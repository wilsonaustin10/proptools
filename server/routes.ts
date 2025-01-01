import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { db } from "@db";
import { tools, upvotes, users, insertToolSchema, reviews, helpfulVotes, insertReviewSchema, groups, groupMembers, insertGroupSchema } from "@db/schema";
import { eq, desc, sql, and } from "drizzle-orm";
import { emailService } from './services/email';
import bcrypt from 'bcrypt';

declare module 'express-session' {
  interface SessionData {
    userId: number;
  }
}

export function registerRoutes(app: Express): Server {
  setupAuth(app);

  // Add a new tool (admin only)
  app.post("/api/tools", async (req, res) => {
    if (!req.isAuthenticated() || !req.user?.isAdmin) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const result = insertToolSchema.safeParse(req.body);
      if (!result.success) {
        return res
          .status(400)
          .json({ error: "Invalid input: " + result.error.issues.map(i => i.message).join(", ") });
      }

      const [newTool] = await db
        .insert(tools)
        .values(result.data)
        .returning();

      res.json(newTool);
    } catch (error) {
      res.status(500).json({ error: "Failed to create tool" });
    }
  });

  // Get all tools
  app.get("/api/tools", async (_req, res) => {
    try {
      const allTools = await db.query.tools.findMany({
        orderBy: [desc(tools.upvotes)],
      });
      res.json(allTools);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tools" });
    }
  });

  // Get a single tool by ID
  app.get("/api/tools/:id", async (req, res) => {
    try {
      const [tool] = await db.query.tools.findMany({
        where: eq(tools.id, parseInt(req.params.id)),
        limit: 1,
      });

      if (!tool) {
        return res.status(404).json({ error: "Tool not found" });
      }

      res.json(tool);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tool details" });
    }
  });

  // Get tools by category
  app.get("/api/tools/category/:category", async (req, res) => {
    try {
      const categoryTools = await db.query.tools.findMany({
        where: eq(tools.category, req.params.category),
        orderBy: [desc(tools.upvotes)],
      });
      res.json(categoryTools);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tools by category" });
    }
  });

  // Search tools
  app.get("/api/tools/search", async (req, res) => {
    const query = req.query.q as string;
    try {
      const searchResults = await db.query.tools.findMany({
        where: sql`${tools.name} ILIKE ${`%${query}%`} OR ${
          tools.description
        } ILIKE ${`%${query}%`}`,
      });
      res.json(searchResults);
    } catch (error) {
      res.status(500).json({ error: "Failed to search tools" });
    }
  });

  // Upvote a tool
  app.post("/api/tools/:id/upvote", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Must be logged in to upvote" });
    }

    const toolId = parseInt(req.params.id);
    const userId = req.user!.id;

    try {
      // Check if user has already upvoted
      const [existingUpvote] = await db
        .select()
        .from(upvotes)
        .where(sql`${upvotes.userId} = ${userId} AND ${upvotes.toolId} = ${toolId}`)
        .limit(1);

      if (existingUpvote) {
        return res.status(400).json({ error: "Already upvoted" });
      }

      // Create upvote and increment tool's upvote count
      await db.transaction(async (tx) => {
        await tx.insert(upvotes).values({ userId, toolId });
        await tx
          .update(tools)
          .set({ upvotes: sql`${tools.upvotes} + 1` })
          .where(eq(tools.id, toolId));
      });

      res.json({ message: "Upvote successful" });
    } catch (error) {
      res.status(500).json({ error: "Failed to upvote" });
    }
  });

  // Email verification endpoint
  app.get('/api/verify-email', async (req, res) => {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ success: false, message: 'Invalid token' });
    }

    const result = await emailService.verifyEmail(token);
    if (result.success) {
      return res.redirect('/auth?verified=true');
    } else {
      return res.redirect('/auth?verified=false&message=' + encodeURIComponent(result.message));
    }
  });

  const httpServer = createServer(app);

  // Tool comparison endpoint
  app.get("/api/tools/compare", async (req, res) => {
    try {
      const toolIds = (req.query.ids as string || "").split(",").map(id => parseInt(id));
      
      if (!toolIds.length || toolIds.some(isNaN)) {
        return res.status(400).json({ error: "Invalid tool IDs provided" });
      }

      const toolsToCompare = await db.query.tools.findMany({
        where: sql`${tools.id} IN (${sql.join(toolIds, sql`, `)})`,
        with: {
          upvotes: true,
        },
      });

      if (toolsToCompare.length !== toolIds.length) {
        return res.status(404).json({ error: "One or more tools not found" });
      }

      res.json(toolsToCompare);
    } catch (error) {
      console.error("Error comparing tools:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // User verification endpoint (admin only)
  app.put("/api/admin/users/:id/verify", async (req, res) => {
    if (!req.isAuthenticated() || !req.user?.isAdmin) {
      return res.status(401).json({ error: "Unauthorized - Admin access required" });
    }

    try {
      const userId = parseInt(req.params.id);
      const { isVerified } = req.body;

      if (typeof isVerified !== "boolean") {
        return res.status(400).json({ error: "Invalid verification status" });
      }

      const [updatedUser] = await db
        .update(users)
        .set({ isVerified })
        .where(eq(users.id, userId))
        .returning();

      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user verification status:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Create a new group
  app.post("/api/groups", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Must be logged in to create a group" });
    }

    try {
      const validationResult = insertGroupSchema.safeParse(req.body);

      if (!validationResult.success) {
        return res
          .status(400)
          .json({ error: "Invalid input: " + validationResult.error.issues.map(i => i.message).join(", ") });
      }

      type NewGroup = typeof groups.$inferInsert;
      const groupData: NewGroup = {
        name: validationResult.data.name,
        description: validationResult.data.description,
        createdById: req.user!.id,
      };

      const [newGroup] = await db
        .insert(groups)
        .values(groupData)
        .returning();

      // Automatically add creator as a member
      await db.insert(groupMembers).values({
        userId: req.user!.id,
        groupId: newGroup.id,
      });

      res.json(newGroup);
    } catch (error) {
      console.error("Error creating group:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Community Groups endpoints
  app.get("/api/groups", async (_req, res) => {
    try {
      const allGroups = await db.query.groups.findMany({
        with: {
          creator: {
            columns: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
            },
          },
          members: {
            with: {
              user: {
                columns: {
                  id: true,
                  username: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      });

      res.json(allGroups);
    } catch (error) {
      console.error("Error fetching groups:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/groups/:id", async (req, res) => {
    try {
      const group = await db.query.groups.findFirst({
        where: eq(groups.id, parseInt(req.params.id)),
        with: {
          creator: {
            columns: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
            },
          },
          members: {
            with: {
              user: {
                columns: {
                  id: true,
                  username: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      });

      if (!group) {
        return res.status(404).json({ error: "Group not found" });
      }

      res.json(group);
    } catch (error) {
      console.error("Error fetching group:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/groups/:id/join", async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const group = await db.query.groups.findFirst({
        where: eq(groups.id, parseInt(id)),
      });

      if (!group) {
        return res.status(404).json({ error: "Group not found" });
      }

      const existingMembership = await db.query.groupMembers.findFirst({
        where: and(
          eq(groupMembers.userId, userId),
          eq(groupMembers.groupId, parseInt(id))
        ),
      });

      if (existingMembership) {
        return res.status(400).json({ error: "Already a member of this group" });
      }

      await db.insert(groupMembers).values({
        userId,
        groupId: parseInt(id),
      });

      res.status(200).json({ message: "Successfully joined the group" });
    } catch (error) {
      console.error("Error joining group:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  // Create a review
  app.post("/api/reviews", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Must be logged in to write a review" });
    }

    try {
      const validationResult = insertReviewSchema.safeParse({
        ...req.body,
        userId: req.user!.id,
      });

      if (!validationResult.success) {
        return res
          .status(400)
          .json({ error: "Invalid input: " + validationResult.error.issues.map(i => i.message).join(", ") });
      }

      type NewReview = typeof reviews.$inferInsert;
      const reviewData: NewReview = {
        userId: req.user!.id,
        toolId: parseInt(validationResult.data.toolId.toString()),
        rating: validationResult.data.rating,
        content: validationResult.data.content,
        pros: validationResult.data.pros,
        cons: validationResult.data.cons,
        helpfulCount: 0,
      };

      const [newReview] = await db
        .insert(reviews)
        .values(reviewData)
        .returning();

      res.json(newReview);
    } catch (error) {
      res.status(500).json({ error: "Failed to create review" });
    }
  });

  // Get reviews for a tool
  app.get("/api/reviews/tool/:toolId", async (req, res) => {
    try {
      const toolReviews = await db.query.reviews.findMany({
        where: eq(reviews.toolId, parseInt(req.params.toolId)),
        with: {
          user: true,
        },
        orderBy: [desc(reviews.helpfulCount), desc(reviews.createdAt)],
      });
      res.json(toolReviews);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch reviews" });
    }
  });

  // Update a review
  app.put("/api/reviews/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Must be logged in to update a review" });
    }

    try {
      const [review] = await db
        .select()
        .from(reviews)
        .where(eq(reviews.id, parseInt(req.params.id)))
        .limit(1);

      if (!review) {
        return res.status(404).json({ error: "Review not found" });
      }

      if (review.userId !== req.user!.id) {
        return res.status(403).json({ error: "Can only update your own reviews" });
      }

      const validationResult = insertReviewSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res
          .status(400)
          .json({ error: "Invalid input: " + validationResult.error.issues.map(i => i.message).join(", ") });
      }

      type ReviewUpdate = Partial<typeof reviews.$inferInsert>;
      const reviewData: ReviewUpdate = {
        rating: validationResult.data.rating,
        content: validationResult.data.content,
        pros: validationResult.data.pros,
        cons: validationResult.data.cons,
      };

      const [updatedReview] = await db
        .update(reviews)
        .set(reviewData)
        .where(eq(reviews.id, review.id))
        .returning();

      res.json(updatedReview);
    } catch (error) {
      res.status(500).json({ error: "Failed to update review" });
    }
  });

  // Delete a review
  app.delete("/api/reviews/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Must be logged in to delete a review" });
    }

    try {
      const [review] = await db
        .select()
        .from(reviews)
        .where(eq(reviews.id, parseInt(req.params.id)))
        .limit(1);

      if (!review) {
        return res.status(404).json({ error: "Review not found" });
      }

      if (review.userId !== req.user!.id && !req.user?.isAdmin) {
        return res.status(403).json({ error: "Can only delete your own reviews" });
      }

      await db.delete(reviews).where(eq(reviews.id, review.id));

      res.json({ message: "Review deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete review" });
    }
  });

  // Mark a review as helpful
  app.post("/api/reviews/:id/helpful", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Must be logged in to mark reviews as helpful" });
    }

    const reviewId = parseInt(req.params.id);
    const userId = req.user!.id;

    try {
      // Check if user has already marked this review as helpful
      const [existingVote] = await db
        .select()
        .from(helpfulVotes)
        .where(sql`${helpfulVotes.userId} = ${userId} AND ${helpfulVotes.reviewId} = ${reviewId}`)
        .limit(1);

      if (existingVote) {
        return res.status(400).json({ error: "Already marked as helpful" });
      }

      // Create helpful vote and increment review's helpful count
      await db.transaction(async (tx) => {
        await tx.insert(helpfulVotes).values({ userId, reviewId });
        await tx
          .update(reviews)
          .set({ helpfulCount: sql`${reviews.helpfulCount} + 1` })
          .where(eq(reviews.id, reviewId));
      });

      res.json({ message: "Marked as helpful" });
    } catch (error) {
      res.status(500).json({ error: "Failed to mark review as helpful" });
    }
  });

  return httpServer;
}
