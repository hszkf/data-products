/**
 * Authentication Middleware
 * Verifies JWT tokens and attaches user info to request context
 */

import type { Context, Next } from 'hono';
import { verifyToken } from '../services/auth-service';
import type { AuthTokenPayload, UserRole, Team } from '../models/user';
import { AuthenticationError } from '../utils/errors';
import { logger } from '../utils/logger';

/**
 * Extended context with user information
 */
export interface AuthContext {
  user: AuthTokenPayload;
}

/**
 * Get auth token from request headers
 */
function getTokenFromHeader(c: Context): string | null {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) return null;

  // Support "Bearer <token>" format
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  return authHeader;
}

/**
 * Auth middleware - requires valid JWT token
 * Attaches user info to context variables
 */
export async function authMiddleware(c: Context, next: Next) {
  const token = getTokenFromHeader(c);

  if (!token) {
    throw new AuthenticationError('No authorization token provided');
  }

  const payload = verifyToken(token);

  if (!payload) {
    throw new AuthenticationError('Invalid or expired token');
  }

  // Attach user to context
  c.set('user', payload);
  c.set('userId', payload.userId);
  c.set('username', payload.username);
  c.set('role', payload.role);
  c.set('team', payload.team);

  await next();
}

/**
 * Optional auth middleware - doesn't require token but uses it if present
 * Useful for routes that work differently for authenticated vs anonymous users
 */
export async function optionalAuthMiddleware(c: Context, next: Next) {
  const token = getTokenFromHeader(c);

  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      c.set('user', payload);
      c.set('userId', payload.userId);
      c.set('username', payload.username);
      c.set('role', payload.role);
      c.set('team', payload.team);
    }
  }

  await next();
}

/**
 * Get user from context (for use in route handlers)
 * Returns null if no user is authenticated
 */
export function getUser(c: Context): AuthTokenPayload | null {
  return c.get('user') || null;
}

/**
 * Get user from context (throws if not authenticated)
 */
export function requireUser(c: Context): AuthTokenPayload {
  const user = getUser(c);
  if (!user) {
    throw new AuthenticationError('Authentication required');
  }
  return user;
}

/**
 * Check if current user has a specific role
 */
export function hasRole(c: Context, ...roles: UserRole[]): boolean {
  const user = getUser(c);
  if (!user) return false;
  return roles.includes(user.role);
}

/**
 * Check if current user belongs to a specific team
 */
export function hasTeam(c: Context, ...teams: Team[]): boolean {
  const user = getUser(c);
  if (!user || !user.team) return false;
  return teams.includes(user.team);
}
