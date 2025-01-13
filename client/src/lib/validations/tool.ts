import { z } from "zod";
import { TOOL_CATEGORIES } from "@/lib/constants";
import { tools } from "@db/schema";

export const toolSchema = z.object({
  name: z.string().min(1, "Tool name is required"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  website: z.string().url("Must be a valid URL"),
  categories: z.array(z.enum(TOOL_CATEGORIES)).min(1, "At least one category is required"),
  logo: z.string().optional(),
  pricing: z.string().optional(),
});

export type ToolForm = z.infer<typeof toolSchema>;
export type NewTool = typeof tools.$inferInsert;            