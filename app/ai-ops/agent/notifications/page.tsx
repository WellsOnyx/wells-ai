'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { Notification, NotificationType, NotificationPriority } from '@/lib/agent-notifications-types';

/**
 * Notifications Page - Full notification management
 */
export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  // Filters
  const [typeFilter, setTypeFilter] = useState<NotificationType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [priorityFilter, setPriorityFilter] = useState<NotificationPriority | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const pageSize = 20;

  // Preferences
  const [showPreferences, setShowPreferences] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [desktopEnabled, setDesktopEnabled] = useState(true);

  const agentId = 'agent-001';

  // Fetch notifications
  const fetchNotifications = async (resetPage = false) => {
    setLoading(true);

    try {
      const currentPage = resetPage ? 1 : page;
      const offset = (currentPage - 1) * pageSize;

      const params = new URLSearchParams({
        agentId,
        limit: String(pageSize),
        offset: String(offset),
      });

      if (typeFilter !== 'all') params.append('type', typeFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (priorityFilter !== 'all') params.append('priority', priorityFilter);
      if (searchQuery) params.append('search', searchQuery);

      const response = await fetch(`/api/notifications?${params}`);
      const data = await response.json();

      if (data.success) {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
        setHasMore(data.pagination.hasMore);
      }
    } catch (error) {
      console.error('[Notifications] Fetch error:', error);
    } finally {
      setLoading(false);
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

      setNotifications(notifications.map(n =>
        n.id === notificationId ? { ...n, isRead: true } : n
      ));
      setUnreadCount(Math.max(0, unreadCount - 1));
    } catch (error) {
      console.error('[Notifications] Mark as read error:', error);
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

      setNotifications(notifications.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('[Notifications] Mark all as read error:', error);
    }
  };

  // Delete notification
  const deleteNotification = async (notificationId: string) => {
    try {
      await fetch(`/api/notifications?notificationId=${notificationId}`, {
        method: 'DELETE',
      });

      setNotifications(notifications.filter(n => n.id !== notificationId));
    } catch (error) {
      console.error('[Notifications] Delete error:', error);
    }
  };

  // Snooze notification
  const snoozeNotification = async (notificationId: string, minutes: number) => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notificationId,
          action: 'snooze',
          minutes,
        }),
      });

      // Remove from current view
      setNotifications(notifications.filter(n => n.id !== notificationId));
    } catch (error) {
      console.error('[Notifications] Snooze error:', error);
    }
  };

  // Export history
  const exportHistory = async () => {
    try {
      const response = await fetch(`/api/notifications?agentId=${agentId}&limit=1000`);
      const data = await response.json();

      if (data.success) {
        const json = JSON.stringify(data.notifications, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `notifications-${new Date().toISOString()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('[Notifications] Export error:', error);
    }
  };

  // Request desktop permission
  const requestDesktopPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setDesktopEnabled(permission === 'granted');
    }
  };

  // Group notifications by date
  const groupByDate = (notifications: Notification[]) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 86400000);
    const thisWeek = new Date(today.getTime() - 7 * 86400000);

    const groups: { [key: string]: Notification[] } = {
      Today: [],
      Yesterday: [],
      'This Week': [],
      Older: [],
    };

    notifications.forEach(notification => {
      const date = new Date(notification.createdAt);
      const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());

      if (dateOnly.getTime() === today.getTime()) {
        groups.Today.push(notification);
      } else if (dateOnly.getTime() === yesterday.getTime()) {
        groups.Yesterday.push(notification);
      } else if (dateOnly.getTime() >= thisWeek.getTime()) {
        groups['This Week'].push(notification);
      } else {
        groups.Older.push(notification);
      }
    });

    return groups;
  };

  const groupedNotifications = groupByDate(notifications);

  // Format time
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Priority colors
  const priorityColors = {
    low: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    normal: 'text-green-400 bg-green-500/10 border-green-500/20',
    high: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    urgent: 'text-red-400 bg-red-500/10 border-red-500/20',
  };

  // Type icons
  const typeIcons: { [key in NotificationType]: string } = {
    task_assigned: '📋',
    task_due: '⏰',
    task_overdue: '🚨',
    task_completed: '✅',
    client_message: '💬',
    client_assigned: '🤝',
    grain_earned: '🌾',
    milestone: '🏆',
    leaderboard: '📊',
    system: '⚙️',
    training: '📚',
    feature: '✨',
  };

  // Effects
  useEffect(() => {
    fetchNotifications(true);
  }, [typeFilter, statusFilter, priorityFilter, searchQuery]);

  useEffect(() => {
    fetchNotifications();
  }, [page]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold flex items-center gap-3">
                <span>🔔</span> Notifications
              </h1>
              <p className="text-gray-400 mt-2">
                {unreadCount > 0 ? (
                  <>You have <span className="text-blue-400 font-semibold">{unreadCount}</span> unread notification{unreadCount !== 1 ? 's' : ''}</>
                ) : (
                  'All caught up!'
                )}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowPreferences(!showPreferences)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors flex items-center gap-2"
              >
                <span>⚙️</span> Settings
              </button>

              <button
                onClick={exportHistory}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors flex items-center gap-2"
              >
                <span>📥</span> Export
              </button>

              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors flex items-center gap-2"
                >
                  <span>✓</span> Mark All Read
                </button>
              )}
            </div>
          </div>

          {/* Preferences Panel */}
          {showPreferences && (
            <div className="bg-gray-800 rounded-lg p-6 mb-6 border border-gray-700">
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <span>⚙️</span> Notification Preferences
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-3 text-gray-300">Delivery Settings</h4>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={soundEnabled}
                        onChange={(e) => setSoundEnabled(e.target.checked)}
                        className="w-5 h-5"
                      />
                      <span>🔊 Sound notifications</span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={desktopEnabled}
                        onChange={(e) => {
                          if (e.target.checked) {
                            requestDesktopPermission();
                          } else {
                            setDesktopEnabled(false);
                          }
                        }}
                        className="w-5 h-5"
                      />
                      <span>🖥️ Desktop notifications</span>
                    </label>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-3 text-gray-300">Email Digest</h4>
                  <select className="w-full bg-gray-700 rounded-lg px-4 py-2 border border-gray-600">
                    <option value="none">None</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Type Filter */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Type</label>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as any)}
                  className="w-full bg-gray-700 rounded-lg px-3 py-2 border border-gray-600 text-sm"
                >
                  <option value="all">All Types</option>
                  <option value="task_assigned">Task Assigned</option>
                  <option value="task_due">Task Due</option>
                  <option value="task_overdue">Task Overdue</option>
                  <option value="task_completed">Task Completed</option>
                  <option value="client_message">Client Messages</option>
                  <option value="client_assigned">Client Assigned</option>
                  <option value="grain_earned">GRAIN Earned</option>
                  <option value="milestone">Milestones</option>
                  <option value="leaderboard">Leaderboard</option>
                  <option value="system">System</option>
                  <option value="training">Training</option>
                  <option value="feature">Features</option>
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="w-full bg-gray-700 rounded-lg px-3 py-2 border border-gray-600 text-sm"
                >
                  <option value="all">All</option>
                  <option value="unread">Unread</option>
                  <option value="read">Read</option>
                </select>
              </div>

              {/* Priority Filter */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Priority</label>
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value as any)}
                  className="w-full bg-gray-700 rounded-lg px-3 py-2 border border-gray-600 text-sm"
                >
                  <option value="all">All Priorities</option>
                  <option value="urgent">Urgent</option>
                  <option value="high">High</option>
                  <option value="normal">Normal</option>
                  <option value="low">Low</option>
                </select>
              </div>

              {/* Search */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Search</label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search notifications..."
                  className="w-full bg-gray-700 rounded-lg px-3 py-2 border border-gray-600 text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading && notifications.length === 0 && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            <p className="mt-4 text-gray-400">Loading notifications...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && notifications.length === 0 && (
          <div className="text-center py-12 bg-gray-800 rounded-lg border border-gray-700">
            <span className="text-6xl mb-4 block">📭</span>
            <h3 className="text-xl font-semibold mb-2">No notifications found</h3>
            <p className="text-gray-400">Try adjusting your filters</p>
          </div>
        )}

        {/* Notifications List */}
        {!loading && notifications.length > 0 && (
          <div className="space-y-6">
            {Object.entries(groupedNotifications).map(([group, groupNotifications]) => {
              if (groupNotifications.length === 0) return null;

              return (
                <div key={group}>
                  {/* Group Header */}
                  <h2 className="text-lg font-semibold text-gray-400 mb-3 flex items-center gap-2">
                    <span>📅</span> {group}
                    <span className="text-sm font-normal">({groupNotifications.length})</span>
                  </h2>

                  {/* Group Notifications */}
                  <div className="space-y-2">
                    {groupNotifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`bg-gray-800 rounded-lg p-4 border transition-all hover:border-gray-600 ${
                          notification.isRead ? 'border-gray-700' : 'border-blue-500/30 bg-gray-800/80'
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          {/* Icon */}
                          <span className="text-3xl flex-shrink-0">
                            {notification.icon || typeIcons[notification.type]}
                          </span>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <div className="flex-1">
                                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                  {notification.title}
                                  {!notification.isRead && (
                                    <span className="w-2 h-2 bg-blue-500 rounded-full" />
                                  )}
                                </h3>

                                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                  <span>{group === 'Today' ? formatTime(notification.createdAt) : formatDate(notification.createdAt)}</span>
                                  <span>•</span>
                                  <span className={`px-2 py-0.5 rounded border ${priorityColors[notification.priority]}`}>
                                    {notification.priority}
                                  </span>
                                  <span>•</span>
                                  <span className="text-gray-400">{notification.type.replace(/_/g, ' ')}</span>
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {!notification.isRead && (
                                  <button
                                    onClick={() => markAsRead(notification.id)}
                                    className="p-2 text-gray-400 hover:text-blue-400 transition-colors"
                                    title="Mark as read"
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  </button>
                                )}

                                <button
                                  onClick={() => snoozeNotification(notification.id, 60)}
                                  className="p-2 text-gray-400 hover:text-yellow-400 transition-colors"
                                  title="Snooze for 1 hour"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                </button>

                                <button
                                  onClick={() => deleteNotification(notification.id)}
                                  className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                                  title="Delete"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>

                            <p className="text-gray-300 mb-3">{notification.message}</p>

                            {notification.actionUrl && (
                              <Link
                                href={notification.actionUrl}
                                className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300"
                              >
                                View Details →
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {hasMore && !loading && (
          <div className="mt-8 flex justify-center gap-4">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              ← Previous
            </button>

            <span className="px-6 py-3 bg-gray-800 rounded-lg border border-gray-700">
              Page {page}
            </span>

            <button
              onClick={() => setPage(page + 1)}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {/* Custom Styles */}
      <style jsx global>{`
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }

        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
}
