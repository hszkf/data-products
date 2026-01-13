/**
 * SQL Autocomplete - Redshift Schema, Table & Column Names
 *
 * Fast autocomplete for Redshift schemas, tables, and columns from cache.
 * Columns are fetched on-demand when user types "schema.table." and cached locally.
 */

import { executeQuery } from "./api";

export interface AutocompleteSuggestion {
  value: string;
  label: string;
  type: "schema" | "table" | "column";
  detail?: string;
}

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

// Cache the parsed schema data in memory for faster access
let cachedSchemas: { schema: string; table: string; fullName: string }[] | null = null;
let cacheTimestamp = 0;

// Memory cache for columns (faster than localStorage)
let memoryColumnCache: ColumnCache = {};

/**
 * Load schemas from localStorage cache
 */
function loadSchemas(): { schema: string; table: string; fullName: string }[] {
  if (typeof window === 'undefined') return [];

  try {
    const cached = localStorage.getItem(SCHEMA_CACHE_KEY);
    if (!cached) return [];

    const parsed: SchemaCache = JSON.parse(cached);

    // Check if we need to refresh memory cache
    if (cachedSchemas && parsed.timestamp === cacheTimestamp) {
      return cachedSchemas;
    }

    const schemas = parsed.data?.schemas?.redshift || {};
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
    cachedSchemas = result;
    cacheTimestamp = parsed.timestamp;

    return result;
  } catch {
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
 * Fetch columns for a table from Redshift (async)
 * This is called when columns aren't in cache
 */
export async function fetchTableColumns(schemaName: string, tableName: string): Promise<ColumnInfo[]> {
  const fullName = `${schemaName}.${tableName}`;

  // Check cache first
  const cached = getCachedColumns(fullName);
  if (cached) return cached;

  try {
    const query = `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = '${schemaName}'
        AND table_name = '${tableName}'
      ORDER BY ordinal_position
    `;

    const result = await executeQuery("redshift", query);
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
 * Get autocomplete suggestions for Redshift schemas, tables, and columns
 * Returns sync suggestions from cache; columns may need async fetch
 */
export function getSuggestions(
  text: string,
  cursorPosition: number,
  database: "redshift" | "sqlserver"
): AutocompleteSuggestion[] {
  // Only support Redshift
  if (database !== "redshift") {
    return [];
  }

  const { word } = getCurrentWord(text, cursorPosition);

  // Need at least 2 characters to trigger (or schema.table. pattern)
  if (!word || (word.length < 2 && !word.includes('.'))) {
    return [];
  }

  // Check if we're in column context (schema.table.)
  const tableRef = parseTableReference(word);
  if (tableRef) {
    // Try to get columns from cache
    const fullName = `${tableRef.schema}.${tableRef.table}`;
    const columns = getCachedColumns(fullName);

    if (columns) {
      // Return column suggestions from cache
      const suggestions: AutocompleteSuggestion[] = [];
      const prefix = tableRef.columnPrefix;

      for (const col of columns) {
        if (!prefix || col.name.toLowerCase().startsWith(prefix)) {
          suggestions.push({
            value: col.name,
            label: col.name,
            type: "column",
            detail: col.dataType,
          });
        }
        if (suggestions.length >= 15) break;
      }

      return suggestions;
    }

    // Columns not in cache - trigger async fetch (handled by component)
    // Return empty to signal "loading" state
    return [];
  }

  // Schema and table suggestions
  const searchTerm = word.toLowerCase();
  const schemas = loadSchemas();
  const suggestions: AutocompleteSuggestion[] = [];
  const seenSchemas = new Set<string>();

  for (const item of schemas) {
    const schemaLower = item.schema.toLowerCase();
    const tableLower = item.table.toLowerCase();
    const fullLower = item.fullName.toLowerCase();

    // Match schema name
    if (schemaLower.startsWith(searchTerm) && !seenSchemas.has(item.schema)) {
      seenSchemas.add(item.schema);
      suggestions.push({
        value: item.schema,
        label: item.schema,
        type: "schema",
      });
    }

    // Match table name or full name
    if (tableLower.startsWith(searchTerm) || fullLower.includes(searchTerm)) {
      suggestions.push({
        value: item.fullName,
        label: item.table,
        type: "table",
        detail: item.schema,
      });
    }

    // Limit results for performance
    if (suggestions.length >= 12) {
      break;
    }
  }

  // Sort: schemas first, then tables alphabetically
  suggestions.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === "schema" ? -1 : 1;
    }
    return a.label.localeCompare(b.label);
  });

  return suggestions.slice(0, 10);
}

/**
 * Check if word is in column context (schema.table.)
 */
export function isColumnContext(word: string): { schema: string; table: string } | null {
  const parts = word.split('.');
  if (parts.length >= 2 && parts[0] && parts[1]) {
    // Verify this is a known table
    const schemas = loadSchemas();
    const fullName = `${parts[0]}.${parts[1]}`.toLowerCase();
    const found = schemas.find(s => s.fullName.toLowerCase() === fullName);
    if (found) {
      return { schema: found.schema, table: found.table };
    }
  }
  return null;
}
