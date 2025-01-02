import { afterAll, afterEach, beforeAll } from 'vitest';
import { db } from '../db';
import { users, reviews, tools } from '../db/schema';
import { createApp } from '../server';
import { type Express } from 'express';

declare global {
  // eslint-disable-next-line no-var
  var app: Express;
}

// Global test setup
beforeAll(async () => {
  // Any global setup like database connections
  const { app } = createApp();
  global.app = app;
});

afterEach(async () => {
  // Clean up after each test
  await db.delete(reviews).execute();
  await db.delete(tools).execute();
  await db.delete(users).execute();
});

afterAll(async () => {
  // Clean up after all tests
  await db.delete(reviews).execute();
  await db.delete(tools).execute();
  await db.delete(users).execute();
});
