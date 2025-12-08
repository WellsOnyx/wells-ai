// @ts-nocheck
/**
 * Collateral Management System
 * Grain & Vault Personal Lending System
 */

export interface PropertyValuation {
  address: string;
  estimatedValue: number;
  valuationSource: 'appraisal' | 'avm' | 'zillow' | 'redfin' | 'manual';
  valuationDate: Date;
  confidence: 'high' | 'medium' | 'low';
  comparables?: {
    address: string;
    soldPrice: number;
    soldDate: Date;
    squareFeet: number;
  }[];
}

export interface VehicleValuation {
  year: number;
  make: string;
  model: string;
  mileage: number;
  condition: 'excellent' | 'good' | 'fair' | 'poor';
  estimatedValue: number;
  valuationSource: 'kbb' | 'nada' | 'edmunds' | 'manual';
  valuationDate: Date;
  trim?: string;
  vin?: string;
}

export interface GrainCollateral {
  amount: number;
  walletAddress: string;
  lockDate: Date;
  unlockDate?: Date;
  currentValue: number; // In USD
  grainPriceAtLock: number;
  currentGrainPrice: number;
  ltv: number;
}

export interface InsuranceVerification {
  insuranceType: 'homeowners' | 'auto' | 'flood' | 'umbrella';
  insuranceCompany: string;
  policyNumber: string;
  coverageAmount: number;
  effectiveDate: Date;
  expirationDate: Date;
  isVerified: boolean;
  verifiedDate?: Date;
  lienholderCertificate: boolean;
}

/**
 * Estimate property value using AVM (Automated Valuation Model)
 * In production, this would call Zillow/Redfin/CoreLogic APIs
 */
export function estimatePropertyValue(
  address: string,
  city: string,
  state: string,
  zip: string,
  squareFeet: number,
  bedrooms: number,
  bathrooms: number
): PropertyValuation {
  // Simplified estimation - in production would call external APIs
  const basePrice = 150; // per sq ft
  const stateMultipliers: Record<string, number> = {
    CA: 3.5,
    NY: 2.8,
    FL: 1.5,
    TX: 1.2,
    // ... etc
  };

  const multiplier = stateMultipliers[state] || 1.0;
  const estimatedValue = squareFeet * basePrice * multiplier;

  // Add variance
  const variance = estimatedValue * 0.1; // ±10%
  const finalValue = estimatedValue + (Math.random() * variance * 2 - variance);

  return {
    address: `${address}, ${city}, ${state} ${zip}`,
    estimatedValue: Math.round(finalValue),
    valuationSource: 'avm',
    valuationDate: new Date(),
    confidence: squareFeet > 800 && bedrooms >= 2 ? 'high' : 'medium',
    comparables: [
      // Mock comparables
      {
        address: `${parseInt(address) + 100} ${address.split(' ').slice(1).join(' ')}`,
        soldPrice: Math.round(finalValue * 0.95),
        soldDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        squareFeet: squareFeet - 100,
      },
      {
        address: `${parseInt(address) - 50} ${address.split(' ').slice(1).join(' ')}`,
        soldPrice: Math.round(finalValue * 1.05),
        soldDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        squareFeet: squareFeet + 150,
      },
    ],
  };
}

/**
 * Estimate vehicle value using KBB-style valuation
 * In production, this would call KBB/NADA/Edmunds APIs
 */
export function estimateVehicleValue(
  year: number,
  make: string,
  model: string,
  mileage: number,
  condition: 'excellent' | 'good' | 'fair' | 'poor' = 'good',
  trim?: string
): VehicleValuation {
  // Simplified estimation - in production would call KBB/NADA APIs
  const currentYear = new Date().getFullYear();
  const age = currentYear - year;

  // Base values by make (simplified)
  const basePrices: Record<string, number> = {
    Toyota: 28000,
    Honda: 27000,
    Ford: 32000,
    Chevrolet: 30000,
    Tesla: 45000,
    BMW: 42000,
    Mercedes: 48000,
    // ... etc
  };

  const basePrice = basePrices[make] || 25000;

  // Depreciation (approximate)
  const depreciationRate = age <= 1 ? 0.20 : age <= 3 ? 0.15 : age <= 5 ? 0.10 : 0.08;
  let value = basePrice;
  for (let i = 0; i < age; i++) {
    value *= (1 - depreciationRate);
  }

  // Mileage adjustment (average is 12k/year)
  const expectedMileage = age * 12000;
  const mileageDifference = mileage - expectedMileage;
  const mileageAdjustment = (mileageDifference / 1000) * -25; // -$25 per 1000 miles over average
  value += mileageAdjustment;

  // Condition adjustment
  const conditionMultipliers = {
    excellent: 1.10,
    good: 1.00,
    fair: 0.85,
    poor: 0.70,
  };
  value *= conditionMultipliers[condition];

  return {
    year,
    make,
    model,
    mileage,
    condition,
    estimatedValue: Math.max(1000, Math.round(value)),
    valuationSource: 'kbb',
    valuationDate: new Date(),
    trim,
  };
}

/**
 * Lock GRAIN as collateral
 *
 * When GRAIN is used as collateral, 100% is initially locked:
 * - 50% as primary collateral (at LTV)
 * - 50% as secondary lock (can be unlocked via GRAIN market)
 *
 * Integration with GRAIN Lending Market:
 * - Borrower can find backers to unlock the secondary 50%
 * - Lenders provide their GRAIN to replace borrower's secondary lock
 * - Borrower gains liquidity, lender earns yield
 */
export function lockGrainCollateral(
  amount: number,
  walletAddress: string,
  grainPrice: number,
  loanAmount: number,
  options: {
    loanId?: string;
    borrowerId?: string;
    enableMarketBacking?: boolean;
  } = {}
): GrainCollateral & {
  primaryLockAmount: number;
  secondaryLockAmount: number;
  canSeekBacking: boolean;
} {
  const currentValue = amount * grainPrice;
  const ltv = loanAmount / currentValue;

  if (ltv > 0.50) {
    throw new Error('Cannot lock GRAIN - LTV exceeds 50% maximum');
  }

  // Split into primary (actual collateral) and secondary (additional lock)
  const primaryLockAmount = amount * ltv * 2; // Amount needed for 50% LTV
  const secondaryLockAmount = amount - primaryLockAmount; // Remaining GRAIN

  return {
    amount,
    walletAddress,
    lockDate: new Date(),
    currentValue,
    grainPriceAtLock: grainPrice,
    currentGrainPrice: grainPrice,
    ltv,
    primaryLockAmount,
    secondaryLockAmount,
    canSeekBacking: options.enableMarketBacking !== false && secondaryLockAmount > 0,
  };
}

/**
 * Update GRAIN collateral value
 */
export function updateGrainCollateralValue(
  collateral: GrainCollateral,
  currentGrainPrice: number,
  currentLoanBalance: number
): {
  collateral: GrainCollateral;
  currentLtv: number;
  marginCallRequired: boolean;
  marginCallAmount?: number;
} {
  const currentValue = collateral.amount * currentGrainPrice;
  const currentLtv = currentLoanBalance / currentValue;

  // Margin call if LTV > 60%
  const marginCallRequired = currentLtv > 0.60;
  let marginCallAmount: number | undefined;

  if (marginCallRequired) {
    // Amount needed to bring LTV back to 50%
    const targetValue = currentLoanBalance / 0.50;
    const additionalGrainNeeded = (targetValue - currentValue) / currentGrainPrice;
    marginCallAmount = Math.max(0, additionalGrainNeeded);
  }

  return {
    collateral: {
      ...collateral,
      currentValue,
      currentGrainPrice,
      ltv: currentLtv,
    },
    currentLtv,
    marginCallRequired,
    marginCallAmount,
  };
}

/**
 * Release GRAIN collateral (when loan is paid off)
 */
export function releaseGrainCollateral(
  collateral: GrainCollateral
): GrainCollateral {
  return {
    ...collateral,
    unlockDate: new Date(),
  };
}

/**
 * Verify insurance coverage
 */
export function verifyInsurance(
  insuranceType: 'homeowners' | 'auto',
  policyNumber: string,
  insuranceCompany: string,
  coverageAmount: number,
  expirationDate: Date,
  requiredCoverage: number,
  lienholderName: string = 'Grain & Vault'
): InsuranceVerification {
  const isVerified =
    coverageAmount >= requiredCoverage &&
    expirationDate > new Date() &&
    policyNumber.length > 0;

  return {
    insuranceType,
    insuranceCompany,
    policyNumber,
    coverageAmount,
    effectiveDate: new Date(),
    expirationDate,
    isVerified,
    verifiedDate: isVerified ? new Date() : undefined,
    lienholderCertificate: isVerified,
  };
}

/**
 * Calculate required insurance coverage
 */
export function calculateRequiredInsurance(
  collateralType: 'property' | 'vehicle',
  collateralValue: number,
  loanAmount: number
): {
  requiredCoverage: number;
  recommendedCoverage: number;
  replacementCost: number;
} {
  if (collateralType === 'property') {
    // Property: Require coverage for loan amount or replacement cost
    const replacementCost = collateralValue * 1.0; // 100% of value
    const requiredCoverage = Math.max(loanAmount, replacementCost * 0.80);
    const recommendedCoverage = replacementCost;

    return {
      requiredCoverage: Math.round(requiredCoverage),
      recommendedCoverage: Math.round(recommendedCoverage),
      replacementCost: Math.round(replacementCost),
    };
  } else {
    // Vehicle: Require actual cash value coverage
    const replacementCost = collateralValue;
    const requiredCoverage = Math.max(loanAmount, collateralValue);
    const recommendedCoverage = collateralValue * 1.25; // 125% for gap coverage

    return {
      requiredCoverage: Math.round(requiredCoverage),
      recommendedCoverage: Math.round(recommendedCoverage),
      replacementCost: Math.round(replacementCost),
    };
  }
}

/**
 * File lien on collateral
 */
export function fileLien(
  collateralType: 'property' | 'vehicle',
  collateralIdentifier: string, // Address or VIN
  loanAmount: number,
  lienHolder: string = 'Grain & Vault',
  state: string
): {
  lienId: string;
  lienType: string;
  collateralIdentifier: string;
  lienHolder: string;
  lienAmount: number;
  filingDate: Date;
  filingState: string;
  filingFee: number;
  recordingNumber?: string;
} {
  const lienId = `LIEN-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

  // State-specific filing fees (simplified)
  const filingFees: Record<string, number> = {
    CA: 75,
    TX: 50,
    FL: 60,
    NY: 100,
  };

  const filingFee = filingFees[state] || 65;

  return {
    lienId,
    lienType: collateralType === 'property' ? 'Mortgage Lien' : 'Title Lien',
    collateralIdentifier,
    lienHolder,
    lienAmount: loanAmount,
    filingDate: new Date(),
    filingState: state,
    filingFee,
    recordingNumber: `${state}-${Date.now()}`,
  };
}

/**
 * Release lien on collateral
 */
export function releaseLien(
  lienId: string,
  releaseReason: 'paid_in_full' | 'refinanced' | 'sold' | 'other' = 'paid_in_full'
): {
  lienId: string;
  releaseDate: Date;
  releaseReason: string;
  releaseFee: number;
} {
  return {
    lienId,
    releaseDate: new Date(),
    releaseReason,
    releaseFee: 35, // Typical lien release fee
  };
}

/**
 * Perform periodic collateral valuation
 */
export function performPeriodicValuation(
  originalValue: number,
  lastValuationDate: Date,
  currentDate: Date = new Date(),
  collateralType: 'property' | 'vehicle'
): {
  shouldRevalue: boolean;
  daysSinceLastValuation: number;
  estimatedCurrentValue: number;
  valuationMethod: string;
} {
  const daysSinceLastValuation = Math.floor(
    (currentDate.getTime() - lastValuationDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Property: Revalue annually, Vehicle: Revalue every 6 months
  const revaluationDays = collateralType === 'property' ? 365 : 180;
  const shouldRevalue = daysSinceLastValuation >= revaluationDays;

  // Simple appreciation/depreciation estimate
  let estimatedCurrentValue: number;
  let valuationMethod: string;

  if (collateralType === 'property') {
    // Assume 3% annual appreciation
    const years = daysSinceLastValuation / 365;
    estimatedCurrentValue = originalValue * Math.pow(1.03, years);
    valuationMethod = 'Annual appreciation estimate';
  } else {
    // Assume 15% annual depreciation for vehicles
    const years = daysSinceLastValuation / 365;
    estimatedCurrentValue = originalValue * Math.pow(0.85, years);
    valuationMethod = 'Depreciation curve';
  }

  return {
    shouldRevalue,
    daysSinceLastValuation,
    estimatedCurrentValue: Math.round(estimatedCurrentValue),
    valuationMethod,
  };
}

/**
 * Check for PMI removal eligibility (mortgages)
 */
export function checkPMIRemovalEligibility(
  originalLoanAmount: number,
  currentBalance: number,
  originalPropertyValue: number,
  currentPropertyValue: number,
  monthsPaid: number,
  paymentHistory: 'current' | 'late'
): {
  eligible: boolean;
  currentLtv: number;
  originalLtv: number;
  reason: string;
  automaticRemovalLtv: number;
  requestRemovalLtv: number;
} {
  const currentLtv = currentBalance / currentPropertyValue;
  const originalLtv = originalLoanAmount / originalPropertyValue;

  let eligible = false;
  let reason = '';

  // Automatic removal at 78% LTV
  if (currentLtv <= 0.78) {
    eligible = true;
    reason = 'Automatic removal - LTV at or below 78%';
  }
  // Borrower can request removal at 80% LTV with good payment history
  else if (currentLtv <= 0.80 && paymentHistory === 'current' && monthsPaid >= 24) {
    eligible = true;
    reason = 'Eligible for requested removal - LTV at or below 80% with 24+ months payment history';
  } else if (currentLtv <= 0.80 && paymentHistory !== 'current') {
    eligible = false;
    reason = 'LTV is 80% or below, but payment history has late payments';
  } else if (currentLtv <= 0.80 && monthsPaid < 24) {
    eligible = false;
    reason = 'LTV is 80% or below, but less than 24 months payment history';
  } else {
    eligible = false;
    reason = `LTV is ${(currentLtv * 100).toFixed(2)}% - must be 80% or below`;
  }

  return {
    eligible,
    currentLtv: Math.round(currentLtv * 10000) / 10000,
    originalLtv: Math.round(originalLtv * 10000) / 10000,
    reason,
    automaticRemovalLtv: 0.78,
    requestRemovalLtv: 0.80,
  };
}

/**
 * Track collateral inspection status
 */
export function scheduleCollateralInspection(
  collateralType: 'property' | 'vehicle',
  collateralAddress: string,
  lastInspectionDate?: Date
): {
  inspectionRequired: boolean;
  inspectionType: string;
  estimatedCost: number;
  scheduledDate?: Date;
  inspector?: string;
} {
  const inspectionTypes = {
    property: {
      type: 'Property Inspection & Appraisal',
      cost: 500,
      frequency: 365, // Annual
    },
    vehicle: {
      type: 'Vehicle Condition Inspection',
      cost: 150,
      frequency: 180, // Semi-annual
    },
  };

  const config = inspectionTypes[collateralType];
  let inspectionRequired = false;

  if (lastInspectionDate) {
    const daysSince = Math.floor(
      (new Date().getTime() - lastInspectionDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    inspectionRequired = daysSince >= config.frequency;
  } else {
    inspectionRequired = true; // No previous inspection
  }

  return {
    inspectionRequired,
    inspectionType: config.type,
    estimatedCost: config.cost,
    scheduledDate: inspectionRequired ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : undefined,
    inspector: inspectionRequired ? 'Assigned Inspector' : undefined,
  };
}
