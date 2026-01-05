import { Hono } from 'hono';
import { z } from 'zod';
import * as sqlserver from '../services/database/sqlserver';
import * as redshift from '../services/database/redshift';
import { getUser } from '../middleware/auth';
import { checkQuery, getBlockedCommandsForRole } from '../middleware/query-guard';
import { queryLogger } from '../services/query-logger';
import { schemaCache } from '../services/schema-cache';
import { QueryBlockedError } from '../utils/errors';
import { logger } from '../utils/logger';

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
  const startTime = Date.now();
  const database = c.req.path.includes('/redshift') ? 'redshift' : 'sqlserver';
  const user = getUser(c);
  
  try {
    const body = await c.req.json();
    const validated = ExecuteQuerySchema.parse(body);

    // Support both 'query' and 'sql' field names
    const query = validated.query || validated.sql!;

    // Check if query is allowed for this user's role
    if (user) {
      const { allowed, blockedCommand } = checkQuery(query, user.role);
      
      if (!allowed) {
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
    }

    const db = getDatabase(c.req.path);
    const result = await db.executeQuery(query);

    // Log successful query
    if (user) {
      await queryLogger.log({
        userId: user.userId,
        username: user.username,
        role: user.role,
        database,
        query,
        executionTimeMs: Date.now() - startTime,
        rowCount: result.rowCount,
        status: 'success',
        clientIp: c.req.header('x-forwarded-for') || c.req.header('x-real-ip'),
      });
    }

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
    // Log failed query
    if (user && !(error instanceof QueryBlockedError)) {
      const body = await c.req.json().catch(() => ({}));
      const query = body.query || body.sql || '';
      
      await queryLogger.log({
        userId: user.userId,
        username: user.username,
        role: user.role,
        database,
        query,
        executionTimeMs: Date.now() - startTime,
        rowCount: 0,
        status: 'error',
        errorMessage: error.message,
        clientIp: c.req.header('x-forwarded-for') || c.req.header('x-real-ip'),
      });
    }

    // Re-throw QueryBlockedError to be handled by error middleware
    if (error instanceof QueryBlockedError) {
      throw error;
    }

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

// Get database schema (with caching)
sqlRoutes.get('/schema', async (c) => {
  const dbType = c.req.path.includes('/redshift') ? 'redshift' : 'sqlserver';
  const forceRefresh = c.req.query('refresh') === 'true';

  try {
    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cachedSchema = schemaCache.get(dbType);
      if (cachedSchema) {
        const cacheInfo = schemaCache.getInfo(dbType);
        const schemaCount = Object.keys(cachedSchema).length;
        const tableCount = Object.values(cachedSchema).flat().length;
        logger.info(`Schema loaded from cache`, {
          metadata: { database: dbType, schemas: schemaCount, tables: tableCount, age: cacheInfo.age }
        });
        return c.json({
          status: 'success',
          schemas: cachedSchema,
          cached: true,
          cacheInfo: {
            cachedAt: cacheInfo.cachedAt,
            age: cacheInfo.age,
          },
        });
      }
    }

    // Fetch fresh data from database
    logger.info(`Fetching schema from database`, { metadata: { database: dbType, forceRefresh } });
    const db = getDatabase(c.req.path);
    const rawSchema = await db.getSchema();

    // Normalize schema to format frontend expects: { schema_name: ["table1", "table2", ...] }
    const schemas: Record<string, string[]> = {};
    for (const [schemaName, tables] of Object.entries(rawSchema)) {
      if (Array.isArray(tables)) {
        schemas[schemaName] = tables;
      } else if (typeof tables === 'object' && tables !== null) {
        schemas[schemaName] = Object.keys(tables);
      }
    }

    // Cache the result
    schemaCache.set(dbType, schemas);

    const schemaCount = Object.keys(schemas).length;
    const tableCount = Object.values(schemas).flat().length;
    logger.info(`Schema fetched from database`, {
      metadata: { database: dbType, schemas: schemaCount, tables: tableCount }
    });

    return c.json({
      status: 'success',
      schemas,
      cached: false,
    });
  } catch (error: any) {
    logger.error(`Schema fetch error`, error, { metadata: { database: dbType } });
    return c.json({
      status: 'error',
      schemas: {},
      detail: error.message || 'Failed to fetch schema',
    });
  }
});

// Get cache info
sqlRoutes.get('/schema/cache', async (c) => {
  const dbType = c.req.path.includes('/redshift') ? 'redshift' : 'sqlserver';
  const cacheInfo = schemaCache.getInfo(dbType);

  return c.json({
    status: 'success',
    database: dbType,
    cache: cacheInfo,
  });
});

// Clear schema cache
sqlRoutes.delete('/schema/cache', async (c) => {
  const dbType = c.req.path.includes('/redshift') ? 'redshift' : 'sqlserver';
  const cleared = schemaCache.clear(dbType);

  return c.json({
    status: 'success',
    database: dbType,
    cleared,
    message: cleared ? 'Cache cleared successfully' : 'No cache to clear',
  });
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
