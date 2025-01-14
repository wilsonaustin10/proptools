import { sqliteTable, text, integer, type AnyColumn } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations, sql } from "drizzle-orm";
import { z } from "zod";
import type { TableConfig, Column } from "drizzle-orm";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull().unique(),
  isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
  isVerified: integer("is_verified", { mode: "boolean" }).notNull().default(false),
  verificationToken: text("verification_token"),
  verificationTokenExpiry: integer("verification_token_expiry"),
  createdAt: integer("created_at").notNull().default(Date.now()),
});

export const tools = sqliteTable("tools", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description").notNull(),
  website: text("website").notNull(),
  categories: text("categories").notNull(), // Stored as JSON string
  logo: text("logo"),
  pricing: text("pricing"),
  upvotes: integer("upvotes").default(0),
  featured: integer("featured", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at").notNull().default(Date.now()),
});

export const upvotes = sqliteTable("upvotes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").references(() => users.id),
  toolId: integer("tool_id").references(() => tools.id),
  voteType: integer("vote_type", { mode: "boolean" }).notNull().default(true),
  category: text("category").notNull(),
  createdAt: integer("created_at").notNull().default(Date.now()),
});

export const toolsRelations = relations(tools as any, ({ many }) => ({
  upvotes: many(upvotes as any),
}));

export const usersRelations = relations(users as any, ({ many }) => ({
  upvotes: many(upvotes as any),
}));

export const upvotesRelations = relations(upvotes as any, ({ one }) => ({
  user: one(users as any, {
    fields: [upvotes.userId],
    references: [users.id],
  }),
  tool: one(tools as any, {
    fields: [upvotes.toolId],
    references: [tools.id],
  }),
}));

// Enhanced validation schema for user
export const insertUserSchema = createInsertSchema(users, {
  email: z.string().email("Invalid email address"),
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const selectUserSchema = createSelectSchema(users);
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export const insertToolSchema = createInsertSchema(tools);
export const selectToolSchema = createSelectSchema(tools);
export type Tool = typeof tools.$inferSelect;
export type NewTool = typeof tools.$inferInsert;
