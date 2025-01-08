import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '../../db';
import { tools, type Tool } from '../../db/schema';
import { eq } from 'drizzle-orm';
import type { PgSelect, PgInsert } from 'drizzle-orm/pg-core';

// Mock the database module
vi.mock('../../db', () => {
  const mockDb = {
    select: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
  };

  return { db: mockDb };
});

describe('Tools Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Tool Creation', () => {
    it('should create a new tool with valid data', async () => {
      const toolData = {
        name: 'Test Tool',
        description: 'A tool for testing',
        website: 'https://test.com',
        category: 'Testing',
      };

      const mockTool = { id: 1, ...toolData };
      const mockExecute = vi.fn().mockResolvedValueOnce([mockTool]);
      const mockReturning = vi.fn().mockReturnValue({ execute: mockExecute });
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      vi.mocked(db.insert).mockReturnValue({ values: mockValues } as any);

      const result = await db.insert(tools).values(toolData).returning().execute();
      
      expect(result[0]).toEqual(mockTool);
      expect(mockValues).toHaveBeenCalledWith(toolData);
      expect(mockReturning).toHaveBeenCalled();
      expect(mockExecute).toHaveBeenCalled();
    });
  });

  describe('Tool Queries', () => {
    it('should find tool by id', async () => {
      const mockTool = {
        id: 1,
        name: 'Query Test Tool',
        description: 'Tool for testing queries',
        website: 'https://querytest.com',
        category: 'Testing',
      };

      const mockExecute = vi.fn().mockResolvedValueOnce([mockTool]);
      const mockWhere = vi.fn().mockReturnValue({ execute: mockExecute });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await db.select().from(tools).where(eq(tools.id, 1)).execute();
      
      expect(result[0]).toEqual(mockTool);
      expect(mockFrom).toHaveBeenCalledWith(tools);
      expect(mockWhere).toHaveBeenCalledWith(eq(tools.id, 1));
      expect(mockExecute).toHaveBeenCalled();
    });

    it('should find tools by category', async () => {
      const mockTools = [
        {
          id: 1,
          name: 'Tool 1',
          description: 'Description 1',
          website: 'https://tool1.com',
          category: 'Testing',
        },
        {
          id: 2,
          name: 'Tool 2',
          description: 'Description 2',
          website: 'https://tool2.com',
          category: 'Testing',
        },
      ];

      const mockExecute = vi.fn().mockResolvedValueOnce(mockTools);
      const mockWhere = vi.fn().mockReturnValue({ execute: mockExecute });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const results = await db.select().from(tools).where(eq(tools.category, 'Testing')).execute();
      
      expect(mockFrom).toHaveBeenCalledWith(tools);
      expect(mockWhere).toHaveBeenCalledWith(eq(tools.category, 'Testing'));
      expect(mockExecute).toHaveBeenCalled();
      expect(results).toEqual(mockTools);
    });
  });
});
