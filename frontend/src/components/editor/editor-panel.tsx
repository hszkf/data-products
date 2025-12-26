

import * as React from "react";
import { Play, Wand2, GitBranch, Database, TableProperties, PanelLeftClose, PanelLeft, Save, ChevronDown, FileDown, Upload } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { CodeEditor } from "./code-editor";
import { ResultsPanel } from "./results-panel";
import { SchemaBrowser } from "./schema-browser";
import { useToast } from "~/components/ui/toast-provider";
import { SaveQueryDialog } from "~/components/ui/save-query-dialog";
import { ImportQueryDialog } from "~/components/ui/import-query-dialog";
import { FileUploadDialog } from "~/components/ui/file-upload-dialog";
import { useMerge } from "~/components/merge";
import { cn } from "~/lib/utils";
import { executeQuery as apiExecuteQuery, checkHealth, SavedQuery } from "~/lib/api";
import { executeMergeQuery, MergeResult } from "~/lib/merge-sql";
import { parseErrorLocation } from "~/lib/error-parser";
import { getRedshiftTableName, getSqlServerTableName } from "~/lib/table-naming";

export type DatabaseType = "redshift" | "sqlserver";

interface EditorPanelProps {
  type: DatabaseType;
  defaultQuery?: string;
}

interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  executionTime: number;
  message?: string;
  error?: string;
}

const databaseConfig = {
  redshift: {
    name: "Amazon Redshift",
    connection: "Schema: glue-spectrum",
    database: "analytics_db",
    schema: "Hasif Hensem",
    version: "PostgreSQL 8.0.2",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-[18px] h-[18px]">
        <path
          d="M12 2L3 7V17L12 22L21 17V7L12 2Z"
          stroke="#ff9900"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path d="M12 22V12" stroke="#ff9900" strokeWidth="2" />
        <path d="M21 7L12 12L3 7" stroke="#ff9900" strokeWidth="2" />
        <circle cx="12" cy="12" r="2" fill="#ff9900" />
      </svg>
    ),
  },
  sqlserver: {
    name: "SQL Server",
    connection: "10.200.224.42",
    database: "Staging",
    schema: "dbo",
    version: "SQL Server",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-[18px] h-[18px]">
        <rect
          x="3"
          y="3"
          width="18"
          height="18"
          rx="2"
          stroke="#0078d4"
          strokeWidth="2"
        />
        <path d="M3 9H21" stroke="#0078d4" strokeWidth="2" />
        <path d="M9 9V21" stroke="#0078d4" strokeWidth="2" />
        <circle cx="6" cy="6" r="1" fill="#0078d4" />
      </svg>
    ),
  },
};


export function EditorPanel({ type, defaultQuery = "" }: EditorPanelProps) {
  const config = databaseConfig[type];
  const { showToast } = useToast();
  const { tables, saveTable } = useMerge();
  const panelRef = React.useRef<HTMLDivElement>(null);

  const [query, setQuery] = React.useState(defaultQuery);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isConnected, setIsConnected] = React.useState<boolean | null>(null);
  const [result, setResult] = React.useState<QueryResult | null>(null);
  const [cursorPosition, setCursorPosition] = React.useState({
    line: 1,
    column: 1,
  });
  const [isExplorerOpen, setIsExplorerOpen] = React.useState(false);
  const [explorerWidth, setExplorerWidth] = React.useState(300); // 208px = w-52
  const [isResizing, setIsResizing] = React.useState(false);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = React.useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = React.useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = React.useState(false);
  const [errorLine, setErrorLine] = React.useState<number | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Check connection status on mount
  React.useEffect(() => {
    const checkConnectionStatus = async () => {
      try {
        const health = await checkHealth(type);
        setIsConnected(health.status === "connected");
        if (health.status !== "connected") {
          showToast(`${config.name} is disconnected`, "error");
        }
      } catch {
        setIsConnected(false);
      }
    };

    checkConnectionStatus();
  }, [type, config.name, showToast]);

  // Handle explorer resize
  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !panelRef.current) return;
      // Calculate width relative to panel's left edge
      const panelRect = panelRef.current.getBoundingClientRect();
      const newWidth = e.clientX - panelRect.left;
      // Constrain width between 150px and 400px
      setExplorerWidth(Math.min(400, Math.max(150, newWidth)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing]);

  const executeQuery = React.useCallback(async () => {
    if (!query.trim()) {
      showToast("Please enter a query", "error");
      return;
    }

    setIsLoading(true);
    setResult(null);
    setErrorLine(null);
    setErrorMessage(null);

    // Check if query references tables that exist in the merge context
    // Only match actual table names from the context, NOT SQL Server bracket syntax like [dbo].[table]
    const referencedTables = Object.keys(tables).filter(tableName =>
      query.toLowerCase().includes(`[${tableName.toLowerCase()}]`)
    );
    const hasUploadedTables = referencedTables.length > 0;

    // If query references uploaded/saved tables from the merge context, use merge functionality
    if (hasUploadedTables) {
      try {
        const mergeResult = await executeMergeQuery(query, {
          ...tables,
          // Also include current database result as a table if needed
          [type]: {
            columns: [],
            rows: [],
            source: type,
            savedAt: new Date(),
          }
        });

        setResult({
          columns: mergeResult.columns,
          rows: mergeResult.rows,
          executionTime: mergeResult.executionTime,
          error: mergeResult.error,
          message: mergeResult.status === "success" ?
            `Query executed successfully (${mergeResult.rowCount} rows in ${mergeResult.executionTime}s)` :
            undefined,
        });

        if (mergeResult.status === "success") {
          showToast(
            `Query executed successfully (${mergeResult.rowCount} rows in ${mergeResult.executionTime}s)`,
            "success"
          );
        } else {
          showToast(mergeResult.error || "Query execution failed", "error");
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Query execution failed";
        showToast(errorMsg, "error");

        setResult({
          columns: [],
          rows: [],
          executionTime: 0,
          error: errorMsg,
        });
      } finally {
        setIsLoading(false);
      }
    } else {
      // Normal database query execution
      try {
        const response = await apiExecuteQuery(type, query);

        setResult({
          columns: response.columns,
          rows: response.rows,
          executionTime: response.execution_time,
          message: response.message,
        });

        // Auto-save results to merge context for cross-database queries
        // Only save if it looks like a table query (not a random SQL statement)
        // For SQL Server, allow sys. queries if they return actual data
        if (response.columns.length > 0 && response.rows.length > 0 &&
            (query.toLowerCase().includes('select') || query.toLowerCase().includes('from'))) {

          // Database-specific filtering
          const isSystemQuery =
            (type === 'redshift' && (
              query.toLowerCase().includes('information_schema') ||
              query.toLowerCase().includes('pg_')
            )) ||
            (type === 'sqlserver' && (
              query.toLowerCase().includes('information_schema')
            ));

          if (isSystemQuery) {
            // Don't save system metadata queries
            showToast(
              `Query executed successfully (${response.row_count} rows in ${response.execution_time}s)`,
              "success"
            );
            return;
          }

          // Generate table name with rs_ or ss_ prefix and 4-digit random
          const tableName = type === 'redshift' ? getRedshiftTableName() : getSqlServerTableName();

          // Debug: log what's being saved
          console.log(`[${type}] Saving ${response.rows.length} rows to table ${tableName}`);
          console.log('Columns:', response.columns);

          saveTable(tableName, {
            columns: response.columns,
            rows: response.rows,
            source: type,
          });

          // Show toast with the table name
          showToast(
            `Query executed successfully! Results saved as table [${tableName}]`,
            "success"
          );
        } else {
          showToast(
            `Query executed successfully (${response.row_count} rows in ${response.execution_time}s)`,
            "success"
          );
        }
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : "Query execution failed";
        showToast(errorMsg, "error");

        // Parse error to extract line number
        const errorLocation = parseErrorLocation(errorMsg);
        if (errorLocation) {
          setErrorLine(errorLocation.line);
          setErrorMessage(errorMsg);
        } else {
          setErrorLine(null);
          setErrorMessage(null);
        }

        // Set error result to display in Messages tab
        setResult({
          columns: [],
          rows: [],
          executionTime: 0,
          error: errorMsg,
        });
      } finally {
        setIsLoading(false);
      }
    }
  }, [type, query, tables, showToast, saveTable]);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        executeQuery();
      }
    },
    [executeQuery]
  );

  const handleTableSelect = React.useCallback(
    (tableName: string, schema: string) => {
      // Insert the fully qualified table name at cursor or append to query
      // Different format for Redshift vs SQL Server
      const tableRef = type === "redshift"
        ? `${schema}.${tableName}`
        : `[${schema}].[dbo].[${tableName}]`;

      const selectQuery = type === "redshift"
        ? `SELECT * FROM ${tableRef} LIMIT 100`
        : `SELECT TOP 100 * FROM ${tableRef}`;

      setQuery((prev) => {
        if (prev.trim()) {
          return `${prev}\n-- Table: ${tableRef}`;
        }
        return selectQuery;
      });
      showToast(`Table ${tableName} selected`, "info");
    },
    [type, showToast]
  );

  const handleQuerySelect = React.useCallback(
    (savedQuery: SavedQuery) => {
      setQuery(savedQuery.query_text);
      showToast(`Loaded query: ${savedQuery.query_name}`, "success");
    },
    [showToast]
  );

  return (
    <div
      ref={panelRef}
      className={cn(
        "flex flex-col bg-surface overflow-hidden h-full",
        type === "redshift" && "[--panel-primary:theme(colors.redshift.DEFAULT)] [--panel-tint:theme(colors.redshift.tint)] [--panel-container:theme(colors.redshift.container)]",
        type === "sqlserver" && "[--panel-primary:theme(colors.sqlserver.DEFAULT)] [--panel-tint:theme(colors.sqlserver.tint)] [--panel-container:theme(colors.sqlserver.container)]"
      )}
    >
      {/* Panel Header */}
      <div
        className={cn(
          "flex items-center justify-between px-4 py-3 flex-shrink-0",
          "border-b border-outline-variant",
          type === "redshift" && "bg-redshift-tint",
          type === "sqlserver" && "bg-sqlserver-tint"
        )}
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center relative overflow-hidden",
              type === "redshift" && "bg-redshift-container",
              type === "sqlserver" && "bg-sqlserver-container"
            )}
          >
            <div
              className={cn(
                "absolute inset-0",
                type === "redshift" &&
                  "bg-gradient-to-br from-transparent via-transparent to-redshift/30",
                type === "sqlserver" &&
                  "bg-gradient-to-br from-transparent via-transparent to-sqlserver/30"
              )}
            />
            <div className="relative z-10">{config.icon}</div>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-on-surface leading-tight">
              {config.name}
            </h2>
            <span className="text-[11px] text-on-surface-variant flex items-center gap-1">
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  isConnected === null && "bg-yellow-400 animate-pulse",
                  isConnected === true && "bg-green-400",
                  isConnected === false && "bg-red-400"
                )}
              />
              {isConnected === null
                ? "Connecting..."
                : isConnected
                ? config.connection
                : "Disconnected"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="icon"
                size="icon"
                onClick={() => setIsExplorerOpen(!isExplorerOpen)}
              >
                {isExplorerOpen ? (
                  <PanelLeftClose className="w-[18px] h-[18px]" />
                ) : (
                  <PanelLeft className="w-[18px] h-[18px]" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isExplorerOpen ? "Hide Explorer" : "Show Explorer"}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="icon" size="icon" disabled>
                <Wand2 className="w-[18px] h-[18px]" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Format SQL (Coming Soon)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="icon" size="icon" disabled>
                <GitBranch className="w-[18px] h-[18px]" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Execution Plan (Coming Soon)</TooltipContent>
          </Tooltip>

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

          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="icon"
                    size="icon"
                    disabled={!query.trim()}
                  >
                    <Save className="w-[18px] h-[18px]" />
                    <ChevronDown className="w-3 h-3 ml-0.5" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>Query Options</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsSaveDialogOpen(true)}>
                <Save className="w-4 h-4 mr-2" />
                Save Query
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsImportDialogOpen(true)}>
                <FileDown className="w-4 h-4 mr-2" />
                Import Query
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="run"
            size="sm"
            colorScheme={type}
            onClick={executeQuery}
            disabled={isLoading}
          >
            <Play className="w-4 h-4" />
            Run
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

      {/* Editor Area */}
      <div className="flex-1 flex min-h-0">
        {/* Schema Browser - collapsible and resizable for both Redshift and SQL Server */}
        {isExplorerOpen && (
          <div
            className="flex-shrink-0 border-r border-outline-variant relative h-[830px]"
            style={{ width: explorerWidth }}
          >
            <SchemaBrowser type={type} onTableSelect={handleTableSelect} />
            {/* Resize handle */}
            <div
              className={cn(
                "absolute top-0 right-0 w-1 h-full cursor-col-resize transition-colors",
                type === "redshift" && "hover:bg-redshift/50",
                type === "sqlserver" && "hover:bg-sqlserver/50",
                isResizing && type === "redshift" && "bg-redshift/50",
                isResizing && type === "sqlserver" && "bg-sqlserver/50"
              )}
              onMouseDown={() => setIsResizing(true)}
            />
          </div>
        )}

        {/* Code Editor and Results */}
        <div className="flex-1 flex flex-col min-h-0">
          <CodeEditor
            value={query}
            onChange={setQuery}
            onKeyDown={handleKeyDown}
            onCursorChange={setCursorPosition}
            isLoading={isLoading}
            colorScheme={type}
            placeholder={`-- Enter your ${config.name} query here...`}
            errorLine={errorLine}
            errorMessage={errorMessage}
          />

          <ResultsPanel result={result} colorScheme={type} errorLine={errorLine} queryText={query} />
        </div>
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-surface-container border-t border-outline-variant text-[11px] text-on-surface-variant">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <Database className="w-3.5 h-3.5" />
            {config.database}
          </span>
          <span className="flex items-center gap-1">
            <TableProperties className="w-3.5 h-3.5" />
            {config.schema}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span>{config.version}</span>
          <span>
            Ln {cursorPosition.line}, Col {cursorPosition.column}
          </span>
        </div>
      </div>

      {/* Save Query Dialog */}
      <SaveQueryDialog
        open={isSaveDialogOpen}
        onOpenChange={setIsSaveDialogOpen}
        queryText={query}
        queryType={type}
        colorScheme={type}
      />

      {/* Import Query Dialog */}
      <ImportQueryDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        onQuerySelect={handleQuerySelect}
        queryType={type}
        colorScheme={type}
      />

      {/* File Upload Dialog */}
      <FileUploadDialog
        open={isUploadDialogOpen}
        onOpenChange={setIsUploadDialogOpen}
        colorScheme={type}
      />
    </div>
  );
}
