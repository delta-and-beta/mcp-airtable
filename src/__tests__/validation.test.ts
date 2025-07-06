import { describe, it, expect } from '@jest/globals';
import {
  validateInput,
  ListBasesSchema,
  ListTablesSchema,
  GetRecordsSchema,
  CreateRecordSchema,
  UpdateRecordSchema,
  UploadAttachmentSchema,
} from '../utils/validation.js';

describe('Input Validation', () => {
  describe('ListBasesSchema', () => {
    it('should accept empty object', () => {
      expect(() => validateInput(ListBasesSchema, {})).not.toThrow();
    });
  });

  describe('ListTablesSchema', () => {
    it('should accept valid base ID', () => {
      const input = { baseId: 'appXXXXXXXXXXXXXX' };
      expect(() => validateInput(ListTablesSchema, input)).not.toThrow();
    });

    it('should reject invalid base ID', () => {
      const input = { baseId: 'invalid' };
      expect(() => validateInput(ListTablesSchema, input)).toThrow(/Invalid base ID format/);
    });
  });

  describe('GetRecordsSchema', () => {
    it('should accept valid input', () => {
      const input = {
        tableName: 'Users',
        maxRecords: 50,
        filterByFormula: "Name = 'John'",
        sort: [{ field: 'Name', direction: 'asc' }],
      };
      expect(() => validateInput(GetRecordsSchema, input)).not.toThrow();
    });

    it('should reject maxRecords over 100', () => {
      const input = {
        tableName: 'Users',
        maxRecords: 150,
      };
      expect(() => validateInput(GetRecordsSchema, input)).toThrow();
    });

    it('should require tableName', () => {
      const input = {};
      expect(() => validateInput(GetRecordsSchema, input)).toThrow();
    });
  });

  describe('CreateRecordSchema', () => {
    it('should accept valid input', () => {
      const input = {
        tableName: 'Users',
        fields: { Name: 'John', Age: 30 },
      };
      expect(() => validateInput(CreateRecordSchema, input)).not.toThrow();
    });
  });

  describe('UpdateRecordSchema', () => {
    it('should accept valid input', () => {
      const input = {
        tableName: 'Users',
        recordId: 'recXXXXXXXXXXXXXX',
        fields: { Name: 'Jane' },
      };
      expect(() => validateInput(UpdateRecordSchema, input)).not.toThrow();
    });

    it('should reject invalid record ID', () => {
      const input = {
        tableName: 'Users',
        recordId: 'invalid',
        fields: {},
      };
      expect(() => validateInput(UpdateRecordSchema, input)).toThrow(/Invalid record ID format/);
    });
  });

  describe('UploadAttachmentSchema', () => {
    it('should accept filePath', () => {
      const input = { filePath: '/path/to/file.jpg' };
      expect(() => validateInput(UploadAttachmentSchema, input)).not.toThrow();
    });

    it('should accept base64Data with filename', () => {
      const input = {
        base64Data: 'SGVsbG8gV29ybGQ=',
        filename: 'test.txt',
      };
      expect(() => validateInput(UploadAttachmentSchema, input)).not.toThrow();
    });

    it('should reject base64Data without filename', () => {
      const input = { base64Data: 'SGVsbG8gV29ybGQ=' };
      expect(() => validateInput(UploadAttachmentSchema, input)).toThrow(/filename is required/);
    });

    it('should reject empty input', () => {
      const input = {};
      expect(() => validateInput(UploadAttachmentSchema, input)).toThrow(/Either filePath or base64Data/);
    });
  });
});