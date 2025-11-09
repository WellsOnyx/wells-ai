/**
 * Real-time Update System
 * Manages WebSocket-like functionality using Server-Sent Events (SSE)
 * for agent notifications, task updates, and GRAIN milestones
 */

export type EventType =
  | 'new_task'
  | 'task_completed'
  | 'client_message'
  | 'grain_earned'
  | 'milestone'
  | 'urgent_task'
  | 'system_notification';

export interface RealtimeEvent {
  id: string;
  type: EventType;
  data: any;
  timestamp: string;
  agentId: string;
  read: boolean;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
}

export interface TaskEvent {
  taskId: string;
  taskTitle: string;
  clientName: string;
  dueDate?: string;
  grainReward?: number;
}

export interface CompletionEvent {
  taskId: string;
  taskTitle: string;
  agentName: string;
  grainEarned: number;
}

export interface GrainEvent {
  amount: number;
  reason: string;
  totalEarned: number;
}

export interface MessageEvent {
  clientName: string;
  messagePreview: string;
  messageId: string;
  urgent: boolean;
}

export interface MilestoneEvent {
  milestoneName: string;
  description: string;
  reward: number;
  badgeUrl?: string;
}

/**
 * Real-time Service
 * Manages event subscriptions and emissions
 */
export class RealtimeService {
  private subscribers: Map<string, Set<(event: RealtimeEvent) => void>> = new Map();
  private eventHistory: RealtimeEvent[] = [];
  private readonly MAX_HISTORY = 100;

  /**
   * Subscribe to real-time events for a specific agent
   */
  subscribe(agentId: string, callback: (event: RealtimeEvent) => void): () => void {
    if (!this.subscribers.has(agentId)) {
      this.subscribers.set(agentId, new Set());
    }

    this.subscribers.get(agentId)!.add(callback);

    // Return unsubscribe function
    return () => this.unsubscribe(agentId, callback);
  }

  /**
   * Unsubscribe from events
   */
  unsubscribe(agentId: string, callback?: (event: RealtimeEvent) => void): void {
    if (!callback) {
      this.subscribers.delete(agentId);
      return;
    }

    const callbacks = this.subscribers.get(agentId);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.subscribers.delete(agentId);
      }
    }
  }

  /**
   * Emit an event to subscribed agents
   */
  emit(event: RealtimeEvent): void {
    // Add to history
    this.eventHistory.unshift(event);
    if (this.eventHistory.length > this.MAX_HISTORY) {
      this.eventHistory = this.eventHistory.slice(0, this.MAX_HISTORY);
    }

    // Notify subscribers
    const callbacks = this.subscribers.get(event.agentId);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error('Error in realtime callback:', error);
        }
      });
    }

    // Also notify 'all' subscribers (admin/broadcast)
    const allCallbacks = this.subscribers.get('all');
    if (allCallbacks) {
      allCallbacks.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error('Error in realtime callback:', error);
        }
      });
    }
  }

  /**
   * Get event history for an agent
   */
  getHistory(agentId: string, limit: number = 50): RealtimeEvent[] {
    return this.eventHistory
      .filter(event => event.agentId === agentId || event.agentId === 'all')
      .slice(0, limit);
  }

  /**
   * Get unread count for an agent
   */
  getUnreadCount(agentId: string): number {
    return this.eventHistory.filter(
      event => (event.agentId === agentId || event.agentId === 'all') && !event.read
    ).length;
  }

  /**
   * Mark event as read
   */
  markAsRead(eventId: string): void {
    const event = this.eventHistory.find(e => e.id === eventId);
    if (event) {
      event.read = true;
    }
  }

  /**
   * Mark all events as read for an agent
   */
  markAllAsRead(agentId: string): void {
    this.eventHistory.forEach(event => {
      if (event.agentId === agentId || event.agentId === 'all') {
        event.read = true;
      }
    });
  }

  /**
   * Clear history for an agent
   */
  clearHistory(agentId: string): void {
    this.eventHistory = this.eventHistory.filter(
      event => event.agentId !== agentId && event.agentId !== 'all'
    );
  }

  /**
   * Get subscriber count
   */
  getSubscriberCount(): number {
    return this.subscribers.size;
  }
}

// Singleton instance
export const realtimeService = new RealtimeService();

/**
 * Event Generator for Mock Data
 */
export class MockEventGenerator {
  private intervalId?: NodeJS.Timeout;
  private agentIds: string[];

  constructor(agentIds: string[]) {
    this.agentIds = agentIds;
  }

  /**
   * Start generating mock events
   */
  start(minDelay: number = 15000, maxDelay: number = 45000): void {
    if (this.intervalId) {
      console.warn('Mock event generator already running');
      return;
    }

    const scheduleNext = () => {
      const delay = Math.random() * (maxDelay - minDelay) + minDelay;
      this.intervalId = setTimeout(() => {
        this.generateRandomEvent();
        scheduleNext();
      }, delay);
    };

    scheduleNext();
    console.log('Mock event generator started');
  }

  /**
   * Stop generating events
   */
  stop(): void {
    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = undefined;
      console.log('Mock event generator stopped');
    }
  }

  /**
   * Generate a random event
   */
  private generateRandomEvent(): void {
    const agentId = this.agentIds[Math.floor(Math.random() * this.agentIds.length)];
    const eventType = this.getRandomEventType();
    const event = this.createMockEvent(agentId, eventType);

    realtimeService.emit(event);
  }

  /**
   * Get random event type with weighted probabilities
   */
  private getRandomEventType(): EventType {
    const rand = Math.random();

    if (rand < 0.35) return 'new_task';
    if (rand < 0.60) return 'task_completed';
    if (rand < 0.75) return 'grain_earned';
    if (rand < 0.85) return 'client_message';
    if (rand < 0.92) return 'milestone';
    if (rand < 0.97) return 'urgent_task';
    return 'system_notification';
  }

  /**
   * Create mock event based on type
   */
  private createMockEvent(agentId: string, type: EventType): RealtimeEvent {
    const baseEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      timestamp: new Date().toISOString(),
      agentId,
      read: false,
    };

    switch (type) {
      case 'new_task':
        return {
          ...baseEvent,
          priority: 'medium',
          data: this.mockNewTask(),
        };

      case 'urgent_task':
        return {
          ...baseEvent,
          priority: 'urgent',
          data: this.mockUrgentTask(),
        };

      case 'task_completed':
        return {
          ...baseEvent,
          priority: 'low',
          data: this.mockTaskCompleted(),
        };

      case 'grain_earned':
        return {
          ...baseEvent,
          priority: 'medium',
          data: this.mockGrainEarned(),
        };

      case 'client_message':
        return {
          ...baseEvent,
          priority: Math.random() > 0.7 ? 'high' : 'medium',
          data: this.mockClientMessage(),
        };

      case 'milestone':
        return {
          ...baseEvent,
          priority: 'high',
          data: this.mockMilestone(),
        };

      case 'system_notification':
        return {
          ...baseEvent,
          priority: 'low',
          data: this.mockSystemNotification(),
        };

      default:
        return baseEvent as RealtimeEvent;
    }
  }

  private mockNewTask(): TaskEvent {
    const clients = ['TechCorp', 'FinanceHub', 'HealthPro', 'EduTech', 'RetailMax', 'MediaFlow'];
    const tasks = [
      'CEO Daily Brief',
      'Market Research Report',
      'Quarterly Analysis',
      'Competitor Review',
      'Legal Document Review',
      'Financial Reconciliation',
      'Customer Support Escalation',
      'Product Launch Planning',
      'Content Strategy Review',
      'Data Migration Task',
    ];

    return {
      taskId: `task_${Date.now()}`,
      taskTitle: tasks[Math.floor(Math.random() * tasks.length)],
      clientName: clients[Math.floor(Math.random() * clients.length)],
      dueDate: new Date(Date.now() + Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      grainReward: Math.floor(Math.random() * 500) + 100,
    };
  }

  private mockUrgentTask(): TaskEvent {
    const urgentTasks = [
      'URGENT: Board Meeting Prep',
      'URGENT: Crisis Response',
      'URGENT: Client Escalation',
      'URGENT: Security Incident',
      'URGENT: System Outage Response',
    ];

    return {
      taskId: `task_${Date.now()}`,
      taskTitle: urgentTasks[Math.floor(Math.random() * urgentTasks.length)],
      clientName: ['TechCorp', 'FinanceHub'][Math.floor(Math.random() * 2)],
      dueDate: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour
      grainReward: Math.floor(Math.random() * 1000) + 500,
    };
  }

  private mockTaskCompleted(): CompletionEvent {
    const agents = ['Sarah Chen', 'Marcus Rodriguez', 'Jane Kim', 'Alex Thompson', 'Maya Patel'];
    const tasks = [
      'Paralegal Research',
      'Financial Analysis',
      'Market Research',
      'Content Writing',
      'Data Entry',
      'Customer Support',
    ];

    return {
      taskId: `task_${Date.now() - 1000000}`,
      taskTitle: tasks[Math.floor(Math.random() * tasks.length)],
      agentName: agents[Math.floor(Math.random() * agents.length)],
      grainEarned: Math.floor(Math.random() * 400) + 100,
    };
  }

  private mockGrainEarned(): GrainEvent {
    const reasons = [
      'Task completion bonus',
      'Quality work reward',
      'Fast completion bonus',
      'Client satisfaction bonus',
      'Weekly milestone',
      'Perfect attendance',
    ];

    const amount = Math.floor(Math.random() * 300) + 50;

    return {
      amount,
      reason: reasons[Math.floor(Math.random() * reasons.length)],
      totalEarned: Math.floor(Math.random() * 10000) + amount,
    };
  }

  private mockClientMessage(): MessageEvent {
    const clients = ['TechCorp', 'FinanceHub', 'HealthPro', 'EduTech'];
    const messages = [
      'Can you update the timeline?',
      'Great work on the last task!',
      'Quick question about the report...',
      'Need clarification on deliverables',
      'Thanks for the fast response!',
      'When can I expect the final draft?',
    ];

    return {
      clientName: clients[Math.floor(Math.random() * clients.length)],
      messagePreview: messages[Math.floor(Math.random() * messages.length)],
      messageId: `msg_${Date.now()}`,
      urgent: Math.random() > 0.8,
    };
  }

  private mockMilestone(): MilestoneEvent {
    const milestones = [
      { name: '500 GRAIN Milestone', description: "You've earned 500 GRAIN this week!", reward: 100 },
      { name: 'Top Performer', description: 'Ranked #1 in your category!', reward: 250 },
      { name: '10 Tasks Completed', description: 'Completed 10 tasks this month', reward: 150 },
      { name: 'Perfect Week', description: '5/5 star rating for the week!', reward: 200 },
      { name: 'Fast Responder', description: 'Average response time under 2 hours', reward: 100 },
    ];

    const milestone = milestones[Math.floor(Math.random() * milestones.length)];

    return {
      milestoneName: milestone.name,
      description: milestone.description,
      reward: milestone.reward,
      badgeUrl: `/badges/${milestone.name.toLowerCase().replace(/\s+/g, '-')}.png`,
    };
  }

  private mockSystemNotification(): any {
    const notifications = [
      { title: 'System Maintenance', message: 'Scheduled maintenance tonight at 2 AM EST' },
      { title: 'New Feature', message: 'Check out our new task filtering options!' },
      { title: 'Payment Processed', message: 'Your weekly payment has been processed' },
      { title: 'Profile Update', message: 'Remember to update your availability calendar' },
    ];

    return notifications[Math.floor(Math.random() * notifications.length)];
  }
}

/**
 * Utility functions
 */
export const formatEventTimestamp = (timestamp: string): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
};

export const getEventIcon = (type: EventType): string => {
  const icons: Record<EventType, string> = {
    new_task: '📋',
    task_completed: '✅',
    client_message: '💬',
    grain_earned: '🌾',
    milestone: '🏆',
    urgent_task: '🚨',
    system_notification: '🔔',
  };

  return icons[type] || '📢';
};

export const getEventColor = (priority?: string): string => {
  switch (priority) {
    case 'urgent':
      return 'red';
    case 'high':
      return 'orange';
    case 'medium':
      return 'blue';
    case 'low':
      return 'gray';
    default:
      return 'blue';
  }
};
