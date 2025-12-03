# Clerk Authentication Setup

Clerk authentication has been added back to Wells Onyx. The authentication is fully configured and ready to use.

## Environment Variables Required

Add these to your `.env.local` file:

```bash
# Clerk API Keys
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Clerk URLs (optional - these are the defaults)
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
```

## Getting Your Clerk Keys

1. Go to [Clerk Dashboard](https://dashboard.clerk.com/)
2. Select your application (or create one)
3. Go to **API Keys** in the sidebar
4. Copy your publishable key and secret key

## What's Included

### Pages Created
- `/sign-in` - Sign in page with Clerk's pre-built component
- `/sign-up` - Sign up page with Clerk's pre-built component and value props
- `/dashboard` - Protected dashboard page for authenticated users

### Features
- Dark theme styling matching Wells Onyx aesthetic
- Mobile responsive design
- Automatic redirects after authentication
- Protected routes via middleware
- User profile management with UserButton component

### Authentication Flow
1. User clicks "Sign In" or "Sign Up" in header
2. Clerk handles authentication (email/password, OAuth, etc.)
3. After successful auth, user is redirected to `/dashboard`
4. Protected routes automatically redirect to sign-in if not authenticated

## Protected Routes

The following routes require authentication (configured in `middleware.ts`):
- `/dashboard` - Main dashboard
- `/deals` - Deal management
- `/settings` - User settings
- `/api/deals/*` - Deal API endpoints
- `/api/transactions/*` - Transaction API endpoints

## Public Routes

These routes are accessible without authentication:
- `/` - Homepage
- `/sign-in` - Sign in page
- `/sign-up` - Sign up page
- `/suppliers/onboard` - Supplier onboarding
- `/partnerships` - Partnerships page
- All API webhooks

## Testing

To test locally:

```bash
npm run dev
```

Then visit:
- http://localhost:3000 - Homepage with Sign In/Sign Up buttons
- http://localhost:3000/sign-in - Sign in page
- http://localhost:3000/sign-up - Sign up page
- http://localhost:3000/dashboard - Dashboard (will redirect to sign-in if not authenticated)

## Customization

### Styling
The Clerk components are styled to match the Wells Onyx dark theme. You can customize the appearance by modifying the `appearance` prop in:
- `/app/sign-in/[[...sign-in]]/page.tsx`
- `/app/sign-up/[[...sign-up]]/page.tsx`
- `/app/dashboard/page.tsx`

### Routes
To modify authentication redirect URLs, edit:
- `middleware.ts` - Update `signInUrl`, `signUpUrl`, `afterSignInUrl`, `afterSignUpUrl`

### Protected Routes
To add or remove protected routes, edit the route matchers in `middleware.ts`.

## Support

For Clerk-specific questions, see:
- [Clerk Documentation](https://clerk.com/docs)
- [Next.js Integration Guide](https://clerk.com/docs/quickstarts/nextjs)
