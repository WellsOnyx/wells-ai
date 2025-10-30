import { NextResponse } from 'next/server'
import { detectCategory, isNewCategory, getCategoryOpportunity } from '@/lib/categories'

// System prompt for Wells AI with function calling
function getSystemPrompt(userType?: string) {
  const basePrompt = `You are Wells AI, a conversational commerce platform that matches buyers and sellers in real-time.

Categories we support:
- Semiconductors & Electronics
- Executive Talent & Recruitment
- Industrial Equipment
- Professional Services
- Raw Materials
- Software & Technology

Be conversational, ask clarifying questions if needed, but don't be too chatty.
Once you have clear requirements, confirm and proceed with the match.`

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

export async function POST(request: Request) {
  try {
    const { messages, userData } = await request.json()

    // Get Claude's response with user-type-aware system prompt
    const systemPrompt = getSystemPrompt(userData?.userType)

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: messages,
        system: systemPrompt
      })
    })

    const data = await response.json()
    const assistantMessage = data.content?.[0]?.text || 'Error processing request'

    // Analyze intent based on user type
    const intent = await analyzeProcurementIntent(messages)

    let procurementData = null
    let pioneerData = null

    // CHECK FOR CATEGORY PIONEER OPPORTUNITY FIRST
    if (intent.isPioneerOpportunity && intent.pioneerCategory) {
      return NextResponse.json({
        message: assistantMessage,
        procurementData: null,
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
            requirements: intent.requirements
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
              category: intent.category
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
      procurementData
    })
  } catch (error) {
    console.error('Chat error:', error)
    return NextResponse.json({ error: 'Failed to process message' }, { status: 500 })
  }
}
