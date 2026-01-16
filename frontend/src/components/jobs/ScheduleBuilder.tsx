

import { useState } from "react";
import {
  Clock,
  HelpCircle,
  RefreshCw,
  Calendar,
  Zap,
  Terminal,
  MessageSquare,
} from "lucide-react";
import { formatMYDateTime } from "~/lib/date-utils";

interface ScheduleBuilderProps {
  cronExpression?: string;
  naturalSchedule?: string;
  onCronChange: (cron: string) => void;
  onNaturalScheduleChange: (schedule: string) => void;
}

const cronPresets = [
  { label: "Every minute", value: "* * * * *", description: "Runs every minute" },
  { label: "Every 5 minutes", value: "*/5 * * * *", description: "Runs every 5 minutes" },
  { label: "Every 15 minutes", value: "*/15 * * * *", description: "Runs every 15 minutes" },
  { label: "Every 30 minutes", value: "*/30 * * * *", description: "Runs every 30 minutes" },
  { label: "Every hour", value: "0 * * * *", description: "At the start of every hour" },
  { label: "Daily at midnight", value: "0 0 * * *", description: "Every day at 00:00" },
  { label: "Daily at 9 AM", value: "0 9 * * *", description: "Every day at 09:00" },
  { label: "Weekly on Monday", value: "0 9 * * 1", description: "Every Monday at 09:00" },
  { label: "Weekdays at 9 AM", value: "0 9 * * 1-5", description: "Monday to Friday at 09:00" },
  { label: "Monthly", value: "0 0 1 * *", description: "First day of every month" },
];

const weekDays = [
  { label: "Sunday", value: "0" },
  { label: "Monday", value: "1" },
  { label: "Tuesday", value: "2" },
  { label: "Wednesday", value: "3" },
  { label: "Thursday", value: "4" },
  { label: "Friday", value: "5" },
  { label: "Saturday", value: "6" },
];

const naturalExamples = [
  "Every weekday at 9 AM",
  "Daily at 8:30 PM",
  "Every Monday at 6 AM",
  "First of every month at midnight",
  "Every hour during business hours",
];

// Tab button component
function ModeTab({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium
        transition-all duration-200
        ${active
          ? 'bg-surface-container-high text-on-surface shadow-sm'
          : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/50'}
      `}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

export function ScheduleBuilder({
  cronExpression,
  naturalSchedule,
  onCronChange,
  onNaturalScheduleChange,
}: ScheduleBuilderProps) {
  const [mode, setMode] = useState<"simple" | "advanced" | "natural">(
    naturalSchedule ? "natural" : cronExpression ? "advanced" : "simple"
  );
  const [simpleSchedule, setSimpleSchedule] = useState({
    frequency: "daily",
    time: "09:00",
    weekday: "1",
  });

  const parseCronExpression = (cron: string) => {
    const parts = cron.split(" ");
    if (parts.length === 5) {
      if (cron === "0 9 * * 1-5") {
        setSimpleSchedule({ frequency: "weekdays", time: "09:00", weekday: "1" });
      } else if (parts[4] !== "*" && !parts[4].includes("-") && !parts[4].includes(",")) {
        setSimpleSchedule({
          frequency: "weekly",
          time: `${parts[1].padStart(2, "0")}:${parts[0].padStart(2, "0")}`,
          weekday: parts[4],
        });
      } else if (parts[2] === "*" && parts[3] === "*" && parts[4] === "*") {
        setSimpleSchedule({
          frequency: "daily",
          time: `${parts[1].padStart(2, "0")}:${parts[0].padStart(2, "0")}`,
          weekday: "1",
        });
      }
    }
  };

  const generateCronFromSimple = () => {
    const [hours, minutes] = simpleSchedule.time.split(":");

    switch (simpleSchedule.frequency) {
      case "daily":
        return `${minutes} ${hours} * * *`;
      case "weekly":
        return `${minutes} ${hours} * * ${simpleSchedule.weekday}`;
      case "weekdays":
        return `${minutes} ${hours} * * 1-5`;
      case "hourly":
        return `${minutes} * * * *`;
      case "monthly":
        return `${minutes} ${hours} 1 * *`;
      default:
        return "0 9 * * *";
    }
  };

  const handleSimpleScheduleChange = (updates: Partial<typeof simpleSchedule>) => {
    const newSchedule = { ...simpleSchedule, ...updates };
    setSimpleSchedule(newSchedule);

    const [hours, minutes] = newSchedule.time.split(":");
    let cron = "";

    switch (newSchedule.frequency) {
      case "daily":
        cron = `${minutes} ${hours} * * *`;
        break;
      case "weekly":
        cron = `${minutes} ${hours} * * ${newSchedule.weekday}`;
        break;
      case "weekdays":
        cron = `${minutes} ${hours} * * 1-5`;
        break;
      case "hourly":
        cron = `${minutes} * * * *`;
        break;
      case "monthly":
        cron = `${minutes} ${hours} 1 * *`;
        break;
      default:
        cron = "0 9 * * *";
    }

    onCronChange(cron);
  };

  const handlePresetSelect = (value: string) => {
    onCronChange(value);
    parseCronExpression(value);
  };

  const getNextRuns = (cron: string, count: number = 5): string[] => {
    const now = new Date();
    const runs: string[] = [];

    for (let i = 0; i < count; i++) {
      const nextRun = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
      runs.push(formatMYDateTime(nextRun));
    }

    return runs;
  };

  const currentCron = mode === "natural" ? "" : mode === "advanced" ? cronExpression || "" : generateCronFromSimple();

  return (
    <div className="space-y-6">
      {/* Mode Selector */}
      <div className="flex items-center gap-2 p-1.5 bg-surface-container-high/50 rounded-xl w-fit">
        <ModeTab
          active={mode === "simple"}
          icon={Calendar}
          label="Simple"
          onClick={() => {
            setMode("simple");
            const cron = generateCronFromSimple();
            onCronChange(cron);
          }}
        />
        <ModeTab
          active={mode === "natural"}
          icon={MessageSquare}
          label="Natural Language"
          onClick={() => setMode("natural")}
        />
        <ModeTab
          active={mode === "advanced"}
          icon={Terminal}
          label="Cron"
          onClick={() => setMode("advanced")}
        />
      </div>

      {/* Simple Schedule Builder */}
      {mode === "simple" && (
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-on-surface-variant mb-2">
              Frequency
            </label>
            <select
              value={simpleSchedule.frequency}
              onChange={(e) => handleSimpleScheduleChange({ frequency: e.target.value })}
              className="
                w-full px-4 py-3
                bg-surface-container border border-outline-variant/50 rounded-xl
                text-on-surface text-sm
                focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20
                transition-all duration-200 cursor-pointer
              "
            >
              <option value="hourly">Hourly</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="weekdays">Weekdays (Mon-Fri)</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          {(simpleSchedule.frequency === "daily" ||
            simpleSchedule.frequency === "weekly" ||
            simpleSchedule.frequency === "weekdays" ||
            simpleSchedule.frequency === "monthly") && (
            <div>
              <label className="block text-sm font-medium text-on-surface-variant mb-2">
                Time
              </label>
              <input
                type="time"
                value={simpleSchedule.time}
                onChange={(e) => handleSimpleScheduleChange({ time: e.target.value })}
                className="
                  w-full px-4 py-3
                  bg-surface-container border border-outline-variant/50 rounded-xl
                  text-on-surface font-mono text-sm
                  focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20
                  transition-all duration-200
                "
              />
            </div>
          )}

          {simpleSchedule.frequency === "weekly" && (
            <div>
              <label className="block text-sm font-medium text-on-surface-variant mb-2">
                Day of Week
              </label>
              <select
                value={simpleSchedule.weekday}
                onChange={(e) => handleSimpleScheduleChange({ weekday: e.target.value })}
                className="
                  w-full px-4 py-3
                  bg-surface-container border border-outline-variant/50 rounded-xl
                  text-on-surface text-sm
                  focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20
                  transition-all duration-200 cursor-pointer
                "
              >
                {weekDays.map((day) => (
                  <option key={day.value} value={day.value}>
                    {day.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Quick Presets */}
          <div>
            <label className="block text-sm font-medium text-on-surface-variant mb-3">
              Quick Presets
            </label>
            <div className="grid grid-cols-2 gap-2">
              {cronPresets.slice(0, 6).map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => handlePresetSelect(preset.value)}
                  className="
                    flex items-center justify-between px-3 py-2.5
                    bg-surface-container border border-outline-variant/30 rounded-xl
                    text-sm text-on-surface
                    hover:bg-surface-container-high hover:border-outline-variant/50
                    transition-all duration-200
                  "
                >
                  <span>{preset.label}</span>
                  <Zap className="w-3.5 h-3.5 text-amber-400/60" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Natural Language Schedule */}
      {mode === "natural" && (
        <div className="space-y-5">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-on-surface-variant mb-2">
              Schedule in Plain English
              <div className="group relative">
                <HelpCircle className="w-4 h-4 cursor-help" />
                <div className="absolute bottom-full left-0 mb-2 w-64 p-3 bg-surface-container-high border border-outline-variant rounded-xl shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                  <p className="text-xs text-on-surface-variant">
                    Examples: "every weekday at 9am", "daily at 2:30 PM", "first Monday of every month"
                  </p>
                </div>
              </div>
            </label>
            <input
              type="text"
              value={naturalSchedule || ""}
              onChange={(e) => onNaturalScheduleChange(e.target.value)}
              placeholder="e.g., every weekday at 9 AM"
              className="
                w-full px-4 py-3
                bg-surface-container border border-outline-variant/50 rounded-xl
                text-on-surface placeholder-on-surface-variant/50
                text-sm
                focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20
                transition-all duration-200
              "
            />
            <p className="text-xs text-on-surface-variant/60 mt-1.5 font-mono">
              Natural language schedules are parsed server-side
            </p>
          </div>

          <div className="p-4 bg-surface-container-high/50 border border-outline-variant/30 rounded-xl">
            <p className="text-sm font-medium text-on-surface-variant mb-3">Popular Examples</p>
            <div className="flex flex-wrap gap-2">
              {naturalExamples.map((example) => (
                <button
                  key={example}
                  onClick={() => onNaturalScheduleChange(example)}
                  className="
                    px-3 py-1.5
                    bg-amber-500/10 hover:bg-amber-500/20
                    text-amber-400 text-xs font-medium
                    border border-amber-500/20 rounded-lg
                    transition-all duration-200
                  "
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Advanced Cron Expression */}
      {mode === "advanced" && (
        <div className="space-y-5">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-on-surface-variant mb-2">
              Cron Expression
              <div className="group relative">
                <HelpCircle className="w-4 h-4 cursor-help" />
                <div className="absolute bottom-full left-0 mb-2 w-72 p-3 bg-surface-container-high border border-outline-variant rounded-xl shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                  <p className="text-xs text-on-surface-variant mb-2">
                    Format: <code className="text-cyan-400">minute hour day month weekday</code>
                  </p>
                  <p className="text-xs text-on-surface-variant">
                    Example: <code className="text-cyan-400">0 9 * * 1-5</code> = 9 AM Monday to Friday
                  </p>
                </div>
              </div>
            </label>
            <input
              type="text"
              value={cronExpression || ""}
              onChange={(e) => onCronChange(e.target.value)}
              placeholder="0 9 * * 1-5"
              className="
                w-full px-4 py-3
                bg-surface-container border border-outline-variant/50 rounded-xl
                text-on-surface placeholder-on-surface-variant/50
                font-mono text-sm
                focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20
                transition-all duration-200
              "
            />
            <p className="text-xs text-on-surface-variant/60 mt-1.5 font-mono">
              minute (0-59) | hour (0-23) | day (1-31) | month (1-12) | weekday (0-6, 0=Sunday)
            </p>
          </div>

          {/* Cron Presets */}
          <div>
            <label className="block text-sm font-medium text-on-surface-variant mb-3">
              Common Cron Expressions
            </label>
            <div className="space-y-2">
              {cronPresets.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => onCronChange(preset.value)}
                  className="
                    w-full flex items-center justify-between px-4 py-3
                    bg-surface-container border border-outline-variant/30 rounded-xl
                    hover:bg-surface-container-high hover:border-outline-variant/50
                    transition-all duration-200 group
                  "
                >
                  <div className="text-left">
                    <span className="text-sm text-on-surface">{preset.label}</span>
                    <span className="text-xs text-on-surface-variant/60 ml-2">
                      {preset.description}
                    </span>
                  </div>
                  <code className="text-xs font-mono text-cyan-400/70 group-hover:text-cyan-400 transition-colors">
                    {preset.value}
                  </code>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Schedule Preview */}
      {currentCron && (
        <div className="p-4 bg-surface-container-high/50 border border-outline-variant/30 rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-on-surface-variant">Next Runs</span>
            <button
              onClick={() => {}}
              className="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-all"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-1.5">
            {getNextRuns(currentCron).map((run, index) => (
              <div key={index} className="flex items-center gap-3 text-sm font-mono text-on-surface-variant">
                <span className="w-5 h-5 rounded bg-surface-container flex items-center justify-center text-xs">
                  {index + 1}
                </span>
                {run}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Current Cron Display */}
      {currentCron && (
        <div className="flex items-center gap-2 px-4 py-3 bg-cyan-500/10 border border-cyan-500/20 rounded-xl">
          <Clock className="w-4 h-4 text-cyan-400" />
          <span className="text-sm text-on-surface-variant">Active schedule:</span>
          <code className="text-sm font-mono text-cyan-400 font-semibold">
            {currentCron}
          </code>
        </div>
      )}
    </div>
  );
}
