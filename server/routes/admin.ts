import { Router } from 'express';
import { tools } from '@db/schema';
import { db } from '@db';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '../middleware/rbac';
import { z } from 'zod';
import { TOOL_CATEGORIES } from '@/lib/constants';

const router = Router();

// Schema for mass upload
const massUploadSchema = z.array(z.object({
  name: z.string().min(1, "Tool name is required"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  website: z.string().url("Must be a valid URL"),
  categories: z.array(z.enum(TOOL_CATEGORIES)).min(1, "At least one category is required"),
  logo: z.string().optional(),
  pricing: z.string().optional(),
  featured: z.boolean().optional(),
  upvotes: z.number().optional(),
}));

// Delete a tool (admin only)
router.delete('/tools/:id', requireAdmin, async (req, res) => {
  try {
    const toolId = parseInt(req.params.id);
    if (isNaN(toolId)) {
      return res.status(400).json({ error: "Invalid tool ID" });
    }

    const [deletedTool] = await db
      .delete(tools)
      .where(eq(tools.id, toolId))
      .returning();

    if (!deletedTool) {
      return res.status(404).json({ error: "Tool not found" });
    }

    res.json({ message: "Tool deleted successfully", tool: deletedTool });
  } catch (error) {
    console.error('Error deleting tool:', error);
    res.status(500).json({ error: "Failed to delete tool" });
  }
});

// Mass upload tools (admin only)
router.post('/tools/mass', requireAdmin, async (req, res) => {
  try {
    const result = massUploadSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ 
        error: "Invalid input", 
        details: result.error.issues.map(i => i.message).join(", ")
      });
    }

    const newTools = await db
      .insert(tools)
      .values(result.data)
      .returning();

    res.json({ 
      message: `Successfully uploaded ${newTools.length} tools`,
      tools: newTools
    });
  } catch (error) {
    console.error('Error mass uploading tools:', error);
    res.status(500).json({ error: "Failed to mass upload tools" });
  }
});

export default router;
