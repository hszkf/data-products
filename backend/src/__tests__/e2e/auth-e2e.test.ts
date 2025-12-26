/**
 * End-to-End Tests for Authentication System
 * Tests the full auth flow including login, permissions, and query guards
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { Hono } from 'hono';

// Mock the database to avoid needing actual SQL Server connection
const mockUsers = [
  { id: 1, username: 'admin', password_hash: '', role: 'admin', team: 'data-science', display_name: 'Admin User', is_active: true, created_at: new Date(), last_login: null },
  { id: 2, username: 'editor', password_hash: '', role: 'editor', team: 'data-science', display_name: 'Editor User', is_active: true, created_at: new Date(), last_login: null },
  { id: 3, username: 'viewer', password_hash: '', role: 'viewer', team: 'business-intelligence', display_name: 'Viewer User', is_active: true, created_at: new Date(), last_login: null },
];

// Test the checkQuery function directly
import { checkQuery, getBlockedCommandsForRole } from '../../middleware/query-guard';

describe('Query Guard - checkQuery function', () => {
  
  describe('Admin role', () => {
    test('allows SELECT queries', () => {
      const result = checkQuery('SELECT * FROM users', 'admin');
      expect(result.allowed).toBe(true);
    });

    test('allows INSERT queries', () => {
      const result = checkQuery('INSERT INTO users (name) VALUES ("test")', 'admin');
      expect(result.allowed).toBe(true);
    });

    test('allows UPDATE queries', () => {
      const result = checkQuery('UPDATE users SET name = "test" WHERE id = 1', 'admin');
      expect(result.allowed).toBe(true);
    });

    test('allows DELETE queries', () => {
      const result = checkQuery('DELETE FROM users WHERE id = 1', 'admin');
      expect(result.allowed).toBe(true);
    });

    test('allows DROP TABLE', () => {
      const result = checkQuery('DROP TABLE users', 'admin');
      expect(result.allowed).toBe(true);
    });

    test('allows TRUNCATE TABLE', () => {
      const result = checkQuery('TRUNCATE TABLE users', 'admin');
      expect(result.allowed).toBe(true);
    });

    test('allows ALTER TABLE', () => {
      const result = checkQuery('ALTER TABLE users ADD COLUMN email VARCHAR(255)', 'admin');
      expect(result.allowed).toBe(true);
    });
  });

  describe('Editor role', () => {
    test('allows SELECT queries', () => {
      const result = checkQuery('SELECT * FROM users', 'editor');
      expect(result.allowed).toBe(true);
    });

    test('allows INSERT queries', () => {
      const result = checkQuery('INSERT INTO users (name) VALUES ("test")', 'editor');
      expect(result.allowed).toBe(true);
    });

    test('blocks UPDATE queries', () => {
      const result = checkQuery('UPDATE users SET name = "test" WHERE id = 1', 'editor');
      expect(result.allowed).toBe(false);
      expect(result.blockedCommand).toBe('UPDATE');
    });

    test('blocks DELETE queries', () => {
      const result = checkQuery('DELETE FROM users WHERE id = 1', 'editor');
      expect(result.allowed).toBe(false);
      expect(result.blockedCommand).toBe('DELETE');
    });

    test('blocks DROP TABLE', () => {
      const result = checkQuery('DROP TABLE users', 'editor');
      expect(result.allowed).toBe(false);
      expect(result.blockedCommand).toBe('DROP');
    });

    test('blocks TRUNCATE TABLE', () => {
      const result = checkQuery('TRUNCATE TABLE users', 'editor');
      expect(result.allowed).toBe(false);
      expect(result.blockedCommand).toBe('TRUNCATE');
    });

    test('blocks ALTER TABLE', () => {
      const result = checkQuery('ALTER TABLE users ADD COLUMN email VARCHAR(255)', 'editor');
      expect(result.allowed).toBe(false);
      expect(result.blockedCommand).toBe('ALTER');
    });
  });

  describe('Viewer role', () => {
    test('allows SELECT queries', () => {
      const result = checkQuery('SELECT * FROM users', 'viewer');
      expect(result.allowed).toBe(true);
    });

    test('blocks INSERT queries', () => {
      const result = checkQuery('INSERT INTO users (name) VALUES ("test")', 'viewer');
      expect(result.allowed).toBe(false);
      expect(result.blockedCommand).toBe('INSERT');
    });

    test('blocks UPDATE queries', () => {
      const result = checkQuery('UPDATE users SET name = "test" WHERE id = 1', 'viewer');
      expect(result.allowed).toBe(false);
      expect(result.blockedCommand).toBe('UPDATE');
    });

    test('blocks DELETE queries', () => {
      const result = checkQuery('DELETE FROM users WHERE id = 1', 'viewer');
      expect(result.allowed).toBe(false);
      expect(result.blockedCommand).toBe('DELETE');
    });

    test('blocks DROP TABLE', () => {
      const result = checkQuery('DROP TABLE users', 'viewer');
      expect(result.allowed).toBe(false);
      expect(result.blockedCommand).toBe('DROP');
    });

    test('blocks TRUNCATE TABLE', () => {
      const result = checkQuery('TRUNCATE TABLE users', 'viewer');
      expect(result.allowed).toBe(false);
      expect(result.blockedCommand).toBe('TRUNCATE');
    });

    test('blocks ALTER TABLE', () => {
      const result = checkQuery('ALTER TABLE users ADD COLUMN email VARCHAR(255)', 'viewer');
      expect(result.allowed).toBe(false);
      expect(result.blockedCommand).toBe('ALTER');
    });
  });
});

describe('Query Guard - getBlockedCommandsForRole', () => {
  test('admin has no blocked commands', () => {
    const blocked = getBlockedCommandsForRole('admin');
    expect(blocked).toEqual([]);
  });

  test('editor is blocked from DDL and destructive commands', () => {
    const blocked = getBlockedCommandsForRole('editor');
    expect(blocked).toContain('DROP');
    expect(blocked).toContain('TRUNCATE');
    expect(blocked).toContain('ALTER');
    expect(blocked).toContain('CREATE');
    expect(blocked).toContain('DELETE');
    expect(blocked).toContain('UPDATE');
    expect(blocked).not.toContain('INSERT');
  });

  test('viewer is blocked from all write operations', () => {
    const blocked = getBlockedCommandsForRole('viewer');
    expect(blocked).toContain('DROP');
    expect(blocked).toContain('TRUNCATE');
    expect(blocked).toContain('ALTER');
    expect(blocked).toContain('CREATE');
    expect(blocked).toContain('DELETE');
    expect(blocked).toContain('UPDATE');
    expect(blocked).toContain('INSERT');
  });
});

// Test JWT token functions
import { verifyToken } from '../../services/auth-service';

describe('Auth Service - JWT Token', () => {
  test('verifyToken returns null for invalid token', () => {
    const result = verifyToken('invalid-token');
    expect(result).toBeNull();
  });

  test('verifyToken returns null for malformed token', () => {
    const result = verifyToken('abc.def');
    expect(result).toBeNull();
  });

  test('verifyToken returns null for empty token', () => {
    const result = verifyToken('');
    expect(result).toBeNull();
  });
});

// Test user model helpers
import { hasPermission, isValidRole, isValidTeam, ROLE_PERMISSIONS } from '../../models/user';

describe('User Model - Permissions', () => {
  test('admin has all permissions', () => {
    expect(hasPermission('admin', 'canExecuteSelect')).toBe(true);
    expect(hasPermission('admin', 'canExecuteInsert')).toBe(true);
    expect(hasPermission('admin', 'canExecuteUpdate')).toBe(true);
    expect(hasPermission('admin', 'canExecuteDelete')).toBe(true);
    expect(hasPermission('admin', 'canExecuteDDL')).toBe(true);
    expect(hasPermission('admin', 'canManageUsers')).toBe(true);
    expect(hasPermission('admin', 'canViewLogs')).toBe(true);
  });

  test('editor has limited permissions', () => {
    expect(hasPermission('editor', 'canExecuteSelect')).toBe(true);
    expect(hasPermission('editor', 'canExecuteInsert')).toBe(true);
    expect(hasPermission('editor', 'canExecuteUpdate')).toBe(false);
    expect(hasPermission('editor', 'canExecuteDelete')).toBe(false);
    expect(hasPermission('editor', 'canExecuteDDL')).toBe(false);
    expect(hasPermission('editor', 'canManageUsers')).toBe(false);
    expect(hasPermission('editor', 'canViewLogs')).toBe(false);
  });

  test('viewer has read-only permissions', () => {
    expect(hasPermission('viewer', 'canExecuteSelect')).toBe(true);
    expect(hasPermission('viewer', 'canExecuteInsert')).toBe(false);
    expect(hasPermission('viewer', 'canExecuteUpdate')).toBe(false);
    expect(hasPermission('viewer', 'canExecuteDelete')).toBe(false);
    expect(hasPermission('viewer', 'canExecuteDDL')).toBe(false);
    expect(hasPermission('viewer', 'canManageUsers')).toBe(false);
    expect(hasPermission('viewer', 'canViewLogs')).toBe(false);
  });
});

describe('User Model - Validation', () => {
  test('isValidRole accepts valid roles', () => {
    expect(isValidRole('admin')).toBe(true);
    expect(isValidRole('editor')).toBe(true);
    expect(isValidRole('viewer')).toBe(true);
  });

  test('isValidRole rejects invalid roles', () => {
    expect(isValidRole('superadmin')).toBe(false);
    expect(isValidRole('guest')).toBe(false);
    expect(isValidRole('')).toBe(false);
  });

  test('isValidTeam accepts valid teams', () => {
    expect(isValidTeam('data-science')).toBe(true);
    expect(isValidTeam('business-intelligence')).toBe(true);
  });

  test('isValidTeam rejects invalid teams', () => {
    expect(isValidTeam('engineering')).toBe(false);
    expect(isValidTeam('marketing')).toBe(false);
    expect(isValidTeam('')).toBe(false);
  });
});

// Test error classes
import { 
  AppError, 
  ValidationError, 
  AuthenticationError, 
  AuthorizationError, 
  NotFoundError, 
  QueryBlockedError 
} from '../../utils/errors';

describe('Error Classes', () => {
  test('ValidationError has correct status code', () => {
    const error = new ValidationError('Invalid input');
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.message).toBe('Invalid input');
  });

  test('AuthenticationError has correct status code', () => {
    const error = new AuthenticationError('Not logged in');
    expect(error.statusCode).toBe(401);
    expect(error.code).toBe('AUTHENTICATION_ERROR');
  });

  test('AuthorizationError has correct status code', () => {
    const error = new AuthorizationError('Access denied');
    expect(error.statusCode).toBe(403);
    expect(error.code).toBe('AUTHORIZATION_ERROR');
  });

  test('NotFoundError has correct status code', () => {
    const error = new NotFoundError('User');
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
    expect(error.message).toBe('User not found');
  });

  test('QueryBlockedError has correct status code and message', () => {
    const error = new QueryBlockedError('DELETE', 'viewer');
    expect(error.statusCode).toBe(403);
    expect(error.code).toBe('QUERY_BLOCKED');
    expect(error.message).toContain('DELETE');
    expect(error.message).toContain('viewer');
  });
});

console.log('\\n====================================');
console.log('E2E Auth Tests Completed');
console.log('====================================\\n');
