import { supabase } from '@/lib/supabase/client';
import { TaskReviewStatus } from '@/lib/supabase/types';

/**
 * Task Review Service
 * Handles task review workflow operations
 */

/**
 * Request review for a task
 */
export async function requestReview(
  taskId: string,
  userId: string
): Promise<{ error: Error | null }> {
  try {
    // Update task review status
    const { error: updateError } = await ((supabase
      .from('tasks') as any)
      .update({
        review_status: TaskReviewStatus.WAITING_FOR_REVIEW,
        review_requested_by: userId,
      })
      .eq('id', taskId) as any);

    if (updateError) {
      return { error: updateError as Error };
    }

    // Trigger notification via database function
    // @ts-expect-error - Supabase type inference issue with strict TypeScript
    const { error: notifyError } = await supabase.rpc('create_review_requested_notification', {
      p_task_id: taskId,
      p_requested_by: userId,
    });

    if (notifyError) {
      console.error('Error creating review notification:', notifyError);
      // Don't fail the request if notification fails
    }

    return { error: null };
  } catch (error) {
    return { error: error as Error };
  }
}

/**
 * Approve a task
 */
export async function approveTask(
  taskId: string,
  userId: string,
  comments?: string
): Promise<{ error: Error | null }> {
  try {
    // Update task review status
    const { error: updateError } = await ((supabase
      .from('tasks') as any)
      .update({
        review_status: TaskReviewStatus.REVIEWED_APPROVED,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        review_comments: comments ?? null,
      })
      .eq('id', taskId) as any);

    if (updateError) {
      return { error: updateError as Error };
    }

    // Trigger notification via database function
    // @ts-expect-error - Supabase type inference issue with strict TypeScript
    const { error: notifyError } = await supabase.rpc('create_review_completed_notification', {
      p_task_id: taskId,
      p_reviewed_by: userId,
      p_status: TaskReviewStatus.REVIEWED_APPROVED,
    });

    if (notifyError) {
      console.error('Error creating review notification:', notifyError);
      // Don't fail the request if notification fails
    }

    return { error: null };
  } catch (error) {
    return { error: error as Error };
  }
}

/**
 * Request changes for a task
 */
export async function requestChanges(
  taskId: string,
  userId: string,
  comments: string
): Promise<{ error: Error | null }> {
  try {
    if (!comments || comments.trim().length === 0) {
      return { error: new Error('Comments are required when requesting changes') };
    }

    // Update task review status
    const { error: updateError } = await ((supabase
      .from('tasks') as any)
      .update({
        review_status: TaskReviewStatus.CHANGES_REQUESTED,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        review_comments: comments,
      })
      .eq('id', taskId) as any);

    if (updateError) {
      return { error: updateError as Error };
    }

    // Trigger notification via database function
    // @ts-expect-error - Supabase type inference issue with strict TypeScript
    const { error: notifyError } = await supabase.rpc('create_review_completed_notification', {
      p_task_id: taskId,
      p_reviewed_by: userId,
      p_status: TaskReviewStatus.CHANGES_REQUESTED,
    });

    if (notifyError) {
      console.error('Error creating review notification:', notifyError);
      // Don't fail the request if notification fails
    }

    return { error: null };
  } catch (error) {
    return { error: error as Error };
  }
}

/**
 * Reset review status (e.g., when task is updated after changes requested)
 */
export async function resetReviewStatus(taskId: string): Promise<{ error: Error | null }> {
  try {
    const { error } = await ((supabase
      .from('tasks') as any)
      .update({
        review_status: TaskReviewStatus.NONE,
        review_requested_by: null,
        reviewed_by: null,
        reviewed_at: null,
        review_comments: null,
      })
      .eq('id', taskId) as any);

    if (error) {
      return { error: error as Error };
    }

    return { error: null };
  } catch (error) {
    return { error: error as Error };
  }
}
