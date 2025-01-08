import express, { type Express, Router } from "express";
import { db } from "@db";
import { tools, upvotes, users, insertToolSchema, reviews, helpfulVotes, insertReviewSchema, groups, groupMembers, insertGroupSchema } from "@db/schema";
import { eq, desc, sql, and } from "drizzle-orm";
import { DatabaseError } from "../shared/errors/database";
import { emailService } from './services/email';
import bcrypt from 'bcrypt';

declare module 'express-session' {
  interface SessionData {
    userId: number;
  }
}

export function registerRoutes(app: Express): Router {
  if (!app) throw new Error("Express app is required");
  console.log('Registering routes...');
  // Create router for API routes
  const router = Router();
  console.log('Setting up routes with Router...');
  
  // Note: Routes will be mounted under /api prefix in server/index.ts

  // Add a new tool (admin only)
  router.post("/tools", async (req, res) => {
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
  router.get("/tools", async (_req, res) => {
    try {
      const allTools = await db.query.tools.findMany({
        orderBy: [desc(tools.upvotes)],
      });
      res.json(allTools);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tools" });
    }
  });

  // Search tools
  router.get("/tools/search", async (req, res) => {
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

  // Get tools by category
  router.get("/tools/category/:category", async (req, res) => {
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

  // Get a single tool by ID
  router.get("/tools/:id", async (req, res) => {
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

  // Upvote a tool
  router.post("/tools/:id/upvote", async (req, res) => {
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
  router.get('/verify-email', async (req, res) => {
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

  // Tool comparison endpoint
  router.get("/tools/compare", async (req, res) => {
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
  router.put("/admin/users/:id/verify", async (req, res) => {
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
  router.post("/groups", async (req, res) => {
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
  router.get("/groups", async (_req, res) => {
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

  router.get("/groups/:id", async (req, res) => {
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

  router.post("/groups/:id/join", async (req, res) => {
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
  console.log('Setting up review routes...');

  // Create a review
  router.post("/reviews", async (req, res, next) => {
    // Check authentication
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Must be logged in to write a review" });
    }

    try {
      if (!req.body || typeof req.body !== 'object') {
        console.error('Invalid request body:', req.body);
        return res.status(400).json({ error: "Invalid request body" });
      }

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

      const newReview = await db.transaction(async (tx) => {
        // Check if tool exists
        const tool = await tx.query.tools.findFirst({
          where: eq(tools.id, reviewData.toolId)
        });

        if (!tool) {
          throw new DatabaseError("Tool not found", "NOT_FOUND");
        }

        // Check for existing review
        const existingReview = await tx.query.reviews.findFirst({
          where: and(
            eq(reviews.userId, reviewData.userId),
            eq(reviews.toolId, reviewData.toolId)
          )
        });

        if (existingReview) {
          throw new DatabaseError("You have already reviewed this tool", "CONFLICT");
        }

        const insertResult = await tx.insert(reviews)
          .values(reviewData)
          .returning();
        
        if (!insertResult || insertResult.length === 0) {
          throw new DatabaseError("Failed to create review", "INTERNAL_ERROR");
        }
        
        return insertResult[0];
      });

      res.json(newReview);
    } catch (error) {
      // Let the global error handler handle DatabaseErrors
      next(error);
    }
  });

  // Get reviews for a tool
  router.get("/reviews/tool/:toolId", async (req, res, next) => {
    try {
      const toolId = parseInt(req.params.toolId);
      if (isNaN(toolId)) {
        return res.status(400).json({ error: "Invalid tool ID" });
      }

      const result = await db.transaction(async (tx) => {
        // Check if tool exists
        const tool = await tx.query.tools.findFirst({
          where: eq(tools.id, toolId)
        });

        if (!tool) {
          throw new DatabaseError("Tool not found", "NOT_FOUND");
        }

        const reviewsList = await tx.query.reviews.findMany({
          where: eq(reviews.toolId, toolId),
          with: {
            user: true,
          },
          orderBy: [desc(reviews.helpfulCount), desc(reviews.createdAt)],
        });
        
        return reviewsList || [];
      });
      
      res.json(result);
    } catch (error) {
      // Let the global error handler handle DatabaseErrors
      next(error);
    }
  });

  // Update a review
  router.put("/reviews/:id", async (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Must be logged in to update a review" });
    }

    try {
      const reviewId = parseInt(req.params.id);
      if (isNaN(reviewId)) {
        return res.status(400).json({ error: "Invalid review ID" });
      }

      const validationResult = insertReviewSchema.safeParse({
        ...req.body,
        userId: req.user!.id,
        toolId: 1 // Use a dummy value since we don't need to validate toolId for updates
      });
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid input: " + validationResult.error.issues.map(i => i.message).join(", ") 
        });
      }

      type ReviewUpdate = Partial<typeof reviews.$inferInsert>;
      const reviewData: ReviewUpdate = {
        rating: validationResult.data.rating,
        content: validationResult.data.content,
        pros: validationResult.data.pros,
        cons: validationResult.data.cons,
      };

      const updatedReview = await db.transaction(async (tx) => {
        const review = await tx.query.reviews.findFirst({
          where: eq(reviews.id, reviewId)
        });

        if (!review) {
          throw new DatabaseError("Review not found", "NOT_FOUND");
        }

        if (review.userId !== req.user!.id) {
          throw new DatabaseError("Can only update your own reviews", "FORBIDDEN");
        }

        const updateResult = await tx
          .update(reviews)
          .set(reviewData)
          .where(eq(reviews.id, review.id))
          .returning();

        if (!updateResult || updateResult.length === 0) {
          throw new DatabaseError("Failed to update review", "INTERNAL_ERROR");
        }
        
        return updateResult[0];
      });

      res.json(updatedReview);
    } catch (error) {
      // Let the global error handler handle DatabaseErrors
      next(error);
    }
  });

  // Delete a review
  router.delete("/reviews/:id", async (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Must be logged in to delete a review" });
    }

    const reviewId = parseInt(req.params.id);
    if (isNaN(reviewId)) {
      return res.status(400).json({ error: "Invalid review ID" });
    }

    try {
      // Delete review and helpful votes in a transaction
      const deletedReview = await db.transaction(async (tx) => {
        // Check if review exists and user has permission inside transaction
        const existingReview = await tx.query.reviews.findFirst({
          where: eq(reviews.id, reviewId)
        });

        if (!existingReview) {
          throw new DatabaseError("Review not found", "NOT_FOUND");
        }

        if (existingReview.userId !== req.user!.id && !req.user?.isAdmin) {
          throw new DatabaseError("Can only delete your own reviews", "FORBIDDEN");
        }

        // Delete helpful votes first
        await tx
          .delete(helpfulVotes)
          .where(eq(helpfulVotes.reviewId, reviewId));

        // Then delete the review
        const deleted = await tx
          .delete(reviews)
          .where(eq(reviews.id, reviewId))
          .returning();

        if (!deleted || deleted.length === 0) {
          throw new DatabaseError("Failed to delete review", "INTERNAL_ERROR");
        }

        return deleted[0];
      });

      res.json(deletedReview);
    } catch (error: unknown) {
      // Log detailed error information for DELETE /reviews/:id
      console.error('Error in DELETE /reviews/:id:', {
        error,
        stack: error instanceof Error ? error.stack : undefined,
        reviewId,
        userId: req.user?.id,
        isAuthenticated: req.isAuthenticated(),
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        isDatabaseError: error instanceof DatabaseError,
        errorCode: error instanceof DatabaseError ? error.code : undefined,
        errorMessage: error instanceof Error ? error.message : String(error)
      });
      next(error);
    }
  });

  // Mark a review as helpful
  router.post("/reviews/:id/helpful", async (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Must be logged in to mark reviews as helpful" });
    }

    const reviewId = parseInt(req.params.id);
    if (isNaN(reviewId)) {
      return res.status(400).json({ error: "Invalid review ID" });
    }

    const userId = req.user!.id;

    try {
      // Create helpful vote and update review count in a transaction
      const result = await db.transaction(async (tx) => {
        // Check if review exists inside transaction
        const existingReview = await tx.query.reviews.findFirst({
          where: eq(reviews.id, reviewId)
        });

        if (!existingReview) {
          throw new DatabaseError("Review not found", "NOT_FOUND");
        }

        // Check if user has already marked this review as helpful
        const existingVote = await tx.query.helpfulVotes.findFirst({
          where: and(
            eq(helpfulVotes.userId, userId),
            eq(helpfulVotes.reviewId, reviewId)
          )
        });

        if (existingVote) {
          throw new DatabaseError("Already marked as helpful", "CONFLICT");
        }

        // Create helpful vote
        const insertResult = await tx.insert(helpfulVotes)
          .values({
            userId,
            reviewId,
          })
          .returning();

        if (!insertResult || insertResult.length === 0) {
          throw new DatabaseError("Failed to record helpful vote", "INTERNAL_ERROR");
        }

        // Increment review's helpful count
        const updateResult = await tx.update(reviews)
          .set({ helpfulCount: sql`${reviews.helpfulCount} + 1` })
          .where(eq(reviews.id, reviewId))
          .returning();

        if (!updateResult || updateResult.length === 0) {
          throw new DatabaseError("Failed to update review helpful count", "INTERNAL_ERROR");
        }

        return updateResult[0];
      });

      res.json(result);
    } catch (error: unknown) {
      // Log detailed error information for POST /reviews/:id/helpful
      console.error('Error in POST /reviews/:id/helpful:', {
        error,
        stack: error instanceof Error ? error.stack : undefined,
        reviewId,
        userId,
        isAuthenticated: req.isAuthenticated(),
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        isDatabaseError: error instanceof DatabaseError,
        errorCode: error instanceof DatabaseError ? error.code : undefined,
        errorMessage: error instanceof Error ? error.message : String(error)
      });
      next(error);
    }
  });

  // Log all registered routes for debugging
  console.log('Routes registered on router:', router.stack
    .filter((r: any) => r.route)
    .map((r: any) => {
      const methods = Object.keys(r.route.methods || {});
      return `${methods.join(',')} ${r.route.path}`;
    })
    .join('\n'));

  return router;
}
