

import { JobStatus, ExecutionStatus } from "~/lib/jobs-api";

interface JobStatusBadgeProps {
  status: JobStatus | ExecutionStatus | string;
  size?: "xs" | "sm" | "md" | "lg";
  showIcon?: boolean;
  animate?: boolean;
}

// Terminal-style status configuration
const statusConfig: Record<string, {
  bg: string;
  text: string;
  border: string;
  dot: string;
  glow: string;
}> = {
  draft: {
    bg: "bg-zinc-500/10",
    text: "text-zinc-400",
    border: "border-zinc-500/30",
    dot: "bg-zinc-400",
    glow: ""
  },
  scheduled: {
    bg: "bg-cyan-500/10",
    text: "text-cyan-400",
    border: "border-cyan-500/30",
    dot: "bg-cyan-400",
    glow: "shadow-[0_0_8px_rgba(34,211,238,0.3)]"
  },
  running: {
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    border: "border-amber-500/30",
    dot: "bg-amber-400",
    glow: "shadow-[0_0_12px_rgba(251,191,36,0.4)]"
  },
  completed: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    border: "border-emerald-500/30",
    dot: "bg-emerald-400",
    glow: ""
  },
  failed: {
    bg: "bg-rose-500/10",
    text: "text-rose-400",
    border: "border-rose-500/30",
    dot: "bg-rose-400",
    glow: ""
  },
  paused: {
    bg: "bg-orange-500/10",
    text: "text-orange-400",
    border: "border-orange-500/30",
    dot: "bg-orange-400",
    glow: ""
  },
  cancelled: {
    bg: "bg-slate-500/10",
    text: "text-slate-400",
    border: "border-slate-500/30",
    dot: "bg-slate-400",
    glow: ""
  },
  pending: {
    bg: "bg-zinc-500/10",
    text: "text-zinc-400",
    border: "border-zinc-500/30",
    dot: "bg-zinc-400",
    glow: ""
  },
};

const sizeClasses = {
  xs: "text-[10px] px-1.5 py-0.5 gap-1",
  sm: "text-xs px-2 py-0.5 gap-1.5",
  md: "text-xs px-2.5 py-1 gap-1.5",
  lg: "text-sm px-3 py-1.5 gap-2",
};

const dotSizes = {
  xs: "w-1 h-1",
  sm: "w-1.5 h-1.5",
  md: "w-1.5 h-1.5",
  lg: "w-2 h-2",
};

export function JobStatusBadge({
  status,
  size = "md",
  showIcon = true,
  animate = true,
}: JobStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.draft;
  const sizeClass = sizeClasses[size];
  const dotSize = dotSizes[size];
  const isRunning = status === "running";
  const shouldAnimate = animate && isRunning;

  return (
    <span
      className={`
        inline-flex items-center rounded-md font-mono font-medium uppercase tracking-wider
        border transition-all duration-300
        ${sizeClass}
        ${config.bg} ${config.text} ${config.border} ${config.glow}
      `}
    >
      {showIcon && (
        <span
          className={`
            rounded-full shrink-0
            ${dotSize}
            ${config.dot}
            ${shouldAnimate ? "animate-pulse" : ""}
          `}
        />
      )}
      {status}
    </span>
  );
}

// Minimal dot-only indicator for compact views
export function StatusDot({
  status,
  size = "md",
  animate = true,
}: {
  status: string;
  size?: "sm" | "md" | "lg";
  animate?: boolean;
}) {
  const config = statusConfig[status] || statusConfig.draft;
  const isRunning = status === "running";
  const shouldAnimate = animate && isRunning;

  const sizes = {
    sm: "w-1.5 h-1.5",
    md: "w-2 h-2",
    lg: "w-2.5 h-2.5",
  };

  return (
    <span
      className={`
        rounded-full shrink-0 transition-all duration-300
        ${sizes[size]}
        ${config.dot}
        ${shouldAnimate ? "animate-pulse" : ""}
        ${config.glow}
      `}
      title={status}
    />
  );
}

// Step type indicator for workflow visualization
export function StepTypeIndicator({
  type,
  size = "md",
}: {
  type: string;
  size?: "sm" | "md" | "lg";
}) {
  const typeConfig: Record<string, { bg: string; text: string; label: string; fullLabel: string }> = {
    redshift_query: {
      bg: "bg-redshift/20",
      text: "text-redshift",
      label: "RS",
      fullLabel: "Redshift"
    },
    sqlserver_query: {
      bg: "bg-sqlserver/20",
      text: "text-sqlserver",
      label: "SQL",
      fullLabel: "SQL Server"
    },
    merge: {
      bg: "bg-violet-500/20",
      text: "text-violet-400",
      label: "MRG",
      fullLabel: "Merge"
    },
  };

  const config = typeConfig[type] || {
    bg: "bg-zinc-500/20",
    text: "text-zinc-400",
    label: "?",
    fullLabel: "Unknown"
  };

  const sizes = {
    sm: "w-6 h-4 text-[9px]",
    md: "w-7 h-5 text-[10px]",
    lg: "w-9 h-6 text-xs",
  };

  return (
    <span
      className={`
        inline-flex items-center justify-center rounded font-mono font-bold
        ${sizes[size]} ${config.bg} ${config.text}
      `}
      title={config.fullLabel}
    >
      {config.label}
    </span>
  );
}
