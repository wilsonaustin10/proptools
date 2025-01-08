import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import { db } from '../../db';
import { tools } from '../../db/schema';
import supertest from 'supertest';
import { createApp } from '../../server';
import { sql, eq, like } from 'drizzle-orm';

// Mock the database module
vi.mock('../../db', () => {
  const mockDb = {
    select: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
  };

  return { db: mockDb };
});

const { app } = createApp();

const request = supertest(app);

describe('Tool Discovery E2E', () => {
  let testTools;
  
  const mockTools = [
    {
      id: 1,
      name: 'Popular Tool',
      description: 'Most upvoted tool',
      website: 'https://popular.com',
      category: 'Popular',
      upvotes: 100,
    },
    {
      id: 2,
      name: 'New Tool',
      description: 'Recently added tool',
      website: 'https://new.com',
      category: 'New',
      upvotes: 0,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock database responses for tools
    const mockExecute = vi.fn().mockResolvedValue(mockTools);
    const mockWhere = vi.fn().mockReturnValue({ execute: mockExecute });
    const mockFrom = vi.fn().mockReturnValue({ 
      where: mockWhere,
      execute: mockExecute,
      orderBy: vi.fn().mockReturnValue({ execute: mockExecute })
    });
    
    // Setup mocks with proper types
    vi.mocked(db.select).mockImplementation(() => ({ 
      from: mockFrom,
      where: mockWhere,
      orderBy: vi.fn().mockReturnValue({ execute: mockExecute }),
      execute: mockExecute
    }) as any);
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
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body.some(tool => tool.name.includes('Popular'))).toBe(true);
    });
  });
});
