import path from 'path';
import { ValidationError } from './errors.js';

/**
 * Sanitize filename to prevent path traversal and other security issues
 */
export function sanitizeFilename(filename: string): string {
  if (!filename) {
    throw new ValidationError('Filename cannot be empty');
  }

  // Remove any path components
  const basename = path.basename(filename);
  
  // Remove dangerous characters but keep common ones
  const sanitized = basename
    .replace(/[^a-zA-Z0-9._-]/g, '_')  // Replace unsafe chars with underscore
    .replace(/\.{2,}/g, '.')           // Remove multiple dots
    .replace(/^\.+/, '')               // Remove leading dots
    .replace(/\.+$/, '')               // Remove trailing dots
    .substring(0, 255);                // Limit length
  
  if (!sanitized || sanitized === '.') {
    throw new ValidationError('Invalid filename after sanitization');
  }
  
  // Check for dangerous extensions
  const dangerousExtensions = ['.exe', '.bat', '.cmd', '.sh', '.ps1'];
  const ext = path.extname(sanitized).toLowerCase();
  if (dangerousExtensions.includes(ext)) {
    throw new ValidationError(`File type not allowed: ${ext}`);
  }
  
  return sanitized;
}

/**
 * Sanitize S3 key to prevent traversal
 */
export function sanitizeS3Key(key: string): string {
  if (!key) {
    throw new ValidationError('S3 key cannot be empty');
  }
  
  // Remove any parent directory references
  const sanitized = key
    .split('/')
    .filter(part => part && part !== '.' && part !== '..')
    .map(part => part.replace(/[^a-zA-Z0-9._-]/g, '_'))
    .join('/');
  
  if (!sanitized) {
    throw new ValidationError('Invalid S3 key after sanitization');
  }
  
  return sanitized;
}

/**
 * Sanitize Airtable formula to prevent injection
 */
export function sanitizeFormula(formula: string): string {
  if (!formula) {
    return formula;
  }
  
  // Check for potentially dangerous functions
  const dangerousFunctions = [
    'EVAL',
    'EXEC',
    'SYSTEM',
    'SCRIPT',
    'JAVASCRIPT',
    'VBSCRIPT'
  ];
  
  const upperFormula = formula.toUpperCase();
  for (const func of dangerousFunctions) {
    if (upperFormula.includes(func)) {
      throw new ValidationError(`Formula contains potentially dangerous function: ${func}`);
    }
  }
  
  // Basic SQL injection patterns
  const sqlPatterns = [
    /(\b(UNION|SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER)\b.*\b(FROM|INTO|WHERE|TABLE)\b)/i,
    /(;|\||--)/  // Command separators and comments
  ];
  
  for (const pattern of sqlPatterns) {
    if (pattern.test(formula)) {
      throw new ValidationError('Formula contains potentially dangerous SQL-like syntax');
    }
  }
  
  return formula;
}

/**
 * Sanitize error messages to prevent information disclosure
 */
export function sanitizeErrorMessage(error: Error, isDevelopment: boolean): string {
  if (isDevelopment) {
    return error.message;
  }
  
  // In production, use generic messages for internal errors
  const message = error.message.toLowerCase();
  
  // Don't expose file paths
  if (message.includes('/') || message.includes('\\')) {
    return 'An error occurred while processing your request';
  }
  
  // Don't expose internal service names or IPs
  if (message.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/) || 
      message.includes('localhost') ||
      message.includes('127.0.0.1')) {
    return 'Service temporarily unavailable';
  }
  
  // Don't expose stack traces or internal errors
  if (message.includes('stack') || 
      message.includes('trace') ||
      message.includes('undefined') ||
      message.includes('null')) {
    return 'An unexpected error occurred';
  }
  
  // For known safe errors, return the message
  const safePatterns = [
    /rate limit/i,
    /unauthorized/i,
    /forbidden/i,
    /not found/i,
    /bad request/i,
    /validation error/i
  ];
  
  if (safePatterns.some(pattern => pattern.test(message))) {
    return error.message;
  }
  
  // Default to generic message
  return 'An error occurred while processing your request';
}

/**
 * Sanitize log data to prevent sensitive information disclosure
 */
export function sanitizeLogData(data: any): any {
  if (!data || typeof data !== 'object') {
    return data;
  }
  
  const sensitiveKeys = [
    'password',
    'token',
    'apikey',
    'api_key',
    'secret',
    'authorization',
    'bearer',
    'credentials',
    'private',
    'ssn',
    'creditcard',
    'credit_card'
  ];
  
  const sanitized = { ...data };
  
  for (const key in sanitized) {
    const lowerKey = key.toLowerCase();
    
    // Check if key contains sensitive terms
    if (sensitiveKeys.some(term => lowerKey.includes(term))) {
      sanitized[key] = '[REDACTED]';
      continue;
    }
    
    // Recursively sanitize nested objects
    if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeLogData(sanitized[key]);
    }
  }
  
  return sanitized;
}

/**
 * Validate and sanitize base64 data
 */
export function sanitizeBase64(data: string): string {
  if (!data) {
    throw new ValidationError('Base64 data cannot be empty');
  }
  
  // Remove any whitespace and newlines
  const cleaned = data.replace(/\s/g, '');
  
  // Validate base64 format
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
  if (!base64Regex.test(cleaned)) {
    throw new ValidationError('Invalid base64 format');
  }
  
  // Check size limit (10MB)
  const estimatedSize = (cleaned.length * 3) / 4;
  if (estimatedSize > 10 * 1024 * 1024) {
    throw new ValidationError('Base64 data exceeds maximum size limit (10MB)');
  }
  
  return cleaned;
}