import {
  sanitizeFormulaString,
  sanitizeFilename,
  sanitizeBase64,
  sanitizeTableName,
  sanitizeFieldName,
  sanitizeRecordId,
} from '../../utils/sanitization';

describe('Sanitization Utils', () => {
  describe('sanitizeFormulaString', () => {
    it('should escape quotes properly', () => {
      expect(sanitizeFormulaString(`Name = "Test"`)).toBe(`Name = \\"Test\\"`);
      expect(sanitizeFormulaString(`It's a test`)).toBe(`It\\'s a test`);
    });

    it('should handle empty strings', () => {
      expect(sanitizeFormulaString('')).toBe('');
    });

    it('should handle already escaped strings', () => {
      expect(sanitizeFormulaString(`Already \\"escaped\\"`)).toBe(`Already \\\\\\"escaped\\\\\\"`);
    });

    it('should handle complex formulas', () => {
      const formula = `AND({Status} = "Active", {Name} = 'John\\'s')`;
      const sanitized = sanitizeFormulaString(formula);
      expect(sanitized).toContain(`\\"Active\\"`);
      expect(sanitized).toContain(`\\'John`);
    });
  });

  describe('sanitizeFilename', () => {
    it('should remove dangerous characters', () => {
      expect(sanitizeFilename('test<file>.txt')).toBe('test_file_.txt');
      expect(sanitizeFilename('file|name?.pdf')).toBe('file_name_.pdf');
    });

    it('should remove path traversal attempts', () => {
      expect(sanitizeFilename('../../../etc/passwd')).toBe('_etc_passwd');
      expect(sanitizeFilename('..\\windows\\system32')).toBe('_windows_system32');
    });

    it('should preserve allowed characters', () => {
      expect(sanitizeFilename('valid-file_name.txt')).toBe('valid-file_name.txt');
      expect(sanitizeFilename('document (1).pdf')).toBe('document (1).pdf');
    });

    it('should handle unicode characters', () => {
      expect(sanitizeFilename('文档.txt')).toBe('文档.txt');
      expect(sanitizeFilename('файл.pdf')).toBe('файл.pdf');
    });

    it('should limit filename length', () => {
      const longName = 'a'.repeat(300) + '.txt';
      const sanitized = sanitizeFilename(longName);
      expect(sanitized.length).toBeLessThanOrEqual(255);
      expect(sanitized).toEndWith('.txt');
    });

    it('should handle dangerous extensions', () => {
      expect(() => sanitizeFilename('malware.exe')).toThrow('File type not allowed');
      expect(() => sanitizeFilename('script.bat')).toThrow('File type not allowed');
      expect(() => sanitizeFilename('shell.sh')).toThrow('File type not allowed');
    });
  });

  describe('sanitizeBase64', () => {
    it('should validate valid base64 strings', () => {
      const validBase64 = 'SGVsbG8gV29ybGQ=';
      expect(sanitizeBase64(validBase64)).toBe(validBase64);
    });

    it('should remove whitespace and newlines', () => {
      const base64WithSpace = 'SGVs bG8g V29y bGQ=\n';
      expect(sanitizeBase64(base64WithSpace)).toBe('SGVsbG8gV29ybGQ=');
    });

    it('should validate size limits', () => {
      const largeBase64 = 'A'.repeat(20 * 1024 * 1024); // 20MB
      expect(() => sanitizeBase64(largeBase64)).toThrow('exceeds maximum allowed size');
    });

    it('should reject invalid base64', () => {
      expect(() => sanitizeBase64('Not!Base64')).toThrow('Invalid base64 string');
      expect(() => sanitizeBase64('SGVsbG8=')).toThrow('Invalid base64 string'); // Wrong padding
    });

    it('should handle custom size limits', () => {
      const smallBase64 = 'SGVsbG8='; // "Hello"
      expect(() => sanitizeBase64(smallBase64, 5)).toThrow('exceeds maximum allowed size');
      expect(sanitizeBase64(smallBase64, 10)).toBe(smallBase64);
    });
  });

  describe('sanitizeTableName', () => {
    it('should handle valid table names', () => {
      expect(sanitizeTableName('Users')).toBe('Users');
      expect(sanitizeTableName('User Records')).toBe('User Records');
      expect(sanitizeTableName('Table_123')).toBe('Table_123');
    });

    it('should trim whitespace', () => {
      expect(sanitizeTableName('  Table Name  ')).toBe('Table Name');
    });

    it('should handle empty names', () => {
      expect(() => sanitizeTableName('')).toThrow('Table name cannot be empty');
      expect(() => sanitizeTableName('   ')).toThrow('Table name cannot be empty');
    });

    it('should enforce length limits', () => {
      const longName = 'A'.repeat(300);
      expect(() => sanitizeTableName(longName)).toThrow('Table name too long');
    });
  });

  describe('sanitizeFieldName', () => {
    it('should handle valid field names', () => {
      expect(sanitizeFieldName('firstName')).toBe('firstName');
      expect(sanitizeFieldName('First Name')).toBe('First Name');
      expect(sanitizeFieldName('field_1')).toBe('field_1');
    });

    it('should handle special characters', () => {
      expect(sanitizeFieldName('Email (Primary)')).toBe('Email (Primary)');
      expect(sanitizeFieldName('Price $')).toBe('Price $');
    });

    it('should trim and validate', () => {
      expect(sanitizeFieldName('  Field  ')).toBe('Field');
      expect(() => sanitizeFieldName('')).toThrow('Field name cannot be empty');
    });
  });

  describe('sanitizeRecordId', () => {
    it('should validate Airtable record ID format', () => {
      expect(sanitizeRecordId('recABCDEF123456789')).toBe('recABCDEF123456789');
      expect(sanitizeRecordId('rec000000000000000')).toBe('rec000000000000000');
    });

    it('should reject invalid formats', () => {
      expect(() => sanitizeRecordId('invalid')).toThrow('Invalid record ID format');
      expect(() => sanitizeRecordId('REC123456789012345')).toThrow('Invalid record ID format');
      expect(() => sanitizeRecordId('rec12345')).toThrow('Invalid record ID format');
      expect(() => sanitizeRecordId('rec!@#$%^&*()12345')).toThrow('Invalid record ID format');
    });

    it('should handle null/undefined', () => {
      expect(() => sanitizeRecordId(null as any)).toThrow('Invalid record ID format');
      expect(() => sanitizeRecordId(undefined as any)).toThrow('Invalid record ID format');
    });
  });
});