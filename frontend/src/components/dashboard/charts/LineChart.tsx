

import { useMemo } from "react";
import type { ChartDataPoint } from "~/lib/dashboard/types";
import * as Tooltip from "@radix-ui/react-tooltip";

interface LineChartProps {
  data: ChartDataPoint[];
  width?: number;
  height?: number;
  showGrid?: boolean;
  showLabels?: boolean;
  showDots?: boolean;
  smooth?: boolean;
  colour?: string;
  className?: string;
}

export function LineChart({
  data,
  width = 400,
  height = 300,
  showGrid = true,
  showLabels = false,
  showDots = true,
  smooth = true,
  colour = "#06b6d4",
  className = "",
}: LineChartProps) {
  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const { maxValue, minValue, yTicks, points, linePath, areaPath } = useMemo(() => {
    const values = data.map((d) => d.value);
    const min = Math.min(...values, 0);
    const max = Math.max(...values, 0);
    const range = max - min || 1;
    const niceMax = max + range * 0.1;
    const niceMin = Math.min(min - range * 0.1, 0);
    const tickCount = 5;
    const tickStep = (niceMax - niceMin) / tickCount;
    const ticks = Array.from({ length: tickCount + 1 }, (_, i) => niceMin + i * tickStep);

    const pts = data.map((d, i) => ({
      x: padding.left + (i / (data.length - 1 || 1)) * chartWidth,
      y: padding.top + chartHeight - ((d.value - niceMin) / (niceMax - niceMin)) * chartHeight,
      ...d,
    }));

    // Create SVG path
    let line = "";
    let area = "";
    if (pts.length > 0) {
      if (smooth && pts.length > 2) {
        // Catmull-Rom spline
        line = `M ${pts[0].x} ${pts[0].y}`;
        area = `M ${pts[0].x} ${padding.top + chartHeight} L ${pts[0].x} ${pts[0].y}`;
        for (let i = 0; i < pts.length - 1; i++) {
          const p0 = pts[Math.max(0, i - 1)];
          const p1 = pts[i];
          const p2 = pts[i + 1];
          const p3 = pts[Math.min(pts.length - 1, i + 2)];
          const cp1x = p1.x + (p2.x - p0.x) / 6;
          const cp1y = p1.y + (p2.y - p0.y) / 6;
          const cp2x = p2.x - (p3.x - p1.x) / 6;
          const cp2y = p2.y - (p3.y - p1.y) / 6;
          line += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
          area += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
        }
        area += ` L ${pts[pts.length - 1].x} ${padding.top + chartHeight} Z`;
      } else {
        line = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
        area = `M ${pts[0].x} ${padding.top + chartHeight} ` +
          pts.map((p) => `L ${p.x} ${p.y}`).join(" ") +
          ` L ${pts[pts.length - 1].x} ${padding.top + chartHeight} Z`;
      }
    }

    return { maxValue: niceMax, minValue: niceMin, yTicks: ticks, points: pts, linePath: line, areaPath: area };
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
          <linearGradient id={`line-gradient-${colour.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colour} stopOpacity={0.3} />
            <stop offset="100%" stopColor={colour} stopOpacity={0.05} />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {showGrid && (
          <g className="grid-lines">
            {yTicks.map((tick, i) => {
              const y = padding.top + chartHeight - ((tick - minValue) / (maxValue - minValue)) * chartHeight;
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
          fill={`url(#line-gradient-${colour.replace("#", "")})`}
        />

        {/* Line */}
        <path
          d={linePath}
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
                  className="cursor-pointer transition-all hover:r-6"
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

        {/* Data labels */}
        {showLabels &&
          points.map((p, i) => (
            <text
              key={i}
              x={p.x}
              y={p.y - 10}
              textAnchor="middle"
              className="fill-current text-[10px] font-medium text-on-surface"
            >
              {p.value >= 1000 ? `${(p.value / 1000).toFixed(1)}k` : p.value.toFixed(0)}
            </text>
          ))}
      </svg>
    </Tooltip.Provider>
  );
}
