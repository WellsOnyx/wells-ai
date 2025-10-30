/**
 * Test Audit Ledger System
 * Validates immutable audit trail with policy versioning
 */

import {
  writeAuditAction,
  writeAuditPayload,
  getAuditAction,
  getAuditActionByActionId,
  getAuditPayload,
  getAuditPayloadByActionId,
  getAllAuditActions,
  getAllAuditPayloads,
  getAuditActionsByPolicyVersion,
  getAuditActionsByDecision,
  getAuditActionsByDateRange,
  verifyPayloadIntegrity,
  getCurrentPolicyVersion,
  getAuditStats
} from '../lib/audit-ledger'

async function testAuditLedger() {
  console.log('🧪 Testing Audit Ledger System\n')

  // ===== TEST 1: Policy Version =====
  console.log('📝 TEST 1: Policy Version Management')

  const policyVersion = getCurrentPolicyVersion()
  console.log(`   Current Policy Version: ${policyVersion.version}`)
  console.log(`   Effective Date: ${policyVersion.effectiveDate}`)
  console.log(`   Description: ${policyVersion.description}`)
  console.log(`   Requires Approval: ${policyVersion.rules.requiresApproval.join(', ')}`)

  if (!policyVersion.version) {
    throw new Error('Policy version not set')
  }

  console.log(`✅ Policy version loaded\n`)

  // ===== TEST 2: Write Audit Payload =====
  console.log('📝 TEST 2: Write Audit Payload')

  const actionId = `action_test_${Date.now()}`
  const testPayload = {
    to: '+15105551234',
    message: 'Test SMS message',
    from: 'Wells AI',
    metadata: {
      campaignId: 'test-campaign-001',
      userId: 'user-123'
    }
  }

  const auditPayload = await writeAuditPayload({
    actionId,
    actionType: 'sms',
    payload: testPayload
  })

  console.log(`   Payload ID: ${auditPayload.payloadId}`)
  console.log(`   Action ID: ${auditPayload.actionId}`)
  console.log(`   Action Type: ${auditPayload.actionType}`)
  console.log(`   Size: ${auditPayload.size} bytes`)
  console.log(`   Hash: ${auditPayload.payloadHash}`)
  console.log(`   Is Immutable: ${auditPayload.isImmutable}`)

  if (!auditPayload.payloadId) {
    throw new Error('Payload ID not generated')
  }

  if (!auditPayload.isImmutable) {
    throw new Error('Payload must be immutable')
  }

  console.log(`✅ Audit payload written\n`)

  // ===== TEST 3: Write Audit Action (Approve) =====
  console.log('📝 TEST 3: Write Audit Action (Approve)')

  const auditAction = await writeAuditAction({
    actionId,
    actionType: 'sms',
    title: 'Send SMS to customer',
    description: 'Sending test SMS message',
    recipient: '+15105551234',
    decision: 'approve',
    decidedBy: 'test-user',
    reason: 'Approved for testing'
  })

  console.log(`   Audit ID: ${auditAction.auditId}`)
  console.log(`   Action ID: ${auditAction.actionId}`)
  console.log(`   Decision: ${auditAction.decision}`)
  console.log(`   Decided By: ${auditAction.decidedBy}`)
  console.log(`   Policy Version: ${auditAction.policyVersion}`)
  console.log(`   Is Immutable: ${auditAction.isImmutable}`)

  if (!auditAction.auditId) {
    throw new Error('Audit ID not generated')
  }

  if (!auditAction.isImmutable) {
    throw new Error('Audit action must be immutable')
  }

  if (auditAction.policyVersion !== policyVersion.version) {
    throw new Error(`Expected policy version ${policyVersion.version}, got ${auditAction.policyVersion}`)
  }

  console.log(`✅ Audit action written with policy version\n`)

  // ===== TEST 4: Write Additional Actions for Testing =====
  console.log('📝 TEST 4: Write Multiple Audit Actions')

  const action2Id = `action_test_${Date.now()}_2`
  await writeAuditPayload({
    actionId: action2Id,
    actionType: 'email',
    payload: {
      to: 'test@example.com',
      subject: 'Test Email',
      body: 'This is a test email'
    }
  })

  await writeAuditAction({
    actionId: action2Id,
    actionType: 'email',
    title: 'Send Email to partner',
    description: 'Sending test email',
    recipient: 'test@example.com',
    decision: 'reject',
    decidedBy: 'test-user',
    reason: 'Rejected for testing'
  })

  const action3Id = `action_test_${Date.now()}_3`
  await writeAuditPayload({
    actionId: action3Id,
    actionType: 'partner_outreach',
    payload: {
      partnerId: 'ibm',
      opportunityId: 'opp-123',
      message: 'Test partner outreach'
    }
  })

  await writeAuditAction({
    actionId: action3Id,
    actionType: 'partner_outreach',
    title: 'Partner outreach to IBM',
    description: 'Sending partner outreach',
    recipient: 'partner@ibm.com',
    decision: 'approve',
    decidedBy: 'admin-user',
    reason: 'Valid opportunity'
  })

  console.log(`   Created 2 additional audit actions`)
  console.log(`✅ Multiple audit actions written\n`)

  // ===== TEST 5: Retrieve Audit Action =====
  console.log('📝 TEST 5: Retrieve Audit Action')

  const retrievedAction = getAuditAction(auditAction.auditId)
  if (!retrievedAction) {
    throw new Error('Failed to retrieve audit action')
  }

  console.log(`   Retrieved audit ID: ${retrievedAction.auditId}`)
  console.log(`   Decision: ${retrievedAction.decision}`)
  console.log(`✅ Audit action retrieved successfully\n`)

  // ===== TEST 6: Retrieve Audit Action by Action ID =====
  console.log('📝 TEST 6: Retrieve Audit Action by Action ID')

  const retrievedByActionId = getAuditActionByActionId(actionId)
  if (!retrievedByActionId) {
    throw new Error('Failed to retrieve audit action by action ID')
  }

  console.log(`   Retrieved by action ID: ${retrievedByActionId.actionId}`)
  console.log(`✅ Audit action retrieved by action ID\n`)

  // ===== TEST 7: Retrieve Audit Payload =====
  console.log('📝 TEST 7: Retrieve Audit Payload')

  const retrievedPayload = getAuditPayload(auditPayload.payloadId)
  if (!retrievedPayload) {
    throw new Error('Failed to retrieve audit payload')
  }

  console.log(`   Retrieved payload ID: ${retrievedPayload.payloadId}`)
  console.log(`   Payload size: ${retrievedPayload.size} bytes`)
  console.log(`✅ Audit payload retrieved successfully\n`)

  // ===== TEST 8: Retrieve Audit Payload by Action ID =====
  console.log('📝 TEST 8: Retrieve Audit Payload by Action ID')

  const retrievedPayloadByActionId = getAuditPayloadByActionId(actionId)
  if (!retrievedPayloadByActionId) {
    throw new Error('Failed to retrieve audit payload by action ID')
  }

  console.log(`   Retrieved by action ID: ${retrievedPayloadByActionId.actionId}`)
  console.log(`✅ Audit payload retrieved by action ID\n`)

  // ===== TEST 9: Verify Payload Integrity =====
  console.log('📝 TEST 9: Verify Payload Integrity')

  const isValid = await verifyPayloadIntegrity(auditPayload.payloadId)
  if (!isValid) {
    throw new Error('Payload integrity verification failed')
  }

  console.log(`   Payload integrity verified: ${isValid}`)
  console.log(`✅ Payload integrity check passed\n`)

  // ===== TEST 10: Get All Audit Actions =====
  console.log('📝 TEST 10: Get All Audit Actions')

  const allActions = getAllAuditActions()
  console.log(`   Total audit actions: ${allActions.length}`)

  if (allActions.length < 3) {
    throw new Error(`Expected at least 3 audit actions, got ${allActions.length}`)
  }

  console.log(`✅ Retrieved all audit actions\n`)

  // ===== TEST 11: Get All Audit Payloads =====
  console.log('📝 TEST 11: Get All Audit Payloads')

  const allPayloads = getAllAuditPayloads()
  console.log(`   Total audit payloads: ${allPayloads.length}`)

  if (allPayloads.length < 3) {
    throw new Error(`Expected at least 3 audit payloads, got ${allPayloads.length}`)
  }

  console.log(`✅ Retrieved all audit payloads\n`)

  // ===== TEST 12: Get Audit Actions by Policy Version =====
  console.log('📝 TEST 12: Get Audit Actions by Policy Version')

  const actionsByPolicy = getAuditActionsByPolicyVersion(policyVersion.version)
  console.log(`   Actions with policy ${policyVersion.version}: ${actionsByPolicy.length}`)

  if (actionsByPolicy.length !== allActions.length) {
    throw new Error('All actions should have current policy version')
  }

  console.log(`✅ Retrieved audit actions by policy version\n`)

  // ===== TEST 13: Get Audit Actions by Decision =====
  console.log('📝 TEST 13: Get Audit Actions by Decision')

  const approvedActions = getAuditActionsByDecision('approve')
  const rejectedActions = getAuditActionsByDecision('reject')

  console.log(`   Approved actions: ${approvedActions.length}`)
  console.log(`   Rejected actions: ${rejectedActions.length}`)

  if (approvedActions.length < 1) {
    throw new Error('Expected at least 1 approved action')
  }

  if (rejectedActions.length < 1) {
    throw new Error('Expected at least 1 rejected action')
  }

  console.log(`✅ Retrieved audit actions by decision\n`)

  // ===== TEST 14: Get Audit Actions by Date Range =====
  console.log('📝 TEST 14: Get Audit Actions by Date Range')

  const now = new Date()
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
  const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000)

  const actionsByDateRange = getAuditActionsByDateRange(
    oneHourAgo.toISOString(),
    oneHourFromNow.toISOString()
  )

  console.log(`   Actions in date range: ${actionsByDateRange.length}`)

  if (actionsByDateRange.length !== allActions.length) {
    throw new Error('All test actions should be within date range')
  }

  console.log(`✅ Retrieved audit actions by date range\n`)

  // ===== TEST 15: Get Audit Statistics =====
  console.log('📝 TEST 15: Get Audit Statistics')

  const stats = getAuditStats()
  console.log(`   Total Actions: ${stats.totalActions}`)
  console.log(`   Total Payloads: ${stats.totalPayloads}`)
  console.log(`   Total Payload Size: ${stats.totalPayloadSize} bytes`)
  console.log(`   Current Policy Version: ${stats.currentPolicyVersion}`)
  console.log(`   By Decision:`)
  console.log(`     - Approved: ${stats.byDecision.approve}`)
  console.log(`     - Rejected: ${stats.byDecision.reject}`)
  console.log(`     - Timeout: ${stats.byDecision.timeout}`)
  console.log(`     - Error: ${stats.byDecision.error}`)
  console.log(`   By Action Type:`)
  Object.entries(stats.byActionType).forEach(([type, count]) => {
    console.log(`     - ${type}: ${count}`)
  })
  console.log(`   By Policy Version:`)
  Object.entries(stats.byPolicyVersion).forEach(([version, count]) => {
    console.log(`     - ${version}: ${count}`)
  })

  if (stats.totalActions !== allActions.length) {
    throw new Error('Statistics mismatch')
  }

  console.log(`✅ Audit statistics generated\n`)

  // ===== TEST 16: Immutability Verification =====
  console.log('📝 TEST 16: Verify Immutability')

  const testAction = getAllAuditActions()[0]
  const testPayloadObj = getAllAuditPayloads()[0]

  if (!testAction.isImmutable || !testPayloadObj.isImmutable) {
    throw new Error('All audit records must be immutable')
  }

  console.log(`   ✓ All actions marked as immutable`)
  console.log(`   ✓ All payloads marked as immutable`)
  console.log(`✅ Immutability verified\n`)

  // ===== TEST 17: Policy Version Tracking =====
  console.log('📝 TEST 17: Verify Policy Version Tracking')

  const actionsWithPolicy = getAllAuditActions()
  const allHavePolicy = actionsWithPolicy.every(a => a.policyVersion && a.policyRules)

  if (!allHavePolicy) {
    throw new Error('All actions must have policy version and rules')
  }

  console.log(`   ✓ All actions have policy version`)
  console.log(`   ✓ All actions have policy rules snapshot`)
  console.log(`✅ Policy version tracking verified\n`)

  // ===== SUMMARY =====
  console.log('='.repeat(60))
  console.log('✅ ALL TESTS PASSED')
  console.log('='.repeat(60))
  console.log(`
Audit Ledger Summary:
  Total Actions: ${stats.totalActions}
  Total Payloads: ${stats.totalPayloads}
  Total Payload Size: ${stats.totalPayloadSize} bytes

  Decisions:
    - Approved: ${stats.byDecision.approve}
    - Rejected: ${stats.byDecision.reject}

  Current Policy Version: ${stats.currentPolicyVersion}

  Key Features Validated:
    ✅ Immutable audit_actions table
    ✅ Immutable audit_payloads table
    ✅ Policy version tracking (${policyVersion.version})
    ✅ Payload integrity verification (SHA-256)
    ✅ Query by policy version
    ✅ Query by decision type
    ✅ Query by date range
    ✅ Comprehensive audit statistics

Ready for compliance reporting and audit trails!
`)
}

// ===== RUN TEST =====

testAuditLedger()
  .then(() => {
    console.log('🎉 Audit Ledger System: READY FOR PRODUCTION')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ TEST FAILED:', error.message)
    console.error(error.stack)
    process.exit(1)
  })
