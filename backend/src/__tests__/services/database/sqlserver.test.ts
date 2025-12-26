import { describe, expect, test, mock, beforeEach, afterEach } from 'bun:test';

// Mock mssql module - create fresh mock request per call
const createMockRequest = () => ({
  query: mock(() =>
    Promise.resolve({
      recordset: [],
      columns: {},
      rowsAffected: [0],
    })
  ),
});

let mockRequest = createMockRequest();

const mockPool = {
  connected: true,
  request: () => mockRequest,
  close: mock(() => Promise.resolve()),
  pool: {
    size: 10,
    available: 8,
    pending: 0,
  },
};

const mockConnect = mock(() => Promise.resolve(mockPool));

mock.module('mssql', () => ({
  default: {
    connect: mockConnect,
  },
}));

describe('SQL Server Service', () => {
  let sqlserver: any;

  beforeEach(async () => {
    // Create fresh mock request for each test
    mockRequest = createMockRequest();
    mockConnect.mockClear();
    mockPool.close.mockClear();
    mockPool.connected = true;

    // Reset module to get fresh instance
    const module = await import('../../../services/database/sqlserver');
    sqlserver = module;

    // Make sure pool is closed before each test
    try {
      await sqlserver.closeSqlServer();
    } catch {}
  });

  afterEach(async () => {
    // Clean up after each test
    try {
      await sqlserver.closeSqlServer();
    } catch {}
  });

  describe('initSqlServer', () => {
    test('should initialize SQL Server connection', async () => {
      mockConnect.mockResolvedValueOnce(mockPool);

      await sqlserver.initSqlServer();

      expect(mockConnect).toHaveBeenCalled();
    });

    test('should throw error on connection failure', async () => {
      mockConnect.mockRejectedValueOnce(new Error('Connection refused'));

      await expect(sqlserver.initSqlServer()).rejects.toThrow('Connection refused');
    });
  });

  describe('closeSqlServer', () => {
    test('should close SQL Server connection', async () => {
      mockConnect.mockResolvedValueOnce(mockPool);
      await sqlserver.initSqlServer();

      await sqlserver.closeSqlServer();

      expect(mockPool.close).toHaveBeenCalled();
    });

    test('should handle closing when no connection exists', async () => {
      // Should not throw when there's no connection
      await sqlserver.closeSqlServer();
      // Test passes if no error is thrown
      expect(true).toBe(true);
    });
  });

  describe('getPool', () => {
    test('should return existing pool when connected', async () => {
      mockConnect.mockResolvedValueOnce(mockPool);
      await sqlserver.initSqlServer();

      const pool = await sqlserver.getPool();

      expect(pool).toBeDefined();
      expect(pool.connected).toBe(true);
    });

    test('should reconnect when pool is not connected', async () => {
      mockConnect.mockResolvedValueOnce(mockPool);
      await sqlserver.initSqlServer();

      // Simulate disconnected state
      mockPool.connected = false;
      mockConnect.mockResolvedValueOnce({ ...mockPool, connected: true });

      const pool = await sqlserver.getPool();

      // Pool reconnects
      expect(mockConnect).toHaveBeenCalledTimes(2);
    });
  });

  describe('executeQuery', () => {
    test('should execute query and return results', async () => {
      const mockResult = {
        recordset: [
          { id: 1, name: 'Test 1' },
          { id: 2, name: 'Test 2' },
        ],
        columns: {
          id: { type: 'int' },
          name: { type: 'varchar' },
        },
        rowsAffected: [2],
      };

      mockConnect.mockResolvedValueOnce(mockPool);
      mockRequest.query.mockResolvedValueOnce(mockResult);

      await sqlserver.initSqlServer();
      const result = await sqlserver.executeQuery('SELECT * FROM users');

      expect(result.columns).toEqual(['id', 'name']);
      expect(result.rows).toHaveLength(2);
      expect(result.rowCount).toBe(2);
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });

    test('should return column names from first row when columns metadata is missing', async () => {
      const mockResult = {
        recordset: [{ id: 1, name: 'Test', email: 'test@example.com' }],
        rowsAffected: [1],
      };

      mockConnect.mockResolvedValueOnce(mockPool);
      mockRequest.query.mockResolvedValueOnce(mockResult);

      await sqlserver.initSqlServer();
      const result = await sqlserver.executeQuery('SELECT id, name, email FROM users');

      expect(result.columns).toEqual(['id', 'name', 'email']);
    });

    test('should return empty columns for empty result set', async () => {
      const mockResult = {
        recordset: [],
        rowsAffected: [0],
      };

      mockConnect.mockResolvedValueOnce(mockPool);
      mockRequest.query.mockResolvedValueOnce(mockResult);

      await sqlserver.initSqlServer();
      const result = await sqlserver.executeQuery('SELECT * FROM empty_table');

      expect(result.columns).toEqual([]);
      expect(result.rows).toEqual([]);
      expect(result.rowCount).toBe(0);
    });

    test('should throw error on query failure', async () => {
      mockConnect.mockResolvedValueOnce(mockPool);
      mockRequest.query.mockRejectedValueOnce(new Error('Syntax error'));

      await sqlserver.initSqlServer();

      await expect(
        sqlserver.executeQuery('INVALID SQL')
      ).rejects.toThrow('SQL Server query error');
    });

    test('should handle INSERT/UPDATE returning rowsAffected', async () => {
      const mockResult = {
        recordset: undefined,
        rowsAffected: [5],
      };

      mockConnect.mockResolvedValueOnce(mockPool);
      mockRequest.query.mockResolvedValueOnce(mockResult);

      await sqlserver.initSqlServer();
      const result = await sqlserver.executeQuery('UPDATE users SET active = 1');

      expect(result.rowCount).toBe(5);
    });
  });

  describe('getSchema', () => {
    test('should return schema grouped by schema and table', async () => {
      const mockSchemaResult = {
        recordset: [
          {
            schema_name: 'dbo',
            table_name: 'users',
            column_name: 'id',
            data_type: 'int',
            max_length: 4,
            is_nullable: false,
            is_identity: true,
            is_primary_key: true,
          },
          {
            schema_name: 'dbo',
            table_name: 'users',
            column_name: 'name',
            data_type: 'varchar',
            max_length: 255,
            is_nullable: true,
            is_identity: false,
            is_primary_key: false,
          },
          {
            schema_name: 'dbo',
            table_name: 'orders',
            column_name: 'id',
            data_type: 'int',
            max_length: 4,
            is_nullable: false,
            is_identity: true,
            is_primary_key: true,
          },
        ],
        columns: {},
        rowsAffected: [3],
      };

      mockConnect.mockResolvedValueOnce(mockPool);
      mockRequest.query.mockResolvedValueOnce(mockSchemaResult);

      await sqlserver.initSqlServer();
      const schema = await sqlserver.getSchema();

      expect(schema.dbo).toBeDefined();
      expect(schema.dbo.users).toHaveLength(2);
      expect(schema.dbo.orders).toHaveLength(1);
      expect(schema.dbo.users[0].column_name).toBe('id');
    });

    test('should handle multiple schemas', async () => {
      const mockSchemaResult = {
        recordset: [
          {
            schema_name: 'dbo',
            table_name: 'users',
            column_name: 'id',
            data_type: 'int',
            max_length: 4,
            is_nullable: false,
            is_identity: true,
            is_primary_key: true,
          },
          {
            schema_name: 'staging',
            table_name: 'temp_data',
            column_name: 'value',
            data_type: 'varchar',
            max_length: 100,
            is_nullable: true,
            is_identity: false,
            is_primary_key: false,
          },
        ],
        columns: {},
        rowsAffected: [2],
      };

      mockConnect.mockResolvedValueOnce(mockPool);
      mockRequest.query.mockResolvedValueOnce(mockSchemaResult);

      await sqlserver.initSqlServer();
      const schema = await sqlserver.getSchema();

      expect(schema.dbo).toBeDefined();
      expect(schema.staging).toBeDefined();
      expect(schema.dbo.users).toHaveLength(1);
      expect(schema.staging.temp_data).toHaveLength(1);
    });
  });

  describe('getHealthStatus', () => {
    test('should return healthy status with pool info', async () => {
      mockConnect.mockResolvedValueOnce(mockPool);
      mockRequest.query.mockResolvedValueOnce({
        recordset: [{ healthy: 1 }],
      });

      await sqlserver.initSqlServer();
      const status = await sqlserver.getHealthStatus();

      expect(status.status).toBe('healthy');
      expect(status.connected).toBe(true);
      expect(status.pool).toBeDefined();
      expect(status.pool.size).toBe(10);
      expect(status.pool.available).toBe(8);
    });

    test('should return unhealthy status on query failure', async () => {
      mockConnect.mockResolvedValueOnce(mockPool);
      mockRequest.query.mockRejectedValueOnce(new Error('Connection lost'));

      await sqlserver.initSqlServer();
      const status = await sqlserver.getHealthStatus();

      expect(status.status).toBe('unhealthy');
      expect(status.connected).toBe(false);
      expect(status.error).toBe('Connection lost');
    });
  });
});
