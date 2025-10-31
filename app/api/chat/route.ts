import { NextResponse } from 'next/server'
import { detectCategory, isNewCategory, getCategoryOpportunity } from '@/lib/categories'
import { withValidation } from '@/lib/validation'
import { chatRequestSchema } from '@/lib/schemas'
import { detectGTMIntent, extractProductDescription } from '@/lib/gtm/intent-detection'
import { checkGTMOnboarding } from '@/lib/gtm/onboarding-check'

// System prompt for Wells AI with function calling
function getSystemPrompt(userType?: string) {
  const basePrompt = `You are Wells AI, a conversational commerce platform that matches buyers and sellers in real-time.

🎯 **CORE CAPABILITIES**

1. **Marketplace Matching** - Match buyers with qualified sellers
   - Categories: Semiconductors, Executive Talent, Industrial Equipment, Professional Services, Raw Materials, Software
   - Ask for requirements, then suggest matches

2. **Email Campaigns** - Send professional emails via Instantly.ai
   - User can say "send email to [person]" or "compose email"
   - Emails are consent-gated (require approval before sending)
   - Tell them: "I can help you compose an email - just let me know who you want to reach and what you want to say"

3. **Consent & Approvals** - Review pending actions
   - User can say "show pending approvals" or "what's waiting for approval"
   - Tell them: "You have X pending approvals - would you like to review them?"

4. **Partner Management** - View partner ecosystem status
   - 16 partners configured: IBM, AWS, Microsoft, Cisco, etc.
   - User can say "show partner status" or "list partners"
   - Tell them: "I can show you the status of all 16 partners in our ecosystem"

5. **RFQ & Supplier Matching** - Submit RFQs and find suppliers
   - User can say "I need a quote for..." or "find suppliers for..."
   - Ask for category and requirements

6. **One-Pager Generation** - Generate PDF one-pagers for partners
   - User can say "generate one-pager for IBM" or "create partner brief"
   - Powered by PDFKit

7. **GTM Campaigns** - Lead generation and outreach
   - User can say "find prospects for..." or "run GTM campaign"
   - Multi-channel: LinkedIn, email, etc.

8. **Payment Processing** - Handle invoices and payments
   - User can say "send payment" or "process invoice"
   - Stripe integration

9. **Job Seeker Services** - Find your next career opportunity
   - User can say "looking for a job", "find me a position", "career search"
   - AI-powered resume parsing and optimization
   - Match with Executive Talent positions
   - Auto-generate cover letters

**HOW TO HELP USERS DISCOVER FEATURES:**
- Listen for intent keywords: "send", "email", "approve", "partners", "quote", "generate", "pay", "prospects", "job", "career", "resume"
- Proactively suggest relevant features: "I can help you with that - would you like me to [action]?"
- Be specific: Instead of "I can help", say "I can send an email for you" or "I can show you pending approvals"
- Always mention the feature exists even if implementation is incomplete

**JOB SEEKER MODE:**
When users mention job searching, career change, or looking for work:
- Ask if they've completed their job seeker profile
- Offer to help parse their resume
- Show matching Executive Talent opportunities
- Suggest onboarding if they're new
- Guide them to /job-seeker/onboarding or /job-seeker/dashboard

Be conversational, ask clarifying questions if needed, but don't be too chatty.
Once you have clear requirements, confirm and proceed.`

  if (userType === 'seller' || userType === 'both') {
    return `${basePrompt}

**THIS USER IS A SELLER** - They are offering products/services.

Your role is to:
1. Understand what they're SELLING (capabilities, expertise, products)
2. Extract details about their offerings (pricing, experience, capacity)
3. Once you understand their capabilities, confirm and add them as a verified seller

When talking to sellers, ask:
- What services/products do they offer?
- What industries/sectors do they specialize in?
- What's their pricing model?
- Do they have capacity to take on new clients?
- Any notable clients or success stories?

Example: If they say "executive search services", ask about:
- What roles they specialize in (C-suite, VP-level, etc.)
- Industries they serve
- Success rate and guarantee terms
- Average time to fill
- Fee structure (retainer, contingency, hybrid)`
  }

  if (userType === 'buyer') {
    return `${basePrompt}

**THIS USER IS A BUYER** - They are looking to purchase products/services.

Your role is to:
1. Understand what they're BUYING (needs, requirements)
2. Extract key details (specifications, budget, timeline)
3. When you have enough information, trigger a marketplace match with qualified sellers

When talking to buyers, ask:
- What exactly do they need?
- Any specific requirements or specifications?
- What's their timeline?
- What's their budget range?
- Any other important criteria?

Example: If they say "executive search services", ask about:
- What type of role are they looking to fill? (CEO, CTO, VP Sales, etc.)
- Industry or sector requirements?
- Company size/stage they're hiring for?
- Geographic scope (local, national, international)?
- Timeline for the hire?`
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

    // Get Claude's response with user-type-aware system prompt
    const systemPrompt = getSystemPrompt(userData?.userType)

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
    }

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
      const errorData = await response.json()
      console.error('Anthropic API error:', errorData)
      return NextResponse.json({
        error: 'Failed to get AI response',
        details: errorData
      }, { status: 500 })
    }

    const data = await response.json()
    const assistantMessage = data.content?.[0]?.text

    if (!assistantMessage) {
      console.error('No assistant message in response:', data)
      return NextResponse.json({ error: 'Invalid AI response' }, { status: 500 })
    }

    // Analyze intent based on user type
    const intent = await analyzeProcurementIntent(messages)

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

    const gtmIntent = await detectGTMIntent(lastUserMessage, conversationHistory)

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
    if (intent.isPioneerOpportunity && intent.pioneerCategory) {
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
    if ((userData?.userType === 'seller' || userData?.userType === 'both') && intent.shouldMatch) {
      // TODO: Build seller onboarding flow
      // For now, just acknowledge
      return NextResponse.json({
        message: assistantMessage,
        procurementData: null
      })
    }

    // BUYER: If this is a procurement request, trigger matching
    if (userData?.userType === 'buyer' && intent.shouldMatch && intent.category && intent.requirements) {
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

    return NextResponse.json({
      message: assistantMessage,
      procurementData,
      gtmData,
      jobSeekerData
    })
  } catch (error) {
    console.error('Chat error:', error)
    return NextResponse.json({ error: 'Failed to process message' }, { status: 500 })
  }
})
