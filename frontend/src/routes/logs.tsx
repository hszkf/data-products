import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute('/logs')({
  component: DashboardPage,
});

import React, { useState, useMemo, useSyncExternalStore, useCallback } from "react";
import { useInterval } from "~/lib/hooks";
import { Link } from "@tanstack/react-router";
import { StudioNav } from "~/components/studio-nav";
import {
  Database,
  Clock,
  Zap,
  TrendingUp,
  HardDrive,
  Calendar,
  Play,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Terminal,
  ArrowUpRight,
  BarChart3,
  RefreshCw,
  Wifi,
  Sparkles,
} from "lucide-react";
import { ThemeProvider } from "~/lib/theme-context";
import { ToastProvider } from "~/components/ui/toast-provider";
import { formatMYTimeWithSeconds, formatMYDateShort } from "~/lib/date-utils";
import { TooltipProvider } from "~/components/ui/tooltip";

// Simulated real-time data using custom interval hook
const useRealtimeStats = () => {
  const [stats, setStats] = useState({
    queriesExecuted: 12847,
    activeConnections: 8,
    avgResponseTime: 142,
    successRate: 99.2,
    storageUsed: 2.4,
    scheduledJobs: 12,
    runningJobs: 2,
    failedJobs: 1,
  });

  // Use custom interval hook instead of useEffect
  useInterval(() => {
    setStats(prev => ({
      ...prev,
      queriesExecuted: prev.queriesExecuted + Math.floor(Math.random() * 3),
      activeConnections: Math.max(1, prev.activeConnections + (Math.random() > 0.5 ? 1 : -1)),
      avgResponseTime: Math.max(50, prev.avgResponseTime + (Math.random() - 0.5) * 20),
    }));
  }, 3000);

  return stats;
};

// Activity data
const recentActivity = [
  { id: 1, type: "query", action: "SELECT query executed", database: "Redshift", user: "Hasif", time: "2 min ago", status: "success" },
  { id: 2, type: "job", action: "Daily Report completed", database: "SQL Server", user: "System", time: "15 min ago", status: "success" },
  { id: 3, type: "query", action: "INSERT batch processed", database: "Redshift", user: "Nazierul", time: "32 min ago", status: "success" },
  { id: 4, type: "job", action: "Data Sync failed", database: "SQL Server", user: "System", time: "1 hr ago", status: "failed" },
  { id: 5, type: "query", action: "UPDATE statement executed", database: "Redshift", user: "Izhar", time: "2 hrs ago", status: "success" },
  { id: 6, type: "merge", action: "Tables merged", database: "Mixed", user: "Asyraff", time: "3 hrs ago", status: "success" },
];

// Quick actions
const quickActions = [
  { label: "New Query", href: "/sql", icon: Terminal, colour: "amber" },
  { label: "Create Job", href: "/jobs/new", icon: Calendar, colour: "cyan" },
  { label: "View Storage", href: "/storage", icon: HardDrive, colour: "violet" },
  { label: "AI Assistant", href: "/ai", icon: Sparkles, colour: "rose" },
];

// Database connections
const connections = [
  { name: "Redshift Prod", type: "redshift", status: "connected", latency: 24 },
  { name: "Redshift Dev", type: "redshift", status: "connected", latency: 31 },
  { name: "SQL Server Staging", type: "sqlserver", status: "connected", latency: 18 },
  { name: "SQL Server Analytics", type: "sqlserver", status: "idle", latency: 45 },
];

function DashboardContent() {
  const stats = useRealtimeStats();
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

  // Simulated chart data
  const chartData = useMemo(() => {
    return Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      queries: Math.floor(Math.random() * 500) + 100,
      errors: Math.floor(Math.random() * 10),
    }));
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0c] text-neutral-100 overflow-hidden">
      {/* Ambient Background */}
      <div className="fixed inset-0 pointer-events-none">
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(251, 191, 36, 0.3) 1px, transparent 1px),
              linear-gradient(90deg, rgba(251, 191, 36, 0.3) 1px, transparent 1px)
            `,
            backgroundSize: "60px 60px",
          }}
        />
        {/* Radial glows */}
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 80% 50% at 20% 0%, rgba(251, 191, 36, 0.08), transparent 50%),
              radial-gradient(ellipse 60% 40% at 80% 100%, rgba(34, 211, 238, 0.06), transparent 50%)
            `,
          }}
        />
      </div>

      {/* Header */}
      <header className="relative z-10 flex flex-col bg-[#0a0a0c]/80 backdrop-blur-xl border-b border-neutral-800/50">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-neutral-800/30">
          <StudioNav />
        </div>

        {/* Page Header */}
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
                <BarChart3 className="w-6 h-6 text-black" />
              </div>
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#0a0a0c] animate-pulse" />
            </div>
            <div>
              <h1 className="font-serif text-xl font-bold tracking-tight">
                Mission Control
              </h1>
              <p className="font-terminal text-xs text-neutral-500 tracking-wider">
                SYSTEM OVERVIEW
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Live Clock */}
          <div className="hidden md:flex items-center gap-3 px-4 py-2 rounded-xl bg-neutral-900/50 border border-neutral-800/50">
            <Clock className="w-4 h-4 text-amber-400" />
            <span className="font-terminal text-sm text-neutral-300 tabular-nums">
              {formatMYTimeWithSeconds(currentTime)}
            </span>
            <span className="text-neutral-600">|</span>
            <span className="font-terminal text-xs text-neutral-500">
              {formatMYDateShort(currentTime)}
            </span>
          </div>

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            className="p-2.5 rounded-xl bg-neutral-900/50 border border-neutral-800/50 text-neutral-400 hover:text-amber-400 hover:border-amber-500/30 transition-all"
          >
            <RefreshCw className={`w-5 h-5 ${isRefreshing ? "animate-spin" : ""}`} />
          </button>

          {/* Status Indicator */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            <span className="font-terminal text-xs text-emerald-400 tracking-wider">ALL SYSTEMS NOMINAL</span>
          </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 overflow-auto p-6">
        <div className="max-w-[1600px] mx-auto space-y-6">

          {/* Top Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              icon={Database}
              label="Queries Executed"
              value={stats.queriesExecuted.toLocaleString()}
              trend="+12%"
              trendUp={true}
              colour="amber"
            />
            <StatCard
              icon={Wifi}
              label="Active Connections"
              value={stats.activeConnections.toString()}
              trend="stable"
              trendUp={true}
              colour="cyan"
            />
            <StatCard
              icon={Zap}
              label="Avg Response"
              value={`${Math.round(stats.avgResponseTime)}ms`}
              trend="-8%"
              trendUp={true}
              colour="emerald"
            />
            <StatCard
              icon={CheckCircle2}
              label="Success Rate"
              value={`${stats.successRate}%`}
              trend="+0.3%"
              trendUp={true}
              colour="violet"
            />
          </div>

          {/* Main Grid */}
          <div className="grid lg:grid-cols-3 gap-6">

            {/* Left Column - Activity & Chart */}
            <div className="lg:col-span-2 space-y-6">

              {/* Activity Chart */}
              <div className="rounded-2xl bg-neutral-900/50 border border-neutral-800/50 p-6 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="font-serif text-lg font-bold">Query Activity</h2>
                    <p className="font-terminal text-xs text-neutral-500 mt-1">Last 24 hours</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-amber-400" />
                      <span className="text-xs text-neutral-500">Queries</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-rose-400" />
                      <span className="text-xs text-neutral-500">Errors</span>
                    </div>
                  </div>
                </div>

                {/* Mini Chart Visualization */}
                <div className="h-48 flex items-end gap-1">
                  {chartData.map((data, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full bg-gradient-to-t from-amber-500/80 to-amber-400/40 rounded-t transition-all hover:from-amber-400 hover:to-amber-300/60"
                        style={{ height: `${(data.queries / 600) * 100}%` }}
                      />
                      {data.errors > 5 && (
                        <div
                          className="w-full bg-rose-500/60 rounded-t"
                          style={{ height: `${(data.errors / 10) * 20}%`, maxHeight: "20px" }}
                        />
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex justify-between mt-2 text-xs font-terminal text-neutral-600">
                  <span>00:00</span>
                  <span>06:00</span>
                  <span>12:00</span>
                  <span>18:00</span>
                  <span>Now</span>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="rounded-2xl bg-neutral-900/50 border border-neutral-800/50 p-6 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="font-serif text-lg font-bold">Recent Activity</h2>
                    <p className="font-terminal text-xs text-neutral-500 mt-1">Live feed</p>
                  </div>
                  <Link
                    href="/sql"
                    className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition-colors"
                  >
                    View all <ArrowUpRight className="w-3 h-3" />
                  </Link>
                </div>

                <div className="space-y-3">
                  {recentActivity.map((item, index) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-4 p-3 rounded-xl bg-neutral-800/30 hover:bg-neutral-800/50 transition-all group"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      {/* Status Icon */}
                      <div className={`
                        w-10 h-10 rounded-xl flex items-center justify-center shrink-0
                        ${item.status === "success" ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}
                      `}>
                        {item.status === "success" ? (
                          <CheckCircle2 className="w-5 h-5" />
                        ) : (
                          <XCircle className="w-5 h-5" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-neutral-200 truncate">
                            {item.action}
                          </span>
                          <span className={`
                            px-2 py-0.5 rounded text-[10px] font-terminal uppercase
                            ${item.database === "Redshift" ? "bg-redshift/20 text-redshift" :
                              item.database === "SQL Server" ? "bg-sqlserver/20 text-sqlserver" :
                              "bg-violet-500/20 text-violet-400"}
                          `}>
                            {item.database}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-neutral-500">{item.user}</span>
                          <span className="text-neutral-700">&bull;</span>
                          <span className="text-xs text-neutral-600">{item.time}</span>
                        </div>
                      </div>

                      {/* Arrow */}
                      <ArrowUpRight className="w-4 h-4 text-neutral-600 group-hover:text-amber-400 transition-colors shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column - Sidebar */}
            <div className="space-y-6">

              {/* Quick Actions */}
              <div className="rounded-2xl bg-neutral-900/50 border border-neutral-800/50 p-6 backdrop-blur-sm">
                <h2 className="font-serif text-lg font-bold mb-4">Quick Actions</h2>
                <div className="grid grid-cols-2 gap-3">
                  {quickActions.map((action) => (
                    <Link
                      key={action.label}
                      href={action.href}
                      className={`
                        group flex flex-col items-center gap-3 p-4 rounded-xl
                        bg-neutral-800/30 hover:bg-neutral-800/60
                        border border-neutral-700/30 hover:border-${action.colour}-500/30
                        transition-all duration-300
                      `}
                    >
                      <div className={`
                        w-12 h-12 rounded-xl flex items-center justify-center
                        bg-${action.colour}-500/10 text-${action.colour}-400
                        group-hover:scale-110 transition-transform duration-300
                      `}>
                        <action.icon className="w-6 h-6" />
                      </div>
                      <span className="text-sm font-medium text-neutral-300 group-hover:text-neutral-100">
                        {action.label}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Jobs Overview */}
              <div className="rounded-2xl bg-neutral-900/50 border border-neutral-800/50 p-6 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-serif text-lg font-bold">Jobs Overview</h2>
                  <Link
                    href="/jobs"
                    className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition-colors"
                  >
                    Manage <ArrowUpRight className="w-3 h-3" />
                  </Link>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                    <div className="flex items-center gap-3">
                      <Calendar className="w-5 h-5 text-cyan-400" />
                      <span className="text-sm text-neutral-300">Scheduled</span>
                    </div>
                    <span className="font-terminal text-lg font-bold text-cyan-400">{stats.scheduledJobs}</span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <div className="flex items-center gap-3">
                      <Play className="w-5 h-5 text-amber-400" />
                      <span className="text-sm text-neutral-300">Running</span>
                    </div>
                    <span className="font-terminal text-lg font-bold text-amber-400">{stats.runningJobs}</span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="w-5 h-5 text-rose-400" />
                      <span className="text-sm text-neutral-300">Failed</span>
                    </div>
                    <span className="font-terminal text-lg font-bold text-rose-400">{stats.failedJobs}</span>
                  </div>
                </div>
              </div>

              {/* Database Connections */}
              <div className="rounded-2xl bg-neutral-900/50 border border-neutral-800/50 p-6 backdrop-blur-sm">
                <h2 className="font-serif text-lg font-bold mb-4">Connections</h2>
                <div className="space-y-2">
                  {connections.map((conn, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 rounded-xl bg-neutral-800/30 hover:bg-neutral-800/50 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`
                          w-2 h-2 rounded-full
                          ${conn.status === "connected" ? "bg-emerald-400 animate-pulse" : "bg-neutral-500"}
                        `} />
                        <div>
                          <div className="text-sm font-medium text-neutral-300">{conn.name}</div>
                          <div className={`
                            text-[10px] font-terminal uppercase
                            ${conn.type === "redshift" ? "text-redshift" : "text-sqlserver"}
                          `}>
                            {conn.type}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-terminal text-xs text-neutral-400">{conn.latency}ms</div>
                        <div className={`
                          text-[10px] uppercase
                          ${conn.status === "connected" ? "text-emerald-400" : "text-neutral-500"}
                        `}>
                          {conn.status}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Storage */}
              <div className="rounded-2xl bg-neutral-900/50 border border-neutral-800/50 p-6 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-serif text-lg font-bold">Storage</h2>
                  <Link
                    href="/storage"
                    className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition-colors"
                  >
                    View <ArrowUpRight className="w-3 h-3" />
                  </Link>
                </div>

                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center">
                    <HardDrive className="w-8 h-8 text-violet-400" />
                  </div>
                  <div>
                    <div className="font-terminal text-3xl font-bold text-neutral-100">
                      {stats.storageUsed} <span className="text-lg text-neutral-500">GB</span>
                    </div>
                    <div className="text-xs text-neutral-500">of 10 GB used</div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-violet-500 to-violet-400 rounded-full transition-all duration-1000"
                    style={{ width: `${(stats.storageUsed / 10) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between mt-2 text-xs text-neutral-600 font-terminal">
                  <span>0 GB</span>
                  <span>10 GB</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// Stat Card Component
function StatCard({
  icon: Icon,
  label,
  value,
  trend,
  trendUp,
  colour,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  trend: string;
  trendUp: boolean;
  colour: "amber" | "cyan" | "emerald" | "violet" | "rose";
}) {
  const colours = {
    amber: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" },
    cyan: { bg: "bg-cyan-500/10", text: "text-cyan-400", border: "border-cyan-500/20" },
    emerald: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
    violet: { bg: "bg-violet-500/10", text: "text-violet-400", border: "border-violet-500/20" },
    rose: { bg: "bg-rose-500/10", text: "text-rose-400", border: "border-rose-500/20" },
  };

  const c = colours[colour];

  return (
    <div className={`
      rounded-2xl ${c.bg} border ${c.border} p-5
      backdrop-blur-sm transition-all duration-300
      hover:scale-[1.02] hover:shadow-lg
    `}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${c.text}`} />
        </div>
        <div className={`
          flex items-center gap-1 px-2 py-1 rounded-full text-xs font-terminal
          ${trendUp ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}
        `}>
          <TrendingUp className={`w-3 h-3 ${!trendUp && "rotate-180"}`} />
          {trend}
        </div>
      </div>
      <div className="font-terminal text-3xl font-bold text-neutral-100 mb-1">
        {value}
      </div>
      <div className="text-xs text-neutral-500 uppercase tracking-wider">
        {label}
      </div>
    </div>
  );
}

function DashboardPage() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <TooltipProvider delayDuration={300}>
          <DashboardContent />
        </TooltipProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
