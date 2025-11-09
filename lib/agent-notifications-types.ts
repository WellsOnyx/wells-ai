/**
 * Agent Notification Types
 * Shared types that can be used in both client and server components
 */

export type NotificationType =
  | 'task_assigned'
  | 'task_due'
  | 'task_overdue'
  | 'task_completed'
  | 'client_message'
  | 'client_assigned'
  | 'grain_earned'
  | 'milestone'
  | 'leaderboard'
  | 'system'
  | 'training'
  | 'feature';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface Notification {
  id: string;
  agentId: string;
  type: NotificationType;
  title: string;
  message: string;
  icon: string;
  actionUrl?: string;
  isRead: boolean;
  createdAt: string;
  priority: NotificationPriority;
  metadata?: Record<string, any>;
  snoozedUntil?: string;
}

export interface NotificationPreferences {
  agentId: string;
  emailDigest: 'none' | 'daily' | 'weekly';
  soundEnabled: boolean;
  desktopEnabled: boolean;
  quietHoursStart?: string; // HH:mm format
  quietHoursEnd?: string;
  priorityThreshold: NotificationPriority;
  enabledTypes: {
    task_assigned: boolean;
    task_due: boolean;
    task_overdue: boolean;
    task_completed: boolean;
    client_message: boolean;
    client_assigned: boolean;
    grain_earned: boolean;
    milestone: boolean;
    leaderboard: boolean;
    system: boolean;
    training: boolean;
    feature: boolean;
  };
}

export interface NotificationFilters {
  type?: NotificationType | 'all';
  status?: 'all' | 'unread' | 'read';
  priority?: NotificationPriority;
  startDate?: string;
  endDate?: string;
  search?: string;
}
