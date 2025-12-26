/**
 * Authentication Service
 * Handles user authentication, JWT tokens, and password management
 * 
 * Supports two modes:
 * 1. Database mode: Uses SQL Server for user storage (production)
 * 2. In-memory mode: Uses hardcoded users (development/when DB unavailable)
 */

import { getPool } from './database/sqlserver';
import { 
  User, 
  UserPublic, 
  UserRole, 
  Team,
  CreateUserInput, 
  UpdateUserInput, 
  AuthToken, 
  AuthTokenPayload,
  toPublicUser,
  isValidRole,
  isValidTeam,
} from '../models/user';
import { 
  AuthenticationError, 
  ValidationError, 
  NotFoundError, 
  ConflictError 
} from '../utils/errors';
import { logger } from '../utils/logger';

// Use in-memory storage when database is unavailable
const USE_IN_MEMORY = process.env.AUTH_MODE === 'memory' || process.env.NODE_ENV === 'development';

// JWT secret from environment
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-change-in-production';
const TOKEN_EXPIRY_DAYS = 365; // 1 year

/**
 * Hash password using bcrypt-compatible implementation
 * Using Bun's built-in password hashing
 */
async function hashPassword(password: string): Promise<string> {
  return await Bun.password.hash(password, {
    algorithm: 'bcrypt',
    cost: 10,
  });
}

/**
 * Verify password against hash
 */
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await Bun.password.verify(password, hash);
  } catch {
    return false;
  }
}

/**
 * Generate JWT token
 */
function generateToken(payload: AuthTokenPayload): { token: string; expiresAt: Date } {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + TOKEN_EXPIRY_DAYS);

  // Create JWT manually (Bun doesn't have built-in JWT, using simple implementation)
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({
    ...payload,
    exp: Math.floor(expiresAt.getTime() / 1000),
    iat: Math.floor(Date.now() / 1000),
  })).toString('base64url');

  const signature = createHmacSignature(`${header}.${body}`, JWT_SECRET);
  const token = `${header}.${body}.${signature}`;

  return { token, expiresAt };
}

/**
 * Verify JWT token and return payload
 */
export function verifyToken(token: string): AuthTokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, body, signature] = parts;

    // Verify signature
    const expectedSignature = createHmacSignature(`${header}.${body}`, JWT_SECRET);
    if (signature !== expectedSignature) return null;

    // Parse payload
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());

    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return {
      userId: payload.userId,
      username: payload.username,
      role: payload.role,
      team: payload.team,
    };
  } catch {
    return null;
  }
}

/**
 * Create HMAC signature for JWT
 */
function createHmacSignature(data: string, secret: string): string {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const msgData = encoder.encode(data);

  // Use Bun's crypto for HMAC
  const hmac = new Bun.CryptoHasher('sha256', keyData);
  hmac.update(msgData);
  return hmac.digest('base64url');
}

/**
 * In-memory user storage for development/testing
 */
interface InMemoryUser extends User {
  password_hash: string;
}

// Pre-hashed passwords for default users (bcrypt hash of 'admin123')
// These are generated once and stored to avoid async init issues
const DEFAULT_PASSWORD_HASH = '$argon2id$v=19$m=65536,t=2,p=1$placeholder'; // Will be replaced on first use

class InMemoryUserStore {
  private users: Map<number, InMemoryUser> = new Map();
  private nextId = 1;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const defaultUsers: Array<{ username: string; password: string; role: UserRole; team: Team; display_name: string }> = [
      { username: 'hasif', password: 'admin123', role: 'admin', team: 'data-science', display_name: 'Hasif' },
      { username: 'nazierul', password: 'admin123', role: 'admin', team: 'data-science', display_name: 'Nazierul' },
      { username: 'izhar', password: 'admin123', role: 'editor', team: 'data-science', display_name: 'Izhar' },
      { username: 'asyraff', password: 'admin123', role: 'editor', team: 'data-science', display_name: 'Asyraff' },
      { username: 'bob', password: 'admin123', role: 'editor', team: 'business-intelligence', display_name: 'Bob' },
      { username: 'yee-ming', password: 'admin123', role: 'editor', team: 'business-intelligence', display_name: 'Yee Ming' },
      { username: 'ernie', password: 'admin123', role: 'viewer', team: 'business-intelligence', display_name: 'Ernie' },
    ];

    for (const user of defaultUsers) {
      const passwordHash = await hashPassword(user.password);
      const id = this.nextId++;
      this.users.set(id, {
        id,
        username: user.username.toLowerCase(),
        password_hash: passwordHash,
        role: user.role,
        team: user.team,
        display_name: user.display_name,
        created_at: new Date(),
        updated_at: new Date(),
        last_login: null,
        is_active: true,
      });
    }

    this.initialized = true;
    console.log('📦 In-memory user store initialized with', this.users.size, 'users');
  }

  async findByUsername(username: string): Promise<InMemoryUser | null> {
    await this.initialize();
    for (const user of this.users.values()) {
      if (user.username === username.toLowerCase()) {
        return user;
      }
    }
    return null;
  }

  async findById(id: number): Promise<InMemoryUser | null> {
    await this.initialize();
    return this.users.get(id) || null;
  }

  async list(filters?: { role?: UserRole; team?: Team; isActive?: boolean }): Promise<InMemoryUser[]> {
    await this.initialize();
    let result = Array.from(this.users.values());
    
    if (filters?.role) {
      result = result.filter(u => u.role === filters.role);
    }
    if (filters?.team) {
      result = result.filter(u => u.team === filters.team);
    }
    if (filters?.isActive !== undefined) {
      result = result.filter(u => u.is_active === filters.isActive);
    }
    
    return result.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
  }

  async create(input: CreateUserInput): Promise<InMemoryUser> {
    await this.initialize();
    
    const existing = await this.findByUsername(input.username);
    if (existing) {
      throw new ConflictError('Username already exists');
    }

    const passwordHash = await hashPassword(input.password);
    const id = this.nextId++;
    const user: InMemoryUser = {
      id,
      username: input.username.toLowerCase(),
      password_hash: passwordHash,
      role: input.role,
      team: input.team || null,
      display_name: input.display_name || input.username,
      created_at: new Date(),
      updated_at: new Date(),
      last_login: null,
      is_active: true,
    };
    
    this.users.set(id, user);
    return user;
  }

  async update(id: number, input: UpdateUserInput): Promise<InMemoryUser | null> {
    await this.initialize();
    
    const user = this.users.get(id);
    if (!user) return null;

    if (input.role !== undefined) user.role = input.role;
    if (input.team !== undefined) user.team = input.team;
    if (input.display_name !== undefined) user.display_name = input.display_name;
    if (input.is_active !== undefined) user.is_active = input.is_active;
    user.updated_at = new Date();

    return user;
  }

  async delete(id: number): Promise<boolean> {
    await this.initialize();
    return this.users.delete(id);
  }

  async updateLastLogin(id: number): Promise<void> {
    await this.initialize();
    const user = this.users.get(id);
    if (user) {
      user.last_login = new Date();
    }
  }

  async updatePassword(id: number, newPasswordHash: string): Promise<void> {
    await this.initialize();
    const user = this.users.get(id);
    if (user) {
      user.password_hash = newPasswordHash;
      user.updated_at = new Date();
    }
  }
}

const inMemoryStore = new InMemoryUserStore();

/**
 * Auth Service
 */
class AuthService {
  /**
   * Login user and return token
   */
  async login(username: string, password: string): Promise<AuthToken> {
    let user: (User & { password_hash: string }) | null = null;

    if (USE_IN_MEMORY) {
      // In-memory mode
      user = await inMemoryStore.findByUsername(username);
    } else {
      // Database mode
      try {
        const pool = await getPool();
        const result = await pool.request()
          .input('username', username.toLowerCase())
          .query(`
            SELECT id, username, password_hash, role, team, display_name, 
                   created_at, last_login, is_active
            FROM users 
            WHERE username = @username
          `);
        user = result.recordset[0] as (User & { password_hash: string }) | undefined || null;
      } catch (error) {
        // Fall back to in-memory if database fails
        logger.warn('Database unavailable, falling back to in-memory auth', { 
          metadata: { error: (error as Error).message } 
        });
        user = await inMemoryStore.findByUsername(username);
      }
    }

    if (!user) {
      logger.auth('login_failed', username, { metadata: { reason: 'user_not_found' } });
      throw new AuthenticationError('Invalid username or password');
    }

    if (!user.is_active) {
      logger.auth('login_failed', username, { metadata: { reason: 'account_disabled' } });
      throw new AuthenticationError('Account is disabled');
    }

    // Verify password
    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      logger.auth('login_failed', username, { metadata: { reason: 'invalid_password' } });
      throw new AuthenticationError('Invalid username or password');
    }

    // Update last login
    if (USE_IN_MEMORY) {
      await inMemoryStore.updateLastLogin(user.id);
    } else {
      try {
        const pool = await getPool();
        await pool.request()
          .input('id', user.id)
          .query(`UPDATE users SET last_login = GETDATE() WHERE id = @id`);
      } catch {
        // Ignore update failure
      }
    }

    // Generate token
    const tokenPayload: AuthTokenPayload = {
      userId: user.id,
      username: user.username,
      role: user.role as UserRole,
      team: user.team as Team | null,
    };

    const { token, expiresAt } = generateToken(tokenPayload);

    logger.auth('login', username, { userId: user.id });

    return {
      token,
      expiresAt,
      user: toPublicUser({ ...user, updated_at: new Date() }),
    };
  }

  /**
   * Get user by ID
   */
  async getUserById(id: number): Promise<UserPublic | null> {
    if (USE_IN_MEMORY) {
      const user = await inMemoryStore.findById(id);
      return user ? toPublicUser(user) : null;
    }

    try {
      const pool = await getPool();
      const result = await pool.request()
        .input('id', id)
        .query(`
          SELECT id, username, role, team, display_name, 
                 created_at, last_login, is_active
          FROM users 
          WHERE id = @id
        `);
      const user = result.recordset[0];
      return user || null;
    } catch {
      // Fall back to in-memory
      const user = await inMemoryStore.findById(id);
      return user ? toPublicUser(user) : null;
    }
  }

  /**
   * Get user by username
   */
  async getUserByUsername(username: string): Promise<User | null> {
    if (USE_IN_MEMORY) {
      return await inMemoryStore.findByUsername(username);
    }

    try {
      const pool = await getPool();
      const result = await pool.request()
        .input('username', username.toLowerCase())
        .query(`SELECT * FROM users WHERE username = @username`);
      return result.recordset[0] || null;
    } catch {
      // Fall back to in-memory
      return await inMemoryStore.findByUsername(username);
    }
  }

  /**
   * List all users
   */
  async listUsers(filters?: { role?: UserRole; team?: Team; isActive?: boolean }): Promise<UserPublic[]> {
    if (USE_IN_MEMORY) {
      const users = await inMemoryStore.list(filters);
      return users.map(u => toPublicUser(u));
    }

    try {
      const pool = await getPool();

      let query = `
        SELECT id, username, role, team, display_name, 
               created_at, last_login, is_active
        FROM users
        WHERE 1=1
      `;

      const request = pool.request();

      if (filters?.role) {
        query += ` AND role = @role`;
        request.input('role', filters.role);
      }

      if (filters?.team) {
        query += ` AND team = @team`;
        request.input('team', filters.team);
      }

      if (filters?.isActive !== undefined) {
        query += ` AND is_active = @isActive`;
        request.input('isActive', filters.isActive);
      }

      query += ` ORDER BY created_at DESC`;

      const result = await request.query(query);
      return result.recordset;
    } catch {
      // Fall back to in-memory
      const users = await inMemoryStore.list(filters);
      return users.map(u => toPublicUser(u));
    }
  }

  /**
   * Create new user
   */
  async createUser(input: CreateUserInput): Promise<UserPublic> {
    // Validate input
    if (!input.username || input.username.length < 3) {
      throw new ValidationError('Username must be at least 3 characters');
    }

    if (!input.password || input.password.length < 1) {
      throw new ValidationError('Password is required');
    }

    if (!isValidRole(input.role)) {
      throw new ValidationError('Invalid role');
    }

    if (input.team && !isValidTeam(input.team)) {
      throw new ValidationError('Invalid team');
    }

    if (USE_IN_MEMORY) {
      const user = await inMemoryStore.create(input);
      logger.info('User created (in-memory)', { metadata: { username: input.username, role: input.role } });
      return toPublicUser(user);
    }

    try {
      const pool = await getPool();

      // Check if username exists
      const existing = await this.getUserByUsername(input.username);
      if (existing) {
        throw new ConflictError('Username already exists');
      }

      // Hash password
      const passwordHash = await hashPassword(input.password);

      // Insert user
      const result = await pool.request()
        .input('username', input.username.toLowerCase())
        .input('password_hash', passwordHash)
        .input('role', input.role)
        .input('team', input.team || null)
        .input('display_name', input.display_name || input.username)
        .query(`
          INSERT INTO users (username, password_hash, role, team, display_name, is_active)
          OUTPUT INSERTED.id, INSERTED.username, INSERTED.role, INSERTED.team, 
                 INSERTED.display_name, INSERTED.created_at, INSERTED.last_login, INSERTED.is_active
          VALUES (@username, @password_hash, @role, @team, @display_name, 1)
        `);

      logger.info('User created', { metadata: { username: input.username, role: input.role } });

      return result.recordset[0];
    } catch (error) {
      if (error instanceof ConflictError) throw error;
      // Fall back to in-memory
      const user = await inMemoryStore.create(input);
      logger.info('User created (in-memory fallback)', { metadata: { username: input.username, role: input.role } });
      return toPublicUser(user);
    }
  }

  /**
   * Update user
   */
  async updateUser(id: number, input: UpdateUserInput): Promise<UserPublic> {
    // Check user exists
    const existing = await this.getUserById(id);
    if (!existing) {
      throw new NotFoundError('User');
    }

    // Validate input
    if (input.role && !isValidRole(input.role)) {
      throw new ValidationError('Invalid role');
    }

    if (input.team && !isValidTeam(input.team)) {
      throw new ValidationError('Invalid team');
    }

    if (USE_IN_MEMORY) {
      const user = await inMemoryStore.update(id, input);
      if (!user) throw new NotFoundError('User');
      logger.info('User updated (in-memory)', { userId: id, metadata: input });
      return toPublicUser(user);
    }

    try {
      const pool = await getPool();

      // Build update query
      const updates: string[] = ['updated_at = GETDATE()'];
      const request = pool.request().input('id', id);

      if (input.role !== undefined) {
        updates.push('role = @role');
        request.input('role', input.role);
      }

      if (input.team !== undefined) {
        updates.push('team = @team');
        request.input('team', input.team);
      }

      if (input.display_name !== undefined) {
        updates.push('display_name = @display_name');
        request.input('display_name', input.display_name);
      }

      if (input.is_active !== undefined) {
        updates.push('is_active = @is_active');
        request.input('is_active', input.is_active);
      }

      const result = await request.query(`
        UPDATE users SET ${updates.join(', ')}
        OUTPUT INSERTED.id, INSERTED.username, INSERTED.role, INSERTED.team,
               INSERTED.display_name, INSERTED.created_at, INSERTED.last_login, INSERTED.is_active
        WHERE id = @id
      `);

      logger.info('User updated', { userId: id, metadata: input });

      return result.recordset[0];
    } catch {
      // Fall back to in-memory
      const user = await inMemoryStore.update(id, input);
      if (!user) throw new NotFoundError('User');
      logger.info('User updated (in-memory fallback)', { userId: id, metadata: input });
      return toPublicUser(user);
    }
  }

  /**
   * Delete user
   */
  async deleteUser(id: number): Promise<void> {
    if (USE_IN_MEMORY) {
      const deleted = await inMemoryStore.delete(id);
      if (!deleted) throw new NotFoundError('User');
      logger.info('User deleted (in-memory)', { userId: id });
      return;
    }

    try {
      const pool = await getPool();

      const result = await pool.request()
        .input('id', id)
        .query(`DELETE FROM users WHERE id = @id`);

      if (result.rowsAffected[0] === 0) {
        throw new NotFoundError('User');
      }

      logger.info('User deleted', { userId: id });
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      // Fall back to in-memory
      const deleted = await inMemoryStore.delete(id);
      if (!deleted) throw new NotFoundError('User');
      logger.info('User deleted (in-memory fallback)', { userId: id });
    }
  }

  /**
   * Change password
   */
  async changePassword(userId: number, oldPassword: string, newPassword: string): Promise<void> {
    if (USE_IN_MEMORY) {
      const user = await inMemoryStore.findById(userId);
      if (!user) throw new NotFoundError('User');

      const isValid = await verifyPassword(oldPassword, user.password_hash);
      if (!isValid) throw new AuthenticationError('Current password is incorrect');

      const newHash = await hashPassword(newPassword);
      await inMemoryStore.updatePassword(userId, newHash);
      logger.info('Password changed (in-memory)', { userId });
      return;
    }

    try {
      const pool = await getPool();

      // Get user with password hash
      const result = await pool.request()
        .input('id', userId)
        .query(`SELECT password_hash FROM users WHERE id = @id`);

      const user = result.recordset[0];
      if (!user) {
        throw new NotFoundError('User');
      }

      // Verify old password
      const isValid = await verifyPassword(oldPassword, user.password_hash);
      if (!isValid) {
        throw new AuthenticationError('Current password is incorrect');
      }

      // Hash new password
      const newHash = await hashPassword(newPassword);

      // Update password
      await pool.request()
        .input('id', userId)
        .input('password_hash', newHash)
        .query(`UPDATE users SET password_hash = @password_hash, updated_at = GETDATE() WHERE id = @id`);

      logger.info('Password changed', { userId });
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof AuthenticationError) throw error;
      // Fall back to in-memory
      const user = await inMemoryStore.findById(userId);
      if (!user) throw new NotFoundError('User');

      const isValid = await verifyPassword(oldPassword, user.password_hash);
      if (!isValid) throw new AuthenticationError('Current password is incorrect');

      const newHash = await hashPassword(newPassword);
      await inMemoryStore.updatePassword(userId, newHash);
      logger.info('Password changed (in-memory fallback)', { userId });
    }
  }

  /**
   * Reset password (admin only)
   */
  async resetPassword(userId: number, newPassword: string): Promise<void> {
    // Check user exists
    const existing = await this.getUserById(userId);
    if (!existing) {
      throw new NotFoundError('User');
    }

    // Hash new password
    const newHash = await hashPassword(newPassword);

    if (USE_IN_MEMORY) {
      await inMemoryStore.updatePassword(userId, newHash);
      logger.info('Password reset by admin (in-memory)', { userId });
      return;
    }

    try {
      const pool = await getPool();

      // Update password
      await pool.request()
        .input('id', userId)
        .input('password_hash', newHash)
        .query(`UPDATE users SET password_hash = @password_hash, updated_at = GETDATE() WHERE id = @id`);

      logger.info('Password reset by admin', { userId });
    } catch {
      // Fall back to in-memory
      await inMemoryStore.updatePassword(userId, newHash);
      logger.info('Password reset by admin (in-memory fallback)', { userId });
    }
  }

  /**
   * Initialize default users (run on startup)
   */
  async initializeDefaultUsers(): Promise<void> {
    const defaultUsers: CreateUserInput[] = [
      { username: 'hasif', password: 'admin123', role: 'admin', team: 'data-science', display_name: 'Hasif' },
      { username: 'nazierul', password: 'admin123', role: 'admin', team: 'data-science', display_name: 'Nazierul' },
      { username: 'izhar', password: 'admin123', role: 'editor', team: 'data-science', display_name: 'Izhar' },
      { username: 'asyraff', password: 'admin123', role: 'editor', team: 'data-science', display_name: 'Asyraff' },
      { username: 'bob', password: 'admin123', role: 'editor', team: 'business-intelligence', display_name: 'Bob' },
      { username: 'yee-ming', password: 'admin123', role: 'editor', team: 'business-intelligence', display_name: 'Yee Ming' },
      { username: 'ernie', password: 'admin123', role: 'viewer', team: 'business-intelligence', display_name: 'Ernie' },
    ];

    for (const user of defaultUsers) {
      try {
        const existing = await this.getUserByUsername(user.username);
        if (!existing) {
          await this.createUser(user);
          console.log(`✅ Created default user: ${user.username}`);
        }
      } catch (error) {
        console.warn(`⚠️ Failed to create user ${user.username}:`, (error as Error).message);
      }
    }
  }
}

export const authService = new AuthService();
