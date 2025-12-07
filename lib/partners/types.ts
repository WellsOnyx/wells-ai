/**
 * Type definitions for Wells AI Partner Portal
 */

export interface Partner {
  id: string;
  company_name: string;
  platform_name: string;
  domain: string;
  contact_email: string;
  contact_name?: string;
  contact_phone?: string;
  industry?: string;
  revenue_share_percent: number;
  total_volume: number;
  monthly_volume: number;
  transaction_count: number;
  total_fees_collected: number;
  total_partner_share: number;
  total_wells_share: number;
  webhook_url?: string;
  status: 'pending' | 'active' | 'suspended' | 'inactive';
  created_at: string;
  updated_at?: string;
}

export interface PartnerApplication {
  // Step 1: Company Info
  company_name: string;
  platform_name: string;
  domain: string;
  industry: string;

  // Step 2: Contact Info
  contact_name: string;
  contact_email: string;
  contact_phone: string;

  // Step 3: Platform Details
  estimated_monthly_volume: string;
  estimated_monthly_transactions: string;
  use_case: string;
  current_payment_provider?: string;

  // Step 4: Revenue Share
  revenue_share_percent: number;
}

export interface PartnerTransaction {
  id: string;
  external_id?: string;
  sender_external_id: string;
  recipient_external_id: string;
  amount: number;
  currency: string;
  wells_fee: number;
  partner_share: number;
  wells_net: number;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  metadata?: Record<string, any>;
  created_at: string;
}

export interface PartnerStats {
  total_volume: number;
  monthly_volume: number;
  transaction_count: number;
  fees_earned: number;
  avg_transaction_size: number;
  volume_trend: number; // percentage change
}

export interface PartnerCredentials {
  api_key: string;
  webhook_secret: string;
}

export interface VolumeDataPoint {
  date: string;
  volume: number;
  transactions: number;
  fees_earned: number;
}

export interface ApiEndpoint {
  method: string;
  path: string;
  description: string;
  auth_required: boolean;
  parameters: ApiParameter[];
  example_request?: string;
  example_response?: string;
}

export interface ApiParameter {
  name: string;
  type: string;
  required: boolean;
  description: string;
}
