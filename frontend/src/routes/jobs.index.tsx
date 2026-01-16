import { createFileRoute, Link, useSearch, useNavigate } from '@tanstack/react-router';
import React, { useState, useMemo, useRef } from "react";
import { JobsProvider, useJobs } from "~/components/jobs/JobsProvider";
import { ConfirmModal, ConfirmModalVariant } from "~/components/ui/confirm-modal";
import { ToastProvider, useToast } from "~/components/ui/toast-provider";
import { ThemeProvider } from "~/lib/theme-context";
import { TooltipProvider } from "~/components/ui/tooltip";
import { Job, formatSchedule } from "~/lib/jobs-api";
import { useInterval } from "~/lib/hooks";
import { formatTimestampNoConvert } from "~/lib/date-utils";
import {
  Plus,
  RefreshCw,
  Search,
  Play,
  Pause,
  Trash2,
  Clock,
  Calendar,
  Database,
  Activity,
  XCircle,
  Timer,
  Power,
  Code,
  User,
  CheckCircle,
  AlertCircle,
  Loader2,
  ArrowUp,
  ArrowDown,
  FilterX,
} from "lucide-react";
import { AppHeader } from "~/components/app-header";
import { AgentJobDetailModal } from "~/components/jobs/AgentJobDetailModal";
import { ColumnFilter } from "~/components/ui/column-filter";
import { Calendar as CalendarIcon } from "lucide-react";

export const Route = createFileRoute('/jobs/')({
  component: JobsIndexPage,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      created: search.created as string | undefined,
    };
  },
});


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
      inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-medium uppercase
      ${isActive
        ? "bg-emerald-500/10 text-emerald-400"
        : "bg-zinc-500/10 text-zinc-400"
      }
    `}>
      <span className={`w-1 h-1 rounded-full ${isActive ? "bg-emerald-400" : "bg-zinc-400"}`} />
      {isActive ? "On" : "Off"}
    </span>
  );
}

// Job type badge
function JobTypeBadge({ jobType, isAgentJob }: { jobType: string; isAgentJob?: boolean }) {
  if (isAgentJob) {
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-mono bg-sqlserver/15 text-sqlserver">
        <Database className="w-2.5 h-2.5" />
        Agent
      </span>
    );
  }

  const isWorkflow = jobType === "workflow";
  return (
    <span className={`
      inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-mono
      ${isWorkflow
        ? "bg-blue-500/10 text-blue-400"
        : "bg-purple-500/10 text-purple-400"
      }
    `}>
      {isWorkflow ? <Database className="w-2.5 h-2.5" /> : <Code className="w-2.5 h-2.5" />}
      {isWorkflow ? "WF" : "Fn"}
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

        {/* Info row - Type + Owner + Modified */}
        <div className="flex items-center gap-3 text-[11px] font-mono text-on-surface-variant">
          {/* Type badge */}
          <JobTypeBadge jobType={job.job_type} isAgentJob={(job as any)._isAgentJob} />

          {/* Owner */}
          {job.author && (
            <div className="flex items-center gap-1">
              <User className="w-3 h-3 text-violet-400/60" />
              <span className="text-violet-400/80 truncate max-w-[100px]" title={job.author}>
                {job.author}
              </span>
            </div>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Modified date */}
          {job.updated_at && (
            <span className="text-[10px] text-on-surface-variant/60">
              {formatLocalDateTimeShort(job.updated_at)}
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
  onRequestConfirm,
  onOpenAgentDetail
}: {
  job: Job;
  onRun: (id: string) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onRequestConfirm: (action: string, job: Job, variant: ConfirmModalVariant) => void;
  onOpenAgentDetail?: (jobName: string) => void;
}) {
  const isAgentJob = (job as any)._isAgentJob;
  const agentJobName = (job as any)._agentJobName;

  return (
    <tr className="group border-b border-outline-variant/15 hover:bg-surface-container-high/30 transition-colors">
      {/* Job Name */}
      <td className="py-1 px-2">
        {isAgentJob && onOpenAgentDetail ? (
          <button
            onClick={() => onOpenAgentDetail(agentJobName)}
            className="flex items-center gap-2 text-on-surface hover:text-sqlserver transition-colors text-left"
          >
            <div className={`
              w-1.5 h-1.5 rounded-full shrink-0
              ${job.is_active ? 'bg-emerald-400' : 'bg-zinc-500'}
            `} />
            <span className="text-[11px] font-medium truncate max-w-[300px]">{job.job_name}</span>
          </button>
        ) : (
          <Link
            to={`/jobs/${job.id}`}
            className="flex items-center gap-2 text-on-surface hover:text-sqlserver transition-colors"
          >
            <div className={`
              w-1.5 h-1.5 rounded-full shrink-0
              ${job.is_active ? 'bg-emerald-400' : 'bg-zinc-500'}
            `} />
            <span className="text-[11px] font-medium truncate max-w-[300px]">{job.job_name}</span>
          </Link>
        )}
      </td>

      {/* Status */}
      <td className="py-1 px-2">
        <ActiveBadge isActive={job.is_active} />
      </td>

      {/* Owner */}
      <td className="py-1 px-2">
        {job.author ? (
          <span className="text-[10px] font-mono text-on-surface-variant whitespace-nowrap">
            {job.author}
          </span>
        ) : (
          <span className="text-[10px] text-on-surface-variant/50">—</span>
        )}
      </td>

      {/* Created */}
      <td className="py-1 px-2">
        {job.created_at ? (
          <span className="text-[10px] font-mono text-on-surface-variant whitespace-nowrap">
            {formatTimestampNoConvert(job.created_at)}
          </span>
        ) : (
          <span className="text-[10px] text-on-surface-variant/50">—</span>
        )}
      </td>

      {/* Modified */}
      <td className="py-1 px-2">
        {job.updated_at ? (
          <span className="text-[10px] font-mono text-on-surface-variant whitespace-nowrap">
            {formatTimestampNoConvert(job.updated_at)}
          </span>
        ) : (
          <span className="text-[10px] text-on-surface-variant/50">—</span>
        )}
      </td>

      {/* Last Run */}
      <td className="py-1 px-2">
        {job.last_run_started_at ? (
          <div className="flex flex-col">
            <span className="text-[10px] font-mono text-on-surface-variant whitespace-nowrap">
              {formatTimestampNoConvert(job.last_run_started_at)}
            </span>
            {job.last_run_status && (
              <span className={`text-[9px] font-medium ${
                job.last_run_status === 'completed' ? 'text-emerald-400' :
                job.last_run_status === 'failed' ? 'text-red-400' :
                job.last_run_status === 'running' ? 'text-amber-400' :
                'text-on-surface-variant/60'
              }`}>
                {job.last_run_status}
              </span>
            )}
          </div>
        ) : (
          <span className="text-[10px] text-on-surface-variant/50">—</span>
        )}
      </td>

      {/* Next Run */}
      <td className="py-1 px-2">
        <span className="text-[10px] font-mono text-on-surface-variant whitespace-nowrap">
          {job.next_run_time ? formatTimestampNoConvert(job.next_run_time) : '—'}
        </span>
      </td>

      {/* Success/Fail Counts */}
      <td className="py-1 px-2">
        <div className="flex items-center gap-1.5 text-[11px] font-mono font-medium">
          <span className="text-emerald-400" title="Succeeded">
            {(job as any).success_count ?? 0}
          </span>
          <span className="text-on-surface-variant/40">/</span>
          <span className="text-rose-400" title="Failed">
            {(job as any).fail_count ?? 0}
          </span>
        </div>
      </td>

      {/* Actions */}
      <td className="py-1 px-2">
        <div className="flex items-center gap-0 justify-end">
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
        </div>
      </td>
    </tr>
  );
}

// Stats card - compact
function StatCard({ icon: Icon, label, value, colour }: {
  icon: React.ElementType;
  label: string;
  value: number;
  colour: string;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-surface-container border border-outline-variant/30 rounded-lg">
      <div className={`p-1.5 rounded ${colour}`}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div>
        <div className="text-base font-bold font-mono text-on-surface">{value}</div>
        <div className="text-[10px] text-on-surface-variant">{label}</div>
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

// Jobs sub-navigation tabs
function JobsSubNav() {
  return (
    <div className="flex items-center gap-1 px-4 py-1.5 bg-surface-container-high/30 border-b border-outline-variant/30">
      <Link
        to="/jobs"
        className="px-3 py-1 text-[11px] font-medium rounded-md bg-sqlserver/20 text-sqlserver border border-sqlserver/30"
      >
        Jobs
      </Link>
      <Link
        to="/jobs/executionhistory"
        className="px-3 py-1 text-[11px] font-medium rounded-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-colors"
      >
        Execution History
      </Link>
    </div>
  );
}

function JobsHeader() {
  const { isLoading, isPolling, loadJobs, startPolling, stopPolling } = useJobs();

  return (
    <div className="sticky top-0 z-20">
      {/* App Header with Navigation */}
      <AppHeader
        title="SQL Server Agent"
        icon={Database}
        iconClassName="bg-gradient-to-br from-sqlserver to-blue-600"
      />
      <JobsSubNav />
    </div>
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
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [authorFilter, setAuthorFilter] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedAgentJobName, setSelectedAgentJobName] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<"created_at" | "updated_at" | "last_run_started_at" | "success_count" | "fail_count" | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const itemsPerPage = 15;

  // Check if any filters are active
  const hasActiveFilters = searchQuery || activeFilter || authorFilter;

  // Clear all filters
  const clearAllFilters = () => {
    setSearchQuery("");
    setActiveFilter(null);
    setAuthorFilter(null);
  };

  // Toggle sort for a column
  const toggleSort = (column: "created_at" | "updated_at" | "last_run_started_at" | "success_count" | "fail_count") => {
    if (sortColumn === column) {
      // Toggle direction or clear
      if (sortDirection === "desc") {
        setSortDirection("asc");
      } else {
        setSortColumn(null);
      }
    } else {
      setSortColumn(column);
      setSortDirection("desc"); // Default to highest first
    }
  };

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
    // First filter
    const filtered = jobs.filter((job) => {
      const matchesSearch =
        !searchQuery ||
        job.job_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.description?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesActive = activeFilter === null ||
        (activeFilter === "active" && job.is_active) ||
        (activeFilter === "inactive" && !job.is_active);

      const matchesAuthor = !authorFilter || job.author === authorFilter;

      return matchesSearch && matchesActive && matchesAuthor;
    });

    // Then sort if a sort column is selected
    if (sortColumn) {
      return [...filtered].sort((a, b) => {
        // Handle numeric columns (success_count, fail_count)
        if (sortColumn === "success_count" || sortColumn === "fail_count") {
          const aVal = (a as any)[sortColumn] ?? 0;
          const bVal = (b as any)[sortColumn] ?? 0;
          return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
        }

        // Handle date columns
        const aVal = a[sortColumn];
        const bVal = b[sortColumn];

        // Handle null/undefined values
        if (!aVal && !bVal) return 0;
        if (!aVal) return sortDirection === "asc" ? -1 : 1;
        if (!bVal) return sortDirection === "asc" ? 1 : -1;

        const aDate = new Date(aVal).getTime();
        const bDate = new Date(bVal).getTime();

        return sortDirection === "asc" ? aDate - bDate : bDate - aDate;
      });
    }

    return filtered;
  }, [jobs, searchQuery, activeFilter, authorFilter, sortColumn, sortDirection]);

  // Unique owners for filter dropdown
  const uniqueOwners = useMemo(() => {
    const owners = jobs
      .map(j => j.author)
      .filter((owner): owner is string => Boolean(owner));
    return [...new Set(owners)].sort();
  }, [jobs]);

  // Stats calculation
  const stats = useMemo(() => ({
    total: jobs.length,
    active: jobs.filter(j => j.is_active).length,
    running: jobs.filter(j => (j as any).current_status === 'Running').length,
    failed: jobs.filter(j => (j as any).last_run_status === 'Failed').length,
  }), [jobs]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredJobs.length / itemsPerPage);
  const paginatedJobs = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredJobs.slice(start, start + itemsPerPage);
  }, [filteredJobs, currentPage, itemsPerPage]);

  // Reset to page 1 when filters change
  const prevFilteredLength = useRef(filteredJobs.length);
  if (filteredJobs.length !== prevFilteredLength.current) {
    prevFilteredLength.current = filteredJobs.length;
    if (currentPage > 1) {
      setCurrentPage(1);
    }
  }

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
        <div className="max-w-[1600px] mx-auto px-4 py-3">

          {/* Dashboard Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-4">
              <h1 className="text-sm font-semibold text-on-surface">Dashboard</h1>
              <div className="flex items-center gap-3 text-[11px] font-mono">
                <span className="text-on-surface-variant">
                  Total: <span className="text-on-surface font-semibold">{stats.total}</span>
                </span>
                <span className="text-on-surface-variant">
                  Active: <span className="text-emerald-400 font-semibold">{stats.active}</span>
                </span>
                <span className="text-on-surface-variant">
                  Running: <span className={`font-semibold ${stats.running > 0 ? 'text-cyan-400' : 'text-on-surface-variant/50'}`}>{stats.running}</span>
                </span>
                <span className="text-on-surface-variant">
                  Failed: <span className={`font-semibold ${stats.failed > 0 ? 'text-rose-400' : 'text-on-surface-variant/50'}`}>{stats.failed}</span>
                </span>
                {isPolling && (
                  <span className="flex items-center gap-1 text-cyan-400/70">
                    <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
                    live
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Toggle Polling */}
              <button
                onClick={() => isPolling ? stopPolling() : startPolling()}
                title={isPolling ? "Disable auto-refresh" : "Enable auto-refresh"}
                className={`p-1.5 rounded-lg transition-all ${
                  isPolling
                    ? "text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20"
                    : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
              </button>

              {/* Refresh */}
              <button
                onClick={() => loadJobs()}
                disabled={isLoading}
                title="Refresh"
                className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              </button>

              {/* New Job */}
              <Link to="/jobs/agent/new">
                <button className="
                  inline-flex items-center gap-1.5 px-2.5 py-1.5
                  bg-sqlserver/20 text-sqlserver
                  border border-sqlserver/30
                  rounded-lg font-medium text-[11px]
                  hover:bg-sqlserver/30 hover:border-sqlserver/50
                  transition-all duration-200
                ">
                  <Plus className="w-3.5 h-3.5" />
                  New Job
                </button>
              </Link>
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3 mb-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-on-surface-variant/60" />
              <input
                type="text"
                placeholder="Search jobs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="
                  w-full pl-8 pr-3 py-1.5
                  bg-surface-container border border-outline-variant/50 rounded-lg
                  text-on-surface placeholder-on-surface-variant/50
                  text-xs font-mono
                  focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20
                  transition-all duration-200
                "
              />
            </div>

            {/* Clear All Filters */}
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg
                  bg-rose-500/10 text-rose-400 hover:bg-rose-500/20
                  text-[10px] font-medium transition-colors"
              >
                <FilterX className="w-3 h-3" />
                Clear
              </button>
            )}

            <div className="flex-1" />

            {/* Count badge */}
            <div className="text-[10px] font-mono text-on-surface-variant">
              <span className="text-on-surface font-semibold">{filteredJobs.length}</span>
              <span className="text-on-surface-variant/60"> jobs</span>
            </div>
          </div>

          {/* Content */}
          {isLoading && jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-10 h-10 border-2 border-sqlserver/30 border-t-sqlserver rounded-full animate-spin mb-3" />
              <span className="text-xs font-mono text-on-surface-variant">Loading jobs...</span>
            </div>
          ) : jobs.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="bg-surface-container border border-outline-variant/50 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-outline-variant/30 bg-surface-container-high/30">
                      <th className="text-left py-1.5 px-2 text-[9px] font-semibold text-on-surface-variant uppercase tracking-wider">Job Name</th>
                      <th className="text-left py-1.5 px-2">
                        <ColumnFilter
                          label="Status"
                          value={activeFilter}
                          onChange={setActiveFilter}
                          accentColor="emerald"
                          options={[
                            { value: "active", label: "Active" },
                            { value: "inactive", label: "Inactive" },
                          ]}
                        />
                      </th>
                      <th className="text-left py-1.5 px-2">
                        <ColumnFilter
                          label="Owner"
                          value={authorFilter}
                          onChange={setAuthorFilter}
                          accentColor="violet"
                          options={uniqueOwners.map((owner) => ({
                            value: owner,
                            label: owner,
                          }))}
                        />
                      </th>
                      <th className="text-left py-1.5 px-2">
                        <button
                          onClick={() => toggleSort("created_at")}
                          className={`inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider transition-colors
                            ${sortColumn === "created_at" ? "text-amber-400" : "text-on-surface-variant hover:text-on-surface"}`}
                        >
                          Created
                          {sortColumn === "created_at" ? (
                            sortDirection === "desc" ? <ArrowDown className="w-2.5 h-2.5" /> : <ArrowUp className="w-2.5 h-2.5" />
                          ) : (
                            <ArrowDown className="w-2.5 h-2.5 opacity-0 group-hover:opacity-30" />
                          )}
                        </button>
                      </th>
                      <th className="text-left py-1.5 px-2">
                        <button
                          onClick={() => toggleSort("updated_at")}
                          className={`inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider transition-colors
                            ${sortColumn === "updated_at" ? "text-amber-400" : "text-on-surface-variant hover:text-on-surface"}`}
                        >
                          Modified
                          {sortColumn === "updated_at" ? (
                            sortDirection === "desc" ? <ArrowDown className="w-2.5 h-2.5" /> : <ArrowUp className="w-2.5 h-2.5" />
                          ) : (
                            <ArrowDown className="w-2.5 h-2.5 opacity-0 group-hover:opacity-30" />
                          )}
                        </button>
                      </th>
                      <th className="text-left py-1.5 px-2">
                        <button
                          onClick={() => toggleSort("last_run_started_at")}
                          className={`inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider transition-colors
                            ${sortColumn === "last_run_started_at" ? "text-amber-400" : "text-on-surface-variant hover:text-on-surface"}`}
                        >
                          Last Run
                          {sortColumn === "last_run_started_at" ? (
                            sortDirection === "desc" ? <ArrowDown className="w-2.5 h-2.5" /> : <ArrowUp className="w-2.5 h-2.5" />
                          ) : (
                            <ArrowDown className="w-2.5 h-2.5 opacity-0 group-hover:opacity-30" />
                          )}
                        </button>
                      </th>
                      <th className="text-left py-1.5 px-2 text-[9px] font-semibold text-on-surface-variant uppercase tracking-wider">Next Run</th>
                      <th className="text-left py-1.5 px-2">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => toggleSort("success_count")}
                            className={`inline-flex items-center gap-0.5 text-[9px] font-semibold uppercase tracking-wider transition-colors
                              ${sortColumn === "success_count" ? "text-emerald-400" : "text-emerald-400/60 hover:text-emerald-400"}`}
                            title="Sort by success count"
                          >
                            {sortColumn === "success_count" ? (
                              sortDirection === "desc" ? <ArrowDown className="w-2.5 h-2.5" /> : <ArrowUp className="w-2.5 h-2.5" />
                            ) : null}
                            Pass
                          </button>
                          <span className="text-on-surface-variant/30">/</span>
                          <button
                            onClick={() => toggleSort("fail_count")}
                            className={`inline-flex items-center gap-0.5 text-[9px] font-semibold uppercase tracking-wider transition-colors
                              ${sortColumn === "fail_count" ? "text-rose-400" : "text-rose-400/60 hover:text-rose-400"}`}
                            title="Sort by fail count"
                          >
                            {sortColumn === "fail_count" ? (
                              sortDirection === "desc" ? <ArrowDown className="w-2.5 h-2.5" /> : <ArrowUp className="w-2.5 h-2.5" />
                            ) : null}
                            Fail
                          </button>
                        </div>
                      </th>
                      <th className="text-right py-1.5 px-2 text-[9px] font-semibold text-on-surface-variant uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedJobs.map((job) => (
                      <JobRow
                        key={job.id}
                        job={job}
                        onRun={handleRun}
                        onToggle={handleToggle}
                        onDelete={deleteExistingJob}
                        onRequestConfirm={handleRequestConfirm}
                        onOpenAgentDetail={setSelectedAgentJobName}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredJobs.length === 0 && jobs.length > 0 && (
                <div className="text-center py-8 text-on-surface-variant">
                  <Search className="w-6 h-6 mx-auto mb-2 opacity-40" />
                  <p className="text-xs">No jobs match your search criteria</p>
                </div>
              )}

              {/* Pagination */}
              {filteredJobs.length > 0 && (
                <div className="flex items-center justify-between px-2 py-1.5 border-t border-outline-variant/20 bg-surface-container-high/20">
                  <div className="text-[10px] font-mono text-on-surface-variant">
                    {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredJobs.length)} of {filteredJobs.length}
                  </div>
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      className="px-1.5 py-0.5 text-[10px] font-mono rounded hover:bg-surface-container-highest disabled:opacity-40 disabled:cursor-not-allowed text-on-surface-variant"
                    >
                      ««
                    </button>
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-1.5 py-0.5 text-[10px] font-mono rounded hover:bg-surface-container-highest disabled:opacity-40 disabled:cursor-not-allowed text-on-surface-variant"
                    >
                      «
                    </button>
                    <span className="px-2 py-0.5 text-[10px] font-mono text-on-surface">
                      {currentPage}/{totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-1.5 py-0.5 text-[10px] font-mono rounded hover:bg-surface-container-highest disabled:opacity-40 disabled:cursor-not-allowed text-on-surface-variant"
                    >
                      »
                    </button>
                    <button
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                      className="px-1.5 py-0.5 text-[10px] font-mono rounded hover:bg-surface-container-highest disabled:opacity-40 disabled:cursor-not-allowed text-on-surface-variant"
                    >
                      »»
                    </button>
                  </div>
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

      {/* SQL Server Agent Job Detail Modal */}
      {selectedAgentJobName && (
        <AgentJobDetailModal
          jobName={selectedAgentJobName}
          onClose={() => setSelectedAgentJobName(null)}
          onRefresh={() => loadJobs()}
        />
      )}
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
