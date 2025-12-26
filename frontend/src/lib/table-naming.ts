/**
 * Generate a 4-digit random number for table naming
 */
export function generateTableSuffix(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

/**
 * Get a session-based random suffix that persists during the session
 * but regenerates on page refresh
 */
export function getSessionTableSuffix(): string {
  // Check if we already have a suffix for this session
  const existing = sessionStorage.getItem('table_suffix');
  if (existing) {
    return existing;
  }

  // Generate new one and store it
  const suffix = generateTableSuffix();
  sessionStorage.setItem('table_suffix', suffix);
  return suffix;
}

/**
 * Generate a Redshift table name with rs_ prefix
 */
export function getRedshiftTableName(): string {
  const suffix = getSessionTableSuffix();
  return `rs_${suffix}`;
}

/**
 * Generate a SQL Server table name with ss_ prefix
 */
export function getSqlServerTableName(): string {
  const suffix = getSessionTableSuffix();
  return `ss_${suffix}`;
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