// @ts-nocheck
/**
 * Wells AI Conversational Onboarding System
 *
 * A conversation-first approach to onboarding that feels like chatting
 * with a helpful assistant, not filling out forms.
 *
 * Key principles:
 * - Learn about users naturally through dialogue
 * - Remember everything for personalization
 * - Adapt conversation based on user type
 * - Allow users to skip or come back to topics
 * - Feel helpful, not interrogative
 */

import Anthropic from '@anthropic-ai/sdk'
import { sqlQuery as sql } from '@/lib/db'
import { clerkClient } from '@clerk/nextjs/server'
import {
  UserJourney,
  OnboardingStep,
  UserProfile,
  FounderProfile,
  BuyerProfile,
  SellerProfile,
  JobsProfile,
  IntegrationProvider,
  ERPSystemChoice,
} from './types'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

// ============================================================================
// TYPES
// ============================================================================

export type ConversationPhase =
  | 'greeting'           // Initial warm welcome
  | 'discovery'          // Learning about the user
  | 'journey_selection'  // Understanding their primary need
  | 'profile_building'   // Gathering profile details
  | 'integrations'       // Connecting apps/services
  | 'preferences'        // Communication & autonomy preferences
  | 'treasury'           // Payment setup
  | 'data_import'        // Importing existing data
  | 'completion'         // Final personalized next steps

export interface OnboardingConversation {
  id: string
  userId: string
  phase: ConversationPhase
  messages: OnboardingMessage[]
  collectedData: CollectedOnboardingData
  preferences: UserPreferences
  phaseProgress: Record<ConversationPhase, PhaseProgress>
  createdAt: Date
  updatedAt: Date
}

export interface OnboardingMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  phase: ConversationPhase
  extractedData?: Partial<CollectedOnboardingData>
  suggestedActions?: SuggestedAction[]
}

export interface CollectedOnboardingData {
  // Personal
  firstName?: string
  lastName?: string
  preferredName?: string
  email?: string
  phone?: string
  timezone?: string
  location?: string

  // Journey & Role
  journey?: UserJourney
  secondaryJourneys?: UserJourney[]
  role?: string
  company?: string
  industry?: string
  companySize?: string

  // Journey-specific profiles
  founderProfile?: Partial<FounderProfile>
  buyerProfile?: Partial<BuyerProfile>
  sellerProfile?: Partial<SellerProfile>
  jobsProfile?: Partial<JobsProfile>

  // Integrations
  connectedIntegrations?: IntegrationProvider[]
  pendingIntegrations?: IntegrationProvider[]
  erpChoice?: ERPSystemChoice

  // Preferences
  communicationStyle?: 'formal' | 'casual' | 'professional'
  proactivityLevel?: 'minimal' | 'moderate' | 'high'
  notificationPreferences?: NotificationPreferences

  // Autonomy settings
  autonomyLevel?: AutonomyLevel
  negotiationLimits?: NegotiationLimits
  approvalThresholds?: ApprovalThresholds

  // Treasury
  treasurySetupComplete?: boolean
  paymentMethodAdded?: boolean
  kycStatus?: 'not-started' | 'pending' | 'approved' | 'rejected'

  // Import
  contactsImported?: boolean
  documentsImported?: boolean
  dataSourceConnected?: boolean
}

export interface UserPreferences {
  communicationStyle: 'formal' | 'casual' | 'professional'
  responseLength: 'brief' | 'detailed' | 'adaptive'
  proactivityLevel: 'minimal' | 'moderate' | 'high'
  timezone?: string
}

export interface NotificationPreferences {
  email: boolean
  sms: boolean
  push: boolean
  slack?: boolean
  digest: 'realtime' | 'hourly' | 'daily' | 'weekly'
}

export interface AutonomyLevel {
  level: 'supervised' | 'semi-autonomous' | 'autonomous'
  description: string
}

export interface NegotiationLimits {
  maxDiscountPercent: number
  maxAutoApproveAmount: number
  requireApprovalAbove: number
  currency: string
}

export interface ApprovalThresholds {
  purchaseOrderLimit: number
  paymentLimit: number
  hiringApproval: boolean
  contractSigning: boolean
}

export interface PhaseProgress {
  started: boolean
  completed: boolean
  skipped: boolean
  dataCollected: string[]
  lastActivity?: Date
}

export interface SuggestedAction {
  type: 'button' | 'link' | 'oauth' | 'input'
  label: string
  action: string
  data?: Record<string, unknown>
  primary?: boolean
}

// ============================================================================
// CONVERSATION CONTEXT
// ============================================================================

const conversationCache = new Map<string, OnboardingConversation>()

/**
 * Initialize or retrieve onboarding conversation
 */
export async function getOrCreateConversation(
  userId: string
): Promise<OnboardingConversation> {
  // Check cache
  if (conversationCache.has(userId)) {
    return conversationCache.get(userId)!
  }

  // Try to load from database
  try {
    const result = await sql`
      SELECT * FROM onboarding_conversations
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 1
    `

    if (result.rows.length > 0) {
      const row = result.rows[0]
      const conversation: OnboardingConversation = {
        id: row.id,
        userId: row.user_id,
        phase: row.current_phase,
        messages: row.messages || [],
        collectedData: row.collected_data || {},
        preferences: row.preferences || getDefaultPreferences(),
        phaseProgress: row.phase_progress || initializePhaseProgress(),
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
      }
      conversationCache.set(userId, conversation)
      return conversation
    }
  } catch (error) {
    console.error('[ConversationalOnboarding] Error loading conversation:', error)
  }

  // Create new conversation
  const conversation = await createNewConversation(userId)
  conversationCache.set(userId, conversation)
  return conversation
}

/**
 * Create a fresh onboarding conversation
 */
async function createNewConversation(userId: string): Promise<OnboardingConversation> {
  const id = `onb_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

  // Get user info from Clerk
  let firstName = ''
  let email = ''
  try {
    const client = await clerkClient()
    const user = await client.users.getUser(userId)
    firstName = user.firstName || ''
    email = user.emailAddresses?.[0]?.emailAddress || ''
  } catch (error) {
    console.error('[ConversationalOnboarding] Error fetching user from Clerk:', error)
  }

  const conversation: OnboardingConversation = {
    id,
    userId,
    phase: 'greeting',
    messages: [],
    collectedData: {
      firstName,
      email,
    },
    preferences: getDefaultPreferences(),
    phaseProgress: initializePhaseProgress(),
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  // Save to database
  try {
    await sql`
      INSERT INTO onboarding_conversations (
        id,
        user_id,
        current_phase,
        messages,
        collected_data,
        preferences,
        phase_progress,
        created_at,
        updated_at
      ) VALUES (
        ${conversation.id},
        ${userId},
        ${conversation.phase},
        ${JSON.stringify(conversation.messages)},
        ${JSON.stringify(conversation.collectedData)},
        ${JSON.stringify(conversation.preferences)},
        ${JSON.stringify(conversation.phaseProgress)},
        ${conversation.createdAt.toISOString()},
        ${conversation.updatedAt.toISOString()}
      )
    `
  } catch (error) {
    console.error('[ConversationalOnboarding] Error creating conversation:', error)
  }

  return conversation
}

/**
 * Save conversation to database
 */
export async function saveConversation(conversation: OnboardingConversation): Promise<void> {
  conversation.updatedAt = new Date()
  conversationCache.set(conversation.userId, conversation)

  try {
    await sql`
      UPDATE onboarding_conversations
      SET
        current_phase = ${conversation.phase},
        messages = ${JSON.stringify(conversation.messages.slice(-100))},
        collected_data = ${JSON.stringify(conversation.collectedData)},
        preferences = ${JSON.stringify(conversation.preferences)},
        phase_progress = ${JSON.stringify(conversation.phaseProgress)},
        updated_at = ${conversation.updatedAt.toISOString()}
      WHERE id = ${conversation.id}
    `
  } catch (error) {
    console.error('[ConversationalOnboarding] Error saving conversation:', error)
  }
}

// ============================================================================
// PHASE CONFIGURATION
// ============================================================================

const PHASE_ORDER: ConversationPhase[] = [
  'greeting',
  'discovery',
  'journey_selection',
  'profile_building',
  'integrations',
  'preferences',
  'treasury',
  'data_import',
  'completion',
]

interface PhaseConfig {
  name: string
  goal: string
  requiredData: string[]
  optionalData: string[]
  canSkip: boolean
  systemPrompt: string
  initialMessages?: string[]
  suggestedActions?: SuggestedAction[]
}

const PHASE_CONFIGS: Record<ConversationPhase, PhaseConfig> = {
  greeting: {
    name: 'Welcome',
    goal: 'Warm welcome and initial introduction',
    requiredData: [],
    optionalData: ['preferredName'],
    canSkip: false,
    systemPrompt: `You are Wells, starting a friendly onboarding conversation.

Your goal: Give a warm, personal welcome that makes the user feel excited to be here.

Guidelines:
- Be warm and genuine, not corporate
- If you know their first name, use it
- Express that you're here to help them succeed
- Briefly mention you'll learn about them to personalize their experience
- Keep it concise - 2-3 sentences max
- End by naturally transitioning to learning about them

DO NOT:
- List features or capabilities yet
- Ask multiple questions at once
- Sound like a form or survey`,
  },

  discovery: {
    name: 'Get to Know You',
    goal: 'Learn about the user naturally',
    requiredData: ['company', 'role'],
    optionalData: ['industry', 'companySize', 'location'],
    canSkip: false,
    systemPrompt: `You are Wells, having a friendly discovery conversation.

Your goal: Learn about the user through natural dialogue, not interrogation.

CURRENT CONTEXT:
{context}

Guidelines:
- Ask about what brings them to Wells AI
- Learn about their company/work naturally
- Pick up on cues about their industry and role
- Remember and reference what they've already told you
- Sound curious and interested, not procedural
- One question at a time - this is a conversation

If they mention what they're looking for (suppliers, talent, jobs, selling),
acknowledge it and note it for the journey selection phase.

Extract from their responses:
- Company name
- Their role
- Industry
- Company size (startup, SMB, enterprise)
- Location (if mentioned)`,
  },

  journey_selection: {
    name: 'Your Journey',
    goal: 'Understand their primary need and journey',
    requiredData: ['journey'],
    optionalData: ['secondaryJourneys'],
    canSkip: false,
    systemPrompt: `You are Wells, helping the user identify their primary journey.

Your goal: Understand what they mainly want to accomplish with Wells AI.

CURRENT CONTEXT:
{context}

JOURNEY OPTIONS:
- Buyer: Source products, find suppliers, manage procurement
- Seller: Find customers, respond to RFQs, grow sales
- Founder: Multi-purpose - hire, source, sell, raise funding
- Jobs: Find your next role, negotiate offers

Guidelines:
- If they've already indicated their need, confirm it
- Otherwise, ask what's the #1 thing they want to accomplish
- If they have multiple needs (common for founders), acknowledge that
- Frame journeys in terms of outcomes, not features
- Make them feel their needs will be met

Once you understand their primary journey, acknowledge it enthusiastically and
mention how you'll help them specifically.`,
  },

  profile_building: {
    name: 'Profile Details',
    goal: 'Gather journey-specific information',
    requiredData: [], // Dynamic based on journey
    optionalData: [],
    canSkip: false,
    systemPrompt: `You are Wells, gathering profile details conversationally.

Your goal: Collect relevant information for their journey without feeling like a form.

CURRENT CONTEXT:
{context}

JOURNEY: {journey}

Based on their journey, naturally gather:

FOR FOUNDER:
- Company stage (idea, MVP, early revenue, scaling, funded)
- What they're looking for (talent, suppliers, customers, investors)
- Team size
- Immediate priorities

FOR BUYER:
- Purchase categories/products they need
- Typical purchase volume
- Current procurement process
- Payment terms they prefer

FOR SELLER:
- Products/services they offer
- Target customer profile
- Certifications or special capabilities
- Shipping/service regions

FOR JOBS:
- Current role and experience level
- Skills and specialties
- What they're looking for in next role
- Remote/location preferences
- Salary expectations (if they're comfortable)

Guidelines:
- Only ask about relevant things for their journey
- 2-3 questions per message max
- Acknowledge their answers before asking more
- If they seem done sharing, move on`,
  },

  integrations: {
    name: 'Connect Your Tools',
    goal: 'Connect relevant integrations',
    requiredData: [],
    optionalData: ['connectedIntegrations', 'erpChoice'],
    canSkip: true,
    systemPrompt: `You are Wells, offering to connect helpful integrations.

Your goal: Help them connect tools that will make their experience better.

CURRENT CONTEXT:
{context}

RELEVANT INTEGRATIONS BY JOURNEY:
- All: Calendar (Google/Outlook), Slack
- Buyer: QuickBooks, Xero, NetSuite, or use WellsAI as ERP
- Seller: CRM, Inventory systems
- Founder: All of the above
- Jobs: LinkedIn

Guidelines:
- Suggest the most relevant 1-2 integrations first
- Explain the benefit in one sentence
- Make it clear they can skip and do this later
- If they want to connect, provide the action button
- Don't push - integrations should feel helpful, not required

For ERP specifically:
- Mention they can use WellsAI as their ERP (conversational, no forms)
- Or connect an existing one
- This is a choice, not a requirement`,
    suggestedActions: [
      { type: 'oauth', label: 'Connect Google Calendar', action: 'connect_google_calendar', primary: true },
      { type: 'oauth', label: 'Connect Slack', action: 'connect_slack' },
      { type: 'button', label: 'Skip for now', action: 'skip_integrations' },
    ],
  },

  preferences: {
    name: 'Your Preferences',
    goal: 'Set communication and autonomy preferences',
    requiredData: ['communicationStyle'],
    optionalData: ['proactivityLevel', 'autonomyLevel', 'negotiationLimits'],
    canSkip: true,
    systemPrompt: `You are Wells, learning how the user likes to work.

Your goal: Understand their communication style and autonomy preferences.

CURRENT CONTEXT:
{context}

THINGS TO LEARN:

1. COMMUNICATION STYLE:
   "How should I communicate with you?"
   - Formal: Professional, detailed, executive-style
   - Casual: Friendly, concise, emoji-friendly
   - Professional: Balanced, clear, efficient

2. PROACTIVITY LEVEL:
   "How proactive should I be?"
   - Minimal: Only respond when asked
   - Moderate: Suggest things occasionally, send important alerts
   - High: Actively monitor and suggest opportunities

3. AUTONOMY (especially for Buyer/Founder):
   "Should I auto-negotiate within limits?"
   - Supervised: Always ask before acting
   - Semi-autonomous: Act within defined limits
   - Autonomous: Handle routine things automatically

For semi/autonomous, ask about:
- Max discount I can negotiate (%)
- Max amount I can auto-approve ($)
- Approval threshold for larger decisions

Guidelines:
- Frame these as customization, not configuration
- Give concrete examples of what each option means
- Start with communication style, then proactivity
- Only ask about autonomy for relevant journeys
- Make it feel like they're teaching you their preferences`,
  },

  treasury: {
    name: 'Treasury Setup',
    goal: 'Set up GRAIN wallet and payment methods',
    requiredData: [],
    optionalData: ['treasurySetupComplete', 'paymentMethodAdded'],
    canSkip: true,
    systemPrompt: `You are Wells, introducing Grain & Vault treasury.

Your goal: Help them set up their treasury account if they're interested.

CURRENT CONTEXT:
{context}

GRAIN & VAULT BENEFITS:
- GRAIN stablecoin for instant payments
- Credit line for working capital
- Earn yield on balances
- Seamless payments between Wells AI users

Guidelines:
- Explain the benefits briefly (2-3 bullet points)
- This is optional but valuable
- If they're interested, guide them through setup
- If not interested, that's totally fine
- Don't be pushy about financial setup

For interested users:
1. Create their GRAIN wallet
2. Offer to add a funding source (bank account or card)
3. Explain KYC if needed for higher limits`,
    suggestedActions: [
      { type: 'button', label: 'Set Up Treasury', action: 'setup_treasury', primary: true },
      { type: 'button', label: 'Learn More', action: 'treasury_info' },
      { type: 'button', label: 'Skip for now', action: 'skip_treasury' },
    ],
  },

  data_import: {
    name: 'Import Data',
    goal: 'Help import existing contacts and data',
    requiredData: [],
    optionalData: ['contactsImported', 'documentsImported'],
    canSkip: true,
    systemPrompt: `You are Wells, offering to import their existing data.

Your goal: Help them get started faster by importing existing data.

CURRENT CONTEXT:
{context}

IMPORT OPTIONS BY JOURNEY:
- Buyer: Supplier contacts, past POs, vendor list
- Seller: Customer contacts, product catalog
- Founder: Team info, investor contacts, supplier/customer lists
- Jobs: LinkedIn profile, resume, connection list

Guidelines:
- Offer the most relevant import for their journey
- Make it sound helpful, not invasive
- Emphasize that Wells can learn from this data
- If they have a CRM or system, offer to connect
- CSV upload is always an option
- Make it clear this is optional`,
    suggestedActions: [
      { type: 'button', label: 'Import from LinkedIn', action: 'import_linkedin', primary: true },
      { type: 'button', label: 'Upload CSV', action: 'upload_csv' },
      { type: 'button', label: 'Skip for now', action: 'skip_import' },
    ],
  },

  completion: {
    name: 'Ready!',
    goal: 'Celebrate and provide personalized next steps',
    requiredData: [],
    optionalData: [],
    canSkip: false,
    systemPrompt: `You are Wells, celebrating onboarding completion.

Your goal: Make them feel accomplished and excited to get started.

CURRENT CONTEXT:
{context}

PERSONALIZED NEXT STEPS BY JOURNEY:

FOR BUYER:
- "Tell me what you need and I'll find suppliers"
- Create your first RFQ
- Explore the marketplace

FOR SELLER:
- "Share your catalog and I'll match you with buyers"
- Set up your seller profile
- View incoming opportunities

FOR FOUNDER:
- "What's your #1 priority? Hiring, sourcing, or selling?"
- Check the founder dashboard
- Post your first need

FOR JOBS:
- "Let's find your next role"
- Create job alerts
- Review opportunities

Guidelines:
- Celebrate their completion genuinely
- Reference specific things they shared during onboarding
- Give them 2-3 clear next steps relevant to their journey
- Offer to help right now with their first task
- Make them feel like a VIP / First Mover
- End with an invitation to just start talking`,
  },
}

// ============================================================================
// CORE CONVERSATION ENGINE
// ============================================================================

/**
 * Process a user message in the onboarding conversation
 */
export async function processOnboardingMessage(
  userId: string,
  userMessage: string
): Promise<OnboardingResponse> {
  // Get or create conversation
  const conversation = await getOrCreateConversation(userId)

  // Add user message
  const userMsg: OnboardingMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    role: 'user',
    content: userMessage,
    timestamp: new Date(),
    phase: conversation.phase,
  }
  conversation.messages.push(userMsg)

  // Get phase config
  const phaseConfig = PHASE_CONFIGS[conversation.phase]

  // Build context for AI
  const context = buildConversationContext(conversation)

  // Generate AI response with data extraction
  const aiResult = await generateOnboardingResponse(
    conversation,
    userMessage,
    phaseConfig,
    context
  )

  // Update collected data
  if (aiResult.extractedData) {
    conversation.collectedData = {
      ...conversation.collectedData,
      ...aiResult.extractedData,
    }
  }

  // Add assistant message
  const assistantMsg: OnboardingMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    role: 'assistant',
    content: aiResult.message,
    timestamp: new Date(),
    phase: conversation.phase,
    extractedData: aiResult.extractedData,
    suggestedActions: aiResult.suggestedActions,
  }
  conversation.messages.push(assistantMsg)

  // Check if phase is complete and advance if needed
  const phaseComplete = checkPhaseCompletion(conversation, phaseConfig)
  if (phaseComplete || aiResult.advancePhase) {
    await advanceToNextPhase(conversation)
  }

  // Save conversation
  await saveConversation(conversation)

  // Sync to user profile if onboarding is progressing
  await syncToUserProfile(conversation)

  return {
    message: aiResult.message,
    phase: conversation.phase,
    progress: calculateOverallProgress(conversation),
    suggestedActions: aiResult.suggestedActions || phaseConfig.suggestedActions,
    collectedData: conversation.collectedData,
    isComplete: conversation.phase === 'completion' && phaseComplete,
  }
}

/**
 * Generate the AI response for onboarding
 */
async function generateOnboardingResponse(
  conversation: OnboardingConversation,
  userMessage: string,
  phaseConfig: PhaseConfig,
  context: string
): Promise<{
  message: string
  extractedData?: Partial<CollectedOnboardingData>
  suggestedActions?: SuggestedAction[]
  advancePhase?: boolean
}> {
  // Build system prompt
  let systemPrompt = phaseConfig.systemPrompt.replace('{context}', context)

  if (conversation.collectedData.journey) {
    systemPrompt = systemPrompt.replace('{journey}', conversation.collectedData.journey)
  }

  // Add extraction instructions
  systemPrompt += `

IMPORTANT: After your conversational response, include a JSON block with any data you extracted:

<extracted>
{
  "firstName": "...",
  "company": "...",
  "journey": "buyer|seller|founder|jobs",
  "role": "...",
  "industry": "...",
  // ... any relevant fields
}
</extracted>

Also indicate if it's time to advance to the next phase:
<advance>true|false</advance>

Only advance when you've gathered the key information for this phase or the user wants to move on.`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: conversation.messages.slice(-10).map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })),
    })

    const textBlock = response.content.find(block => block.type === 'text')
    const fullResponse = textBlock?.type === 'text' ? textBlock.text : ''

    // Parse extracted data
    let extractedData: Partial<CollectedOnboardingData> | undefined
    const extractedMatch = fullResponse.match(/<extracted>([\s\S]*?)<\/extracted>/)
    if (extractedMatch) {
      try {
        extractedData = JSON.parse(extractedMatch[1])
      } catch (e) {
        console.error('[ConversationalOnboarding] Error parsing extracted data:', e)
      }
    }

    // Parse advance flag
    let advancePhase = false
    const advanceMatch = fullResponse.match(/<advance>(true|false)<\/advance>/)
    if (advanceMatch) {
      advancePhase = advanceMatch[1] === 'true'
    }

    // Get clean message (without extraction blocks)
    const message = fullResponse
      .replace(/<extracted>[\s\S]*?<\/extracted>/g, '')
      .replace(/<advance>.*?<\/advance>/g, '')
      .trim()

    // Generate contextual suggested actions
    const suggestedActions = generateSuggestedActions(
      conversation.phase,
      conversation.collectedData,
      extractedData
    )

    return {
      message,
      extractedData,
      suggestedActions,
      advancePhase,
    }
  } catch (error) {
    console.error('[ConversationalOnboarding] Error generating response:', error)

    // Fallback response
    return {
      message: "I'm having a moment - could you tell me that again?",
    }
  }
}

/**
 * Build context string from conversation data
 */
function buildConversationContext(conversation: OnboardingConversation): string {
  const data = conversation.collectedData
  const parts: string[] = []

  if (data.firstName) parts.push(`Name: ${data.preferredName || data.firstName}`)
  if (data.company) parts.push(`Company: ${data.company}`)
  if (data.role) parts.push(`Role: ${data.role}`)
  if (data.industry) parts.push(`Industry: ${data.industry}`)
  if (data.journey) parts.push(`Journey: ${data.journey}`)

  // Add journey-specific context
  if (data.founderProfile) {
    const fp = data.founderProfile
    if (fp.companyStage) parts.push(`Company Stage: ${fp.companyStage}`)
    if (fp.lookingFor) parts.push(`Looking for: ${fp.lookingFor.join(', ')}`)
  }

  if (data.buyerProfile) {
    const bp = data.buyerProfile
    if (bp.categories) parts.push(`Buying: ${bp.categories.join(', ')}`)
    if (bp.purchaseVolume) parts.push(`Volume: ${bp.purchaseVolume}`)
  }

  if (data.sellerProfile) {
    const sp = data.sellerProfile
    if (sp.productsServices) parts.push(`Selling: ${sp.productsServices.join(', ')}`)
  }

  if (data.jobsProfile) {
    const jp = data.jobsProfile
    if (jp.desiredRoles) parts.push(`Looking for: ${jp.desiredRoles.join(', ')}`)
    if (jp.skills) parts.push(`Skills: ${jp.skills.join(', ')}`)
  }

  // Recent conversation summary
  const recentMessages = conversation.messages.slice(-6)
  if (recentMessages.length > 0) {
    parts.push('\nRecent conversation:')
    recentMessages.forEach(m => {
      const preview = m.content.slice(0, 100)
      parts.push(`${m.role}: ${preview}${m.content.length > 100 ? '...' : ''}`)
    })
  }

  return parts.join('\n') || 'New user, no data collected yet.'
}

// ============================================================================
// PHASE MANAGEMENT
// ============================================================================

/**
 * Check if the current phase is complete
 */
function checkPhaseCompletion(
  conversation: OnboardingConversation,
  phaseConfig: PhaseConfig
): boolean {
  const data = conversation.collectedData

  // Check all required data is collected
  for (const field of phaseConfig.requiredData) {
    if (!data[field as keyof CollectedOnboardingData]) {
      return false
    }
  }

  return true
}

/**
 * Advance to the next phase
 */
async function advanceToNextPhase(conversation: OnboardingConversation): Promise<void> {
  // Mark current phase complete
  conversation.phaseProgress[conversation.phase].completed = true

  // Find next phase
  const currentIndex = PHASE_ORDER.indexOf(conversation.phase)
  if (currentIndex < PHASE_ORDER.length - 1) {
    conversation.phase = PHASE_ORDER[currentIndex + 1]
    conversation.phaseProgress[conversation.phase].started = true
  }
}

/**
 * Skip the current phase
 */
export async function skipCurrentPhase(userId: string): Promise<OnboardingResponse> {
  const conversation = await getOrCreateConversation(userId)
  const phaseConfig = PHASE_CONFIGS[conversation.phase]

  if (!phaseConfig.canSkip) {
    return {
      message: "I'd love to learn a bit more about this before we move on. It'll help me help you better!",
      phase: conversation.phase,
      progress: calculateOverallProgress(conversation),
      collectedData: conversation.collectedData,
      isComplete: false,
    }
  }

  // Mark as skipped
  conversation.phaseProgress[conversation.phase].skipped = true

  // Advance
  await advanceToNextPhase(conversation)
  await saveConversation(conversation)

  // Generate welcome message for new phase
  const newPhaseConfig = PHASE_CONFIGS[conversation.phase]

  return {
    message: `No problem! We can always come back to that later. ${newPhaseConfig.initialMessages?.[0] || "Let's move on!"}`,
    phase: conversation.phase,
    progress: calculateOverallProgress(conversation),
    suggestedActions: newPhaseConfig.suggestedActions,
    collectedData: conversation.collectedData,
    isComplete: false,
  }
}

/**
 * Calculate overall onboarding progress
 */
function calculateOverallProgress(conversation: OnboardingConversation): number {
  const completedPhases = Object.values(conversation.phaseProgress).filter(
    p => p.completed || p.skipped
  ).length

  return Math.round((completedPhases / PHASE_ORDER.length) * 100)
}

// ============================================================================
// SUGGESTED ACTIONS
// ============================================================================

/**
 * Generate contextual suggested actions
 */
function generateSuggestedActions(
  phase: ConversationPhase,
  currentData: CollectedOnboardingData,
  newData?: Partial<CollectedOnboardingData>
): SuggestedAction[] {
  const actions: SuggestedAction[] = []

  switch (phase) {
    case 'journey_selection':
      if (!currentData.journey && !newData?.journey) {
        actions.push(
          { type: 'button', label: "I'm buying", action: 'select_journey_buyer', primary: true },
          { type: 'button', label: "I'm selling", action: 'select_journey_seller' },
          { type: 'button', label: "I'm a founder", action: 'select_journey_founder' },
          { type: 'button', label: "I'm job searching", action: 'select_journey_jobs' }
        )
      }
      break

    case 'integrations':
      if (!currentData.connectedIntegrations?.length) {
        actions.push(
          { type: 'oauth', label: 'Connect Google Calendar', action: 'connect_google_calendar', primary: true },
          { type: 'oauth', label: 'Connect Slack', action: 'connect_slack' },
          { type: 'button', label: 'Skip for now', action: 'skip_phase' }
        )
      }
      break

    case 'treasury':
      if (!currentData.treasurySetupComplete) {
        actions.push(
          { type: 'button', label: 'Set Up GRAIN Wallet', action: 'setup_treasury', primary: true },
          { type: 'button', label: 'Skip for now', action: 'skip_phase' }
        )
      }
      break

    case 'preferences':
      if (!currentData.communicationStyle) {
        actions.push(
          { type: 'button', label: 'Casual', action: 'set_style_casual' },
          { type: 'button', label: 'Professional', action: 'set_style_professional', primary: true },
          { type: 'button', label: 'Formal', action: 'set_style_formal' }
        )
      }
      break

    case 'completion':
      const journey = currentData.journey
      if (journey === 'buyer') {
        actions.push(
          { type: 'button', label: 'Create my first RFQ', action: 'create_rfq', primary: true },
          { type: 'button', label: 'Explore suppliers', action: 'explore_suppliers' }
        )
      } else if (journey === 'seller') {
        actions.push(
          { type: 'button', label: 'View opportunities', action: 'view_rfqs', primary: true },
          { type: 'button', label: 'Set up my catalog', action: 'setup_catalog' }
        )
      } else if (journey === 'founder') {
        actions.push(
          { type: 'button', label: "Let's get started", action: 'founder_dashboard', primary: true },
          { type: 'button', label: 'Hire talent', action: 'post_job' },
          { type: 'button', label: 'Source products', action: 'create_rfq' }
        )
      } else if (journey === 'jobs') {
        actions.push(
          { type: 'button', label: 'Find jobs', action: 'search_jobs', primary: true },
          { type: 'button', label: 'Create job alerts', action: 'create_alerts' }
        )
      }
      break
  }

  return actions
}

// ============================================================================
// HELPERS
// ============================================================================

function getDefaultPreferences(): UserPreferences {
  return {
    communicationStyle: 'professional',
    responseLength: 'adaptive',
    proactivityLevel: 'moderate',
  }
}

function initializePhaseProgress(): Record<ConversationPhase, PhaseProgress> {
  const progress: Record<string, PhaseProgress> = {}

  for (const phase of PHASE_ORDER) {
    progress[phase] = {
      started: phase === 'greeting',
      completed: false,
      skipped: false,
      dataCollected: [],
    }
  }

  return progress as Record<ConversationPhase, PhaseProgress>
}

/**
 * Sync collected data to user profile
 */
async function syncToUserProfile(conversation: OnboardingConversation): Promise<void> {
  const data = conversation.collectedData

  // Update Clerk metadata
  try {
    const client = await clerkClient()
    await client.users.updateUserMetadata(conversation.userId, {
      publicMetadata: {
        onboardingPhase: conversation.phase,
        onboardingProgress: calculateOverallProgress(conversation),
        selectedJourney: data.journey,
        communicationStyle: data.communicationStyle,
        proactivityLevel: data.proactivityLevel,
      },
      privateMetadata: {
        company: data.company,
        role: data.role,
        industry: data.industry,
        founderProfile: data.founderProfile,
        buyerProfile: data.buyerProfile,
        sellerProfile: data.sellerProfile,
        jobsProfile: data.jobsProfile,
        autonomyLevel: data.autonomyLevel,
        negotiationLimits: data.negotiationLimits,
      },
    })
  } catch (error) {
    console.error('[ConversationalOnboarding] Error syncing to Clerk:', error)
  }
}

// ============================================================================
// RESPONSE TYPE
// ============================================================================

export interface OnboardingResponse {
  message: string
  phase: ConversationPhase
  progress: number
  suggestedActions?: SuggestedAction[]
  collectedData: CollectedOnboardingData
  isComplete: boolean
}

// ============================================================================
// INITIAL MESSAGE GENERATOR
// ============================================================================

/**
 * Generate the initial welcome message
 */
export async function generateWelcomeMessage(userId: string): Promise<OnboardingResponse> {
  const conversation = await getOrCreateConversation(userId)

  // If this is truly new, generate a personalized welcome
  if (conversation.messages.length === 0) {
    const firstName = conversation.collectedData.firstName || ''

    let welcomeMessage = firstName
      ? `Hi ${firstName}! I'm Wells, and I'm genuinely excited to meet you.`
      : `Hi there! I'm Wells, and I'm genuinely excited to meet you.`

    welcomeMessage += `

I'm here to help you succeed - whether that's finding the perfect suppliers, landing great customers, hiring amazing talent, or discovering your next role.

To make sure I can actually help you (and not just give generic advice), I'd love to learn a bit about you. What brings you to Wells AI today?`

    // Add welcome message to conversation
    const msg: OnboardingMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      role: 'assistant',
      content: welcomeMessage,
      timestamp: new Date(),
      phase: 'greeting',
    }
    conversation.messages.push(msg)
    await saveConversation(conversation)

    return {
      message: welcomeMessage,
      phase: 'greeting',
      progress: 0,
      collectedData: conversation.collectedData,
      isComplete: false,
    }
  }

  // Return last assistant message
  const lastAssistantMsg = [...conversation.messages]
    .reverse()
    .find(m => m.role === 'assistant')

  return {
    message: lastAssistantMsg?.content || 'How can I help you get started?',
    phase: conversation.phase,
    progress: calculateOverallProgress(conversation),
    suggestedActions: lastAssistantMsg?.suggestedActions,
    collectedData: conversation.collectedData,
    isComplete: conversation.phase === 'completion',
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const ConversationalOnboarding = {
  getOrCreateConversation,
  processOnboardingMessage,
  generateWelcomeMessage,
  skipCurrentPhase,
  saveConversation,
}

export default ConversationalOnboarding
