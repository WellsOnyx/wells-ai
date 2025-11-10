/**
 * useRealtime Hook
 * React hook for real-time event subscriptions and notifications
 * Features: SSE connection, toast notifications, event history, desktop notifications
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  RealtimeEvent,
  EventType,
  formatEventTimestamp,
  getEventIcon,
  getEventColor,
} from '@/lib/realtime';

export interface Toast {
  id: string;
  event: RealtimeEvent;
  visible: boolean;
  dismissed: boolean;
}

export interface UseRealtimeOptions {
  agentId: string;
  enableMock?: boolean;
  enableSound?: boolean;
  enableDesktopNotifications?: boolean;
  autoConnect?: boolean;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
  toastDuration?: number;
}

export interface UseRealtimeReturn {
  events: RealtimeEvent[];
  isConnected: boolean;
  unreadCount: number;
  toasts: Toast[];
  connect: () => void;
  disconnect: () => void;
  clearEvents: () => void;
  markAsRead: (eventId: string) => void;
  markAllAsRead: () => void;
  dismissToast: (toastId: string) => void;
  filterEvents: (type?: EventType) => RealtimeEvent[];
  getEventById: (eventId: string) => RealtimeEvent | undefined;
}

/**
 * Custom hook for real-time events
 */
export function useRealtime(options: UseRealtimeOptions): UseRealtimeReturn {
  const {
    agentId,
    enableMock = false,
    enableSound = true,
    enableDesktopNotifications = true,
    autoConnect = true,
    reconnectDelay = 3000,
    maxReconnectAttempts = 10,
    toastDuration = 5000,
  } = options;

  // State
  const [events, setEvents] = useState<RealtimeEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Refs
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  /**
   * Request desktop notification permission
   */
  useEffect(() => {
    if (enableDesktopNotifications && typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }, [enableDesktopNotifications]);

  /**
   * Initialize audio for notifications
   */
  useEffect(() => {
    if (enableSound && typeof window !== 'undefined') {
      // Create a simple beep sound using Web Audio API
      audioRef.current = new Audio();
      audioRef.current.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGGS57OajTQ0OUKXh8LdjHAU2jtT';
    }
  }, [enableSound]);

  /**
   * Play notification sound
   */
  const playNotificationSound = useCallback(() => {
    if (enableSound && audioRef.current) {
      audioRef.current.play().catch(() => {
        // User hasn't interacted with page yet
      });
    }
  }, [enableSound]);

  /**
   * Show desktop notification
   */
  const showDesktopNotification = useCallback((event: RealtimeEvent) => {
    if (
      !enableDesktopNotifications ||
      typeof window === 'undefined' ||
      !('Notification' in window) ||
      Notification.permission !== 'granted'
    ) {
      return;
    }

    const title = getNotificationTitle(event);
    const body = getNotificationBody(event);
    const icon = getEventIcon(event.type);

    try {
      const notification = new Notification(title, {
        body,
        icon: `/icons/notification-${event.type}.png`,
        badge: icon,
        tag: event.id,
        requireInteraction: event.priority === 'urgent',
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      // Auto-close after 5 seconds for non-urgent
      if (event.priority !== 'urgent') {
        setTimeout(() => notification.close(), 5000);
      }
    } catch (error) {
      console.error('Error showing desktop notification:', error);
    }
  }, [enableDesktopNotifications]);

  /**
   * Add toast notification
   */
  const addToast = useCallback((event: RealtimeEvent) => {
    const toast: Toast = {
      id: `toast_${event.id}`,
      event,
      visible: true,
      dismissed: false,
    };

    setToasts(prev => [...prev, toast]);

    // Auto-dismiss after duration
    setTimeout(() => {
      setToasts(prev =>
        prev.map(t =>
          t.id === toast.id ? { ...t, visible: false } : t
        )
      );

      // Remove from DOM after animation
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toast.id));
      }, 300);
    }, toastDuration);
  }, [toastDuration]);

  /**
   * Handle incoming event
   */
  const handleEvent = useCallback((event: RealtimeEvent) => {
    // Add to events list
    setEvents(prev => {
      // Avoid duplicates
      if (prev.some(e => e.id === event.id)) {
        return prev;
      }
      return [event, ...prev].slice(0, 50); // Keep last 50 events
    });

    // Update unread count
    setUnreadCount(prev => prev + 1);

    // Show toast notification
    addToast(event);

    // Play sound
    playNotificationSound();

    // Show desktop notification
    showDesktopNotification(event);
  }, [addToast, playNotificationSound, showDesktopNotification]);

  /**
   * Connect to SSE stream
   */
  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      console.warn('Already connected to realtime stream');
      return;
    }

    const url = `/api/realtime?agentId=${agentId}&mock=${enableMock}`;
    const eventSource = new EventSource(url);

    eventSource.onopen = () => {
      console.log('✅ Connected to realtime stream');
      setIsConnected(true);
      reconnectAttemptsRef.current = 0;
    };

    eventSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);

        if (data.type === 'connected') {
          console.log('Realtime connection established:', data.message);
          return;
        }

        if (data.type === 'history') {
          // Load historical events
          setEvents(data.events);
          setUnreadCount(data.events.filter((ev: RealtimeEvent) => !ev.read).length);
          return;
        }

        // Handle regular event
        handleEvent(data as RealtimeEvent);
      } catch (error) {
        console.error('Error parsing event data:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('❌ SSE connection error:', error);
      setIsConnected(false);

      // Close current connection
      eventSource.close();
      eventSourceRef.current = null;

      // Attempt reconnection
      if (reconnectAttemptsRef.current < maxReconnectAttempts) {
        reconnectAttemptsRef.current += 1;
        console.log(
          `Reconnecting... (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`
        );

        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, reconnectDelay);
      } else {
        console.error('Max reconnection attempts reached');
      }
    };

    eventSourceRef.current = eventSource;
  }, [agentId, enableMock, handleEvent, reconnectDelay, maxReconnectAttempts]);

  /**
   * Disconnect from SSE stream
   */
  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsConnected(false);
      console.log('Disconnected from realtime stream');
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  /**
   * Clear all events
   */
  const clearEvents = useCallback(async () => {
    try {
      const response = await fetch(`/api/realtime?agentId=${agentId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setEvents([]);
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error clearing events:', error);
    }
  }, [agentId]);

  /**
   * Mark event as read
   */
  const markAsRead = useCallback(async (eventId: string) => {
    try {
      const response = await fetch('/api/realtime', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId }),
      });

      if (response.ok) {
        setEvents(prev =>
          prev.map(e => (e.id === eventId ? { ...e, read: true } : e))
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error marking event as read:', error);
    }
  }, []);

  /**
   * Mark all events as read
   */
  const markAllAsRead = useCallback(async () => {
    try {
      const response = await fetch('/api/realtime', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, markAll: true }),
      });

      if (response.ok) {
        setEvents(prev => prev.map(e => ({ ...e, read: true })));
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error marking all events as read:', error);
    }
  }, [agentId]);

  /**
   * Dismiss toast notification
   */
  const dismissToast = useCallback((toastId: string) => {
    setToasts(prev =>
      prev.map(t => (t.id === toastId ? { ...t, visible: false, dismissed: true } : t))
    );

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== toastId));
    }, 300);
  }, []);

  /**
   * Filter events by type
   */
  const filterEvents = useCallback((type?: EventType): RealtimeEvent[] => {
    if (!type) return events;
    return events.filter(e => e.type === type);
  }, [events]);

  /**
   * Get event by ID
   */
  const getEventById = useCallback((eventId: string): RealtimeEvent | undefined => {
    return events.find(e => e.id === eventId);
  }, [events]);

  /**
   * Auto-connect on mount
   */
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    events,
    isConnected,
    unreadCount,
    toasts,
    connect,
    disconnect,
    clearEvents,
    markAsRead,
    markAllAsRead,
    dismissToast,
    filterEvents,
    getEventById,
  };
}

/**
 * Helper functions for notifications
 */
function getNotificationTitle(event: RealtimeEvent): string {
  switch (event.type) {
    case 'new_task':
      return `New Task: ${event.data.taskTitle}`;
    case 'urgent_task':
      return `🚨 URGENT: ${event.data.taskTitle}`;
    case 'task_completed':
      return `Task Completed`;
    case 'grain_earned':
      return `🌾 ${event.data.amount} GRAIN Earned!`;
    case 'client_message':
      return `Message from ${event.data.clientName}`;
    case 'milestone':
      return `🏆 ${event.data.milestoneName}`;
    case 'system_notification':
      return event.data.title || 'System Notification';
    default:
      return 'New Notification';
  }
}

function getNotificationBody(event: RealtimeEvent): string {
  switch (event.type) {
    case 'new_task':
      return `From ${event.data.clientName} • ${event.data.grainReward} GRAIN`;
    case 'urgent_task':
      return `Due in 1 hour • ${event.data.grainReward} GRAIN`;
    case 'task_completed':
      return `${event.data.agentName} completed ${event.data.taskTitle}`;
    case 'grain_earned':
      return event.data.reason;
    case 'client_message':
      return event.data.messagePreview;
    case 'milestone':
      return `${event.data.description} • +${event.data.reward} GRAIN`;
    case 'system_notification':
      return event.data.message || '';
    default:
      return 'You have a new notification';
  }
}

/**
 * Toast Component Helper Hook
 */
export function useToastStyles() {
  return {
    container: 'fixed top-4 right-4 z-50 space-y-2 max-w-md',
    toast: (visible: boolean, priority?: string) => `
      transform transition-all duration-300 ease-in-out
      ${visible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
      bg-white dark:bg-gray-800 rounded-lg shadow-lg border-l-4
      ${getBorderColor(priority)}
      p-4 flex items-start space-x-3 cursor-pointer hover:shadow-xl
    `,
    icon: (type: EventType) => `
      text-2xl flex-shrink-0
    `,
    content: 'flex-1 min-w-0',
    title: 'font-semibold text-gray-900 dark:text-white text-sm',
    message: 'text-gray-600 dark:text-gray-300 text-xs mt-1 line-clamp-2',
    timestamp: 'text-gray-400 text-xs mt-1',
    closeButton: `
      flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200
      transition-colors
    `,
  };
}

function getBorderColor(priority?: string): string {
  switch (priority) {
    case 'urgent':
      return 'border-red-500';
    case 'high':
      return 'border-orange-500';
    case 'medium':
      return 'border-blue-500';
    case 'low':
      return 'border-gray-400';
    default:
      return 'border-blue-500';
  }
}
