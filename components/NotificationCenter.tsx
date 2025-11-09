'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { Notification } from '@/lib/agent-notifications-types';

/**
 * Toast Notification Component
 */
function ToastNotification({
  notification,
  onClose
}: {
  notification: Notification;
  onClose: () => void;
}) {
  const priorityColors = {
    low: 'bg-blue-500',
    normal: 'bg-green-500',
    high: 'bg-orange-500',
    urgent: 'bg-red-500',
  };

  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className={`${priorityColors[notification.priority]} rounded-lg shadow-lg p-4 mb-2 animate-slide-in-right cursor-pointer hover:shadow-xl transition-shadow`}
      onClick={onClose}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl">{notification.icon}</span>
        <div className="flex-1 text-white">
          <h4 className="font-semibold text-sm">{notification.title}</h4>
          <p className="text-xs opacity-90 mt-1">{notification.message}</p>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="text-white opacity-70 hover:opacity-100"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

/**
 * Notification Center Dropdown Component
 */
export default function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toasts, setToasts] = useState<Notification[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const agentId = 'agent-001';

  // Fetch notifications
  const fetchNotifications = async () => {
    try {
      const response = await fetch(`/api/notifications?agentId=${agentId}&limit=10`);
      const data = await response.json();

      if (data.success) {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      }
    } catch (error) {
      console.error('[NotificationCenter] Fetch error:', error);
    }
  };

  // Mark as read
  const markAsRead = async (notificationId: string) => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notificationId,
          action: 'markAsRead',
        }),
      });

      // Update local state
      setNotifications(notifications.map(n =>
        n.id === notificationId ? { ...n, isRead: true } : n
      ));
      setUnreadCount(Math.max(0, unreadCount - 1));
    } catch (error) {
      console.error('[NotificationCenter] Mark as read error:', error);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'markAllAsRead',
          agentId,
        }),
      });

      // Update local state
      setNotifications(notifications.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('[NotificationCenter] Mark all as read error:', error);
    }
  };

  // Handle notification click
  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsRead(notification.id);
    }
    setIsOpen(false);
  };

  // Show toast for new notification
  const showToast = (notification: Notification) => {
    setToasts(prev => [...prev, notification]);

    // Play sound
    if (soundEnabled) {
      playNotificationSound();
    }
  };

  // Play notification sound
  const playNotificationSound = () => {
    try {
      const audio = new Audio('/notification.mp3');
      audio.volume = 0.3;
      audio.play().catch(e => console.log('[NotificationCenter] Sound play failed:', e));
    } catch (error) {
      console.log('[NotificationCenter] Sound error:', error);
    }
  };

  // Remove toast
  const removeToast = (notificationId: string) => {
    setToasts(prev => prev.filter(n => n.id !== notificationId));
  };

  // Poll for new notifications
  useEffect(() => {
    fetchNotifications();

    // Poll every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);

    return () => clearInterval(interval);
  }, []);

  // Listen for new notifications (simulated)
  useEffect(() => {
    // In production, this would use WebSocket or Server-Sent Events
    // For now, we'll just check periodically
    const checkForNew = setInterval(() => {
      fetchNotifications();
    }, 5000);

    return () => clearInterval(checkForNew);
  }, [notifications]);

  // Format time ago
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  // Priority badge color
  const getPriorityColor = (priority: string) => {
    const colors = {
      low: 'text-blue-400',
      normal: 'text-green-400',
      high: 'text-orange-400',
      urgent: 'text-red-400',
    };
    return colors[priority as keyof typeof colors] || colors.normal;
  };

  return (
    <>
      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
        <div className="pointer-events-auto">
          {toasts.map(toast => (
            <ToastNotification
              key={toast.id}
              notification={toast}
              onClose={() => removeToast(toast.id)}
            />
          ))}
        </div>
      </div>

      {/* Notification Bell Icon */}
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative p-2 text-gray-400 hover:text-white transition-colors"
          aria-label="Notifications"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>

          {/* Unread Badge */}
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Dropdown Panel */}
        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />

            {/* Panel */}
            <div className="absolute right-0 mt-2 w-96 bg-gray-800 rounded-lg shadow-2xl z-50 border border-gray-700 max-h-[80vh] flex flex-col">
              {/* Header */}
              <div className="p-4 border-b border-gray-700 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <span>🔔</span> Notifications
                </h3>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              {/* Notifications List */}
              <div className="flex-1 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-gray-400">
                    <span className="text-4xl mb-2 block">📭</span>
                    <p>No notifications yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-700">
                    {notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`p-4 hover:bg-gray-750 cursor-pointer transition-colors ${
                          !notification.isRead ? 'bg-gray-750/50' : ''
                        }`}
                        onClick={() => handleNotificationClick(notification)}
                      >
                        {notification.actionUrl ? (
                          <Link href={notification.actionUrl} className="block">
                            <NotificationItem notification={notification} formatTimeAgo={formatTimeAgo} getPriorityColor={getPriorityColor} />
                          </Link>
                        ) : (
                          <NotificationItem notification={notification} formatTimeAgo={formatTimeAgo} getPriorityColor={getPriorityColor} />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-3 border-t border-gray-700">
                <Link
                  href="/ai-ops/agent/notifications"
                  className="block text-center text-sm text-blue-400 hover:text-blue-300 py-2"
                  onClick={() => setIsOpen(false)}
                >
                  View All Notifications →
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

/**
 * Notification Item Component
 */
function NotificationItem({
  notification,
  formatTimeAgo,
  getPriorityColor,
}: {
  notification: Notification;
  formatTimeAgo: (date: string) => string;
  getPriorityColor: (priority: string) => string;
}) {
  return (
    <div className="flex items-start gap-3">
      {/* Icon */}
      <span className="text-2xl flex-shrink-0">{notification.icon}</span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-medium text-white truncate">
            {notification.title}
          </h4>
          {!notification.isRead && (
            <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1" />
          )}
        </div>

        <p className="text-xs text-gray-400 mt-1 line-clamp-2">
          {notification.message}
        </p>

        <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
          <span>{formatTimeAgo(notification.createdAt)}</span>
          {notification.priority !== 'normal' && (
            <>
              <span>•</span>
              <span className={getPriorityColor(notification.priority)}>
                {notification.priority}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
