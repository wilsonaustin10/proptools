import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import { sql } from 'drizzle-orm';

// Create an in-memory SQLite database
const sqlite = new Database(':memory:', { verbose: console.log });

// Create the database connection
export const db = drizzle(sqlite, { schema });

// Initialize tables
export function initializeDatabase() {
  // Create tables
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      is_admin INTEGER NOT NULL DEFAULT 0,
      is_verified INTEGER NOT NULL DEFAULT 0,
      verification_token TEXT,
      verification_token_expiry INTEGER,
      created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tools (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      website TEXT NOT NULL,
      categories TEXT NOT NULL,
      logo TEXT,
      pricing TEXT,
      upvotes INTEGER DEFAULT 0,
      featured INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS upvotes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      tool_id INTEGER REFERENCES tools(id),
      vote_type INTEGER NOT NULL DEFAULT 1,
      category TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (tool_id) REFERENCES tools(id)
    );

    CREATE INDEX IF NOT EXISTS idx_upvotes_category_created_at ON upvotes(category, created_at);
  `);
}

// Initialize the database when this module is imported
initializeDatabase();
