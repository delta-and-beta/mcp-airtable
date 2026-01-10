# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Circuit Breaker Pattern**: Prevents cascading failures with automatic recovery
  - Three states: CLOSED (normal), OPEN (failing fast), HALF_OPEN (testing recovery)
  - Configurable failure threshold, reset timeout, success threshold
  - Windowed failure counting to ignore old failures
  - Global circuit breaker registry for shared breakers
  - `CircuitBreakerError` with retry timing information
  - 24 new unit tests for circuit breaker functionality
- **Request Timeout**: Configurable timeout for HTTP requests using AbortController
  - Default timeout of 30000ms per request attempt
  - `timeoutMs` option in `FetchOptions` and `RetryOptions`
  - Each retry attempt gets its own fresh timeout
  - Throws `TimeoutError` with details (timeout duration, URL)
  - Timeout errors are retryable (like network errors)
  - 8 new unit tests for timeout functionality
- **Modular Architecture**: Refactored Airtable client into modular components (`src/lib/airtable/`)
  - `client.ts` - Main AirtableClient class
  - `fetch.ts` - Fetch utility with detailed error handling
  - `types.ts` - Shared TypeScript interfaces
  - `mime-types.ts` - MIME type utilities for attachments
- **Sentry Integration**: Optional error tracking via `SENTRY_DSN` environment variable
  - Debug mode for full request tracing (`SENTRY_DEBUG=true`)
  - Sensitive data redaction (API keys never sent)
  - Graceful shutdown with event flushing
- **Enhanced E2E Tests**: 200-record batch testing
  - Creates 200 records in 20 batches of 10
  - Tests rate limiting with 100ms delay between batches
  - Verifies all records created successfully
- **PDF Upload/Download Validation Test**: New e2e test for PDF attachments
  - Creates minimal valid PDF, uploads to Airtable
  - Downloads from Airtable CDN and validates integrity
  - Checks magic bytes (`%PDF-`) and file size match
  - Records preserved after test for manual review
- **Retry with Exponential Backoff**: Automatic retry for transient failures
  - Retries on HTTP 429, 500, 502, 503, 504 errors
  - Retries on network errors (ECONNRESET, ETIMEDOUT, ECONNREFUSED)
  - Respects Retry-After header for rate limits
  - Configurable max retries, delays, and jitter
  - 25 new unit tests for retry logic

### Changed
- Consolidated types from `src/types.ts` into `src/lib/airtable/types.ts`
- Updated documentation (CLAUDE.md, README.md, DEPLOYMENT_PROMPT.md, PRODUCTION_READY.md)
- Enhanced examples documentation

### Fixed
- Improved error handling in batch operations
