import React, { createContext, useContext, useState, useCallback, useRef, useSyncExternalStore } from "react";
import {
  Job,
  JobExecution,
  JobStats,
  getJobs,
  getJob,
  createJob,
  updateJob,
  deleteJob,
  runJob,
  cancelJob,
  scheduleJob,
  pauseJob,
  resumeJob,
  toggleJob,
  getJobExecutions,
  getExecutionStatus,
  syncSchedules,
  getJobStats,
  CreateJobRequest,
  UpdateJobRequest,
  ScheduleJobRequest,
  ScheduleType,
  ScheduleConfig,
} from "~/lib/jobs-api";
import { useToast } from "~/components/ui/toast-provider";

interface JobsContextType {
  jobs: Job[];
  selectedJob: Job | null;
  executions: JobExecution[];
  stats: JobStats | null;
  isLoading: boolean;
  error: string | null;
  isPolling: boolean;

  // Job operations
  loadJobs: (params?: { author?: string; job_type?: "workflow" | "function"; is_active?: boolean }) => Promise<void>;
  loadJob: (jobId: string) => Promise<void>;
  createNewJob: (request: CreateJobRequest) => Promise<string | null>;
  updateExistingJob: (jobId: string, request: UpdateJobRequest) => Promise<boolean>;
  deleteExistingJob: (jobId: string) => Promise<boolean>;

  // Execution operations
  triggerJob: (jobId: string) => Promise<{ success: boolean; executionId?: string }>;
  stopJob: (jobId: string) => Promise<boolean>;
  loadExecutions: (jobId: string) => Promise<void>;
  pollExecutionStatus: (executionId: string) => Promise<JobExecution | null>;

  // Schedule operations
  setSchedule: (jobId: string, scheduleType: ScheduleType, scheduleConfig: ScheduleConfig, enabled: boolean) => Promise<boolean>;
  toggleJobActive: (jobId: string) => Promise<boolean>;
  pauseSchedule: (jobId: string) => Promise<boolean>;
  resumeSchedule: (jobId: string) => Promise<boolean>;
  syncAllSchedules: () => Promise<boolean>;

  // Stats
  loadStats: () => Promise<void>;

  // Polling control
  startPolling: (intervalMs?: number) => void;
  stopPolling: () => void;

  // Selection
  selectJob: (job: Job | null) => void;
  clearError: () => void;
}

const JobsContext = createContext<JobsContextType | undefined>(undefined);

const DEFAULT_POLL_INTERVAL = 5000; // 5 seconds

export function JobsProvider({ children }: { children: React.ReactNode }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [executions, setExecutions] = useState<JobExecution[]>([]);
  const [stats, setStats] = useState<JobStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  const { showToast } = useToast();

  // Use useSyncExternalStore for cleanup instead of useEffect
  const subscribe = useCallback((callback: () => void) => {
    isMountedRef.current = true;
    callback();
    return () => {
      isMountedRef.current = false;
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, []);
  
  const getSnapshot = useCallback(() => isMountedRef.current, []);
  const getServerSnapshot = useCallback(() => true, []);
  
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const loadJobs = useCallback(
    async (params?: { author?: string; job_type?: "workflow" | "function"; is_active?: boolean }) => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await getJobs(params);
        if (isMountedRef.current) {
          setJobs(result.jobs || []);
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to load jobs";
        const isInitError = message.toLowerCase().includes("not initialised") ||
                           message.toLowerCase().includes("not initialized") ||
                           message.toLowerCase().includes("service not available");
        if (isMountedRef.current) {
          setError(isInitError ? null : message);
        }
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    []
  );

  const loadStats = useCallback(async () => {
    try {
      const result = await getJobStats();
      if (isMountedRef.current) {
        setStats(result.stats);
      }
    } catch (e) {
      console.warn("Failed to load job stats:", e);
    }
  }, []);

  const loadJob = useCallback(
    async (jobId: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await getJob(jobId);
        if (isMountedRef.current) {
          setSelectedJob(result.job);
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to load job";
        if (isMountedRef.current) {
          setError(message);
        }
        showToast(message, "error");
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    [showToast]
  );

  const createNewJob = useCallback(
    async (request: CreateJobRequest): Promise<string | null> => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await createJob(request);
        // Don't show toast here - the jobs index page shows it via query param
        await loadJobs();
        return result.id;
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to create job";
        const isInitError = message.toLowerCase().includes("not initialised") ||
                           message.toLowerCase().includes("not initialized") ||
                           message.toLowerCase().includes("service not available") ||
                           message.toLowerCase().includes("503");
        if (isInitError) {
          showToast("Job service unavailable. Please run the database migration first.", "error");
        } else {
          setError(message);
          showToast(message, "error");
        }
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [loadJobs, showToast]
  );

  const updateExistingJob = useCallback(
    async (jobId: string, request: UpdateJobRequest): Promise<boolean> => {
      setIsLoading(true);
      setError(null);
      try {
        await updateJob(jobId, request);
        showToast("Job updated successfully", "success");
        await loadJobs();
        if (selectedJob?.id === jobId) {
          await loadJob(jobId);
        }
        return true;
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to update job";
        setError(message);
        showToast(message, "error");
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [loadJobs, loadJob, selectedJob, showToast]
  );

  const deleteExistingJob = useCallback(
    async (jobId: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);
      try {
        await deleteJob(jobId);
        showToast("Job deleted successfully", "success");
        if (selectedJob?.id === jobId) {
          setSelectedJob(null);
        }
        await loadJobs();
        return true;
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to delete job";
        setError(message);
        showToast(message, "error");
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [loadJobs, selectedJob, showToast]
  );

  const triggerJob = useCallback(
    async (jobId: string): Promise<{ success: boolean; executionId?: string }> => {
      try {
        const result = await runJob(jobId);
        showToast("Job execution started", "success");
        await loadJobs();
        return { success: true, executionId: result.execution_id };
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to start job";
        const isAlreadyRunning = message.toLowerCase().includes("already running");
        if (isAlreadyRunning) {
          showToast("Job is already running", "warning");
        } else {
          showToast(message, "error");
        }
        return { success: false };
      }
    },
    [loadJobs, showToast]
  );

  const stopJob = useCallback(
    async (jobId: string): Promise<boolean> => {
      try {
        await cancelJob(jobId);
        showToast("Job cancellation requested", "info");
        await loadJobs();
        return true;
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to cancel job";
        showToast(message, "error");
        return false;
      }
    },
    [loadJobs, showToast]
  );

  const loadExecutions = useCallback(
    async (jobId: string) => {
      try {
        const result = await getJobExecutions(jobId);
        if (isMountedRef.current) {
          setExecutions(result.executions || []);
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to load executions";
        showToast(message, "error");
      }
    },
    [showToast]
  );

  const pollExecutionStatus = useCallback(
    async (executionId: string): Promise<JobExecution | null> => {
      try {
        const result = await getExecutionStatus(executionId);
        return result.execution;
      } catch (e) {
        console.warn("Failed to poll execution status:", e);
        return null;
      }
    },
    []
  );

  const setSchedule = useCallback(
    async (jobId: string, scheduleType: ScheduleType, scheduleConfig: ScheduleConfig, enabled: boolean): Promise<boolean> => {
      try {
        const request: ScheduleJobRequest = { schedule_type: scheduleType, schedule_config: scheduleConfig, enabled };
        const result = await scheduleJob(jobId, request);
        if (enabled && result.next_run_time) {
          showToast(`Job scheduled. Next run: ${new Date(result.next_run_time).toLocaleString()}`, "success");
        } else if (!enabled) {
          showToast("Schedule updated but job is inactive", "info");
        } else {
          showToast("Schedule updated", "success");
        }
        await loadJobs();
        return true;
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to schedule job";
        showToast(message, "error");
        return false;
      }
    },
    [loadJobs, showToast]
  );

  const toggleJobActive = useCallback(
    async (jobId: string): Promise<boolean> => {
      try {
        const result = await toggleJob(jobId);
        showToast(result.is_active ? "Job activated" : "Job deactivated", "info");
        await loadJobs();
        return true;
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to toggle job";
        showToast(message, "error");
        return false;
      }
    },
    [loadJobs, showToast]
  );

  const pauseSchedule = useCallback(
    async (jobId: string): Promise<boolean> => {
      try {
        await pauseJob(jobId);
        showToast("Job paused", "info");
        await loadJobs();
        return true;
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to pause job";
        showToast(message, "error");
        return false;
      }
    },
    [loadJobs, showToast]
  );

  const resumeSchedule = useCallback(
    async (jobId: string): Promise<boolean> => {
      try {
        await resumeJob(jobId);
        showToast("Job resumed", "success");
        await loadJobs();
        return true;
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to resume job";
        showToast(message, "error");
        return false;
      }
    },
    [loadJobs, showToast]
  );

  const syncAllSchedules = useCallback(
    async (): Promise<boolean> => {
      try {
        const result = await syncSchedules();
        showToast(`Schedules synchronised. ${result.scheduled_jobs} jobs in scheduler.`, "success");
        await loadJobs();
        return true;
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to sync schedules";
        showToast(message, "error");
        return false;
      }
    },
    [loadJobs, showToast]
  );

  const startPolling = useCallback(
    (intervalMs: number = DEFAULT_POLL_INTERVAL) => {
      if (pollingIntervalRef.current) {
        return;
      }

      setIsPolling(true);

      pollingIntervalRef.current = setInterval(async () => {
        if (!isMountedRef.current) {
          return;
        }

        try {
          const result = await getJobs();
          if (isMountedRef.current) {
            setJobs(result.jobs || []);
          }
        } catch (e) {
          console.warn("Polling failed:", e);
        }
      }, intervalMs);
    },
    []
  );

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setIsPolling(false);
  }, []);

  const selectJob = useCallback((job: Job | null) => {
    setSelectedJob(job);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return (
    <JobsContext.Provider
      value={{
        jobs,
        selectedJob,
        executions,
        stats,
        isLoading,
        error,
        isPolling,
        loadJobs,
        loadJob,
        createNewJob,
        updateExistingJob,
        deleteExistingJob,
        triggerJob,
        stopJob,
        loadExecutions,
        pollExecutionStatus,
        setSchedule,
        toggleJobActive,
        pauseSchedule,
        resumeSchedule,
        syncAllSchedules,
        loadStats,
        startPolling,
        stopPolling,
        selectJob,
        clearError,
      }}
    >
      {children}
    </JobsContext.Provider>
  );
}

export function useJobs(): JobsContextType {
  const context = useContext(JobsContext);
  if (context === undefined) {
    throw new Error("useJobs must be used within a JobsProvider");
  }
  return context;
}
