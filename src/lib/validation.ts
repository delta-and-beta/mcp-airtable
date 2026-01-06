/**
 * Input validation and sanitization
 * Copied from archive with minimal modifications
 */

import path from 'path';
import { ValidationError } from './errors.js';

export function validateFilePath(filePath: string): string {
  if (!filePath) {
    throw new ValidationError('File path cannot be empty');
  }

  const normalizedPath = path.normalize(filePath);

  if (normalizedPath.includes('..')) {
    throw new ValidationError('Path traversal detected');
  }

  const blockedPaths = [
    '/etc/', '/var/', '/usr/', '/bin/', '/sbin/', '/root/',
    '/home/', '/proc/', '/sys/', '/dev/',
    'C:\\Windows', 'C:\\Program Files', 'C:\\Users',
  ];

  const lowerPath = normalizedPath.toLowerCase();
  for (const blocked of blockedPaths) {
    if (lowerPath.startsWith(blocked.toLowerCase())) {
      throw new ValidationError(`Access to system directory not allowed: ${blocked}`);
    }
  }

  return normalizedPath;
}

export function sanitizeFilename(filename: string): string {
  if (!filename) {
    throw new ValidationError('Filename cannot be empty');
  }

  const basename = path.basename(filename);
  
  const sanitized = basename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\.{2,}/g, '.')
    .replace(/^\.+/, '')
    .replace(/\.+$/, '')
    .substring(0, 255);
  
  if (!sanitized || sanitized === '.') {
    throw new ValidationError('Invalid filename after sanitization');
  }
  
  const dangerousExtensions = ['.exe', '.bat', '.cmd', '.sh', '.ps1'];
  const ext = path.extname(sanitized).toLowerCase();
  if (dangerousExtensions.includes(ext)) {
    throw new ValidationError(`File type not allowed: ${ext}`);
  }
  
  return sanitized;
}

export function sanitizeFormula(formula: string): string {
  if (!formula) return formula;
  
  const dangerousFunctions = ['EVAL', 'EXEC', 'SYSTEM', 'SCRIPT', 'JAVASCRIPT', 'VBSCRIPT'];
  
  const upperFormula = formula.toUpperCase();
  for (const func of dangerousFunctions) {
    if (upperFormula.includes(func)) {
      throw new ValidationError(`Formula contains dangerous function: ${func}`);
    }
  }
  
  const sqlPatterns = [
    /(\b(UNION|SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER)\b.*\b(FROM|INTO|WHERE|TABLE)\b)/i,
    /(;|\||--)/
  ];
  
  for (const pattern of sqlPatterns) {
    if (pattern.test(formula)) {
      throw new ValidationError('Formula contains SQL-like syntax');
    }
  }
  
  return formula;
}

export function sanitizeBase64(data: string): string {
  if (!data) {
    throw new ValidationError('Base64 data cannot be empty');
  }
  
  const cleaned = data.replace(/\s/g, '');
  
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleaned)) {
    throw new ValidationError('Invalid base64 format');
  }
  
  const estimatedSize = (cleaned.length * 3) / 4;
  if (estimatedSize > 10 * 1024 * 1024) {
    throw new ValidationError('Base64 data exceeds 10MB limit');
  }
  
  return cleaned;
}
