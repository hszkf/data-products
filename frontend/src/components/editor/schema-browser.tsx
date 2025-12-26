

import * as React from "react";
import {
  Database,
  Table,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Search,
  Upload,
  FileSpreadsheet,
} from "lucide-react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { cn } from "~/lib/utils";
import { getSchemas } from "~/lib/api";
import { useMerge } from "~/components/merge";
import { useToast } from "~/components/ui/toast-provider";
import type { DatabaseType } from "./editor-panel";

interface SchemaBrowserProps {
  type: DatabaseType;
  onTableSelect?: (tableName: string, database: string) => void;
}

interface SchemaData {
  [database: string]: string[];
}

export function SchemaBrowser({ type, onTableSelect }: SchemaBrowserProps) {
  const [schemas, setSchemas] = React.useState<SchemaData>({});
  const [expandedDbs, setExpandedDbs] = React.useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [isUploading, setIsUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { saveTable } = useMerge();
  const { showToast } = useToast();

  const fetchSchemas = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getSchemas(type);
      if (result.status === "success" && result.schemas) {
        setSchemas(result.schemas);
        setExpandedDbs(new Set());
      } else {
        setError(result.detail || "Failed to fetch schemas");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch schemas");
    } finally {
      setIsLoading(false);
    }
  }, [type]);

  React.useEffect(() => {
    fetchSchemas();
  }, [fetchSchemas]);

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

  const handleTableClick = (tableName: string, database: string) => {
    if (onTableSelect) {
      onTableSelect(tableName, database);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
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
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const filteredSchemas = React.useMemo(() => {
    if (!searchTerm) return schemas;

    const filtered: SchemaData = {};
    const term = searchTerm.toLowerCase();

    Object.entries(schemas).forEach(([db, tables]) => {
      const matchingTables = tables.filter((table) =>
        table.toLowerCase().includes(term)
      );
      if (matchingTables.length > 0 || db.toLowerCase().includes(term)) {
        filtered[db] = matchingTables.length > 0 ? matchingTables : tables;
      }
    });

    return filtered;
  }, [schemas, searchTerm]);

  return (
    <div className="flex flex-col h-full bg-surface-container overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-outline-variant">
        <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
          Explorer
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleUploadClick}
            disabled={isUploading}
            className={cn(
              "p-1 rounded transition-colors",
              "text-green-400 hover:bg-green-400/20",
              isUploading && "opacity-50"
            )}
            title="Upload CSV/Excel"
          >
            <Upload className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={fetchSchemas}
            disabled={isLoading}
            className={cn(
              "p-1 rounded hover:bg-surface-container-high transition-colors",
              "text-on-surface-variant hover:text-on-surface",
              isLoading && "animate-spin"
            )}
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* Search */}
      <div className="px-2 py-2 border-b border-outline-variant">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-outline" />
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={cn(
              "w-full pl-7 pr-2 py-1.5 text-xs",
              "bg-surface rounded border border-outline-variant",
              "text-on-surface placeholder:text-outline",
              "focus:outline-none",
              type === "redshift" ? "focus:border-redshift" : "focus:border-sqlserver"
            )}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {/* Tables Section */}
        <div>
          <div className="flex items-center gap-2 px-3 py-2 border-b border-outline-variant">
            <Database className={cn(
              "w-3.5 h-3.5",
              type === "redshift" ? "text-redshift" : "text-sqlserver"
            )} />
            <span className="text-xs font-medium text-on-surface">Tables</span>
            <span className="text-[10px] text-on-surface-variant ml-auto">
              {Object.values(schemas).flat().length}
            </span>
          </div>

          <div className="pb-2">
              {/* Database Schemas */}
              {isLoading ? (
                <div className="flex items-center justify-center py-4 text-on-surface-variant">
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                  <span className="text-xs">Loading...</span>
                </div>
              ) : error ? (
                <div className="px-3 py-2 text-xs text-red-400">{error}</div>
              ) : Object.keys(filteredSchemas).length === 0 ? (
                <div className="px-3 py-2 text-xs text-on-surface-variant">No tables found</div>
              ) : (
                Object.entries(filteredSchemas).map(([database, tables]) => (
                  <div key={database}>
                    <button
                      onClick={() => toggleDatabase(database)}
                      className={cn(
                        "w-full flex items-center gap-1 px-3 py-1 ml-2",
                        "hover:bg-surface-container-high transition-colors",
                        "text-left"
                      )}
                    >
                      {expandedDbs.has(database) ? (
                        <ChevronDown className="w-3 h-3 text-on-surface-variant flex-shrink-0" />
                      ) : (
                        <ChevronRight className="w-3 h-3 text-on-surface-variant flex-shrink-0" />
                      )}
                      <span className="text-xs text-on-surface truncate">{database}</span>
                      <span className="text-[10px] text-on-surface-variant ml-auto">{tables.length}</span>
                    </button>

                    {expandedDbs.has(database) && (
                      <div className="ml-6">
                        {tables.map((table) => (
                          <button
                            key={`${database}.${table}`}
                            onClick={() => handleTableClick(table, database)}
                            className={cn(
                              "w-full flex items-center gap-1.5 px-2 py-1",
                              "hover:bg-surface-container-high transition-colors",
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
              )}
            </div>
        </div>
      </div>
    </div>
  );
}
