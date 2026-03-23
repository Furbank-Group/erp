-- Migration 056: Add approved, failed, rejected, closed to user workload summary
-- Drops and recreates the get_user_workload_summary RPC to add the new columns.

DROP FUNCTION IF EXISTS public.get_user_workload_summary(UUID);

CREATE OR REPLACE FUNCTION get_user_workload_summary(p_user_id UUID)
RETURNS TABLE (
  user_id UUID,
  user_name VARCHAR,
  user_email VARCHAR,
  user_role VARCHAR,
  assigned_tasks INTEGER,
  overdue_tasks INTEGER,
  tasks_waiting_review INTEGER,
  approved_tasks INTEGER,
  failed_tasks INTEGER,
  rejected_tasks INTEGER,
  closed_tasks INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Super Admin and Admin see all users
  IF EXISTS (
    SELECT 1 FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = p_user_id AND r.name IN ('super_admin', 'admin')
  ) THEN
    RETURN QUERY
    SELECT 
      u.id as user_id,
      COALESCE(u.full_name, u.email) as user_name,
      u.email as user_email,
      r.name as user_role,
      COUNT(DISTINCT t.id) FILTER (
        WHERE EXISTS (
          SELECT 1 FROM task_assignees ta
          WHERE ta.task_id = t.id AND ta.user_id = u.id
        ) OR t.assigned_to = u.id
      )::INTEGER as assigned_tasks,
      COUNT(DISTINCT t.id) FILTER (
        WHERE t.due_date IS NOT NULL 
        AND t.due_date < NOW() 
        AND t.task_status != 'Closed'
        AND (EXISTS (
          SELECT 1 FROM task_assignees ta
          WHERE ta.task_id = t.id AND ta.user_id = u.id
        ) OR t.assigned_to = u.id)
      )::INTEGER as overdue_tasks,
      COUNT(DISTINCT t.id) FILTER (
        WHERE t.task_status = 'Done'
        AND t.deleted_at IS NULL
        AND (
          EXISTS (
            SELECT 1 FROM task_assignees ta
            WHERE ta.task_id = t.id AND ta.user_id = u.id
          )
          OR t.assigned_to = u.id
        )
      )::INTEGER as tasks_waiting_review,
      COUNT(DISTINCT t.id) FILTER (
        WHERE t.task_status = 'Closed'
        AND t.deleted_at IS NULL
        AND (t.closed_reason IS NULL OR t.closed_reason != 'failed')
        AND (
          EXISTS (
            SELECT 1 FROM task_assignees ta
            WHERE ta.task_id = t.id AND ta.user_id = u.id
          ) OR t.assigned_to = u.id
        )
      )::INTEGER as approved_tasks,
      COUNT(DISTINCT t.id) FILTER (
        WHERE t.task_status = 'Closed'
        AND t.deleted_at IS NULL
        AND t.closed_reason = 'failed'
        AND (
          EXISTS (
            SELECT 1 FROM task_assignees ta
            WHERE ta.task_id = t.id AND ta.user_id = u.id
          ) OR t.assigned_to = u.id
        )
      )::INTEGER as failed_tasks,
      (
        SELECT COUNT(DISTINCT t_rej.id)
        FROM tasks t_rej
        JOIN task_progress_log pl ON pl.task_id = t_rej.id
        WHERE t_rej.deleted_at IS NULL
          AND pl.progress_note LIKE 'Review rejected - returned to Work-In-Progress%'
          AND (
            EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t_rej.id AND ta.user_id = u.id)
            OR t_rej.assigned_to = u.id
          )
      )::INTEGER as rejected_tasks,
      COUNT(DISTINCT t.id) FILTER (
        WHERE t.task_status = 'Closed'
        AND t.deleted_at IS NULL
        AND (
          EXISTS (
            SELECT 1 FROM task_assignees ta
            WHERE ta.task_id = t.id AND ta.user_id = u.id
          ) OR t.assigned_to = u.id
        )
      )::INTEGER as closed_tasks
    FROM users u
    LEFT JOIN roles r ON u.role_id = r.id
    LEFT JOIN tasks t ON (
      EXISTS (
        SELECT 1 FROM task_assignees ta
        WHERE ta.task_id = t.id AND ta.user_id = u.id
      )
      OR t.assigned_to = u.id
      OR t.review_requested_by = u.id
    )
    WHERE u.is_active = true
      AND u.deleted_at IS NULL
      AND (t.deleted_at IS NULL OR t.id IS NULL)
    GROUP BY u.id, u.full_name, u.email, r.name
    ORDER BY u.full_name, u.email;
  -- Users see only themselves
  ELSE
    RETURN QUERY
    SELECT 
      u.id as user_id,
      COALESCE(u.full_name, u.email) as user_name,
      u.email as user_email,
      r.name as user_role,
      COUNT(DISTINCT t.id) FILTER (
        WHERE EXISTS (
          SELECT 1 FROM task_assignees ta
          WHERE ta.task_id = t.id AND ta.user_id = u.id
        ) OR t.assigned_to = u.id
      )::INTEGER as assigned_tasks,
      COUNT(DISTINCT t.id) FILTER (
        WHERE t.due_date IS NOT NULL 
        AND t.due_date < NOW() 
        AND t.task_status != 'Closed'
        AND (EXISTS (
          SELECT 1 FROM task_assignees ta
          WHERE ta.task_id = t.id AND ta.user_id = u.id
        ) OR t.assigned_to = u.id)
      )::INTEGER as overdue_tasks,
      COUNT(DISTINCT t.id) FILTER (
        WHERE t.task_status = 'Done'
        AND t.deleted_at IS NULL
        AND (
          EXISTS (
            SELECT 1 FROM task_assignees ta
            WHERE ta.task_id = t.id AND ta.user_id = u.id
          )
          OR t.assigned_to = u.id
        )
      )::INTEGER as tasks_waiting_review,
      COUNT(DISTINCT t.id) FILTER (
        WHERE t.task_status = 'Closed'
        AND t.deleted_at IS NULL
        AND (t.closed_reason IS NULL OR t.closed_reason != 'failed')
        AND (
          EXISTS (
            SELECT 1 FROM task_assignees ta
            WHERE ta.task_id = t.id AND ta.user_id = u.id
          ) OR t.assigned_to = u.id
        )
      )::INTEGER as approved_tasks,
      COUNT(DISTINCT t.id) FILTER (
        WHERE t.task_status = 'Closed'
        AND t.deleted_at IS NULL
        AND t.closed_reason = 'failed'
        AND (
          EXISTS (
            SELECT 1 FROM task_assignees ta
            WHERE ta.task_id = t.id AND ta.user_id = u.id
          ) OR t.assigned_to = u.id
        )
      )::INTEGER as failed_tasks,
      (
        SELECT COUNT(DISTINCT t_rej.id)
        FROM tasks t_rej
        JOIN task_progress_log pl ON pl.task_id = t_rej.id
        WHERE t_rej.deleted_at IS NULL
          AND pl.progress_note LIKE 'Review rejected - returned to Work-In-Progress%'
          AND (
            EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t_rej.id AND ta.user_id = u.id)
            OR t_rej.assigned_to = u.id
          )
      )::INTEGER as rejected_tasks,
      COUNT(DISTINCT t.id) FILTER (
        WHERE t.task_status = 'Closed'
        AND t.deleted_at IS NULL
        AND (
          EXISTS (
            SELECT 1 FROM task_assignees ta
            WHERE ta.task_id = t.id AND ta.user_id = u.id
          ) OR t.assigned_to = u.id
        )
      )::INTEGER as closed_tasks
    FROM users u
    LEFT JOIN roles r ON u.role_id = r.id
    LEFT JOIN tasks t ON (
      EXISTS (
        SELECT 1 FROM task_assignees ta
        WHERE ta.task_id = t.id AND ta.user_id = u.id
      )
      OR t.assigned_to = u.id
      OR t.review_requested_by = u.id
    )
    WHERE u.id = p_user_id AND u.is_active = true
      AND u.deleted_at IS NULL
      AND (t.deleted_at IS NULL OR t.id IS NULL)
    GROUP BY u.id, u.full_name, u.email, r.name;
  END IF;
END;
$$;

COMMENT ON FUNCTION get_user_workload_summary IS 'Returns user workload snapshot: assigned tasks, overdue, waiting review, approved, failed, rejected, closed. Sorted by name.';
