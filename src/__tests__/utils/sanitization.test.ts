import { describe, it, expect } from '@jest/globals';
import {
  sanitizeFilename,
  sanitizeBase64,
  sanitizeFormula,
  sanitizeS3Key,
  sanitizeErrorMessage,
  sanitizeLogData,
} from '../../utils/sanitization.js';

describe('Sanitization Utils', () => {
  describe('sanitizeFilename', () => {
    it('should remove dangerous characters', () => {
      expect(sanitizeFilename('test<file>.txt')).toBe('test_file_.txt');
      expect(sanitizeFilename('file|name?.pdf')).toBe('file_name_.pdf');
    });

    it('should remove path traversal attempts', () => {
      expect(sanitizeFilename('../../../etc/passwd')).toBe('passwd');
      // On macOS, backslashes are treated as part of the filename
      const result = sanitizeFilename('..\\..\\windows\\system32');
      expect(result).not.toContain('..');
    });

    it('should preserve allowed characters', () => {
      expect(sanitizeFilename('valid-file_name.txt')).toBe('valid-file_name.txt');
    });

    it('should limit filename length', () => {
      const longName = 'a'.repeat(300) + '.txt';
      const sanitized = sanitizeFilename(longName);
      expect(sanitized.length).toBeLessThanOrEqual(255);
    });

    it('should handle dangerous extensions', () => {
      expect(() => sanitizeFilename('malware.exe')).toThrow('File type not allowed');
      expect(() => sanitizeFilename('script.bat')).toThrow('File type not allowed');
      expect(() => sanitizeFilename('shell.sh')).toThrow('File type not allowed');
    });

    it('should throw on empty filename', () => {
      expect(() => sanitizeFilename('')).toThrow('Filename cannot be empty');
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

    it('should reject invalid base64', () => {
      expect(() => sanitizeBase64('Not!Base64')).toThrow('Invalid base64 format');
    });

    it('should throw on empty data', () => {
      expect(() => sanitizeBase64('')).toThrow('Base64 data cannot be empty');
    });
  });

  describe('sanitizeFormula', () => {
    it('should allow valid Airtable formulas', () => {
      const formula = `AND({Status} = "Active", {Name} = "John")`;
      expect(sanitizeFormula(formula)).toBe(formula);
    });

    it('should handle empty formulas', () => {
      expect(sanitizeFormula('')).toBe('');
    });

    it('should reject dangerous functions', () => {
      expect(() => sanitizeFormula('EVAL(something)')).toThrow('dangerous function');
      expect(() => sanitizeFormula('SCRIPT(code)')).toThrow('dangerous function');
    });

    it('should reject SQL injection patterns', () => {
      expect(() => sanitizeFormula('test; DROP TABLE users')).toThrow('dangerous SQL-like syntax');
    });
  });

  describe('sanitizeS3Key', () => {
    it('should sanitize S3 keys', () => {
      expect(sanitizeS3Key('folder/file.txt')).toBe('folder/file.txt');
    });

    it('should remove path traversal', () => {
      expect(sanitizeS3Key('../../../etc/passwd')).toBe('etc/passwd');
    });

    it('should throw on empty key', () => {
      expect(() => sanitizeS3Key('')).toThrow('S3 key cannot be empty');
    });
  });

  describe('sanitizeErrorMessage', () => {
    it('should return full message in development', () => {
      const error = new Error('Detailed error at /path/to/file');
      expect(sanitizeErrorMessage(error, true)).toBe('Detailed error at /path/to/file');
    });

    it('should hide paths in production', () => {
      const error = new Error('Error at /path/to/file');
      expect(sanitizeErrorMessage(error, false)).toBe('An error occurred while processing your request');
    });

    it('should allow safe messages in production', () => {
      const error = new Error('Rate limit exceeded');
      expect(sanitizeErrorMessage(error, false)).toBe('Rate limit exceeded');
    });
  });

  describe('sanitizeLogData', () => {
    it('should redact sensitive keys', () => {
      const data = {
        username: 'john',
        password: 'secret123',
        apiKey: 'abc123',
      };
      const sanitized = sanitizeLogData(data);
      expect(sanitized.username).toBe('john');
      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.apiKey).toBe('[REDACTED]');
    });

    it('should handle nested objects', () => {
      const data = {
        user: {
          name: 'john',
          settings: {
            token: 'secret',
          },
        },
      };
      const sanitized = sanitizeLogData(data);
      expect(sanitized.user.name).toBe('john');
      expect(sanitized.user.settings.token).toBe('[REDACTED]');
    });

    it('should handle null and non-objects', () => {
      expect(sanitizeLogData(null)).toBeNull();
      expect(sanitizeLogData('string')).toBe('string');
      expect(sanitizeLogData(123)).toBe(123);
    });
  });
});
