export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public details?: any) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class AirtableError extends Error {
  constructor(message: string, public statusCode?: number, public details?: any) {
    super(message);
    this.name = 'AirtableError';
  }
}

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

export function formatErrorResponse(error: Error): {
  error: string;
  details?: any;
  statusCode?: number;
} {
  if (error instanceof ValidationError) {
    return {
      error: error.message,
      details: error.details,
    };
  }
  
  if (error instanceof AirtableError) {
    return {
      error: error.message,
      statusCode: error.statusCode,
      details: error.details,
    };
  }
  
  if (error instanceof RateLimitError) {
    return {
      error: error.message,
      statusCode: 429,
    };
  }
  
  if (error instanceof AuthenticationError) {
    return {
      error: error.message,
      statusCode: 401,
    };
  }
  
  if (error instanceof ConfigurationError) {
    return {
      error: error.message,
      statusCode: 500,
    };
  }
  
  return {
    error: error.message || 'Internal server error',
    statusCode: 500,
  };
}