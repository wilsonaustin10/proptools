import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import adminRoutes from "./routes/admin";
import { db } from "@db";
import { tools, upvotes, users, insertToolSchema, type Tool } from "@db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { emailService } from './services/email';
import { extractMetadata } from './services/metadata';
import bcrypt from 'bcrypt';

interface Vote {
  id: number;
  userId: number;
  toolId: number;
  voteType: boolean;
  category: string;
  createdAt: Date;
}

interface ToolWithVotes extends Tool {
  upvotes: Vote[];
}

declare module 'express-session' {
  interface SessionData {
    userId: number;
  }
}

export function registerRoutes(app: Express): Server {
  setupAuth(app);
  app.use('/api', adminRoutes);

  // Add a new tool (any authenticated user)
  app.post("/api/tools", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Must be logged in to submit tools" });
    }

    try {
      const result = insertToolSchema.safeParse(req.body);
      if (!result.success) {
        return res
          .status(400)
          .json({ error: "Invalid input: " + result.error.issues.map(i => i.message).join(", ") });
      }

      // Extract metadata from website
      const metadata = await extractMetadata(result.data.website);
      
      const toolData = {
        ...result.data,
        description: result.data.description.trim() || metadata.description || "No description available yet",
        logo: result.data.logo || metadata.logo,
        pricing: metadata.pricing || `See ${result.data.website} for more information`
      };

      const [newTool] = await db
        .insert(tools)
        .values(toolData)
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

  // Vote on a tool in a specific category
  app.post("/api/tools/:id/vote", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Must be logged in to vote" });
    }

    const { category, voteType } = req.body;
    if (!category || typeof voteType !== 'boolean') {
      return res.status(400).json({ error: "Category and vote type are required" });
    }

    const toolId = parseInt(req.params.id);
    const userId = req.user!.id;

    try {
      // Check if user has already voted in this category
      const [existingVote] = await db
        .select()
        .from(upvotes)
        .where(sql`${upvotes.userId} = ${userId} AND ${upvotes.toolId} = ${toolId} AND ${upvotes.category} = ${category}`)
        .limit(1);

      if (existingVote) {
        return res.status(400).json({ error: "Already voted in this category" });
      }

      // Create vote
      await db.insert(upvotes).values({ 
        userId, 
        toolId,
        category,
        voteType,
      });

      res.json({ message: "Vote successful" });
    } catch (error) {
      res.status(500).json({ error: "Failed to vote" });
    }
  });

  // Get tool rankings by category with time decay
  app.get("/api/rankings", async (req, res) => {
    try {
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

      // Calculate rankings with time decay
      const rankings = await db.query.tools.findMany({
        with: {
          upvotes: {
            where: sql`${upvotes.createdAt} >= ${threeMonthsAgo}`,
          },
        },
      });

      // Process rankings with time decay
      const categoryRankings = rankings.reduce((acc, tool) => {
        const now = new Date();
        
        // Calculate score for each category
        tool.categories.forEach(category => {
          const categoryVotes = tool.upvotes.filter(vote => vote.category === category);
          
          // Calculate weighted score based on vote age
          const score = categoryVotes.reduce((sum, vote) => {
            const ageInDays = (now.getTime() - vote.createdAt.getTime()) / (1000 * 60 * 60 * 24);
            const weight = Math.max(0, 1 - (ageInDays / 90)); // Linear decay over 90 days
            return sum + (vote.voteType ? weight : -weight);
          }, 0);

          if (!acc[category]) {
            acc[category] = [];
          }

          acc[category].push({
            id: tool.id,
            name: tool.name,
            score,
            description: tool.description,
            website: tool.website,
            logo: tool.logo,
          });
        });

        return acc;
      }, {} as Record<string, Array<{
        id: number;
        name: string;
        score: number;
        description: string;
        website: string;
        logo?: string;
      }>>);

      // Sort each category by score
      Object.keys(categoryRankings).forEach(category => {
        categoryRankings[category].sort((a, b) => b.score - a.score);
      });

      res.json(categoryRankings);
    } catch (error) {
      console.error('Error fetching rankings:', error);
      res.status(500).json({ error: "Failed to fetch rankings" });
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
  return httpServer;
}
