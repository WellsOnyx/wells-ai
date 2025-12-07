// @ts-nocheck
/**
 * Rate Calculation System
 * Grain & Vault Personal Lending System
 */

import { getProduct, getCreditTier, calculateGrainDiscount } from './products';

export interface RateQuoteInput {
  productCode: string;
  loanAmount: number;
  creditScore?: number;
  grainStaked?: number;
  points?: number; // Discount points (1 point = 1% of loan amount)
  propertyValue?: number; // For LTV calculation
  vehicleValue?: number; // For auto LTV
}

export interface RateQuote {
  baseRate: number;
  creditAdjustment: number;
  grainDiscount: number;
  pointsDiscount: number;
  finalRate: number;
  apr: number;

  monthlyPayment: number;
  totalInterest: number;
  totalCost: number;

  pointsCost: number;
  originationFee: number;
  totalFees: number;

  ltv?: number;
  creditTier?: string;

  breakEvenMonths?: number; // If buying points
}

export interface RateSheet {
  productCode: string;
  productName: string;
  asOfDate: Date;
  rates: {
    creditTier: string;
    minScore: number;
    maxScore: number;
    rate: number;
    apr: number;
    points: number;
  }[];
}

/**
 * Get personalized rate quote
 */
export function getRateQuote(input: RateQuoteInput): RateQuote {
  const product = getProduct(input.productCode);
  if (!product) {
    throw new Error('Invalid product code');
  }

  // Base rate from product
  let baseRate = product.baseRate;

  // Credit score adjustment
  let creditAdjustment = 0;
  let creditTier = 'Standard';

  if (input.creditScore) {
    const tier = getCreditTier(input.creditScore);
    if (tier) {
      creditAdjustment = tier.rateAdjustment;
      creditTier = tier.name;
    }
  }

  // GRAIN discount
  const grainDiscount = input.grainStaked ? calculateGrainDiscount(input.grainStaked) : 0;

  // Discount points adjustment (typically 0.25% per point)
  const pointsDiscount = (input.points || 0) * 0.0025;

  // Calculate final rate
  const finalRate = Math.max(0, baseRate + creditAdjustment - grainDiscount - pointsDiscount);

  // Calculate LTV if applicable
  let ltv: number | undefined;
  if (product.type === 'mortgage' && input.propertyValue) {
    ltv = input.loanAmount / input.propertyValue;
  } else if (product.type === 'auto' && input.vehicleValue) {
    ltv = input.loanAmount / input.vehicleValue;
  }

  // Calculate fees
  const pointsCost = (input.points || 0) * input.loanAmount * 0.01;
  const originationFee = calculateOriginationFee(input.loanAmount, product.type);
  const totalFees = pointsCost + originationFee;

  // Calculate APR
  const apr = calculateAPRWithFees(input.loanAmount, finalRate, product.termMonths, totalFees);

  // Calculate monthly payment
  const monthlyPayment = calculateMonthlyPayment(input.loanAmount, finalRate, product.termMonths);

  // Calculate total interest and cost
  const totalPaid = monthlyPayment * product.termMonths;
  const totalInterest = totalPaid - input.loanAmount;
  const totalCost = totalPaid + totalFees;

  // Calculate break-even for points
  let breakEvenMonths: number | undefined;
  if (input.points && input.points > 0) {
    const paymentWithoutPoints = calculateMonthlyPayment(
      input.loanAmount,
      baseRate + creditAdjustment - grainDiscount,
      product.termMonths
    );
    const monthlySavings = paymentWithoutPoints - monthlyPayment;
    if (monthlySavings > 0) {
      breakEvenMonths = Math.ceil(pointsCost / monthlySavings);
    }
  }

  return {
    baseRate,
    creditAdjustment,
    grainDiscount,
    pointsDiscount,
    finalRate,
    apr,
    monthlyPayment,
    totalInterest,
    totalCost,
    pointsCost,
    originationFee,
    totalFees,
    ltv,
    creditTier,
    breakEvenMonths,
  };
}

/**
 * Generate rate sheet for a product
 */
export function generateRateSheet(productCode: string): RateSheet {
  const product = getProduct(productCode);
  if (!product) {
    throw new Error('Invalid product code');
  }

  const creditTiers = [
    { name: 'Excellent', minScore: 750, maxScore: 850, adjustment: -0.0050 },
    { name: 'Good', minScore: 700, maxScore: 749, adjustment: 0.0000 },
    { name: 'Fair', minScore: 650, maxScore: 699, adjustment: 0.0075 },
    { name: 'Subprime', minScore: 580, maxScore: 649, adjustment: 0.0200 },
  ];

  const rates = creditTiers.map(tier => {
    const rate = product.baseRate + tier.adjustment;
    // Assume 1% origination fee for APR calculation
    const fee = 100000 * (product.type === 'mortgage' ? 0.01 : product.type === 'auto' ? 0 : 0.02);
    const apr = calculateAPRWithFees(100000, rate, product.termMonths, fee);

    return {
      creditTier: tier.name,
      minScore: tier.minScore,
      maxScore: tier.maxScore,
      rate,
      apr,
      points: 0,
    };
  });

  return {
    productCode,
    productName: product.name,
    asOfDate: new Date(),
    rates,
  };
}

/**
 * Compare loan scenarios
 */
export function compareScenarios(scenarios: RateQuoteInput[]): {
  scenarios: (RateQuote & { label: string })[];
  bestRate: number;
  bestPayment: number;
  bestTotalCost: number;
} {
  const quotes = scenarios.map((scenario, index) => ({
    ...getRateQuote(scenario),
    label: `Scenario ${index + 1}`,
  }));

  return {
    scenarios: quotes,
    bestRate: Math.min(...quotes.map(q => q.finalRate)),
    bestPayment: Math.min(...quotes.map(q => q.monthlyPayment)),
    bestTotalCost: Math.min(...quotes.map(q => q.totalCost)),
  };
}

/**
 * Calculate bi-weekly payment option
 */
export function calculateBiWeeklyPayment(
  loanAmount: number,
  annualRate: number,
  termMonths: number
): {
  biWeeklyPayment: number;
  totalPayments: number;
  monthsSaved: number;
  interestSaved: number;
} {
  const monthlyPayment = calculateMonthlyPayment(loanAmount, annualRate, termMonths);
  const biWeeklyPayment = monthlyPayment / 2;

  // Bi-weekly means 26 payments per year (equivalent to 13 monthly payments)
  const biWeeklyRate = annualRate / 26;

  // Calculate how many bi-weekly periods to pay off
  let balance = loanAmount;
  let periods = 0;
  const maxPeriods = termMonths * 3; // Safety limit

  while (balance > 0 && periods < maxPeriods) {
    const interest = balance * biWeeklyRate;
    const principal = biWeeklyPayment - interest;
    balance -= principal;
    periods++;
  }

  const monthsSaved = termMonths - (periods / 26 * 12);
  const totalBiWeeklyPaid = biWeeklyPayment * periods;
  const totalMonthlyPaid = monthlyPayment * termMonths;
  const interestSaved = totalMonthlyPaid - totalBiWeeklyPaid;

  return {
    biWeeklyPayment,
    totalPayments: periods,
    monthsSaved: Math.round(monthsSaved),
    interestSaved,
  };
}

/**
 * Calculate refinance savings
 */
export function calculateRefinanceSavings(
  currentBalance: number,
  currentRate: number,
  currentMonthsRemaining: number,
  newRate: number,
  newTermMonths: number,
  closingCosts: number
): {
  oldPayment: number;
  newPayment: number;
  monthlySavings: number;
  totalInterestSavings: number;
  breakEvenMonths: number;
  worthIt: boolean;
} {
  const oldPayment = calculateMonthlyPayment(currentBalance, currentRate, currentMonthsRemaining);
  const newPayment = calculateMonthlyPayment(currentBalance, newRate, newTermMonths);
  const monthlySavings = oldPayment - newPayment;

  const oldTotalInterest = (oldPayment * currentMonthsRemaining) - currentBalance;
  const newTotalInterest = (newPayment * newTermMonths) - currentBalance;
  const totalInterestSavings = oldTotalInterest - newTotalInterest - closingCosts;

  const breakEvenMonths = monthlySavings > 0 ? Math.ceil(closingCosts / monthlySavings) : Infinity;
  const worthIt = breakEvenMonths < (newTermMonths * 0.5) && totalInterestSavings > 0;

  return {
    oldPayment,
    newPayment,
    monthlySavings,
    totalInterestSavings,
    breakEvenMonths,
    worthIt,
  };
}

/**
 * Helper: Calculate monthly payment
 */
function calculateMonthlyPayment(principal: number, annualRate: number, months: number): number {
  if (annualRate === 0) {
    return principal / months;
  }

  const monthlyRate = annualRate / 12;
  const payment = principal * (monthlyRate * Math.pow(1 + monthlyRate, months)) /
                 (Math.pow(1 + monthlyRate, months) - 1);

  return Math.round(payment * 100) / 100;
}

/**
 * Helper: Calculate APR with fees
 */
function calculateAPRWithFees(
  principal: number,
  rate: number,
  months: number,
  fees: number
): number {
  // Use the effective loan amount (principal - fees) but same payment
  const payment = calculateMonthlyPayment(principal, rate, months);
  const effectivePrincipal = principal - fees;

  // Solve for the rate that makes the payment work with effective principal
  // This is an approximation - proper APR calculation is iterative
  const feeRate = (fees / principal) * (12 / months);
  return rate + feeRate;
}

/**
 * Helper: Calculate origination fee
 */
function calculateOriginationFee(amount: number, productType: string): number {
  if (productType === 'mortgage') {
    return amount * 0.01; // 1%
  } else if (productType === 'auto') {
    return 0; // No origination fee
  } else {
    // Personal loans
    if (amount >= 25000) return amount * 0.01;
    if (amount >= 10000) return amount * 0.02;
    if (amount >= 5000) return amount * 0.03;
    return amount * 0.05;
  }
}

/**
 * Calculate closing costs for mortgage
 */
export function calculateClosingCosts(
  loanAmount: number,
  propertyValue: number,
  state: string
): {
  originationFee: number;
  appraisalFee: number;
  creditReportFee: number;
  titleInsurance: number;
  recordingFees: number;
  surveyFee: number;
  homeInspection: number;
  totalClosingCosts: number;
  cashToClose: number;
} {
  const originationFee = loanAmount * 0.01; // 1%
  const appraisalFee = 500;
  const creditReportFee = 50;
  const titleInsurance = propertyValue * 0.005; // 0.5%
  const recordingFees = 250;
  const surveyFee = 400;
  const homeInspection = 450;

  const totalClosingCosts =
    originationFee +
    appraisalFee +
    creditReportFee +
    titleInsurance +
    recordingFees +
    surveyFee +
    homeInspection;

  const downPayment = propertyValue - loanAmount;
  const cashToClose = downPayment + totalClosingCosts;

  return {
    originationFee,
    appraisalFee,
    creditReportFee,
    titleInsurance,
    recordingFees,
    surveyFee,
    homeInspection,
    totalClosingCosts,
    cashToClose,
  };
}

/**
 * Calculate max purchase price based on payment
 */
export function calculateMaxPurchasePrice(
  monthlyPayment: number,
  annualRate: number,
  termMonths: number,
  downPaymentPercent: number
): number {
  // Work backwards from payment to loan amount
  const monthlyRate = annualRate / 12;
  const loanAmount = monthlyPayment * (Math.pow(1 + monthlyRate, termMonths) - 1) /
                    (monthlyRate * Math.pow(1 + monthlyRate, termMonths));

  // Calculate purchase price including down payment
  const purchasePrice = loanAmount / (1 - downPaymentPercent);

  return Math.round(purchasePrice);
}

/**
 * Today's rate highlights
 */
export function getTodaysRates(): {
  mortgage30Year: number;
  mortgage15Year: number;
  autoNew: number;
  personalUnsecured: number;
  grainBacked: number;
  asOfDate: Date;
} {
  return {
    mortgage30Year: 0.0675,
    mortgage15Year: 0.0600,
    autoNew: 0.0699,
    personalUnsecured: 0.1199,
    grainBacked: 0.0000,
    asOfDate: new Date(),
  };
}
