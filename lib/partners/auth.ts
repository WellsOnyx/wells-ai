/**
 * Partner authentication utilities
 */

import { createClient } from '@supabase/supabase-js';
import type { Partner } from './types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key'
);

/**
 * Validate partner API key and return partner data
 */
export async function validateApiKey(apiKey: string): Promise<Partner | null> {
  try {
    const { data: partner, error } = await supabase
      .from('white_label_partners')
      .select('*')
      .eq('api_key', apiKey)
      .eq('status', 'active')
      .single();

    if (error || !partner) {
      return null;
    }

    return partner;
  } catch (error) {
    console.error('Error validating API key:', error);
    return null;
  }
}

/**
 * Get partner by ID (for dashboard access)
 */
export async function getPartnerById(partnerId: string): Promise<Partner | null> {
  try {
    const { data: partner, error } = await supabase
      .from('white_label_partners')
      .select('*')
      .eq('id', partnerId)
      .single();

    if (error || !partner) {
      return null;
    }

    return partner;
  } catch (error) {
    console.error('Error getting partner:', error);
    return null;
  }
}

/**
 * Extract API key from request headers
 */
export function extractApiKey(headers: Headers): string | null {
  const authHeader = headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  const apiKeyHeader = headers.get('X-API-Key');
  if (apiKeyHeader) {
    return apiKeyHeader;
  }

  return null;
}

/**
 * Check if API key is valid format
 */
export function isValidApiKeyFormat(apiKey: string): boolean {
  return /^wl_[a-f0-9]{48}$/.test(apiKey);
}

/**
 * Store API key in session storage (client-side only)
 */
export function storeApiKey(apiKey: string): void {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('wells_partner_api_key', apiKey);
  }
}

/**
 * Retrieve API key from session storage (client-side only)
 */
export function getStoredApiKey(): string | null {
  if (typeof window !== 'undefined') {
    return sessionStorage.getItem('wells_partner_api_key');
  }
  return null;
}

/**
 * Clear stored API key (logout)
 */
export function clearApiKey(): void {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('wells_partner_api_key');
  }
}
