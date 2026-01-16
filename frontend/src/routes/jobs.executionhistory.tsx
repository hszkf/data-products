import { createFileRoute, Link } from '@tanstack/react-router';
import React, { useState, useMemo, useRef, useCallback } from "react";
import { ThemeProvider } from "~/lib/theme-context";
import { ToastProvider, useToast } from "~/components/ui/toast-provider";
import { TooltipProvider } from "~/components/ui/tooltip";
import { getAllAgentJobHistory, AgentJobHistory, getJobOwners } from "~/lib/jobs-api";
import {
  Search,
  RefreshCw,
  Database,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  History,
  FilterX,
  ChevronDown,
  Calendar,
  ArrowUp,
  ArrowDown,
  Trophy,
} from "lucide-react";
import { AppHeader } from "~/components/app-header";
import { ColumnFilter } from "~/components/ui/column-filter";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { format } from "date-fns";

// Jobs sub-navigation tabs
function JobsSubNav() {
  return (
    <div className="flex items-center gap-1 px-4 py-1.5 bg-surface-container-high/30 border-b border-outline-variant/30">
      <Link
        to="/jobs"
        className="px-3 py-1 text-[11px] font-medium rounded-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-colors"
      >
        Jobs
      </Link>
      <Link
        to="/jobs/executionhistory"
        className="px-3 py-1 text-[11px] font-medium rounded-md bg-violet-500/20 text-violet-400 border border-violet-500/30"
      >
        Execution History
      </Link>
    </div>
  );
}

export const Route = createFileRoute('/jobs/executionhistory')({
  component: ExecutionHistoryPage,
});

// Status badge component
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    Succeeded: {
      bg: "bg-emerald-500/15",
      text: "text-emerald-400",
      icon: <CheckCircle className="w-2.5 h-2.5" />
    },
    Failed: {
      bg: "bg-rose-500/15",
      text: "text-rose-400",
      icon: <XCircle className="w-2.5 h-2.5" />
    },
    'In Progress': {
      bg: "bg-amber-500/15",
      text: "text-amber-400",
      icon: <Clock className="w-2.5 h-2.5 animate-pulse" />
    },
    Retry: {
      bg: "bg-blue-500/15",
      text: "text-blue-400",
      icon: <RefreshCw className="w-2.5 h-2.5" />
    },
    Cancelled: {
      bg: "bg-zinc-500/15",
      text: "text-zinc-400",
      icon: <XCircle className="w-2.5 h-2.5" />
    },
  };

  const c = config[status] || { bg: "bg-zinc-500/15", text: "text-zinc-400", icon: <AlertCircle className="w-2.5 h-2.5" /> };

  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-medium ${c.bg} ${c.text}`}>
      {c.icon}
      {status}
    </span>
  );
}

// History row component
function HistoryRow({ entry }: { entry: AgentJobHistory & { owner?: string } }) {
  const [expanded, setExpanded] = useState(false);

  // Combine date and time for display
  const runDateTime = entry.run_date && entry.run_time
    ? `${entry.run_date} ${entry.run_time}`
    : '-';

  return (
    <>
      <tr className="group border-b border-outline-variant/15 hover:bg-surface-container-high/30 transition-colors">
        {/* Job Name */}
        <td className="py-1 px-2">
          <span className="text-[11px] font-medium text-on-surface truncate max-w-[280px] block">
            {entry.job_name}
          </span>
        </td>

        {/* Status */}
        <td className="py-1 px-2">
          <StatusBadge status={entry.status} />
        </td>

        {/* Run Date/Time */}
        <td className="py-1 px-2">
          <span className="text-[10px] font-mono text-on-surface-variant whitespace-nowrap">
            {runDateTime}
          </span>
        </td>

        {/* Duration */}
        <td className="py-1 px-2">
          <span className="text-[10px] font-mono text-on-surface-variant">
            {entry.run_duration || '-'}
          </span>
        </td>

        {/* Owner */}
        <td className="py-1 px-2">
          <span className="text-[10px] font-mono text-on-surface-variant whitespace-nowrap">
            {entry.owner || '-'}
          </span>
        </td>

        {/* Message Toggle */}
        <td className="py-1 px-2">
          {entry.message && entry.message.length > 0 ? (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
            >
              <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
              {expanded ? 'Hide' : 'Show'}
            </button>
          ) : (
            <span className="text-[10px] text-on-surface-variant/40">-</span>
          )}
        </td>
      </tr>
      {expanded && entry.message && (
        <tr className="bg-surface-container-high/20">
          <td colSpan={6} className="px-2 py-1.5">
            <div className="text-[10px] font-mono text-on-surface-variant bg-surface-container p-2 rounded border border-outline-variant/30 max-h-32 overflow-auto whitespace-pre-wrap">
              {entry.message}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function ExecutionHistoryContent() {
  const { showToast } = useToast();

  // State
  const [history, setHistory] = useState<(AgentJobHistory & { owner?: string })[]>([]);
  const [owners, setOwners] = useState<string[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 15,
    total: 0,
    total_pages: 0,
    has_next: false,
    has_prev: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [ownerFilter, setOwnerFilter] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const [sortColumn, setSortColumn] = useState<'run_date' | 'duration' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);

  // Toggle sort for a column
  const toggleSort = (column: 'run_date' | 'duration') => {
    if (sortColumn === column) {
      if (sortDirection === 'desc') {
        setSortDirection('asc');
      } else {
        setSortColumn(null);
      }
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  // Load data
  const loadHistory = useCallback(async (page: number = 1) => {
    setIsLoading(true);
    try {
      const result = await getAllAgentJobHistory({
        page,
        limit: 15,
        job_name: searchQuery || undefined,
        status: statusFilter || undefined,
        date_from: dateFrom ? format(dateFrom, 'yyyy-MM-dd') : undefined,
        date_to: dateTo ? format(dateTo, 'yyyy-MM-dd') : undefined,
        owner: ownerFilter || undefined,
        sort_by: sortColumn || undefined,
        sort_dir: sortColumn ? sortDirection : undefined,
      });
      setHistory(result.history);
      setPagination(result.pagination);
      setCurrentPage(page);
    } catch (error: any) {
      showToast({
        title: "Error",
        description: error.message || "Failed to load execution history",
        variant: "error",
      });
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, statusFilter, ownerFilter, dateFrom, dateTo, sortColumn, sortDirection, showToast]);

  // Load owners
  const loadOwners = useCallback(async () => {
    try {
      const result = await getJobOwners();
      setOwners(result.owners);
    } catch (error) {
      console.error('Failed to load owners:', error);
    }
  }, []);

  // Initial load
  const hasInitiallyLoaded = useRef(false);
  if (!hasInitiallyLoaded.current) {
    hasInitiallyLoaded.current = true;
    loadHistory();
    loadOwners();
  }

  // Reload when filters change
  const prevFilters = useRef({ searchQuery, statusFilter, ownerFilter, sortColumn, sortDirection });
  if (
    prevFilters.current.searchQuery !== searchQuery ||
    prevFilters.current.statusFilter !== statusFilter ||
    prevFilters.current.ownerFilter !== ownerFilter ||
    prevFilters.current.sortColumn !== sortColumn ||
    prevFilters.current.sortDirection !== sortDirection
  ) {
    prevFilters.current = { searchQuery, statusFilter, ownerFilter, sortColumn, sortDirection };
    // Debounce search
    const timer = setTimeout(() => loadHistory(1), 300);
    return () => clearTimeout(timer);
  }

  // Check if any filters are active
  const hasActiveFilters = searchQuery || statusFilter || ownerFilter || dateFrom || dateTo || sortColumn;

  // Clear all filters
  const clearAllFilters = () => {
    setSearchQuery("");
    setStatusFilter(null);
    setOwnerFilter(null);
    setDateFrom(null);
    setDateTo(null);
    setSortColumn(null);
    loadHistory(1);
  };

  // Stats
  const stats = useMemo(() => {
    const succeeded = history.filter(h => h.status === 'Succeeded').length;
    const failed = history.filter(h => h.status === 'Failed').length;
    return { succeeded, failed, total: pagination.total };
  }, [history, pagination.total]);

  // Calculate yesterday's date in Malaysia timezone (UTC+8)
  const yesterday = useMemo(() => {
    const now = new Date();
    // Convert to Malaysia time (UTC+8)
    const malaysiaOffset = 8 * 60; // 8 hours in minutes
    const localOffset = now.getTimezoneOffset(); // local offset in minutes (negative for ahead of UTC)
    const malaysiaTime = new Date(now.getTime() + (localOffset + malaysiaOffset) * 60 * 1000);
    // Get yesterday
    malaysiaTime.setDate(malaysiaTime.getDate() - 1);
    return format(malaysiaTime, 'yyyy-MM-dd');
  }, []);

  // Top 3 owners state (fetched separately for yesterday)
  const [topOwners, setTopOwners] = useState<{ owner: string; total: number; success: number; failed: number }[]>([]);
  const [topOwnersLoading, setTopOwnersLoading] = useState(false);

  // Fetch yesterday's data for top 3 owners
  const loadYesterdayStats = useCallback(async () => {
    setTopOwnersLoading(true);
    try {
      // Fetch all jobs from yesterday (up to 1000 to get full picture)
      const result = await getAllAgentJobHistory({
        page: 1,
        limit: 1000,
        date_from: yesterday,
        date_to: yesterday,
      });

      // Calculate top 3 owners
      const ownerStats: Record<string, { total: number; success: number; failed: number }> = {};

      result.history.forEach(h => {
        const owner = h.owner || 'Unknown';
        if (!ownerStats[owner]) {
          ownerStats[owner] = { total: 0, success: 0, failed: 0 };
        }
        ownerStats[owner].total++;
        if (h.status === 'Succeeded') {
          ownerStats[owner].success++;
        } else if (h.status === 'Failed') {
          ownerStats[owner].failed++;
        }
      });

      const sorted = Object.entries(ownerStats)
        .map(([owner, stats]) => ({ owner, ...stats }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 3);

      setTopOwners(sorted);
    } catch (error) {
      console.error('Failed to load yesterday stats:', error);
    } finally {
      setTopOwnersLoading(false);
    }
  }, [yesterday]);

  // Load yesterday's stats on mount
  const hasLoadedYesterdayStats = useRef(false);
  if (!hasLoadedYesterdayStats.current) {
    hasLoadedYesterdayStats.current = true;
    loadYesterdayStats();
  }

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

      {/* Header */}
      <div className="sticky top-0 z-20">
        <AppHeader
          title="SQL Server Agent"
          icon={Database}
          iconClassName="bg-gradient-to-br from-sqlserver to-blue-600"
        />
        <JobsSubNav />
      </div>

      <main className="flex-1 overflow-auto relative">
        <div className="max-w-[1600px] mx-auto px-4 py-3">

          {/* Dashboard Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-4">
              <h1 className="text-sm font-semibold text-on-surface">All Executions</h1>
              <div className="flex items-center gap-3 text-[11px] font-mono">
                <span className="text-on-surface-variant">
                  Total: <span className="text-on-surface font-semibold">{stats.total.toLocaleString()}</span>
                </span>
                <span className="text-on-surface-variant">
                  Showing: <span className="text-emerald-400 font-semibold">{stats.succeeded}</span>
                  <span className="text-on-surface-variant/50"> / </span>
                  <span className="text-rose-400 font-semibold">{stats.failed}</span>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Refresh */}
              <button
                onClick={() => loadHistory(currentPage)}
                disabled={isLoading}
                title="Refresh"
                className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3 mb-3">
            {/* Search */}
            <div className="relative min-w-[180px] max-w-[220px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-on-surface-variant/60" />
              <input
                type="text"
                placeholder="Search job name..."
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

            {/* Date Range Filter */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-on-surface-variant/60" />
                <span className="text-[10px] text-on-surface-variant">From:</span>
              </div>
              <DatePicker
                selected={dateFrom}
                onChange={(date) => {
                  setDateFrom(date);
                  loadHistory(1);
                }}
                dateFormat="dd/MM/yyyy"
                placeholderText="Select date"
                maxDate={dateTo || undefined}
                className="
                  px-2.5 py-1.5 w-32
                  bg-surface-container border border-outline-variant/50 rounded-lg
                  text-on-surface text-xs font-mono
                  placeholder:text-on-surface-variant/50
                  focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20
                  transition-all duration-200
                "
                calendarClassName="dark-datepicker"
                popperClassName="datepicker-popper"
              />
              <span className="text-[10px] text-on-surface-variant">To:</span>
              <DatePicker
                selected={dateTo}
                onChange={(date) => {
                  setDateTo(date);
                  loadHistory(1);
                }}
                dateFormat="dd/MM/yyyy"
                placeholderText="Select date"
                minDate={dateFrom || undefined}
                className="
                  px-2.5 py-1.5 w-32
                  bg-surface-container border border-outline-variant/50 rounded-lg
                  text-on-surface text-xs font-mono
                  placeholder:text-on-surface-variant/50
                  focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20
                  transition-all duration-200
                "
                calendarClassName="dark-datepicker"
                popperClassName="datepicker-popper"
              />
            </div>

            {/* Top 3 Owners (Yesterday - Malaysia Time) */}
            <div className="flex items-center gap-2 px-2.5 py-1.5 bg-surface-container border border-outline-variant/30 rounded-lg">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[9px] text-on-surface-variant font-medium">Yesterday</span>

              {topOwnersLoading ? (
                <RefreshCw className="w-3 h-3 text-on-surface-variant/50 animate-spin" />
              ) : topOwners.length > 0 ? (
                <div className="flex items-center gap-3">
                  {topOwners.map((ownerData, index) => {
                    const rankColors = ['text-amber-400', 'text-zinc-400', 'text-orange-400'][index];
                    const shortName = ownerData.owner.includes('\\')
                      ? ownerData.owner.split('\\')[1]
                      : ownerData.owner;

                    return (
                      <div
                        key={ownerData.owner}
                        className="flex items-center gap-1.5"
                        title={`${ownerData.owner}: ${ownerData.total} jobs`}
                      >
                        <span className={`text-[10px] font-bold ${rankColors}`}>#{index + 1}</span>
                        <span className="text-[10px] text-on-surface font-medium truncate max-w-[70px]">{shortName}</span>
                        <span className="text-[9px] font-mono text-emerald-400">{ownerData.success}</span>
                        <span className="text-[9px] text-on-surface-variant/40">/</span>
                        <span className="text-[9px] font-mono text-rose-400">{ownerData.failed}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <span className="text-[9px] text-on-surface-variant/50">No data</span>
              )}
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
              <span className="text-on-surface font-semibold">{history.length}</span>
              <span className="text-on-surface-variant/60"> of {pagination.total.toLocaleString()}</span>
            </div>
          </div>

          {/* Content */}
          {isLoading && history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-10 h-10 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin mb-3" />
              <span className="text-xs font-mono text-on-surface-variant">Loading history...</span>
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-6">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/30 flex items-center justify-center mb-6">
                <History className="w-10 h-10 text-violet-400/70" />
              </div>
              <h3 className="text-xl font-semibold text-on-surface mb-2">No execution history</h3>
              <p className="text-on-surface-variant text-center max-w-md">
                No job executions found. Run some jobs to see their execution history here.
              </p>
            </div>
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
                          value={statusFilter}
                          onChange={(val) => {
                            setStatusFilter(val);
                            loadHistory(1);
                          }}
                          accentColor="emerald"
                          options={[
                            { value: "Succeeded", label: "Succeeded" },
                            { value: "Failed", label: "Failed" },
                            { value: "In Progress", label: "In Progress" },
                            { value: "Retry", label: "Retry" },
                            { value: "Cancelled", label: "Cancelled" },
                          ]}
                        />
                      </th>
                      <th className="text-left py-1.5 px-2">
                        <button
                          onClick={() => toggleSort('run_date')}
                          className={`group inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider transition-colors
                            ${sortColumn === 'run_date' ? 'text-amber-400' : 'text-on-surface-variant hover:text-on-surface'}`}
                        >
                          Run Date/Time
                          {sortColumn === 'run_date' ? (
                            sortDirection === 'desc' ? <ArrowDown className="w-2.5 h-2.5" /> : <ArrowUp className="w-2.5 h-2.5" />
                          ) : (
                            <ArrowDown className="w-2.5 h-2.5 opacity-0 group-hover:opacity-30" />
                          )}
                        </button>
                      </th>
                      <th className="text-left py-1.5 px-2">
                        <button
                          onClick={() => toggleSort('duration')}
                          className={`group inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider transition-colors
                            ${sortColumn === 'duration' ? 'text-amber-400' : 'text-on-surface-variant hover:text-on-surface'}`}
                        >
                          Duration
                          {sortColumn === 'duration' ? (
                            sortDirection === 'desc' ? <ArrowDown className="w-2.5 h-2.5" /> : <ArrowUp className="w-2.5 h-2.5" />
                          ) : (
                            <ArrowDown className="w-2.5 h-2.5 opacity-0 group-hover:opacity-30" />
                          )}
                        </button>
                      </th>
                      <th className="text-left py-1.5 px-2">
                        <ColumnFilter
                          label="Owner"
                          value={ownerFilter}
                          onChange={(val) => {
                            setOwnerFilter(val);
                            loadHistory(1);
                          }}
                          accentColor="violet"
                          options={owners.map(owner => ({
                            value: owner,
                            label: owner,
                          }))}
                        />
                      </th>
                      <th className="text-left py-1.5 px-2 text-[9px] font-semibold text-on-surface-variant uppercase tracking-wider">Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((entry, index) => (
                      <HistoryRow key={`${entry.job_name}-${entry.run_date}-${entry.run_time}-${index}`} entry={entry} />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination.total > 0 && (
                <div className="flex items-center justify-between px-2 py-1.5 border-t border-outline-variant/20 bg-surface-container-high/20">
                  <div className="text-[10px] font-mono text-on-surface-variant">
                    {((currentPage - 1) * pagination.limit) + 1}-{Math.min(currentPage * pagination.limit, pagination.total)} of {pagination.total.toLocaleString()}
                  </div>
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => loadHistory(1)}
                      disabled={currentPage === 1 || isLoading}
                      className="px-1.5 py-0.5 text-[10px] font-mono rounded hover:bg-surface-container-highest disabled:opacity-40 disabled:cursor-not-allowed text-on-surface-variant"
                    >
                      ««
                    </button>
                    <button
                      onClick={() => loadHistory(currentPage - 1)}
                      disabled={!pagination.has_prev || isLoading}
                      className="px-1.5 py-0.5 text-[10px] font-mono rounded hover:bg-surface-container-highest disabled:opacity-40 disabled:cursor-not-allowed text-on-surface-variant"
                    >
                      «
                    </button>
                    <span className="px-2 py-0.5 text-[10px] font-mono text-on-surface">
                      {currentPage}/{pagination.total_pages}
                    </span>
                    <button
                      onClick={() => loadHistory(currentPage + 1)}
                      disabled={!pagination.has_next || isLoading}
                      className="px-1.5 py-0.5 text-[10px] font-mono rounded hover:bg-surface-container-highest disabled:opacity-40 disabled:cursor-not-allowed text-on-surface-variant"
                    >
                      »
                    </button>
                    <button
                      onClick={() => loadHistory(pagination.total_pages)}
                      disabled={currentPage === pagination.total_pages || isLoading}
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
    </div>
  );
}

function ExecutionHistoryPage() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <TooltipProvider delayDuration={300}>
          <ExecutionHistoryContent />
        </TooltipProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
