import { useState, useRef, useMemo } from "react";
import {
  X,
  Save,
  Loader2,
  FileText,
  Calendar,
  Settings,
  Code,
} from "lucide-react";
import { CustomSelect } from "~/components/ui/custom-select";
import { useToast } from "~/components/ui/toast-provider";
import { useSchedulePreviewQuery } from "~/lib/hooks";
import {
  Job,
  updateJob,
  OutputFormat,
} from "~/lib/jobs-api";

interface EditJobModalProps {
  job: Job;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

const authorOptions = [
  { value: "hasif", label: "Hasif" },
  { value: "nazierul", label: "Nazierul" },
  { value: "izhar", label: "Izhar" },
  { value: "asyraff", label: "Asyraff" },
  { value: "bob", label: "Bob" },
  { value: "ernie", label: "Ernie" },
  { value: "yee_ming", label: "Yee Ming" },
];

const cronPresets = [
  { value: "* * * * *", label: "Every minute" },
  { value: "*/5 * * * *", label: "Every 5 minutes" },
  { value: "*/15 * * * *", label: "Every 15 minutes" },
  { value: "*/30 * * * *", label: "Every 30 minutes" },
  { value: "0 * * * *", label: "Every hour" },
  { value: "0 0 * * *", label: "Daily at midnight" },
  { value: "0 9 * * *", label: "Daily at 9 AM" },
  { value: "0 9 * * 1", label: "Weekly on Monday" },
  { value: "0 9 * * 1-5", label: "Weekdays at 9 AM" },
  { value: "0 0 1 * *", label: "Monthly" },
];

export function EditJobModal({ job, isOpen, onClose, onSave }: EditJobModalProps) {
  const { showToast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [jobName, setJobName] = useState("");
  const [description, setDescription] = useState("");
  const [author, setAuthor] = useState("");
  const [cronExpression, setCronExpression] = useState("");
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("csv");
  const [maxRetries, setMaxRetries] = useState(3);
  const [retryDelay, setRetryDelay] = useState(60);
  
  // Workflow steps - we'll allow editing the first step's query
  const [stepQuery, setStepQuery] = useState("");
  const [stepName, setStepName] = useState("");
  const [stepType, setStepType] = useState<string>("redshift_query");

  // Track if form has been initialized to prevent re-initialization on job prop changes
  const hasInitializedRef = useRef(false);
  const previousIsOpenRef = useRef(false);

  // Initialize form data using ref pattern instead of useEffect
  // Detect when modal transitions from closed to open
  const justOpened = isOpen && !previousIsOpenRef.current;
  previousIsOpenRef.current = isOpen;
  
  // Reset initialization flag when modal closes
  if (!isOpen) {
    hasInitializedRef.current = false;
  }
  
  // Only initialize form data when modal just opened and hasn't been initialized yet
  if (justOpened && !hasInitializedRef.current && job) {
    hasInitializedRef.current = true;
    
    // Use queueMicrotask to batch state updates
    queueMicrotask(() => {
      setJobName(job.job_name || "");
      setDescription(job.description || "");
      setAuthor(job.author || "");
      setOutputFormat((job.output_format as OutputFormat) || "csv");
      setMaxRetries(job.max_retries || 3);
      setRetryDelay(job.retry_delay_seconds || 60);

      // Extract cron expression
      if (job.schedule_config && 'cron_expression' in job.schedule_config) {
        setCronExpression(job.schedule_config.cron_expression || "");
      } else {
        setCronExpression("");
      }

      // Load first step data
      const steps = job.workflow_definition?.steps || [];
      if (steps.length > 0) {
        const step = steps[0] as any;
        setStepName(step.name || step.step_name || "");
        setStepQuery(step.query || "");
        setStepType(step.type || step.step_type || "redshift_query");
      }

      setError(null);
    });
  }

  // Use TanStack Query for schedule preview instead of useEffect
  const schedulePreviewQuery = useSchedulePreviewQuery(
    cronExpression ? "cron" : null,
    cronExpression ? { cron_expression: cronExpression } : null,
    { enabled: !!cronExpression && isOpen }
  );
  
  const schedulePreview = useMemo(() => {
    return schedulePreviewQuery.data?.next_runs?.slice(0, 3) || [];
  }, [schedulePreviewQuery.data]);

  const handleSave = async () => {
    if (!jobName.trim()) {
      setError("Job name is required");
      return;
    }

    if (!author) {
      setError("Author is required");
      return;
    }

    if (!stepQuery.trim()) {
      setError("SQL query is required");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // Build workflow with updated step
      const existingSteps = job.workflow_definition?.steps || [];
      const updatedSteps = existingSteps.length > 0
        ? existingSteps.map((step: any, index: number) => {
            if (index === 0) {
              return {
                ...step,
                name: stepName || step.name || step.step_name,
                type: stepType,
                query: stepQuery,
              };
            }
            return step;
          })
        : [{
            id: "step_1",
            name: stepName || "Query Step",
            type: stepType,
            query: stepQuery,
          }];

      await updateJob(job.id, {
        job_name: jobName,
        description: description || undefined,
        author,
        output_format: outputFormat,
        max_retries: maxRetries,
        retry_delay_seconds: retryDelay,
        schedule_config: cronExpression
          ? {
              schedule_type: "cron",
              cron_expression: cronExpression,
              timezone: "UTC",
            }
          : undefined,
        workflow_definition: {
          steps: updatedSteps,
          error_handling: job.workflow_definition?.error_handling || "stop",
        },
      } as any);

      showToast("Job updated successfully", "success");
      onSave();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save job");
    } finally {
      setIsSaving(false);
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
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden bg-surface-container border border-outline-variant/50 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-on-surface">Edit Job</h2>
              <p className="text-xs text-on-surface-variant font-mono">{job.id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-140px)] p-6 space-y-6">
          {/* Error message */}
          {error && (
            <div className="px-4 py-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-sm text-rose-400">
              {error}
            </div>
          )}

          {/* Basic Information */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-semibold text-on-surface">Basic Information</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1.5">
                  Job Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={jobName}
                  onChange={(e) => setJobName(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-container-high border border-outline-variant/50 rounded-lg text-on-surface font-mono text-sm focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1.5">
                  Author <span className="text-rose-400">*</span>
                </label>
                <CustomSelect
                  value={author}
                  onChange={setAuthor}
                  options={authorOptions}
                  placeholder="Select author..."
                  accentColor="cyan"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-on-surface-variant mb-1.5">
                  Description
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description..."
                  className="w-full px-3 py-2 bg-surface-container-high border border-outline-variant/50 rounded-lg text-on-surface text-sm focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20"
                />
              </div>
            </div>
          </section>

          {/* SQL Query */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Code className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-semibold text-on-surface">SQL Query</h3>
              <span className={`ml-2 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                stepType === 'redshift_query' ? 'bg-orange-500/20 text-orange-400' :
                stepType === 'sqlserver_query' ? 'bg-blue-500/20 text-blue-400' :
                'bg-violet-500/20 text-violet-400'
              }`}>
                {stepType === 'redshift_query' ? 'Redshift' :
                 stepType === 'sqlserver_query' ? 'SQL Server' : 'Merge'}
              </span>
            </div>
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-on-surface-variant mb-1.5">
                    Step Name
                  </label>
                  <input
                    type="text"
                    value={stepName}
                    onChange={(e) => setStepName(e.target.value)}
                    placeholder="Query step name"
                    className="w-full px-3 py-2 bg-surface-container-high border border-outline-variant/50 rounded-lg text-on-surface text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20"
                  />
                </div>
                <div className="w-40">
                  <label className="block text-xs font-medium text-on-surface-variant mb-1.5">
                    Database
                  </label>
                  <CustomSelect
                    value={stepType}
                    onChange={setStepType}
                    options={[
                      { value: "redshift_query", label: "Redshift" },
                      { value: "sqlserver_query", label: "SQL Server" },
                    ]}
                    accentColor="emerald"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1.5">
                  Query <span className="text-rose-400">*</span>
                </label>
                <textarea
                  value={stepQuery}
                  onChange={(e) => setStepQuery(e.target.value)}
                  rows={6}
                  placeholder="SELECT * FROM table_name"
                  className="w-full px-3 py-2 bg-[#1a1a2e] border border-outline-variant/50 rounded-lg text-emerald-400 font-mono text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 resize-none"
                />
              </div>
            </div>
          </section>

          {/* Schedule */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-on-surface">Schedule</h3>
              <span className="text-[10px] text-on-surface-variant/60 font-mono">(optional)</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1.5">
                  Cron Expression
                </label>
                <input
                  type="text"
                  value={cronExpression}
                  onChange={(e) => setCronExpression(e.target.value)}
                  placeholder="*/5 * * * *"
                  className="w-full px-3 py-2 bg-surface-container-high border border-outline-variant/50 rounded-lg text-on-surface font-mono text-sm focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1.5">
                  Quick Preset
                </label>
                <CustomSelect
                  value=""
                  onChange={(val) => val && setCronExpression(val)}
                  options={cronPresets}
                  placeholder="Select preset..."
                  accentColor="amber"
                />
              </div>
            </div>
            {schedulePreview.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="text-xs text-on-surface-variant">Next runs:</span>
                {schedulePreview.map((time, i) => (
                  <span key={i} className="px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded text-xs font-mono text-amber-400">
                    {new Date(time).toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                ))}
              </div>
            )}
          </section>

          {/* Settings */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Settings className="w-4 h-4 text-violet-400" />
              <h3 className="text-sm font-semibold text-on-surface">Settings</h3>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1.5">
                  Output Format
                </label>
                <CustomSelect
                  value={outputFormat}
                  onChange={(val) => setOutputFormat(val as OutputFormat)}
                  options={[
                    { value: "csv", label: "CSV" },
                    { value: "excel", label: "Excel" },
                    { value: "json", label: "JSON" },
                  ]}
                  accentColor="violet"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1.5">
                  Max Retries
                </label>
                <input
                  type="number"
                  value={maxRetries}
                  onChange={(e) => setMaxRetries(parseInt(e.target.value) || 0)}
                  min={0}
                  max={10}
                  className="w-full px-3 py-2 bg-surface-container-high border border-outline-variant/50 rounded-lg text-on-surface font-mono text-sm focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1.5">
                  Retry Delay (s)
                </label>
                <input
                  type="number"
                  value={retryDelay}
                  onChange={(e) => setRetryDelay(parseInt(e.target.value) || 60)}
                  min={0}
                  max={3600}
                  className="w-full px-3 py-2 bg-surface-container-high border border-outline-variant/50 rounded-lg text-on-surface font-mono text-sm focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20"
                />
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-outline-variant/50 bg-surface-container-high/50">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 rounded-lg text-sm font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg font-semibold text-sm hover:from-amber-400 hover:to-orange-400 shadow-lg shadow-amber-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
