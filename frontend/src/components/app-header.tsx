import { Link } from "@tanstack/react-router";
import { Terminal, Settings, History, Plus, LucideIcon } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { ThemeToggle } from "~/components/ui/theme-toggle";
import { StudioNav } from "~/components/studio-nav";

interface AppHeaderProps {
  title?: string;
  subtitle?: string;
  icon?: LucideIcon;
  iconClassName?: string;
  showNav?: boolean;
}

export function AppHeader({
  title = "SQL Query Studio",
  subtitle = "Multi-Database Query Environment",
  icon: Icon = Terminal,
  iconClassName = "bg-gradient-to-br from-redshift to-sqlserver",
  showNav = true,
}: AppHeaderProps) {
  return (
    <header className="bg-surface-container/80 backdrop-blur-sm border-b border-outline-variant/50 sticky top-0 z-20 flex-shrink-0">
      {/* Navigation Bar */}
      {showNav && (
        <div className="px-6 py-3 border-b border-outline-variant/30">
          <StudioNav />
        </div>
      )}

      {/* Page Header */}
      <div className="flex items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-3 group">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconClassName} group-hover:scale-105 transition-transform shadow-lg`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-on-surface">
              {title}
            </h1>
            <p className="text-xs text-on-surface-variant font-mono">
              {subtitle}
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <ThemeToggle />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="icon" size="icon" disabled className="opacity-50 cursor-not-allowed">
                <Settings className="w-[18px] h-[18px]" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Settings (Coming Soon)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="icon" size="icon" disabled className="opacity-50 cursor-not-allowed">
                <History className="w-[18px] h-[18px]" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Query History (Coming Soon)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="tonal" disabled className="opacity-50 cursor-not-allowed">
                <Plus className="w-[18px] h-[18px]" />
                New Query
              </Button>
            </TooltipTrigger>
            <TooltipContent>New Query (Coming Soon)</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </header>
  );
}
