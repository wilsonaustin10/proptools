import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { db } from "@db";
import { users } from "@db/schema";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function createAdmin() {
  const hashedPassword = await hashPassword("Admin@12345");
  
  await db.insert(users).values({
    username: "admin@proptools.co",
    password: hashedPassword,
    firstName: "Admin",
    lastName: "User",
    email: "admin@proptools.co",
    isAdmin: true,
  });
  
  console.log("Admin user created successfully");
}

createAdmin().catch(console.error);
