# Authentication Setup Guide

Wells AI uses [Clerk](https://clerk.com) for authentication. This provides secure user management, session handling, and profile storage.

## Quick Setup (5 minutes)

### 1. Create a Clerk Account
1. Go to https://clerk.com
2. Sign up for a free account
3. Create a new application

### 2. Get Your API Keys
1. In your Clerk dashboard, go to **API Keys**
2. Copy your **Publishable Key** (starts with `pk_test_`)
3. Copy your **Secret Key** (starts with `sk_test_`)

### 3. Add Keys to Environment
Add these to your `.env.local` file:

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
CLERK_SECRET_KEY=sk_test_your_key_here
```

### 4. Configure Clerk Settings (Recommended)

**In Clerk Dashboard → Configure → Paths:**
- Sign-in URL: `/sign-in`
- Sign-up URL: `/sign-up`
- After sign-in URL: `/`
- After sign-up URL: `/`

**In Clerk Dashboard → User & Authentication → Email, Phone, Username:**
- Enable **Email address** (required)
- Enable **Name** (required)
- Optional: Enable phone, username

That's it! 🎉

## How It Works

### User Flow
1. User visits Wells AI
2. If not authenticated → Redirected to `/sign-in`
3. After sign-in → Redirected to home page
4. If no onboarding data → Shows onboarding flow
5. Onboarding data saved to Clerk user metadata
6. User can access full chat interface

### Data Storage
User preferences are stored in Clerk's user metadata:
- `userType`: "buyer" | "seller" | "both" | "job-seeker" | "entrepreneur"
- `name`: User's full name
- `company`: Company name (optional)
- `email`: User's email
- `phone`: Phone number (optional)
- `industry`: Industry (optional)

### Protected Routes
All routes except these require authentication:
- `/sign-in`
- `/sign-up`
- `/api/webhooks/*` (for external integrations)
- `/sms-opt-in`

## Development

```bash
npm run dev
```

Visit http://localhost:3000 and you'll be prompted to sign in.

## Production Deployment

Add your Clerk keys to Vercel:

```bash
vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
vercel env add CLERK_SECRET_KEY
```

Or add them in the Vercel dashboard: **Settings → Environment Variables**

## Customization

### Custom Sign-In/Sign-Up Pages
Edit:
- `app/sign-in/[[...sign-in]]/page.tsx`
- `app/sign-up/[[...sign-up]]/page.tsx`

### Branding
In Clerk Dashboard → **Customization → Theme**, you can:
- Upload your logo
- Change colors to match Wells Onyx branding (#183b6d, #dba63f)
- Customize button styles

### Adding More User Fields
Update the onboarding flow in:
- `app/components/Onboarding.tsx`

Save additional fields to Clerk metadata in:
- `app/components/WellsAIContent.tsx` → `handleOnboardingComplete()`

## Troubleshooting

**"Clerk: Missing publishable key"**
- Add `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` to `.env.local`
- Restart your dev server

**"Clerk: Missing secret key"**
- Add `CLERK_SECRET_KEY` to `.env.local`
- Restart your dev server

**Infinite redirect loop**
- Check that `/sign-in` and `/sign-up` are in the public routes list in `middleware.ts`

**User data not persisting**
- Check that `unsafeMetadata` is being updated in `handleOnboardingComplete`
- Verify user metadata in Clerk Dashboard → Users → [User] → Metadata

## Resources

- [Clerk Documentation](https://clerk.com/docs)
- [Next.js App Router Integration](https://clerk.com/docs/quickstarts/nextjs)
- [User Metadata Guide](https://clerk.com/docs/users/metadata)
