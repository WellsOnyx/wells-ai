import { NextResponse } from 'next/server'
import { detectCategory, isNewCategory, getCategoryOpportunity } from '@/lib/categories'
import { withValidation } from '@/lib/validation'
import { chatRequestSchema } from '@/lib/schemas'
import { detectGTMIntent, extractProductDescription } from '@/lib/gtm/intent-detection'
import { checkGTMOnboarding } from '@/lib/gtm/onboarding-check'
import { getWisdomSystemPrompt } from '@/lib/wisdom/principles'
import { detectSignupIntent, extractUserInfo, getNextPrompt, createUserInNotion, type ConversationState } from '@/lib/conversation-signup'
import { EMAIL_TOOL_DEFINITION, type SendEmailInput } from '@/lib/tools/email'
import { sendEmail } from '@/lib/resend-email'
import { getSession } from '@/lib/auth'
import { notifyDealRequest, extractDealDetails } from '@/lib/notifications'
import { moderateContent } from '@/lib/content-moderation'
import {
  detectSellerIntent,
  getSellerOnboardingQuestions,
  createSellerProfile,
  getSellerWelcomeMessage,
  type SellerProfile
} from '@/lib/seller-onboarding'
import { createSellerProfile as saveSellerProfile, getSellerProfileByUserId } from '@/lib/db/seller-helpers'
// Onboarding imports temporarily disabled
// import {
//   createOnboardingState,
//   updateOnboardingState,
//   isOnboardingComplete,
//   type OnboardingState
// } from '@/lib/legendary-onboarding'
// Memory system enabled with Prisma database
import {
  buildConversationContext,
  formatContextForPrompt,
  getOrCreateConversation,
  storeMessage,
  updateConversationMetrics,
  updateUserContext,
  extractAndStoreContext
} from '@/lib/memory'

// System prompt for Wells AI with function calling
function getSystemPrompt(userType?: string) {
  const basePrompt = `You are Wells, an AI that helps people and companies connect to get things done.

${getWisdomSystemPrompt()}

**YOUR PERSONALITY:**
You're consultative, curious, and helpful. You build relationships through discovery, not transactions. You listen more than you pitch.

**RESPONSE FORMAT - ALWAYS USE THIS STRUCTURE:**
Every response should have:
- 2-3 concise points (acknowledgment, insight, or value)
- 1 question to deepen understanding or move forward

Example:
"I can help you find the right CFO for your company. From what you've shared, it sounds like you need someone with both startup experience and financial discipline.

What's the biggest challenge your finance team is facing right now?"

**CRITICAL: IN-CONVERSATION CONVERSION - NO LINKS/FORMS:**
When a user wants to sign up or take action, collect the info conversationally and create their account PROGRAMMATICALLY. Never send them anywhere.

Example flow:
User: "I want to sign up"
Wells: "Perfect! What's your name?"
User: "John Smith"
Wells: "And your email?"
User: "john@example.com"
Wells: "Great! Are you buying, selling, or both?"
User: "Selling"
Wells: "You're all set! Account created. What do you sell?"

Once you have name + email + userType, their account is automatically created. Keep the conversation flowing - never redirect them.

**DISCOVERY PROCESS:**
1. **Understand context first** - What are they trying to achieve? Why does it matter?
2. **Ask clarifying questions** - Get specific about requirements, constraints, timeline
3. **Surface what you can do naturally** - When relevant, mention capabilities without forcing them
4. **Guide toward action** - Once you have enough context, suggest next steps

**WHAT YOU CAN DO:**
- Match buyers with suppliers (semiconductors, executive talent, equipment, services)
- Help companies find customers (GTM campaigns, lead gen, outreach)
- Connect job seekers with executive opportunities
- Send emails, generate proposals, create one-pagers
- Process RFQs and manage supplier relationships

**EMAIL CAPABILITY:**
You can send emails on behalf of the user using the send_email tool. When they ask you to send an email:
1. If you have recipient, subject, and message - use the send_email tool immediately
2. If missing information, ask for it conversationally first
3. After using the tool, confirm the email was sent

The email will be sent from the user's authenticated email address (from their Clerk login).

**CONVERSATION STYLE:**
- Keep responses SHORT - 2-3 sentences per point, max 5 sentences total
- Ask ONE good question per response
- Don't list features - discover needs first
- Use natural language, not bullet points in actual responses
- Be warm but professional

**DISCOVERY QUESTIONS TO ASK:**
- "What are you trying to accomplish?"
- "What's the timeline you're working with?"
- "What's worked or not worked for you in the past?"
- "What would success look like?"
- "What's the biggest challenge right now?"

Remember: Build the relationship through questions. Understand before you act.`

  if (userType === 'seller' || userType === 'both') {
    return `${basePrompt}

**CONTEXT: This user is a SELLER/SUPPLIER**

They're here to offer their products or services. Your job is to understand what they do and help them get discovered by the right buyers.

**Discovery questions for sellers:**
- "What do you specialize in?" (capabilities, expertise, products)
- "Who's your ideal client?" (industries, company size, use cases)
- "What makes your offering different?"
- "What's your capacity like right now?"
- "How do you typically work with clients?" (pricing, engagement model)

Once you understand their value proposition, you can suggest adding them to the marketplace.`
  }

  if (userType === 'buyer') {
    return `${basePrompt}

**CONTEXT: This user is a BUYER**

They're looking for products, services, or talent. Your job is to understand what they need and connect them with the right suppliers.

**Discovery questions for buyers:**
- "What are you looking for?" (product, service, role to fill)
- "What problem are you trying to solve?"
- "What's your timeline?"
- "What's worked or not worked for you before?"
- "Any specific requirements or constraints?"

Once you have enough context, you can match them with qualified sellers from the marketplace.`
  }

  return basePrompt
}

interface ProcurementIntent {
  shouldMatch: boolean
  category?: string
  requirements?: string
  buyerName?: string
  isPioneerOpportunity?: boolean
  pioneerCategory?: any
}

// Analyze if the conversation indicates a procurement request
async function analyzeProcurementIntent(messages: any[]): Promise<ProcurementIntent> {
  const lastMessage = messages[messages.length - 1]
  const text = lastMessage.content.toLowerCase()

  // Enhanced procurement keywords - broader detection
  const procurementKeywords = [
    'need to source',
    'get quotes',
    'find suppliers',
    'rfq for',
    'request for quote',
    'looking for',
    'need',
    'buy',
    'purchase',
    'source',
    'find',
    'require',
    'procure',
    'vendor',
    'supplier'
  ]

  const hasProcurementIntent = procurementKeywords.some(keyword => text.includes(keyword))

  if (!hasProcurementIntent) {
    return { shouldMatch: false }
  }

  // Use enhanced category detection
  const detectedCategory = detectCategory(text)

  // Check if this is a Category Pioneer opportunity
  if (detectedCategory && isNewCategory(detectedCategory)) {
    const categorySlug = detectedCategory.replace('new:', '')
    const pioneerCategory = getCategoryOpportunity(categorySlug)

    if (pioneerCategory) {
      return {
        shouldMatch: false, // Don't trigger normal matching
        isPioneerOpportunity: true,
        pioneerCategory,
        requirements: lastMessage.content
      }
    }
  }

  // Standard category detection with broader coverage
  let category = 'General'
  if (text.includes('semiconductor') || text.includes('chip') || text.includes('electronics') || text.includes('circuit') || text.includes('pcb')) {
    category = 'Electronics'
  } else if (text.includes('cto') || text.includes('cfo') || text.includes('executive') || text.includes('talent') || text.includes('hire') || text.includes('recruiting')) {
    category = 'Executive Talent'
  } else if (text.includes('equipment') || text.includes('machinery') || text.includes('manufacturing')) {
    category = 'Manufacturing'
  } else if (text.includes('software') || text.includes('saas') || text.includes('technology') || text.includes('it services')) {
    category = 'IT Services'
  } else if (text.includes('office') || text.includes('supplies') || text.includes('furniture')) {
    category = 'Office Supplies'
  } else if (text.includes('marketing') || text.includes('advertising') || text.includes('design')) {
    category = 'Marketing'
  }

  return {
    shouldMatch: true,
    category,
    requirements: lastMessage.content,
    buyerName: 'Anonymous Buyer'
  }
}

export const POST = withValidation(chatRequestSchema, async (request) => {
  try {
    const { messages, userData } = request.validatedBody
    const organizationId = null // Not in schema yet, will be added later for org support

    // Validate messages array
    if (!Array.isArray(messages) || messages.length === 0) {
      console.error('[CHAT] Invalid messages array:', messages)
      return NextResponse.json({
        error: 'Messages array is required and must contain at least one message'
      }, { status: 400 })
    }

    // LEGENDARY ONBOARDING: Temporarily disabled until full integration is complete
    // TODO: Properly integrate legendary onboarding system
    // The onboarding system requires:
    // 1. Getting Claude's response first
    // 2. Parsing the response to determine if phase should advance
    // 3. Updating state with both user message and Wells' response
    /*
    let onboardingState: OnboardingState | undefined = userData?.onboardingState
    if (!onboardingState) {
      const sessionId = userData?.userId || `session-${Date.now()}-${Math.random().toString(36).substring(7)}`
      onboardingState = createOnboardingState(sessionId)
    }
    if (!isOnboardingComplete(onboardingState)) {
      // Need to implement full onboarding flow with Claude integration
    }
    */

    // AUTHENTICATION CHECK: Prompt anonymous users to sign in for cross-device sync
    const isAnonymous = userData?.userId?.startsWith('anon-') || !userData?.userId
    const messageCount = messages.length / 2 // Approximate conversation turns

    // Trigger auth prompt after 3+ messages for anonymous users
    if (isAnonymous && messageCount >= 3) {
      console.log('[AUTH] Anonymous user detected after', messageCount, 'turns - prompting for authentication')

      return NextResponse.json({
        message: "I'd love to help you with that! To ensure I can remember our conversation and sync it across all your devices, I'll need your email address.",
        authPrompt: {
          type: 'email_auth',
          data: {
            reason: 'Sign in to sync your conversations across all devices and unlock secure transactions',
            benefits: [
              'Access your chats on any device (desktop, mobile, tablet)',
              'Secure your conversation history permanently',
              'Enable transaction capabilities (payments, contracts, deals)',
              'Get personalized recommendations based on your history'
            ]
          }
        }
      })
    }

    // MEMORY SYSTEM: Build conversation context
    let memoryContext = ''
    let conversationId: string | undefined

    if (userData?.userId) {
      try {
        // Generate session ID if not provided
        // Use daily session to enable cross-device conversation continuity
        const sessionId = userData.sessionId || `session-${userData.userId}-${new Date().toISOString().split('T')[0]}`

        // Get or create conversation
        const conversation = await getOrCreateConversation({
          userId: userData.userId,
          sessionId,
          device: userData.device,
          source: userData.source
        }, undefined) // onboardingState temporarily disabled

        conversationId = conversation.id

        // Build context from memory
        const context = await buildConversationContext(userData.userId, sessionId)
        memoryContext = formatContextForPrompt(context)

        console.log('[MEMORY] Loaded conversation context for user:', userData.userId)
      } catch (error) {
        console.error('[MEMORY] Failed to load context (non-critical):', error)
        // Continue without memory if it fails
      }
    }

    // Get Claude's response with user-type-aware system prompt + memory context
    let systemPrompt = getSystemPrompt(userData?.userType)

    if (memoryContext) {
      systemPrompt = `${systemPrompt}\n\n---\n\n## YOUR MEMORY\n\n${memoryContext}\n\nUse this context naturally in conversation. Don't announce that you're remembering - just show it through your responses.`
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('[CHAT] ANTHROPIC_API_KEY not configured')
      return NextResponse.json({ error: 'AI service not configured. Please contact support.' }, { status: 500 })
    }

    console.log('[CHAT] Sending request to Anthropic with', messages.length, 'messages')

    // Call Claude with tools
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: messages,
        system: systemPrompt,
        tools: [EMAIL_TOOL_DEFINITION]
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      console.error('[CHAT] Anthropic API error:', errorData)
      return NextResponse.json({
        error: 'AI service temporarily unavailable. Please try again.',
        details: process.env.NODE_ENV === 'development' ? errorData : undefined
      }, { status: 500 })
    }

    const data = await response.json()

    // Check if Claude wants to use a tool
    const toolUseBlock = data.content?.find((block: any) => block.type === 'tool_use')

    if (toolUseBlock && toolUseBlock.name === 'send_email') {
      console.log('[TOOL] Claude is using send_email tool:', toolUseBlock.input)

      // TODO: Re-enable auth once NextAuth is fully configured
      // For now, chat API is public so skip auth requirement
      const userEmail = undefined  // session?.user?.email || undefined
      const userName = undefined  // session?.user?.name || undefined

      // Skip auth requirement for now
      if (false && !userEmail) {
        console.error('[TOOL] No user email found - user must be logged in to send emails')
        const toolInput = toolUseBlock.input as SendEmailInput

        // Return error to Claude
        const toolResultMessages = [
          ...messages,
          {
            role: 'assistant',
            content: data.content
          },
          {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: toolUseBlock.id,
                content: JSON.stringify({
                  success: false,
                  error: 'User must be logged in to send emails. Please sign in to continue.'
                })
              }
            ]
          }
        ]

        // Get final response from Claude with the error
        const finalResponse = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.ANTHROPIC_API_KEY || '',
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 4096,
            messages: toolResultMessages,
            tools: EMAIL_TOOL_DEFINITION
          }),
        })

        const finalData = await finalResponse.json()
        return NextResponse.json({ response: finalData.content[0].text })
      }

      console.log('[TOOL] Sending email from:', userEmail)

      // Execute the email send directly
      const toolInput = toolUseBlock.input as SendEmailInput
      const emailResult = await sendEmail({
        to: toolInput.to,
        toName: toolInput.toName,
        subject: toolInput.subject,
        text: toolInput.message,
        from: userEmail, // Use authenticated user's email
        fromName: userName
      })

      console.log('[TOOL] Email send result:', emailResult)

      // Send tool result back to Claude
      const toolResultMessages = [
        ...messages,
        {
          role: 'assistant',
          content: data.content
        },
        {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: toolUseBlock.id,
              content: JSON.stringify(emailResult)
            }
          ]
        }
      ]

      // Get Claude's final response
      const finalResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          messages: toolResultMessages,
          system: systemPrompt,
          tools: [EMAIL_TOOL_DEFINITION]
        })
      })

      if (!finalResponse.ok) {
        const errorData = await finalResponse.json().catch(() => ({ error: 'Unknown error' }))
        console.error('[CHAT] Anthropic API error on final response:', errorData)
        return NextResponse.json({
          error: 'AI service temporarily unavailable. Please try again.',
          details: process.env.NODE_ENV === 'development' ? errorData : undefined
        }, { status: 500 })
      }

      const finalData = await finalResponse.json()
      const assistantMessage = finalData.content?.find((block: any) => block.type === 'text')?.text

      if (!assistantMessage) {
        console.error('[CHAT] No text message in final response:', finalData)
        return NextResponse.json({ error: 'Invalid response from AI service. Please try again.' }, { status: 500 })
      }

      console.log('[CHAT] Successfully got final response from Claude after tool use')

      // Continue with normal flow below, using assistantMessage
      // Store this for the rest of the function
      var finalAssistantMessage = assistantMessage
    } else {
      // No tool use - extract text response normally
      const assistantMessage = data.content?.find((block: any) => block.type === 'text')?.text

      if (!assistantMessage) {
        console.error('[CHAT] No assistant message in response:', data)
        return NextResponse.json({ error: 'Invalid response from AI service. Please try again.' }, { status: 500 })
      }

      console.log('[CHAT] Successfully got response from Claude')
      var finalAssistantMessage = assistantMessage
    }

    // CONTENT MODERATION: Block illegal activities FIRST (before any intent detection)
    const moderationResult = moderateContent(lastUserMessage)
    if (!moderationResult.allowed) {
      console.log('[MODERATION] Blocked request:', {
        category: moderationResult.category,
        severity: moderationResult.severity,
        confidence: moderationResult.confidence
      })

      return NextResponse.json({
        message: moderationResult.reason || "I can't help with that request. Wells is designed for legitimate B2B commerce only.",
        moderation: {
          blocked: true,
          category: moderationResult.category,
          severity: moderationResult.severity
        }
      })
    }

    // Analyze intent based on user type
    let intent = null
    try {
      intent = await analyzeProcurementIntent(messages)
    } catch (error) {
      console.error('[CHAT] Intent analysis failed (non-critical):', error)
      intent = null
    }

    let procurementData = null
    let pioneerData = null
    let gtmData = null
    let jobSeekerData = null

    // CHECK FOR GTM INTENT (sales, leads, customers)
    const lastUserMessage = messages[messages.length - 1]?.content || ''
    const conversationHistory = messages.map((m: any) => m.content)

    // CHECK FOR JOB SEEKER INTENT (career, job search, resume)
    const jobSeekerKeywords = ['job', 'career', 'resume', 'looking for work', 'find a job', 'hire me', 'employment', 'position']
    const hasJobSeekerIntent = jobSeekerKeywords.some(keyword =>
      lastUserMessage.toLowerCase().includes(keyword)
    )

    if (hasJobSeekerIntent) {
      console.log('[JOB SEEKER] Intent detected')

      // Check if user has profile
      if (userData?.userId) {
        try {
          const profileCheck = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/job-seeker/profile`, {
            headers: {
              'Cookie': request.headers.get('cookie') || ''
            }
          })
          const profileData = await profileCheck.json()

          if (profileData.success) {
            // User has profile - show matches
            const matchCheck = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/job-seeker/match`, {
              headers: {
                'Cookie': request.headers.get('cookie') || ''
              }
            })
            const matchData = await matchCheck.json()

            jobSeekerData = {
              hasProfile: true,
              matchCount: matchData.success ? matchData.count : 0,
              topMatches: matchData.success ? matchData.matches.slice(0, 3) : []
            }
          } else {
            // User doesn't have profile
            jobSeekerData = {
              hasProfile: false,
              needsOnboarding: true
            }
          }
        } catch (error) {
          console.error('[JOB SEEKER] Error checking profile:', error)
          jobSeekerData = {
            hasProfile: false,
            needsOnboarding: true
          }
        }
      } else {
        // Not logged in
        jobSeekerData = {
          hasProfile: false,
          needsLogin: true
        }
      }
    }

    let gtmIntent = null
    try {
      gtmIntent = await detectGTMIntent(lastUserMessage, conversationHistory)
    } catch (error) {
      console.error('[CHAT] GTM intent detection failed (non-critical):', error)
      gtmIntent = { isGTMRequest: false, confidence: 0 }
    }

    if (gtmIntent.isGTMRequest && gtmIntent.confidence > 0.6) {
      console.log('[GTM] Intent detected:', gtmIntent)

      // Check if user has GTM set up
      if (userData?.userId) {
        try {
          const onboardingStatus = await checkGTMOnboarding(userData.userId)

          if (onboardingStatus.isComplete) {
            // User is onboarded - offer to create campaign
            gtmData = {
              detected: true,
              intent: gtmIntent,
              onboardingComplete: true,
              canSendEmails: onboardingStatus.canSendEmails,
              canSendSMS: onboardingStatus.canSendSMS,
              usingWellsStack: onboardingStatus.usingWellsStack
            }
          } else {
            // User NOT onboarded - show what's missing
            gtmData = {
              detected: true,
              intent: gtmIntent,
              onboardingComplete: false,
              missingSteps: onboardingStatus.missingSteps
            }
          }
        } catch (error) {
          console.error('[GTM] Onboarding check error:', error)
          // User not logged in or error - tell them to log in
          gtmData = {
            detected: true,
            intent: gtmIntent,
            onboardingComplete: false,
            needsLogin: true
          }
        }
      } else {
        // No user ID - not logged in
        gtmData = {
          detected: true,
          intent: gtmIntent,
          onboardingComplete: false,
          needsLogin: true
        }
      }
    }

    // CHECK FOR CATEGORY PIONEER OPPORTUNITY FIRST
    if (intent?.isPioneerOpportunity && intent?.pioneerCategory) {
      return NextResponse.json({
        message: finalAssistantMessage,
        procurementData: null,
        gtmData,
        pioneerOpportunity: {
          detected: true,
          category: intent.pioneerCategory,
          userRequest: intent.requirements
        }
      })
    }

    // CHECK FOR SELLER INTENT: Detect if user wants to sell products/services
    let sellerData = null
    const sellerIntent = detectSellerIntent(lastUserMessage, conversationHistory)

    if (sellerIntent.detected && sellerIntent.confidence > 0.7 && userData?.userId) {
      console.log('[SELLER] Intent detected:', sellerIntent)

      try {
        // Check if seller already has profile
        const existingProfile = await getSellerProfileByUserId(userData.userId)

        if (existingProfile) {
          // Seller already onboarded - provide marketplace status
          sellerData = {
            detected: true,
            hasProfile: true,
            profile: {
              companyName: existingProfile.companyName,
              categories: existingProfile.categories,
              products: existingProfile.products,
              verified: existingProfile.verified,
              completedDeals: existingProfile.completedDeals,
              rating: existingProfile.rating
            }
          }
        } else {
          // New seller - start onboarding
          // Build partial profile from conversation so far
          const partialProfile: Partial<SellerProfile> = {
            userId: userData.userId,
            email: sellerIntent.extractedInfo.email,
            phone: sellerIntent.extractedInfo.phone,
            products: sellerIntent.products || []
          }

          // Get next onboarding question
          const nextQuestion = getSellerOnboardingQuestions(partialProfile)

          if (nextQuestion) {
            // Still collecting info
            sellerData = {
              detected: true,
              hasProfile: false,
              onboarding: {
                currentField: nextQuestion.field,
                question: nextQuestion.question,
                type: nextQuestion.type,
                options: nextQuestion.options,
                progress: Object.keys(partialProfile).length / 8 // ~8 required fields
              }
            }
          } else {
            // All info collected - create profile
            const profile = createSellerProfile(partialProfile)
            await saveSellerProfile(profile)

            const welcomeMessage = getSellerWelcomeMessage(profile)

            sellerData = {
              detected: true,
              hasProfile: true,
              justOnboarded: true,
              welcomeMessage,
              profile: {
                companyName: profile.companyName,
                categories: profile.categories,
                products: profile.products
              }
            }
          }
        }
      } catch (error) {
        console.error('[SELLER] Profile creation error:', error)
        sellerData = {
          detected: true,
          hasProfile: false,
          error: 'Failed to create seller profile. Please try again.'
        }
      }
    }

    // PROCUREMENT FLOW: Start supplier outreach immediately, continue conversation
    if (intent?.shouldMatch && intent?.category && intent?.requirements) {
      console.log('[PROCUREMENT] Intent detected:', intent)

      const requestId = `req_${Date.now()}`

      // NOTIFY JONAH IMMEDIATELY (non-blocking)
      try {
        const dealDetails = extractDealDetails(messages, { ...intent, requestId }, userData)
        notifyDealRequest(dealDetails).catch(err => {
          console.error('[NOTIFICATIONS] Failed to notify (non-critical):', err)
        })
        console.log('[NOTIFICATIONS] Deal request notification sent for:', requestId)
      } catch (error) {
        console.error('[NOTIFICATIONS] Failed to extract deal details (non-critical):', error)
      }

      // Immediately kick off supplier pings in background (async, non-blocking)
      fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/procurement/ping-suppliers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId,
          category: intent.category,
          description: intent.requirements,
          buyerContext: lastUserMessage
        })
      }).catch(err => console.error('[PROCUREMENT] Supplier ping failed:', err))

      // Return conversational response indicating we're working on it
      procurementData = {
        detected: true,
        sourcing: true,
        requestId,
        category: intent.category,
        suppliersContacted: 0, // Will be updated via webhook/polling
        status: 'reaching_out'
      }
    }

    // CHECK FOR IN-CONVERSATION SIGNUP (stateless - analyzes conversation history)
    let signupData = null
    try {
      const allMessages = messages.map((m: any) => m.content).join('\n')

      // Detect signup intent in conversation
      if (detectSignupIntent(lastUserMessage) || allMessages.includes("What's your name")) {
        // Analyze conversation to extract collected info
        const conversationState: ConversationState = {
          step: 'idle',
          sessionId: crypto.randomUUID()
        }

        // Look for name in conversation (after "What's your name?")
        const nameMatch = allMessages.match(/What's your name\?[\s\S]*?User:?\s*([^\n]+)/i)
        if (nameMatch && nameMatch[1] && !nameMatch[1].includes('@')) {
          conversationState.name = nameMatch[1].trim()
          conversationState.step = 'collecting_email'
        }

        // Look for email
        const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/
        const emailMatch = allMessages.match(emailRegex)
        if (emailMatch && conversationState.name) {
          conversationState.email = emailMatch[0]
          conversationState.step = 'collecting_type'
        }

        // Look for user type
        if (conversationState.email) {
          const lower = allMessages.toLowerCase()
          if (lower.includes('buy') && !lower.includes('seller')) {
            conversationState.userType = 'buyer'
            conversationState.step = 'complete'
          } else if (lower.includes('sell') && !lower.includes('buyer')) {
            conversationState.userType = 'seller'
            conversationState.step = 'complete'
          } else if (lower.includes('both')) {
            conversationState.userType = 'both'
            conversationState.step = 'complete'
          }
        }

        // If complete, create user
        if (conversationState.step === 'complete' && conversationState.name && conversationState.email && conversationState.userType) {
          const created = await createUserInNotion(conversationState)
          if (created) {
            console.log('[CONVERSATION_SIGNUP] User created:', conversationState.email)
            signupData = {
              success: true,
              user: {
                name: conversationState.name,
                email: conversationState.email,
                userType: conversationState.userType
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('[CONVERSATION_SIGNUP] Error:', error)
      // Continue without signup data if it fails
    }

    // MEMORY SYSTEM: Store messages after successful response
    if (conversationId && userData?.userId) {
      try {
        // Store user message
        await storeMessage(conversationId, {
          role: 'user',
          content: lastUserMessage
        })

        // Store assistant message
        await storeMessage(conversationId, {
          role: 'assistant',
          content: finalAssistantMessage
        })

        // Extract and store context for learning
        await extractAndStoreContext(
          userData.userId,
          conversationId,
          lastUserMessage,
          finalAssistantMessage
        )

        // Update user context if onboarding just completed
        // TODO: Re-enable when onboarding is fully integrated
        /* if (onboardingState?.phase === 'complete' && onboardingState.name) {
          await updateUserContext(userData.userId, {
            name: onboardingState.name,
            preferredName: onboardingState.preferredName,
            email: onboardingState.email,
            userType: onboardingState.userType,
            company: onboardingState.company,
            painPoints: onboardingState.painPoint ? [onboardingState.painPoint] : undefined,
            goals: onboardingState.goal ? [onboardingState.goal] : undefined
          })
        } */

        console.log('[MEMORY] Messages stored successfully')
      } catch (error) {
        console.error('[MEMORY] Failed to store messages (non-critical):', error)
        // Continue - don't fail the request if memory storage fails
      }
    }

    return NextResponse.json({
      message: finalAssistantMessage,
      procurementData,
      gtmData,
      jobSeekerData,
      signupData,
      sellerData
    })
  } catch (error: any) {
    console.error('[CHAT] Unexpected error:', error)
    console.error('[CHAT] Error stack:', error.stack)
    return NextResponse.json({
      error: 'An unexpected error occurred. Please try again.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 })
  }
})
