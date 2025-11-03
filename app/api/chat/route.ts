import { NextResponse } from 'next/server'
import { detectCategory, isNewCategory, getCategoryOpportunity } from '@/lib/categories'
import { withValidation } from '@/lib/validation'
import { chatRequestSchema } from '@/lib/schemas'
import { detectGTMIntent, extractProductDescription } from '@/lib/gtm/intent-detection'
import { checkGTMOnboarding } from '@/lib/gtm/onboarding-check'
import { getWisdomSystemPrompt } from '@/lib/wisdom/principles'
import { detectSignupIntent, extractUserInfo, getNextPrompt, createUserInNotion, type ConversationState } from '@/lib/conversation-signup'

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

  const buyKeywords = ['need', 'looking for', 'buy', 'purchase', 'source', 'find', 'require']
  const hasBuyIntent = buyKeywords.some(keyword => text.includes(keyword))

  if (!hasBuyIntent) {
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

  // Standard category detection fallback
  let category = 'General'
  if (text.includes('semiconductor') || text.includes('chip') || text.includes('electronics')) {
    category = 'Semiconductors'
  } else if (text.includes('cto') || text.includes('cfo') || text.includes('executive') || text.includes('talent') || text.includes('hire')) {
    category = 'Executive Talent'
  } else if (text.includes('equipment') || text.includes('machinery')) {
    category = 'Industrial Equipment'
  } else if (text.includes('software') || text.includes('saas') || text.includes('technology')) {
    category = 'Software & Technology'
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

    // Get Claude's response with user-type-aware system prompt
    const systemPrompt = getSystemPrompt(userData?.userType)

    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('[CHAT] ANTHROPIC_API_KEY not configured')
      return NextResponse.json({ error: 'AI service not configured. Please contact support.' }, { status: 500 })
    }

    console.log('[CHAT] Sending request to Anthropic with', messages.length, 'messages')

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
        system: systemPrompt
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
    const assistantMessage = data.content?.[0]?.text

    if (!assistantMessage) {
      console.error('[CHAT] No assistant message in response:', data)
      return NextResponse.json({ error: 'Invalid response from AI service. Please try again.' }, { status: 500 })
    }

    console.log('[CHAT] Successfully got response from Claude')

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
        message: assistantMessage,
        procurementData: null,
        gtmData,
        pioneerOpportunity: {
          detected: true,
          category: intent.pioneerCategory,
          userRequest: intent.requirements
        }
      })
    }

    // SELLER: Add them to supplier database (we'll build this next)
    if ((userData?.userType === 'seller' || userData?.userType === 'both') && intent?.shouldMatch) {
      // TODO: Build seller onboarding flow
      // For now, just acknowledge
      return NextResponse.json({
        message: assistantMessage,
        procurementData: null
      })
    }

    // BUYER: If this is a procurement request, trigger matching
    if (userData?.userType === 'buyer' && intent?.shouldMatch && intent?.category && intent?.requirements) {
      try {
        // Match suppliers
        const matchResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/suppliers/match`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category: intent.category,
            requirements: intent.requirements,
            organizationId: organizationId || null
          })
        })

        const matchData = await matchResponse.json()

        if (matchData.success && matchData.suppliers.length > 0) {
          // Get buyer name from userData or use default
          const buyerName = userData?.name || userData?.company || 'Anonymous Buyer'

          // Notify suppliers via SMS
          const notifyResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/suppliers/notify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              supplierIds: matchData.suppliers.map((s: any) => s.id),
              buyerName: buyerName,
              requirements: intent.requirements,
              category: intent.category,
              organizationId: organizationId || null
            })
          })

          const notifyData = await notifyResponse.json()

          if (notifyData.success) {
            procurementData = {
              detected: true,
              requestId: notifyData.requestId,
              suppliersNotified: notifyData.notifications.length,
              category: intent.category
            }
          }
        }
      } catch (error) {
        console.error('Procurement matching error:', error)
        // Continue without procurement data if matching fails
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

    return NextResponse.json({
      message: assistantMessage,
      procurementData,
      gtmData,
      jobSeekerData,
      signupData
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
