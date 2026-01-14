

import * as React from "react";
import { Play, Square, Wand2, GitBranch, Database, TableProperties, PanelLeftClose, PanelLeft, Save, ChevronDown, FileDown, Upload, MoreVertical, RefreshCw, Trash2, History, CheckCircle, XCircle, Clock } from "lucide-react";
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
import { EditorTabs, type EditorTab } from "./editor-tabs";
import { useToast } from "~/components/ui/toast-provider";
import { SaveQueryDialog } from "~/components/ui/save-query-dialog";
import { ImportQueryDialog } from "~/components/ui/import-query-dialog";
import { FileUploadDialog } from "~/components/ui/file-upload-dialog";
import { useMerge } from "~/components/merge";
import { cn } from "~/lib/utils";
import { executeQuery as apiExecuteQuery, checkHealth, clearSchemaCache, getSchemas } from "~/lib/api";
import { LocalSavedQuery } from "~/lib/saved-queries";
import { executeMergeQuery, MergeResult } from "~/lib/merge-sql";
import { parseErrorLocation } from "~/lib/error-parser";
import { getRedshiftTableName, getSqlServerTableName } from "~/lib/table-naming";
import { useQueryExecution } from "~/lib/query-execution-context";
import {
  getHistory,
  addToHistory,
  clearHistory,
  formatHistoryTimestamp,
  type QueryHistoryEntry,
} from "~/lib/query-history";
import { formatSql } from "~/lib/sql-formatter";

export type DatabaseType = "redshift" | "sqlserver" | "sqlserver-bi-backup";

// Default queries for each database type
const defaultQueries: Record<DatabaseType, string> = {
  redshift: `SELECT
    *
FROM
    redshift_customers.public_customers
LIMIT 10`,
  sqlserver: `SELECT * FROM [Staging].[dbo].[Def_CCRIS_Entity_Type_Code]`,
  "sqlserver-bi-backup": `SELECT TOP 10 * FROM [BI_Backup].[dbo].[your_table]`,
};

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
    schema: "public",
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
  "sqlserver-bi-backup": {
    name: "SQL Server BI_Backup",
    connection: "10.200.224.42",
    database: "BI_Backup",
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
          stroke="#16a34a"
          strokeWidth="2"
        />
        <path d="M3 9H21" stroke="#16a34a" strokeWidth="2" />
        <path d="M9 9V21" stroke="#16a34a" strokeWidth="2" />
        <circle cx="6" cy="6" r="1" fill="#16a34a" />
      </svg>
    ),
  },
};


// Extended tab state to include results and errors
interface TabState extends EditorTab {
  result: QueryResult | null;
  errorLine: number | null;
  errorMessage: string | null;
  cursorPosition: { line: number; column: number };
}

// Generate unique tab ID
const generateTabId = () => `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Format execution time to mins and secs
function formatExecutionTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds.toFixed(2)}s`;
  }
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(1);
  return `${mins}m ${secs}s`;
}

// LocalStorage keys
const getStorageKey = (dbType: DatabaseType) => `sql-editor-tabs-${dbType}`;
const getActiveTabKey = (dbType: DatabaseType) => `sql-editor-active-tab-${dbType}`;
const getConnectionCacheKey = (dbType: DatabaseType) => `sql-connection-status-${dbType}`;
const getEditorHeightKey = (dbType: DatabaseType) => `sql-editor-height-${dbType}`;

// Connection cache TTL (5 minutes)
const CONNECTION_CACHE_TTL = 5 * 60 * 1000;

interface ConnectionCache {
  connected: boolean;
  timestamp: number;
}

function getCachedConnectionStatus(dbType: DatabaseType): boolean | null {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(getConnectionCacheKey(dbType));
    if (!cached) return null;
    const { connected, timestamp }: ConnectionCache = JSON.parse(cached);
    if (Date.now() - timestamp < CONNECTION_CACHE_TTL) {
      return connected;
    }
    return null; // Cache expired
  } catch {
    return null;
  }
}

function setCachedConnectionStatus(dbType: DatabaseType, connected: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    const cache: ConnectionCache = { connected, timestamp: Date.now() };
    localStorage.setItem(getConnectionCacheKey(dbType), JSON.stringify(cache));
  } catch {
    // Ignore storage errors
  }
}

// Persistent tab data (what we save to localStorage)
interface PersistedTab {
  id: string;
  name: string;
  query: string;
}

// SQL Server database options
const sqlServerDatabases = [
  { id: "sqlserver", name: "Staging", database: "Staging" },
  { id: "sqlserver-bi-backup", name: "BI_Backup", database: "BI_Backup" },
] as const;

export function EditorPanel({ type, defaultQuery = "" }: EditorPanelProps) {
  const baseConfig = databaseConfig[type];
  const { showToast } = useToast();
  const { tables, saveTable } = useMerge();
  const queryExecution = useQueryExecution();
  const panelRef = React.useRef<HTMLDivElement>(null);

  // For SQL Server, allow switching between databases
  const [selectedSqlServerDb, setSelectedSqlServerDb] = React.useState<"sqlserver" | "sqlserver-bi-backup">("sqlserver");

  // Get effective database type (for API calls)
  const effectiveDbType: DatabaseType = type === "sqlserver" ? selectedSqlServerDb : type;

  // Get effective config based on selected database
  const config = type === "sqlserver" ? databaseConfig[selectedSqlServerDb] : baseConfig;

  // Get the effective default query (prop or built-in default)
  const effectiveDefaultQuery = defaultQuery || defaultQueries[effectiveDbType];

  // Initialize tabs from localStorage or create default
  const [tabs, setTabs] = React.useState<TabState[]>(() => {
    try {
      const saved = localStorage.getItem(getStorageKey(type));
      if (saved) {
        const parsed: PersistedTab[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((t) => ({
            id: t.id,
            name: t.name,
            // Use default query if saved query is empty
            query: t.query || defaultQueries[type],
            isDirty: false,
            result: null,
            errorLine: null,
            errorMessage: null,
            cursorPosition: { line: 1, column: 1 },
          }));
        }
      }
    } catch {
      // Ignore parse errors
    }
    // Default tab
    return [{
      id: generateTabId(),
      name: "Query 1",
      query: effectiveDefaultQuery,
      isDirty: false,
      result: null,
      errorLine: null,
      errorMessage: null,
      cursorPosition: { line: 1, column: 1 },
    }];
  });

  // Initialize active tab from localStorage
  const [activeTabId, setActiveTabId] = React.useState<string>(() => {
    try {
      const saved = localStorage.getItem(getActiveTabKey(type));
      if (saved && tabs.some((t) => t.id === saved)) {
        return saved;
      }
    } catch {
      // Ignore
    }
    return tabs[0]?.id || "";
  });

  // Persist tabs to localStorage whenever they change
  React.useEffect(() => {
    const toSave: PersistedTab[] = tabs.map((t) => ({
      id: t.id,
      name: t.name,
      query: t.query,
    }));
    localStorage.setItem(getStorageKey(type), JSON.stringify(toSave));
  }, [tabs, type]);

  // Persist active tab ID
  React.useEffect(() => {
    localStorage.setItem(getActiveTabKey(type), activeTabId);
  }, [activeTabId, type]);

  // Get current active tab
  const activeTab = React.useMemo(
    () => tabs.find((t) => t.id === activeTabId) || tabs[0],
    [tabs, activeTabId]
  );

  // Convenience getters for active tab state
  const query = activeTab?.query || "";
  const result = activeTab?.result || null;
  const errorLine = activeTab?.errorLine || null;
  const errorMessage = activeTab?.errorMessage || null;
  const cursorPosition = activeTab?.cursorPosition || { line: 1, column: 1 };

  // Check if query is running from the global context
  const isLoading = queryExecution.isRunning(effectiveDbType, activeTabId);
  const [isConnected, setIsConnected] = React.useState<boolean | null>(null);
  const [isExplorerOpen, setIsExplorerOpen] = React.useState(false);
  const [explorerWidth, setExplorerWidth] = React.useState(260);
  const [isResizing, setIsResizing] = React.useState(false);
  const [resizeType, setResizeType] = React.useState<"sidebar" | "editor" | null>(null);

  // Editor height state with localStorage persistence
  const [editorHeight, setEditorHeight] = React.useState<number>(() => {
    try {
      const saved = localStorage.getItem(getEditorHeightKey(type));
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 100 && parsed <= 800) {
          return parsed;
        }
      }
    } catch {
      // Ignore
    }
    return 250; // Default editor height
  });

  // Persist editor height to localStorage
  React.useEffect(() => {
    try {
      localStorage.setItem(getEditorHeightKey(type), String(editorHeight));
    } catch {
      // Ignore storage errors
    }
  }, [editorHeight, type]);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = React.useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = React.useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = React.useState(false);
  const [schemaRefreshKey, setSchemaRefreshKey] = React.useState(0);
  const [isClearingCache, setIsClearingCache] = React.useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = React.useState(false);
  const [queryHistory, setQueryHistory] = React.useState<QueryHistoryEntry[]>([]);
  const explorerFileInputRef = React.useRef<HTMLInputElement>(null);

  // Load query history when history dropdown opens
  React.useEffect(() => {
    if (isHistoryOpen) {
      setQueryHistory(getHistory(type));
    }
  }, [isHistoryOpen, type]);

  // Tab management handlers
  const updateActiveTab = React.useCallback((updates: Partial<TabState>) => {
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === activeTabId ? { ...tab, ...updates } : tab
      )
    );
  }, [activeTabId]);

  const setQuery = React.useCallback((newQuery: string | ((prev: string) => string)) => {
    setTabs((prev) =>
      prev.map((tab) => {
        if (tab.id !== activeTabId) return tab;
        const updatedQuery = typeof newQuery === "function" ? newQuery(tab.query) : newQuery;
        return {
          ...tab,
          query: updatedQuery,
          isDirty: updatedQuery !== effectiveDefaultQuery,
        };
      })
    );
  }, [activeTabId, effectiveDefaultQuery]);

  const setResult = React.useCallback((newResult: QueryResult | null) => {
    updateActiveTab({ result: newResult });
  }, [updateActiveTab]);

  const setErrorLine = React.useCallback((line: number | null) => {
    updateActiveTab({ errorLine: line });
  }, [updateActiveTab]);

  const setErrorMessage = React.useCallback((message: string | null) => {
    updateActiveTab({ errorMessage: message });
  }, [updateActiveTab]);

  const setCursorPosition = React.useCallback((pos: { line: number; column: number }) => {
    updateActiveTab({ cursorPosition: pos });
  }, [updateActiveTab]);

  const handleNewTab = React.useCallback(() => {
    const tabNumber = tabs.length + 1;
    const newTab: TabState = {
      id: generateTabId(),
      name: `Query ${tabNumber}`,
      query: defaultQueries[type],
      isDirty: false,
      result: null,
      errorLine: null,
      errorMessage: null,
      cursorPosition: { line: 1, column: 1 },
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
  }, [tabs.length, type]);

  const handleTabClose = React.useCallback((tabId: string) => {
    setTabs((prev) => {
      if (prev.length <= 1) return prev; // Don't close last tab
      const filtered = prev.filter((t) => t.id !== tabId);
      // If closing active tab, switch to adjacent tab
      if (tabId === activeTabId) {
        const closedIndex = prev.findIndex((t) => t.id === tabId);
        const newActiveIndex = Math.min(closedIndex, filtered.length - 1);
        setActiveTabId(filtered[newActiveIndex]?.id || "");
      }
      return filtered;
    });
  }, [activeTabId]);

  const handleTabRename = React.useCallback((tabId: string, newName: string) => {
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === tabId ? { ...tab, name: newName } : tab
      )
    );
  }, []);

  // Restore execution state when component mounts or active tab changes
  React.useEffect(() => {
    const execution = queryExecution.getExecution(effectiveDbType, activeTabId);
    if (execution) {
      // Restore result if query completed while we were away
      if (execution.result && !execution.isRunning) {
        updateActiveTab({ result: execution.result });
      }
      // Restore error if query failed
      if (execution.error && !execution.isRunning) {
        const errorLocation = parseErrorLocation(execution.error);
        if (errorLocation) {
          updateActiveTab({
            errorLine: errorLocation.line,
            errorMessage: execution.error,
          });
        }
      }
    }
  }, [effectiveDbType, activeTabId, queryExecution, updateActiveTab]);

  // Check connection status on mount - use cache first, then refresh in background
  React.useEffect(() => {
    let mounted = true;

    // Check cache first for instant UI
    const cachedStatus = getCachedConnectionStatus(effectiveDbType);
    if (cachedStatus !== null) {
      setIsConnected(cachedStatus);
    }

    const checkConnectionStatus = async () => {
      try {
        const health = await checkHealth(effectiveDbType);
        if (!mounted) return;
        const isHealthy = health.status === "connected" && health.connected === true;
        setIsConnected(isHealthy);
        setCachedConnectionStatus(effectiveDbType, isHealthy);
      } catch (error) {
        if (!mounted) return;
        setIsConnected(false);
        setCachedConnectionStatus(effectiveDbType, false);
      }
    };

    // Only check if no cache or cache is stale
    if (cachedStatus === null) {
      checkConnectionStatus();
    } else {
      // Refresh in background after a short delay
      const timer = setTimeout(checkConnectionStatus, 2000);
      return () => {
        mounted = false;
        clearTimeout(timer);
      };
    }

    return () => {
      mounted = false;
    };
  }, [effectiveDbType]);

  // Ref to track editor container for resize calculations
  const editorContainerRef = React.useRef<HTMLDivElement>(null);

  // Handle resize (both sidebar and editor)
  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !panelRef.current) return;

      if (resizeType === "sidebar") {
        // Calculate width relative to panel's left edge
        const panelRect = panelRef.current.getBoundingClientRect();
        const newWidth = e.clientX - panelRect.left;
        // Constrain width between 150px and 400px
        setExplorerWidth(Math.min(400, Math.max(150, newWidth)));
      } else if (resizeType === "editor" && editorContainerRef.current) {
        // Calculate height relative to the editor container's top
        const containerRect = editorContainerRef.current.getBoundingClientRect();
        const newHeight = e.clientY - containerRect.top;
        // Constrain height between 100px and 800px
        setEditorHeight(Math.min(800, Math.max(100, newHeight)));
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      setResizeType(null);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = resizeType === "sidebar" ? "col-resize" : "row-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, resizeType]);

  // Stop running query
  const stopQuery = React.useCallback(() => {
    queryExecution.stopExecution(effectiveDbType, activeTabId);
    showToast("Query cancelled", "info");
  }, [queryExecution, effectiveDbType, activeTabId, showToast]);

  const executeQuery = React.useCallback(async () => {
    if (!query.trim()) {
      showToast("Please enter a query", "error");
      return;
    }

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
            `Query executed successfully (${mergeResult.rowCount} rows in ${formatExecutionTime(mergeResult.executionTime)})` :
            undefined,
        });

        if (mergeResult.status === "success") {
          // Save to history
          addToHistory(type, query, true, mergeResult.executionTime, mergeResult.rowCount);
          showToast(
            `Query executed successfully (${mergeResult.rowCount} rows in ${formatExecutionTime(mergeResult.executionTime)})`,
            "success"
          );
        } else {
          // Save failed query to history
          addToHistory(type, query, false);
          showToast(mergeResult.error || "Query execution failed", "error");
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Query execution failed";
        // Save failed query to history
        addToHistory(type, query, false);
        showToast(errorMsg, "error");

        setResult({
          columns: [],
          rows: [],
          executionTime: 0,
          error: errorMsg,
        });
      }
    } else {
      // Normal database query execution - use global context for persistence
      try {
        const queryResponse = await queryExecution.startExecution(effectiveDbType, activeTabId, query);

        // Create the result object
        const queryResult: QueryResult = {
          columns: queryResponse.columns || [],
          rows: queryResponse.rows || [],
          executionTime: queryResponse.executionTime || 0,
          message: queryResponse.message,
        };

        // Set the result immediately to display in the results panel
        setResult(queryResult);

        // Auto-save results to merge context for cross-database queries
        // Only save if it looks like a table query (not a random SQL statement)
        // For SQL Server, allow sys. queries if they return actual data
        if (queryResponse.columns.length > 0 && queryResponse.rows.length > 0 &&
            (query.toLowerCase().includes('select') || query.toLowerCase().includes('from'))) {

          // Database-specific filtering
          const isSystemQuery =
            (effectiveDbType === 'redshift' && (
              query.toLowerCase().includes('information_schema') ||
              query.toLowerCase().includes('pg_')
            )) ||
            (effectiveDbType.startsWith('sqlserver') && (
              query.toLowerCase().includes('information_schema')
            ));

          if (isSystemQuery) {
            // Don't save system metadata queries to merge context, but save to history
            addToHistory(effectiveDbType, query, true, queryResponse.executionTime, queryResponse.rows.length);
            showToast(
              `Query executed successfully (${queryResponse.rows.length} rows in ${formatExecutionTime(queryResponse.executionTime)})`,
              "success"
            );
            return;
          }

          // Generate table name with query number (e.g., rsq1_42, ssq2_87)
          const tableName = effectiveDbType === 'redshift' ? getRedshiftTableName(activeTab?.name) : getSqlServerTableName(activeTab?.name);

          // Debug: log what's being saved
          console.log(`[${effectiveDbType}] Saving ${queryResponse.rows.length} rows to table ${tableName}`);
          console.log('Columns:', queryResponse.columns);

          saveTable(tableName, {
            columns: queryResponse.columns,
            rows: queryResponse.rows,
            source: effectiveDbType,
          });

          // Save to history
          addToHistory(effectiveDbType, query, true, queryResponse.executionTime, queryResponse.rows.length);

          // Show toast with the table name
          showToast(
            `Query executed successfully! Results saved as table [${tableName}]`,
            "success"
          );
        } else {
          // Save to history (query with no results or non-SELECT)
          addToHistory(effectiveDbType, query, true, queryResponse.executionTime, queryResponse.rows.length);
          showToast(
            `Query executed successfully (${queryResponse.rows.length} rows in ${formatExecutionTime(queryResponse.executionTime)})`,
            "success"
          );
        }
      } catch (error) {
        // Check if query was aborted
        if (error instanceof Error && error.name === 'AbortError') {
          // Query was cancelled - don't show error or save to history
          return;
        }

        const errorMsg =
          error instanceof Error ? error.message : "Query execution failed";

        // Save failed query to history
        addToHistory(effectiveDbType, query, false);

        showToast(errorMsg, "error");

        // Check if error is a connection/authentication error and update status
        const isConnectionError =
          errorMsg.toLowerCase().includes('security token') ||
          errorMsg.toLowerCase().includes('expired') ||
          errorMsg.toLowerCase().includes('credential') ||
          errorMsg.toLowerCase().includes('authentication') ||
          errorMsg.toLowerCase().includes('connection') ||
          errorMsg.toLowerCase().includes('not connected') ||
          errorMsg.toLowerCase().includes('disconnected');

        if (isConnectionError) {
          setIsConnected(false);
          setCachedConnectionStatus(effectiveDbType, false);
        }

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
      }
    }
  }, [effectiveDbType, activeTabId, query, tables, queryExecution, showToast, saveTable, activeTab?.name, setResult, setErrorLine, setErrorMessage]);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        executeQuery();
      }
    },
    [executeQuery]
  );

  // Explorer menu handlers
  const handleRefreshSchema = React.useCallback(() => {
    setSchemaRefreshKey(prev => prev + 1);
  }, []);

  const handleClearSchemaCache = React.useCallback(async () => {
    setIsClearingCache(true);
    try {
      await clearSchemaCache(effectiveDbType);
      showToast("Cache cleared", "success");
      setSchemaRefreshKey(prev => prev + 1);
    } catch (err) {
      showToast("Failed to clear cache", "error");
    } finally {
      setIsClearingCache(false);
    }
  }, [effectiveDbType, showToast]);

  const handleExplorerUpload = React.useCallback(() => {
    explorerFileInputRef.current?.click();
  }, []);

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
    (savedQuery: LocalSavedQuery) => {
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
          "flex items-center justify-between px-2 py-1.5 flex-shrink-0",
          "border-b border-outline-variant",
          type === "redshift" && "bg-redshift-tint",
          type === "sqlserver" && "bg-sqlserver-tint"
        )}
      >
        <div className="flex items-center gap-1.5">
          <div
            className={cn(
              "w-6 h-6 rounded-md flex items-center justify-center relative overflow-hidden",
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
            <div className="relative z-10 scale-[0.85]">{config.icon}</div>
          </div>
          <div>
            <div className="flex items-center gap-1">
              <h2 className="text-xs font-semibold text-on-surface leading-tight">
                {type === "sqlserver" ? "SQL Server" : config.name}
              </h2>
              {/* Database selector for SQL Server */}
              {type === "sqlserver" && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 px-1.5 text-[10px] font-medium bg-sqlserver/10 hover:bg-sqlserver/20 text-sqlserver rounded"
                    >
                      {sqlServerDatabases.find(db => db.id === selectedSqlServerDb)?.database || "Staging"}
                      <ChevronDown className="w-3 h-3 ml-0.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-[120px]">
                    {sqlServerDatabases.map((db) => (
                      <DropdownMenuItem
                        key={db.id}
                        onClick={() => setSelectedSqlServerDb(db.id)}
                        className={cn(
                          "text-xs",
                          selectedSqlServerDb === db.id && "bg-sqlserver/10 text-sqlserver"
                        )}
                      >
                        {db.database}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            <span className="text-[10px] text-on-surface-variant flex items-center gap-1">
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
          {/* Tool buttons group */}
          <div className={cn(
            "flex items-center gap-0.5 px-1 py-0.5 rounded-md",
            "bg-surface-container/50 border border-outline-variant/30"
          )}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-7 w-7 p-0 rounded-md transition-all duration-150",
                    "hover:bg-[var(--panel-tint)] hover:text-[var(--panel-primary)]",
                    isExplorerOpen && "bg-[var(--panel-tint)] text-[var(--panel-primary)]"
                  )}
                  onClick={() => setIsExplorerOpen(!isExplorerOpen)}
                >
                  {isExplorerOpen ? (
                    <PanelLeftClose className="w-4 h-4" />
                  ) : (
                    <PanelLeft className="w-4 h-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isExplorerOpen ? "Hide Explorer" : "Show Explorer"}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-7 w-7 p-0 rounded-md transition-all duration-150",
                    "hover:bg-[var(--panel-tint)] hover:text-[var(--panel-primary)]",
                    !query.trim() && "opacity-40 cursor-not-allowed"
                  )}
                  disabled={!query.trim()}
                  onClick={() => {
                    if (query.trim()) {
                      const formatted = formatSql(query, type);
                      setQuery(formatted);
                      showToast("SQL formatted", "success");
                    }
                  }}
                >
                  <Wand2 className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Format SQL</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 rounded-md opacity-40 cursor-not-allowed"
                  disabled
                >
                  <GitBranch className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Execution Plan (Coming Soon)</TooltipContent>
            </Tooltip>

            <div className="w-px h-4 bg-outline-variant/50 mx-0.5" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 rounded-md transition-all duration-150 hover:bg-[var(--panel-tint)] hover:text-[var(--panel-primary)]"
                  onClick={() => setIsUploadDialogOpen(true)}
                >
                  <Upload className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Upload Files to S3</TooltipContent>
            </Tooltip>

            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-7 px-1.5 rounded-md transition-all duration-150",
                        "hover:bg-[var(--panel-tint)] hover:text-[var(--panel-primary)]"
                      )}
                    >
                      <Save className="w-4 h-4" />
                      <ChevronDown className="w-3 h-3 ml-0.5 opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>Query Options</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => setIsSaveDialogOpen(true)}
                  disabled={!query.trim()}
                  className={!query.trim() ? "opacity-50 cursor-not-allowed" : ""}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Query
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsImportDialogOpen(true)}>
                  <FileDown className="w-4 h-4 mr-2" />
                  Import Query
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* History Dropdown */}
            <DropdownMenu open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-7 w-7 p-0 rounded-md transition-all duration-150",
                        "hover:bg-[var(--panel-tint)] hover:text-[var(--panel-primary)]",
                        isHistoryOpen && "bg-[var(--panel-tint)] text-[var(--panel-primary)]"
                      )}
                    >
                      <History className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>Query History</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-auto">
                <div className="flex items-center justify-between px-2 py-1.5 border-b border-outline-variant">
                  <span className="text-xs font-semibold text-on-surface">Recent Queries</span>
                  {queryHistory.length > 0 && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        clearHistory(type);
                        setQueryHistory([]);
                      }}
                      className="text-[10px] text-on-surface-variant hover:text-red-400 transition-colors"
                    >
                      Clear All
                    </button>
                  )}
                </div>
                {queryHistory.length === 0 ? (
                  <div className="px-3 py-6 text-center text-on-surface-variant">
                    <History className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-xs">No query history yet</p>
                    <p className="text-[10px] opacity-70">Execute queries to build history</p>
                  </div>
                ) : (
                  queryHistory.map((entry) => (
                    <DropdownMenuItem
                      key={entry.id}
                      onClick={() => {
                        setQuery(entry.query);
                        setIsHistoryOpen(false);
                      }}
                      className="flex flex-col items-start gap-1 py-2 cursor-pointer"
                    >
                      <div className="flex items-center gap-2 w-full">
                        {entry.success ? (
                          <CheckCircle className="w-3 h-3 text-green-400 flex-shrink-0" />
                        ) : (
                          <XCircle className="w-3 h-3 text-red-400 flex-shrink-0" />
                        )}
                        <code className="text-[11px] font-mono text-on-surface truncate flex-1">
                          {entry.query.length > 60 ? entry.query.slice(0, 60) + "..." : entry.query}
                        </code>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-on-surface-variant pl-5">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatHistoryTimestamp(entry.timestamp)}
                        </span>
                        {entry.executionTime !== undefined && (
                          <span>{entry.executionTime.toFixed(2)}s</span>
                        )}
                        {entry.rowCount !== undefined && (
                          <span>{entry.rowCount} rows</span>
                        )}
                      </div>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Run/Stop button - prominent */}
          {isLoading ? (
            <Button
              variant="run"
              size="sm"
              className={cn(
                "h-7 px-3 text-xs font-medium gap-1.5 rounded-md",
                "shadow-sm transition-all duration-150",
                "bg-red-500 hover:bg-red-600",
                "hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
              )}
              onClick={stopQuery}
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Stop</span>
            </Button>
          ) : (
            <Button
              variant="run"
              size="sm"
              className={cn(
                "h-7 px-3 text-xs font-medium gap-1.5 rounded-md",
                "shadow-sm transition-all duration-150",
                "hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
              )}
              colorScheme={type}
              onClick={executeQuery}
            >
              <Play className="w-3.5 h-3.5" />
              <span>Run</span>
              <kbd className={cn(
                "hidden sm:inline-flex items-center gap-0.5 ml-1",
                "px-1 py-0.5 rounded text-[10px] font-mono",
                "bg-white/15 text-white/80"
              )}>
                ⌘↵
              </kbd>
            </Button>
          )}
        </div>
      </div>

      {/* Editor Tabs */}
      <EditorTabs
        tabs={tabs}
        activeTabId={activeTabId}
        onTabSelect={setActiveTabId}
        onTabClose={handleTabClose}
        onNewTab={handleNewTab}
        onTabRename={handleTabRename}
        colorScheme={type}
      />

      {/* Main Content Area - relative for absolute sidebar positioning */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* Sidebar - Absolutely positioned to not affect layout */}
        {isExplorerOpen && (
          <div
            className={cn(
              "absolute left-0 top-0 bottom-0 z-10 flex",
              "bg-gradient-to-b from-surface-container to-surface-container/95",
              "backdrop-blur-md overflow-hidden"
            )}
            style={{ width: explorerWidth }}
          >
            {/* Sidebar content */}
            <div className="flex-1 flex flex-col overflow-hidden border-r border-outline-variant/50">
            {/* Sidebar Header */}
            <div className={cn(
              "flex-shrink-0 flex items-center justify-between px-3 py-2.5 border-b border-outline-variant/30",
              "bg-gradient-to-r",
              type === "redshift" && "from-redshift/5 to-transparent",
              type === "sqlserver" && "from-sqlserver/5 to-transparent"
            )}>
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0",
                  "bg-gradient-to-br shadow-inner",
                  type === "redshift" && "from-redshift/20 to-redshift/5 text-redshift",
                  type === "sqlserver" && "from-sqlserver/20 to-sqlserver/5 text-sqlserver"
                )}>
                  <Database className="w-4 h-4" />
                </div>
                <span className="text-[11px] font-semibold text-on-surface tracking-wide uppercase">
                  Explorer
                </span>
              </div>

              {/* 3-dot menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className={cn(
                      "p-1.5 rounded-md transition-colors",
                      "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
                    )}
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={handleExplorerUpload}>
                    <Upload className="w-4 h-4 mr-2 text-green-400" />
                    Upload CSV/Excel
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleRefreshSchema}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh Schema
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleClearSchemaCache} disabled={isClearingCache}>
                    <Trash2 className="w-4 h-4 mr-2 text-amber-400" />
                    Clear Cache
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Hidden file input for explorer upload */}
              <input
                ref={explorerFileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => {
                  // Trigger the schema browser's file handler via a custom event
                  const file = e.target.files?.[0];
                  if (file) {
                    window.dispatchEvent(new CustomEvent('explorer-file-upload', { detail: file }));
                  }
                  e.target.value = '';
                }}
                className="hidden"
              />
            </div>

            {/* SchemaBrowser - takes remaining space, scrolls internally */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <SchemaBrowser type={effectiveDbType} onTableSelect={handleTableSelect} refreshKey={schemaRefreshKey} />
            </div>
            </div>

            {/* Resize handle */}
            <div
              className={cn(
                "w-1 cursor-col-resize flex-shrink-0 transition-colors",
                "hover:bg-primary/30",
                isResizing && resizeType === "sidebar" && "bg-primary/50"
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                setIsResizing(true);
                setResizeType("sidebar");
              }}
            />
          </div>
        )}

        {/* Editor & Results - adds left margin when sidebar is open */}
        <div
          ref={editorContainerRef}
          className="flex-1 flex flex-col min-h-0 min-w-0 transition-[margin] duration-200"
          style={{ marginLeft: isExplorerOpen ? explorerWidth : 0 }}
        >
          {/* Code Editor with fixed height */}
          <div className="flex flex-col" style={{ height: editorHeight, flexShrink: 0 }}>
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
          </div>

          {/* Resize handle between editor and results */}
          <div
            className={cn(
              "h-1.5 cursor-row-resize flex-shrink-0 transition-colors relative group",
              "hover:bg-primary/20",
              isResizing && resizeType === "editor" && "bg-primary/40"
            )}
            onMouseDown={(e) => {
              e.preventDefault();
              setIsResizing(true);
              setResizeType("editor");
            }}
          >
            {/* Visual indicator */}
            <div className={cn(
              "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
              "w-8 h-1 rounded-full bg-outline-variant/50",
              "group-hover:bg-primary/50 transition-colors",
              isResizing && resizeType === "editor" && "bg-primary/70"
            )} />
          </div>

          {/* Results Panel - takes remaining space */}
          <ResultsPanel result={result} colorScheme={type} errorLine={errorLine} queryText={query} />
        </div>
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-3 py-1 bg-surface-container border-t border-outline-variant text-[11px] text-on-surface-variant">
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
