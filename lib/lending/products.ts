// @ts-nocheck
/**
 * Loan Product Definitions
 * Grain & Vault Personal Lending System
 */

export interface LoanProduct {
  code: string;
  name: string;
  type: 'mortgage' | 'auto' | 'personal';
  termMonths: number;
  minAmount: number;
  maxAmount: number;
  baseRate: number; // APR as decimal (0.0675 = 6.75%)
  isSecured: boolean;
  description: string;
  features: Record<string, any>;
}

export const LOAN_PRODUCTS: Record<string, LoanProduct> = {
  // Mortgages
  MORTGAGE_30YR_FIXED: {
    code: 'MORTGAGE_30YR_FIXED',
    name: '30-Year Fixed Rate Mortgage',
    type: 'mortgage',
    termMonths: 360,
    minAmount: 50000,
    maxAmount: 2000000,
    baseRate: 0.0675,
    isSecured: true,
    description: 'Traditional 30-year fixed rate mortgage with predictable payments',
    features: {
      conventional: true,
      conforming: true,
      escrowRequired: true,
    },
  },

  MORTGAGE_15YR_FIXED: {
    code: 'MORTGAGE_15YR_FIXED',
    name: '15-Year Fixed Rate Mortgage',
    type: 'mortgage',
    termMonths: 180,
    minAmount: 50000,
    maxAmount: 2000000,
    baseRate: 0.0600,
    isSecured: true,
    description: 'Build equity faster with a 15-year fixed rate mortgage',
    features: {
      conventional: true,
      conforming: true,
      escrowRequired: true,
    },
  },

  MORTGAGE_ARM_5_1: {
    code: 'MORTGAGE_ARM_5_1',
    name: '5/1 Adjustable Rate Mortgage',
    type: 'mortgage',
    termMonths: 360,
    minAmount: 50000,
    maxAmount: 2000000,
    baseRate: 0.0575,
    isSecured: true,
    description: 'Fixed for 5 years, then adjusts annually',
    features: {
      arm: true,
      initialFixedYears: 5,
      adjustmentFrequency: 12,
      lifetimeCap: 0.05,
      periodicCap: 0.02,
    },
  },

  MORTGAGE_FHA_30YR: {
    code: 'MORTGAGE_FHA_30YR',
    name: 'FHA 30-Year Fixed',
    type: 'mortgage',
    termMonths: 360,
    minAmount: 50000,
    maxAmount: 726525, // 2024 FHA limit
    baseRate: 0.0650,
    isSecured: true,
    description: 'FHA-backed mortgage with low down payment',
    features: {
      fha: true,
      minDownPayment: 0.035,
      upfrontMIP: 0.0175,
      annualMIP: 0.0055,
    },
  },

  MORTGAGE_JUMBO_30YR: {
    code: 'MORTGAGE_JUMBO_30YR',
    name: 'Jumbo 30-Year Fixed',
    type: 'mortgage',
    termMonths: 360,
    minAmount: 726526,
    maxAmount: 5000000,
    baseRate: 0.0725,
    isSecured: true,
    description: 'For loan amounts exceeding conforming limits',
    features: {
      jumbo: true,
      minCreditScore: 700,
      minDownPayment: 0.20,
      reserves: 12, // months
    },
  },

  // Auto Loans
  AUTO_NEW_60MO: {
    code: 'AUTO_NEW_60MO',
    name: 'New Auto 60-Month',
    type: 'auto',
    termMonths: 60,
    minAmount: 10000,
    maxAmount: 150000,
    baseRate: 0.0699,
    isSecured: true,
    description: 'Finance your new vehicle with competitive rates',
    features: {
      vehicleAge: 'new',
      maxVehicleAge: 0,
      gapInsuranceAvailable: true,
      extendedWarrantyAvailable: true,
    },
  },

  AUTO_NEW_72MO: {
    code: 'AUTO_NEW_72MO',
    name: 'New Auto 72-Month',
    type: 'auto',
    termMonths: 72,
    minAmount: 10000,
    maxAmount: 150000,
    baseRate: 0.0749,
    isSecured: true,
    description: 'Extended term for lower monthly payments on new vehicles',
    features: {
      vehicleAge: 'new',
      maxVehicleAge: 0,
      gapInsuranceAvailable: true,
    },
  },

  AUTO_USED_48MO: {
    code: 'AUTO_USED_48MO',
    name: 'Used Auto 48-Month',
    type: 'auto',
    termMonths: 48,
    minAmount: 5000,
    maxAmount: 100000,
    baseRate: 0.0849,
    isSecured: true,
    description: 'Competitive rates on quality used vehicles',
    features: {
      vehicleAge: 'used',
      maxVehicleAge: 7,
      minVehicleValue: 5000,
    },
  },

  AUTO_USED_60MO: {
    code: 'AUTO_USED_60MO',
    name: 'Used Auto 60-Month',
    type: 'auto',
    termMonths: 60,
    minAmount: 5000,
    maxAmount: 100000,
    baseRate: 0.0899,
    isSecured: true,
    description: 'Finance used vehicles up to 7 years old',
    features: {
      vehicleAge: 'used',
      maxVehicleAge: 7,
      minVehicleValue: 5000,
    },
  },

  // Personal Loans
  PERSONAL_UNSECURED_36MO: {
    code: 'PERSONAL_UNSECURED_36MO',
    name: 'Personal Loan 36-Month',
    type: 'personal',
    termMonths: 36,
    minAmount: 1000,
    maxAmount: 50000,
    baseRate: 0.1199,
    isSecured: false,
    description: 'Unsecured personal loan for any purpose',
    features: {
      unsecured: true,
      maxDTI: 0.43,
      noCollateralRequired: true,
      flexiblePurpose: true,
    },
  },

  PERSONAL_UNSECURED_60MO: {
    code: 'PERSONAL_UNSECURED_60MO',
    name: 'Personal Loan 60-Month',
    type: 'personal',
    termMonths: 60,
    minAmount: 5000,
    maxAmount: 50000,
    baseRate: 0.1399,
    isSecured: false,
    description: 'Extended term unsecured personal loan',
    features: {
      unsecured: true,
      maxDTI: 0.43,
      noCollateralRequired: true,
    },
  },

  PERSONAL_SECURED_48MO: {
    code: 'PERSONAL_SECURED_48MO',
    name: 'Secured Personal Loan 48-Month',
    type: 'personal',
    termMonths: 48,
    minAmount: 5000,
    maxAmount: 100000,
    baseRate: 0.0899,
    isSecured: true,
    description: 'Lower rates with collateral',
    features: {
      secured: true,
      acceptedCollateral: ['vehicle', 'savings', 'grain'],
    },
  },

  PERSONAL_DEBT_CONSOLIDATION: {
    code: 'PERSONAL_DEBT_CONSOLIDATION',
    name: 'Debt Consolidation Loan',
    type: 'personal',
    termMonths: 60,
    minAmount: 5000,
    maxAmount: 75000,
    baseRate: 0.1099,
    isSecured: false,
    description: 'Consolidate high-interest debt into one payment',
    features: {
      purpose: 'debt_consolidation',
      directPayoffAvailable: true,
      creditCounselingIncluded: true,
    },
  },

  // GRAIN-Backed Products
  GRAIN_BACKED_INSTANT: {
    code: 'GRAIN_BACKED_INSTANT',
    name: 'GRAIN-Backed Instant Loan',
    type: 'personal',
    termMonths: 12,
    minAmount: 1000,
    maxAmount: 500000,
    baseRate: 0.0000, // 0% APR!
    isSecured: true,
    description: 'Instant approval using GRAIN as collateral - 0% APR',
    features: {
      grainBacked: true,
      instantApproval: true,
      maxLTV: 0.50, // Can borrow up to 50% of GRAIN value
      noCreditCheckRequired: true,
      flexibleRepayment: true,
      grainReleaseOnPayoff: true,
    },
  },

  GRAIN_DISCOUNT_MORTGAGE: {
    code: 'GRAIN_DISCOUNT_MORTGAGE',
    name: 'GRAIN Holder Mortgage',
    type: 'mortgage',
    termMonths: 360,
    minAmount: 50000,
    maxAmount: 2000000,
    baseRate: 0.0625,
    isSecured: true,
    description: 'Exclusive mortgage rates for GRAIN holders',
    features: {
      grainExclusive: true,
      baseDiscount: 0.0050,
      noPMIWithGrain: true,
      grainStakingRequired: true,
      minGrainBalance: 10000,
    },
  },
};

export const CREDIT_TIERS = {
  EXCELLENT: {
    name: 'Excellent',
    minScore: 750,
    maxScore: 850,
    rateAdjustment: -0.0050, // -0.5%
    description: 'Exceptional credit - best rates available',
  },
  GOOD: {
    name: 'Good',
    minScore: 700,
    maxScore: 749,
    rateAdjustment: 0.0000, // base rate
    description: 'Good credit - competitive rates',
  },
  FAIR: {
    name: 'Fair',
    minScore: 650,
    maxScore: 699,
    rateAdjustment: 0.0075, // +0.75%
    description: 'Fair credit - standard rates',
  },
  SUBPRIME: {
    name: 'Subprime',
    minScore: 580,
    maxScore: 649,
    rateAdjustment: 0.0200, // +2.0%
    description: 'Building credit - higher rates',
  },
};

export function getCreditTier(creditScore: number) {
  if (creditScore >= 750) return CREDIT_TIERS.EXCELLENT;
  if (creditScore >= 700) return CREDIT_TIERS.GOOD;
  if (creditScore >= 650) return CREDIT_TIERS.FAIR;
  if (creditScore >= 580) return CREDIT_TIERS.SUBPRIME;
  return null; // Below minimum
}

export function getProductsByType(type: 'mortgage' | 'auto' | 'personal') {
  return Object.values(LOAN_PRODUCTS).filter(p => p.type === type);
}

export function getProduct(code: string): LoanProduct | null {
  return LOAN_PRODUCTS[code] || null;
}

// GRAIN discount tiers
export const GRAIN_DISCOUNTS = {
  TIER_1: { minGrain: 10000, discount: 0.0025 },   // 0.25% off
  TIER_2: { minGrain: 25000, discount: 0.0050 },   // 0.50% off
  TIER_3: { minGrain: 50000, discount: 0.0075 },   // 0.75% off
  TIER_4: { minGrain: 100000, discount: 0.0100 },  // 1.00% off
  TIER_5: { minGrain: 250000, discount: 0.0150 },  // 1.50% off
};

export function calculateGrainDiscount(grainStaked: number): number {
  let discount = 0;

  if (grainStaked >= GRAIN_DISCOUNTS.TIER_5.minGrain) {
    discount = GRAIN_DISCOUNTS.TIER_5.discount;
  } else if (grainStaked >= GRAIN_DISCOUNTS.TIER_4.minGrain) {
    discount = GRAIN_DISCOUNTS.TIER_4.discount;
  } else if (grainStaked >= GRAIN_DISCOUNTS.TIER_3.minGrain) {
    discount = GRAIN_DISCOUNTS.TIER_3.discount;
  } else if (grainStaked >= GRAIN_DISCOUNTS.TIER_2.minGrain) {
    discount = GRAIN_DISCOUNTS.TIER_2.discount;
  } else if (grainStaked >= GRAIN_DISCOUNTS.TIER_1.minGrain) {
    discount = GRAIN_DISCOUNTS.TIER_1.discount;
  }

  return discount;
}

export const LOAN_PURPOSES = {
  // Mortgage purposes
  PURCHASE: 'Home Purchase',
  REFINANCE: 'Refinance',
  REFINANCE_CASH_OUT: 'Cash-Out Refinance',
  CONSTRUCTION: 'Construction',
  RENOVATION: 'Home Renovation',

  // Auto purposes
  AUTO_PURCHASE: 'Vehicle Purchase',
  AUTO_REFINANCE: 'Auto Refinance',

  // Personal loan purposes
  DEBT_CONSOLIDATION: 'Debt Consolidation',
  HOME_IMPROVEMENT: 'Home Improvement',
  MEDICAL_EXPENSES: 'Medical Expenses',
  WEDDING: 'Wedding',
  VACATION: 'Vacation',
  BUSINESS: 'Business Expenses',
  EDUCATION: 'Education',
  MOVING: 'Moving/Relocation',
  OTHER: 'Other',
};

export const PROPERTY_TYPES = {
  SINGLE_FAMILY: 'Single Family Home',
  CONDO: 'Condominium',
  TOWNHOUSE: 'Townhouse',
  MULTI_FAMILY_2_4: 'Multi-Family (2-4 units)',
  MANUFACTURED: 'Manufactured Home',
  COOPERATIVE: 'Cooperative',
};

export const PROPERTY_USE = {
  PRIMARY_RESIDENCE: 'Primary Residence',
  SECOND_HOME: 'Second Home',
  INVESTMENT: 'Investment Property',
};

export const EMPLOYMENT_TYPES = {
  FULL_TIME: 'Full-Time Employee',
  PART_TIME: 'Part-Time Employee',
  SELF_EMPLOYED: 'Self-Employed',
  CONTRACT: 'Contract/1099',
  RETIRED: 'Retired',
  UNEMPLOYED: 'Unemployed',
  OTHER: 'Other',
};
