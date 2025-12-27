import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { mockEnv, expectToThrowAsync } from '../helpers/test-utils.js';

// Mock fetch globally before importing the client
const mockFetch = jest.fn<typeof fetch>();
global.fetch = mockFetch;

// Import after setting up mocks
const { AirtableClient } = await import('../../airtable/client.js');

// Mock responses
const mockBaseResponse = {
  ok: true,
  json: async () => ({
    bases: [{ id: 'appXXXXXXXXXXXXXX', name: 'Test Base' }]
  }),
};

const mockTablesResponse = {
  ok: true,
  json: async () => ({
    tables: [{
      id: 'tblXXXXXXXXXXXXXX',
      name: 'Test Table',
      views: [{ id: 'viwXXXXXXXXXXXXXX', name: 'Grid view', type: 'grid' }],
    }]
  }),
};

const mockSchemaResponse = {
  ok: true,
  json: async () => ({
    tables: [{
      id: 'tblXXXXXXXXXXXXXX',
      name: 'Test Table',
      fields: [{ id: 'fldXXXXXXXXXXXXXX', name: 'Name', type: 'singleLineText' }],
    }]
  }),
};

const mockErrorResponse = {
  ok: false,
  statusText: 'Not Found',
  json: async () => ({ error: { message: 'Not found' } }),
};

describe('AirtableClient', () => {
  mockEnv();

  let client: InstanceType<typeof AirtableClient>;

  beforeEach(() => {
    mockFetch.mockClear();
    client = new AirtableClient({
      apiKey: 'test-api-key',
      baseId: 'appTestBase',
    });
  });

  afterEach(() => {
    mockFetch.mockReset();
  });

  describe('constructor', () => {
    it('should create client with valid config', () => {
      expect(() => new AirtableClient({
        apiKey: 'test-key',
        baseId: 'appTest',
      })).not.toThrow();
    });

    it('should throw error when API key is missing', () => {
      expect(() => new AirtableClient({
        apiKey: '',
      })).toThrow('Airtable API key is required');
    });
  });

  describe('listBases', () => {
    it('should return list of bases', async () => {
      mockFetch.mockResolvedValueOnce(mockBaseResponse as Response);

      const result = await client.listBases();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.airtable.com/v0/meta/bases',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key',
          }),
        })
      );
      expect(result).toEqual({ bases: [expect.objectContaining({ id: 'appXXXXXXXXXXXXXX' })] });
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce(mockErrorResponse as Response);

      await expectToThrowAsync(
        () => client.listBases(),
        'List bases failed: Not Found'
      );
    });
  });

  describe('listTables', () => {
    it('should return list of tables for a base', async () => {
      mockFetch.mockResolvedValueOnce(mockTablesResponse as Response);

      const result = await client.listTables('appTestBase');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.airtable.com/v0/meta/bases/appTestBase/tables',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key',
          }),
        })
      );
      expect(result).toEqual({ tables: [expect.objectContaining({ id: 'tblXXXXXXXXXXXXXX' })] });
    });

    it('should use default base ID when not provided', async () => {
      mockFetch.mockResolvedValueOnce(mockTablesResponse as Response);

      await client.listTables();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/appTestBase/tables'),
        expect.any(Object)
      );
    });
  });

  describe('listViews', () => {
    it('should return list of views for a table', async () => {
      mockFetch.mockResolvedValueOnce(mockTablesResponse as Response);

      const result = await client.listViews('Test Table');

      expect(result).toEqual({
        tableId: 'tblXXXXXXXXXXXXXX',
        tableName: 'Test Table',
        views: expect.arrayContaining([
          expect.objectContaining({ id: 'viwXXXXXXXXXXXXXX' })
        ]),
      });
    });

    it('should throw error when table is not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tables: [] }),
      } as Response);

      await expectToThrowAsync(
        () => client.listViews('NonExistent Table'),
        "Table 'NonExistent Table' not found"
      );
    });
  });

  describe('getSchema', () => {
    it('should retrieve base schema', async () => {
      mockFetch.mockResolvedValueOnce(mockSchemaResponse as Response);

      const result = await client.getSchema();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.airtable.com/v0/meta/bases/appTestBase',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key',
          }),
        })
      );
      expect(result).toEqual({ tables: expect.any(Array) });
    });
  });

  describe('error handling', () => {
    it('should handle API error when base ID is not provided', async () => {
      const clientWithoutBase = new AirtableClient({ apiKey: 'test-key' });

      // When no base ID is provided, the URL will have 'undefined' in it
      // This should result in an API error
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ error: { message: 'Base not found' } }),
      } as Response);

      await expectToThrowAsync(
        () => clientWithoutBase.listTables(),
        /Base not found|List tables failed/
      );
    });
  });
});
