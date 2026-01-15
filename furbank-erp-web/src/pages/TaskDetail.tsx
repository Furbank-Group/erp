import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';
import type { Task, TaskComment, TaskNote, TaskFile, Project, UserWithRole } from '@/lib/supabase/types';
import { TaskStatus, TaskReviewStatus, UserRole } from '@/lib/supabase/types';
import { requestReview, approveTask, requestChanges } from '@/lib/services/taskReviewService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { CheckCircle2, XCircle, Clock, MessageSquare, Trash2, Archive, FileText, Image, File, Download } from 'lucide-react';
import { getPriorityDisplay, getTaskStatusDisplay, getDueDateDisplay } from '@/lib/utils/taskDisplay';
import { isTaskClosed } from '@/lib/services/projectService';

export function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, permissions, role } = useAuth();
  const [task, setTask] = useState<Task | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [notes, setNotes] = useState<TaskNote[]>([]);
  const [files, setFiles] = useState<TaskFile[]>([]);
  const [assignedUser, setAssignedUser] = useState<UserWithRole | null>(null);
  const [taskUsers, setTaskUsers] = useState<UserWithRole[]>([]);
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

  // Fetch task users when task, comments, notes, or files are loaded
  useEffect(() => {
    if (task && id) {
      fetchTaskUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id, comments.length, notes.length, files.length, id]);

  const fetchTask = async () => {
    if (!id) return;
    try {
      // Use left join to handle standalone tasks (where project_id is NULL)
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          projects!left (*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setTask(data);

      // Use the joined project data (it respects RLS policies)
      // For standalone tasks, project will be null
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
      } else {
        // Standalone task - no project
        setProject(null);
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

      // Fetch assigned user
      if (taskData.assigned_to) {
        const { data: assignedUserData } = await supabase
          .from('users')
          .select('*')
          .eq('id', taskData.assigned_to)
          .single();
        if (assignedUserData) {
          const { data: assignedUserRole } = await supabase
            .from('roles')
            .select('*')
            .eq('id', (assignedUserData as any).role_id)
            .single();
          setAssignedUser({ ...(assignedUserData as any), roles: assignedUserRole ?? undefined } as UserWithRole);
        }
      }
    } catch (error) {
      console.error('Error fetching task:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTaskUsers = async () => {
    if (!id || !task) return;
    try {
      const userIds = new Set<string>();
      
      // Add assigned user if exists
      if (task.assigned_to) {
        userIds.add(task.assigned_to);
      }
      
      // Add user IDs from comments
      comments.forEach((comment) => {
        if ((comment as any).user_id) {
          userIds.add((comment as any).user_id);
        }
      });
      
      // Add user IDs from notes
      notes.forEach((note) => {
        if ((note as any).user_id) {
          userIds.add((note as any).user_id);
        }
      });
      
      // Add user IDs from files
      files.forEach((file) => {
        if ((file as any).user_id) {
          userIds.add((file as any).user_id);
        }
      });

      if (userIds.size > 0) {
        const userIdsArray = Array.from(userIds);
        const { data: usersData, error } = await supabase
          .from('users')
          .select('*')
          .in('id', userIdsArray);

        if (error) throw error;

        if (usersData && usersData.length > 0) {
          // Fetch roles for each user
          const usersWithRoles = await Promise.all(
            usersData.map(async (user: any) => {
              if (user.role_id) {
                const { data: roleData } = await supabase
                  .from('roles')
                  .select('*')
                  .eq('id', user.role_id)
                  .single();
                return { ...user, roles: roleData ?? undefined } as UserWithRole;
              }
              return { ...user } as UserWithRole;
            })
          );
          setTaskUsers(usersWithRoles);
        } else {
          setTaskUsers([]);
        }
      } else {
        setTaskUsers([]);
      }
    } catch (error) {
      console.error('Error fetching task users:', error);
      setTaskUsers([]);
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

      // Fetch users separately and generate signed URLs for files
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map((f: any) => f.user_id).filter(Boolean))];
        const { data: usersData } = userIds.length > 0
          ? await supabase.from('users').select('*').in('id', userIds)
          : { data: [] };

        const usersMap = new Map((usersData as any)?.map((u: any) => [u.id, u]) ?? []);

        // Generate signed URLs for each file (required for private buckets)
        const filesWithUsers = await Promise.all(
          data.map(async (file: any) => {
            const path = file.file_path.startsWith('task-files/') 
              ? file.file_path.replace('task-files/', '') 
              : file.file_path;
            
            // Generate signed URL (valid for 1 hour)
            const { data: signedUrlData } = await supabase.storage
              .from('task-files')
              .createSignedUrl(path, 3600);
            
            return {
              ...file,
              user: usersMap.get(file.user_id) ?? null,
              signedUrl: signedUrlData?.signedUrl ?? null,
            };
          })
        );

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
      // Don't include bucket name in path - Supabase adds it automatically
      const filePath = fileName;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('task-files')
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      // Create file record
      // Store path without bucket name (bucket is specified in .from() call)
      const { error: dbError } = await ((supabase.from('task_files') as any).insert({
        task_id: id,
        user_id: user.id,
        file_name: selectedFile.name,
        file_path: filePath, // Store path without bucket prefix
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
    if (!id || !user) return;
    
    // Enforce immutability: only status updates are allowed, and only by assigned user
    if (field !== 'status') {
      alert('Tasks cannot be edited after creation. Only status updates are allowed.');
      return;
    }

    // Check if user is assigned to this task
    if (task && task.assigned_to !== user.id) {
      alert('Only the assigned user can update task status.');
      return;
    }

    // Check permissions
    if (!permissions.canUpdateTaskStatus) {
      alert('You do not have permission to update task status.');
      return;
    }

    // Use progress logging service for status updates
    try {
      const { addProgressLog } = await import('@/lib/services/taskProgressService');
      const { error } = await addProgressLog(id, user.id, value as any);
      
      if (error) {
        throw error;
      }
      
      fetchTask();
    } catch (error: any) {
      console.error('Error updating task status:', error);
      alert(error?.message ?? 'Failed to update task status');
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
      [TaskReviewStatus.PENDING_REVIEW]: { label: 'Pending Review', icon: Clock, color: 'text-yellow-600' },
      [TaskReviewStatus.UNDER_REVIEW]: { label: 'Under Review', icon: Clock, color: 'text-blue-600' },
      [TaskReviewStatus.REVIEWED_APPROVED]: { label: 'Reviewed / Approved', icon: CheckCircle2, color: 'text-green-600' },
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

  const taskIsClosed = task ? isTaskClosed(task) : false;
  const closedByProject = task ? (task as any).closed_reason === 'project_closed' : false;
  const closedAt = task ? (task as any).closed_at : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" onClick={() => navigate('/tasks')}>
            ← Back to Tasks
          </Button>
          <h1 className="text-3xl font-bold mt-2">{task.title}</h1>
          {project ? (
            <p className="text-muted-foreground">Project: {project.name}</p>
          ) : (
            <p className="text-muted-foreground italic">Standalone Task (No Project)</p>
          )}
        </div>
      </div>

      {taskIsClosed && (
        <Card className="border-2 border-gray-400 bg-gray-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Archive className="h-5 w-5 text-gray-600" />
              <div>
                <p className="font-medium text-gray-900">This task is closed</p>
                <p className="text-sm text-muted-foreground">
                  {closedByProject 
                    ? 'Task was closed because the project is closed. It will be reactivated when the project is reopened.'
                    : 'This task has been manually closed and is now read-only.'}
                  {closedAt && (
                    <span className="block mt-1">
                      Closed on {new Date(closedAt).toLocaleString()}
                    </span>
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
                {!taskIsClosed && (task.assigned_to === user?.id || role === UserRole.SUPER_ADMIN) && (
                  <div className="flex gap-2">
                    <Textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Add a comment..."
                      rows={3}
                    />
                    <Button onClick={handleAddComment}>Post</Button>
                  </div>
                )}
                {!taskIsClosed && task.assigned_to !== user?.id && role !== UserRole.SUPER_ADMIN && (
                  <div className="text-sm text-muted-foreground bg-gray-50 p-3 rounded-md">
                    Only the assigned user or Super Admin can add comments.
                  </div>
                )}
                {taskIsClosed && (
                  <div className="text-sm text-muted-foreground bg-gray-50 p-3 rounded-md">
                    Comments are disabled for closed tasks.
                  </div>
                )}
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
                {!taskIsClosed && (task.assigned_to === user?.id || role === UserRole.SUPER_ADMIN) && (
                  <div className="flex gap-2">
                    <Textarea
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="Add a note..."
                      rows={3}
                    />
                    <Button onClick={handleAddNote}>Add Note</Button>
                  </div>
                )}
                {!taskIsClosed && task.assigned_to !== user?.id && role !== UserRole.SUPER_ADMIN && (
                  <div className="text-sm text-muted-foreground bg-gray-50 p-3 rounded-md">
                    Only the assigned user or Super Admin can add notes.
                  </div>
                )}
                {taskIsClosed && (
                  <div className="text-sm text-muted-foreground bg-gray-50 p-3 rounded-md">
                    Notes are disabled for closed tasks.
                  </div>
                )}
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
                <CardDescription>
                  Allowed file types: PDF, JPEG, PNG, DOC, DOCX, XLS, XLSX
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!taskIsClosed && (task.assigned_to === user?.id || role === UserRole.SUPER_ADMIN) && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input
                        type="file"
                        onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                      />
                      <Button onClick={handleFileUpload} disabled={!selectedFile}>
                        Upload
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Only PDF, JPEG, PNG, DOC, DOCX, XLS, and XLSX files are allowed.
                    </p>
                  </div>
                )}
                {!taskIsClosed && task.assigned_to !== user?.id && role !== UserRole.SUPER_ADMIN && (
                  <div className="text-sm text-muted-foreground bg-gray-50 p-3 rounded-md">
                    Only the assigned user or Super Admin can upload files.
                  </div>
                )}
                {taskIsClosed && (
                  <div className="text-sm text-muted-foreground bg-gray-50 p-3 rounded-md">
                    File uploads are disabled for closed tasks.
                  </div>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {files.map((file) => {
                    // Use signed URL if available (for private buckets), otherwise fallback to public URL
                    const path = file.file_path.startsWith('task-files/') 
                      ? file.file_path.replace('task-files/', '') 
                      : file.file_path;
                    const fileUrl = (file as any).signedUrl ?? supabase.storage
                      .from('task-files')
                      .getPublicUrl(path).data.publicUrl;
                    
                    // Determine file type
                    const fileExt = file.file_name.split('.').pop()?.toLowerCase() ?? '';
                    const isImage = ['jpg', 'jpeg', 'png'].includes(fileExt);
                    const isPdf = fileExt === 'pdf';
                    const isDoc = ['doc', 'docx'].includes(fileExt);
                    const isXls = ['xls', 'xlsx'].includes(fileExt);
                    
                    // Get file icon
                    let FileIcon = File;
                    if (isPdf) FileIcon = FileText;
                    else if (isDoc) FileIcon = FileText;
                    else if (isXls) FileIcon = FileText;
                    else if (isImage) FileIcon = Image;
                    
                    return (
                      <a
                        key={file.id}
                        href={fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group relative block border rounded-lg overflow-hidden hover:shadow-md transition-all duration-200 bg-card"
                      >
                        {isImage ? (
                          // Show thumbnail for images
                          <div className="aspect-square relative bg-muted">
                            <img
                              src={fileUrl}
                              alt={file.file_name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                // Fallback to icon if image fails to load
                                (e.target as HTMLImageElement).style.display = 'none';
                                (e.target as HTMLImageElement).parentElement!.innerHTML = `
                                  <div class="w-full h-full flex items-center justify-center">
                                    <svg class="w-12 h-12 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                    </svg>
                                  </div>
                                `;
                              }}
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                              <Download className="h-6 w-6 text-white drop-shadow-lg" />
                            </div>
                          </div>
                        ) : (
                          // Show icon for non-image files
                          <div className="aspect-square flex flex-col items-center justify-center bg-muted p-4 group-hover:bg-accent/50 transition-colors">
                            <FileIcon className="h-12 w-12 text-muted-foreground group-hover:text-primary transition-colors mb-2" />
                            <Download className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2" />
                          </div>
                        )}
                        <div className="p-2 border-t bg-card">
                          <p className="text-xs font-medium truncate" title={file.file_name}>
                            {file.file_name}
                          </p>
                          {file.file_size && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {(file.file_size / 1024).toFixed(1)} KB
                            </p>
                          )}
                        </div>
                      </a>
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
              {/* Assigned User */}
              {assignedUser && (
                <div className="space-y-2">
                  <Label>Assigned To</Label>
                  <div className="text-sm">
                    <p className="font-medium">{assignedUser.full_name ?? assignedUser.email ?? 'Unknown'}</p>
                    {(assignedUser as any).roles && (
                      <p className="text-xs text-muted-foreground capitalize">
                        {((assignedUser as any).roles as { name: string }).name.replace('_', ' ')}
                      </p>
                    )}
                  </div>
                </div>
              )}
              
              {/* Team Members */}
              {taskUsers.length > 0 && (
                <div className="space-y-2">
                  <Label>Team Members</Label>
                  <div className="space-y-2">
                    {taskUsers.map((user) => {
                      const role = (user as any).roles as { name: string } | null;
                      const isAssigned = user.id === task?.assigned_to;
                      return (
                        <div key={user.id} className="text-sm">
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate">
                              {user.full_name ?? user.email ?? 'Unknown'}
                            </p>
                            {isAssigned && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary shrink-0">
                                Assigned
                              </span>
                            )}
                          </div>
                          {role && (
                            <p className="text-xs text-muted-foreground capitalize">
                              {role.name.replace('_', ' ')}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {/* Status: Only assigned user can update, and only if task is not closed */}
              <div className="space-y-2">
                <Label>Status</Label>
                {permissions.canUpdateTaskStatus && task.assigned_to === user?.id && !taskIsClosed ? (
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
                {task.assigned_to !== user?.id && (
                  <p className="text-xs text-muted-foreground">
                    Only the assigned user can update status
                  </p>
                )}
              </div>
              
              {/* Priority: Immutable after creation */}
              <div className="space-y-2">
                <Label>Priority</Label>
                {(() => {
                  const priorityDisplay = getPriorityDisplay(task.priority);
                  const PriorityIcon = priorityDisplay.icon;
                  return (
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-md ${priorityDisplay.bgColor} ${priorityDisplay.color}`}>
                      <PriorityIcon className="h-4 w-4" />
                      <span className="text-sm font-medium">{priorityDisplay.label}</span>
                    </div>
                  );
                })()}
                <p className="text-xs text-muted-foreground">
                  Priority cannot be changed after task creation
                </p>
              </div>
              
              {/* Due Date: Immutable after creation */}
              <div className="space-y-2">
                <Label>Due Date</Label>
                {renderDueDateDisplay()}
                <p className="text-xs text-muted-foreground">
                  Due date cannot be changed after task creation
                </p>
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

              {/* Staff: Request Review - Only assigned user, disabled for closed tasks */}
              {permissions.canRequestReview && !permissions.canReviewTasks && !taskIsClosed && task.assigned_to === user?.id && (
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
                      Review has been requested. Waiting for Super Admin approval.
                    </p>
                  )}
                </div>
              )}
              {permissions.canRequestReview && !permissions.canReviewTasks && !taskIsClosed && task.assigned_to !== user?.id && (
                <div className="text-sm text-muted-foreground bg-gray-50 p-3 rounded-md">
                  Only the assigned user can request review.
                </div>
              )}

              {/* Super Admin: Review Actions */}
              {permissions.canReviewTasks && task.review_status === TaskReviewStatus.PENDING_REVIEW && (
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
              {permissions.canReviewTasks && task.review_status === TaskReviewStatus.UNDER_REVIEW && (
                <p className="text-sm text-muted-foreground">
                  This task is currently under review.
                </p>
              )}

              {permissions.canReviewTasks &&
                task.review_status !== TaskReviewStatus.PENDING_REVIEW &&
                task.review_status !== TaskReviewStatus.UNDER_REVIEW &&
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
