import { describe, expect, test, mock, beforeEach } from 'bun:test';
import { Hono } from 'hono';

// Mock database modules
const mockSqlServer = {
  executeQuery: mock(() =>
    Promise.resolve({
      columns: ['id', 'name'],
      rows: [{ id: 1, name: 'Test' }],
      rowCount: 1,
      executionTime: 100,
    })
  ),
  getSchema: mock(() =>
    Promise.resolve({
      dbo: {
        users: [
          { column_name: 'id', data_type: 'int' },
          { column_name: 'name', data_type: 'varchar' },
        ],
      },
    })
  ),
  getHealthStatus: mock(() =>
    Promise.resolve({
      status: 'healthy',
      connected: true,
      pool: { size: 10, available: 8, pending: 0 },
    })
  ),
};

const mockRedshift = {
  executeQuery: mock(() =>
    Promise.resolve({
      columns: [],
      rows: [],
      rowCount: 0,
      executionTime: 50,
    })
  ),
  getSchema: mock(() => Promise.resolve({})),
  getHealthStatus: mock(() =>
    Promise.resolve({
      status: 'healthy',
      connected: true,
    })
  ),
};

mock.module('../../services/database/sqlserver', () => mockSqlServer);
mock.module('../../services/database/redshift', () => mockRedshift);

// Import routes after mocking
import { sqlRoutes } from '../../routes/sql';

describe('SQL Routes', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.route('/sqlserver', sqlRoutes);
    app.route('/redshift', sqlRoutes);

    // Clear all mocks
    Object.values(mockSqlServer).forEach((m) => m.mockClear());
    Object.values(mockRedshift).forEach((m) => m.mockClear());
  });

  describe('POST /sqlserver/execute', () => {
    test('should execute SQL query and return results', async () => {
      mockSqlServer.executeQuery.mockResolvedValueOnce({
        columns: ['id', 'name', 'email'],
        rows: [
          { id: 1, name: 'John', email: 'john@example.com' },
          { id: 2, name: 'Jane', email: 'jane@example.com' },
        ],
        rowCount: 2,
        executionTime: 150,
      });

      const res = await app.request('/sqlserver/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'SELECT * FROM users' }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.columns).toEqual(['id', 'name', 'email']);
      expect(json.data.rows).toHaveLength(2);
      expect(json.data.row_count).toBe(2);
      expect(json.data.execution_time_ms).toBe(150);
    });

    test('should validate query is not empty', async () => {
      const res = await app.request('/sqlserver/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: '' }),
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
    });

    test('should handle query errors', async () => {
      mockSqlServer.executeQuery.mockRejectedValueOnce(
        new Error('Syntax error in SQL statement')
      );

      const res = await app.request('/sqlserver/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'INVALID SQL' }),
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error).toContain('Syntax error');
    });

    test('should accept optional params', async () => {
      mockSqlServer.executeQuery.mockResolvedValueOnce({
        columns: ['id'],
        rows: [{ id: 1 }],
        rowCount: 1,
        executionTime: 50,
      });

      const res = await app.request('/sqlserver/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'SELECT * FROM users WHERE id = @id',
          params: { id: 1 },
        }),
      });

      expect(res.status).toBe(200);
    });
  });

  describe('POST /redshift/execute', () => {
    test('should use Redshift database', async () => {
      mockRedshift.executeQuery.mockResolvedValueOnce({
        columns: ['count'],
        rows: [{ count: 1000 }],
        rowCount: 1,
        executionTime: 200,
      });

      const res = await app.request('/redshift/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'SELECT COUNT(*) FROM events' }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(mockRedshift.executeQuery).toHaveBeenCalled();
      expect(mockSqlServer.executeQuery).not.toHaveBeenCalled();
    });
  });

  describe('GET /sqlserver/schema', () => {
    test('should return database schema', async () => {
      mockSqlServer.getSchema.mockResolvedValueOnce({
        dbo: {
          users: [
            { column_name: 'id', data_type: 'int', is_nullable: false },
            { column_name: 'name', data_type: 'varchar', is_nullable: true },
          ],
          orders: [
            { column_name: 'id', data_type: 'int', is_nullable: false },
            { column_name: 'user_id', data_type: 'int', is_nullable: false },
          ],
        },
      });

      const res = await app.request('/sqlserver/schema');
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.dbo).toBeDefined();
      expect(json.data.dbo.users).toHaveLength(2);
    });

    test('should handle schema fetch errors', async () => {
      mockSqlServer.getSchema.mockRejectedValueOnce(new Error('Permission denied'));

      const res = await app.request('/sqlserver/schema');
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.success).toBe(false);
    });
  });

  describe('GET /redshift/schema', () => {
    test('should return Redshift schema', async () => {
      mockRedshift.getSchema.mockResolvedValueOnce({
        public: {
          events: [{ column_name: 'event_id', data_type: 'integer' }],
        },
      });

      const res = await app.request('/redshift/schema');
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(mockRedshift.getSchema).toHaveBeenCalled();
    });
  });

  describe('GET /sqlserver/health', () => {
    test('should return healthy status', async () => {
      mockSqlServer.getHealthStatus.mockResolvedValueOnce({
        status: 'healthy',
        connected: true,
        pool: { size: 10, available: 8, pending: 0 },
      });

      const res = await app.request('/sqlserver/health');
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.status).toBe('healthy');
      expect(json.data.connected).toBe(true);
    });

    test('should return unhealthy status on error', async () => {
      mockSqlServer.getHealthStatus.mockRejectedValueOnce(new Error('Connection lost'));

      const res = await app.request('/sqlserver/health');
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.success).toBe(false);
    });
  });

  describe('GET /sqlserver/tables', () => {
    test('should return list of tables', async () => {
      mockSqlServer.executeQuery.mockResolvedValueOnce({
        columns: ['schema_name', 'table_name', 'row_count'],
        rows: [
          { schema_name: 'dbo', table_name: 'users', row_count: 100 },
          { schema_name: 'dbo', table_name: 'orders', row_count: 500 },
        ],
        rowCount: 2,
        executionTime: 50,
      });

      const res = await app.request('/sqlserver/tables');
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(2);
    });

    test('should handle table listing errors', async () => {
      mockSqlServer.executeQuery.mockRejectedValueOnce(new Error('Access denied'));

      const res = await app.request('/sqlserver/tables');
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.success).toBe(false);
    });
  });

  describe('GET /redshift/tables', () => {
    test('should return empty list for Redshift (placeholder)', async () => {
      const res = await app.request('/redshift/tables');
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data).toEqual([]);
    });
  });
});
