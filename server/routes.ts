import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { db } from "@db";
import { tools, upvotes, insertToolSchema } from "@db/schema";
import { eq, desc, sql } from "drizzle-orm";

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

  const httpServer = createServer(app);
  return httpServer;
}