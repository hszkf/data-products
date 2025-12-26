/**
 * Admin Dashboard Layout
 * Container for admin pages with sidebar navigation
 */

import { createFileRoute, Outlet, useLocation } from '@tanstack/react-router';
import { useAuth } from '~/lib/auth-context';
import { AppHeader } from '~/components/app-header';
import { Shield, Users, FileText, BarChart3 } from 'lucide-react';
import { cn } from '~/lib/utils';

// @ts-expect-error - Route will be auto-generated when dev server runs
export const Route = createFileRoute('/admin')({
  component: AdminLayout,
});

function AdminLayout() {
  const { hasRole, isLoading } = useAuth();
  const location = useLocation();

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Check if user is admin
  if (!hasRole('admin')) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <Shield className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground mb-4">
            You need admin privileges to access this page.
          </p>
          <a href="/" className="text-primary hover:underline">
            Go back to home
          </a>
        </div>
      </div>
    );
  }

  const navItems = [
    { path: '/admin', label: 'Overview', icon: BarChart3, exact: true },
    { path: '/admin/users', label: 'Users', icon: Users },
    { path: '/admin/logs', label: 'Query Logs', icon: FileText },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader
        title="Admin Dashboard"
        subtitle="System Administration"
        icon={Shield}
        iconClassName="bg-gradient-to-br from-red-500 to-red-700"
        showNav={true}
      />

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="w-64 border-r border-outline-variant/50 bg-surface-container/30 p-4 flex-shrink-0">
          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = item.exact
                ? location.pathname === item.path
                : location.pathname.startsWith(item.path);

              return (
                <a
                  key={item.path}
                  href={item.path}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </a>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
