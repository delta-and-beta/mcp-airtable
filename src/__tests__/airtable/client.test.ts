import { AirtableClient } from '../../airtable/client';
import { 
  createMockAirtable, 
  mockRecord, 
  mockFetchResponses,
  mockError 
} from '../mocks/airtable.mock';
import { mockEnv, expectToThrowAsync, createBatchRecords } from '../helpers/test-utils';

// Mock the Airtable module
jest.mock('airtable', () => createMockAirtable());

// Mock global fetch
global.fetch = jest.fn();
const mockedFetch = global.fetch as jest.MockedFunction<typeof fetch>;

describe('AirtableClient', () => {
  mockEnv();

  let client: AirtableClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new AirtableClient({
      apiKey: 'test-api-key',
      baseId: 'appTestBase',
    });
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
      mockedFetch.mockResolvedValueOnce(mockFetchResponses.listBases as any);
      
      const result = await client.listBases();
      
      expect(mockedFetch).toHaveBeenCalledWith(
        'https://api.airtable.com/v0/meta/bases',
        expect.objectContaining({
          headers: {
            Authorization: 'Bearer test-api-key',
          },
        })
      );
      expect(result).toEqual({ bases: [expect.objectContaining({ id: 'appXXXXXXXXXXXXXX' })] });
    });

    it('should handle API errors', async () => {
      mockedFetch.mockResolvedValueOnce(mockFetchResponses.error as any);
      
      await expectToThrowAsync(
        () => client.listBases(),
        'Failed to list bases: Not Found'
      );
    });
  });

  describe('listTables', () => {
    it('should return list of tables for a base', async () => {
      mockedFetch.mockResolvedValueOnce(mockFetchResponses.listTables as any);
      
      const result = await client.listTables('appTestBase');
      
      expect(mockedFetch).toHaveBeenCalledWith(
        'https://api.airtable.com/v0/meta/bases/appTestBase/tables',
        expect.objectContaining({
          headers: {
            Authorization: 'Bearer test-api-key',
          },
        })
      );
      expect(result).toEqual({ tables: [expect.objectContaining({ id: 'tblXXXXXXXXXXXXXX' })] });
    });

    it('should use default base ID when not provided', async () => {
      mockedFetch.mockResolvedValueOnce(mockFetchResponses.listTables as any);
      
      await client.listTables();
      
      expect(mockedFetch).toHaveBeenCalledWith(
        expect.stringContaining('/appTestBase/tables'),
        expect.any(Object)
      );
    });
  });

  describe('listViews', () => {
    it('should return list of views for a table', async () => {
      mockedFetch.mockResolvedValueOnce(mockFetchResponses.listTables as any);
      
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
      mockedFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tables: [] }),
      } as any);
      
      await expectToThrowAsync(
        () => client.listViews('NonExistent Table'),
        "Table 'NonExistent Table' not found"
      );
    });
  });

  describe('getRecords', () => {
    it('should retrieve records from a table', async () => {
      const result = await client.getRecords('Test Table');
      
      expect(result).toEqual([
        expect.objectContaining({
          id: 'recXXXXXXXXXXXXXX',
          fields: expect.objectContaining({ Name: 'Test Record' }),
        }),
      ]);
    });

    it('should apply filters and options', async () => {
      await client.getRecords('Test Table', {
        view: 'Grid view',
        maxRecords: 10,
        filterByFormula: "Status = 'Active'",
        sort: [{ field: 'Name', direction: 'asc' }],
        fields: ['Name', 'Status'],
      });
      
      const Airtable = require('airtable');
      const mockBase = Airtable().base();
      const mockTable = mockBase();
      
      expect(mockTable.select).toHaveBeenCalledWith({
        view: 'Grid view',
        maxRecords: 10,
        filterByFormula: "Status = 'Active'",
        sort: [{ field: 'Name', direction: 'asc' }],
        fields: ['Name', 'Status'],
      });
    });
  });

  describe('createRecord', () => {
    it('should create a single record', async () => {
      const fields = { Name: 'New Record', Status: 'Active' };
      const result = await client.createRecord('Test Table', fields);
      
      expect(result).toEqual(expect.objectContaining({
        id: 'recXXXXXXXXXXXXXX',
        fields: expect.objectContaining({ Name: 'Test Record' }),
      }));
    });

    it('should support typecast option', async () => {
      const fields = { Name: 'New Record', Count: '5' };
      await client.createRecord('Test Table', fields, { typecast: true });
      
      const Airtable = require('airtable');
      const mockTable = Airtable().base()()();
      
      expect(mockTable.create).toHaveBeenCalledWith(fields, { typecast: true });
    });
  });

  describe('updateRecord', () => {
    it('should update a record', async () => {
      const result = await client.updateRecord(
        'Test Table',
        'recXXXXXXXXXXXXXX',
        { Status: 'Inactive' }
      );
      
      expect(result).toEqual(expect.objectContaining({
        id: 'recXXXXXXXXXXXXXX',
        fields: expect.any(Object),
      }));
    });
  });

  describe('deleteRecord', () => {
    it('should delete a record', async () => {
      const result = await client.deleteRecord('Test Table', 'recXXXXXXXXXXXXXX');
      
      expect(result).toEqual({
        id: 'recXXXXXXXXXXXXXX',
        deleted: true,
      });
    });
  });

  describe('batchCreate', () => {
    it('should create multiple records in batches', async () => {
      const records = createBatchRecords(25);
      const results = await client.batchCreate('Test Table', records);
      
      expect(results).toHaveLength(25);
      expect(results[0]).toEqual(expect.objectContaining({
        id: expect.any(String),
        fields: expect.any(Object),
      }));
    });

    it('should handle single record as array', async () => {
      const records = [{ fields: { Name: 'Single' } }];
      const results = await client.batchCreate('Test Table', records);
      
      expect(results).toHaveLength(1);
    });

    it('should respect typecast option', async () => {
      const records = createBatchRecords(5);
      await client.batchCreate('Test Table', records, { typecast: true });
      
      const Airtable = require('airtable');
      const mockTable = Airtable().base()()();
      
      expect(mockTable.create).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ typecast: true })
      );
    });
  });

  describe('batchUpdate', () => {
    it('should update multiple records in batches', async () => {
      const records = Array.from({ length: 15 }, (_, i) => ({
        id: `rec${i}`,
        fields: { Status: 'Updated' },
      }));
      
      const results = await client.batchUpdate('Test Table', records);
      
      expect(results).toHaveLength(15);
      expect(results[0]).toEqual(expect.objectContaining({
        id: expect.any(String),
        fields: expect.any(Object),
      }));
    });
  });

  describe('batchUpsert', () => {
    it('should upsert records with merge fields', async () => {
      const records = createBatchRecords(5);
      const results = await client.batchUpsert('Test Table', records, {
        performUpsert: {
          fieldsToMergeOn: ['Name'],
        },
      });
      
      expect(results).toHaveLength(5);
      
      const Airtable = require('airtable');
      const mockTable = Airtable().base()()();
      
      expect(mockTable.create).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          performUpsert: { fieldsToMergeOn: ['Name'] },
        })
      );
    });
  });

  describe('batchDelete', () => {
    it('should delete multiple records in batches', async () => {
      const recordIds = Array.from({ length: 25 }, (_, i) => `rec${i}`);
      const results = await client.batchDelete('Test Table', recordIds);
      
      expect(results).toHaveLength(25);
      expect(results[0]).toEqual({
        id: expect.any(String),
        deleted: true,
      });
    });
  });

  describe('getSchema', () => {
    it('should retrieve base schema', async () => {
      mockedFetch.mockResolvedValueOnce(mockFetchResponses.getSchema as any);
      
      const result = await client.getSchema();
      
      expect(mockedFetch).toHaveBeenCalledWith(
        'https://api.airtable.com/v0/meta/bases/appTestBase',
        expect.objectContaining({
          headers: {
            Authorization: 'Bearer test-api-key',
          },
        })
      );
      expect(result).toEqual({ tables: expect.any(Array) });
    });
  });

  describe('error handling', () => {
    it('should throw error when base ID is not provided', async () => {
      const clientWithoutBase = new AirtableClient({ apiKey: 'test-key' });
      
      await expectToThrowAsync(
        () => clientWithoutBase.getRecords('Test Table'),
        'Base ID is required'
      );
    });
  });
});