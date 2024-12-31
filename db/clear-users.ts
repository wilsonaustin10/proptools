import { db } from "@db";
import { users } from "@db/schema";

async function clearUsers() {
  try {
    console.log('Clearing users table...');
    await db.delete(users);
    console.log('Users table cleared successfully');
  } catch (error) {
    console.error('Error clearing users table:', error);
  } finally {
    process.exit();
  }
}

clearUsers(); 