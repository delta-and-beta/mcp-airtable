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

const statusDescriptions: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
};

function getStatusDescription(code: number): string {
  return statusDescriptions[code] || `Error ${code}`;
}

export function formatErrorResponse(error: Error): {
  error: string;
  details?: any;
  statusCode?: number;
} {
  let statusCode: number;
  let message = error.message;
  let details: any;

  if (error instanceof ValidationError) {
    statusCode = 400;
    details = error.details;
  } else if (error instanceof AirtableError) {
    statusCode = error.statusCode || 500;
    details = error.details;
  } else if (error instanceof RateLimitError) {
    statusCode = 429;
  } else if (error instanceof AuthenticationError) {
    statusCode = 401;
  } else if (error instanceof ConfigurationError) {
    statusCode = 500;
  } else {
    statusCode = 500;
    message = error.message || 'Internal server error';
  }

  // Prefix message with status description
  const statusDesc = getStatusDescription(statusCode);
  const formattedMessage = `[${statusDesc}] ${message}`;

  return {
    error: formattedMessage,
    statusCode,
    ...(details && { details }),
  };
}