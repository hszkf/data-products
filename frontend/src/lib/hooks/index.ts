/**
 * Custom hooks that replace useEffect patterns.
 * 
 * Instead of useEffect, use:
 * - useInterval: for interval-based updates
 * - useEventListener: for DOM event listeners
 * - useLocalStorage: for localStorage sync
 * - useMounted: for lifecycle checks
 * - useDebounce: for debounced values
 * - TanStack Query hooks: for data fetching
 */

// Interval hooks
export { useInterval, useControlledInterval } from "./use-interval";

// Event listener hooks
export {
  useEventListener,
  useKeyboardShortcut,
  useClickOutside,
  useScrollPosition,
  useWindowSize,
} from "./use-event-listener";

// LocalStorage hooks
export {
  useLocalStorage,
  useLocalStorageFlag,
  useThemePreference,
} from "./use-local-storage";

// Lifecycle hooks
export {
  useMounted,
  useMountedCallback,
  useDebounce,
  useThrottle,
  usePrevious,
} from "./use-mounted";

// TanStack Query hooks for Jobs
export {
  useJobsQuery,
  useJobQuery,
  useJobExecutionsQuery,
  useExecutionStatusQuery,
  useJobStatsQuery,
  useSchedulerStatusQuery,
  useCronPresetsQuery,
  useJobRegistryQuery,
  useSchedulePreviewQuery,
  useCreateJobMutation,
  useUpdateJobMutation,
  useDeleteJobMutation,
  useRunJobMutation,
  useCancelJobMutation,
  useToggleJobMutation,
  useScheduleJobMutation,
  useSyncSchedulesMutation,
  useJobsWithPolling,
} from "./use-jobs-query";
