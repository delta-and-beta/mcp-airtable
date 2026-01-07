import { describe, it, expect } from "vitest";
import {
  AirtableError,
  ValidationError,
  AuthenticationError,
  RateLimitError,
  formatErrorResponse,
} from "../../lib/errors.js";

describe("AirtableError", () => {
  it("should create error with default status code", () => {
    const error = new AirtableError("Test error");
    expect(error.message).toBe("Test error");
    expect(error.statusCode).toBe(500);
    expect(error.name).toBe("AirtableError");
  });

  it("should create error with custom status code", () => {
    const error = new AirtableError("Not found", 404);
    expect(error.statusCode).toBe(404);
  });

  it("should create error with details", () => {
    const details = { endpoint: "listBases", baseId: "app123" };
    const error = new AirtableError("API error", 400, details);
    expect(error.details).toEqual(details);
  });

  it("should be instanceof Error", () => {
    const error = new AirtableError("Test");
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AirtableError);
  });
});

describe("ValidationError", () => {
  it("should create validation error", () => {
    const error = new ValidationError("Invalid input");
    expect(error.message).toBe("Invalid input");
    expect(error.name).toBe("ValidationError");
  });

  it("should be instanceof Error", () => {
    const error = new ValidationError("Test");
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ValidationError);
  });
});

describe("AuthenticationError", () => {
  it("should create auth error with default message", () => {
    const error = new AuthenticationError();
    expect(error.message).toBe("Authentication required");
    expect(error.name).toBe("AuthenticationError");
  });

  it("should create auth error with custom message", () => {
    const error = new AuthenticationError("Invalid API key");
    expect(error.message).toBe("Invalid API key");
  });

  it("should be instanceof Error", () => {
    const error = new AuthenticationError();
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AuthenticationError);
  });
});

describe("RateLimitError", () => {
  it("should create rate limit error with default message", () => {
    const error = new RateLimitError();
    expect(error.message).toBe("Rate limit exceeded");
    expect(error.name).toBe("RateLimitError");
    expect(error.retryAfter).toBeUndefined();
  });

  it("should create rate limit error with custom message", () => {
    const error = new RateLimitError("Too many requests");
    expect(error.message).toBe("Too many requests");
  });

  it("should include retryAfter value", () => {
    const error = new RateLimitError("Rate limit", 60);
    expect(error.retryAfter).toBe(60);
  });

  it("should be instanceof Error", () => {
    const error = new RateLimitError();
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(RateLimitError);
  });
});

describe("formatErrorResponse", () => {
  it("should format AirtableError", () => {
    const error = new AirtableError("API failed", 503);
    const response = formatErrorResponse(error);
    expect(response).toEqual({
      error: "AirtableError",
      message: "API failed",
      statusCode: 503,
    });
  });

  it("should format ValidationError with 400 status", () => {
    const error = new ValidationError("Bad input");
    const response = formatErrorResponse(error);
    expect(response).toEqual({
      error: "ValidationError",
      message: "Bad input",
      statusCode: 400,
    });
  });

  it("should format AuthenticationError with 401 status", () => {
    const error = new AuthenticationError("No API key");
    const response = formatErrorResponse(error);
    expect(response).toEqual({
      error: "AuthenticationError",
      message: "No API key",
      statusCode: 401,
    });
  });

  it("should format RateLimitError with 429 status", () => {
    const error = new RateLimitError("Too fast");
    const response = formatErrorResponse(error);
    expect(response).toEqual({
      error: "RateLimitError",
      message: "Too fast",
      statusCode: 429,
    });
  });

  it("should format generic Error with 500 status", () => {
    const error = new Error("Unknown error");
    const response = formatErrorResponse(error);
    expect(response).toEqual({
      error: "InternalServerError",
      message: "Unknown error",
      statusCode: 500,
    });
  });

  it("should handle errors without message", () => {
    const error = new Error();
    const response = formatErrorResponse(error);
    expect(response.error).toBe("InternalServerError");
    expect(response.statusCode).toBe(500);
  });
});
