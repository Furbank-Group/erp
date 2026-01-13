import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';
import type { Task, Project, UserWithRole } from '@/lib/supabase/types';
import { TaskStatus, TaskPriority } from '@/lib/supabase/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Link } from 'react-router-dom';
import { getPriorityDisplay, getTaskStatusDisplay, getDueDateDisplay } from '@/lib/utils/taskDisplay';

interface TaskWithRelations extends Task {
  projects?: Project;
  assigned_user?: UserWithRole;
}

export function Tasks() {
  const { user, permissions } = useAuth();
  const [tasks, setTasks] = useState<TaskWithRelations[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    project_id: '',
    assigned_to: '',
    due_date: '',
    priority: TaskPriority.MEDIUM,
    status: TaskStatus.TO_DO,
  });

  useEffect(() => {
    fetchTasks();
    if (permissions.canCreateTasks) {
      fetchProjects();
      fetchUsers();
    }
  }, [permissions.canCreateTasks]);

  const fetchTasks = async () => {
    try {
      let query = supabase
        .from('tasks')
        .select(`
          *,
          projects!tasks_project_id_fkey (*)
        `)
        .order('created_at', { ascending: false });

      // Staff can only see assigned tasks
      if (!permissions.canViewAllTasks && user) {
        query = query.eq('assigned_to', user.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Use joined project data from the query, and fetch users separately
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(t => t.assigned_to).filter(Boolean))];
        
        // Fetch assigned users separately
        const usersResult = userIds.length > 0
          ? await supabase.from('users').select('*').in('id', userIds)
          : { data: [] };
        
        const usersMap = new Map(usersResult.data?.map(u => [u.id, u]) ?? []);
        
        // Use the joined project data from the query (it respects RLS policies)
        const tasksWithRelations = data.map((task: any) => ({
          ...task,
          projects: task.projects ?? null,
          assigned_user: task.assigned_to ? usersMap.get(task.assigned_to) ?? null : null,
        }));
        
        setTasks(tasksWithRelations as TaskWithRelations[]);
      } else {
        setTasks([]);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('status', 'active')
        .order('name');

      if (error) throw error;
      setProjects(data ?? []);
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('is_active', true)
        .order('full_name');

      if (error) throw error;
      setUsers(data ?? []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!permissions.canCreateTasks) return;

    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error('Not authenticated');

      const { error } = await supabase.from('tasks').insert({
        title: formData.title,
        description: formData.description || null,
        project_id: formData.project_id,
        assigned_to: formData.assigned_to || null,
        due_date: formData.due_date || null,
        priority: formData.priority,
        status: formData.status,
        created_by: authUser.id,
      });

      if (error) throw error;

      setFormData({
        title: '',
        description: '',
        project_id: '',
        assigned_to: '',
        due_date: '',
        priority: TaskPriority.MEDIUM,
        status: TaskStatus.TO_DO,
      });
      setShowCreateForm(false);
      fetchTasks();
    } catch (error) {
      console.error('Error creating task:', error);
      alert('Failed to create task');
    }
  };


  if (loading) {
    return <div className="text-center py-8">Loading tasks...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">
          {permissions.canViewAllTasks ? 'All Tasks' : 'My Tasks'}
        </h1>
        {permissions.canCreateTasks && (
          <Button onClick={() => setShowCreateForm(!showCreateForm)}>
            {showCreateForm ? 'Cancel' : 'New Task'}
          </Button>
        )}
      </div>

      {showCreateForm && permissions.canCreateTasks && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Task</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateTask} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Enter task title"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Enter task description"
                  rows={4}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="project_id">Project</Label>
                  <Select
                    id="project_id"
                    value={formData.project_id}
                    onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                    required
                  >
                    <option value="">Select a project</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="assigned_to">Assign To</Label>
                  <Select
                    id="assigned_to"
                    value={formData.assigned_to}
                    onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                  >
                    <option value="">Unassigned</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name ?? u.email}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="due_date">Due Date</Label>
                  <Input
                    id="due_date"
                    type="datetime-local"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Select
                    id="priority"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as TaskPriority })}
                  >
                    <option value={TaskPriority.LOW}>Low</option>
                    <option value={TaskPriority.MEDIUM}>Medium</option>
                    <option value={TaskPriority.HIGH}>High</option>
                    <option value={TaskPriority.URGENT}>Urgent</option>
                  </Select>
                </div>
              </div>
              <Button type="submit">Create Task</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {tasks.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No tasks found.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {tasks.map((task) => {
            const priorityDisplay = getPriorityDisplay(task.priority);
            const statusDisplay = getTaskStatusDisplay(task.status);
            const dueDateDisplay = getDueDateDisplay(task.due_date);
            const PriorityIcon = priorityDisplay.icon;
            const StatusIcon = statusDisplay.icon;

            return (
              <Card
                key={task.id}
                className={`hover:shadow-md transition-shadow border-l-4 ${priorityDisplay.borderColor}`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">
                        <Link to={`/tasks/${task.id}`} className="hover:underline">
                          {task.title}
                        </Link>
                      </CardTitle>
                      <CardDescription>
                        {(task.projects as Project)?.name ?? 'Unknown Project'}
                      </CardDescription>
                    </div>
                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md ${statusDisplay.bgColor} ${statusDisplay.color}`}>
                      <StatusIcon className="h-3.5 w-3.5" />
                      <span className="text-xs font-medium">{statusDisplay.label}</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                    {task.description ?? 'No description'}
                  </p>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-4 flex-wrap">
                      {task.assigned_to && (
                        <span className="text-xs text-muted-foreground">
                          Assigned to: {(task.assigned_user as UserWithRole)?.full_name ?? (task.assigned_user as UserWithRole)?.email ?? 'Unknown'}
                        </span>
                      )}
                      {dueDateDisplay && (() => {
                        const DueDateIcon = dueDateDisplay.icon;
                        return (
                          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md ${dueDateDisplay.bgColor} ${dueDateDisplay.color}`}>
                            <DueDateIcon className="h-3.5 w-3.5" />
                            <span className="text-xs font-medium">{dueDateDisplay.label}</span>
                          </div>
                        );
                      })()}
                    </div>
                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md ${priorityDisplay.bgColor} ${priorityDisplay.color}`}>
                      <PriorityIcon className="h-3.5 w-3.5" />
                      <span className="text-xs font-medium">{priorityDisplay.label}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
