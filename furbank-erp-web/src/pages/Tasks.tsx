import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase/client';
import type { Project, UserWithRole } from '@/lib/supabase/types';
import { TaskStatus, TaskPriority } from '@/lib/supabase/types';
import { useRealtimeTasks, type TaskFilters } from '@/hooks/useRealtimeTasks';

type AppUser = UserWithRole;
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { getPriorityDisplay, getTaskStatusDisplay, getDueDateDisplay } from '@/lib/utils/taskDisplay';
import { isTaskClosed } from '@/lib/services/projectService';

export function Tasks() {
  const { permissions } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'new' | 'in_progress' | 'completed'>('all');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    project_id: '',
    assigned_to: '',
    due_date: '',
    priority: 'medium' as TaskPriority,
    status: 'to_do' as TaskStatus,
  });

  // Build filters from URL params and active tab
  const taskFilters = useMemo<TaskFilters>(() => {
    const statusParam = searchParams.get('status');
    const reviewStatusParam = searchParams.get('review_status');
    
    const filters: TaskFilters = {};
    
    // Determine status filter
    if (statusParam) {
      filters.status = statusParam;
    } else if (activeTab === 'new') {
      filters.status = 'to_do';
    } else if (activeTab === 'in_progress') {
      filters.status = 'in_progress';
    } else if (activeTab === 'completed') {
      filters.status = 'closed'; // Will be handled specially in the hook
    }
    
    if (reviewStatusParam) {
      filters.reviewStatus = reviewStatusParam;
    }
    
    return filters;
  }, [searchParams, activeTab]);

  // Use real-time tasks hook
  const { tasks, loading } = useRealtimeTasks(taskFilters);

  // Initialize tab from URL params
  useEffect(() => {
    const statusParam = searchParams.get('status');
    const reviewStatusParam = searchParams.get('review_status');
    
    if (statusParam === 'closed' || statusParam === 'done') {
      setActiveTab('completed');
    } else if (statusParam === 'in_progress') {
      setActiveTab('in_progress');
    } else if (statusParam === 'to_do') {
      setActiveTab('new');
    } else if (statusParam === 'due_today' || statusParam === 'overdue' || statusParam === 'blocked') {
      setActiveTab('all');
    } else if (reviewStatusParam === 'pending_review' || reviewStatusParam === 'under_review') {
      setActiveTab('all');
    } else {
      setActiveTab('all');
    }
  }, [searchParams]);

  useEffect(() => {
    if (permissions.canCreateTasks) {
      fetchProjects();
      fetchUsers();
    }
  }, [permissions.canCreateTasks]);

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
    
    // Enforce assignment permission: only users with canAssignTasks can assign tasks
    if (formData.assigned_to && !permissions.canAssignTasks) {
      alert('You do not have permission to assign tasks. Only Admins and Super Admins can assign tasks.');
      return;
    }

    // Enforce single assignee constraint
    if (formData.assigned_to && formData.assigned_to.split(',').length > 1) {
      alert('A task can only be assigned to one user.');
      return;
    }

    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error('Not authenticated');

      // @ts-expect-error - Supabase type inference issue with strict TypeScript
      const { error } = await supabase.from('tasks').insert({
        title: formData.title,
        description: formData.description || null,
        project_id: formData.project_id || null, // Allow null for standalone tasks
        assigned_to: formData.assigned_to || null, // Single assignee only
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
      // Tasks will update automatically via real-time subscription
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
        <h1 className="text-3xl font-bold">Tasks</h1>
        {permissions.canCreateTasks && (
          <Button onClick={() => setShowCreateForm(!showCreateForm)}>
            {showCreateForm ? 'Cancel' : 'New Task'}
          </Button>
        )}
      </div>

      {/* Tabs for filtering */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => {
            setActiveTab('all');
            setSearchParams({});
          }}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'all'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          All Tasks
        </button>
        <button
          onClick={() => {
            setActiveTab('new');
            setSearchParams({});
          }}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'new'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          New Tasks
        </button>
        <button
          onClick={() => {
            setActiveTab('in_progress');
            setSearchParams({});
          }}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'in_progress'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Work In Progress
        </button>
        <button
          onClick={() => {
            setActiveTab('completed');
            setSearchParams({});
          }}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'completed'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Completed Tasks
        </button>
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
                  <Label htmlFor="project_id">Project (Optional)</Label>
                  <Select
                    id="project_id"
                    value={formData.project_id}
                    onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                  >
                    <option value="">Standalone Task (No Project)</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Leave as "Standalone Task" for operational tasks not tied to a project
                  </p>
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
            const taskIsClosed = isTaskClosed(task);
            const closedByProject = (task as any).closed_reason === 'project_closed';

            return (
              <Link
                key={task.id}
                to={`/tasks/${task.id}`}
                className="block"
              >
                <Card
                  className={`transition-all duration-200 border-l-4 ${priorityDisplay.borderColor} group ${
                    taskIsClosed 
                      ? 'bg-gray-50 opacity-75 cursor-not-allowed' 
                      : 'hover:shadow-lg hover:scale-[1.02] cursor-pointer'
                  }`}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg group-hover:text-primary transition-colors">
                          {task.title}
                        </CardTitle>
                        <CardDescription>
                          {(task.projects as Project)?.name ?? 'Standalone Task'}
                          {taskIsClosed && closedByProject && (
                            <span className="text-xs italic text-muted-foreground ml-2">
                              (Closed - Project closed)
                            </span>
                          )}
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
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
