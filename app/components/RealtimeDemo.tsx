/**
 * Real-time Demo Component
 * Example implementation of the real-time update system
 * Shows toast notifications, event feed, and connection status
 */

'use client';

import React from 'react';
import { useRealtime, useToastStyles } from '@/hooks/useRealtime';
import { RealtimeEvent, getEventIcon, formatEventTimestamp } from '@/lib/realtime';

export default function RealtimeDemo() {
  const {
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
  } = useRealtime({
    agentId: 'agent_demo',
    enableMock: true, // Enable mock events for demo
    enableSound: true,
    enableDesktopNotifications: true,
    autoConnect: true,
  });

  const toastStyles = useToastStyles();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      {/* Header */}
      <div className="max-w-4xl mx-auto mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Real-Time Update System
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Live notifications and event feed for AI agents
              </p>
            </div>

            {/* Connection Status */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div
                  className={`w-3 h-3 rounded-full ${
                    isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                  }`}
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>

              {/* Unread Badge */}
              {unreadCount > 0 && (
                <div className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                  {unreadCount}
                </div>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center space-x-3 mt-4">
            {!isConnected ? (
              <button
                onClick={connect}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                Connect
              </button>
            ) : (
              <button
                onClick={disconnect}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
              >
                Disconnect
              </button>
            )}

            <button
              onClick={markAllAsRead}
              disabled={unreadCount === 0}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Mark All Read
            </button>

            <button
              onClick={clearEvents}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
            >
              Clear All
            </button>
          </div>
        </div>
      </div>

      {/* Event Feed */}
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Event Feed
            </h2>
          </div>

          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {events.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <div className="text-4xl mb-3">📭</div>
                <p className="text-gray-500 dark:text-gray-400">
                  No events yet. Waiting for updates...
                </p>
              </div>
            ) : (
              events.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  onMarkRead={markAsRead}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Toast Notifications */}
      <div className={toastStyles.container}>
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={toastStyles.toast(toast.visible, toast.event.priority)}
            onClick={() => dismissToast(toast.id)}
          >
            <div className={toastStyles.icon(toast.event.type)}>
              {getEventIcon(toast.event.type)}
            </div>
            <div className={toastStyles.content}>
              <div className={toastStyles.title}>
                {getEventTitle(toast.event)}
              </div>
              <div className={toastStyles.message}>
                {getEventMessage(toast.event)}
              </div>
              <div className={toastStyles.timestamp}>
                {formatEventTimestamp(toast.event.timestamp)}
              </div>
            </div>
            <button
              className={toastStyles.closeButton}
              onClick={(e) => {
                e.stopPropagation();
                dismissToast(toast.id);
              }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Event Card Component
 */
function EventCard({
  event,
  onMarkRead,
}: {
  event: RealtimeEvent;
  onMarkRead: (id: string) => void;
}) {
  const priorityColors = {
    urgent: 'bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500',
    high: 'bg-orange-50 dark:bg-orange-900/20 border-l-4 border-orange-500',
    medium: 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500',
    low: 'bg-gray-50 dark:bg-gray-800 border-l-4 border-gray-400',
  };

  const priorityClass = priorityColors[event.priority || 'medium'];

  return (
    <div
      className={`px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer ${
        !event.read ? priorityClass : ''
      }`}
      onClick={() => !event.read && onMarkRead(event.id)}
    >
      <div className="flex items-start space-x-3">
        <div className="text-2xl">{getEventIcon(event.type)}</div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
              {getEventTitle(event)}
            </h3>
            {!event.read && (
              <span className="flex-shrink-0 w-2 h-2 bg-blue-600 rounded-full" />
            )}
          </div>

          <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">
            {getEventMessage(event)}
          </p>

          <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-500">
            <span>{formatEventTimestamp(event.timestamp)}</span>
            {event.priority === 'urgent' && (
              <span className="text-red-600 dark:text-red-400 font-medium">
                URGENT
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Helper functions
 */
function getEventTitle(event: RealtimeEvent): string {
  switch (event.type) {
    case 'new_task':
      return `New Task: ${event.data.taskTitle}`;
    case 'urgent_task':
      return `🚨 URGENT: ${event.data.taskTitle}`;
    case 'task_completed':
      return `Task Completed`;
    case 'grain_earned':
      return `${event.data.amount} GRAIN Earned!`;
    case 'client_message':
      return `Message from ${event.data.clientName}`;
    case 'milestone':
      return `${event.data.milestoneName}`;
    case 'system_notification':
      return event.data.title || 'System Notification';
    default:
      return 'New Notification';
  }
}

function getEventMessage(event: RealtimeEvent): string {
  switch (event.type) {
    case 'new_task':
      return `From ${event.data.clientName} • ${event.data.grainReward} GRAIN reward`;
    case 'urgent_task':
      return `Due soon • ${event.data.grainReward} GRAIN reward`;
    case 'task_completed':
      return `${event.data.agentName} completed "${event.data.taskTitle}" and earned ${event.data.grainEarned} GRAIN`;
    case 'grain_earned':
      return event.data.reason;
    case 'client_message':
      return event.data.messagePreview;
    case 'milestone':
      return `${event.data.description} • +${event.data.reward} GRAIN bonus`;
    case 'system_notification':
      return event.data.message || '';
    default:
      return 'You have a new notification';
  }
}
