/**
 * Wells AI - Playbook Runner
 * Turn suggested actions into queued tasks after consent
 */

import {
  PlaybookType,
  PlaybookAction,
  PlaybookParams,
  ActionStatus,
  DealRegistrationParams
} from './types'
import { Opportunity, OpportunityStage } from '../opportunity'
import { queueAction as queueConsentAction } from '../consent'
import { enqueueAction, updateActionStatus, getAction } from '../queue'

// ===== PLAYBOOK RUNNER =====

/**
 * Suggest a playbook action based on opportunity
 */
export function suggestPlaybook(opportunity: Opportunity): PlaybookAction | null {
  // IBM opportunities → Deal registration playbook
  if (opportunity.partnerId === 'ibm' && opportunity.stage === OpportunityStage.Qualified) {
    return suggestDealRegistration(opportunity)
  }

  // Cisco opportunities → Co-sell request playbook
  if (opportunity.partnerId === 'cisco' && opportunity.stage === OpportunityStage.Qualified) {
    return suggestCoSellRequest(opportunity)
  }

  // High-value opportunities → Partner intro playbook
  if (opportunity.estimatedValue >= 1000000) {
    return suggestPartnerIntro(opportunity)
  }

  return null
}

/**
 * Suggest deal registration playbook
 */
function suggestDealRegistration(opportunity: Opportunity): PlaybookAction {
  const params: DealRegistrationParams = {
    opportunityId: opportunity.id,
    partnerId: opportunity.partnerId,
    dealValue: opportunity.estimatedValue,
    expectedCloseDate: opportunity.expectedCloseDate || '',
    competitorInfo: opportunity.metadata.raw?.competitorInfo?.competingWith,
    partnerManagerEmail: opportunity.metadata.partnerManagerEmail
  }

  const action: PlaybookAction = {
    actionId: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    playbookType: PlaybookType.DealRegistration,
    supplierId: opportunity.supplierId,
    opportunityId: opportunity.id,
    partnerId: opportunity.partnerId,
    params,
    status: ActionStatus.Suggested,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  return action
}

/**
 * Suggest co-sell request playbook
 */
function suggestCoSellRequest(opportunity: Opportunity): PlaybookAction {
  const params = {
    opportunityId: opportunity.id,
    partnerId: opportunity.partnerId,
    customerName: opportunity.companyName,
    useCase: opportunity.description,
    requestedSupport: 'overlay' as const
  }

  const action: PlaybookAction = {
    actionId: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    playbookType: PlaybookType.CoSellRequest,
    supplierId: opportunity.supplierId,
    opportunityId: opportunity.id,
    partnerId: opportunity.partnerId,
    params,
    status: ActionStatus.Suggested,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  return action
}

/**
 * Suggest partner intro playbook
 */
function suggestPartnerIntro(opportunity: Opportunity): PlaybookAction {
  const params = {
    opportunityId: opportunity.id,
    partnerId: opportunity.partnerId,
    customerName: opportunity.companyName,
    introMessage: `Introduction for ${opportunity.title}`,
    requestedMeeting: true
  }

  const action: PlaybookAction = {
    actionId: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    playbookType: PlaybookType.PartnerIntro,
    supplierId: opportunity.supplierId,
    opportunityId: opportunity.id,
    partnerId: opportunity.partnerId,
    params,
    status: ActionStatus.Suggested,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  return action
}

/**
 * Run playbook - queue action for consent, then execute if approved
 */
export async function runPlaybook(params: {
  type: PlaybookType
  partner: string
  oppId: string
  playbookParams?: PlaybookParams
}): Promise<PlaybookAction> {
  const { type, partner, oppId, playbookParams } = params

  // Create action
  const action: PlaybookAction = {
    actionId: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    playbookType: type,
    supplierId: 'wells-onyx', // TODO: Get from context
    opportunityId: oppId,
    partnerId: partner,
    params: playbookParams || {} as any,
    status: ActionStatus.Pending,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  // Queue for consent
  const consentAction = queueConsentAction({
    actionType: 'partner_outreach',
    title: `${getPlaybookTitle(type)} - ${partner.toUpperCase()}`,
    description: getPlaybookDescription(type, oppId, partner),
    recipient: partner,
    messagePreview: JSON.stringify(playbookParams, null, 2),
    metadata: {
      playbookType: type,
      actionId: action.actionId,
      opportunityId: oppId
    }
  })

  action.consentActionId = consentAction.actionId

  // Add to action queue
  enqueueAction(action)

  return action
}

/**
 * Execute playbook action after consent approval
 */
export async function executePlaybookAction(actionId: string): Promise<void> {
  const action = getAction(actionId)

  if (!action) {
    throw new Error(`Action not found: ${actionId}`)
  }

  if (action.status !== ActionStatus.Approved) {
    throw new Error(`Action not approved: ${actionId} (status: ${action.status})`)
  }

  console.log(`🚀 Executing playbook: ${action.playbookType} (${actionId})`)

  try {
    // Update status to submitted
    updateActionStatus(actionId, ActionStatus.Submitted)

    // Execute based on playbook type
    switch (action.playbookType) {
      case PlaybookType.DealRegistration:
        await executeDealRegistration(action)
        break
      case PlaybookType.CoSellRequest:
        await executeCoSellRequest(action)
        break
      case PlaybookType.PartnerIntro:
        await executePartnerIntro(action)
        break
      default:
        throw new Error(`Unknown playbook type: ${action.playbookType}`)
    }

    // Mark as completed
    updateActionStatus(actionId, ActionStatus.Completed, {
      success: true,
      message: `${action.playbookType} completed successfully`
    })

    console.log(`✅ Playbook completed: ${action.playbookType} (${actionId})`)
  } catch (error) {
    console.error(`❌ Playbook failed: ${action.playbookType} (${actionId})`, error)

    updateActionStatus(actionId, ActionStatus.Failed, {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
      error: error instanceof Error ? error.stack : undefined
    })

    throw error
  }
}

// ===== PLAYBOOK EXECUTORS =====

async function executeDealRegistration(action: PlaybookAction): Promise<void> {
  const params = action.params as DealRegistrationParams

  // TODO: Integrate with partner portal API
  // For now, simulate submission
  console.log(`📋 Registering deal with ${action.partnerId}:`, {
    opportunityId: params.opportunityId,
    dealValue: params.dealValue,
    expectedCloseDate: params.expectedCloseDate
  })

  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000))

  console.log(`✅ Deal registered with ${action.partnerId}`)
}

async function executeCoSellRequest(action: PlaybookAction): Promise<void> {
  const params = action.params

  console.log(`🤝 Requesting co-sell support from ${action.partnerId}:`, params)

  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000))

  console.log(`✅ Co-sell request submitted to ${action.partnerId}`)
}

async function executePartnerIntro(action: PlaybookAction): Promise<void> {
  const params = action.params

  console.log(`👋 Requesting partner intro from ${action.partnerId}:`, params)

  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000))

  console.log(`✅ Partner intro requested from ${action.partnerId}`)
}

// ===== HELPERS =====

function getPlaybookTitle(type: PlaybookType): string {
  switch (type) {
    case PlaybookType.DealRegistration:
      return 'Register Deal'
    case PlaybookType.CoSellRequest:
      return 'Request Co-Sell Support'
    case PlaybookType.PartnerIntro:
      return 'Request Partner Introduction'
    case PlaybookType.QuoteRequest:
      return 'Request Quote'
    case PlaybookType.TechnicalReview:
      return 'Request Technical Review'
    default:
      return 'Run Playbook'
  }
}

function getPlaybookDescription(type: PlaybookType, oppId: string, partner: string): string {
  switch (type) {
    case PlaybookType.DealRegistration:
      return `Register opportunity ${oppId} with ${partner} partner portal to protect deal registration and access co-sell resources.`
    case PlaybookType.CoSellRequest:
      return `Request co-sell support from ${partner} for opportunity ${oppId}. Partner will provide overlay support, technical resources, and executive sponsorship.`
    case PlaybookType.PartnerIntro:
      return `Request introduction from ${partner} partner manager for opportunity ${oppId}.`
    default:
      return `Execute ${type} playbook for opportunity ${oppId} with partner ${partner}.`
  }
}
