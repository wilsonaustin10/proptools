import { db } from './index';
import { tools, users } from './schema';
import bcrypt from 'bcrypt';

async function seed() {
  try {
    // Create admin user
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const [admin] = await db.insert(users).values({
      username: 'admin',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@proptools.co',
      isAdmin: true
    }).returning();

    console.log('Created admin user:', admin);

    // Create some initial tools
    const initialTools = [
      {
        name: 'Zillow',
        description: 'Real estate marketplace and data platform',
        website: 'https://www.zillow.com',
        category: 'marketplace',
        logo: 'https://logo.clearbit.com/zillow.com',
        featured: true,
        upvotes: 0
      },
      {
        name: 'Redfin',
        description: 'Real estate brokerage and search platform',
        website: 'https://www.redfin.com',
        category: 'marketplace',
        logo: 'https://logo.clearbit.com/redfin.com',
        featured: true,
        upvotes: 0
      },
      {
        name: 'Realtor.com',
        description: 'Real estate listings and market insights',
        website: 'https://www.realtor.com',
        category: 'marketplace',
        logo: 'https://logo.clearbit.com/realtor.com',
        featured: false,
        upvotes: 0
      }
    ];

    const createdTools = await db.insert(tools).values(initialTools).returning();
    console.log('Created initial tools:', createdTools);

    console.log('Seeding completed successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

seed(); 