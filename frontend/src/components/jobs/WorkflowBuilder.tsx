

import { useState } from "react";
import {
  WorkflowStep,
  WorkflowDefinition,
  StepType,
  createWorkflowStep,
} from "~/lib/jobs-api";
import {
  Trash2,
  Database,
  GitMerge,
  ChevronDown,
  ChevronUp,
  Code,
  Clock,
  Table,
  Layers,
  ChevronRight,
} from "lucide-react";

interface WorkflowBuilderProps {
  workflow: WorkflowDefinition;
  onChange: (workflow: WorkflowDefinition) => void;
}

const stepTypeConfig: Record<StepType, {
  label: string;
  shortLabel: string;
  colour: string;
  bgColour: string;
  borderColour: string;
  icon: React.ReactNode;
}> = {
  redshift_query: {
    label: "Redshift Query",
    shortLabel: "RS",
    colour: "text-redshift",
    bgColour: "bg-redshift/20",
    borderColour: "border-redshift/30",
    icon: <Database className="w-3.5 h-3.5" />,
  },
  sqlserver_query: {
    label: "SQL Server Query",
    shortLabel: "SQL",
    colour: "text-sqlserver",
    bgColour: "bg-sqlserver/20",
    borderColour: "border-sqlserver/30",
    icon: <Database className="w-3.5 h-3.5" />,
  },
  merge: {
    label: "Merge Results",
    shortLabel: "MRG",
    colour: "text-violet-400",
    bgColour: "bg-violet-500/20",
    borderColour: "border-violet-500/30",
    icon: <GitMerge className="w-3.5 h-3.5" />,
  },
};

function StepTypeBadge({ type }: { type: StepType }) {
  const config = stepTypeConfig[type];
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold ${config.bgColour} ${config.colour}`}>
      {config.icon}
      {config.shortLabel}
    </span>
  );
}

export function WorkflowBuilder({ workflow, onChange }: WorkflowBuilderProps) {
  const [expandedStep, setExpandedStep] = useState<string | null>(
    workflow.steps[0]?.id || null
  );

  const addStep = (type: StepType) => {
    const stepNames: Record<StepType, string> = {
      redshift_query: `Redshift Query ${workflow.steps.filter(s => s.type === "redshift_query").length + 1}`,
      sqlserver_query: `SQL Server Query ${workflow.steps.filter(s => s.type === "sqlserver_query").length + 1}`,
      merge: `Merge Results ${workflow.steps.filter(s => s.type === "merge").length + 1}`,
    };

    const defaultQueries: Record<StepType, string> = {
      redshift_query: "SELECT * FROM redshift_customers.public_customers LIMIT 5",
      sqlserver_query: "",
      merge: "",
    };

    const newStep = createWorkflowStep(type, stepNames[type], defaultQueries[type]);

    if (type === "merge" && workflow.steps.length > 0) {
      newStep.depends_on = workflow.steps
        .filter(s => s.type !== "merge")
        .map(s => s.id);
    }

    onChange({
      ...workflow,
      steps: [...workflow.steps, newStep],
    });
    setExpandedStep(newStep.id);
  };

  const updateStep = (stepId: string, updates: Partial<WorkflowStep>) => {
    onChange({
      ...workflow,
      steps: workflow.steps.map((step) =>
        step.id === stepId ? { ...step, ...updates } : step
      ),
    });
  };

  const removeStep = (stepId: string) => {
    const updatedSteps = workflow.steps
      .filter((step) => step.id !== stepId)
      .map((step) => ({
        ...step,
        depends_on: step.depends_on?.filter((dep) => dep !== stepId) || [],
      }));

    onChange({
      ...workflow,
      steps: updatedSteps,
    });
  };

  const moveStep = (stepId: string, direction: "up" | "down") => {
    const index = workflow.steps.findIndex((s) => s.id === stepId);
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === workflow.steps.length - 1)
    ) {
      return;
    }

    const newSteps = [...workflow.steps];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    [newSteps[index], newSteps[swapIndex]] = [newSteps[swapIndex], newSteps[index]];

    onChange({
      ...workflow,
      steps: newSteps,
    });
  };

  return (
    <div className="space-y-3">
      {/* Steps list */}
      {workflow.steps.length > 0 && (
        <div className="space-y-2">
          {workflow.steps.map((step, index) => {
            const config = stepTypeConfig[step.type];
            const isExpanded = expandedStep === step.id;

            return (
              <div
                key={step.id}
                className={`group rounded-lg border overflow-hidden transition-all duration-200 ${
                  isExpanded
                    ? `bg-surface-container-high/80 ${config.borderColour}`
                    : 'bg-surface-container-high/40 border-outline-variant/30 hover:border-outline-variant/50'
                }`}
              >
                {/* Step header */}
                <div
                  className="flex items-center gap-2 px-3 py-2.5 cursor-pointer"
                  onClick={() => setExpandedStep(isExpanded ? null : step.id)}
                >
                  {/* Index */}
                  <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-mono font-bold ${config.bgColour} ${config.colour}`}>
                    {index + 1}
                  </span>

                  {/* Step info */}
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <span className="font-medium text-sm text-on-surface truncate">{step.name}</span>
                    <StepTypeBadge type={step.type} />
                  </div>

                  {/* Query preview (collapsed) */}
                  {!isExpanded && step.query && (
                    <span className="hidden md:block text-[10px] font-mono text-on-surface-variant/60 truncate max-w-[200px]">
                      {step.query.split('\n')[0].substring(0, 40)}...
                    </span>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); moveStep(step.id, "up"); }}
                      disabled={index === 0}
                      className="p-1 rounded hover:bg-surface-container text-on-surface-variant hover:text-on-surface disabled:opacity-30 transition-all"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); moveStep(step.id, "down"); }}
                      disabled={index === workflow.steps.length - 1}
                      className="p-1 rounded hover:bg-surface-container text-on-surface-variant hover:text-on-surface disabled:opacity-30 transition-all"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); if (confirm(`Delete "${step.name}"?`)) removeStep(step.id); }}
                      className="p-1 rounded hover:bg-rose-500/20 text-on-surface-variant hover:text-rose-400 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <ChevronDown className={`w-4 h-4 text-on-surface-variant transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </div>

                {/* Step content (expanded) */}
                {isExpanded && (
                  <div className="border-t border-outline-variant/30 p-3 space-y-3 bg-surface-container/30">
                    {/* Step Name & Type Row */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-medium text-on-surface-variant uppercase tracking-wider mb-1">
                          Step Name
                        </label>
                        <input
                          type="text"
                          value={step.name}
                          onChange={(e) => updateStep(step.id, { name: e.target.value })}
                          className="w-full px-2.5 py-1.5 bg-surface-container border border-outline-variant/50 rounded-lg text-on-surface font-mono text-sm focus:outline-none focus:border-cyan-500/50 transition-all"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-medium text-on-surface-variant uppercase tracking-wider mb-1">
                            Output Table
                          </label>
                          <input
                            type="text"
                            value={step.output_table || ""}
                            onChange={(e) => updateStep(step.id, { output_table: e.target.value })}
                            placeholder="result_table"
                            className="w-full px-2.5 py-1.5 bg-surface-container border border-outline-variant/50 rounded-lg text-on-surface placeholder-on-surface-variant/40 font-mono text-sm focus:outline-none focus:border-cyan-500/50 transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-on-surface-variant uppercase tracking-wider mb-1">
                            Timeout (s)
                          </label>
                          <input
                            type="number"
                            value={step.timeout_seconds || 300}
                            onChange={(e) => updateStep(step.id, { timeout_seconds: parseInt(e.target.value) || 300 })}
                            min={30}
                            max={3600}
                            className="w-full px-2.5 py-1.5 bg-surface-container border border-outline-variant/50 rounded-lg text-on-surface font-mono text-sm focus:outline-none focus:border-cyan-500/50 transition-all"
                          />
                        </div>
                      </div>
                    </div>

                    {/* SQL Query */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="flex items-center gap-1.5 text-[10px] font-medium text-on-surface-variant uppercase tracking-wider">
                          <Code className="w-3 h-3" />
                          {step.type === "merge" ? "Merge Query" : "SQL Query"}
                        </label>
                        <span className="text-[10px] text-on-surface-variant/50 font-mono">
                          {step.query.length} chars
                        </span>
                      </div>
                      <div className="relative">
                        <textarea
                          value={step.query}
                          onChange={(e) => updateStep(step.id, { query: e.target.value })}
                          placeholder={
                            step.type === "merge"
                              ? "SELECT * FROM redshift_data r\nJOIN sqlserver_data s ON r.id = s.id"
                              : "SELECT *\nFROM table_name\nWHERE condition = 'value'"
                          }
                          rows={5}
                          className="w-full px-3 py-2.5 bg-[#1a1a2e] border border-outline-variant/50 rounded-lg text-emerald-400 placeholder-on-surface-variant/30 font-mono text-xs leading-relaxed focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all resize-y"
                          style={{ tabSize: 2 }}
                        />
                        {/* SQL syntax hint */}
                        <div className="absolute bottom-2 right-2 text-[9px] text-on-surface-variant/40 font-mono">
                          SQL
                        </div>
                      </div>
                    </div>

                    {/* Dependencies (for merge steps) */}
                    {step.type === "merge" && workflow.steps.filter(s => s.type !== "merge").length > 0 && (
                      <div>
                        <label className="flex items-center gap-1.5 text-[10px] font-medium text-on-surface-variant uppercase tracking-wider mb-2">
                          <Layers className="w-3 h-3" />
                          Dependencies
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {workflow.steps
                            .filter((s) => s.id !== step.id && s.type !== "merge")
                            .map((depStep) => {
                              const depConfig = stepTypeConfig[depStep.type];
                              const isSelected = step.depends_on?.includes(depStep.id) || false;

                              return (
                                <label
                                  key={depStep.id}
                                  className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer transition-all text-xs ${
                                    isSelected
                                      ? `${depConfig.bgColour} ${depConfig.borderColour} border ${depConfig.colour}`
                                      : 'bg-surface-container border border-outline-variant/30 text-on-surface-variant hover:border-outline-variant/50'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      const depends_on = step.depends_on || [];
                                      if (e.target.checked) {
                                        updateStep(step.id, { depends_on: [...depends_on, depStep.id] });
                                      } else {
                                        updateStep(step.id, { depends_on: depends_on.filter((d) => d !== depStep.id) });
                                      }
                                    }}
                                    className="hidden"
                                  />
                                  <span className="font-medium">{depStep.name}</span>
                                  <span className={`text-[9px] font-mono px-1 py-0.5 rounded ${depConfig.bgColour}`}>
                                    {depStep.output_table || 'output'}
                                  </span>
                                </label>
                              );
                            })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add step buttons */}
      <div className="flex flex-wrap items-center gap-2 pt-2">
        <span className="text-xs text-on-surface-variant">Add:</span>

        <button
          type="button"
          onClick={() => addStep("redshift_query")}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-redshift/10 hover:bg-redshift/20 text-redshift border border-redshift/30 rounded-lg text-xs font-medium transition-all active:scale-[0.98]"
        >
          <Database className="w-3.5 h-3.5" />
          Redshift
        </button>

        <button
          type="button"
          onClick={() => addStep("sqlserver_query")}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sqlserver/10 hover:bg-sqlserver/20 text-sqlserver border border-sqlserver/30 rounded-lg text-xs font-medium transition-all active:scale-[0.98]"
        >
          <Database className="w-3.5 h-3.5" />
          SQL Server
        </button>

        <button
          type="button"
          onClick={() => addStep("merge")}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 border border-violet-500/30 rounded-lg text-xs font-medium transition-all active:scale-[0.98]"
        >
          <GitMerge className="w-3.5 h-3.5" />
          Merge
        </button>
      </div>

      {/* Empty state */}
      {workflow.steps.length === 0 && (
        <div className="text-center py-8">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br from-cyan-500/10 to-violet-500/10 border border-cyan-500/20 flex items-center justify-center">
            <Layers className="w-6 h-6 text-cyan-400/60" />
          </div>
          <h3 className="text-sm font-semibold text-on-surface mb-1">No steps added</h3>
          <p className="text-xs text-on-surface-variant">
            Click a button above to add your first workflow step
          </p>
        </div>
      )}
    </div>
  );
}
