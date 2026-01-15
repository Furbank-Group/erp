import { supabase } from '@/lib/supabase/client';
import { TaskStatus } from '@/lib/supabase/types';

/**
 * Task Progress Service
 * Handles append-only progress logging for tasks
 */

export interface TaskProgressLog {
  id: string;
  task_id: string;
  user_id: string;
  status: string;
  progress_note: string | null;
  created_at: string;
  created_by: string | null;
}

/**
 * Add a progress log entry (append-only)
 */
export async function addProgressLog(
  taskId: string,
  userId: string,
  status: TaskStatus,
  progressNote?: string
): Promise<{ error: Error | null }> {
  try {
    // First, update the task status
    const { error: statusError } = await ((supabase
      .from('tasks') as any)
      .update({ status })
      .eq('id', taskId) as any);

    if (statusError) {
      return { error: statusError as Error };
    }

    // Then, create a progress log entry
    const { error: logError } = await ((supabase
      .from('task_progress_log') as any)
      .insert({
        task_id: taskId,
        user_id: userId,
        status,
        progress_note: progressNote ?? null,
        created_by: userId,
      }) as any);

    if (logError) {
      return { error: logError as Error };
    }

    return { error: null };
  } catch (error) {
    return { error: error as Error };
  }
}

/**
 * Get progress log entries for a task
 */
export async function getProgressLogs(
  taskId: string
): Promise<{ data: TaskProgressLog[] | null; error: Error | null }> {
  try {
    const { data, error } = await ((supabase
      .from('task_progress_log') as any)
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true }) as any);

    if (error) {
      return { data: null, error: error as Error };
    }

    return { data: data as TaskProgressLog[], error: null };
  } catch (error) {
    return { data: null, error: error as Error };
  }
}
