

import * as React from "react";
import { loadTablesFromStorage, saveTablesToStorage, clearPersistedTables } from "~/lib/storage-utils";

export interface TableData {
  columns: string[];
  rows: Record<string, unknown>[];
  source: "redshift" | "sqlserver" | "uploaded";
  savedAt: Date;
  fileName?: string;
  s3Key?: string;
}

interface MergeContextValue {
  tables: Record<string, TableData>;
  saveTable: (name: string, data: Omit<TableData, "savedAt">) => void;
  removeTable: (name: string) => void;
  clearTables: () => void;
  hasRedshiftData: boolean;
  hasSqlServerData: boolean;
  canMerge: boolean;
}

const MergeContext = React.createContext<MergeContextValue | null>(null);

export function MergeProvider({ children }: { children: React.ReactNode }) {
  // Start with empty state to avoid hydration mismatch
  const [tables, setTables] = React.useState<Record<string, TableData>>({});

  // Load persisted tables from localStorage after mount (client-side only)
  React.useEffect(() => {
    const loaded = loadTablesFromStorage();
    // Remove any tables with generic names to avoid confusion
    delete loaded.redshift;
    delete loaded.sqlserver;
    if (Object.keys(loaded).length > 0) {
      setTables(loaded);
    }
  }, []);

  const saveTable = React.useCallback(
    (name: string, data: Omit<TableData, "savedAt">) => {
      const newTable = {
        ...data,
        savedAt: new Date(),
      };

      setTables((prev) => {
        const updated = {
          ...prev,
          [name]: newTable,
        };

        // Save to localStorage (only database queries, not uploaded files)
        if (data.source === "redshift" || data.source === "sqlserver") {
          saveTablesToStorage(updated);
        }

        return updated;
      });
    },
    []
  );

  const removeTable = React.useCallback((name: string) => {
    setTables((prev) => {
      const next = { ...prev };
      delete next[name];

      // Update localStorage if it was a database table
      if (prev[name]?.source === "redshift" || prev[name]?.source === "sqlserver") {
        saveTablesToStorage(next);
      }

      return next;
    });
  }, []);

  const clearTables = React.useCallback(() => {
    setTables({});
    clearPersistedTables();
  }, []);

  const hasRedshiftData = React.useMemo(
    () => Object.values(tables).some((t) => t.source === "redshift"),
    [tables]
  );

  const hasSqlServerData = React.useMemo(
    () => Object.values(tables).some((t) => t.source === "sqlserver"),
    [tables]
  );

  // Can merge if at least 2 tables exist (any combination)
  const canMerge = React.useMemo(() => {
    return Object.keys(tables).length >= 2;
  }, [tables]);

  const value = React.useMemo(
    () => ({
      tables,
      saveTable,
      removeTable,
      clearTables,
      hasRedshiftData,
      hasSqlServerData,
      canMerge,
    }),
    [
      tables,
      saveTable,
      removeTable,
      clearTables,
      hasRedshiftData,
      hasSqlServerData,
      canMerge,
    ]
  );

  return (
    <MergeContext.Provider value={value}>{children}</MergeContext.Provider>
  );
}

export function useMerge() {
  const context = React.useContext(MergeContext);
  if (!context) {
    throw new Error("useMerge must be used within a MergeProvider");
  }
  return context;
}
