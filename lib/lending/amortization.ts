// @ts-nocheck
/**
 * Loan Amortization Calculator
 * Grain & Vault Personal Lending System
 */

export interface AmortizationEntry {
  paymentNumber: number;
  dueDate: Date;
  paymentAmount: number;
  principal: number;
  interest: number;
  remainingBalance: number;
  cumulativePrincipal: number;
  cumulativeInterest: number;
}

export interface AmortizationSchedule {
  loanAmount: number;
  interestRate: number;
  termMonths: number;
  monthlyPayment: number;
  firstPaymentDate: Date;
  schedule: AmortizationEntry[];
  summary: {
    totalPayments: number;
    totalInterest: number;
    totalPrincipal: number;
    averageMonthlyInterest: number;
  };
}

/**
 * Generate standard amortization schedule
 */
export function generateAmortizationSchedule(
  loanAmount: number,
  annualRate: number,
  termMonths: number,
  firstPaymentDate: Date = new Date()
): AmortizationSchedule {
  const monthlyRate = annualRate / 12;
  const monthlyPayment = calculateMonthlyPayment(loanAmount, annualRate, termMonths);

  const schedule: AmortizationEntry[] = [];
  let remainingBalance = loanAmount;
  let cumulativePrincipal = 0;
  let cumulativeInterest = 0;

  for (let i = 1; i <= termMonths; i++) {
    const interestPayment = remainingBalance * monthlyRate;
    const principalPayment = monthlyPayment - interestPayment;

    cumulativePrincipal += principalPayment;
    cumulativeInterest += interestPayment;
    remainingBalance -= principalPayment;

    // Handle rounding on final payment
    if (i === termMonths) {
      remainingBalance = 0;
    }

    const dueDate = new Date(firstPaymentDate);
    dueDate.setMonth(dueDate.getMonth() + i);

    schedule.push({
      paymentNumber: i,
      dueDate,
      paymentAmount: monthlyPayment,
      principal: Math.round(principalPayment * 100) / 100,
      interest: Math.round(interestPayment * 100) / 100,
      remainingBalance: Math.max(0, Math.round(remainingBalance * 100) / 100),
      cumulativePrincipal: Math.round(cumulativePrincipal * 100) / 100,
      cumulativeInterest: Math.round(cumulativeInterest * 100) / 100,
    });
  }

  return {
    loanAmount,
    interestRate: annualRate,
    termMonths,
    monthlyPayment,
    firstPaymentDate,
    schedule,
    summary: {
      totalPayments: monthlyPayment * termMonths,
      totalInterest: cumulativeInterest,
      totalPrincipal: loanAmount,
      averageMonthlyInterest: cumulativeInterest / termMonths,
    },
  };
}

/**
 * Calculate payoff quote
 */
export function calculatePayoffQuote(
  currentBalance: number,
  annualRate: number,
  payoffDate: Date,
  lastPaymentDate: Date
): {
  principalBalance: number;
  accruedInterest: number;
  payoffAmount: number;
  perDiemInterest: number;
  goodThroughDate: Date;
} {
  const dailyRate = annualRate / 365;
  const daysSincePayment = Math.floor(
    (payoffDate.getTime() - lastPaymentDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  const accruedInterest = currentBalance * dailyRate * daysSincePayment;
  const payoffAmount = currentBalance + accruedInterest;
  const perDiemInterest = currentBalance * dailyRate;

  const goodThroughDate = new Date(payoffDate);
  goodThroughDate.setDate(goodThroughDate.getDate() + 10);

  return {
    principalBalance: Math.round(currentBalance * 100) / 100,
    accruedInterest: Math.round(accruedInterest * 100) / 100,
    payoffAmount: Math.round(payoffAmount * 100) / 100,
    perDiemInterest: Math.round(perDiemInterest * 100) / 100,
    goodThroughDate,
  };
}

/**
 * Calculate impact of extra payments
 */
export function calculateExtraPaymentImpact(
  loanAmount: number,
  annualRate: number,
  termMonths: number,
  extraMonthlyPayment: number
): {
  originalSchedule: {
    monthlyPayment: number;
    totalInterest: number;
    totalCost: number;
  };
  withExtraPayments: {
    monthlyPayment: number;
    totalInterest: number;
    totalCost: number;
    monthsSaved: number;
    interestSaved: number;
    payoffDate: Date;
  };
} {
  const monthlyRate = annualRate / 12;
  const monthlyPayment = calculateMonthlyPayment(loanAmount, annualRate, termMonths);

  // Original schedule
  const originalTotalCost = monthlyPayment * termMonths;
  const originalTotalInterest = originalTotalCost - loanAmount;

  // With extra payments
  let balance = loanAmount;
  let totalPaid = 0;
  let monthsPaid = 0;
  const maxMonths = termMonths * 2; // Safety limit

  while (balance > 0 && monthsPaid < maxMonths) {
    const interest = balance * monthlyRate;
    const principal = Math.min(monthlyPayment + extraMonthlyPayment - interest, balance);
    balance -= principal;
    totalPaid += interest + principal;
    monthsPaid++;
  }

  const totalInterestWithExtra = totalPaid - loanAmount;
  const monthsSaved = termMonths - monthsPaid;
  const interestSaved = originalTotalInterest - totalInterestWithExtra;

  const payoffDate = new Date();
  payoffDate.setMonth(payoffDate.getMonth() + monthsPaid);

  return {
    originalSchedule: {
      monthlyPayment,
      totalInterest: Math.round(originalTotalInterest * 100) / 100,
      totalCost: Math.round(originalTotalCost * 100) / 100,
    },
    withExtraPayments: {
      monthlyPayment: monthlyPayment + extraMonthlyPayment,
      totalInterest: Math.round(totalInterestWithExtra * 100) / 100,
      totalCost: Math.round(totalPaid * 100) / 100,
      monthsSaved,
      interestSaved: Math.round(interestSaved * 100) / 100,
      payoffDate,
    },
  };
}

/**
 * Calculate one-time lump sum payment impact
 */
export function calculateLumpSumImpact(
  currentBalance: number,
  annualRate: number,
  monthsRemaining: number,
  lumpSumAmount: number,
  applyTo: 'reduce_balance' | 'reduce_term'
): {
  original: {
    balance: number;
    monthlyPayment: number;
    monthsRemaining: number;
    totalInterest: number;
  };
  afterLumpSum: {
    balance: number;
    monthlyPayment: number;
    monthsRemaining: number;
    totalInterest: number;
  };
  savings: {
    interestSaved: number;
    monthsSaved: number;
  };
} {
  const monthlyPayment = calculateMonthlyPayment(currentBalance, annualRate, monthsRemaining);
  const originalTotalPaid = monthlyPayment * monthsRemaining;
  const originalTotalInterest = originalTotalPaid - currentBalance;

  const newBalance = currentBalance - lumpSumAmount;

  let newMonthlyPayment: number;
  let newMonthsRemaining: number;
  let newTotalInterest: number;

  if (applyTo === 'reduce_balance') {
    // Keep same term, reduce payment
    newMonthlyPayment = calculateMonthlyPayment(newBalance, annualRate, monthsRemaining);
    newMonthsRemaining = monthsRemaining;
    const totalPaid = newMonthlyPayment * newMonthsRemaining;
    newTotalInterest = totalPaid - newBalance;
  } else {
    // Keep same payment, reduce term
    newMonthlyPayment = monthlyPayment;
    const monthlyRate = annualRate / 12;

    // Calculate new term
    let balance = newBalance;
    let months = 0;
    const maxMonths = monthsRemaining;

    while (balance > 0 && months < maxMonths) {
      const interest = balance * monthlyRate;
      const principal = Math.min(monthlyPayment - interest, balance);
      balance -= principal;
      months++;
    }

    newMonthsRemaining = months;
    const totalPaid = monthlyPayment * newMonthsRemaining;
    newTotalInterest = totalPaid - newBalance;
  }

  return {
    original: {
      balance: currentBalance,
      monthlyPayment,
      monthsRemaining,
      totalInterest: Math.round(originalTotalInterest * 100) / 100,
    },
    afterLumpSum: {
      balance: newBalance,
      monthlyPayment: Math.round(newMonthlyPayment * 100) / 100,
      monthsRemaining: newMonthsRemaining,
      totalInterest: Math.round(newTotalInterest * 100) / 100,
    },
    savings: {
      interestSaved: Math.round((originalTotalInterest - newTotalInterest) * 100) / 100,
      monthsSaved: monthsRemaining - newMonthsRemaining,
    },
  };
}

/**
 * Calculate interest-only payment period
 */
export function calculateInterestOnlySchedule(
  loanAmount: number,
  annualRate: number,
  interestOnlyMonths: number,
  amortizationMonths: number
): {
  interestOnlyPayment: number;
  regularPayment: number;
  totalInterestOnlyPaid: number;
  totalPaid: number;
  totalInterest: number;
  schedule: {
    phase: 'interest_only' | 'amortizing';
    monthlyPayment: number;
    months: number;
  }[];
} {
  const monthlyRate = annualRate / 12;
  const interestOnlyPayment = loanAmount * monthlyRate;
  const regularPayment = calculateMonthlyPayment(loanAmount, annualRate, amortizationMonths);

  const totalInterestOnlyPaid = interestOnlyPayment * interestOnlyMonths;
  const totalAmortizingPaid = regularPayment * amortizationMonths;
  const totalPaid = totalInterestOnlyPaid + totalAmortizingPaid;
  const totalInterest = totalPaid - loanAmount;

  return {
    interestOnlyPayment: Math.round(interestOnlyPayment * 100) / 100,
    regularPayment: Math.round(regularPayment * 100) / 100,
    totalInterestOnlyPaid: Math.round(totalInterestOnlyPaid * 100) / 100,
    totalPaid: Math.round(totalPaid * 100) / 100,
    totalInterest: Math.round(totalInterest * 100) / 100,
    schedule: [
      {
        phase: 'interest_only',
        monthlyPayment: Math.round(interestOnlyPayment * 100) / 100,
        months: interestOnlyMonths,
      },
      {
        phase: 'amortizing',
        monthlyPayment: Math.round(regularPayment * 100) / 100,
        months: amortizationMonths,
      },
    ],
  };
}

/**
 * Calculate balloon payment loan
 */
export function calculateBalloonPayment(
  loanAmount: number,
  annualRate: number,
  paymentTermMonths: number,
  balloonTermMonths: number
): {
  monthlyPayment: number;
  balloonPayment: number;
  totalInterest: number;
  totalCost: number;
} {
  // Calculate payment as if it's a longer term
  const monthlyPayment = calculateMonthlyPayment(loanAmount, annualRate, paymentTermMonths);
  const monthlyRate = annualRate / 12;

  // Calculate remaining balance after balloon term
  let balance = loanAmount;
  for (let i = 0; i < balloonTermMonths; i++) {
    const interest = balance * monthlyRate;
    const principal = monthlyPayment - interest;
    balance -= principal;
  }

  const balloonPayment = Math.max(0, balance);
  const totalPaid = (monthlyPayment * balloonTermMonths) + balloonPayment;
  const totalInterest = totalPaid - loanAmount;

  return {
    monthlyPayment: Math.round(monthlyPayment * 100) / 100,
    balloonPayment: Math.round(balloonPayment * 100) / 100,
    totalInterest: Math.round(totalInterest * 100) / 100,
    totalCost: Math.round(totalPaid * 100) / 100,
  };
}

/**
 * Compare payment frequencies
 */
export function comparePaymentFrequencies(
  loanAmount: number,
  annualRate: number,
  termMonths: number
): {
  monthly: { payment: number; totalPaid: number; totalInterest: number };
  biWeekly: { payment: number; totalPayments: number; totalPaid: number; totalInterest: number; monthsSaved: number };
  weekly: { payment: number; totalPayments: number; totalPaid: number; totalInterest: number; monthsSaved: number };
} {
  const monthlyPayment = calculateMonthlyPayment(loanAmount, annualRate, termMonths);
  const monthlyTotalPaid = monthlyPayment * termMonths;
  const monthlyTotalInterest = monthlyTotalPaid - loanAmount;

  // Bi-weekly (26 payments/year)
  const biWeeklyPayment = monthlyPayment / 2;
  const biWeeklyResult = calculatePayoffWithFrequency(loanAmount, annualRate, biWeeklyPayment, 26);

  // Weekly (52 payments/year)
  const weeklyPayment = monthlyPayment / 4;
  const weeklyResult = calculatePayoffWithFrequency(loanAmount, annualRate, weeklyPayment, 52);

  return {
    monthly: {
      payment: Math.round(monthlyPayment * 100) / 100,
      totalPaid: Math.round(monthlyTotalPaid * 100) / 100,
      totalInterest: Math.round(monthlyTotalInterest * 100) / 100,
    },
    biWeekly: {
      payment: Math.round(biWeeklyPayment * 100) / 100,
      totalPayments: biWeeklyResult.totalPayments,
      totalPaid: Math.round(biWeeklyResult.totalPaid * 100) / 100,
      totalInterest: Math.round(biWeeklyResult.totalInterest * 100) / 100,
      monthsSaved: Math.round(termMonths - (biWeeklyResult.totalPayments / 26 * 12)),
    },
    weekly: {
      payment: Math.round(weeklyPayment * 100) / 100,
      totalPayments: weeklyResult.totalPayments,
      totalPaid: Math.round(weeklyResult.totalPaid * 100) / 100,
      totalInterest: Math.round(weeklyResult.totalInterest * 100) / 100,
      monthsSaved: Math.round(termMonths - (weeklyResult.totalPayments / 52 * 12)),
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

/**
 * Helper: Calculate payoff with custom frequency
 */
function calculatePayoffWithFrequency(
  loanAmount: number,
  annualRate: number,
  paymentAmount: number,
  paymentsPerYear: number
): {
  totalPayments: number;
  totalPaid: number;
  totalInterest: number;
} {
  const periodRate = annualRate / paymentsPerYear;
  let balance = loanAmount;
  let payments = 0;
  const maxPayments = 1000; // Safety limit

  while (balance > 0 && payments < maxPayments) {
    const interest = balance * periodRate;
    const principal = Math.min(paymentAmount - interest, balance);
    balance -= principal;
    payments++;
  }

  const totalPaid = paymentAmount * payments;
  const totalInterest = totalPaid - loanAmount;

  return {
    totalPayments: payments,
    totalPaid,
    totalInterest,
  };
}

/**
 * Get principal vs interest breakdown by year
 */
export function getAnnualBreakdown(schedule: AmortizationEntry[]): {
  year: number;
  principalPaid: number;
  interestPaid: number;
  endingBalance: number;
}[] {
  const breakdown: Map<number, { principal: number; interest: number; balance: number }> = new Map();

  schedule.forEach(entry => {
    const year = entry.dueDate.getFullYear();

    if (!breakdown.has(year)) {
      breakdown.set(year, { principal: 0, interest: 0, balance: 0 });
    }

    const yearData = breakdown.get(year)!;
    yearData.principal += entry.principal;
    yearData.interest += entry.interest;
    yearData.balance = entry.remainingBalance;
  });

  return Array.from(breakdown.entries()).map(([year, data]) => ({
    year,
    principalPaid: Math.round(data.principal * 100) / 100,
    interestPaid: Math.round(data.interest * 100) / 100,
    endingBalance: Math.round(data.balance * 100) / 100,
  }));
}
