# Clerk Signup 404 Fix

## Problem
Users signing up get 404 after successful authentication because Clerk is redirecting to a non-existent route.

## Root Cause
Clerk Dashboard configuration or environment variables are pointing to `/dashboard` (which doesn't exist). The correct route is `/founder`.

## Fix Instructions

### 1. Add Environment Variables

Add to your `.env.local` file:

```bash
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/founder
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/founder
```

### 2. Update Clerk Dashboard Settings

Go to [Clerk Dashboard](https://dashboard.clerk.com):

1. Select your application
2. Go to **Paths** section (in left sidebar)
3. Update these settings:
   - **After sign-up URL**: `/founder`
   - **After sign-in URL**: `/founder`
   - (Or leave blank to use environment variable defaults)

### 3. Update Vercel Environment Variables

If deployed on Vercel:

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to Settings → Environment Variables
4. Add:
   - `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` = `/founder`
   - `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` = `/founder`
5. Redeploy

### 4. Test the Flow

1. Go to your site (grainandvault.com or localhost:3000)
2. Click "Sign Up"
3. Complete authentication (Apple, Google, or Email)
4. Verify you land on `/founder` (not 404)

## Why This Works

- `/founder` route exists: `app/founder/page.tsx` ✅
- `/dashboard` route does NOT exist ❌
- Clerk was trying to redirect to non-existent route
- Now redirects to existing `/founder` page

## Files Changed

1. `.env.example` - Added Clerk redirect variables
2. `CLERK_SIGNUP_FIX.md` - This documentation

## Next Steps After Fix

Once working:
- Commit the .env.example changes
- Verify on production
- Remove this file

---

**Status:** Ready to deploy
**Test:** Sign up flow should now work end-to-end
