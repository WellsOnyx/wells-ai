# Real-Time System Quick Start

## 1-Minute Integration

### Add to Navigation Bar

```tsx
// app/components/Navigation.tsx
import RealtimeNotificationBell from '@/app/components/RealtimeNotificationBell';

export default function Navigation() {
  return (
    <nav className="flex items-center justify-between p-4">
      <div>Your Logo</div>

      <div className="flex items-center space-x-4">
        {/* Add notification bell */}
        <RealtimeNotificationBell
          agentId="agent_123"
          enableMock={true}
        />

        <div>Profile Menu</div>
      </div>
    </nav>
  );
}
```

### Test It

1. Start dev server: `npm run dev`
2. Navigate to your page with the navigation
3. Watch for notifications every 10-30 seconds
4. Click bell icon to see dropdown
5. Desktop notifications appear automatically

## Send Real Events

```typescript
// From any API route or server action
await fetch('/api/realtime', {
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

## Full Documentation

See `REALTIME_INTEGRATION.md` for complete API reference and advanced features.

## Files Created

- `/lib/realtime.ts` - Core service (508 lines)
- `/app/api/realtime/route.ts` - API endpoints (239 lines)
- `/hooks/useRealtime.ts` - React hook (491 lines)
- `/app/components/RealtimeDemo.tsx` - Full demo (277 lines)
- `/app/components/RealtimeNotificationBell.tsx` - Drop-in bell component (270 lines)

**Total: 1,785 lines of production code**
