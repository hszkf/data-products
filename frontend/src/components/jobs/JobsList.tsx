import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Job, formatSchedule } from "~/lib/jobs-api";
import { Button } from "~/components/ui/button";
import {
  Play,
  Pause,
  Trash2,
  Clock,
  MoreVertical,
  Calendar,
  Edit,
  ExternalLink,
  Power,
  PowerOff,
  Code,
  Database,
} from "lucide-react";

interface JobsListProps {
  jobs: Job[];
  onRun: (jobId: string) => void;
  onToggle: (jobId: string) => void;
  onPause: (jobId: string) => void;
  onResume: (jobId: string) => void;
  onDelete: (jobId: string) => void;
  isLoading?: boolean;
}

export function JobsList({
  jobs,
  onRun,
  onToggle,
  onPause,
  onResume,
  onDelete,
  isLoading,
}: JobsListProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  if (jobs.length === 0 && !isLoading) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 mx-auto mb-4 bg-surface-container-high rounded-full flex items-center justify-center">
          <Calendar className="w-8 h-8 text-on-surface-variant" />
        </div>
        <h3 className="text-lg font-medium mb-2">No jobs yet</h3>
        <p className="text-on-surface-variant mb-6">Create your first job to get started</p>
        <Link to="/jobs/new">
          <Button>Create Job</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {jobs.map((job) => (
        <div
          key={job.id}
          className="bg-surface-container border border-outline-variant rounded-xl p-4 hover:border-outline transition-colors"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <Link
                  href={`/jobs/${job.id}`}
                  className="text-lg font-semibold hover:text-indigo-400 transition-colors truncate"
                >
                  {job.job_name}
                </Link>

                {/* Job type badge */}
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full ${
                  job.job_type === "workflow"
                    ? "bg-blue-500/20 text-blue-400"
                    : "bg-purple-500/20 text-purple-400"
                }`}>
                  {job.job_type === "workflow" ? (
                    <Database className="w-3 h-3" />
                  ) : (
                    <Code className="w-3 h-3" />
                  )}
                  {job.job_type}
                </span>

                {/* Active/Inactive badge */}
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full ${
                  job.is_active
                    ? "bg-green-500/20 text-green-400"
                    : "bg-gray-500/20 text-gray-400"
                }`}>
                  {job.is_active ? (
                    <Power className="w-3 h-3" />
                  ) : (
                    <PowerOff className="w-3 h-3" />
                  )}
                  {job.is_active ? "Active" : "Inactive"}
                </span>
              </div>

              {job.description && (
                <p className="text-on-surface-variant text-sm mb-3 line-clamp-2">
                  {job.description}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-4 text-sm text-on-surface-variant">
                {/* Show steps count for workflow jobs */}
                {job.job_type === "workflow" && (
                  <span className="flex items-center gap-1.5">
                    <span>Steps:</span>
                    {job.workflow_definition?.steps?.length || 0}
                  </span>
                )}

                {/* Show function name for function jobs */}
                {job.job_type === "function" && job.target_function && (
                  <span className="flex items-center gap-1.5">
                    <Code className="w-3.5 h-3.5" />
                    {job.target_function}
                  </span>
                )}

                {/* Schedule info */}
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  {formatSchedule(job.schedule_type, job.schedule_config)}
                </span>

                {/* Next run time */}
                {job.is_active && job.next_run_time && (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    Next: {new Date(job.next_run_time).toLocaleString()}
                  </span>
                )}

                {/* Last run time */}
                {job.last_run_time && (
                  <span>
                    Last run: {new Date(job.last_run_time).toLocaleString()}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Run button */}
              <button
                onClick={() => onRun(job.id)}
                className="p-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg transition-colors"
                title="Run Now"
              >
                <Play className="w-4 h-4" />
              </button>

              {/* Toggle active/inactive */}
              <button
                onClick={() => onToggle(job.id)}
                className={`p-2 rounded-lg transition-colors ${
                  job.is_active
                    ? "bg-orange-500/20 hover:bg-orange-500/30 text-orange-400"
                    : "bg-green-500/20 hover:bg-green-500/30 text-green-400"
                }`}
                title={job.is_active ? "Deactivate" : "Activate"}
              >
                {job.is_active ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Power className="w-4 h-4" />
                )}
              </button>

              {/* More actions menu */}
              <div className="relative">
                <button
                  onClick={() => setOpenMenuId(openMenuId === job.id ? null : job.id)}
                  className="p-2 hover:bg-surface-container-high rounded-lg transition-colors"
                >
                  <MoreVertical className="w-4 h-4 text-on-surface-variant" />
                </button>

                {openMenuId === job.id && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setOpenMenuId(null)}
                    />
                    <div className="absolute right-0 top-full mt-1 w-48 bg-surface-container-high border border-outline-variant rounded-lg shadow-elevation-2 z-20 py-1">
                      <Link
                        href={`/jobs/${job.id}`}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-on-surface hover:bg-surface-container transition-colors"
                        onClick={() => setOpenMenuId(null)}
                      >
                        <ExternalLink className="w-4 h-4" />
                        View Details
                      </Link>
                      <Link
                        href={`/jobs/${job.id}?edit=true`}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-on-surface hover:bg-surface-container transition-colors"
                        onClick={() => setOpenMenuId(null)}
                      >
                        <Edit className="w-4 h-4" />
                        Edit Job
                      </Link>
                      <button
                        onClick={() => {
                          setOpenMenuId(null);
                          if (confirm("Are you sure you want to delete this job?")) {
                            onDelete(job.id);
                          }
                        }}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-surface-container transition-colors w-full text-left"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete Job
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
