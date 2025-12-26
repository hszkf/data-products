

import * as React from "react";
import { Play, Combine, Table2, Timer, TableProperties, Download, FileText, FileSpreadsheet, Database, Save, ChevronDown, Columns, Upload } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Button } from "~/components/ui/button";
import { Pagination } from "~/components/ui/pagination";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { SaveQueryDialog } from "~/components/ui/save-query-dialog";
import { ImportQueryDialog } from "~/components/ui/import-query-dialog";
import { FileUploadDialog } from "~/components/ui/file-upload-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";
import { useMerge } from "./merge-context";
import { SavedTablesList } from "./saved-tables-list";
import { executeMergeQuery, MergeResult } from "~/lib/merge-sql";
import { downloadAsCSV, downloadAsExcel } from "~/lib/download";
import { SavedQuery } from "~/lib/api";
import { FileUp } from "lucide-react";
import { generateJoinQuery } from "~/lib/table-naming";

const ROWS_PER_PAGE = 100;

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

const defaultMergeQuery = `-- Query uploaded files or join tables
-- Use [brackets] around table names

SELECT * FROM [your_table_name]
LIMIT 100`;

export function SimpleMergeEditor() {
  const { tables, canMerge } = useMerge();
  // Use empty state initially to avoid hydration issues
  const [query, setQuery] = React.useState('');
  const [result, setResult] = React.useState<MergeResult | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isInitialized, setIsInitialized] = React.useState(false);

  // Initialize with default query only on client side
  React.useEffect(() => {
    if (typeof window !== 'undefined' && !isInitialized) {
      setQuery(defaultMergeQuery);
      setIsInitialized(true);
    }
  }, [isInitialized]);

  // Check if we have both redshift and sqlserver tables
  const hasBothTables = React.useMemo(() => {
    const redshiftTable = Object.entries(tables).find(([name, data]) =>
      data.source === 'redshift' && name.startsWith('rs_')
    );
    const sqlserverTable = Object.entries(tables).find(([name, data]) =>
      data.source === 'sqlserver' && name.startsWith('ss_')
    );

    if (redshiftTable && sqlserverTable) {
      return {
        redshiftTable: redshiftTable[0],
        sqlserverTable: sqlserverTable[0]
      };
    }
    return null;
  }, [tables]);

  // Update query with placeholder when both tables are available
  // Only run on client side to avoid hydration issues
  React.useEffect(() => {
    if (typeof window !== 'undefined' && hasBothTables && !query.trim().startsWith('--') && !query.includes('[')) {
      const placeholderQuery = generateJoinQuery(hasBothTables.redshiftTable, hasBothTables.sqlserverTable);
      setQuery(placeholderQuery);
    }
  }, [hasBothTables]);

  const [currentPage, setCurrentPage] = React.useState(1);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = React.useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = React.useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = React.useState(false);

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

  const handleExecute = React.useCallback(async () => {
    if (!query.trim()) return;

    setIsLoading(true);
    setResult(null);

    try {
      const mergeResult = await executeMergeQuery(query, tables);
      setResult(mergeResult);
    } catch (error) {
      setResult({
        status: "error",
        columns: [],
        rows: [],
        rowCount: 0,
        executionTime: 0,
        error: error instanceof Error ? error.message : "Query execution failed",
      });
    } finally {
      setIsLoading(false);
    }
  }, [query, tables]);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleExecute();
      }
    },
    [handleExecute]
  );

  const handleQuerySelect = React.useCallback((selectedQuery: SavedQuery) => {
    setQuery(selectedQuery.query_text);
  }, []);

  return (
    <div className="flex flex-col bg-surface min-h-[900px]">
      {/* Panel Header */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0 border-b border-outline-variant bg-gradient-to-r from-redshift/10 via-surface-container to-sqlserver/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-redshift/20 to-sqlserver/20">
            <Combine className="w-[18px] h-[18px] text-on-surface" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-on-surface leading-tight">
              Merge Editor
            </h2>
            <span className="text-[11px] text-on-surface-variant flex items-center gap-1">
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  canMerge ? "bg-green-400" : "bg-yellow-400"
                )}
              />
              {canMerge
                ? "Ready to merge"
                : "Run queries in both panels to enable"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="icon"
                size="icon"
                onClick={() => setIsUploadDialogOpen(true)}
              >
                <Upload className="w-[18px] h-[18px]" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Upload Files to S3</TooltipContent>
          </Tooltip>

          <DropdownMenu.Root>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenu.Trigger asChild>
                  <Button variant="icon" size="icon">
                    <Save className="w-[18px] h-[18px]" />
                    <ChevronDown className="w-3 h-3 ml-0.5" />
                  </Button>
                </DropdownMenu.Trigger>
              </TooltipTrigger>
              <TooltipContent>Query Actions</TooltipContent>
            </Tooltip>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                className={cn(
                  "min-w-[160px] p-1 rounded-lg z-50",
                  "bg-surface-container-highest shadow-elevation-3",
                  "border border-outline-variant",
                  "animate-in fade-in-0 zoom-in-95"
                )}
                sideOffset={5}
                align="end"
              >
                <DropdownMenu.Item
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 text-sm rounded-md cursor-pointer",
                    "text-on-surface hover:bg-surface-container-high",
                    "outline-none",
                    !query.trim() && "opacity-50 pointer-events-none"
                  )}
                  onClick={() => setIsSaveDialogOpen(true)}
                  disabled={!query.trim()}
                >
                  <Save className="w-4 h-4" />
                  Save Query
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 text-sm rounded-md cursor-pointer",
                    "text-on-surface hover:bg-surface-container-high",
                    "outline-none"
                  )}
                  onClick={() => setIsImportDialogOpen(true)}
                >
                  <FileUp className="w-4 h-4" />
                  Import Query
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>

          <Button
            variant="run"
            size="sm"
            onClick={handleExecute}
            disabled={isLoading}
            className="bg-gradient-to-r from-redshift to-sqlserver hover:from-redshift/90 hover:to-sqlserver/90"
          >
            <Play className="w-4 h-4" />
            Run Merge
            <span className="text-[10px] opacity-70 flex items-center gap-0.5">
              <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-[10px]">
                ⌘
              </kbd>
              <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-[10px]">
                ↵
              </kbd>
            </span>
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex min-h-0">
        {/* Sidebar - Saved Tables */}
        <div className="w-52 flex-shrink-0 border-r border-outline-variant bg-surface-container">
          <SavedTablesList />
        </div>

        {/* Editor and Results */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Simple SQL Editor */}
          <div className="h-96 flex-shrink-0 border-b border-outline-variant">
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="-- Enter your merge SQL query..."
              disabled={isLoading}
              className="w-full h-full p-4 bg-surface font-mono text-[13px] text-white resize-none focus:outline-none focus:ring-2 focus:ring-gradient-to-r focus:ring-from-redshift/30 focus:ring-to-sqlserver/30"
              style={{
                caretColor: '#ff9900',
                tabSize: 2,
              }}
            />
          </div>

          {/* Results with Tabs */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <Tabs defaultValue="results" className="flex flex-col h-full">
              <div className="flex items-center justify-between px-4 py-2 bg-surface-container border-b border-outline-variant gap-4">
                <div className="flex items-center gap-2 flex-shrink-0">
                  <TabsList>
                    <TabsTrigger value="results" colorScheme="merge">
                      Results
                    </TabsTrigger>
                    <TabsTrigger value="columns" colorScheme="merge">
                      Columns
                    </TabsTrigger>
                    <TabsTrigger value="messages" colorScheme="merge">
                      Messages
                      {result?.error && (
                        <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-purple-500 text-white">
                          1
                        </span>
                      )}
                    </TabsTrigger>
                  </TabsList>

                  {/* Download Button */}
                  {result && result.status === "success" && result.columns.length > 0 && result.rows.length > 0 && (
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
                                `merge_results_${Date.now()}`
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
                                `merge_results_${Date.now()}`
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

                {result && result.status === "success" && (
                  <div className="flex items-center gap-3 text-[11px] text-on-surface-variant flex-shrink-0">
                    <span className="flex items-center gap-1">
                      <Timer className="w-3.5 h-3.5" />
                      {result.executionTime}s
                    </span>
                    <span className="flex items-center gap-1">
                      <TableProperties className="w-3.5 h-3.5" />
                      {totalRows} rows
                    </span>
                  </div>
                )}
              </div>

              {/* Results Tab */}
              <TabsContent value="results" className="flex-1 m-0 overflow-hidden relative">
                {isLoading ? (
                  <div className="flex items-center justify-center h-full text-on-surface-variant">
                    <div className="animate-spin w-5 h-5 border-2 border-outline border-t-on-surface rounded-full" />
                    <span className="ml-2 text-sm">Executing merge...</span>
                  </div>
                ) : result?.status === "success" &&
                result.columns.length > 0 &&
                result.rows.length > 0 ? (
                <>
                  {/* Table container - use absolute positioning but leave room for pagination */}
                  <div className={cn(
                    "absolute inset-0 overflow-auto",
                    totalPages > 1 && "bottom-10"
                  )}>
                    <table
                      className="border-collapse text-xs"
                      style={{ minWidth: "max-content" }}
                    >
                      <thead>
                        <tr>
                          {result.columns.map((column) => (
                            <th
                              key={column}
                              className={cn(
                                "px-4 py-2 text-left font-semibold",
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
                              "hover:bg-surface-container-high"
                            )}
                          >
                            {result.columns.map((column) => (
                              <td
                                key={column}
                                className="px-4 py-2 font-mono text-[11px] whitespace-nowrap"
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
                    <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-4 py-2 bg-surface-container border-t border-outline-variant">
                      <span className="text-[11px] text-on-surface-variant">
                        Showing {startIndex + 1}-{endIndex} of {totalRows} rows
                      </span>
                      <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={handlePageChange}
                        colorScheme="merge"
                      />
                    </div>
                  )}
                </>
                ) : result?.status === "success" ? (
                  <div className="flex flex-col items-center justify-center h-full text-outline gap-2">
                    <Table2 className="w-6 h-6 opacity-50" />
                    <span className="text-sm">Query returned no results</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-outline gap-2">
                    <Combine className="w-8 h-8 opacity-50" />
                    <span className="text-sm">
                      {canMerge
                        ? "Write a query to merge data from both databases"
                        : "Run queries in Redshift and SQL Server panels first"}
                    </span>
                    <span className="text-xs text-on-surface-variant">
                      Available tables: <code className="bg-surface-container px-1 rounded">redshift</code>, <code className="bg-surface-container px-1 rounded">sqlserver</code>
                    </span>
                  </div>
                )}
              </TabsContent>

              {/* Columns Tab */}
              <TabsContent value="columns" className="flex-1 m-0 overflow-hidden relative">
                {result && result.status === "success" && result.columns.length > 0 ? (
                  <div className="absolute inset-0 overflow-auto">
                    <table className="border-collapse text-xs" style={{ minWidth: 'max-content' }}>
                      <thead>
                        <tr>
                          <th className={cn(
                            "px-4 py-2 text-left font-semibold",
                            "bg-surface-container text-on-surface-variant",
                            "border-b border-outline-variant",
                            "sticky top-0 z-10 whitespace-nowrap"
                          )}>
                            #
                          </th>
                          <th className={cn(
                            "px-4 py-2 text-left font-semibold",
                            "bg-surface-container text-on-surface-variant",
                            "border-b border-outline-variant",
                            "sticky top-0 z-10 whitespace-nowrap"
                          )}>
                            Column Name
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.columns.map((column, index) => (
                          <tr
                            key={column}
                            className="border-b border-outline-variant transition-colors hover:bg-surface-container-high"
                          >
                            <td className="px-4 py-2 font-mono text-[11px] text-on-surface-variant">
                              {index + 1}
                            </td>
                            <td className="px-4 py-2 font-mono text-[11px] whitespace-nowrap">
                              {column}
                            </td>
                          </tr>
                        ))}
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

              {/* Messages Tab */}
              <TabsContent value="messages" className="flex-1 overflow-auto m-0">
                {result?.error ? (
                  <div className="p-4">
                    <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center">
                          <svg
                            className="w-4 h-4 text-red-400"
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
                          <h4 className="text-sm font-semibold text-red-400 mb-2">
                            Merge Query Error
                          </h4>
                          <pre className="text-xs text-red-200 font-mono whitespace-pre-wrap break-words">
                            {result.error}
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
            </Tabs>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-surface-container border-t border-outline-variant text-[11px] text-on-surface-variant">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <Database className="w-3.5 h-3.5" />
            In-Memory (AlaSQL)
          </span>
          <span className="flex items-center gap-1">
            <TableProperties className="w-3.5 h-3.5" />
            {Object.keys(tables).length} tables available
          </span>
          {hasBothTables && (
            <span className="flex items-center gap-1 text-purple-600">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-600"></span>
              Ready to merge: [{hasBothTables.redshiftTable}] + [{hasBothTables.sqlserverTable}]
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span>Client-side SQL Engine</span>
        </div>
      </div>

      {/* Save Query Dialog */}
      <SaveQueryDialog
        open={isSaveDialogOpen}
        onOpenChange={setIsSaveDialogOpen}
        queryText={query}
        queryType="merge"
        colorScheme="merge"
      />

      {/* Import Query Dialog */}
      <ImportQueryDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        onQuerySelect={handleQuerySelect}
        queryType="merge"
        colorScheme="merge"
      />

      {/* File Upload Dialog */}
      <FileUploadDialog
        open={isUploadDialogOpen}
        onOpenChange={setIsUploadDialogOpen}
        colorScheme="merge"
      />
    </div>
  );
}