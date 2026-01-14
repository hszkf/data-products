/**
 * SQL Autocomplete - Redshift & SQL Server Schema, Table, Column & Keywords
 *
 * Fast autocomplete for schemas, tables, columns, and SQL keywords.
 * Columns are fetched on-demand when user types "schema.table." and cached locally.
 * Supports both Redshift and SQL Server databases.
 */

import { executeQuery } from "./api";

export type DatabaseType = "redshift" | "sqlserver" | "sqlserver-bi-backup" | "sqlserver-datamart";

export interface AutocompleteSuggestion {
  value: string;
  label: string;
  type: "database" | "schema" | "table" | "column" | "keyword";
  detail?: string;
}

// SQL Server database names
const SQLSERVER_DATABASES = ['Staging', 'BI_Backup', 'Datamart'];

// SQL Keywords for autocomplete
const SQL_KEYWORDS = [
  // DML
  'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'EXISTS',
  'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE',
  // Joins
  'JOIN', 'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'FULL JOIN', 'CROSS JOIN',
  'LEFT OUTER JOIN', 'RIGHT OUTER JOIN', 'FULL OUTER JOIN', 'ON',
  // Clauses
  'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'OFFSET', 'DISTINCT',
  'AS', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
  // Operators
  'BETWEEN', 'LIKE', 'ILIKE', 'IS NULL', 'IS NOT NULL',
  // Aggregates
  'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'COALESCE', 'NULLIF',
  // Window functions
  'OVER', 'PARTITION BY', 'ROW_NUMBER', 'RANK', 'DENSE_RANK', 'LAG', 'LEAD',
  // Set operations
  'UNION', 'UNION ALL', 'INTERSECT', 'EXCEPT',
  // DDL
  'CREATE', 'TABLE', 'VIEW', 'INDEX', 'DROP', 'ALTER', 'TRUNCATE',
  // CTE
  'WITH', 'AS',
  // Other
  'CAST', 'CONVERT', 'EXTRACT', 'DATE_TRUNC', 'TO_CHAR', 'TO_DATE',
  'GETDATE', 'CURRENT_DATE', 'CURRENT_TIMESTAMP', 'DATEADD', 'DATEDIFF',
];

// Schema cache key (shared with schema-browser)
const SCHEMA_CACHE_KEY = 'sql-schema-cache';
const COLUMN_CACHE_KEY = 'sql-column-cache';
const COLUMN_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

interface SchemaCache {
  data: {
    schemas: {
      redshift: Record<string, string[]>;
      sqlserver: Record<string, string[]>;
    };
  };
  timestamp: number;
}

interface ColumnInfo {
  name: string;
  dataType: string;
}

interface ColumnCache {
  [tableFullName: string]: {
    columns: ColumnInfo[];
    timestamp: number;
  };
}

// Cache the parsed schema data in memory for faster access (per database)
const cachedSchemas: Record<string, { schema: string; table: string; fullName: string }[]> = {};
const cacheTimestamps: Record<string, number> = {};

// Memory cache for columns (faster than localStorage)
let memoryColumnCache: ColumnCache = {};

/**
 * Get the schema key for a database type (normalize sqlserver variants)
 */
function getSchemaKey(database: DatabaseType): "redshift" | "sqlserver" {
  if (database === "redshift") return "redshift";
  return "sqlserver"; // All SQL Server variants share the same schema
}

/**
 * Load schemas from localStorage cache
 */
function loadSchemas(database: DatabaseType): { schema: string; table: string; fullName: string }[] {
  if (typeof window === 'undefined') return [];

  const schemaKey = getSchemaKey(database);

  try {
    const cached = localStorage.getItem(SCHEMA_CACHE_KEY);
    if (!cached) {
      return [];
    }

    const parsed: SchemaCache = JSON.parse(cached);

    // Check if we need to refresh memory cache
    if (cachedSchemas[schemaKey] && parsed.timestamp === cacheTimestamps[schemaKey]) {
      return cachedSchemas[schemaKey];
    }

    const schemas = parsed.data?.schemas?.[schemaKey] || {};
    const result: { schema: string; table: string; fullName: string }[] = [];

    for (const [schemaName, tables] of Object.entries(schemas)) {
      for (const tableName of tables) {
        result.push({
          schema: schemaName,
          table: tableName,
          fullName: `${schemaName}.${tableName}`,
        });
      }
    }

    // Update memory cache
    cachedSchemas[schemaKey] = result;
    cacheTimestamps[schemaKey] = parsed.timestamp;

    return result;
  } catch (e) {
    console.error('[Autocomplete] Error loading schemas:', e);
    return [];
  }
}

/**
 * Load column cache from localStorage
 */
function loadColumnCache(): ColumnCache {
  if (typeof window === 'undefined') return {};

  try {
    const cached = localStorage.getItem(COLUMN_CACHE_KEY);
    if (!cached) return {};
    return JSON.parse(cached);
  } catch {
    return {};
  }
}

/**
 * Save column cache to localStorage
 */
function saveColumnCache(cache: ColumnCache): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(COLUMN_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Get columns for a table from cache
 */
function getCachedColumns(tableFullName: string): ColumnInfo[] | null {
  // Check memory cache first
  const memCached = memoryColumnCache[tableFullName];
  if (memCached && Date.now() - memCached.timestamp < COLUMN_CACHE_TTL) {
    return memCached.columns;
  }

  // Check localStorage cache
  const cache = loadColumnCache();
  const cached = cache[tableFullName];
  if (cached && Date.now() - cached.timestamp < COLUMN_CACHE_TTL) {
    // Update memory cache
    memoryColumnCache[tableFullName] = cached;
    return cached.columns;
  }

  return null;
}

/**
 * Store columns in cache
 */
function cacheColumns(tableFullName: string, columns: ColumnInfo[]): void {
  const entry = { columns, timestamp: Date.now() };

  // Update memory cache
  memoryColumnCache[tableFullName] = entry;

  // Update localStorage cache
  const cache = loadColumnCache();
  cache[tableFullName] = entry;
  saveColumnCache(cache);
}

/**
 * Simplify data type for display (e.g., "character varying(256)" -> "varchar(256)")
 */
function simplifyDataType(dataType: string): string {
  if (!dataType) return '';
  const lower = dataType.toLowerCase();

  // Common type simplifications
  if (lower.startsWith('character varying')) return lower.replace('character varying', 'varchar');
  if (lower === 'integer') return 'int';
  if (lower === 'bigint') return 'bigint';
  if (lower === 'smallint') return 'smallint';
  if (lower === 'double precision') return 'double';
  if (lower === 'boolean') return 'bool';
  if (lower.startsWith('timestamp')) return 'timestamp';
  if (lower.startsWith('numeric')) return lower;

  return lower;
}

/**
 * Fetch columns for a table from database (async)
 * This is called when columns aren't in cache
 */
export async function fetchTableColumns(
  schemaName: string,
  tableName: string,
  database: DatabaseType = "redshift"
): Promise<ColumnInfo[]> {
  const fullName = `${database}:${schemaName}.${tableName}`;

  // Check cache first
  const cached = getCachedColumns(fullName);
  if (cached) return cached;

  try {
    let query: string;
    let dbTarget: DatabaseType = database;

    if (database === "redshift") {
      // Redshift uses information_schema
      query = `
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = '${schemaName}'
          AND table_name = '${tableName}'
        ORDER BY ordinal_position
      `;
    } else {
      // SQL Server - query sys.columns with sys.types
      // Use Staging database for column metadata (all schemas are visible)
      dbTarget = "sqlserver";
      query = `
        SELECT
          c.name AS column_name,
          t.name + CASE
            WHEN t.name IN ('varchar', 'nvarchar', 'char', 'nchar') THEN '(' + CAST(c.max_length AS VARCHAR) + ')'
            WHEN t.name IN ('decimal', 'numeric') THEN '(' + CAST(c.precision AS VARCHAR) + ',' + CAST(c.scale AS VARCHAR) + ')'
            ELSE ''
          END AS data_type
        FROM sys.columns c
        INNER JOIN sys.types t ON c.user_type_id = t.user_type_id
        INNER JOIN sys.tables tbl ON c.object_id = tbl.object_id
        INNER JOIN sys.schemas s ON tbl.schema_id = s.schema_id
        WHERE s.name = '${schemaName}'
          AND tbl.name = '${tableName}'
        ORDER BY c.column_id
      `;
    }

    const result = await executeQuery(dbTarget, query);
    const columns: ColumnInfo[] = result.rows.map(row => ({
      name: String(row.column_name),
      dataType: simplifyDataType(String(row.data_type || '')),
    }));

    // Cache the results
    if (columns.length > 0) {
      cacheColumns(fullName, columns);
    }

    return columns;
  } catch (error) {
    console.warn('Failed to fetch columns:', error);
    return [];
  }
}

/**
 * Get the current word being typed at cursor position
 */
export function getCurrentWord(text: string, cursorPosition: number): { word: string; start: number } {
  let start = cursorPosition;

  // Move backwards to find word beginning (alphanumeric, underscore, dot)
  while (start > 0 && /[\w\.]/.test(text[start - 1])) {
    start--;
  }

  return {
    word: text.substring(start, cursorPosition),
    start,
  };
}

/**
 * Parse word to extract schema, table, and partial column
 * Returns: { schema, table, columnPrefix } or null if not a column context
 */
function parseTableReference(word: string): { schema: string; table: string; columnPrefix: string } | null {
  const parts = word.split('.');

  // schema.table. or schema.table.col
  if (parts.length >= 3) {
    return {
      schema: parts[0],
      table: parts[1],
      columnPrefix: parts.slice(2).join('.').toLowerCase(),
    };
  }

  return null;
}

/**
 * Get autocomplete suggestions for schemas, tables, and columns
 * Returns sync suggestions from cache; columns may need async fetch
 * Supports both Redshift and SQL Server databases
 *
 * SQL Server uses 3-level: Database.Schema.Table (e.g., Staging.dbo.Users)
 * Redshift uses 2-level: Schema.Table (e.g., public.customers)
 */
export function getSuggestions(
  text: string,
  cursorPosition: number,
  database: DatabaseType
): AutocompleteSuggestion[] {
  const { word } = getCurrentWord(text, cursorPosition);

  // Need at least 2 characters to trigger (or pattern with dot)
  if (!word || (word.length < 2 && !word.includes('.'))) {
    return [];
  }

  const isSqlServer = database !== "redshift";
  const searchTerm = word.toLowerCase();
  const parts = searchTerm.split('.');
  const schemas = loadSchemas(database);
  const suggestions: AutocompleteSuggestion[] = [];

  if (isSqlServer) {
    // SQL Server: Database.Schema.Table.Column pattern
    return getSqlServerSuggestions(word, parts, schemas);
  } else {
    // Redshift: Schema.Table.Column pattern
    return getRedshiftSuggestions(word, parts, schemas, database);
  }
}

/**
 * SQL Server suggestions with 3-level hierarchy: Database.Schema.Table
 */
function getSqlServerSuggestions(
  word: string,
  parts: string[],
  schemas: { schema: string; table: string; fullName: string }[]
): AutocompleteSuggestion[] {
  const suggestions: AutocompleteSuggestion[] = [];
  const searchTerm = word.toLowerCase();

  if (parts.length === 1) {
    // User typing plain text - suggest databases and keywords
    const searchUpper = searchTerm.toUpperCase();

    // Match SQL keywords
    for (const keyword of SQL_KEYWORDS) {
      if (keyword.startsWith(searchUpper)) {
        suggestions.push({
          value: keyword + ' ',
          label: keyword,
          type: "keyword",
        });
      }
    }

    // Match database names (Staging, BI_Backup, Datamart)
    for (const db of SQLSERVER_DATABASES) {
      if (db.toLowerCase().startsWith(searchTerm)) {
        suggestions.push({
          value: db + '.',
          label: db,
          type: "database",
          detail: "database",
        });
      }
    }
  } else if (parts.length === 2) {
    // User typed "Database." - suggest schemas in that database
    const dbPrefix = parts[0];
    const schemaPrefix = parts[1];
    const seenSchemas = new Set<string>();

    for (const item of schemas) {
      // Schema format is "Database.Schema" (e.g., "Staging.dbo")
      const schemaParts = item.schema.split('.');
      if (schemaParts.length === 2) {
        const [itemDb, itemSchema] = schemaParts;
        if (itemDb.toLowerCase() === dbPrefix) {
          if (!schemaPrefix || itemSchema.toLowerCase().startsWith(schemaPrefix)) {
            const fullSchemaPath = `${itemDb}.${itemSchema}`;
            if (!seenSchemas.has(fullSchemaPath)) {
              seenSchemas.add(fullSchemaPath);
              suggestions.push({
                value: fullSchemaPath + '.',
                label: itemSchema,
                type: "schema",
                detail: itemDb,
              });
            }
          }
        }
      }
    }
  } else if (parts.length === 3) {
    // User typed "Database.Schema." - suggest tables
    const dbPrefix = parts[0];
    const schemaPrefix = parts[1];
    const tablePrefix = parts[2];
    const targetSchema = `${dbPrefix}.${schemaPrefix}`.toLowerCase();
    const seenTables = new Set<string>();

    for (const item of schemas) {
      if (item.schema.toLowerCase() === targetSchema) {
        if (!tablePrefix || item.table.toLowerCase().startsWith(tablePrefix)) {
          if (!seenTables.has(item.fullName.toLowerCase())) {
            seenTables.add(item.fullName.toLowerCase());
            suggestions.push({
              value: item.fullName,
              label: item.table,
              type: "table",
              detail: item.schema,
            });
          }
        }
      }
    }
  } else if (parts.length >= 4) {
    // User typed "Database.Schema.Table." - suggest columns
    const dbName = parts[0];
    const schemaName = parts[1];
    const tableName = parts[2];
    const columnPrefix = parts.slice(3).join('.').toLowerCase();

    // Get database type from database name
    const dbTypeMap: Record<string, DatabaseType> = {
      'staging': 'sqlserver',
      'bi_backup': 'sqlserver-bi-backup',
      'datamart': 'sqlserver-datamart',
    };
    const dbType = dbTypeMap[dbName.toLowerCase()] || 'sqlserver';
    const cacheKey = `${dbType}:${schemaName}.${tableName}`;
    const columns = getCachedColumns(cacheKey);

    if (columns) {
      for (const col of columns) {
        if (!columnPrefix || col.name.toLowerCase().startsWith(columnPrefix)) {
          suggestions.push({
            value: col.name,
            label: col.name,
            type: "column",
            detail: col.dataType,
          });
        }
        if (suggestions.length >= 15) break;
      }
    }
  }

  // Sort suggestions
  suggestions.sort((a, b) => {
    const typeOrder = { keyword: 0, database: 1, schema: 2, table: 3, column: 4 };
    if (a.type !== b.type) {
      return typeOrder[a.type] - typeOrder[b.type];
    }
    return a.label.localeCompare(b.label);
  });

  return suggestions;
}

/**
 * Redshift suggestions with 2-level hierarchy: Schema.Table
 */
function getRedshiftSuggestions(
  word: string,
  parts: string[],
  schemas: { schema: string; table: string; fullName: string }[],
  database: DatabaseType
): AutocompleteSuggestion[] {
  const suggestions: AutocompleteSuggestion[] = [];
  const searchTerm = word.toLowerCase();

  if (parts.length === 1) {
    // User typing plain text - suggest schemas and keywords
    const searchUpper = searchTerm.toUpperCase();
    const seenSchemas = new Set<string>();

    // Match SQL keywords
    for (const keyword of SQL_KEYWORDS) {
      if (keyword.startsWith(searchUpper)) {
        suggestions.push({
          value: keyword + ' ',
          label: keyword,
          type: "keyword",
        });
      }
    }

    // Match schema names
    for (const item of schemas) {
      if (item.schema.toLowerCase().startsWith(searchTerm) && !seenSchemas.has(item.schema)) {
        seenSchemas.add(item.schema);
        suggestions.push({
          value: item.schema + '.',
          label: item.schema,
          type: "schema",
        });
      }
    }
  } else if (parts.length === 2) {
    // User typed "schema." - suggest tables
    const schemaPrefix = parts[0];
    const tablePrefix = parts[1];
    const seenTables = new Set<string>();

    for (const item of schemas) {
      if (item.schema.toLowerCase() === schemaPrefix) {
        if (!tablePrefix || item.table.toLowerCase().startsWith(tablePrefix)) {
          if (!seenTables.has(item.fullName.toLowerCase())) {
            seenTables.add(item.fullName.toLowerCase());
            suggestions.push({
              value: item.fullName,
              label: item.table,
              type: "table",
              detail: item.schema,
            });
          }
        }
      }
    }
  } else if (parts.length >= 3) {
    // User typed "schema.table." - suggest columns
    const schemaName = parts[0];
    const tableName = parts[1];
    const columnPrefix = parts.slice(2).join('.').toLowerCase();
    const cacheKey = `${database}:${schemaName}.${tableName}`;
    const columns = getCachedColumns(cacheKey);

    if (columns) {
      for (const col of columns) {
        if (!columnPrefix || col.name.toLowerCase().startsWith(columnPrefix)) {
          suggestions.push({
            value: col.name,
            label: col.name,
            type: "column",
            detail: col.dataType,
          });
        }
        if (suggestions.length >= 15) break;
      }
    }
  }

  // Sort suggestions
  suggestions.sort((a, b) => {
    const typeOrder = { keyword: 0, database: 1, schema: 2, table: 3, column: 4 };
    if (a.type !== b.type) {
      return typeOrder[a.type] - typeOrder[b.type];
    }
    return a.label.localeCompare(b.label);
  });

  return suggestions;
}

/**
 * Check if word is in column context
 * SQL Server: Database.Schema.Table. (4 parts)
 * Redshift: Schema.Table. (3 parts)
 */
export function isColumnContext(word: string, database: DatabaseType): { schema: string; table: string; dbType?: DatabaseType } | null {
  const parts = word.split('.');
  const isSqlServer = database !== "redshift";

  if (isSqlServer) {
    // SQL Server: Database.Schema.Table. pattern (need 4+ parts)
    if (parts.length >= 4 && parts[0] && parts[1] && parts[2]) {
      const dbName = parts[0];
      const schemaName = parts[1];
      const tableName = parts[2];

      // Map database name to database type
      const dbTypeMap: Record<string, DatabaseType> = {
        'staging': 'sqlserver',
        'bi_backup': 'sqlserver-bi-backup',
        'datamart': 'sqlserver-datamart',
      };
      const dbType = dbTypeMap[dbName.toLowerCase()] || 'sqlserver';

      // Verify this is a known table
      const schemas = loadSchemas(database);
      const schemaKey = `${dbName}.${schemaName}`.toLowerCase();
      const found = schemas.find(s =>
        s.schema.toLowerCase() === schemaKey &&
        s.table.toLowerCase() === tableName.toLowerCase()
      );
      if (found) {
        return { schema: schemaName, table: tableName, dbType };
      }
    }
  } else {
    // Redshift: Schema.Table. pattern (need 3+ parts)
    if (parts.length >= 3 && parts[0] && parts[1]) {
      const schemas = loadSchemas(database);
      const fullName = `${parts[0]}.${parts[1]}`.toLowerCase();
      const found = schemas.find(s => s.fullName.toLowerCase() === fullName);
      if (found) {
        return { schema: found.schema, table: found.table };
      }
    }
  }
  return null;
}
