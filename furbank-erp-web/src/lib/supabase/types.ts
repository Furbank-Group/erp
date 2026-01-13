// TypeScript types for Supabase database
// These will be generated from your Supabase schema
// For now, defining manually based on the schema

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      roles: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      users: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          role_id: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          role_id?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          role_id?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
      };
      projects: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          status: string;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
      };
      project_members: {
        Row: {
          id: string;
          project_id: string;
          user_id: string;
          role: string;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          project_id: string;
          user_id: string;
          role?: string;
          created_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          project_id?: string;
          user_id?: string;
          role?: string;
          created_at?: string;
          created_by?: string | null;
        };
      };
      tasks: {
        Row: {
          id: string;
          project_id: string;
          title: string;
          description: string | null;
          status: string;
          assigned_to: string | null;
          due_date: string | null;
          priority: string;
          review_status: string | null;
          review_requested_by: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          review_comments: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          project_id: string;
          title: string;
          description?: string | null;
          status?: string;
          assigned_to?: string | null;
          due_date?: string | null;
          priority?: string;
          review_status?: string | null;
          review_requested_by?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          review_comments?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          project_id?: string;
          title?: string;
          description?: string | null;
          status?: string;
          assigned_to?: string | null;
          due_date?: string | null;
          priority?: string;
          review_status?: string | null;
          review_requested_by?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          review_comments?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
      };
      notifications: {
        Row: {
          id: string;
          recipient_user_id: string;
          type: string;
          title: string;
          message: string;
          related_entity_type: string | null;
          related_entity_id: string | null;
          is_read: boolean;
          created_at: string;
          read_at: string | null;
        };
        Insert: {
          id?: string;
          recipient_user_id: string;
          type: string;
          title: string;
          message: string;
          related_entity_type?: string | null;
          related_entity_id?: string | null;
          is_read?: boolean;
          created_at?: string;
          read_at?: string | null;
        };
        Update: {
          id?: string;
          recipient_user_id?: string;
          type?: string;
          title?: string;
          message?: string;
          related_entity_type?: string | null;
          related_entity_id?: string | null;
          is_read?: boolean;
          created_at?: string;
          read_at?: string | null;
        };
      };
      task_comments: {
        Row: {
          id: string;
          task_id: string;
          user_id: string;
          content: string;
          parent_comment_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          user_id: string;
          content: string;
          parent_comment_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          task_id?: string;
          user_id?: string;
          content?: string;
          parent_comment_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      task_notes: {
        Row: {
          id: string;
          task_id: string;
          user_id: string;
          content: string;
          version: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          user_id: string;
          content: string;
          version?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          task_id?: string;
          user_id?: string;
          content?: string;
          version?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      task_files: {
        Row: {
          id: string;
          task_id: string;
          user_id: string;
          file_name: string;
          file_path: string;
          file_size: number | null;
          mime_type: string | null;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          task_id: string;
          user_id: string;
          file_name: string;
          file_path: string;
          file_size?: number | null;
          mime_type?: string | null;
          created_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          task_id?: string;
          user_id?: string;
          file_name?: string;
          file_path?: string;
          file_size?: number | null;
          mime_type?: string | null;
          created_at?: string;
          created_by?: string | null;
        };
      };
    };
  };
}

// Helper types for easier usage
export type Role = Database['public']['Tables']['roles']['Row'];
export type User = Database['public']['Tables']['users']['Row'];
export type Project = Database['public']['Tables']['projects']['Row'];
export type ProjectMember = Database['public']['Tables']['project_members']['Row'];
export type Task = Database['public']['Tables']['tasks']['Row'];
export type TaskComment = Database['public']['Tables']['task_comments']['Row'];
export type TaskNote = Database['public']['Tables']['task_notes']['Row'];
export type TaskFile = Database['public']['Tables']['task_files']['Row'];
export type Notification = Database['public']['Tables']['notifications']['Row'];

// Extended types with relations
export type UserWithRole = User & {
  roles?: Role;
};

// Enums for type safety
export enum TaskStatus {
  TO_DO = 'to_do',
  IN_PROGRESS = 'in_progress',
  BLOCKED = 'blocked',
  DONE = 'done',
}

export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  USER = 'user',
}

export enum ProjectStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  ARCHIVED = 'archived',
}

export enum TaskReviewStatus {
  NONE = 'none',
  WAITING_FOR_REVIEW = 'waiting_for_review',
  REVIEWED_APPROVED = 'reviewed_approved',
  CHANGES_REQUESTED = 'changes_requested',
}

export enum NotificationType {
  TASK_ASSIGNED = 'task_assigned',
  TASK_DUE_SOON = 'task_due_soon',
  TASK_OVERDUE = 'task_overdue',
  REVIEW_REQUESTED = 'review_requested',
  REVIEW_COMPLETED = 'review_completed',
  COMMENT_ADDED = 'comment_added',
  DOCUMENT_UPLOADED = 'document_uploaded',
}
