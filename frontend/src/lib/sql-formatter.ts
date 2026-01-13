/**
 * SQL Formatter Utility
 *
 * Formats SQL queries for Redshift (PostgreSQL) and SQL Server dialects.
 */

import { format } from "sql-formatter";

export type DatabaseType = "redshift" | "sqlserver";

interface FormatOptions {
  /** Use uppercase for SQL keywords */
  uppercase?: boolean;
  /** Number of spaces for indentation */
  tabWidth?: number;
  /** Maximum line width before wrapping */
  lineWidth?: number;
}

const defaultOptions: FormatOptions = {
  uppercase: true,
  tabWidth: 2,
  lineWidth: 80,
};

/**
 * Format a SQL query string
 */
export function formatSql(
  sql: string,
  database: DatabaseType,
  options: FormatOptions = {}
): string {
  const opts = { ...defaultOptions, ...options };

  // Map database type to sql-formatter language
  const language = database === "redshift" ? "redshift" : "transactsql";

  try {
    return format(sql, {
      language,
      keywordCase: opts.uppercase ? "upper" : "preserve",
      tabWidth: opts.tabWidth,
      linesBetweenQueries: 2,
      indentStyle: "standard",
    });
  } catch (error) {
    // If formatting fails, return original SQL
    console.warn("SQL formatting failed:", error);
    return sql;
  }
}

/**
 * Check if SQL can be formatted (basic validation)
 */
export function canFormatSql(sql: string): boolean {
  if (!sql || !sql.trim()) {
    return false;
  }
  // Basic check - has some SQL-like content
  const sqlKeywords = /\b(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|FROM|WHERE|JOIN|AND|OR|GROUP|ORDER|HAVING|UNION|WITH)\b/i;
  return sqlKeywords.test(sql);
}
