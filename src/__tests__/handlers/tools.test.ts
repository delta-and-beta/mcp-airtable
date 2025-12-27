import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { mockEnv, expectToThrowAsync } from '../helpers/test-utils.js';

// Mock fetch globally before importing modules
const mockFetch = jest.fn<typeof fetch>();
global.fetch = mockFetch;

// Helper to create mock responses
const createMockResponse = (data: unknown, ok = true): Response => ({
  ok,
  status: ok ? 200 : 400,
  statusText: ok ? 'OK' : 'Bad Request',
  json: async () => data,
  text: async () => JSON.stringify(data),
  headers: new Headers(),
  redirected: false,
  type: 'basic',
  url: '',
  clone: () => createMockResponse(data, ok),
  body: null,
  bodyUsed: false,
  arrayBuffer: async () => new ArrayBuffer(0),
  blob: async () => new Blob(),
  formData: async () => new FormData(),
  bytes: async () => new Uint8Array(),
} as Response);

// Test API key - handlers require this for authentication (field name is airtableApiKey)
const TEST_API_KEY = 'patXXXXXXXXXXXXXX.XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
const AUTH_ARGS = { airtableApiKey: TEST_API_KEY };

// Mock data with valid ID formats (17 characters for base/table IDs)
const mockBase = {
  id: 'appXXXXXXXXXXXXXX',
  name: 'Test Base',
  permissionLevel: 'create',
};

const mockTable = {
  id: 'tblXXXXXXXXXXXXXX',
  name: 'Test Table',
  primaryFieldId: 'fldXXXXXXXXXXXXXX',
  fields: [
    { id: 'fldXXXXXXXXXXXXXX', name: 'Name', type: 'singleLineText' },
    { id: 'fldYYYYYYYYYYYYYY', name: 'Status', type: 'singleSelect' },
  ],
  views: [
    { id: 'viwXXXXXXXXXXXXXX', name: 'Grid view', type: 'grid' },
  ],
};

// Valid test base ID (17 chars, starts with "app")
const TEST_BASE_ID = 'appXXXXXXXXXXXXXX';

// Import handlers after setting up mocks
const { toolHandlers } = await import('../../handlers/tools-refactored.js');

describe('Tool Handlers', () => {
  mockEnv();

  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    mockFetch.mockReset();
  });

  // These tests work well with fetch mocking because they use the Airtable Meta API
  // which directly calls fetch, not the Airtable SDK

  describe('list_bases', () => {
    it('should list all available bases', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        bases: [mockBase],
      }));

      const result = await toolHandlers.list_bases(AUTH_ARGS);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.airtable.com/v0/meta/bases',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: expect.stringMatching(/^Bearer /),
          }),
        })
      );
      expect(result).toEqual({ bases: [mockBase] });
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(
        { error: { message: 'Unauthorized' } },
        false
      ));

      await expectToThrowAsync(
        () => toolHandlers.list_bases(AUTH_ARGS),
        /List bases failed|Unauthorized/
      );
    });
  });

  describe('list_tables', () => {
    it('should list tables in a base', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        tables: [mockTable],
      }));

      const result = await toolHandlers.list_tables({
        ...AUTH_ARGS,
        baseId: TEST_BASE_ID,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.airtable.com/v0/meta/bases/${TEST_BASE_ID}/tables`,
        expect.any(Object)
      );
      // Note: listTables strips fields by default for smaller response
      expect(result).toEqual({
        tables: [expect.objectContaining({
          id: 'tblXXXXXXXXXXXXXX',
          name: 'Test Table',
        })],
      });
    });

    it('should use default base when baseId not provided', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        tables: [mockTable],
      }));

      await toolHandlers.list_tables(AUTH_ARGS);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/meta/bases/'),
        expect.any(Object)
      );
    });
  });

  describe('list_views', () => {
    it('should list views for a table', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        tables: [mockTable],
      }));

      const result = await toolHandlers.list_views({
        ...AUTH_ARGS,
        tableName: 'Test Table',
        baseId: TEST_BASE_ID,
      });

      expect(result).toEqual({
        tableId: 'tblXXXXXXXXXXXXXX',
        tableName: 'Test Table',
        views: expect.arrayContaining([
          expect.objectContaining({ name: 'Grid view' })
        ]),
      });
    });

    it('should throw error when table not found', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        tables: [],
      }));

      await expectToThrowAsync(
        () => toolHandlers.list_views({
          ...AUTH_ARGS,
          tableName: 'NonExistent',
        }),
        "Table 'NonExistent' not found"
      );
    });
  });

  describe('get_schema', () => {
    it('should retrieve base schema', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        tables: [mockTable],
      }));

      const result = await toolHandlers.get_schema({
        ...AUTH_ARGS,
        baseId: TEST_BASE_ID,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.airtable.com/v0/meta/bases/${TEST_BASE_ID}`,
        expect.any(Object)
      );
      expect(result).toEqual({ tables: [mockTable] });
    });
  });

  describe('input validation', () => {
    it('should throw error for missing table name in get_records', async () => {
      await expectToThrowAsync(
        () => toolHandlers.get_records(AUTH_ARGS),
        /Table name or table ID is required|tableName/
      );
    });

    it('should throw error when table not found in list_views', async () => {
      // Mock an empty tables response - handler will call API first
      mockFetch.mockResolvedValueOnce(createMockResponse({
        tables: [],
      }));

      await expectToThrowAsync(
        () => toolHandlers.list_views({
          ...AUTH_ARGS,
          tableName: 'NonExistent',
        }),
        /Table.*not found/
      );
    });
  });

  // Note: Record CRUD tests (get_records, create_record, update_record, delete_record)
  // and batch operation tests (batch_create, batch_update, batch_upsert, batch_delete)
  // are not included here because they use the Airtable SDK which has its own
  // connection management and doesn't work well with simple fetch mocking.
  // These operations should be tested via integration tests with a real Airtable base.
});
