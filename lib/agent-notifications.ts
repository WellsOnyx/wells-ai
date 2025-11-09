/**
 * Agent Notification System for AI Ops
 * Handles all notification types, storage, and management for AI agents
 */

// Re-export types from the types file
export type {
  NotificationType,
  NotificationPriority,
  Notification,
  NotificationPreferences,
  NotificationFilters,
} from './agent-notifications-types';

import type {
  NotificationType,
  NotificationPriority,
  Notification,
  NotificationPreferences,
  NotificationFilters,
} from './agent-notifications-types';

// In-memory storage (ready for database migration)
class NotificationStore {
  private notifications: Map<string, Notification> = new Map();
  private preferences: Map<string, NotificationPreferences> = new Map();
  private listeners: Set<(notification: Notification) => void> = new Set();

  constructor() {
    this.initializeMockData();
  }

  private initializeMockData() {
    const mockNotifications = this.generateMockNotifications();
    mockNotifications.forEach(notif => {
      this.notifications.set(notif.id, notif);
    });

    // Default preferences
    const defaultPrefs: NotificationPreferences = {
      agentId: 'agent-001',
      emailDigest: 'daily',
      soundEnabled: true,
      desktopEnabled: true,
      quietHoursStart: '22:00',
      quietHoursEnd: '08:00',
      priorityThreshold: 'normal',
      enabledTypes: {
        task_assigned: true,
        task_due: true,
        task_overdue: true,
        task_completed: true,
        client_message: true,
        client_assigned: true,
        grain_earned: true,
        milestone: true,
        leaderboard: true,
        system: true,
        training: true,
        feature: true,
      }
    };
    this.preferences.set('agent-001', defaultPrefs);
  }

  private generateMockNotifications(): Notification[] {
    const now = new Date();
    const notifications: Notification[] = [];
    const agentId = 'agent-001';

    const mockData = [
      // Today - Task Notifications
      {
        type: 'task_assigned' as NotificationType,
        title: 'New Task Assigned',
        message: 'CEO Daily Brief for TechCorp',
        icon: '📋',
        priority: 'high' as NotificationPriority,
        actionUrl: '/ai-ops/agent/tasks',
        hoursAgo: 1,
        isRead: false,
      },
      {
        type: 'task_due' as NotificationType,
        title: 'Task Due Soon',
        message: 'Invoice Processing due in 1 hour',
        icon: '⏰',
        priority: 'urgent' as NotificationPriority,
        actionUrl: '/ai-ops/agent/tasks',
        hoursAgo: 0.5,
        isRead: false,
      },
      {
        type: 'task_overdue' as NotificationType,
        title: 'Task Overdue',
        message: 'Security Audit is overdue',
        icon: '🚨',
        priority: 'urgent' as NotificationPriority,
        actionUrl: '/ai-ops/agent/tasks',
        hoursAgo: 2,
        isRead: false,
      },
      {
        type: 'task_completed' as NotificationType,
        title: 'Task Completed',
        message: 'You completed "Financial Report" and earned +50 GRAIN',
        icon: '✅',
        priority: 'normal' as NotificationPriority,
        actionUrl: '/ai-ops/agent/grain',
        hoursAgo: 3,
        isRead: true,
      },

      // Today - Client Messages
      {
        type: 'client_message' as NotificationType,
        title: 'New Client Message',
        message: 'TechCorp sent you a message about Q4 planning',
        icon: '💬',
        priority: 'high' as NotificationPriority,
        actionUrl: '/ai-ops/agent/clients',
        hoursAgo: 4,
        isRead: false,
      },
      {
        type: 'client_message' as NotificationType,
        title: 'Urgent Message',
        message: 'HealthCorp requested urgent assistance with payroll',
        icon: '🆘',
        priority: 'urgent' as NotificationPriority,
        actionUrl: '/ai-ops/agent/clients',
        hoursAgo: 5,
        isRead: false,
      },
      {
        type: 'client_assigned' as NotificationType,
        title: 'New Client Assigned',
        message: 'RetailCo has been assigned to you',
        icon: '🤝',
        priority: 'normal' as NotificationPriority,
        actionUrl: '/ai-ops/agent/clients',
        hoursAgo: 6,
        isRead: true,
      },

      // Today - GRAIN & Milestones
      {
        type: 'grain_earned' as NotificationType,
        title: 'GRAIN Earned',
        message: 'You earned 500 GRAIN this week!',
        icon: '🌾',
        priority: 'normal' as NotificationPriority,
        actionUrl: '/ai-ops/agent/grain',
        hoursAgo: 7,
        isRead: false,
      },
      {
        type: 'milestone' as NotificationType,
        title: 'Milestone Reached',
        message: 'Congratulations! You reached 1,000 total GRAIN',
        icon: '🏆',
        priority: 'normal' as NotificationPriority,
        actionUrl: '/ai-ops/agent/grain',
        hoursAgo: 8,
        isRead: true,
      },
      {
        type: 'leaderboard' as NotificationType,
        title: 'Leaderboard Update',
        message: 'You\'re now rank #3 on the leaderboard!',
        icon: '📊',
        priority: 'low' as NotificationPriority,
        actionUrl: '/ai-ops/agent/grain',
        hoursAgo: 9,
        isRead: true,
      },

      // Yesterday
      {
        type: 'task_assigned' as NotificationType,
        title: 'New Task Assigned',
        message: 'Market Research Analysis for StartupXYZ',
        icon: '📋',
        priority: 'normal' as NotificationPriority,
        actionUrl: '/ai-ops/agent/tasks',
        hoursAgo: 24,
        isRead: true,
      },
      {
        type: 'grain_earned' as NotificationType,
        title: 'Weekly Bonus',
        message: 'Weekly performance bonus: +100 GRAIN',
        icon: '💰',
        priority: 'normal' as NotificationPriority,
        actionUrl: '/ai-ops/agent/grain',
        hoursAgo: 25,
        isRead: true,
      },
      {
        type: 'system' as NotificationType,
        title: 'System Maintenance',
        message: 'Scheduled maintenance tomorrow 2:00 AM - 4:00 AM EST',
        icon: '⚙️',
        priority: 'normal' as NotificationPriority,
        actionUrl: '/ai-ops/agent',
        hoursAgo: 26,
        isRead: false,
      },
      {
        type: 'feature' as NotificationType,
        title: 'New Feature Available',
        message: 'AI Assistant v2 with enhanced capabilities is now live',
        icon: '✨',
        priority: 'low' as NotificationPriority,
        actionUrl: '/ai-ops/agent',
        hoursAgo: 27,
        isRead: true,
      },
      {
        type: 'client_message' as NotificationType,
        title: 'Client Feedback',
        message: 'Your client satisfaction score: 4.8/5 ⭐',
        icon: '⭐',
        priority: 'low' as NotificationPriority,
        actionUrl: '/ai-ops/agent/clients',
        hoursAgo: 28,
        isRead: true,
      },

      // This Week
      {
        type: 'training' as NotificationType,
        title: 'Training Reminder',
        message: 'Advanced Excel training starting in 15 minutes',
        icon: '📚',
        priority: 'high' as NotificationPriority,
        actionUrl: '/ai-ops/agent/training',
        hoursAgo: 48,
        isRead: true,
      },
      {
        type: 'task_completed' as NotificationType,
        title: 'Task Completed',
        message: 'You completed "Data Migration" and earned +75 GRAIN',
        icon: '✅',
        priority: 'normal' as NotificationPriority,
        actionUrl: '/ai-ops/agent/grain',
        hoursAgo: 50,
        isRead: true,
      },
      {
        type: 'client_assigned' as NotificationType,
        title: 'New Client Assigned',
        message: 'FinanceCorp has been assigned to you',
        icon: '🤝',
        priority: 'normal' as NotificationPriority,
        actionUrl: '/ai-ops/agent/clients',
        hoursAgo: 52,
        isRead: true,
      },
      {
        type: 'milestone' as NotificationType,
        title: 'Milestone Reached',
        message: '50 tasks completed this month!',
        icon: '🎯',
        priority: 'normal' as NotificationPriority,
        actionUrl: '/ai-ops/agent/tasks',
        hoursAgo: 54,
        isRead: true,
      },
      {
        type: 'task_assigned' as NotificationType,
        title: 'New Task Assigned',
        message: 'Competitor Analysis for RetailCo',
        icon: '📋',
        priority: 'normal' as NotificationPriority,
        actionUrl: '/ai-ops/agent/tasks',
        hoursAgo: 72,
        isRead: true,
      },
      {
        type: 'grain_earned' as NotificationType,
        title: 'GRAIN Earned',
        message: 'Client referral bonus: +200 GRAIN',
        icon: '🌾',
        priority: 'normal' as NotificationPriority,
        actionUrl: '/ai-ops/agent/grain',
        hoursAgo: 74,
        isRead: true,
      },
      {
        type: 'system' as NotificationType,
        title: 'System Update',
        message: 'New security features have been enabled',
        icon: '🔒',
        priority: 'normal' as NotificationPriority,
        actionUrl: '/ai-ops/agent',
        hoursAgo: 76,
        isRead: true,
      },
      {
        type: 'client_message' as NotificationType,
        title: 'Client Message',
        message: 'TechCorp thanked you for excellent work',
        icon: '💬',
        priority: 'low' as NotificationPriority,
        actionUrl: '/ai-ops/agent/clients',
        hoursAgo: 96,
        isRead: true,
      },
      {
        type: 'task_due' as NotificationType,
        title: 'Task Due Soon',
        message: 'Quarterly Review due in 2 days',
        icon: '⏰',
        priority: 'high' as NotificationPriority,
        actionUrl: '/ai-ops/agent/tasks',
        hoursAgo: 98,
        isRead: true,
      },
      {
        type: 'leaderboard' as NotificationType,
        title: 'Leaderboard Update',
        message: 'You climbed to rank #2!',
        icon: '📊',
        priority: 'normal' as NotificationPriority,
        actionUrl: '/ai-ops/agent/grain',
        hoursAgo: 100,
        isRead: true,
      },

      // Older (2+ weeks ago)
      ...Array.from({ length: 25 }, (_, i) => ({
        type: ['task_assigned', 'task_completed', 'client_message', 'grain_earned', 'milestone'][i % 5] as NotificationType,
        title: [
          'New Task Assigned',
          'Task Completed',
          'Client Message',
          'GRAIN Earned',
          'Milestone Reached'
        ][i % 5],
        message: [
          'Annual Budget Planning for Enterprise Inc',
          'You completed "Strategic Planning" and earned +100 GRAIN',
          'HealthCorp requested follow-up meeting',
          'Quality bonus: +150 GRAIN',
          '100 tasks completed all-time!'
        ][i % 5],
        icon: ['📋', '✅', '💬', '🌾', '🎯'][i % 5],
        priority: ['normal', 'normal', 'low', 'normal', 'normal'][i % 5] as NotificationPriority,
        actionUrl: '/ai-ops/agent/tasks',
        hoursAgo: 336 + (i * 24),
        isRead: true,
      }))
    ];

    mockData.forEach((item, index) => {
      const createdAt = new Date(now.getTime() - item.hoursAgo * 60 * 60 * 1000);
      notifications.push({
        id: `notif-${String(index + 1).padStart(3, '0')}`,
        agentId,
        type: item.type,
        title: item.title,
        message: item.message,
        icon: item.icon,
        priority: item.priority,
        actionUrl: item.actionUrl,
        isRead: item.isRead,
        createdAt: createdAt.toISOString(),
      });
    });

    return notifications;
  }

  getAll(): Notification[] {
    return Array.from(this.notifications.values());
  }

  getById(id: string): Notification | undefined {
    return this.notifications.get(id);
  }

  create(notification: Omit<Notification, 'id' | 'createdAt'>): Notification {
    const id = `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newNotification: Notification = {
      ...notification,
      id,
      createdAt: new Date().toISOString(),
    };

    this.notifications.set(id, newNotification);

    // Notify listeners
    this.listeners.forEach(listener => listener(newNotification));

    return newNotification;
  }

  update(id: string, updates: Partial<Notification>): Notification | undefined {
    const notification = this.notifications.get(id);
    if (!notification) return undefined;

    const updated = { ...notification, ...updates };
    this.notifications.set(id, updated);
    return updated;
  }

  delete(id: string): boolean {
    return this.notifications.delete(id);
  }

  getPreferences(agentId: string): NotificationPreferences | undefined {
    return this.preferences.get(agentId);
  }

  updatePreferences(agentId: string, updates: Partial<NotificationPreferences>): NotificationPreferences {
    const current = this.preferences.get(agentId) || this.getDefaultPreferences(agentId);
    const updated = { ...current, ...updates };
    this.preferences.set(agentId, updated);
    return updated;
  }

  private getDefaultPreferences(agentId: string): NotificationPreferences {
    return {
      agentId,
      emailDigest: 'daily',
      soundEnabled: true,
      desktopEnabled: true,
      priorityThreshold: 'normal',
      enabledTypes: {
        task_assigned: true,
        task_due: true,
        task_overdue: true,
        task_completed: true,
        client_message: true,
        client_assigned: true,
        grain_earned: true,
        milestone: true,
        leaderboard: true,
        system: true,
        training: true,
        feature: true,
      }
    };
  }

  subscribe(listener: (notification: Notification) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

// Singleton instance
const store = new NotificationStore();

/**
 * Notification Service
 * Main API for managing notifications
 */
export class AgentNotificationService {

  /**
   * Create a new notification
   */
  static createNotification(notification: Omit<Notification, 'id' | 'createdAt'>): Notification {
    const prefs = store.getPreferences(notification.agentId);

    // Check if notification type is enabled
    if (prefs && !prefs.enabledTypes[notification.type]) {
      console.log(`Notification type ${notification.type} is disabled for agent ${notification.agentId}`);
    }

    // Check priority threshold
    const priorityLevels = { low: 0, normal: 1, high: 2, urgent: 3 };
    if (prefs && priorityLevels[notification.priority] < priorityLevels[prefs.priorityThreshold]) {
      console.log(`Notification priority ${notification.priority} below threshold ${prefs.priorityThreshold}`);
    }

    return store.create(notification);
  }

  /**
   * Mark notification as read
   */
  static markAsRead(notificationId: string): Notification | undefined {
    return store.update(notificationId, { isRead: true });
  }

  /**
   * Mark all notifications as read for an agent
   */
  static markAllAsRead(agentId: string): number {
    const notifications = store.getAll().filter(n => n.agentId === agentId && !n.isRead);
    notifications.forEach(n => store.update(n.id, { isRead: true }));
    return notifications.length;
  }

  /**
   * Get notifications with optional filters
   */
  static getNotifications(agentId: string, filters?: NotificationFilters): Notification[] {
    let notifications = store.getAll().filter(n => n.agentId === agentId);

    if (filters) {
      // Filter by type
      if (filters.type && filters.type !== 'all') {
        notifications = notifications.filter(n => n.type === filters.type);
      }

      // Filter by status
      if (filters.status === 'unread') {
        notifications = notifications.filter(n => !n.isRead);
      } else if (filters.status === 'read') {
        notifications = notifications.filter(n => n.isRead);
      }

      // Filter by priority
      if (filters.priority) {
        notifications = notifications.filter(n => n.priority === filters.priority);
      }

      // Filter by date range
      if (filters.startDate) {
        const startDate = new Date(filters.startDate);
        notifications = notifications.filter(n => new Date(n.createdAt) >= startDate);
      }
      if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        notifications = notifications.filter(n => new Date(n.createdAt) <= endDate);
      }

      // Search in title and message
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        notifications = notifications.filter(n =>
          n.title.toLowerCase().includes(searchLower) ||
          n.message.toLowerCase().includes(searchLower)
        );
      }
    }

    // Sort by date (newest first)
    notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return notifications;
  }

  /**
   * Delete notification
   */
  static deleteNotification(notificationId: string): boolean {
    return store.delete(notificationId);
  }

  /**
   * Get unread count
   */
  static getUnreadCount(agentId: string): number {
    return store.getAll().filter(n => n.agentId === agentId && !n.isRead).length;
  }

  /**
   * Snooze notification
   */
  static snoozeNotification(notificationId: string, minutes: number): Notification | undefined {
    const snoozedUntil = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    return store.update(notificationId, { snoozedUntil });
  }

  /**
   * Get preferences
   */
  static getPreferences(agentId: string): NotificationPreferences | undefined {
    return store.getPreferences(agentId);
  }

  /**
   * Update preferences
   */
  static updatePreferences(agentId: string, updates: Partial<NotificationPreferences>): NotificationPreferences {
    return store.updatePreferences(agentId, updates);
  }

  /**
   * Subscribe to new notifications
   */
  static subscribe(listener: (notification: Notification) => void): () => void {
    return store.subscribe(listener);
  }

  /**
   * Group similar notifications
   */
  static groupNotifications(notifications: Notification[]): Map<string, Notification[]> {
    const groups = new Map<string, Notification[]>();

    notifications.forEach(notif => {
      const key = `${notif.type}-${new Date(notif.createdAt).toDateString()}`;
      const existing = groups.get(key) || [];
      existing.push(notif);
      groups.set(key, existing);
    });

    return groups;
  }

  /**
   * Check if in quiet hours
   */
  static isInQuietHours(agentId: string): boolean {
    const prefs = store.getPreferences(agentId);
    if (!prefs?.quietHoursStart || !prefs?.quietHoursEnd) return false;

    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    return currentTime >= prefs.quietHoursStart || currentTime <= prefs.quietHoursEnd;
  }

  /**
   * Request desktop notification permission
   */
  static async requestDesktopPermission(): Promise<boolean> {
    if (!('Notification' in window)) return false;

    if (Notification.permission === 'granted') return true;

    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  /**
   * Show desktop notification
   */
  static showDesktopNotification(notification: Notification): void {
    const prefs = store.getPreferences(notification.agentId);

    if (!prefs?.desktopEnabled) return;
    if (this.isInQuietHours(notification.agentId)) return;
    if (typeof window !== 'undefined' && Notification.permission !== 'granted') return;

    if (typeof window !== 'undefined') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.ico',
        tag: notification.id,
      });
    }
  }

  /**
   * Export notification history
   */
  static exportHistory(agentId: string): string {
    const notifications = this.getNotifications(agentId);
    return JSON.stringify(notifications, null, 2);
  }
}

export default AgentNotificationService;
