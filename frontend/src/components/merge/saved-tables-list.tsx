

import * as React from "react";
import { Database, Table, Trash2, FileSpreadsheet, Upload, RotateCcw } from "lucide-react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { cn } from "~/lib/utils";
import { useMerge } from "./merge-context";
import { useToast } from "~/components/ui/toast-provider";

export function SavedTablesList() {
  const { tables, removeTable, saveTable, clearTables } = useMerge();
  const { showToast } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = React.useState(false);

  const handleClearAll = React.useCallback(() => {
    clearTables();
    showToast("All tables cleared", "info");
  }, [clearTables, showToast]);

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

      // Save with "uploaded" as source for file uploads
      saveTable(tableName, {
        columns,
        rows,
        source: "uploaded",
        fileName,
      });

      showToast(`Uploaded "${tableName}" (${rows.length} rows)`, "success");
    } catch {
      showToast("Failed to parse file", "error");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const tableEntries = Object.entries(tables);

  const getSourceColor = (source: string) => {
    switch (source) {
      case "redshift":
        return "text-redshift";
      case "sqlserver":
        return "text-sqlserver";
      case "uploaded":
        return "text-green-400";
      default:
        return "text-on-surface-variant";
    }
  };

  const getSourceBgColor = (source: string) => {
    switch (source) {
      case "redshift":
        return "bg-redshift/20 text-redshift";
      case "sqlserver":
        return "bg-sqlserver/20 text-sqlserver";
      case "uploaded":
        return "bg-green-400/20 text-green-400";
      default:
        return "bg-surface-container text-on-surface-variant";
    }
  };

  const isUploadedFile = (source: string) => source === "uploaded";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 border-b border-outline-variant flex items-center justify-between">
        <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
          Tables
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleClearAll}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded text-[10px]",
              "bg-red-400/20 text-red-400 hover:bg-red-400/30",
              "transition-colors",
              Object.keys(tables).length === 0 && "opacity-50 cursor-not-allowed"
            )}
            title="Clear all tables"
            disabled={Object.keys(tables).length === 0}
          >
            <RotateCcw className="w-3 h-3" />
            Clear
          </button>
          <button
            onClick={handleUploadClick}
            disabled={isUploading}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded text-[10px]",
              "bg-green-400/20 text-green-400 hover:bg-green-400/30",
              "transition-colors",
              isUploading && "opacity-50 cursor-not-allowed"
            )}
            title="Upload CSV or Excel file"
          >
            <Upload className="w-3 h-3" />
            {isUploading ? "..." : "Upload"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </div>

      {/* Tables List */}
      <div className="flex-1 overflow-auto py-1">
        {tableEntries.length === 0 ? (
          <div className="h-full overflow-auto flex items-center justify-center">
            <div className="text-center px-4">
              <Table className="w-8 h-8 mx-auto text-outline mb-2" />
              <p className="text-sm text-on-surface-variant mb-1">No tables available</p>
              <p className="text-xs text-outline">Upload files or run queries to see tables here</p>
            </div>
          </div>
        ) : (
          tableEntries.map(([name, data]) => (
            <div
              key={name}
              className={cn(
                "px-3 py-2 hover:bg-surface-container-high transition-colors",
                "border-b border-outline-variant/50"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  {isUploadedFile(data.source) ? (
                    <FileSpreadsheet className={cn("w-3.5 h-3.5 flex-shrink-0 text-green-400")} />
                  ) : (
                    <Table className={cn("w-3.5 h-3.5 flex-shrink-0", getSourceColor(data.source))} />
                  )}
                  <span className="text-xs font-medium text-on-surface truncate">
                    {name}
                  </span>
                </div>
                <button
                  onClick={() => removeTable(name)}
                  className="p-1 rounded hover:bg-red-500/20 text-on-surface-variant hover:text-red-400 transition-colors flex-shrink-0"
                  title="Remove table"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
              <div className="mt-0.5 text-[10px] text-on-surface-variant flex items-center gap-1.5">
                <span className={cn(
                  "px-1 py-0 rounded text-[9px]",
                  getSourceBgColor(data.source)
                )}>
                  {isUploadedFile(data.source) ? "file" : data.source === "redshift" ? "rs" : "ss"}
                </span>
                <span>{data.rows.length}r</span>
                <span>{data.columns.length}c</span>
              </div>
              {data.fileName && (
                <div className="mt-1 text-[10px] text-outline truncate">
                  {data.fileName}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Usage Hint */}
      <div className="px-3 py-2 border-t border-outline-variant bg-surface-container">
        <div className="text-[10px] text-on-surface-variant leading-relaxed">
          <strong>Usage:</strong> SELECT * FROM{" "}
          <span className="text-green-400">[myfile]</span>
          <br />
          <span className="text-outline">Use [brackets] around table names</span>
        </div>
      </div>
    </div>
  );
}
