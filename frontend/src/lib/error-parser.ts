/**
 * Parse SQL error messages to extract line and column information
 */

export interface ErrorLocation {
  line: number;
  column?: number;
  message: string;
}

/**
 * Extract line number from various SQL error formats
 */
export function parseErrorLocation(errorMessage: string): ErrorLocation | null {
  if (!errorMessage) return null;

  // PostgreSQL/Redshift format: "LINE 5: SELECT * FORM users"
  const pgLineMatch = errorMessage.match(/LINE (\d+):/i);
  if (pgLineMatch) {
    return {
      line: parseInt(pgLineMatch[1], 10),
      message: errorMessage,
    };
  }

  // SQL Server format: "Incorrect syntax near 'FORM' on line 5"
  const sqlServerMatch = errorMessage.match(/(?:on line|line)\s+(\d+)/i);
  if (sqlServerMatch) {
    return {
      line: parseInt(sqlServerMatch[1], 10),
      message: errorMessage,
    };
  }

  // SQL Server format with position: "Line 3, Column 8"
  const sqlServerPosMatch = errorMessage.match(/Line\s+(\d+)(?:,\s*Column\s+(\d+))?/i);
  if (sqlServerPosMatch) {
    return {
      line: parseInt(sqlServerPosMatch[1], 10),
      column: sqlServerPosMatch[2] ? parseInt(sqlServerPosMatch[2], 10) : undefined,
      message: errorMessage,
    };
  }

  // Generic format: "Error at line 10"
  const genericLineMatch = errorMessage.match(/(?:error|syntax).*?line\s+(\d+)/i);
  if (genericLineMatch) {
    return {
      line: parseInt(genericLineMatch[1], 10),
      message: errorMessage,
    };
  }

  // Position format: "position 45" - calculate line from query
  const positionMatch = errorMessage.match(/position\s+(\d+)/i);
  if (positionMatch) {
    // Position alone isn't enough without the original query
    // This will be handled by the component with query context
    return null;
  }

  // No line number found
  return null;
}

/**
 * Convert character position to line number given a query string
 */
export function positionToLine(query: string, position: number): number {
  const textBeforePosition = query.substring(0, position);
  return textBeforePosition.split('\n').length;
}

/**
 * Extract error context from message (the specific part that's wrong)
 */
export function extractErrorContext(errorMessage: string): string | null {
  // Extract text in quotes
  const quotedMatch = errorMessage.match(/['"]([^'"]+)['"]/);
  if (quotedMatch) {
    return quotedMatch[1];
  }

  // Extract text after "near"
  const nearMatch = errorMessage.match(/near\s+(.+?)(?:\.|$)/i);
  if (nearMatch) {
    return nearMatch[1].trim();
  }

  return null;
}
