

import { useMemo } from "react";
import type { ChartDataPoint } from "~/lib/dashboard/types";
import * as Tooltip from "@radix-ui/react-tooltip";

interface BarChartProps {
  data: ChartDataPoint[];
  width?: number;
  height?: number;
  showGrid?: boolean;
  showLabels?: boolean;
  orientation?: "vertical" | "horizontal";
  className?: string;
}

export function BarChart({
  data,
  width = 400,
  height = 300,
  showGrid = true,
  showLabels = false,
  orientation = "vertical",
  className = "",
}: BarChartProps) {
  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const { maxValue, yTicks } = useMemo(() => {
    const values = data.map((d) => d.value);
    const max = Math.max(...values, 0);
    const niceMax = Math.ceil(max * 1.1);
    const tickCount = 5;
    const tickStep = niceMax / tickCount;
    const ticks = Array.from({ length: tickCount + 1 }, (_, i) => i * tickStep);
    return { maxValue: niceMax, yTicks: ticks };
  }, [data]);

  if (data.length === 0) {
    return (
      <div className={`flex items-center justify-center text-on-surface-variant ${className}`} style={{ width, height }}>
        No data available
      </div>
    );
  }

  const isVertical = orientation === "vertical";
  const barGap = 4;
  const barWidth = isVertical
    ? (chartWidth - barGap * (data.length - 1)) / data.length
    : (chartHeight - barGap * (data.length - 1)) / data.length;

  return (
    <Tooltip.Provider>
      <svg width={width} height={height} className={className}>
        {/* Grid lines */}
        {showGrid && (
          <g className="grid-lines">
            {yTicks.map((tick, i) => {
              const y = isVertical
                ? padding.top + chartHeight - (tick / maxValue) * chartHeight
                : padding.left + (tick / maxValue) * chartWidth;
              return (
                <g key={i}>
                  {isVertical ? (
                    <>
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
                    </>
                  ) : (
                    <>
                      <line
                        x1={y}
                        y1={padding.top}
                        x2={y}
                        y2={height - padding.bottom}
                        stroke="currentColor"
                        strokeOpacity={0.1}
                        strokeDasharray="4"
                      />
                      <text
                        x={y}
                        y={height - padding.bottom + 16}
                        textAnchor="middle"
                        className="fill-current text-[10px] text-on-surface-variant"
                      >
                        {tick >= 1000 ? `${(tick / 1000).toFixed(0)}k` : tick.toFixed(0)}
                      </text>
                    </>
                  )}
                </g>
              );
            })}
          </g>
        )}

        {/* Bars */}
        {data.map((d, i) => {
          const barHeight = (d.value / maxValue) * (isVertical ? chartHeight : chartWidth);
          const x = isVertical
            ? padding.left + i * (barWidth + barGap)
            : padding.left;
          const y = isVertical
            ? padding.top + chartHeight - barHeight
            : padding.top + i * (barWidth + barGap);
          const w = isVertical ? barWidth : barHeight;
          const h = isVertical ? barHeight : barWidth;

          return (
            <Tooltip.Root key={i}>
              <Tooltip.Trigger asChild>
                <rect
                  x={x}
                  y={y}
                  width={Math.max(w, 0)}
                  height={Math.max(h, 0)}
                  fill={d.colour || "#f59e0b"}
                  rx={2}
                  className="cursor-pointer transition-opacity hover:opacity-80"
                />
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content
                  className="bg-surface-container-highest px-3 py-2 rounded-lg shadow-elevation-2 text-xs"
                  sideOffset={5}
                >
                  <div className="font-medium text-on-surface">{d.label}</div>
                  <div className="text-on-surface-variant">
                    {d.value.toLocaleString()}
                  </div>
                  <Tooltip.Arrow className="fill-surface-container-highest" />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          );
        })}

        {/* X-axis labels */}
        {data.map((d, i) => {
          const x = isVertical
            ? padding.left + i * (barWidth + barGap) + barWidth / 2
            : padding.left - 8;
          const y = isVertical
            ? height - padding.bottom + 16
            : padding.top + i * (barWidth + barGap) + barWidth / 2;

          return (
            <text
              key={i}
              x={x}
              y={y}
              textAnchor={isVertical ? "middle" : "end"}
              dominantBaseline={isVertical ? "auto" : "middle"}
              className="fill-current text-[10px] text-on-surface-variant"
            >
              {d.label.length > 10 ? `${d.label.slice(0, 10)}...` : d.label}
            </text>
          );
        })}

        {/* Data labels */}
        {showLabels &&
          data.map((d, i) => {
            const barHeight = (d.value / maxValue) * (isVertical ? chartHeight : chartWidth);
            const x = isVertical
              ? padding.left + i * (barWidth + barGap) + barWidth / 2
              : padding.left + barHeight + 4;
            const y = isVertical
              ? padding.top + chartHeight - barHeight - 4
              : padding.top + i * (barWidth + barGap) + barWidth / 2;

            return (
              <text
                key={i}
                x={x}
                y={y}
                textAnchor={isVertical ? "middle" : "start"}
                dominantBaseline={isVertical ? "auto" : "middle"}
                className="fill-current text-[10px] font-medium text-on-surface"
              >
                {d.value >= 1000 ? `${(d.value / 1000).toFixed(1)}k` : d.value.toFixed(0)}
              </text>
            );
          })}
      </svg>
    </Tooltip.Provider>
  );
}
