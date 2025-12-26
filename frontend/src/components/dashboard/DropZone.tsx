

import { useDroppable } from "@dnd-kit/core";
import { Plus } from "lucide-react";
import type { FieldConfig, AggregatedField, AggregationType, DropZoneType } from "~/lib/dashboard/types";
import { FieldPill } from "./FieldPill";

interface DropZoneProps {
  id: DropZoneType;
  label: string;
  description?: string;
  fields: (FieldConfig | AggregatedField)[];
  acceptsMultiple?: boolean;
  acceptsAggregation?: boolean;
  onRemoveField: (index: number) => void;
  onAggregationChange?: (index: number, agg: AggregationType) => void;
  className?: string;
}

export function DropZone({
  id,
  label,
  description,
  fields,
  acceptsMultiple = false,
  acceptsAggregation = false,
  onRemoveField,
  onAggregationChange,
  className = "",
}: DropZoneProps) {
  const { isOver, setNodeRef } = useDroppable({
    id,
  });

  const isEmpty = fields.length === 0;
  const canAcceptMore = isEmpty || acceptsMultiple;

  return (
    <div className={`${className}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">
          {label}
        </span>
        {description && (
          <span className="text-[10px] text-on-surface-variant/60">
            {description}
          </span>
        )}
      </div>

      <div
        ref={setNodeRef}
        className={`
          min-h-[48px] p-2 rounded-lg border-2 border-dashed transition-all
          ${isOver && canAcceptMore
            ? "border-amber-500 bg-amber-500/10"
            : "border-outline-variant/30 bg-surface-container/50"
          }
          ${isEmpty ? "flex items-center justify-center" : "flex flex-wrap gap-2"}
        `}
      >
        {isEmpty ? (
          <div className="flex items-center gap-2 text-on-surface-variant/50 text-xs">
            <Plus className="w-4 h-4" />
            <span>Drag a field here</span>
          </div>
        ) : (
          fields.map((field, index) => {
            const isAggregated = "aggregation" in field;
            return (
              <FieldPill
                key={`${field.column}-${index}`}
                id={`${id}-${field.column}-${index}`}
                column={field.column}
                dataType={isAggregated ? "number" : (field as FieldConfig).dataType}
                aggregation={isAggregated ? (field as AggregatedField).aggregation : undefined}
                isInDropZone
                onRemove={() => onRemoveField(index)}
                onAggregationChange={
                  acceptsAggregation && onAggregationChange
                    ? (agg) => onAggregationChange(index, agg)
                    : undefined
                }
              />
            );
          })
        )}
      </div>
    </div>
  );
}
