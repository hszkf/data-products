import { Hono } from 'hono';
import { z } from 'zod';
import * as sqlserver from '../services/database/sqlserver';
import * as redshift from '../services/database/redshift';

export const sqlRoutes = new Hono();

// Execute query schema - accept both 'query' and 'sql' for frontend compatibility
const ExecuteQuerySchema = z.object({
  query: z.string().min(1).optional(),
  sql: z.string().min(1).optional(),
  params: z.record(z.string(), z.unknown()).optional(),
  parameters: z.array(z.unknown()).optional(),
}).refine(data => data.query || data.sql, {
  message: "Either 'query' or 'sql' must be provided",
});

// Determine which database to use based on path
function getDatabase(path: string) {
  if (path.includes('/redshift')) {
    return redshift;
  }
  return sqlserver;
}

// Execute SQL query
sqlRoutes.post('/execute', async (c) => {
  try {
    const body = await c.req.json();
    const validated = ExecuteQuerySchema.parse(body);

    // Support both 'query' and 'sql' field names
    const query = validated.query || validated.sql!;

    const db = getDatabase(c.req.path);
    const result = await db.executeQuery(query);

    // Return flat structure expected by frontend
    return c.json({
      status: 'success',
      columns: result.columns,
      rows: result.rows,
      row_count: result.rowCount,
      execution_time: result.executionTime,
      message: `Query executed successfully (${result.rowCount} rows)`,
    });
  } catch (error: any) {
    console.error('Query execution error:', error);
    return c.json(
      {
        status: 'error',
        columns: [],
        rows: [],
        row_count: 0,
        execution_time: 0,
        error: error.message || 'Query execution failed',
      },
      400
    );
  }
});

// Get database schema
sqlRoutes.get('/schema', async (c) => {
  try {
    const db = getDatabase(c.req.path);
    const schema = await db.getSchema();

    return c.json({
      success: true,
      data: schema,
    });
  } catch (error: any) {
    console.error('Schema fetch error:', error);
    return c.json(
      {
        success: false,
        error: error.message || 'Failed to fetch schema',
      },
      500
    );
  }
});

// Health check
sqlRoutes.get('/health', async (c) => {
  try {
    const db = getDatabase(c.req.path);
    const healthStatus = await db.getHealthStatus();

    // Return format expected by frontend: { status: 'connected' | 'disconnected', ... }
    // Spread healthStatus first, then override status with frontend-expected value
    return c.json({
      ...healthStatus,
      status: healthStatus.connected ? 'connected' : 'disconnected',
      database: c.req.path.includes('/redshift') ? 'redshift' : 'sqlserver',
    });
  } catch (error: any) {
    return c.json({
      status: 'disconnected',
      database: c.req.path.includes('/redshift') ? 'redshift' : 'sqlserver',
      error: error.message,
    });
  }
});

// Get tables list (simplified)
sqlRoutes.get('/tables', async (c) => {
  try {
    const db = getDatabase(c.req.path);

    if (db === sqlserver) {
      const result = await sqlserver.executeQuery(`
        SELECT
          s.name AS schema_name,
          t.name AS table_name,
          p.rows AS row_count
        FROM sys.tables t
        INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
        INNER JOIN sys.partitions p ON t.object_id = p.object_id AND p.index_id IN (0, 1)
        ORDER BY s.name, t.name
      `);

      return c.json({
        success: true,
        data: result.rows,
      });
    }

    // Redshift placeholder
    return c.json({
      success: true,
      data: [],
    });
  } catch (error: any) {
    return c.json(
      {
        success: false,
        error: error.message,
      },
      500
    );
  }
});
