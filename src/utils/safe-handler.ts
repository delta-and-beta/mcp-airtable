import { logger } from './logger.js';

/**
 * Wraps a tool handler to ensure safe execution and proper error handling
 */
export function createSafeHandler<T extends (...args: any[]) => any>(
  handlerName: string,
  handler: T
): T {
  return (async (...args: Parameters<T>) => {
    try {
      // Validate inputs
      const [params] = args;
      if (params && typeof params === 'object') {
        // Check for any potentially problematic values
        for (const [key, value] of Object.entries(params)) {
          if (value === undefined) {
            logger.warn(`Undefined value for parameter '${key}' in ${handlerName}`);
          }
        }
      }
      
      // Execute the handler
      const result = await handler(...args);
      
      // Ensure we always return something
      if (result === undefined) {
        logger.warn(`Handler ${handlerName} returned undefined, returning null instead`);
        return null;
      }
      
      return result;
    } catch (error) {
      logger.error(`Error in handler ${handlerName}:`, error as Error);
      
      // Re-throw with more context
      if (error instanceof Error) {
        error.message = `[${handlerName}] ${error.message}`;
      }
      throw error;
    }
  }) as T;
}