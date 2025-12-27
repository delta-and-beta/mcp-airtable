// Test utilities and helpers
import { jest, beforeEach, afterEach, expect } from '@jest/globals';

export const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const mockEnv = (overrides: Record<string, string> = {}) => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      AIRTABLE_API_KEY: 'test-api-key',
      AIRTABLE_BASE_ID: 'appTestBase',
      NODE_ENV: 'test',
      ...overrides,
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });
};

export const expectToThrowAsync = async (
  func: () => Promise<any>,
  errorMessage?: string | RegExp
) => {
  let error: any;
  try {
    await func();
  } catch (e) {
    error = e;
  }
  
  expect(error).toBeDefined();
  if (errorMessage) {
    if (typeof errorMessage === 'string') {
      expect(error.message).toBe(errorMessage);
    } else {
      expect(error.message).toMatch(errorMessage);
    }
  }
};

export const createTestRecord = (overrides: any = {}) => ({
  fields: {
    Name: 'Test Record',
    Description: 'Test Description',
    Status: 'Active',
    Count: 1,
    ...overrides,
  },
});

export const createBatchRecords = (count: number, overrides: any = {}) => {
  return Array.from({ length: count }, (_, i) => ({
    fields: {
      Name: `Test Record ${i + 1}`,
      Description: `Test Description ${i + 1}`,
      Status: i % 2 === 0 ? 'Active' : 'Inactive',
      Count: i + 1,
      ...overrides,
    },
  }));
};

export const mockConsoleError = () => {
  const originalError = console.error;
  beforeEach(() => {
    console.error = jest.fn() as typeof console.error;
  });
  afterEach(() => {
    console.error = originalError;
  });
  return () => console.error as jest.Mock;
};