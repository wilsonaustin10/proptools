ALTER TABLE "users" ADD COLUMN "is_verified" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "verification_token" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "verification_token_expiry" timestamp;