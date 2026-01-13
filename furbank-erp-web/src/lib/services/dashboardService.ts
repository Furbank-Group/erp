import { supabase } from '@/lib/supabase/client';
import type { Task } from '@/lib/supabase/types';

/**
 * Dashboard Service
 * Provides role-specific dashboard statistics using efficient RPC functions
 */

export interface DashboardStats {
  // Super Admin specific
  totalProjects?: number;
  totalTasks?: number;
  taskStatusDistribution?: { status: string; count: number }[];
  
  // Admin specific
  activeProjects?: number;
  recentlyUpdatedTasks?: Task[];
  
  // Staff specific
  myTasks?: number;
  tasksAwaitingAction?: number;
  tasksSubmittedForReview?: number;
  
  // Common to all roles
  tasksDueToday: number;
  overdueTasks: number;
  tasksAwaitingReview: number;
}

/**
 * Get dashboard stats for super admin
 */
export async function getSuperAdminDashboardStats(): Promise<{
  data: DashboardStats | null;
  error: Error | null;
}> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { data: null, error: new Error('Not authenticated') };
    }

    const { data, error } = await supabase.rpc('get_dashboard_stats_super_admin', {
      p_user_id: user.id,
    });

    // If function doesn't exist, provide helpful error
    if (error) {
      const errorMessage = (error as any).message ?? '';
      if ((error as any).code === '42883' || errorMessage.includes('does not exist') || (error as any).status === 400) {
        return {
          data: null,
          error: new Error('Dashboard RPC functions not found. Please run migrations 007-010 in Supabase SQL Editor.'),
        };
      }
      return { data: null, error: error as Error };
    }

    const stats = data as {
      total_projects: number;
      total_tasks: number;
      tasks_due_today: number;
      overdue_tasks: number;
      tasks_awaiting_review: number;
      task_status_distribution: { status: string; count: number }[];
    };

    return {
      data: {
        totalProjects: stats.total_projects,
        totalTasks: stats.total_tasks,
        tasksDueToday: stats.tasks_due_today,
        overdueTasks: stats.overdue_tasks,
        tasksAwaitingReview: stats.tasks_awaiting_review,
        taskStatusDistribution: stats.task_status_distribution,
      },
      error: null,
    };
  } catch (error) {
    return { data: null, error: error as Error };
  }
}

/**
 * Get dashboard stats for admin
 */
export async function getAdminDashboardStats(): Promise<{
  data: DashboardStats | null;
  error: Error | null;
}> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { data: null, error: new Error('Not authenticated') };
    }

    const { data, error } = await supabase.rpc('get_dashboard_stats_admin', {
      p_user_id: user.id,
    });

    // If function doesn't exist, provide helpful error
    if (error) {
      const errorMessage = (error as any).message ?? '';
      if ((error as any).code === '42883' || errorMessage.includes('does not exist') || (error as any).status === 400) {
        return {
          data: null,
          error: new Error('Dashboard RPC functions not found. Please run migrations 007-010 in Supabase SQL Editor.'),
        };
      }
      return { data: null, error: error as Error };
    }

    const stats = data as {
      active_projects: number;
      tasks_due_today: number;
      overdue_tasks: number;
      tasks_awaiting_review: number;
      recently_updated_tasks: Array<{
        id: string;
        title: string;
        status: string;
        updated_at: string;
      }>;
    };

    // Fetch full task details for recently updated tasks
    const taskIds = stats.recently_updated_tasks.map((t) => t.id);
    let recentlyUpdatedTasks: Task[] = [];

    if (taskIds.length > 0) {
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .in('id', taskIds);

      if (!tasksError && tasksData) {
        // Preserve order from RPC result
        const taskMap = new Map(tasksData.map((t) => [t.id, t]));
        recentlyUpdatedTasks = stats.recently_updated_tasks
          .map((t) => taskMap.get(t.id))
          .filter((t): t is Task => t !== undefined);
      }
    }

    return {
      data: {
        activeProjects: stats.active_projects,
        tasksDueToday: stats.tasks_due_today,
        overdueTasks: stats.overdue_tasks,
        tasksAwaitingReview: stats.tasks_awaiting_review,
        recentlyUpdatedTasks,
      },
      error: null,
    };
  } catch (error) {
    return { data: null, error: error as Error };
  }
}

/**
 * Get dashboard stats for staff
 */
export async function getStaffDashboardStats(): Promise<{
  data: DashboardStats | null;
  error: Error | null;
}> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { data: null, error: new Error('Not authenticated') };
    }

    // Try RPC function first
    const { data, error } = await supabase.rpc('get_dashboard_stats_staff', {
      p_user_id: user.id,
    });

    // If function doesn't exist (migrations not run) or user doesn't exist in users table, fall back to direct queries
    if (error) {
      const errorMessage = (error as any).message ?? '';
      const errorCode = (error as any).code ?? '';
      
      // Check for various error conditions that indicate we should use fallback
      if (
        errorCode === '42883' || // Function does not exist
        errorMessage.includes('does not exist') ||
        errorMessage.includes('User does not exist') ||
        errorCode === 'P0001' || // PostgreSQL exception (like our RAISE EXCEPTION)
        (error as any).status === 400 // Bad request (function might not exist)
      ) {
        console.warn('RPC function not available, using fallback queries:', errorMessage);
        return await getStaffDashboardStatsFallback(user.id);
      }
      
      return { data: null, error: error as Error };
    }

    const stats = data as {
      my_tasks: number;
      tasks_due_today: number;
      overdue_tasks: number;
      tasks_awaiting_action: number;
      tasks_submitted_for_review: number;
    };

    return {
      data: {
        myTasks: stats.my_tasks,
        tasksDueToday: stats.tasks_due_today,
        overdueTasks: stats.overdue_tasks,
        tasksAwaitingAction: stats.tasks_awaiting_action,
        tasksSubmittedForReview: stats.tasks_submitted_for_review,
        tasksAwaitingReview: 0, // Not applicable for staff
      },
      error: null,
    };
  } catch (error) {
    return { data: null, error: error as Error };
  }
}

/**
 * Fallback function for staff dashboard stats using direct queries
 * Used when RPC functions don't exist (migrations not run)
 */
async function getStaffDashboardStatsFallback(userId: string): Promise<{
  data: DashboardStats | null;
  error: Error | null;
}> {
  try {
    // My tasks (assigned to me)
    const { count: myTasks } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('assigned_to', userId);

    // Tasks due today
    const today = new Date().toISOString().split('T')[0];
    const { count: tasksDueToday } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('assigned_to', userId)
      .not('due_date', 'is', null)
      .neq('status', 'done')
      .gte('due_date', `${today}T00:00:00`)
      .lte('due_date', `${today}T23:59:59`);

    // Overdue tasks
    const now = new Date().toISOString();
    const { count: overdueTasks } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('assigned_to', userId)
      .not('due_date', 'is', null)
      .neq('status', 'done')
      .lt('due_date', now);

    // Tasks awaiting action
    const { count: tasksAwaitingAction } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('assigned_to', userId)
      .not('status', 'in', '(done,blocked)');

    // Tasks submitted for review (if review_status column exists)
    let tasksSubmittedForReview = 0;
    try {
      const { count } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('review_requested_by', userId)
        .eq('review_status', 'waiting_for_review');
      tasksSubmittedForReview = count ?? 0;
    } catch {
      // Column might not exist if migrations not run
      tasksSubmittedForReview = 0;
    }

    return {
      data: {
        myTasks: myTasks ?? 0,
        tasksDueToday: tasksDueToday ?? 0,
        overdueTasks: overdueTasks ?? 0,
        tasksAwaitingAction: tasksAwaitingAction ?? 0,
        tasksSubmittedForReview,
        tasksAwaitingReview: 0,
      },
      error: null,
    };
  } catch (error) {
    return { data: null, error: error as Error };
  }
}
