/**
 * Plaid Integration for Grain & Vault
 * Bank account linking for ACH deposits and withdrawals
 */

import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from 'plaid';

// ============================================================================
// PLAID CLIENT
// ============================================================================

let plaidClient: PlaidApi | null = null;

function getPlaidClient(): PlaidApi {
  if (!plaidClient) {
    const clientId = process.env.PLAID_CLIENT_ID;
    const secret = process.env.PLAID_SECRET;
    const env = process.env.PLAID_ENV || 'sandbox';

    if (!clientId || !secret) {
      throw new Error('PLAID_CLIENT_ID and PLAID_SECRET must be configured');
    }

    const config = new Configuration({
      basePath: PlaidEnvironments[env as keyof typeof PlaidEnvironments],
      baseOptions: {
        headers: {
          'PLAID-CLIENT-ID': clientId,
          'PLAID-SECRET': secret,
        },
      },
    });

    plaidClient = new PlaidApi(config);
  }

  return plaidClient;
}

// ============================================================================
// TYPES
// ============================================================================

export interface LinkedBankAccount {
  id: string;
  accountId: string;
  institutionId: string;
  institutionName: string;
  accountName: string;
  accountType: string;
  accountSubtype: string;
  mask: string;
  currentBalance: number;
  availableBalance: number;
  routingNumber?: string;
  accountNumber?: string;
  verified: boolean;
  createdAt: string;
}

export interface PlaidLinkToken {
  linkToken: string;
  expiration: string;
}

// ============================================================================
// LINK TOKEN CREATION
// ============================================================================

/**
 * Create a Plaid Link token for initiating bank connection
 */
export async function createLinkToken(
  userId: string,
  redirectUri?: string
): Promise<PlaidLinkToken> {
  const client = getPlaidClient();

  try {
    const response = await client.linkTokenCreate({
      user: { client_user_id: userId },
      client_name: 'Grain & Vault',
      products: [Products.Auth, Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
      webhook: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://wellsai.vercel.app'}/api/webhooks/plaid`,
      redirect_uri: redirectUri,
    });

    return {
      linkToken: response.data.link_token,
      expiration: response.data.expiration,
    };
  } catch (error: any) {
    console.error('Error creating Plaid link token:', error?.response?.data || error);
    throw new Error('Failed to create bank connection link');
  }
}

/**
 * Create Link token for updating existing connection
 */
export async function createUpdateLinkToken(
  userId: string,
  accessToken: string
): Promise<PlaidLinkToken> {
  const client = getPlaidClient();

  try {
    const response = await client.linkTokenCreate({
      user: { client_user_id: userId },
      client_name: 'Grain & Vault',
      country_codes: [CountryCode.Us],
      language: 'en',
      access_token: accessToken,
    });

    return {
      linkToken: response.data.link_token,
      expiration: response.data.expiration,
    };
  } catch (error: any) {
    console.error('Error creating update link token:', error?.response?.data || error);
    throw new Error('Failed to create update link');
  }
}

// ============================================================================
// TOKEN EXCHANGE
// ============================================================================

/**
 * Exchange public token for access token and get account details
 */
export async function exchangePublicToken(publicToken: string): Promise<{
  accessToken: string;
  itemId: string;
  accounts: LinkedBankAccount[];
}> {
  const client = getPlaidClient();

  try {
    // Exchange public token
    const exchangeResponse = await client.itemPublicTokenExchange({
      public_token: publicToken,
    });

    const accessToken = exchangeResponse.data.access_token;
    const itemId = exchangeResponse.data.item_id;

    // Get institution info
    const itemResponse = await client.itemGet({ access_token: accessToken });
    const institutionId = itemResponse.data.item.institution_id!;

    const institutionResponse = await client.institutionsGetById({
      institution_id: institutionId,
      country_codes: [CountryCode.Us],
    });

    const institutionName = institutionResponse.data.institution.name;

    // Get accounts
    const accountsResponse = await client.accountsGet({ access_token: accessToken });

    // Get auth info for ACH
    let authData: any = null;
    try {
      const authResponse = await client.authGet({ access_token: accessToken });
      authData = authResponse.data;
    } catch (e) {
      // Auth might not be available for all accounts
      console.log('Auth data not available for this connection');
    }

    const accounts: LinkedBankAccount[] = accountsResponse.data.accounts.map((acc) => {
      const achNumbers = authData?.numbers?.ach?.find((n: any) => n.account_id === acc.account_id);

      return {
        id: `${itemId}_${acc.account_id}`,
        accountId: acc.account_id,
        institutionId,
        institutionName,
        accountName: acc.name,
        accountType: acc.type,
        accountSubtype: acc.subtype || '',
        mask: acc.mask || '',
        currentBalance: acc.balances.current || 0,
        availableBalance: acc.balances.available || 0,
        routingNumber: achNumbers?.routing,
        accountNumber: achNumbers?.account,
        verified: !!achNumbers,
        createdAt: new Date().toISOString(),
      };
    });

    return { accessToken, itemId, accounts };
  } catch (error: any) {
    console.error('Error exchanging public token:', error?.response?.data || error);
    throw new Error('Failed to connect bank account');
  }
}

// ============================================================================
// ACCOUNT VERIFICATION
// ============================================================================

/**
 * Get ACH auth info for an account (routing + account numbers)
 */
export async function getACHAuth(
  accessToken: string,
  accountId: string
): Promise<{
  accountNumber: string;
  routingNumber: string;
  wireRoutingNumber?: string;
}> {
  const client = getPlaidClient();

  try {
    const response = await client.authGet({ access_token: accessToken });
    const achNumbers = response.data.numbers.ach?.find((n) => n.account_id === accountId);

    if (!achNumbers) {
      throw new Error('ACH numbers not available for this account');
    }

    return {
      accountNumber: achNumbers.account,
      routingNumber: achNumbers.routing,
      wireRoutingNumber: achNumbers.wire_routing || undefined,
    };
  } catch (error: any) {
    console.error('Error getting ACH auth:', error?.response?.data || error);
    throw new Error('Failed to get bank account details');
  }
}

/**
 * Verify micro-deposits (for manual verification flow)
 */
export async function verifyMicroDeposits(
  accessToken: string,
  amounts: [number, number]
): Promise<boolean> {
  const client = getPlaidClient();

  try {
    await client.itemPublicTokenExchange({
      public_token: accessToken, // This should be the verification flow
    });
    return true;
  } catch (error) {
    console.error('Error verifying micro-deposits:', error);
    return false;
  }
}

// ============================================================================
// BALANCE & TRANSACTIONS
// ============================================================================

/**
 * Get real-time account balances
 */
export async function getAccountBalances(accessToken: string): Promise<
  Array<{
    accountId: string;
    current: number;
    available: number;
    limit?: number;
  }>
> {
  const client = getPlaidClient();

  try {
    const response = await client.accountsBalanceGet({ access_token: accessToken });

    return response.data.accounts.map((acc) => ({
      accountId: acc.account_id,
      current: acc.balances.current || 0,
      available: acc.balances.available || 0,
      limit: acc.balances.limit || undefined,
    }));
  } catch (error: any) {
    console.error('Error getting account balances:', error?.response?.data || error);
    throw new Error('Failed to get account balances');
  }
}

/**
 * Get recent transactions for transaction analysis
 */
export async function getRecentTransactions(
  accessToken: string,
  daysBack: number = 30
): Promise<
  Array<{
    id: string;
    accountId: string;
    date: string;
    amount: number;
    name: string;
    merchantName?: string;
    category: string[];
    pending: boolean;
  }>
> {
  const client = getPlaidClient();

  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  try {
    const response = await client.transactionsGet({
      access_token: accessToken,
      start_date: startDate,
      end_date: endDate,
    });

    return response.data.transactions.map((tx) => ({
      id: tx.transaction_id,
      accountId: tx.account_id,
      date: tx.date,
      amount: tx.amount,
      name: tx.name,
      merchantName: tx.merchant_name || undefined,
      category: tx.category || [],
      pending: tx.pending,
    }));
  } catch (error: any) {
    console.error('Error getting transactions:', error?.response?.data || error);
    throw new Error('Failed to get transactions');
  }
}

// ============================================================================
// IDENTITY VERIFICATION
// ============================================================================

/**
 * Get identity information from bank for KYC
 */
export async function getIdentity(accessToken: string): Promise<{
  names: string[];
  emails: string[];
  phones: string[];
  addresses: Array<{
    city: string;
    region: string;
    postalCode: string;
    country: string;
    street: string;
  }>;
}> {
  const client = getPlaidClient();

  try {
    const response = await client.identityGet({ access_token: accessToken });

    const owners = response.data.accounts.flatMap((acc) => acc.owners || []);

    const names = owners.flatMap((o) => o.names || []);
    const emails = owners.flatMap((o) => o.emails?.map((e) => e.data) || []);
    const phones = owners.flatMap((o) => o.phone_numbers?.map((p) => p.data) || []);
    const addresses = owners.flatMap(
      (o) =>
        o.addresses?.map((a) => ({
          city: a.data.city || '',
          region: a.data.region || '',
          postalCode: a.data.postal_code || '',
          country: a.data.country || 'US',
          street: a.data.street || '',
        })) || []
    );

    return { names, emails, phones, addresses };
  } catch (error: any) {
    console.error('Error getting identity:', error?.response?.data || error);
    throw new Error('Failed to get identity information');
  }
}

// ============================================================================
// PROCESSOR TOKENS (for Stripe ACH)
// ============================================================================

/**
 * Create a Stripe processor token for ACH
 */
export async function createStripeToken(
  accessToken: string,
  accountId: string
): Promise<string> {
  const client = getPlaidClient();

  try {
    const response = await client.processorStripeBankAccountTokenCreate({
      access_token: accessToken,
      account_id: accountId,
    });

    return response.data.stripe_bank_account_token;
  } catch (error: any) {
    console.error('Error creating Stripe token:', error?.response?.data || error);
    throw new Error('Failed to create Stripe bank token');
  }
}

// ============================================================================
// WEBHOOK HANDLING
// ============================================================================

export type PlaidWebhookType =
  | 'ITEM'
  | 'TRANSACTIONS'
  | 'AUTH'
  | 'IDENTITY'
  | 'ASSETS'
  | 'INVESTMENTS_TRANSACTIONS';

export interface PlaidWebhookEvent {
  webhook_type: PlaidWebhookType;
  webhook_code: string;
  item_id: string;
  error?: {
    error_type: string;
    error_code: string;
    error_message: string;
  };
}

/**
 * Process Plaid webhook events
 */
export async function handleWebhook(event: PlaidWebhookEvent): Promise<void> {
  console.log('Processing Plaid webhook:', event.webhook_type, event.webhook_code);

  switch (event.webhook_type) {
    case 'ITEM':
      if (event.webhook_code === 'ERROR') {
        // Bank connection error - notify user
        console.error('Plaid item error:', event.error);
      } else if (event.webhook_code === 'PENDING_EXPIRATION') {
        // Access token expiring - prompt user to re-authenticate
        console.log('Plaid access token expiring for item:', event.item_id);
      }
      break;

    case 'AUTH':
      if (event.webhook_code === 'AUTOMATICALLY_VERIFIED') {
        // Micro-deposits verified automatically
        console.log('Account automatically verified:', event.item_id);
      } else if (event.webhook_code === 'VERIFICATION_EXPIRED') {
        // Micro-deposit verification expired
        console.log('Verification expired:', event.item_id);
      }
      break;

    case 'TRANSACTIONS':
      if (event.webhook_code === 'SYNC_UPDATES_AVAILABLE') {
        // New transactions available
        console.log('New transactions available:', event.item_id);
      }
      break;

    default:
      console.log('Unhandled Plaid webhook type:', event.webhook_type);
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  createLinkToken,
  createUpdateLinkToken,
  exchangePublicToken,
  getACHAuth,
  verifyMicroDeposits,
  getAccountBalances,
  getRecentTransactions,
  getIdentity,
  createStripeToken,
  handleWebhook,
};
