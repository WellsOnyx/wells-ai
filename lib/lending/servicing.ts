// @ts-nocheck
/**
 * Loan Servicing System
 * Grain & Vault Personal Lending System
 */

export interface LoanPaymentAllocation {
  paymentAmount: number;
  lateFees: number;
  interest: number;
  principal: number;
  escrow: number;
  remainingBalance: number;
}

export interface LateFeeCalculation {
  daysLate: number;
  gracePeriodDays: number;
  isLate: boolean;
  lateFeeAmount: number;
  lateFeePercent: number;
  totalDue: number;
}

export interface DelinquencyStatus {
  status: 'current' | 'grace' | '30_days' | '60_days' | '90_days' | '120_plus' | 'default';
  daysDelinquent: number;
  missedPayments: number;
  totalPastDue: number;
  nextAction: string;
  actionDate: Date;
}

/**
 * Allocate payment (waterfall method: fees → interest → principal → escrow)
 */
export function allocatePayment(
  paymentAmount: number,
  outstandingLateFees: number,
  accruedInterest: number,
  principalBalance: number,
  escrowDue: number = 0
): LoanPaymentAllocation {
  let remaining = paymentAmount;

  // 1. Apply to late fees first
  const lateFees = Math.min(remaining, outstandingLateFees);
  remaining -= lateFees;

  // 2. Apply to interest
  const interest = Math.min(remaining, accruedInterest);
  remaining -= interest;

  // 3. Apply to principal
  const principal = Math.min(remaining, principalBalance);
  remaining -= principal;

  // 4. Apply to escrow
  const escrow = Math.min(remaining, escrowDue);
  remaining -= escrow;

  const remainingBalance = principalBalance - principal;

  return {
    paymentAmount,
    lateFees: Math.round(lateFees * 100) / 100,
    interest: Math.round(interest * 100) / 100,
    principal: Math.round(principal * 100) / 100,
    escrow: Math.round(escrow * 100) / 100,
    remainingBalance: Math.round(remainingBalance * 100) / 100,
  };
}

/**
 * Calculate late fee
 */
export function calculateLateFee(
  paymentAmount: number,
  dueDate: Date,
  currentDate: Date = new Date(),
  gracePeriodDays: number = 15,
  lateFeePercent: number = 0.05, // 5%
  maxLateFee: number = 50
): LateFeeCalculation {
  const daysLate = Math.floor(
    (currentDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  const isLate = daysLate > gracePeriodDays;

  let lateFeeAmount = 0;
  if (isLate) {
    lateFeeAmount = Math.min(paymentAmount * lateFeePercent, maxLateFee);
  }

  return {
    daysLate: Math.max(0, daysLate),
    gracePeriodDays,
    isLate,
    lateFeeAmount: Math.round(lateFeeAmount * 100) / 100,
    lateFeePercent,
    totalDue: Math.round((paymentAmount + lateFeeAmount) * 100) / 100,
  };
}

/**
 * Determine delinquency status
 */
export function getDelinquencyStatus(
  lastPaymentDate: Date,
  nextPaymentDueDate: Date,
  monthlyPayment: number,
  currentDate: Date = new Date()
): DelinquencyStatus {
  const daysSinceLastPayment = Math.floor(
    (currentDate.getTime() - lastPaymentDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  const daysPastDue = Math.floor(
    (currentDate.getTime() - nextPaymentDueDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  let status: DelinquencyStatus['status'];
  let nextAction: string;
  let actionDate: Date;

  if (daysPastDue < 0) {
    status = 'current';
    nextAction = 'None - account is current';
    actionDate = nextPaymentDueDate;
  } else if (daysPastDue <= 15) {
    status = 'grace';
    nextAction = 'Payment reminder sent';
    actionDate = new Date(nextPaymentDueDate);
    actionDate.setDate(actionDate.getDate() + 15);
  } else if (daysPastDue <= 30) {
    status = '30_days';
    nextAction = 'First collection notice';
    actionDate = new Date(nextPaymentDueDate);
    actionDate.setDate(actionDate.getDate() + 30);
  } else if (daysPastDue <= 60) {
    status = '60_days';
    nextAction = 'Second collection notice + phone call';
    actionDate = new Date(nextPaymentDueDate);
    actionDate.setDate(actionDate.getDate() + 60);
  } else if (daysPastDue <= 90) {
    status = '90_days';
    nextAction = 'Final notice before acceleration';
    actionDate = new Date(nextPaymentDueDate);
    actionDate.setDate(actionDate.getDate() + 90);
  } else if (daysPastDue <= 120) {
    status = '120_plus';
    nextAction = 'Loan acceleration notice';
    actionDate = new Date(nextPaymentDueDate);
    actionDate.setDate(actionDate.getDate() + 120);
  } else {
    status = 'default';
    nextAction = 'Foreclosure/Repossession proceedings';
    actionDate = new Date();
  }

  const missedPayments = Math.floor(daysPastDue / 30);
  const totalPastDue = missedPayments * monthlyPayment;

  return {
    status,
    daysDelinquent: Math.max(0, daysPastDue),
    missedPayments: Math.max(0, missedPayments),
    totalPastDue: Math.round(totalPastDue * 100) / 100,
    nextAction,
    actionDate,
  };
}

/**
 * Calculate escrow analysis
 */
export function performEscrowAnalysis(
  currentBalance: number,
  projectedAnnualTax: number,
  projectedAnnualInsurance: number,
  monthlyEscrowPayment: number,
  monthsAnalyzed: number = 12
): {
  projectedBalance: number;
  projectedShortage: number;
  projectedSurplus: number;
  recommendedMonthlyPayment: number;
  adjustmentAmount: number;
  analysis: {
    totalDeposits: number;
    totalDisbursements: number;
    lowestBalance: number;
    highestBalance: number;
  };
} {
  const monthlyTax = projectedAnnualTax / 12;
  const monthlyInsurance = projectedAnnualInsurance / 12;

  let balance = currentBalance;
  let lowestBalance = balance;
  let highestBalance = balance;

  const totalDeposits = monthlyEscrowPayment * monthsAnalyzed;
  const totalDisbursements = projectedAnnualTax + projectedAnnualInsurance;

  // Simulate 12 months
  for (let month = 1; month <= monthsAnalyzed; month++) {
    balance += monthlyEscrowPayment;

    // Tax disbursements (typically semi-annual)
    if (month === 6 || month === 12) {
      balance -= projectedAnnualTax / 2;
    }

    // Insurance disbursement (typically annual)
    if (month === 12) {
      balance -= projectedAnnualInsurance;
    }

    lowestBalance = Math.min(lowestBalance, balance);
    highestBalance = Math.max(highestBalance, balance);
  }

  const projectedBalance = balance;
  const cushion = monthlyEscrowPayment * 2; // 2-month cushion required
  const targetBalance = cushion;

  const shortage = Math.max(0, targetBalance - projectedBalance);
  const surplus = Math.max(0, projectedBalance - targetBalance - cushion);

  // Calculate new monthly payment
  const requiredMonthly = (projectedAnnualTax + projectedAnnualInsurance) / 12;
  const cushionMonthly = cushion / 12;
  const shortageMonthly = shortage / 12;

  const recommendedMonthlyPayment = requiredMonthly + cushionMonthly + shortageMonthly;
  const adjustmentAmount = recommendedMonthlyPayment - monthlyEscrowPayment;

  return {
    projectedBalance: Math.round(projectedBalance * 100) / 100,
    projectedShortage: Math.round(shortage * 100) / 100,
    projectedSurplus: Math.round(surplus * 100) / 100,
    recommendedMonthlyPayment: Math.round(recommendedMonthlyPayment * 100) / 100,
    adjustmentAmount: Math.round(adjustmentAmount * 100) / 100,
    analysis: {
      totalDeposits: Math.round(totalDeposits * 100) / 100,
      totalDisbursements: Math.round(totalDisbursements * 100) / 100,
      lowestBalance: Math.round(lowestBalance * 100) / 100,
      highestBalance: Math.round(highestBalance * 100) / 100,
    },
  };
}

/**
 * Generate monthly statement
 */
export function generateMonthlyStatement(
  loanNumber: string,
  borrowerName: string,
  statementDate: Date,
  principalBalance: number,
  interestRate: number,
  monthlyPayment: number,
  nextDueDate: Date,
  escrowBalance: number = 0,
  ytdInterestPaid: number = 0,
  ytdPrincipalPaid: number = 0
): {
  loanNumber: string;
  borrowerName: string;
  statementDate: Date;
  principalBalance: number;
  interestRate: number;
  monthlyPayment: number;
  nextDueDate: Date;
  amountDue: number;
  escrowBalance: number;
  ytdInterestPaid: number;
  ytdPrincipalPaid: number;
  paymentBreakdown: {
    principal: number;
    interest: number;
    escrow: number;
    total: number;
  };
} {
  const monthlyInterest = (principalBalance * interestRate) / 12;
  const monthlyPrincipal = monthlyPayment - monthlyInterest;

  return {
    loanNumber,
    borrowerName,
    statementDate,
    principalBalance: Math.round(principalBalance * 100) / 100,
    interestRate,
    monthlyPayment: Math.round(monthlyPayment * 100) / 100,
    nextDueDate,
    amountDue: Math.round(monthlyPayment * 100) / 100,
    escrowBalance: Math.round(escrowBalance * 100) / 100,
    ytdInterestPaid: Math.round(ytdInterestPaid * 100) / 100,
    ytdPrincipalPaid: Math.round(ytdPrincipalPaid * 100) / 100,
    paymentBreakdown: {
      principal: Math.round(monthlyPrincipal * 100) / 100,
      interest: Math.round(monthlyInterest * 100) / 100,
      escrow: 0,
      total: Math.round(monthlyPayment * 100) / 100,
    },
  };
}

/**
 * Calculate payoff quote with per-diem interest
 */
export function generatePayoffStatement(
  principalBalance: number,
  annualRate: number,
  lastPaymentDate: Date,
  payoffDate: Date = new Date()
): {
  principalBalance: number;
  interestRate: number;
  lastPaymentDate: Date;
  payoffDate: Date;
  daysSinceLastPayment: number;
  perDiemInterest: number;
  accruedInterest: number;
  payoffAmount: number;
  goodThroughDate: Date;
} {
  const dailyRate = annualRate / 365;
  const daysSinceLastPayment = Math.floor(
    (payoffDate.getTime() - lastPaymentDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  const perDiemInterest = principalBalance * dailyRate;
  const accruedInterest = perDiemInterest * daysSinceLastPayment;
  const payoffAmount = principalBalance + accruedInterest;

  const goodThroughDate = new Date(payoffDate);
  goodThroughDate.setDate(goodThroughDate.getDate() + 10);

  return {
    principalBalance: Math.round(principalBalance * 100) / 100,
    interestRate: annualRate,
    lastPaymentDate,
    payoffDate,
    daysSinceLastPayment,
    perDiemInterest: Math.round(perDiemInterest * 100) / 100,
    accruedInterest: Math.round(accruedInterest * 100) / 100,
    payoffAmount: Math.round(payoffAmount * 100) / 100,
    goodThroughDate,
  };
}

/**
 * Process autopay
 */
export function processAutopay(
  loanId: string,
  dueDate: Date,
  amount: number,
  paymentMethod: 'ach' | 'card',
  currentDate: Date = new Date()
): {
  shouldProcess: boolean;
  processDate: Date;
  amount: number;
  reason: string;
} {
  // Process autopay 3 days before due date
  const processDate = new Date(dueDate);
  processDate.setDate(processDate.getDate() - 3);

  const shouldProcess = currentDate >= processDate && currentDate <= dueDate;

  return {
    shouldProcess,
    processDate,
    amount: Math.round(amount * 100) / 100,
    reason: shouldProcess
      ? 'Autopay scheduled for processing'
      : currentDate < processDate
      ? 'Too early to process'
      : 'Autopay window has passed',
  };
}

/**
 * Calculate forbearance terms
 */
export function calculateForbearance(
  monthlyPayment: number,
  forbearanceMonths: number,
  principalBalance: number,
  annualRate: number,
  remainingMonths: number
): {
  pausedPayments: number;
  totalForbearanceAmount: number;
  resumptionPayment: number;
  extendedTermMonths: number;
  additionalInterest: number;
  options: {
    extendTerm: {
      newPayment: number;
      newTermMonths: number;
      additionalInterest: number;
    };
    lumpSum: {
      resumptionPayment: number;
      lumpSumDue: number;
      originalTermMonths: number;
    };
    partialPayment: {
      reducedPayment: number;
      forbearanceMonths: number;
      catchUpMonths: number;
    };
  };
} {
  const totalForbearanceAmount = monthlyPayment * forbearanceMonths;
  const monthlyRate = annualRate / 12;

  // Option 1: Extend term
  const extendedTermMonths = remainingMonths + forbearanceMonths;
  const newPayment = calculateMonthlyPayment(principalBalance, annualRate, extendedTermMonths);
  const extendedTotalPaid = newPayment * extendedTermMonths;
  const originalTotalPaid = monthlyPayment * remainingMonths;
  const additionalInterest = extendedTotalPaid - originalTotalPaid;

  // Option 2: Lump sum repayment
  const lumpSumDue = totalForbearanceAmount;

  // Option 3: Partial payments during forbearance
  const reducedPayment = monthlyPayment * 0.25; // 25% payments
  const catchUpMonths = 6; // 6 months to catch up

  return {
    pausedPayments: forbearanceMonths,
    totalForbearanceAmount: Math.round(totalForbearanceAmount * 100) / 100,
    resumptionPayment: Math.round(monthlyPayment * 100) / 100,
    extendedTermMonths,
    additionalInterest: Math.round(additionalInterest * 100) / 100,
    options: {
      extendTerm: {
        newPayment: Math.round(newPayment * 100) / 100,
        newTermMonths: extendedTermMonths,
        additionalInterest: Math.round(additionalInterest * 100) / 100,
      },
      lumpSum: {
        resumptionPayment: Math.round(monthlyPayment * 100) / 100,
        lumpSumDue: Math.round(lumpSumDue * 100) / 100,
        originalTermMonths: remainingMonths,
      },
      partialPayment: {
        reducedPayment: Math.round(reducedPayment * 100) / 100,
        forbearanceMonths,
        catchUpMonths,
      },
    },
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
