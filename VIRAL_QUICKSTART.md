# Viral Payment Flow - Quick Start Guide

## What Was Built

A complete viral payment system that enables network growth through seamless payments. Every payment automatically enrolls the recipient with a wallet.

## Files Created

### Frontend Pages (3)
1. `/app/viral/send/page.tsx` - Send viral payments
2. `/app/viral/claim/[paymentId]/page.tsx` - Claim payments (dynamic route)
3. `/app/viral/history/page.tsx` - Payment history dashboard

### Backend API (1 new)
- `/app/api/viral/history/route.ts` - Payment history endpoint

### Supporting Libraries
- `/lib/viral/hooks.ts` - React hooks for all viral operations

### Documentation
- `VIRAL_PAYMENT_FLOW.md` - Complete documentation
- `VIRAL_QUICKSTART.md` - This file

## Quick Start

### 1. Access the Pages

**Send a Payment:**
```
http://localhost:3000/viral/send
```

**Claim a Payment:**
```
http://localhost:3000/viral/claim/[payment_id]
```

**View History:**
```
http://localhost:3000/viral/history
```

### 2. Test the Flow

**Step 1: Send a Payment**
1. Go to `/viral/send`
2. Enter recipient email: `test@example.com`
3. Enter amount: `100`
4. Add memo: `Test payment`
5. Click "Preview Payment"
6. Click "Confirm & Send"
7. Copy the claim link from success screen

**Step 2: Claim the Payment**
1. Paste claim link in browser (or use payment ID directly)
2. Click "Claim Payment Now"
3. See wallet created and funds deposited
4. Note the pre-approved credit line

**Step 3: View History**
1. Go to `/viral/history`
2. See sent payment in "Sent Payments" tab
3. Check stats dashboard for network metrics
4. Expand payment for full details

## Key Features

### Viral Mechanics
- ✅ 1% Wells fee on all payments
- ✅ 0.1% referrer bonus to sender
- ✅ Silent account creation for recipients
- ✅ Auto-approved credit line (2x transaction amount)
- ✅ 30-day claim window
- ✅ Shareable claim links with referral tracking

### UI/UX
- ✅ Dark mode compatible
- ✅ Mobile-first responsive design
- ✅ Multi-step form with progress indicators
- ✅ Real-time fee calculations
- ✅ Loading states
- ✅ Error handling
- ✅ Copy-to-clipboard functionality
- ✅ Status badges (pending/claimed/expired)

### Developer Experience
- ✅ TypeScript types for all data structures
- ✅ Reusable React hooks
- ✅ Clean separation of concerns
- ✅ Proper error handling
- ✅ Extensible architecture

## Integration Checklist

### Required for Production

- [ ] **Authentication**: Replace hardcoded `user_demo_123` with Clerk user ID
  ```typescript
  import { useUser } from '@clerk/nextjs';
  const { user } = useUser();
  const accountId = user?.id;
  ```

- [ ] **Notifications**: Implement email/SMS notifications
  ```typescript
  // In /api/viral/pay/route.ts
  await sendEmail({
    to: recipient_email,
    subject: 'You received a payment!',
    claimUrl: claimUrl,
  });
  ```

- [ ] **Environment Variables**: Ensure these are set
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`

- [ ] **Database**: Verify these tables exist
  - `viral_payments`
  - `silent_accounts`
  - `viral_events`
  - `credit_lines`
  - `treasury_wallets`

### Optional Enhancements

- [ ] Add payment search/filter
- [ ] Export payment history to CSV
- [ ] Payment scheduling
- [ ] QR code generation for claim links
- [ ] Social sharing buttons
- [ ] Network graph visualization
- [ ] Advanced analytics dashboard

## API Endpoints

### Existing (from backend)
- `POST /api/viral/pay` - Create payment
- `POST /api/viral/claim/[paymentId]` - Claim payment
- `GET /api/viral/claim/[paymentId]` - Get payment details

### New (created today)
- `GET /api/viral/history?account_id=xxx` - Get payment history

## React Hooks Reference

### Available Hooks
```typescript
import {
  useSendPayment,      // Send a payment
  useClaimPayment,     // Claim a payment
  usePaymentDetails,   // Get payment details
  usePaymentHistory,   // Get payment history
  useFormatCurrency,   // Format USD/USDC
  useCopyToClipboard,  // Copy with feedback
} from '@/lib/viral/hooks';
```

### Example Usage
```typescript
// Send a payment
const { sendPayment, loading, error } = useSendPayment();
await sendPayment({
  sender_id: 'user_123',
  recipient_email: 'user@example.com',
  amount: 100,
});

// Claim a payment
const { claimPayment } = useClaimPayment();
await claimPayment('pay_abc123');

// Get payment details
const { payment, loading } = usePaymentDetails('pay_abc123');

// Get history
const { payments, stats } = usePaymentHistory('user_123');

// Format currency
const { formatUSD, formatUSDC } = useFormatCurrency();
formatUSD(100.50); // "$100.50"
```

## Customization

### Styling
All pages use Tailwind CSS. To customize:
- Colors: Search for `blue-500`, `purple-600`, etc.
- Spacing: Adjust `p-`, `m-`, `gap-` values
- Borders: Modify `rounded-`, `border-` classes
- Gradients: Update `from-` and `to-` colors

### Fee Structure
To change fees, update these files:
- Frontend preview: `/app/viral/send/page.tsx`
  ```typescript
  const wellsFee = amount * 0.01;      // Change 0.01 to desired %
  const referrerBonus = amount * 0.001; // Change 0.001 to desired %
  ```
- Backend calculation: `/app/api/viral/pay/route.ts`
  ```typescript
  const wellsFee = amount * 0.01;
  const referrerBonus = amount * 0.001;
  ```

### Credit Line Rules
To adjust auto-approved credit:
- File: `/app/api/viral/claim/[paymentId]/route.ts`
  ```typescript
  function calculateCreditLimit(transactionAmount: number): number {
    return Math.min(transactionAmount * 2, 100000); // 2x up to $100K
  }
  ```

## Troubleshooting

### Common Issues

**"Payment not found"**
- Check payment ID is correct
- Verify database connection
- Ensure `viral_payments` table exists

**"Account not found" in history**
- Replace hardcoded `user_demo_123` with real user ID
- Verify `silent_accounts` table exists

**Styling looks broken**
- Ensure Tailwind CSS is configured
- Check `globals.css` is imported
- Verify dark mode classes are working

**API errors**
- Check Supabase environment variables
- Verify service role key has correct permissions
- Check database table schemas

### Debug Mode

Enable verbose logging:
```typescript
// In any component
console.log('Payment:', payment);
console.log('Stats:', stats);
console.log('Loading:', loading);
console.log('Error:', error);
```

## Next Steps

1. **Test thoroughly** - Use the test flow above
2. **Integrate auth** - Replace demo user ID
3. **Add notifications** - Email/SMS for claims
4. **Deploy** - Push to production
5. **Monitor** - Track viral metrics
6. **Iterate** - Optimize based on user behavior

## Support

For questions or issues:
1. Check `VIRAL_PAYMENT_FLOW.md` for detailed docs
2. Review code comments in the files
3. Contact Wells AI development team

## Success Metrics

Track these KPIs:
- **Viral Coefficient**: New users per existing user
- **Claim Rate**: % of payments claimed
- **Time to Claim**: How fast payments are claimed
- **Network Growth**: Rate of new enrollments
- **Referrer Revenue**: Total bonuses earned

The viral coefficient should be > 1.0 for exponential growth!

---

**Built with:** Next.js 14, React, TypeScript, Tailwind CSS, Supabase
**License:** Proprietary - Wells Onyx / Wells AI
