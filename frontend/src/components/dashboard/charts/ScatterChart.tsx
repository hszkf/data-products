

import { useMemo } from "react";
import type { ScatterDataPoint } from "~/lib/dashboard/types";
import * as Tooltip from "@radix-ui/react-tooltip";
import { CHART_COLOURS } from "~/lib/dashboard/types";

interface ScatterChartProps {
  data: ScatterDataPoint[];
  width?: number;
  height?: number;
  showGrid?: boolean;
  xLabel?: string;
  yLabel?: string;
  className?: string;
}

export function ScatterChart({
  data,
  width = 400,
  height = 300,
  showGrid = true,
  xLabel = "",
  yLabel = "",
  className = "",
}: ScatterChartProps) {
  const padding = { top: 20, right: 20, bottom: 50, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const { xRange, yRange, xTicks, yTicks, points } = useMemo(() => {
    if (data.length === 0) {
      return {
        xRange: { min: 0, max: 100 },
        yRange: { min: 0, max: 100 },
        xTicks: [],
        yTicks: [],
        points: [],
      };
    }

    const xValues = data.map((d) => d.x);
    const yValues = data.map((d) => d.y);

    const xMin = Math.min(...xValues);
    const xMax = Math.max(...xValues);
    const yMin = Math.min(...yValues);
    const yMax = Math.max(...yValues);

    const xPadding = (xMax - xMin) * 0.1 || 10;
    const yPadding = (yMax - yMin) * 0.1 || 10;

    const xR = { min: xMin - xPadding, max: xMax + xPadding };
    const yR = { min: Math.min(yMin - yPadding, 0), max: yMax + yPadding };

    const tickCount = 5;
    const xStep = (xR.max - xR.min) / tickCount;
    const yStep = (yR.max - yR.min) / tickCount;

    const xT = Array.from({ length: tickCount + 1 }, (_, i) => xR.min + i * xStep);
    const yT = Array.from({ length: tickCount + 1 }, (_, i) => yR.min + i * yStep);

    const pts = data.map((d, i) => ({
      ...d,
      px: padding.left + ((d.x - xR.min) / (xR.max - xR.min)) * chartWidth,
      py: padding.top + chartHeight - ((d.y - yR.min) / (yR.max - yR.min)) * chartHeight,
      colour: d.colour || CHART_COLOURS[i % CHART_COLOURS.length],
    }));

    return { xRange: xR, yRange: yR, xTicks: xT, yTicks: yT, points: pts };
  }, [data, chartWidth, chartHeight, padding.left, padding.top]);

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
        {/* Grid lines */}
        {showGrid && (
          <g className="grid-lines">
            {/* Horizontal grid */}
            {yTicks.map((tick, i) => {
              const y = padding.top + chartHeight - ((tick - yRange.min) / (yRange.max - yRange.min)) * chartHeight;
              return (
                <g key={`y-${i}`}>
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
            {/* Vertical grid */}
            {xTicks.map((tick, i) => {
              const x = padding.left + ((tick - xRange.min) / (xRange.max - xRange.min)) * chartWidth;
              return (
                <g key={`x-${i}`}>
                  <line
                    x1={x}
                    y1={padding.top}
                    x2={x}
                    y2={height - padding.bottom}
                    stroke="currentColor"
                    strokeOpacity={0.1}
                    strokeDasharray="4"
                  />
                  <text
                    x={x}
                    y={height - padding.bottom + 16}
                    textAnchor="middle"
                    className="fill-current text-[10px] text-on-surface-variant"
                  >
                    {tick >= 1000 ? `${(tick / 1000).toFixed(0)}k` : tick.toFixed(0)}
                  </text>
                </g>
              );
            })}
          </g>
        )}

        {/* Data points */}
        {points.map((p, i) => (
          <Tooltip.Root key={i}>
            <Tooltip.Trigger asChild>
              <circle
                cx={p.px}
                cy={p.py}
                r={6}
                fill={p.colour}
                fillOpacity={0.7}
                stroke={p.colour}
                strokeWidth={2}
                className="cursor-pointer transition-all hover:r-8"
              />
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                className="bg-surface-container-highest px-3 py-2 rounded-lg shadow-elevation-2 text-xs"
                sideOffset={5}
              >
                {p.label && <div className="font-medium text-on-surface mb-1">{p.label}</div>}
                <div className="text-on-surface-variant">
                  X: {p.x.toLocaleString()}
                </div>
                <div className="text-on-surface-variant">
                  Y: {p.y.toLocaleString()}
                </div>
                <Tooltip.Arrow className="fill-surface-container-highest" />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        ))}

        {/* Axis labels */}
        {xLabel && (
          <text
            x={width / 2}
            y={height - 8}
            textAnchor="middle"
            className="fill-current text-xs text-on-surface-variant"
          >
            {xLabel}
          </text>
        )}
        {yLabel && (
          <text
            x={14}
            y={height / 2}
            textAnchor="middle"
            transform={`rotate(-90, 14, ${height / 2})`}
            className="fill-current text-xs text-on-surface-variant"
          >
            {yLabel}
          </text>
        )}
      </svg>
    </Tooltip.Provider>
  );
}
