/**
 * TanStack Query hooks for Jobs API.
 * Replaces useEffect data fetching patterns.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../query-client";
import {
  getJobs,
  getJob,
  createJob,
  updateJob,
  deleteJob,
  runJob,
  cancelJob,
  toggleJob,
  getJobExecutions,
  getExecutionStatus,
  previewSchedule,
  scheduleJob,
  syncSchedules,
  getJobStats,
  getSchedulerStatus,
  getCronPresets,
  getJobRegistry,
  CreateJobRequest,
  UpdateJobRequest,
  ScheduleJobRequest,
  ScheduleType,
  ScheduleConfig,
  Job,
  JobExecution,
} from "../jobs-api";

/**
 * Hook for fetching all jobs
 */
export function useJobsQuery(
  filters?: { author?: string; job_type?: "workflow" | "function"; is_active?: boolean },
  options?: { refetchInterval?: number; enabled?: boolean }
) {
  return useQuery({
    queryKey: queryKeys.jobs.list(filters),
    queryFn: () => getJobs(filters),
    select: (data) => data.jobs,
    refetchInterval: options?.refetchInterval,
    enabled: options?.enabled ?? true,
  });
}

/**
 * Hook for fetching a single job
 */
export function useJobQuery(jobId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.jobs.detail(jobId),
    queryFn: () => getJob(jobId),
    select: (data) => data.job,
    enabled: options?.enabled ?? !!jobId,
  });
}

/**
 * Hook for fetching job executions
 */
export function useJobExecutionsQuery(
  jobId: string,
  options?: { refetchInterval?: number; enabled?: boolean }
) {
  return useQuery({
    queryKey: queryKeys.jobs.executions(jobId),
    queryFn: () => getJobExecutions(jobId),
    select: (data) => data.executions,
    refetchInterval: options?.refetchInterval,
    enabled: options?.enabled ?? !!jobId,
  });
}

/**
 * Hook for fetching execution status
 */
export function useExecutionStatusQuery(
  executionId: string,
  options?: { refetchInterval?: number; enabled?: boolean }
) {
  return useQuery({
    queryKey: queryKeys.jobs.execution(executionId),
    queryFn: () => getExecutionStatus(executionId),
    select: (data) => data.execution,
    refetchInterval: options?.refetchInterval,
    enabled: options?.enabled ?? !!executionId,
  });
}

/**
 * Hook for fetching job stats
 */
export function useJobStatsQuery() {
  return useQuery({
    queryKey: queryKeys.jobs.stats(),
    queryFn: getJobStats,
    select: (data) => data.stats,
  });
}

/**
 * Hook for fetching scheduler status
 */
export function useSchedulerStatusQuery() {
  return useQuery({
    queryKey: queryKeys.jobs.schedulerStatus(),
    queryFn: getSchedulerStatus,
  });
}

/**
 * Hook for fetching cron presets
 */
export function useCronPresetsQuery() {
  return useQuery({
    queryKey: queryKeys.jobs.cronPresets(),
    queryFn: getCronPresets,
    select: (data) => data.presets,
    staleTime: Infinity, // Presets don't change
  });
}

/**
 * Hook for fetching job registry (available functions)
 */
export function useJobRegistryQuery() {
  return useQuery({
    queryKey: queryKeys.jobs.registry(),
    queryFn: getJobRegistry,
    select: (data) => data.functions,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook for schedule preview
 */
export function useSchedulePreviewQuery(
  scheduleType: ScheduleType | null,
  scheduleConfig: ScheduleConfig | null,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ["jobs", "schedulePreview", scheduleType, scheduleConfig],
    queryFn: () => previewSchedule(scheduleType!, scheduleConfig!),
    enabled: options?.enabled ?? (!!scheduleType && !!scheduleConfig),
    staleTime: 1000 * 60, // 1 minute
  });
}

// ============================================================================
// Mutations
// ============================================================================

/**
 * Hook for creating a job
 */
export function useCreateJobMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: CreateJobRequest) => createJob(request),
    onSuccess: () => {
      // Invalidate jobs list to refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
    },
  });
}

/**
 * Hook for updating a job
 */
export function useUpdateJobMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ jobId, request }: { jobId: string; request: UpdateJobRequest }) =>
      updateJob(jobId, request),
    onSuccess: (_, { jobId }) => {
      // Invalidate both list and detail
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.detail(jobId) });
    },
  });
}

/**
 * Hook for deleting a job
 */
export function useDeleteJobMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (jobId: string) => deleteJob(jobId),
    onSuccess: (_, jobId) => {
      // Invalidate list and remove detail from cache
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
      queryClient.removeQueries({ queryKey: queryKeys.jobs.detail(jobId) });
    },
  });
}

/**
 * Hook for running a job
 */
export function useRunJobMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (jobId: string) => runJob(jobId),
    onSuccess: (_, jobId) => {
      // Invalidate to get updated status
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.detail(jobId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.executions(jobId) });
    },
  });
}

/**
 * Hook for cancelling a job
 */
export function useCancelJobMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (jobId: string) => cancelJob(jobId),
    onSuccess: (_, jobId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.detail(jobId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.executions(jobId) });
    },
  });
}

/**
 * Hook for toggling job active state
 */
export function useToggleJobMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (jobId: string) => toggleJob(jobId),
    onSuccess: (_, jobId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.detail(jobId) });
    },
  });
}

/**
 * Hook for scheduling a job
 */
export function useScheduleJobMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ jobId, request }: { jobId: string; request: ScheduleJobRequest }) =>
      scheduleJob(jobId, request),
    onSuccess: (_, { jobId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.detail(jobId) });
    },
  });
}

/**
 * Hook for syncing schedules
 */
export function useSyncSchedulesMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: syncSchedules,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.schedulerStatus() });
    },
  });
}

// ============================================================================
// Combined hook for common job operations
// ============================================================================

/**
 * Combined hook that provides all job-related data and operations
 */
export function useJobsWithPolling(
  filters?: { author?: string; job_type?: "workflow" | "function"; is_active?: boolean },
  pollingEnabled: boolean = true,
  pollingInterval: number = 5000
) {
  const queryClient = useQueryClient();

  const jobsQuery = useJobsQuery(filters, {
    refetchInterval: pollingEnabled ? pollingInterval : undefined,
  });

  const createMutation = useCreateJobMutation();
  const updateMutation = useUpdateJobMutation();
  const deleteMutation = useDeleteJobMutation();
  const runMutation = useRunJobMutation();
  const cancelMutation = useCancelJobMutation();
  const toggleMutation = useToggleJobMutation();
  const syncMutation = useSyncSchedulesMutation();

  return {
    // Data
    jobs: jobsQuery.data ?? [],
    isLoading: jobsQuery.isLoading,
    isRefetching: jobsQuery.isRefetching,
    error: jobsQuery.error,

    // Queries
    refetch: jobsQuery.refetch,

    // Mutations
    createJob: createMutation.mutateAsync,
    updateJob: (jobId: string, request: UpdateJobRequest) =>
      updateMutation.mutateAsync({ jobId, request }),
    deleteJob: deleteMutation.mutateAsync,
    runJob: runMutation.mutateAsync,
    cancelJob: cancelMutation.mutateAsync,
    toggleJob: toggleMutation.mutateAsync,
    syncSchedules: syncMutation.mutateAsync,

    // Mutation states
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isRunning: runMutation.isPending,
    isCancelling: cancelMutation.isPending,
    isToggling: toggleMutation.isPending,
    isSyncing: syncMutation.isPending,

    // Polling control
    isPolling: pollingEnabled,
  };
}
