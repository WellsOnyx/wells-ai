# Wells AI - UI Refresh Plan

**Version:** 1.0
**Date:** October 31, 2025
**Status:** Ready for Review & Implementation

---

## Executive Summary

Wells AI has a solid foundation with a clear brand identity (Deep Blue #183b6d, Gold #dba63f), but the UI suffers from **inconsistencies**, **outdated patterns**, and **missing modern UX elements**. This plan outlines a comprehensive refresh to bring the entire platform to a professional, cohesive, modern standard.

**Key Findings:**
- 🟡 **Inconsistent Design System**: Colors/spacing/typography vary across pages
- 🔴 **Multiple UI Styles**: Some pages use modern Wells branding, others use generic gray/blue
- 🟡 **Missing States**: Inadequate loading, error, and empty states throughout
- 🟡 **Accessibility Issues**: Poor contrast, missing ARIA labels, keyboard nav gaps
- 🟢 **Strong Foundation**: Good component architecture, clear brand colors

---

## Part 1: Current State Assessment

### 1.1 Design System Audit

#### Colors - INCONSISTENT ⚠️

**Wells Brand Colors (Correct):**
```
Deep Blue:     #183b6d (primary)
Gold:          #dba63f (accent)
Dark Gray:     #575757 (body text)
Light Gray:    #9ea1a7 (secondary text)
Black:         #000000 (emphasis)
White:         #ffffff (backgrounds)
```

**Issues Found:**
- ❌ `/quotes/page.tsx` uses generic `blue-600`, `gray-50`, `yellow-100` instead of brand colors
- ❌ `/admin/page.tsx` uses black background (intentional? looks like different product)
- ❌ Chat components use `blue-600`, `gray-100` instead of Wells colors
- ⚠️ Inconsistent opacity values: `/20`, `/30`, `/40`, `/5` used randomly

**What Works:**
- ✅ Main landing page uses brand consistently
- ✅ GTM Dashboard uses brand correctly
- ✅ Onboarding uses brand throughout
- ✅ Partnerships page maintains brand identity

#### Typography - MIXED ⚠️

**Current Pattern:**
```
Headings:  font-serif (looks like default serif, not custom)
Body:      Inter (from Next font/google)
Code:      font-mono
```

**Issues:**
- 🟡 No clear hierarchy: h1/h2/h3 sizes vary wildly between pages
- 🟡 Line heights inconsistent: `leading-relaxed`, `leading-[0.95]`, default
- 🟡 Font weights inconsistent: `font-medium`, `font-bold`, `font-light` used randomly
- 🟡 No defined typography scale

**Examples:**
- Landing hero: `text-7xl md:text-8xl` (massive)
- GTM page: `text-3xl` for h1 (too small)
- Quotes page: `text-3xl` (generic style)
- Partnerships: `text-4xl` (good)

#### Spacing - INCONSISTENT ⚠️

**Current Pattern:**
```
Container padding: px-6 (most pages)
Section spacing: py-8, py-12 (varies)
Component padding: p-4, p-5, p-6 (no pattern)
Grid gaps: gap-4, gap-6, gap-8 (no system)
```

**Issues:**
- 🟡 No 8px grid system enforced
- 🟡 Random spacing values: `mb-12`, `mb-8`, `mb-6` used interchangeably
- 🟡 Inconsistent button padding: `px-6 py-3`, `px-8 py-4`, `px-4 py-2`

#### Borders & Shadows - INCONSISTENT ⚠️

**Current Pattern:**
```
Borders: border-[#9ea1a7]/20, border-[#9ea1a7]/30 (good)
Corners: rounded-sm everywhere (GOOD - brand consistency)
Shadows: shadow-sm, shadow-md (rare), none (most common)
```

**Issues:**
- 🟡 Very minimal use of shadows (intentional minimalism?)
- ⚠️ Some pages use `shadow` (generic), others use `shadow-sm`, most use none
- ✅ Consistent use of `rounded-sm` is excellent

---

### 1.2 Component Patterns Audit

#### Buttons - NEEDS STANDARDIZATION 🟡

**Found Patterns:**

1. **Primary Button (Wells Blue):**
   ```tsx
   // GOOD - Used on landing, GTM, partnerships
   className="px-8 py-3 bg-[#183b6d] text-white rounded-sm hover:bg-[#0d2545]"

   // BAD - Quotes page uses generic colors
   className="text-blue-600 hover:text-blue-900"
   ```

2. **Secondary Button (Gold):**
   ```tsx
   // GOOD - Used for CTAs
   className="px-6 py-3 bg-[#dba63f] text-white rounded-sm hover:bg-[#c89531]"
   ```

3. **Ghost Button:**
   ```tsx
   // INCONSISTENT padding
   className="px-6 py-3 border border-[#9ea1a7]/30 text-[#575757] rounded-sm hover:border-[#183b6d]"
   className="px-4 py-2 border border-[#9ea1a7]/30..." // Different size!
   ```

**Missing:**
- ❌ Disabled states inconsistent (some use `opacity-50`, others `opacity-40`, some `bg-[#9ea1a7]/50`)
- ❌ Loading states (spinner/text) inconsistent
- ❌ No button size system (sm/md/lg)
- ❌ No danger/warning button variants

#### Forms - INCONSISTENT 🟡

**Input Fields:**
```tsx
// Pattern 1 (most common - GOOD):
className="w-full px-4 py-3 border border-[#9ea1a7]/30 rounded-sm focus:outline-none focus:border-[#183b6d]"

// Pattern 2 (some pages):
className="w-full px-4 py-3 bg-white border border-[#9ea1a7]/30..." // Explicit bg-white

// Pattern 3 (HR page):
className="w-full px-4 py-3 border border-[#9ea1a7]/30 focus:border-[#183b6d] focus:outline-none" // Different order
```

**Issues:**
- 🟡 Inconsistent label styling: `text-sm font-medium text-[#183b6d]` vs `block text-sm font-medium`
- ❌ No error states styled
- ❌ No helper text pattern
- ❌ No inline validation feedback
- 🟡 Placeholder text inconsistent: `placeholder:text-[#9ea1a7]` vs just `placeholder`

#### Cards - MULTIPLE PATTERNS ⚠️

**Pattern 1 (Wells Brand - GOOD):**
```tsx
className="border border-[#9ea1a7]/20 rounded-sm p-6 bg-white hover:border-[#183b6d]"
```

**Pattern 2 (Quotes/Generic):**
```tsx
className="bg-white shadow overflow-hidden sm:rounded-lg" // Generic Tailwind
```

**Pattern 3 (Admin):**
```tsx
className="bg-gray-900 border border-gray-800 rounded-lg p-6" // Dark mode (inconsistent!)
```

**Issues:**
- ⚠️ Three completely different card styles across the app
- 🟡 Hover states inconsistent (some have hover, some don't)
- ❌ No card header/body/footer standardization

#### Tables - NEEDS WORK 🔴

**Current State:**
- ❌ `/quotes/page.tsx` uses full Tailwind UI table (looks generic, not Wells-branded)
- ❌ No Wells-branded table component exists
- ❌ Mobile responsiveness poor (tables don't scroll/collapse)
- ❌ No sorting indicators
- ❌ No pagination component

#### Navigation - MINIMAL ⚠️

**Current State:**
- ✅ Main chat has minimal header (good for focus)
- 🟡 GTM dashboard has tabs (good pattern)
- 🟡 No consistent app-wide navigation
- ❌ No breadcrumbs on deep pages
- ❌ No mobile menu component
- 🟡 Organization selector exists but style varies

---

### 1.3 Page-by-Page Analysis

#### ✅ Landing Page (`/page.tsx`) - EXCELLENT
**What Works:**
- Beautiful Wells branding throughout
- Constellation animation (unique, on-brand)
- Clean minimalist aesthetic
- Perfect use of brand colors
- Strong typography hierarchy
- Responsive design

**Minor Issues:**
- Could use more micro-interactions
- Input could have better focus states

**Score: 9/10** - This is the gold standard. Other pages should match this quality.

---

#### ⚠️ Onboarding (`/components/Onboarding.tsx`) - GOOD
**What Works:**
- Wells brand maintained
- Good step-by-step flow
- Nice icon usage

**Issues:**
- Form inputs could be more polished
- Transition between steps is instant (could animate)
- No progress indicator

**Score: 7/10**

---

#### ⚠️ GTM Dashboard (`/gtm/dashboard/page.tsx`) - GOOD
**What Works:**
- Wells brand colors maintained
- Good data visualization
- Clear tabs pattern
- Stats cards work well

**Issues:**
- Slight color inconsistencies in badges (`bg-green-100 text-green-700` vs Wells palette)
- Could use more visual hierarchy
- Empty states not styled
- Loading state too basic

**Score: 7.5/10**

---

#### 🔴 Quotes Page (`/quotes/page.tsx`) - NEEDS COMPLETE REFRESH
**Critical Issues:**
- ❌ Uses generic Tailwind UI components (`bg-gray-50`, `text-blue-600`)
- ❌ NO Wells branding at all
- ❌ Looks like different product entirely
- ❌ Generic "blue" accent colors
- ❌ Shadows don't match brand (uses `shadow` not `shadow-sm`)
- ❌ Loading spinner is generic blue, not Wells blue

**Needs:**
- Complete redesign using Wells brand
- Custom table component
- Better mobile layout
- Status badges in brand colors

**Score: 3/10** - PRIORITY FIX

---

#### 🔴 Admin Dashboard (`/admin/page.tsx`) - INTENTIONAL DARK MODE?
**Issues:**
- ❌ Black background with white text (looks like terminal/dev tool)
- ❌ NO connection to Wells brand visually
- ❌ Uses `bg-gray-900` throughout (not brand colors)
- ⚠️ May be intentional "command center" aesthetic?

**Decision Needed:**
- If admin is meant to feel different, okay (but document it)
- If not, needs complete refresh to match brand

**Score: ?/10** - Needs product decision

---

#### ⚠️ Payment Page (`/payment/page.tsx`) - GOOD BUT COULD BE BETTER
**What Works:**
- Wells brand maintained
- Good use of gold for CTAs
- Clear payment flow
- Nice summary cards

**Issues:**
- 🟡 Stripe Elements placeholders are gray boxes (fine for MVP)
- 🟡 Radio buttons could be custom-styled to brand
- 🟡 Success state transition is instant (could animate)
- 🟡 Error state is red border (could be Wells-branded)

**Score: 7/10**

---

#### ⚠️ Partnerships (`/partnerships/page.tsx`) - GOOD
**What Works:**
- Wells branding maintained
- Good use of emoji + color
- Live activity feed is nice touch
- Modal is clean

**Issues:**
- 🟡 Hover states could be smoother
- 🟡 Grid could be more responsive
- 🟡 Modal transition is instant (could fade)

**Score: 7.5/10**

---

#### ⚠️ HR Onboarding (`/hr/onboard/page.tsx`) - GOOD BUT LONG
**What Works:**
- Wells brand maintained
- Good educational content
- Clear step-by-step

**Issues:**
- 🟡 Very long page with lots of scrolling
- 🟡 Could use sticky progress indicator
- 🟡 Form validation not visible
- 🟡 Select dropdowns are default style

**Score: 7/10**

---

#### ⚠️ GTM Campaign Setup (`/gtm/page.tsx`) - GOOD
**What Works:**
- Wells brand maintained
- Good form organization
- Clear call-to-actions
- Sample message preview is excellent

**Issues:**
- 🟡 Form could feel more interactive
- 🟡 Select dropdowns are default style
- 🟡 Could use inline validation
- 🟡 Success state transition instant

**Score: 7.5/10**

---

#### 🟡 Chat Components (`/components/chat/`) - NEEDS BRAND COLORS
**Issues:**
- ❌ Uses `bg-blue-600` instead of Wells blue
- ❌ Uses `bg-gray-100` instead of Wells light gray
- 🟡 Message bubbles generic style
- 🟡 No message send/receive animations

**Score: 6/10**

---

### 1.4 Missing/Inadequate States

#### Loading States ⚠️

**Current:**
```tsx
// Pattern 1: Spinner (varies)
<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />

// Pattern 2: Dots (landing page - GOOD)
<div className="w-1.5 h-1.5 bg-[#183b6d] rounded-full animate-bounce" />

// Pattern 3: Text only
{isLoading ? 'Loading...' : 'Submit'}
```

**Issues:**
- ❌ Generic blue spinner in `/quotes/page.tsx`
- 🟡 No skeleton loaders anywhere
- 🟡 Page transitions instant (no loading indicators)
- ✅ Landing page loading dots are excellent (use this!)

#### Error States 🔴

**Current:**
```tsx
// Pattern 1: Red border (inconsistent)
<div className="border border-red-300 bg-red-50 rounded-sm p-4">

// Pattern 2: Text only
<p className="text-sm text-red-600">{error}</p>
```

**Issues:**
- ❌ No standardized error component
- ❌ No inline form validation errors
- ❌ No toast/notification system
- ❌ Red color doesn't fit brand palette (should we use Wells colors?)

#### Empty States ❌

**Current:**
- ⚠️ `/quotes/page.tsx` has basic empty state with generic icon
- ❌ Most pages don't handle empty states
- ❌ No illustrations or helpful messaging
- ❌ No CTAs to guide users

**Examples Needed:**
- No RFQs yet → "Create your first RFQ"
- No suppliers → "Invite suppliers to the marketplace"
- No campaigns → "Launch your first GTM campaign"
- No deals → "Start transacting"

#### Success States 🟡

**Current:**
```tsx
// Pattern 1: Green checkmark (good)
<svg className="w-8 h-8 text-green-600" />

// Pattern 2: Instant redirect (no feedback)
```

**Issues:**
- 🟡 Success states vary in style
- 🟡 No confetti/celebration micro-interactions
- 🟡 Messages vary: some playful, some generic

---

### 1.5 Responsive Design Audit

#### Mobile Breakpoints ⚠️

**Current Usage:**
```tsx
md:text-8xl  // Used but not consistently
lg:grid-cols-3  // Some pages
sm:rounded-lg  // Quotes page
```

**Issues:**
- 🟡 Mobile-first approach inconsistent
- 🟡 Some pages don't test well on mobile
- ❌ Tables don't scroll horizontally on mobile
- ⚠️ Landing page hero text might be too large on mobile
- 🟡 Forms could be more thumb-friendly on mobile

#### Touch Targets ⚠️

**Issues:**
- 🟡 Some buttons are `py-2` (32px height) - should be minimum 44px for mobile
- 🟡 Small clickable areas in tables
- ❌ No touch gesture support (swipe, etc.)

---

### 1.6 Accessibility Audit

#### Color Contrast 🟡

**Wells Brand Colors:**
- ✅ `#183b6d` on white: 8.59:1 (WCAG AAA) - EXCELLENT
- ✅ `#dba63f` on white: 4.36:1 (WCAG AA) - GOOD
- ⚠️ `#9ea1a7` on white: 2.76:1 (WCAG AA FAIL) - ISSUES

**Issues:**
- ❌ Light gray text `#9ea1a7` fails WCAG AA for small text
- 🟡 Some hover states reduce contrast
- 🟡 Placeholder text may be too light

#### Semantic HTML 🟡

**Issues:**
- ❌ No `<main>` landmark on most pages
- ❌ Some buttons should be links (and vice versa)
- 🟡 Heading hierarchy skips levels (h1 → h3)
- ❌ Form labels not always associated with inputs
- ❌ No `<fieldset>` for grouped form controls

#### ARIA & Screen Readers ❌

**Issues:**
- ❌ No `aria-label` on icon buttons
- ❌ Loading states don't announce to screen readers
- ❌ No `aria-live` regions for dynamic content
- ❌ Modals don't trap focus
- ❌ No skip-to-content link

#### Keyboard Navigation ⚠️

**Issues:**
- 🟡 Focus states inconsistent (some use `focus:outline-none` without replacement)
- ❌ Modal doesn't trap focus
- ❌ Tab order not optimized
- 🟡 No visible focus indicator on some elements
- ❌ No keyboard shortcuts

---

## Part 2: UI Refresh Strategy

### 2.1 Design System Standardization

#### New Design Tokens

**Create:** `/lib/design-tokens.ts`

```typescript
export const colors = {
  // Brand
  primary: '#183b6d',      // Deep Blue
  primaryHover: '#0d2545', // Darker blue for hovers
  accent: '#dba63f',       // Gold
  accentHover: '#c89531',  // Darker gold

  // Neutrals
  black: '#000000',
  gray900: '#1a1a1a',      // NEW - for dark text
  gray700: '#575757',      // Body text
  gray500: '#9ea1a7',      // Secondary text (review contrast!)
  gray300: '#d1d5db',      // NEW - borders
  gray100: '#f3f4f6',      // NEW - subtle backgrounds
  white: '#ffffff',

  // Semantic (use Wells colors!)
  success: '#22c55e',      // Keep green for success
  warning: '#dba63f',      // Use Wells gold
  error: '#b91c1c',        // Dark red (not bright)
  info: '#183b6d',         // Use Wells blue

  // Opacity helpers
  overlay: 'rgba(0, 0, 0, 0.5)',
}

export const spacing = {
  // 8px grid system
  xs: '0.5rem',   // 8px
  sm: '0.75rem',  // 12px
  md: '1rem',     // 16px
  lg: '1.5rem',   // 24px
  xl: '2rem',     // 32px
  '2xl': '3rem',  // 48px
  '3xl': '4rem',  // 64px
}

export const typography = {
  // Font families
  sans: 'Inter, system-ui, sans-serif',
  serif: 'Georgia, serif', // Consider custom serif font?
  mono: 'ui-monospace, monospace',

  // Font sizes (scale)
  xs: '0.75rem',    // 12px
  sm: '0.875rem',   // 14px
  base: '1rem',     // 16px
  lg: '1.125rem',   // 18px
  xl: '1.25rem',    // 20px
  '2xl': '1.5rem',  // 24px
  '3xl': '1.875rem',// 30px
  '4xl': '2.25rem', // 36px
  '5xl': '3rem',    // 48px
  '6xl': '3.75rem', // 60px
  '7xl': '4.5rem',  // 72px

  // Line heights
  tight: '1.25',
  normal: '1.5',
  relaxed: '1.75',

  // Font weights
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
}

export const borders = {
  radius: {
    none: '0',
    sm: '0.125rem',  // 2px - Wells standard
    md: '0.25rem',   // 4px
    lg: '0.5rem',    // 8px
    full: '9999px',
  },
  width: {
    default: '1px',
    thick: '2px',
    thicker: '4px',
  }
}

export const shadows = {
  // Minimal shadows (Wells aesthetic)
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
  // For cards that need to "float"
  float: '0 8px 16px rgba(24, 59, 109, 0.08)',
}

export const transitions = {
  fast: '150ms ease',
  normal: '250ms ease',
  slow: '350ms ease',
}
```

---

#### Updated Tailwind Config

**Update:** `/tailwind.config.js`

```javascript
const tokens = require('./lib/design-tokens')

module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Wells brand colors (keep existing names for compatibility)
        'wells-blue': tokens.colors.primary,
        'wells-gold': tokens.colors.accent,
        'wells-black': tokens.colors.black,
        'wells-gray-dark': tokens.colors.gray700,
        'wells-gray-light': tokens.colors.gray500,

        // Semantic names (NEW - prefer these in new code)
        primary: tokens.colors.primary,
        'primary-hover': tokens.colors.primaryHover,
        accent: tokens.colors.accent,
        'accent-hover': tokens.colors.accentHover,
      },
      spacing: tokens.spacing,
      fontSize: tokens.typography,
      fontFamily: {
        sans: tokens.typography.sans,
        serif: tokens.typography.serif,
        mono: tokens.typography.mono,
      },
      borderRadius: tokens.borders.radius,
      boxShadow: tokens.shadows,
      transitionDuration: {
        fast: '150ms',
        normal: '250ms',
        slow: '350ms',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'), // Better form defaults
  ],
}
```

---

### 2.2 Component Library - Standardized Building Blocks

**Create:** `/app/components/ui/` directory

#### Button Component

**File:** `/app/components/ui/Button.tsx`

```typescript
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  disabled?: boolean
  fullWidth?: boolean
  children: React.ReactNode
  onClick?: () => void
  type?: 'button' | 'submit' | 'reset'
  className?: string // Allow overrides
}

// Standardized Wells-branded button
// No more inconsistent padding/colors!
```

**Variants:**
```tsx
// Primary: Wells Blue background
<Button variant="primary">Submit</Button>

// Secondary: Wells Gold background
<Button variant="secondary">Learn More</Button>

// Ghost: Transparent with border
<Button variant="ghost">Cancel</Button>

// Danger: Red for destructive actions
<Button variant="danger">Delete</Button>
```

**Sizes:**
```tsx
<Button size="sm">Small</Button>   // px-4 py-2 text-sm
<Button size="md">Medium</Button>  // px-6 py-3 text-base (default)
<Button size="lg">Large</Button>   // px-8 py-4 text-lg
```

**States:**
- Hover: Darken background
- Focus: Blue ring (Wells blue)
- Disabled: Opacity 50%, cursor not-allowed
- Loading: Spinner + "Loading..." text

---

#### Input Component

**File:** `/app/components/ui/Input.tsx`

```typescript
interface InputProps {
  label?: string
  error?: string
  helperText?: string
  required?: boolean
  disabled?: boolean
  placeholder?: string
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'email' | 'password' | 'tel' | 'number'
  className?: string
}

// Standardized form input
// Always includes label, error state, helper text
```

**Features:**
- Label always above input
- Error state: Red border + error message below
- Helper text: Gray text below input
- Focus state: Wells blue border
- Disabled state: Gray background

---

#### Card Component

**File:** `/app/components/ui/Card.tsx`

```typescript
interface CardProps {
  children: React.ReactNode
  hover?: boolean  // Add hover effect
  border?: 'light' | 'medium' | 'heavy'
  padding?: 'sm' | 'md' | 'lg'
  className?: string
}

// Standardized Wells-branded card
// border border-[#9ea1a7]/20 rounded-sm bg-white
```

**Subcomponents:**
```tsx
<Card>
  <Card.Header>Title</Card.Header>
  <Card.Body>Content</Card.Body>
  <Card.Footer>Actions</Card.Footer>
</Card>
```

---

#### Table Component (NEW)

**File:** `/app/components/ui/Table.tsx`

```typescript
// Wells-branded table component
// Replaces generic Tailwind UI tables
```

**Features:**
- Wells color scheme
- Responsive (scrolls on mobile)
- Sortable columns
- Selectable rows
- Pagination
- Empty state built-in

---

#### Loading Components

**File:** `/app/components/ui/Loading.tsx`

```typescript
// Spinner with Wells blue
export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  // Consistent spinner using Wells blue
}

// Dots animation (like landing page)
export function LoadingDots() {
  // Three dots bouncing (Wells blue)
}

// Skeleton loaders
export function Skeleton({ className }: { className?: string }) {
  // Gray animated skeleton
}
```

---

#### Toast/Notification System (NEW)

**File:** `/app/components/ui/Toast.tsx`

```typescript
// Toast notifications for success/error/info
// Uses Wells colors
// Appears top-right corner
// Auto-dismisses after 5s
```

---

#### Modal Component

**File:** `/app/components/ui/Modal.tsx`

```typescript
interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

// Standardized modal
// Backdrop, focus trap, ESC to close
// Fade-in animation
```

---

#### Badge Component

**File:** `/app/components/ui/Badge.tsx`

```typescript
interface BadgeProps {
  variant: 'success' | 'warning' | 'error' | 'info' | 'neutral'
  children: React.ReactNode
  size?: 'sm' | 'md'
}

// Status badges using Wells colors
// Replaces generic green/yellow/red badges
```

---

### 2.3 Animation & Micro-interactions

**Create:** `/lib/animations.ts`

```typescript
// Framer Motion variants for consistent animations

export const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.25 } }
}

export const slideUp = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { duration: 0.3 } }
}

export const scaleIn = {
  hidden: { scale: 0.95, opacity: 0 },
  visible: { scale: 1, opacity: 1, transition: { duration: 0.2 } }
}

export const stagger = {
  visible: {
    transition: {
      staggerChildren: 0.1
    }
  }
}
```

**Add animations to:**
- Page transitions
- Modal open/close
- List items appearing
- Button hover states
- Success states (confetti?)
- Loading states

---

### 2.4 Accessibility Improvements

#### Focus Management

**Add to global CSS:**
```css
/* Remove default focus ring */
*:focus {
  outline: none;
}

/* Add custom Wells-branded focus ring */
*:focus-visible {
  outline: 2px solid #183b6d;
  outline-offset: 2px;
}

/* Exception for buttons (use ring) */
button:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(24, 59, 109, 0.2);
}
```

#### ARIA Labels

**Add to all icon buttons:**
```tsx
<button aria-label="Close modal">
  <XIcon />
</button>
```

#### Live Regions

**Add for dynamic content:**
```tsx
<div role="status" aria-live="polite" aria-atomic="true">
  {loading && "Loading..."}
  {error && "Error occurred"}
  {success && "Success!"}
</div>
```

#### Skip Link

**Add to layout:**
```tsx
<a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-[#183b6d] focus:text-white">
  Skip to main content
</a>
```

---

## Part 3: Priority List

### 🔴 CRITICAL - Fix ASAP (Week 1)

**P0: Quotes Page Complete Refresh**
- **Impact:** HIGH - Customer-facing, looks unprofessional
- **Effort:** Medium (8 hours)
- **Tasks:**
  - Replace all generic Tailwind colors with Wells brand
  - Create Wells-branded Table component
  - Style status badges with Wells colors
  - Add proper empty state
  - Add loading skeletons
  - Make mobile responsive
- **Files:** `/app/quotes/page.tsx`

**P1: Chat Components Color Fix**
- **Impact:** HIGH - Core experience
- **Effort:** Small (2 hours)
- **Tasks:**
  - Replace `bg-blue-600` with `bg-[#183b6d]`
  - Replace `bg-gray-100` with Wells gray
  - Update timestamp colors
- **Files:** `/app/components/chat/ChatMessageRenderer.tsx`

**P2: Admin Dashboard Decision**
- **Impact:** Medium - Internal tool
- **Effort:** N/A (decision only)
- **Tasks:**
  - Decide: Is dark mode intentional?
  - If yes: Document it, add toggle
  - If no: Refresh to Wells brand
- **Files:** `/app/admin/page.tsx`

---

### 🟡 HIGH PRIORITY - Fix Soon (Week 2-3)

**P3: Create Component Library**
- **Impact:** HIGH - Enables future consistency
- **Effort:** Large (20 hours)
- **Tasks:**
  - Create Button component with all variants
  - Create Input/Form components
  - Create Card component
  - Create Table component
  - Create Modal component
  - Create Badge component
  - Create Loading components
  - Create Toast system
  - Document in Storybook or similar
- **Files:** Create `/app/components/ui/` directory

**P4: Design Tokens & Config**
- **Impact:** HIGH - Foundation for everything
- **Effort:** Medium (6 hours)
- **Tasks:**
  - Create design tokens file
  - Update Tailwind config
  - Add Tailwind forms plugin
  - Document usage
- **Files:** `/lib/design-tokens.ts`, `/tailwind.config.js`

**P5: Loading States Standardization**
- **Impact:** Medium - Better UX
- **Effort:** Medium (8 hours)
- **Tasks:**
  - Create Spinner component
  - Create Skeleton loaders
  - Add loading states to all pages
  - Add page transition indicators
- **Files:** All pages

**P6: Error States & Validation**
- **Impact:** Medium - Better UX
- **Effort:** Medium (8 hours)
- **Tasks:**
  - Create Toast notification system
  - Add inline form validation
  - Add error boundaries
  - Style all error states with Wells colors
- **Files:** All forms, error boundaries

---

### 🟢 NICE TO HAVE - Polish (Week 4+)

**P7: Empty States**
- **Impact:** Low - Edge cases
- **Effort:** Medium (6 hours)
- **Tasks:**
  - Design empty state illustrations
  - Add helpful CTAs
  - Add to all list/table views
- **Files:** All list pages

**P8: Animations & Micro-interactions**
- **Impact:** Low - Polish
- **Effort:** Large (15 hours)
- **Tasks:**
  - Add Framer Motion
  - Animate page transitions
  - Animate modals
  - Add hover animations
  - Add success celebrations
- **Files:** All pages

**P9: Accessibility Audit Fixes**
- **Impact:** Medium - Legal/ethical
- **Effort:** Large (20 hours)
- **Tasks:**
  - Fix color contrast issues
  - Add ARIA labels everywhere
  - Fix keyboard navigation
  - Add skip links
  - Test with screen readers
- **Files:** All pages

**P10: Mobile Optimization**
- **Impact:** Medium - Mobile users
- **Effort:** Large (15 hours)
- **Tasks:**
  - Optimize touch targets (44px minimum)
  - Fix table horizontal scrolling
  - Test all pages on mobile
  - Add mobile-specific interactions
- **Files:** All pages

**P11: Dark Mode Support** (Optional)
- **Impact:** Low - Nice to have
- **Effort:** Large (20 hours)
- **Tasks:**
  - Create dark theme tokens
  - Add theme toggle
  - Test all pages in dark mode
- **Files:** All pages, design tokens

---

## Part 4: Before/After Examples

### Example 1: Quotes Page Table

**Before:**
```tsx
// Generic Tailwind UI - blue accents, gray backgrounds
<table className="min-w-full divide-y divide-gray-200">
  <thead className="bg-gray-50">
    <th className="text-gray-500">Supplier</th>
  </thead>
  <tbody className="bg-white divide-y divide-gray-200">
    <button className="text-blue-600 hover:text-blue-900">View</button>
  </tbody>
</table>
```

**After:**
```tsx
// Wells-branded Table component
<Table>
  <Table.Header>
    <Table.Column>Supplier</Table.Column>
  </Table.Header>
  <Table.Body>
    <Table.Row>
      <Table.Cell>{supplier}</Table.Cell>
      <Table.Cell>
        <Button variant="ghost" size="sm">View</Button>
      </Table.Cell>
    </Table.Row>
  </Table.Body>
</Table>

// Uses Wells colors:
// - Headers: bg-white border-b border-[#9ea1a7]/20 text-[#575757]
// - Rows: hover:bg-[#183b6d]/5
// - Actions: Wells blue buttons
```

---

### Example 2: Loading States

**Before:**
```tsx
// Inconsistent across pages
{loading && <div className="animate-spin h-12 w-12 border-b-2 border-blue-600" />}
{loading && "Loading..."}
```

**After:**
```tsx
// Standardized component
{loading && <Spinner size="md" />}
// OR
{loading && <LoadingDots />}
// OR for content
{loading ? <Skeleton className="h-20 w-full" /> : <Content />}
```

---

### Example 3: Status Badges

**Before:**
```tsx
// Generic colors
<span className="bg-yellow-100 text-yellow-800">Pending</span>
<span className="bg-green-100 text-green-800">Accepted</span>
<span className="bg-red-100 text-red-800">Rejected</span>
```

**After:**
```tsx
// Wells-branded Badge component
<Badge variant="warning">Pending</Badge>   {/* Uses Wells gold */}
<Badge variant="success">Accepted</Badge>  {/* Green is okay for success */}
<Badge variant="error">Rejected</Badge>    {/* Dark red */}
<Badge variant="info">In Progress</Badge>  {/* Uses Wells blue */}
```

---

### Example 4: Chat Messages

**Before:**
```tsx
// Generic blue
className="bg-blue-600 text-white"  // User message
className="bg-gray-100 text-gray-900"  // Assistant message
```

**After:**
```tsx
// Wells brand
className="bg-[#183b6d] text-white"  // User message
className="bg-white border border-[#9ea1a7]/20 text-[#575757]"  // Assistant message
```

---

### Example 5: Buttons

**Before:**
```tsx
// Inconsistent sizing/styling
<button className="px-6 py-3 bg-[#183b6d] text-white rounded-sm hover:bg-[#0d2545]">Submit</button>
<button className="px-4 py-2 bg-[#183b6d] text-white rounded-sm">Submit</button>  // Different size!
<button className="text-blue-600 hover:text-blue-900">View</button>  // Wrong color!
```

**After:**
```tsx
// Standardized Button component
<Button variant="primary">Submit</Button>
<Button variant="primary" size="sm">Submit</Button>
<Button variant="ghost">View</Button>  // Uses Wells colors
```

---

## Part 5: Implementation Checklist

### Week 1: Critical Fixes (32 hours)

**Monday-Tuesday:**
- [ ] Create `/lib/design-tokens.ts`
- [ ] Update `/tailwind.config.js`
- [ ] Install `@tailwindcss/forms` plugin
- [ ] Document design tokens in README

**Wednesday-Thursday:**
- [ ] Refresh `/app/quotes/page.tsx` with Wells brand
- [ ] Fix chat component colors
- [ ] Test on desktop/mobile

**Friday:**
- [ ] Decide on Admin dashboard direction
- [ ] Fix Admin dashboard OR document as intentional
- [ ] QA week 1 changes

---

### Week 2: Component Library (40 hours)

**Monday:**
- [ ] Create `/app/components/ui/` directory
- [ ] Create `Button.tsx` with all variants
- [ ] Create `Input.tsx` with validation states
- [ ] Test Button/Input in Storybook

**Tuesday:**
- [ ] Create `Card.tsx` with Header/Body/Footer
- [ ] Create `Badge.tsx` with all variants
- [ ] Test Card/Badge components

**Wednesday:**
- [ ] Create `Table.tsx` component
- [ ] Make Table responsive
- [ ] Add sorting/pagination features

**Thursday:**
- [ ] Create `Modal.tsx` with animations
- [ ] Create `Loading.tsx` (Spinner, Dots, Skeleton)
- [ ] Create `Toast.tsx` notification system

**Friday:**
- [ ] Document all components
- [ ] Create usage examples
- [ ] QA week 2 changes

---

### Week 3: Apply Component Library (40 hours)

**Monday:**
- [ ] Refactor `/app/quotes/page.tsx` to use new components
- [ ] Refactor `/app/payment/page.tsx`
- [ ] Test

**Tuesday:**
- [ ] Refactor `/app/gtm/dashboard/page.tsx`
- [ ] Refactor `/app/partnerships/page.tsx`
- [ ] Test

**Wednesday:**
- [ ] Refactor `/app/hr/onboard/page.tsx`
- [ ] Refactor `/app/gtm/page.tsx`
- [ ] Test

**Thursday:**
- [ ] Add loading states to all pages
- [ ] Add error states to all forms
- [ ] Test error handling

**Friday:**
- [ ] Add empty states to list pages
- [ ] QA week 3 changes
- [ ] Fix bugs

---

### Week 4: Polish & Accessibility (40 hours)

**Monday-Tuesday:**
- [ ] Add Framer Motion
- [ ] Animate page transitions
- [ ] Animate modals/toasts
- [ ] Add button hover animations

**Wednesday:**
- [ ] Fix color contrast issues
- [ ] Add ARIA labels to all icons
- [ ] Add skip links
- [ ] Fix focus indicators

**Thursday:**
- [ ] Test keyboard navigation
- [ ] Test with screen reader
- [ ] Fix semantic HTML issues
- [ ] Add live regions

**Friday:**
- [ ] Mobile optimization pass
- [ ] Fix touch targets
- [ ] Final QA
- [ ] Ship to production!

---

## Part 6: Estimated Effort

### Time Breakdown

| Phase | Tasks | Estimated Hours |
|-------|-------|----------------|
| **Week 1: Critical Fixes** | Design tokens, Quotes refresh, Chat colors, Admin decision | 32 hours |
| **Week 2: Component Library** | Button, Input, Card, Table, Modal, Loading, Toast, Badge | 40 hours |
| **Week 3: Apply Library** | Refactor all pages, add loading/error/empty states | 40 hours |
| **Week 4: Polish** | Animations, accessibility, mobile optimization, QA | 40 hours |
| **TOTAL** | | **152 hours** |

### Team Size Scenarios

**1 Designer + 1 Developer:**
- 4 weeks full-time
- Ship incrementally each week

**1 Full-stack Developer (solo):**
- 6 weeks part-time (25 hrs/week)
- Or 4 weeks if focused

**Just want quick wins?**
- Week 1 only = 32 hours
- Fixes biggest visual issues
- Can iterate later

---

## Part 7: Success Metrics

### How to measure success:

**Design Consistency:**
- [ ] All pages use Wells brand colors (0 generic blue/gray)
- [ ] All components use standardized spacing
- [ ] Typography hierarchy is consistent

**User Experience:**
- [ ] 0 pages without loading states
- [ ] 0 forms without validation/error feedback
- [ ] 0 list pages without empty states
- [ ] All interactions feel smooth (animations)

**Accessibility:**
- [ ] WCAG AA compliance (color contrast)
- [ ] 100% keyboard navigable
- [ ] Screen reader tested
- [ ] Mobile touch targets 44px+

**Code Quality:**
- [ ] 0 inline color values (all use design tokens)
- [ ] 0 duplicate button styles (use Button component)
- [ ] 0 duplicate form styles (use Input component)
- [ ] All pages use component library

---

## Part 8: Risk Mitigation

### Potential Issues & Solutions

**Issue 1: Breaking existing functionality**
- **Solution:** Implement component library alongside existing code
- **Solution:** Migrate pages one at a time
- **Solution:** Keep old code until new is tested

**Issue 2: Design system too rigid**
- **Solution:** Allow className overrides on all components
- **Solution:** Keep escape hatches for unique cases
- **Solution:** Iterate based on usage

**Issue 3: Time overruns**
- **Solution:** Ship incrementally (Week 1 can ship alone)
- **Solution:** Focus on P0/P1 first
- **Solution:** P7-P11 can be postponed

**Issue 4: User confusion during transition**
- **Solution:** Ship all related changes at once (e.g., all of GTM pages)
- **Solution:** Don't leave half-migrated pages
- **Solution:** Test with users before shipping

---

## Part 9: Post-Launch

### After refresh is complete:

**Documentation:**
- [ ] Design system docs (colors, spacing, typography)
- [ ] Component library docs with examples
- [ ] Contribution guide for new components
- [ ] Figma design system (if using Figma)

**Maintenance:**
- [ ] Regular design reviews (quarterly)
- [ ] Update components as needed
- [ ] Add new components to library (don't inline!)
- [ ] Keep consistency as #1 priority

**Future Enhancements:**
- Dark mode support (if desired)
- Advanced animations (scroll reveals, etc.)
- Illustration system
- Icon library expansion
- Motion design system

---

## Appendix: Key Files to Create/Update

### New Files to Create:
```
/lib/design-tokens.ts              (Design system foundation)
/lib/animations.ts                 (Animation variants)
/app/components/ui/Button.tsx      (Standard button)
/app/components/ui/Input.tsx       (Form inputs)
/app/components/ui/Card.tsx        (Card container)
/app/components/ui/Table.tsx       (Data tables)
/app/components/ui/Modal.tsx       (Modals/dialogs)
/app/components/ui/Loading.tsx     (Spinner, Skeleton, Dots)
/app/components/ui/Toast.tsx       (Notifications)
/app/components/ui/Badge.tsx       (Status badges)
/app/components/ui/index.ts        (Export all)
```

### Files to Update:
```
/tailwind.config.js                (Add design tokens)
/app/globals.css                   (Focus styles, utilities)
/app/quotes/page.tsx               (Complete refresh)
/app/admin/page.tsx                (Refresh or document)
/app/components/chat/ChatMessageRenderer.tsx  (Color fixes)
/app/gtm/dashboard/page.tsx        (Refactor to use library)
/app/partnerships/page.tsx         (Refactor to use library)
/app/payment/page.tsx              (Refactor to use library)
/app/hr/onboard/page.tsx           (Refactor to use library)
/app/gtm/page.tsx                  (Refactor to use library)
```

---

## Final Notes

This UI refresh will:
1. **Eliminate inconsistencies** across the entire platform
2. **Establish Wells brand identity** visually everywhere
3. **Improve user experience** with proper loading/error/empty states
4. **Accelerate future development** with reusable component library
5. **Improve accessibility** for all users
6. **Create foundation for scale** as product grows

**The refresh is focused on:**
- Consistency over novelty
- Wells brand over generic Tailwind
- User experience over developer convenience
- Accessibility over aesthetics alone

**This is NOT a redesign.** It's a systematic refresh to bring existing UI to a professional, consistent standard while maintaining the excellent foundation already in place (especially the landing page).

---

**Ready to start? Begin with Week 1 tasks above.**

Questions or need clarification on any section? Let me know!
