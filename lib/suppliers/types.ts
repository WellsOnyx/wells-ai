/**
 * Supplier Types
 *
 * Core types for supplier onboarding and matching system
 */

export interface Supplier {
  id: string;
  companyName: string;
  contactEmail: string;
  phone?: string;
  website?: string;

  // Product categories this supplier covers
  products: string[];

  // Pricing structure
  pricing: {
    minimumOrder: number;
    currency: string;
    discountTiers?: {
      minQuantity: number;
      discountPct: number;
    }[];
    paymentTerms: string; // e.g., "NET30", "NET60"
  };

  // Operational capacity
  capacity: {
    monthlyVolume: number; // Units per month
    leadTime: number; // Days
    locations: string[]; // Cities/regions they can ship to
  };

  // Quality and compliance
  certifications: string[]; // ISO9001, ISO14001, etc.

  // Fulfillment details
  leadTime: number; // Standard lead time in days
  minimumOrder: number; // Minimum order value

  // Additional capabilities
  dropShipCapable?: boolean;
  whiteLabelCapable?: boolean;

  // Status
  status: 'pending' | 'active' | 'paused' | 'rejected';
  onboardedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SupplierOnboardingRequest {
  companyName: string;
  contactEmail: string;
  phone?: string;
  website?: string;
  products: string[];
  pricing: Supplier['pricing'];
  capacity: Supplier['capacity'];
  certifications: string[];
  leadTime: number;
  minimumOrder: number;
  dropShipCapable?: boolean;
  whiteLabelCapable?: boolean;
}

export interface RFQDetails {
  category: string;
  description: string;
  quantity: number;
  targetPrice?: number;
  urgency: 'standard' | 'urgent' | 'critical';
  deliveryLocation: string;
  requiredCertifications?: string[];
  additionalRequirements?: string;
}

export interface SupplierMatch {
  supplier: Supplier;
  matchScore: number; // 0-100
  reasoning: string;
  estimatedPrice?: number;
  estimatedLeadTime?: number;
  strengths: string[];
  concerns?: string[];
}

export interface MatchingResult {
  matches: SupplierMatch[];
  rfqDetails: RFQDetails;
  analyzedAt: Date;
  totalSuppliersConsidered: number;
}
