# Wells AI Mini App - Technical Architecture

**Version:** 1.0
**Date:** November 17, 2025
**Status:** Design Phase

---

## Architecture Overview

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Host App (iOS)                        │
│  ┌────────────────────────────────────────────────────┐ │
│  │         Wells AI Mini App (HTML5/JS)               │ │
│  │  ┌──────────────┐  ┌──────────────┐               │ │
│  │  │  UI Layer    │  │  State Mgmt  │               │ │
│  │  │  (Preact)    │  │  (Hooks)     │               │ │
│  │  └──────┬───────┘  └──────┬───────┘               │ │
│  │         │                  │                        │ │
│  │  ┌──────▼──────────────────▼───────┐               │ │
│  │  │    Service Layer (API Client)   │               │ │
│  │  └──────┬──────────────────┬───────┘               │ │
│  │         │                  │                        │ │
│  │  ┌──────▼───────┐   ┌─────▼────────┐              │ │
│  │  │  Local Store │   │ IAP Handler  │              │ │
│  │  │  (IndexedDB) │   │ (Apple API)  │              │ │
│  │  └──────────────┘   └──────────────┘              │ │
│  └────────────────┬───────────────────────────────────┘ │
│                   │                                      │
└───────────────────┼──────────────────────────────────────┘
                    │
                    │ HTTPS/WSS
                    │
        ┌───────────▼──────────────┐
        │   Wells AI Backend       │
        │   (Vercel + Next.js)     │
        ├──────────────────────────┤
        │  /api/mini-app/*         │
        │  - Authentication        │
        │  - Supplier Search       │
        │  - RFQ Management        │
        │  - Chat/AI Endpoints     │
        │  - Deal Pipeline         │
        └───────────┬──────────────┘
                    │
        ┌───────────▼──────────────┐
        │   PostgreSQL Database    │
        │   + Vector DB (Pinecone) │
        └──────────────────────────┘
```

---

## Technology Stack

### Frontend (Mini App)

**Core Framework:**
- **Preact 10.x** - Lightweight React alternative (3KB)
- **Preact Hooks** - State management built-in
- **HTM** - JSX alternative for no-build scenarios (optional)

**Styling:**
- **Tailwind CSS 3.x** - Utility-first CSS framework
- **PostCSS** - CSS transformations and minification
- Custom iOS-native design tokens

**Build Tools:**
- **Vite 5.x** - Fast build tool and dev server
- **Rollup** - Production bundling with tree-shaking
- **Terser** - JavaScript minification
- **Workbox** - Service worker generation

**State & Storage:**
- **Preact Signals** - Reactive state primitive
- **IndexedDB** - Client-side structured data storage
- **LocalStorage** - Simple key-value persistence

**Network & API:**
- **Fetch API** - HTTP requests
- **WebSocket** - Real-time communication for chat
- **Axios** - HTTP client with interceptors (optional)

### Backend (Wells AI)

**Existing Stack (Reuse):**
- Next.js 16 API routes
- Vercel deployment
- PostgreSQL via @vercel/postgres
- Clerk authentication
- Anthropic Claude AI

**New Endpoints for Mini App:**
- `/api/mini-app/auth` - Mini app authentication flow
- `/api/mini-app/search` - Lightweight supplier search
- `/api/mini-app/rfq` - RFQ creation and tracking
- `/api/mini-app/chat` - Streaming AI chat
- `/api/mini-app/deals` - Deal pipeline view

### Apple Integration

**Required APIs:**
- **Advanced Commerce API** - In-app purchase handling
- **Declared Age Rating API** - Age-appropriate content
- **StoreKit 2** - Modern IAP framework
- **App Store Server API** - Consumption info for refunds

---

## File Structure

```
mini-app/
├── public/
│   ├── manifest.json          # Mini app manifest (Apple required)
│   ├── icon.png               # App icon (multiple sizes)
│   └── assets/
│       ├── images/
│       └── fonts/
├── src/
│   ├── index.html             # Entry point
│   ├── index.tsx              # App bootstrap
│   ├── App.tsx                # Root component
│   ├── components/
│   │   ├── Chat/
│   │   │   ├── ChatInterface.tsx
│   │   │   ├── MessageList.tsx
│   │   │   └── MessageInput.tsx
│   │   ├── Search/
│   │   │   ├── SearchBar.tsx
│   │   │   ├── SearchResults.tsx
│   │   │   └── SupplierCard.tsx
│   │   ├── RFQ/
│   │   │   ├── RFQForm.tsx
│   │   │   ├── RFQList.tsx
│   │   │   └── RFQDetail.tsx
│   │   ├── Deals/
│   │   │   ├── DealPipeline.tsx
│   │   │   └── DealCard.tsx
│   │   └── Common/
│   │       ├── Button.tsx
│   │       ├── Input.tsx
│   │       ├── Modal.tsx
│   │       └── Loading.tsx
│   ├── services/
│   │   ├── api.ts             # API client
│   │   ├── auth.ts            # Authentication service
│   │   ├── iap.ts             # In-app purchase handler
│   │   ├── storage.ts         # IndexedDB wrapper
│   │   └── websocket.ts       # WebSocket client
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useSupplierSearch.ts
│   │   ├── useRFQ.ts
│   │   └── useDeals.ts
│   ├── store/
│   │   ├── auth.ts            # Auth state
│   │   ├── user.ts            # User profile state
│   │   └── app.ts             # App-wide state
│   ├── utils/
│   │   ├── helpers.ts
│   │   ├── validators.ts
│   │   └── formatters.ts
│   ├── types/
│   │   ├── api.ts
│   │   ├── models.ts
│   │   └── iap.ts
│   └── styles/
│       ├── globals.css
│       └── tailwind.css
├── scripts/
│   ├── build.sh               # Production build script
│   └── deploy.sh              # Deployment script
├── vite.config.ts             # Vite configuration
├── tailwind.config.js         # Tailwind configuration
├── tsconfig.json              # TypeScript configuration
├── package.json
└── README.md
```

---

## Component Architecture

### Core Components

#### 1. Chat Interface

```typescript
// src/components/Chat/ChatInterface.tsx
interface ChatInterfaceProps {
  userId: string
  onUpgrade?: () => void
}

Features:
- Streaming AI responses
- Message history with persistence
- Quick action buttons
- Supplier suggestion cards
- RFQ creation from chat
```

#### 2. Supplier Search

```typescript
// src/components/Search/SearchBar.tsx
interface SearchBarProps {
  onSearch: (query: string, filters: SearchFilters) => void
  filters?: SearchFilters
  placeholder?: string
}

Features:
- Real-time search with debouncing
- Filter by industry, location, certifications
- Recent search history
- Voice search integration (iOS)
```

#### 3. RFQ Management

```typescript
// src/components/RFQ/RFQForm.tsx
interface RFQFormProps {
  supplierIds?: string[]
  onSubmit: (rfq: RFQData) => Promise<void>
  onCancel: () => void
}

Features:
- Multi-step form wizard
- File attachment support
- Supplier auto-selection
- Draft saving to IndexedDB
- Offline support with sync
```

#### 4. Deal Pipeline

```typescript
// src/components/Deals/DealPipeline.tsx
interface DealPipelineProps {
  userId: string
  viewMode: 'list' | 'kanban'
}

Features:
- Drag-and-drop stage management
- Quick filters (stage, value, date)
- Deal detail modal
- Activity timeline
- Win/loss analytics
```

---

## API Specification

### Authentication

**Endpoint:** `POST /api/mini-app/auth`

**Request:**
```json
{
  "hostAppToken": "eyJhbGc...",
  "deviceId": "550e8400-e29b-41d4-a716-446655440000",
  "platform": "ios"
}
```

**Response:**
```json
{
  "success": true,
  "token": "jwt_token_here",
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "name": "John Doe",
    "tier": "free",
    "limits": {
      "searches": 10,
      "rfqs": 5,
      "contacts": 50
    }
  }
}
```

### Supplier Search

**Endpoint:** `GET /api/mini-app/search`

**Query Parameters:**
```
?q=steel+supplier
&industry=manufacturing
&location=us
&certifications=iso9001
&page=1
&limit=20
```

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "id": "supplier_456",
      "name": "Acme Steel Co.",
      "description": "Premium steel supplier...",
      "location": "Pittsburgh, PA",
      "industries": ["manufacturing", "construction"],
      "certifications": ["ISO9001", "ISO14001"],
      "rating": 4.8,
      "responseTime": "2 hours",
      "matchScore": 0.95
    }
  ],
  "total": 47,
  "page": 1,
  "hasMore": true
}
```

### RFQ Creation

**Endpoint:** `POST /api/mini-app/rfq`

**Request:**
```json
{
  "title": "Steel Plates for Q1 2026",
  "description": "Need 500 tons of steel plates...",
  "category": "materials",
  "budget": {
    "min": 50000,
    "max": 75000,
    "currency": "USD"
  },
  "deadline": "2026-01-15T00:00:00Z",
  "suppliers": ["supplier_456", "supplier_789"],
  "attachments": [
    {
      "name": "specs.pdf",
      "url": "https://storage...",
      "size": 1024000
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "rfq": {
    "id": "rfq_101",
    "status": "sent",
    "sentTo": 2,
    "createdAt": "2025-11-17T10:00:00Z",
    "expiresAt": "2026-01-15T00:00:00Z"
  }
}
```

### Chat / AI Assistant

**Endpoint:** `POST /api/mini-app/chat` (Streaming)

**Request:**
```json
{
  "message": "Find me suppliers for custom PCB manufacturing in Asia",
  "context": {
    "conversationId": "conv_123",
    "previousMessages": 5
  }
}
```

**Response (Server-Sent Events):**
```
data: {"type":"start","id":"msg_456"}

data: {"type":"delta","text":"I found"}

data: {"type":"delta","text":" 15 suppliers"}

data: {"type":"suppliers","ids":["sup_1","sup_2","sup_3"]}

data: {"type":"done"}
```

---

## State Management

### Global State with Preact Signals

```typescript
// src/store/auth.ts
import { signal, computed } from '@preact/signals'

export const authState = signal({
  isAuthenticated: false,
  token: null as string | null,
  user: null as User | null,
})

export const isAuthenticated = computed(() => authState.value.isAuthenticated)
export const currentUser = computed(() => authState.value.user)

export const login = (token: string, user: User) => {
  authState.value = {
    isAuthenticated: true,
    token,
    user,
  }
  localStorage.setItem('auth_token', token)
}

export const logout = () => {
  authState.value = {
    isAuthenticated: false,
    token: null,
    user: null,
  }
  localStorage.removeItem('auth_token')
}
```

### Local Persistence

```typescript
// src/services/storage.ts
import { openDB, DBSchema, IDBPDatabase } from 'idb'

interface WellsAIDB extends DBSchema {
  messages: {
    key: string
    value: ChatMessage
    indexes: { 'by-date': Date }
  }
  rfqs: {
    key: string
    value: RFQDraft
  }
  suppliers: {
    key: string
    value: CachedSupplier
    indexes: { 'by-industry': string }
  }
}

class StorageService {
  private db: IDBPDatabase<WellsAIDB> | null = null

  async init() {
    this.db = await openDB<WellsAIDB>('wellsai-miniapp', 1, {
      upgrade(db) {
        // Create object stores
        const messagesStore = db.createObjectStore('messages', {
          keyPath: 'id',
        })
        messagesStore.createIndex('by-date', 'timestamp')

        db.createObjectStore('rfqs', { keyPath: 'id' })

        const suppliersStore = db.createObjectStore('suppliers', {
          keyPath: 'id',
        })
        suppliersStore.createIndex('by-industry', 'industry')
      },
    })
  }

  async saveMessage(message: ChatMessage) {
    await this.db?.put('messages', message)
  }

  async getMessages(limit = 50): Promise<ChatMessage[]> {
    const messages = await this.db?.getAll('messages', undefined, limit)
    return messages?.reverse() || []
  }

  // ... more methods
}

export const storage = new StorageService()
```

---

## In-App Purchase Integration

### IAP Product Configuration

**Product IDs:**
- `com.wellsai.miniapp.pro.monthly` - Professional Monthly ($49)
- `com.wellsai.miniapp.pro.yearly` - Professional Yearly ($490)
- `com.wellsai.miniapp.enterprise.monthly` - Enterprise Monthly ($199)
- `com.wellsai.miniapp.enterprise.yearly` - Enterprise Yearly ($1990)

### IAP Handler

```typescript
// src/services/iap.ts
import { StoreKit } from '@apple/storekit'

class IAPService {
  private products: Map<string, Product> = new Map()

  async initialize() {
    // Request products from App Store
    const productIds = [
      'com.wellsai.miniapp.pro.monthly',
      'com.wellsai.miniapp.pro.yearly',
      'com.wellsai.miniapp.enterprise.monthly',
      'com.wellsai.miniapp.enterprise.yearly',
    ]

    const products = await StoreKit.requestProducts(productIds)
    products.forEach(p => this.products.set(p.id, p))
  }

  async purchase(productId: string): Promise<PurchaseResult> {
    const product = this.products.get(productId)
    if (!product) throw new Error('Product not found')

    try {
      const result = await StoreKit.purchase(product)

      if (result.success) {
        // Verify receipt with backend
        await this.verifyReceipt(result.receipt)
        return { success: true, tier: this.getTierForProduct(productId) }
      }

      return { success: false, error: 'Purchase cancelled' }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  private async verifyReceipt(receipt: string) {
    // Send receipt to backend for verification
    const response = await fetch('/api/mini-app/iap/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receipt }),
    })

    if (!response.ok) throw new Error('Receipt verification failed')
  }

  async restorePurchases(): Promise<void> {
    const purchases = await StoreKit.restorePurchases()
    // Process restored purchases
  }

  private getTierForProduct(productId: string): UserTier {
    if (productId.includes('enterprise')) return 'enterprise'
    if (productId.includes('pro')) return 'professional'
    return 'free'
  }
}

export const iapService = new IAPService()
```

---

## Build Configuration

### Vite Config

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import { visualizer } from 'rollup-plugin-visualizer'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.wellsai\.com\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 5, // 5 minutes
              },
            },
          },
        ],
      },
    }),
    visualizer({ filename: 'dist/stats.html' }),
  ],
  build: {
    target: 'es2020',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['preact', 'preact/hooks'],
          utils: ['./src/utils/helpers', './src/utils/formatters'],
        },
      },
    },
    cssCodeSplit: true,
    sourcemap: false,
    reportCompressedSize: true,
    chunkSizeWarningLimit: 500, // 500KB chunks max
  },
  server: {
    port: 3001,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
```

### Bundle Size Optimization

**Target Bundle Sizes:**
- Initial JS: <150KB gzipped
- Vendor chunk: <100KB gzipped
- CSS: <30KB gzipped
- Total page weight: <400KB

**Optimization Techniques:**
1. Code splitting by route
2. Lazy loading for heavy components
3. Tree-shaking unused code
4. Dynamic imports for conditional features
5. Image optimization (WebP, lazy loading)
6. Font subsetting

---

## Manifest Configuration

### Apple Mini App Manifest

```json
// public/manifest.json
{
  "name": "Wells AI",
  "short_name": "Wells AI",
  "description": "AI-powered B2B procurement and supplier matching",
  "version": "1.0.0",
  "mini_app_version": "1.0",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#2563eb",
  "orientation": "portrait",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ],
  "apple_mini_app": {
    "advanced_commerce_api": true,
    "declared_age_rating": {
      "min_age": 13,
      "age_rating": "12+"
    },
    "categories": ["business", "productivity"],
    "permissions": [
      "notifications",
      "storage"
    ],
    "iap_products": [
      {
        "id": "com.wellsai.miniapp.pro.monthly",
        "type": "auto_renewable_subscription"
      },
      {
        "id": "com.wellsai.miniapp.enterprise.monthly",
        "type": "auto_renewable_subscription"
      }
    ]
  },
  "scope": "/",
  "screenshots": [
    {
      "src": "/screenshots/chat.png",
      "sizes": "1170x2532",
      "type": "image/png"
    },
    {
      "src": "/screenshots/search.png",
      "sizes": "1170x2532",
      "type": "image/png"
    }
  ]
}
```

---

## Security Considerations

### Authentication Flow

```
1. User opens mini app in host app
2. Host app provides hostAppToken (validates user)
3. Mini app exchanges hostAppToken for Wells AI session
4. Session token stored in IndexedDB (encrypted)
5. All API requests include session token in header
6. Token refresh handled automatically on 401
```

### Data Protection

- **Encryption at rest:** IndexedDB encrypted with Web Crypto API
- **Encryption in transit:** All API calls over HTTPS/WSS
- **Token rotation:** JWT tokens expire every 1 hour
- **Secure storage:** Sensitive data never in LocalStorage

### Content Security Policy

```html
<meta http-equiv="Content-Security-Policy"
  content="default-src 'self';
           script-src 'self' 'unsafe-inline';
           style-src 'self' 'unsafe-inline';
           img-src 'self' data: https:;
           connect-src 'self' https://api.wellsai.com wss://api.wellsai.com;
           font-src 'self';
           frame-src 'none';">
```

---

## Performance Targets

### Loading Performance
- **First Contentful Paint (FCP):** <1.0s on 4G
- **Time to Interactive (TTI):** <2.0s on 4G
- **Largest Contentful Paint (LCP):** <2.5s
- **First Input Delay (FID):** <100ms
- **Cumulative Layout Shift (CLS):** <0.1

### Runtime Performance
- **60 FPS** during scrolling and animations
- **<50ms** response time for user interactions
- **<100MB** memory footprint
- **<5% CPU** usage when idle

### Network Performance
- **Offline-first** architecture with service workers
- **Background sync** for RFQ submissions
- **Optimistic UI** updates
- **Request deduplication** and caching

---

## Testing Strategy

### Unit Tests
- Jest for business logic
- Testing Library for components
- 80%+ code coverage target

### Integration Tests
- API integration tests with mock server
- IAP flow testing with StoreKit sandbox
- Authentication flow testing

### E2E Tests
- Playwright for critical user journeys
- iOS Simulator testing
- Real device testing on multiple iOS versions

### Performance Testing
- Lighthouse CI in build pipeline
- Bundle size monitoring
- Runtime performance profiling

---

## Deployment Pipeline

### Build Process

```bash
# 1. Install dependencies
npm ci

# 2. Run tests
npm test

# 3. Build for production
npm run build

# 4. Analyze bundle
npm run analyze

# 5. Verify bundle size
node scripts/check-bundle-size.js

# 6. Package for distribution
npm run package
```

### Hosting Options

**Option 1: Vercel Edge (Recommended)**
- Deploy alongside main Wells AI app
- Edge network for low latency
- Automatic HTTPS and CDN
- Path: `/mini-app/`

**Option 2: Dedicated CDN**
- Cloudflare Pages
- AWS CloudFront + S3
- Separate domain: `mini-app.wellsai.com`

### Version Management

```
Semantic Versioning: MAJOR.MINOR.PATCH

- MAJOR: Breaking changes requiring host app update
- MINOR: New features, backward compatible
- PATCH: Bug fixes, performance improvements

Example: 1.0.0 → 1.1.0 (new feature) → 1.1.1 (bug fix)
```

---

## Monitoring & Analytics

### Key Metrics to Track

**Usage Metrics:**
- Daily/Monthly Active Users (DAU/MAU)
- Session duration
- Feature adoption rates
- User retention cohorts

**Performance Metrics:**
- Core Web Vitals (LCP, FID, CLS)
- API response times
- Error rates
- Crash reports

**Business Metrics:**
- Free-to-paid conversion rate
- Revenue per user
- Churn rate
- RFQs created per user

### Monitoring Tools

- **Sentry** - Error tracking and performance monitoring
- **PostHog** - Product analytics and feature flags
- **Vercel Analytics** - Web vitals and visitor insights
- **App Store Connect** - Downloads and reviews

---

## Next Steps

1. **Week 1:** Set up mini app project structure
2. **Week 2:** Build core UI components
3. **Week 3:** Implement API integration
4. **Week 4:** Add IAP functionality
5. **Week 5:** Testing and optimization
6. **Week 6:** Submit to Apple for review

---

**Document Owner:** Wells AI Engineering Team
**Last Reviewed:** November 17, 2025
**Next Review:** December 17, 2025
