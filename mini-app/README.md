# Wells AI Mini App

A lightweight Wells AI mini app prototype built for iOS distribution via Apple's Mini Apps Partner Program.

## Overview

This mini app provides core Wells AI functionality in a highly optimized package (<500KB bundle):
- AI-powered chat interface for supplier discovery
- Advanced supplier search with filters
- RFQ creation wizard
- Deal pipeline management
- Free/Pro tier gating with upgrade prompts

## Tech Stack

- **Preact 10.x** - Lightweight React alternative (3KB)
- **TypeScript** - Type safety and better DX
- **Tailwind CSS** - Utility-first styling
- **Zustand** - Lightweight state management
- **Vite** - Fast build tooling

## Project Structure

```
mini-app/
├── src/
│   ├── components/        # UI components
│   │   ├── App.tsx        # Main app with routing
│   │   ├── Layout.tsx     # Layout with tab bar
│   │   ├── ChatInterface.tsx
│   │   ├── Search.tsx
│   │   ├── SearchBar.tsx
│   │   ├── SearchResults.tsx
│   │   ├── RFQForm.tsx
│   │   ├── DealPipeline.tsx
│   │   └── UpgradeModal.tsx
│   ├── services/          # API clients
│   │   └── api.ts         # Mock API client
│   ├── hooks/             # Custom hooks
│   │   └── useStore.ts    # Global state
│   ├── types/             # TypeScript types
│   │   └── index.ts
│   ├── mock/              # Mock data
│   │   └── data.ts
│   ├── styles/            # Global styles
│   │   └── index.css
│   └── main.tsx           # Entry point
├── public/
│   ├── manifest.json      # Apple Mini App manifest
│   └── assets/            # Images and icons
├── vite.config.ts         # Vite configuration
├── tailwind.config.js     # Tailwind configuration
├── tsconfig.json          # TypeScript configuration
└── package.json           # Dependencies
```

## Getting Started

### Install Dependencies

```bash
cd mini-app
npm install
```

### Development

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

### Build for Production

```bash
npm run build
```

The optimized bundle will be in the `dist/` directory.

### Analyze Bundle Size

```bash
npm run analyze
```

## Features

### AI Chat Interface
- Conversational supplier search
- Streaming message simulation
- Context-aware suggestions
- Message history

### Supplier Search
- Full-text search
- Advanced filters (category, location, certifications, rating)
- Verified supplier badges
- Detailed supplier cards

### RFQ Creation
- Multi-step wizard (3 steps)
- Form validation
- Progress indicator
- Review before submit

### Deal Pipeline
- Kanban-style view
- 5 stages: Lead → Qualified → Proposal → Negotiation → Closed
- Deal cards with key metrics
- Pipeline summary

### Tier Gating
- Free tier: 10 searches/month, 2 RFQs/month
- Pro tier: Unlimited access
- Upgrade modal with IAP integration
- Feature comparison

## Apple Mini App Integration

### Manifest
The `public/manifest.json` file defines:
- App metadata and icons
- IAP products (monthly/annual subscriptions)
- Required permissions
- API endpoints
- Feature flags

### IAP Products
- Monthly: $49.99 (com.wellsonyx.wellsai.pro.monthly)
- Annual: $499.99 (com.wellsonyx.wellsai.pro.annual)

### Bundle Size
Target: <500KB total
- Preact: ~3KB
- Zustand: ~1KB
- Tailwind (purged): ~10KB
- App code: ~30KB
- Total: ~50KB (gzipped)

## API Integration

The app uses a mock API client (`src/services/api.ts`) that simulates network requests. In production, replace with real API calls:

```typescript
// Update baseURL in api.ts
private baseURL = 'https://api.wellsonyx.com';
```

## Customization

### Design Tokens
Update colors in `tailwind.config.js`:

```javascript
colors: {
  primary: { /* your colors */ },
  onyx: { /* your colors */ },
}
```

### Tier Limits
Update limits in `src/mock/data.ts`:

```typescript
export const TIER_LIMITS = {
  free: { searchesPerMonth: 10, ... },
  pro: { searchesPerMonth: -1, ... },
};
```

## Performance Optimizations

1. **Code Splitting** - Vendor chunk separation
2. **Tree Shaking** - Remove unused code
3. **Minification** - Terser for JS, PurgeCSS for styles
4. **Compression** - Gzip enabled
5. **Lazy Loading** - Components loaded on demand
6. **Memoization** - Zustand for efficient state updates

## iOS-Specific Features

- Safe area insets support
- iOS-style animations
- Native feel with haptics support (via host app)
- Tab bar navigation
- Pull-to-refresh ready
- Dark mode ready (can be enabled)

## License

Proprietary - Wells Onyx LLC

## Support

For questions or issues, contact: support@wellsonyx.com
