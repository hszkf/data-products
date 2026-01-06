/**
 * Unified SQL Service for cross-source queries
 * Supports both Redshift and SQL Server with schema prefix convention:
 * - rs.schema.table for Redshift
 * - ss.schema.table for SQL Server
 */

import {
  RedshiftDataClient,
  ExecuteStatementCommand,
  GetStatementResultCommand,
  DescribeStatementCommand,
  ListTablesCommand,
  StatusString,
} from '@aws-sdk/client-redshift-data';
import sql from 'mssql';

// Configuration
const redshiftConfig = {
  database: process.env.REDSHIFT_DATABASE || 'glue_spectrum',
  workgroupName: process.env.REDSHIFT_WORKGROUP_NAME || 'serverless-workgroup',
  region: process.env.AWS_REGION || 'ap-southeast-1',
};

const sqlServerConfig: sql.config = {
  user: process.env.SQLSERVER_USER || 'ssis_admin',
  password: process.env.SQLSERVER_PASSWORD || 'P@55word',
  server: process.env.SQLSERVER_HOST || '10.200.224.42',
  database: process.env.SQLSERVER_DATABASE || 'Staging',
  port: parseInt(process.env.SQLSERVER_PORT || '1433'),
  options: {
    encrypt: process.env.SQLSERVER_ENCRYPT === 'true',
    trustServerCertificate: process.env.SQLSERVER_TRUST_CERT !== 'false',
    enableArithAbort: true,
  },
  pool: {
    max: 30,
    min: 10,
    idleTimeoutMillis: 3600000,
    acquireTimeoutMillis: 600000,
  },
  requestTimeout: 3600000,
  connectionTimeout: 60000,
};

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  executionTime: number;
  source?: 'redshift' | 'sqlserver' | 'cross';
}

export interface UnifiedSchema {
  redshift: Record<string, string[]>;
  sqlserver: Record<string, string[]>;
}

export interface HealthStatus {
  redshift: { connected: boolean; error?: string };
  sqlserver: { connected: boolean; error?: string };
}

// Clients
let redshiftClient: RedshiftDataClient | null = null;
let sqlServerPool: sql.ConnectionPool | null = null;
let redshiftConnected = false;
let sqlServerConnected = false;

/**
 * Initialize Redshift client
 */
async function initRedshiftClient(): Promise<boolean> {
  const MAX_ITERATIONS = 50;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    try {
      redshiftClient = new RedshiftDataClient({
        region: redshiftConfig.region,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
          sessionToken: process.env.AWS_SESSION_TOKEN || '',
        },
      });

      // Test with simple query
      const statementId = await executeRedshiftStatement('SELECT 1');
      if (statementId) {
        await waitForRedshiftStatement(statementId, 30000);
        redshiftConnected = true;
        console.log('✅ Unified SQL: Redshift connected');
        return true;
      }
    } catch (error: any) {
      if (i === MAX_ITERATIONS - 1) {
        console.warn(`⚠️ Unified SQL: Redshift connection failed after ${MAX_ITERATIONS} attempts:`, error.message);
        redshiftConnected = false;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  return false;
}

/**
 * Initialize SQL Server pool
 */
async function initSqlServerPool(): Promise<boolean> {
  const MAX_ITERATIONS = 50;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    try {
      sqlServerPool = await sql.connect(sqlServerConfig);
      sqlServerConnected = true;
      console.log('✅ Unified SQL: SQL Server connected');
      return true;
    } catch (error: any) {
      if (i === MAX_ITERATIONS - 1) {
        console.warn(`⚠️ Unified SQL: SQL Server connection failed after ${MAX_ITERATIONS} attempts:`, error.message);
        sqlServerConnected = false;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  return false;
}

/**
 * Initialize unified SQL service
 */
export async function initUnifiedSql(): Promise<void> {
  const results = await Promise.allSettled([
    initRedshiftClient(),
    initSqlServerPool(),
  ]);

  console.log('Unified SQL initialization complete:', {
    redshift: redshiftConnected,
    sqlserver: sqlServerConnected,
  });
}

/**
 * Close all connections
 */
export async function closeUnifiedSql(): Promise<void> {
  if (redshiftClient) {
    redshiftClient.destroy();
    redshiftClient = null;
    redshiftConnected = false;
  }
  if (sqlServerPool) {
    await sqlServerPool.close();
    sqlServerPool = null;
    sqlServerConnected = false;
  }
  console.log('Unified SQL connections closed');
}

// ============ Redshift Operations ============

async function executeRedshiftStatement(sqlQuery: string): Promise<string | null> {
  if (!redshiftClient) return null;

  const command = new ExecuteStatementCommand({
    Database: redshiftConfig.database,
    WorkgroupName: redshiftConfig.workgroupName,
    Sql: sqlQuery,
  });

  const response = await redshiftClient.send(command);
  return response.Id || null;
}

async function waitForRedshiftStatement(statementId: string, maxWaitMs: number = 60000): Promise<boolean> {
  if (!redshiftClient) return false;

  const startTime = Date.now();
  const pollInterval = 1000;

  while (Date.now() - startTime < maxWaitMs) {
    const describeCommand = new DescribeStatementCommand({ Id: statementId });
    const response = await redshiftClient.send(describeCommand);
    const status = response.Status;

    if (status === StatusString.FINISHED) {
      return true;
    } else if (status === StatusString.FAILED) {
      throw new Error(`Query failed: ${response.Error}`);
    } else if (status === StatusString.ABORTED) {
      throw new Error('Query was aborted');
    }

    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  throw new Error('Query timeout');
}

async function getRedshiftStatementResult(statementId: string): Promise<QueryResult> {
  if (!redshiftClient) {
    throw new Error('Redshift client not initialized');
  }

  const command = new GetStatementResultCommand({ Id: statementId });
  const response = await redshiftClient.send(command);

  const columns = response.ColumnMetadata?.map(col => col.name || '') || [];
  const rows = response.Records?.map(record => {
    const row: Record<string, unknown> = {};
    record.forEach((field, index) => {
      const columnName = columns[index] || `column_${index}`;
      row[columnName] = field.stringValue
        ?? field.longValue
        ?? field.doubleValue
        ?? field.booleanValue
        ?? field.blobValue
        ?? null;
    });
    return row;
  }) || [];

  return {
    columns,
    rows,
    rowCount: response.TotalNumRows || rows.length,
    executionTime: 0,
    source: 'redshift',
  };
}

async function executeRedshiftQuery(query: string): Promise<QueryResult> {
  const start = Date.now();

  if (!redshiftClient || !redshiftConnected) {
    throw new Error('Redshift not connected');
  }

  const statementId = await executeRedshiftStatement(query);
  if (!statementId) {
    throw new Error('Failed to execute statement');
  }

  await waitForRedshiftStatement(statementId);
  const result = await getRedshiftStatementResult(statementId);
  result.executionTime = Date.now() - start;

  return result;
}

async function getRedshiftSchema(): Promise<Record<string, string[]>> {
  if (!redshiftClient || !redshiftConnected) {
    return {};
  }

  try {
    const allTables: Array<{ schema?: string; name?: string; type?: string }> = [];
    let nextToken: string | undefined;

    do {
      const listTablesCommand = new ListTablesCommand({
        Database: redshiftConfig.database,
        WorkgroupName: redshiftConfig.workgroupName,
        NextToken: nextToken,
      });

      const response = await redshiftClient.send(listTablesCommand);
      if (response.Tables) {
        allTables.push(...response.Tables);
      }
      nextToken = response.NextToken;
    } while (nextToken);

    const schemasResult: Record<string, string[]> = {};

    for (const table of allTables) {
      const schemaName = table.schema;
      const tableName = table.name;

      if (!schemaName || !tableName) continue;
      if (['pg_catalog', 'information_schema', 'pg_internal'].includes(schemaName)) continue;
      if (table.type === 'SYSTEM TABLE') continue;

      if (!schemasResult[schemaName]) {
        schemasResult[schemaName] = [];
      }
      if (!schemasResult[schemaName].includes(tableName)) {
        schemasResult[schemaName].push(tableName);
      }
    }

    for (const schema of Object.keys(schemasResult)) {
      schemasResult[schema].sort();
    }

    return schemasResult;
  } catch (error) {
    return {};
  }
}

// ============ SQL Server Operations ============

async function getSqlServerPool(): Promise<sql.ConnectionPool> {
  if (!sqlServerPool || !sqlServerPool.connected) {
    await initSqlServerPool();
  }
  return sqlServerPool!;
}

async function executeSqlServerQuery(query: string): Promise<QueryResult> {
  const start = Date.now();
  const pool = await getSqlServerPool();

  const result = await pool.request().query(query);
  const executionTime = Date.now() - start;

  const columns = result.recordset?.columns
    ? Object.keys(result.recordset.columns)
    : result.recordset?.length > 0
      ? Object.keys(result.recordset[0])
      : [];

  return {
    columns,
    rows: result.recordset || [],
    rowCount: result.recordset?.length || result.rowsAffected?.[0] || 0,
    executionTime,
    source: 'sqlserver',
  };
}

async function getSqlServerSchema(): Promise<Record<string, string[]>> {
  if (!sqlServerPool || !sqlServerConnected) {
    return {};
  }

  try {
    const pool = await getSqlServerPool();
    const result = await pool.request().query(`
      SELECT
        s.name AS schema_name,
        t.name AS table_name
      FROM sys.schemas s
      INNER JOIN sys.tables t ON s.schema_id = t.schema_id
      ORDER BY s.name, t.name
    `);

    const schemas: Record<string, string[]> = {};
    for (const row of result.recordset) {
      const schemaName = row.schema_name;
      const tableName = row.table_name;

      if (!schemas[schemaName]) {
        schemas[schemaName] = [];
      }
      schemas[schemaName].push(tableName);
    }

    return schemas;
  } catch (error) {
    return {};
  }
}

// ============ Unified Operations ============

/**
 * Parse query to detect source based on schema prefix
 * rs.schema.table -> redshift
 * ss.schema.table -> sqlserver
 */
function detectQuerySource(query: string): 'redshift' | 'sqlserver' | 'cross' | 'unknown' {
  const hasRedshift = /\brs\.[a-z0-9_]+\.[a-z0-9_]+/i.test(query);
  const hasSqlServer = /\bss\.\[[^\]]+\]\.[a-z0-9_]+/i.test(query) || /\bss\.[a-z0-9_]+\.[a-z0-9_]+/i.test(query);

  if (hasRedshift && hasSqlServer) {
    return 'cross';
  } else if (hasRedshift) {
    return 'redshift';
  } else if (hasSqlServer) {
    return 'sqlserver';
  }
  return 'unknown';
}

/**
 * Transform query by removing source prefix and adjusting syntax
 * rs.schema.table -> schema.table (for Redshift)
 * ss.schema.table -> [schema].[table] (for SQL Server)
 */
function transformQueryForSource(query: string, source: 'redshift' | 'sqlserver'): string {
  if (source === 'redshift') {
    // Remove rs. prefix: rs.schema.table -> schema.table
    return query.replace(/\brs\.([a-z0-9_]+)\.([a-z0-9_]+)/gi, '$1.$2');
  } else {
    // Remove ss. prefix: ss.[schema].table or ss.schema.table -> [schema].[table]
    let transformed = query.replace(/\bss\.\[([^\]]+)\]\.([a-z0-9_]+)/gi, '[$1].[$2]');
    transformed = transformed.replace(/\bss\.([a-z0-9_]+)\.([a-z0-9_]+)/gi, '[$1].[$2]');
    return transformed;
  }
}

interface CrossSourceJoinInfo {
  rsTable: { schema: string; table: string; alias: string };
  ssTable: { schema: string; table: string; alias: string };
  joinType: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';
  joinCondition: { rsColumn: string; ssColumn: string };
  selectColumns: string;
  whereClause?: string;
  rsWhereConditions: string[];
  ssWhereConditions: string[];
  limit?: number;
}

/**
 * Parse WHERE conditions and separate by source alias
 */
function parseWhereConditions(whereClause: string, rsAlias: string, ssAlias: string): { rs: string[]; ss: string[] } {
  const rs: string[] = [];
  const ss: string[] = [];

  // Split by AND (simple parsing)
  const conditions = whereClause.split(/\s+AND\s+/i);

  for (const cond of conditions) {
    const trimmed = cond.trim();
    // Check which alias the condition references
    const rsPattern = new RegExp(`\\b${rsAlias}\\.`, 'i');
    const ssPattern = new RegExp(`\\b${ssAlias}\\.`, 'i');

    if (rsPattern.test(trimmed)) {
      // Replace alias with actual column name for source query
      const transformed = trimmed.replace(new RegExp(`\\b${rsAlias}\\.`, 'gi'), '');
      rs.push(transformed);
    } else if (ssPattern.test(trimmed)) {
      // Replace alias with actual column name for source query
      const transformed = trimmed.replace(new RegExp(`\\b${ssAlias}\\.`, 'gi'), '');
      ss.push(transformed);
    }
  }

  return { rs, ss };
}

/**
 * Parse cross-source JOIN query
 * Example: SELECT * FROM rs.schema.table rs JOIN ss.[schema].table ss ON rs.col = ss.col
 */
function parseCrossSourceQuery(query: string): CrossSourceJoinInfo | null {
  // Normalize query
  const normalizedQuery = query.replace(/\s+/g, ' ').trim();

  // Extract SELECT columns
  const selectMatch = normalizedQuery.match(/SELECT\s+(.+?)\s+FROM/i);
  const selectColumns = selectMatch ? selectMatch[1].trim() : '*';

  // Extract Redshift table: rs.schema.table alias
  const rsTableMatch = normalizedQuery.match(/\brs\.([a-z0-9_]+)\.([a-z0-9_]+)\s+([a-z0-9_]+)/i);
  if (!rsTableMatch) return null;

  const rsTable = {
    schema: rsTableMatch[1],
    table: rsTableMatch[2],
    alias: rsTableMatch[3],
  };

  // Extract SQL Server table: ss.[schema].table alias or ss.schema.table alias
  let ssTableMatch = normalizedQuery.match(/\bss\.\[([^\]]+)\]\.([a-z0-9_]+)\s+([a-z0-9_]+)/i);
  if (!ssTableMatch) {
    ssTableMatch = normalizedQuery.match(/\bss\.([a-z0-9_]+)\.([a-z0-9_]+)\s+([a-z0-9_]+)/i);
  }
  if (!ssTableMatch) return null;

  const ssTable = {
    schema: ssTableMatch[1],
    table: ssTableMatch[2],
    alias: ssTableMatch[3],
  };

  // Detect JOIN type
  let joinType: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL' = 'INNER';
  if (/LEFT\s+(OUTER\s+)?JOIN/i.test(normalizedQuery)) joinType = 'LEFT';
  else if (/RIGHT\s+(OUTER\s+)?JOIN/i.test(normalizedQuery)) joinType = 'RIGHT';
  else if (/FULL\s+(OUTER\s+)?JOIN/i.test(normalizedQuery)) joinType = 'FULL';

  // Extract JOIN condition: ON alias1.col = alias2.col
  const onMatch = normalizedQuery.match(/\bON\s+([a-z0-9_]+)\.([a-z0-9_]+)\s*=\s*([a-z0-9_]+)\.([a-z0-9_]+)/i);
  if (!onMatch) return null;

  const leftAlias = onMatch[1];
  const leftCol = onMatch[2];
  const rightAlias = onMatch[3];
  const rightCol = onMatch[4];

  // Determine which column belongs to which source
  let rsColumn: string, ssColumn: string;
  if (leftAlias.toLowerCase() === rsTable.alias.toLowerCase()) {
    rsColumn = leftCol;
    ssColumn = rightCol;
  } else {
    rsColumn = rightCol;
    ssColumn = leftCol;
  }

  // Extract WHERE clause if present
  const whereMatch = normalizedQuery.match(/\bWHERE\s+(.+?)(?:\s+ORDER\s+BY|\s+LIMIT|\s*$)/i);
  const whereClause = whereMatch ? whereMatch[1].trim() : undefined;

  // Parse WHERE conditions by source
  let rsWhereConditions: string[] = [];
  let ssWhereConditions: string[] = [];
  if (whereClause) {
    const parsed = parseWhereConditions(whereClause, rsTable.alias, ssTable.alias);
    rsWhereConditions = parsed.rs;
    ssWhereConditions = parsed.ss;
  }

  // Extract LIMIT
  const limitMatch = normalizedQuery.match(/\bLIMIT\s+(\d+)/i);
  const limit = limitMatch ? parseInt(limitMatch[1], 10) : undefined;

  return {
    rsTable,
    ssTable,
    joinType,
    joinCondition: { rsColumn, ssColumn },
    selectColumns,
    whereClause,
    rsWhereConditions,
    ssWhereConditions,
    limit,
  };
}

/**
 * Execute cross-source JOIN by fetching from both sources and joining in memory
 */
async function executeCrossSourceJoin(query: string): Promise<QueryResult> {
  const start = Date.now();

  const joinInfo = parseCrossSourceQuery(query);
  if (!joinInfo) {
    throw new Error('Could not parse cross-source query. Supported format: SELECT * FROM rs.schema.table alias1 JOIN ss.[schema].table alias2 ON alias1.col = alias2.col');
  }

  const { rsTable, ssTable, joinType, joinCondition, rsWhereConditions, ssWhereConditions, limit } = joinInfo;

  // Build individual queries with WHERE conditions pushed down
  let rsQuery = `SELECT * FROM ${rsTable.schema}.${rsTable.table}`;
  let ssQuery = `SELECT * FROM [${ssTable.schema}].[${ssTable.table}]`;

  // Add WHERE conditions to source queries
  if (rsWhereConditions.length > 0) {
    rsQuery += ` WHERE ${rsWhereConditions.join(' AND ')}`;
  }
  if (ssWhereConditions.length > 0) {
    ssQuery += ` WHERE ${ssWhereConditions.join(' AND ')}`;
  }

  console.log(`Cross-source JOIN: Fetching from Redshift with query: ${rsQuery}`);
  console.log(`Cross-source JOIN: Fetching from SQL Server with query: ${ssQuery}`);

  // Execute both queries in parallel
  const [rsResult, ssResult] = await Promise.all([
    executeRedshiftQuery(rsQuery),
    executeSqlServerQuery(ssQuery),
  ]);

  console.log(`Cross-source JOIN: Redshift returned ${rsResult.rowCount} rows, SQL Server returned ${ssResult.rowCount} rows`);

  // Build index on SQL Server data for efficient lookup
  const ssIndex = new Map<string, Record<string, unknown>[]>();
  for (const row of ssResult.rows) {
    const key = String(row[joinCondition.ssColumn] ?? '').toLowerCase();
    if (!ssIndex.has(key)) {
      ssIndex.set(key, []);
    }
    ssIndex.get(key)!.push(row);
  }

  // Perform JOIN
  const joinedRows: Record<string, unknown>[] = [];
  const rsAlias = rsTable.alias;
  const ssAlias = ssTable.alias;

  for (const rsRow of rsResult.rows) {
    const joinKey = String(rsRow[joinCondition.rsColumn] ?? '').toLowerCase();
    const matchingSSRows = ssIndex.get(joinKey) || [];

    if (matchingSSRows.length > 0) {
      // Found matches - create joined rows
      for (const ssRow of matchingSSRows) {
        const joinedRow: Record<string, unknown> = {};

        // Add Redshift columns with alias prefix
        for (const [col, val] of Object.entries(rsRow)) {
          joinedRow[`${rsAlias}_${col}`] = val;
        }

        // Add SQL Server columns with alias prefix
        for (const [col, val] of Object.entries(ssRow)) {
          joinedRow[`${ssAlias}_${col}`] = val;
        }

        joinedRows.push(joinedRow);

        // Check limit
        if (limit && joinedRows.length >= limit) break;
      }
    } else if (joinType === 'LEFT' || joinType === 'FULL') {
      // No match but LEFT/FULL JOIN - include RS row with NULL SS columns
      const joinedRow: Record<string, unknown> = {};
      for (const [col, val] of Object.entries(rsRow)) {
        joinedRow[`${rsAlias}_${col}`] = val;
      }
      for (const col of ssResult.columns) {
        joinedRow[`${ssAlias}_${col}`] = null;
      }
      joinedRows.push(joinedRow);
    }

    if (limit && joinedRows.length >= limit) break;
  }

  // Handle RIGHT/FULL JOIN - add unmatched SS rows
  if (joinType === 'RIGHT' || joinType === 'FULL') {
    const matchedSSKeys = new Set<string>();
    for (const rsRow of rsResult.rows) {
      matchedSSKeys.add(String(rsRow[joinCondition.rsColumn] ?? '').toLowerCase());
    }

    for (const ssRow of ssResult.rows) {
      const key = String(ssRow[joinCondition.ssColumn] ?? '').toLowerCase();
      if (!matchedSSKeys.has(key)) {
        const joinedRow: Record<string, unknown> = {};
        for (const col of rsResult.columns) {
          joinedRow[`${rsAlias}_${col}`] = null;
        }
        for (const [col, val] of Object.entries(ssRow)) {
          joinedRow[`${ssAlias}_${col}`] = val;
        }
        joinedRows.push(joinedRow);

        if (limit && joinedRows.length >= limit) break;
      }
    }
  }

  // Get columns from first joined row
  const columns = joinedRows.length > 0 ? Object.keys(joinedRows[0]) : [];

  console.log(`Cross-source JOIN: Produced ${joinedRows.length} joined rows in ${Date.now() - start}ms`);

  return {
    columns,
    rows: joinedRows,
    rowCount: joinedRows.length,
    executionTime: Date.now() - start,
    source: 'cross',
  };
}

/**
 * Execute unified query with automatic source detection
 */
export async function executeUnifiedQuery(query: string): Promise<QueryResult> {
  const source = detectQuerySource(query);

  if (source === 'cross') {
    return executeCrossSourceJoin(query);
  }

  if (source === 'redshift') {
    const transformedQuery = transformQueryForSource(query, 'redshift');
    return executeRedshiftQuery(transformedQuery);
  } else if (source === 'sqlserver') {
    const transformedQuery = transformQueryForSource(query, 'sqlserver');
    return executeSqlServerQuery(transformedQuery);
  } else {
    // No prefix - try to detect from query structure or default to SQL Server
    // Check for Redshift-specific syntax
    if (query.toLowerCase().includes('limit ') && !query.toLowerCase().includes('top ')) {
      return executeRedshiftQuery(query);
    }
    // Check for SQL Server-specific syntax
    if (query.toLowerCase().includes('top ') || query.includes('[')) {
      return executeSqlServerQuery(query);
    }
    // Default to SQL Server
    return executeSqlServerQuery(query);
  }
}

/**
 * Get unified schema from both sources
 */
export async function getUnifiedSchema(): Promise<UnifiedSchema> {
  const [redshiftSchema, sqlServerSchema] = await Promise.all([
    getRedshiftSchema(),
    getSqlServerSchema(),
  ]);

  return {
    redshift: redshiftSchema,
    sqlserver: sqlServerSchema,
  };
}

/**
 * Get health status for both sources
 */
export async function getUnifiedHealthStatus(): Promise<HealthStatus> {
  const status: HealthStatus = {
    redshift: { connected: false },
    sqlserver: { connected: false },
  };

  // Check Redshift
  if (redshiftClient) {
    try {
      const statementId = await executeRedshiftStatement('SELECT 1');
      if (statementId) {
        await waitForRedshiftStatement(statementId, 10000);
        status.redshift.connected = true;
        redshiftConnected = true;
      }
    } catch (error: any) {
      status.redshift.connected = false;
      status.redshift.error = error.message;
      redshiftConnected = false;
    }
  }

  // Check SQL Server
  if (sqlServerPool) {
    try {
      const pool = await getSqlServerPool();
      await pool.request().query('SELECT 1');
      status.sqlserver.connected = true;
      sqlServerConnected = true;
    } catch (error: any) {
      status.sqlserver.connected = false;
      status.sqlserver.error = error.message;
      sqlServerConnected = false;
    }
  }

  return status;
}
