/**
 * Sanitize response data to ensure it's safe for JSON serialization
 * and doesn't cause parsing issues in the MCP client
 */
export function sanitizeResponse(data: any): any {
  if (data === null || data === undefined) {
    return data;
  }

  // Handle strings - ensure they're properly encoded
  if (typeof data === 'string') {
    // Replace any control characters that might cause issues
    // eslint-disable-next-line no-control-regex
    return data.replace(/[\x00-\x1F\x7F-\x9F]/g, (char) => {
      // Keep newlines, tabs, and carriage returns
      if (char === '\n' || char === '\r' || char === '\t') {
        return char;
      }
      // Replace other control characters with their unicode escape
      return `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`;
    });
  }

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => sanitizeResponse(item));
  }

  // Handle objects
  if (typeof data === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      // Sanitize both keys and values
      const sanitizedKey = typeof key === 'string' ? sanitizeResponse(key) : key;
      sanitized[sanitizedKey] = sanitizeResponse(value);
    }
    return sanitized;
  }

  // Return other types as-is (numbers, booleans, etc.)
  return data;
}

/**
 * Ensure the response is serializable and within size limits
 */
export function prepareResponse(data: any, maxSize: number = 1000000): any {
  // First sanitize the data
  const sanitized = sanitizeResponse(data);
  
  // Check size and truncate if needed
  const jsonString = JSON.stringify(sanitized);
  if (jsonString.length > maxSize) {
    // If the response is too large, truncate arrays
    if (Array.isArray(sanitized) && sanitized.length > 0) {
      const itemSize = jsonString.length / sanitized.length;
      const maxItems = Math.floor(maxSize / itemSize) - 1;
      return {
        data: sanitized.slice(0, maxItems),
        truncated: true,
        totalCount: sanitized.length,
        returnedCount: maxItems
      };
    }
    
    // For other types, return a truncation message
    return {
      error: 'Response too large',
      truncated: true,
      size: jsonString.length,
      maxSize
    };
  }
  
  return sanitized;
}