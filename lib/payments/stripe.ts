/**
 * STRIPE INTEGRATION - Fiat Payment Rails
 *
 * Stripe provides card processing, ACH, and bank payouts.
 * This is the fiat payment backbone for Wells AI.
 *
 * KEY FEATURES:
 * - Card payments (deposits)
 * - ACH bank transfers (larger amounts)
 * - Connected accounts (for marketplace payouts)
 * - Instant payouts to bank accounts
 * - All payments convert to USDC and track float
 *
 * DOCS: https://stripe.com/docs/api
 */

import Stripe from 'stripe';
import { trackFloat } from '@/lib/scale/float-treasury-integration';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================================================
// STRIPE CLIENT
// ============================================================================

let stripeClient: Stripe;

function getStripeClient(): Stripe {
  if (!stripeClient) {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (!apiKey) {
      throw new Error('STRIPE_SECRET_KEY not configured');
    }
    stripeClient = new Stripe(apiKey, {
      apiVersion: '2024-12-18.acacia',
      typescript: true,
    });
  }
  return stripeClient;
}

// ============================================================================
// TYPES
// ============================================================================

export interface StripeCustomer {
  customerId: string;
  email?: string;
  name?: string;
  defaultPaymentMethodId?: string;
}

export interface PaymentMethod {
  id: string;
  type: 'card' | 'us_bank_account';
  card?: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  };
  usBankAccount?: {
    bankName: string;
    last4: string;
    accountType: string;
  };
}

export interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: string;
  clientSecret: string;
  paymentMethodId?: string;
}

// ============================================================================
// CUSTOMER MANAGEMENT
// ============================================================================

/**
 * Get or create a Stripe customer for a user
 */
export async function getOrCreateCustomer(
  userId: string,
  email?: string,
  name?: string
): Promise<StripeCustomer> {
  // Check if user already has a Stripe customer
  const { data: existingCustomer } = await supabase
    .from('stripe_customers')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (existingCustomer) {
    return {
      customerId: existingCustomer.customer_id,
      email: existingCustomer.email,
      name: existingCustomer.name,
      defaultPaymentMethodId: existingCustomer.default_payment_method_id,
    };
  }

  // Create new Stripe customer
  const stripe = getStripeClient();
  const customer = await stripe.customers.create({
    email,
    name,
    metadata: {
      userId,
    },
  });

  // Store in database
  await supabase.from('stripe_customers').insert({
    user_id: userId,
    customer_id: customer.id,
    email: customer.email,
    name: customer.name,
    created_at: new Date().toISOString(),
  });

  return {
    customerId: customer.id,
    email: customer.email || undefined,
    name: customer.name || undefined,
  };
}

/**
 * Get customer's payment methods
 */
export async function getPaymentMethods(userId: string): Promise<PaymentMethod[]> {
  const customer = await getOrCreateCustomer(userId);
  const stripe = getStripeClient();

  const paymentMethods = await stripe.paymentMethods.list({
    customer: customer.customerId,
    type: 'card',
  });

  return paymentMethods.data.map(pm => ({
    id: pm.id,
    type: pm.type as 'card' | 'us_bank_account',
    card: pm.card ? {
      brand: pm.card.brand,
      last4: pm.card.last4,
      expMonth: pm.card.exp_month,
      expYear: pm.card.exp_year,
    } : undefined,
  }));
}

/**
 * Attach a payment method to a customer
 */
export async function attachPaymentMethod(
  userId: string,
  paymentMethodId: string
): Promise<void> {
  const customer = await getOrCreateCustomer(userId);
  const stripe = getStripeClient();

  await stripe.paymentMethods.attach(paymentMethodId, {
    customer: customer.customerId,
  });

  // Set as default if this is the first payment method
  const methods = await getPaymentMethods(userId);
  if (methods.length === 1) {
    await stripe.customers.update(customer.customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    await supabase
      .from('stripe_customers')
      .update({ default_payment_method_id: paymentMethodId })
      .eq('user_id', userId);
  }
}

// ============================================================================
// CARD PAYMENTS (DEPOSITS)
// ============================================================================

/**
 * Create a payment intent for card deposit
 * Returns clientSecret for frontend Stripe Elements
 */
export async function createDepositIntent(
  userId: string,
  amount: number, // Amount in cents
  metadata?: {
    description?: string;
    paymentType?: string;
  }
): Promise<{
  paymentIntentId: string;
  clientSecret: string;
  amount: number;
}> {
  const customer = await getOrCreateCustomer(userId);
  const stripe = getStripeClient();

  const paymentIntent = await stripe.paymentIntents.create({
    amount,
    currency: 'usd',
    customer: customer.customerId,
    automatic_payment_methods: {
      enabled: true,
    },
    metadata: {
      userId,
      type: 'deposit',
      ...metadata,
    },
  });

  // Store payment intent
  await supabase.from('stripe_payment_intents').insert({
    user_id: userId,
    payment_intent_id: paymentIntent.id,
    amount_cents: amount,
    currency: 'usd',
    status: paymentIntent.status,
    client_secret: paymentIntent.client_secret,
    metadata,
    created_at: new Date().toISOString(),
  });

  return {
    paymentIntentId: paymentIntent.id,
    clientSecret: paymentIntent.client_secret!,
    amount,
  };
}

/**
 * Confirm a payment intent
 * Called after user completes payment on frontend
 */
export async function confirmPayment(
  paymentIntentId: string
): Promise<{
  status: string;
  amount: number;
  currency: string;
}> {
  const stripe = getStripeClient();
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

  // Update in database
  await supabase
    .from('stripe_payment_intents')
    .update({
      status: paymentIntent.status,
      payment_method_id: paymentIntent.payment_method as string,
      updated_at: new Date().toISOString(),
    })
    .eq('payment_intent_id', paymentIntentId);

  // If payment succeeded, convert to USDC and track float
  if (paymentIntent.status === 'succeeded') {
    const { data: intent } = await supabase
      .from('stripe_payment_intents')
      .select('*')
      .eq('payment_intent_id', paymentIntentId)
      .single();

    if (intent) {
      // Convert USD to USDC (1:1)
      const amountUSDC = intent.amount_cents / 100;

      // Track as float
      try {
        const floatPosition = await trackFloat(
          'viral_payment', // Classify deposits as viral payments
          paymentIntentId,
          amountUSDC,
          1 // 1-day settlement for card payments
        );

        // Link float position
        await supabase
          .from('stripe_payment_intents')
          .update({ float_position_id: floatPosition.id })
          .eq('payment_intent_id', paymentIntentId);
      } catch (error) {
        console.error('Failed to track float for deposit:', error);
      }

      // Credit user's USDC balance
      await creditUSDCBalance(intent.user_id, amountUSDC, 'card_deposit');
    }
  }

  return {
    status: paymentIntent.status,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
  };
}

// ============================================================================
// ACH BANK TRANSFERS
// ============================================================================

/**
 * Setup ACH debit for larger deposits
 * Uses Stripe Payment Links or direct ACH
 */
export async function createACHPayment(
  userId: string,
  amount: number, // Amount in cents
  metadata?: {
    description?: string;
  }
): Promise<{
  paymentIntentId: string;
  clientSecret: string;
  amount: number;
}> {
  const customer = await getOrCreateCustomer(userId);
  const stripe = getStripeClient();

  const paymentIntent = await stripe.paymentIntents.create({
    amount,
    currency: 'usd',
    customer: customer.customerId,
    payment_method_types: ['us_bank_account'],
    metadata: {
      userId,
      type: 'ach_deposit',
      ...metadata,
    },
  });

  // Store payment intent
  await supabase.from('stripe_payment_intents').insert({
    user_id: userId,
    payment_intent_id: paymentIntent.id,
    amount_cents: amount,
    currency: 'usd',
    status: paymentIntent.status,
    client_secret: paymentIntent.client_secret,
    payment_type: 'ach',
    metadata,
    created_at: new Date().toISOString(),
  });

  return {
    paymentIntentId: paymentIntent.id,
    clientSecret: paymentIntent.client_secret!,
    amount,
  };
}

// ============================================================================
// PAYOUTS (WITHDRAWALS)
// ============================================================================

/**
 * Create a connected account for receiving payouts
 * Required for marketplace functionality
 */
export async function createConnectedAccount(
  userId: string,
  email: string,
  businessType: 'individual' | 'company' = 'individual'
): Promise<{
  accountId: string;
  onboardingUrl: string;
}> {
  const stripe = getStripeClient();

  const account = await stripe.accounts.create({
    type: 'express',
    email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    business_type: businessType,
    metadata: {
      userId,
    },
  });

  // Create account link for onboarding
  const accountLink = await stripe.accountLinks.create({
    account: account.id,
    refresh_url: `${process.env.NEXT_PUBLIC_BASE_URL}/settings/payout`,
    return_url: `${process.env.NEXT_PUBLIC_BASE_URL}/settings/payout?success=true`,
    type: 'account_onboarding',
  });

  // Store connected account
  await supabase.from('stripe_connected_accounts').insert({
    user_id: userId,
    account_id: account.id,
    email,
    business_type: businessType,
    charges_enabled: false,
    payouts_enabled: false,
    created_at: new Date().toISOString(),
  });

  return {
    accountId: account.id,
    onboardingUrl: accountLink.url,
  };
}

/**
 * Send payout to user's bank account
 * Converts USDC to USD and transfers via Stripe
 */
export async function createPayout(
  userId: string,
  amountUSDC: number,
  metadata?: {
    description?: string;
  }
): Promise<{
  payoutId: string;
  amount: number;
  arrivalDate: string;
  status: string;
}> {
  // Get user's connected account
  const { data: connectedAccount } = await supabase
    .from('stripe_connected_accounts')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!connectedAccount) {
    throw new Error('User has not set up bank account for payouts');
  }

  if (!connectedAccount.payouts_enabled) {
    throw new Error('Payouts not enabled for this account. Please complete verification.');
  }

  // Check user has sufficient USDC balance
  const balance = await getUSDCBalance(userId);
  if (balance < amountUSDC) {
    throw new Error(`Insufficient balance. Have ${balance} USDC, need ${amountUSDC} USDC`);
  }

  const stripe = getStripeClient();
  const amountCents = Math.round(amountUSDC * 100);

  // Create transfer to connected account
  const transfer = await stripe.transfers.create({
    amount: amountCents,
    currency: 'usd',
    destination: connectedAccount.account_id,
    metadata: {
      userId,
      type: 'withdrawal',
      ...metadata,
    },
  });

  // Create payout from connected account to bank
  const payout = await stripe.payouts.create(
    {
      amount: amountCents,
      currency: 'usd',
      metadata: {
        userId,
        transferId: transfer.id,
        ...metadata,
      },
    },
    {
      stripeAccount: connectedAccount.account_id,
    }
  );

  // Store payout record
  await supabase.from('stripe_payouts').insert({
    user_id: userId,
    payout_id: payout.id,
    transfer_id: transfer.id,
    amount_usdc: amountUSDC,
    amount_cents: amountCents,
    status: payout.status,
    arrival_date: new Date(payout.arrival_date * 1000).toISOString(),
    metadata,
    created_at: new Date().toISOString(),
  });

  // Debit user's USDC balance
  await debitUSDCBalance(userId, amountUSDC, 'bank_withdrawal');

  return {
    payoutId: payout.id,
    amount: amountCents,
    arrivalDate: new Date(payout.arrival_date * 1000).toISOString(),
    status: payout.status,
  };
}

/**
 * Get payout status
 */
export async function getPayoutStatus(payoutId: string): Promise<{
  status: string;
  amount: number;
  arrivalDate: string;
  failureMessage?: string;
}> {
  const { data: payout } = await supabase
    .from('stripe_payouts')
    .select('*')
    .eq('payout_id', payoutId)
    .single();

  if (!payout) {
    throw new Error('Payout not found');
  }

  // Get fresh status from Stripe
  const stripe = getStripeClient();
  const { data: account } = await supabase
    .from('stripe_connected_accounts')
    .select('account_id')
    .eq('user_id', payout.user_id)
    .single();

  if (account) {
    const stripePayout = await stripe.payouts.retrieve(
      payoutId,
      undefined,
      { stripeAccount: account.account_id }
    );

    // Update in database
    await supabase
      .from('stripe_payouts')
      .update({
        status: stripePayout.status,
        failure_message: stripePayout.failure_message,
        updated_at: new Date().toISOString(),
      })
      .eq('payout_id', payoutId);

    return {
      status: stripePayout.status,
      amount: stripePayout.amount,
      arrivalDate: new Date(stripePayout.arrival_date * 1000).toISOString(),
      failureMessage: stripePayout.failure_message || undefined,
    };
  }

  return {
    status: payout.status,
    amount: payout.amount_cents,
    arrivalDate: payout.arrival_date,
  };
}

// ============================================================================
// BALANCE MANAGEMENT
// ============================================================================

/**
 * Get user's USDC balance from database
 */
async function getUSDCBalance(userId: string): Promise<number> {
  const { data: balance } = await supabase
    .from('user_balances')
    .select('usdc_balance')
    .eq('user_id', userId)
    .single();

  return balance?.usdc_balance || 0;
}

/**
 * Credit user's USDC balance
 */
async function creditUSDCBalance(
  userId: string,
  amount: number,
  source: string
): Promise<void> {
  // Get current balance
  const currentBalance = await getUSDCBalance(userId);
  const newBalance = currentBalance + amount;

  // Update or insert balance
  await supabase
    .from('user_balances')
    .upsert({
      user_id: userId,
      usdc_balance: newBalance,
      updated_at: new Date().toISOString(),
    });

  // Record transaction
  await supabase.from('balance_transactions').insert({
    user_id: userId,
    amount,
    type: 'credit',
    source,
    balance_after: newBalance,
    created_at: new Date().toISOString(),
  });
}

/**
 * Debit user's USDC balance
 */
async function debitUSDCBalance(
  userId: string,
  amount: number,
  destination: string
): Promise<void> {
  const currentBalance = await getUSDCBalance(userId);
  if (currentBalance < amount) {
    throw new Error('Insufficient balance');
  }

  const newBalance = currentBalance - amount;

  await supabase
    .from('user_balances')
    .update({
      usdc_balance: newBalance,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  // Record transaction
  await supabase.from('balance_transactions').insert({
    user_id: userId,
    amount,
    type: 'debit',
    source: destination,
    balance_after: newBalance,
    created_at: new Date().toISOString(),
  });
}

// ============================================================================
// WEBHOOK HANDLERS
// ============================================================================

/**
 * Process Stripe webhook event
 * Called from webhook endpoint
 */
export async function handleStripeWebhook(
  event: Stripe.Event
): Promise<void> {
  switch (event.type) {
    case 'payment_intent.succeeded':
      await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
      break;

    case 'payment_intent.payment_failed':
      await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
      break;

    case 'payout.paid':
      await handlePayoutPaid(event.data.object as Stripe.Payout);
      break;

    case 'payout.failed':
      await handlePayoutFailed(event.data.object as Stripe.Payout);
      break;

    case 'account.updated':
      await handleAccountUpdated(event.data.object as Stripe.Account);
      break;

    default:
      console.log('Unhandled Stripe webhook event:', event.type);
  }
}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  await confirmPayment(paymentIntent.id);
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  await supabase
    .from('stripe_payment_intents')
    .update({
      status: 'failed',
      failure_message: paymentIntent.last_payment_error?.message,
      updated_at: new Date().toISOString(),
    })
    .eq('payment_intent_id', paymentIntent.id);
}

async function handlePayoutPaid(payout: Stripe.Payout): Promise<void> {
  await supabase
    .from('stripe_payouts')
    .update({
      status: 'paid',
      updated_at: new Date().toISOString(),
    })
    .eq('payout_id', payout.id);
}

async function handlePayoutFailed(payout: Stripe.Payout): Promise<void> {
  await supabase
    .from('stripe_payouts')
    .update({
      status: 'failed',
      failure_message: payout.failure_message,
      updated_at: new Date().toISOString(),
    })
    .eq('payout_id', payout.id);

  // Refund user's USDC balance
  const { data: payoutRecord } = await supabase
    .from('stripe_payouts')
    .select('user_id, amount_usdc')
    .eq('payout_id', payout.id)
    .single();

  if (payoutRecord) {
    await creditUSDCBalance(
      payoutRecord.user_id,
      payoutRecord.amount_usdc,
      'payout_refund'
    );
  }
}

async function handleAccountUpdated(account: Stripe.Account): Promise<void> {
  await supabase
    .from('stripe_connected_accounts')
    .update({
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      updated_at: new Date().toISOString(),
    })
    .eq('account_id', account.id);
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  getOrCreateCustomer,
  getPaymentMethods,
  attachPaymentMethod,
  createDepositIntent,
  confirmPayment,
  createACHPayment,
  createConnectedAccount,
  createPayout,
  getPayoutStatus,
  handleStripeWebhook,
};
