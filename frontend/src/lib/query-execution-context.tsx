/**
 * Global Query Execution Context
 *
 * Manages query execution state that persists across route navigations.
 * Queries continue running in the background when navigating away,
 * and results are available when returning to the page.
 */

import * as React from "react";
import { executeQuery as apiExecuteQuery } from "./api";

export type DatabaseType = "redshift" | "sqlserver";

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  executionTime: number;
  message?: string;
  error?: string;
}

export interface QueryExecution {
  id: string;
  database: DatabaseType;
  tabId: string;
  query: string;
  startTime: number;
  isRunning: boolean;
  result: QueryResult | null;
  error: string | null;
}

interface QueryExecutionContextValue {
  // Get execution state for a specific tab
  getExecution: (database: DatabaseType, tabId: string) => QueryExecution | null;

  // Start a new query execution
  startExecution: (
    database: DatabaseType,
    tabId: string,
    query: string,
    signal?: AbortSignal
  ) => Promise<QueryResult>;

  // Stop a running execution
  stopExecution: (database: DatabaseType, tabId: string) => void;

  // Clear execution result for a tab
  clearExecution: (database: DatabaseType, tabId: string) => void;

  // Check if a query is running for a tab
  isRunning: (database: DatabaseType, tabId: string) => boolean;
}

const QueryExecutionContext = React.createContext<QueryExecutionContextValue | null>(null);

// Generate unique execution ID
const generateExecutionId = () => `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Create a key for the execution map
const getExecutionKey = (database: DatabaseType, tabId: string) => `${database}:${tabId}`;

export function QueryExecutionProvider({ children }: { children: React.ReactNode }) {
  // Store all executions in a ref to avoid re-renders
  const executionsRef = React.useRef<Map<string, QueryExecution>>(new Map());

  // Store abort controllers
  const abortControllersRef = React.useRef<Map<string, AbortController>>(new Map());

  // Force re-render when execution state changes
  const [, forceUpdate] = React.useReducer(x => x + 1, 0);

  const getExecution = React.useCallback((database: DatabaseType, tabId: string): QueryExecution | null => {
    const key = getExecutionKey(database, tabId);
    return executionsRef.current.get(key) || null;
  }, []);

  const isRunning = React.useCallback((database: DatabaseType, tabId: string): boolean => {
    const execution = getExecution(database, tabId);
    return execution?.isRunning || false;
  }, [getExecution]);

  const stopExecution = React.useCallback((database: DatabaseType, tabId: string) => {
    const key = getExecutionKey(database, tabId);

    // Abort the fetch request
    const controller = abortControllersRef.current.get(key);
    if (controller) {
      controller.abort();
      abortControllersRef.current.delete(key);
    }

    // Update execution state
    const execution = executionsRef.current.get(key);
    if (execution && execution.isRunning) {
      execution.isRunning = false;
      execution.error = "Query cancelled";
      forceUpdate();
    }
  }, []);

  const clearExecution = React.useCallback((database: DatabaseType, tabId: string) => {
    const key = getExecutionKey(database, tabId);
    executionsRef.current.delete(key);
    forceUpdate();
  }, []);

  const startExecution = React.useCallback(async (
    database: DatabaseType,
    tabId: string,
    query: string,
    externalSignal?: AbortSignal
  ): Promise<QueryResult> => {
    const key = getExecutionKey(database, tabId);

    // Stop any existing execution for this tab
    stopExecution(database, tabId);

    // Create new abort controller
    const controller = new AbortController();
    abortControllersRef.current.set(key, controller);

    // Link external signal if provided
    if (externalSignal) {
      externalSignal.addEventListener('abort', () => controller.abort());
    }

    // Create execution record
    const execution: QueryExecution = {
      id: generateExecutionId(),
      database,
      tabId,
      query,
      startTime: Date.now(),
      isRunning: true,
      result: null,
      error: null,
    };

    executionsRef.current.set(key, execution);
    forceUpdate();

    try {
      const response = await apiExecuteQuery(database, query, undefined, controller.signal);

      // Calculate execution time from start to now (in seconds)
      const elapsedTime = (Date.now() - execution.startTime) / 1000;

      const result: QueryResult = {
        columns: response.columns,
        rows: response.rows,
        executionTime: elapsedTime,
        message: response.message,
      };

      // Update execution with result
      const currentExecution = executionsRef.current.get(key);
      if (currentExecution && currentExecution.id === execution.id) {
        currentExecution.isRunning = false;
        currentExecution.result = result;
        forceUpdate();
      }

      return result;
    } catch (error) {
      // Check if aborted
      if (error instanceof Error && error.name === 'AbortError') {
        const currentExecution = executionsRef.current.get(key);
        if (currentExecution && currentExecution.id === execution.id) {
          currentExecution.isRunning = false;
          currentExecution.error = "Query cancelled";
          forceUpdate();
        }
        throw error;
      }

      const errorMsg = error instanceof Error ? error.message : "Query execution failed";

      // Update execution with error
      const currentExecution = executionsRef.current.get(key);
      if (currentExecution && currentExecution.id === execution.id) {
        currentExecution.isRunning = false;
        currentExecution.error = errorMsg;
        currentExecution.result = {
          columns: [],
          rows: [],
          executionTime: 0,
          error: errorMsg,
        };
        forceUpdate();
      }

      throw error;
    } finally {
      abortControllersRef.current.delete(key);
    }
  }, [stopExecution]);

  const value = React.useMemo(() => ({
    getExecution,
    startExecution,
    stopExecution,
    clearExecution,
    isRunning,
  }), [getExecution, startExecution, stopExecution, clearExecution, isRunning]);

  return (
    <QueryExecutionContext.Provider value={value}>
      {children}
    </QueryExecutionContext.Provider>
  );
}

export function useQueryExecution() {
  const context = React.useContext(QueryExecutionContext);
  if (!context) {
    throw new Error("useQueryExecution must be used within QueryExecutionProvider");
  }
  return context;
}
