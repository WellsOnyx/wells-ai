/**
 * Realtime Notification Bell Component
 * Drop-in component for navigation bars
 * Shows unread count and notification dropdown
 */

'use client';

import React, { useState } from 'react';
import { useRealtime } from '@/hooks/useRealtime';
import { getEventIcon, formatEventTimestamp } from '@/lib/realtime';

interface RealtimeNotificationBellProps {
  agentId: string;
  enableMock?: boolean;
}

export default function RealtimeNotificationBell({
  agentId,
  enableMock = false,
}: RealtimeNotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);

  const {
    events,
    unreadCount,
    isConnected,
    markAsRead,
    markAllAsRead,
    clearEvents,
  } = useRealtime({
    agentId,
    enableMock,
    enableSound: true,
    enableDesktopNotifications: true,
    autoConnect: true,
    toastDuration: 5000,
  });

  // Show only recent events
  const recentEvents = events.slice(0, 10);

  return (
    <div className="relative">
      {/* Bell Icon */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
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

        {/* Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}

        {/* Connection Status Indicator */}
        <span
          className={`absolute bottom-0 right-0 w-2 h-2 rounded-full ${
            isConnected ? 'bg-green-500' : 'bg-red-500'
          }`}
          title={isConnected ? 'Connected' : 'Disconnected'}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown Panel */}
          <div className="absolute right-0 mt-2 w-96 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-20 max-h-[600px] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  Notifications
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {unreadCount > 0
                    ? `${unreadCount} unread`
                    : 'All caught up!'}
                </p>
              </div>

              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>

            {/* Notifications List */}
            <div className="overflow-y-auto flex-1">
              {recentEvents.length === 0 ? (
                <div className="px-4 py-12 text-center">
                  <div className="text-4xl mb-2">🔔</div>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">
                    No notifications yet
                  </p>
                </div>
              ) : (
                recentEvents.map((event) => (
                  <div
                    key={event.id}
                    onClick={() => {
                      markAsRead(event.id);
                      // Navigate to relevant page based on event type
                      handleEventClick(event);
                    }}
                    className={`px-4 py-3 border-b border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                      !event.read ? 'bg-blue-50 dark:bg-blue-900/10' : ''
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      {/* Icon */}
                      <div className="text-2xl flex-shrink-0">
                        {getEventIcon(event.type)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-1">
                            {getEventTitle(event)}
                          </p>
                          {!event.read && (
                            <span className="flex-shrink-0 w-2 h-2 bg-blue-600 rounded-full ml-2 mt-1" />
                          )}
                        </div>

                        <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                          {getEventMessage(event)}
                        </p>

                        <div className="flex items-center space-x-2 mt-1">
                          <span className="text-xs text-gray-500 dark:text-gray-500">
                            {formatEventTimestamp(event.timestamp)}
                          </span>
                          {event.priority === 'urgent' && (
                            <span className="text-xs text-red-600 dark:text-red-400 font-medium">
                              URGENT
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            {recentEvents.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <button
                  onClick={() => {
                    // Navigate to full notifications page
                    window.location.href = '/notifications';
                  }}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  View all
                </button>

                <button
                  onClick={clearEvents}
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Handle event click - navigate to relevant page
 */
function handleEventClick(event: any) {
  switch (event.type) {
    case 'new_task':
    case 'urgent_task':
      window.location.href = `/tasks/${event.data.taskId}`;
      break;
    case 'client_message':
      window.location.href = `/messages/${event.data.messageId}`;
      break;
    case 'grain_earned':
    case 'milestone':
      window.location.href = '/earnings';
      break;
    case 'task_completed':
      window.location.href = `/tasks/${event.data.taskId}`;
      break;
    default:
      break;
  }
}

/**
 * Helper functions
 */
function getEventTitle(event: any): string {
  switch (event.type) {
    case 'new_task':
      return event.data.taskTitle;
    case 'urgent_task':
      return `🚨 ${event.data.taskTitle}`;
    case 'task_completed':
      return 'Task Completed';
    case 'grain_earned':
      return `+${event.data.amount} GRAIN`;
    case 'client_message':
      return `Message from ${event.data.clientName}`;
    case 'milestone':
      return event.data.milestoneName;
    case 'system_notification':
      return event.data.title || 'System Notification';
    default:
      return 'Notification';
  }
}

function getEventMessage(event: any): string {
  switch (event.type) {
    case 'new_task':
      return `From ${event.data.clientName} • ${event.data.grainReward} GRAIN`;
    case 'urgent_task':
      return `Due soon • ${event.data.grainReward} GRAIN`;
    case 'task_completed':
      return `${event.data.agentName} completed "${event.data.taskTitle}"`;
    case 'grain_earned':
      return event.data.reason;
    case 'client_message':
      return event.data.messagePreview;
    case 'milestone':
      return `${event.data.description} • +${event.data.reward} GRAIN`;
    case 'system_notification':
      return event.data.message || '';
    default:
      return '';
  }
}
