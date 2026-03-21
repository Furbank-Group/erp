-- Migration 051: Fix Done → Work-In-Progress transition
-- The validate_task_status_transition function was missing the Done → Work-In-Progress
-- transition that the reject_review_and_reopen function needs.
-- When a Super Admin requests changes on a Done task, the trigger was blocking
-- the transition because it wasn't in the allowed list.

-- ============================================
-- 1. Fix the validation function to allow Done → Work-In-Progress for Super Admin
-- ============================================
CREATE OR REPLACE FUNCTION public.validate_task_status_transition(
  p_old_status VARCHAR(50),
  p_new_status VARCHAR(50),
  p_user_role VARCHAR(50)
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Super Admin can reopen Closed tasks
  IF p_old_status = 'Closed' AND p_new_status = 'Work-In-Progress' THEN
    RETURN p_user_role = 'super_admin';
  END IF;

  -- Standard transitions (allowed for all users)
  IF p_old_status = 'ToDo' AND p_new_status = 'Work-In-Progress' THEN
    RETURN true;
  END IF;

  IF p_old_status = 'Work-In-Progress' AND p_new_status = 'Done' THEN
    RETURN true;
  END IF;

  -- Super Admin transitions from Done
  IF p_old_status = 'Done' AND p_new_status = 'Closed' THEN
    RETURN p_user_role = 'super_admin'; -- Only Super Admin can approve
  END IF;

  IF p_old_status = 'Done' AND p_new_status = 'Work-In-Progress' THEN
    RETURN p_user_role = 'super_admin'; -- Only Super Admin can request changes
  END IF;

  -- No other transitions allowed
  RETURN false;
END;
$$;

-- ============================================
-- 2. Update the trigger error message to include the new transition
-- ============================================
CREATE OR REPLACE FUNCTION enforce_task_lifecycle_transitions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_role VARCHAR(50);
  v_transition_allowed BOOLEAN;
BEGIN
  -- Only enforce if task_status is being changed
  IF OLD.task_status IS DISTINCT FROM NEW.task_status THEN
    -- Get user role
    SELECT r.name INTO v_user_role
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = auth.uid();

    -- Validate transition
    v_transition_allowed := public.validate_task_status_transition(
      OLD.task_status,
      NEW.task_status,
      COALESCE(v_user_role, 'user')
    );

    IF NOT v_transition_allowed THEN
      RAISE EXCEPTION 'Invalid task status transition from % to %. Only allowed transitions: ToDo->Work-In-Progress, Work-In-Progress->Done, Done->Closed (Super Admin only), Done->Work-In-Progress (Super Admin only), Closed->Work-In-Progress (Super Admin only)',
        OLD.task_status, NEW.task_status;
    END IF;

    -- Enforce lifecycle rules
    -- 1. Closed tasks must have archived_at set
    IF NEW.task_status = 'Closed' AND NEW.archived_at IS NULL THEN
      NEW.archived_at := NOW();
      NEW.archived_by := auth.uid();
    END IF;

    -- 2. Non-Closed tasks must not have archived_at
    IF NEW.task_status != 'Closed' AND NEW.archived_at IS NOT NULL THEN
      NEW.archived_at := NULL;
      NEW.archived_by := NULL;
    END IF;

    -- 3. Done status requires review_requested_at
    IF NEW.task_status = 'Done' AND NEW.review_requested_at IS NULL THEN
      NEW.review_requested_at := NOW();
      NEW.review_requested_by := auth.uid();
    END IF;

    -- 4. Closed status requires reviewed_at
    IF NEW.task_status = 'Closed' AND NEW.reviewed_at IS NULL THEN
      NEW.reviewed_at := NOW();
      NEW.reviewed_by := auth.uid();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.validate_task_status_transition(VARCHAR, VARCHAR, VARCHAR) IS
  'Validates task status transitions. Allowed: ToDo->WIP (all), WIP->Done (all), Done->Closed (Super Admin), Done->WIP (Super Admin), Closed->WIP (Super Admin)';
