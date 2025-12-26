import { createFileRoute, Link, useSearch, useNavigate } from '@tanstack/react-router';
import React, { useState, useMemo, useRef } from "react";
import { JobsProvider, useJobs } from "~/components/jobs/JobsProvider";
import { ConfirmModal, ConfirmModalVariant } from "~/components/ui/confirm-modal";
import { ToastProvider, useToast } from "~/components/ui/toast-provider";
import { ThemeProvider } from "~/lib/theme-context";
import { TooltipProvider } from "~/components/ui/tooltip";
import { Job, formatSchedule } from "~/lib/jobs-api";
import { useInterval } from "~/lib/hooks";
import {
  Plus,
  RefreshCw,
  Search,
  Play,
  Pause,
  Trash2,
  Clock,
  Calendar,
  ChevronRight,
  Database,
  LayoutGrid,
  LayoutList,
  Filter,
  Activity,
  XCircle,
  Timer,
  Layers,
  User,
  Power,
  Code,
  Zap,
  CheckCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { StudioNav } from "~/components/studio-nav";

export const Route = createFileRoute('/jobs/')({
  component: JobsIndexPage,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      created: search.created as string | undefined,
    };
  },
});

// Malaysia timezone helper
const MALAYSIA_TZ = 'Asia/Kuala_Lumpur';

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

// Format with seconds and milliseconds for Last Run columns
function formatMYDateTimeWithMs(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const dateStr = d.toLocaleDateString('en-MY', { 
    timeZone: MALAYSIA_TZ, 
    month: 'short', 
    day: 'numeric'
  });
  const timeStr = d.toLocaleTimeString('en-MY', { 
    timeZone: MALAYSIA_TZ, 
    hour: '2-digit', 
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const ms = d.getMilliseconds().toString().padStart(3, '0');
  return `${dateStr} ${timeStr}.${ms}`;
}

// Author options
const authorOptions = [
  { value: "hasif", label: "Hasif" },
  { value: "nazierul", label: "Nazierul" },
  { value: "izhar", label: "Izhar" },
  { value: "asyraff", label: "Asyraff" },
  { value: "bob", label: "Bob" },
  { value: "ernie", label: "Ernie" },
  { value: "yee_ming", label: "Yee Ming" },
];

// Active/Inactive badge
function ActiveBadge({ isActive }: { isActive: boolean }) {
  return (
    <span className={`
      inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-medium uppercase tracking-wider
      ${isActive
        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
        : "bg-zinc-500/10 text-zinc-400 border border-zinc-500/30"
      }
      transition-all duration-300
    `}>
      <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-emerald-400" : "bg-zinc-400"}`} />
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}

// Job type badge
function JobTypeBadge({ jobType }: { jobType: string }) {
  const isWorkflow = jobType === "workflow";
  return (
    <span className={`
      inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono
      ${isWorkflow
        ? "bg-blue-500/10 text-blue-400 border border-blue-500/30"
        : "bg-purple-500/10 text-purple-400 border border-purple-500/30"
      }
    `}>
      {isWorkflow ? <Database className="w-3 h-3" /> : <Code className="w-3 h-3" />}
      {jobType}
    </span>
  );
}

// Step type indicator
function StepTypeIndicator({ type }: { type: string }) {
  const colours: Record<string, { bg: string; text: string; label: string }> = {
    redshift_query: { bg: "bg-redshift/20", text: "text-redshift", label: "RS" },
    sqlserver_query: { bg: "bg-sqlserver/20", text: "text-sqlserver", label: "SQL" },
    merge: { bg: "bg-violet-500/20", text: "text-violet-400", label: "MRG" },
  };
  const config = colours[type] || { bg: "bg-zinc-500/20", text: "text-zinc-400", label: "?" };

  return (
    <span className={`inline-flex items-center justify-center w-7 h-5 rounded text-[10px] font-mono font-bold ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
}

// Last run status badge
function LastRunStatusBadge({ status }: { status?: string }) {
  if (!status) {
    return <span className="text-xs text-on-surface-variant/50">—</span>;
  }

  const config: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    completed: { 
      bg: "bg-emerald-500/15", 
      text: "text-emerald-400",
      icon: <CheckCircle className="w-3 h-3" />
    },
    failed: { 
      bg: "bg-rose-500/15", 
      text: "text-rose-400",
      icon: <XCircle className="w-3 h-3" />
    },
    running: { 
      bg: "bg-amber-500/15", 
      text: "text-amber-400",
      icon: <Loader2 className="w-3 h-3 animate-spin" />
    },
    pending: { 
      bg: "bg-blue-500/15", 
      text: "text-blue-400",
      icon: <Clock className="w-3 h-3" />
    },
    cancelled: { 
      bg: "bg-zinc-500/15", 
      text: "text-zinc-400",
      icon: <XCircle className="w-3 h-3" />
    },
  };
  
  const c = config[status] || { bg: "bg-zinc-500/15", text: "text-zinc-400", icon: <AlertCircle className="w-3 h-3" /> };
  
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono uppercase ${c.bg} ${c.text}`}>
      {c.icon}
      {status}
    </span>
  );
}

// Action button component
function ActionButton({
  onClick,
  icon: Icon,
  label,
  variant = "default",
  disabled = false
}: {
  onClick: () => void;
  icon: React.ElementType;
  label: string;
  variant?: "default" | "success" | "warning" | "danger";
  disabled?: boolean;
}) {
  const variants = {
    default: "hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface",
    success: "hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300",
    warning: "hover:bg-amber-500/20 text-amber-400 hover:text-amber-300",
    danger: "hover:bg-rose-500/20 text-rose-400 hover:text-rose-300",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`
        p-2 rounded-lg transition-all duration-200
        ${variants[variant]}
        disabled:opacity-40 disabled:cursor-not-allowed
        active:scale-95
      `}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}

// Job card for grid view - Compact design
function JobCard({
  job,
  onRun,
  onToggle,
  onDelete,
  onRequestConfirm
}: {
  job: Job;
  onRun: (id: string) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onRequestConfirm: (action: string, job: Job, variant: ConfirmModalVariant) => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const stepTypes = useMemo(() => {
    return job.workflow_definition?.steps?.map(s => s.type) || [];
  }, [job.workflow_definition?.steps]);

  return (
    <div
      className="group relative bg-surface-container border border-outline-variant/40 rounded-lg overflow-hidden
                 hover:border-outline/50 hover:shadow-md transition-all duration-200"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="p-3">
        {/* Header row - Name + Status + Actions */}
        <div className="flex items-center gap-2 mb-2">
          {/* Status dot */}
          <div className={`w-2 h-2 rounded-full shrink-0 ${
            job.is_active ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]' : 'bg-zinc-500'
          }`} />
          
          {/* Job name */}
          <Link
            to={`/jobs/${job.id}`}
            className="flex-1 text-sm font-medium text-on-surface hover:text-cyan-400 transition-colors truncate"
          >
            {job.job_name}
          </Link>

          {/* Step type indicators */}
          {job.job_type === "workflow" && stepTypes.length > 0 && (
            <div className="flex items-center gap-0.5 shrink-0">
              {stepTypes.slice(0, 2).map((type, i) => (
                <StepTypeIndicator key={i} type={type} />
              ))}
              {stepTypes.length > 2 && (
                <span className="text-[9px] font-mono text-on-surface-variant ml-0.5">+{stepTypes.length - 2}</span>
              )}
            </div>
          )}

          {/* Quick actions - always visible but subtle */}
          <div className={`flex items-center gap-0.5 shrink-0 transition-opacity duration-150 ${
            showActions ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}>
            <button
              onClick={() => onRun(job.id)}
              title="Run Now"
              className="p-1 rounded text-emerald-400/70 hover:text-emerald-400 hover:bg-emerald-500/15 transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onToggle(job.id)}
              title={job.is_active ? "Deactivate" : "Activate"}
              className="p-1 rounded text-amber-400/70 hover:text-amber-400 hover:bg-amber-500/15 transition-colors"
            >
              {job.is_active ? <Pause className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => onRequestConfirm("delete", job, "danger")}
              title="Delete"
              className="p-1 rounded text-rose-400/70 hover:text-rose-400 hover:bg-rose-500/15 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Info row - Schedule + Author + Last run */}
        <div className="flex items-center gap-3 text-[11px] font-mono text-on-surface-variant">
          {/* Schedule */}
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-cyan-400/60" />
            <span className="text-cyan-400/80">{formatSchedule(job.schedule_type, job.schedule_config)}</span>
          </div>

          {/* Author */}
          {job.author && (
            <div className="flex items-center gap-1">
              <User className="w-3 h-3 text-violet-400/60" />
              <span className="text-violet-400/80 capitalize truncate max-w-[80px]">{job.author.replace("_", " ")}</span>
            </div>
          )}

          {/* Last run status */}
          {job.last_run_status && (
            <LastRunStatusBadge status={job.last_run_status} />
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Next run (if active) */}
          {job.is_active && job.next_run_time && (
            <span className="text-[10px] text-on-surface-variant/60">
              Next: {new Date(job.next_run_time).toLocaleString('en-MY', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// Job row for table view
function JobRow({
  job,
  onRun,
  onToggle,
  onDelete,
  onRequestConfirm
}: {
  job: Job;
  onRun: (id: string) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onRequestConfirm: (action: string, job: Job, variant: ConfirmModalVariant) => void;
}) {
  return (
    <tr className="group border-b border-outline-variant/30 hover:bg-surface-container-high/50 transition-colors">
      {/* Job Name */}
      <td className="py-4 px-4">
        <Link
          to={`/jobs/${job.id}`}
          className="flex items-center gap-3 text-on-surface hover:text-cyan-400 transition-colors"
        >
          <div className={`
            w-2 h-2 rounded-full shrink-0
            ${job.is_active ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.4)]' : 'bg-zinc-500'}
          `} />
          <span className="font-medium truncate max-w-[200px]">{job.job_name}</span>
        </Link>
      </td>

      {/* Type */}
      <td className="py-4 px-4">
        <JobTypeBadge jobType={job.job_type} />
      </td>

      {/* Status */}
      <td className="py-4 px-4">
        <ActiveBadge isActive={job.is_active} />
      </td>

      {/* Author */}
      <td className="py-4 px-4">
        {job.author ? (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center">
              <User className="w-3 h-3 text-violet-400" />
            </div>
            <span className="text-sm text-on-surface capitalize">{job.author.replace("_", " ")}</span>
          </div>
        ) : (
          <span className="text-xs text-on-surface-variant/50">—</span>
        )}
      </td>

      {/* Last Run Start */}
      <td className="py-4 px-4">
        {job.last_run_started_at ? (
          <div className="text-xs font-mono text-on-surface-variant">
            {formatMYDateTimeWithMs(job.last_run_started_at)}
          </div>
        ) : (
          <span className="text-xs text-on-surface-variant/50">—</span>
        )}
      </td>

      {/* Last Run End */}
      <td className="py-4 px-4">
        {job.last_run_completed_at ? (
          <div className="text-xs font-mono text-on-surface-variant">
            {formatMYDateTimeWithMs(job.last_run_completed_at)}
          </div>
        ) : (
          <span className="text-xs text-on-surface-variant/50">—</span>
        )}
      </td>

      {/* Last Run Status */}
      <td className="py-4 px-4">
        <LastRunStatusBadge status={job.last_run_status} />
      </td>

      {/* Schedule */}
      <td className="py-4 px-4">
        <code className="text-xs font-mono text-cyan-400/90 bg-cyan-500/10 px-2 py-1 rounded">
          {formatSchedule(job.schedule_type, job.schedule_config)}
        </code>
      </td>

      {/* Actions */}
      <td className="py-4 px-4">
        <div className="flex items-center gap-1 justify-end">
          <ActionButton onClick={() => onRun(job.id)} icon={Play} label="Run Now" variant="success" />
          <ActionButton
            onClick={() => onToggle(job.id)}
            icon={job.is_active ? Pause : Power}
            label={job.is_active ? "Deactivate" : "Activate"}
            variant="warning"
          />
          <ActionButton
            onClick={() => onRequestConfirm("delete", job, "danger")}
            icon={Trash2}
            label="Delete"
            variant="danger"
          />
        </div>
      </td>
    </tr>
  );
}

// Stats card
function StatCard({ icon: Icon, label, value, colour }: {
  icon: React.ElementType;
  label: string;
  value: number;
  colour: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-surface-container border border-outline-variant/40 rounded-xl">
      <div className={`p-2 rounded-lg ${colour}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <div className="text-xl font-bold font-mono text-on-surface">{value}</div>
        <div className="text-xs text-on-surface-variant">{label}</div>
      </div>
    </div>
  );
}

// Empty state
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6">
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-violet-500/20 border border-cyan-500/30 flex items-center justify-center mb-6">
        <Database className="w-10 h-10 text-cyan-400/70" />
      </div>
      <h3 className="text-xl font-semibold text-on-surface mb-2">No jobs configured</h3>
      <p className="text-on-surface-variant text-center max-w-md mb-6">
        Create your first scheduled job to automate SQL queries or run registered functions.
      </p>
      <Link to="/jobs/new">
        <button className="
          inline-flex items-center gap-2 px-5 py-2.5
          bg-gradient-to-r from-cyan-500 to-cyan-600 text-white
          rounded-xl font-semibold text-sm
          hover:from-cyan-400 hover:to-cyan-500
          shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40
          transition-all duration-200 active:scale-[0.98]
        ">
          <Plus className="w-4 h-4" />
          Create First Job
        </button>
      </Link>
    </div>
  );
}

function JobsHeader() {
  const { isLoading, isPolling, loadJobs, syncAllSchedules, startPolling, stopPolling } = useJobs();

  return (
    <header className="bg-surface-container/80 backdrop-blur-sm border-b border-outline-variant/50 sticky top-0 z-20">
      {/* Navigation Bar */}
      <div className="px-6 py-3 border-b border-outline-variant/30">
        <StudioNav />
      </div>

      {/* Page Header */}
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Calendar className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-on-surface">
              Job Scheduler
            </h1>
            <p className="text-xs text-on-surface-variant font-mono">
              Automated workflows & functions
              {isPolling && (
                <span className="ml-2 text-cyan-400/70">
                  <span className="inline-block w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse mr-1" />
                  live
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Sync Schedules button */}
          <button
            onClick={syncAllSchedules}
            title="Sync schedules with server"
            className="p-2.5 rounded-lg text-on-surface-variant hover:text-amber-400 hover:bg-amber-500/10 transition-all"
          >
            <Calendar className="w-5 h-5" />
          </button>

          {/* Toggle Polling */}
          <button
            onClick={() => isPolling ? stopPolling() : startPolling()}
            title={isPolling ? "Disable auto-refresh" : "Enable auto-refresh"}
            className={`p-2.5 rounded-lg transition-all ${
              isPolling
                ? "text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20"
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
            }`}
          >
            <Activity className="w-5 h-5" />
          </button>

          {/* Refresh */}
          <button
            onClick={() => loadJobs()}
            disabled={isLoading}
            className="p-2.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${isLoading ? "animate-spin" : ""}`} />
          </button>

          <Link to="/jobs/new">
            <button className="
              inline-flex items-center gap-2 px-4 py-2.5
              bg-surface-container-high text-on-surface
              border border-outline-variant/50
              rounded-xl font-semibold text-sm
              hover:bg-surface-container-highest hover:border-outline/50
              transition-all duration-200 active:scale-[0.98]
            ">
              <Plus className="w-4 h-4" />
              New Job
            </button>
          </Link>
        </div>
      </div>
    </header>
  );
}

function JobsPageContent() {
  const {
    jobs,
    isLoading,
    isPolling,
    loadJobs,
    triggerJob,
    toggleJobActive,
    deleteExistingJob,
    startPolling,
    stopPolling,
  } = useJobs();
  const { showToast } = useToast();
  const { created } = useSearch({ from: '/jobs/' });
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [authorFilter, setAuthorFilter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "table">("table");

  // Track if we've handled the created param
  const hasHandledCreated = useRef(false);
  
  // Clear the search param when redirected from job creation (no toast needed)
  // Using ref to handle this synchronously without useEffect
  if (created && !hasHandledCreated.current) {
    hasHandledCreated.current = true;
    // Schedule navigation for next tick to avoid render issues
    queueMicrotask(() => {
      navigate({ to: '/jobs', search: {}, replace: true });
    });
  } else if (!created) {
    hasHandledCreated.current = false;
  }

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    action: string;
    job: Job | null;
    variant: ConfirmModalVariant;
  }>({
    open: false,
    action: "",
    job: null,
    variant: "danger",
  });

  // Initial load - using ref to ensure it only happens once
  const hasInitiallyLoaded = useRef(false);
  if (!hasInitiallyLoaded.current) {
    hasInitiallyLoaded.current = true;
    loadJobs();
    startPolling(5000);
  }

  // Use custom interval hook for polling instead of useEffect
  useInterval(() => {
    // Polling is handled by the provider, this is just for UI updates
  }, isPolling ? 5000 : null);

  // Confirmation modal handlers
  const handleRequestConfirm = (action: string, job: Job, variant: ConfirmModalVariant) => {
    setConfirmModal({
      open: true,
      action,
      job,
      variant,
    });
  };

  const handleCloseConfirmModal = () => {
    setConfirmModal({
      open: false,
      action: "",
      job: null,
      variant: "danger",
    });
  };

  const handleConfirmAction = () => {
    if (!confirmModal.job) return;

    switch (confirmModal.action) {
      case "delete":
        deleteExistingJob(confirmModal.job.id);
        break;
    }
    handleCloseConfirmModal();
  };

  // Get confirmation modal content based on action
  const getConfirmModalContent = () => {
    if (!confirmModal.job) return { title: "", description: "", confirmText: "" };

    switch (confirmModal.action) {
      case "delete":
        return {
          title: "Delete Job",
          description: `Are you sure you want to delete "${confirmModal.job.job_name}"? This action cannot be undone and all execution history will be lost.`,
          confirmText: "Delete Job",
        };
      default:
        return {
          title: "Confirm Action",
          description: "Are you sure you want to proceed?",
          confirmText: "Confirm",
        };
    }
  };

  const confirmModalContent = getConfirmModalContent();

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const matchesSearch =
        !searchQuery ||
        job.job_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.description?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesType = !typeFilter || job.job_type === typeFilter;

      const matchesActive = activeFilter === null ||
        (activeFilter === "active" && job.is_active) ||
        (activeFilter === "inactive" && !job.is_active);

      const matchesAuthor = !authorFilter || job.author === authorFilter;

      return matchesSearch && matchesType && matchesActive && matchesAuthor;
    });
  }, [jobs, searchQuery, typeFilter, activeFilter, authorFilter]);

  // Stats calculation
  const stats = useMemo(() => ({
    total: jobs.length,
    active: jobs.filter(j => j.is_active).length,
    workflow: jobs.filter(j => j.job_type === 'workflow').length,
    function: jobs.filter(j => j.job_type === 'function').length,
  }), [jobs]);

  const handleRun = async (jobId: string) => {
    await triggerJob(jobId);
  };

  const handleToggle = async (jobId: string) => {
    await toggleJobActive(jobId);
  };

  return (
    <div className="flex flex-col h-screen bg-surface overflow-hidden">
      {/* Subtle background pattern */}
      <div
        className="fixed inset-0 pointer-events-none opacity-40"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 100% 80% at 50% -20%, rgba(34, 211, 238, 0.06), transparent 50%),
            radial-gradient(ellipse 60% 40% at 80% 20%, rgba(139, 92, 246, 0.04), transparent)
          `,
        }}
      />

      {/* Grid pattern overlay */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }}
      />

      <JobsHeader />

      <main className="flex-1 overflow-auto relative">
        <div className="max-w-[1600px] mx-auto px-6 py-6">

          {/* Stats Row */}
          {jobs.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <StatCard icon={Database} label="Total Jobs" value={stats.total} colour="bg-surface-container-high text-on-surface" />
              <StatCard icon={Power} label="Active" value={stats.active} colour="bg-emerald-500/10 text-emerald-400" />
              <StatCard icon={Layers} label="Workflows" value={stats.workflow} colour="bg-blue-500/10 text-blue-400" />
              <StatCard icon={Zap} label="Functions" value={stats.function} colour="bg-purple-500/10 text-purple-400" />
            </div>
          )}

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-4 mb-6 pb-6 border-b border-outline-variant/30">
            {/* Search */}
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/60" />
              <input
                type="text"
                placeholder="Search jobs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="
                  w-full pl-10 pr-4 py-2.5
                  bg-surface-container border border-outline-variant/50 rounded-xl
                  text-on-surface placeholder-on-surface-variant/50
                  text-sm font-mono
                  focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20
                  transition-all duration-200
                "
              />
            </div>

            {/* Type Filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/60 pointer-events-none" />
              <select
                value={typeFilter || ""}
                onChange={(e) => setTypeFilter(e.target.value || null)}
                className="
                  pl-9 pr-8 py-2.5
                  bg-surface-container border border-outline-variant/50 rounded-xl
                  text-on-surface text-sm
                  focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20
                  transition-all duration-200
                  appearance-none cursor-pointer
                "
              >
                <option value="">All Types</option>
                <option value="workflow">Workflow</option>
                <option value="function">Function</option>
              </select>
              <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/60 rotate-90 pointer-events-none" />
            </div>

            {/* Active Filter */}
            <div className="relative">
              <Power className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/60 pointer-events-none" />
              <select
                value={activeFilter || ""}
                onChange={(e) => setActiveFilter(e.target.value || null)}
                className="
                  pl-9 pr-8 py-2.5
                  bg-surface-container border border-outline-variant/50 rounded-xl
                  text-on-surface text-sm
                  focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20
                  transition-all duration-200
                  appearance-none cursor-pointer
                "
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/60 rotate-90 pointer-events-none" />
            </div>

            {/* Author Filter */}
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/60 pointer-events-none" />
              <select
                value={authorFilter || ""}
                onChange={(e) => setAuthorFilter(e.target.value || null)}
                className="
                  pl-9 pr-8 py-2.5
                  bg-surface-container border border-outline-variant/50 rounded-xl
                  text-on-surface text-sm
                  focus:outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20
                  transition-all duration-200
                  appearance-none cursor-pointer
                "
              >
                <option value="">All Authors</option>
                {authorOptions.map((author) => (
                  <option key={author.value} value={author.value}>
                    {author.label}
                  </option>
                ))}
              </select>
              <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/60 rotate-90 pointer-events-none" />
            </div>

            <div className="flex-1" />

            {/* View Toggle */}
            <div className="flex items-center bg-surface-container border border-outline-variant/50 rounded-xl p-1">
              <button
                onClick={() => setViewMode("table")}
                className={`p-2 rounded-lg transition-all ${
                  viewMode === "table"
                    ? "bg-surface-container-high text-on-surface"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                <LayoutList className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 rounded-lg transition-all ${
                  viewMode === "grid"
                    ? "bg-surface-container-high text-on-surface"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>

            {/* Count badge */}
            <div className="text-sm font-mono text-on-surface-variant">
              <span className="text-on-surface font-semibold">{filteredJobs.length}</span>
              <span className="text-on-surface-variant/60"> / {jobs.length} jobs</span>
            </div>
          </div>

          {/* Content */}
          {isLoading && jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-12 h-12 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin mb-4" />
              <span className="text-sm font-mono text-on-surface-variant">Loading jobs...</span>
            </div>
          ) : jobs.length === 0 ? (
            <EmptyState />
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredJobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onRun={handleRun}
                  onToggle={handleToggle}
                  onDelete={deleteExistingJob}
                  onRequestConfirm={handleRequestConfirm}
                />
              ))}
            </div>
          ) : (
            <div className="bg-surface-container border border-outline-variant/50 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-outline-variant/50 bg-surface-container-high/50">
                      <th className="text-left py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Job</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Type</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Status</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Author</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Last Run Start</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Last Run End</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Last Status</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Schedule</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredJobs.map((job) => (
                      <JobRow
                        key={job.id}
                        job={job}
                        onRun={handleRun}
                        onToggle={handleToggle}
                        onDelete={deleteExistingJob}
                        onRequestConfirm={handleRequestConfirm}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredJobs.length === 0 && jobs.length > 0 && (
                <div className="text-center py-12 text-on-surface-variant">
                  <Search className="w-8 h-8 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">No jobs match your search criteria</p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Confirmation Modal */}
      <ConfirmModal
        open={confirmModal.open}
        onOpenChange={(open) => {
          if (!open) handleCloseConfirmModal();
        }}
        onConfirm={handleConfirmAction}
        title={confirmModalContent.title}
        description={confirmModalContent.description}
        confirmText={confirmModalContent.confirmText}
        variant={confirmModal.variant}
      />
    </div>
  );
}

function JobsIndexPage() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <TooltipProvider delayDuration={300}>
          <JobsProvider>
            <JobsPageContent />
          </JobsProvider>
        </TooltipProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
