import { useEffect, useState, useMemo, memo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSearchParams, Link } from 'react-router-dom';
import { usePage } from '@/contexts/PageContext';
import { Plus, X } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import type { Project, UserWithRole } from '@/lib/supabase/types';
import { TaskStatus, TaskPriority } from '@/lib/supabase/types';
import { useRealtimeTasks, type TaskFilters, type TaskWithRelations } from '@/hooks/useRealtimeTasks';

type AppUser = UserWithRole;
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { getPriorityDisplay, getTaskStatusDisplay, getDueDateDisplay } from '@/lib/utils/taskDisplay';
import { assignTask } from '@/lib/services/taskAssignmentService';
import { isTaskClosed } from '@/lib/services/projectService';
import { Skeleton, SkeletonTaskCard } from '@/components/skeletons';
import { AssigneeSelector } from '@/components/tasks/AssigneeSelector';

// Memoized task list item component
const TaskListItem = memo(({ task }: { task: TaskWithRelations }) => {
  const priorityDisplay = getPriorityDisplay(task.priority);
  const statusDisplay = getTaskStatusDisplay(
    (task as any).task_status, // Use canonical task_status field
    task.status, // Pass legacy status as fallback
    (task as any).archived_at
  );
  const dueDateDisplay = getDueDateDisplay(task.due_date);
  const PriorityIcon = priorityDisplay.icon;
  const StatusIcon = statusDisplay.icon;
  const taskIsClosed = isTaskClosed(task);
  const closedByProject = (task as any).closed_reason === 'project_closed';
  const isArchived = !!(task as any).archived_at;

  return (
    <Link
      key={task.id}
      to={`/tasks/${task.id}`}
      className="block"
    >
      <Card
        className={`transition-all duration-200 border-l-4 ${priorityDisplay.borderColor} group w-full ${
          taskIsClosed || isArchived
            ? 'bg-gray-50 opacity-75 cursor-not-allowed' 
            : 'hover:shadow-lg sm:hover:scale-[1.02] cursor-pointer'
        }`}
      >
        <CardHeader className="p-4 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base sm:text-lg group-hover:text-primary transition-colors break-words">
                {task.title}
              </CardTitle>
              <CardDescription className="break-words mt-1">
                {(task.projects as Project)?.name ?? 'Standalone Task'}
                {taskIsClosed && closedByProject && (
                  <span className="text-xs italic text-muted-foreground ml-2">
                    (Closed - Project closed)
                  </span>
                )}
              </CardDescription>
            </div>
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md shrink-0 ${statusDisplay.bgColor} ${statusDisplay.color}`}>
              <StatusIcon className="h-3.5 w-3.5" />
              <span className="text-xs font-medium hidden sm:inline">{statusDisplay.label}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0">
          <p className="text-sm text-muted-foreground line-clamp-2 mb-4 break-words">
            {task.description ?? 'No description'}
          </p>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              {task.assigned_to && (
                <span className="text-xs text-muted-foreground break-words">
                  Assigned to: {(task.assigned_user as UserWithRole)?.full_name ?? (task.assigned_user as UserWithRole)?.email ?? 'Unknown'}
                </span>
              )}
              {dueDateDisplay && (() => {
                const DueDateIcon = dueDateDisplay.icon;
                return (
                  <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md w-fit ${dueDateDisplay.bgColor} ${dueDateDisplay.color}`}>
                    <DueDateIcon className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">{dueDateDisplay.label}</span>
                  </div>
                );
              })()}
            </div>
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md w-fit ${priorityDisplay.bgColor} ${priorityDisplay.color}`}>
              <PriorityIcon className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">{priorityDisplay.label}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
});

TaskListItem.displayName = 'TaskListItem';

export function Tasks() {
  const { permissions } = useAuth();
  const { setActionButton } = usePage();
  const [searchParams, setSearchParams] = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(50);
  const [activeTab, setActiveTab] = useState<'all' | 'todo' | 'work-in-progress' | 'done' | 'closed'>('all');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    project_id: '',
    assignee_ids: [] as string[],
    due_date: '',
    priority: 'medium' as TaskPriority,
        status: 'to_do' as TaskStatus, // Legacy field - task_status will be set to 'ToDo' by default
  });

  // Build filters from URL params and active tab - using canonical lifecycle
  const taskFilters = useMemo<TaskFilters>(() => {
    const statusParam = searchParams.get('status');
    const taskStatusParam = searchParams.get('task_status');
    
    const filters: TaskFilters = {};
    
    // Determine lifecycle status filter
    if (taskStatusParam) {
      filters.taskStatus = taskStatusParam;
    } else if (statusParam) {
      // Legacy status support
      filters.status = statusParam;
    } else if (activeTab === 'todo') {
      filters.taskStatus = 'ToDo';
    } else if (activeTab === 'work-in-progress') {
      filters.taskStatus = 'Work-In-Progress';
    } else if (activeTab === 'done') {
      filters.taskStatus = 'Done';
    } else if (activeTab === 'closed') {
      filters.taskStatus = 'Closed';
      filters.includeArchived = true;
    }
    
    return filters;
  }, [searchParams, activeTab]);

  // Use real-time tasks hook
  const { tasks, loading } = useRealtimeTasks(taskFilters);

  // Set action button in top bar
  useEffect(() => {
    if (permissions.canCreateTasks) {
      setActionButton(
        <>
          {/* Mobile: Icon button */}
          <Button 
            onClick={() => setShowCreateForm((prev) => !prev)}
            size="icon"
            variant="ghost"
            className="h-10 w-10 lg:hidden"
          >
            {showCreateForm ? (
              <X className="h-5 w-5" />
            ) : (
              <Plus className="h-5 w-5" />
            )}
          </Button>
          {/* Desktop: Full button with text */}
          <Button 
            onClick={() => setShowCreateForm((prev) => !prev)}
            className="hidden lg:flex min-h-[44px]"
          >
            {showCreateForm ? 'Cancel' : 'New Task'}
          </Button>
        </>
      );
    } else {
      setActionButton(null);
    }
    
    return () => setActionButton(null);
  }, [permissions.canCreateTasks, showCreateForm, setActionButton]);

  // Initialize tab from URL params
  useEffect(() => {
    const statusParam = searchParams.get('status');
    const reviewStatusParam = searchParams.get('review_status');
    const taskStatusParam = searchParams.get('task_status');
    
    if (taskStatusParam === 'Closed') {
      setActiveTab('closed');
    } else if (taskStatusParam === 'Done') {
      setActiveTab('done');
    } else if (taskStatusParam === 'Work-In-Progress') {
      setActiveTab('work-in-progress');
    } else if (taskStatusParam === 'ToDo') {
      setActiveTab('todo');
    } else if (statusParam === 'closed' || statusParam === 'done') {
      setActiveTab('closed');
    } else if (statusParam === 'in_progress') {
      setActiveTab('work-in-progress');
    } else if (statusParam === 'to_do') {
      setActiveTab('todo');
    } else if (statusParam === 'due_today' || statusParam === 'overdue' || statusParam === 'blocked') {
      setActiveTab('all');
    } else if (reviewStatusParam === 'pending_review' || reviewStatusParam === 'under_review') {
      setActiveTab('done');
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
      // Only fetch active projects with minimal fields needed for selection
      const { data, error } = await supabase
        .from('projects')
        .select('id, name')
        .eq('status', 'active')
        .order('name')
        .limit(100); // Limit to prevent excessive data

      if (error) throw error;
      setProjects(data ?? []);
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      // Only fetch active users with minimal fields needed for selection
      const { data, error } = await supabase
        .from('users')
        .select('id, email, full_name')
        .eq('is_active', true)
        .order('full_name')
        .limit(100); // Limit to prevent excessive data

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
    if (formData.assignee_ids.length > 0 && !permissions.canAssignTasks) {
      alert('You do not have permission to assign tasks. Only Admins and Super Admins can assign tasks.');
      return;
    }

    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error('Not authenticated');

      // @ts-expect-error - Supabase type inference issue with strict TypeScript
      const { data: newTask, error } = await supabase.from('tasks').insert({
        title: formData.title,
        description: formData.description || null,
        project_id: formData.project_id || null, // Allow null for standalone tasks
        assigned_to: null, // Use task_assignees for multi-assign
        due_date: formData.due_date || null,
        priority: formData.priority,
        status: formData.status, // Legacy field
        task_status: 'ToDo', // Canonical lifecycle status - new tasks start in ToDo
        created_by: authUser.id,
      }).select('id').single();

      if (error) throw error;

      const taskId = (newTask as any)?.id;
      if (taskId && formData.assignee_ids.length > 0) {
        const { error: assignError } = await assignTask(
          taskId,
          formData.assignee_ids,
          authUser.id
        );
        if (assignError) {
          console.error('Error assigning users:', assignError);
          alert('Task created, but assigning users failed.');
        }
      }

      setFormData({
        title: '',
        description: '',
        project_id: '',
        assignee_ids: [],
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
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton height={32} width="20%" variant="text" />
          <Skeleton height={40} width={120} variant="rectangular" />
        </div>
        <div className="flex gap-2 border-b pb-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height={36} width={120} variant="rectangular" />
          ))}
        </div>
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonTaskCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 w-full max-w-full overflow-x-hidden">

      {/* Mobile: Dropdown filter */}
      <div className="lg:hidden w-full">
        <Select
          value={activeTab}
          onChange={(e) => {
            const tab = e.target.value as typeof activeTab;
            setActiveTab(tab);
            setSearchParams({});
          }}
          className="w-full min-h-[44px]"
        >
          <option value="all">All Tasks</option>
          <option value="todo">To Do</option>
          <option value="work-in-progress">Work-In-Progress</option>
          <option value="done">Done (Pending Review)</option>
          <option value="closed">Closed (Complete)</option>
        </Select>
      </div>

      {/* Desktop: Lifecycle Tabs for filtering */}
      <div className="hidden lg:flex gap-2 border-b">
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
            setActiveTab('todo');
            setSearchParams({});
          }}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'todo'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          To Do
        </button>
        <button
          onClick={() => {
            setActiveTab('work-in-progress');
            setSearchParams({});
          }}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'work-in-progress'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Work-In-Progress
        </button>
        <button
          onClick={() => {
            setActiveTab('done');
            setSearchParams({});
          }}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'done'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Done (Pending Review)
        </button>
        <button
          onClick={() => {
            setActiveTab('closed');
            setSearchParams({});
          }}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'closed'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Closed (Complete)
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="project_id">Project (Optional)</Label>
                  <Select
                    id="project_id"
                    value={formData.project_id}
                    onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                    className="w-full min-h-[44px]"
                  >
                    <option value="">Standalone Task (No Project)</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </Select>
                  <p className="text-xs text-muted-foreground break-words">
                    Leave as "Standalone Task" for operational tasks not tied to a project
                  </p>
                </div>
                <AssigneeSelector
                  taskId="new-task-temp-id"
                  allUsers={users}
                  selectedAssigneeIds={formData.assignee_ids}
                  onSelectionChange={(selectedIds) => {
                    setFormData({ ...formData, assignee_ids: selectedIds });
                  }}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
        <>
          <div className="space-y-3 sm:space-y-4 w-full">
            {tasks
              .slice((currentPage - 1) * pageSize, currentPage * pageSize)
              .map((task) => (
                <TaskListItem key={task.id} task={task} />
              ))}
          </div>
          {tasks.length > pageSize && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-6 pt-4 border-t">
              <div className="text-sm text-muted-foreground text-center sm:text-left">
                Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, tasks.length)} of {tasks.length} tasks
              </div>
              <div className="flex gap-2 justify-center sm:justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="min-h-[44px] min-w-[80px]"
                >
                  Previous
                </Button>
                <span className="flex items-center px-3 text-sm">
                  Page {currentPage} of {Math.ceil(tasks.length / pageSize)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(Math.ceil(tasks.length / pageSize), p + 1))}
                  disabled={currentPage >= Math.ceil(tasks.length / pageSize)}
                  className="min-h-[44px] min-w-[80px]"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
