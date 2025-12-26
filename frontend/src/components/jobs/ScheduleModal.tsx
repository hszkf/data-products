

import { useState, useEffect } from "react";
import { X, Clock, Play, Calendar, AlertCircle, Loader2 } from "lucide-react";
import { ScheduleBuilder } from "./ScheduleBuilder";
import { useJobs } from "./JobsProvider";
import { Job, previewSchedule } from "~/lib/jobs-api";

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: Job;
}

export function ScheduleModal({ isOpen, onClose, job }: ScheduleModalProps) {
  const { enableSchedule, triggerJob } = useJobs();

  const [cronExpression, setCronExpression] = useState(job.cron_expression || "");
  const [naturalSchedule, setNaturalSchedule] = useState("");
  const [nextRuns, setNextRuns] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRunNowLoading, setIsRunNowLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when job changes
  useEffect(() => {
    if (isOpen) {
      setCronExpression(job.cron_expression || "");
      setNaturalSchedule("");
      setError(null);
    }
  }, [isOpen, job]);

  // Preview schedule when cron changes
  useEffect(() => {
    if (!cronExpression) {
      setNextRuns([]);
      return;
    }

    const fetchPreview = async () => {
      try {
        const result = await previewSchedule("cron", { cron_expression: cronExpression });
        setNextRuns(result.next_runs || []);
      } catch (e) {
        // Preview failed, ignore
        setNextRuns([]);
      }
    };

    const debounceTimeout = setTimeout(fetchPreview, 500);
    return () => clearTimeout(debounceTimeout);
  }, [cronExpression]);

  const handleSchedule = async () => {
    if (!cronExpression) {
      setError("Please configure a schedule");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const success = await enableSchedule(job.id, cronExpression);
      if (success) {
        onClose();
      } else {
        setError("Failed to schedule job");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to schedule job");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunNow = async () => {
    setIsRunNowLoading(true);
    setError(null);

    try {
      const success = await triggerJob(job.id);
      if (success) {
        onClose();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to run job");
    } finally {
      setIsRunNowLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-surface border border-outline-variant/30 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-surface border-b border-outline-variant/30">
          <div>
            <h2 className="text-lg font-semibold text-on-surface">
              Schedule Job
            </h2>
            <p className="text-sm text-on-surface-variant mt-0.5">
              {job.job_name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Error message */}
          {error && (
            <div className="flex items-center gap-3 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Run Now section */}
          <div className="p-5 bg-surface-container-high/50 border border-outline-variant/30 rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-on-surface flex items-center gap-2">
                  <Play className="w-4 h-4 text-green-400" />
                  Run Now
                </h3>
                <p className="text-sm text-on-surface-variant mt-1">
                  Execute this job immediately without scheduling
                </p>
              </div>
              <button
                onClick={handleRunNow}
                disabled={isRunNowLoading}
                className="
                  flex items-center gap-2 px-4 py-2.5
                  bg-green-600 hover:bg-green-500
                  text-white text-sm font-medium
                  rounded-xl
                  transition-all duration-200
                  disabled:opacity-50 disabled:cursor-not-allowed
                "
              >
                {isRunNowLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Run Now
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-outline-variant/30" />
            <span className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">
              Or Schedule
            </span>
            <div className="flex-1 h-px bg-outline-variant/30" />
          </div>

          {/* Schedule Builder */}
          <div>
            <h3 className="text-sm font-semibold text-on-surface flex items-center gap-2 mb-4">
              <Calendar className="w-4 h-4 text-amber-400" />
              Configure Schedule
            </h3>
            <ScheduleBuilder
              cronExpression={cronExpression}
              naturalSchedule={naturalSchedule}
              onCronChange={setCronExpression}
              onNaturalScheduleChange={setNaturalSchedule}
            />
          </div>

          {/* Preview from API */}
          {nextRuns.length > 0 && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-medium text-amber-400">
                  Server-calculated Next Runs
                </span>
              </div>
              <div className="space-y-1.5">
                {nextRuns.slice(0, 5).map((run, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 text-sm text-on-surface-variant"
                  >
                    <span className="w-5 h-5 rounded bg-surface-container flex items-center justify-center text-xs font-mono">
                      {index + 1}
                    </span>
                    <span className="font-mono">
                      {new Date(run).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-end gap-3 px-6 py-4 bg-surface border-t border-outline-variant/30">
          <button
            onClick={onClose}
            className="
              px-4 py-2.5
              text-on-surface-variant text-sm font-medium
              hover:text-on-surface hover:bg-surface-container-high
              rounded-xl
              transition-all duration-200
            "
          >
            Cancel
          </button>
          <button
            onClick={handleSchedule}
            disabled={isLoading || !cronExpression}
            className="
              flex items-center gap-2 px-5 py-2.5
              bg-amber-600 hover:bg-amber-500
              text-white text-sm font-medium
              rounded-xl
              transition-all duration-200
              disabled:opacity-50 disabled:cursor-not-allowed
            "
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Scheduling...
              </>
            ) : (
              <>
                <Calendar className="w-4 h-4" />
                Save Schedule
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
