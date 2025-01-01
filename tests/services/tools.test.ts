import { describe, it, expect } from 'vitest';
import { db } from '@db';
import { tools, type Tool } from '@db/schema';

describe('Tools Service', () => {
  describe('Tool Creation', () => {
    it('should create a new tool with valid data', async () => {
      const toolData = {
        name: 'Test Tool',
        description: 'A tool for testing',
        website: 'https://test.com',
        category: 'Testing',
      };

      const [newTool] = await db.insert(tools).values(toolData).returning();

      expect(newTool).toHaveProperty('id');
      expect(newTool.name).toBe(toolData.name);
      expect(newTool.description).toBe(toolData.description);

      // Clean up
      await db.delete(tools).where({ id: newTool.id });
    });
  });

  describe('Tool Queries', () => {
    let testTool: Tool;

    beforeAll(async () => {
      [testTool] = await db.insert(tools).values({
        name: 'Query Test Tool',
        description: 'Tool for testing queries',
        website: 'https://querytest.com',
        category: 'Testing',
      }).returning();
    });

    afterAll(async () => {
      await db.delete(tools).where({ id: testTool.id });
    });

    it('should find tool by id', async () => {
      const [found] = await db.select().from(tools).where({ id: testTool.id });
      expect(found).toBeDefined();
      expect(found.name).toBe('Query Test Tool');
    });

    it('should find tools by category', async () => {
      const results = await db.select().from(tools).where({ category: 'Testing' });
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(tool => tool.id === testTool.id)).toBe(true);
    });
  });
});
