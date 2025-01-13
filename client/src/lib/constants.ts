export const TOOL_CATEGORIES = [
  "marketing",
  "lead generation",
  "real estate data",
  "crm",
  "mastermind",
  "education",
  "communications",
] as const;

export type ToolCategory = typeof TOOL_CATEGORIES[number];
