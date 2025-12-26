

import { useMemo } from "react";
import { Edit2, Copy, Trash2, GripVertical } from "lucide-react";
import * as Tooltip from "@radix-ui/react-tooltip";
import type { ChartConfig, ChartDataPoint, ScatterDataPoint } from "~/lib/dashboard/types";
import { useMerge } from "~/components/merge/merge-context";
import { transformToChartData, aggregate, calculateColumnStats } from "~/lib/dashboard/aggregations";
import {
  BarChart,
  LineChart,
  AreaChart,
  PieChart,
  DonutChart,
  ScatterChart,
  GaugeChart,
  KPICard,
  TableChart,
} from "./charts";

interface DashboardWidgetProps {
  chart: ChartConfig;
  width: number;
  height: number;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  isSelected?: boolean;
}

export function DashboardWidget({
  chart,
  width,
  height,
  onEdit,
  onDuplicate,
  onDelete,
  isSelected = false,
}: DashboardWidgetProps) {
  const { tables } = useMerge();
  const table = tables[chart.tableId];

  // Calculate chart data based on configuration
  const chartData = useMemo((): ChartDataPoint[] => {
    if (!table || !chart.fields.xAxis || chart.fields.yAxis.length === 0) {
      return [];
    }

    return transformToChartData(
      table.rows,
      chart.fields.xAxis.column,
      chart.fields.yAxis,
      chart.colours
    );
  }, [table, chart.fields, chart.colours]);

  // Scatter plot data
  const scatterData = useMemo((): ScatterDataPoint[] => {
    if (chart.type !== "scatter" || !table) return [];
    if (!chart.fields.xAxis || chart.fields.yAxis.length === 0) return [];

    const xCol = chart.fields.xAxis.column;
    const yField = chart.fields.yAxis[0];

    return table.rows.map((row, i) => ({
      x: Number(row[xCol]) || 0,
      y: Number(row[yField.column]) || 0,
      label: chart.fields.legend ? String(row[chart.fields.legend.column]) : undefined,
      colour: chart.colours[i % chart.colours.length],
    }));
  }, [table, chart]);

  // KPI value
  const kpiValue = useMemo(() => {
    if (chart.type !== "kpi" || !table) return 0;
    if (chart.fields.yAxis.length === 0) return 0;

    return aggregate(table.rows, chart.fields.yAxis[0]);
  }, [table, chart]);

  // Gauge value
  const gaugeData = useMemo(() => {
    if (chart.type !== "gauge" || !table) return { value: 0, min: 0, max: 100 };
    if (chart.fields.yAxis.length === 0) return { value: 0, min: 0, max: 100 };

    const value = aggregate(table.rows, chart.fields.yAxis[0]);
    const stats = calculateColumnStats(table.rows, chart.fields.yAxis[0].column);

    return {
      value,
      min: chart.options.gaugeMin ?? stats.min,
      max: chart.options.gaugeMax ?? stats.max,
    };
  }, [table, chart]);

  // Table data
  const tableData = useMemo(() => {
    if (chart.type !== "table" || !table) return [];
    return table.rows;
  }, [table, chart.type]);

  const tableColumns = useMemo(() => {
    if (chart.type !== "table" || !table) return [];
    return table.columns;
  }, [table, chart.type]);

  const contentHeight = height - 48; // Account for header
  const contentWidth = width - 16; // Account for padding

  const renderChart = () => {
    if (!table) {
      return (
        <div className="flex items-center justify-center h-full text-on-surface-variant text-sm">
          Table not found: {chart.tableId}
        </div>
      );
    }

    switch (chart.type) {
      case "bar":
        return (
          <BarChart
            data={chartData}
            width={contentWidth}
            height={contentHeight}
            showGrid={chart.options.showGrid}
            showLabels={chart.options.showDataLabels}
            orientation={chart.options.orientation}
          />
        );

      case "line":
        return (
          <LineChart
            data={chartData}
            width={contentWidth}
            height={contentHeight}
            showGrid={chart.options.showGrid}
            showLabels={chart.options.showDataLabels}
            smooth={chart.options.smooth}
            colour={chart.colours[0]}
          />
        );

      case "area":
        return (
          <AreaChart
            data={chartData}
            width={contentWidth}
            height={contentHeight}
            showGrid={chart.options.showGrid}
            smooth={chart.options.smooth}
            colour={chart.colours[0]}
          />
        );

      case "pie":
        return (
          <PieChart
            data={chartData}
            width={contentWidth}
            height={contentHeight}
            showLabels={chart.options.showDataLabels}
            showLegend={chart.options.showLegend}
          />
        );

      case "donut":
        return (
          <DonutChart
            data={chartData}
            width={contentWidth}
            height={contentHeight}
            showLabels={chart.options.showDataLabels}
            showLegend={chart.options.showLegend}
          />
        );

      case "scatter":
        return (
          <ScatterChart
            data={scatterData}
            width={contentWidth}
            height={contentHeight}
            showGrid={chart.options.showGrid}
            xLabel={chart.fields.xAxis?.column}
            yLabel={chart.fields.yAxis[0]?.column}
          />
        );

      case "gauge":
        return (
          <GaugeChart
            value={gaugeData.value}
            min={gaugeData.min}
            max={gaugeData.max}
            label={chart.fields.yAxis[0]?.column || ""}
            width={contentWidth}
            height={contentHeight}
            colour={chart.colours[0]}
          />
        );

      case "kpi":
        return (
          <KPICard
            value={kpiValue}
            label={chart.fields.yAxis[0]?.column || chart.name}
            format={chart.options.kpiFormat}
            prefix={chart.options.kpiPrefix}
            suffix={chart.options.kpiSuffix}
            width={contentWidth}
            height={contentHeight}
            colour={chart.colours[0]}
          />
        );

      case "table":
        return (
          <TableChart
            data={tableData}
            columns={tableColumns}
            width={contentWidth}
            height={contentHeight}
          />
        );

      default:
        return (
          <div className="flex items-center justify-center h-full text-on-surface-variant">
            Unsupported chart type
          </div>
        );
    }
  };

  return (
    <Tooltip.Provider>
      <div
        className={`
          flex flex-col h-full bg-surface-container rounded-xl border transition-all
          ${isSelected ? "border-amber-500/50 shadow-lg shadow-amber-500/10" : "border-outline-variant/30"}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-outline-variant/20">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <GripVertical className="w-4 h-4 text-on-surface-variant/50 cursor-grab widget-drag-handle shrink-0" />
            <span className="text-sm font-medium text-on-surface truncate">
              {chart.name}
            </span>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <button
                  onClick={onEdit}
                  className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </Tooltip.Trigger>
              <Tooltip.Content className="bg-surface-container-highest px-2 py-1 rounded text-xs" sideOffset={5}>
                Edit
              </Tooltip.Content>
            </Tooltip.Root>

            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <button
                  onClick={onDuplicate}
                  className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </Tooltip.Trigger>
              <Tooltip.Content className="bg-surface-container-highest px-2 py-1 rounded text-xs" sideOffset={5}>
                Duplicate
              </Tooltip.Content>
            </Tooltip.Root>

            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <button
                  onClick={onDelete}
                  className="p-1.5 rounded-lg hover:bg-red-500/20 text-on-surface-variant hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </Tooltip.Trigger>
              <Tooltip.Content className="bg-surface-container-highest px-2 py-1 rounded text-xs" sideOffset={5}>
                Delete
              </Tooltip.Content>
            </Tooltip.Root>
          </div>
        </div>

        {/* Chart content */}
        <div className="flex-1 p-2 overflow-hidden">
          {renderChart()}
        </div>
      </div>
    </Tooltip.Provider>
  );
}
