-- Migration 055: User Performance Metrics Update
-- Redefines user performance metrics RPCs to explicitly handle approved, rejected, and failed tasks
-- and fixes bugs related to the new canonical task lifecycle where failed tasks were counted as completed.

-- ============================================
-- 1. Helper Function: Get User Task Counts
-- ============================================
-- Note: We have to drop the existing function because we are changing the return record type
DROP FUNCTION IF EXISTS public.get_user_task_counts(UUID);

CREATE OR REPLACE FUNCTION public.get_user_task_counts(
  p_user_id UUID
)
RETURNS TABLE(
  total_assigned BIGINT,
  total_completed BIGINT,
  total_failed BIGINT,
  total_rejected BIGINT,
  total_pending BIGINT,
  total_in_progress BIGINT,
  total_pending_review BIGINT,
  total_archived BIGINT,
  completion_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_assigned BIGINT := 0;
  v_total_completed BIGINT := 0;
  v_total_failed BIGINT := 0;
  v_total_rejected BIGINT := 0;
  v_total_pending BIGINT := 0;
  v_total_in_progress BIGINT := 0;
  v_total_pending_review BIGINT := 0;
  v_total_archived BIGINT := 0;
  v_completion_rate NUMERIC := 0;
BEGIN
  -- Count all tasks assigned to user
  SELECT COUNT(DISTINCT t.id) INTO v_total_assigned
  FROM tasks t
  WHERE t.deleted_at IS NULL
    AND (
      EXISTS (
        SELECT 1 FROM task_assignees ta
        WHERE ta.task_id = t.id
        AND ta.user_id = p_user_id
      )
      OR t.assigned_to = p_user_id
    );

  -- Count successfully completed tasks (Done or Closed, but NOT failed)
  SELECT COUNT(DISTINCT t.id) INTO v_total_completed
  FROM tasks t
  WHERE t.deleted_at IS NULL
    AND (
      EXISTS (
        SELECT 1 FROM task_assignees ta
        WHERE ta.task_id = t.id
        AND ta.user_id = p_user_id
      )
      OR t.assigned_to = p_user_id
    )
    AND (
      (t.task_status = 'Done') 
      OR (t.task_status = 'Closed' AND (t.closed_reason IS NULL OR t.closed_reason != 'failed'))
    );

  -- Count failed tasks (Closed with reason 'failed')
  SELECT COUNT(DISTINCT t.id) INTO v_total_failed
  FROM tasks t
  WHERE t.deleted_at IS NULL
    AND (
      EXISTS (
        SELECT 1 FROM task_assignees ta
        WHERE ta.task_id = t.id
        AND ta.user_id = p_user_id
      )
      OR t.assigned_to = p_user_id
    )
    AND t.task_status = 'Closed' 
    AND t.closed_reason = 'failed';

  -- Count rejected tasks (How many distinct tasks had a 'changes_requested' event for this user)
  -- Based on the task_progress_log since review_status is deprecated
  SELECT COUNT(DISTINCT pl.task_id) INTO v_total_rejected
  FROM task_progress_log pl
  JOIN tasks t ON pl.task_id = t.id
  WHERE t.deleted_at IS NULL
    AND pl.progress_note LIKE 'Review rejected - returned to Work-In-Progress%'
    AND (
      EXISTS (
        SELECT 1 FROM task_assignees ta
        WHERE ta.task_id = t.id
        AND ta.user_id = p_user_id
      )
      OR t.assigned_to = p_user_id
    );

  -- Count pending tasks (status = 'ToDo')
  SELECT COUNT(DISTINCT t.id) INTO v_total_pending
  FROM tasks t
  WHERE t.deleted_at IS NULL
    AND t.task_status = 'ToDo'
    AND (
      EXISTS (
        SELECT 1 FROM task_assignees ta
        WHERE ta.task_id = t.id
        AND ta.user_id = p_user_id
      )
      OR t.assigned_to = p_user_id
    );

  -- Count in progress tasks
  SELECT COUNT(DISTINCT t.id) INTO v_total_in_progress
  FROM tasks t
  WHERE t.deleted_at IS NULL
    AND t.task_status = 'Work-In-Progress'
    AND (
      EXISTS (
        SELECT 1 FROM task_assignees ta
        WHERE ta.task_id = t.id
        AND ta.user_id = p_user_id
      )
      OR t.assigned_to = p_user_id
    );

  -- Count pending review tasks
  SELECT COUNT(DISTINCT t.id) INTO v_total_pending_review
  FROM tasks t
  WHERE t.deleted_at IS NULL
    AND t.task_status = 'Done'
    AND (
      EXISTS (
        SELECT 1 FROM task_assignees ta
        WHERE ta.task_id = t.id
        AND ta.user_id = p_user_id
      )
      OR t.assigned_to = p_user_id
    );

  -- Count archived/closed tasks
  SELECT COUNT(DISTINCT t.id) INTO v_total_archived
  FROM tasks t
  WHERE t.deleted_at IS NULL
    AND t.task_status = 'Closed'
    AND (
      EXISTS (
        SELECT 1 FROM task_assignees ta
        WHERE ta.task_id = t.id
        AND ta.user_id = p_user_id
      )
      OR t.assigned_to = p_user_id
    );

  -- Calculate completion rate: successful completions / (successful + failed)
  -- Or just out of all assigned tasks that reach a terminal state (Done/Closed)
  IF (v_total_completed + v_total_failed) > 0 THEN
    v_completion_rate := ROUND((v_total_completed::NUMERIC / (v_total_completed + v_total_failed)::NUMERIC) * 100, 2);
  END IF;

  RETURN QUERY SELECT
    v_total_assigned,
    v_total_completed,
    v_total_failed,
    v_total_rejected,
    v_total_pending,
    v_total_in_progress,
    v_total_pending_review,
    v_total_archived,
    v_completion_rate;
END;
$$;


-- ============================================
-- 2. Function: Get User Performance Summary
-- ============================================
CREATE OR REPLACE FUNCTION public.get_user_performance_summary(
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task_counts RECORD;
  v_avg_completion_time INTERVAL;
  v_on_time_count BIGINT := 0;
  v_overdue_count BIGINT := 0;
  v_timeliness_rate NUMERIC := 0;
  v_review_approval_rate NUMERIC := 0;
  v_reviewed_count BIGINT := 0;
  v_approved_count BIGINT := 0;
  v_this_week_completed BIGINT := 0;
  v_last_week_completed BIGINT := 0;
  v_week_over_week_change NUMERIC := 0;
  v_result JSONB;
BEGIN
  -- Get task counts
  SELECT * INTO v_task_counts
  FROM public.get_user_task_counts(p_user_id);

  -- Calculate average completion time (for successfully completed tasks)
  -- This is the time from creation to when status changed to 'Done' or 'Closed'
  SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (
    COALESCE(t.reviewed_at, COALESCE(t.archived_at, t.updated_at)) - t.created_at
  ))), 0) INTO v_avg_completion_time
  FROM tasks t
  WHERE t.deleted_at IS NULL
    AND (
      EXISTS (
        SELECT 1 FROM task_assignees ta
        WHERE ta.task_id = t.id
        AND ta.user_id = p_user_id
      )
      OR t.assigned_to = p_user_id
    )
    AND (
      (t.task_status = 'Done') 
      OR (t.task_status = 'Closed' AND (t.closed_reason IS NULL OR t.closed_reason != 'failed'))
    );

  -- Count on-time vs overdue tasks
  -- On-time: successfully completed before or on due_date
  SELECT COUNT(DISTINCT t.id) INTO v_on_time_count
  FROM tasks t
  WHERE t.deleted_at IS NULL
    AND t.due_date IS NOT NULL
    AND (
      EXISTS (
        SELECT 1 FROM task_assignees ta
        WHERE ta.task_id = t.id
        AND ta.user_id = p_user_id
      )
      OR t.assigned_to = p_user_id
    )
    AND (
      (t.task_status = 'Done') 
      OR (t.task_status = 'Closed' AND (t.closed_reason IS NULL OR t.closed_reason != 'failed'))
    )
    AND (
      COALESCE(t.reviewed_at, COALESCE(t.archived_at, t.updated_at)) <= t.due_date
    );

  -- Overdue: successfully completed after due_date OR active but past due_date OR failed past due date (all overdues)
  SELECT COUNT(DISTINCT t.id) INTO v_overdue_count
  FROM tasks t
  WHERE t.deleted_at IS NULL
    AND t.due_date IS NOT NULL
    AND (
      EXISTS (
        SELECT 1 FROM task_assignees ta
        WHERE ta.task_id = t.id
        AND ta.user_id = p_user_id
      )
      OR t.assigned_to = p_user_id
    )
    AND (
      -- Was completed late
      (
        ((t.task_status = 'Done') OR (t.task_status = 'Closed'))
        AND COALESCE(t.reviewed_at, COALESCE(t.archived_at, t.updated_at)) > t.due_date
      )
      OR
      -- Is currently active and overdue
      (
        t.task_status IN ('ToDo', 'Work-In-Progress')
        AND NOW() > t.due_date
      )
    );

  -- Calculate timeliness rate
  IF (v_on_time_count + v_overdue_count) > 0 THEN
    v_timeliness_rate := ROUND((v_on_time_count::NUMERIC / (v_on_time_count + v_overdue_count)::NUMERIC) * 100, 2);
  END IF;

  -- Calculate review approval rate
  -- Total reviewed count = distinct tasks that had ANY review action (approved, rejected, or failed)
  SELECT COUNT(DISTINCT t.id) INTO v_reviewed_count
  FROM tasks t
  WHERE t.deleted_at IS NULL
    AND (
      -- Was approved or failed
      t.task_status = 'Closed'
      OR 
      -- Was rejected at least once
      EXISTS (
        SELECT 1 FROM task_progress_log pl 
        WHERE pl.task_id = t.id AND pl.progress_note LIKE 'Review rejected - returned to Work-In-Progress%'
      )
    )
    AND (
      EXISTS (
        SELECT 1 FROM task_assignees ta
        WHERE ta.task_id = t.id
        AND ta.user_id = p_user_id
      )
      OR t.assigned_to = p_user_id
    );

  -- Total approved count = distinct tasks that were approved
  SELECT COUNT(DISTINCT t.id) INTO v_approved_count
  FROM tasks t
  WHERE t.deleted_at IS NULL
    AND t.task_status = 'Closed'
    AND (t.closed_reason IS NULL OR t.closed_reason != 'failed')
    AND (
      EXISTS (
        SELECT 1 FROM task_assignees ta
        WHERE ta.task_id = t.id
        AND ta.user_id = p_user_id
      )
      OR t.assigned_to = p_user_id
    );

  IF v_reviewed_count > 0 THEN
    v_review_approval_rate := ROUND((v_approved_count::NUMERIC / v_reviewed_count::NUMERIC) * 100, 2);
  END IF;

  -- Calculate weekly completion stats
  -- This week (Monday to Sunday of current week)
  SELECT COUNT(DISTINCT t.id) INTO v_this_week_completed
  FROM tasks t
  WHERE t.deleted_at IS NULL
    AND (
      EXISTS (
        SELECT 1 FROM task_assignees ta
        WHERE ta.task_id = t.id
        AND ta.user_id = p_user_id
      )
      OR t.assigned_to = p_user_id
    )
    AND (
      (t.task_status = 'Done' AND t.updated_at >= date_trunc('week', CURRENT_DATE))
      OR (t.task_status = 'Closed' AND (t.closed_reason IS NULL OR t.closed_reason != 'failed') AND t.archived_at >= date_trunc('week', CURRENT_DATE))
    );

  -- Last week
  SELECT COUNT(DISTINCT t.id) INTO v_last_week_completed
  FROM tasks t
  WHERE t.deleted_at IS NULL
    AND (
      EXISTS (
        SELECT 1 FROM task_assignees ta
        WHERE ta.task_id = t.id
        AND ta.user_id = p_user_id
      )
      OR t.assigned_to = p_user_id
    )
    AND (
      (t.task_status = 'Done' 
        AND t.updated_at >= date_trunc('week', CURRENT_DATE) - INTERVAL '1 week'
        AND t.updated_at < date_trunc('week', CURRENT_DATE))
      OR (t.task_status = 'Closed' AND (t.closed_reason IS NULL OR t.closed_reason != 'failed')
        AND t.archived_at >= date_trunc('week', CURRENT_DATE) - INTERVAL '1 week'
        AND t.archived_at < date_trunc('week', CURRENT_DATE))
    );

  -- Calculate week-over-week change
  IF v_last_week_completed > 0 THEN
    v_week_over_week_change := ROUND(((v_this_week_completed::NUMERIC - v_last_week_completed::NUMERIC) / v_last_week_completed::NUMERIC) * 100, 2);
  ELSIF v_this_week_completed > 0 THEN
    v_week_over_week_change := 100; -- 100% increase from 0
  END IF;

  -- Build result JSON
  v_result := jsonb_build_object(
    'task_counts', jsonb_build_object(
      'total_assigned', v_task_counts.total_assigned,
      'total_completed', v_task_counts.total_completed,
      'total_failed', v_task_counts.total_failed,
      'total_rejected', v_task_counts.total_rejected,
      'total_pending', v_task_counts.total_pending,
      'total_in_progress', v_task_counts.total_in_progress,
      'total_pending_review', v_task_counts.total_pending_review,
      'total_archived', v_task_counts.total_archived,
      'completion_rate', v_task_counts.completion_rate
    ),
    'avg_completion_time_seconds', EXTRACT(EPOCH FROM v_avg_completion_time),
    'timeliness', jsonb_build_object(
      'on_time_count', v_on_time_count,
      'overdue_count', v_overdue_count,
      'timeliness_rate', v_timeliness_rate
    ),
    'review_metrics', jsonb_build_object(
      'reviewed_count', v_reviewed_count,
      'approved_count', v_approved_count,
      'approval_rate', v_review_approval_rate
    ),
    'weekly_stats', jsonb_build_object(
      'this_week_completed', v_this_week_completed,
      'last_week_completed', v_last_week_completed,
      'week_over_week_change', v_week_over_week_change
    )
  );

  RETURN v_result;
END;
$$;


-- ============================================
-- 3. Function: Calculate Productivity Score
-- ============================================
CREATE OR REPLACE FUNCTION public.calculate_productivity_score(
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_performance JSONB;
  v_task_counts RECORD;
  v_completion_rate NUMERIC := 0;
  v_timeliness_rate NUMERIC := 0;
  v_consistency_score NUMERIC := 0;
  v_review_approval_rate NUMERIC := 0;
  v_productivity_score NUMERIC := 0;
  v_weekly_trends JSONB;
  v_weeks_with_activity INTEGER := 0;
  v_total_weeks INTEGER := 8;
  v_result JSONB;
BEGIN
  -- Get performance summary
  SELECT public.get_user_performance_summary(p_user_id) INTO v_performance;

  -- Extract metrics
  v_completion_rate := COALESCE((v_performance->'task_counts'->>'completion_rate')::NUMERIC, 0);
  v_timeliness_rate := COALESCE((v_performance->'timeliness'->>'timeliness_rate')::NUMERIC, 0);
  v_review_approval_rate := COALESCE((v_performance->'review_metrics'->>'approval_rate')::NUMERIC, 0);

  -- Calculate consistency (weeks with activity in last 8 weeks)
  SELECT public.get_user_weekly_trends(p_user_id, 8) INTO v_weekly_trends;
  
  SELECT COUNT(*) INTO v_weeks_with_activity
  FROM jsonb_array_elements(v_weekly_trends) week
  WHERE (week->>'completed_count')::BIGINT > 0;

  -- Consistency score: percentage of weeks with activity
  IF v_total_weeks > 0 THEN
    v_consistency_score := (v_weeks_with_activity::NUMERIC / v_total_weeks::NUMERIC) * 100;
  END IF;

  -- Calculate weighted productivity score
  -- New Weights: Completion Rate (35%), Timeliness (25%), Quality/Approval (25%), Consistency (15%)
  v_productivity_score := 
    (v_completion_rate * 0.35) +
    (v_timeliness_rate * 0.25) +
    (v_review_approval_rate * 0.25) +
    (v_consistency_score * 0.15);

  -- Normalize to 0-100
  v_productivity_score := LEAST(100, GREATEST(0, ROUND(v_productivity_score, 2)));

  -- Build result with breakdown
  v_result := jsonb_build_object(
    'productivity_score', v_productivity_score,
    'breakdown', jsonb_build_object(
      'completion_rate', jsonb_build_object(
        'value', v_completion_rate,
        'weight', 35,
        'contribution', ROUND(v_completion_rate * 0.35, 2)
      ),
      'timeliness', jsonb_build_object(
        'value', v_timeliness_rate,
        'weight', 25,
        'contribution', ROUND(v_timeliness_rate * 0.25, 2)
      ),
      'consistency', jsonb_build_object(
        'value', v_consistency_score,
        'weight', 15,
        'contribution', ROUND(v_consistency_score * 0.15, 2)
      ),
      'review_approval', jsonb_build_object(
        'value', v_review_approval_rate,
        'weight', 25,
        'contribution', ROUND(v_review_approval_rate * 0.25, 2)
      )
    )
  );

  RETURN v_result;
END;
$$;
