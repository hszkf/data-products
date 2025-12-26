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
} from "~/lib/jobs-api";
import {
  ArrowLeft,
  Save,
  Calendar,
  Clock,
  Settings,
  Plus,
  Database,
  Timer,
  RefreshCcw,
  Check,
  AlertCircle,
  Layers,
  FileText,
  User,
  FileOutput,
  RotateCcw,
} from "lucide-react";

export const Route = createFileRoute('/jobs/new')({
  component: JobsNewPage,
});

function NewJobHeader() {
  return (
    <header className="flex items-center justify-between px-6 py-3 bg-surface-container/80 backdrop-blur-sm border-b border-outline-variant/50 sticky top-0 z-20">
      <div className="flex items-center gap-3">
        <Link
          to="/jobs"
          className="p-2 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-all"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>

        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Plus className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-on-surface">
              Create New Job
            </h1>
            <p className="text-[11px] text-on-surface-variant font-mono">
              Automated query workflow
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}

function NewJobPageContent() {
  const navigate = useNavigate();
  const { createNewJob, isLoading } = useJobs();
  const { showToast } = useToast();

  const [jobName, setJobName] = useState("");
  const [description, setDescription] = useState("");
  const [author, setAuthor] = useState("");
  const [workflow, setWorkflow] = useState<WorkflowDefinition>(createDefaultWorkflow());
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("csv");
  const [cronExpression, setCronExpression] = useState("");
  const [cronPresets] = useState<CronPreset[]>([
    { expression: "* * * * *", description: "Every minute" },
    { expression: "*/5 * * * *", description: "Every 5 minutes" },
    { expression: "*/15 * * * *", description: "Every 15 minutes" },
    { expression: "*/30 * * * *", description: "Every 30 minutes" },
    { expression: "0 * * * *", description: "Every hour" },
    { expression: "0 0 * * *", description: "Daily at midnight" },
    { expression: "0 9 * * *", description: "Daily at 9 AM" },
    { expression: "0 9 * * 1", description: "Weekly on Monday" },
    { expression: "0 9 * * 1-5", description: "Weekdays at 9 AM" },
    { expression: "0 0 1 * *", description: "Monthly" },
  ]);
  const [schedulePreview, setSchedulePreview] = useState<string[]>([]);
  const [maxRetries, setMaxRetries] = useState(3);
  const [retryDelay, setRetryDelay] = useState(60);

  const authorOptions = [
    { value: "hasif", label: "Hasif" },
    { value: "nazierul", label: "Nazierul" },
    { value: "izhar", label: "Izhar" },
    { value: "asyraff", label: "Asyraff" },
    { value: "bob", label: "Bob" },
    { value: "ernie", label: "Ernie" },
    { value: "yee_ming", label: "Yee Ming" },
  ];

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

    // Transform workflow steps to backend format
    const transformedWorkflow = {
      steps: workflow.steps.map((step, index) => ({
        step_number: index + 1,
        step_name: step.name,
        step_type: step.type,
        query: step.query,
        save_as: step.output_table,
      })),
      error_handling: workflow.error_handling?.on_step_failure || 'stop',
    };

    const jobId = await createNewJob({
      job_name: jobName,
      description: description || undefined,
      job_type: 'workflow',
      workflow_definition: transformedWorkflow,
      output_format: outputFormat,
      schedule_config: cronExpression ? {
        schedule_type: 'cron',
        cron_expression: cronExpression,
        timezone: 'UTC',
      } : undefined,
      author: author,
      max_retries: maxRetries,
      retry_delay_seconds: retryDelay,
    } as any);

    if (jobId) {
      navigate({ to: '/jobs', search: { created: jobName } });
    }
  };

  const stepCount = workflow.steps.length;
  const isValid = jobName.trim() && author && stepCount > 0;

  return (
    <div className="flex flex-col h-screen bg-surface overflow-hidden">
      <div
        className="fixed inset-0 pointer-events-none opacity-30"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 100% 80% at 50% -20%, rgba(16, 185, 129, 0.05), transparent 50%),
            radial-gradient(ellipse 60% 40% at 80% 20%, rgba(34, 211, 238, 0.03), transparent)
          `,
        }}
      />

      <NewJobHeader />

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
              <Link to="/jobs">
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg text-sm font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-all"
                >
                  Cancel
                </button>
              </Link>

              <div className="flex items-center gap-3">
                {!isValid && (
                  <div className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                    <span>Complete required fields</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading || !isValid}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-lg font-semibold text-sm hover:from-emerald-400 hover:to-cyan-400 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                >
                  {isLoading ? (
                    <>
                      <RefreshCcw className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Create Job
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

function JobsNewPage() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <TooltipProvider delayDuration={300}>
          <JobsProvider>
            <NewJobPageContent />
          </JobsProvider>
        </TooltipProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
