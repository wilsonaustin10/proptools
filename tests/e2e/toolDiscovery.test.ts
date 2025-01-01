import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '@db';
import { tools, users } from '@db/schema';
import supertest from 'supertest';
import { app } from '../../server';

const request = supertest(app);

describe('Tool Discovery E2E', () => {
  let testTools;
  
  beforeAll(async () => {
    // Create test tools
    testTools = await db.insert(tools).values([
      {
        name: 'Popular Tool',
        description: 'Most upvoted tool',
        website: 'https://popular.com',
        category: 'Popular',
        upvotes: 100,
      },
      {
        name: 'New Tool',
        description: 'Recently added tool',
        website: 'https://new.com',
        category: 'New',
        upvotes: 0,
      },
    ]).returning();
  });

  afterAll(async () => {
    // Clean up test data
    await db.delete(tools).where(tool => 
      tool.id.in(testTools.map(t => t.id))
    );
  });

  describe('Tool Browsing', () => {
    it('should list tools ordered by upvotes', async () => {
      const response = await request.get('/api/tools');
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      
      const popularToolIndex = response.body.findIndex(
        tool => tool.name === 'Popular Tool'
      );
      const newToolIndex = response.body.findIndex(
        tool => tool.name === 'New Tool'
      );
      
      expect(popularToolIndex).toBeLessThan(newToolIndex);
    });

    it('should filter tools by category', async () => {
      const response = await request.get('/api/tools/category/Popular');
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0].category).toBe('Popular');
    });

    it('should search tools by name', async () => {
      const response = await request.get('/api/tools/search?q=Popular');
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.some(tool => tool.name.includes('Popular'))).toBe(true);
    });
  });
});
