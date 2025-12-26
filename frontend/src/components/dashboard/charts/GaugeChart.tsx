

import { useMemo } from "react";

interface GaugeChartProps {
  value: number;
  min?: number;
  max?: number;
  label?: string;
  suffix?: string;
  width?: number;
  height?: number;
  colour?: string;
  showTicks?: boolean;
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
  radius: number,
  startAngle: number,
  endAngle: number
): string {
  const start = polarToCartesian(cx, cy, radius, startAngle);
  const end = polarToCartesian(cx, cy, radius, endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;

  return [
    "M", start.x, start.y,
    "A", radius, radius, 0, largeArc, 1, end.x, end.y,
  ].join(" ");
}

export function GaugeChart({
  value,
  min = 0,
  max = 100,
  label = "",
  suffix = "",
  width = 200,
  height = 150,
  colour = "#10b981",
  showTicks = true,
  className = "",
}: GaugeChartProps) {
  const cx = width / 2;
  const cy = height - 20;
  const radius = Math.min(cx - 20, cy - 20);
  const strokeWidth = 12;

  const { percentage, valueAngle, colourZones } = useMemo(() => {
    const pct = Math.max(0, Math.min(1, (value - min) / (max - min)));
    const startAngle = -180;
    const endAngle = 0;
    const angleRange = endAngle - startAngle;
    const vAngle = startAngle + pct * angleRange;

    // Colour zones for visual indication
    const zones = [
      { start: -180, end: -120, colour: "#ef4444" }, // Red
      { start: -120, end: -60, colour: "#f59e0b" },  // Amber
      { start: -60, end: 0, colour: "#10b981" },     // Green
    ];

    return { percentage: pct, valueAngle: vAngle, colourZones: zones };
  }, [value, min, max]);

  const formatValue = (v: number) => {
    if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
    if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
    return v.toLocaleString("en-US", { maximumFractionDigits: 0 });
  };

  return (
    <div className={`flex flex-col items-center ${className}`} style={{ width, height }}>
      <svg width={width} height={height - 20}>
        {/* Background arc */}
        <path
          d={describeArc(cx, cy, radius, -180, 0)}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.1}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Coloured zones (optional) */}
        {showTicks && colourZones.map((zone, i) => (
          <path
            key={i}
            d={describeArc(cx, cy, radius - strokeWidth - 4, zone.start, zone.end)}
            fill="none"
            stroke={zone.colour}
            strokeOpacity={0.3}
            strokeWidth={4}
            strokeLinecap="round"
          />
        ))}

        {/* Value arc */}
        <path
          d={describeArc(cx, cy, radius, -180, valueAngle)}
          fill="none"
          stroke={colour}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          style={{
            filter: `drop-shadow(0 0 6px ${colour}60)`,
          }}
        />

        {/* Needle */}
        <g transform={`rotate(${valueAngle + 90}, ${cx}, ${cy})`}>
          <line
            x1={cx}
            y1={cy}
            x2={cx}
            y2={cy - radius + 15}
            stroke="currentColor"
            strokeWidth={3}
            strokeLinecap="round"
            className="text-on-surface"
          />
          <circle
            cx={cx}
            cy={cy}
            r={6}
            fill="currentColor"
            className="text-on-surface"
          />
        </g>

        {/* Min/Max labels */}
        <text
          x={cx - radius + 10}
          y={cy + 16}
          textAnchor="start"
          className="fill-current text-[10px] text-on-surface-variant"
        >
          {formatValue(min)}
        </text>
        <text
          x={cx + radius - 10}
          y={cy + 16}
          textAnchor="end"
          className="fill-current text-[10px] text-on-surface-variant"
        >
          {formatValue(max)}
        </text>

        {/* Value display */}
        <text
          x={cx}
          y={cy - 10}
          textAnchor="middle"
          className="fill-current text-2xl font-bold text-on-surface"
        >
          {formatValue(value)}{suffix}
        </text>
      </svg>

      {/* Label */}
      {label && (
        <span className="text-sm text-on-surface-variant mt-1">{label}</span>
      )}
    </div>
  );
}
