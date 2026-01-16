import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useRealtime } from '@/contexts/RealtimeContext';
import type { Project } from '@/lib/supabase/types';

export interface ProjectFilters {
  status?: string;
}

/**
 * Hook to subscribe to real-time project updates
 * Automatically fetches initial data and subscribes to changes
 */
export function useRealtimeProjects(filters?: ProjectFilters) {
  const { user } = useAuth();
  const { subscribe, isConnected } = useRealtime();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch initial projects
  const fetchProjects = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      setLoading(true);

      let query = supabase
        .from('projects')
        .select('*');

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      query = query.order('created_at', { ascending: false });

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      setProjects(data ?? []);
    } catch (err) {
      console.error('Error fetching projects:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [user, filters]);

  // Set up real-time subscription
  useEffect(() => {
    if (!user || !isConnected) {
      if (!user) {
        setProjects([]);
        setLoading(false);
      }
      return;
    }

    // Initial fetch
    fetchProjects();

    // Build filter string for subscription
    const filterParts: string[] = [];
    
    if (filters?.status) {
      filterParts.push(`status=eq.${filters.status}`);
    }

    const filterString = filterParts.length > 0 ? filterParts.join(',') : undefined;

    // Subscribe to project changes
    const unsubscribe = subscribe(
      `projects:${user.id}:${JSON.stringify(filters ?? {})}`,
      {
        event: '*',
        schema: 'public',
        table: 'projects',
        filter: filterString,
        callback: (payload) => {
          if (payload.eventType === 'INSERT') {
            const newProject = payload.new as Project;
            
            // Check if project matches filters
            let matchesFilter = true;
            if (filters?.status && newProject.status !== filters.status) {
              matchesFilter = false;
            }

            if (matchesFilter) {
              setProjects((prev) => {
                // Check if project already exists (avoid duplicates)
                if (prev.some((p) => p.id === newProject.id)) {
                  return prev;
                }
                return [newProject, ...prev];
              });
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedProject = payload.new as Project;
            
            // Check if project still matches filters
            let matchesFilter = true;
            if (filters?.status && updatedProject.status !== filters.status) {
              matchesFilter = false;
            }

            setProjects((prev) => {
              const existingIndex = prev.findIndex((p) => p.id === updatedProject.id);
              
              if (existingIndex >= 0) {
                if (matchesFilter) {
                  // Update existing project
                  const updated = [...prev];
                  updated[existingIndex] = updatedProject;
                  return updated;
                } else {
                  // Remove if no longer matches filter
                  return prev.filter((p) => p.id !== updatedProject.id);
                }
              } else if (matchesFilter) {
                // Add if it now matches filter
                return [updatedProject, ...prev];
              }
              
              return prev;
            });
          } else if (payload.eventType === 'DELETE') {
            const deletedProject = payload.old as Project;
            setProjects((prev) => prev.filter((p) => p.id !== deletedProject.id));
          }
        },
      }
    );

    return () => {
      unsubscribe();
    };
  }, [user, isConnected, filters, fetchProjects, subscribe]);

  return { projects, loading, error, refetch: fetchProjects };
}
