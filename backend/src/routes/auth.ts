/**
 * Auth Routes
 * Handles login, logout, password management, and current user info
 */

import { Hono } from 'hono';
import { authService } from '../services/auth-service';
import { authMiddleware, getUser } from '../middleware/auth';
import { ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';

export const authRoutes = new Hono();

/**
 * POST /auth/login
 * Login with username and password
 */
authRoutes.post('/login', async (c) => {
  const body = await c.req.json();
  const { username, password } = body;

  if (!username || typeof username !== 'string') {
    throw new ValidationError('Username is required');
  }

  if (!password || typeof password !== 'string') {
    throw new ValidationError('Password is required');
  }

  const result = await authService.login(username.trim(), password);

  return c.json({
    success: true,
    data: result,
  });
});

/**
 * GET /auth/me
 * Get current user info (requires auth)
 */
authRoutes.get('/me', authMiddleware, async (c) => {
  const user = getUser(c);

  if (!user) {
    return c.json({ success: false, error: 'Not authenticated' }, 401);
  }

  // Get full user info from database
  const fullUser = await authService.getUserById(user.userId);

  if (!fullUser) {
    return c.json({ success: false, error: 'User not found' }, 404);
  }

  return c.json({
    success: true,
    data: fullUser,
  });
});

/**
 * POST /auth/change-password
 * Change current user's password (requires auth)
 */
authRoutes.post('/change-password', authMiddleware, async (c) => {
  const user = getUser(c);

  if (!user) {
    return c.json({ success: false, error: 'Not authenticated' }, 401);
  }

  const body = await c.req.json();
  const { oldPassword, newPassword } = body;

  if (!oldPassword || typeof oldPassword !== 'string') {
    throw new ValidationError('Current password is required');
  }

  if (!newPassword || typeof newPassword !== 'string') {
    throw new ValidationError('New password is required');
  }

  if (newPassword.length < 1) {
    throw new ValidationError('New password cannot be empty');
  }

  await authService.changePassword(user.userId, oldPassword, newPassword);

  return c.json({
    success: true,
    message: 'Password changed successfully',
  });
});

/**
 * POST /auth/logout
 * Logout (client-side token removal, just log the event)
 */
authRoutes.post('/logout', authMiddleware, async (c) => {
  const user = getUser(c);

  if (user) {
    logger.auth('logout', user.username, { userId: user.userId });
  }

  return c.json({
    success: true,
    message: 'Logged out successfully',
  });
});

/**
 * GET /auth/validate
 * Validate current token (useful for frontend to check if token is still valid)
 */
authRoutes.get('/validate', authMiddleware, async (c) => {
  const user = getUser(c);

  return c.json({
    success: true,
    valid: true,
    user: user,
  });
});
