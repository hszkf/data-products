/**
 * Extract query number from tab name (e.g., "Query 1" -> 1, "My Query" -> null)
 */
export function extractQueryNumber(tabName: string): number | null {
  const match = tabName.match(/query\s*(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Generate a Redshift table name based on query tab
 * Format: rsq{queryNum} (e.g., rsq1, rsq2) - overwrites on re-run
 */
export function getRedshiftTableName(tabName?: string): string {
  const queryNum = tabName ? extractQueryNumber(tabName) : null;
  if (queryNum !== null) {
    return `rsq${queryNum}`;
  }
  // Fallback for custom tab names - use sanitized tab name
  if (tabName) {
    const sanitized = tabName.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 10);
    return `rs_${sanitized}`;
  }
  return `rs_default`;
}

/**
 * Generate a SQL Server table name based on query tab
 * Format: ssq{queryNum} (e.g., ssq1, ssq2) - overwrites on re-run
 */
export function getSqlServerTableName(tabName?: string): string {
  const queryNum = tabName ? extractQueryNumber(tabName) : null;
  if (queryNum !== null) {
    return `ssq${queryNum}`;
  }
  // Fallback for custom tab names - use sanitized tab name
  if (tabName) {
    const sanitized = tabName.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 10);
    return `ss_${sanitized}`;
  }
  return `ss_default`;
}

/**
 * Generate a placeholder join query for Redshift and SQL Server tables
 */
export function generateJoinQuery(redshiftTable: string, sqlserverTable: string): string {
  // Extract column names from both tables if available
  const redshiftColumns = ['*']; // You could pass actual columns
  const sqlserverColumns = ['*'];

  // Basic join template - you can customize this
  return `-- Join Query Template
-- Adjust column names as needed

SELECT
    ${redshiftColumns.join(', ')},
    ${sqlserverColumns.join(', ')}
FROM [${sqlserverTable}] AS ss
LEFT JOIN [${redshiftTable}] AS rs
    ON ss.CIC = rs.bank_cic
    -- Add your join conditions here
ORDER BY ss.CIC ASC;

-- Or use INNER JOIN:
-- SELECT * FROM [${sqlserverTable}] ss
-- INNER JOIN [${redshiftTable}] rs ON ss.id = rs.id`;
}