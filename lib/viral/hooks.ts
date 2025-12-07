/**
 * React hooks for viral payment operations
 */

import { useState, useEffect, useCallback } from 'react';

export interface ViralPayment {
  id: string;
  sender_id: string;
  sender_wallet: string;
  recipient_email?: string;
  recipient_phone?: string;
  recipient_company?: string;
  recipient_wallet: string;
  recipient_account_id: string;
  amount_usdc: number;
  memo?: string;
  invoice_id?: string;
  referral_code: string;
  claim_url: string;
  status: 'pending' | 'claimed' | 'expired';
  expires_at: string;
  created_at: string;
  claimed_at?: string;
  wells_fee: number;
  referrer_bonus: number;
}

export interface PaymentStats {
  total_sent: number;
  total_received: number;
  total_volume_sent: number;
  total_volume_received: number;
  network_enrollments: number;
  total_referrer_bonus: number;
}

export interface SendPaymentParams {
  sender_id: string;
  recipient_email?: string;
  recipient_phone?: string;
  recipient_company?: string;
  amount: number;
  memo?: string;
  invoice_id?: string;
}

export interface SendPaymentResult {
  success: boolean;
  payment?: {
    id: string;
    amount: number;
    claim_url: string;
    referral_code: string;
    expires_at: string;
    status: string;
  };
  recipient?: {
    account_id: string;
    activation_level: string;
  };
  error?: string;
}

export interface ClaimPaymentResult {
  success: boolean;
  claimed?: {
    amount: number;
    wallet: string;
    memo?: string;
  };
  account?: {
    id: string;
    activation_level: string;
    total_received: number;
  };
  next_steps?: {
    credit_available: number;
    send_payment_url: string;
    invite_bonus: string;
  };
  error?: string;
}

export interface PaymentDetails {
  payment: {
    id: string;
    amount: number;
    memo?: string;
    status: string;
    expires_at: string;
    from_company?: string;
    created_at: string;
  };
  claimable: boolean;
}

/**
 * Hook to send a viral payment
 */
export function useSendPayment() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendPayment = useCallback(async (params: SendPaymentParams): Promise<SendPaymentResult> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/viral/pay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send payment');
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send payment';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, []);

  return { sendPayment, loading, error };
}

/**
 * Hook to claim a payment
 */
export function useClaimPayment() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const claimPayment = useCallback(async (
    paymentId: string,
    email?: string,
    phone?: string
  ): Promise<ClaimPaymentResult> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/viral/claim/${paymentId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, phone }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to claim payment');
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to claim payment';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, []);

  return { claimPayment, loading, error };
}

/**
 * Hook to fetch payment details
 */
export function usePaymentDetails(paymentId: string | null) {
  const [payment, setPayment] = useState<PaymentDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!paymentId) {
      setPayment(null);
      return;
    }

    const fetchPayment = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/viral/claim/${paymentId}`);
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to fetch payment');
        }

        setPayment(result);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch payment';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchPayment();
  }, [paymentId]);

  return { payment, loading, error };
}

/**
 * Hook to fetch payment history
 * Note: You'll need to create the backend endpoint for this
 */
export function usePaymentHistory(accountId: string | null) {
  const [payments, setPayments] = useState<{
    sent: ViralPayment[];
    received: ViralPayment[];
  }>({ sent: [], received: [] });
  const [stats, setStats] = useState<PaymentStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!accountId) {
      setPayments({ sent: [], received: [] });
      setStats(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/viral/history?account_id=${accountId}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch history');
      }

      setPayments(result.payments || { sent: [], received: [] });
      setStats(result.stats || null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch history';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return { payments, stats, loading, error, refetch: fetchHistory };
}

/**
 * Hook to format currency
 */
export function useFormatCurrency() {
  const formatUSD = useCallback((amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }, []);

  const formatUSDC = useCallback((amount: number): string => {
    return `${amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    })} USDC`;
  }, []);

  return { formatUSD, formatUSDC };
}

/**
 * Hook to copy to clipboard
 */
export function useCopyToClipboard() {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, []);

  return { copy, copied };
}
