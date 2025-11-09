# Real-Time Update System Integration Guide

## Overview

A complete real-time notification and update system using Server-Sent Events (SSE) to keep AI agents informed of new tasks, messages, GRAIN earnings, and system updates.

## Features Implemented

### Core Features
- ✅ Server-Sent Events (SSE) for real-time updates
- ✅ Auto-reconnect with exponential backoff
- ✅ Event history management (last 100 events)
- ✅ Read/unread tracking
- ✅ Priority-based events (low, medium, high, urgent)
- ✅ Mock event generator for testing

### Notification Features
- ✅ Toast notifications with auto-dismiss
- ✅ Desktop notifications (browser API)
- ✅ Sound notifications
- ✅ Badge count on unread events
- ✅ Click to dismiss or mark as read
- ✅ Slide-in animation from top-right

### Event Types
1. **new_task** - New task assigned to agent
2. **urgent_task** - High-priority task with deadline
3. **task_completed** - Another agent completed a task
4. **grain_earned** - GRAIN milestone or bonus
5. **client_message** - Message from client
6. **milestone** - Achievement unlocked
7. **system_notification** - System updates

## File Structure

```
/Users/jonahmanning/Downloads/wells-ai-github-ready/
├── lib/
│   └── realtime.ts                    # Core service & types (508 lines)
├── app/
│   ├── api/
│   │   └── realtime/
│   │       └── route.ts               # API endpoints (239 lines)
│   └── components/
│       └── RealtimeDemo.tsx           # Demo component (277 lines)
└── hooks/
    └── useRealtime.ts                 # React hook (491 lines)

Total: 1,515 lines of code
```

## Quick Start

### 1. Basic Usage

```tsx
'use client';

import { useRealtime } from '@/hooks/useRealtime';

export default function MyComponent() {
  const {
    events,
    isConnected,
    unreadCount,
    toasts,
    markAsRead,
    markAllAsRead,
  } = useRealtime({
    agentId: 'agent_123',
    enableMock: true, // Enable mock events for testing
    enableSound: true,
    enableDesktopNotifications: true,
    autoConnect: true,
  });

  return (
    <div>
      <div>Status: {isConnected ? 'Connected' : 'Disconnected'}</div>
      <div>Unread: {unreadCount}</div>

      {/* Your event feed UI */}
      {events.map(event => (
        <div key={event.id} onClick={() => markAsRead(event.id)}>
          {event.type}: {event.data.taskTitle}
        </div>
      ))}
    </div>
  );
}
```

### 2. Server-Side Event Emission

```typescript
// Send event from any API route
const response = await fetch('/api/realtime', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'new_task',
    agentId: 'agent_123',
    priority: 'high',
    data: {
      taskId: 'task_456',
      taskTitle: 'CEO Daily Brief',
      clientName: 'TechCorp',
      grainReward: 350,
    },
  }),
});
```

### 3. Custom Toast Notifications

```tsx
import { useRealtime, useToastStyles } from '@/hooks/useRealtime';
import { getEventIcon } from '@/lib/realtime';

function MyToasts() {
  const { toasts, dismissToast } = useRealtime({ agentId: 'agent_123' });
  const styles = useToastStyles();

  return (
    <div className={styles.container}>
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={styles.toast(toast.visible, toast.event.priority)}
          onClick={() => dismissToast(toast.id)}
        >
          <div className={styles.icon(toast.event.type)}>
            {getEventIcon(toast.event.type)}
          </div>
          <div className={styles.content}>
            <div className={styles.title}>New Task</div>
            <div className={styles.message}>{toast.event.data.taskTitle}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
```

## API Reference

### useRealtime Hook

#### Parameters
```typescript
interface UseRealtimeOptions {
  agentId: string;                    // Required: Agent identifier
  enableMock?: boolean;               // Enable mock events (default: false)
  enableSound?: boolean;              // Play sound on notification (default: true)
  enableDesktopNotifications?: boolean; // Browser notifications (default: true)
  autoConnect?: boolean;              // Auto-connect on mount (default: true)
  reconnectDelay?: number;            // Delay between reconnects (default: 3000ms)
  maxReconnectAttempts?: number;      // Max reconnect attempts (default: 10)
  toastDuration?: number;             // Auto-dismiss time (default: 5000ms)
}
```

#### Return Values
```typescript
interface UseRealtimeReturn {
  events: RealtimeEvent[];            // All events
  isConnected: boolean;               // Connection status
  unreadCount: number;                // Unread event count
  toasts: Toast[];                    // Active toast notifications
  connect: () => void;                // Manually connect
  disconnect: () => void;             // Disconnect from stream
  clearEvents: () => void;            // Clear all events
  markAsRead: (eventId: string) => void;  // Mark single event as read
  markAllAsRead: () => void;          // Mark all as read
  dismissToast: (toastId: string) => void; // Dismiss toast
  filterEvents: (type?: EventType) => RealtimeEvent[]; // Filter by type
  getEventById: (eventId: string) => RealtimeEvent | undefined; // Get event
}
```

### RealtimeService Class

```typescript
import { realtimeService } from '@/lib/realtime';

// Subscribe to events
const unsubscribe = realtimeService.subscribe('agent_123', (event) => {
  console.log('New event:', event);
});

// Emit event
realtimeService.emit({
  id: 'evt_123',
  type: 'new_task',
  data: { taskTitle: 'Test Task' },
  timestamp: new Date().toISOString(),
  agentId: 'agent_123',
  read: false,
  priority: 'medium',
});

// Get history
const history = realtimeService.getHistory('agent_123', 50);

// Get unread count
const count = realtimeService.getUnreadCount('agent_123');

// Mark as read
realtimeService.markAsRead('evt_123');
realtimeService.markAllAsRead('agent_123');

// Cleanup
unsubscribe();
```

### API Endpoints

#### GET /api/realtime
Subscribe to SSE stream
```bash
# Query parameters:
# - agentId: Agent identifier
# - mock: Enable mock events (true/false)

curl "http://localhost:3000/api/realtime?agentId=agent_123&mock=true"
```

#### POST /api/realtime
Emit event to connected clients
```bash
curl -X POST http://localhost:3000/api/realtime \
  -H "Content-Type: application/json" \
  -d '{
    "type": "new_task",
    "agentId": "agent_123",
    "priority": "high",
    "data": {
      "taskId": "task_456",
      "taskTitle": "CEO Daily Brief",
      "clientName": "TechCorp",
      "grainReward": 350
    }
  }'
```

#### PATCH /api/realtime
Mark events as read
```bash
# Mark single event as read
curl -X PATCH http://localhost:3000/api/realtime \
  -H "Content-Type: application/json" \
  -d '{"eventId": "evt_123"}'

# Mark all events as read
curl -X PATCH http://localhost:3000/api/realtime \
  -H "Content-Type: application/json" \
  -d '{"agentId": "agent_123", "markAll": true}'
```

#### DELETE /api/realtime
Clear event history
```bash
curl -X DELETE "http://localhost:3000/api/realtime?agentId=agent_123"
```

## Event Data Structures

### New Task Event
```typescript
{
  type: 'new_task',
  data: {
    taskId: 'task_456',
    taskTitle: 'CEO Daily Brief',
    clientName: 'TechCorp',
    dueDate: '2025-11-15T10:00:00Z',
    grainReward: 350
  }
}
```

### Urgent Task Event
```typescript
{
  type: 'urgent_task',
  priority: 'urgent',
  data: {
    taskId: 'task_789',
    taskTitle: 'URGENT: Board Meeting Prep',
    clientName: 'FinanceHub',
    dueDate: '2025-11-09T14:00:00Z', // 1 hour from now
    grainReward: 750
  }
}
```

### Task Completed Event
```typescript
{
  type: 'task_completed',
  data: {
    taskId: 'task_123',
    taskTitle: 'Paralegal Research',
    agentName: 'Sarah Chen',
    grainEarned: 250
  }
}
```

### GRAIN Earned Event
```typescript
{
  type: 'grain_earned',
  data: {
    amount: 150,
    reason: 'Quality work reward',
    totalEarned: 5150
  }
}
```

### Client Message Event
```typescript
{
  type: 'client_message',
  data: {
    clientName: 'TechCorp',
    messagePreview: 'Can you update the timeline?',
    messageId: 'msg_456',
    urgent: false
  }
}
```

### Milestone Event
```typescript
{
  type: 'milestone',
  data: {
    milestoneName: '500 GRAIN Milestone',
    description: "You've earned 500 GRAIN this week!",
    reward: 100,
    badgeUrl: '/badges/500-grain-milestone.png'
  }
}
```

## Mock Event Generator

For testing and development, use the mock event generator:

```typescript
import { MockEventGenerator } from '@/lib/realtime';

// Create generator with agent IDs
const generator = new MockEventGenerator([
  'agent_1',
  'agent_2',
  'agent_3',
]);

// Start generating events every 15-45 seconds
generator.start(15000, 45000);

// Stop generator
generator.stop();
```

The generator automatically creates realistic events:
- New tasks from various clients
- Task completions by different agents
- GRAIN earnings and bonuses
- Client messages
- Milestones and achievements
- Urgent tasks
- System notifications

## Integration with Existing Systems

### 1. Task Assignment Integration

```typescript
// In your task assignment API
import { realtimeService } from '@/lib/realtime';

export async function assignTask(taskId: string, agentId: string) {
  // ... your task assignment logic

  // Emit real-time event
  realtimeService.emit({
    id: `evt_${Date.now()}`,
    type: 'new_task',
    agentId,
    timestamp: new Date().toISOString(),
    read: false,
    priority: 'medium',
    data: {
      taskId,
      taskTitle: task.title,
      clientName: task.client,
      grainReward: task.reward,
    },
  });
}
```

### 2. GRAIN System Integration

```typescript
// When GRAIN is earned
import { realtimeService } from '@/lib/realtime';

export async function awardGrain(agentId: string, amount: number, reason: string) {
  // ... your GRAIN logic

  realtimeService.emit({
    id: `evt_${Date.now()}`,
    type: 'grain_earned',
    agentId,
    timestamp: new Date().toISOString(),
    read: false,
    priority: 'medium',
    data: {
      amount,
      reason,
      totalEarned: newTotal,
    },
  });
}
```

### 3. Navigation Badge Count

```tsx
'use client';

import { useRealtime } from '@/hooks/useRealtime';

export function NavigationBadge() {
  const { unreadCount } = useRealtime({
    agentId: 'current_agent',
    autoConnect: true,
  });

  if (unreadCount === 0) return null;

  return (
    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
      {unreadCount > 99 ? '99+' : unreadCount}
    </span>
  );
}
```

## Styling & Customization

### Toast Notification Styles

The system includes pre-built toast styles, but you can customize:

```tsx
// Custom toast container position
<div className="fixed bottom-4 left-4 z-50"> {/* Bottom-left */}
  {/* Toasts */}
</div>

// Custom toast appearance
const customToastClass = `
  bg-gradient-to-r from-purple-500 to-pink-500
  text-white rounded-xl shadow-2xl
  transform transition-all duration-500
  hover:scale-105
`;
```

### Event Priority Colors

```typescript
const priorityColors = {
  urgent: 'border-red-500 bg-red-50',
  high: 'border-orange-500 bg-orange-50',
  medium: 'border-blue-500 bg-blue-50',
  low: 'border-gray-400 bg-gray-50',
};
```

## Browser Compatibility

### Desktop Notifications
- Chrome 22+
- Firefox 22+
- Safari 7+
- Edge 14+

Requires user permission. Request with:
```typescript
if ('Notification' in window && Notification.permission === 'default') {
  await Notification.requestPermission();
}
```

### Server-Sent Events
- All modern browsers
- Automatic fallback to polling not included (SSE is widely supported)

## Performance Considerations

### Memory Management
- Event history capped at 100 events
- Toasts auto-removed from DOM after animation
- Automatic cleanup on component unmount

### Network Optimization
- Keep-alive pings every 30 seconds
- Automatic reconnection with exponential backoff
- Single SSE connection per agent

### Scalability
- Server-side: In-memory storage (consider Redis for production)
- Multiple agents: Separate SSE connections
- Broadcasting: Use agentId: 'all' for system-wide messages

## Testing

### Manual Testing
```bash
# Start dev server
npm run dev

# Navigate to demo page
# http://localhost:3000/realtime-demo

# Watch for mock events every 10-30 seconds
```

### Programmatic Testing
```typescript
import { realtimeService } from '@/lib/realtime';

// Subscribe and test
const events: RealtimeEvent[] = [];
realtimeService.subscribe('test_agent', (event) => {
  events.push(event);
});

// Emit test event
realtimeService.emit({
  id: 'test_1',
  type: 'new_task',
  agentId: 'test_agent',
  timestamp: new Date().toISOString(),
  read: false,
  data: { taskTitle: 'Test Task' },
});

// Verify
console.assert(events.length === 1);
```

## Troubleshooting

### Connection Issues
```typescript
// Check connection status
const { isConnected } = useRealtime({ agentId: 'agent_123' });

// Manual reconnect
const { connect, disconnect } = useRealtime({
  agentId: 'agent_123',
  autoConnect: false,
});

// Later...
connect();
```

### No Events Received
1. Verify agent ID matches
2. Check browser console for errors
3. Ensure SSE endpoint is accessible
4. Enable mock events for testing

### Desktop Notifications Not Working
```typescript
// Check permission
if (Notification.permission === 'denied') {
  console.warn('Desktop notifications blocked by user');
}

// Request permission
if (Notification.permission === 'default') {
  await Notification.requestPermission();
}
```

### Memory Leaks
Always cleanup subscriptions:
```typescript
useEffect(() => {
  const { disconnect } = useRealtime({ agentId: 'agent_123' });

  return () => {
    disconnect(); // Automatic with hook
  };
}, []);
```

## Production Deployment

### Environment Variables
```bash
# .env.production
NEXT_PUBLIC_REALTIME_ENDPOINT=/api/realtime
REALTIME_EVENT_HISTORY_SIZE=100
REALTIME_KEEPALIVE_INTERVAL=30000
```

### Vercel Deployment
SSE works on Vercel with Edge Functions:
```typescript
// app/api/realtime/route.ts
export const runtime = 'edge'; // Optional for better performance
```

### Redis Integration (Optional)
For production scale, replace in-memory storage:
```typescript
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

// Store events in Redis
await redis.lpush(`events:${agentId}`, JSON.stringify(event));
await redis.ltrim(`events:${agentId}`, 0, 99); // Keep 100 events
```

## Next Steps

1. **Integrate with existing pages**: Add `useRealtime` to agent dashboard
2. **Custom event types**: Add domain-specific events
3. **Event filtering UI**: Let users filter by event type
4. **Event search**: Add search functionality
5. **Push notifications**: Integrate with Firebase Cloud Messaging
6. **Analytics**: Track event engagement rates
7. **Archive system**: Move old events to database

## Demo Component

A full demo component is included at:
`/Users/jonahmanning/Downloads/wells-ai-github-ready/app/components/RealtimeDemo.tsx`

Use it as a reference or drop it directly into your app:
```tsx
import RealtimeDemo from '@/app/components/RealtimeDemo';

export default function Page() {
  return <RealtimeDemo />;
}
```

## Support

For issues or questions:
1. Check browser console for errors
2. Verify network tab shows SSE connection
3. Test with mock events enabled
4. Review integration examples above

---

**Built with:**
- Next.js 14 App Router
- TypeScript
- Server-Sent Events (SSE)
- Tailwind CSS
- React Hooks

**Total Implementation:** 1,515 lines of production-ready code
