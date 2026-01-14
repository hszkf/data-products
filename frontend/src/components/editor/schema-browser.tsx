

import * as React from "react";
import {
  Database,
  Table,
  ChevronRight,
  ChevronDown,
  RefreshCw,
} from "lucide-react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { cn } from "~/lib/utils";
import { getSchemas } from "~/lib/api";
import { useMerge } from "~/components/merge";
import { useToast } from "~/components/ui/toast-provider";
import type { DatabaseType } from "./editor-panel";

// Shared cache key with /sqlv2
const SCHEMA_CACHE_KEY = 'sql-schema-cache';
const SCHEMA_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

interface SchemaCache {
  data: {
    status: string;
    schemas: {
      redshift: Record<string, string[]>;
      sqlserver: Record<string, string[]>;
      "sqlserver-bi-backup": Record<string, string[]>;
    };
  };
  timestamp: number;
}

function getSchemaFromCache(dbType: DatabaseType): Record<string, string[]> | null {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(SCHEMA_CACHE_KEY);
    if (!cached) return null;
    const { data, timestamp }: SchemaCache = JSON.parse(cached);
    if (Date.now() - timestamp > SCHEMA_CACHE_TTL) return null;
    return data.schemas[dbType] || null;
  } catch {
    return null;
  }
}

function saveSchemaToCache(dbType: DatabaseType, schemas: Record<string, string[]>): void {
  if (typeof window === 'undefined') return;
  try {
    let cache: SchemaCache;
    const existing = localStorage.getItem(SCHEMA_CACHE_KEY);
    if (existing) {
      cache = JSON.parse(existing);
      cache.data.schemas[dbType] = schemas;
      cache.timestamp = Date.now();
    } else {
      cache = {
        data: {
          status: 'success',
          schemas: {
            redshift: dbType === 'redshift' ? schemas : {},
            sqlserver: dbType === 'sqlserver' ? schemas : {},
          },
        },
        timestamp: Date.now(),
      };
    }
    localStorage.setItem(SCHEMA_CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.error('[Schema Cache] Error saving:', e);
  }
}

interface SchemaBrowserProps {
  type: DatabaseType;
  onTableSelect?: (tableName: string, database: string, dbType?: DatabaseType) => void;
  refreshKey?: number;
}

interface SchemaData {
  [database: string]: string[];
}

// For SQL Server, we show multiple databases
interface MultiDbSchemaData {
  [dbName: string]: SchemaData;
}

export function SchemaBrowser({ type, onTableSelect, refreshKey = 0 }: SchemaBrowserProps) {
  const [schemas, setSchemas] = React.useState<SchemaData>({});
  const [multiDbSchemas, setMultiDbSchemas] = React.useState<MultiDbSchemaData>({});
  const [expandedDbs, setExpandedDbs] = React.useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const { saveTable } = useMerge();
  const { showToast } = useToast();

  // For SQL Server, we fetch both Staging and BI_Backup
  const isSqlServer = type === "sqlserver" || type === "sqlserver-bi-backup";

  const fetchSchemas = React.useCallback(async (refresh: boolean = false) => {
    setIsLoading(true);
    setError(null);

    if (isSqlServer) {
      // Fetch all SQL Server databases
      try {
        const [stagingResult, biBackupResult, datamartResult] = await Promise.all([
          getSchemas("sqlserver", refresh),
          getSchemas("sqlserver-bi-backup", refresh),
          getSchemas("sqlserver-datamart", refresh),
        ]);

        const multiDb: MultiDbSchemaData = {};

        if (stagingResult.schemas && Object.keys(stagingResult.schemas).length > 0) {
          multiDb["Staging"] = stagingResult.schemas;
        }
        if (biBackupResult.schemas && Object.keys(biBackupResult.schemas).length > 0) {
          multiDb["BI_Backup"] = biBackupResult.schemas;
        }
        if (datamartResult.schemas && Object.keys(datamartResult.schemas).length > 0) {
          multiDb["Datamart"] = datamartResult.schemas;
        }

        // Save SQL Server schemas with database prefix for autocomplete
        // Format: { "Staging.dbo": ["Table1", "Table2"], "BI_Backup.dbo": ["Table3"] }
        const prefixedSchemas: Record<string, string[]> = {};
        for (const [dbName, dbSchemas] of Object.entries(multiDb)) {
          for (const [schemaName, tables] of Object.entries(dbSchemas)) {
            const prefixedKey = `${dbName}.${schemaName}`;
            prefixedSchemas[prefixedKey] = tables;
          }
        }
        if (Object.keys(prefixedSchemas).length > 0) {
          saveSchemaToCache("sqlserver", prefixedSchemas);
        }

        setMultiDbSchemas(multiDb);
        setSchemas({});
        setExpandedDbs(new Set());
      } catch (err) {
        setMultiDbSchemas({});
        setSchemas({});
      } finally {
        setIsLoading(false);
      }
    } else {
      // Redshift - single database
      if (!refresh) {
        const cached = getSchemaFromCache(type);
        if (cached && Object.keys(cached).length > 0) {
          setSchemas(cached);
          setMultiDbSchemas({});
          setExpandedDbs(new Set());
          setIsLoading(false);
          return;
        }
      }

      try {
        const result = await getSchemas(type, refresh);
        const fetchedSchemas = result.schemas || {};
        setSchemas(fetchedSchemas);
        setMultiDbSchemas({});
        setExpandedDbs(new Set());
        if (Object.keys(fetchedSchemas).length > 0) {
          saveSchemaToCache(type, fetchedSchemas);
        }
      } catch (err) {
        setSchemas({});
        setMultiDbSchemas({});
      } finally {
        setIsLoading(false);
      }
    }
  }, [type, isSqlServer]);

  // Fetch on mount and when refreshKey changes
  React.useEffect(() => {
    fetchSchemas(refreshKey > 0);
  }, [fetchSchemas, refreshKey]);

  const toggleDatabase = (db: string) => {
    setExpandedDbs((prev) => {
      const next = new Set(prev);
      if (next.has(db)) {
        next.delete(db);
      } else {
        next.add(db);
      }
      return next;
    });
  };

  const handleTableClick = (tableName: string, schema: string, dbType?: DatabaseType) => {
    if (onTableSelect) {
      onTableSelect(tableName, schema, dbType);
    }
  };

  // Calculate total table count
  const getTotalTableCount = () => {
    if (isSqlServer && Object.keys(multiDbSchemas).length > 0) {
      return Object.values(multiDbSchemas).reduce((total, dbSchemas) => {
        return total + Object.values(dbSchemas).flat().length;
      }, 0);
    }
    return Object.values(schemas).flat().length;
  };

  // Handle file upload from parent via custom event
  const processFile = React.useCallback(async (file: File) => {
    try {
      const fileName = file.name;
      const extension = fileName.split(".").pop()?.toLowerCase();

      let columns: string[] = [];
      let rows: Record<string, unknown>[] = [];

      if (extension === "csv") {
        const result = await new Promise<Papa.ParseResult<Record<string, unknown>>>((resolve, reject) => {
          Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: resolve,
            error: reject,
          });
        });

        if (result.errors.length > 0) {
          showToast(result.errors[0].message, "error");
          return;
        }

        rows = result.data;
        columns = result.meta.fields || [];
      } else if (extension === "xlsx" || extension === "xls") {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

        if (jsonData.length === 0) {
          showToast("Excel file is empty", "error");
          return;
        }

        rows = jsonData;
        columns = Object.keys(jsonData[0]);
      } else {
        showToast("Please upload CSV or Excel files", "error");
        return;
      }

      if (rows.length === 0) {
        showToast("File contains no data", "error");
        return;
      }

      const baseName = fileName.replace(/\.[^/.]+$/, "");
      const sanitizedName = baseName.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();
      const tableName = sanitizedName;

      saveTable(tableName, {
        columns,
        rows,
        source: "uploaded",
        fileName,
      });

      showToast(`Uploaded "${tableName}" (${rows.length} rows)`, "success");
    } catch (err) {
      showToast("Failed to parse file", "error");
    }
  }, [saveTable, showToast]);

  // Listen for file upload events from parent
  React.useEffect(() => {
    const handleFileUpload = (e: CustomEvent<File>) => {
      processFile(e.detail);
    };

    window.addEventListener('explorer-file-upload', handleFileUpload as EventListener);
    return () => {
      window.removeEventListener('explorer-file-upload', handleFileUpload as EventListener);
    };
  }, [processFile]);

  // Render single database schemas (Redshift)
  const renderSingleDbSchemas = () => (
    Object.entries(schemas).map(([schemaName, tables]) => (
      <div key={schemaName}>
        <button
          onClick={() => toggleDatabase(schemaName)}
          className={cn(
            "w-full flex items-center gap-1 px-3 py-1.5",
            "hover:bg-surface-container-high/50 transition-colors",
            "text-left"
          )}
        >
          {expandedDbs.has(schemaName) ? (
            <ChevronDown className="w-3 h-3 text-on-surface-variant flex-shrink-0" />
          ) : (
            <ChevronRight className="w-3 h-3 text-on-surface-variant flex-shrink-0" />
          )}
          <span className="text-xs text-on-surface truncate">{schemaName}</span>
          <span className="text-[10px] text-on-surface-variant ml-auto pr-2">{tables.length}</span>
        </button>

        {expandedDbs.has(schemaName) && (
          <div className="ml-4">
            {tables.map((table) => (
              <button
                key={`${schemaName}.${table}`}
                onClick={() => handleTableClick(table, schemaName)}
                className={cn(
                  "w-full flex items-center gap-1.5 px-3 py-1",
                  "hover:bg-surface-container-high/50 transition-colors",
                  "text-left group"
                )}
              >
                <Table className="w-3 h-3 text-on-surface-variant flex-shrink-0" />
                <span className="text-xs text-on-surface-variant group-hover:text-on-surface truncate">
                  {table}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    ))
  );

  // Render multi-database schemas (SQL Server: Staging + BI_Backup + Datamart)
  const renderMultiDbSchemas = () => (
    Object.entries(multiDbSchemas).map(([dbName, dbSchemas]) => {
      const dbKey = `db-${dbName}`;
      // Map database name to database type for API calls
      const dbTypeMap: Record<string, DatabaseType> = {
        "Staging": "sqlserver",
        "BI_Backup": "sqlserver-bi-backup",
        "Datamart": "sqlserver-datamart",
      };
      const dbType: DatabaseType = dbTypeMap[dbName] || "sqlserver";
      const totalTables = Object.values(dbSchemas).flat().length;

      return (
        <div key={dbName}>
          {/* Database level */}
          <button
            onClick={() => toggleDatabase(dbKey)}
            className={cn(
              "w-full flex items-center gap-1 px-3 py-1.5",
              "hover:bg-surface-container-high/50 transition-colors",
              "text-left"
            )}
          >
            {expandedDbs.has(dbKey) ? (
              <ChevronDown className="w-3 h-3 text-on-surface-variant flex-shrink-0" />
            ) : (
              <ChevronRight className="w-3 h-3 text-on-surface-variant flex-shrink-0" />
            )}
            <Database className="w-3 h-3 text-sqlserver flex-shrink-0" />
            <span className="text-xs text-on-surface font-medium truncate">{dbName}</span>
            <span className="text-[10px] text-on-surface-variant ml-auto pr-2">{totalTables}</span>
          </button>

          {/* Schema level within database */}
          {expandedDbs.has(dbKey) && (
            <div className="ml-3">
              {Object.entries(dbSchemas).map(([schemaName, tables]) => {
                const schemaKey = `${dbName}.${schemaName}`;
                return (
                  <div key={schemaKey}>
                    <button
                      onClick={() => toggleDatabase(schemaKey)}
                      className={cn(
                        "w-full flex items-center gap-1 px-3 py-1",
                        "hover:bg-surface-container-high/50 transition-colors",
                        "text-left"
                      )}
                    >
                      {expandedDbs.has(schemaKey) ? (
                        <ChevronDown className="w-3 h-3 text-on-surface-variant flex-shrink-0" />
                      ) : (
                        <ChevronRight className="w-3 h-3 text-on-surface-variant flex-shrink-0" />
                      )}
                      <span className="text-xs text-on-surface truncate">{schemaName}</span>
                      <span className="text-[10px] text-on-surface-variant ml-auto pr-2">{tables.length}</span>
                    </button>

                    {/* Tables within schema */}
                    {expandedDbs.has(schemaKey) && (
                      <div className="ml-4">
                        {tables.map((table) => (
                          <button
                            key={`${dbName}.${schemaName}.${table}`}
                            onClick={() => handleTableClick(table, schemaName, dbType)}
                            className={cn(
                              "w-full flex items-center gap-1.5 px-3 py-1",
                              "hover:bg-surface-container-high/50 transition-colors",
                              "text-left group"
                            )}
                          >
                            <Table className="w-3 h-3 text-on-surface-variant flex-shrink-0" />
                            <span className="text-xs text-on-surface-variant group-hover:text-on-surface truncate">
                              {table}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    })
  );

  const hasSchemas = isSqlServer
    ? Object.keys(multiDbSchemas).length > 0
    : Object.keys(schemas).length > 0;

  return (
    <div className="flex flex-col h-full bg-transparent overflow-hidden">
      {/* Content - Scrollable area */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* Tables Section Header */}
        <div className="sticky top-0 z-10 flex items-center gap-2 px-3 py-2 border-b border-outline-variant/30 bg-surface-container/95 backdrop-blur-sm">
          <Database className={cn(
            "w-3.5 h-3.5",
            type === "redshift" ? "text-redshift" : "text-sqlserver"
          )} />
          <span className="text-xs font-medium text-on-surface">Tables</span>
          <span className="text-[10px] text-on-surface-variant ml-auto">
            {isLoading ? "..." : getTotalTableCount()}
          </span>
        </div>

        {/* Table list */}
        <div className="pb-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-on-surface-variant">
              <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              <span className="text-xs">Loading schemas...</span>
            </div>
          ) : error ? (
            <div className="px-3 py-2 text-xs text-red-400">{error}</div>
          ) : !hasSchemas ? (
            <div className="px-3 py-2 text-xs text-on-surface-variant">No tables found</div>
          ) : isSqlServer ? (
            renderMultiDbSchemas()
          ) : (
            renderSingleDbSchemas()
          )}
        </div>
      </div>
    </div>
  );
}
