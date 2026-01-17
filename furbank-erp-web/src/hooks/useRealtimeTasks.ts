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

      // Fetch assigned users efficiently in a single query
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map((t: any) => t.assigned_to).filter(Boolean))];

        // Fetch all users with roles in a single query
        let usersMap = new Map();
        if (userIds.length > 0) {
          const { data: usersData } = await supabase
            .from('users')
            .select('*, roles(*)')
            .in('id', userIds);

          if (usersData) {
            usersMap = new Map(
              usersData.map((u: any) => {
                const user = {
                  ...u,
                  roles: Array.isArray(u.roles) && u.roles.length > 0 ? u.roles[0] : (u.roles ?? null),
                };
                return [u.id, user];
              })
            );
          }
        }

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
            // Use payload data directly, fetch relations in parallel if needed
            const newTask = payload.new as any;
            
            // Check if task matches current filters
            let matchesFilter = true;
            
            if (filters?.status) {
              if (filters.status === 'closed' && newTask.status !== TaskStatus.CLOSED) {
                matchesFilter = false;
              } else if (filters.status === 'to_do' && newTask.status !== TaskStatus.TO_DO) {
                matchesFilter = false;
              } else if (filters.status === 'in_progress' && newTask.status !== TaskStatus.IN_PROGRESS) {
                matchesFilter = false;
              } else if (filters.status === 'blocked' && newTask.status !== TaskStatus.BLOCKED) {
                matchesFilter = false;
              } else if (filters.status === 'done' && newTask.status !== TaskStatus.DONE) {
                matchesFilter = false;
              }
            }

            if (filters?.reviewStatus && newTask.review_status !== filters.reviewStatus) {
              matchesFilter = false;
            }

            if (matchesFilter) {
              // Fetch relations in parallel
              const promises: Promise<any>[] = [];
              
              // Fetch project if project_id exists
              if (newTask.project_id) {
                promises.push(
                  Promise.resolve(
                    supabase
                      .from('projects')
                      .select('*')
                      .eq('id', newTask.project_id)
                      .single()
                      .then(({ data }) => data)
                  )
                );
              } else {
                promises.push(Promise.resolve(null));
              }
              
              // Fetch assigned user if assigned_to exists
              if (newTask.assigned_to) {
                promises.push(
                  Promise.resolve(
                    supabase
                      .from('users')
                      .select('*, roles(*)')
                      .eq('id', newTask.assigned_to)
                      .single()
                      .then(({ data }) => {
                        if (data) {
                          const user = data as any;
                          return {
                            ...user,
                            roles: Array.isArray(user.roles) ? user.roles[0] : user.roles,
                          };
                        }
                        return null;
                      })
                  )
                );
              } else {
                promises.push(Promise.resolve(null));
              }
              
              Promise.all(promises).then(([project, assignedUser]) => {
                setTasks((prev) => {
                  // Check if task already exists (avoid duplicates)
                  if (prev.some((t) => t.id === newTask.id)) {
                    return prev;
                  }
                  return [
                    {
                      ...newTask,
                      projects: project ?? null,
                      assigned_user: assignedUser ?? null,
                    } as TaskWithRelations,
                    ...prev,
                  ];
                });
              });
            }
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
                  // Merge payload directly into existing task (preserve relations)
                  const updated = [...prev];
                  updated[existingIndex] = {
                    ...updated[existingIndex],
                    ...updatedTask,
                    // Preserve relations if they exist
                    projects: updatedTask.project_id && updated[existingIndex].projects 
                      ? updated[existingIndex].projects 
                      : (updatedTask.project_id ? null : updated[existingIndex].projects),
                    assigned_user: updatedTask.assigned_to && updated[existingIndex].assigned_user
                      ? updated[existingIndex].assigned_user
                      : (updatedTask.assigned_to ? null : updated[existingIndex].assigned_user),
                  };
                  return updated;
                } else {
                  // Remove if no longer matches filter
                  return prev.filter((t) => t.id !== updatedTask.id);
                }
              } else if (matchesFilter) {
                // Add if it now matches filter - fetch relations if needed
                if (updatedTask.project_id || updatedTask.assigned_to) {
                  const promises: Promise<any>[] = [];
                  
                  if (updatedTask.project_id) {
                    promises.push(
                      Promise.resolve(
                        supabase
                          .from('projects')
                          .select('*')
                          .eq('id', updatedTask.project_id)
                          .single()
                          .then(({ data }) => data)
                      )
                    );
                  } else {
                    promises.push(Promise.resolve(null));
                  }
                  
                  if (updatedTask.assigned_to) {
                    promises.push(
                      Promise.resolve(
                        supabase
                          .from('users')
                          .select('*, roles(*)')
                          .eq('id', updatedTask.assigned_to)
                          .single()
                          .then(({ data }) => {
                            if (data) {
                              const user = data as any;
                              return {
                                ...user,
                                roles: Array.isArray(user.roles) ? user.roles[0] : user.roles,
                              };
                            }
                            return null;
                          })
                      )
                    );
                  } else {
                    promises.push(Promise.resolve(null));
                  }
                  
                  Promise.all(promises).then(([project, assignedUser]) => {
                    setTasks((prevTasks) => {
                      if (prevTasks.some((t) => t.id === updatedTask.id)) {
                        return prevTasks;
                      }
                      return [
                        {
                          ...updatedTask,
                          projects: project ?? null,
                          assigned_user: assignedUser ?? null,
                        } as TaskWithRelations,
                        ...prevTasks,
                      ];
                    });
                  });
                  return prev; // Return unchanged for now, will update via Promise
                } else {
                  return [
                    {
                      ...updatedTask,
                      projects: null,
                      assigned_user: null,
                    } as TaskWithRelations,
                    ...prev,
                  ];
                }
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
