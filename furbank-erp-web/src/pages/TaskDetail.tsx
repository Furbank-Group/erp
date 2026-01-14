import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';
import type { Task, TaskComment, TaskNote, TaskFile, Project, UserWithRole } from '@/lib/supabase/types';
import { TaskStatus, TaskPriority, TaskReviewStatus } from '@/lib/supabase/types';
import { requestReview, approveTask, requestChanges } from '@/lib/services/taskReviewService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { CheckCircle2, XCircle, Clock, MessageSquare, Trash2 } from 'lucide-react';
import { getPriorityDisplay, getTaskStatusDisplay, getDueDateDisplay } from '@/lib/utils/taskDisplay';

export function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, permissions } = useAuth();
  const [task, setTask] = useState<Task | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [notes, setNotes] = useState<TaskNote[]>([]);
  const [files, setFiles] = useState<TaskFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [newNote, setNewNote] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewRequestedBy, setReviewRequestedBy] = useState<UserWithRole | null>(null);
  const [reviewedBy, setReviewedBy] = useState<UserWithRole | null>(null);
  const [loadingReview, setLoadingReview] = useState(false);

  useEffect(() => {
    if (id) {
      fetchTask();
      fetchComments();
      fetchNotes();
      fetchFiles();
    }
  }, [id]);

  const fetchTask = async () => {
    if (!id) return;
    try {
      // Use join query to get project data (respects RLS policies)
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          projects!tasks_project_id_fkey (*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setTask(data);

      // Use the joined project data (it respects RLS policies)
      const taskData = data as any;
      if (taskData && taskData.projects) {
        setProject(taskData.projects);
      } else if (taskData?.project_id) {
        // Fallback: try to fetch project separately if join didn't return it
        const { data: projectData } = await supabase
          .from('projects')
          .select('*')
          .eq('id', taskData.project_id)
          .single();
        setProject(projectData ?? null);
      }

      // Fetch review requester and reviewer
      if (taskData.review_requested_by) {
        const { data: requesterData } = await supabase
          .from('users')
          .select('*')
          .eq('id', taskData.review_requested_by)
          .single();
        if (requesterData) {
          const { data: requesterRole } = await supabase
            .from('roles')
            .select('*')
            .eq('id', (requesterData as any).role_id)
            .single();
          setReviewRequestedBy({ ...(requesterData as any), roles: requesterRole ?? undefined } as UserWithRole);
        }
      }

      if (taskData.reviewed_by) {
        const { data: reviewerData } = await supabase
          .from('users')
          .select('*')
          .eq('id', taskData.reviewed_by)
          .single();
        if (reviewerData) {
          const { data: reviewerRole } = await supabase
            .from('roles')
            .select('*')
            .eq('id', (reviewerData as any).role_id)
            .single();
          setReviewedBy({ ...(reviewerData as any), roles: reviewerRole ?? undefined } as UserWithRole);
        }
      }
    } catch (error) {
      console.error('Error fetching task:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from('task_comments')
        .select('*')
        .eq('task_id', id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch users separately
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map((c: any) => c.user_id).filter(Boolean))];
        const { data: usersData } = userIds.length > 0
          ? await supabase.from('users').select('*').in('id', userIds)
          : { data: [] };

        const usersMap = new Map((usersData as any)?.map((u: any) => [u.id, u]) ?? []);

        const commentsWithUsers = data.map((comment: any) => ({
          ...comment,
          user: usersMap.get(comment.user_id) ?? null,
        }));

        setComments(commentsWithUsers as any);
      } else {
        setComments([]);
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const fetchNotes = async () => {
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from('task_notes')
        .select('*')
        .eq('task_id', id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch users separately
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map((n: any) => n.user_id).filter(Boolean))];
        const { data: usersData } = userIds.length > 0
          ? await supabase.from('users').select('*').in('id', userIds)
          : { data: [] };

        const usersMap = new Map((usersData as any)?.map((u: any) => [u.id, u]) ?? []);

        const notesWithUsers = data.map((note: any) => ({
          ...note,
          user: usersMap.get(note.user_id) ?? null,
        }));

        setNotes(notesWithUsers as any);
      } else {
        setNotes([]);
      }
    } catch (error) {
      console.error('Error fetching notes:', error);
    }
  };

  const fetchFiles = async () => {
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from('task_files')
        .select('*')
        .eq('task_id', id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch users separately
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map((f: any) => f.user_id).filter(Boolean))];
        const { data: usersData } = userIds.length > 0
          ? await supabase.from('users').select('*').in('id', userIds)
          : { data: [] };

        const usersMap = new Map((usersData as any)?.map((u: any) => [u.id, u]) ?? []);

        const filesWithUsers = data.map((file: any) => ({
          ...file,
          user: usersMap.get(file.user_id) ?? null,
        }));

        setFiles(filesWithUsers as any);
      } else {
        setFiles([]);
      }
    } catch (error) {
      console.error('Error fetching files:', error);
    }
  };

  const handleAddComment = async () => {
    if (!id || !newComment.trim() || !user) return;

    try {
      const { error } = await ((supabase.from('task_comments') as any).insert({
        task_id: id,
        user_id: user.id,
        content: newComment.trim(),
      }) as any);

      if (error) {
        console.error('Error adding comment:', error);
        alert(`Failed to add comment: ${error.message ?? 'Unknown error'}`);
        return;
      }

      setNewComment('');
      fetchComments();
    } catch (error: any) {
      console.error('Error adding comment:', error);
      alert(`Failed to add comment: ${error?.message ?? 'Unknown error'}`);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!permissions.canDeleteComments) return;
    if (!confirm('Are you sure you want to delete this comment?')) return;

    try {
      const { error } = await ((supabase
        .from('task_comments') as any)
        .delete()
        .eq('id', commentId) as any);

      if (error) {
        console.error('Error deleting comment:', error);
        alert(`Failed to delete comment: ${error.message ?? 'Unknown error'}`);
        return;
      }

      fetchComments();
    } catch (error: any) {
      console.error('Error deleting comment:', error);
      alert(`Failed to delete comment: ${error?.message ?? 'Unknown error'}`);
    }
  };

  const handleAddNote = async () => {
    if (!id || !newNote.trim() || !user) return;

    try {
      const { error } = await ((supabase.from('task_notes') as any).insert({
        task_id: id,
        user_id: user.id,
        content: newNote,
      }) as any);

      if (error) throw error;
      setNewNote('');
      fetchNotes();
    } catch (error) {
      console.error('Error adding note:', error);
      alert('Failed to add note');
    }
  };

  const handleFileUpload = async () => {
    if (!id || !selectedFile || !user) return;

    try {
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${id}/${Date.now()}.${fileExt}`;
      const filePath = `task-files/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('task-files')
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      // Create file record
      const { error: dbError } = await ((supabase.from('task_files') as any).insert({
        task_id: id,
        user_id: user.id,
        file_name: selectedFile.name,
        file_path: filePath,
        file_size: selectedFile.size,
        mime_type: selectedFile.type,
        created_by: user.id,
      }) as any);

      if (dbError) throw dbError;

      setSelectedFile(null);
      fetchFiles();
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Failed to upload file');
    }
  };

  const handleUpdateTask = async (field: string, value: string) => {
    if (!id) return;
    
    // Check permissions based on field
    if (field === 'status' && !permissions.canUpdateTaskStatus && !permissions.canEditTasks) {
      return;
    }
    if (field !== 'status' && !permissions.canEditTasks) {
      return;
    }

    try {
      const { error } = await ((supabase
        .from('tasks') as any)
        .update({ [field]: value })
        .eq('id', id) as any);

      if (error) throw error;
      fetchTask();
    } catch (error) {
      console.error('Error updating task:', error);
      alert('Failed to update task');
    }
  };

  const handleRequestReview = async () => {
    if (!id || !user) return;

    try {
      setLoadingReview(true);
      const { error } = await requestReview(id, user.id);
      if (error) throw error;
      await fetchTask();
      alert('Review requested successfully');
    } catch (error) {
      console.error('Error requesting review:', error);
      alert('Failed to request review');
    } finally {
      setLoadingReview(false);
    }
  };

  const handleApprove = async () => {
    if (!id || !user) return;

    try {
      setLoadingReview(true);
      const { error } = await approveTask(id, user.id, reviewComment || undefined);
      if (error) throw error;
      setReviewComment('');
      await fetchTask();
      alert('Task approved successfully');
    } catch (error) {
      console.error('Error approving task:', error);
      alert('Failed to approve task');
    } finally {
      setLoadingReview(false);
    }
  };

  const handleRequestChanges = async () => {
    if (!id || !user || !reviewComment.trim()) {
      alert('Please provide comments when requesting changes');
      return;
    }

    try {
      setLoadingReview(true);
      const { error } = await requestChanges(id, user.id, reviewComment);
      if (error) throw error;
      setReviewComment('');
      await fetchTask();
      alert('Changes requested');
    } catch (error) {
      console.error('Error requesting changes:', error);
      alert('Failed to request changes');
    } finally {
      setLoadingReview(false);
    }
  };

  const renderDueDateDisplay = () => {
    if (!task?.due_date) {
      return <p className="text-sm text-muted-foreground">No due date set</p>;
    }
    const dueDateDisplay = getDueDateDisplay(task.due_date);
    if (!dueDateDisplay) {
      return <p className="text-sm text-muted-foreground">No due date set</p>;
    }
    const DueDateIcon = dueDateDisplay.icon;
    return (
      <div className={`flex items-center gap-2 px-3 py-2 rounded-md ${dueDateDisplay.bgColor} ${dueDateDisplay.color}`}>
        <DueDateIcon className="h-4 w-4" />
        <span className="text-sm font-medium">{dueDateDisplay.label}</span>
      </div>
    );
  };

  const getReviewStatusDisplay = () => {
    if (!task?.review_status || task.review_status === TaskReviewStatus.NONE) {
      return null;
    }

    const statusMap = {
      [TaskReviewStatus.WAITING_FOR_REVIEW]: { label: 'Waiting for Review', icon: Clock, color: 'text-yellow-600' },
      [TaskReviewStatus.REVIEWED_APPROVED]: { label: 'Approved', icon: CheckCircle2, color: 'text-green-600' },
      [TaskReviewStatus.CHANGES_REQUESTED]: { label: 'Changes Requested', icon: XCircle, color: 'text-red-600' },
    };

    const status = statusMap[task.review_status as keyof typeof statusMap];
    if (!status) return null;

    const Icon = status.icon;
    return (
      <div className={`flex items-center gap-2 ${status.color}`}>
        <Icon className="h-4 w-4" />
        <span className="text-sm font-medium">{status.label}</span>
      </div>
    );
  };

  if (loading) {
    return <div className="text-center py-8">Loading task...</div>;
  }

  if (!task) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground mb-4">Task not found</p>
        <Button onClick={() => navigate('/tasks')}>Back to Tasks</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" onClick={() => navigate('/tasks')}>
            ← Back to Tasks
          </Button>
          <h1 className="text-3xl font-bold mt-2">{task.title}</h1>
          {project && (
            <p className="text-muted-foreground">Project: {project.name}</p>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">
                {task.description || 'No description'}
              </p>
            </CardContent>
          </Card>

          {permissions.canAddComments && (
            <Card className="animate-in fade-in slide-in-from-bottom-4 duration-300 delay-75">
              <CardHeader>
                <CardTitle>Comments</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add a comment..."
                    rows={3}
                  />
                  <Button onClick={handleAddComment}>Post</Button>
                </div>
                <div className="space-y-4">
                  {comments.map((comment, index) => (
                    <div
                      key={comment.id}
                      className="border-l-2 pl-4 py-2 hover:bg-accent/30 rounded-r-md transition-colors duration-200"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">
                          {(comment as any).user?.full_name ?? (comment as any).user?.email ?? 'Unknown'}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {new Date(comment.created_at).toLocaleString()}
                          </span>
                          {permissions.canDeleteComments && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteComment(comment.id)}
                              className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <p className="text-sm">{comment.content}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {permissions.canAddNotes && (
            <Card className="animate-in fade-in slide-in-from-bottom-4 duration-300 delay-150">
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Add a note..."
                    rows={3}
                  />
                  <Button onClick={handleAddNote}>Add Note</Button>
                </div>
                <div className="space-y-4">
                  {notes.map((note, index) => (
                    <div
                      key={note.id}
                      className="border-l-2 pl-4 py-2 hover:bg-accent/30 rounded-r-md transition-colors duration-200"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">
                          {(note as any).user?.full_name ?? (note as any).user?.email ?? 'Unknown'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(note.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {permissions.canUploadFiles && (
            <Card className="animate-in fade-in slide-in-from-bottom-4 duration-300 delay-200">
              <CardHeader>
                <CardTitle>Files</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    type="file"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                  />
                  <Button onClick={handleFileUpload} disabled={!selectedFile}>
                    Upload
                  </Button>
                </div>
                <div className="space-y-2">
                  {files.map((file) => {
                    const fileUrl = supabase.storage
                      .from('task-files')
                      .getPublicUrl(file.file_path).data.publicUrl;
                    
                    return (
                      <div key={file.id} className="flex items-center justify-between p-2 border rounded hover:bg-accent/50 transition-colors duration-200">
                        <span className="text-sm">{file.file_name}</span>
                        <a
                          href={fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline hover:text-primary/80 transition-colors"
                        >
                          Download
                        </a>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Status: Users can update if they have canUpdateTaskStatus or canEditTasks */}
              <div className="space-y-2">
                <Label>Status</Label>
                {permissions.canUpdateTaskStatus || permissions.canEditTasks ? (
                  <Select
                    value={task.status}
                    onChange={(e) => handleUpdateTask('status', e.target.value)}
                  >
                    <option value={TaskStatus.TO_DO}>To Do</option>
                    <option value={TaskStatus.IN_PROGRESS}>In Progress</option>
                    <option value={TaskStatus.BLOCKED}>Blocked</option>
                    <option value={TaskStatus.DONE}>Done</option>
                  </Select>
                ) : (
                  (() => {
                    const statusDisplay = getTaskStatusDisplay(task.status);
                    const StatusIcon = statusDisplay.icon;
                    return (
                      <div className={`flex items-center gap-2 px-3 py-2 rounded-md ${statusDisplay.bgColor} ${statusDisplay.color}`}>
                        <StatusIcon className="h-4 w-4" />
                        <span className="text-sm font-medium">{statusDisplay.label}</span>
                      </div>
                    );
                  })()
                )}
              </div>
              
              {/* Priority: Only admins can edit */}
              <div className="space-y-2">
                <Label>Priority</Label>
                {permissions.canEditTasks ? (
                  <Select
                    value={task.priority}
                    onChange={(e) => handleUpdateTask('priority', e.target.value)}
                  >
                    <option value={TaskPriority.LOW}>Low</option>
                    <option value={TaskPriority.MEDIUM}>Medium</option>
                    <option value={TaskPriority.HIGH}>High</option>
                    <option value={TaskPriority.URGENT}>Urgent</option>
                  </Select>
                ) : (
                  (() => {
                    const priorityDisplay = getPriorityDisplay(task.priority);
                    const PriorityIcon = priorityDisplay.icon;
                    return (
                      <div className={`flex items-center gap-2 px-3 py-2 rounded-md ${priorityDisplay.bgColor} ${priorityDisplay.color}`}>
                        <PriorityIcon className="h-4 w-4" />
                        <span className="text-sm font-medium">{priorityDisplay.label}</span>
                      </div>
                    );
                  })()
                )}
              </div>
              
              {/* Due Date: Admins can edit */}
              <div className="space-y-2">
                <Label>Due Date</Label>
                {permissions.canEditTasks ? (
                  <Input
                    type="datetime-local"
                    value={task.due_date ? new Date(task.due_date).toISOString().slice(0, 16) : ''}
                    onChange={(e) => {
                      const value = e.target.value ? new Date(e.target.value).toISOString() : null;
                      handleUpdateTask('due_date', value ?? '');
                    }}
                  />
                ) : renderDueDateDisplay()}
              </div>
            </CardContent>
          </Card>

          {/* Review Section */}
          <Card>
            <CardHeader>
              <CardTitle>Review</CardTitle>
              {task.review_status && task.review_status !== TaskReviewStatus.NONE && (
                <CardDescription>{getReviewStatusDisplay()}</CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Review Status Display */}
              {task.review_status && task.review_status !== TaskReviewStatus.NONE && (
                <div className="space-y-2 text-sm">
                  {reviewRequestedBy && (
                    <div>
                      <span className="text-muted-foreground">Requested by: </span>
                      <span className="font-medium">
                        {reviewRequestedBy.full_name ?? reviewRequestedBy.email}
                      </span>
                      {task.review_requested_by && (
                        <span className="text-muted-foreground ml-2">
                          ({new Date(task.updated_at).toLocaleString()})
                        </span>
                      )}
                    </div>
                  )}
                  {reviewedBy && task.reviewed_at && (
                    <div>
                      <span className="text-muted-foreground">Reviewed by: </span>
                      <span className="font-medium">{reviewedBy.full_name ?? reviewedBy.email}</span>
                      <span className="text-muted-foreground ml-2">
                        ({new Date(task.reviewed_at).toLocaleString()})
                      </span>
                    </div>
                  )}
                  {task.review_comments && (
                    <div className="mt-2 p-3 bg-muted rounded-md">
                      <p className="text-sm whitespace-pre-wrap">{task.review_comments}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Staff: Request Review */}
              {permissions.canRequestReview && !permissions.canReviewTasks && (
                <div>
                  {task.review_status === TaskReviewStatus.NONE ||
                  task.review_status === null ||
                  task.review_status === TaskReviewStatus.CHANGES_REQUESTED ? (
                    <Button
                      onClick={handleRequestReview}
                      disabled={loadingReview}
                      className="w-full"
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Request Review
                    </Button>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Review has been requested. Waiting for admin approval.
                    </p>
                  )}
                </div>
              )}

              {/* Admin/Consultant: Review Actions */}
              {permissions.canReviewTasks && task.review_status === TaskReviewStatus.WAITING_FOR_REVIEW && (
                <div className="space-y-3">
                  <Textarea
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="Add review comments (optional for approval, required for changes)..."
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={handleApprove}
                      disabled={loadingReview}
                      variant="default"
                      className="flex-1"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Approve
                    </Button>
                    <Button
                      onClick={handleRequestChanges}
                      disabled={loadingReview || !reviewComment.trim()}
                      variant="destructive"
                      className="flex-1"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Request Changes
                    </Button>
                  </div>
                </div>
              )}

              {permissions.canReviewTasks &&
                task.review_status !== TaskReviewStatus.WAITING_FOR_REVIEW &&
                task.review_status !== TaskReviewStatus.NONE &&
                task.review_status !== null && (
                  <p className="text-sm text-muted-foreground">
                    This task has already been reviewed.
                  </p>
                )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
