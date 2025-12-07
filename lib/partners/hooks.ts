/**
 * React hooks for partner operations
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Partner, PartnerStats, PartnerTransaction, VolumeDataPoint } from './types';
import { getStoredApiKey } from './auth';

const API_BASE = '/api/partners';

/**
 * Hook to fetch partner data
 */
export function usePartner() {
  const [partner, setPartner] = useState<Partner | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const apiKey = getStoredApiKey();

  const fetchPartner = useCallback(async () => {
    if (!apiKey) {
      setError('No API key found');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/me`, {
        headers: {
          'X-API-Key': apiKey,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch partner data');
      }

      const data = await response.json();
      setPartner(data.partner);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setPartner(null);
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  useEffect(() => {
    fetchPartner();
  }, [fetchPartner]);

  return { partner, loading, error, refetch: fetchPartner };
}

/**
 * Hook to fetch partner stats
 */
export function usePartnerStats() {
  const [stats, setStats] = useState<PartnerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const apiKey = getStoredApiKey();

  const fetchStats = useCallback(async () => {
    if (!apiKey) {
      setError('No API key found');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/stats`, {
        headers: {
          'X-API-Key': apiKey,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }

      const data = await response.json();
      setStats(data.stats);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, error, refetch: fetchStats };
}

/**
 * Hook to fetch partner transactions
 */
export function usePartnerTransactions(limit = 10) {
  const [transactions, setTransactions] = useState<PartnerTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const apiKey = getStoredApiKey();

  const fetchTransactions = useCallback(async () => {
    if (!apiKey) {
      setError('No API key found');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/transactions?limit=${limit}`, {
        headers: {
          'X-API-Key': apiKey,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch transactions');
      }

      const data = await response.json();
      setTransactions(data.transactions);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [apiKey, limit]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  return { transactions, loading, error, refetch: fetchTransactions };
}

/**
 * Hook to fetch volume data for charts
 */
export function useVolumeData(days = 30) {
  const [volumeData, setVolumeData] = useState<VolumeDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const apiKey = getStoredApiKey();

  const fetchVolumeData = useCallback(async () => {
    if (!apiKey) {
      setError('No API key found');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/volume?days=${days}`, {
        headers: {
          'X-API-Key': apiKey,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch volume data');
      }

      const data = await response.json();
      setVolumeData(data.volume_data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setVolumeData([]);
    } finally {
      setLoading(false);
    }
  }, [apiKey, days]);

  useEffect(() => {
    fetchVolumeData();
  }, [fetchVolumeData]);

  return { volumeData, loading, error, refetch: fetchVolumeData };
}

/**
 * Hook to update partner settings
 */
export function usePartnerSettings() {
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiKey = getStoredApiKey();

  const updateSettings = useCallback(async (settings: Partial<Partner>) => {
    if (!apiKey) {
      throw new Error('No API key found');
    }

    try {
      setUpdating(true);
      const response = await fetch(`${API_BASE}/settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        throw new Error('Failed to update settings');
      }

      const data = await response.json();
      setError(null);
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setUpdating(false);
    }
  }, [apiKey]);

  const regenerateApiKey = useCallback(async () => {
    if (!apiKey) {
      throw new Error('No API key found');
    }

    try {
      setUpdating(true);
      const response = await fetch(`${API_BASE}/regenerate-key`, {
        method: 'POST',
        headers: {
          'X-API-Key': apiKey,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to regenerate API key');
      }

      const data = await response.json();
      setError(null);
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setUpdating(false);
    }
  }, [apiKey]);

  return { updateSettings, regenerateApiKey, updating, error };
}
