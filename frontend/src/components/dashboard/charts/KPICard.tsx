

import { useMemo } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { formatValue } from "~/lib/dashboard/aggregations";

interface KPICardProps {
  value: number;
  label: string;
  previousValue?: number;
  format?: "number" | "currency" | "percentage";
  prefix?: string;
  suffix?: string;
  colour?: string;
  width?: number;
  height?: number;
  className?: string;
}

export function KPICard({
  value,
  label,
  previousValue,
  format = "number",
  prefix = "",
  suffix = "",
  colour = "#f59e0b",
  width = 200,
  height = 120,
  className = "",
}: KPICardProps) {
  const { formattedValue, change, changePercent, trend } = useMemo(() => {
    const formatted = formatValue(value, format, prefix, suffix);

    if (previousValue === undefined || previousValue === 0) {
      return { formattedValue: formatted, change: 0, changePercent: 0, trend: "neutral" as const };
    }

    const diff = value - previousValue;
    const pct = (diff / previousValue) * 100;
    const t = diff > 0 ? "up" : diff < 0 ? "down" : "neutral";

    return {
      formattedValue: formatted,
      change: diff,
      changePercent: pct,
      trend: t as "up" | "down" | "neutral",
    };
  }, [value, previousValue, format, prefix, suffix]);

  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColour = trend === "up" ? "text-emerald-400" : trend === "down" ? "text-rose-400" : "text-on-surface-variant";

  return (
    <div
      className={`flex flex-col justify-center p-4 rounded-xl ${className}`}
      style={{ width, height }}
    >
      {/* Label */}
      <span className="text-xs text-on-surface-variant font-medium uppercase tracking-wider mb-2">
        {label}
      </span>

      {/* Main value */}
      <div className="flex items-baseline gap-2">
        <span
          className="text-3xl font-bold"
          style={{ color: colour }}
        >
          {formattedValue}
        </span>
      </div>

      {/* Trend indicator */}
      {previousValue !== undefined && (
        <div className={`flex items-center gap-1 mt-2 ${trendColour}`}>
          <TrendIcon className="w-4 h-4" />
          <span className="text-sm font-medium">
            {changePercent >= 0 ? "+" : ""}{changePercent.toFixed(1)}%
          </span>
          <span className="text-xs text-on-surface-variant ml-1">
            vs previous
          </span>
        </div>
      )}
    </div>
  );
}

// Multi-KPI variant for displaying multiple metrics
interface MultiKPICardProps {
  metrics: Array<{
    value: number;
    label: string;
    format?: "number" | "currency" | "percentage";
    prefix?: string;
    suffix?: string;
    colour?: string;
  }>;
  width?: number;
  height?: number;
  className?: string;
}

export function MultiKPICard({
  metrics,
  width = 400,
  height = 120,
  className = "",
}: MultiKPICardProps) {
  return (
    <div
      className={`flex items-stretch divide-x divide-outline-variant/30 ${className}`}
      style={{ width, height }}
    >
      {metrics.map((metric, i) => (
        <div key={i} className="flex-1 flex flex-col justify-center px-4 first:pl-0 last:pr-0">
          <span className="text-xs text-on-surface-variant font-medium uppercase tracking-wider mb-1">
            {metric.label}
          </span>
          <span
            className="text-2xl font-bold"
            style={{ color: metric.colour || "#f59e0b" }}
          >
            {formatValue(metric.value, metric.format || "number", metric.prefix || "", metric.suffix || "")}
          </span>
        </div>
      ))}
    </div>
  );
}
