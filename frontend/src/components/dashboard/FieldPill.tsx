

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Hash, Type, Calendar, ToggleLeft, X } from "lucide-react";
import type { DataType, AggregationType } from "~/lib/dashboard/types";

interface FieldPillProps {
  id: string;
  column: string;
  dataType: DataType;
  sourceTable?: string;
  aggregation?: AggregationType;
  onRemove?: () => void;
  onAggregationChange?: (agg: AggregationType) => void;
  isDragging?: boolean;
  isInDropZone?: boolean;
  className?: string;
}

const dataTypeIcons: Record<DataType, typeof Hash> = {
  number: Hash,
  string: Type,
  date: Calendar,
  boolean: ToggleLeft,
};

const dataTypeColors: Record<DataType, string> = {
  number: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  string: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  date: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  boolean: "bg-amber-500/20 text-amber-400 border-amber-500/30",
};

export function FieldPill({
  id,
  column,
  dataType,
  sourceTable,
  aggregation,
  onRemove,
  onAggregationChange,
  isDragging = false,
  isInDropZone = false,
  className = "",
}: FieldPillProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id,
    data: {
      type: "field",
      column,
      dataType,
      sourceTable,
    },
  });

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
      }
    : undefined;

  const Icon = dataTypeIcons[dataType];
  const colorClass = dataTypeColors[dataType];

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`
        inline-flex items-center gap-1.5 px-2 py-1 rounded-md border cursor-grab
        ${colorClass}
        ${isDragging ? "opacity-50 shadow-lg" : ""}
        ${isInDropZone ? "pr-1" : ""}
        ${className}
      `}
    >
      <Icon className="w-3 h-3" />
      <span className="text-xs font-medium truncate max-w-[120px]">
        {aggregation && aggregation !== "NONE" ? `${aggregation}(${column})` : column}
      </span>

      {/* Aggregation selector for numeric fields in drop zone */}
      {isInDropZone && dataType === "number" && onAggregationChange && (
        <select
          value={aggregation || "SUM"}
          onChange={(e) => onAggregationChange(e.target.value as AggregationType)}
          onClick={(e) => e.stopPropagation()}
          className="ml-1 px-1 py-0.5 text-[10px] bg-transparent border border-current/30 rounded cursor-pointer focus:outline-none"
        >
          <option value="SUM">SUM</option>
          <option value="COUNT">COUNT</option>
          <option value="AVG">AVG</option>
          <option value="MIN">MIN</option>
          <option value="MAX">MAX</option>
        </select>
      )}

      {/* Remove button */}
      {isInDropZone && onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="p-0.5 rounded hover:bg-white/20 transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

// Static version for drag overlay
export function FieldPillOverlay({
  column,
  dataType,
}: {
  column: string;
  dataType: DataType;
}) {
  const Icon = dataTypeIcons[dataType];
  const colorClass = dataTypeColors[dataType];

  return (
    <div
      className={`
        inline-flex items-center gap-1.5 px-2 py-1 rounded-md border shadow-lg
        ${colorClass}
      `}
    >
      <Icon className="w-3 h-3" />
      <span className="text-xs font-medium">{column}</span>
    </div>
  );
}
