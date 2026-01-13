import { UserRole } from '@/lib/supabase/types';

/**
 * RBAC Permission System
 * 
 * Defines what each role can do in the application.
 * This is enforced at:
 * - UI level (what is shown/hidden)
 * - API level (what operations are allowed)
 * - Database level (RLS policies)
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
export function getPermissions(roleName: string | null): Permissions {
  switch (roleName) {
    case UserRole.SUPER_ADMIN:
      return {
        canViewAllProjects: true,
        canCreateProjects: true,
        canEditProjects: true,
        canDeleteProjects: true,
        canViewAllTasks: true,
        canCreateTasks: true,
        canEditTasks: true,
        canAssignTasks: true,
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
      return {
        canViewAllProjects: true,
        canCreateProjects: true,
        canEditProjects: true,
        canDeleteProjects: false, // Only super_admin can delete
        canViewAllTasks: true,
        canCreateTasks: true,
        canEditTasks: true,
        canAssignTasks: true,
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
      return {
        canViewAllProjects: false, // Only assigned projects
        canCreateProjects: false,
        canEditProjects: false,
        canDeleteProjects: false,
        canViewAllTasks: false, // Only assigned tasks
        canCreateTasks: false,
        canEditTasks: false,
        canAssignTasks: false,
        canDeleteTasks: false,
        canAddComments: true,
        canDeleteComments: false, // Only admins can delete comments
        canAddNotes: true,
        canUploadFiles: true,
        canRequestReview: true,
        canReviewTasks: false, // Only admins and consultants can review
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
