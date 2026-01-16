import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useRealtime } from '@/contexts/RealtimeContext';
import type { Task, Project, UserWithRole } from '@/lib/supabase/types';
import { TaskStatus } from '@/lib/supabase/types';

export interface TaskFilters {
  status?: string;
  reviewStatus?: string;
  projectId?: string;
  assignedTo?: string;
}

export interface TaskWithRelations extends Task {
  projects?: Project | null;
  assigned_user?: UserWithRole | null;
}

/**
 * Hook to subscribe to real-time task updates
 * Automatically fetches initial data and subscribes to changes
 */
export function useRealtimeTasks(filters?: TaskFilters) {
  const { user } = useAuth();
  const { subscribe, isConnected } = useRealtime();
  const [tasks, setTasks] = useState<TaskWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch initial tasks
  const fetchTasks = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      setLoading(true);

      // Build query with filters
      let query = supabase
        .from('tasks')
        .select(`
          *,
          projects!left (*)
        `);

      // Apply filters
      if (filters?.status) {
        if (filters.status === 'closed') {
          query = query.eq('status', TaskStatus.CLOSED);
        } else if (filters.status === 'to_do') {
          query = query.eq('status', TaskStatus.TO_DO);
        } else if (filters.status === 'in_progress') {
          query = query.eq('status', TaskStatus.IN_PROGRESS);
        } else if (filters.status === 'blocked') {
          query = query.eq('status', TaskStatus.BLOCKED);
        } else if (filters.status === 'done') {
          query = query.eq('status', TaskStatus.DONE);
        } else if (filters.status === 'due_today') {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          query = query
            .gte('due_date', today.toISOString())
            .lt('due_date', tomorrow.toISOString())
            .neq('status', TaskStatus.CLOSED);
        } else if (filters.status === 'overdue') {
          const now = new Date().toISOString();
          query = query
            .lt('due_date', now)
            .neq('status', TaskStatus.CLOSED)
            .neq('status', TaskStatus.DONE);
        }
      }

      if (filters?.reviewStatus) {
        query = query.eq('review_status', filters.reviewStatus);
      }

      if (filters?.projectId) {
        query = query.eq('project_id', filters.projectId);
      }

      if (filters?.assignedTo) {
        query = query.eq('assigned_to', filters.assignedTo);
      }

      query = query.order('created_at', { ascending: false });

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      // Fetch assigned users separately
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map((t: any) => t.assigned_to).filter(Boolean))];

        const usersResult = userIds.length > 0
          ? await supabase.from('users').select('*').in('id', userIds)
          : { data: [] };

        const usersMap = new Map((usersResult.data as any)?.map((u: any) => [u.id, u]) ?? []);

        const tasksWithRelations = data.map((task: any) => ({
          ...task,
          projects: task.projects ?? null,
          assigned_user: task.assigned_to ? usersMap.get(task.assigned_to) ?? null : null,
        }));

        setTasks(tasksWithRelations as TaskWithRelations[]);
      } else {
        setTasks([]);
      }
    } catch (err) {
      console.error('Error fetching tasks:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [user, filters]);

  // Set up real-time subscription
  useEffect(() => {
    if (!user || !isConnected) {
      if (!user) {
        setTasks([]);
        setLoading(false);
      }
      return;
    }

    // Initial fetch
    fetchTasks();

    // Build filter string for subscription
    // Note: RLS will automatically filter based on user permissions
    // We can add additional filters here if needed
    const filterParts: string[] = [];
    
    if (filters?.projectId) {
      filterParts.push(`project_id=eq.${filters.projectId}`);
    }
    
    if (filters?.assignedTo) {
      filterParts.push(`assigned_to=eq.${filters.assignedTo}`);
    }

    const filterString = filterParts.length > 0 ? filterParts.join(',') : undefined;

    // Subscribe to task changes
    const unsubscribe = subscribe(
      `tasks:${user.id}:${JSON.stringify(filters ?? {})}`,
      {
        event: '*',
        schema: 'public',
        table: 'tasks',
        filter: filterString,
        callback: (payload: any) => {
          if (payload.eventType === 'INSERT') {
            // Fetch the new task with relations
            const newTask = payload.new as any;
            supabase
              .from('tasks')
              .select(`
                *,
                projects!left (*)
              `)
              .eq('id', newTask.id)
              .single()
              .then(({ data: taskData, error: taskError }) => {
                if (!taskError && taskData) {
                  const task = taskData as any;
                  // Check if task matches current filters
                  let matchesFilter = true;
                  
                  if (filters?.status) {
                    if (filters.status === 'closed' && task.status !== TaskStatus.CLOSED) {
                      matchesFilter = false;
                    } else if (filters.status === 'to_do' && task.status !== TaskStatus.TO_DO) {
                      matchesFilter = false;
                    } else if (filters.status === 'in_progress' && task.status !== TaskStatus.IN_PROGRESS) {
                      matchesFilter = false;
                    } else if (filters.status === 'blocked' && task.status !== TaskStatus.BLOCKED) {
                      matchesFilter = false;
                    } else if (filters.status === 'done' && task.status !== TaskStatus.DONE) {
                      matchesFilter = false;
                    }
                  }

                  if (filters?.reviewStatus && task.review_status !== filters.reviewStatus) {
                    matchesFilter = false;
                  }

                  if (matchesFilter) {
                    // Fetch assigned user if needed
                    if (task.assigned_to) {
                      supabase
                        .from('users')
                        .select('*')
                        .eq('id', task.assigned_to)
                        .single()
                        .then(({ data: userData }) => {
                          setTasks((prev) => {
                            // Check if task already exists (avoid duplicates)
                            if (prev.some((t) => t.id === task.id)) {
                              return prev;
                            }
                            return [
                              {
                                ...task,
                                projects: task.projects ?? null,
                                assigned_user: userData ?? null,
                              } as TaskWithRelations,
                              ...prev,
                            ];
                          });
                        });
                    } else {
                      setTasks((prev) => {
                        if (prev.some((t) => t.id === task.id)) {
                          return prev;
                        }
                        return [
                          {
                            ...task,
                            projects: task.projects ?? null,
                            assigned_user: null,
                          } as TaskWithRelations,
                          ...prev,
                        ];
                      });
                    }
                  }
                }
              });
          } else if (payload.eventType === 'UPDATE') {
            const updatedTask = payload.new as any;
            
            // Check if task still matches filters
            let matchesFilter = true;
            
            if (filters?.status) {
              if (filters.status === 'closed' && updatedTask.status !== TaskStatus.CLOSED) {
                matchesFilter = false;
              } else if (filters.status === 'to_do' && updatedTask.status !== TaskStatus.TO_DO) {
                matchesFilter = false;
              } else if (filters.status === 'in_progress' && updatedTask.status !== TaskStatus.IN_PROGRESS) {
                matchesFilter = false;
              } else if (filters.status === 'blocked' && updatedTask.status !== TaskStatus.BLOCKED) {
                matchesFilter = false;
              } else if (filters.status === 'done' && updatedTask.status !== TaskStatus.DONE) {
                matchesFilter = false;
              }
            }

            if (filters?.reviewStatus && updatedTask.review_status !== filters.reviewStatus) {
              matchesFilter = false;
            }

            setTasks((prev) => {
              const existingIndex = prev.findIndex((t) => t.id === updatedTask.id);
              
              if (existingIndex >= 0) {
                if (matchesFilter) {
                  // Update existing task
                  const updated = [...prev];
                  updated[existingIndex] = {
                    ...updated[existingIndex],
                    ...updatedTask,
                  };
                  return updated;
                } else {
                  // Remove if no longer matches filter
                  return prev.filter((t) => t.id !== updatedTask.id);
                }
              } else if (matchesFilter) {
                // Add if it now matches filter
                return [
                  {
                    ...updatedTask,
                    projects: null,
                    assigned_user: null,
                  } as TaskWithRelations,
                  ...prev,
                ];
              }
              
              return prev;
            });
          } else if (payload.eventType === 'DELETE') {
            const deletedTask = payload.old as any;
            setTasks((prev) => prev.filter((t) => t.id !== deletedTask.id));
          }
        },
      }
    );

    return () => {
      unsubscribe();
    };
  }, [user, isConnected, filters, fetchTasks, subscribe]);

  return { tasks, loading, error, refetch: fetchTasks };
}
