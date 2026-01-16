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
      <div className="space-y-4 md:space-y-6 w-full">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Dashboard</h1>
          <p className="text-xs sm:text-sm md:text-base text-muted-foreground mt-1">
            {role === UserRole.SUPER_ADMIN && 'Global overview across all projects'}
            {role === UserRole.ADMIN && 'Operational overview of your projects'}
            {role === UserRole.USER && 'Your personal productivity overview'}
          </p>
        </div>
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
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
    dueToday: stats.tasksDueToday ?? 0,
    overdue: stats.overdueTasks ?? 0,
    waitingReview: stats.tasksAwaitingReview ?? 0,
    closed: stats.closedTasksCount ?? 0,
  };

  return (
    <div className="space-y-4 md:space-y-6 w-full">
      <div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Dashboard</h1>
        <p className="text-xs sm:text-sm md:text-base text-muted-foreground mt-1">
          {role === UserRole.SUPER_ADMIN && 'Global overview across all projects'}
          {role === UserRole.ADMIN && 'Operational overview of your projects'}
          {role === UserRole.USER && 'Your personal productivity overview'}
        </p>
      </div>

      {/* Section 1: Tasks (Most Urgent) */}
      <section>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3 md:mb-4">
          <h2 className="text-base sm:text-lg md:text-xl font-semibold">Tasks</h2>
          <Link to="/tasks" className="text-xs md:text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 w-fit">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {/* Task Metrics Summary - All clickable */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 mb-3 md:mb-4">
          <Link to="/tasks" className="block">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="pt-3 pb-3 sm:pt-4 sm:pb-4">
                <div className="text-xs text-muted-foreground mb-1">Total</div>
                <div className="text-lg sm:text-xl md:text-2xl font-bold">{taskMetrics.total}</div>
              </CardContent>
            </Card>
          </Link>
          <Link to="/tasks?status=due_today" className="block">
            <Card className={`hover:shadow-md transition-shadow cursor-pointer ${taskMetrics.dueToday > 0 ? 'border-orange-500/50 dark:border-orange-400/50 bg-orange-50/50 dark:bg-orange-950/20' : ''}`}>
              <CardContent className="pt-3 pb-3 sm:pt-4 sm:pb-4">
                <div className="text-xs text-muted-foreground mb-1">Due Today</div>
                <div className={`text-lg sm:text-xl md:text-2xl font-bold ${taskMetrics.dueToday > 0 ? 'text-orange-700 dark:text-orange-400' : ''}`}>
                  {taskMetrics.dueToday}
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link to="/tasks?status=overdue" className="block">
            <Card className={`hover:shadow-md transition-shadow cursor-pointer ${taskMetrics.overdue > 0 ? 'border-red-500/50 dark:border-red-400/50 bg-red-50/50 dark:bg-red-950/20' : ''}`}>
              <CardContent className="pt-3 pb-3 sm:pt-4 sm:pb-4">
                <div className="text-xs text-muted-foreground mb-1">Overdue</div>
                <div className={`text-lg sm:text-xl md:text-2xl font-bold ${taskMetrics.overdue > 0 ? 'text-red-700 dark:text-red-400' : ''}`}>
                  {taskMetrics.overdue}
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link to="/tasks?review_status=pending_review" className="block">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="pt-3 pb-3 sm:pt-4 sm:pb-4">
                <div className="text-xs text-muted-foreground mb-1">Pending Review</div>
                <div className="text-lg sm:text-xl md:text-2xl font-bold">{taskMetrics.waitingReview}</div>
              </CardContent>
            </Card>
          </Link>
          <Link to="/tasks?status=closed" className="block">
            <Card className="col-span-2 sm:col-span-1 hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="pt-3 pb-3 sm:pt-4 sm:pb-4">
                <div className="text-xs text-muted-foreground mb-1">Closed</div>
                <div className="text-lg sm:text-xl md:text-2xl font-bold">{taskMetrics.closed}</div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Task Status Breakdown */}
        {stats.taskUrgencySummary && stats.taskUrgencySummary.length > 0 && (
          <Card>
            <CardHeader className="pb-3 md:pb-4 px-4 md:px-6 pt-4 md:pt-6">
              <CardTitle className="text-sm sm:text-base md:text-lg">Status Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="px-4 md:px-6 pb-4 md:pb-6">
              {/* Vertical layout for small screens, horizontal for large screens */}
              <div className="space-y-2 lg:space-y-0 lg:flex lg:gap-3">
                {[...stats.taskUrgencySummary].sort((a, b) => {
                  // Custom sort order: blocked, to_do, in_progress, done, closed
                  const order: Record<string, number> = {
                    'blocked': 1,
                    'to_do': 2,
                    'in_progress': 3,
                    'done': 4,
                    'closed': 5,
                  };
                  return (order[a.status] ?? 99) - (order[b.status] ?? 99);
                }).map((summary) => {
                  const statusDisplay = getTaskStatusDisplay(summary.status);
                  const StatusIcon = statusDisplay.icon;
                  const hasUrgency = summary.overdue_count > 0 || summary.due_today_count > 0;

                  // Map status to URL parameter
                  const statusParam = summary.status === 'to_do' ? 'to_do' : 
                                     summary.status === 'in_progress' ? 'in_progress' :
                                     summary.status === 'blocked' ? 'blocked' :
                                     summary.status === 'done' ? 'done' :
                                     summary.status === 'closed' ? 'closed' : summary.status;

                  return (
                    <Link
                      key={summary.status}
                      to={`/tasks?status=${statusParam}`}
                      className="block lg:flex-1"
                    >
                      <div
                        className={`flex flex-col lg:flex-col gap-2 lg:gap-3 p-2.5 sm:p-3 lg:p-4 rounded-md border transition-colors hover:shadow-md hover:bg-accent/50 dark:hover:bg-accent/20 cursor-pointer ${
                          hasUrgency 
                            ? 'bg-accent/50 dark:bg-accent/20 border-border' 
                            : 'bg-card border-border'
                        }`}
                      >
                        {/* Status Header - Icon and Label */}
                        <div className="flex items-center gap-2 sm:gap-3 lg:flex-col lg:items-start lg:gap-2 flex-1 min-w-0">
                          <div className="flex items-center gap-2 lg:w-full">
                            <StatusIcon className={`h-3.5 w-3.5 sm:h-4 sm:w-4 lg:h-5 lg:w-5 shrink-0 ${statusDisplay.color}`} />
                            <span className="text-xs sm:text-sm lg:text-sm font-semibold capitalize truncate lg:truncate-none">
                              {summary.status.replace('_', ' ')}
                            </span>
                          </div>
                        </div>
                        
                        {/* Metrics - Rearranged for better cognitive load on large screens */}
                        <div className="flex flex-col lg:flex-col gap-1.5 lg:gap-2">
                          {/* Total Count - Prominent on large screens */}
                          <div className="flex items-baseline justify-between lg:flex-col lg:items-start lg:gap-1">
                            <span className="text-[10px] sm:text-xs lg:text-xs text-muted-foreground font-medium uppercase tracking-wide">
                              Total
                            </span>
                            <span className="text-base sm:text-lg lg:text-2xl font-bold text-foreground tabular-nums">
                              {summary.total_count}
                            </span>
                          </div>
                          
                          {/* Show productivity metrics for done tasks, urgency for others */}
                          {summary.status === 'done' ? (
                            <div className="flex flex-wrap gap-x-2 gap-y-1 lg:flex-col lg:gap-1.5 text-xs lg:text-xs">
                              {/* Completion Rate */}
                              <div className="flex items-center gap-1.5 lg:justify-between">
                                <span className="text-[10px] lg:text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                                  Rate
                                </span>
                                <span className={`font-bold text-xs lg:text-sm tabular-nums ${
                                  taskMetrics.total > 0 
                                    ? 'text-green-700 dark:text-green-400' 
                                    : 'text-muted-foreground opacity-60'
                                }`}>
                                  {taskMetrics.total > 0 
                                    ? `${Math.round((summary.total_count / taskMetrics.total) * 100)}%`
                                    : '0%'}
                                </span>
                              </div>
                              {/* Done vs Open Ratio */}
                              <div className="flex items-center gap-1.5 lg:justify-between">
                                <span className="text-[10px] lg:text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                                  vs Open
                                </span>
                                <span className={`font-bold text-xs lg:text-sm tabular-nums ${
                                  taskMetrics.total > summary.total_count
                                    ? 'text-primary' 
                                    : 'text-muted-foreground opacity-60'
                                }`}>
                                  {taskMetrics.total > summary.total_count
                                    ? `${taskMetrics.total - summary.total_count}`
                                    : '0'}
                                </span>
                              </div>
                              {/* Productivity Score (done / total) */}
                              <div className="flex items-center gap-1.5 lg:justify-between">
                                <span className="text-[10px] lg:text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                                  Score
                                </span>
                                <span className={`font-semibold text-xs lg:text-sm tabular-nums ${
                                  summary.total_count > 0
                                    ? 'text-foreground' 
                                    : 'text-muted-foreground opacity-60'
                                }`}>
                                  {taskMetrics.total > 0
                                    ? `${summary.total_count}/${taskMetrics.total}`
                                    : '0/0'}
                                </span>
                              </div>
                            </div>
                          ) : (
                            /* Urgency Indicators - Always show all three, even if 0 */
                            <div className="flex flex-wrap gap-x-2 gap-y-1 lg:flex-col lg:gap-1.5 text-xs lg:text-xs">
                              <div className="flex items-center gap-1.5 lg:justify-between">
                                <span className="text-[10px] lg:text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                                  Overdue
                                </span>
                                <span className={`font-bold text-xs lg:text-sm tabular-nums ${
                                  summary.overdue_count > 0 
                                    ? 'text-red-700 dark:text-red-400' 
                                    : 'text-muted-foreground opacity-60'
                                }`}>
                                  {summary.overdue_count}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 lg:justify-between">
                                <span className="text-[10px] lg:text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                                  Today
                                </span>
                                <span className={`font-bold text-xs lg:text-sm tabular-nums ${
                                  summary.due_today_count > 0 
                                    ? 'text-orange-700 dark:text-orange-400' 
                                    : 'text-muted-foreground opacity-60'
                                }`}>
                                  {summary.due_today_count}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 lg:justify-between">
                                <span className="text-[10px] lg:text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                                  Soon
                                </span>
                                <span className={`font-semibold text-xs lg:text-sm tabular-nums ${
                                  summary.due_soon_count > 0 
                                    ? 'text-foreground' 
                                    : 'text-muted-foreground opacity-60'
                                }`}>
                                  {summary.due_soon_count}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
              
              {/* Task Distribution Bar Graph */}
              {(() => {
                // Calculate counts for the three main statuses
                const toDoCount = stats.taskUrgencySummary.find(s => s.status === 'to_do')?.total_count ?? 0;
                const inProgressCount = stats.taskUrgencySummary.find(s => s.status === 'in_progress')?.total_count ?? 0;
                const doneCount = stats.taskUrgencySummary.find(s => s.status === 'done')?.total_count ?? 0;
                const totalCount = toDoCount + inProgressCount + doneCount;
                
                // Calculate percentages
                const toDoPercent = totalCount > 0 ? (toDoCount / totalCount) * 100 : 0;
                const inProgressPercent = totalCount > 0 ? (inProgressCount / totalCount) * 100 : 0;
                const donePercent = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;
                
                return (
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                        Distribution
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {totalCount} total
                      </span>
                    </div>
                    <div className="w-full h-6 rounded-md overflow-hidden flex bg-muted/30">
                      {/* To Do segment */}
                      {toDoPercent > 0 && (
                        <div
                          className="bg-gray-600 transition-all duration-300 flex items-center justify-center"
                          style={{ width: `${toDoPercent}%` }}
                          title={`To Do: ${toDoCount} (${Math.round(toDoPercent)}%)`}
                        >
                          {toDoPercent > 10 && (
                            <span className="text-[10px] font-semibold text-white px-1">
                              {toDoCount}
                            </span>
                          )}
                        </div>
                      )}
                      {/* In Progress segment */}
                      {inProgressPercent > 0 && (
                        <div
                          className="bg-blue-600 transition-all duration-300 flex items-center justify-center"
                          style={{ width: `${inProgressPercent}%` }}
                          title={`In Progress: ${inProgressCount} (${Math.round(inProgressPercent)}%)`}
                        >
                          {inProgressPercent > 10 && (
                            <span className="text-[10px] font-semibold text-white px-1">
                              {inProgressCount}
                            </span>
                          )}
                        </div>
                      )}
                      {/* Done segment */}
                      {donePercent > 0 && (
                        <div
                          className="bg-green-600 transition-all duration-300 flex items-center justify-center"
                          style={{ width: `${donePercent}%` }}
                          title={`Done: ${doneCount} (${Math.round(donePercent)}%)`}
                        >
                          {donePercent > 10 && (
                            <span className="text-[10px] font-semibold text-white px-1">
                              {doneCount}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        )}
      </section>

      {/* Section 2: Projects (Work Containers) */}
      {stats.projectHealth && stats.projectHealth.length > 0 && (
        <section>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3 md:mb-4">
            <h2 className="text-base sm:text-lg md:text-xl font-semibold">Projects</h2>
            <Link to="/projects" className="text-xs md:text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 w-fit">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <Card>
            <CardHeader className="pb-3 md:pb-4 px-4 md:px-6 pt-4 md:pt-6">
              <CardTitle className="text-sm sm:text-base md:text-lg">Project Health</CardTitle>
              <CardDescription className="text-xs md:text-sm">Task distribution and completion status</CardDescription>
            </CardHeader>
            <CardContent className="px-4 md:px-6 pb-4 md:pb-6">
              <div className="space-y-2 sm:space-y-3">
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
                          className={`p-2.5 sm:p-3 md:p-4 rounded-md border hover:bg-accent/50 dark:hover:bg-accent/20 transition-colors ${
                            hasOverdue 
                              ? 'border-orange-500/50 dark:border-orange-400/50 bg-orange-50/30 dark:bg-orange-950/20' 
                              : 'border-border'
                          }`}
                        >
                          <div className="flex flex-col gap-2 mb-2">
                            <div className="flex items-start justify-between gap-2 min-h-10">
                              <div className="flex-1 min-w-0 pr-2">
                                <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-1 sm:gap-1.5">
                                  <h3 className="font-semibold text-xs sm:text-sm md:text-base truncate leading-tight">{project.project_name}</h3>
                                  <div className={`flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded text-xs shrink-0 w-fit ${statusDisplay.bgColor} ${statusDisplay.color}`}>
                                    <StatusIcon className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                                    <span className="hidden sm:inline">{statusDisplay.label}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="text-xs text-muted-foreground whitespace-nowrap">Completion</div>
                                <div className="text-xs sm:text-sm md:text-base font-semibold whitespace-nowrap">{project.completion_percentage}%</div>
                              </div>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-2 sm:gap-3 text-xs">
                            <div className="min-w-0">
                              <div className="text-muted-foreground text-xs">Total</div>
                              <div className="font-medium text-xs sm:text-sm tabular-nums">{project.total_tasks}</div>
                            </div>
                            <div className="min-w-0">
                              <div className="text-muted-foreground text-xs">Open</div>
                              <div className="font-medium text-xs sm:text-sm tabular-nums">{project.open_tasks}</div>
                            </div>
                            <div className={`min-w-0 ${hasOverdue ? 'text-red-700 dark:text-red-400' : ''}`}>
                              <div className="text-muted-foreground text-xs">Overdue</div>
                              <div className="font-semibold text-xs sm:text-sm tabular-nums">{project.overdue_tasks}</div>
                            </div>
                            <div className="min-w-0">
                              <div className="text-muted-foreground text-xs">Closed</div>
                              <div className="font-medium text-xs sm:text-sm tabular-nums">{project.closed_tasks}</div>
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}

                {/* Closed Projects (Collapsed) */}
                {stats.projectHealth.filter(p => p.project_status === 'closed').length > 0 && (
                  <details className="mt-4">
                    <summary className="text-xs md:text-sm text-muted-foreground cursor-pointer hover:text-foreground py-2">
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
                            <div className="p-3 rounded-md border border-border bg-muted/30 dark:bg-muted/20 opacity-75 hover:opacity-100 transition-opacity">
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <Archive className="h-3 w-3 text-muted-foreground shrink-0" />
                                  <span className="text-sm font-medium truncate">{project.project_name}</span>
                                </div>
                                <div className="text-xs text-muted-foreground shrink-0">
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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3 md:mb-4">
            <h2 className="text-base sm:text-lg md:text-xl font-semibold">User Workload</h2>
            {permissions.canViewAllUsers && (
              <Link to="/users" className="text-xs md:text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 w-fit">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>

          <Card>
            <CardHeader className="pb-3 md:pb-4 px-4 md:px-6 pt-4 md:pt-6">
              <CardTitle className="text-sm sm:text-base md:text-lg">Workload Summary</CardTitle>
              <CardDescription className="text-xs md:text-sm">Tasks assigned and overdue by user</CardDescription>
            </CardHeader>
            <CardContent className="px-4 md:px-6 pb-4 md:pb-6">
              <div className="overflow-x-auto -mx-4 md:-mx-6 px-4 md:px-6">
                <table className="w-full text-xs md:text-sm min-w-[500px] sm:min-w-[600px] md:min-w-0">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-2 sm:p-2.5 md:p-3 font-semibold text-xs sm:text-sm">Name</th>
                      <th className="text-left p-2 sm:p-2.5 md:p-3 font-semibold hidden sm:table-cell text-xs sm:text-sm">Role</th>
                      <th className="text-right p-2 sm:p-2.5 md:p-3 font-semibold text-xs sm:text-sm">Assigned</th>
                      <th className="text-right p-2 sm:p-2.5 md:p-3 font-semibold text-xs sm:text-sm">Overdue</th>
                      <th className="text-right p-2 sm:p-2.5 md:p-3 font-semibold text-xs sm:text-sm">Awaiting Review</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.userWorkload.map((user) => {
                      const hasOverdue = user.overdue_tasks > 0;
                      return (
                        <tr
                          key={user.user_id}
                          className={`border-b border-border hover:bg-accent/50 dark:hover:bg-accent/20 transition-colors ${
                            hasOverdue ? 'bg-red-50/30 dark:bg-red-950/20' : ''
                          }`}
                        >
                          <td className="p-2 sm:p-2.5 md:p-3 font-medium text-xs sm:text-sm">
                            <div className="flex flex-col sm:hidden">
                              <span className="truncate">{user.user_name}</span>
                              <span className="text-xs text-muted-foreground capitalize mt-0.5">
                                {user.user_role.replace('_', ' ')}
                              </span>
                            </div>
                            <span className="hidden sm:inline truncate">{user.user_name}</span>
                          </td>
                          <td className="p-2 sm:p-2.5 md:p-3 text-muted-foreground capitalize hidden sm:table-cell text-xs sm:text-sm">
                            {user.user_role.replace('_', ' ')}
                          </td>
                          <td className="p-2 sm:p-2.5 md:p-3 text-right font-medium text-xs sm:text-sm">{user.assigned_tasks}</td>
                          <td className={`p-2 sm:p-2.5 md:p-3 text-right font-semibold text-xs sm:text-sm ${hasOverdue ? 'text-red-700 dark:text-red-400' : ''}`}>
                            {user.overdue_tasks}
                          </td>
                          <td className="p-2 sm:p-2.5 md:p-3 text-right text-xs sm:text-sm">{user.tasks_waiting_review}</td>
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
