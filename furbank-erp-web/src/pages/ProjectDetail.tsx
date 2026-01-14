import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase/client';
import type { Project, Task, UserWithRole } from '@/lib/supabase/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getProjectStatusDisplay, getTaskStatusDisplay, getPriorityDisplay } from '@/lib/utils/taskDisplay';
import { Link } from 'react-router-dom';

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchProject();
      fetchTasks();
      fetchMembers();
    }
  }, [id]);

  const fetchProject = async () => {
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setProject(data);
    } catch (error) {
      console.error('Error fetching project:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTasks = async () => {
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTasks(data ?? []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    }
  };

  const fetchMembers = async () => {
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from('project_members')
        .select('*, users(*)')
        .eq('project_id', id);

      if (error) throw error;

      if (data && data.length > 0) {
        const userIds = [...new Set(data.map((m: any) => m.user_id).filter(Boolean))];
        const { data: usersData } = userIds.length > 0
          ? await supabase.from('users').select('*').in('id', userIds)
          : { data: [] };

        const usersMap = new Map((usersData as any)?.map((u: any) => [u.id, u]) ?? []);

        const membersWithUsers = data.map((member: any) => {
          const user = usersMap.get(member.user_id);
          return {
            ...member,
            user: user ?? null,
          };
        });

        setMembers(membersWithUsers as any);
      } else {
        setMembers([]);
      }
    } catch (error) {
      console.error('Error fetching members:', error);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading project...</div>;
  }

  if (!project) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground mb-4">Project not found</p>
        <Button onClick={() => navigate('/projects')}>Back to Projects</Button>
      </div>
    );
  }

  const statusDisplay = getProjectStatusDisplay(project.status);
  const StatusIcon = statusDisplay.icon;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" onClick={() => navigate('/projects')}>
            ← Back to Projects
          </Button>
          <h1 className="text-3xl font-bold mt-2">{project.name}</h1>
          <div className="flex items-center gap-2 mt-2">
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md ${statusDisplay.bgColor} ${statusDisplay.color}`}>
              <StatusIcon className="h-4 w-4" />
              <span className="text-sm font-medium">{statusDisplay.label}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <Card className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">
                {project.description || 'No description'}
              </p>
            </CardContent>
          </Card>

          <Card className="animate-in fade-in slide-in-from-bottom-4 duration-300 delay-75">
            <CardHeader>
              <CardTitle>Tasks ({tasks.length})</CardTitle>
              <CardDescription>Tasks associated with this project</CardDescription>
            </CardHeader>
            <CardContent>
              {tasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tasks in this project yet.</p>
              ) : (
                <div className="space-y-2">
                  {tasks.map((task, index) => {
                    const taskStatusDisplay = getTaskStatusDisplay(task.status);
                    const priorityDisplay = getPriorityDisplay(task.priority);
                    const TaskStatusIcon = taskStatusDisplay.icon;
                    const PriorityIcon = priorityDisplay.icon;

                    return (
                      <Link
                        key={task.id}
                        to={`/tasks/${task.id}`}
                        className="block"
                      >
                        <div
                          className="p-3 border rounded-lg hover:bg-accent hover:shadow-sm hover:scale-[1.01] transition-all duration-200 group"
                          style={{ animationDelay: `${index * 50}ms` }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-medium group-hover:text-primary transition-colors truncate">
                                {task.title}
                              </h4>
                              {task.description && (
                                <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                                  {task.description}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md ${taskStatusDisplay.bgColor} ${taskStatusDisplay.color}`}>
                                <TaskStatusIcon className="h-3 w-3" />
                                <span className="text-xs font-medium">{taskStatusDisplay.label}</span>
                              </div>
                              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md ${priorityDisplay.bgColor} ${priorityDisplay.color}`}>
                                <PriorityIcon className="h-3 w-3" />
                                <span className="text-xs font-medium">{priorityDisplay.label}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="animate-in fade-in slide-in-from-bottom-4 duration-300 delay-150">
            <CardHeader>
              <CardTitle>Project Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground">Created</p>
                <p className="text-sm font-medium">
                  {new Date(project.created_at).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Last Updated</p>
                <p className="text-sm font-medium">
                  {new Date(project.updated_at).toLocaleDateString()}
                </p>
              </div>
            </CardContent>
          </Card>

          {members.length > 0 && (
            <Card className="animate-in fade-in slide-in-from-bottom-4 duration-300 delay-200">
              <CardHeader>
                <CardTitle>Members ({members.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {members.map((member: any) => (
                    <div key={member.id} className="text-sm">
                      <p className="font-medium">
                        {member.user?.full_name ?? member.user?.email ?? 'Unknown'}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {member.role ?? 'Member'}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
