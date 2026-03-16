-- Migration 050: Allow approval for legacy/out-of-sync tasks
-- Extends approve_and_archive_task to accept tasks that are logically "Done"
-- (status='done' AND review_status IN ('pending_review','under_review'))
-- even when task_status was never set to 'Done' (e.g. from direct DB updates or legacy code).
-- This does NOT allow skipping lifecycle stages; it only fixes rows where task_status is out of sync.

CREATE OR REPLACE FUNCTION public.approve_and_archive_task(
  p_task_id UUID,
  p_user_id UUID,
  p_comments TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task tasks;
  v_can_approve BOOLEAN := FALSE;
BEGIN
  -- Validate that user is Super Admin
  IF NOT public.user_has_role(ARRAY['super_admin']) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Only Super Admin can approve and close tasks'
    );
  END IF;

  -- Get task
  SELECT * INTO v_task
  FROM tasks
  WHERE id = p_task_id
  AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Task not found or deleted'
    );
  END IF;

  -- Check if already Closed
  IF v_task.task_status = 'Closed' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Task is already Closed'
    );
  END IF;

  -- Allow approval when:
  -- 1. task_status = 'Done' (canonical path), OR
  -- 2. status = 'done' AND review_status IN ('pending_review', 'under_review') (legacy/out-of-sync)
  IF v_task.task_status = 'Done' THEN
    v_can_approve := TRUE;
  ELSIF v_task.status = 'done' AND v_task.review_status IN ('pending_review', 'under_review') THEN
    v_can_approve := TRUE;
  END IF;

  IF NOT v_can_approve THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Can only approve tasks in Done (Pending Review) state'
    );
  END IF;

  -- Approve and close in one operation
  UPDATE tasks
  SET
    task_status = 'Closed',
    reviewed_by = p_user_id,
    reviewed_at = NOW(),
    review_comments = p_comments,
    archived_at = NOW(),
    archived_by = p_user_id,
    updated_at = NOW()
  WHERE id = p_task_id;

  -- Log progress
  INSERT INTO task_progress_log (task_id, user_id, status, progress_note, created_by)
  VALUES (p_task_id, p_user_id, 'Closed', 'Task approved and closed', p_user_id);

  -- Trigger notification
  PERFORM public.create_review_completed_notification(p_task_id, p_user_id, 'reviewed_approved');

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Task approved and closed successfully'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION public.approve_and_archive_task(UUID, UUID, TEXT) IS 'Approves a review request and archives the task. Allows task_status=Done OR legacy (status=done AND review_status pending/under_review). Super Admin only.';
