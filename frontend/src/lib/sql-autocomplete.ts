/**
 * SQL Autocomplete - Redshift Schema & Table Names
 *
 * Fast autocomplete for Redshift schemas and table names from cache.
 */

export interface AutocompleteSuggestion {
  value: string;
  label: string;
  type: "schema" | "table";
  detail?: string;
}

// Schema cache key (shared with schema-browser)
const SCHEMA_CACHE_KEY = 'sql-schema-cache';

interface SchemaCache {
  data: {
    schemas: {
      redshift: Record<string, string[]>;
      sqlserver: Record<string, string[]>;
    };
  };
  timestamp: number;
}

// Cache the parsed schema data in memory for faster access
let cachedSchemas: { schema: string; table: string; fullName: string }[] | null = null;
let cacheTimestamp = 0;

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
 * Get autocomplete suggestions for Redshift schemas and tables
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

  // Need at least 2 characters to trigger
  if (!word || word.length < 2) {
    return [];
  }

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
