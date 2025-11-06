# NextAuth Setup - Quick Start

This is a **5-minute setup guide** to get NextAuth running with Wells AI.

## Prerequisites

- Node.js installed
- PostgreSQL database available (existing DATABASE_URL works)
- Email provider credentials (Gmail recommended for testing)

## Step 1: Environment Variables (2 minutes)

Create `.env.local` in the project root:

```bash
# 1. Generate secret
openssl rand -base64 32

# 2. Copy this template and fill it out
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<paste-the-secret-you-just-generated>

# 3. Email provider (Gmail example - easiest for testing)
EMAIL_SERVER_HOST=smtp.gmail.com
EMAIL_SERVER_PORT=587
EMAIL_SERVER_USER=your-email@gmail.com
EMAIL_SERVER_PASSWORD=your-gmail-app-password
EMAIL_FROM=noreply@yourapp.com

# 4. Database (already have this)
DATABASE_URL=<your-existing-database-url>
```

### Getting Gmail App Password

1. Go to https://myaccount.google.com/apppasswords
2. Select "Mail" and your device
3. Copy the 16-character password
4. Paste it as `EMAIL_SERVER_PASSWORD`

## Step 2: Database Migration (1 minute)

```bash
# Create NextAuth tables
npm run db:migrate

# Or manually:
npx prisma migrate dev --name add_nextauth_tables
```

This adds 4 new tables: `User`, `Account`, `Session`, `VerificationToken`

## Step 3: Test It (2 minutes)

```bash
# Start dev server
npm run dev

# Open browser
open http://localhost:3000/sign-in

# Enter your email
# Check inbox for magic link
# Click link to sign in
```

## That's It!

You're done! Authentication now works with:
- ✅ Passwordless magic links
- ✅ No more Clerk issues
- ✅ Mobile browser support
- ✅ Incognito mode support

## Common Issues

### Email not received?
1. Check spam folder
2. Verify Gmail app password is correct
3. Make sure 2FA is enabled on Gmail account

### Migration error?
```bash
# Reset and try again
npx prisma migrate reset
npx prisma migrate dev --name add_nextauth_tables
```

### Session not persisting?
- Check `NEXTAUTH_SECRET` is set
- Clear browser cookies
- Restart dev server

## Production Setup

### Vercel

1. Add environment variables in Vercel dashboard:
   ```
   NEXTAUTH_URL=https://your-domain.com
   NEXTAUTH_SECRET=<same-secret-from-local>
   EMAIL_SERVER_HOST=smtp.gmail.com
   EMAIL_SERVER_PORT=587
   EMAIL_SERVER_USER=your-email@gmail.com
   EMAIL_SERVER_PASSWORD=your-gmail-app-password
   EMAIL_FROM=noreply@your-domain.com
   ```

2. Deploy:
   ```bash
   vercel --prod
   ```

3. Migration runs automatically on deploy!

### Other Providers

For production, consider using:
- **SendGrid** (recommended): 100 emails/day free
- **AWS SES**: Very cheap, needs verification
- **Resend**: Developer-friendly, good free tier

## Need Help?

Check `NEXTAUTH_MIGRATION.md` for:
- Detailed migration guide
- Code examples
- Troubleshooting
- Remaining tasks

## Quick Reference

### Client-side Auth
```typescript
import { useSession, signOut } from 'next-auth/react'

const { data: session, status } = useSession()
const isLoading = status === 'loading'
const isSignedIn = !!session?.user

// Sign out
signOut({ callbackUrl: '/' })
```

### Server-side Auth
```typescript
import { getSession, requireAuth } from '@/lib/auth'

// Get session (can be null)
const session = await getSession()

// Require auth (throws if not signed in)
const user = await requireAuth()
```

### Protect API Route
```typescript
import { requireAuth } from '@/lib/auth'

export async function POST(request: Request) {
  const user = await requireAuth()
  // User is guaranteed to be authenticated here
  // ...
}
```
