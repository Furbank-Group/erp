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
import { ArrowRight, Archive } from 'lucide-react';
import { getTaskStatusDisplay, getProjectStatusDisplay } from '@/lib/utils/taskDisplay';

export function Dashboard() {
  const { user, role, permissions } = useAuth();
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
    const isMigrationError = error.message.includes('does not exist') || 
                            error.message.includes('function') ||
                            error.message.includes('User does not exist');

    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <p className="text-destructive font-medium">Error loading dashboard: {error.message}</p>
        {isMigrationError && (
          <div className="text-sm text-muted-foreground max-w-md text-center">
            <p>This might be because database migrations haven't been run yet.</p>
            <p className="mt-2">Please run migrations 010 and 020 in your Supabase SQL Editor.</p>
          </div>
        )}
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  // Common task metrics summary
  const taskMetrics = {
    total: stats.totalTasks ?? stats.myTasks ?? 0,
    dueToday: stats.tasksDueToday,
    overdue: stats.overdueTasks,
    waitingReview: stats.tasksAwaitingReview,
    closed: stats.closedTasksCount ?? 0,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          {role === UserRole.SUPER_ADMIN && 'Global overview across all projects'}
          {role === UserRole.ADMIN && 'Operational overview of your projects'}
          {role === UserRole.USER && 'Your personal productivity overview'}
        </p>
      </div>

      {/* Section 1: Tasks (Most Urgent) */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Tasks</h2>
          <Link to="/tasks" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {/* Task Metrics Summary */}
        <div className="grid gap-3 md:grid-cols-5 mb-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground mb-1">Total</div>
              <div className="text-2xl font-bold">{taskMetrics.total}</div>
            </CardContent>
          </Card>
          <Card className={taskMetrics.dueToday > 0 ? 'border-orange-300 bg-orange-50/50' : ''}>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground mb-1">Due Today</div>
              <div className={`text-2xl font-bold ${taskMetrics.dueToday > 0 ? 'text-orange-700' : ''}`}>
                {taskMetrics.dueToday}
              </div>
            </CardContent>
          </Card>
          <Card className={taskMetrics.overdue > 0 ? 'border-red-300 bg-red-50/50' : ''}>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground mb-1">Overdue</div>
              <div className={`text-2xl font-bold ${taskMetrics.overdue > 0 ? 'text-red-700' : ''}`}>
                {taskMetrics.overdue}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground mb-1">Waiting Review</div>
              <div className="text-2xl font-bold">{taskMetrics.waitingReview}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground mb-1">Closed</div>
              <div className="text-2xl font-bold">{taskMetrics.closed}</div>
            </CardContent>
          </Card>
        </div>

        {/* Task Status Breakdown */}
        {stats.taskUrgencySummary && stats.taskUrgencySummary.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Status Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stats.taskUrgencySummary.map((summary) => {
                  const statusDisplay = getTaskStatusDisplay(summary.status);
                  const StatusIcon = statusDisplay.icon;
                  const hasUrgency = summary.overdue_count > 0 || summary.due_today_count > 0;

                  return (
                    <div
                      key={summary.status}
                      className={`flex items-center justify-between p-3 rounded-md border ${
                        hasUrgency ? 'bg-gray-50 border-gray-300' : 'bg-white border-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <StatusIcon className={`h-4 w-4 ${statusDisplay.color}`} />
                        <span className="text-sm font-medium capitalize">
                          {summary.status.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        {summary.overdue_count > 0 && (
                          <span className="text-red-700 font-semibold">
                            {summary.overdue_count} overdue
                          </span>
                        )}
                        {summary.due_today_count > 0 && (
                          <span className="text-orange-700 font-semibold">
                            {summary.due_today_count} due today
                          </span>
                        )}
                        {summary.due_soon_count > 0 && (
                          <span className="text-gray-600">
                            {summary.due_soon_count} due soon
                          </span>
                        )}
                        <span className="text-gray-700 font-medium">
                          {summary.total_count} total
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Section 2: Projects (Work Containers) */}
      {stats.projectHealth && stats.projectHealth.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Projects</h2>
            <Link to="/projects" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Project Health</CardTitle>
              <CardDescription>Task distribution and completion status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.projectHealth
                  .filter(p => p.project_status !== 'closed')
                  .map((project) => {
                    const statusDisplay = getProjectStatusDisplay(project.project_status);
                    const StatusIcon = statusDisplay.icon;
                    const hasOverdue = project.overdue_tasks > 0;

                    return (
                      <Link
                        key={project.project_id}
                        to={`/projects/${project.project_id}`}
                        className="block"
                      >
                        <div
                          className={`p-4 rounded-md border hover:bg-gray-50 transition-colors ${
                            hasOverdue ? 'border-orange-300 bg-orange-50/30' : 'border-gray-200'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold text-sm">{project.project_name}</h3>
                                <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs ${statusDisplay.bgColor} ${statusDisplay.color}`}>
                                  <StatusIcon className="h-3 w-3" />
                                  <span>{statusDisplay.label}</span>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs text-muted-foreground">Completion</div>
                              <div className="text-sm font-semibold">{project.completion_percentage}%</div>
                            </div>
                          </div>
                          <div className="grid grid-cols-4 gap-3 text-xs">
                            <div>
                              <div className="text-muted-foreground">Total</div>
                              <div className="font-medium">{project.total_tasks}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Open</div>
                              <div className="font-medium">{project.open_tasks}</div>
                            </div>
                            <div className={hasOverdue ? 'text-red-700' : ''}>
                              <div className="text-muted-foreground">Overdue</div>
                              <div className="font-semibold">{project.overdue_tasks}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Closed</div>
                              <div className="font-medium">{project.closed_tasks}</div>
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}

                {/* Closed Projects (Collapsed) */}
                {stats.projectHealth.filter(p => p.project_status === 'closed').length > 0 && (
                  <details className="mt-4">
                    <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground">
                      {stats.projectHealth.filter(p => p.project_status === 'closed').length} closed project(s)
                    </summary>
                    <div className="mt-2 space-y-2">
                      {stats.projectHealth
                        .filter(p => p.project_status === 'closed')
                        .map((project) => (
                          <Link
                            key={project.project_id}
                            to={`/projects/${project.project_id}`}
                            className="block"
                          >
                            <div className="p-3 rounded-md border border-gray-200 bg-gray-50 opacity-75 hover:opacity-100 transition-opacity">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Archive className="h-3 w-3 text-gray-500" />
                                  <span className="text-sm font-medium">{project.project_name}</span>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {project.total_tasks} tasks • {project.completion_percentage}% complete
                                </div>
                              </div>
                            </div>
                          </Link>
                        ))}
                    </div>
                  </details>
                )}
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Section 3: Users (Capacity & Accountability) - Only for Admin/Super Admin */}
      {stats.userWorkload && stats.userWorkload.length > 0 && (role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN) && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">User Workload</h2>
            {permissions.canViewAllUsers && (
              <Link to="/users" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Workload Summary</CardTitle>
              <CardDescription>Tasks assigned and overdue by user</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 font-semibold">Name</th>
                      <th className="text-left p-2 font-semibold">Role</th>
                      <th className="text-right p-2 font-semibold">Assigned</th>
                      <th className="text-right p-2 font-semibold">Overdue</th>
                      <th className="text-right p-2 font-semibold">Awaiting Review</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.userWorkload.map((user) => {
                      const hasOverdue = user.overdue_tasks > 0;
                      return (
                        <tr
                          key={user.user_id}
                          className={`border-b hover:bg-gray-50 transition-colors ${
                            hasOverdue ? 'bg-red-50/30' : ''
                          }`}
                        >
                          <td className="p-2 font-medium">{user.user_name}</td>
                          <td className="p-2 text-muted-foreground capitalize">
                            {user.user_role.replace('_', ' ')}
                          </td>
                          <td className="p-2 text-right">{user.assigned_tasks}</td>
                          <td className={`p-2 text-right font-semibold ${hasOverdue ? 'text-red-700' : ''}`}>
                            {user.overdue_tasks}
                          </td>
                          <td className="p-2 text-right">{user.tasks_waiting_review}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Empty States */}
      {(!stats.projectHealth || stats.projectHealth.length === 0) && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No projects found.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
