# Payment Rails Dependencies

Required npm packages for the Wells AI payment infrastructure.

## Installation

```bash
npm install stripe @stripe/stripe-js @stripe/react-stripe-js @supabase/supabase-js
```

## Package Details

### Core Dependencies

```json
{
  "dependencies": {
    "stripe": "^14.11.0",
    "@stripe/stripe-js": "^2.4.0",
    "@stripe/react-stripe-js": "^2.4.0",
    "@supabase/supabase-js": "^2.39.0"
  }
}
```

### What Each Package Does

**stripe** (Server-side)
- Stripe Node.js SDK
- Used in API routes for server-side operations
- Handles payment intents, connected accounts, payouts
- Webhook verification

**@stripe/stripe-js** (Client-side)
- Official Stripe JavaScript library
- Loads Stripe.js asynchronously
- Required for Stripe Elements

**@stripe/react-stripe-js** (React Components)
- React wrapper for Stripe Elements
- Provides `<Elements>` and `<PaymentElement>` components
- Used in deposit page UI

**@supabase/supabase-js** (Database)
- Supabase client library
- PostgreSQL database access
- Real-time subscriptions (optional)

### Circle Integration

Circle doesn't have an official npm package, so we use direct API calls via fetch.

If you prefer, you can add a lightweight HTTP client:

```bash
npm install axios  # or your preferred HTTP client
```

## Full package.json Example

```json
{
  "name": "wells-ai",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "14.0.4",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",

    "stripe": "^14.11.0",
    "@stripe/stripe-js": "^2.4.0",
    "@stripe/react-stripe-js": "^2.4.0",
    "@supabase/supabase-js": "^2.39.0",

    "typescript": "^5.3.3",
    "@types/node": "^20.10.6",
    "@types/react": "^18.2.46",
    "@types/react-dom": "^18.2.18"
  },
  "devDependencies": {
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.32",
    "eslint": "^8.56.0",
    "eslint-config-next": "14.0.4"
  }
}
```

## TypeScript Configuration

The payment system uses TypeScript. Ensure your `tsconfig.json` includes:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

## Environment Setup

After installing packages, create `.env.local`:

```bash
cp .env.payments.example .env.local
```

Then fill in your actual API keys.

## Development Mode

Run the development server:

```bash
npm run dev
```

Test the deposit page at: http://localhost:3000/deposit

## Production Build

Before deploying:

```bash
npm run build
npm start
```

Verify payment flows work correctly before switching to production API keys.

## Version Compatibility

Tested with:
- Node.js: 18.x or higher
- Next.js: 14.x
- React: 18.x
- Stripe API: 2024-12-18 (Acacia)
- Circle API: v1

## Optional Enhancements

### Error Tracking

```bash
npm install @sentry/nextjs
```

### Monitoring

```bash
npm install @vercel/analytics
```

### Testing

```bash
npm install --save-dev jest @testing-library/react @testing-library/jest-dom
```

### API Documentation

```bash
npm install swagger-ui-react
```

## Stripe CLI (Development)

For testing webhooks locally:

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/api/webhooks/payments?provider=stripe
```

## Circle Sandbox

Circle doesn't require a CLI. Use their Dashboard to:
- Create sandbox API keys
- View test transactions
- Trigger webhook events

## Database Migrations

Apply the payment schema:

```bash
# If using Supabase CLI
supabase db push

# Or direct SQL
psql $DATABASE_URL -f scripts/schema-payments.sql
```

## Health Check

Verify all dependencies are installed:

```bash
npm list stripe @stripe/stripe-js @stripe/react-stripe-js @supabase/supabase-js
```

All should show versions without errors.

## Troubleshooting

**"Module not found: stripe"**
- Run `npm install stripe`
- Restart dev server

**"Cannot find module '@stripe/stripe-js'"**
- Run `npm install @stripe/stripe-js @stripe/react-stripe-js`
- Clear .next cache: `rm -rf .next`

**TypeScript errors**
- Ensure `@types/node` is installed
- Run `npm install --save-dev @types/react @types/react-dom`

## Support

For dependency issues:
- Stripe: https://github.com/stripe/stripe-node
- Supabase: https://github.com/supabase/supabase-js
- Next.js: https://nextjs.org/docs
