# Mobile Optimization Guide

## Overview

This document outlines the mobile-first design principles, responsive patterns, and optimization strategies implemented for the Wells AI Agent Operations platform. The mobile experience is designed to enable agents to work efficiently from phones and tablets with the same capabilities as desktop.

---

## Table of Contents

1. [Mobile-First Design Principles](#mobile-first-design-principles)
2. [Responsive Breakpoints](#responsive-breakpoints)
3. [Touch Interaction Guidelines](#touch-interaction-guidelines)
4. [Mobile Dashboard Features](#mobile-dashboard-features)
5. [Performance Optimization](#performance-optimization)
6. [Testing Checklist](#testing-checklist)
7. [Known Limitations](#known-limitations)
8. [Progressive Web App (PWA)](#progressive-web-app-pwa)
9. [Troubleshooting](#troubleshooting)

---

## Mobile-First Design Principles

### 1. Content Hierarchy

**Mobile displays information in order of importance:**

- Primary actions at the top
- Critical data in hero cards
- Secondary information in collapsible sections
- Tertiary data accessible via bottom sheets

**Example:**
```tsx
// Mobile-first: Most important info first
<div className="space-y-4">
  {/* Hero: GRAIN Balance */}
  <GrainBalanceCard />

  {/* Primary Stats */}
  <StatsGrid />

  {/* Quick Actions */}
  <QuickActions />

  {/* Upcoming Tasks (preview) */}
  <TaskPreview />
</div>
```

### 2. Single Column Layout

Mobile uses exclusively single-column layouts to prevent horizontal scrolling and ensure readability.

```css
@media (max-width: 767px) {
  .responsive-grid {
    grid-template-columns: 1fr !important;
  }
}
```

### 3. Progressive Disclosure

Show essential information first, reveal details on interaction:

- Collapsed task cards show title, client, and reward
- Tap to expand full description and actions
- Bottom sheets for detailed views
- Drawers for filters and settings

### 4. Thumb-Friendly Navigation

All primary navigation is within easy thumb reach:

- Bottom tab bar for main sections
- Floating Action Button (FAB) in bottom-right
- Sticky headers for context
- Pull-down actions at the top

---

## Responsive Breakpoints

### Breakpoint System

```css
/* Mobile (Portrait Phones) */
--mobile-max: 767px;

/* Tablet (iPad, Android Tablets) */
--tablet-min: 768px;
--tablet-max: 1023px;

/* Desktop */
--desktop-min: 1024px;
```

### Usage Examples

```tsx
// Component-level responsive rendering
{isMobile() && <MobileView />}
{isTablet() && <TabletView />}
{!isMobile() && <DesktopView />}
```

```css
/* CSS Media Queries */
@media (max-width: 767px) {
  /* Mobile styles */
}

@media (min-width: 768px) and (max-width: 1023px) {
  /* Tablet styles */
}

@media (min-width: 1024px) {
  /* Desktop styles */
}
```

### Utility Classes

```html
<!-- Hide on mobile, show on desktop -->
<div class="hidden-mobile">Desktop-only content</div>

<!-- Show only on mobile -->
<div class="mobile-only">Mobile-only content</div>

<!-- Show only on tablet -->
<div class="tablet-only">Tablet-only content</div>

<!-- Show only on desktop -->
<div class="desktop-only">Desktop-only content</div>
```

---

## Touch Interaction Guidelines

### Touch Target Sizes

**Minimum sizes per Apple Human Interface Guidelines and Material Design:**

```css
/* Minimum touch target (44x44px) */
.touch-target {
  min-width: 44px;
  min-height: 44px;
}

/* Comfortable touch target (48x48px) */
.touch-target-comfortable {
  min-width: 48px;
  min-height: 48px;
}

/* Spacious touch target (56x56px) - for primary actions */
.touch-target-spacious {
  min-width: 56px;
  min-height: 56px;
}
```

**Implementation:**

```tsx
// All buttons automatically have touch-target class
<button className="touch-target">
  Click Me
</button>

// Primary actions get spacious targets
<button className="touch-target-spacious bg-green-500">
  Start Task
</button>
```

### Gesture Support

#### 1. Swipe Gestures

**Task Cards:**
- Swipe right (>100px): Mark complete
- Swipe left (<-100px): Snooze task
- Visual feedback during swipe
- Haptic feedback on action

```tsx
const handleTaskSwipeEnd = (taskId: string) => {
  const offset = swipeOffset[taskId] || 0

  if (offset > 100) {
    // Swipe right - Mark complete
    handleCompleteTask(taskId)
    if ('vibrate' in navigator) navigator.vibrate([50, 50])
  } else if (offset < -100) {
    // Swipe left - Snooze
    handleSnoozeTask(taskId)
    if ('vibrate' in navigator) navigator.vibrate([50, 50])
  }
}
```

#### 2. Pull to Refresh

Pull down from the top of the screen (when scrolled to top) to refresh data.

**States:**
1. Pull initiated (distance < 60px): Show spinner
2. Release threshold reached (distance >= 60px): Activate refresh
3. Refreshing: Spinner animation
4. Complete: Reset

```tsx
const handleTouchEnd = () => {
  if (pullDistance > 60) {
    handleRefresh()
  }
  setIsPulling(false)
  setPullDistance(0)
}
```

#### 3. Long Press

Long press on items for contextual menus (future feature).

### Haptic Feedback

Provide tactile feedback for important interactions:

```tsx
// Success feedback
if ('vibrate' in navigator) {
  navigator.vibrate(50) // Single short vibration
}

// Error feedback
if ('vibrate' in navigator) {
  navigator.vibrate([50, 100, 50]) // Pattern
}

// Confirmation feedback
if ('vibrate' in navigator) {
  navigator.vibrate([50, 50]) // Double tap
}
```

### Tap Highlight Removal

Remove default tap highlights for better custom feedback:

```css
* {
  -webkit-tap-highlight-color: transparent;
  -webkit-touch-callout: none;
}
```

---

## Mobile Dashboard Features

### Bottom Navigation

**5-Tab Navigation:**

1. **Home**: Dashboard overview, stats, quick actions
2. **Tasks**: Full task queue with filters
3. **Clients**: Client list with earnings breakdown
4. **Earnings**: Daily/weekly earnings charts
5. **More**: Settings, profile, help

**Features:**
- Active state highlighting with top border
- Badge counts on tabs (e.g., pending tasks)
- Icons + labels for clarity
- Sticky to bottom with safe area support

```tsx
<div className="bottom-nav">
  <div className="bottom-nav-items">
    {tabs.map((tab) => (
      <button
        key={tab.id}
        onClick={() => setActiveTab(tab.id)}
        className="bottom-nav-item"
      >
        <tab.icon className={isActive ? 'text-purple-400' : 'text-gray-400'} />
        <span>{tab.label}</span>
        {tab.badge > 0 && (
          <span className="bottom-nav-badge">{tab.badge}</span>
        )}
      </button>
    ))}
  </div>
</div>
```

### Home Tab

**Components:**

1. **GRAIN Balance Card**: Gradient hero card showing balance and daily earnings
2. **Stats Grid**: 2x2 grid with completed tasks, hours, efficiency, and earnings
3. **Quick Actions**: 2x2 grid of action buttons
4. **Urgent Tasks Preview**: Top 3 urgent tasks with "View All" button

### Tasks Tab

**Features:**

- Filter button (opens bottom drawer)
- Swipeable task cards
- Status indicators (pending, in progress)
- Tap to view details in bottom sheet
- Empty state when filtered

**Task Card Information:**
- SOP type icon (color-coded)
- Priority dot
- Task title
- Client name
- Duration estimate
- GRAIN reward
- Due date (relative: "2h", "Due now")

### Clients Tab

**Client Cards:**
- Client avatar (first letter)
- Client name
- Active task count
- Total GRAIN earned
- Tap for details

### Earnings Tab

**Components:**

1. **Weekly Summary Card**: Total earnings with task count, hours, and average per task
2. **Daily Breakdown**: Bar chart showing earnings by day
3. **GRAIN Value Info**: Conversion rate and minimum withdrawal

### More Tab

**Sections:**

1. **Profile Card**: Avatar, name, email, "Edit Profile" button
2. **Settings Menu**: Notifications, Privacy, Preferences, Help
3. **Sign Out Button**: Red accent

### Bottom Sheets

**Used for:**
- Task details
- Filter options
- Client details
- Settings panels

**Anatomy:**
```tsx
<div className="bottom-sheet">
  <div className="bottom-sheet-backdrop" onClick={close} />
  <div className="bottom-sheet-content">
    <div className="bottom-sheet-handle" />
    {/* Content */}
  </div>
</div>
```

**Features:**
- Drag handle at top
- Swipe down to dismiss
- Backdrop tap to close
- Slide-up animation
- Max height 90vh
- Scrollable content
- Safe area support

### AI Assistant Modal

**Full-screen chat interface:**
- Back button to close
- Online indicator (pulsing green dot)
- Chat messages area
- Input bar with microphone and send buttons
- Voice input support (future)

### Floating Action Button (FAB)

**Purpose**: Quick access to AI assistant

**Position**: Bottom-right, above bottom nav

**Interaction**: Tap to open AI assistant

```tsx
<button className="fab bg-purple-500">
  <Sparkles className="w-6 h-6 text-white" />
</button>
```

---

## Performance Optimization

### 1. Lazy Loading

**Images:**
```tsx
<img
  src={imageUrl}
  loading="lazy"
  alt="Description"
  className="mobile-img-responsive"
/>
```

**Components:**
```tsx
import dynamic from 'next/dynamic'

const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <Skeleton />,
})
```

### 2. Virtual Scrolling

For long lists (>50 items), implement virtual scrolling:

```tsx
import { useVirtualizer } from '@tanstack/react-virtual'

const rowVirtualizer = useVirtualizer({
  count: tasks.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 80,
})
```

### 3. Debounce & Throttle

**Search inputs:**
```tsx
import { useDebouncedCallback } from 'use-debounce'

const debouncedSearch = useDebouncedCallback(
  (value) => setSearchTerm(value),
  300
)
```

**Scroll handlers:**
```tsx
import { throttle } from 'lodash'

const throttledScroll = throttle(handleScroll, 100)
```

### 4. Code Splitting

Split large pages into smaller chunks:

```tsx
// app/ai-ops/mobile/page.tsx
const TasksTab = dynamic(() => import('./components/TasksTab'))
const ClientsTab = dynamic(() => import('./components/ClientsTab'))
const EarningsTab = dynamic(() => import('./components/EarningsTab'))
```

### 5. Image Optimization

**Next.js Image component:**
```tsx
import Image from 'next/image'

<Image
  src={clientLogo}
  alt={clientName}
  width={48}
  height={48}
  quality={75}
  placeholder="blur"
/>
```

### 6. Caching

**API responses:**
```tsx
import useSWR from 'swr'

const { data, error, isLoading } = useSWR('/api/tasks', fetcher, {
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  dedupingInterval: 5000,
})
```

### 7. Bundle Size Optimization

**Analyze bundle:**
```bash
npm run build -- --analyze
```

**Tree shaking:**
```tsx
// Import only what you need
import { useState } from 'react'
// Not: import * as React from 'react'

// Use named imports from icon libraries
import { Home, User } from 'lucide-react'
// Not: import * from 'lucide-react'
```

### 8. Animation Performance

**Use transforms for 60fps:**
```css
/* Good - GPU accelerated */
.slide {
  transform: translateX(100px);
  transition: transform 0.3s;
}

/* Bad - causes reflows */
.slide {
  left: 100px;
  transition: left 0.3s;
}
```

**Will-change for complex animations:**
```css
.swipeable {
  will-change: transform;
}
```

### 9. Network Optimization

**Compress data:**
```tsx
// API responses
export default async function handler(req, res) {
  const data = await fetchData()

  res.setHeader('Content-Encoding', 'gzip')
  res.json(data)
}
```

**Prefetch critical data:**
```tsx
useEffect(() => {
  // Prefetch next likely page
  router.prefetch('/ai-ops/agent/queue')
}, [])
```

### 10. Battery Optimization

**Reduce animation when battery low:**
```tsx
useEffect(() => {
  if ('getBattery' in navigator) {
    navigator.getBattery().then(battery => {
      if (battery.level < 0.2) {
        setReducedMotion(true)
      }
    })
  }
}, [])
```

---

## Testing Checklist

### Device Testing

- [ ] iPhone SE (375x667) - Small phone
- [ ] iPhone 12/13/14 (390x844) - Standard phone
- [ ] iPhone 14 Pro Max (430x932) - Large phone
- [ ] iPad Mini (768x1024) - Small tablet
- [ ] iPad Pro (1024x1366) - Large tablet
- [ ] Samsung Galaxy S21 (360x800) - Android phone
- [ ] Samsung Galaxy Tab (800x1280) - Android tablet

### Browser Testing

- [ ] Safari (iOS)
- [ ] Chrome (iOS)
- [ ] Safari (iPadOS)
- [ ] Chrome (Android)
- [ ] Samsung Internet (Android)
- [ ] Firefox (Android)

### Orientation Testing

- [ ] Portrait mode
- [ ] Landscape mode
- [ ] Orientation change handling
- [ ] Safe area in landscape
- [ ] Bottom nav in landscape

### Touch Interaction Testing

- [ ] All buttons have 44px minimum touch targets
- [ ] Swipe gestures work smoothly
- [ ] Pull-to-refresh activates correctly
- [ ] No accidental taps/swipes
- [ ] Haptic feedback works (on supported devices)
- [ ] Long press doesn't trigger click
- [ ] Scroll doesn't trigger swipe

### Performance Testing

- [ ] Page load time < 3 seconds (3G)
- [ ] Page load time < 1 second (4G)
- [ ] Smooth scrolling (60fps)
- [ ] Smooth animations (60fps)
- [ ] No jank during interactions
- [ ] Low memory usage (<100MB)
- [ ] Battery drain acceptable

### Network Testing

- [ ] Works on 3G network
- [ ] Works on 4G network
- [ ] Works on WiFi
- [ ] Handles network switching
- [ ] Shows offline indicator
- [ ] Graceful error handling
- [ ] Retry mechanism works

### Accessibility Testing

- [ ] Screen reader compatible (VoiceOver, TalkBack)
- [ ] Keyboard navigation works
- [ ] Focus indicators visible
- [ ] Color contrast meets WCAG AA
- [ ] Text resizes without breaking layout
- [ ] Works with reduced motion preference
- [ ] Works with high contrast mode

### Feature Testing

- [ ] Bottom navigation works
- [ ] Pull-to-refresh works
- [ ] Task swipe actions work
- [ ] Bottom sheets open/close
- [ ] AI assistant opens
- [ ] Filters apply correctly
- [ ] Stats update correctly
- [ ] GRAIN balance displays
- [ ] Task status changes
- [ ] Notifications appear

### Edge Cases

- [ ] Works with 0 tasks
- [ ] Works with 100+ tasks
- [ ] Handles very long task titles
- [ ] Handles very long client names
- [ ] Works with slow API responses
- [ ] Handles API errors
- [ ] Works offline (with cached data)
- [ ] Recovers from crashes

### Safe Area Testing

- [ ] Content not hidden by notch (iPhone X+)
- [ ] Content not hidden by home indicator
- [ ] Bottom nav respects safe area
- [ ] Modals respect safe area
- [ ] Landscape safe area works

---

## Known Limitations

### 1. Browser Support

**Not supported:**
- Internet Explorer (any version)
- Opera Mini
- UC Browser (legacy versions)

**Partially supported:**
- Safari < 14 (some features may not work)
- Chrome < 90 (some features may not work)

### 2. Device Limitations

**Very small screens (< 320px):**
- Some content may be cramped
- Consider showing "unsupported device" message

**Very large tablets (> 1024px):**
- Automatically switches to desktop view
- Mobile-specific features disabled

### 3. Feature Limitations

**Haptic feedback:**
- Only works on devices that support Vibration API
- Not supported on iOS Safari (PWA only)

**Pull-to-refresh:**
- May conflict with native browser pull-to-refresh
- Disabled in some browsers for security

**Background sync:**
- Requires PWA installation
- Not available in all browsers

**Notifications:**
- Requires user permission
- May be blocked by browser settings

### 4. Performance Considerations

**Long task lists:**
- Virtual scrolling recommended for >100 items
- May cause memory issues on older devices

**High-res images:**
- Use compressed/optimized images
- Lazy load below-the-fold images

**Complex animations:**
- May lag on low-end devices
- Respect prefers-reduced-motion

### 5. Network Limitations

**Offline mode:**
- Limited functionality (view cached data only)
- Cannot create/update tasks offline
- Sync when back online (future)

**Slow connections:**
- Show loading states
- Implement timeouts
- Allow retry

---

## Progressive Web App (PWA)

### Setup

**1. Create manifest.json:**

```json
{
  "name": "Wells AI - Agent Ops",
  "short_name": "Wells AI",
  "description": "Agent Operations Dashboard",
  "start_url": "/ai-ops/mobile",
  "display": "standalone",
  "background_color": "#1a1a2e",
  "theme_color": "#a855f7",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "/icons/icon-72x72.png",
      "sizes": "72x72",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-96x96.png",
      "sizes": "96x96",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-128x128.png",
      "sizes": "128x128",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-144x144.png",
      "sizes": "144x144",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-152x152.png",
      "sizes": "152x152",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-384x384.png",
      "sizes": "384x384",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

**2. Add to layout:**

```tsx
// app/layout.tsx
export const metadata = {
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Wells AI',
  },
}
```

**3. Create service worker (basic):**

```js
// public/sw.js
const CACHE_NAME = 'wells-ai-v1'
const urlsToCache = [
  '/',
  '/ai-ops/mobile',
  '/styles/mobile-responsive.css',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  )
})

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => response || fetch(event.request))
  )
})
```

**4. Register service worker:**

```tsx
// app/ai-ops/mobile/page.tsx
useEffect(() => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered:', registration)
      })
      .catch((error) => {
        console.log('SW registration failed:', error)
      })
  }
}, [])
```

### Install Prompt

```tsx
const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
const [showInstallPrompt, setShowInstallPrompt] = useState(false)

useEffect(() => {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    setDeferredPrompt(e)
    setShowInstallPrompt(true)
  })
}, [])

const handleInstall = async () => {
  if (!deferredPrompt) return

  deferredPrompt.prompt()
  const { outcome } = await deferredPrompt.userChoice

  if (outcome === 'accepted') {
    console.log('PWA installed')
  }

  setDeferredPrompt(null)
  setShowInstallPrompt(false)
}
```

### Splash Screens (iOS)

```tsx
// app/layout.tsx
<link
  rel="apple-touch-startup-image"
  media="screen and (device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)"
  href="/splash/iphone-14.png"
/>
<link
  rel="apple-touch-startup-image"
  media="screen and (device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)"
  href="/splash/iphone-14-pro-max.png"
/>
```

---

## Troubleshooting

### Issue: Bottom nav hidden by home indicator

**Solution:**
```css
.bottom-nav {
  padding-bottom: calc(0.5rem + env(safe-area-inset-bottom));
}
```

### Issue: Input zoom on iOS

**Solution:**
```css
input, textarea, select {
  font-size: 16px; /* Prevents zoom */
}
```

### Issue: Touch events not firing

**Solution:**
```tsx
// Use passive event listeners
element.addEventListener('touchstart', handler, { passive: true })
element.addEventListener('touchmove', handler, { passive: false })
```

### Issue: Swipe conflicts with browser navigation

**Solution:**
```css
.swipeable {
  touch-action: pan-y; /* Allow vertical scroll only */
}
```

### Issue: Animations laggy

**Solution:**
```css
.animated-element {
  will-change: transform;
  transform: translateZ(0); /* Force GPU acceleration */
}
```

### Issue: Safe area not working

**Solution:**
```html
<!-- Add to <head> -->
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```

### Issue: Pull-to-refresh triggering browser refresh

**Solution:**
```css
body {
  overscroll-behavior-y: contain;
}
```

### Issue: Haptic feedback not working

**Solution:**
```tsx
// Check for support first
if ('vibrate' in navigator) {
  navigator.vibrate(50)
} else {
  console.log('Vibration not supported')
}
```

---

## Best Practices Summary

### DO

✅ Use mobile-first CSS (mobile styles first, desktop in media queries)
✅ Implement 44px minimum touch targets
✅ Provide visual feedback for all interactions
✅ Use haptic feedback where appropriate
✅ Optimize images (compress, lazy load, responsive sizes)
✅ Test on real devices (not just emulators)
✅ Support offline mode (graceful degradation)
✅ Use semantic HTML
✅ Implement proper error handling
✅ Show loading states
✅ Respect user preferences (dark mode, reduced motion)
✅ Use safe area insets
✅ Optimize for battery life
✅ Keep bundle size small

### DON'T

❌ Don't use hover states as primary interaction
❌ Don't rely on mouse events only
❌ Don't use small touch targets (<44px)
❌ Don't forget landscape orientation
❌ Don't ignore network speed
❌ Don't use fixed positioning without safe area
❌ Don't animate properties that cause reflow (width, height, left, top)
❌ Don't load large images on mobile
❌ Don't forget accessibility
❌ Don't use font-size < 16px for inputs (causes zoom on iOS)
❌ Don't nest too many components (performance)
❌ Don't forget to test on real devices
❌ Don't use alerts/confirms (use custom modals)
❌ Don't assume fast network

---

## Resources

### Tools

- **Chrome DevTools**: Device emulation, network throttling
- **Safari Web Inspector**: iOS debugging
- **Lighthouse**: Performance auditing
- **BrowserStack**: Real device testing
- **PageSpeed Insights**: Mobile performance analysis

### Documentation

- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [Material Design Touch Targets](https://material.io/design/usability/accessibility.html#layout-and-typography)
- [MDN Touch Events](https://developer.mozilla.org/en-US/docs/Web/API/Touch_events)
- [Web.dev Mobile Performance](https://web.dev/mobile/)

### Testing

- [Can I Use](https://caniuse.com/) - Browser support
- [Mobile-Friendly Test](https://search.google.com/test/mobile-friendly) - Google's tool
- [WebPageTest](https://www.webpagetest.org/) - Performance testing

---

## Changelog

### v1.0.0 - Initial Release
- Mobile-first dashboard implementation
- Bottom navigation system
- Pull-to-refresh functionality
- Swipeable task cards
- Bottom sheets for details
- AI assistant modal
- Responsive utilities CSS
- PWA setup guide
- Comprehensive documentation

---

## Support

For issues or questions about mobile optimization:

1. Check this documentation
2. Review troubleshooting section
3. Test on real devices
4. Check browser console for errors
5. Contact development team

---

**Last Updated**: November 9, 2025
**Version**: 1.0.0
**Author**: Wells AI Team
