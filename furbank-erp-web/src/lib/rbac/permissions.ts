import { UserRole } from '@/lib/supabase/types';

/**
 * RBAC Permission System
 * 
 * Defines what each role can do in the application.
 * This is enforced at:
 * - UI level (what is shown/hidden)
 * - API level (what operations are allowed)
 * - Database level (RLS policies)
 * 
 * Role Hierarchy:
 * 1. Super Admin - System owner, can manage everything, can assign tasks, can be assigned tasks
 * 2. Admin (Uploader/Task Capturer) - Captures tasks, assigns tasks to users, can be assigned tasks
 * 3. User (Staff) - Cannot assign tasks, can view assigned tasks, add comments, notes, upload documents, request reviews
 */

export interface Permissions {
  // Projects
  canViewAllProjects: boolean;
  canCreateProjects: boolean;
  canEditProjects: boolean;
  canDeleteProjects: boolean;
  
  // Tasks
  canViewAllTasks: boolean;
  canCreateTasks: boolean;
  canEditTasks: boolean;
  canAssignTasks: boolean;
  canDeleteTasks: boolean;
  
  // Task Interactions
  canAddComments: boolean;
  canDeleteComments: boolean;
  canAddNotes: boolean;
  canUploadFiles: boolean;
  
  // Task Status Updates
  canUpdateTaskStatus: boolean;
  
  // Task Review
  canRequestReview: boolean;
  canReviewTasks: boolean;
  
  // Users
  canViewAllUsers: boolean;
  canManageUsers: boolean;
  
  // Reports (future-ready)
  canViewReports: boolean;
}

/**
 * Get permissions for a given role
 */
/**
 * Get permissions for a given role
 * 
 * Role Descriptions:
 * - SUPER_ADMIN: System owner, can manage everything, can assign tasks, can be assigned tasks themselves
 * - ADMIN: Task capturer/uploader, responsible for capturing tasks and assigning them to users, can also be assigned tasks
 * - USER: Staff member, cannot assign tasks, can view assigned tasks, add comments/notes, upload documents, request reviews
 */
export function getPermissions(roleName: string | null): Permissions {
  switch (roleName) {
    case UserRole.SUPER_ADMIN:
      // Super Admin: Full system access
      return {
        canViewAllProjects: true,
        canCreateProjects: true,
        canEditProjects: true,
        canDeleteProjects: true,
        canViewAllTasks: true,
        canCreateTasks: true,
        canEditTasks: true,
        canAssignTasks: true, // Can assign tasks to anyone including themselves
        canDeleteTasks: true,
        canAddComments: true,
        canDeleteComments: true,
        canAddNotes: true,
        canUploadFiles: true,
        canRequestReview: true,
        canReviewTasks: true,
        canViewAllUsers: true,
        canManageUsers: false, // System-level permissions not changeable
        canViewReports: true,
        canUpdateTaskStatus: true,
      };
      
    case UserRole.ADMIN:
      // Admin (Task Capturer/Uploader): Can capture tasks, assign tasks, can be assigned tasks
      return {
        canViewAllProjects: true,
        canCreateProjects: true,
        canEditProjects: true,
        canDeleteProjects: false, // Only super_admin can delete
        canViewAllTasks: true,
        canCreateTasks: true,
        canEditTasks: true,
        canAssignTasks: true, // Core responsibility: assigning tasks to users (including themselves)
        canDeleteTasks: false, // Only super_admin can delete
        canAddComments: true,
        canDeleteComments: true,
        canAddNotes: true,
        canUploadFiles: true,
        canRequestReview: true,
        canReviewTasks: true,
        canViewAllUsers: true,
        canManageUsers: false,
        canViewReports: false, // Future feature
        canUpdateTaskStatus: true,
      };
      
    case UserRole.USER:
    default:
      // User (Staff): Cannot assign tasks, can work on assigned tasks
      return {
        canViewAllProjects: false, // Only assigned projects
        canCreateProjects: false,
        canEditProjects: false,
        canDeleteProjects: false,
        canViewAllTasks: false, // Only assigned tasks
        canCreateTasks: false,
        canEditTasks: false,
        canAssignTasks: false, // Staff cannot assign tasks - this is enforced strictly
        canDeleteTasks: false,
        canAddComments: true,
        canDeleteComments: false, // Only admins can delete comments
        canAddNotes: true,
        canUploadFiles: true,
        canRequestReview: true,
        canReviewTasks: false, // Only admins and super_admins can review
        canViewAllUsers: false,
        canManageUsers: false,
        canViewReports: false,
        canUpdateTaskStatus: true, // Users can update status on assigned tasks
      };
  }
}

/**
 * Check if user has a specific permission
 */
export function hasPermission(
  roleName: string | null,
  permission: keyof Permissions
): boolean {
  const permissions = getPermissions(roleName);
  return permissions[permission] ?? false;
}
