/**
 * API client for Job Scheduler functionality
 *
 * Supports:
 * - Workflow jobs (SQL steps) and Function jobs (registry-based)
 * - Multiple schedule types: cron, interval, date
 * - Polling-based execution status
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

// =============================================================================
// Types
// =============================================================================

export type JobType = "workflow" | "function";
export type ScheduleType = "cron" | "interval" | "date";
export type StepType = "redshift_query" | "sqlserver_query" | "merge";
export type ExecutionStatus = "pending" | "running" | "completed" | "failed" | "cancelled";
export type OutputFormat = "csv" | "excel" | "json";
export type ErrorHandlingMode = "stop" | "continue" | "retry";
export type TriggerType = "manual" | "scheduled";

// Schedule configuration types
export interface CronScheduleConfig {
  cron_expression: string;
}

export interface IntervalScheduleConfig {
  weeks?: number;
  days?: number;
  hours?: number;
  minutes?: number;
  seconds?: number;
}

export interface DateScheduleConfig {
  run_at: string;
}

export type ScheduleConfig = CronScheduleConfig | IntervalScheduleConfig | DateScheduleConfig;

export interface WorkflowStep {
  id: string;
  name: string;
  type: StepType;
  query: string;
  output_table?: string;
  depends_on?: string[];
  timeout_seconds?: number;
}

export interface WorkflowErrorHandling {
  on_step_failure: ErrorHandlingMode;
  notify_on_failure: boolean;
  notify_on_success: boolean;
}

export interface WorkflowDefinition {
  version: string;
  steps: WorkflowStep[];
  error_handling: WorkflowErrorHandling;
}

export interface Job {
  id: string;
  job_name: string;
  description?: string;

  // Job type
  job_type: JobType;

  // Schedule configuration
  schedule_type: ScheduleType;
  schedule_config?: ScheduleConfig;

  // For workflow jobs
  workflow_definition?: WorkflowDefinition;

  // For function jobs
  target_function?: string;
  parameters?: Record<string, unknown>;

  // State
  is_active: boolean;
  next_run_time?: string;
  last_run_time?: string;
  
  // Last execution info
  last_run_started_at?: string;
  last_run_completed_at?: string;
  last_run_status?: ExecutionStatus;

  // Common fields
  output_format: OutputFormat;
  author: string;
  created_at: string;
  updated_at: string;
  max_retries: number;
  retry_delay_seconds: number;
  notify_on_success?: boolean;
  notify_on_failure?: boolean;
  on_success_action?: number;
  on_fail_action?: number;
}

export interface StepResult {
  id: string;
  step_number: number;
  step_name: string;
  step_type: string;
  started_at?: string;
  completed_at?: string;
  duration_seconds?: number;
  status: string;
  error_message?: string;
  rows_returned?: number;
}

export interface JobExecution {
  id: string;
  job_id: string;
  started_at?: string;
  completed_at?: string;
  duration_seconds?: number;
  status: ExecutionStatus;
  trigger_type: TriggerType;
  error_message?: string;
  result?: string;
  output_file_path?: string;
  output_file_size_bytes?: number;
  rows_processed?: number;
  step_results?: StepResult[];
  created_at?: string;
}

export interface CreateJobRequest {
  job_name: string;
  description?: string;
  job_type?: JobType;
  schedule_type: ScheduleType;
  schedule_config: ScheduleConfig;
  workflow_definition?: WorkflowDefinition;
  target_function?: string;
  parameters?: Record<string, unknown>;
  output_format?: OutputFormat;
  author: string;
  max_retries?: number;
  retry_delay_seconds?: number;
  notify_on_success?: boolean;
  notify_on_failure?: boolean;
}

export interface UpdateJobRequest {
  job_name?: string;
  description?: string;
  author?: string;
  schedule_type?: ScheduleType;
  schedule_config?: ScheduleConfig;
  workflow_definition?: WorkflowDefinition;
  target_function?: string;
  parameters?: Record<string, unknown>;
  output_format?: OutputFormat;
  max_retries?: number;
  retry_delay_seconds?: number;
  notify_on_success?: boolean;
  notify_on_failure?: boolean;
}

export interface ScheduleJobRequest {
  schedule_type: ScheduleType;
  schedule_config: ScheduleConfig;
  enabled: boolean;
}

export interface RegistryFunction {
  name: string;
  description: string;
  parameters?: Record<string, unknown>;
}

export interface CronPreset {
  name: string;
  expression: string;
  description: string;
}

export interface SchedulerStatus {
  running: boolean;
  total_jobs: number;
  pending_jobs: number;
  running_jobs: number;
}

export interface JobStats {
  total_jobs: number;
  active_jobs: number;
  inactive_jobs: number;
  workflow_jobs: number;
  function_jobs: number;
}

// =============================================================================
// Helper Functions
// =============================================================================

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;
    try {
      const errorData = await response.json();
      if (typeof errorData.detail === "string") {
        errorMessage = errorData.detail;
      } else if (errorData.message) {
        errorMessage = errorData.message;
      } else if (errorData.error) {
        errorMessage = errorData.error;
      }
    } catch {
      errorMessage = response.statusText || errorMessage;
    }
    throw new Error(errorMessage);
  }
  const json = await response.json();
  // Unwrap { success: true, data: {...} } envelope if present
  if (json && typeof json === 'object' && 'success' in json && 'data' in json) {
    return json.data as T;
  }
  return json as T;
}

// =============================================================================
// Job CRUD Operations
// =============================================================================

/**
 * Create a new job
 */
export async function createJob(request: CreateJobRequest): Promise<{ status: string; message: string; id: string }> {
  const response = await fetch(`${API_BASE_URL}/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  return handleResponse(response);
}

/**
 * Get all jobs with optional filtering
 */
export async function getJobs(params?: {
  author?: string;
  job_type?: JobType;
  is_active?: boolean;
  limit?: number;
  offset?: number;
}): Promise<{ status: string; jobs: Job[]; total: number }> {
  const searchParams = new URLSearchParams();
  if (params?.author) searchParams.set("author", params.author);
  if (params?.job_type) searchParams.set("job_type", params.job_type);
  if (params?.is_active !== undefined) searchParams.set("is_active", params.is_active.toString());
  if (params?.limit) searchParams.set("limit", params.limit.toString());
  if (params?.offset) searchParams.set("offset", params.offset.toString());

  const queryString = searchParams.toString();
  const url = `${API_BASE_URL}/jobs${queryString ? `?${queryString}` : ""}`;

  const response = await fetch(url);
  return handleResponse(response);
}

/**
 * Get a specific job by ID
 */
export async function getJob(jobId: string): Promise<{ status: string; job: Job }> {
  const response = await fetch(`${API_BASE_URL}/jobs/${jobId}`);
  return handleResponse(response);
}

/**
 * Update a job
 */
export async function updateJob(
  jobId: string,
  request: UpdateJobRequest
): Promise<{ status: string; message: string }> {
  console.log('[API] updateJob called', { jobId, request });
  const response = await fetch(`${API_BASE_URL}/jobs/${jobId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  console.log('[API] updateJob response status:', response.status);
  const result = await handleResponse(response);
  console.log('[API] updateJob result:', result);
  return result;
}

/**
 * Delete a job
 */
export async function deleteJob(jobId: string): Promise<{ status: string; message: string }> {
  const response = await fetch(`${API_BASE_URL}/jobs/${jobId}`, {
    method: "DELETE",
  });
  return handleResponse(response);
}

// =============================================================================
// Job Execution Operations
// =============================================================================

/**
 * Trigger immediate execution of a job.
 * Returns execution_id immediately - use getExecutionStatus to poll for completion.
 */
export async function runJob(jobId: string): Promise<{
  status: string;
  message: string;
  execution_id: string;
}> {
  const response = await fetch(`${API_BASE_URL}/jobs/${jobId}/run`, {
    method: "POST",
  });
  return handleResponse(response);
}

/**
 * Get execution status by execution ID.
 * Use this to poll for status after triggering a job run.
 */
export async function getExecutionStatus(executionId: string): Promise<{
  status: string;
  execution: JobExecution;
}> {
  const response = await fetch(`${API_BASE_URL}/jobs/executions/${executionId}`);
  return handleResponse(response);
}

/**
 * Cancel a running job
 */
export async function cancelJob(jobId: string): Promise<{ status: string; message: string }> {
  const response = await fetch(`${API_BASE_URL}/jobs/${jobId}/cancel`, {
    method: "POST",
  });
  return handleResponse(response);
}

/**
 * Toggle job active state
 */
export async function toggleJob(
  jobId: string,
  isActive?: boolean
): Promise<{ status: string; is_active: boolean; message: string }> {
  const response = await fetch(`${API_BASE_URL}/jobs/${jobId}/toggle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(isActive !== undefined ? { is_active: isActive } : {}),
  });
  return handleResponse(response);
}

// =============================================================================
// Scheduling Operations
// =============================================================================

/**
 * Set or update a job's schedule
 */
export async function scheduleJob(
  jobId: string,
  request: ScheduleJobRequest
): Promise<{ status: string; message: string; next_run_time?: string; is_active: boolean }> {
  const response = await fetch(`${API_BASE_URL}/jobs/${jobId}/schedule`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  return handleResponse(response);
}

/**
 * Pause a scheduled job
 */
export async function pauseJob(jobId: string): Promise<{ status: string; message: string }> {
  const response = await fetch(`${API_BASE_URL}/jobs/${jobId}/pause`, {
    method: "POST",
  });
  return handleResponse(response);
}

/**
 * Resume a paused job
 */
export async function resumeJob(jobId: string): Promise<{ status: string; message: string }> {
  const response = await fetch(`${API_BASE_URL}/jobs/${jobId}/resume`, {
    method: "POST",
  });
  return handleResponse(response);
}

// =============================================================================
// Execution History Operations
// =============================================================================

/**
 * Get execution history for a job
 */
export async function getJobExecutions(
  jobId: string,
  params?: { limit?: number; offset?: number }
): Promise<{ status: string; executions: JobExecution[]; total: number }> {
  const searchParams = new URLSearchParams();
  if (params?.limit) searchParams.set("limit", params.limit.toString());
  if (params?.offset) searchParams.set("offset", params.offset.toString());

  const queryString = searchParams.toString();
  const url = `${API_BASE_URL}/jobs/${jobId}/executions${queryString ? `?${queryString}` : ""}`;

  const response = await fetch(url);
  return handleResponse(response);
}

/**
 * Get details of a specific execution
 */
export async function getExecution(
  jobId: string,
  executionId: string
): Promise<{ status: string; execution: JobExecution }> {
  const response = await fetch(`${API_BASE_URL}/jobs/${jobId}/executions/${executionId}`);
  return handleResponse(response);
}

/**
 * Get download URL for execution output
 */
export function getExecutionDownloadUrl(jobId: string, executionId: string): string {
  return `${API_BASE_URL}/jobs/${jobId}/executions/${executionId}/download`;
}

// =============================================================================
// Registry Operations
// =============================================================================

/**
 * Get list of available functions for function-type jobs
 */
export async function getJobRegistry(): Promise<{
  status: string;
  functions: RegistryFunction[];
}> {
  const response = await fetch(`${API_BASE_URL}/jobs/registry/functions`);
  return handleResponse(response);
}

// =============================================================================
// Scheduler Utility Operations
// =============================================================================

/**
 * Get scheduler status
 */
export async function getSchedulerStatus(): Promise<{
  status: string;
  scheduler: SchedulerStatus;
  scheduled_jobs: Array<{
    scheduler_job_id: string;
    job_id?: string;
    name: string;
    next_run_time?: string;
    pending: boolean;
    is_running: boolean;
  }>;
}> {
  const response = await fetch(`${API_BASE_URL}/jobs/scheduler/status`);
  return handleResponse(response);
}

/**
 * Get cron expression presets
 */
export async function getCronPresets(): Promise<{ status: string; presets: CronPreset[] }> {
  const response = await fetch(`${API_BASE_URL}/jobs/scheduler/cron-presets`);
  return handleResponse(response);
}

/**
 * Preview next run times for a schedule configuration
 */
export async function previewSchedule(
  scheduleType: ScheduleType,
  scheduleConfig: ScheduleConfig
): Promise<{
  status: string;
  schedule_type: string;
  schedule_config: ScheduleConfig;
  description: string;
  next_runs: string[];
}> {
  const params = new URLSearchParams();
  params.set("schedule_type", scheduleType);

  if (scheduleType === "cron" && "cron_expression" in scheduleConfig) {
    params.set("cron_expression", scheduleConfig.cron_expression);
  } else if (scheduleType === "interval") {
    const config = scheduleConfig as IntervalScheduleConfig;
    if (config.weeks) params.set("weeks", config.weeks.toString());
    if (config.days) params.set("days", config.days.toString());
    if (config.hours) params.set("hours", config.hours.toString());
    if (config.minutes) params.set("minutes", config.minutes.toString());
    if (config.seconds) params.set("seconds", config.seconds.toString());
  } else if (scheduleType === "date" && "run_at" in scheduleConfig) {
    params.set("run_at", scheduleConfig.run_at);
  }

  const response = await fetch(`${API_BASE_URL}/jobs/scheduler/preview?${params.toString()}`, {
    method: "POST",
  });
  return handleResponse(response);
}

/**
 * Get storage statistics
 */
export async function getStorageStats(): Promise<{
  status: string;
  storage: {
    total_jobs: number;
    total_files: number;
    total_size_bytes: number;
    total_size_mb: number;
  };
}> {
  const response = await fetch(`${API_BASE_URL}/jobs/storage/stats`);
  return handleResponse(response);
}

/**
 * Sync schedules with database
 */
export async function syncSchedules(): Promise<{
  status: string;
  message: string;
  scheduled_jobs: number;
}> {
  const response = await fetch(`${API_BASE_URL}/jobs/scheduler/sync`, {
    method: "POST",
  });
  return handleResponse(response);
}

/**
 * Get job statistics
 */
export async function getJobStats(): Promise<{
  status: string;
  stats: JobStats;
}> {
  const response = await fetch(`${API_BASE_URL}/jobs/stats`);
  return handleResponse(response);
}

/**
 * Check if a job is currently running
 */
export async function checkJobRunning(jobId: string): Promise<{
  status: string;
  job_id: string;
  is_running: boolean;
  execution_id?: string;
}> {
  const response = await fetch(`${API_BASE_URL}/jobs/${jobId}/running`);
  return handleResponse(response);
}

// =============================================================================
// Helper Functions for UI
// =============================================================================

/**
 * Get status badge colour based on execution status
 */
export function getStatusColour(status: ExecutionStatus | string): string {
  const colours: Record<string, string> = {
    pending: "bg-gray-500",
    running: "bg-yellow-500",
    completed: "bg-green-500",
    failed: "bg-red-500",
    cancelled: "bg-gray-400",
  };
  return colours[status] || "bg-gray-500";
}

/**
 * Format duration in seconds to human-readable string
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  } else if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
}

/**
 * Format file size in bytes to human-readable string
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  } else if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  } else {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
}

/**
 * Create a default workflow definition
 */
export function createDefaultWorkflow(): WorkflowDefinition {
  return {
    version: "1.0",
    steps: [],
    error_handling: {
      on_step_failure: "stop",
      notify_on_failure: true,
      notify_on_success: true,
    },
  };
}

/**
 * Create a new workflow step
 */
export function createWorkflowStep(
  type: StepType,
  name: string,
  query: string = ""
): WorkflowStep {
  const id = `step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  return {
    id,
    name,
    type,
    query,
    output_table: id,
    depends_on: [],
    timeout_seconds: 300,
  };
}

// =============================================================================
// SQL Server Agent Jobs API
// =============================================================================

/**
 * SQL Server Agent Job type from /job endpoint
 */
export interface AgentJobStep {
  step_id: number;
  step_name: string;
  subsystem: string;
  command: string;
  database_name: string;
  on_success_action: number;
  on_fail_action: number;
  retry_attempts: number;
  retry_interval: number;
}

export interface AgentJobSchedule {
  schedule_id: number;
  schedule_name: string;
  enabled: boolean;
  freq_type: string;
  freq_interval: number;
  freq_subday_type: string;
  freq_subday_interval: number;
  active_start_date: number;
  active_end_date: number;
  active_start_time: number;
  active_end_time: number;
  next_run_date: number | null;
  next_run_time: number | null;
  schedule_description: string;
}

export interface AgentJobHistory {
  job_name: string;
  step_id: number;
  step_name: string;
  status: string;
  run_date: string | null;
  run_time: string | null;
  run_duration: string | null;
  message: string;
}

export interface AgentJob {
  job_id: string;
  job_name: string;
  description: string | null;
  enabled: boolean;
  date_created: string;
  date_modified: string;
  owner: string;
  category: string;
  current_status: string;
  last_run_date: string | null;
  last_run_time: string | null;
  last_run_status: string | null;
  last_run_duration: string | null;
  next_run_date: string | null;
  next_run_time: string | null;
  step_count: number;
  has_schedule: boolean;
  on_success_action?: number;
  on_fail_action?: number;
  success_count?: number;
  fail_count?: number;
  steps?: AgentJobStep[];
  schedules?: AgentJobSchedule[];
}

export interface AgentJobsResponse {
  success: boolean;
  jobs: AgentJob[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

/**
 * Get SQL Server Agent jobs from /job endpoint
 */
export async function getAgentJobs(params?: {
  page?: number;
  limit?: number;
}): Promise<AgentJobsResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set("page", params.page.toString());
  if (params?.limit) searchParams.set("limit", params.limit.toString());

  const queryString = searchParams.toString();
  const url = `${API_BASE_URL}/job${queryString ? `?${queryString}` : ""}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch agent jobs: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Start a SQL Server Agent job
 */
export async function startAgentJob(jobName: string): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE_URL}/job/${encodeURIComponent(jobName)}/start`, {
    method: "POST",
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `Failed to start job: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Stop a SQL Server Agent job
 */
export async function stopAgentJob(jobName: string): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE_URL}/job/${encodeURIComponent(jobName)}/stop`, {
    method: "POST",
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `Failed to stop job: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Get SQL Server Agent job details (with steps and schedules)
 */
export async function getAgentJobDetails(jobName: string): Promise<{ success: boolean; job: AgentJob }> {
  const response = await fetch(`${API_BASE_URL}/job/${encodeURIComponent(jobName)}`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `Failed to get job details: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Get SQL Server Agent job execution history
 */
export async function getAgentJobHistory(jobName: string, limit: number = 50): Promise<{
  success: boolean;
  job_name: string;
  count: number;
  history: AgentJobHistory[];
}> {
  const response = await fetch(`${API_BASE_URL}/job/${encodeURIComponent(jobName)}/history?limit=${limit}`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `Failed to get job history: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Get unique job owners
 */
export async function getJobOwners(): Promise<{ success: boolean; owners: string[] }> {
  const response = await fetch(`${API_BASE_URL}/job/owners`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `Failed to get job owners: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Response type for all job execution history
 */
export interface AllJobHistoryResponse {
  success: boolean;
  history: (AgentJobHistory & { owner?: string })[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

/**
 * Get all SQL Server Agent job execution history with pagination and filtering
 */
export async function getAllAgentJobHistory(params?: {
  page?: number;
  limit?: number;
  job_name?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
  owner?: string;
  sort_by?: 'run_date' | 'duration';
  sort_dir?: 'asc' | 'desc';
}): Promise<AllJobHistoryResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set("page", params.page.toString());
  if (params?.limit) searchParams.set("limit", params.limit.toString());
  if (params?.job_name) searchParams.set("job_name", params.job_name);
  if (params?.status) searchParams.set("status", params.status);
  if (params?.date_from) searchParams.set("date_from", params.date_from);
  if (params?.date_to) searchParams.set("date_to", params.date_to);
  if (params?.owner) searchParams.set("owner", params.owner);
  if (params?.sort_by) searchParams.set("sort_by", params.sort_by);
  if (params?.sort_dir) searchParams.set("sort_dir", params.sort_dir);

  const queryString = searchParams.toString();
  const url = `${API_BASE_URL}/job/history${queryString ? `?${queryString}` : ""}`;

  const response = await fetch(url);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `Failed to get execution history: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Email notification configuration for SQL Server Agent jobs
 */
export interface EmailNotificationConfig {
  enabled: boolean;
  from_email?: string;       // Default: BI-Alert@alrajhibank.com.my
  to_email: string;          // Multiple recipients separated by semicolon
  cc_email?: string;         // CC recipients separated by semicolon
  bcc_email?: string;        // BCC recipients separated by semicolon
  subject?: string;
  body?: string;
  attach_results?: boolean;
  attachment_filename?: string;
}

/**
 * Create SQL Server Agent job input interface
 */
export interface CreateAgentJobInput {
  job_name: string;
  description?: string;
  step_command?: string;
  step_name?: string;
  database_name?: string;
  enabled?: boolean;
  category?: string;
  schedule_cron?: string; // Cron expression for scheduling (e.g., "0 8 * * *")
  email_notification?: EmailNotificationConfig;
}

/**
 * Update SQL Server Agent job input interface
 */
export interface UpdateAgentJobInput {
  new_name?: string;
  description?: string;
  enabled?: boolean;
  step_command?: string;
  step_name?: string;
  database_name?: string;
}

/**
 * Create a new SQL Server Agent job
 */
export async function createAgentJob(input: CreateAgentJobInput): Promise<{
  success: boolean;
  message: string;
  job?: AgentJob;
}> {
  const response = await fetch(`${API_BASE_URL}/job`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `Failed to create job: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Update an existing SQL Server Agent job
 */
export async function updateAgentJob(jobName: string, input: UpdateAgentJobInput): Promise<{
  success: boolean;
  message: string;
  job?: AgentJob;
}> {
  const response = await fetch(`${API_BASE_URL}/job/${encodeURIComponent(jobName)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `Failed to update job: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Convert SQL Server Agent job to internal Job format for UI compatibility
 */
export function agentJobToJob(agentJob: AgentJob): Job {
  // Parse last run datetime from date + time strings
  let lastRunStartedAt: string | undefined;
  if (agentJob.last_run_date && agentJob.last_run_time) {
    lastRunStartedAt = `${agentJob.last_run_date}T${agentJob.last_run_time}`;
  }

  // Map agent job status to execution status
  const mapStatus = (status: string | null): ExecutionStatus | undefined => {
    if (!status) return undefined;
    const statusMap: Record<string, ExecutionStatus> = {
      'Succeeded': 'completed',
      'Failed': 'failed',
      'Running': 'running',
      'Retry': 'pending',
      'Canceled': 'cancelled',
      'In Progress': 'running',
    };
    return statusMap[status] || 'pending';
  };

  return {
    id: agentJob.job_id,
    job_name: agentJob.job_name,
    description: agentJob.description || undefined,
    job_type: 'workflow' as JobType, // Agent jobs are workflow-like
    schedule_type: 'cron' as ScheduleType, // Default
    is_active: agentJob.enabled,
    next_run_time: agentJob.next_run_date && agentJob.next_run_time
      ? `${agentJob.next_run_date}T${agentJob.next_run_time}`
      : undefined,
    last_run_time: lastRunStartedAt,
    last_run_started_at: lastRunStartedAt,
    last_run_status: mapStatus(agentJob.last_run_status),
    output_format: 'json' as OutputFormat,
    author: agentJob.owner,
    created_at: agentJob.date_created,
    updated_at: agentJob.date_modified,
    max_retries: 0,
    retry_delay_seconds: 0,
    on_success_action: agentJob.on_success_action,
    on_fail_action: agentJob.on_fail_action,
    // Mark as agent job for UI differentiation
    _isAgentJob: true,
    _agentJobName: agentJob.job_name,
    // Success/Fail counts from history
    success_count: agentJob.success_count,
    fail_count: agentJob.fail_count,
  } as Job & { _isAgentJob: boolean; _agentJobName: string; success_count?: number; fail_count?: number };
}

/**
 * Format schedule for display
 */
export function formatSchedule(scheduleType: ScheduleType, scheduleConfig?: ScheduleConfig): string {
  if (!scheduleConfig) return "No schedule";

  if (scheduleType === "cron" && "cron_expression" in scheduleConfig) {
    return `Cron: ${scheduleConfig.cron_expression}`;
  } else if (scheduleType === "interval") {
    const config = scheduleConfig as IntervalScheduleConfig;
    const parts: string[] = [];
    if (config.weeks) parts.push(`${config.weeks}w`);
    if (config.days) parts.push(`${config.days}d`);
    if (config.hours) parts.push(`${config.hours}h`);
    if (config.minutes) parts.push(`${config.minutes}m`);
    if (config.seconds) parts.push(`${config.seconds}s`);
    return `Every ${parts.join(" ")}`;
  } else if (scheduleType === "date" && "run_at" in scheduleConfig) {
    return `Once at ${new Date(scheduleConfig.run_at).toLocaleString()}`;
  }

  return "Unknown schedule";
}

/**
 * Test email input interface
 */
export interface TestEmailInput {
  from_email: string;
  to_email: string;
  cc_email?: string;
  bcc_email?: string;
  subject: string;
  body: string;
  query?: string;
  attach_results?: boolean;
  attachment_filename?: string;
}

/**
 * Send a test email using SQL Server Database Mail
 */
export async function sendTestEmail(input: TestEmailInput): Promise<{
  success: boolean;
  message: string;
  mail_id?: number;
}> {
  const response = await fetch(`${API_BASE_URL}/job/send-test-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `Failed to send test email: ${response.statusText}`);
  }
  return response.json();
}
