import nodemailer from 'nodemailer';
import { randomBytes } from 'crypto';
import { db } from '@db';
import { users } from '@db/schema';
import { eq } from 'drizzle-orm';

// Create a test account if no SMTP settings are provided
const createTestAccount = async () => {
  console.log('Creating test email account...');
  try {
    const testAccount = await nodemailer.createTestAccount();
    console.log('Test account created:', testAccount.user);
    return nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
  } catch (error) {
    console.error('Error creating test account:', error);
    throw error;
  }
};

// Create transporter based on environment
const createTransporter = async () => {
  console.log('Creating email transporter...');
  if (process.env.SMTP_HOST) {
    console.log('Using configured SMTP settings');
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  console.log('No SMTP settings found, using test account');
  return createTestAccount();
};

export const emailService = {
  async sendVerificationEmail(userId: number, email: string) {
    try {
      console.log('Starting email verification process for user:', userId, 'email:', email);
      
      // Generate verification token
      const token = randomBytes(32).toString('hex');
      const expiry = new Date();
      expiry.setHours(expiry.getHours() + 24);
      
      console.log('Generated verification token:', token);

      // Update user with verification token
      await db
        .update(users)
        .set({
          verificationToken: token,
          verificationTokenExpiry: expiry,
        })
        .where(eq(users.id, userId));
        
      console.log('Updated user with verification token');

      // Create verification URL
      const verificationUrl = `${process.env.APP_URL || 'http://localhost:5001'}/api/verify-email?token=${token}`;
      console.log('Verification URL:', verificationUrl);

      // Send email
      const transporter = await createTransporter();
      console.log('Created email transporter');
      
      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || '"PropTools" <noreply@proptools.co>',
        to: email,
        subject: "Verify your email address",
        text: `Please verify your email address by clicking the following link: ${verificationUrl}`,
        html: `
          <h1>Welcome to PropTools!</h1>
          <p>Please verify your email address by clicking the button below:</p>
          <a href="${verificationUrl}" style="display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
            Verify Email
          </a>
          <p>Or copy and paste this link into your browser:</p>
          <p>${verificationUrl}</p>
          <p>This link will expire in 24 hours.</p>
        `,
      });

      // Always log the preview URL
      const previewUrl = nodemailer.getTestMessageUrl(info);
      console.log('Email sent successfully');
      console.log('Preview URL:', previewUrl);
      console.log('Message ID:', info.messageId);

      return true;
    } catch (error) {
      console.error('Detailed error sending verification email:', error);
      return false;
    }
  },

  async verifyEmail(token: string) {
    try {
      // Find user with matching token that hasn't expired
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.verificationToken, token))
        .limit(1);

      if (!user) {
        return { success: false, message: 'Invalid verification token' };
      }

      if (user.verificationTokenExpiry && user.verificationTokenExpiry < new Date()) {
        return { success: false, message: 'Verification token has expired' };
      }

      // Update user as verified
      await db
        .update(users)
        .set({
          isVerified: true,
          verificationToken: null,
          verificationTokenExpiry: null,
        })
        .where(eq(users.id, user.id));

      return { success: true, message: 'Email verified successfully' };
    } catch (error) {
      console.error('Error verifying email:', error);
      return { success: false, message: 'Error verifying email' };
    }
  }
}; 