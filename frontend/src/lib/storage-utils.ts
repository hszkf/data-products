import type { TableData } from "~/components/merge/merge-context";

const STORAGE_KEY = "sql-query-studio-persistent-tables";
const TABLE_SUFFIX_KEY = "table_suffix";

/**
 * Check if we're running in a browser environment
 */
function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export interface PersistedTableData extends TableData {
  timestamp: number;
}

/**
 * Save tables to localStorage with timestamp
 */
export function saveTablesToStorage(tables: Record<string, TableData>): void {
  if (!isBrowser()) return;

  try {
    const persistedTables: Record<string, PersistedTableData> = {};

    Object.entries(tables).forEach(([name, data]) => {
      // Only persist tables from database queries (not uploaded files)
      // Uploaded files have 'uploaded' as source and should be re-uploaded
      if (data.source === "redshift" || data.source === "sqlserver") {
        persistedTables[name] = {
          ...data,
          timestamp: Date.now(),
        };
      }
    });

    localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedTables));
  } catch (error) {
    console.error("Failed to save tables to localStorage:", error);
  }
}

/**
 * Load tables from localStorage (only recent ones, not older than 1 hour)
 */
export function loadTablesFromStorage(): Record<string, TableData> {
  if (!isBrowser()) return {};

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return {};

    const persistedTables: Record<string, PersistedTableData> = JSON.parse(stored);
    const now = Date.now();
    const ONE_HOUR = 60 * 60 * 1000; // 1 hour in milliseconds

    const validTables: Record<string, TableData> = {};

    Object.entries(persistedTables).forEach(([name, data]) => {
      // Only keep tables that are less than 1 hour old
      if (now - data.timestamp < ONE_HOUR) {
        validTables[name] = {
          columns: data.columns,
          rows: data.rows,
          source: data.source,
          savedAt: new Date(data.savedAt),
        };
      }
    });

    return validTables;
  } catch (error) {
    console.error("Failed to load tables from localStorage:", error);
    return {};
  }
}

/**
 * Clear persisted tables from localStorage
 */
export function clearPersistedTables(): void {
  if (!isBrowser()) return;

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Failed to clear tables from localStorage:", error);
  }
}