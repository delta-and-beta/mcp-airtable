/**
 * Custom error classes for proper error handling
 * Uses MCP-standard JSON-RPC 2.0 error codes
 */

// MCP/JSON-RPC 2.0 Error Codes
export const MCP_ERROR_CODES = {
  // MCP-specific errors (-32000 to -32099)
  AUTHENTICATION_ERROR: -32000,
  INVALID_SESSION: -32001,
  MISSING_SESSION_ID: -32003,

  // Standard JSON-RPC 2.0 errors
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;

export class AirtableError extends Error {
  public code: number;

  constructor(
    message: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = "AirtableError";
    this.code = MCP_ERROR_CODES.INTERNAL_ERROR;
  }
}

export class ValidationError extends Error {
  public code: number = MCP_ERROR_CODES.INVALID_PARAMS;

  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class AuthenticationError extends Error {
  public code: number = MCP_ERROR_CODES.AUTHENTICATION_ERROR;

  constructor(message: string = "Authentication required") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export class SessionError extends Error {
  public code: number;

  constructor(message: string = "Invalid session", code: number = MCP_ERROR_CODES.INVALID_SESSION) {
    super(message);
    this.name = "SessionError";
    this.code = code;
  }
}

export class RateLimitError extends Error {
  public code: number = MCP_ERROR_CODES.INTERNAL_ERROR;

  constructor(
    message: string = "Rate limit exceeded",
    public retryAfter?: number
  ) {
    super(message);
    this.name = "RateLimitError";
  }
}

// MCP-compliant error response format
export interface McpErrorResponse {
  error: {
    code: number;
    message: string;
    data?: {
      name: string;
      statusCode?: number;
      details?: any;
      retryAfter?: number;
    };
  };
}

// Legacy format for backward compatibility
export interface LegacyErrorResponse {
  error: string;
  message: string;
  statusCode?: number;
}

/**
 * Format error as MCP-compliant JSON-RPC 2.0 error
 */
export function formatMcpError(error: Error): McpErrorResponse {
  if (error instanceof AirtableError) {
    return {
      error: {
        code: error.code,
        message: error.message,
        data: {
          name: error.name,
          statusCode: error.statusCode,
          details: error.details,
        },
      },
    };
  }

  if (error instanceof ValidationError) {
    return {
      error: {
        code: error.code,
        message: error.message,
        data: { name: "ValidationError" },
      },
    };
  }

  if (error instanceof AuthenticationError) {
    return {
      error: {
        code: error.code,
        message: error.message,
        data: { name: "AuthenticationError" },
      },
    };
  }

  if (error instanceof SessionError) {
    return {
      error: {
        code: error.code,
        message: error.message,
        data: { name: "SessionError" },
      },
    };
  }

  if (error instanceof RateLimitError) {
    return {
      error: {
        code: error.code,
        message: error.message,
        data: {
          name: "RateLimitError",
          retryAfter: error.retryAfter,
        },
      },
    };
  }

  return {
    error: {
      code: MCP_ERROR_CODES.INTERNAL_ERROR,
      message: error.message,
      data: { name: "InternalServerError" },
    },
  };
}

/**
 * Format error response (legacy format for tool responses)
 */
export function formatErrorResponse(error: Error): LegacyErrorResponse {
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

  if (error instanceof SessionError) {
    return {
      error: "SessionError",
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
