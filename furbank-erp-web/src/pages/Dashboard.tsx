import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  getSuperAdminDashboardStats,
  getAdminDashboardStats,
  getStaffDashboardStats,
  type DashboardStats,
} from '@/lib/services/dashboardService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UserRole } from '@/lib/supabase/types';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Clock, AlertCircle, FileText } from 'lucide-react';

export function Dashboard() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    async function fetchStats() {
      try {
        setLoading(true);
        setError(null);

        let result;
        if (role === UserRole.SUPER_ADMIN) {
          result = await getSuperAdminDashboardStats();
        } else if (role === UserRole.ADMIN) {
          result = await getAdminDashboardStats();
        } else {
          result = await getStaffDashboardStats();
        }

        if (result.error) {
          setError(result.error);
        } else {
          setStats(result.data);
        }
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, [user, role, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Loading dashboard...</p>
      </div>
    );
  }

  if (error) {
    // Check if it's a migration-related error
    const isMigrationError = error.message.includes('does not exist') || 
                            error.message.includes('function') ||
                            error.message.includes('User does not exist');

    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <p className="text-destructive font-medium">Error loading dashboard: {error.message}</p>
        {isMigrationError && (
          <div className="text-sm text-muted-foreground max-w-md text-center">
            <p>This might be because database migrations haven't been run yet.</p>
            <p className="mt-2">Please run migrations 007-010 in your Supabase SQL Editor.</p>
          </div>
        )}
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  // Super Admin View
  if (role === UserRole.SUPER_ADMIN) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Global overview across all projects</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card className="animate-in fade-in slide-in-from-left-4 duration-300 hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalProjects ?? 0}</div>
            </CardContent>
          </Card>

          <Card className="animate-in fade-in slide-in-from-left-4 duration-300 delay-75 hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalTasks ?? 0}</div>
            </CardContent>
          </Card>

          <Card className="animate-in fade-in slide-in-from-left-4 duration-300 delay-150 hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tasks Due Today</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.tasksDueToday}</div>
            </CardContent>
          </Card>

          <Card className="animate-in fade-in slide-in-from-left-4 duration-300 delay-200 hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overdue Tasks</CardTitle>
              <AlertCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats.overdueTasks}</div>
            </CardContent>
          </Card>

          <Card className="animate-in fade-in slide-in-from-left-4 duration-300 delay-300 hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Awaiting Review</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.tasksAwaitingReview}</div>
            </CardContent>
          </Card>
        </div>

        {stats.taskStatusDistribution && stats.taskStatusDistribution.length > 0 && (
          <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <CardHeader>
              <CardTitle>Task Status Distribution</CardTitle>
              <CardDescription>Breakdown of tasks by status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {stats.taskStatusDistribution?.map((item, index) => (
                  <div
                    key={item.status}
                    className={`flex items-center justify-between p-4 rounded-lg border ${
                      index % 2 === 0
                        ? 'bg-card border-border/50 dark:bg-card/50'
                        : 'bg-accent/30 border-border/30 dark:bg-accent/10'
                    } ${
                      index < (stats.taskStatusDistribution?.length ?? 0) - 1
                        ? 'mb-2 border-b-2'
                        : ''
                    } hover:bg-accent/50 hover:shadow-sm transition-all duration-200`}
                  >
                    <span className="text-sm font-medium capitalize">{item.status.replace('_', ' ')}</span>
                    <span className="text-2xl font-bold">{item.count}</span>
                  </div>
                )) ?? []}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Admin View
  if (role === UserRole.ADMIN) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Operational overview of your projects</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="animate-in fade-in slide-in-from-left-4 duration-300 hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeProjects ?? 0}</div>
            </CardContent>
          </Card>

          <Card className="animate-in fade-in slide-in-from-left-4 duration-300 delay-75 hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tasks Due Today</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.tasksDueToday}</div>
            </CardContent>
          </Card>

          <Card className="animate-in fade-in slide-in-from-left-4 duration-300 delay-150 hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overdue Tasks</CardTitle>
              <AlertCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats.overdueTasks}</div>
            </CardContent>
          </Card>

          <Card className="animate-in fade-in slide-in-from-left-4 duration-300 delay-200 hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Awaiting Review</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.tasksAwaitingReview}</div>
            </CardContent>
          </Card>
        </div>

        {stats.recentlyUpdatedTasks && stats.recentlyUpdatedTasks.length > 0 && (
          <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <CardHeader>
              <CardTitle>Recently Updated Tasks</CardTitle>
              <CardDescription>Tasks that were recently modified</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stats.recentlyUpdatedTasks.slice(0, 10).map((task, index) => (
                  <Link
                    key={task.id}
                    to={`/tasks/${task.id}`}
                    className="flex items-center justify-between p-3 rounded-md border hover:bg-accent hover:shadow-sm hover:scale-[1.01] transition-all duration-200 group"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{task.title}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {task.status.replace('_', ' ')}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Staff View
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Your personal productivity overview</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Link to="/tasks" className="block">
          <Card className="hover:shadow-lg hover:scale-[1.02] transition-all duration-200 cursor-pointer group animate-in fade-in slide-in-from-left-4 duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium group-hover:text-primary transition-colors">My Tasks</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.myTasks ?? 0}</div>
              <div className="mt-2">
                <span className="text-sm text-primary group-hover:underline">View all</span>
                <ArrowRight className="h-3 w-3 ml-1 inline group-hover:translate-x-1 transition-transform" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Card className="animate-in fade-in slide-in-from-left-4 duration-300 delay-75 hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Due Today</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.tasksDueToday}</div>
          </CardContent>
        </Card>

        <Card className="animate-in fade-in slide-in-from-left-4 duration-300 delay-150 hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.overdueTasks}</div>
          </CardContent>
        </Card>

        <Card className="animate-in fade-in slide-in-from-left-4 duration-300 delay-200 hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Awaiting My Action</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.tasksAwaitingAction ?? 0}</div>
          </CardContent>
        </Card>

        <Card className="animate-in fade-in slide-in-from-left-4 duration-300 delay-300 hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Submitted for Review</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.tasksSubmittedForReview ?? 0}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
