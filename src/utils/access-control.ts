/**
 * Access control utilities for restricting access to bases, tables, and views
 */

import { config } from './config.js';
import { logger } from './logger.js';
import { AuthenticationError } from './errors.js';

interface AccessControlConfig {
  allowedBases: string[];
  allowedTables: string[];
  allowedViews: string[];
  blockedBases: string[];
  blockedTables: string[];
  blockedViews: string[];
  mode: 'allowlist' | 'blocklist' | 'both';
}

let accessConfig: AccessControlConfig | null = null;

/**
 * Parse comma-separated environment variable into array
 */
function parseList(value?: string): string[] {
  if (!value || value.trim() === '') return [];
  return value.split(',').map(item => item.trim()).filter(Boolean);
}

/**
 * Get access control configuration
 */
function getAccessConfig(): AccessControlConfig {
  if (!accessConfig) {
    accessConfig = {
      allowedBases: parseList(config.ALLOWED_BASES),
      allowedTables: parseList(config.ALLOWED_TABLES),
      allowedViews: parseList(config.ALLOWED_VIEWS),
      blockedBases: parseList(config.BLOCKED_BASES),
      blockedTables: parseList(config.BLOCKED_TABLES),
      blockedViews: parseList(config.BLOCKED_VIEWS),
      mode: config.ACCESS_CONTROL_MODE,
    };

    logger.info('Access control configured', {
      mode: accessConfig.mode,
      allowedBases: accessConfig.allowedBases.length,
      allowedTables: accessConfig.allowedTables.length,
      allowedViews: accessConfig.allowedViews.length,
      blockedBases: accessConfig.blockedBases.length,
      blockedTables: accessConfig.blockedTables.length,
      blockedViews: accessConfig.blockedViews.length,
    });
  }
  return accessConfig;
}

/**
 * Check if a base is allowed
 */
export function isBaseAllowed(baseId: string): boolean {
  const { allowedBases, blockedBases, mode } = getAccessConfig();
  
  // Check blocklist first (always takes precedence)
  if (blockedBases.length > 0 && blockedBases.includes(baseId)) {
    logger.warn('Base access denied (blocklisted)', { baseId });
    return false;
  }
  
  // Check allowlist
  if (mode === 'allowlist' || mode === 'both') {
    if (allowedBases.length === 0) {
      // No allowlist configured means all bases are allowed (unless blocked)
      return true;
    }
    const allowed = allowedBases.includes(baseId);
    if (!allowed) {
      logger.warn('Base access denied (not in allowlist)', { baseId });
    }
    return allowed;
  }
  
  // Blocklist mode only - allowed unless specifically blocked
  return true;
}

/**
 * Check if a table is allowed
 */
export function isTableAllowed(tableName: string, tableId?: string): boolean {
  const { allowedTables, blockedTables, mode } = getAccessConfig();
  
  // Check blocklist first (always takes precedence)
  if (blockedTables.length > 0) {
    if (blockedTables.includes(tableName) || (tableId && blockedTables.includes(tableId))) {
      logger.warn('Table access denied (blocklisted)', { tableName, tableId });
      return false;
    }
  }
  
  // Check allowlist
  if (mode === 'allowlist' || mode === 'both') {
    if (allowedTables.length === 0) {
      // No allowlist configured means all tables are allowed (unless blocked)
      return true;
    }
    const allowed = allowedTables.includes(tableName) || (tableId ? allowedTables.includes(tableId) : false);
    if (!allowed) {
      logger.warn('Table access denied (not in allowlist)', { tableName, tableId });
    }
    return allowed;
  }
  
  // Blocklist mode only - allowed unless specifically blocked
  return true;
}

/**
 * Check if a view is allowed
 */
export function isViewAllowed(viewName: string, viewId?: string): boolean {
  const { allowedViews, blockedViews, mode } = getAccessConfig();
  
  // Check blocklist first (always takes precedence)
  if (blockedViews.length > 0) {
    if (blockedViews.includes(viewName) || (viewId && blockedViews.includes(viewId))) {
      logger.warn('View access denied (blocklisted)', { viewName, viewId });
      return false;
    }
  }
  
  // Check allowlist
  if (mode === 'allowlist' || mode === 'both') {
    if (allowedViews.length === 0) {
      // No allowlist configured means all views are allowed (unless blocked)
      return true;
    }
    const allowed = allowedViews.includes(viewName) || (viewId ? allowedViews.includes(viewId) : false);
    if (!allowed) {
      logger.warn('View access denied (not in allowlist)', { viewName, viewId });
    }
    return allowed;
  }
  
  // Blocklist mode only - allowed unless specifically blocked
  return true;
}

/**
 * Filter bases based on access control
 */
export function filterBases(bases: Array<{ id: string; name?: string }>): Array<{ id: string; name?: string }> {
  return bases.filter(base => isBaseAllowed(base.id));
}

/**
 * Filter tables based on access control
 */
export function filterTables(tables: Array<{ id: string; name: string }>): Array<{ id: string; name: string }> {
  return tables.filter(table => isTableAllowed(table.name, table.id));
}

/**
 * Filter views based on access control
 */
export function filterViews(views: Array<{ id: string; name: string }>): Array<{ id: string; name: string }> {
  return views.filter(view => isViewAllowed(view.name, view.id));
}

/**
 * Throw error if base is not allowed
 */
export function enforceBaseAccess(baseId: string): void {
  if (!isBaseAllowed(baseId)) {
    throw new AuthenticationError(`Access denied: Base '${baseId}' is not allowed`);
  }
}

/**
 * Throw error if table is not allowed
 */
export function enforceTableAccess(tableName: string, tableId?: string): void {
  if (!isTableAllowed(tableName, tableId)) {
    throw new AuthenticationError(`Access denied: Table '${tableName}' is not allowed`);
  }
}

/**
 * Throw error if view is not allowed
 */
export function enforceViewAccess(viewName: string, viewId?: string): void {
  if (!isViewAllowed(viewName, viewId)) {
    throw new AuthenticationError(`Access denied: View '${viewName}' is not allowed`);
  }
}

/**
 * Get access control summary for logging
 */
export function getAccessControlSummary(): string {
  const config = getAccessConfig();
  const parts: string[] = [];
  
  if (config.allowedBases.length > 0) {
    parts.push(`${config.allowedBases.length} allowed bases`);
  }
  if (config.allowedTables.length > 0) {
    parts.push(`${config.allowedTables.length} allowed tables`);
  }
  if (config.allowedViews.length > 0) {
    parts.push(`${config.allowedViews.length} allowed views`);
  }
  if (config.blockedBases.length > 0) {
    parts.push(`${config.blockedBases.length} blocked bases`);
  }
  if (config.blockedTables.length > 0) {
    parts.push(`${config.blockedTables.length} blocked tables`);
  }
  if (config.blockedViews.length > 0) {
    parts.push(`${config.blockedViews.length} blocked views`);
  }
  
  if (parts.length === 0) {
    return `No access restrictions (mode: ${config.mode})`;
  }
  
  return `Access control (${config.mode}): ${parts.join(', ')}`;
}