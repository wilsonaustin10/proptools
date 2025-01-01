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

export const usersRelations = relations(users, ({ many }: { many: any }) => ({
  upvotes: many(upvotes),
  reviews: many(reviews),
  helpfulVotes: many(helpfulVotes),
}));

export const upvotesRelations = relations(upvotes, ({ one }: { one: any }) => ({
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

export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  toolId: integer("tool_id").references(() => tools.id).notNull(),
  rating: integer("rating").notNull(),
  content: text("content").notNull(),
  pros: text("pros").notNull(),
  cons: text("cons").notNull(),
  helpfulCount: integer("helpful_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const helpfulVotes = pgTable("helpful_votes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  reviewId: integer("review_id").references(() => reviews.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const reviewsRelations = relations(reviews, ({ one, many }: { one: any; many: any }) => ({
  user: one(users, {
    fields: [reviews.userId],
    references: [users.id],
  }),
  tool: one(tools, {
    fields: [reviews.toolId],
    references: [tools.id],
  }),
  helpfulVotes: many(helpfulVotes),
}));

export const helpfulVotesRelations = relations(helpfulVotes, ({ one }: { one: any }) => ({
  user: one(users, {
    fields: [helpfulVotes.userId],
    references: [users.id],
  }),
  review: one(reviews, {
    fields: [helpfulVotes.reviewId],
    references: [reviews.id],
  }),
}));



export const groups = pgTable("groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  createdById: integer("created_by_id").references(() => users.id).notNull(),
});

export const groupMembers = pgTable("group_members", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").references(() => groups.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  joinedAt: timestamp("joined_at").defaultNow(),
});

export const groupsRelations = relations(groups, ({ one, many }) => ({
  creator: one(users, {
    fields: [groups.createdById],
    references: [users.id],
  }),
  members: many(groupMembers),
}));

export const groupMembersRelations = relations(groupMembers, ({ one }) => ({
  group: one(groups, {
    fields: [groupMembers.groupId],
    references: [groups.id],
  }),
  user: one(users, {
    fields: [groupMembers.userId],
    references: [users.id],
  }),
}));

export const insertGroupSchema = createInsertSchema(groups, {
  name: z.string().min(3, "Group name must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
});

export const insertReviewSchema = createInsertSchema(reviews, {
  rating: z.number().min(1).max(5),
  content: z.string().min(10, "Review must be at least 10 characters"),
  pros: z.string().min(1, "Must include at least one pro"),
  cons: z.string().min(1, "Must include at least one con"),
});

export const selectReviewSchema = createSelectSchema(reviews);
export type Review = typeof reviews.$inferSelect;
export type NewReview = typeof reviews.$inferInsert;
