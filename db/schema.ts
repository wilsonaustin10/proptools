import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").unique().notNull(),
  password: text("password").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").unique().notNull(),
  isAdmin: boolean("is_admin").default(false),
  isVerified: boolean("is_verified").default(false),
  verificationToken: text("verification_token"),
  verificationTokenExpiry: timestamp("verification_token_expiry"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const tools = pgTable("tools", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  website: text("website").notNull(),
  category: text("category").notNull(),
  logo: text("logo"),
  upvotes: integer("upvotes").default(0),
  featured: boolean("featured").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const upvotes = pgTable("upvotes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  toolId: integer("tool_id").references(() => tools.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const toolsRelations = relations(tools, ({ many }) => ({
  upvotes: many(upvotes),
}));

export const usersRelations = relations(users, ({ many }) => ({
  upvotes: many(upvotes),
}));

export const upvotesRelations = relations(upvotes, ({ one }) => ({
  user: one(users, {
    fields: [upvotes.userId],
    references: [users.id],
  }),
  tool: one(tools, {
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