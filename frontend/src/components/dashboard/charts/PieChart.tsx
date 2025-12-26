

import { useMemo } from "react";
import type { ChartDataPoint } from "~/lib/dashboard/types";
import * as Tooltip from "@radix-ui/react-tooltip";
import { CHART_COLOURS } from "~/lib/dashboard/types";

interface PieChartProps {
  data: ChartDataPoint[];
  width?: number;
  height?: number;
  showLabels?: boolean;
  showLegend?: boolean;
  innerRadius?: number; // 0 for pie, 0.6 for donut
  className?: string;
}

function polarToCartesian(cx: number, cy: number, radius: number, angle: number) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(rad),
    y: cy + radius * Math.sin(rad),
  };
}

function describeArc(
  cx: number,
  cy: number,
  outerRadius: number,
  innerRadius: number,
  startAngle: number,
  endAngle: number
): string {
  const outerStart = polarToCartesian(cx, cy, outerRadius, startAngle);
  const outerEnd = polarToCartesian(cx, cy, outerRadius, endAngle);
  const innerStart = polarToCartesian(cx, cy, innerRadius, endAngle);
  const innerEnd = polarToCartesian(cx, cy, innerRadius, startAngle);

  const largeArc = endAngle - startAngle > 180 ? 1 : 0;

  if (innerRadius === 0) {
    // Pie slice
    return [
      "M", cx, cy,
      "L", outerStart.x, outerStart.y,
      "A", outerRadius, outerRadius, 0, largeArc, 1, outerEnd.x, outerEnd.y,
      "Z",
    ].join(" ");
  }

  // Donut slice
  return [
    "M", outerStart.x, outerStart.y,
    "A", outerRadius, outerRadius, 0, largeArc, 1, outerEnd.x, outerEnd.y,
    "L", innerStart.x, innerStart.y,
    "A", innerRadius, innerRadius, 0, largeArc, 0, innerEnd.x, innerEnd.y,
    "Z",
  ].join(" ");
}

export function PieChart({
  data,
  width = 300,
  height = 300,
  showLabels = false,
  showLegend = true,
  innerRadius = 0,
  className = "",
}: PieChartProps) {
  const legendWidth = showLegend ? 120 : 0;
  const chartSize = Math.min(width - legendWidth, height);
  const cx = (width - legendWidth) / 2;
  const cy = height / 2;
  const outerRadius = chartSize / 2 - 20;
  const inner = outerRadius * innerRadius;

  const { slices, total } = useMemo(() => {
    const sum = data.reduce((acc, d) => acc + d.value, 0);
    let startAngle = 0;

    const s = data.map((d, i) => {
      const angle = (d.value / sum) * 360;
      const slice = {
        ...d,
        startAngle,
        endAngle: startAngle + angle,
        percentage: (d.value / sum) * 100,
        colour: d.colour || CHART_COLOURS[i % CHART_COLOURS.length],
      };
      startAngle += angle;
      return slice;
    });

    return { slices: s, total: sum };
  }, [data]);

  if (data.length === 0) {
    return (
      <div className={`flex items-center justify-center text-on-surface-variant ${className}`} style={{ width, height }}>
        No data available
      </div>
    );
  }

  return (
    <Tooltip.Provider>
      <div className={`flex items-center ${className}`} style={{ width, height }}>
        <svg width={width - legendWidth} height={height}>
          {slices.map((slice, i) => {
            const midAngle = (slice.startAngle + slice.endAngle) / 2;
            const labelPos = polarToCartesian(cx, cy, outerRadius * 0.7, midAngle);

            return (
              <Tooltip.Root key={i}>
                <Tooltip.Trigger asChild>
                  <path
                    d={describeArc(cx, cy, outerRadius, inner, slice.startAngle, slice.endAngle)}
                    fill={slice.colour}
                    stroke="var(--surface)"
                    strokeWidth={2}
                    className="cursor-pointer transition-opacity hover:opacity-80"
                  />
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content
                    className="bg-surface-container-highest px-3 py-2 rounded-lg shadow-elevation-2 text-xs"
                    sideOffset={5}
                  >
                    <div className="font-medium text-on-surface">{slice.label}</div>
                    <div className="text-on-surface-variant">
                      {slice.value.toLocaleString()} ({slice.percentage.toFixed(1)}%)
                    </div>
                    <Tooltip.Arrow className="fill-surface-container-highest" />
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            );
          })}

          {/* Centre text for donut */}
          {innerRadius > 0 && (
            <text
              x={cx}
              y={cy}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-current text-on-surface"
            >
              <tspan x={cx} dy="-0.5em" className="text-lg font-semibold">
                {total >= 1000 ? `${(total / 1000).toFixed(1)}k` : total.toLocaleString()}
              </tspan>
              <tspan x={cx} dy="1.5em" className="text-xs text-on-surface-variant">
                Total
              </tspan>
            </text>
          )}

          {/* Labels */}
          {showLabels &&
            slices.map((slice, i) => {
              const midAngle = (slice.startAngle + slice.endAngle) / 2;
              const labelPos = polarToCartesian(cx, cy, outerRadius + 15, midAngle);

              return (
                <text
                  key={i}
                  x={labelPos.x}
                  y={labelPos.y}
                  textAnchor={labelPos.x > cx ? "start" : "end"}
                  dominantBaseline="middle"
                  className="fill-current text-[10px] text-on-surface-variant"
                >
                  {slice.percentage.toFixed(0)}%
                </text>
              );
            })}
        </svg>

        {/* Legend */}
        {showLegend && (
          <div className="flex flex-col gap-2 pl-4" style={{ width: legendWidth }}>
            {slices.slice(0, 6).map((slice, i) => (
              <div key={i} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-sm shrink-0"
                  style={{ backgroundColor: slice.colour }}
                />
                <span className="text-xs text-on-surface-variant truncate">
                  {slice.label}
                </span>
              </div>
            ))}
            {slices.length > 6 && (
              <span className="text-xs text-on-surface-variant">
                +{slices.length - 6} more
              </span>
            )}
          </div>
        )}
      </div>
    </Tooltip.Provider>
  );
}

// Export DonutChart as a convenience wrapper
export function DonutChart(props: Omit<PieChartProps, "innerRadius">) {
  return <PieChart {...props} innerRadius={0.6} />;
}
