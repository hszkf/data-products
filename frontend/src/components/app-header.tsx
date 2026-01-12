import { Link } from "@tanstack/react-router";
import { Terminal, Settings, History, LucideIcon } from "lucide-react";
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
    <header className="bg-surface-container/80 backdrop-blur-sm border-b border-outline-variant/50 flex-shrink-0">
      {/* Navigation Bar */}
      {showNav && (
        <div className="px-4 py-2 border-b border-outline-variant/30">
          <StudioNav />
        </div>
      )}

      {/* Page Header */}
      <div className="flex items-center justify-between px-4 py-2">
        <Link to="/" className="flex items-center gap-2 group">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconClassName} group-hover:scale-105 transition-transform shadow-md`}>
            <Icon className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-base font-semibold tracking-tight text-on-surface">
              {title}
            </h1>
            <p className="text-[11px] text-on-surface-variant font-mono">
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
        </div>
      </div>
    </header>
  );
}
