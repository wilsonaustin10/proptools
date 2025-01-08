import { User } from '../db/schema';

declare global {
  namespace Express {
    interface Request {
      isAuthenticated(): this is { user: User };
      user?: User;
    }
  }
}

export type AuthenticatedRequest = Express.Request & {
  user: User;
};
