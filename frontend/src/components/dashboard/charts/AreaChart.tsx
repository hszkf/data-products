

import { useMemo } from "react";
import type { ChartDataPoint } from "~/lib/dashboard/types";
import * as Tooltip from "@radix-ui/react-tooltip";

interface AreaChartProps {
  data: ChartDataPoint[];
  width?: number;
  height?: number;
  showGrid?: boolean;
  showDots?: boolean;
  smooth?: boolean;
  colour?: string;
  stacked?: boolean;
  className?: string;
}

export function AreaChart({
  data,
  width = 400,
  height = 300,
  showGrid = true,
  showDots = false,
  smooth = true,
  colour = "#10b981",
  className = "",
}: AreaChartProps) {
  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const { maxValue, minValue, yTicks, points, areaPath } = useMemo(() => {
    const values = data.map((d) => d.value);
    const min = 0;
    const max = Math.max(...values, 0);
    const niceMax = Math.ceil(max * 1.1);
    const tickCount = 5;
    const tickStep = niceMax / tickCount;
    const ticks = Array.from({ length: tickCount + 1 }, (_, i) => i * tickStep);

    const pts = data.map((d, i) => ({
      x: padding.left + (i / (data.length - 1 || 1)) * chartWidth,
      y: padding.top + chartHeight - (d.value / niceMax) * chartHeight,
      ...d,
    }));

    let path = "";
    if (pts.length > 0) {
      const baseline = padding.top + chartHeight;

      if (smooth && pts.length > 2) {
        path = `M ${pts[0].x} ${baseline} L ${pts[0].x} ${pts[0].y}`;
        for (let i = 0; i < pts.length - 1; i++) {
          const p0 = pts[Math.max(0, i - 1)];
          const p1 = pts[i];
          const p2 = pts[i + 1];
          const p3 = pts[Math.min(pts.length - 1, i + 2)];
          const cp1x = p1.x + (p2.x - p0.x) / 6;
          const cp1y = p1.y + (p2.y - p0.y) / 6;
          const cp2x = p2.x - (p3.x - p1.x) / 6;
          const cp2y = p2.y - (p3.y - p1.y) / 6;
          path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
        }
        path += ` L ${pts[pts.length - 1].x} ${baseline} Z`;
      } else {
        path = `M ${pts[0].x} ${baseline} ` +
          pts.map((p) => `L ${p.x} ${p.y}`).join(" ") +
          ` L ${pts[pts.length - 1].x} ${baseline} Z`;
      }
    }

    return { maxValue: niceMax, minValue: min, yTicks: ticks, points: pts, areaPath: path };
  }, [data, chartWidth, chartHeight, padding.left, padding.top, smooth]);

  if (data.length === 0) {
    return (
      <div className={`flex items-center justify-center text-on-surface-variant ${className}`} style={{ width, height }}>
        No data available
      </div>
    );
  }

  return (
    <Tooltip.Provider>
      <svg width={width} height={height} className={className}>
        <defs>
          <linearGradient id={`area-gradient-${colour.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colour} stopOpacity={0.6} />
            <stop offset="100%" stopColor={colour} stopOpacity={0.1} />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {showGrid && (
          <g className="grid-lines">
            {yTicks.map((tick, i) => {
              const y = padding.top + chartHeight - (tick / maxValue) * chartHeight;
              return (
                <g key={i}>
                  <line
                    x1={padding.left}
                    y1={y}
                    x2={width - padding.right}
                    y2={y}
                    stroke="currentColor"
                    strokeOpacity={0.1}
                    strokeDasharray="4"
                  />
                  <text
                    x={padding.left - 8}
                    y={y}
                    textAnchor="end"
                    dominantBaseline="middle"
                    className="fill-current text-[10px] text-on-surface-variant"
                  >
                    {tick >= 1000 ? `${(tick / 1000).toFixed(0)}k` : tick.toFixed(0)}
                  </text>
                </g>
              );
            })}
          </g>
        )}

        {/* Area fill */}
        <path
          d={areaPath}
          fill={`url(#area-gradient-${colour.replace("#", "")})`}
        />

        {/* Line on top */}
        <path
          d={areaPath.replace(/^M [^ ]+ [^ ]+ /, "M ").replace(/ L [^ ]+ [^ ]+ Z$/, "")}
          fill="none"
          stroke={colour}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {showDots &&
          points.map((p, i) => (
            <Tooltip.Root key={i}>
              <Tooltip.Trigger asChild>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={4}
                  fill={colour}
                  stroke="var(--surface)"
                  strokeWidth={2}
                  className="cursor-pointer"
                />
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content
                  className="bg-surface-container-highest px-3 py-2 rounded-lg shadow-elevation-2 text-xs"
                  sideOffset={5}
                >
                  <div className="font-medium text-on-surface">{p.label}</div>
                  <div className="text-on-surface-variant">
                    {p.value.toLocaleString()}
                  </div>
                  <Tooltip.Arrow className="fill-surface-container-highest" />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          ))}

        {/* X-axis labels */}
        {data.map((d, i) => {
          const x = padding.left + (i / (data.length - 1 || 1)) * chartWidth;
          return (
            <text
              key={i}
              x={x}
              y={height - padding.bottom + 16}
              textAnchor="middle"
              className="fill-current text-[10px] text-on-surface-variant"
            >
              {d.label.length > 8 ? `${d.label.slice(0, 8)}...` : d.label}
            </text>
          );
        })}
      </svg>
    </Tooltip.Provider>
  );
}
