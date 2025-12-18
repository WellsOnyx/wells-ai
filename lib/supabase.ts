// Shared Supabase client with safe initialization
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Create a lazy-initialized Supabase client
let _supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (_supabase) return _supabase;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.warn('Supabase credentials not configured - database operations disabled');
    return null;
  }

  _supabase = createClient(supabaseUrl, supabaseKey);
  return _supabase;
}

// For backwards compatibility - creates client only if env vars exist
export const supabase = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.warn('NEXT_PUBLIC_SUPABASE_URL not set - using placeholder');
  }

  return createClient(url, key);
})();
