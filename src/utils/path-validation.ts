import path from 'path';

/**
 * Validates and sanitizes file paths to prevent path traversal attacks
 */
export function validateFilePath(filePath: string, allowedBasePath?: string): boolean {
  if (!filePath || typeof filePath !== 'string') {
    return false;
  }

  // Remove any null bytes
  const cleanPath = filePath.replace(/\0/g, '');

  // Check for path traversal patterns
  const traversalPatterns = [
    '..',
    '..\\',
    '../',
    '..%2F',
    '..%5C',
    '%2E%2E',
    '%252E%252E',
    '..%252F',
    '..%255C',
    '..%c0%af',
    '..%c1%9c',
    '/etc/',
    '\\windows\\',
    'c:\\',
    'C:\\'
  ];

  const lowerPath = cleanPath.toLowerCase();
  for (const pattern of traversalPatterns) {
    if (lowerPath.includes(pattern.toLowerCase())) {
      return false;
    }
  }

  // If an allowed base path is provided, ensure the resolved path is within it
  if (allowedBasePath) {
    const resolvedPath = path.resolve(cleanPath);
    const resolvedBase = path.resolve(allowedBasePath);
    
    if (!resolvedPath.startsWith(resolvedBase)) {
      return false;
    }
  }

  // Check for absolute paths (unless that's what we're expecting)
  if (!allowedBasePath && path.isAbsolute(cleanPath)) {
    return false;
  }

  return true;
}

/**
 * Sanitizes a filename to prevent directory traversal and other issues
 */
export function sanitizeFilename(filename: string): string {
  if (!filename || typeof filename !== 'string') {
    return '';
  }

  // Remove path separators and other dangerous characters
  return filename
    .replace(/[\/\\]/g, '_')           // Replace slashes with underscores
    .replace(/\.{2,}/g, '_')           // Replace multiple dots with underscore
    .replace(/[^\w\s.-]/g, '_')        // Keep only alphanumeric, spaces, dots, hyphens
    .replace(/^\.+/, '')               // Remove leading dots
    .trim();
}

/**
 * Validates that a path is within allowed upload directories
 */
export function isPathAllowed(filePath: string, allowedPaths: string[]): boolean {
  if (!filePath || !allowedPaths || allowedPaths.length === 0) {
    return false;
  }

  const resolvedPath = path.resolve(filePath);
  
  for (const allowedPath of allowedPaths) {
    const resolvedAllowed = path.resolve(allowedPath);
    if (resolvedPath.startsWith(resolvedAllowed)) {
      return true;
    }
  }

  return false;
}