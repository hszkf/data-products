/**
 * SQL Server Agent Job Detail Modal
 *
 * Shows job details with tabs for Overview, Steps, Schedules, and History.
 */

import { useState, useEffect } from "react";
import {
  X,
  Clock,
  Calendar,
  Database,
  Code,
  Play,
  Pause,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  User,
  FileText,
  LayoutList,
  History,
  RefreshCw,
  Edit3,
} from "lucide-react";
import {
  AgentJob,
  AgentJobStep,
  AgentJobSchedule,
  AgentJobHistory,
  getAgentJobDetails,
  getAgentJobHistory,
  startAgentJob,
  stopAgentJob,
} from "~/lib/jobs-api";
import { useToast } from "~/components/ui/toast-provider";
import { formatMYDateTime, formatMYDateTimeShort, formatLocalDateTimeShort } from "~/lib/date-utils";

interface AgentJobDetailModalProps {
  jobName: string | null;
  onClose: () => void;
  onRefresh?: () => void;
}

type TabType = "overview" | "steps" | "schedules" | "history";

// Status badge component
function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-[10px] text-on-surface-variant/50">—</span>;

  const config: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    Succeeded: { bg: "bg-emerald-500/15", text: "text-emerald-400", icon: <CheckCircle className="w-2.5 h-2.5" /> },
    Failed: { bg: "bg-rose-500/15", text: "text-rose-400", icon: <XCircle className="w-2.5 h-2.5" /> },
    Running: { bg: "bg-amber-500/15", text: "text-amber-400", icon: <Loader2 className="w-2.5 h-2.5 animate-spin" /> },
    Retry: { bg: "bg-orange-500/15", text: "text-orange-400", icon: <RefreshCw className="w-2.5 h-2.5" /> },
    Cancelled: { bg: "bg-zinc-500/15", text: "text-zinc-400", icon: <XCircle className="w-2.5 h-2.5" /> },
    'In Progress': { bg: "bg-amber-500/15", text: "text-amber-400", icon: <Loader2 className="w-2.5 h-2.5 animate-spin" /> },
    Idle: { bg: "bg-zinc-500/15", text: "text-zinc-400", icon: <Clock className="w-2.5 h-2.5" /> },
  };

  const c = config[status] || config.Idle;

  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono ${c.bg} ${c.text}`}>
      {c.icon}
      {status}
    </span>
  );
}

// Tab button component
function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
  count
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-all
        border-b-2 -mb-px
        ${active
          ? "border-cyan-500 text-cyan-400"
          : "border-transparent text-on-surface-variant hover:text-on-surface hover:border-outline-variant/50"
        }
      `}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
      {count !== undefined && count > 0 && (
        <span className={`text-[9px] px-1 py-0.5 rounded-full font-mono ${
          active ? "bg-cyan-500/20 text-cyan-400" : "bg-surface-container-high text-on-surface-variant"
        }`}>
          {count}
        </span>
      )}
    </button>
  );
}

// Overview tab content
function OverviewTab({ job }: { job: AgentJob }) {
  return (
    <div className="p-3 space-y-2">
      {/* Status & Basic Info */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-2 rounded-lg bg-surface-container-high/50">
          <div className="text-[9px] uppercase tracking-wider text-on-surface-variant/60 mb-0.5">Status</div>
          <StatusBadge status={job.current_status} />
        </div>
        <div className="p-2 rounded-lg bg-surface-container-high/50">
          <div className="text-[9px] uppercase tracking-wider text-on-surface-variant/60 mb-0.5">Enabled</div>
          <span className={`text-xs font-medium ${job.enabled ? "text-emerald-400" : "text-zinc-400"}`}>
            {job.enabled ? "Yes" : "No"}
          </span>
        </div>
      </div>

      {/* Description */}
      {job.description && (
        <div className="p-2 rounded-lg bg-surface-container-high/50">
          <div className="text-[9px] uppercase tracking-wider text-on-surface-variant/60 mb-0.5">Description</div>
          <p className="text-[11px] text-on-surface">{job.description}</p>
        </div>
      )}

      {/* Metadata */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-2 rounded-lg bg-surface-container-high/50">
          <div className="text-[9px] uppercase tracking-wider text-on-surface-variant/60 mb-0.5">Owner</div>
          <div className="flex items-center gap-1.5">
            <User className="w-3 h-3 text-violet-400" />
            <span className="text-[11px] text-on-surface">{job.owner}</span>
          </div>
        </div>
        <div className="p-2 rounded-lg bg-surface-container-high/50">
          <div className="text-[9px] uppercase tracking-wider text-on-surface-variant/60 mb-0.5">Category</div>
          <span className="text-[11px] text-on-surface">{job.category}</span>
        </div>
      </div>

      {/* Last Run Info */}
      <div className="p-2 rounded-lg bg-surface-container-high/50">
        <div className="text-[9px] uppercase tracking-wider text-on-surface-variant/60 mb-1">Last Execution</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
          <div>
            <span className="text-on-surface-variant/60">Date:</span>{" "}
            <span className="text-on-surface font-mono">{job.last_run_date || "—"}</span>
          </div>
          <div>
            <span className="text-on-surface-variant/60">Time:</span>{" "}
            <span className="text-on-surface font-mono">{job.last_run_time || "—"}</span>
          </div>
          <div>
            <span className="text-on-surface-variant/60">Status:</span>{" "}
            <StatusBadge status={job.last_run_status} />
          </div>
          <div>
            <span className="text-on-surface-variant/60">Duration:</span>{" "}
            <span className="text-cyan-400 font-mono">{job.last_run_duration || "—"}</span>
          </div>
        </div>
      </div>

      {/* Next Run */}
      {job.next_run_date && job.next_run_time && (
        <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/30">
          <div className="text-[9px] uppercase tracking-wider text-indigo-400/60 mb-0.5">Next Scheduled Run</div>
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3 h-3 text-indigo-400" />
            <span className="text-[11px] font-mono text-indigo-300">{job.next_run_date} {job.next_run_time}</span>
          </div>
        </div>
      )}

      {/* Timestamps */}
      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <div>
          <span className="text-on-surface-variant/60">Created:</span>{" "}
          <span className="text-on-surface font-mono">{formatLocalDateTimeShort(job.date_created)}</span>
        </div>
        <div>
          <span className="text-on-surface-variant/60">Modified:</span>{" "}
          <span className="text-on-surface font-mono">{formatLocalDateTimeShort(job.date_modified)}</span>
        </div>
      </div>
    </div>
  );
}

// Steps tab content
function StepsTab({ steps }: { steps: AgentJobStep[] }) {
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  if (steps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-on-surface-variant">
        <Code className="w-6 h-6 mb-1.5 opacity-40" />
        <p className="text-xs">No steps configured for this job</p>
      </div>
    );
  }

  return (
    <div className="p-2.5 space-y-1.5">
      {steps.map((step) => (
        <div
          key={step.step_id}
          className="bg-surface-container-high/50 rounded-md overflow-hidden border border-outline-variant/30"
        >
          {/* Step Header */}
          <button
            onClick={() => setExpandedStep(expandedStep === step.step_id ? null : step.step_id)}
            className="w-full flex items-center gap-2 p-2 hover:bg-surface-container-high transition-colors"
          >
            <div className="w-5 h-5 rounded bg-blue-500/20 flex items-center justify-center text-blue-400 font-mono text-[10px] font-bold">
              {step.step_id}
            </div>
            <div className="flex-1 text-left">
              <div className="text-xs font-medium text-on-surface">{step.step_name}</div>
              <div className="text-[9px] text-on-surface-variant/60 font-mono">
                {step.subsystem} → {step.database_name}
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-[9px] text-on-surface-variant/60">
              {step.retry_attempts > 0 && (
                <span className="px-1 py-0.5 rounded bg-amber-500/15 text-amber-400">
                  Retries: {step.retry_attempts}
                </span>
              )}
            </div>
          </button>

          {/* Step Details */}
          {expandedStep === step.step_id && (
            <div className="border-t border-outline-variant/30">
              <div className="bg-zinc-950/50">
                <div className="flex items-center justify-between px-2 py-1.5 bg-zinc-900/50 border-b border-zinc-800/50">
                  <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider">Command</span>
                </div>
                <pre className="p-2 text-[10px] font-mono text-zinc-300 overflow-x-auto max-h-[200px] overflow-y-auto whitespace-pre-wrap">
                  <code>{step.command || "No command"}</code>
                </pre>
              </div>
              <div className="p-2 bg-surface-container-high/30 grid grid-cols-2 gap-2 text-[10px]">
                <div>
                  <span className="text-on-surface-variant/60">On Success:</span>{" "}
                  <span className="text-emerald-400">
                    {step.on_success_action === 1 ? "Quit Success" :
                     step.on_success_action === 2 ? "Quit Failure" :
                     step.on_success_action === 3 ? "Next Step" :
                     step.on_success_action === 4 ? "Go to Step..." : `Action ${step.on_success_action}`}
                  </span>
                </div>
                <div>
                  <span className="text-on-surface-variant/60">On Failure:</span>{" "}
                  <span className="text-rose-400">
                    {step.on_fail_action === 1 ? "Quit Success" :
                     step.on_fail_action === 2 ? "Quit Failure" :
                     step.on_fail_action === 3 ? "Next Step" :
                     step.on_fail_action === 4 ? "Go to Step..." : `Action ${step.on_fail_action}`}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Schedules tab content
function SchedulesTab({ schedules }: { schedules: AgentJobSchedule[] }) {
  if (schedules.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-on-surface-variant">
        <Calendar className="w-6 h-6 mb-1.5 opacity-40" />
        <p className="text-xs">No schedules configured for this job</p>
      </div>
    );
  }

  return (
    <div className="p-2.5 space-y-2">
      {schedules.map((schedule) => (
        <div
          key={schedule.schedule_id}
          className="p-2.5 bg-surface-container-high/50 rounded-md border border-outline-variant/30"
        >
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3 h-3 text-indigo-400" />
              <span className="text-xs font-medium text-on-surface">{schedule.schedule_name}</span>
            </div>
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono ${
              schedule.enabled
                ? "bg-emerald-500/15 text-emerald-400"
                : "bg-zinc-500/15 text-zinc-400"
            }`}>
              {schedule.enabled ? "ON" : "OFF"}
            </span>
          </div>

          <p className="text-[10px] text-on-surface-variant mb-2">{schedule.schedule_description}</p>

          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div>
              <span className="text-on-surface-variant/60">Frequency:</span>{" "}
              <span className="text-on-surface">{schedule.freq_type}</span>
            </div>
            <div>
              <span className="text-on-surface-variant/60">Interval:</span>{" "}
              <span className="text-on-surface">{schedule.freq_interval}</span>
            </div>
            {schedule.next_run_date && schedule.next_run_date > 0 && (
              <div className="col-span-2">
                <span className="text-on-surface-variant/60">Next Run:</span>{" "}
                <span className="text-indigo-400 font-mono">
                  {schedule.next_run_date} {schedule.next_run_time}
                </span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// History tab content
function HistoryTab({ history, isLoading }: { history: AgentJobHistory[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <Loader2 className="w-5 h-5 text-cyan-400 animate-spin mb-1.5" />
        <p className="text-xs text-on-surface-variant">Loading history...</p>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-on-surface-variant">
        <History className="w-6 h-6 mb-1.5 opacity-40" />
        <p className="text-xs">No execution history available</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[10px]">
        <thead>
          <tr className="border-b border-outline-variant/30 bg-surface-container-high/50">
            <th className="text-left py-1.5 px-2 font-semibold text-on-surface-variant">Date</th>
            <th className="text-left py-1.5 px-2 font-semibold text-on-surface-variant">Time</th>
            <th className="text-left py-1.5 px-2 font-semibold text-on-surface-variant">Step</th>
            <th className="text-left py-1.5 px-2 font-semibold text-on-surface-variant">Status</th>
            <th className="text-left py-1.5 px-2 font-semibold text-on-surface-variant">Duration</th>
            <th className="text-left py-1.5 px-2 font-semibold text-on-surface-variant">Message</th>
          </tr>
        </thead>
        <tbody>
          {history.map((entry, index) => (
            <tr
              key={index}
              className={`border-b border-outline-variant/15 hover:bg-surface-container-high/30 ${
                entry.step_id === 0 ? "bg-surface-container-high/20" : ""
              }`}
            >
              <td className="py-1 px-2 font-mono text-on-surface whitespace-nowrap">
                {entry.run_date || "—"}
              </td>
              <td className="py-1 px-2 font-mono text-on-surface whitespace-nowrap">
                {entry.run_time || "—"}
              </td>
              <td className="py-1 px-2">
                <span className={`${entry.step_id === 0 ? "text-on-surface font-medium" : "text-on-surface-variant"}`}>
                  {entry.step_name}
                </span>
              </td>
              <td className="py-1 px-2">
                <StatusBadge status={entry.status} />
              </td>
              <td className="py-1 px-2 font-mono text-cyan-400 whitespace-nowrap">
                {entry.run_duration || "—"}
              </td>
              <td className="py-1 px-2 text-on-surface-variant max-w-[200px] truncate" title={entry.message}>
                {entry.message}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AgentJobDetailModal({ jobName, onClose, onRefresh }: AgentJobDetailModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [job, setJob] = useState<AgentJob | null>(null);
  const [history, setHistory] = useState<AgentJobHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const { showToast } = useToast();

  // Load job details
  useEffect(() => {
    if (!jobName) return;

    setIsLoading(true);
    getAgentJobDetails(jobName)
      .then((result) => {
        setJob(result.job);
      })
      .catch((err) => {
        showToast(`Failed to load job: ${err.message}`, "error");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [jobName, showToast]);

  // Load history when switching to history tab
  useEffect(() => {
    if (activeTab !== "history" || !jobName || history.length > 0) return;

    setIsHistoryLoading(true);
    getAgentJobHistory(jobName, 100)
      .then((result) => {
        setHistory(result.history);
      })
      .catch((err) => {
        showToast(`Failed to load history: ${err.message}`, "error");
      })
      .finally(() => {
        setIsHistoryLoading(false);
      });
  }, [activeTab, jobName, history.length, showToast]);

  const handleStartJob = async () => {
    if (!jobName) return;
    setIsActionLoading(true);
    try {
      await startAgentJob(jobName);
      showToast("Job started successfully", "success");
      onRefresh?.();
    } catch (err: any) {
      showToast(`Failed to start job: ${err.message}`, "error");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleStopJob = async () => {
    if (!jobName) return;
    setIsActionLoading(true);
    try {
      await stopAgentJob(jobName);
      showToast("Job stopped", "info");
      onRefresh?.();
    } catch (err: any) {
      showToast(`Failed to stop job: ${err.message}`, "error");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!jobName) return;
    setIsLoading(true);
    try {
      const result = await getAgentJobDetails(jobName);
      setJob(result.job);
      // Also refresh history if on that tab
      if (activeTab === "history") {
        const historyResult = await getAgentJobHistory(jobName, 100);
        setHistory(historyResult.history);
      }
      onRefresh?.();
    } catch (err: any) {
      showToast(`Failed to refresh: ${err.message}`, "error");
    } finally {
      setIsLoading(false);
    }
  };

  if (!jobName) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-3xl max-h-[85vh] bg-surface border border-outline-variant/50 rounded-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 bg-surface-container border-b border-outline-variant/30">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-sqlserver/20 to-blue-600/10 border border-sqlserver/30 flex items-center justify-center">
              <Database className="w-3.5 h-3.5 text-sqlserver" />
            </div>
            <div>
              <h2 className="text-xs font-semibold text-on-surface">{jobName}</h2>
              <span className="text-[9px] text-on-surface-variant/60 font-mono">SQL Server Agent Job</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Actions */}
            {job && (
              <>
                {job.current_status === "Running" ? (
                  <button
                    onClick={handleStopJob}
                    disabled={isActionLoading}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 text-[10px] font-medium disabled:opacity-50"
                  >
                    {isActionLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Pause className="w-3 h-3" />}
                    Stop
                  </button>
                ) : (
                  <button
                    onClick={handleStartJob}
                    disabled={isActionLoading}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 text-[10px] font-medium disabled:opacity-50"
                  >
                    {isActionLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                    Start
                  </button>
                )}
              </>
            )}

            {/* Edit */}
            <a
              href={`/jobs/agent/new?edit=${encodeURIComponent(jobName)}`}
              onClick={onClose}
            >
              <button className="inline-flex items-center gap-1 px-2 py-1 rounded bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 text-[10px] font-medium">
                <Edit3 className="w-3 h-3" />
                Edit
              </button>
            </a>

            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="p-1.5 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-outline-variant/30 bg-surface-container/50">
          <TabButton
            active={activeTab === "overview"}
            onClick={() => setActiveTab("overview")}
            icon={FileText}
            label="Overview"
          />
          <TabButton
            active={activeTab === "steps"}
            onClick={() => setActiveTab("steps")}
            icon={LayoutList}
            label="Steps"
            count={job?.steps?.length}
          />
          <TabButton
            active={activeTab === "schedules"}
            onClick={() => setActiveTab("schedules")}
            icon={Calendar}
            label="Schedules"
            count={job?.schedules?.length}
          />
          <TabButton
            active={activeTab === "history"}
            onClick={() => setActiveTab("history")}
            icon={History}
            label="History"
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {isLoading && !job ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="w-5 h-5 text-cyan-400 animate-spin mb-1.5" />
              <p className="text-xs text-on-surface-variant">Loading job details...</p>
            </div>
          ) : job ? (
            <>
              {activeTab === "overview" && <OverviewTab job={job} />}
              {activeTab === "steps" && <StepsTab steps={job.steps || []} />}
              {activeTab === "schedules" && <SchedulesTab schedules={job.schedules || []} />}
              {activeTab === "history" && <HistoryTab history={history} isLoading={isHistoryLoading} />}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-on-surface-variant">
              <AlertTriangle className="w-5 h-5 mb-1.5 opacity-40" />
              <p className="text-xs">Failed to load job details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
