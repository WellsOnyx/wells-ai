// @ts-nocheck
/**
 * Cold Start Protocol API Route
 *
 * ⚠️  MASTER ACCESS ONLY ⚠️
 *
 * Accessible at: /api/cold-start
 * Requires: Authorization: Bearer <COLD_START_MASTER_KEY>
 *
 * Examples:
 *
 * Create a campaign:
 *   POST /api/cold-start
 *   { "command": "cold start protocol for tort law firms in Florida" }
 *
 * Get status:
 *   GET /api/cold-start?view=overview
 *
 * Start campaign:
 *   POST /api/cold-start
 *   { "action": "start_campaign", "campaignId": "..." }
 */

export { POST, GET, DELETE } from '@/nextgen/cold-start-protocol/api/route-cold-start'
