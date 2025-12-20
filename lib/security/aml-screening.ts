/**
 * AML (Anti-Money Laundering) and OFAC Sanctions Screening Service
 * For Grain & Vault treasury operations
 *
 * Compliance with:
 * - Bank Secrecy Act (BSA)
 * - USA PATRIOT Act
 * - OFAC Sanctions Programs
 * - FinCEN Regulations
 */

import { sql } from '@vercel/postgres';

// ============================================================================
// TYPES
// ============================================================================

export interface UserData {
  id: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  country: string;
  citizenship?: string;
  email: string;
  phone?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  employmentStatus?: string;
  occupation?: string;
  annualIncomeRange?: string;
  netWorthRange?: string;
  sourceOfFunds?: string;
  sourceOfFundsDetail?: string;
  pepStatus?: boolean;
  pepDetails?: string;
}

export interface Transaction {
  id: string;
  userId: string;
  type: 'deposit' | 'withdraw' | 'buy_grain' | 'sell_grain' | 'transfer_in' | 'transfer_out';
  amount: number;
  currency: string;
  paymentMethod?: string;
  sourceAccount?: string;
  destinationAccount?: string;
  description?: string;
  createdAt: Date;
}

export interface ScreeningResult {
  passed: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'blocked';
  riskScore: number;
  flags: ScreeningFlag[];
  action: 'approve' | 'review' | 'block' | 'report';
  ofacMatch: boolean;
  ofacMatchDetails?: OFACMatchDetail[];
  requiresManualReview: boolean;
  requiresCTR: boolean; // Currency Transaction Report
  requiresSAR: boolean; // Suspicious Activity Report
  screeningId: string;
  timestamp: Date;
}

export interface ScreeningFlag {
  code: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  details?: Record<string, unknown>;
}

export interface OFACMatchDetail {
  listType: 'SDN' | 'CONSOLIDATED' | 'SSI' | 'FSE';
  matchScore: number;
  matchedName: string;
  matchedProgram?: string;
  entityType?: string;
  remarks?: string;
}

export interface TransactionPattern {
  userId: string;
  totalAmount24h: number;
  transactionCount24h: number;
  totalAmount7d: number;
  transactionCount7d: number;
  totalAmount30d: number;
  transactionCount30d: number;
  avgTransactionAmount: number;
  largestTransaction: number;
  recentTransactions: Transaction[];
}

// ============================================================================
// COUNTRY RISK CLASSIFICATIONS (FATF)
// ============================================================================

// Blocked countries - No transactions allowed
const BLOCKED_COUNTRIES = new Set([
  'IR', // Iran
  'KP', // North Korea (DPRK)
  'SY', // Syria
  'CU', // Cuba (OFAC)
  'RU', // Russia (OFAC comprehensive sanctions)
]);

// High-risk countries requiring enhanced due diligence (FATF Grey/Black List)
const HIGH_RISK_COUNTRIES = new Set([
  'MM', // Myanmar
  'PK', // Pakistan
  'YE', // Yemen
  'VE', // Venezuela
  'AF', // Afghanistan
  'IQ', // Iraq
  'LY', // Libya
  'SD', // Sudan
  'SS', // South Sudan
  'SO', // Somalia
  'LB', // Lebanon
  'BY', // Belarus
  'ZW', // Zimbabwe
  'NI', // Nicaragua
  'NG', // Nigeria (elevated monitoring)
  'KH', // Cambodia
  'ML', // Mali
  'BF', // Burkina Faso
  'HT', // Haiti
  'TZ', // Tanzania (monitoring)
  'JM', // Jamaica (monitoring)
  'AL', // Albania
  'BA', // Bosnia Herzegovina
  'UG', // Uganda
  'CF', // Central African Republic
  'CD', // Democratic Republic of Congo
]);

// Enhanced monitoring countries
const ENHANCED_MONITORING_COUNTRIES = new Set([
  'CN', // China - PRC
  'AE', // UAE
  'SG', // Singapore (tax considerations)
  'PA', // Panama
  'BS', // Bahamas
  'KY', // Cayman Islands
  'VG', // British Virgin Islands
  'BZ', // Belize
  'LI', // Liechtenstein
  'MC', // Monaco
  'AD', // Andorra
  'JE', // Jersey
  'GG', // Guernsey
  'IM', // Isle of Man
  'VU', // Vanuatu
  'WS', // Samoa
  'MH', // Marshall Islands
  'SC', // Seychelles
  'MU', // Mauritius
]);

// ============================================================================
// THRESHOLDS
// ============================================================================

const AML_THRESHOLDS = {
  // Currency Transaction Report threshold
  CTR_THRESHOLD: 10000,

  // Suspicious Activity Report thresholds
  SAR_THRESHOLD: 5000,

  // Structuring detection (multiple transactions just under CTR)
  STRUCTURING_THRESHOLD: 8000,
  STRUCTURING_WINDOW_HOURS: 24,
  STRUCTURING_COUNT: 3,

  // Velocity limits
  MAX_DAILY_TRANSACTIONS: 10,
  MAX_DAILY_AMOUNT: 50000,
  MAX_WEEKLY_AMOUNT: 100000,
  MAX_MONTHLY_AMOUNT: 250000,

  // Rapid succession thresholds
  RAPID_SUCCESSION_WINDOW_MINUTES: 60,
  RAPID_SUCCESSION_COUNT: 5,

  // Risk score thresholds
  LOW_RISK_MAX: 30,
  MEDIUM_RISK_MAX: 60,
  HIGH_RISK_MAX: 85,

  // PEP additional monitoring
  PEP_ENHANCED_REVIEW_THRESHOLD: 5000,
};

// ============================================================================
// MOCK OFAC SDN LIST (In production, use commercial API)
// ============================================================================

interface SDNEntry {
  name: string;
  aliases: string[];
  type: 'individual' | 'entity';
  program: string;
  country?: string;
  dateOfBirth?: string;
  remarks?: string;
}

// Sample SDN entries for testing (real list has 12,000+ entries)
const MOCK_SDN_LIST: SDNEntry[] = [
  {
    name: 'BANK MELLI IRAN',
    aliases: ['BMI', 'NATIONAL BANK OF IRAN'],
    type: 'entity',
    program: 'IRAN',
    country: 'IR',
  },
  {
    name: 'KOREA KWANGSON BANKING CORP',
    aliases: ['KKBC'],
    type: 'entity',
    program: 'DPRK',
    country: 'KP',
  },
  {
    name: 'COMMERCIAL BANK OF SYRIA',
    aliases: ['CBS'],
    type: 'entity',
    program: 'SYRIA',
    country: 'SY',
  },
  // Add more as needed for testing
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Normalize name for matching (remove special chars, lowercase, etc.)
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculate string similarity (Levenshtein-based)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = normalizeName(str1);
  const s2 = normalizeName(str2);

  if (s1 === s2) return 100;
  if (s1.length === 0 || s2.length === 0) return 0;

  // Check if one contains the other
  if (s1.includes(s2) || s2.includes(s1)) {
    return 85;
  }

  // Levenshtein distance
  const matrix: number[][] = [];

  for (let i = 0; i <= s1.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= s2.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  const distance = matrix[s1.length][s2.length];
  const maxLength = Math.max(s1.length, s2.length);

  return Math.round((1 - distance / maxLength) * 100);
}

/**
 * Generate unique screening ID
 */
function generateScreeningId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `AML-${timestamp}-${random}`.toUpperCase();
}

// ============================================================================
// CORE SCREENING FUNCTIONS
// ============================================================================

/**
 * Check name against OFAC SDN list
 */
export async function checkOFACList(
  name: string,
  country?: string
): Promise<{ match: boolean; matches: OFACMatchDetail[] }> {
  const matches: OFACMatchDetail[] = [];
  const normalizedName = normalizeName(name);

  // Check against mock SDN list
  // In production, call ComplyAdvantage, Dow Jones, or Treasury API
  for (const entry of MOCK_SDN_LIST) {
    // Check main name
    const mainSimilarity = calculateSimilarity(name, entry.name);
    if (mainSimilarity >= 80) {
      matches.push({
        listType: 'SDN',
        matchScore: mainSimilarity,
        matchedName: entry.name,
        matchedProgram: entry.program,
        entityType: entry.type,
        remarks: entry.remarks,
      });
      continue;
    }

    // Check aliases
    for (const alias of entry.aliases) {
      const aliasSimilarity = calculateSimilarity(name, alias);
      if (aliasSimilarity >= 85) {
        matches.push({
          listType: 'SDN',
          matchScore: aliasSimilarity,
          matchedName: `${entry.name} (alias: ${alias})`,
          matchedProgram: entry.program,
          entityType: entry.type,
          remarks: entry.remarks,
        });
        break;
      }
    }
  }

  // Optional: Call external AML provider
  if (process.env.AML_PROVIDER_API_KEY) {
    try {
      const externalMatches = await checkExternalAMLProvider(name, country);
      matches.push(...externalMatches);
    } catch (error) {
      console.error('External AML provider check failed:', error);
      // Continue with internal checks
    }
  }

  return {
    match: matches.length > 0,
    matches,
  };
}

/**
 * Call external AML provider (ComplyAdvantage, etc.)
 */
async function checkExternalAMLProvider(
  name: string,
  country?: string
): Promise<OFACMatchDetail[]> {
  // Placeholder for external API integration
  // Example: ComplyAdvantage, Dow Jones Risk & Compliance

  const apiKey = process.env.AML_PROVIDER_API_KEY;
  if (!apiKey) return [];

  // This would be the actual API call
  // const response = await fetch('https://api.complyadvantage.com/searches', {
  //   method: 'POST',
  //   headers: {
  //     'Authorization': `Token ${apiKey}`,
  //     'Content-Type': 'application/json',
  //   },
  //   body: JSON.stringify({
  //     search_term: name,
  //     filters: {
  //       types: ['sanction', 'pep', 'adverse-media'],
  //       countries: country ? [country] : undefined,
  //     },
  //   }),
  // });

  return [];
}

/**
 * Calculate user risk score based on multiple factors
 */
export async function calculateRiskScore(user: UserData): Promise<{
  score: number;
  factors: { factor: string; points: number; reason: string }[];
}> {
  const factors: { factor: string; points: number; reason: string }[] = [];
  let score = 0;

  // 1. Country risk (0-40 points)
  const countryCode = user.country?.toUpperCase() || user.address?.country?.toUpperCase() || 'US';

  if (BLOCKED_COUNTRIES.has(countryCode)) {
    factors.push({
      factor: 'country_blocked',
      points: 100,
      reason: `Country ${countryCode} is on blocked list`,
    });
    score += 100; // Immediate max risk
  } else if (HIGH_RISK_COUNTRIES.has(countryCode)) {
    factors.push({
      factor: 'country_high_risk',
      points: 35,
      reason: `Country ${countryCode} is FATF grey/black listed`,
    });
    score += 35;
  } else if (ENHANCED_MONITORING_COUNTRIES.has(countryCode)) {
    factors.push({
      factor: 'country_enhanced_monitoring',
      points: 15,
      reason: `Country ${countryCode} requires enhanced monitoring`,
    });
    score += 15;
  }

  // 2. PEP status (0-25 points)
  if (user.pepStatus) {
    factors.push({
      factor: 'pep_status',
      points: 25,
      reason: 'User is a Politically Exposed Person',
    });
    score += 25;
  }

  // 3. Source of funds risk (0-20 points)
  const highRiskSources = ['inheritance', 'gift', 'other'];
  if (user.sourceOfFunds && highRiskSources.includes(user.sourceOfFunds)) {
    factors.push({
      factor: 'source_of_funds',
      points: 15,
      reason: `Source of funds (${user.sourceOfFunds}) requires verification`,
    });
    score += 15;
  }

  // 4. Missing information (0-15 points)
  const missingFields = [];
  if (!user.dateOfBirth) missingFields.push('date of birth');
  if (!user.address?.line1) missingFields.push('address');
  if (!user.phone) missingFields.push('phone');

  if (missingFields.length > 0) {
    const points = Math.min(missingFields.length * 5, 15);
    factors.push({
      factor: 'incomplete_profile',
      points,
      reason: `Missing: ${missingFields.join(', ')}`,
    });
    score += points;
  }

  // 5. High income/net worth (0-10 points) - requires enhanced verification
  if (user.annualIncomeRange === '1m_plus' || user.netWorthRange === '5m_plus') {
    factors.push({
      factor: 'high_net_worth',
      points: 10,
      reason: 'High net worth individual requires enhanced due diligence',
    });
    score += 10;
  }

  // 6. Occupation risk (0-10 points)
  const highRiskOccupations = [
    'politician', 'government', 'military', 'casino', 'gambling',
    'crypto', 'money service', 'msb', 'pawn', 'precious metals', 'jeweler',
  ];
  if (user.occupation) {
    const occupationLower = user.occupation.toLowerCase();
    if (highRiskOccupations.some(occ => occupationLower.includes(occ))) {
      factors.push({
        factor: 'high_risk_occupation',
        points: 10,
        reason: `Occupation "${user.occupation}" is high-risk`,
      });
      score += 10;
    }
  }

  // Cap at 100
  score = Math.min(score, 100);

  return { score, factors };
}

/**
 * Get transaction patterns for a user
 */
async function getTransactionPatterns(userId: string): Promise<TransactionPattern> {
  try {
    // Get transaction summary
    const result = await sql`
      SELECT
        COALESCE(SUM(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN usd_amount ELSE 0 END), 0) as total_24h,
        COALESCE(COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END), 0) as count_24h,
        COALESCE(SUM(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN usd_amount ELSE 0 END), 0) as total_7d,
        COALESCE(COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END), 0) as count_7d,
        COALESCE(SUM(CASE WHEN created_at > NOW() - INTERVAL '30 days' THEN usd_amount ELSE 0 END), 0) as total_30d,
        COALESCE(COUNT(CASE WHEN created_at > NOW() - INTERVAL '30 days' THEN 1 END), 0) as count_30d,
        COALESCE(AVG(usd_amount), 0) as avg_amount,
        COALESCE(MAX(usd_amount), 0) as max_amount
      FROM grain_transactions
      WHERE account_id = ${userId}
        AND status = 'completed'
    `;

    const summary = result.rows[0] || {};

    // Get recent transactions
    const recentResult = await sql`
      SELECT id, type, usd_amount as amount, 'USD' as currency, created_at
      FROM grain_transactions
      WHERE account_id = ${userId}
        AND created_at > NOW() - INTERVAL '24 hours'
      ORDER BY created_at DESC
      LIMIT 20
    `;

    return {
      userId,
      totalAmount24h: parseFloat(summary.total_24h) || 0,
      transactionCount24h: parseInt(summary.count_24h) || 0,
      totalAmount7d: parseFloat(summary.total_7d) || 0,
      transactionCount7d: parseInt(summary.count_7d) || 0,
      totalAmount30d: parseFloat(summary.total_30d) || 0,
      transactionCount30d: parseInt(summary.count_30d) || 0,
      avgTransactionAmount: parseFloat(summary.avg_amount) || 0,
      largestTransaction: parseFloat(summary.max_amount) || 0,
      recentTransactions: recentResult.rows.map(r => ({
        id: r.id,
        userId,
        type: r.type,
        amount: parseFloat(r.amount),
        currency: r.currency,
        createdAt: new Date(r.created_at),
      })) as Transaction[],
    };
  } catch (error) {
    console.error('Error fetching transaction patterns:', error);
    return {
      userId,
      totalAmount24h: 0,
      transactionCount24h: 0,
      totalAmount7d: 0,
      transactionCount7d: 0,
      totalAmount30d: 0,
      transactionCount30d: 0,
      avgTransactionAmount: 0,
      largestTransaction: 0,
      recentTransactions: [],
    };
  }
}

/**
 * Detect structuring patterns (smurfing)
 */
function detectStructuring(patterns: TransactionPattern): ScreeningFlag | null {
  const recentTransactions = patterns.recentTransactions;

  // Look for multiple transactions just under CTR threshold
  const structuringCandidates = recentTransactions.filter(
    tx => tx.amount >= AML_THRESHOLDS.STRUCTURING_THRESHOLD &&
          tx.amount < AML_THRESHOLDS.CTR_THRESHOLD
  );

  if (structuringCandidates.length >= AML_THRESHOLDS.STRUCTURING_COUNT) {
    const totalAmount = structuringCandidates.reduce((sum, tx) => sum + tx.amount, 0);
    return {
      code: 'STRUCTURING_DETECTED',
      severity: 'critical',
      message: `Potential structuring detected: ${structuringCandidates.length} transactions totaling $${totalAmount.toFixed(2)} just under CTR threshold`,
      details: {
        transactionCount: structuringCandidates.length,
        totalAmount,
        transactionIds: structuringCandidates.map(tx => tx.id),
      },
    };
  }

  return null;
}

/**
 * Detect rapid succession withdrawals
 */
function detectRapidSuccession(patterns: TransactionPattern): ScreeningFlag | null {
  const withdrawals = patterns.recentTransactions.filter(
    tx => tx.type === 'withdraw' || tx.type === 'sell_grain'
  );

  // Check for rapid succession within window
  const windowMs = AML_THRESHOLDS.RAPID_SUCCESSION_WINDOW_MINUTES * 60 * 1000;
  const now = Date.now();

  const recentWithdrawals = withdrawals.filter(
    tx => now - tx.createdAt.getTime() < windowMs
  );

  if (recentWithdrawals.length >= AML_THRESHOLDS.RAPID_SUCCESSION_COUNT) {
    const totalAmount = recentWithdrawals.reduce((sum, tx) => sum + tx.amount, 0);
    return {
      code: 'RAPID_SUCCESSION',
      severity: 'warning',
      message: `Rapid succession detected: ${recentWithdrawals.length} withdrawals within ${AML_THRESHOLDS.RAPID_SUCCESSION_WINDOW_MINUTES} minutes`,
      details: {
        transactionCount: recentWithdrawals.length,
        totalAmount,
        windowMinutes: AML_THRESHOLDS.RAPID_SUCCESSION_WINDOW_MINUTES,
      },
    };
  }

  return null;
}

/**
 * Screen a user against all AML checks
 */
export async function screenUser(userData: UserData): Promise<ScreeningResult> {
  const screeningId = generateScreeningId();
  const flags: ScreeningFlag[] = [];
  let requiresManualReview = false;
  let ofacMatch = false;
  let ofacMatchDetails: OFACMatchDetail[] = [];

  // 1. OFAC/Sanctions check
  const ofacResult = await checkOFACList(userData.fullName, userData.country);
  if (ofacResult.match) {
    ofacMatch = true;
    ofacMatchDetails = ofacResult.matches;
    flags.push({
      code: 'OFAC_MATCH',
      severity: 'critical',
      message: `OFAC/Sanctions list match detected`,
      details: { matches: ofacResult.matches },
    });
  }

  // 2. Country check
  const countryCode = userData.country?.toUpperCase();
  if (countryCode && BLOCKED_COUNTRIES.has(countryCode)) {
    flags.push({
      code: 'BLOCKED_COUNTRY',
      severity: 'critical',
      message: `User from blocked country: ${countryCode}`,
    });
  } else if (countryCode && HIGH_RISK_COUNTRIES.has(countryCode)) {
    flags.push({
      code: 'HIGH_RISK_COUNTRY',
      severity: 'warning',
      message: `User from high-risk country: ${countryCode}`,
    });
    requiresManualReview = true;
  }

  // 3. PEP check
  if (userData.pepStatus) {
    flags.push({
      code: 'PEP_STATUS',
      severity: 'warning',
      message: 'User is a Politically Exposed Person',
      details: { pepDetails: userData.pepDetails },
    });
    requiresManualReview = true;
  }

  // 4. Calculate risk score
  const { score: riskScore, factors } = await calculateRiskScore(userData);

  // Add risk factors as info flags
  for (const factor of factors) {
    if (factor.points >= 15) {
      flags.push({
        code: factor.factor.toUpperCase(),
        severity: factor.points >= 25 ? 'warning' : 'info',
        message: factor.reason,
      });
    }
  }

  // 5. Get transaction patterns (for existing users)
  let patterns: TransactionPattern | null = null;
  try {
    patterns = await getTransactionPatterns(userData.id);

    // Check structuring
    const structuringFlag = detectStructuring(patterns);
    if (structuringFlag) {
      flags.push(structuringFlag);
      requiresManualReview = true;
    }

    // Check rapid succession
    const rapidFlag = detectRapidSuccession(patterns);
    if (rapidFlag) {
      flags.push(rapidFlag);
    }
  } catch (error) {
    // New user, no transaction history
  }

  // Determine risk level and action
  let riskLevel: 'low' | 'medium' | 'high' | 'blocked';
  let action: 'approve' | 'review' | 'block' | 'report';

  const hasCriticalFlag = flags.some(f => f.severity === 'critical');

  if (ofacMatch || hasCriticalFlag) {
    riskLevel = 'blocked';
    action = 'report';
  } else if (riskScore > AML_THRESHOLDS.HIGH_RISK_MAX) {
    riskLevel = 'high';
    action = 'block';
  } else if (riskScore > AML_THRESHOLDS.MEDIUM_RISK_MAX || requiresManualReview) {
    riskLevel = 'medium';
    action = 'review';
  } else if (riskScore > AML_THRESHOLDS.LOW_RISK_MAX) {
    riskLevel = 'medium';
    action = 'review';
  } else {
    riskLevel = 'low';
    action = 'approve';
  }

  const result: ScreeningResult = {
    passed: action === 'approve',
    riskLevel,
    riskScore,
    flags,
    action,
    ofacMatch,
    ofacMatchDetails,
    requiresManualReview,
    requiresCTR: false,
    requiresSAR: ofacMatch || hasCriticalFlag,
    screeningId,
    timestamp: new Date(),
  };

  // Log the screening result
  await logScreeningResult(userData.id, 'user', result);

  // Send alert if needed
  if (action === 'report' || action === 'block') {
    await sendAMLAlert(userData, result);
  }

  return result;
}

/**
 * Screen a transaction
 */
export async function screenTransaction(transaction: Transaction): Promise<ScreeningResult> {
  const screeningId = generateScreeningId();
  const flags: ScreeningFlag[] = [];
  let requiresManualReview = false;
  let requiresCTR = false;
  let requiresSAR = false;

  // 1. CTR threshold check
  if (transaction.amount >= AML_THRESHOLDS.CTR_THRESHOLD) {
    requiresCTR = true;
    flags.push({
      code: 'CTR_REQUIRED',
      severity: 'info',
      message: `Transaction exceeds CTR threshold ($${AML_THRESHOLDS.CTR_THRESHOLD})`,
      details: { amount: transaction.amount, threshold: AML_THRESHOLDS.CTR_THRESHOLD },
    });
  }

  // 2. Get user's transaction patterns
  const patterns = await getTransactionPatterns(transaction.userId);

  // 3. Check for structuring
  const structuringFlag = detectStructuring(patterns);
  if (structuringFlag) {
    flags.push(structuringFlag);
    requiresManualReview = true;
    requiresSAR = true;
  }

  // 4. Check rapid succession
  const rapidFlag = detectRapidSuccession(patterns);
  if (rapidFlag) {
    flags.push(rapidFlag);
    requiresManualReview = true;
  }

  // 5. Daily limit check
  const newDailyTotal = patterns.totalAmount24h + transaction.amount;
  if (newDailyTotal > AML_THRESHOLDS.MAX_DAILY_AMOUNT) {
    flags.push({
      code: 'DAILY_LIMIT_EXCEEDED',
      severity: 'warning',
      message: `Daily transaction limit would be exceeded ($${newDailyTotal.toFixed(2)} > $${AML_THRESHOLDS.MAX_DAILY_AMOUNT})`,
    });
    requiresManualReview = true;
  }

  // 6. Transaction count check
  if (patterns.transactionCount24h >= AML_THRESHOLDS.MAX_DAILY_TRANSACTIONS) {
    flags.push({
      code: 'TRANSACTION_COUNT_EXCEEDED',
      severity: 'warning',
      message: `Maximum daily transactions reached (${patterns.transactionCount24h})`,
    });
    requiresManualReview = true;
  }

  // 7. Unusual amount check (3x average)
  if (patterns.avgTransactionAmount > 0 &&
      transaction.amount > patterns.avgTransactionAmount * 3) {
    flags.push({
      code: 'UNUSUAL_AMOUNT',
      severity: 'info',
      message: `Transaction amount is significantly above user's average ($${transaction.amount} vs avg $${patterns.avgTransactionAmount.toFixed(2)})`,
    });
  }

  // 8. Large withdrawal check
  if ((transaction.type === 'withdraw' || transaction.type === 'sell_grain') &&
      transaction.amount >= AML_THRESHOLDS.SAR_THRESHOLD) {
    flags.push({
      code: 'LARGE_WITHDRAWAL',
      severity: 'info',
      message: `Large withdrawal of $${transaction.amount}`,
    });
  }

  // Calculate risk score for transaction
  let riskScore = 0;

  if (requiresCTR) riskScore += 10;
  if (structuringFlag) riskScore += 40;
  if (rapidFlag) riskScore += 20;
  if (newDailyTotal > AML_THRESHOLDS.MAX_DAILY_AMOUNT) riskScore += 25;
  if (transaction.amount > patterns.avgTransactionAmount * 3) riskScore += 15;

  riskScore = Math.min(riskScore, 100);

  // Determine action
  let riskLevel: 'low' | 'medium' | 'high' | 'blocked';
  let action: 'approve' | 'review' | 'block' | 'report';

  const hasCriticalFlag = flags.some(f => f.severity === 'critical');

  if (hasCriticalFlag) {
    riskLevel = 'blocked';
    action = 'block';
  } else if (riskScore > AML_THRESHOLDS.HIGH_RISK_MAX) {
    riskLevel = 'high';
    action = 'block';
  } else if (riskScore > AML_THRESHOLDS.MEDIUM_RISK_MAX || requiresManualReview) {
    riskLevel = 'medium';
    action = 'review';
  } else {
    riskLevel = 'low';
    action = 'approve';
  }

  if (requiresSAR) {
    action = 'report';
  }

  const result: ScreeningResult = {
    passed: action === 'approve',
    riskLevel,
    riskScore,
    flags,
    action,
    ofacMatch: false,
    requiresManualReview,
    requiresCTR,
    requiresSAR,
    screeningId,
    timestamp: new Date(),
  };

  // Log the screening result
  await logScreeningResult(transaction.userId, 'transaction', result, transaction.id);

  return result;
}

// ============================================================================
// DATABASE LOGGING
// ============================================================================

/**
 * Log screening result to database
 */
async function logScreeningResult(
  userId: string,
  screeningType: 'user' | 'transaction',
  result: ScreeningResult,
  transactionId?: string
): Promise<void> {
  try {
    await sql`
      INSERT INTO aml_screening_results (
        screening_id,
        user_id,
        transaction_id,
        screening_type,
        passed,
        risk_level,
        risk_score,
        action,
        ofac_match,
        ofac_match_details,
        flags,
        requires_manual_review,
        requires_ctr,
        requires_sar,
        created_at
      ) VALUES (
        ${result.screeningId},
        ${userId},
        ${transactionId || null},
        ${screeningType},
        ${result.passed},
        ${result.riskLevel},
        ${result.riskScore},
        ${result.action},
        ${result.ofacMatch},
        ${JSON.stringify(result.ofacMatchDetails || [])},
        ${JSON.stringify(result.flags)},
        ${result.requiresManualReview},
        ${result.requiresCTR},
        ${result.requiresSAR},
        ${result.timestamp.toISOString()}
      )
    `;
  } catch (error) {
    console.error('Error logging screening result:', error);
    // Don't throw - logging failure shouldn't block screening
  }
}

/**
 * Create AML alert for compliance team
 */
async function createAMLAlert(
  userId: string,
  screeningId: string,
  alertType: 'sanctions_match' | 'high_risk' | 'structuring' | 'sar_required' | 'manual_review',
  severity: 'low' | 'medium' | 'high' | 'critical',
  details: Record<string, unknown>
): Promise<string> {
  try {
    const result = await sql`
      INSERT INTO aml_alerts (
        user_id,
        screening_id,
        alert_type,
        severity,
        status,
        details,
        created_at
      ) VALUES (
        ${userId},
        ${screeningId},
        ${alertType},
        ${severity},
        'pending',
        ${JSON.stringify(details)},
        NOW()
      )
      RETURNING id
    `;

    return result.rows[0].id;
  } catch (error) {
    console.error('Error creating AML alert:', error);
    throw error;
  }
}

/**
 * Send AML alert via email
 */
async function sendAMLAlert(
  userData: UserData,
  result: ScreeningResult
): Promise<void> {
  const alertEmail = process.env.AML_ALERT_EMAIL;

  if (!alertEmail) {
    console.warn('AML_ALERT_EMAIL not configured');
    return;
  }

  // Create alert in database
  const alertType = result.ofacMatch ? 'sanctions_match' :
                    result.requiresSAR ? 'sar_required' :
                    'high_risk';

  const severity = result.ofacMatch ? 'critical' :
                   result.action === 'block' ? 'high' :
                   'medium';

  await createAMLAlert(userData.id, result.screeningId, alertType, severity, {
    userName: userData.fullName,
    userEmail: userData.email,
    country: userData.country,
    riskScore: result.riskScore,
    flags: result.flags,
    ofacMatchDetails: result.ofacMatchDetails,
  });

  // In production, send email via SendGrid/Postmark/etc.
  console.log(`[AML ALERT] ${alertType} - User: ${userData.fullName} (${userData.email})`);
  console.log(`  Risk Score: ${result.riskScore}`);
  console.log(`  Action: ${result.action}`);
  console.log(`  Flags: ${result.flags.map(f => f.code).join(', ')}`);

  // Example email integration:
  // await sendEmail({
  //   to: alertEmail,
  //   subject: `[URGENT] AML Alert: ${alertType} - ${userData.fullName}`,
  //   body: formatAMLAlertEmail(userData, result),
  // });
}

// ============================================================================
// COMPLIANCE REPORT FUNCTIONS
// ============================================================================

/**
 * Generate Currency Transaction Report (CTR)
 */
export async function generateCTR(
  transactionId: string,
  userId: string
): Promise<{ reportId: string; filingStatus: string }> {
  try {
    const result = await sql`
      INSERT INTO aml_ctr_reports (
        transaction_id,
        user_id,
        status,
        created_at
      ) VALUES (
        ${transactionId},
        ${userId},
        'pending',
        NOW()
      )
      RETURNING id
    `;

    return {
      reportId: result.rows[0].id,
      filingStatus: 'pending',
    };
  } catch (error) {
    console.error('Error generating CTR:', error);
    throw error;
  }
}

/**
 * Generate Suspicious Activity Report (SAR)
 */
export async function generateSAR(
  userId: string,
  screeningId: string,
  suspiciousActivity: string,
  details: Record<string, unknown>
): Promise<{ reportId: string; filingStatus: string }> {
  try {
    const result = await sql`
      INSERT INTO aml_sar_reports (
        user_id,
        screening_id,
        suspicious_activity,
        details,
        status,
        created_at
      ) VALUES (
        ${userId},
        ${screeningId},
        ${suspiciousActivity},
        ${JSON.stringify(details)},
        'pending',
        NOW()
      )
      RETURNING id
    `;

    return {
      reportId: result.rows[0].id,
      filingStatus: 'pending',
    };
  } catch (error) {
    console.error('Error generating SAR:', error);
    throw error;
  }
}

// ============================================================================
// ADMIN FUNCTIONS
// ============================================================================

/**
 * Get pending AML alerts
 */
export async function getPendingAlerts(limit = 50): Promise<unknown[]> {
  try {
    const result = await sql`
      SELECT
        a.*,
        u.full_name as user_name,
        u.email as user_email
      FROM aml_alerts a
      LEFT JOIN grain_user_profiles u ON a.user_id = u.user_id
      WHERE a.status = 'pending'
      ORDER BY
        CASE a.severity
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          ELSE 4
        END,
        a.created_at DESC
      LIMIT ${limit}
    `;

    return result.rows;
  } catch (error) {
    console.error('Error fetching pending alerts:', error);
    return [];
  }
}

/**
 * Resolve an AML alert
 */
export async function resolveAlert(
  alertId: string,
  resolution: 'approved' | 'rejected' | 'escalated',
  notes: string,
  reviewerId: string
): Promise<void> {
  try {
    await sql`
      UPDATE aml_alerts
      SET
        status = 'resolved',
        resolution = ${resolution},
        resolution_notes = ${notes},
        reviewed_by = ${reviewerId},
        reviewed_at = NOW()
      WHERE id = ${alertId}
    `;
  } catch (error) {
    console.error('Error resolving alert:', error);
    throw error;
  }
}

/**
 * Get user's AML history
 */
export async function getUserAMLHistory(userId: string): Promise<{
  screenings: unknown[];
  alerts: unknown[];
  riskScore: number;
}> {
  try {
    const [screenings, alerts] = await Promise.all([
      sql`
        SELECT * FROM aml_screening_results
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT 20
      `,
      sql`
        SELECT * FROM aml_alerts
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT 20
      `,
    ]);

    // Calculate current risk score from most recent screening
    const latestScreening = screenings.rows[0];

    return {
      screenings: screenings.rows,
      alerts: alerts.rows,
      riskScore: latestScreening?.risk_score || 0,
    };
  } catch (error) {
    console.error('Error fetching user AML history:', error);
    return { screenings: [], alerts: [], riskScore: 0 };
  }
}

/**
 * Batch screen multiple users (for periodic re-screening)
 */
export async function batchScreenUsers(userIds: string[]): Promise<{
  total: number;
  passed: number;
  flagged: number;
  blocked: number;
}> {
  let passed = 0;
  let flagged = 0;
  let blocked = 0;

  for (const userId of userIds) {
    try {
      // Fetch user data
      const userResult = await sql`
        SELECT * FROM grain_user_profiles WHERE user_id = ${userId}
      `;

      if (userResult.rows.length === 0) continue;

      const user = userResult.rows[0];
      const userData: UserData = {
        id: user.user_id,
        fullName: user.full_name,
        firstName: user.first_name,
        lastName: user.last_name,
        dateOfBirth: user.date_of_birth,
        country: user.country,
        email: user.email,
        phone: user.phone,
        address: {
          line1: user.address_line1,
          city: user.city,
          state: user.state,
          zipCode: user.zip_code,
          country: user.country,
        },
        employmentStatus: user.employment_status,
        occupation: user.occupation,
        sourceOfFunds: user.source_of_funds,
        pepStatus: user.pep_status,
      };

      const result = await screenUser(userData);

      if (result.action === 'approve') passed++;
      else if (result.action === 'block' || result.action === 'report') blocked++;
      else flagged++;

      // Update user's AML risk score
      await sql`
        UPDATE grain_user_profiles
        SET
          aml_risk_score = ${result.riskScore},
          sanctions_check_date = NOW(),
          sanctions_check_result = ${result.ofacMatch ? 'match' : 'clear'}
        WHERE user_id = ${userId}
      `;
    } catch (error) {
      console.error(`Error screening user ${userId}:`, error);
    }
  }

  return {
    total: userIds.length,
    passed,
    flagged,
    blocked,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

// Re-export constants for named imports
export {
  BLOCKED_COUNTRIES,
  HIGH_RISK_COUNTRIES,
  ENHANCED_MONITORING_COUNTRIES,
  AML_THRESHOLDS,
};
