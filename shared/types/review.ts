import type { Review } from '../../db/schema';

export interface HelpfulVote {
  id?: number;
  userId: number;
  reviewId: number;
  createdAt?: Date;
}

export interface ReviewWithUser extends Review {
  user: {
    username: string;
    firstName: string;
    lastName: string;
  };
}
