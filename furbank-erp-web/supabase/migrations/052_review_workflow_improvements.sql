-- Migration 052: Review Workflow Improvements
-- 1. Fix reject_review_and_reopen: save review_requested_by before NULLing,
--    insert review comment as task_comment, notify all assignees
-- 2. Fix approve_and_archive_task: insert review comment as task_comment,
--    notify all assignees
-- 3. Update create_review_completed_notification: notify all task assignees

-- ============================================
-- 1. Update create_review_completed_notification to notify all assignees
-- ============================================
CREATE OR REPLACE FUNCTION create_review_completed_notification(
  p_task_id UUID,
  p_reviewed_by UUID,
  p_status TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task_title VARCHAR(255);
  v_message TEXT;
  v_recipient_id UUID;
BEGIN
  -- Get task details
  SELECT title INTO v_task_title
  FROM tasks
  WHERE id = p_task_id;

  -- Build message based on status
  IF p_status = 'reviewed_approved' THEN
    v_message := 'Task "' || COALESCE(v_task_title, 'Untitled Task') || '" has been approved and closed';
  ELSIF p_status = 'changes_requested' THEN
    v_message := 'Changes have been requested for task "' || COALESCE(v_task_title, 'Untitled Task') || '"';
  ELSE
    RETURN NULL;
  END IF;

  -- Notify all assigned users (from task_assignees table)
  FOR v_recipient_id IN
    SELECT DISTINCT ta.user_id
    FROM task_assignees ta
    WHERE ta.task_id = p_task_id
      AND ta.user_id != p_reviewed_by  -- Don't notify the reviewer
  LOOP
    INSERT INTO notifications (
      recipient_user_id,
      type,
      title,
      message,
      related_entity_type,
      related_entity_id
    ) VALUES (
      v_recipient_id,
      'review_completed',
      CASE WHEN p_status = 'reviewed_approved' THEN 'Task Approved' ELSE 'Changes Requested' END,
      v_message,
      'task',
      p_task_id
    );
  END LOOP;

  -- Also notify the legacy assigned_to user if not already in task_assignees
  FOR v_recipient_id IN
    SELECT t.assigned_to
    FROM tasks t
    WHERE t.id = p_task_id
      AND t.assigned_to IS NOT NULL
      AND t.assigned_to != p_reviewed_by
      AND NOT EXISTS (
        SELECT 1 FROM task_assignees ta
        WHERE ta.task_id = p_task_id AND ta.user_id = t.assigned_to
      )
  LOOP
    INSERT INTO notifications (
      recipient_user_id,
      type,
      title,
      message,
      related_entity_type,
      related_entity_id
    ) VALUES (
      v_recipient_id,
      'review_completed',
      CASE WHEN p_status = 'reviewed_approved' THEN 'Task Approved' ELSE 'Changes Requested' END,
      v_message,
      'task',
      p_task_id
    );
  END LOOP;

  RETURN NULL; -- Multiple notifications created
END;
$$;

-- ============================================
-- 2. Update reject_review_and_reopen
-- ============================================
CREATE OR REPLACE FUNCTION public.reject_review_and_reopen(
  p_task_id UUID,
  p_user_id UUID,
  p_comments TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task tasks;
BEGIN
  -- Validate that user is Super Admin
  IF NOT public.user_has_role(ARRAY['super_admin']) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Only Super Admin can reject reviews'
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

  -- Only allow rejection from Done state
  IF v_task.task_status != 'Done' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Can only reject reviews for tasks in Done (Pending Review) state'
    );
  END IF;

  -- Insert review comment as a task_comment so it shows in the comments section
  IF p_comments IS NOT NULL AND TRIM(p_comments) != '' THEN
    INSERT INTO task_comments (task_id, user_id, content)
    VALUES (p_task_id, p_user_id, '[Changes Requested] ' || p_comments);
  END IF;

  -- Trigger notification BEFORE nullifying review_requested_by
  PERFORM public.create_review_completed_notification(p_task_id, p_user_id, 'changes_requested');

  -- Reject review and return to Work-In-Progress
  UPDATE tasks
  SET
    task_status = 'Work-In-Progress',
    reviewed_by = p_user_id,
    reviewed_at = NOW(),
    review_comments = p_comments,
    review_requested_at = NULL,
    review_requested_by = NULL,
    updated_at = NOW()
  WHERE id = p_task_id;

  -- Log progress
  INSERT INTO task_progress_log (task_id, user_id, status, progress_note, created_by)
  VALUES (p_task_id, p_user_id, 'Work-In-Progress', 'Review rejected - returned to Work-In-Progress', p_user_id);

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Review rejected and task returned to Work-In-Progress'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- ============================================
-- 3. Update approve_and_archive_task
-- ============================================
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

  -- Insert review comment as a task_comment so it shows in the comments section
  IF p_comments IS NOT NULL AND TRIM(p_comments) != '' THEN
    INSERT INTO task_comments (task_id, user_id, content)
    VALUES (p_task_id, p_user_id, '[Approved] ' || p_comments);
  END IF;

  -- Trigger notification BEFORE updating the task
  PERFORM public.create_review_completed_notification(p_task_id, p_user_id, 'reviewed_approved');

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

COMMENT ON FUNCTION public.reject_review_and_reopen(UUID, UUID, TEXT) IS 'Rejects a review, inserts review comment as task_comment, notifies all assignees, and returns task to Work-In-Progress. Super Admin only.';
COMMENT ON FUNCTION public.approve_and_archive_task(UUID, UUID, TEXT) IS 'Approves a review, inserts review comment as task_comment, notifies all assignees, and archives the task. Super Admin only.';
COMMENT ON FUNCTION public.create_review_completed_notification(UUID, UUID, TEXT) IS 'Creates review completed notifications for all task assignees (via task_assignees table and legacy assigned_to).';
