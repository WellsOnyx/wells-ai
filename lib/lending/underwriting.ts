// @ts-nocheck
/**
 * Automated Underwriting Engine
 * Grain & Vault Personal Lending System
 */

import { getCreditTier, getProduct, calculateGrainDiscount } from './products';

export interface UnderwritingInput {
  // Borrower info
  creditScore: number;
  annualIncome: number;
  additionalIncome?: number;
  monthlyHousingPayment: number;
  monthlyDebtPayments: number;
  employmentType: string;
  yearsAtJob: number;

  // Loan details
  productCode: string;
  requestedAmount: number;
  downPayment?: number;
  propertyValue?: number;
  vehicleValue?: number;

  // GRAIN holdings
  grainStaked?: number;

  // Assets
  liquidAssets?: number;
  totalAssets?: number;
}

export interface UnderwritingDecision {
  decision: 'approved' | 'declined' | 'conditional' | 'manual_review';
  approvedAmount?: number;
  approvedRate: number;
  apr: number;
  monthlyPayment: number;
  termMonths: number;

  // Rate breakdown
  baseRate: number;
  creditAdjustment: number;
  grainDiscount: number;

  // Ratios
  dti: number;
  ltv?: number;
  loanToIncome: number;

  // Risk
  riskGrade: 'A' | 'B' | 'C' | 'D' | 'E';
  riskScore: number;
  riskFactors: string[];

  // Conditions
  conditions: string[];
  stipulations: string[];

  // Decline reasons
  declineReasons?: string[];

  // Additional info
  creditTier: string;
  maxApprovedAmount: number;
  reservesRequired?: number; // months
}

/**
 * Main underwriting decision engine
 */
export async function underwriteLoan(
  input: UnderwritingInput
): Promise<UnderwritingDecision> {
  const product = getProduct(input.productCode);
  if (!product) {
    throw new Error('Invalid product code');
  }

  const declineReasons: string[] = [];
  const conditions: string[] = [];
  const stipulations: string[] = [];
  const riskFactors: string[] = [];

  // Check minimum credit score
  const creditTier = getCreditTier(input.creditScore);
  if (!creditTier) {
    declineReasons.push('Credit score below minimum requirement (580)');
  }

  // Calculate DTI
  const totalMonthlyIncome = (input.annualIncome + (input.additionalIncome || 0)) / 12;
  const proposedPayment = calculateMonthlyPayment(
    input.requestedAmount,
    product.baseRate,
    product.termMonths
  );

  let totalMonthlyDebt = input.monthlyDebtPayments;

  // For mortgages, use PITI (Principal, Interest, Taxes, Insurance)
  if (product.type === 'mortgage') {
    const estimatedEscrow = (input.propertyValue || input.requestedAmount) * 0.01 / 12; // ~1% annually
    totalMonthlyDebt = totalMonthlyDebt - input.monthlyHousingPayment + proposedPayment + estimatedEscrow;
  } else {
    totalMonthlyDebt = totalMonthlyDebt + proposedPayment;
  }

  const dti = totalMonthlyDebt / totalMonthlyIncome;

  // Calculate LTV for secured loans
  let ltv = 0;
  if (product.type === 'mortgage' && input.propertyValue) {
    ltv = input.requestedAmount / input.propertyValue;
  } else if (product.type === 'auto' && input.vehicleValue) {
    ltv = input.requestedAmount / input.vehicleValue;
  }

  // Loan to income ratio
  const loanToIncome = input.requestedAmount / input.annualIncome;

  // Check DTI limits
  const maxDTI = product.type === 'mortgage' ? 0.45 : 0.43;
  if (dti > maxDTI) {
    declineReasons.push(`Debt-to-income ratio (${(dti * 100).toFixed(1)}%) exceeds maximum (${(maxDTI * 100).toFixed(0)}%)`);
  } else if (dti > maxDTI - 0.05) {
    riskFactors.push('High DTI ratio');
    conditions.push('DTI ratio is high - recommend lower loan amount');
  }

  // Check LTV limits for secured loans
  if (product.isSecured && ltv > 0) {
    const maxLTV = getMaxLTV(product.type, input.creditScore);
    if (ltv > maxLTV) {
      declineReasons.push(`Loan-to-value ratio (${(ltv * 100).toFixed(1)}%) exceeds maximum (${(maxLTV * 100).toFixed(0)}%)`);
    }
  }

  // Check employment stability
  if (input.employmentType === 'UNEMPLOYED') {
    declineReasons.push('No verifiable income source');
  } else if (input.employmentType === 'SELF_EMPLOYED' && input.yearsAtJob < 2) {
    conditions.push('Self-employment less than 2 years - requires 2 years tax returns');
    stipulations.push('2 years of tax returns with Schedule C');
    riskFactors.push('New self-employment');
  } else if (input.yearsAtJob < 0.5) {
    conditions.push('Limited employment history - may require additional documentation');
    riskFactors.push('New employment');
  }

  // Check loan amount limits
  if (input.requestedAmount < product.minAmount) {
    declineReasons.push(`Loan amount below minimum ($${product.minAmount.toLocaleString()})`);
  }
  if (input.requestedAmount > product.maxAmount) {
    declineReasons.push(`Loan amount exceeds maximum ($${product.maxAmount.toLocaleString()})`);
  }

  // Calculate rate
  const baseRate = product.baseRate;
  const creditAdjustment = creditTier ? creditTier.rateAdjustment : 0.0200;
  const grainDiscount = input.grainStaked ? calculateGrainDiscount(input.grainStaked) : 0;

  const finalRate = Math.max(0, baseRate + creditAdjustment - grainDiscount);

  // Calculate APR (includes fees)
  const originationFee = calculateOriginationFee(input.requestedAmount, product.type);
  const apr = calculateAPR(input.requestedAmount, finalRate, product.termMonths, originationFee);

  // Calculate monthly payment
  const monthlyPayment = calculateMonthlyPayment(input.requestedAmount, finalRate, product.termMonths);

  // Add escrow for mortgages
  let totalMonthlyPayment = monthlyPayment;
  if (product.type === 'mortgage') {
    const estimatedEscrow = (input.propertyValue || input.requestedAmount) * 0.01 / 12;
    totalMonthlyPayment += estimatedEscrow;

    // PMI if LTV > 80% and not GRAIN-backed
    if (ltv > 0.80 && (!input.grainStaked || input.grainStaked < 20000)) {
      const pmi = input.requestedAmount * 0.005 / 12; // 0.5% annually
      totalMonthlyPayment += pmi;
      conditions.push('Private Mortgage Insurance (PMI) required due to LTV > 80%');
    }
  }

  // Risk assessment
  let riskScore = 50; // Base score

  // Credit score impact
  if (input.creditScore >= 750) riskScore -= 15;
  else if (input.creditScore >= 700) riskScore -= 5;
  else if (input.creditScore >= 650) riskScore += 5;
  else riskScore += 15;

  // DTI impact
  if (dti <= 0.30) riskScore -= 10;
  else if (dti <= 0.36) riskScore -= 5;
  else if (dti <= 0.43) riskScore += 5;
  else riskScore += 15;

  // LTV impact
  if (ltv > 0) {
    if (ltv <= 0.70) riskScore -= 10;
    else if (ltv <= 0.80) riskScore -= 5;
    else if (ltv <= 0.90) riskScore += 5;
    else riskScore += 10;
  }

  // Employment stability
  if (input.yearsAtJob >= 5) riskScore -= 5;
  else if (input.yearsAtJob < 1) riskScore += 10;

  // GRAIN staking reduces risk
  if (input.grainStaked && input.grainStaked >= 50000) riskScore -= 15;
  else if (input.grainStaked && input.grainStaked >= 25000) riskScore -= 10;
  else if (input.grainStaked && input.grainStaked >= 10000) riskScore -= 5;

  // Determine risk grade
  let riskGrade: 'A' | 'B' | 'C' | 'D' | 'E';
  if (riskScore <= 30) riskGrade = 'A';
  else if (riskScore <= 45) riskGrade = 'B';
  else if (riskScore <= 60) riskGrade = 'C';
  else if (riskScore <= 75) riskGrade = 'D';
  else riskGrade = 'E';

  // Additional risk factors
  if (loanToIncome > 3) riskFactors.push('High loan-to-income ratio');
  if (input.creditScore < 680) riskFactors.push('Below prime credit score');
  if (dti > 0.40) riskFactors.push('Elevated debt levels');

  // Standard stipulations
  stipulations.push('Government-issued photo ID');
  stipulations.push('30 days recent pay stubs or bank statements');

  if (product.type === 'mortgage') {
    stipulations.push('Property appraisal');
    stipulations.push('Homeowners insurance quote');
    stipulations.push('Title report');
  } else if (product.type === 'auto') {
    stipulations.push('Vehicle inspection report');
    stipulations.push('Auto insurance quote');
    stipulations.push('Vehicle title');
  }

  // Reserves required for higher-risk mortgages
  let reservesRequired = 0;
  if (product.type === 'mortgage') {
    if (riskGrade === 'C') reservesRequired = 2;
    else if (riskGrade === 'D' || riskGrade === 'E') reservesRequired = 6;

    if (reservesRequired > 0) {
      conditions.push(`${reservesRequired} months reserves required (${(reservesRequired * totalMonthlyPayment).toLocaleString('en-US', { style: 'currency', currency: 'USD' })})`);
    }
  }

  // Calculate max approved amount based on DTI
  const maxMonthlyPayment = (totalMonthlyIncome * maxDTI) - input.monthlyDebtPayments;
  const maxApprovedAmount = calculateLoanAmount(maxMonthlyPayment, finalRate, product.termMonths);

  // Make final decision
  let decision: 'approved' | 'declined' | 'conditional' | 'manual_review';

  if (declineReasons.length > 0) {
    decision = 'declined';
  } else if (riskGrade === 'E' || riskScore > 80) {
    decision = 'manual_review';
    conditions.push('Application requires manual underwriter review');
  } else if (conditions.length > 3 || riskGrade === 'D') {
    decision = 'conditional';
  } else {
    decision = 'approved';
  }

  // Special handling for GRAIN-backed loans
  if (product.code === 'GRAIN_BACKED_INSTANT' && input.grainStaked) {
    const maxGrainLoan = input.grainStaked * 0.50; // 50% LTV
    if (input.requestedAmount <= maxGrainLoan) {
      decision = 'approved';
      declineReasons.length = 0;
      conditions.length = 0;
      riskGrade = 'A';
      riskScore = 20;
      stipulations.length = 0;
      stipulations.push('GRAIN collateral lock agreement');
    } else {
      declineReasons.push(`Requested amount exceeds 50% of GRAIN collateral value (max: ${maxGrainLoan.toLocaleString('en-US', { style: 'currency', currency: 'USD' })})`);
      decision = 'declined';
    }
  }

  return {
    decision,
    approvedAmount: decision === 'approved' || decision === 'conditional' ? input.requestedAmount : undefined,
    approvedRate: finalRate,
    apr,
    monthlyPayment: totalMonthlyPayment,
    termMonths: product.termMonths,
    baseRate,
    creditAdjustment,
    grainDiscount,
    dti,
    ltv: ltv > 0 ? ltv : undefined,
    loanToIncome,
    riskGrade,
    riskScore,
    riskFactors,
    conditions,
    stipulations,
    declineReasons: declineReasons.length > 0 ? declineReasons : undefined,
    creditTier: creditTier?.name || 'Below Minimum',
    maxApprovedAmount,
    reservesRequired: reservesRequired > 0 ? reservesRequired : undefined,
  };
}

/**
 * Get maximum LTV based on product type and credit score
 */
function getMaxLTV(productType: string, creditScore: number): number {
  if (productType === 'mortgage') {
    if (creditScore >= 750) return 0.97;
    if (creditScore >= 700) return 0.95;
    if (creditScore >= 650) return 0.90;
    return 0.85;
  } else if (productType === 'auto') {
    if (creditScore >= 700) return 1.00; // 100% financing available
    if (creditScore >= 650) return 0.95;
    return 0.90;
  }
  return 0.80; // Default for other secured loans
}

/**
 * Calculate monthly payment
 */
export function calculateMonthlyPayment(
  principal: number,
  annualRate: number,
  months: number
): number {
  if (annualRate === 0) {
    return principal / months;
  }

  const monthlyRate = annualRate / 12;
  const payment = principal * (monthlyRate * Math.pow(1 + monthlyRate, months)) /
                 (Math.pow(1 + monthlyRate, months) - 1);

  return Math.round(payment * 100) / 100;
}

/**
 * Calculate loan amount from payment
 */
export function calculateLoanAmount(
  monthlyPayment: number,
  annualRate: number,
  months: number
): number {
  if (annualRate === 0) {
    return monthlyPayment * months;
  }

  const monthlyRate = annualRate / 12;
  const amount = monthlyPayment * (Math.pow(1 + monthlyRate, months) - 1) /
                (monthlyRate * Math.pow(1 + monthlyRate, months));

  return Math.round(amount * 100) / 100;
}

/**
 * Calculate APR (includes fees)
 */
export function calculateAPR(
  principal: number,
  rate: number,
  months: number,
  fees: number
): number {
  // Simple approximation: APR ≈ rate + (fees/principal) * (12/months)
  const feeRate = (fees / principal) * (12 / months);
  return rate + feeRate;
}

/**
 * Calculate origination fee
 */
export function calculateOriginationFee(amount: number, productType: string): number {
  if (productType === 'mortgage') {
    return amount * 0.01; // 1% for mortgages
  } else if (productType === 'auto') {
    return 0; // No origination fee for auto
  } else {
    // Personal loans: 1-5% based on amount
    if (amount >= 25000) return amount * 0.01;
    if (amount >= 10000) return amount * 0.02;
    if (amount >= 5000) return amount * 0.03;
    return amount * 0.05;
  }
}

/**
 * Quick pre-qualification check (soft pull simulation)
 */
export function preQualify(
  creditScoreRange: { min: number; max: number },
  annualIncome: number,
  monthlyDebts: number,
  requestedAmount: number,
  productCode: string
): { qualified: boolean; estimatedRate: number; estimatedPayment: number; message: string } {
  const avgCreditScore = (creditScoreRange.min + creditScoreRange.max) / 2;
  const product = getProduct(productCode);

  if (!product) {
    return {
      qualified: false,
      estimatedRate: 0,
      estimatedPayment: 0,
      message: 'Invalid product',
    };
  }

  const creditTier = getCreditTier(avgCreditScore);
  if (!creditTier) {
    return {
      qualified: false,
      estimatedRate: 0,
      estimatedPayment: 0,
      message: 'Credit score below minimum requirement',
    };
  }

  const estimatedRate = product.baseRate + creditTier.rateAdjustment;
  const estimatedPayment = calculateMonthlyPayment(requestedAmount, estimatedRate, product.termMonths);

  const monthlyIncome = annualIncome / 12;
  const dti = (monthlyDebts + estimatedPayment) / monthlyIncome;

  if (dti > 0.43) {
    return {
      qualified: false,
      estimatedRate,
      estimatedPayment,
      message: 'Debt-to-income ratio too high',
    };
  }

  if (requestedAmount < product.minAmount || requestedAmount > product.maxAmount) {
    return {
      qualified: false,
      estimatedRate,
      estimatedPayment,
      message: 'Loan amount outside acceptable range',
    };
  }

  return {
    qualified: true,
    estimatedRate,
    estimatedPayment,
    message: 'You may qualify for this loan',
  };
}
