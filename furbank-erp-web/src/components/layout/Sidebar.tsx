import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { 
  LayoutDashboard, 
  FolderKanban, 
  CheckSquare, 
  Users, 
  BarChart3,
  LogOut,
  Moon,
  Sun
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function Sidebar() {
  const { signOut, permissions } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  const navItems = [];

  // Dashboard is first for all roles
  navItems.push({
    label: 'Dashboard',
    path: '/dashboard',
    icon: LayoutDashboard,
  });

  // Build navigation items based on role/permissions
  // Use permissions as the primary check since role might be a string
  if (permissions.canViewAllProjects) {
    navItems.push(
      {
        label: 'Projects',
        path: '/projects',
        icon: FolderKanban,
      },
      {
        label: 'Tasks',
        path: '/tasks',
        icon: CheckSquare,
      }
    );

    if (permissions.canViewAllUsers) {
      navItems.push({
        label: 'Users',
        path: '/users',
        icon: Users,
      });
    }

    if (permissions.canViewReports) {
      navItems.push({
        label: 'Reports',
        path: '/reports',
        icon: BarChart3,
      });
    }
  } else {
    // Regular users only see tasks
    navItems.push({
      label: 'My Tasks',
      path: '/tasks',
      icon: CheckSquare,
    });
  }

  return (
    <aside className="hidden md:flex md:flex-col md:w-64 md:border-r md:bg-card md:sticky md:top-0 md:h-screen md:overflow-y-auto">
      <div className="flex flex-col h-full">
        {/* Logo/Brand */}
        <div className="flex items-center gap-2 px-6 py-4 border-b">
          <span className="text-lg font-semibold">Furbank ERP</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-4 space-y-1">
          {navItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200",
                  isActive(item.path)
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground hover:translate-x-1"
                )}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <Icon className="h-5 w-5 transition-transform duration-200" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Dark mode toggle and sign out */}
        <div className="px-4 py-4 border-t space-y-2">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3"
            onClick={toggleTheme}
          >
            {theme === 'dark' ? (
              <>
                <Sun className="h-4 w-4" />
                <span>Light Mode</span>
              </>
            ) : (
              <>
                <Moon className="h-4 w-4" />
                <span>Dark Mode</span>
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start gap-3"
            onClick={signOut}
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </Button>
        </div>
      </div>
    </aside>
  );
}
