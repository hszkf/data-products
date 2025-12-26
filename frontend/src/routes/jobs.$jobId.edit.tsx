import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState, useEffect } from "react";
import { JobsProvider, useJobs } from "~/components/jobs/JobsProvider";
import { WorkflowBuilder } from "~/components/jobs/WorkflowBuilder";
import { ToastProvider, useToast } from "~/components/ui/toast-provider";
import { ThemeProvider } from "~/lib/theme-context";
import { TooltipProvider } from "~/components/ui/tooltip";
import { CustomSelect } from "~/components/ui/custom-select";
import {
  createDefaultWorkflow,
  previewSchedule,
  WorkflowDefinition,
  OutputFormat,
  CronPreset,
  getJob,
  updateJob,
} from "~/lib/jobs-api";
import {
  ArrowLeft,
  Save,
  Calendar,
  Clock,
  Settings,
  Edit3,
  Timer,
  RefreshCcw,
  Check,
  AlertCircle,
  Layers,
  FileText,
  Loader2,
  AlertTriangle,
} from "lucide-react";

export const Route = createFileRoute('/jobs/$jobId/edit')({
  component: JobEditPage,
});

function EditJobHeader({ jobName, jobId }: { jobName: string; jobId: string }) {
  const navigate = useNavigate();
  
  return (
    <header className="flex items-center justify-between px-6 py-3 bg-surface-container/80 backdrop-blur-sm border-b border-outline-variant/50 sticky top-0 z-20">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate({ to: '/jobs/$jobId', params: { jobId } })}
          className="p-2 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-all"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Edit3 className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-on-surface">
              Edit Job
            </h1>
            <p className="text-[11px] text-on-surface-variant font-mono truncate max-w-[200px]">
              {jobName || "Loading..."}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}

function EditJobPageContent() {
  const params = Route.useParams();
  const jobId = params.jobId;
  const navigate = useNavigate();
  const { showToast } = useToast();

  // Loading and error states
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [jobName, setJobName] = useState("");
  const [description, setDescription] = useState("");
  const [author, setAuthor] = useState("");
  const [workflow, setWorkflow] = useState<WorkflowDefinition>(createDefaultWorkflow());
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("csv");
  const [cronExpression, setCronExpression] = useState("");
  const [schedulePreview, setSchedulePreview] = useState<string[]>([]);
  const [maxRetries, setMaxRetries] = useState(3);
  const [retryDelay, setRetryDelay] = useState(60);

  const cronPresets: CronPreset[] = [
    { name: "every_minute", expression: "* * * * *", description: "Every minute" },
    { name: "every_5_min", expression: "*/5 * * * *", description: "Every 5 minutes" },
    { name: "every_15_min", expression: "*/15 * * * *", description: "Every 15 minutes" },
    { name: "every_30_min", expression: "*/30 * * * *", description: "Every 30 minutes" },
    { name: "hourly", expression: "0 * * * *", description: "Every hour" },
    { name: "daily_midnight", expression: "0 0 * * *", description: "Daily at midnight" },
    { name: "daily_9am", expression: "0 9 * * *", description: "Daily at 9 AM" },
    { name: "weekly_monday", expression: "0 9 * * 1", description: "Weekly on Monday" },
    { name: "weekdays_9am", expression: "0 9 * * 1-5", description: "Weekdays at 9 AM" },
    { name: "monthly", expression: "0 0 1 * *", description: "Monthly" },
  ];

  const authorOptions = [
    { value: "hasif", label: "Hasif" },
    { value: "nazierul", label: "Nazierul" },
    { value: "izhar", label: "Izhar" },
    { value: "asyraff", label: "Asyraff" },
    { value: "bob", label: "Bob" },
    { value: "ernie", label: "Ernie" },
    { value: "yee_ming", label: "Yee Ming" },
  ];

  // Load job data on mount
  useEffect(() => {
    async function loadJobData() {
      setIsLoading(true);
      setError(null);
      
      try {
        const result = await getJob(jobId);
        const job = result.job;
        
        if (!job) {
          setError("Job not found");
          return;
        }

        // Populate form with job data
        setJobName(job.job_name || "");
        setDescription(job.description || "");
        setAuthor(job.author || "");
        setOutputFormat((job.output_format as OutputFormat) || "csv");
        setMaxRetries(job.max_retries || 3);
        setRetryDelay(job.retry_delay_seconds || 60);

        // Extract cron expression from schedule_config
        if (job.schedule_config && 'cron_expression' in job.schedule_config) {
          setCronExpression(job.schedule_config.cron_expression || "");
        }

        // Load workflow definition
        if (job.workflow_definition) {
          const wf = job.workflow_definition;
          // Convert backend format to frontend format if needed
          const steps = (wf.steps || []).map((step: any, index: number) => ({
            id: step.id || `step_${index + 1}`,
            name: step.name || step.step_name || `Step ${index + 1}`,
            type: step.type || step.step_type || 'redshift_query',
            query: step.query || "",
            output_table: step.output_table || step.save_as || "",
            depends_on: step.depends_on || [],
            timeout_seconds: step.timeout_seconds || 300,
          }));
          
          setWorkflow({
            version: "1.0",
            steps,
            error_handling: {
              on_step_failure: typeof wf.error_handling === 'string' 
                ? wf.error_handling 
                : wf.error_handling?.on_step_failure || 'stop',
              notify_on_failure: true,
              notify_on_success: false,
            },
          });
        }
      } catch (err) {
        console.error("Failed to load job:", err);
        setError(err instanceof Error ? err.message : "Failed to load job");
      } finally {
        setIsLoading(false);
      }
    }

    loadJobData();
  }, [jobId]);

  // Preview schedule when cron expression changes
  useEffect(() => {
    if (cronExpression) {
      previewSchedule("cron", { cron_expression: cronExpression })
        .then((result) => setSchedulePreview(result.next_runs))
        .catch(() => setSchedulePreview([]));
    } else {
      setSchedulePreview([]);
    }
  }, [cronExpression]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!jobName.trim()) {
      showToast("Job name is required", "error");
      return;
    }

    if (!author) {
      showToast("Please select an author", "error");
      return;
    }

    if (workflow.steps.length === 0) {
      showToast("Add at least one step to the workflow", "error");
      return;
    }

    const emptySteps = workflow.steps.filter((s) => !s.query.trim());
    if (emptySteps.length > 0) {
      showToast(`Step "${emptySteps[0].name}" has no query`, "error");
      return;
    }

    setIsSaving(true);

    try {
      // Transform workflow steps to backend format
      const transformedWorkflow = {
        steps: workflow.steps.map((step, index) => ({
          id: step.id,
          name: step.name,
          type: step.type,
          query: step.query,
          output_table: step.output_table,
          depends_on: step.depends_on,
          timeout_seconds: step.timeout_seconds,
        })),
        error_handling: workflow.error_handling?.on_step_failure || 'stop',
      };

      await updateJob(jobId, {
        job_name: jobName,
        description: description || undefined,
        author: author,
        workflow_definition: transformedWorkflow,
        output_format: outputFormat,
        schedule_config: cronExpression ? {
          schedule_type: 'cron',
          cron_expression: cronExpression,
          timezone: 'UTC',
        } : undefined,
        max_retries: maxRetries,
        retry_delay_seconds: retryDelay,
      } as any);

      showToast("Job updated successfully", "success");
      navigate({ to: '/jobs/$jobId', params: { jobId } });
    } catch (err) {
      console.error("Failed to update job:", err);
      showToast(err instanceof Error ? err.message : "Failed to update job", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const stepCount = workflow.steps.length;
  const isValid = jobName.trim() && author && stepCount > 0;

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col h-screen bg-surface overflow-hidden">
        <EditJobHeader jobName="" jobId={jobId} />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
            <span className="text-sm text-on-surface-variant font-mono">Loading job...</span>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col h-screen bg-surface overflow-hidden">
        <EditJobHeader jobName="" jobId={jobId} />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-rose-400" />
            </div>
            <h2 className="text-lg font-semibold text-on-surface">Failed to load job</h2>
            <p className="text-sm text-on-surface-variant">{error}</p>
            <button
              onClick={() => window.location.href = '/jobs'}
              className="mt-2 px-4 py-2 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              ← Back to Jobs
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-surface overflow-hidden">
      <div
        className="fixed inset-0 pointer-events-none opacity-30"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 100% 80% at 50% -20%, rgba(251, 191, 36, 0.05), transparent 50%),
            radial-gradient(ellipse 60% 40% at 80% 20%, rgba(249, 115, 22, 0.03), transparent)
          `,
        }}
      />

      <EditJobHeader jobName={jobName} jobId={jobId} />

      <main className="flex-1 overflow-auto relative">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Basic Info + Settings Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Basic Information */}
              <div className="lg:col-span-2 bg-surface-container border border-outline-variant/50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="w-4 h-4 text-cyan-400" />
                  <h2 className="text-sm font-semibold text-on-surface">Basic Information</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-on-surface-variant mb-1.5">
                      Job Name <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={jobName}
                      onChange={(e) => setJobName(e.target.value)}
                      placeholder="daily_data_sync"
                      className="w-full h-[38px] px-3 py-2 bg-surface-container-high border border-outline-variant/50 rounded-lg text-on-surface placeholder-on-surface-variant/50 font-mono text-sm focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all"
                      required
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

                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-on-surface-variant mb-1.5">
                      Description
                    </label>
                    <input
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Brief description of what this job does..."
                      className="w-full h-[38px] px-3 py-2 bg-surface-container-high border border-outline-variant/50 rounded-lg text-on-surface placeholder-on-surface-variant/50 text-sm focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Output & Retry Settings */}
              <div className="bg-surface-container border border-outline-variant/50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Settings className="w-4 h-4 text-emerald-400" />
                  <h2 className="text-sm font-semibold text-on-surface">Settings</h2>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-on-surface-variant mb-1.5">
                      Output Format
                    </label>
                    <CustomSelect
                      value={outputFormat}
                      onChange={(val) => setOutputFormat(val as OutputFormat)}
                      options={[
                        { value: "csv", label: "CSV" },
                        { value: "excel", label: "Excel (XLSX)" },
                        { value: "json", label: "JSON" },
                      ]}
                      placeholder="Select format..."
                      accentColor="emerald"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
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
                        className="w-full h-[38px] px-3 py-2 bg-surface-container-high border border-outline-variant/50 rounded-lg text-on-surface font-mono text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all"
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
                        className="w-full h-[38px] px-3 py-2 bg-surface-container-high border border-outline-variant/50 rounded-lg text-on-surface font-mono text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Schedule Section */}
            <div className="bg-surface-container border border-outline-variant/50 rounded-xl p-4 overflow-visible relative z-30">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-semibold text-on-surface">Schedule</h2>
                <span className="text-[10px] text-on-surface-variant/60 font-mono ml-1">(optional)</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                {/* Cron Input */}
                <div className="md:col-span-4">
                  <label className="block text-xs font-medium text-on-surface-variant mb-1.5">
                    Cron Expression
                  </label>
                  <input
                    type="text"
                    value={cronExpression}
                    onChange={(e) => setCronExpression(e.target.value)}
                    placeholder="0 2 * * *"
                    className="w-full h-[38px] px-3 py-2 bg-surface-container-high border border-outline-variant/50 rounded-lg text-on-surface placeholder-on-surface-variant/50 font-mono text-sm focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all"
                  />
                </div>

                {/* Preset Selector */}
                <div className="md:col-span-3">
                  <label className="block text-xs font-medium text-on-surface-variant mb-1.5">
                    Quick Presets
                  </label>
                  <CustomSelect
                    value=""
                    onChange={(val) => val && setCronExpression(val)}
                    options={cronPresets.map((preset) => ({
                      value: preset.expression,
                      label: preset.description,
                    }))}
                    placeholder="Select preset..."
                    accentColor="amber"
                  />
                </div>

                {/* Schedule Preview */}
                <div className="md:col-span-5">
                  {schedulePreview.length > 0 ? (
                    <div>
                      <label className="block text-xs font-medium text-on-surface-variant mb-1.5">
                        Next Runs
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {schedulePreview.slice(0, 3).map((time, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1.5 px-2 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs font-mono text-amber-400"
                          >
                            <Timer className="w-3 h-3" />
                            {new Date(time).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}{' '}
                            {new Date(time).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center h-full">
                      <span className="text-xs text-on-surface-variant/50 italic">
                        {cronExpression ? "Invalid cron expression" : "No schedule - manual execution only"}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {cronExpression && schedulePreview.length > 0 && (
                <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  <code className="text-xs font-mono text-cyan-400">{cronExpression}</code>
                  <span className="text-xs text-on-surface-variant">— Job will run automatically</span>
                </div>
              )}
            </div>

            {/* Workflow Steps */}
            <div className="bg-surface-container border border-outline-variant/50 rounded-xl p-4 relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-violet-400" />
                  <h2 className="text-sm font-semibold text-on-surface">Workflow Steps</h2>
                  <span className="text-[10px] text-on-surface-variant/60 font-mono ml-1">
                    ({stepCount} step{stepCount !== 1 ? 's' : ''})
                  </span>
                </div>
                {stepCount > 0 && (
                  <span className="flex items-center gap-1 text-xs text-emerald-400">
                    <Check className="w-3 h-3" />
                    Ready
                  </span>
                )}
              </div>

              <WorkflowBuilder workflow={workflow} onChange={setWorkflow} />
            </div>

            {/* Submit Actions */}
            <div className="flex items-center justify-between py-2">
              <button
                type="button"
                onClick={() => navigate({ to: '/jobs/$jobId', params: { jobId } })}
                className="px-4 py-2 rounded-lg text-sm font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-all"
              >
                Cancel
              </button>

              <div className="flex items-center gap-3">
                {!isValid && (
                  <div className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                    <span>Complete required fields</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSaving || !isValid}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg font-semibold text-sm hover:from-amber-400 hover:to-orange-400 shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                >
                  {isSaving ? (
                    <>
                      <RefreshCcw className="w-4 h-4 animate-spin" />
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
          </form>
        </div>
      </main>
    </div>
  );
}

function JobEditPage() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <TooltipProvider delayDuration={300}>
          <JobsProvider>
            <EditJobPageContent />
          </JobsProvider>
        </TooltipProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
