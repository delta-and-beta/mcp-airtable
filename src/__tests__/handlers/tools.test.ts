import { toolHandlers } from '../../handlers/tools';
import { AirtableClient } from '../../airtable/client';
import { S3StorageClient } from '../../s3/client';
import { GCSStorageClient } from '../../gcs/client';
import { 
  createMockAirtable, 
  mockRecord,
  mockBase,
  mockTable,
  mockFetchResponses 
} from '../mocks/airtable.mock';
import { createMockS3Client, createMockGCSClient } from '../mocks/storage.mock';
import { mockEnv, expectToThrowAsync } from '../helpers/test-utils';

// Mock dependencies
jest.mock('airtable', () => createMockAirtable());
jest.mock('../../airtable/client');
jest.mock('../../s3/client');
jest.mock('../../gcs/client');
jest.mock('../../airtable/queued-client');
jest.mock('../../utils/rate-limiter-redis', () => ({
  airtableRateLimiter: {
    executeWithRetry: jest.fn((fn) => fn()),
  },
}));

// Mock global fetch
global.fetch = jest.fn();
const mockedFetch = global.fetch as jest.MockedFunction<typeof fetch>;

describe('Tool Handlers', () => {
  mockEnv();

  let mockAirtableClient: jest.Mocked<AirtableClient>;
  let mockS3Client: ReturnType<typeof createMockS3Client>;
  let mockGCSClient: ReturnType<typeof createMockGCSClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mocked Airtable client
    mockAirtableClient = {
      listBases: jest.fn().mockResolvedValue({ bases: [mockBase] }),
      listTables: jest.fn().mockResolvedValue({ tables: [mockTable] }),
      listViews: jest.fn().mockResolvedValue({
        tableId: 'tblXXXXXXXXXXXXXX',
        tableName: 'Test Table',
        views: [{ id: 'viwXXXXXXXXXXXXXX', name: 'Grid view', type: 'grid' }],
      }),
      getRecords: jest.fn().mockResolvedValue([mockRecord()]),
      createRecord: jest.fn().mockResolvedValue(mockRecord()),
      updateRecord: jest.fn().mockResolvedValue(mockRecord({ fields: { Status: 'Updated' } })),
      deleteRecord: jest.fn().mockResolvedValue({ id: 'recXXXXXXXXXXXXXX', deleted: true }),
      getSchema: jest.fn().mockResolvedValue({ tables: [mockTable] }),
      batchCreate: jest.fn().mockResolvedValue([mockRecord(), mockRecord()]),
      batchUpdate: jest.fn().mockResolvedValue([mockRecord({ fields: { Status: 'Updated' } })]),
      batchUpsert: jest.fn().mockResolvedValue([mockRecord()]),
      batchDelete: jest.fn().mockResolvedValue([{ id: 'rec1', deleted: true }]),
    } as any;

    (AirtableClient as jest.MockedClass<typeof AirtableClient>).mockImplementation(() => mockAirtableClient);

    // Setup mocked storage clients
    mockS3Client = createMockS3Client();
    mockGCSClient = createMockGCSClient();
    
    (S3StorageClient as jest.MockedClass<typeof S3StorageClient>).mockImplementation(() => mockS3Client as any);
    (GCSStorageClient as jest.MockedClass<typeof GCSStorageClient>).mockImplementation(() => mockGCSClient as any);
  });

  describe('list_bases', () => {
    it('should list all available bases', async () => {
      const result = await toolHandlers.list_bases({});
      
      expect(mockAirtableClient.listBases).toHaveBeenCalled();
      expect(result).toEqual({ bases: [mockBase] });
    });
  });

  describe('list_tables', () => {
    it('should list tables in a base', async () => {
      const result = await toolHandlers.list_tables({ baseId: 'appTest' });
      
      expect(mockAirtableClient.listTables).toHaveBeenCalledWith('appTest');
      expect(result).toEqual({ tables: [mockTable] });
    });

    it('should use default base when baseId not provided', async () => {
      await toolHandlers.list_tables({});
      
      expect(mockAirtableClient.listTables).toHaveBeenCalledWith(undefined);
    });
  });

  describe('list_views', () => {
    it('should list views for a table', async () => {
      const result = await toolHandlers.list_views({ 
        tableName: 'Test Table',
        baseId: 'appTest' 
      });
      
      expect(mockAirtableClient.listViews).toHaveBeenCalledWith('Test Table', 'appTest');
      expect(result).toEqual({
        tableId: 'tblXXXXXXXXXXXXXX',
        tableName: 'Test Table',
        views: expect.arrayContaining([
          expect.objectContaining({ name: 'Grid view' })
        ]),
      });
    });
  });

  describe('get_records', () => {
    it('should retrieve records with filters', async () => {
      const args = {
        tableName: 'Test Table',
        baseId: 'appTest',
        view: 'Grid view',
        maxRecords: 10,
        filterByFormula: "Status = 'Active'",
        sort: [{ field: 'Name', direction: 'asc' as const }],
        fields: ['Name', 'Status'],
      };
      
      const result = await toolHandlers.get_records(args);
      
      expect(mockAirtableClient.getRecords).toHaveBeenCalledWith('Test Table', {
        baseId: 'appTest',
        view: 'Grid view',
        maxRecords: 10,
        filterByFormula: "Status = 'Active'",
        sort: [{ field: 'Name', direction: 'asc' }],
        fields: ['Name', 'Status'],
      });
      expect(result).toEqual([mockRecord()]);
    });
  });

  describe('create_record', () => {
    it('should create a record with fields', async () => {
      const fields = { Name: 'New Record', Status: 'Active' };
      const result = await toolHandlers.create_record({
        tableName: 'Test Table',
        fields,
        baseId: 'appTest',
      });
      
      expect(mockAirtableClient.createRecord).toHaveBeenCalledWith(
        'Test Table',
        fields,
        { baseId: 'appTest', typecast: undefined }
      );
      expect(result).toEqual(mockRecord());
    });

    it('should support typecast option', async () => {
      await toolHandlers.create_record({
        tableName: 'Test Table',
        fields: { Count: '5' },
        typecast: true,
      });
      
      expect(mockAirtableClient.createRecord).toHaveBeenCalledWith(
        'Test Table',
        { Count: '5' },
        expect.objectContaining({ typecast: true })
      );
    });
  });

  describe('update_record', () => {
    it('should update a record', async () => {
      const result = await toolHandlers.update_record({
        tableName: 'Test Table',
        recordId: 'recXXXXXXXXXXXXXX',
        fields: { Status: 'Updated' },
      });
      
      expect(mockAirtableClient.updateRecord).toHaveBeenCalledWith(
        'Test Table',
        'recXXXXXXXXXXXXXX',
        { Status: 'Updated' },
        expect.any(Object)
      );
      expect(result.fields.Status).toBe('Updated');
    });
  });

  describe('delete_record', () => {
    it('should delete a record', async () => {
      const result = await toolHandlers.delete_record({
        tableName: 'Test Table',
        recordId: 'recXXXXXXXXXXXXXX',
      });
      
      expect(mockAirtableClient.deleteRecord).toHaveBeenCalledWith(
        'Test Table',
        'recXXXXXXXXXXXXXX',
        expect.any(Object)
      );
      expect(result).toEqual({ id: 'recXXXXXXXXXXXXXX', deleted: true });
    });
  });

  describe('get_schema', () => {
    it('should retrieve base schema', async () => {
      const result = await toolHandlers.get_schema({ baseId: 'appTest' });
      
      expect(mockAirtableClient.getSchema).toHaveBeenCalledWith('appTest');
      expect(result).toEqual({ tables: [mockTable] });
    });
  });

  describe('batch_create', () => {
    it('should create multiple records', async () => {
      const records = [
        { fields: { Name: 'Record 1' } },
        { fields: { Name: 'Record 2' } },
      ];
      
      const result = await toolHandlers.batch_create({
        tableName: 'Test Table',
        records,
      });
      
      expect(mockAirtableClient.batchCreate).toHaveBeenCalledWith(
        'Test Table',
        records,
        expect.any(Object)
      );
      expect(result).toHaveLength(2);
    });

    it('should use queued client for large batches', async () => {
      const records = Array(15).fill({ fields: { Name: 'Record' } });
      
      await toolHandlers.batch_create({
        tableName: 'Test Table',
        records,
      });
      
      // Should use queued client for > 10 records
      expect(mockAirtableClient.batchCreate).not.toHaveBeenCalled();
    });
  });

  describe('batch_update', () => {
    it('should update multiple records', async () => {
      const records = [
        { id: 'rec1', fields: { Status: 'Updated' } },
      ];
      
      const result = await toolHandlers.batch_update({
        tableName: 'Test Table',
        records,
      });
      
      expect(mockAirtableClient.batchUpdate).toHaveBeenCalledWith(
        'Test Table',
        records,
        expect.any(Object)
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('batch_upsert', () => {
    it('should upsert records with AI-detected fields', async () => {
      const records = [
        { fields: { Name: 'Record 1', Email: 'test@example.com' } },
      ];
      
      const result = await toolHandlers.batch_upsert({
        tableName: 'Test Table',
        records,
        detectFields: true,
      });
      
      // Should detect unique fields for upsert
      expect(mockAirtableClient.batchUpsert).toHaveBeenCalledWith(
        'Test Table',
        records,
        expect.objectContaining({
          performUpsert: expect.objectContaining({
            fieldsToMergeOn: expect.any(Array),
          }),
        })
      );
    });

    it('should use provided merge fields', async () => {
      const records = [{ fields: { Name: 'Record 1' } }];
      
      await toolHandlers.batch_upsert({
        tableName: 'Test Table',
        records,
        fieldsToMergeOn: ['Name'],
      });
      
      expect(mockAirtableClient.batchUpsert).toHaveBeenCalledWith(
        'Test Table',
        records,
        expect.objectContaining({
          performUpsert: { fieldsToMergeOn: ['Name'] },
        })
      );
    });
  });

  describe('batch_delete', () => {
    it('should delete multiple records', async () => {
      const recordIds = ['rec1', 'rec2'];
      
      const result = await toolHandlers.batch_delete({
        tableName: 'Test Table',
        recordIds,
      });
      
      expect(mockAirtableClient.batchDelete).toHaveBeenCalledWith(
        'Test Table',
        recordIds,
        expect.any(Object)
      );
      expect(result).toHaveLength(1); // Based on mock
    });
  });

  describe('upload_attachment', () => {
    beforeEach(() => {
      process.env.AWS_S3_BUCKET = 'test-bucket';
    });

    it('should upload file to S3', async () => {
      const result = await toolHandlers.upload_attachment({
        filePath: '/path/to/file.pdf',
        storage: 's3',
      });
      
      expect(mockS3Client.uploadFile).toHaveBeenCalledWith(
        '/path/to/file.pdf',
        expect.any(Object)
      );
      expect(result).toEqual({
        url: expect.stringContaining('s3.amazonaws.com'),
        filename: expect.any(String),
        size: 1024,
        type: 'application/pdf',
      });
    });

    it('should upload base64 data to GCS', async () => {
      process.env.GCS_BUCKET = 'test-bucket';
      
      const result = await toolHandlers.upload_attachment({
        base64Data: 'SGVsbG8gV29ybGQ=',
        filename: 'test.txt',
        contentType: 'text/plain',
        storage: 'gcs',
      });
      
      expect(mockGCSClient.uploadBuffer).toHaveBeenCalled();
      expect(result).toEqual({
        url: expect.stringContaining('storage.googleapis.com'),
        filename: 'test.txt',
        size: 1024,
        type: 'application/pdf',
      });
    });

    it('should auto-detect storage type', async () => {
      await toolHandlers.upload_attachment({
        base64Data: 'SGVsbG8=',
        filename: 'test.txt',
        storage: 'auto',
      });
      
      expect(mockS3Client.uploadBuffer).toHaveBeenCalled();
    });

    it('should throw error when no storage configured', async () => {
      delete process.env.AWS_S3_BUCKET;
      delete process.env.GCS_BUCKET;
      
      await expectToThrowAsync(
        () => toolHandlers.upload_attachment({
          filePath: '/path/to/file.pdf',
        }),
        'No storage client configured'
      );
    });

    it('should validate file path for security', async () => {
      await expectToThrowAsync(
        () => toolHandlers.upload_attachment({
          filePath: '../../../etc/passwd',
        }),
        'Invalid file path'
      );
    });

    it('should sanitize filename', async () => {
      await toolHandlers.upload_attachment({
        base64Data: 'SGVsbG8=',
        filename: '../../../malicious.txt',
        storage: 's3',
      });
      
      expect(mockS3Client.uploadBuffer).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.objectContaining({
          key: expect.stringMatching(/attachments\/\d+-malicious\.txt/),
        })
      );
    });
  });
});