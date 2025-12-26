import { createFileRoute, Link } from '@tanstack/react-router';
import { useState, useMemo, useCallback, useRef } from "react";
import { JobsProvider, useJobs } from "~/components/jobs/JobsProvider";
import { Pagination } from "~/components/ui/pagination";
import { ToastProvider, useToast } from "~/components/ui/toast-provider";
import { ThemeProvider } from "~/lib/theme-context";
import { TooltipProvider } from "~/components/ui/tooltip";
import { useJobExecution, StepProgressMessage } from "~/lib/use-job-status";
import { EditJobModal } from "~/components/jobs/EditJobModal";
import { useInterval, useSchedulePreviewQuery } from "~/lib/hooks";
import {
  Job,
  JobExecution,
  formatDuration,
  formatFileSize,
  getExecutionDownloadUrl,
} from "~/lib/jobs-api";
import {
  ArrowLeft,
  Play,
  Pause,
  Clock,
  Calendar,
  Download,
  RefreshCw,
  CheckCircle,
  XCircle,
  Loader2,
  Database,
  Edit3,
  Zap,
  Timer,
  FileOutput,
  User,
  RotateCcw,
  AlertTriangle,
  Layers,
  ChevronRight,
  ChevronDown,
  Wifi,
  WifiOff,
  MousePointer,
  Bot,
  Code,
  Terminal,
} from "lucide-react";

export const Route = createFileRoute('/jobs/$jobId')({
  component: JobDetailPage,
});

// Malaysia timezone helper
const MALAYSIA_TZ = 'Asia/Kuala_Lumpur';

function formatMYTime(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('en-MY', { timeZone: MALAYSIA_TZ, hour: '2-digit', minute: '2-digit', ...options });
}

function formatMYTimeWithSeconds(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('en-MY', { timeZone: MALAYSIA_TZ, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatMYDate(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-MY', { timeZone: MALAYSIA_TZ, ...options });
}

function formatMYDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-MY', { 
    timeZone: MALAYSIA_TZ, 
    month: 'short', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit' 
  });
}

// Compact status badge
function StatusBadge({ status, size = "sm" }: { status: string; size?: "xs" | "sm" }) {
  const config: Record<string, { bg: string; text: string; dot: string }> = {
    draft: { bg: "bg-zinc-500/15", text: "text-zinc-400", dot: "bg-zinc-400" },
    scheduled: { bg: "bg-cyan-500/15", text: "text-cyan-400", dot: "bg-cyan-400" },
    running: { bg: "bg-amber-500/15", text: "text-amber-400", dot: "bg-amber-400 animate-pulse" },
    completed: { bg: "bg-emerald-500/15", text: "text-emerald-400", dot: "bg-emerald-400" },
    failed: { bg: "bg-rose-500/15", text: "text-rose-400", dot: "bg-rose-400" },
    paused: { bg: "bg-orange-500/15", text: "text-orange-400", dot: "bg-orange-400" },
    cancelled: { bg: "bg-slate-500/15", text: "text-slate-400", dot: "bg-slate-400" },
  };
  const c = config[status] || config.draft;
  const sizeClass = size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs";

  return (
    <span className={`inline-flex items-center gap-1.5 ${sizeClass} rounded-full font-mono uppercase tracking-wider ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {status}
    </span>
  );
}

// Trigger type badge
function TriggerBadge({ type }: { type?: "manual" | "scheduled" }) {
  if (type === "scheduled") {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
        <Bot className="w-2.5 h-2.5" />
        AUTO
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-violet-500/20 text-violet-400 border border-violet-500/30">
      <MousePointer className="w-2.5 h-2.5" />
      MANUAL
    </span>
  );
}

// Step type indicator
function StepType({ type }: { type: string }) {
  const config: Record<string, { icon: string; color: string }> = {
    redshift_query: { icon: "RS", color: "text-orange-400 bg-orange-500/20" },
    sqlserver_query: { icon: "SQL", color: "text-blue-400 bg-blue-500/20" },
    merge: { icon: "M", color: "text-purple-400 bg-purple-500/20" },
  };
  const c = config[type] || { icon: "?", color: "text-zinc-400 bg-zinc-500/20" };
  return (
    <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${c.color}`}>
      {c.icon}
    </span>
  );
}

// Compact workflow step
function WorkflowStep({
  step,
  index,
  liveStep,
  isLast,
}: {
  step: any;
  index: number;
  liveStep?: StepProgressMessage;
  isLast: boolean;
}) {
  const isRunning = liveStep?.status === "running";
  const isCompleted = liveStep?.status === "completed";
  const isFailed = liveStep?.status === "failed";

  return (
    <div className="flex items-start gap-3 group">
      {/* Timeline */}
      <div className="flex flex-col items-center">
        <div className={`
          w-7 h-7 rounded-lg flex items-center justify-center text-xs font-mono font-bold
          transition-all duration-300
          ${isCompleted ? "bg-emerald-500/30 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.3)]" :
            isFailed ? "bg-rose-500/30 text-rose-300" :
            isRunning ? "bg-amber-500/30 text-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.4)]" :
            "bg-surface-container-high text-on-surface-variant"}
        `}>
          {isCompleted ? <CheckCircle className="w-3.5 h-3.5" /> :
           isFailed ? <XCircle className="w-3.5 h-3.5" /> :
           isRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
           index + 1}
        </div>
        {!isLast && (
          <div className={`w-px flex-1 min-h-[20px] mt-1 ${
            isCompleted ? "bg-emerald-500/50" : "bg-outline-variant/30"
          }`} />
        )}
      </div>

      {/* Content */}
      <div className={`flex-1 pb-3 ${isRunning ? "animate-pulse" : ""}`}>
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-medium text-on-surface">{step.name}</span>
          <StepType type={step.type} />
        </div>
        <div className="flex items-center gap-3 text-[11px] text-on-surface-variant font-mono">
          {step.output_table && <span className="opacity-60">→ {step.output_table}</span>}
          {liveStep?.rows_processed != null && (
            <span className="text-emerald-400">{liveStep.rows_processed.toLocaleString()} rows</span>
          )}
        </div>
      </div>
    </div>
  );
}

// Format time with milliseconds
function formatTimeWithMs(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const time = d.toLocaleTimeString('en-MY', { 
    timeZone: MALAYSIA_TZ, 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit',
    hour12: false 
  });
  const ms = d.getMilliseconds().toString().padStart(3, '0');
  return `${time}.${ms}`;
}

// Format duration with milliseconds
function formatDurationMs(startDate: Date | string, endDate: Date | string): string {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
  const diffMs = end.getTime() - start.getTime();
  
  if (diffMs < 1000) {
    return `${diffMs}ms`;
  } else if (diffMs < 60000) {
    const seconds = Math.floor(diffMs / 1000);
    const ms = diffMs % 1000;
    return `${seconds}.${ms.toString().padStart(3, '0')}s`;
  } else {
    const minutes = Math.floor(diffMs / 60000);
    const seconds = Math.floor((diffMs % 60000) / 1000);
    const ms = diffMs % 1000;
    return `${minutes}m ${seconds}.${ms.toString().padStart(3, '0')}s`;
  }
}

// Execution row with proper column alignment
function ExecutionRow({ execution, jobId }: { execution: JobExecution; jobId: string }) {
  const startTimeStr = formatTimeWithMs(execution.started_at);
  const endTimeStr = execution.completed_at ? formatTimeWithMs(execution.completed_at) : '—';
  const dateStr = formatMYDate(execution.started_at, { month: "short", day: "numeric" });
  const processingTime = execution.completed_at 
    ? formatDurationMs(execution.started_at, execution.completed_at)
    : execution.status === "running" ? "Running..." : "—";

  return (
    <div className={`
      flex items-center gap-3 px-3 py-2.5
      transition-all duration-200 hover:bg-surface-container-high/50
      ${execution.status === "running" ? "bg-amber-500/5" :
        execution.status === "failed" ? "bg-rose-500/5" : ""}
    `}>
      {/* Date */}
      <div className="w-14 shrink-0">
        <span className="text-xs font-mono text-on-surface-variant">{dateStr}</span>
      </div>

      {/* Start Time */}
      <div className="w-24 shrink-0">
        <span className="text-xs font-mono text-on-surface">{startTimeStr}</span>
      </div>

      {/* End Time */}
      <div className="w-24 shrink-0">
        <span className="text-xs font-mono text-on-surface">{endTimeStr}</span>
      </div>

      {/* Duration */}
      <div className="w-24 shrink-0">
        <span className={`text-xs font-mono ${execution.status === "running" ? "text-amber-400" : "text-cyan-400"}`}>
          {processingTime}
        </span>
      </div>

      {/* Status */}
      <div className="w-20 shrink-0">
        <StatusBadge status={execution.status} size="xs" />
      </div>

      {/* Trigger */}
      <div className="w-16 shrink-0">
        <TriggerBadge type={execution.trigger_type} />
      </div>

      {/* Metrics */}
      <div className="flex-1 flex items-center gap-4 text-[11px] font-mono text-on-surface-variant min-w-0">
        {execution.rows_processed != null && (
          <span className="flex items-center gap-1 shrink-0">
            <Database className="w-3 h-3 opacity-50" />
            {execution.rows_processed.toLocaleString()} rows
          </span>
        )}
        {execution.output_file_size_bytes != null && (
          <span className="flex items-center gap-1 shrink-0">
            <FileOutput className="w-3 h-3 opacity-50" />
            {formatFileSize(execution.output_file_size_bytes)}
          </span>
        )}
        {execution.output_file_path && (
          <span className="truncate opacity-60" title={execution.output_file_path}>
            {execution.output_file_path.split('/').pop()}
          </span>
        )}
        {!execution.rows_processed && !execution.output_file_size_bytes && !execution.output_file_path && (
          <span className="opacity-40">—</span>
        )}
      </div>

      {/* Actions */}
      <div className="w-16 shrink-0 flex items-center justify-end gap-1">
        {execution.output_file_path && execution.status === "completed" && (
          <a
            href={getExecutionDownloadUrl(jobId, execution.id)}
            className="p-1.5 rounded-md bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
            title="Download"
          >
            <Download className="w-3.5 h-3.5" />
          </a>
        )}
        {execution.error_message && (
          <div className="group relative">
            <div className="p-1.5 rounded-md bg-rose-500/20 text-rose-400">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
            <div className="absolute right-0 top-full mt-1 w-64 p-2 rounded-lg bg-rose-950/90 border border-rose-500/30 text-xs text-rose-200 font-mono opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none">
              {execution.error_message}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Quick stat
function QuickStat({ icon: Icon, label, value, accent = false }: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${accent ? "bg-cyan-500/10" : "bg-surface-container-high/50"}`}>
      <Icon className={`w-3.5 h-3.5 ${accent ? "text-cyan-400" : "text-on-surface-variant/60"}`} />
      <div>
        <div className="text-[10px] uppercase tracking-wider text-on-surface-variant/60">{label}</div>
        <div className={`text-sm font-mono ${accent ? "text-cyan-400" : "text-on-surface"}`}>{value}</div>
      </div>
    </div>
  );
}

function JobDetailContent() {
  const params = Route.useParams();
  const jobId = params.jobId as string;

  const {
    selectedJob,
    executions,
    isLoading,
    loadJob,
    loadExecutions,
    triggerJob,
    pauseSchedule,
    resumeSchedule,
  } = useJobs();

  const { showToast } = useToast();
  const [liveSteps, setLiveSteps] = useState<Record<string, StepProgressMessage>>({});
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);
  const [isTriggering, setIsTriggering] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isConfigExpanded, setIsConfigExpanded] = useState(false);
  const [executionCurrentPage, setExecutionCurrentPage] = useState(1);
  const EXECUTIONS_PER_PAGE = 10;

  // Check if there's an active execution (running or pending) in execution history
  const hasActiveExecution = useMemo(() => {
    return executions.some(exec => exec.status === "running" || exec.status === "pending");
  }, [executions]);

  // Paginated executions
  const totalExecutionPages = Math.ceil(executions.length / EXECUTIONS_PER_PAGE);
  const paginatedExecutions = useMemo(() => {
    const startIndex = (executionCurrentPage - 1) * EXECUTIONS_PER_PAGE;
    return executions.slice(startIndex, startIndex + EXECUTIONS_PER_PAGE);
  }, [executions, executionCurrentPage, EXECUTIONS_PER_PAGE]);

  // Extract cron expression from schedule_config
  const cronExpression = useMemo(() => {
    if (selectedJob?.schedule_type === "cron" && selectedJob?.schedule_config) {
      const config = selectedJob.schedule_config as { cron_expression?: string };
      return config.cron_expression || null;
    }
    return null;
  }, [selectedJob?.schedule_type, selectedJob?.schedule_config]);

  // Check if job has any schedule (cron, interval, or date)
  const hasSchedule = useMemo(() => {
    return selectedJob?.schedule_type && selectedJob?.schedule_config;
  }, [selectedJob?.schedule_type, selectedJob?.schedule_config]);

  // Compute job status from executions and job state
  // Priority: running > pending > scheduled > paused > draft
  const jobStatus = useMemo(() => {
    // Check if any execution is running
    const runningExec = executions.find(exec => exec.status === "running");
    if (runningExec) return "running";

    // Check if any execution is pending
    const pendingExec = executions.find(exec => exec.status === "pending");
    if (pendingExec) return "running"; // Show as running for pending too

    // Check job's schedule state - job is scheduled if active with any schedule type
    if (selectedJob?.is_active && hasSchedule) {
      return "scheduled";
    }

    // If not active but has schedule, it's paused
    if (!selectedJob?.is_active && hasSchedule) {
      return "paused";
    }

    // Default to draft
    return "draft";
  }, [executions, selectedJob?.is_active, hasSchedule]);

  // Button should be disabled if triggering or if there's an active execution
  const isButtonDisabled = isTriggering || hasActiveExecution;

  // WebSocket for real-time updates
  const { isConnected } = useJobExecution(jobId, {
    onStatusChange: () => {
      loadJob(jobId);
      loadExecutions(jobId);
    },
    onStepProgress: (step) => {
      setLiveSteps((prev) => ({ ...prev, [step.step_id]: step }));
    },
    onCompleted: (result) => {
      setLiveSteps({});
      if (result.status === "completed") {
        showToast("Job completed successfully!", "success");
      } else if (result.status === "failed") {
        showToast(`Job failed: ${result.error || "Unknown error"}`, "error");
      }
      loadJob(jobId);
      loadExecutions(jobId);
    },
  });

  // Initial load - use ref pattern instead of useEffect
  const hasInitiallyLoaded = useRef(false);
  const previousJobId = useRef(jobId);
  
  if (!hasInitiallyLoaded.current || previousJobId.current !== jobId) {
    hasInitiallyLoaded.current = true;
    previousJobId.current = jobId;
    // Queue the async operations
    Promise.all([loadJob(jobId), loadExecutions(jobId)])
      .then(() => setHasAttemptedLoad(true))
      .catch(() => setHasAttemptedLoad(true));
  }

  // Use TanStack Query for schedule preview instead of useEffect
  const schedulePreviewQuery = useSchedulePreviewQuery(
    selectedJob?.schedule_type ?? null,
    selectedJob?.schedule_config ?? null,
    { enabled: !!(selectedJob?.schedule_type && selectedJob?.schedule_config) }
  );
  
  // Derive schedule preview from query
  const schedulePreview = useMemo(() => {
    if (schedulePreviewQuery.data) {
      return {
        description: schedulePreviewQuery.data.description,
        next_runs: schedulePreviewQuery.data.next_runs,
      };
    }
    return null;
  }, [schedulePreviewQuery.data]);

  // Use custom interval hook for polling instead of useEffect
  const pollInterval = isConnected ? 10000 : 5000;
  
  useInterval(() => {
    loadExecutions(jobId);
    // Only reload job if there might be changes (active execution or scheduled)
    if (hasActiveExecution || hasSchedule) {
      loadJob(jobId);
    }
  }, pollInterval);

  const handleRunJob = useCallback(async () => {
    setIsTriggering(true);
    try {
      const success = await triggerJob(jobId);
      if (success) {
        // Refresh data after a short delay to get the new execution
        setTimeout(async () => {
          await loadJob(jobId);
          await loadExecutions(jobId);
          // Reset triggering state after data is loaded
          setIsTriggering(false);
        }, 500);
      } else {
        // If trigger failed, reset immediately
        setIsTriggering(false);
      }
    } catch {
      setIsTriggering(false);
    }
  }, [triggerJob, jobId, loadJob, loadExecutions]);

  // Loading state
  if (!hasAttemptedLoad || (isLoading && !selectedJob)) {
    return (
      <div className="flex items-center justify-center h-screen bg-surface">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          <span className="text-sm font-mono text-on-surface-variant">Loading...</span>
        </div>
      </div>
    );
  }

  if (!selectedJob) {
    return (
      <div className="flex items-center justify-center h-screen bg-surface">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-rose-400 mx-auto mb-3" />
          <h1 className="text-lg font-semibold text-on-surface mb-1">Job not found</h1>
          <Link to="/jobs" className="text-sm text-cyan-400 hover:underline">← Back to jobs</Link>
        </div>
      </div>
    );
  }

  const job = selectedJob;
  const steps = job.workflow_definition?.steps || [];

  return (
    <div className="min-h-screen bg-surface">
      {/* Subtle background */}
      <div className="fixed inset-0 pointer-events-none opacity-30"
        style={{
          backgroundImage: `radial-gradient(ellipse 80% 50% at 50% 0%, rgba(34,211,238,0.08), transparent 50%)`,
        }}
      />

      {/* Header */}
      <header className="sticky top-0 z-20 bg-surface/95 backdrop-blur-xl border-b border-outline-variant/20">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Back + Job Info */}
            <div className="flex items-center gap-3 min-w-0">
              <Link 
                to="/jobs" 
                className="p-2 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-all shrink-0"
              >
                <ArrowLeft className="w-4 h-4" />
              </Link>
              
              {/* Status indicator dot */}
              <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                jobStatus === "running" ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)] animate-pulse" :
                jobStatus === "scheduled" ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" :
                jobStatus === "paused" ? "bg-orange-400" :
                "bg-zinc-500"
              }`} />
              
              {/* Job name */}
              <h1 className="text-sm font-semibold text-on-surface truncate">{job.job_name}</h1>

              {/* Cron expression */}
              {cronExpression && (
                <code className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-400 font-mono shrink-0">{cronExpression}</code>
              )}

              {/* Next run time */}
              {cronExpression && job.next_run_time && (
                <span className="text-[10px] text-on-surface-variant/70 font-mono shrink-0">
                  Next: {formatMYDateTime(job.next_run_time)}
                </span>
              )}
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Live indicator */}
              <div className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-mono mr-1 ${
                isConnected ? "bg-emerald-500/10 text-emerald-400" : "bg-zinc-500/10 text-zinc-400"
              }`}>
                {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                {isConnected ? "LIVE" : "OFFLINE"}
              </div>

              {/* Action buttons group */}
              <div className="flex items-center bg-surface-container rounded-lg p-1 gap-1">
                {/* Run / Resume */}
                {jobStatus === "paused" ? (
                  <button
                    onClick={() => resumeSchedule(job.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 text-xs font-medium transition-all"
                    title="Resume Schedule"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Resume</span>
                  </button>
                ) : (
                  <button
                    onClick={handleRunJob}
                    disabled={isButtonDisabled}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 text-xs font-medium transition-all disabled:opacity-50"
                    title="Run Now"
                  >
                    {isButtonDisabled ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                    <span>{isButtonDisabled ? "Running" : "Run"}</span>
                  </button>
                )}

                {/* Pause - only when scheduled and not running */}
                {jobStatus === "scheduled" && !isButtonDisabled && (
                  <button
                    onClick={() => pauseSchedule(job.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 text-xs font-medium transition-all"
                    title="Pause Schedule"
                  >
                    <Pause className="w-3.5 h-3.5" />
                    <span>Pause</span>
                  </button>
                )}

                {/* Divider */}
                <div className="w-px h-5 bg-outline-variant/30 mx-0.5" />

                {/* Edit */}
                <button
                  onClick={() => setIsEditModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface text-xs font-medium transition-all"
                  title="Edit Job"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>

                {/* Refresh */}
                <button
                  onClick={() => { loadJob(jobId); loadExecutions(jobId); }}
                  disabled={isLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface text-xs font-medium transition-all disabled:opacity-50"
                  title="Refresh"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 py-4">
        {/* Conditional layout based on step count */}
        {steps.length <= 1 ? (
          /* Compact single-step layout */
          <div className="space-y-4">
            {/* Job Configuration */}
            <section className="bg-surface-container/80 backdrop-blur-sm border border-outline-variant/30 rounded-xl overflow-hidden">
              {/* Header */}
              <button
                onClick={() => setIsConfigExpanded(!isConfigExpanded)}
                className="w-full flex items-center justify-between p-4 hover:bg-surface-container-high/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {/* Database type icon */}
                  {steps.length > 0 && (
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                      steps[0].type === 'redshift_query' ? 'bg-gradient-to-br from-orange-500/20 to-orange-600/10 border border-orange-500/30' :
                      steps[0].type === 'sqlserver_query' ? 'bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30' :
                      'bg-gradient-to-br from-violet-500/20 to-violet-600/10 border border-violet-500/30'
                    }`}>
                      <Database className={`w-4 h-4 ${
                        steps[0].type === 'redshift_query' ? 'text-orange-400' :
                        steps[0].type === 'sqlserver_query' ? 'text-blue-400' :
                        'text-violet-400'
                      }`} />
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-semibold text-on-surface">
                        {steps.length > 0 ? steps[0].name : 'Job Configuration'}
                      </h2>
                      {liveSteps[steps[0]?.id]?.status === "running" && (
                        <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                      )}
                      {liveSteps[steps[0]?.id]?.status === "completed" && (
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {steps.length > 0 && (
                        <span className={`text-[10px] font-mono ${
                          steps[0].type === 'redshift_query' ? 'text-orange-400/70' :
                          steps[0].type === 'sqlserver_query' ? 'text-blue-400/70' :
                          'text-violet-400/70'
                        }`}>
                          {steps[0].type === 'redshift_query' ? 'Amazon Redshift' :
                           steps[0].type === 'sqlserver_query' ? 'SQL Server' : 'Merge Query'}
                        </span>
                      )}
                      {steps[0]?.output_table && (
                        <>
                          <span className="text-on-surface-variant/30">→</span>
                          <span className="text-[10px] font-mono text-cyan-400/70">{steps[0].output_table}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {liveSteps[steps[0]?.id]?.rows_processed != null && (
                    <span className="px-2 py-1 rounded-md bg-emerald-500/15 text-emerald-400 text-[10px] font-mono">
                      {liveSteps[steps[0]?.id].rows_processed?.toLocaleString()} rows
                    </span>
                  )}
                  <ChevronDown className={`w-4 h-4 text-on-surface-variant transition-transform duration-200 ${isConfigExpanded ? 'rotate-180' : ''}`} />
                </div>
              </button>
              
              {isConfigExpanded && (
                <div className="border-t border-outline-variant/20">
                  {steps.length === 0 ? (
                    <div className="flex items-center justify-center h-24 m-4 rounded-lg bg-surface-container-high/50 border border-dashed border-outline-variant/30">
                      <span className="text-sm text-on-surface-variant">No steps configured</span>
                    </div>
                  ) : (
                    <>
                      {/* SQL Query */}
                      {steps[0].query && (
                        <div className="bg-zinc-950/50">
                          <div className="flex items-center justify-between px-4 py-2 bg-zinc-900/50 border-b border-zinc-800/50">
                            <div className="flex items-center gap-2">
                              <Code className="w-3.5 h-3.5 text-zinc-500" />
                              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">SQL Query</span>
                            </div>
                          </div>
                          <pre className="p-4 text-xs font-mono text-zinc-300 overflow-x-auto max-h-[180px] overflow-y-auto leading-relaxed">
                            <code>{steps[0].query}</code>
                          </pre>
                        </div>
                      )}

                      {/* Metadata Grid */}
                      <div className="p-4 bg-surface-container-high/30">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                              <User className="w-4 h-4 text-violet-400" />
                            </div>
                            <div>
                              <div className="text-[10px] text-on-surface-variant/60 uppercase tracking-wide">Author</div>
                              <div className="text-xs font-medium text-on-surface">{job.author}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                              <FileOutput className="w-4 h-4 text-cyan-400" />
                            </div>
                            <div>
                              <div className="text-[10px] text-on-surface-variant/60 uppercase tracking-wide">Format</div>
                              <div className="text-xs font-medium text-on-surface">{job.output_format.toUpperCase()}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                              <RotateCcw className="w-4 h-4 text-amber-400" />
                            </div>
                            <div>
                              <div className="text-[10px] text-on-surface-variant/60 uppercase tracking-wide">Retries</div>
                              <div className="text-xs font-medium text-on-surface">{job.max_retries}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                              <Timer className="w-4 h-4 text-emerald-400" />
                            </div>
                            <div>
                              <div className="text-[10px] text-on-surface-variant/60 uppercase tracking-wide">Created</div>
                              <div className="text-xs font-medium text-on-surface">{formatMYDate(job.created_at, { month: "short", day: "numeric", year: "numeric" })}</div>
                            </div>
                          </div>
                        </div>

                        {/* Schedule info */}
                        {hasSchedule && schedulePreview && (
                          <div className="mt-4 pt-4 border-t border-outline-variant/20 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                                <Calendar className="w-4 h-4 text-indigo-400" />
                              </div>
                              <div>
                                <div className="text-[10px] text-on-surface-variant/60 uppercase tracking-wide">Schedule</div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium text-on-surface">{schedulePreview.description}</span>
                                  {cronExpression && (
                                    <code className="px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-400 font-mono text-[10px]">{cronExpression}</code>
                                  )}
                                </div>
                              </div>
                            </div>
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-medium ${
                              jobStatus === "scheduled" ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" :
                              jobStatus === "paused" ? "bg-amber-500/15 text-amber-400 border border-amber-500/30" :
                              "bg-zinc-500/15 text-zinc-400 border border-zinc-500/30"
                            }`}>
                              {jobStatus === "scheduled" ? "ACTIVE" : jobStatus === "paused" ? "PAUSED" : "INACTIVE"}
                            </span>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </section>

            {/* Execution History - full width with pagination */}
            <section className="bg-surface-container/80 backdrop-blur-sm border border-outline-variant/30 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-outline-variant/20">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <h2 className="text-sm font-semibold text-on-surface">Execution History</h2>
                </div>
                <span className="text-[10px] font-mono text-on-surface-variant">{executions.length} runs</span>
              </div>
              {executions.length === 0 ? (
                <div className="text-center py-6 text-on-surface-variant text-sm">No executions yet</div>
              ) : (
                <>
                  {/* Table Header */}
                  <div className="flex items-center gap-3 px-3 py-2 bg-surface-container-high/50 border-b border-outline-variant/20 text-[10px] font-mono text-on-surface-variant/60 uppercase tracking-wider">
                    <div className="w-14 shrink-0">Date</div>
                    <div className="w-24 shrink-0">Start</div>
                    <div className="w-24 shrink-0">End</div>
                    <div className="w-24 shrink-0">Duration</div>
                    <div className="w-20 shrink-0">Status</div>
                    <div className="w-16 shrink-0">Trigger</div>
                    <div className="flex-1">Metrics</div>
                    <div className="w-16 shrink-0 text-right">Actions</div>
                  </div>
                  {/* Table Body */}
                  <div className="divide-y divide-outline-variant/10">
                    {paginatedExecutions.map((exec) => (
                      <ExecutionRow key={exec.id} execution={exec} jobId={job.id} />
                    ))}
                  </div>
                  {totalExecutionPages > 1 && (
                    <div className="flex items-center justify-between p-3 border-t border-outline-variant/20 bg-surface-container-high/30">
                      <span className="text-[10px] font-mono text-on-surface-variant">
                        {(executionCurrentPage - 1) * EXECUTIONS_PER_PAGE + 1}-{Math.min(executionCurrentPage * EXECUTIONS_PER_PAGE, executions.length)} of {executions.length}
                      </span>
                      <Pagination
                        currentPage={executionCurrentPage}
                        totalPages={totalExecutionPages}
                        onPageChange={setExecutionCurrentPage}
                      />
                    </div>
                  )}
                </>
              )}
            </section>
          </div>
        ) : (
          /* Multi-step layout with sidebar */
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* Main column */}
            <div className="lg:col-span-3 space-y-4">
              {/* Workflow */}
              <section className="p-4 bg-surface-container/80 backdrop-blur-sm border border-outline-variant/30 rounded-xl">
                <div className="flex items-center gap-2 mb-4">
                  <Layers className="w-4 h-4 text-violet-400" />
                  <h2 className="text-sm font-semibold text-on-surface">Workflow</h2>
                  <span className="text-[10px] font-mono text-on-surface-variant bg-surface-container-high px-1.5 py-0.5 rounded">{steps.length} steps</span>
                </div>
                <div className="pl-1">
                  {steps.map((step, i) => (
                    <WorkflowStep key={step.id} step={step} index={i} liveStep={liveSteps[step.id]} isLast={i === steps.length - 1} />
                  ))}
                </div>
              </section>

              {/* Execution History */}
              <section className="p-4 bg-surface-container/80 backdrop-blur-sm border border-outline-variant/30 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <h2 className="text-sm font-semibold text-on-surface">Execution History</h2>
                  </div>
                  <span className="text-[10px] font-mono text-on-surface-variant">{executions.length} runs</span>
                </div>
                {executions.length === 0 ? (
                  <div className="text-center py-6 text-on-surface-variant text-sm">No executions yet</div>
                ) : (
                  <>
                    <div className="space-y-1.5 pr-1">
                      {paginatedExecutions.map((exec) => (
                        <ExecutionRow key={exec.id} execution={exec} jobId={job.id} />
                      ))}
                    </div>
                    {totalExecutionPages > 1 && (
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-outline-variant/20">
                        <span className="text-[10px] font-mono text-on-surface-variant">
                          {(executionCurrentPage - 1) * EXECUTIONS_PER_PAGE + 1}-{Math.min(executionCurrentPage * EXECUTIONS_PER_PAGE, executions.length)} of {executions.length}
                        </span>
                        <Pagination
                          currentPage={executionCurrentPage}
                          totalPages={totalExecutionPages}
                          onPageChange={setExecutionCurrentPage}
                        />
                      </div>
                    )}
                  </>
                )}
              </section>
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-2 space-y-4">
              {/* Quick stats */}
              <section className="p-4 bg-surface-container/80 backdrop-blur-sm border border-outline-variant/30 rounded-xl">
                <h2 className="text-sm font-semibold text-on-surface mb-3">Details</h2>
                <div className="grid grid-cols-2 gap-2">
                  <QuickStat icon={User} label="Author" value={job.author} />
                  <QuickStat icon={FileOutput} label="Format" value={job.output_format.toUpperCase()} />
                  <QuickStat icon={RotateCcw} label="Retries" value={job.max_retries} />
                  <QuickStat icon={Timer} label="Last Run" value={job.last_run_time ? formatDuration((job as any).last_run_duration_seconds || 0) : "Never"} />
                </div>
              </section>

              {/* Schedule */}
              {hasSchedule && schedulePreview && (
                <section className="p-4 bg-surface-container/80 backdrop-blur-sm border border-outline-variant/30 rounded-xl">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-on-surface">Schedule</h2>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                      jobStatus === "scheduled" ? "bg-emerald-500/20 text-emerald-400" :
                      jobStatus === "paused" ? "bg-amber-500/20 text-amber-400" :
                      "bg-zinc-500/20 text-zinc-400"
                    }`}>
                      {jobStatus === "scheduled" ? "ACTIVE" : jobStatus === "paused" ? "PAUSED" : "INACTIVE"}
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant mb-3">{schedulePreview.description}</p>
                  <div className="space-y-1.5">
                    {schedulePreview.next_runs.slice(0, 5).map((run, i) => (
                      <div key={i} className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs ${
                        i === 0 ? "bg-indigo-500/15 text-indigo-300" : "bg-surface-container-high text-on-surface-variant"
                      }`}>
                        <span className={`w-4 h-4 rounded text-[10px] font-mono flex items-center justify-center ${
                          i === 0 ? "bg-indigo-500/30" : "bg-surface-container"
                        }`}>{i + 1}</span>
                        <span className="font-mono">{formatMYDate(run, { weekday: "short", month: "short", day: "numeric" })}</span>
                        <span className="font-mono opacity-60">{formatMYTime(run)}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Metadata */}
              <section className="p-4 bg-surface-container/80 backdrop-blur-sm border border-outline-variant/30 rounded-xl">
                <h2 className="text-sm font-semibold text-on-surface mb-3">Metadata</h2>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant">Job ID</span>
                    <span className="font-mono text-on-surface truncate ml-2 max-w-[120px]" title={job.id}>#{job.id.slice(0, 8)}...</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant">Created</span>
                    <span className="font-mono text-on-surface">{formatMYDate(job.created_at)}</span>
                  </div>
                  {job.last_run_time && (
                    <div className="flex justify-between">
                      <span className="text-on-surface-variant">Last Run</span>
                      <span className="font-mono text-on-surface">{formatMYDateTime(job.last_run_time)}</span>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        )}
      </main>

      {/* Edit Job Modal */}
      <EditJobModal
        job={job}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSave={() => {
          loadJob(jobId);
        }}
      />
    </div>
  );
}

function JobDetailPage() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <TooltipProvider delayDuration={300}>
          <JobsProvider>
            <JobDetailContent />
          </JobsProvider>
        </TooltipProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
