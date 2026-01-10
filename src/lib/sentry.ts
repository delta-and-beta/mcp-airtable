/**
 * Sentry integration for error tracking and request monitoring
 *
 * Configuration:
 * - SENTRY_DSN: Sentry DSN (optional - Sentry disabled if not set)
 * - SENTRY_DEBUG: Enable debug mode to capture all MCP requests (default: false)
 * - SENTRY_ENVIRONMENT: Environment name (default: NODE_ENV or 'development')
 * - SENTRY_TRACES_SAMPLE_RATE: Transaction sample rate 0-1 (default: 1.0 in debug, 0.1 in prod)
 */

import * as Sentry from "@sentry/node";

// Sentry configuration from environment
const SENTRY_DSN = process.env.SENTRY_DSN;
const SENTRY_DEBUG = process.env.SENTRY_DEBUG === "true";
const SENTRY_ENVIRONMENT = process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development";
const SENTRY_TRACES_SAMPLE_RATE = parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || (SENTRY_DEBUG ? "1.0" : "0.1"));

// Track if Sentry is enabled
let sentryEnabled = false;

/**
 * Initialize Sentry if DSN is configured
 * Call this early in application startup
 */
export function initSentry(): boolean {
  if (!SENTRY_DSN) {
    console.error("[Sentry] Disabled - SENTRY_DSN not configured");
    return false;
  }

  try {
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: SENTRY_ENVIRONMENT,
      debug: SENTRY_DEBUG,
      tracesSampleRate: SENTRY_TRACES_SAMPLE_RATE,

      // Set release version from package.json
      release: `mcp-airtable@${process.env.npm_package_version || "1.0.0"}`,

      // Integrations
      integrations: [
        // Capture unhandled promise rejections
        Sentry.onUnhandledRejectionIntegration(),
      ],

      // Don't send PII by default
      sendDefaultPii: false,

      // Filter sensitive data from breadcrumbs
      beforeBreadcrumb(breadcrumb) {
        // Remove API keys from breadcrumb data
        if (breadcrumb.data) {
          const sensitiveKeys = ["x-airtable-api-key", "authorization", "airtableApiKey"];
          for (const key of sensitiveKeys) {
            if (breadcrumb.data[key]) {
              breadcrumb.data[key] = "[REDACTED]";
            }
          }
        }
        return breadcrumb;
      },

      // Filter sensitive data from events
      beforeSend(event) {
        // Redact sensitive headers
        if (event.request?.headers) {
          const sensitiveHeaders = ["x-airtable-api-key", "authorization", "x-airtable-workspace-id"];
          for (const header of sensitiveHeaders) {
            if (event.request.headers[header]) {
              event.request.headers[header] = "[REDACTED]";
            }
          }
        }
        return event;
      },
    });

    sentryEnabled = true;
    console.error(`[Sentry] Initialized - environment: ${SENTRY_ENVIRONMENT}, debug: ${SENTRY_DEBUG}, sampleRate: ${SENTRY_TRACES_SAMPLE_RATE}`);
    return true;
  } catch (error) {
    console.error("[Sentry] Failed to initialize:", error);
    return false;
  }
}

/**
 * Check if Sentry is enabled
 */
export function isSentryEnabled(): boolean {
  return sentryEnabled;
}

/**
 * Check if Sentry debug mode is enabled
 */
export function isSentryDebug(): boolean {
  return SENTRY_DEBUG;
}

/**
 * Capture an exception in Sentry
 */
export function captureException(error: Error, context?: Record<string, unknown>): string | undefined {
  if (!sentryEnabled) return undefined;

  return Sentry.captureException(error, {
    extra: context,
  });
}

/**
 * Capture a message in Sentry
 */
export function captureMessage(message: string, level: Sentry.SeverityLevel = "info", context?: Record<string, unknown>): string | undefined {
  if (!sentryEnabled) return undefined;

  return Sentry.captureMessage(message, {
    level,
    extra: context,
  });
}

/**
 * Start a new Sentry transaction for MCP request tracking
 * Only creates transaction in debug mode or for errors
 */
export function startMcpTransaction(
  method: string,
  data?: Record<string, unknown>
): Sentry.Span | undefined {
  if (!sentryEnabled) return undefined;

  // Only capture all requests in debug mode
  if (!SENTRY_DEBUG) return undefined;

  return Sentry.startInactiveSpan({
    name: `mcp.${method}`,
    op: "mcp.request",
    attributes: {
      "mcp.method": method,
      ...data,
    },
  });
}

/**
 * Add breadcrumb for MCP request (always added for context)
 */
export function addMcpBreadcrumb(
  method: string,
  data?: Record<string, unknown>,
  level: Sentry.SeverityLevel = "info"
): void {
  if (!sentryEnabled) return;

  Sentry.addBreadcrumb({
    category: "mcp",
    message: `MCP ${method}`,
    level,
    data: {
      method,
      ...data,
    },
  });
}

/**
 * Set user context for Sentry
 */
export function setUser(user: { id?: string; email?: string; [key: string]: unknown }): void {
  if (!sentryEnabled) return;
  Sentry.setUser(user);
}

/**
 * Set extra context
 */
export function setContext(name: string, context: Record<string, unknown>): void {
  if (!sentryEnabled) return;
  Sentry.setContext(name, context);
}

/**
 * Set a tag
 */
export function setTag(key: string, value: string): void {
  if (!sentryEnabled) return;
  Sentry.setTag(key, value);
}

/**
 * Flush Sentry events (call before process exit)
 */
export async function flushSentry(timeout = 2000): Promise<boolean> {
  if (!sentryEnabled) return true;
  return Sentry.flush(timeout);
}

// Export Sentry for direct access if needed
export { Sentry };
