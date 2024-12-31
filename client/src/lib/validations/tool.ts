import { z } from "zod";

export const toolSchema = z.object({
  name: z.string().min(1, "Tool name is required"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  website: z.string().url("Must be a valid URL"),
  category: z.string().min(1, "Category is required"),
  logo: z.string().optional(),
});

export type ToolForm = z.infer<typeof toolSchema>;
export type NewTool = ToolForm; 