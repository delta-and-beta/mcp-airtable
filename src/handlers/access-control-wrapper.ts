/**
 * Wrapper to add access control checks to handlers
 */

import { enforceBaseAccess, enforceTableAccess, enforceViewAccess } from '../utils/access-control.js';

interface BaseTableArgs {
  baseId?: string;
  tableName: string;
  view?: string;
}

/**
 * Check access control for operations on tables
 */
export function checkTableAccess(args: BaseTableArgs): void {
  // Check base access if baseId provided
  if (args.baseId) {
    enforceBaseAccess(args.baseId);
  }
  
  // Check table access
  enforceTableAccess(args.tableName);
  
  // Check view access if view provided
  if (args.view) {
    enforceViewAccess(args.view);
  }
}

/**
 * Wrap a handler with access control checks
 */
export function withTableAccessControl<T extends BaseTableArgs>(
  handler: (args: T) => Promise<any>
): (args: T) => Promise<any> {
  return async (args: T) => {
    checkTableAccess(args);
    return handler(args);
  };
}