/**
 * Custom error classes for proper error handling
 */

export class AirtableError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = "AirtableError";
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class AuthenticationError extends Error {
  constructor(message: string = "Authentication required") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export class RateLimitError extends Error {
  constructor(
    message: string = "Rate limit exceeded",
    public retryAfter?: number
  ) {
    super(message);
    this.name = "RateLimitError";
  }
}

export function formatErrorResponse(error: Error): { error: string; message: string; statusCode?: number } {
  if (error instanceof AirtableError) {
    return {
      error: error.name,
      message: error.message,
      statusCode: error.statusCode,
    };
  }

  if (error instanceof ValidationError) {
    return {
      error: "ValidationError",
      message: error.message,
      statusCode: 400,
    };
  }

  if (error instanceof AuthenticationError) {
    return {
      error: "AuthenticationError",
      message: error.message,
      statusCode: 401,
    };
  }

  if (error instanceof RateLimitError) {
    return {
      error: "RateLimitError",
      message: error.message,
      statusCode: 429,
    };
  }

  return {
    error: "InternalServerError",
    message: error.message,
    statusCode: 500,
  };
}
