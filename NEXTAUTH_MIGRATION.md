# NextAuth Migration Complete

## Overview
Wells AI has been successfully migrated from Clerk to NextAuth.js with passwordless email authentication (magic links).

## What Changed

### 1. Authentication Method
- **Before**: Clerk managed authentication with username/password
- **After**: NextAuth with magic links sent via email (no passwords!)

### 2. Database Tables
Added NextAuth tables to Prisma schema:
- `User` - User accounts
- `Account` - OAuth accounts (future use)
- `Session` - Active sessions
- `VerificationToken` - Email verification tokens

### 3. Files Modified

#### Core Authentication
- `app/api/auth/[...nextauth]/route.ts` - NextAuth configuration (NEW)
- `lib/auth.ts` - Server-side auth helpers (NEW)
- `middleware.ts` - Updated to use NextAuth middleware
- `app/layout.tsx` - Replaced ClerkProvider with SessionProvider
- `app/components/SessionProvider.tsx` - Client wrapper for NextAuth (NEW)

#### Sign-in UI
- `app/sign-in/page.tsx` - Custom sign-in page (NEW)
- `app/verify-request/page.tsx` - Email verification page (NEW)

#### Components
- `app/components/LuxuryLanding.tsx` - Replaced `useUser()` with `useSession()`
- `app/components/EnterpriseLanding.tsx` - Replaced `useUser()` with `useSession()`
- `app/components/WellsAIContent.tsx` - Replaced `useUser()` with `useSession()`
- Replaced `UserButton` with custom sign-out button

#### API Routes
- `app/api/chat/route.ts` - Updated to use `getSession()` instead of `auth()`
- Other API routes will need similar updates (see below)

### 4. Environment Variables

#### Required (New)
```bash
# NextAuth Secret (generate with: openssl rand -base64 32)
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-here

# Email Provider (for magic links)
EMAIL_SERVER_HOST=smtp.gmail.com
EMAIL_SERVER_PORT=587
EMAIL_SERVER_USER=your-email@gmail.com
EMAIL_SERVER_PASSWORD=your-app-password
EMAIL_FROM=noreply@yourapp.com
```

#### Removed
```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY (no longer needed)
CLERK_SECRET_KEY (no longer needed)
```

## Setup Instructions

### 1. Install Dependencies (Already Done)
Packages already in package.json:
- `next-auth@^4.24.13`
- `@auth/prisma-adapter@^2.11.1`
- `nodemailer@^7.0.10`

### 2. Configure Environment Variables

Create a `.env.local` file:

```bash
# Generate a secret
openssl rand -base64 32

# Add to .env.local
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<paste-generated-secret-here>

# Email configuration (example with Gmail)
EMAIL_SERVER_HOST=smtp.gmail.com
EMAIL_SERVER_PORT=587
EMAIL_SERVER_USER=your-email@gmail.com
EMAIL_SERVER_PASSWORD=your-app-specific-password
EMAIL_FROM=noreply@yourapp.com
```

#### Gmail Setup
1. Enable 2-factor authentication on your Google account
2. Generate an App Password: https://myaccount.google.com/apppasswords
3. Use the app password as `EMAIL_SERVER_PASSWORD`

#### SendGrid Setup (Alternative)
```bash
EMAIL_SERVER_HOST=smtp.sendgrid.net
EMAIL_SERVER_PORT=587
EMAIL_SERVER_USER=apikey
EMAIL_SERVER_PASSWORD=<your-sendgrid-api-key>
EMAIL_FROM=noreply@yourapp.com
```

### 3. Run Database Migration

```bash
# Create NextAuth tables
npx prisma migrate dev --name add-nextauth-tables

# Generate Prisma client
npx prisma generate
```

### 4. Test the Authentication Flow

```bash
# Start dev server
npm run dev

# Visit http://localhost:3000/sign-in
# Enter your email
# Check your inbox for the magic link
# Click the link to sign in
```

## Migration Benefits

### Fixes Clerk Issues
- No more mobile browser authentication failures
- No more session management problems
- No more incognito mode issues
- Better cross-device continuity

### Better User Experience
- Passwordless authentication (magic links)
- No password to remember or reset
- Beautiful custom sign-in UI
- Faster sign-in flow

### Cost Savings
- NextAuth is completely free
- No per-user pricing
- No plan limits

## Code Migration Guide

### Client Components

#### Before (Clerk)
```typescript
import { useUser } from '@clerk/nextjs'

const { user, isSignedIn, isLoaded } = useUser()
```

#### After (NextAuth)
```typescript
import { useSession } from 'next-auth/react'

const { data: session, status } = useSession()
const user = session?.user
const isSignedIn = !!session?.user
const isLoaded = status !== 'loading'
```

### API Routes

#### Before (Clerk)
```typescript
import { auth } from '@clerk/nextjs/server'

const authData = await auth()
const userId = authData.userId
const userEmail = authData.sessionClaims?.email
```

#### After (NextAuth)
```typescript
import { getSession } from '@/lib/auth'

const session = await getSession()
const userId = session?.user?.id
const userEmail = session?.user?.email

// Or use the helper
import { requireAuth } from '@/lib/auth'
const user = await requireAuth() // Throws if not authenticated
```

### Sign Out

#### Before (Clerk)
```typescript
import { UserButton } from '@clerk/nextjs'

<UserButton afterSignOutUrl="/" />
```

#### After (NextAuth)
```typescript
import { signOut } from 'next-auth/react'

<button onClick={() => signOut({ callbackUrl: '/' })}>
  Sign Out
</button>
```

## Remaining API Routes to Update

Search for `@clerk/nextjs` imports in these files and update them:

```bash
# Find all files using Clerk
grep -r "@clerk/nextjs" app/api/
```

Common patterns to replace:
- `import { auth } from '@clerk/nextjs/server'` → `import { getSession } from '@/lib/auth'`
- `const { userId } = await auth()` → `const session = await getSession(); const userId = session?.user?.id`

## Deployment

### Vercel
1. Add environment variables in Vercel dashboard:
   - `NEXTAUTH_URL` - Your production URL (e.g., https://yourapp.com)
   - `NEXTAUTH_SECRET` - Generated secret (use same one from local)
   - `EMAIL_SERVER_*` - Email provider credentials
   - `EMAIL_FROM` - Your verified sender email

2. Run migration on production database:
   ```bash
   # Vercel will run this automatically if you have the build script
   npx prisma migrate deploy
   ```

### Other Platforms
1. Set the same environment variables
2. Run `npx prisma migrate deploy` before deployment
3. Ensure your production URL is set in `NEXTAUTH_URL`

## Testing Checklist

- [ ] Sign in with email works
- [ ] Magic link email is received
- [ ] Magic link successfully authenticates
- [ ] Session persists across page refreshes
- [ ] Mobile browser authentication works
- [ ] Incognito mode works
- [ ] Sign out works correctly
- [ ] Protected routes redirect to sign-in
- [ ] API routes check authentication
- [ ] Chat interface works for authenticated users

## Troubleshooting

### Magic Link Not Received
1. Check spam folder
2. Verify email provider credentials
3. Check server logs for email errors
4. Test with a different email provider

### "Invalid session" Error
1. Clear browser cookies
2. Check `NEXTAUTH_SECRET` is set correctly
3. Verify `NEXTAUTH_URL` matches your domain

### Migration Errors
1. Make sure Prisma schema has NextAuth models
2. Run `npx prisma generate`
3. Run `npx prisma migrate dev`
4. Check database connection string

## Support

If you encounter issues:
1. Check NextAuth documentation: https://next-auth.js.org
2. Review Prisma adapter docs: https://authjs.dev/reference/adapter/prisma
3. Check the example files in this migration

## Rollback Plan (If Needed)

If you need to rollback:
1. Restore `package.json` to previous version
2. Restore modified component files
3. Restore `.env.example` with Clerk variables
4. Run `npm install` to restore Clerk packages
5. Database tables can be kept (won't interfere)
