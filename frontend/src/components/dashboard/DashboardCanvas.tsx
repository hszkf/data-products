

import { useCallback, useRef, useEffect, useState } from "react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import ReactGridLayoutBase from "react-grid-layout";
import { Plus, RotateCcw } from "lucide-react";
import { useDashboard } from "./DashboardProvider";
import { DashboardWidget } from "./DashboardWidget";
import type { WidgetLayout } from "~/lib/dashboard/types";

// Import react-grid-layout styles
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

// Cast to any to avoid TypeScript issues with react-grid-layout types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ReactGridLayout = ReactGridLayoutBase as any;

// React-grid-layout layout item type
interface GridLayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  static?: boolean;
}

interface DashboardCanvasProps {
  className?: string;
}

export function DashboardCanvas({ className = "" }: DashboardCanvasProps) {
  const {
    state,
    updateLayout,
    openBuilder,
    deleteChart,
    duplicateChart,
    selectChart,
    resetLayout,
  } = useDashboard();

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1200);

  // Measure container width for responsive layout
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };

    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleLayoutChange = useCallback(
    (newLayout: any) => {
      const mappedLayout: WidgetLayout[] = (newLayout as GridLayoutItem[]).map((l) => ({
        i: l.i,
        x: l.x,
        y: l.y,
        w: l.w,
        h: l.h,
        minW: l.minW,
        minH: l.minH,
        maxW: l.maxW,
        maxH: l.maxH,
        static: l.static,
      }));
      updateLayout(mappedLayout);
    },
    [updateLayout]
  );

  const handleEditChart = useCallback(
    (chartId: string) => {
      const chart = state.dashboard.charts.find((c) => c.id === chartId);
      if (chart) {
        openBuilder(chart);
      }
    },
    [state.dashboard.charts, openBuilder]
  );

  const { charts, layout } = state.dashboard;

  // Convert layout to react-grid-layout format
  const gridLayout: GridLayoutItem[] = layout.map((l) => ({
    i: l.i,
    x: l.x,
    y: l.y,
    w: l.w,
    h: l.h,
    minW: l.minW || 2,
    minH: l.minH || 2,
    maxW: l.maxW,
    maxH: l.maxH,
    static: l.static,
  }));

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-2">
          <button
            onClick={() => openBuilder()}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-black rounded-lg hover:bg-amber-400 transition-colors font-medium text-sm"
          >
            <Plus className="w-4 h-4" />
            Add Chart
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={resetLayout}
            className="flex items-center gap-2 px-3 py-2 bg-surface-container-high rounded-lg hover:bg-surface-container-highest transition-colors text-sm text-on-surface-variant"
          >
            <RotateCcw className="w-4 h-4" />
            Reset Layout
          </button>
        </div>
      </div>

      {/* Grid */}
      {charts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 border-2 border-dashed border-outline-variant/30 rounded-xl">
          <div className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center mb-4">
            <Plus className="w-8 h-8 text-on-surface-variant" />
          </div>
          <h3 className="text-lg font-medium text-on-surface mb-2">
            No charts yet
          </h3>
          <p className="text-on-surface-variant text-sm mb-4">
            Add your first chart to start visualising your data
          </p>
          <button
            onClick={() => openBuilder()}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-black rounded-lg hover:bg-amber-400 transition-colors font-medium text-sm"
          >
            <Plus className="w-4 h-4" />
            Add Chart
          </button>
        </div>
      ) : (
        <ReactGridLayout
          className="dashboard-grid"
          layout={gridLayout}
          cols={12}
          rowHeight={50}
          width={containerWidth}
          margin={[16, 16]}
          containerPadding={[0, 0]}
          onLayoutChange={handleLayoutChange}
          draggableHandle=".widget-drag-handle"
          resizeHandles={["se", "sw", "ne", "nw", "e", "w", "s", "n"]}
          compactType="vertical"
          preventCollision={false}
          isResizable={true}
          isDraggable={true}
        >
          {charts.map((chart) => {
            const layoutItem = layout.find((l) => l.i === chart.id);
            const widgetWidth = layoutItem
              ? (containerWidth / 12) * layoutItem.w - 16
              : 400;
            const widgetHeight = layoutItem ? layoutItem.h * 50 - 16 : 300;

            return (
              <div key={chart.id} className="group">
                <DashboardWidget
                  chart={chart}
                  width={widgetWidth}
                  height={widgetHeight}
                  isSelected={state.selectedChartId === chart.id}
                  onEdit={() => handleEditChart(chart.id)}
                  onDuplicate={() => duplicateChart(chart.id)}
                  onDelete={() => deleteChart(chart.id)}
                />
              </div>
            );
          })}
        </ReactGridLayout>
      )}

      {/* Custom styles for grid */}
      <style jsx global>{`
        .react-grid-item {
          transition: none;
        }
        .react-grid-item.cssTransforms {
          transition: transform 200ms ease;
        }
        .react-grid-item.resizing {
          z-index: 1;
          will-change: width, height;
        }
        .react-grid-item.react-draggable-dragging {
          z-index: 3;
          will-change: transform;
          opacity: 0.9;
        }
        .react-grid-item.dropping {
          visibility: hidden;
        }
        .react-grid-item > .react-resizable-handle {
          position: absolute;
          width: 20px;
          height: 20px;
        }
        .react-grid-item > .react-resizable-handle::after {
          content: "";
          position: absolute;
          right: 3px;
          bottom: 3px;
          width: 8px;
          height: 8px;
          border-right: 2px solid rgba(255, 255, 255, 0.2);
          border-bottom: 2px solid rgba(255, 255, 255, 0.2);
        }
        .react-grid-item:hover > .react-resizable-handle::after {
          border-color: rgba(245, 158, 11, 0.5);
        }
        .react-grid-placeholder {
          background: rgba(245, 158, 11, 0.2) !important;
          border-radius: 12px;
          opacity: 1 !important;
        }
      `}</style>
    </div>
  );
}
