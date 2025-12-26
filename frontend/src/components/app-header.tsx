import { Link } from "@tanstack/react-router";
import { Terminal, Settings, History, Plus, LucideIcon, User, LogOut, KeyRound, Shield } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { ThemeToggle } from "~/components/ui/theme-toggle";
import { StudioNav } from "~/components/studio-nav";
import { useAuth } from "~/lib/auth-context";

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
  const { user, isAuthenticated, logout, hasRole } = useAuth();

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  const navigateTo = (path: string) => {
    window.location.href = path;
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      case 'editor':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'viewer':
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

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

          {/* User Menu */}
          {isAuthenticated && user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2 ml-2 h-auto py-1.5">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <div className="text-left hidden sm:block">
                    <div className="text-sm font-medium">{user.display_name || user.username}</div>
                    <div className={`text-xs px-1.5 py-0.5 rounded-full inline-block ${getRoleBadgeColor(user.role)}`}>
                      {user.role}
                    </div>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span>{user.display_name || user.username}</span>
                    <span className="text-xs text-muted-foreground font-normal">@{user.username}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {hasRole('admin') && (
                  <>
                    <DropdownMenuItem onClick={() => navigateTo('/admin')}>
                      <Shield className="w-4 h-4 mr-2" />
                      Admin Dashboard
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem disabled>
                  <KeyRound className="w-4 h-4 mr-2" />
                  Change Password
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-600 dark:text-red-400">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="tonal" onClick={() => navigateTo('/login')}>
              Sign In
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
