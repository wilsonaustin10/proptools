import { describe, it, expect } from 'vitest';
import { insertReviewSchema } from '../routes';

describe('Review Management', () => {
  describe('insertReviewSchema', () => {
    it('should validate valid review data', () => {
      const validReview = {
        toolId: 1,
        rating: 5,
        content: 'Great tool!',
        pros: 'Easy to use',
        cons: 'A bit expensive'
      };

      const result = insertReviewSchema.safeParse(validReview);
      expect(result.success).toBe(true);
    });

    it('should reject invalid review data', () => {
      const invalidReview = {
        toolId: 'not-a-number',
        rating: 6, // Out of range
        content: '',
        pros: null,
        cons: null
      };

      const result = insertReviewSchema.safeParse(invalidReview);
      expect(result.success).toBe(false);
    });
  });
});
