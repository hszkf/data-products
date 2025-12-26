/**
 * Query Guard Middleware
 * Blocks dangerous SQL commands based on user role
 */

import type { Context, Next } from 'hono';
import { getUser } from './auth';
import type { UserRole } from '../models/user';
import { hasPermission } from '../models/user';
import { QueryBlockedError, AuthenticationError } from '../utils/errors';
import { logger } from '../utils/logger';
import { queryLogger } from '../services/query-logger';

/**
 * SQL command patterns and their required permissions
 */
const SQL_PATTERNS = {
  // DDL commands (require canExecuteDDL)
  ddl: [
    /\bDROP\s+(TABLE|DATABASE|INDEX|VIEW|SCHEMA|PROCEDURE|FUNCTION|TRIGGER)/i,
    /\bTRUNCATE\s+TABLE/i,
    /\bALTER\s+(TABLE|DATABASE|INDEX|VIEW|SCHEMA|PROCEDURE|FUNCTION)/i,
    /\bCREATE\s+(TABLE|DATABASE|INDEX|VIEW|SCHEMA|PROCEDURE|FUNCTION|TRIGGER)/i,
  ],
  // DELETE commands (require canExecuteDelete)
  delete: [
    /\bDELETE\s+FROM/i,
    /\bDELETE\s+\w+\s+FROM/i, // DELETE alias FROM
  ],
  // UPDATE commands (require canExecuteUpdate)
  update: [
    /\bUPDATE\s+\w+\s+SET/i,
  ],
  // INSERT commands (require canExecuteInsert)
  insert: [
    /\bINSERT\s+INTO/i,
    /\bINSERT\s+\w+\s*\(/i, // INSERT table (columns)
  ],
};

/**
 * Blocked commands per role
 * Based on the permissions matrix
 */
const BLOCKED_COMMANDS = {
  viewer: ['DDL', 'DELETE', 'UPDATE', 'INSERT'],
  editor: ['DDL', 'DELETE', 'UPDATE'],
  admin: [], // Admin has full access
} as const;

/**
 * Check if a query contains blocked commands for a role
 */
export function checkQuery(query: string, role: UserRole): { allowed: boolean; blockedCommand?: string } {
  const blockedTypes = BLOCKED_COMMANDS[role];
  
  for (const blockedType of blockedTypes) {
    let patterns: RegExp[];
    
    switch (blockedType) {
      case 'DDL':
        patterns = SQL_PATTERNS.ddl;
        break;
      case 'DELETE':
        patterns = SQL_PATTERNS.delete;
        break;
      case 'UPDATE':
        patterns = SQL_PATTERNS.update;
        break;
      case 'INSERT':
        patterns = SQL_PATTERNS.insert;
        break;
      default:
        continue;
    }
    
    for (const pattern of patterns) {
      if (pattern.test(query)) {
        // Extract the matched command for error message
        const match = query.match(pattern);
        const command = match && match[0] ? match[0].split(/\s+/)[0]?.toUpperCase() || blockedType : blockedType;
        return { allowed: false, blockedCommand: command };
      }
    }
  }
  
  return { allowed: true };
}

/**
 * Get list of blocked commands for a role
 */
export function getBlockedCommandsForRole(role: UserRole): string[] {
  const blocked: string[] = [];
  
  if (!hasPermission(role, 'canExecuteDDL')) {
    blocked.push('DROP', 'TRUNCATE', 'ALTER', 'CREATE');
  }
  if (!hasPermission(role, 'canExecuteDelete')) {
    blocked.push('DELETE');
  }
  if (!hasPermission(role, 'canExecuteUpdate')) {
    blocked.push('UPDATE');
  }
  if (!hasPermission(role, 'canExecuteInsert')) {
    blocked.push('INSERT');
  }
  
  return blocked;
}

/**
 * Query guard middleware factory
 * Checks if user has permission to execute the query
 */
export function queryGuard(database: 'sqlserver' | 'redshift') {
  return async (c: Context, next: Next) => {
    const user = getUser(c);
    
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }
    
    // Get query from request body
    let query: string;
    try {
      const body = await c.req.json();
      query = body.query || body.sql || '';
    } catch {
      // If we can't parse the body, let the route handler deal with it
      await next();
      return;
    }
    
    if (!query) {
      await next();
      return;
    }
    
    // Check if query is allowed
    const { allowed, blockedCommand } = checkQuery(query, user.role);
    
    if (!allowed && blockedCommand) {
      // Log the blocked query
      await queryLogger.log({
        userId: user.userId,
        username: user.username,
        role: user.role,
        database,
        query,
        executionTimeMs: 0,
        rowCount: 0,
        status: 'blocked',
        blockedReason: `${blockedCommand} commands are not allowed for ${user.role} role`,
        clientIp: c.req.header('x-forwarded-for') || c.req.header('x-real-ip'),
      });
      
      logger.warn('Query blocked', {
        userId: user.userId,
        metadata: {
          username: user.username,
          role: user.role,
          blockedCommand,
          database,
          queryPreview: query.slice(0, 100),
        },
      });
      
      throw new QueryBlockedError(blockedCommand, user.role);
    }
    
    // Store query info for logging after execution
    c.set('queryInfo', {
      query,
      database,
      startTime: Date.now(),
    });
    
    await next();
  };
}

interface QueryInfo {
  query: string;
  database: 'sqlserver' | 'redshift';
  startTime: number;
}

interface QueryResult {
  row_count?: number;
  rowCount?: number;
  status?: string;
  success?: boolean;
  error?: string;
}

/**
 * Query result logger middleware
 * Logs query execution results (success or error)
 */
export function queryResultLogger() {
  return async (c: Context, next: Next) => {
    const user = getUser(c);
    const queryInfo = c.get('queryInfo') as QueryInfo | undefined;
    
    try {
      await next();
      
      // Log successful query
      if (user && queryInfo) {
        const response = c.res.clone();
        try {
          const result = await response.json() as QueryResult;
          await queryLogger.log({
            userId: user.userId,
            username: user.username,
            role: user.role,
            database: queryInfo.database,
            query: queryInfo.query,
            executionTimeMs: Date.now() - queryInfo.startTime,
            rowCount: result.row_count || result.rowCount || 0,
            status: result.status === 'success' || result.success ? 'success' : 'error',
            errorMessage: result.error,
            clientIp: c.req.header('x-forwarded-for') || c.req.header('x-real-ip'),
          });
        } catch {
          // Couldn't parse response, skip logging
        }
      }
    } catch (error) {
      // Log failed query
      if (user && queryInfo) {
        await queryLogger.log({
          userId: user.userId,
          username: user.username,
          role: user.role,
          database: queryInfo.database,
          query: queryInfo.query,
          executionTimeMs: Date.now() - queryInfo.startTime,
          rowCount: 0,
          status: 'error',
          errorMessage: (error as Error).message,
          clientIp: c.req.header('x-forwarded-for') || c.req.header('x-real-ip'),
        });
      }
      throw error;
    }
  };
}
