# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
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

### Changed
- Consolidated types from `src/types.ts` into `src/lib/airtable/types.ts`
- Updated documentation (CLAUDE.md, README.md, DEPLOYMENT_PROMPT.md, PRODUCTION_READY.md)
- Enhanced examples documentation

### Fixed
- Improved error handling in batch operations
