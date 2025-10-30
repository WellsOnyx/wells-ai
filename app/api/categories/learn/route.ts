import { NextRequest, NextResponse } from 'next/server'
import { vectorDB, generateCategoryId, CategoryKnowledge } from '@/lib/vector-db'
import { monitorAPI } from '@/lib/monitoring'
import { cache, CacheKeys, CacheTTL } from '@/lib/cache'

/**
 * Category Learning API
 * Handles user-guided training to learn new product categories
 */
export async function POST(req: NextRequest) {
  const monitor = monitorAPI('/api/categories/learn', 'POST')

  try {
    const { userMessage, category, conversationId, mode } = await req.json()

    // Mode: 'detect' (check if we know the category) or 'train' (learn from user)
    if (mode === 'detect') {
      return await detectCategory(userMessage, conversationId)
    } else if (mode === 'train') {
      return await trainCategory(userMessage, category, conversationId)
    }

    monitor.end(false)
    return NextResponse.json({ error: 'Invalid mode' }, { status: 400 })
  } catch (error) {
    monitor.end(false)
    console.error('[API] Category learning error:', error)

    return NextResponse.json(
      {
        error: 'Failed to process category learning',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * Detect if we know about a category from user's message
 */
async function detectCategory(userMessage: string, conversationId: string) {
  const monitor = monitorAPI('detect_category', 'POST')

  try {
    // Search vector DB for matching categories
    const matchingCategories = await vectorDB.searchCategories(userMessage, 3)

    if (matchingCategories.length > 0 && matchingCategories[0]) {
      // We know this category!
      monitor.end(true, { known: true, category: matchingCategories[0].category })

      return NextResponse.json({
        known: true,
        category: matchingCategories[0],
        confidence: 'high',
        message: `I know about ${matchingCategories[0].category}! Let me find suppliers for you.`,
      })
    }

    // We don't know this category - start learning
    const learningQuestions = await generateLearningQuestions(userMessage)

    monitor.end(true, { known: false })

    return NextResponse.json({
      known: false,
      needsTraining: true,
      category: extractCategoryName(userMessage),
      message: learningQuestions.intro,
      questions: learningQuestions.questions,
      conversationId,
    })
  } catch (error) {
    monitor.end(false)
    throw error
  }
}

/**
 * Train on new category information from user
 */
async function trainCategory(userMessage: string, category: string, conversationId: string) {
  const monitor = monitorAPI('train_category', 'POST')

  try {
    // Use Claude to extract structured information
    const extraction = await extractCategoryKnowledge(userMessage, category)

    if (!extraction.complete) {
      // Need more information
      monitor.end(true, { complete: false })

      return NextResponse.json({
        complete: false,
        learned: extraction.learned,
        message: extraction.nextQuestion,
        progress: extraction.progress,
      })
    }

    // We have everything we need - store the knowledge
    const knowledge: CategoryKnowledge = {
      id: generateCategoryId(category, extraction.subcategory || undefined),
      category: category,
      subcategory: extraction.subcategory || undefined,
      specs: extraction.specs || [],
      pricingFactors: extraction.pricingFactors || [],
      leadTimeFactors: extraction.leadTimeFactors || [],
      commonSuppliers: extraction.commonSuppliers || [],
      qualityMetrics: extraction.qualityMetrics || [],
      learnedFrom: {
        conversationId,
        timestamp: new Date(),
      },
      examples: extraction.examples || [],
      metadata: {
        completedAt: new Date().toISOString(),
      },
    }

    // Store in vector DB
    await vectorDB.storeCategory(knowledge)

    // Invalidate category cache
    await cache.invalidateTag('categories')

    monitor.end(true, { complete: true, category })

    return NextResponse.json({
      complete: true,
      category: knowledge,
      message: `Perfect! I've learned about ${category}. ${extraction.summary} I'm ready to find suppliers now!`,
    })
  } catch (error) {
    monitor.end(false)
    throw error
  }
}

/**
 * Generate learning questions (simplified version)
 */
async function generateLearningQuestions(userMessage: string) {
  // TODO: Use Claude for better question generation
  const category = extractCategoryName(userMessage)

  return {
    category,
    intro: `I'm learning about ${category}. Help me understand it better so I can find the best suppliers for you:`,
    questions: [
      'What are the key specifications or technical requirements?',
      'What factors typically affect pricing?',
      'What are typical lead times for delivery?',
      'Are there quality certifications or standards required?',
      'Do you know of any common suppliers or manufacturers?',
      'What are typical order volumes or quantities?',
    ],
  }
}

/**
 * Extract category knowledge from user's teaching (simplified version)
 */
async function extractCategoryKnowledge(userMessage: string, category: string) {
  // TODO: Use Claude for better extraction
  // For now, simple parsing
  const message = userMessage.toLowerCase()

  // Extract basic information
  const specs: any[] = []
  const pricingFactors: string[] = []
  const leadTimeFactors: string[] = []
  const commonSuppliers: string[] = []
  const qualityMetrics: string[] = []
  const examples: string[] = []

  // Simple keyword extraction
  if (message.includes('spec') || message.includes('requirement')) {
    specs.push({
      key: 'General specifications',
      type: 'string',
      description: userMessage.substring(0, 100),
      required: true
    })
  }

  if (message.includes('price') || message.includes('cost') || message.includes('$')) {
    pricingFactors.push('Volume', 'Specifications', 'Lead time')
  }

  if (message.includes('week') || message.includes('day') || message.includes('month')) {
    leadTimeFactors.push('Standard', 'Rush available')
  }

  // Determine if we have enough info
  const progress = Math.min(
    (specs.length > 0 ? 30 : 0) +
    (pricingFactors.length > 0 ? 30 : 0) +
    (leadTimeFactors.length > 0 ? 20 : 0) +
    20, // Base for any response
    100
  )

  const complete = progress >= 70

  return {
    complete,
    progress,
    subcategory: null,
    specs,
    pricingFactors,
    leadTimeFactors,
    commonSuppliers,
    qualityMetrics,
    examples,
    learned: ['Basic category information', 'Initial specifications'],
    nextQuestion: complete
      ? ''
      : 'Can you provide more details about typical pricing ranges and lead times?',
    summary: complete
      ? `Great! I've learned about ${category}. I understand the specifications, pricing factors, and typical lead times.`
      : ''
  }
}

/**
 * Extract category name from user message
 */
function extractCategoryName(message: string): string {
  // Simple extraction - Claude would do this better
  const needMatch = message.match(/need\s+([^,\n]+)/i)
  const lookingMatch = message.match(/looking\s+for\s+([^,\n]+)/i)

  return needMatch?.[1]?.trim() || lookingMatch?.[1]?.trim() || 'Unknown Category'
}
