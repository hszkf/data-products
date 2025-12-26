/**
 * Role-Based Access Control Middleware
 * Checks if user has required role or permission to access a route
 */

import type { Context, Next } from 'hono';
import { getUser } from './auth';
import type { UserRole, Permission } from '../models/user';
import { hasPermission } from '../models/user';
import { AuthorizationError, AuthenticationError } from '../utils/errors';
import { logger } from '../utils/logger';

/**
 * Middleware factory: requires user to have one of the specified roles
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return async (c: Context, next: Next) => {
    const user = getUser(c);

    if (!user) {
      throw new AuthenticationError('Authentication required');
    }

    if (!allowedRoles.includes(user.role)) {
      logger.warn('Access denied - insufficient role', {
        userId: user.userId,
        metadata: {
          username: user.username,
          userRole: user.role,
          requiredRoles: allowedRoles,
          path: c.req.path,
          method: c.req.method,
        },
      });
      throw new AuthorizationError(`Role '${allowedRoles.join("' or '")}' required`);
    }

    await next();
  };
}

/**
 * Middleware factory: requires user to have a specific permission
 */
export function requirePermission(permission: Permission) {
  return async (c: Context, next: Next) => {
    const user = getUser(c);

    if (!user) {
      throw new AuthenticationError('Authentication required');
    }

    if (!hasPermission(user.role, permission)) {
      logger.warn('Access denied - insufficient permission', {
        userId: user.userId,
        metadata: {
          username: user.username,
          userRole: user.role,
          requiredPermission: permission,
          path: c.req.path,
          method: c.req.method,
        },
      });
      throw new AuthorizationError(`Permission '${permission}' required`);
    }

    await next();
  };
}

/**
 * Middleware: requires admin role
 */
export const requireAdmin = requireRole('admin');

/**
 * Middleware: requires editor or admin role
 */
export const requireEditor = requireRole('admin', 'editor');

/**
 * Middleware: requires viewer, editor, or admin role (any authenticated user)
 */
export const requireViewer = requireRole('admin', 'editor', 'viewer');

/**
 * Middleware factory: requires user to be the owner or have admin role
 * Useful for routes where users can only modify their own resources
 */
export function requireOwnerOrAdmin(getUserIdFromRequest: (c: Context) => number) {
  return async (c: Context, next: Next) => {
    const user = getUser(c);

    if (!user) {
      throw new AuthenticationError('Authentication required');
    }

    const resourceOwnerId = getUserIdFromRequest(c);

    // Admin can access anything
    if (user.role === 'admin') {
      await next();
      return;
    }

    // Check if user owns the resource
    if (user.userId !== resourceOwnerId) {
      logger.warn('Access denied - not owner', {
        userId: user.userId,
        metadata: {
          username: user.username,
          resourceOwnerId,
          path: c.req.path,
          method: c.req.method,
        },
      });
      throw new AuthorizationError('You can only access your own resources');
    }

    await next();
  };
}

/**
 * Check permission inline (for use within route handlers)
 * Throws AuthorizationError if user doesn't have permission
 */
export function checkPermission(c: Context, permission: Permission): void {
  const user = getUser(c);

  if (!user) {
    throw new AuthenticationError('Authentication required');
  }

  if (!hasPermission(user.role, permission)) {
    throw new AuthorizationError(`Permission '${permission}' required`);
  }
}

/**
 * Check role inline (for use within route handlers)
 * Throws AuthorizationError if user doesn't have role
 */
export function checkRole(c: Context, ...allowedRoles: UserRole[]): void {
  const user = getUser(c);

  if (!user) {
    throw new AuthenticationError('Authentication required');
  }

  if (!allowedRoles.includes(user.role)) {
    throw new AuthorizationError(`Role '${allowedRoles.join("' or '")}' required`);
  }
}
