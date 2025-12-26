

import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import type {
  DashboardConfig,
  DashboardState,
  DashboardAction,
  ChartConfig,
  WidgetLayout,
} from "~/lib/dashboard/types";
import {
  loadCurrentDashboard,
  saveDashboard,
  generateId,
  calculateNewWidgetLayout,
  duplicateChart,
} from "~/lib/dashboard/storage";
import { DEFAULT_CHART_OPTIONS, DEFAULT_FIELD_MAPPING, CHART_COLOURS } from "~/lib/dashboard/types";

// ============================================
// Reducer
// ============================================

function dashboardReducer(state: DashboardState, action: DashboardAction): DashboardState {
  switch (action.type) {
    case "LOAD_DASHBOARD":
      return {
        ...state,
        dashboard: action.payload,
      };

    case "SET_DASHBOARD_NAME":
      return {
        ...state,
        dashboard: {
          ...state.dashboard,
          name: action.payload,
          updatedAt: new Date(),
        },
      };

    case "ADD_CHART": {
      const newLayout = calculateNewWidgetLayout(
        state.dashboard.layout,
        action.payload.type
      );
      newLayout.i = action.payload.id;

      return {
        ...state,
        dashboard: {
          ...state.dashboard,
          charts: [...state.dashboard.charts, action.payload],
          layout: [...state.dashboard.layout, newLayout],
          updatedAt: new Date(),
        },
        isBuilderOpen: false,
        editingChart: null,
      };
    }

    case "UPDATE_CHART":
      return {
        ...state,
        dashboard: {
          ...state.dashboard,
          charts: state.dashboard.charts.map((c) =>
            c.id === action.payload.id ? action.payload : c
          ),
          updatedAt: new Date(),
        },
        isBuilderOpen: false,
        editingChart: null,
      };

    case "DELETE_CHART":
      return {
        ...state,
        dashboard: {
          ...state.dashboard,
          charts: state.dashboard.charts.filter((c) => c.id !== action.payload),
          layout: state.dashboard.layout.filter((l) => l.i !== action.payload),
          updatedAt: new Date(),
        },
        selectedChartId: state.selectedChartId === action.payload ? null : state.selectedChartId,
      };

    case "DUPLICATE_CHART": {
      const original = state.dashboard.charts.find((c) => c.id === action.payload);
      if (!original) return state;

      const copied = duplicateChart(original);
      const newLayout = calculateNewWidgetLayout(state.dashboard.layout, copied.type);
      newLayout.i = copied.id;

      return {
        ...state,
        dashboard: {
          ...state.dashboard,
          charts: [...state.dashboard.charts, copied],
          layout: [...state.dashboard.layout, newLayout],
          updatedAt: new Date(),
        },
      };
    }

    case "UPDATE_LAYOUT":
      return {
        ...state,
        dashboard: {
          ...state.dashboard,
          layout: action.payload,
          updatedAt: new Date(),
        },
      };

    case "SELECT_CHART":
      return {
        ...state,
        selectedChartId: action.payload,
      };

    case "OPEN_BUILDER":
      return {
        ...state,
        isBuilderOpen: true,
        editingChart: action.payload || null,
      };

    case "CLOSE_BUILDER":
      return {
        ...state,
        isBuilderOpen: false,
        editingChart: null,
      };

    case "RESET_LAYOUT": {
      // Recalculate layout for all charts
      let y = 0;
      const newLayout = state.dashboard.charts.map((chart) => {
        const layout = calculateNewWidgetLayout([], chart.type);
        layout.i = chart.id;
        layout.y = y;
        y += layout.h;
        return layout;
      });

      return {
        ...state,
        dashboard: {
          ...state.dashboard,
          layout: newLayout,
          updatedAt: new Date(),
        },
      };
    }

    default:
      return state;
  }
}

// ============================================
// Context
// ============================================

interface DashboardContextValue {
  state: DashboardState;
  // Chart operations
  addChart: (chart: ChartConfig) => void;
  updateChart: (chart: ChartConfig) => void;
  deleteChart: (chartId: string) => void;
  duplicateChart: (chartId: string) => void;
  selectChart: (chartId: string | null) => void;
  // Layout operations
  updateLayout: (layout: WidgetLayout[]) => void;
  resetLayout: () => void;
  // Builder operations
  openBuilder: (chart?: ChartConfig) => void;
  closeBuilder: () => void;
  // Dashboard operations
  setDashboardName: (name: string) => void;
  // Helpers
  createNewChart: (type: ChartConfig["type"], tableId: string, name: string) => ChartConfig;
  getChartById: (chartId: string) => ChartConfig | undefined;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error("useDashboard must be used within a DashboardProvider");
  }
  return context;
}

// ============================================
// Provider
// ============================================

interface DashboardProviderProps {
  children: ReactNode;
}

export function DashboardProvider({ children }: DashboardProviderProps) {
  const [state, dispatch] = useReducer(dashboardReducer, {
    dashboard: {
      id: "",
      name: "My Dashboard",
      charts: [],
      layout: [],
      gridCols: 12,
      rowHeight: 50,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    selectedChartId: null,
    isBuilderOpen: false,
    editingChart: null,
  });

  // Load dashboard from storage on mount
  useEffect(() => {
    const saved = loadCurrentDashboard();
    dispatch({ type: "LOAD_DASHBOARD", payload: saved });
  }, []);

  // Save dashboard to storage on changes
  useEffect(() => {
    if (state.dashboard.id) {
      saveDashboard(state.dashboard);
    }
  }, [state.dashboard]);

  // Chart operations
  const addChart = useCallback((chart: ChartConfig) => {
    dispatch({ type: "ADD_CHART", payload: chart });
  }, []);

  const updateChart = useCallback((chart: ChartConfig) => {
    dispatch({ type: "UPDATE_CHART", payload: chart });
  }, []);

  const deleteChart = useCallback((chartId: string) => {
    dispatch({ type: "DELETE_CHART", payload: chartId });
  }, []);

  const duplicateChartAction = useCallback((chartId: string) => {
    dispatch({ type: "DUPLICATE_CHART", payload: chartId });
  }, []);

  const selectChart = useCallback((chartId: string | null) => {
    dispatch({ type: "SELECT_CHART", payload: chartId });
  }, []);

  // Layout operations
  const updateLayout = useCallback((layout: WidgetLayout[]) => {
    dispatch({ type: "UPDATE_LAYOUT", payload: layout });
  }, []);

  const resetLayout = useCallback(() => {
    dispatch({ type: "RESET_LAYOUT" });
  }, []);

  // Builder operations
  const openBuilder = useCallback((chart?: ChartConfig) => {
    dispatch({ type: "OPEN_BUILDER", payload: chart });
  }, []);

  const closeBuilder = useCallback(() => {
    dispatch({ type: "CLOSE_BUILDER" });
  }, []);

  // Dashboard operations
  const setDashboardName = useCallback((name: string) => {
    dispatch({ type: "SET_DASHBOARD_NAME", payload: name });
  }, []);

  // Helpers
  const createNewChart = useCallback(
    (type: ChartConfig["type"], tableId: string, name: string): ChartConfig => {
      return {
        id: generateId(),
        name,
        type,
        tableId,
        fields: { ...DEFAULT_FIELD_MAPPING },
        colours: [...CHART_COLOURS],
        options: { ...DEFAULT_CHART_OPTIONS },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    },
    []
  );

  const getChartById = useCallback(
    (chartId: string) => {
      return state.dashboard.charts.find((c) => c.id === chartId);
    },
    [state.dashboard.charts]
  );

  const value = useMemo(
    () => ({
      state,
      addChart,
      updateChart,
      deleteChart,
      duplicateChart: duplicateChartAction,
      selectChart,
      updateLayout,
      resetLayout,
      openBuilder,
      closeBuilder,
      setDashboardName,
      createNewChart,
      getChartById,
    }),
    [
      state,
      addChart,
      updateChart,
      deleteChart,
      duplicateChartAction,
      selectChart,
      updateLayout,
      resetLayout,
      openBuilder,
      closeBuilder,
      setDashboardName,
      createNewChart,
      getChartById,
    ]
  );

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}
