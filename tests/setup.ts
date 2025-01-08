import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest';
import { config } from 'dotenv';
import { resolve } from 'path';
import express, { type Express, type Request, type Response } from 'express';
import { type Session, type SessionData } from 'express-session';
import session from 'express-session';
import passport from 'passport';
import { registerRoutes } from '../server/routes';
import { reviews, helpfulVotes, tools, users, type Review, type Tool, type User, type HelpfulVote, type NewHelpfulVote } from '../db/schema';
import { AuthenticatedRequest } from '../server/types';
import { DatabaseError, type DatabaseErrorCode, statusCodeMap } from '../shared/errors/database';
import { setupAuth } from '../server/auth';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';

// Define table types
type TableKey = number;
type TableValue = Review | HelpfulVote | User | any; // 'any' for tools until we have a proper type

interface SqlOperation {
  sql: string;
}

interface AndOperation {
  op: 'and';
  expressions: any[];
}

interface EqFunction extends Function {
  args?: [string, any];
}

// Define mock state type with proper typing for Map operations
// Define mock tool type that matches our test data
interface MockTool extends Omit<Tool, 'featured'> {
  reviewCount: number;
  averageRating: number;
  upvotes: number;
  isApproved: boolean;
  isArchived: boolean;
}

// Define transaction types
interface MockTransaction {
  query: {
    tools: {
      findFirst: ReturnType<typeof vi.fn<(args: { where: any }) => Promise<MockTool | null>>>;
    };
    reviews: {
      findFirst: ReturnType<typeof vi.fn<(args: { where: any }) => Promise<Review | null>>>;
      findMany: ReturnType<typeof vi.fn<(args: { where?: any; with?: any }) => Promise<Review[]>>>;
    };
    helpfulVotes: {
      findFirst: ReturnType<typeof vi.fn<(args: { where: any }) => Promise<HelpfulVote | null>>>;
      create: ReturnType<typeof vi.fn<(args: { data: any }) => Promise<HelpfulVote>>>;
    };
  };
  insert: {
    values: ReturnType<typeof vi.fn<(data: Partial<Review | HelpfulVote>) => { returning: () => Promise<(Review | HelpfulVote)[]> }>>;
  };
  update: {
    set: ReturnType<typeof vi.fn<(data: Partial<Review | HelpfulVote>) => { where: (condition: { id?: number }) => { returning: () => Promise<Review[]> } }>>;
  };
  remove: {
    where: ReturnType<typeof vi.fn<(condition: { id?: number; reviewId?: number }) => { returning: () => Promise<(Review | HelpfulVote)[]> }>>;
  };
}

type TableMap = {
  reviews: Map<TableKey, Review>;
  helpfulVotes: Map<string, HelpfulVote>;
  tools: Map<TableKey, MockTool>;
  users: Map<TableKey, User>;
};

interface MockState extends TableMap {
  [key: string]: Map<any, any>;
}

// Declare global augmentation for mockState
declare global {
  var mockState: MockState;
  var isAdmin: boolean;
}

interface TableItem {
  table?: string;
  [key: string]: any;
}

const evaluateCondition = (item: TableItem, condition: any): boolean => {
  if (!condition) return true;
  
  // Debug logging
  console.log('Evaluating condition:', { item, condition });
  
  // Handle SQL objects
  if (condition && typeof condition === 'object' && 'queryChunks' in condition) {
    // Extract field and value from SQL query chunks
    const chunks = condition.queryChunks;
    if (!Array.isArray(chunks) || chunks.length < 2) return false;
    
    // Try to find the field name from the SQL chunks
    const sqlChunk = chunks.find(chunk => 
      chunk && typeof chunk === 'object' && 'value' in chunk && 
      typeof chunk.value === 'string' && chunk.value.includes('.')
    );
    
    if (!sqlChunk) return false;
    
    // Extract field name (after the dot)
    const fieldMatch = sqlChunk.value.match(/\.(\w+)/);
    if (!fieldMatch) return false;
    
    const fieldName = fieldMatch[1];
    
    // Find the parameter value
    const paramChunk = chunks.find(chunk => 
      chunk && typeof chunk === 'object' && 'value' in chunk && 
      chunk.value !== undefined && !String(chunk.value).includes('.')
    );
    
    if (!paramChunk) return false;
    
    const value = paramChunk.value;
    console.log('SQL query evaluation:', { fieldName, value, itemValue: item[fieldName] });
    return item[fieldName] === value;
  }
  
  // Handle eq() function and its result
  if (typeof condition === 'function' || (condition && typeof condition === 'object' && ('operator' in condition || 'args' in condition))) {
    if (typeof condition === 'function') {
      const eqFn = condition as EqFunction;
      const [field, value] = eqFn.args || [];
      if (!field) return false;
      const fieldName = field.split('.')[1] || field;
      console.log('Function condition:', { fieldName, value, result: item[fieldName] === value });
      return item[fieldName] === value;
    } else if (condition.operator === 'eq' || condition.args) {
      const fieldName = condition.field?.split('.')[1] || condition.field || condition.args?.[0]?.split('.')[1];
      const value = condition.value || condition.args?.[1];
      if (!fieldName) return false;
      console.log('Operator condition:', { fieldName, value, result: item[fieldName] === value });
      return item[fieldName] === value;
    }
    return false;
  }

  // Handle and() function
  if (condition && typeof condition === 'object' && 'op' in condition && condition.op === 'and') {
    const andOp = condition as AndOperation;
    const results = andOp.expressions.map((expr) => evaluateCondition(item, expr));
    console.log('AND operation:', { expressions: andOp.expressions, results });
    return results.every(Boolean);
  }

  // Handle SQL objects
  const sqlObject = condition?.condition || condition;
  if (sqlObject && typeof sqlObject === 'object' && 
      'decoder' in sqlObject && 
      'shouldInlineParams' in sqlObject && 
      'queryChunks' in sqlObject) {
    console.log('Handling SQL object:', sqlObject);
    
    // Extract query chunks
    const chunks = sqlObject.queryChunks;
    if (!Array.isArray(chunks)) {
      console.log('No query chunks found');
      return false;
    }

    // Log all chunks for debugging with more detail
    console.log('SQL chunks:', chunks.map(chunk => {
      const chunkInfo = {
        type: chunk?.constructor?.name,
        value: chunk?.value,
        values: chunk?.values,
        raw: chunk
      };
      console.log('Chunk details:', JSON.stringify(chunkInfo, null, 2));
      return chunkInfo;
    }));

    // Try to find the condition from the chunks
    let field: string | undefined;
    let value: any;
    let operator = '='; // Default operator
    let tableName: string | undefined;

    // First pass: find the table name and field
    let fullSql = '';
    for (const chunk of chunks) {
      if (!chunk || typeof chunk !== 'object') continue;

      if (chunk.constructor?.name === 'StringChunk' && typeof chunk.value === 'string') {
        fullSql += chunk.value + ' ';
      } else if (chunk.constructor?.name === 'Param') {
        fullSql += JSON.stringify(chunk.value) + ' ';
      }
    }
    console.log('Full SQL:', fullSql);

    // Try to extract table.field from the full SQL
    const tableFieldMatch = fullSql.match(/(?:FROM|JOIN|UPDATE|INTO)\s+([a-zA-Z_]+)|(?:WHERE\s+)?([a-zA-Z_]+)\.([a-zA-Z_]+)\s*([=<>]+)?/i);
    if (tableFieldMatch) {
      // If we matched FROM/JOIN/UPDATE/INTO clause
      if (tableFieldMatch[1]) {
        tableName = tableFieldMatch[1];
      }
      // If we matched table.field pattern
      else if (tableFieldMatch[2]) {
        tableName = tableFieldMatch[2];
        field = tableFieldMatch[3];
        if (tableFieldMatch[4]) operator = tableFieldMatch[4];
      }
    }

    // Find the parameter value - look for the first non-string value
    for (const chunk of chunks) {
      if (!chunk || typeof chunk !== 'object') continue;

      if (chunk.constructor?.name === 'Param' || 
          (chunk.value !== undefined && typeof chunk.value !== 'string')) {
        value = chunk.value;
        break;
      }
    }

    console.log('Extracted SQL parts:', { tableName, field, operator, value });

    // If we found all parts, evaluate the condition
    if (tableName && field && value !== undefined) {
      // Make sure we're looking at the right table
      if (tableName !== item.table) {
        console.log('Table mismatch:', { expected: tableName, actual: item.table });
        return false;
      }

      console.log('Evaluating condition:', { field, operator, value, itemValue: item[field] });

      // Evaluate the condition
      const itemValue = item[field];
      switch (operator) {
        case '=':
          return itemValue === value;
        case '>':
          return itemValue > value;
        case '<':
          return itemValue < value;
        case '>=':
          return itemValue >= value;
        case '<=':
          return itemValue <= value;
        default:
          return itemValue === value;
      }
    }

    // If we couldn't extract field or value, allow the query
    console.log('Could not extract field or value from SQL chunks');
    return true;
  }

  // Direct comparison
  if (condition && typeof condition === 'object') {
    const results = Object.entries(condition).map(([key, value]) => {
      // Skip internal SQL properties
      if (['decoder', 'shouldInlineParams', 'queryChunks'].includes(key)) {
        return true;
      }

      if (!item || !(key in item)) {
        console.log('Key not found:', { key, item });
        return false;
      }

      if (value && typeof value === 'object') {
        if ('sql' in value && typeof (value as SqlOperation).sql === 'string') {
          const sqlStr = (value as SqlOperation).sql;
          if (sqlStr.includes('count')) {
            return true;
          }
          const match = sqlStr.match(/([a-zA-Z]+)\.([a-zA-Z]+)/);
          if (match) {
            const field = match[2];
            console.log('SQL field check:', { field, result: item[field] !== undefined });
            return item[field] !== undefined;
          }
          return true;
        }
        return evaluateCondition(item[key], value);
      }
      console.log('Direct comparison:', { key, value, itemValue: item[key], result: item[key] === value });
      return item[key] !== undefined && item[key] === value;
    });
    console.log('Object condition results:', results);
    return results.every(Boolean);
  }

  console.log('No condition matched, returning false');
  return false;
};

// Define global state type
declare global {
  var mockState: MockState;
  var isAdmin: boolean;
}

// Extend SessionData to include passport
declare module 'express-session' {
  interface SessionData {
    passport?: {
      user: User;
    };
  }
}

declare global {
  namespace Express {
    interface Request {
      user?: User;
      isAuthenticated(): this is { user: User };
    }
  }
}

// Define test request type
type TestRequest = Request & {
  isAuthenticated: () => boolean;
  user?: User;
  login: (user: User, done: (err: any) => void) => void;
  session: Session & Partial<SessionData>;
};

// Import types from @types/passport
declare global {
  namespace Express {
    interface Request {
      isAuthenticated(): boolean;
      user?: User;
      login(user: User, done: (err: any) => void): void;
      session: Session & Partial<SessionData>;
    }
  }
}

// Define mock tools at the top level
export const mockTools = [
  {
    id: 1,
    name: 'Test Tool',
    description: 'A test tool',
    category: 'Testing',
    logo: 'test.png',
    website: 'https://test.com',
    createdAt: new Date(),
    userId: 1,
    isApproved: true,
    isArchived: false,
    reviewCount: 1,
    averageRating: 5,
    upvotes: 10
  }
];

// Initialize mock state before each test
beforeEach(() => {
  const mockReview: Review = {
    id: 1,
    helpfulCount: 1,
    userId: 1,
    toolId: 1,
    rating: 5,
    content: "Test review",
    pros: "Easy to use",
    cons: "A bit expensive",
    createdAt: new Date()
  };

  global.mockState = {
    reviews: new Map([[1, mockReview]]),
    helpfulVotes: new Map(),
    tools: new Map(mockTools.map(tool => [tool.id, tool as MockTool])),
    users: new Map([[1, {
      id: 1,
      username: 'testuser',
      password: 'hashedpassword',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      isAdmin: false,
      isVerified: true,
      verificationToken: null,
      verificationTokenExpiry: null,
      createdAt: new Date()
    }]])
  };
});

// Mock the database module
import { sql } from 'drizzle-orm';
vi.mock('../db', () => ({
  db: {
    select: vi.fn().mockImplementation(() => ({
      from: (table: any) => ({
        where: (condition: any) => ({
          limit: (limit: number) => {
            try {
              if (!global.mockState) return [];
              
              const tableName = table === users ? 'users' as const : 
                              table === reviews ? 'reviews' as const : 
                              table === tools ? 'tools' as const : 
                              table === helpfulVotes ? 'helpfulVotes' as const : null;
              
              if (!tableName) return [];
              
              // Type-safe handling of different table types
              let items: any[] = [];
              switch (tableName) {
                case 'reviews':
                  items = Array.from(global.mockState.reviews.values());
                  break;
                case 'helpfulVotes':
                  items = Array.from(global.mockState.helpfulVotes.values());
                  break;
                case 'tools':
                  items = Array.from(global.mockState.tools.values());
                  break;
                case 'users':
                  items = Array.from(global.mockState.users.values());
                  break;
                default:
                  return [];
              }
              
              items = items
                .filter(item => evaluateCondition(item, condition))
                .slice(0, limit);
              
              if (items.length === 0) {
                throw new DatabaseError("Record not found", "NOT_FOUND");
              }
              
              return items;
            } catch (error) {
              if (error instanceof DatabaseError) throw error;
              console.error('Error in select query:', error);
              throw new DatabaseError("Database query failed", "INTERNAL_ERROR");
            }
          }
        })
      })
    })),
    transaction: vi.fn().mockImplementation(async <T>(callback: (tx: MockTransaction) => Promise<T>): Promise<T> => {
      // Create a backup of the current state before executing transaction
      const backupState = {
        reviews: new Map(global.mockState.reviews),
        helpfulVotes: new Map(global.mockState.helpfulVotes),
        tools: new Map(global.mockState.tools),
        users: new Map(global.mockState.users)
      };

      // Create transaction context that has the same interface as db
      const tx: MockTransaction = {
        query: {
          tools: {
              findFirst: vi.fn().mockImplementation(async ({ where }) => {
                try {
                  if (!global.mockState) return null;
                  
                  // Handle direct id lookup first
                  if (where?.id) {
                    const tool = global.mockState.tools.get(where.id);
                    if (!tool) {
                      throw new DatabaseError("Tool not found", "NOT_FOUND");
                    }
                    return tool;
                  }

                  // Handle SQL operations and complex conditions
                  const tool = Array.from(global.mockState.tools.values()).find(tool => 
                    where ? evaluateCondition({ ...tool, table: 'tools' }, where) : true
                  );
                  
                  if (!tool) {
                    throw new DatabaseError("Tool not found", "NOT_FOUND");
                  }
                  
                  return tool;
                } catch (error: unknown) {
                  if (error instanceof DatabaseError) throw error;
                  console.error('Error in findFirst:', error);
                  throw new DatabaseError("Failed to fetch tool", "INTERNAL_ERROR");
                }
              })
            },
            reviews: {
              findFirst: vi.fn().mockImplementation(async ({ where }) => {
                try {
                  if (!global.mockState) return null;
                  
                  // Handle direct id lookup first
                  if (where?.id) {
                    const review = global.mockState.reviews.get(where.id);
                    if (!review) {
                      throw new DatabaseError("Review not found", "NOT_FOUND");
                    }
                    return review;
                  }

                  // Handle SQL operations and complex conditions
                  const review = Array.from(global.mockState.reviews.values()).find(review => 
                    where ? evaluateCondition({ ...review, table: 'reviews' }, where) : true
                  );
                  
                  if (!review) {
                    throw new DatabaseError("Review not found", "NOT_FOUND");
                  }
                  
                  return review;
                } catch (error: unknown) {
                  if (error instanceof DatabaseError) throw error;
                  console.error('Error in findFirst:', error);
                  throw new DatabaseError("Failed to fetch review", "INTERNAL_ERROR");
                }
              }),
              findMany: vi.fn().mockImplementation(async ({ where, with: withOption }) => {
                try {
                  if (!global.mockState) return [];
                  let reviews = Array.from(global.mockState.reviews.values());
                  
                  if (where) {
                    console.log('Finding reviews with where:', where);
                    
                    // Handle direct toolId lookup
                    if (typeof where === 'object' && 'toolId' in where) {
                      const toolId = where.toolId;
                      console.log('Looking for reviews with toolId:', toolId);
                      
                      const tool = global.mockState.tools.get(toolId);
                      if (!tool) {
                        console.log('Tool not found:', toolId);
                        throw new DatabaseError("Tool not found", "NOT_FOUND");
                      }
                      
                      reviews = reviews.filter(review => review.toolId === toolId);
                      console.log('Found reviews:', reviews);
                      return reviews;
                    }
                    
                    // Handle other conditions using evaluateCondition
                    reviews = reviews.filter(review => {
                      const result = evaluateCondition({ ...review, table: 'reviews' }, where);
                      console.log('Evaluating review:', { review, where, result });
                      return result;
                    });
                  }

                  if (withOption?.user) {
                    reviews = reviews.map(review => ({
                      ...review,
                      user: global.mockState.users.get(review.userId)
                    }));
                  }
                  
                  
                  return reviews;
                } catch (error: unknown) {
                  if (error instanceof DatabaseError) throw error;
                  console.error('Error in findMany:', error);
                  throw new DatabaseError("Failed to fetch reviews", "INTERNAL_ERROR");
                }
              })
            },
            helpfulVotes: {
              findFirst: vi.fn().mockImplementation(async ({ where }) => {
                try {
                  if (!global.mockState) return null;
                  // Try direct key lookup first
                  if (where?.userId && where?.reviewId) {
                    const key = `${where.userId}-${where.reviewId}`;
                    const vote = global.mockState.helpfulVotes.get(key);
                    if (!vote) {
                      throw new DatabaseError("Vote not found", "NOT_FOUND");
                    }
                    return vote;
                  }
                  // Otherwise, use evaluateCondition to find the first matching vote
                  const vote = Array.from(global.mockState.helpfulVotes.values()).find(vote => 
                    where ? evaluateCondition({ ...vote, table: 'helpfulVotes' }, where) : true
                  );
                  if (!vote) {
                    throw new DatabaseError("Vote not found", "NOT_FOUND");
                  }
                  return vote;
                } catch (error: unknown) {
                  if (error instanceof DatabaseError) throw error;
                  console.error('Error in findFirst:', error);
                  throw new DatabaseError("Failed to fetch vote", "INTERNAL_ERROR");
                }
              }),
              create: vi.fn().mockImplementation(async ({ data }) => {
                try {
                  if (!global.mockState) return null;
                  
                  // Check if review exists
                  const review = global.mockState.reviews.get(data.reviewId);
                  if (!review) {
                    throw new DatabaseError("Review not found", "NOT_FOUND");
                  }
                  
                  // Check for existing vote
                  const key = `${data.userId}-${data.reviewId}`;
                  if (global.mockState.helpfulVotes.has(key)) {
                    throw new DatabaseError("Already marked as helpful", "CONFLICT");
                  }
                  
                  // Create vote
                  const vote = { id: global.mockState.helpfulVotes.size + 1, ...data };
                  global.mockState.helpfulVotes.set(key, vote);
                  
                  // Update review helpful count
                  const updatedReview = {
                    ...review,
                    helpfulCount: (review.helpfulCount || 0) + 1
                  };
                  global.mockState.reviews.set(data.reviewId, updatedReview);
                  
                  return vote;
                } catch (error: unknown) {
                  if (error instanceof DatabaseError) throw error;
                  console.error('Error in create:', error);
                  throw new DatabaseError("Failed to create vote", "INTERNAL_ERROR");
                }
              })
            }
          },
          insert: {
            values: vi.fn<(data: Partial<Review | HelpfulVote>) => { returning: () => Promise<(Review | HelpfulVote)[]> }>().mockImplementation((data) => ({
              returning: async () => {
                try {
                  if ('toolId' in data) {
                    const newReview = { id: global.mockState.reviews.size + 1, ...data } as Review;
                    global.mockState.reviews.set(newReview.id, newReview);
                    return [newReview];
                  }
                  if ('reviewId' in data) {
                    const vote = { id: global.mockState.helpfulVotes.size + 1, ...data } as HelpfulVote;
                    const key = `${vote.userId}-${vote.reviewId}`;
                    if (global.mockState.helpfulVotes.has(key)) {
                      throw new DatabaseError("Already marked as helpful", "CONFLICT");
                    }
                    global.mockState.helpfulVotes.set(key, vote);
                    return [vote];
                  }
                  return [];
                } catch (error: unknown) {
                  if (error instanceof DatabaseError) throw error;
                  console.error('Error in insert:', error);
                  throw new DatabaseError("Failed to insert", "INTERNAL_ERROR");
                }
              }
            }))
          },
          update: {
            set: vi.fn<(data: Partial<Review | HelpfulVote>) => { where: (condition: { id?: number }) => { returning: () => Promise<Review[]> } }>().mockImplementation((data) => ({
              where: (condition) => ({
                returning: async () => {
                  try {
                    if (!condition?.id) {
                      throw new DatabaseError("Invalid ID", "INVALID_INPUT");
                    }
                    const review = global.mockState.reviews.get(condition.id);
                    if (!review) {
                      throw new DatabaseError("Review not found", "NOT_FOUND");
                    }
                    const updatedReview = { ...review, ...data };
                    global.mockState.reviews.set(review.id, updatedReview);
                    return [updatedReview];
                  } catch (error: unknown) {
                    if (error instanceof DatabaseError) throw error;
                    console.error('Error in update:', error);
                    throw new DatabaseError("Failed to update", "INTERNAL_ERROR");
                  }
                }
              })
            }))
          },
          remove: {
            where: vi.fn<(condition: { id?: number; reviewId?: number }) => { returning: () => Promise<(Review | HelpfulVote)[]> }>().mockImplementation((condition) => ({
              returning: async () => {
                try {
                  if (condition?.id) {
                    const review = global.mockState.reviews.get(condition.id);
                    if (!review) {
                      throw new DatabaseError("Review not found", "NOT_FOUND");
                    }
                    
                    // Delete associated helpful votes first
                    const reviewId = review.id;
                    for (const [key, vote] of global.mockState.helpfulVotes.entries()) {
                      if (vote.reviewId === reviewId) {
                        global.mockState.helpfulVotes.delete(key);
                      }
                    }
                    
                    // Then delete the review
                    global.mockState.reviews.delete(review.id);
                    return [review];
                  }
                  if (condition?.reviewId) {
                    const votes = Array.from(global.mockState.helpfulVotes.entries())
                      .filter(([_, v]) => evaluateCondition({ ...v, table: 'helpfulVotes' }, condition))
                      .map(([k, v]) => {
                        global.mockState.helpfulVotes.delete(k);
                        return v;
                      });
                    if (votes.length === 0) {
                      throw new DatabaseError("Vote not found", "NOT_FOUND");
                    }
                    return votes;
                  }
                  throw new DatabaseError("Invalid ID", "INVALID_INPUT");
                } catch (error: unknown) {
                  if (error instanceof DatabaseError) throw error;
                  console.error('Error in delete:', error);
                  throw new DatabaseError("Failed to delete", "INTERNAL_ERROR");
                }
              }
            }))
          }
        };

        // Execute the transaction callback with our mock transaction context
        try {
          const result = await callback(tx);
          return result;
        } catch (error: unknown) {
          // Restore state from backup on error
          global.mockState = {
            reviews: new Map(backupState.reviews),
            helpfulVotes: new Map(backupState.helpfulVotes),
            tools: new Map(backupState.tools),
            users: new Map(backupState.users)
          };

          // Re-throw DatabaseError instances
          if (error instanceof DatabaseError) {
            throw error;
          }

          // Convert Error instances to DatabaseError with appropriate code
          if (error instanceof Error) {
            const message = error.message.toLowerCase();
            let errorCode: DatabaseErrorCode = "INTERNAL_ERROR";
            
            if (message.includes('not found')) {
              errorCode = "NOT_FOUND";
            } else if (message.includes('invalid')) {
              errorCode = "INVALID_INPUT";
            } else if (message.includes('unauthorized') || message.includes('permission')) {
              errorCode = "FORBIDDEN";
            }
            
            throw new DatabaseError(message, errorCode);
          }
          
          // Default to INTERNAL_ERROR for unknown errors
          throw new DatabaseError(
            typeof error === 'string' ? error : 'An unknown error occurred',
            "INTERNAL_ERROR"
          );
        }
      })
    }
  }));

// Initialize mock state with test data
const mockState = {
  reviews: new Map<number, Review>([
    [1, {
      id: 1,
      userId: 1,
      toolId: 1,
      rating: 4,
      content: "Great tool for development!",
      pros: "Easy to use, great documentation",
      cons: "Learning curve can be steep",
      helpfulCount: 0,
      createdAt: new Date()
    }]
  ]),
  helpfulVotes: new Map<string, HelpfulVote>(),
  tools: new Map(mockTools.map(tool => [tool.id, tool])),
  users: new Map<number, User>([
    [1, {
      id: 1,
      username: "testuser",
      firstName: "Test",
      lastName: "User",
      email: "test@example.com",
      password: "hashedpassword",
      isAdmin: false,
      isVerified: true,
      verificationToken: null,
      verificationTokenExpiry: null,
      createdAt: new Date()
    }]
  ])
};

// Initialize global mock state
global.mockState = mockState;

// Load test environment variables
config({ path: resolve(__dirname, '../.env.test') });

declare global {
   
  var app: Express;
  var isAdmin: boolean;
}

// Create and configure test app
export async function createTestApp(): Promise<Express> {
  const app = express();
  
  // Enable JSON body parsing and session middleware
  app.use(express.json());
  
  // Configure session middleware for testing
  const store = new session.MemoryStore();
  app.use(session({
    secret: 'test-secret',
    resave: false,
    saveUninitialized: true,
    store: store,
    cookie: { 
      secure: false,
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  }));

  // Set up the test user object
  const testUser: User = {
    id: 1,
    username: 'testuser',
    firstName: 'Test',
    lastName: 'User',
    isAdmin: false,
    email: 'test@example.com',
    password: 'hashedpassword',
    isVerified: true,
    createdAt: new Date(),
    verificationToken: null,
    verificationTokenExpiry: null
  };

  // Initialize passport for session support
  app.use(passport.initialize());
  app.use(passport.session());

  // Mock authentication for tests
  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    if (username === 'testuser' && password === 'hashedpassword') {
      req.session.passport = { user: testUser };
      return res.status(200).json({ success: true });
    }
    return res.status(401).json({ message: 'Invalid credentials' });
  });

  // Add test authentication middleware before main app
  app.use((req: Request, _res: Response, next) => {
    // Initialize session if not exists
    if (!req.session) {
      req.session = {} as Session & Partial<SessionData>;
    }
    
    // Set up session with passport data
    req.session.passport = { user: testUser };
    req.user = testUser;
    
    // Define isAuthenticated to check for user existence
    req.isAuthenticated = function isAuthenticated(): boolean {
      return req.user !== undefined;
    } as any;
    
    next();
  });

  console.log('Creating test app...');
  
  // Set up body parsing middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  // Set up session middleware
  app.use(session({
    secret: 'test-secret',
    resave: false,
    saveUninitialized: false
  }));

  // Initialize passport
  app.use(passport.initialize());
  app.use(passport.session());

  // Set up auth routes first
  const authRouter = setupAuth(app);
  app.use('/api/auth', authRouter);
  
  // Register API routes
  const apiRouter = registerRoutes(app);
  app.use('/api', apiRouter);
  
  // Log all registered routes for debugging
  console.log('Routes registered...');
  
  // Get all routes including nested ones
  const getAllRoutes = (stack: any[]): string[] => {
    return stack.reduce((routes: string[], r: any) => {
      if (r.route) {
        const method = Object.keys(r.route.methods)[0];
        routes.push(`${method} ${r.route.path}`);
      } else if (r.name === 'router' && r.handle.stack) {
        const nestedRoutes = getAllRoutes(r.handle.stack)
          .map((route: string) => route);
        routes.push(...nestedRoutes);
      }
      return routes;
    }, []);
  };

  const allRoutes = getAllRoutes(app._router.stack);
  console.log('All registered routes:', allRoutes.join('\n'));

  // Add error handling middleware for DatabaseErrors
  app.use((error: unknown, _req: any, res: any, next: any) => {
    if (error instanceof DatabaseError) {
      const statusCode = statusCodeMap[error.code] || 500;
      return res.status(statusCode).json({ error: error.message });
    }
    next(error);
  });

  // Basic error handling middleware for non-DatabaseErrors
  app.use((error: unknown, _req: any, res: any, _next: any) => {
    console.error('Unhandled error in middleware:', error);
    return res.status(500).json({ error: "Internal server error" });
  });

  // Log all routes in app after mounting
  console.log('Routes in app after mounting:');
  app._router.stack.forEach((middleware: any) => {
    if (middleware.route) {
      console.log(`${Object.keys(middleware.route.methods)} ${middleware.route.path}`);
    } else if (middleware.name === 'router') {
      middleware.handle.stack.forEach((handler: any) => {
        if (handler.route) {
          console.log(`${Object.keys(handler.route.methods)} ${handler.route.path}`);
        }
      });
    }
  });
  
  // Log all registered routes for debugging
  const registeredRoutes = app._router.stack
    .filter((r: any) => r.route || (r.name === 'router' && r.handle.stack))
    .map((r: any) => {
      if (r.route) {
        return `${Object.keys(r.route.methods)} ${r.route.path}`;
      }
      return r.handle.stack
        .filter((h: any) => h.route)
        .map((h: any) => `${Object.keys(h.route.methods)} ${h.route.path}`)
        .join('\n');
    })
    .join('\n');
  console.log('All registered routes:', registeredRoutes);
  
  return app;
}

// Global test setup
beforeAll(async () => {
  const app = await createTestApp();
  global.app = app;
});

beforeEach(() => {
  const mockReview: Review = {
    id: 1,
    helpfulCount: 0,
    userId: 1,
    toolId: 1,
    rating: 5,
    content: "Test review",
    pros: "Easy to use",
    cons: "A bit expensive",
    createdAt: new Date()
  };
  
  // Reset mock state before each test
  mockState.reviews.clear();
  mockState.helpfulVotes.clear();
  mockState.tools.clear();
  
  // Reinitialize mock tools
  mockTools.forEach(tool => {
    mockState.tools.set(tool.id, tool);
  });
  
  // Add the mock review
  mockState.reviews.set(mockReview.id, mockReview);
  mockState.users.clear();
  
  // Initialize with default data
  mockState.reviews.set(1, mockReview);
  mockState.tools = new Map(mockTools.map(tool => [tool.id, tool]));
  mockState.users.set(1, {
    id: 1,
    username: 'testuser',
    password: 'hashedpassword',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    isAdmin: false,
    isVerified: true,
    verificationToken: null,
    verificationTokenExpiry: null,
    createdAt: new Date()
  });
  
  // Update global mock state
  global.mockState = mockState;
  
  // Clear all mocks
  vi.clearAllMocks();
  
  vi.clearAllMocks();
});

afterAll(async () => {
  // Reset all mocks after tests
  vi.clearAllMocks();
});
