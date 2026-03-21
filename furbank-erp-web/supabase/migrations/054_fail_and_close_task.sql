-- Migration to add fail_and_close_task RPC
-- This allows taking a task from Done to Closed with a failed reason

CREATE OR REPLACE FUNCTION public.fail_and_close_task(
  p_task_id UUID,
  p_user_id UUID,
  p_comments TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update the task status and metadata
  UPDATE public.tasks
  SET 
    task_status = 'Closed',
    closed_reason = 'failed',
    reviewed_by = p_user_id,
    reviewed_at = NOW(),
    review_comments = p_comments,
    archived_at = NOW(),
    archived_by = p_user_id,
    updated_at = NOW()
  WHERE id = p_task_id;

  -- Create a system comment for history
  INSERT INTO public.task_comments (task_id, user_id, content, created_at)
  VALUES (p_task_id, p_user_id, 'TASK FAILED: ' || p_comments, NOW());

  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
