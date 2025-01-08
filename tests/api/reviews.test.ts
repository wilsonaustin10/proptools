import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import supertest from 'supertest';
import type { SuperAgentTest } from 'supertest';
import { DatabaseError } from '../../shared/errors/database';
import { createTestApp, mockTools } from '../setup';
import { db } from '../../db';
import type { Express } from 'express';
import type { User } from '../../db/schema';
import { sql, eq, desc } from 'drizzle-orm';
import { reviews, insertReviewSchema, helpfulVotes } from '../../db/schema';

// Mock drizzle-orm
vi.mock('drizzle-orm', async () => {
  return {
    eq: vi.fn((field: any, value: any) => ({ field, value, operator: 'eq' })),
    desc: vi.fn((field: any) => ({ field, direction: 'desc' })),
    sql: Object.assign(
      vi.fn((strings: TemplateStringsArray, ...values: any[]) => ({
        type: 'sql',
        strings: Array.from(strings),
        values,
        toString: () => strings.reduce((acc, str, i) => acc + str + (values[i] || ''), '')
      })), {
        join: vi.fn((arr: any[], separator: any) => ({
          type: 'sql_join',
          array: arr,
          separator,
          toString: () => arr.join(separator.toString())
        })),
        raw: vi.fn((val: any) => ({
          type: 'sql_raw',
          value: val,
          toString: () => String(val)
        }))
      }
    ),
    and: vi.fn((...conditions: any[]) => ({ type: 'and', conditions }))
  };
});

// Mock the schema module
vi.mock('../../db/schema', async () => {
  const actual = await vi.importActual('../../db/schema') as any;
  return {
    ...actual,
    reviews: {
      id: 'id',
      userId: 'userId',
      toolId: 'toolId',
      rating: 'rating',
      content: 'content',
      pros: 'pros',
      cons: 'cons',
      helpfulCount: 'helpfulCount',
      createdAt: 'createdAt',
      $inferInsert: {} as any,
    },
    insertReviewSchema: {
      safeParse: vi.fn((data) => ({
        success: true,
        data: {
          toolId: data.toolId || 1,
          rating: data.rating || 5,
          content: data.content || 'Great tool!',
          pros: data.pros || 'Easy to use',
          cons: data.cons || 'A bit expensive',
          userId: data.userId || 1
        }
      }))
    },
    helpfulVotes: {
      userId: 'userId',
      reviewId: 'reviewId'
    }
  };
});

import type { Review } from '../../db/schema';
import type { HelpfulVote } from '../../shared/types/review';

// Use the mock from setup.ts
vi.mock('../../db');

describe('Review API', () => {
  let app: Express;
  let agent: SuperAgentTest;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    agent = supertest.agent(app) as unknown as SuperAgentTest;
    
    // Authenticate the test user
    await agent
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'hashedpassword' })
      .expect(200);
  });

  describe('POST /reviews', () => {
    it('should create a new review', async () => {
      const newReview = {
        toolId: 1,
        rating: 5,
        content: 'Great tool!',
        pros: 'Easy to use',
        cons: 'A bit expensive'
      };

      // The mock is already set up in the vi.mock above

      // Authentication is handled in beforeEach

      const response = await agent
        .post('/api/reviews')
        .send(newReview)
        .expect(200);

      const expectedReview = {
        id: 1,
        content: 'Great tool!',
        rating: 5,
        toolId: 1,
        userId: 1,
        pros: 'Easy to use',
        cons: 'A bit expensive',
        helpfulCount: 0,
        createdAt: expect.any(String)
      };

      const { createdAt, ...responseWithoutDate } = response.body;
      expect(responseWithoutDate).toEqual(expectedReview);
      expect(typeof createdAt).toBe('string');
    });
  });

  describe('GET /reviews/tool/:toolId', () => {
    it('should return reviews for a tool', async () => {
      // The mock is already set up in the vi.mock above

      const response = await agent
        .get('/api/reviews/tool/1')
        .expect(200);

      const expectedReviews = [{
        id: 1,
        content: 'Great tool!',
        rating: 5,
        toolId: 1,
        userId: 1,
        pros: 'Easy to use',
        cons: 'A bit expensive',
        helpfulCount: 0,
        createdAt: expect.any(String),
        user: {
          id: 1,
          username: 'testuser',
          firstName: 'Test',
          lastName: 'User'
        }
      }];

      expect(response.body).toEqual(expectedReviews);
    });
  });

  describe('PUT /reviews/:id', () => {
    it('should update an existing review', async () => {
      const updatedReview = {
        toolId: 1,
        rating: 4,
        content: 'Updated review content',
        pros: 'Still easy to use',
        cons: 'Price increased'
      };

      const response = await agent
        .put('/api/reviews/1')
        .send(updatedReview)
        .expect(200);

      expect(response.body).toMatchObject({
        id: 1,
        content: 'Updated review content',
        rating: 4,
        toolId: 1,
        userId: 1,
        pros: 'Still easy to use',
        cons: 'Price increased'
      });
    });

    it('should return 404 for non-existent review', async () => {
      await agent
        .put('/api/reviews/999')
        .send({
          toolId: 1,
          rating: 4,
          content: 'Updated review content',
          pros: 'Still easy to use',
          cons: 'Price increased'
        })
        .expect(404);
    });
  });

  describe('DELETE /reviews/:id', () => {
    it('should delete a review', async () => {
      await agent
        .delete('/api/reviews/1')
        .expect(200);
    });

    it('should return 404 for non-existent review', async () => {
      await agent
        .delete('/api/reviews/999')
        .expect(404);
    });
  });

  describe('POST /reviews/:id/helpful', () => {
    it('should mark a review as helpful', async () => {
      const response = await agent
        .post('/api/reviews/1/helpful')
        .expect(200);

      expect(response.body).toMatchObject({
        id: 1,
        helpfulCount: 1
      });
    });

    it('should return 404 for non-existent review', async () => {
      await agent
        .post('/api/reviews/999/helpful')
        .expect(404);
    });

    it('should prevent marking a review as helpful twice', async () => {
      // First attempt should succeed
      await agent
        .post('/api/reviews/1/helpful')
        .expect(200);

      // Second attempt should fail
      await agent
        .post('/api/reviews/1/helpful')
        .expect(409);
    });
  });
});
