

import * as React from "react";
import { Timer, TableProperties, Table2, Download, FileSpreadsheet, FileText, Columns } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Pagination } from "~/components/ui/pagination";
import { cn } from "~/lib/utils";
import { downloadAsCSV, downloadAsExcel } from "~/lib/download";
import type { DatabaseType } from "./editor-panel";

const ROWS_PER_PAGE = 100;

// Format execution time to mins and secs
function formatExecutionTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds.toFixed(2)}s`;
  }
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(1);
  return `${mins}m ${secs}s`;
}

interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  executionTime: number;
  message?: string;
  error?: string;
}

interface ResultsPanelProps {
  result: QueryResult | null;
  colorScheme: DatabaseType;
  errorLine?: number | null;
  queryText?: string;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "NULL";
  }
  if (typeof value === "number") {
    return value.toLocaleString();
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
}

function inferDataType(value: unknown): string {
  if (value === null || value === undefined) {
    return "NULL";
  }
  if (typeof value === "number") {
    return Number.isInteger(value) ? "INTEGER" : "DECIMAL";
  }
  if (typeof value === "boolean") {
    return "BOOLEAN";
  }
  if (value instanceof Date) {
    return "DATETIME";
  }
  if (typeof value === "string") {
    // Check if it looks like a date
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
      return "DATE/DATETIME";
    }
    // Check if it looks like a number
    if (/^-?\d+$/.test(value)) {
      return "INTEGER";
    }
    if (/^-?\d+\.\d+$/.test(value)) {
      return "DECIMAL";
    }
    return `VARCHAR(${value.length > 0 ? Math.max(value.length, 50) : 50})`;
  }
  if (typeof value === "object") {
    return "JSON/OBJECT";
  }
  return "UNKNOWN";
}

function getColumnTypes(columns: string[], rows: Record<string, unknown>[]): Record<string, string> {
  const types: Record<string, string> = {};

  for (const column of columns) {
    // Find the first non-null value to infer type
    let inferredType = "UNKNOWN";
    for (const row of rows) {
      const value = row[column];
      if (value !== null && value !== undefined) {
        inferredType = inferDataType(value);
        break;
      }
    }
    types[column] = inferredType;
  }

  return types;
}

export function ResultsPanel({ result, colorScheme, errorLine, queryText }: ResultsPanelProps) {
  const [currentPage, setCurrentPage] = React.useState(1);

  // Extract error line content from query
  const errorLineContent = React.useMemo(() => {
    if (!errorLine || !queryText) return null;
    const lines = queryText.split('\n');
    if (errorLine > 0 && errorLine <= lines.length) {
      return lines[errorLine - 1].trim();
    }
    return null;
  }, [errorLine, queryText]);

  // Reset to page 1 when results change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [result]);

  // Calculate pagination values
  const totalRows = result?.rows?.length ?? 0;
  const totalPages = Math.ceil(totalRows / ROWS_PER_PAGE);
  const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
  const endIndex = Math.min(startIndex + ROWS_PER_PAGE, totalRows);
  const paginatedRows = result?.rows?.slice(startIndex, endIndex) ?? [];

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  return (
    <div className="flex-1 min-h-0 border-t border-outline-variant flex flex-col overflow-hidden">
      <Tabs defaultValue="results" className="flex flex-col h-full">
        <div className="flex items-center justify-between px-3 py-1.5 bg-surface-container border-b border-outline-variant gap-3">
          <div className="flex items-center gap-2 flex-shrink-0">
            <TabsList>
              <TabsTrigger value="results" colorScheme={colorScheme}>
                Results
              </TabsTrigger>
              <TabsTrigger value="columns" colorScheme={colorScheme}>
                Columns
              </TabsTrigger>
              <TabsTrigger value="messages" colorScheme={colorScheme}>
                Messages
                {result?.error ? (
                  <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-red-500 text-white">
                    1
                  </span>
                ) : result?.message ? (
                  <span className={cn(
                    "ml-1.5 px-1.5 py-0.5 text-[10px] font-semibold rounded-full text-white",
                    colorScheme === "redshift" && "bg-redshift",
                    colorScheme === "sqlserver" && "bg-sqlserver"
                  )}>
                    1
                  </span>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="plan" colorScheme={colorScheme}>
                {colorScheme === "redshift" ? "Explain" : "Plan"}
              </TabsTrigger>
            </TabsList>

            {/* Download Button - after Explain/Plan tab */}
            {result && result.columns?.length > 0 && result.rows?.length > 0 && (
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button
                    className={cn(
                      "flex items-center gap-1 px-2 py-1.5 rounded text-xs",
                      "hover:bg-surface-container-high transition-colors",
                      "text-on-surface-variant hover:text-on-surface",
                      "border border-outline-variant"
                    )}
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download
                  </button>
                </DropdownMenu.Trigger>

                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    className={cn(
                      "min-w-[140px] p-1 rounded-lg z-50",
                      "bg-surface-container-highest shadow-elevation-3",
                      "border border-outline-variant",
                      "animate-in fade-in-0 zoom-in-95"
                    )}
                    sideOffset={5}
                    side="bottom"
                    align="start"
                  >
                    <DropdownMenu.Item
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 text-xs rounded-md cursor-pointer",
                        "text-on-surface hover:bg-surface-container-high",
                        "outline-none"
                      )}
                      onClick={() =>
                        downloadAsCSV(
                          { columns: result.columns, rows: result.rows },
                          `query_results_${Date.now()}`
                        )
                      }
                    >
                      <FileText className="w-4 h-4" />
                      Download CSV
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 text-xs rounded-md cursor-pointer",
                        "text-on-surface hover:bg-surface-container-high",
                        "outline-none"
                      )}
                      onClick={() =>
                        downloadAsExcel(
                          { columns: result.columns, rows: result.rows },
                          `query_results_${Date.now()}`
                        )
                      }
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      Download Excel
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            )}
          </div>

          {result && (
            <div className="flex items-center gap-3 text-[11px] text-on-surface-variant flex-shrink-0">
              <span className="flex items-center gap-1">
                <Timer className="w-3.5 h-3.5" />
                {formatExecutionTime(result.executionTime ?? 0)}
              </span>
              <span className="flex items-center gap-1">
                <TableProperties className="w-3.5 h-3.5" />
                {totalRows} rows
              </span>
            </div>
          )}
        </div>

        <TabsContent value="results" className="flex-1 m-0 overflow-hidden relative">
          {result && result.columns?.length > 0 && result.rows?.length > 0 ? (
            <>
              {/* Table container - use absolute positioning but leave room for pagination */}
              <div className={cn(
                "absolute inset-0 overflow-auto",
                totalPages > 1 && "bottom-10"
              )}>
                <table className="border-collapse text-xs" style={{ minWidth: 'max-content' }}>
                <thead>
                  <tr>
                    {result.columns.map((column) => (
                      <th
                        key={column}
                        className={cn(
                          "px-3 py-1.5 text-left font-semibold",
                          "bg-surface-container text-on-surface-variant",
                          "border-b border-outline-variant",
                          "sticky top-0 z-10 whitespace-nowrap"
                        )}
                      >
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.map((row, rowIndex) => (
                    <tr
                      key={startIndex + rowIndex}
                      className={cn(
                        "border-b border-outline-variant",
                        "transition-colors",
                        colorScheme === "redshift" && "hover:bg-redshift-tint",
                        colorScheme === "sqlserver" && "hover:bg-sqlserver-tint"
                      )}
                    >
                      {result.columns.map((column) => (
                        <td
                          key={column}
                          className="px-3 py-1 font-mono text-[11px] whitespace-nowrap"
                        >
                          {formatValue(row[column])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                </table>
              </div>

              {/* Pagination footer - positioned at the bottom */}
              {totalPages > 1 && (
                <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 py-1.5 bg-surface-container border-t border-outline-variant">
                  <span className="text-[11px] text-on-surface-variant">
                    Showing {startIndex + 1}-{endIndex} of {totalRows} rows
                  </span>
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={handlePageChange}
                    colorScheme={colorScheme}
                  />
                </div>
              )}
            </>
          ) : result && result.message ? (
            <div className="flex flex-col items-center justify-center h-full text-on-surface-variant gap-2">
              <span className="text-sm">{result.message}</span>
            </div>
          ) : result ? (
            <div className="flex flex-col items-center justify-center h-full text-outline gap-2">
              <Table2 className="w-8 h-8 opacity-50" />
              <span className="text-sm">Query returned no results</span>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-outline gap-2">
              <Table2 className="w-8 h-8 opacity-50" />
              <span className="text-sm">Run a query to see results</span>
            </div>
          )}
        </TabsContent>

        <TabsContent value="columns" className="flex-1 m-0 overflow-hidden relative">
          {result && result.columns?.length > 0 ? (
            <div className="absolute inset-0 overflow-auto">
              <table className="border-collapse text-xs" style={{ minWidth: 'max-content' }}>
                <thead>
                  <tr>
                    <th
                      className={cn(
                        "px-3 py-1.5 text-left font-semibold",
                        "bg-surface-container text-on-surface-variant",
                        "border-b border-outline-variant",
                        "sticky top-0 z-10 whitespace-nowrap"
                      )}
                    >
                      #
                    </th>
                    <th
                      className={cn(
                        "px-3 py-1.5 text-left font-semibold",
                        "bg-surface-container text-on-surface-variant",
                        "border-b border-outline-variant",
                        "sticky top-0 z-10 whitespace-nowrap"
                      )}
                    >
                      Column Name
                    </th>
                    <th
                      className={cn(
                        "px-3 py-1.5 text-left font-semibold",
                        "bg-surface-container text-on-surface-variant",
                        "border-b border-outline-variant",
                        "sticky top-0 z-10 whitespace-nowrap"
                      )}
                    >
                      Data Type
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const columnTypes = result.rows?.length > 0
                      ? getColumnTypes(result.columns, result.rows)
                      : {};
                    return result.columns.map((column, index) => (
                      <tr
                        key={column}
                        className={cn(
                          "border-b border-outline-variant",
                          "transition-colors",
                          colorScheme === "redshift" && "hover:bg-redshift-tint",
                          colorScheme === "sqlserver" && "hover:bg-sqlserver-tint"
                        )}
                      >
                        <td className="px-3 py-1 font-mono text-[11px] text-on-surface-variant">
                          {index + 1}
                        </td>
                        <td className="px-3 py-1 font-mono text-[11px] whitespace-nowrap">
                          {column}
                        </td>
                        <td className={cn(
                          "px-3 py-1 font-mono text-[11px] whitespace-nowrap",
                          colorScheme === "redshift" ? "text-amber-600 dark:text-redshift" : "text-blue-600 dark:text-sqlserver"
                        )}>
                          {columnTypes[column] || "UNKNOWN"}
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-outline gap-2">
              <Columns className="w-8 h-8 opacity-50" />
              <span className="text-sm">Run a query to see columns</span>
            </div>
          )}
        </TabsContent>

        <TabsContent value="messages" className="flex-1 overflow-auto m-0">
          {result?.error ? (
            <div className="p-3">
              <div className="rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 p-3">
                <div className="flex items-start gap-2">
                  <div className="flex-shrink-0 w-5 h-5 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center">
                    <svg
                      className="w-3.5 h-3.5 text-red-600 dark:text-red-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1">
                      Query Error{errorLine ? ` (Line ${errorLine})` : ''}
                    </h4>
                    {errorLineContent && (
                      <div className="mb-2 p-1.5 bg-red-100 dark:bg-red-500/20 border border-red-300 dark:border-red-500/40 rounded">
                        <div className="text-[9px] text-red-600 dark:text-red-300 mb-0.5 font-semibold">Error Line:</div>
                        <code className="text-[11px] text-red-800 dark:text-red-100 font-mono">
                          {errorLineContent}
                        </code>
                      </div>
                    )}
                    <pre className="text-[11px] text-red-700 dark:text-red-200 font-mono whitespace-pre-wrap break-words">
                      {result.error}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          ) : result?.message ? (
            <div className="p-3">
              <div className={cn(
                "rounded-lg border p-3",
                colorScheme === "redshift" && "bg-amber-50 dark:bg-redshift/10 border-amber-200 dark:border-redshift/30",
                colorScheme === "sqlserver" && "bg-blue-50 dark:bg-sqlserver/10 border-blue-200 dark:border-sqlserver/30"
              )}>
                <div className="flex items-start gap-2">
                  <div className={cn(
                    "flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center",
                    colorScheme === "redshift" && "bg-amber-100 dark:bg-redshift/20",
                    colorScheme === "sqlserver" && "bg-blue-100 dark:bg-sqlserver/20"
                  )}>
                    <svg
                      className={cn(
                        "w-3.5 h-3.5",
                        colorScheme === "redshift" && "text-amber-600 dark:text-redshift",
                        colorScheme === "sqlserver" && "text-blue-600 dark:text-sqlserver"
                      )}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className={cn(
                      "text-xs font-semibold mb-1",
                      colorScheme === "redshift" && "text-amber-700 dark:text-redshift",
                      colorScheme === "sqlserver" && "text-blue-700 dark:text-sqlserver"
                    )}>
                      Message
                    </h4>
                    <pre className="text-[11px] text-on-surface-variant font-mono whitespace-pre-wrap break-words">
                      {result.message}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-outline gap-2">
              <span className="text-sm">No messages</span>
            </div>
          )}
        </TabsContent>

        <TabsContent value="plan" className="flex-1 overflow-auto m-0">
          <div className="flex flex-col items-center justify-center h-full text-outline gap-2">
            <span className="text-sm">Execute with EXPLAIN to see the query plan</span>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
