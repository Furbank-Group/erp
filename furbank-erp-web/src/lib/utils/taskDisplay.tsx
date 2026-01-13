import { TaskStatus, TaskPriority, ProjectStatus } from '@/lib/supabase/types';
import { 
  AlertCircle, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  Circle,
  PlayCircle,
  PauseCircle,
  Archive,
  Activity,
  Calendar,
  CalendarCheck,
  CalendarX,
  type LucideIcon
} from 'lucide-react';

// Priority display helpers
export interface PriorityDisplay {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: LucideIcon;
}

export function getPriorityDisplay(priority: string): PriorityDisplay {
  switch (priority) {
    case TaskPriority.URGENT:
      return {
        label: 'Urgent',
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-500',
        icon: AlertCircle,
      };
    case TaskPriority.HIGH:
      return {
        label: 'High',
        color: 'text-orange-600',
        bgColor: 'bg-orange-50',
        borderColor: 'border-orange-500',
        icon: AlertTriangle,
      };
    case TaskPriority.MEDIUM:
      return {
        label: 'Medium',
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-500',
        icon: Clock,
      };
    case TaskPriority.LOW:
    default:
      return {
        label: 'Low',
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-500',
        icon: Circle,
      };
  }
}

// Task status display helpers
export interface StatusDisplay {
  label: string;
  color: string;
  bgColor: string;
  icon: LucideIcon;
}

export function getTaskStatusDisplay(status: string): StatusDisplay {
  switch (status) {
    case TaskStatus.TO_DO:
      return {
        label: 'To Do',
        color: 'text-gray-600',
        bgColor: 'bg-gray-100',
        icon: Circle,
      };
    case TaskStatus.IN_PROGRESS:
      return {
        label: 'In Progress',
        color: 'text-blue-600',
        bgColor: 'bg-blue-100',
        icon: PlayCircle,
      };
    case TaskStatus.BLOCKED:
      return {
        label: 'Blocked',
        color: 'text-red-600',
        bgColor: 'bg-red-100',
        icon: PauseCircle,
      };
    case TaskStatus.DONE:
      return {
        label: 'Done',
        color: 'text-green-600',
        bgColor: 'bg-green-100',
        icon: CheckCircle2,
      };
    default:
      return {
        label: status.replace('_', ' '),
        color: 'text-gray-600',
        bgColor: 'bg-gray-100',
        icon: Circle,
      };
  }
}

// Project status display helpers
export interface ProjectStatusDisplay {
  label: string;
  color: string;
  bgColor: string;
  icon: LucideIcon;
}

export function getProjectStatusDisplay(status: string): ProjectStatusDisplay {
  switch (status) {
    case ProjectStatus.ACTIVE:
      return {
        label: 'Active',
        color: 'text-green-600',
        bgColor: 'bg-green-100',
        icon: Activity,
      };
    case ProjectStatus.COMPLETED:
      return {
        label: 'Completed',
        color: 'text-blue-600',
        bgColor: 'bg-blue-100',
        icon: CheckCircle2,
      };
    case ProjectStatus.ARCHIVED:
      return {
        label: 'Archived',
        color: 'text-gray-600',
        bgColor: 'bg-gray-100',
        icon: Archive,
      };
    default:
      return {
        label: status,
        color: 'text-gray-600',
        bgColor: 'bg-gray-100',
        icon: Circle,
      };
  }
}

// Due date display helpers
export interface DueDateDisplay {
  label: string;
  color: string;
  bgColor: string;
  icon: LucideIcon;
  isOverdue: boolean;
  isDueSoon: boolean;
}

export function getDueDateDisplay(dueDate: string | null | undefined): DueDateDisplay | null {
  if (!dueDate) return null;

  const due = new Date(dueDate);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDateOnly = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  
  const diffTime = dueDateOnly.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    // Overdue
    return {
      label: `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'}`,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      icon: CalendarX,
      isOverdue: true,
      isDueSoon: false,
    };
  } else if (diffDays === 0) {
    // Due today
    return {
      label: 'Due today',
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      icon: Calendar,
      isOverdue: false,
      isDueSoon: true,
    };
  } else if (diffDays <= 3) {
    // Due soon (within 3 days)
    return {
      label: `Due in ${diffDays} day${diffDays === 1 ? '' : 's'}`,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      icon: CalendarCheck,
      isOverdue: false,
      isDueSoon: true,
    };
  } else {
    // Due later
    return {
      label: due.toLocaleDateString(),
      color: 'text-gray-600',
      bgColor: 'bg-gray-50',
      icon: Calendar,
      isOverdue: false,
      isDueSoon: false,
    };
  }
}
