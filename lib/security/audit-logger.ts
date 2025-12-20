/**
 * Grain & Vault Audit Logging Service
 *
 * Comprehensive, immutable audit logging for regulatory compliance.
 *
 * Compliance with:
 * - SOC 2 Type II (Security, Availability, Confidentiality)
 * - PCI DSS (Payment Card Industry Data Security Standard)
 * - Bank Secrecy Act (BSA)
 * - FINRA (Financial Industry Regulatory Authority)
 * - GDPR Article 30 (Records of Processing Activities)
 *
 * Retention: 7 years per financial regulations
 */

import { sql } from '@vercel/postgres';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// TYPES
// ============================================================================

export type AuditEventType =
  // Authentication Events
  | 'auth.login.success'
  | 'auth.login.failed'
  | 'auth.logout'
  | 'auth.mfa.enabled'
  | 'auth.mfa.disabled'
  | 'auth.mfa.challenge'
  | 'auth.mfa.verified'
  | 'auth.mfa.failed'
  | 'auth.password.changed'
  | 'auth.password.reset.requested'
  | 'auth.password.reset.completed'
  | 'auth.session.created'
  | 'auth.session.expired'
  | 'auth.session.revoked'
  // KYC Events
  | 'kyc.verification.started'
  | 'kyc.verification.submitted'
  | 'kyc.verification.approved'
  | 'kyc.verification.rejected'
  | 'kyc.verification.expired'
  | 'kyc.document.uploaded'
  | 'kyc.document.verified'
  | 'kyc.document.rejected'
  | 'kyc.level.upgraded'
  | 'kyc.level.downgraded'
  | 'kyc.pep.detected'
  | 'kyc.sanctions.match'
  // Financial Events
  | 'financial.deposit.initiated'
  | 'financial.deposit.completed'
  | 'financial.deposit.failed'
  | 'financial.withdrawal.initiated'
  | 'financial.withdrawal.completed'
  | 'financial.withdrawal.failed'
  | 'financial.transfer.initiated'
  | 'financial.transfer.completed'
  | 'financial.transfer.failed'
  | 'financial.grain.purchased'
  | 'financial.grain.sold'
  | 'financial.payment.sent'
  | 'financial.payment.received'
  // Balance Events
  | 'balance.credit.applied'
  | 'balance.debit.applied'
  | 'balance.adjustment.manual'
  | 'balance.freeze.applied'
  | 'balance.freeze.removed'
  // Admin Events
  | 'admin.user.created'
  | 'admin.user.suspended'
  | 'admin.user.activated'
  | 'admin.user.deleted'
  | 'admin.limits.modified'
  | 'admin.role.assigned'
  | 'admin.role.revoked'
  | 'admin.override.applied'
  | 'admin.bulk.operation'
  // Data Access Events
  | 'data.pii.viewed'
  | 'data.pii.exported'
  | 'data.report.generated'
  | 'data.bulk.query'
  | 'data.api.access'
  // Configuration Events
  | 'config.system.changed'
  | 'config.feature.enabled'
  | 'config.feature.disabled'
  | 'config.limits.updated'
  | 'config.fees.updated'
  // Security Events
  | 'security.alert.triggered'
  | 'security.block.applied'
  | 'security.suspicious.activity'
  | 'security.rate.limit.exceeded'
  | 'security.ip.blocked';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type AuditResult = 'success' | 'failure' | 'partial' | 'blocked';

export interface AuditEventDetails {
  // Common fields
  description?: string;
  reason?: string;
  errorCode?: string;
  errorMessage?: string;

  // Financial fields
  amount?: number;
  currency?: string;
  transactionId?: string;
  paymentMethod?: string;
  accountNumber?: string; // Masked

  // KYC fields
  verificationType?: string;
  documentType?: string;
  verificationLevel?: number;
  previousLevel?: number;

  // Data access fields
  dataType?: string;
  recordCount?: number;
  query?: string; // Sanitized

  // Configuration fields
  configKey?: string;
  oldValue?: unknown;
  newValue?: unknown;

  // Admin fields
  targetRole?: string;
  overrideReason?: string;
  bulkOperationType?: string;
  affectedRecords?: number;

  // Security fields
  alertType?: string;
  suspiciousIndicators?: string[];
  ruleTriggered?: string;

  // Any additional context
  [key: string]: unknown;
}

export interface AuditEvent {
  id?: string;
  eventType: AuditEventType;
  actorId: string; // User performing the action
  actorType: 'user' | 'admin' | 'system' | 'api';
  targetUserId?: string; // User being affected (if different from actor)
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  details: AuditEventDetails;
  result: AuditResult;
  riskLevel: RiskLevel;
  timestamp?: Date;
  requestId?: string; // For tracing across services
  metadata?: Record<string, unknown>;
}

export interface AuditLogEntry extends AuditEvent {
  id: string;
  timestamp: Date;
  createdAt: Date;
  hash: string; // For immutability verification
  previousHash?: string; // Chain verification
}

export interface AuditTrailOptions {
  startDate?: Date;
  endDate?: Date;
  eventTypes?: AuditEventType[];
  riskLevels?: RiskLevel[];
  results?: AuditResult[];
  limit?: number;
  offset?: number;
  orderBy?: 'asc' | 'desc';
}

export interface AuditSearchQuery {
  userId?: string;
  actorId?: string;
  eventType?: AuditEventType | AuditEventType[];
  riskLevel?: RiskLevel | RiskLevel[];
  result?: AuditResult | AuditResult[];
  ipAddress?: string;
  startDate?: Date;
  endDate?: Date;
  searchText?: string; // Search in details JSON
  transactionId?: string;
  sessionId?: string;
  limit?: number;
  offset?: number;
}

export interface AuditExportOptions {
  startDate: Date;
  endDate: Date;
  format?: 'json' | 'csv' | 'xml';
  eventTypes?: AuditEventType[];
  userId?: string;
  includeDetails?: boolean;
}

export interface SuspiciousPattern {
  patternType: string;
  userId: string;
  description: string;
  occurrences: number;
  timeWindow: string;
  riskScore: number;
  details: Record<string, unknown>;
}

export interface AlertConfig {
  patternType: string;
  threshold: number;
  timeWindowMinutes: number;
  riskLevel: RiskLevel;
  notifyChannels: ('email' | 'sms' | 'slack' | 'webhook')[];
  enabled: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const RETENTION_YEARS = 7;
const HASH_ALGORITHM = 'SHA-256';

// Alert configurations for suspicious patterns
const ALERT_CONFIGS: AlertConfig[] = [
  {
    patternType: 'failed_logins',
    threshold: 5,
    timeWindowMinutes: 15,
    riskLevel: 'high',
    notifyChannels: ['email', 'slack'],
    enabled: true
  },
  {
    patternType: 'large_withdrawal',
    threshold: 1,
    timeWindowMinutes: 1440, // 24 hours
    riskLevel: 'high',
    notifyChannels: ['email', 'sms', 'slack'],
    enabled: true
  },
  {
    patternType: 'rapid_transactions',
    threshold: 10,
    timeWindowMinutes: 60,
    riskLevel: 'medium',
    notifyChannels: ['slack'],
    enabled: true
  },
  {
    patternType: 'pii_bulk_access',
    threshold: 100,
    timeWindowMinutes: 60,
    riskLevel: 'critical',
    notifyChannels: ['email', 'sms', 'slack', 'webhook'],
    enabled: true
  },
  {
    patternType: 'unusual_hours_activity',
    threshold: 5,
    timeWindowMinutes: 60,
    riskLevel: 'medium',
    notifyChannels: ['email'],
    enabled: true
  },
  {
    patternType: 'new_device_high_value',
    threshold: 1,
    timeWindowMinutes: 1440,
    riskLevel: 'high',
    notifyChannels: ['email', 'sms'],
    enabled: true
  }
];

// Large withdrawal threshold (in USD)
const LARGE_WITHDRAWAL_THRESHOLD = 10000;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate a cryptographic hash for audit log entry immutability
 */
async function generateHash(data: string, previousHash?: string): Promise<string> {
  const content = previousHash ? `${previousHash}:${data}` : data;
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest(HASH_ALGORITHM, dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Determine risk level based on event type and details
 */
function determineRiskLevel(
  eventType: AuditEventType,
  details: AuditEventDetails,
  result: AuditResult
): RiskLevel {
  // Critical events
  if (
    eventType === 'kyc.sanctions.match' ||
    eventType === 'security.alert.triggered' ||
    eventType.includes('admin.') ||
    eventType === 'data.pii.exported'
  ) {
    return 'critical';
  }

  // High risk events
  if (
    eventType === 'auth.login.failed' ||
    eventType === 'kyc.pep.detected' ||
    eventType === 'security.suspicious.activity' ||
    eventType === 'security.block.applied' ||
    (eventType.includes('withdrawal') && (details.amount || 0) >= LARGE_WITHDRAWAL_THRESHOLD)
  ) {
    return 'high';
  }

  // Medium risk events
  if (
    eventType.includes('financial.') ||
    eventType === 'auth.password.changed' ||
    eventType === 'kyc.level.upgraded' ||
    eventType === 'data.pii.viewed' ||
    result === 'failure'
  ) {
    return 'medium';
  }

  // Low risk for everything else
  return 'low';
}

/**
 * Mask sensitive data in audit details
 */
function maskSensitiveData(details: AuditEventDetails): AuditEventDetails {
  const masked = { ...details };

  // Mask account numbers (show last 4)
  if (masked.accountNumber && typeof masked.accountNumber === 'string') {
    masked.accountNumber = `****${masked.accountNumber.slice(-4)}`;
  }

  // Mask SSN (already should be last 4 only)
  if (masked.ssn && typeof masked.ssn === 'string') {
    masked.ssn = `***-**-${masked.ssn.slice(-4)}`;
  }

  // Remove any password-related fields
  delete masked.password;
  delete masked.oldPassword;
  delete masked.newPassword;

  // Remove API keys
  delete masked.apiKey;
  delete masked.secretKey;

  return masked;
}

/**
 * Get the previous log entry's hash for chaining
 */
async function getPreviousHash(): Promise<string | undefined> {
  try {
    const result = await sql`
      SELECT hash FROM grain_audit_logs
      ORDER BY created_at DESC, sequence_number DESC
      LIMIT 1
    `;
    return result.rows[0]?.hash;
  } catch {
    return undefined;
  }
}

// ============================================================================
// CORE LOGGING FUNCTIONS
// ============================================================================

/**
 * Log a single audit event
 * This is append-only for compliance - no updates or deletes allowed
 */
export async function logEvent(event: AuditEvent): Promise<AuditLogEntry> {
  const id = event.id || uuidv4();
  const timestamp = event.timestamp || new Date();

  // Auto-determine risk level if not set appropriately
  const riskLevel = event.riskLevel || determineRiskLevel(event.eventType, event.details, event.result);

  // Mask sensitive data
  const maskedDetails = maskSensitiveData(event.details);

  // Get previous hash for chain verification
  const previousHash = await getPreviousHash();

  // Create hash for this entry
  const hashContent = JSON.stringify({
    id,
    eventType: event.eventType,
    actorId: event.actorId,
    targetUserId: event.targetUserId,
    details: maskedDetails,
    result: event.result,
    riskLevel,
    timestamp: timestamp.toISOString()
  });
  const hash = await generateHash(hashContent, previousHash);

  // Insert into database (append-only)
  const result = await sql`
    INSERT INTO grain_audit_logs (
      id,
      event_type,
      actor_id,
      actor_type,
      target_user_id,
      ip_address,
      user_agent,
      session_id,
      details,
      result,
      risk_level,
      timestamp,
      request_id,
      metadata,
      hash,
      previous_hash,
      created_at
    ) VALUES (
      ${id},
      ${event.eventType},
      ${event.actorId},
      ${event.actorType},
      ${event.targetUserId || null},
      ${event.ipAddress || null},
      ${event.userAgent || null},
      ${event.sessionId || null},
      ${JSON.stringify(maskedDetails)},
      ${event.result},
      ${riskLevel},
      ${timestamp.toISOString()},
      ${event.requestId || null},
      ${JSON.stringify(event.metadata || {})},
      ${hash},
      ${previousHash || null},
      NOW()
    )
    RETURNING *
  `;

  const logEntry: AuditLogEntry = {
    id: result.rows[0].id,
    eventType: result.rows[0].event_type,
    actorId: result.rows[0].actor_id,
    actorType: result.rows[0].actor_type,
    targetUserId: result.rows[0].target_user_id,
    ipAddress: result.rows[0].ip_address,
    userAgent: result.rows[0].user_agent,
    sessionId: result.rows[0].session_id,
    details: result.rows[0].details,
    result: result.rows[0].result,
    riskLevel: result.rows[0].risk_level,
    timestamp: new Date(result.rows[0].timestamp),
    requestId: result.rows[0].request_id,
    metadata: result.rows[0].metadata,
    hash: result.rows[0].hash,
    previousHash: result.rows[0].previous_hash,
    createdAt: new Date(result.rows[0].created_at)
  };

  // Check for suspicious patterns asynchronously
  checkSuspiciousPatterns(logEntry).catch(err => {
    console.error('Error checking suspicious patterns:', err);
  });

  return logEntry;
}

/**
 * Shorthand for logging security-related events
 */
export async function logSecurityEvent(
  type: AuditEventType,
  actorId: string,
  details: AuditEventDetails,
  options?: {
    targetUserId?: string;
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
    result?: AuditResult;
    requestId?: string;
  }
): Promise<AuditLogEntry> {
  return logEvent({
    eventType: type,
    actorId,
    actorType: type.startsWith('admin.') ? 'admin' : 'user',
    targetUserId: options?.targetUserId,
    ipAddress: options?.ipAddress,
    userAgent: options?.userAgent,
    sessionId: options?.sessionId,
    details,
    result: options?.result || 'success',
    riskLevel: determineRiskLevel(type, details, options?.result || 'success'),
    requestId: options?.requestId
  });
}

/**
 * Shorthand for logging financial events
 */
export async function logFinancialEvent(
  type: AuditEventType,
  userId: string,
  amount: number,
  details: AuditEventDetails,
  options?: {
    currency?: string;
    transactionId?: string;
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
    result?: AuditResult;
    requestId?: string;
  }
): Promise<AuditLogEntry> {
  const enrichedDetails: AuditEventDetails = {
    ...details,
    amount,
    currency: options?.currency || 'USD',
    transactionId: options?.transactionId
  };

  // Determine if this is a large transaction
  const isLarge = amount >= LARGE_WITHDRAWAL_THRESHOLD;
  const riskLevel = isLarge ? 'high' : 'medium';

  return logEvent({
    eventType: type,
    actorId: userId,
    actorType: 'user',
    ipAddress: options?.ipAddress,
    userAgent: options?.userAgent,
    sessionId: options?.sessionId,
    details: enrichedDetails,
    result: options?.result || 'success',
    riskLevel,
    requestId: options?.requestId
  });
}

/**
 * Log data access events (PII viewing, exports, etc.)
 */
export async function logDataAccess(
  actorId: string,
  dataType: string,
  targetUserId: string,
  action: 'view' | 'export' | 'query',
  options?: {
    recordCount?: number;
    query?: string;
    ipAddress?: string;
    userAgent?: string;
    reason?: string;
    requestId?: string;
  }
): Promise<AuditLogEntry> {
  const eventType: AuditEventType = action === 'export'
    ? 'data.pii.exported'
    : action === 'query'
    ? 'data.bulk.query'
    : 'data.pii.viewed';

  return logEvent({
    eventType,
    actorId,
    actorType: 'user',
    targetUserId,
    ipAddress: options?.ipAddress,
    userAgent: options?.userAgent,
    details: {
      dataType,
      recordCount: options?.recordCount,
      query: options?.query?.substring(0, 500), // Truncate long queries
      reason: options?.reason
    },
    result: 'success',
    riskLevel: action === 'export' ? 'critical' : 'medium',
    requestId: options?.requestId
  });
}

/**
 * Log admin actions
 */
export async function logAdminAction(
  adminId: string,
  action: AuditEventType,
  targetUserId: string,
  details: AuditEventDetails,
  options?: {
    ipAddress?: string;
    userAgent?: string;
    overrideReason?: string;
    requestId?: string;
  }
): Promise<AuditLogEntry> {
  return logEvent({
    eventType: action,
    actorId: adminId,
    actorType: 'admin',
    targetUserId,
    ipAddress: options?.ipAddress,
    userAgent: options?.userAgent,
    details: {
      ...details,
      overrideReason: options?.overrideReason
    },
    result: 'success',
    riskLevel: 'critical',
    requestId: options?.requestId
  });
}

/**
 * Log system events (automated processes)
 */
export async function logSystemEvent(
  type: AuditEventType,
  details: AuditEventDetails,
  options?: {
    targetUserId?: string;
    result?: AuditResult;
    requestId?: string;
  }
): Promise<AuditLogEntry> {
  return logEvent({
    eventType: type,
    actorId: 'SYSTEM',
    actorType: 'system',
    targetUserId: options?.targetUserId,
    details,
    result: options?.result || 'success',
    riskLevel: determineRiskLevel(type, details, options?.result || 'success'),
    requestId: options?.requestId
  });
}

// ============================================================================
// QUERY FUNCTIONS
// ============================================================================

/**
 * Get audit trail for a specific user
 */
export async function getAuditTrail(
  userId: string,
  options: AuditTrailOptions = {}
): Promise<{ entries: AuditLogEntry[]; total: number }> {
  const {
    startDate,
    endDate,
    eventTypes,
    riskLevels,
    results,
    limit = 100,
    offset = 0,
    orderBy = 'desc'
  } = options;

  // Build query conditions
  let conditions = `WHERE (actor_id = $1 OR target_user_id = $1)`;
  const params: (string | number | Date)[] = [userId];
  let paramIndex = 2;

  if (startDate) {
    conditions += ` AND timestamp >= $${paramIndex}`;
    params.push(startDate.toISOString());
    paramIndex++;
  }

  if (endDate) {
    conditions += ` AND timestamp <= $${paramIndex}`;
    params.push(endDate.toISOString());
    paramIndex++;
  }

  if (eventTypes && eventTypes.length > 0) {
    conditions += ` AND event_type = ANY($${paramIndex})`;
    params.push(eventTypes as unknown as string);
    paramIndex++;
  }

  if (riskLevels && riskLevels.length > 0) {
    conditions += ` AND risk_level = ANY($${paramIndex})`;
    params.push(riskLevels as unknown as string);
    paramIndex++;
  }

  if (results && results.length > 0) {
    conditions += ` AND result = ANY($${paramIndex})`;
    params.push(results as unknown as string);
    paramIndex++;
  }

  // Get total count
  const countQuery = `SELECT COUNT(*) FROM grain_audit_logs ${conditions}`;
  const countResult = await sql.query(countQuery, params);
  const total = parseInt(countResult.rows[0].count, 10);

  // Get entries
  const entriesQuery = `
    SELECT * FROM grain_audit_logs
    ${conditions}
    ORDER BY timestamp ${orderBy === 'asc' ? 'ASC' : 'DESC'}
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;
  params.push(limit, offset);

  const entriesResult = await sql.query(entriesQuery, params);

  const entries: AuditLogEntry[] = entriesResult.rows.map(row => ({
    id: row.id,
    eventType: row.event_type,
    actorId: row.actor_id,
    actorType: row.actor_type,
    targetUserId: row.target_user_id,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    sessionId: row.session_id,
    details: row.details,
    result: row.result,
    riskLevel: row.risk_level,
    timestamp: new Date(row.timestamp),
    requestId: row.request_id,
    metadata: row.metadata,
    hash: row.hash,
    previousHash: row.previous_hash,
    createdAt: new Date(row.created_at)
  }));

  return { entries, total };
}

/**
 * Search audit logs with flexible criteria
 */
export async function searchAuditLogs(
  query: AuditSearchQuery
): Promise<{ entries: AuditLogEntry[]; total: number }> {
  const conditions: string[] = [];
  const params: (string | number | Date)[] = [];
  let paramIndex = 1;

  if (query.userId) {
    conditions.push(`(actor_id = $${paramIndex} OR target_user_id = $${paramIndex})`);
    params.push(query.userId);
    paramIndex++;
  }

  if (query.actorId) {
    conditions.push(`actor_id = $${paramIndex}`);
    params.push(query.actorId);
    paramIndex++;
  }

  if (query.eventType) {
    if (Array.isArray(query.eventType)) {
      conditions.push(`event_type = ANY($${paramIndex})`);
      params.push(query.eventType as unknown as string);
    } else {
      conditions.push(`event_type = $${paramIndex}`);
      params.push(query.eventType);
    }
    paramIndex++;
  }

  if (query.riskLevel) {
    if (Array.isArray(query.riskLevel)) {
      conditions.push(`risk_level = ANY($${paramIndex})`);
      params.push(query.riskLevel as unknown as string);
    } else {
      conditions.push(`risk_level = $${paramIndex}`);
      params.push(query.riskLevel);
    }
    paramIndex++;
  }

  if (query.result) {
    if (Array.isArray(query.result)) {
      conditions.push(`result = ANY($${paramIndex})`);
      params.push(query.result as unknown as string);
    } else {
      conditions.push(`result = $${paramIndex}`);
      params.push(query.result);
    }
    paramIndex++;
  }

  if (query.ipAddress) {
    conditions.push(`ip_address = $${paramIndex}`);
    params.push(query.ipAddress);
    paramIndex++;
  }

  if (query.startDate) {
    conditions.push(`timestamp >= $${paramIndex}`);
    params.push(query.startDate.toISOString());
    paramIndex++;
  }

  if (query.endDate) {
    conditions.push(`timestamp <= $${paramIndex}`);
    params.push(query.endDate.toISOString());
    paramIndex++;
  }

  if (query.transactionId) {
    conditions.push(`details->>'transactionId' = $${paramIndex}`);
    params.push(query.transactionId);
    paramIndex++;
  }

  if (query.sessionId) {
    conditions.push(`session_id = $${paramIndex}`);
    params.push(query.sessionId);
    paramIndex++;
  }

  if (query.searchText) {
    conditions.push(`details::text ILIKE $${paramIndex}`);
    params.push(`%${query.searchText}%`);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = query.limit || 100;
  const offset = query.offset || 0;

  // Get total count
  const countQuery = `SELECT COUNT(*) FROM grain_audit_logs ${whereClause}`;
  const countResult = await sql.query(countQuery, params);
  const total = parseInt(countResult.rows[0].count, 10);

  // Get entries
  const entriesQuery = `
    SELECT * FROM grain_audit_logs
    ${whereClause}
    ORDER BY timestamp DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;
  params.push(limit, offset);

  const entriesResult = await sql.query(entriesQuery, params);

  const entries: AuditLogEntry[] = entriesResult.rows.map(row => ({
    id: row.id,
    eventType: row.event_type,
    actorId: row.actor_id,
    actorType: row.actor_type,
    targetUserId: row.target_user_id,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    sessionId: row.session_id,
    details: row.details,
    result: row.result,
    riskLevel: row.risk_level,
    timestamp: new Date(row.timestamp),
    requestId: row.request_id,
    metadata: row.metadata,
    hash: row.hash,
    previousHash: row.previous_hash,
    createdAt: new Date(row.created_at)
  }));

  return { entries, total };
}

/**
 * Export audit logs for regulatory compliance
 */
export async function exportAuditLogs(
  options: AuditExportOptions
): Promise<{
  data: string;
  format: string;
  recordCount: number;
  exportedAt: Date;
  dateRange: { start: Date; end: Date };
}> {
  const { startDate, endDate, format = 'json', eventTypes, userId, includeDetails = true } = options;

  // Build query
  let conditions = `WHERE timestamp >= $1 AND timestamp <= $2`;
  const params: (string | Date)[] = [startDate.toISOString(), endDate.toISOString()];
  let paramIndex = 3;

  if (eventTypes && eventTypes.length > 0) {
    conditions += ` AND event_type = ANY($${paramIndex})`;
    params.push(eventTypes as unknown as string);
    paramIndex++;
  }

  if (userId) {
    conditions += ` AND (actor_id = $${paramIndex} OR target_user_id = $${paramIndex})`;
    params.push(userId);
    paramIndex++;
  }

  const query = `
    SELECT
      id,
      event_type,
      actor_id,
      actor_type,
      target_user_id,
      ip_address,
      ${includeDetails ? 'details,' : ''}
      result,
      risk_level,
      timestamp,
      hash
    FROM grain_audit_logs
    ${conditions}
    ORDER BY timestamp ASC
  `;

  const result = await sql.query(query, params);

  // Log this export for audit purposes
  await logSystemEvent('data.report.generated', {
    dataType: 'audit_logs',
    recordCount: result.rows.length,
    dateRange: {
      start: startDate.toISOString(),
      end: endDate.toISOString()
    },
    format,
    eventTypesFilter: eventTypes,
    userIdFilter: userId
  });

  // Format output
  let data: string;

  if (format === 'csv') {
    const headers = [
      'id', 'event_type', 'actor_id', 'actor_type', 'target_user_id',
      'ip_address', 'result', 'risk_level', 'timestamp', 'hash'
    ];
    if (includeDetails) headers.push('details');

    const rows = result.rows.map(row => {
      const values = [
        row.id,
        row.event_type,
        row.actor_id,
        row.actor_type,
        row.target_user_id || '',
        row.ip_address || '',
        row.result,
        row.risk_level,
        row.timestamp,
        row.hash
      ];
      if (includeDetails) {
        values.push(JSON.stringify(row.details).replace(/"/g, '""'));
      }
      return values.map(v => `"${v}"`).join(',');
    });

    data = [headers.join(','), ...rows].join('\n');
  } else if (format === 'xml') {
    const xmlRows = result.rows.map(row => {
      return `
    <entry>
      <id>${row.id}</id>
      <eventType>${row.event_type}</eventType>
      <actorId>${row.actor_id}</actorId>
      <actorType>${row.actor_type}</actorType>
      <targetUserId>${row.target_user_id || ''}</targetUserId>
      <ipAddress>${row.ip_address || ''}</ipAddress>
      <result>${row.result}</result>
      <riskLevel>${row.risk_level}</riskLevel>
      <timestamp>${row.timestamp}</timestamp>
      <hash>${row.hash}</hash>
      ${includeDetails ? `<details><![CDATA[${JSON.stringify(row.details)}]]></details>` : ''}
    </entry>`;
    });

    data = `<?xml version="1.0" encoding="UTF-8"?>
<auditLog exportedAt="${new Date().toISOString()}" recordCount="${result.rows.length}">
  <dateRange>
    <start>${startDate.toISOString()}</start>
    <end>${endDate.toISOString()}</end>
  </dateRange>
  <entries>${xmlRows.join('')}
  </entries>
</auditLog>`;
  } else {
    // JSON format
    data = JSON.stringify({
      exportedAt: new Date().toISOString(),
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      recordCount: result.rows.length,
      entries: result.rows.map(row => ({
        id: row.id,
        eventType: row.event_type,
        actorId: row.actor_id,
        actorType: row.actor_type,
        targetUserId: row.target_user_id,
        ipAddress: row.ip_address,
        details: includeDetails ? row.details : undefined,
        result: row.result,
        riskLevel: row.risk_level,
        timestamp: row.timestamp,
        hash: row.hash
      }))
    }, null, 2);
  }

  return {
    data,
    format,
    recordCount: result.rows.length,
    exportedAt: new Date(),
    dateRange: { start: startDate, end: endDate }
  };
}

// ============================================================================
// SUSPICIOUS PATTERN DETECTION
// ============================================================================

/**
 * Check for suspicious patterns after each log entry
 */
async function checkSuspiciousPatterns(entry: AuditLogEntry): Promise<void> {
  const patterns: SuspiciousPattern[] = [];

  // Check for multiple failed logins
  if (entry.eventType === 'auth.login.failed') {
    const failedLogins = await getRecentFailedLogins(entry.actorId, 15);
    const config = ALERT_CONFIGS.find(c => c.patternType === 'failed_logins');

    if (config?.enabled && failedLogins >= config.threshold) {
      patterns.push({
        patternType: 'failed_logins',
        userId: entry.actorId,
        description: `${failedLogins} failed login attempts in last 15 minutes`,
        occurrences: failedLogins,
        timeWindow: '15 minutes',
        riskScore: 80,
        details: { ipAddress: entry.ipAddress, userAgent: entry.userAgent }
      });
    }
  }

  // Check for large withdrawals
  if (entry.eventType.includes('withdrawal') && entry.result === 'success') {
    const amount = entry.details.amount as number || 0;
    if (amount >= LARGE_WITHDRAWAL_THRESHOLD) {
      patterns.push({
        patternType: 'large_withdrawal',
        userId: entry.actorId,
        description: `Large withdrawal of $${amount.toLocaleString()}`,
        occurrences: 1,
        timeWindow: 'immediate',
        riskScore: 70,
        details: { amount, transactionId: entry.details.transactionId }
      });
    }
  }

  // Check for rapid transactions
  if (entry.eventType.startsWith('financial.')) {
    const recentTransactions = await getRecentTransactionCount(entry.actorId, 60);
    const config = ALERT_CONFIGS.find(c => c.patternType === 'rapid_transactions');

    if (config?.enabled && recentTransactions >= config.threshold) {
      patterns.push({
        patternType: 'rapid_transactions',
        userId: entry.actorId,
        description: `${recentTransactions} transactions in last hour`,
        occurrences: recentTransactions,
        timeWindow: '60 minutes',
        riskScore: 60,
        details: {}
      });
    }
  }

  // Check for bulk PII access
  if (entry.eventType === 'data.pii.viewed' || entry.eventType === 'data.bulk.query') {
    const recordCount = entry.details.recordCount as number || 0;
    const config = ALERT_CONFIGS.find(c => c.patternType === 'pii_bulk_access');

    if (config?.enabled && recordCount >= config.threshold) {
      patterns.push({
        patternType: 'pii_bulk_access',
        userId: entry.actorId,
        description: `Bulk PII access: ${recordCount} records`,
        occurrences: recordCount,
        timeWindow: 'immediate',
        riskScore: 90,
        details: { dataType: entry.details.dataType, query: entry.details.query }
      });
    }
  }

  // Check for unusual hours activity (outside 6am-10pm local time)
  const hour = new Date().getUTCHours();
  if (hour < 6 || hour >= 22) {
    if (entry.eventType.includes('financial.') || entry.eventType.includes('admin.')) {
      const recentOffHoursActivity = await getRecentOffHoursActivity(entry.actorId, 60);
      const config = ALERT_CONFIGS.find(c => c.patternType === 'unusual_hours_activity');

      if (config?.enabled && recentOffHoursActivity >= config.threshold) {
        patterns.push({
          patternType: 'unusual_hours_activity',
          userId: entry.actorId,
          description: `${recentOffHoursActivity} high-value activities during unusual hours`,
          occurrences: recentOffHoursActivity,
          timeWindow: '60 minutes',
          riskScore: 50,
          details: { hour, eventType: entry.eventType }
        });
      }
    }
  }

  // Trigger alerts for detected patterns
  for (const pattern of patterns) {
    await triggerAlert(pattern);
  }
}

/**
 * Get count of recent failed logins
 */
async function getRecentFailedLogins(userId: string, minutes: number): Promise<number> {
  const result = await sql`
    SELECT COUNT(*) as count
    FROM grain_audit_logs
    WHERE actor_id = ${userId}
      AND event_type = 'auth.login.failed'
      AND timestamp >= NOW() - INTERVAL '1 minute' * ${minutes}
  `;
  return parseInt(result.rows[0].count, 10);
}

/**
 * Get count of recent transactions
 */
async function getRecentTransactionCount(userId: string, minutes: number): Promise<number> {
  const result = await sql`
    SELECT COUNT(*) as count
    FROM grain_audit_logs
    WHERE actor_id = ${userId}
      AND event_type LIKE 'financial.%'
      AND timestamp >= NOW() - INTERVAL '1 minute' * ${minutes}
  `;
  return parseInt(result.rows[0].count, 10);
}

/**
 * Get count of recent off-hours activity
 */
async function getRecentOffHoursActivity(userId: string, minutes: number): Promise<number> {
  const result = await sql`
    SELECT COUNT(*) as count
    FROM grain_audit_logs
    WHERE actor_id = ${userId}
      AND (event_type LIKE 'financial.%' OR event_type LIKE 'admin.%')
      AND EXTRACT(HOUR FROM timestamp) NOT BETWEEN 6 AND 21
      AND timestamp >= NOW() - INTERVAL '1 minute' * ${minutes}
  `;
  return parseInt(result.rows[0].count, 10);
}

/**
 * Trigger an alert for a suspicious pattern
 */
async function triggerAlert(pattern: SuspiciousPattern): Promise<void> {
  // Log the alert
  await logSystemEvent('security.alert.triggered', {
    alertType: pattern.patternType,
    userId: pattern.userId,
    description: pattern.description,
    riskScore: pattern.riskScore,
    ...pattern.details
  }, {
    targetUserId: pattern.userId,
    result: 'success'
  });

  // Store the alert
  await sql`
    INSERT INTO grain_security_alerts (
      id,
      pattern_type,
      user_id,
      description,
      occurrences,
      time_window,
      risk_score,
      details,
      status,
      created_at
    ) VALUES (
      ${uuidv4()},
      ${pattern.patternType},
      ${pattern.userId},
      ${pattern.description},
      ${pattern.occurrences},
      ${pattern.timeWindow},
      ${pattern.riskScore},
      ${JSON.stringify(pattern.details)},
      'pending',
      NOW()
    )
  `;

  // In production, this would trigger actual notifications
  // For now, just log it
  console.warn(`[SECURITY ALERT] ${pattern.patternType}: ${pattern.description}`);
}

// ============================================================================
// INTEGRITY VERIFICATION
// ============================================================================

/**
 * Verify the integrity of the audit log chain
 */
export async function verifyAuditLogIntegrity(
  startDate?: Date,
  endDate?: Date
): Promise<{
  valid: boolean;
  checkedEntries: number;
  invalidEntries: Array<{ id: string; issue: string }>;
}> {
  let query = `
    SELECT id, event_type, actor_id, target_user_id, details, result, risk_level, timestamp, hash, previous_hash
    FROM grain_audit_logs
  `;
  const params: string[] = [];

  if (startDate && endDate) {
    query += ` WHERE timestamp >= $1 AND timestamp <= $2`;
    params.push(startDate.toISOString(), endDate.toISOString());
  }

  query += ` ORDER BY created_at ASC, sequence_number ASC`;

  const result = await sql.query(query, params);
  const invalidEntries: Array<{ id: string; issue: string }> = [];

  for (let i = 0; i < result.rows.length; i++) {
    const row = result.rows[i];

    // Verify hash
    const hashContent = JSON.stringify({
      id: row.id,
      eventType: row.event_type,
      actorId: row.actor_id,
      targetUserId: row.target_user_id,
      details: row.details,
      result: row.result,
      riskLevel: row.risk_level,
      timestamp: new Date(row.timestamp).toISOString()
    });

    const expectedHash = await generateHash(hashContent, row.previous_hash);

    if (row.hash !== expectedHash) {
      invalidEntries.push({
        id: row.id,
        issue: 'Hash mismatch - possible tampering detected'
      });
    }

    // Verify chain continuity
    if (i > 0 && row.previous_hash !== result.rows[i - 1].hash) {
      invalidEntries.push({
        id: row.id,
        issue: 'Chain break - previous hash does not match'
      });
    }
  }

  return {
    valid: invalidEntries.length === 0,
    checkedEntries: result.rows.length,
    invalidEntries
  };
}

// ============================================================================
// RETENTION MANAGEMENT
// ============================================================================

/**
 * Archive old audit logs (move to cold storage, but never delete within retention period)
 */
export async function archiveOldLogs(
  cutoffDate?: Date
): Promise<{ archivedCount: number; archiveId: string }> {
  const archiveDate = cutoffDate || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000); // Default: 1 year old
  const retentionCutoff = new Date(Date.now() - RETENTION_YEARS * 365 * 24 * 60 * 60 * 1000);

  // Never archive logs within retention period
  if (archiveDate > retentionCutoff) {
    throw new Error(`Cannot archive logs within ${RETENTION_YEARS} year retention period`);
  }

  const archiveId = uuidv4();

  // Move to archive table
  const result = await sql`
    WITH archived AS (
      INSERT INTO grain_audit_logs_archive (
        id, event_type, actor_id, actor_type, target_user_id,
        ip_address, user_agent, session_id, details, result,
        risk_level, timestamp, request_id, metadata, hash,
        previous_hash, created_at, archive_id, archived_at
      )
      SELECT
        id, event_type, actor_id, actor_type, target_user_id,
        ip_address, user_agent, session_id, details, result,
        risk_level, timestamp, request_id, metadata, hash,
        previous_hash, created_at, ${archiveId}, NOW()
      FROM grain_audit_logs
      WHERE timestamp < ${archiveDate.toISOString()}
      RETURNING id
    )
    SELECT COUNT(*) as count FROM archived
  `;

  const archivedCount = parseInt(result.rows[0].count, 10);

  // Log the archive operation
  await logSystemEvent('config.system.changed', {
    configKey: 'audit_log_archive',
    description: `Archived ${archivedCount} audit log entries`,
    archiveId,
    cutoffDate: archiveDate.toISOString()
  });

  return { archivedCount, archiveId };
}

/**
 * Get retention statistics
 */
export async function getRetentionStats(): Promise<{
  totalLogs: number;
  oldestLog: Date | null;
  newestLog: Date | null;
  logsPerYear: Record<string, number>;
  retentionExpiresAt: Date | null;
}> {
  const result = await sql`
    SELECT
      COUNT(*) as total,
      MIN(timestamp) as oldest,
      MAX(timestamp) as newest
    FROM grain_audit_logs
  `;

  const yearStats = await sql`
    SELECT
      EXTRACT(YEAR FROM timestamp) as year,
      COUNT(*) as count
    FROM grain_audit_logs
    GROUP BY EXTRACT(YEAR FROM timestamp)
    ORDER BY year
  `;

  const logsPerYear: Record<string, number> = {};
  for (const row of yearStats.rows) {
    logsPerYear[row.year] = parseInt(row.count, 10);
  }

  const oldestLog = result.rows[0].oldest ? new Date(result.rows[0].oldest) : null;
  const retentionExpiresAt = oldestLog
    ? new Date(oldestLog.getTime() + RETENTION_YEARS * 365 * 24 * 60 * 60 * 1000)
    : null;

  return {
    totalLogs: parseInt(result.rows[0].total, 10),
    oldestLog,
    newestLog: result.rows[0].newest ? new Date(result.rows[0].newest) : null,
    logsPerYear,
    retentionExpiresAt
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  // Core logging
  logEvent,
  logSecurityEvent,
  logFinancialEvent,
  logDataAccess,
  logAdminAction,
  logSystemEvent,

  // Querying
  getAuditTrail,
  searchAuditLogs,
  exportAuditLogs,

  // Integrity
  verifyAuditLogIntegrity,

  // Retention
  archiveOldLogs,
  getRetentionStats,

  // Types
  ALERT_CONFIGS,
  RETENTION_YEARS,
  LARGE_WITHDRAWAL_THRESHOLD
};
