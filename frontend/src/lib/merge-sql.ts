/**
 * AlaSQL wrapper for executing merge queries on in-memory tables
 */

import type { TableData } from "~/components/merge/merge-context";

export interface MergeResult {
  status: "success" | "error";
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  executionTime: number;
  error?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let alasql: any = null;

/**
 * Dynamically load AlaSQL to avoid SSR issues
 */
async function getAlasql() {
  if (!alasql) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const module = await import("alasql");
    alasql = module.default || module;
  }
  return alasql;
}

/**
 * Escape table name for AlaSQL (wrap in brackets for safety)
 */
function escapeTableName(name: string): string {
  return `[${name}]`;
}

/**
 * Register tables in AlaSQL from the saved tables
 */
async function registerTables(tables: Record<string, TableData>): Promise<void> {
  const sql = await getAlasql();

  // Clear any existing tables
  Object.keys(sql.tables || {}).forEach((tableName) => {
    try {
      sql(`DROP TABLE IF EXISTS [${tableName}]`);
    } catch {
      // Ignore errors when dropping tables
    }
  });

  // Register each table
  Object.entries(tables).forEach(([name, data]) => {
    if (data.rows.length > 0) {
      // Create table from data with escaped name
      sql(`CREATE TABLE ${escapeTableName(name)}`);
      sql.tables[name].data = [...data.rows];
    }
  });
}

/**
 * Execute a merge SQL query against registered tables
 */
export async function executeMergeQuery(
  sqlQuery: string,
  tables: Record<string, TableData>
): Promise<MergeResult> {
  const startTime = performance.now();

  try {
    const sql = await getAlasql();

    // Register all tables
    await registerTables(tables);

    // Execute the query
    const result = sql(sqlQuery);

    const endTime = performance.now();
    const executionTime = (endTime - startTime) / 1000;

    // Handle different result types
    if (Array.isArray(result) && result.length > 0) {
      const columns = Object.keys(result[0]);
      return {
        status: "success",
        columns,
        rows: result,
        rowCount: result.length,
        executionTime: Math.round(executionTime * 1000) / 1000,
      };
    }

    // Empty result
    return {
      status: "success",
      columns: [],
      rows: [],
      rowCount: 0,
      executionTime: Math.round(executionTime * 1000) / 1000,
    };
  } catch (error) {
    const endTime = performance.now();
    const executionTime = (endTime - startTime) / 1000;

    // Extract detailed error message
    let errorMessage = "Query execution failed";
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === "string") {
      errorMessage = error;
    } else if (error && typeof error === "object" && "message" in error) {
      errorMessage = String(error.message);
    } else {
      errorMessage = `An unexpected error occurred: ${String(error)}`;
    }

    return {
      status: "error",
      columns: [],
      rows: [],
      rowCount: 0,
      executionTime: Math.round(executionTime * 1000) / 1000,
      error: errorMessage,
    };
  }
}

/**
 * Get list of available tables and their columns
 */
export function getTableInfo(
  tables: Record<string, TableData>
): Array<{ name: string; columns: string[]; rowCount: number; source: string }> {
  return Object.entries(tables).map(([name, data]) => ({
    name,
    columns: data.columns,
    rowCount: data.rows.length,
    source: data.source,
  }));
}
