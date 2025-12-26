

import { useState, useMemo, useCallback } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  X,
  BarChart3,
  LineChart,
  PieChart,
  Circle,
  AreaChart,
  ScatterChart,
  Gauge,
  Hash,
  Table,
} from "lucide-react";
import { useDashboard } from "./DashboardProvider";
import { useMerge } from "~/components/merge/merge-context";
import { FieldPill, FieldPillOverlay } from "./FieldPill";
import { DropZone } from "./DropZone";
import { inferColumnType, suggestAggregation } from "~/lib/dashboard/aggregations";
import {
  type ChartType,
  type ChartConfig,
  type FieldConfig,
  type AggregatedField,
  type AggregationType,
  type DragItem,
  type DropZoneType,
  CHART_TYPE_INFO,
  CHART_COLOURS,
  DEFAULT_CHART_OPTIONS,
} from "~/lib/dashboard/types";
import { generateId } from "~/lib/dashboard/storage";

const chartTypeIcons: Record<ChartType, typeof BarChart3> = {
  bar: BarChart3,
  line: LineChart,
  pie: PieChart,
  donut: Circle,
  area: AreaChart,
  scatter: ScatterChart,
  gauge: Gauge,
  kpi: Hash,
  table: Table,
};

export function ChartBuilder() {
  const { state, addChart, updateChart, closeBuilder } = useDashboard();
  const { tables } = useMerge();
  const { isBuilderOpen, editingChart } = state;

  // Form state
  const [chartName, setChartName] = useState("");
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [xAxisField, setXAxisField] = useState<FieldConfig | null>(null);
  const [yAxisFields, setYAxisFields] = useState<AggregatedField[]>([]);
  const [legendField, setLegendField] = useState<FieldConfig | null>(null);

  // Drag state
  const [activeField, setActiveField] = useState<DragItem | null>(null);

  // Initialize form when editing
  useMemo(() => {
    if (editingChart) {
      setChartName(editingChart.name);
      setChartType(editingChart.type);
      setSelectedTable(editingChart.tableId);
      setXAxisField(editingChart.fields.xAxis);
      setYAxisFields(editingChart.fields.yAxis);
      setLegendField(editingChart.fields.legend);
    } else {
      setChartName("");
      setChartType("bar");
      setSelectedTable("");
      setXAxisField(null);
      setYAxisFields([]);
      setLegendField(null);
    }
  }, [editingChart, isBuilderOpen]);

  // Get columns from selected table
  const tableColumns = useMemo(() => {
    if (!selectedTable || !tables[selectedTable]) return [];

    const table = tables[selectedTable];
    return table.columns.map((col) => ({
      column: col,
      dataType: inferColumnType(table.rows, col),
    }));
  }, [selectedTable, tables]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as DragItem;
    setActiveField(data);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveField(null);

      if (!over || !active.data.current) return;

      const field = active.data.current as DragItem;
      const zone = over.id as DropZoneType;

      switch (zone) {
        case "xAxis":
          setXAxisField({
            column: field.column,
            dataType: field.dataType,
          });
          break;

        case "yAxis":
          setYAxisFields((prev) => [
            ...prev,
            {
              column: field.column,
              aggregation: suggestAggregation(field.dataType),
            },
          ]);
          break;

        case "legend":
          setLegendField({
            column: field.column,
            dataType: field.dataType,
          });
          break;

        case "values":
          setYAxisFields((prev) => [
            ...prev,
            {
              column: field.column,
              aggregation: suggestAggregation(field.dataType),
            },
          ]);
          break;
      }
    },
    []
  );

  const handleRemoveXAxis = useCallback(() => {
    setXAxisField(null);
  }, []);

  const handleRemoveYAxis = useCallback((index: number) => {
    setYAxisFields((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleRemoveLegend = useCallback(() => {
    setLegendField(null);
  }, []);

  const handleYAxisAggregationChange = useCallback(
    (index: number, aggregation: AggregationType) => {
      setYAxisFields((prev) =>
        prev.map((f, i) => (i === index ? { ...f, aggregation } : f))
      );
    },
    []
  );

  const handleSave = useCallback(() => {
    if (!chartName || !selectedTable) return;

    const chart: ChartConfig = {
      id: editingChart?.id || generateId(),
      name: chartName,
      type: chartType,
      tableId: selectedTable,
      fields: {
        xAxis: xAxisField,
        yAxis: yAxisFields,
        legend: legendField,
        values: [],
        tooltipFields: [],
      },
      colours: [...CHART_COLOURS],
      options: { ...DEFAULT_CHART_OPTIONS },
      createdAt: editingChart?.createdAt || new Date(),
      updatedAt: new Date(),
    };

    if (editingChart) {
      updateChart(chart);
    } else {
      addChart(chart);
    }
  }, [
    chartName,
    selectedTable,
    chartType,
    xAxisField,
    yAxisFields,
    legendField,
    editingChart,
    addChart,
    updateChart,
  ]);

  const isValid = chartName && selectedTable && (yAxisFields.length > 0 || chartType === "table");

  return (
    <Dialog.Root open={isBuilderOpen} onOpenChange={(open) => !open && closeBuilder()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] max-w-[95vw] max-h-[85vh] bg-surface-container rounded-2xl shadow-elevation-3 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/30">
            <Dialog.Title className="text-lg font-semibold text-on-surface">
              {editingChart ? "Edit Chart" : "Create Chart"}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="p-2 rounded-lg hover:bg-surface-container-high transition-colors">
                <X className="w-5 h-5 text-on-surface-variant" />
              </button>
            </Dialog.Close>
          </div>

          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="flex h-[calc(85vh-140px)]">
              {/* Left panel - Fields */}
              <div className="w-56 border-r border-outline-variant/30 p-4 overflow-y-auto">
                <h3 className="text-xs font-medium text-on-surface-variant uppercase tracking-wider mb-3">
                  Data Source
                </h3>

                {/* Table selector */}
                <select
                  value={selectedTable}
                  onChange={(e) => {
                    setSelectedTable(e.target.value);
                    setXAxisField(null);
                    setYAxisFields([]);
                    setLegendField(null);
                  }}
                  className="w-full px-3 py-2 bg-surface-container-high border border-outline-variant/30 rounded-lg text-sm text-on-surface focus:outline-none focus:border-amber-500 mb-4"
                >
                  <option value="">Select a table</option>
                  {Object.keys(tables).map((tableName) => (
                    <option key={tableName} value={tableName}>
                      {tableName}
                    </option>
                  ))}
                </select>

                {/* Available fields */}
                {selectedTable && (
                  <>
                    <h3 className="text-xs font-medium text-on-surface-variant uppercase tracking-wider mb-3">
                      Fields
                    </h3>
                    <div className="space-y-2">
                      {tableColumns.map((col) => (
                        <FieldPill
                          key={col.column}
                          id={`source-${col.column}`}
                          column={col.column}
                          dataType={col.dataType}
                          sourceTable={selectedTable}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Centre panel - Configuration */}
              <div className="flex-1 p-6 overflow-y-auto">
                {/* Chart name */}
                <div className="mb-6">
                  <label className="block text-xs font-medium text-on-surface-variant uppercase tracking-wider mb-2">
                    Chart Name
                  </label>
                  <input
                    type="text"
                    value={chartName}
                    onChange={(e) => setChartName(e.target.value)}
                    placeholder="Enter chart name"
                    className="w-full px-3 py-2 bg-surface-container-high border border-outline-variant/30 rounded-lg text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Chart type */}
                <div className="mb-6">
                  <label className="block text-xs font-medium text-on-surface-variant uppercase tracking-wider mb-2">
                    Chart Type
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {(Object.keys(CHART_TYPE_INFO) as ChartType[]).map((type) => {
                      const Icon = chartTypeIcons[type];
                      const isSelected = chartType === type;
                      return (
                        <button
                          key={type}
                          onClick={() => setChartType(type)}
                          className={`
                            flex flex-col items-center gap-1 p-3 rounded-lg border transition-all
                            ${isSelected
                              ? "border-amber-500 bg-amber-500/10 text-amber-400"
                              : "border-outline-variant/30 hover:border-outline-variant text-on-surface-variant hover:text-on-surface"
                            }
                          `}
                        >
                          <Icon className="w-5 h-5" />
                          <span className="text-[10px] font-medium">
                            {CHART_TYPE_INFO[type].label.split(" ")[0]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Drop zones */}
                <div className="space-y-4">
                  {chartType !== "kpi" && chartType !== "gauge" && (
                    <DropZone
                      id="xAxis"
                      label="X-Axis (Category)"
                      description="Drag a field for categories"
                      fields={xAxisField ? [xAxisField] : []}
                      onRemoveField={handleRemoveXAxis}
                    />
                  )}

                  <DropZone
                    id="yAxis"
                    label={chartType === "kpi" || chartType === "gauge" ? "Value" : "Y-Axis (Values)"}
                    description={chartType === "kpi" || chartType === "gauge" ? "Drag a numeric field" : "Drag numeric fields"}
                    fields={yAxisFields}
                    acceptsMultiple={chartType !== "kpi" && chartType !== "gauge"}
                    acceptsAggregation
                    onRemoveField={handleRemoveYAxis}
                    onAggregationChange={handleYAxisAggregationChange}
                  />

                  {(chartType === "bar" || chartType === "line" || chartType === "area") && (
                    <DropZone
                      id="legend"
                      label="Legend (Group By)"
                      description="Optional: group data by this field"
                      fields={legendField ? [legendField] : []}
                      onRemoveField={handleRemoveLegend}
                    />
                  )}
                </div>
              </div>

              {/* Right panel - Preview */}
              <div className="w-64 border-l border-outline-variant/30 p-4 bg-surface-container-high/50">
                <h3 className="text-xs font-medium text-on-surface-variant uppercase tracking-wider mb-3">
                  Preview
                </h3>
                <div className="aspect-square bg-surface-container rounded-lg border border-outline-variant/30 flex items-center justify-center">
                  {!selectedTable ? (
                    <span className="text-xs text-on-surface-variant/50">
                      Select a table
                    </span>
                  ) : yAxisFields.length === 0 && chartType !== "table" ? (
                    <span className="text-xs text-on-surface-variant/50 text-center px-4">
                      Drag fields to configure chart
                    </span>
                  ) : (
                    <div className="text-center">
                      {(() => {
                        const Icon = chartTypeIcons[chartType];
                        return <Icon className="w-12 h-12 text-amber-500/50 mx-auto mb-2" />;
                      })()}
                      <span className="text-xs text-on-surface-variant">
                        {CHART_TYPE_INFO[chartType].label}
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-4 space-y-2 text-xs text-on-surface-variant">
                  <div className="flex justify-between">
                    <span>Table:</span>
                    <span className="text-on-surface">{selectedTable || "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>X-Axis:</span>
                    <span className="text-on-surface">{xAxisField?.column || "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Y-Axis:</span>
                    <span className="text-on-surface">
                      {yAxisFields.length > 0
                        ? yAxisFields.map((f) => f.column).join(", ")
                        : "-"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Drag overlay */}
            <DragOverlay>
              {activeField ? (
                <FieldPillOverlay
                  column={activeField.column}
                  dataType={activeField.dataType}
                />
              ) : null}
            </DragOverlay>
          </DndContext>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-outline-variant/30">
            <button
              onClick={closeBuilder}
              className="px-4 py-2 text-sm font-medium text-on-surface-variant hover:text-on-surface transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!isValid}
              className="px-4 py-2 bg-amber-500 text-black rounded-lg text-sm font-medium hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {editingChart ? "Update Chart" : "Create Chart"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
