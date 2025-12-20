# Grain & Vault - Production Setup Guide

This document covers all the environment variables and configurations required for running Grain & Vault in production.

---

## Environment Variables

### Currently Configured (Production)

| Variable | Status | Description |
|----------|--------|-------------|
| `POSTGRES_URL` | Set | Neon PostgreSQL connection string (pooled) |
| `POSTGRES_URL_NON_POOLING` | Set | Direct PostgreSQL connection for migrations |
| `CIRCLE_API_KEY` | Set | Circle API key for USDC operations |
| `CIRCLE_MASTER_WALLET_ID` | Set | Master wallet for platform treasury |
| `CIRCLE_WALLET_SET_ID` | Set | Wallet set for user wallets |
| `CIRCLE_ENTITY_SECRET` | Set | Entity secret for wallet encryption |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Set | Clerk frontend key |
| `CLERK_SECRET_KEY` | Set | Clerk backend key |
| `PII_ENCRYPTION_KEY` | Set | AES-256 key for PII encryption |
| `COLD_START_MASTER_KEY` | Set | Cold start protection key |

### Emergency Controls (Placeholder - Update Required)

| Variable | Current Value | Action Required |
|----------|---------------|-----------------|
| `EMERGENCY_ADMIN_1` | `admin_jonah_primary` | Replace with real Clerk user ID |
| `EMERGENCY_ADMIN_2` | `admin_backup_1` | Replace with real Clerk user ID |
| `EMERGENCY_ADMIN_3` | `admin_backup_2` | Replace with real Clerk user ID |
| `EMERGENCY_MASTER_KEY` | Generated 64-char hex | Keep secure, rotate quarterly |

**To update admin IDs:**
1. Log into Clerk Dashboard: https://dashboard.clerk.com
2. Find user ID for each admin (format: `user_xxxxxxxxxxxxx`)
3. Update via Vercel CLI:
   ```bash
   echo "user_actual_clerk_id" | vercel env add EMERGENCY_ADMIN_1 production --force
   ```

### KYC/Identity Verification (Placeholder - Action Required)

| Variable | Current Value | Action Required |
|----------|---------------|-----------------|
| `VERIFF_API_KEY` | `placeholder_get_from_veriff` | Get from Veriff dashboard |
| `VERIFF_API_SECRET` | `placeholder_get_from_veriff` | Get from Veriff dashboard |
| `VERIFF_PUBLIC_KEY` | `placeholder_get_from_veriff` | Get from Veriff dashboard |

### Compliance

| Variable | Value | Description |
|----------|-------|-------------|
| `COMPLIANCE_ALERT_EMAIL` | `compliance@wellsonyx.com` | Receives compliance alerts |

---

## Getting Veriff API Keys

Veriff provides identity verification and KYC services.

### Steps to Get Keys:

1. **Create a Veriff Account**
   - Go to: https://www.veriff.com/
   - Sign up for a business account
   - Complete business verification

2. **Access the Developer Dashboard**
   - Log in to: https://station.veriff.com/
   - Navigate to "Integrations" > "API Keys"

3. **Create API Keys**
   - Create a new API key set for production
   - You'll receive:
     - **API Key**: Used for server-side API calls
     - **API Secret**: Used for signing requests
     - **Public Key**: Used for client-side SDK initialization

4. **Update Vercel Environment Variables**
   ```bash
   echo "your_actual_api_key" | vercel env add VERIFF_API_KEY production --force
   echo "your_actual_api_secret" | vercel env add VERIFF_API_SECRET production --force
   echo "your_actual_public_key" | vercel env add VERIFF_PUBLIC_KEY production --force
   ```

5. **Configure Verification Settings in Veriff Dashboard**
   - Set allowed document types (passport, ID card, driver's license)
   - Configure callback URLs
   - Set up webhook endpoints

### Veriff Documentation:
- API Reference: https://developers.veriff.com/
- SDK Integration: https://developers.veriff.com/docs/sdk-overview
- Webhooks: https://developers.veriff.com/docs/webhooks

---

## Circle Webhook Configuration

Circle sends webhooks for wallet events, transfers, and payment status updates.

### Steps to Configure:

1. **Log into Circle Console**
   - Go to: https://console.circle.com/
   - Navigate to "Developer" > "Subscriptions"

2. **Create Webhook Subscription**
   - Click "Add Subscription"
   - Set endpoint URL: `https://your-domain.com/api/webhooks/circle`
   - Select events to subscribe to:
     - `wallets` - Wallet creation events
     - `transfers` - Transfer status updates
     - `payouts` - Payout completions
     - `payments` - Payment status changes

3. **Configure Webhook Secret**
   - Copy the webhook signing secret
   - Add to Vercel:
   ```bash
   echo "your_webhook_secret" | vercel env add CIRCLE_WEBHOOK_SECRET production
   ```

4. **Verify Webhook Endpoint**
   - Circle will send a test request
   - Your endpoint must respond with 200 OK
   - Implement signature verification in your webhook handler

### Circle Documentation:
- Webhooks Overview: https://developers.circle.com/developer/docs/webhooks
- Webhook Events: https://developers.circle.com/developer/docs/notification-subscriptions
- Signature Verification: https://developers.circle.com/developer/docs/verifying-webhook-signatures

---

## Admin User Configuration

The emergency control system requires valid Clerk user IDs for authorization.

### Current Placeholder IDs (MUST BE UPDATED):

| Variable | Placeholder | Replace With |
|----------|-------------|--------------|
| `EMERGENCY_ADMIN_1` | `admin_jonah_primary` | Primary admin Clerk user ID |
| `EMERGENCY_ADMIN_2` | `admin_backup_1` | Backup admin #1 Clerk user ID |
| `EMERGENCY_ADMIN_3` | `admin_backup_2` | Backup admin #2 Clerk user ID |

### How to Get Clerk User IDs:

1. **From Clerk Dashboard:**
   - Go to https://dashboard.clerk.com
   - Select your application
   - Navigate to "Users"
   - Click on the admin user
   - Copy the "User ID" (format: `user_2abc123...`)

2. **From Your Application:**
   - Admin users can find their ID in account settings
   - Or use the Clerk API to list users

### Update the Variables:

```bash
# Replace with actual Clerk user IDs
echo "user_2abc123def456" | vercel env add EMERGENCY_ADMIN_1 production --force
echo "user_2xyz789ghi012" | vercel env add EMERGENCY_ADMIN_2 production --force
echo "user_2mno345pqr678" | vercel env add EMERGENCY_ADMIN_3 production --force
```

### Emergency Master Key

The `EMERGENCY_MASTER_KEY` has been generated as a 64-character hex string. This key is used for:
- Signing emergency pause requests
- Authorizing emergency fund recoveries
- Validating admin actions

**Security Requirements:**
- Store a backup in a secure location (password manager, HSM)
- Rotate quarterly or after any security incident
- Never log or expose this key

---

## Post-Deployment Checklist

After deploying to production, verify:

- [ ] All environment variables are set correctly
- [ ] Veriff integration is working (test KYC flow)
- [ ] Circle webhooks are receiving events
- [ ] Admin user IDs are updated to real Clerk IDs
- [ ] Compliance email is receiving alerts
- [ ] Emergency controls can be triggered by authorized admins
- [ ] Database migrations have run successfully
- [ ] SSL/TLS is properly configured

---

## Redeploying After Environment Changes

After updating any environment variables:

```bash
# Redeploy to production
vercel --prod

# Or trigger a new deployment from the Vercel dashboard
```

---

## Support & Resources

- **Circle Support**: https://support.circle.com/
- **Veriff Support**: https://support.veriff.com/
- **Clerk Support**: https://clerk.com/support
- **Vercel Support**: https://vercel.com/support

---

*Last updated: December 2024*
