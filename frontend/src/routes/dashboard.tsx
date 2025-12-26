import { createFileRoute } from '@tanstack/react-router';


import { useState, useSyncExternalStore, useCallback } from "react";
import { Link } from "@tanstack/react-router";
import {
  Clock,
  LayoutDashboard,
  RefreshCw,
  Database,
  BarChart3,
} from "lucide-react";
import { ThemeProvider } from "~/lib/theme-context";
import { ToastProvider } from "~/components/ui/toast-provider";
import { MergeProvider, useMerge } from "~/components/merge/merge-context";
import {
  DashboardProvider,
  useDashboard,
  DashboardCanvas,
  ChartBuilder,
} from "~/components/dashboard";
import { StudioNav } from "~/components/studio-nav";

// Stats display component
export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

function DashboardStats() {
  const { tables } = useMerge();
  const { state } = useDashboard();

  const tableCount = Object.keys(tables).length;
  const chartCount = state.dashboard.charts.length;
  const totalRows = Object.values(tables).reduce((sum, t) => sum + t.rows.length, 0);

  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      <StatCard
        icon={Database}
        label="Saved Tables"
        value={tableCount}
        colour="amber"
      />
      <StatCard
        icon={BarChart3}
        label="Charts"
        value={chartCount}
        colour="cyan"
      />
      <StatCard
        icon={LayoutDashboard}
        label="Total Rows"
        value={totalRows.toLocaleString()}
        colour="emerald"
      />
      <StatCard
        icon={Clock}
        label="Last Updated"
        value={state.dashboard.updatedAt ? new Date(state.dashboard.updatedAt).toLocaleTimeString() : "-"}
        colour="violet"
      />
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  colour,
}: {
  icon: typeof Database;
  label: string;
  value: string | number;
  colour: "amber" | "cyan" | "emerald" | "violet" | "rose";
}) {
  const colourClasses = {
    amber: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    cyan: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    violet: "bg-violet-500/10 text-violet-400 border-violet-500/20",
    rose: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  };

  return (
    <div className={`p-4 rounded-xl border ${colourClasses[colour]}`}>
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colourClasses[colour]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-on-surface-variant font-medium uppercase tracking-wider">
            {label}
          </p>
          <p className="text-xl font-bold text-on-surface">{value}</p>
        </div>
      </div>
    </div>
  );
}


// Empty state for no tables
function NoTablesState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 border-2 border-dashed border-outline-variant/30 rounded-xl">
      <div className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center mb-4">
        <Database className="w-8 h-8 text-on-surface-variant" />
      </div>
      <h3 className="text-lg font-medium text-on-surface mb-2">
        No data tables available
      </h3>
      <p className="text-on-surface-variant text-sm mb-4 text-center max-w-md">
        Run a query in the SQL Studio to save result tables, or upload a CSV/Excel file to start creating charts.
      </p>
      <Link
        href="/sql"
        className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-black rounded-lg hover:bg-amber-400 transition-colors font-medium text-sm"
      >
        <Database className="w-4 h-4" />
        Go to SQL Studio
      </Link>
    </div>
  );
}

// Main dashboard content
function DashboardContent() {
  const { tables } = useMerge();
  const { state, setDashboardName } = useDashboard();
  const hasData = Object.keys(tables).length > 0;
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Use useSyncExternalStore for time updates instead of useEffect
  const subscribe = useCallback((callback: () => void) => {
    const timer = setInterval(callback, 1000);
    return () => clearInterval(timer);
  }, []);
  
  const getSnapshot = useCallback(() => new Date(), []);
  const getServerSnapshot = useCallback(() => new Date(), []);
  
  const currentTime = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-on-surface">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
            `,
            backgroundSize: "60px 60px",
          }}
        />
        <div
          className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full opacity-20"
          style={{
            background: "radial-gradient(circle, rgba(245,158,11,0.15) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full opacity-15"
          style={{
            background: "radial-gradient(circle, rgba(6,182,212,0.15) 0%, transparent 70%)",
          }}
        />
      </div>

      {/* Header - Full Width */}
      <header className="relative z-20 bg-[#0a0a0c]/80 backdrop-blur-sm border-b border-neutral-800/50 sticky top-0">
        {/* Navigation Bar */}
        <div className="px-6 py-3 border-b border-neutral-800/30">
          <StudioNav />
        </div>

        {/* Page Header */}
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <LayoutDashboard className="w-5 h-5 text-white" />
            </div>
            <div>
              <input
                type="text"
                value={state.dashboard.name}
                onChange={(e) => setDashboardName(e.target.value)}
                className="text-lg font-bold tracking-tight text-on-surface bg-transparent border-none focus:outline-none focus:ring-0 p-0"
                placeholder="Dashboard Name"
              />
              <p className="text-xs text-on-surface-variant font-mono">
                Power BI-style analytics dashboard
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-on-surface-variant">
              <Clock className="w-4 h-4" />
              <span className="font-mono text-sm">
                {currentTime.toLocaleTimeString()}
              </span>
            </div>
            <button
              onClick={handleRefresh}
              className="p-2.5 rounded-lg text-on-surface-variant hover:text-cyan-400 hover:bg-cyan-500/10 transition-all"
            >
              <RefreshCw
                className={`w-5 h-5 ${isRefreshing ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="relative z-10 max-w-[1600px] mx-auto px-6 py-8">
        <DashboardStats />

        {hasData ? (
          <DashboardCanvas />
        ) : (
          <NoTablesState />
        )}

        <ChartBuilder />
      </div>
    </div>
  );
}

// Page wrapper with providers
function DashboardPage() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <MergeProvider>
          <DashboardProvider>
            <DashboardContent />
          </DashboardProvider>
        </MergeProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
