/**
 * WebSocket hook for real-time job status updates
 */

import { useEffect, useState, useCallback, useRef } from "react";

const WS_BASE_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8080";

export type MessageType =
  | "connected"
  | "job_status"
  | "step_progress"
  | "job_completed"
  | "pong";

export interface WebSocketMessage {
  type: MessageType;
  job_id?: string;
  execution_id?: string;
  status?: string;
  message?: string;
  timestamp?: string;
}

export interface JobStatusMessage extends WebSocketMessage {
  type: "job_status";
  job_id: string;
  execution_id?: string;
  status: string;
  message?: string;
}

export interface StepProgressMessage extends WebSocketMessage {
  type: "step_progress";
  job_id: string;
  execution_id: string;
  step_id: string;
  step_name: string;
  status: string;
  rows_processed?: number;
  duration_seconds?: number;
  error?: string;
}

export interface JobCompletedMessage extends WebSocketMessage {
  type: "job_completed";
  job_id: string;
  execution_id: string;
  status: string;
  duration_seconds: number;
  output_file_path?: string;
  rows_processed?: number;
  error?: string;
}

export type AnyJobMessage =
  | JobStatusMessage
  | StepProgressMessage
  | JobCompletedMessage
  | WebSocketMessage;

interface UseJobStatusOptions {
  onMessage?: (message: AnyJobMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  enabled?: boolean;
}

interface UseJobStatusReturn {
  isConnected: boolean;
  lastMessage: AnyJobMessage | null;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
  sendPing: () => void;
}

/**
 * Hook for connecting to job status WebSocket
 *
 * @param jobId - Specific job ID to watch, or null for global updates
 * @param options - Configuration options
 */
export function useJobStatus(
  jobId: string | null,
  options: UseJobStatusOptions = {}
): UseJobStatusReturn {
  const {
    reconnectInterval = 5000,
    maxReconnectAttempts = 3,
    enabled = true,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<AnyJobMessage | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  // Store callbacks in refs to avoid dependency issues
  const callbacksRef = useRef(options);
  callbacksRef.current = options;

  const connect = useCallback(() => {
    if (!mountedRef.current || !enabled) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    if (wsRef.current?.readyState === WebSocket.CONNECTING) return;

    // Close any existing connection first
    if (wsRef.current) {
      wsRef.current.onclose = null; // Prevent reconnect logic
      wsRef.current.close();
      wsRef.current = null;
    }

    // Backend expects /ws/{jobId} without 'jobs' prefix
    const url = jobId !== null
      ? `${WS_BASE_URL}/ws/${jobId}`
      : `${WS_BASE_URL}/ws`;

    try {
      const ws = new WebSocket(url);

      ws.onopen = () => {
        if (!mountedRef.current) {
          ws.close();
          return;
        }
        setIsConnected(true);
        setError(null);
        reconnectAttempts.current = 0;
        callbacksRef.current.onConnect?.();
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const message = JSON.parse(event.data) as AnyJobMessage;
          setLastMessage(message);
          callbacksRef.current.onMessage?.(message);
        } catch (e) {
          console.error("Failed to parse WebSocket message:", e);
        }
      };

      ws.onclose = (event) => {
        if (!mountedRef.current) return;
        
        // Don't log error for normal closure or if we're unmounting
        if (event.code !== 1000 && event.code !== 1001) {
          console.debug(`WebSocket closed: ${event.code} ${event.reason}`);
        }
        
        setIsConnected(false);
        callbacksRef.current.onDisconnect?.();

        // Only attempt reconnection if still mounted, enabled, and not a clean close
        if (mountedRef.current && enabled && event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current += 1;
          reconnectTimeoutRef.current = setTimeout(() => {
            if (mountedRef.current) {
              connect();
            }
          }, reconnectInterval);
        }
      };

      ws.onerror = () => {
        // Don't set error state for connection failures - they're common and handled by onclose
        if (!mountedRef.current) return;
      };

      wsRef.current = ws;
    } catch (e) {
      // Silently handle connection errors - WebSocket may not be available
      console.debug(`WebSocket connection failed: ${e}`);
    }
  }, [jobId, enabled, reconnectInterval, maxReconnectAttempts]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    reconnectAttempts.current = maxReconnectAttempts; // Prevent reconnection

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
  }, [maxReconnectAttempts]);

  const sendPing = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send("ping");
    }
  }, []);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    mountedRef.current = true;

    // Delay connection slightly to avoid issues with rapid mount/unmount
    let connectTimeout: NodeJS.Timeout | null = null;
    
    if (jobId !== null && enabled) {
      connectTimeout = setTimeout(() => {
        if (mountedRef.current) {
          connect();
        }
      }, 100);
    }

    return () => {
      mountedRef.current = false;
      
      if (connectTimeout) {
        clearTimeout(connectTimeout);
      }
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      if (wsRef.current) {
        // Prevent onclose from triggering reconnect
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.close(1000, "Component unmounted");
        wsRef.current = null;
      }
    };
  }, [jobId, enabled]); // Only depend on jobId and enabled, not connect

  return {
    isConnected,
    lastMessage,
    error,
    connect,
    disconnect,
    sendPing,
  };
}

/**
 * Hook for watching multiple jobs
 */
export function useGlobalJobStatus(
  options: UseJobStatusOptions = {}
): UseJobStatusReturn {
  return useJobStatus(null, options);
}

/**
 * Hook for watching job execution progress
 * Provides structured callbacks for different message types
 */
export function useJobExecution(
  jobId: string,
  callbacks: {
    onStatusChange?: (status: string, message?: string) => void;
    onStepProgress?: (step: StepProgressMessage) => void;
    onCompleted?: (result: JobCompletedMessage) => void;
    onError?: (error: string) => void;
  }
): UseJobStatusReturn {
  // Store callbacks in a ref to avoid recreating handleMessage
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  const handleMessage = useCallback(
    (message: AnyJobMessage) => {
      switch (message.type) {
        case "job_status":
          callbacksRef.current.onStatusChange?.(
            (message as JobStatusMessage).status,
            (message as JobStatusMessage).message
          );
          break;
        case "step_progress":
          callbacksRef.current.onStepProgress?.(message as StepProgressMessage);
          break;
        case "job_completed":
          const completed = message as JobCompletedMessage;
          callbacksRef.current.onCompleted?.(completed);
          if (completed.error) {
            callbacksRef.current.onError?.(completed.error);
          }
          break;
      }
    },
    [] // No dependencies - uses ref
  );

  return useJobStatus(jobId, { onMessage: handleMessage });
}
