import { Pinecone } from '@pinecone-database/pinecone'
import OpenAI from 'openai'
import { monitorDB } from './monitoring'

/**
 * Vector Database for Category Learning
 * Stores product category knowledge, specs, pricing, and supplier info
 */

// Initialize clients
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
})

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY, // Fallback
})

// Index name for category knowledge
const INDEX_NAME = 'wells-ai-categories'

/**
 * Category knowledge structure
 */
export interface CategoryKnowledge {
  id: string
  category: string
  subcategory?: string
  specs: {
    key: string
    type: 'string' | 'number' | 'range' | 'enum'
    description: string
    required: boolean
    options?: string[]
  }[]
  pricingFactors: string[]
  leadTimeFactors: string[]
  commonSuppliers: string[]
  qualityMetrics: string[]
  learnedFrom: {
    userId?: string
    timestamp: Date
    conversationId?: string
  }
  examples: string[]
  metadata: Record<string, any>
}

/**
 * Supplier knowledge for a category
 */
export interface SupplierCategoryKnowledge {
  supplierId: string
  category: string
  capabilities: string[]
  typicalSpecs: Record<string, any>
  pricingRange: {
    min: number
    max: number
    unit: string
  }
  leadTime: {
    typical: string
    rush: string
  }
  minimumOrder?: string
  certifications: string[]
}

/**
 * Generate embedding for text using OpenAI
 */
async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    })
    return response.data[0].embedding
  } catch (error) {
    console.error('[VECTOR_DB] Embedding generation error:', error)
    throw error
  }
}

/**
 * Vector Database Manager
 */
export class VectorDB {
  private index: any

  async initialize() {
    try {
      this.index = pinecone.index(INDEX_NAME)
      console.log('[VECTOR_DB] Initialized')
    } catch (error) {
      console.error('[VECTOR_DB] Initialization error:', error)
      throw error
    }
  }

  /**
   * Store category knowledge
   */
  async storeCategory(knowledge: CategoryKnowledge): Promise<void> {
    const monitor = monitorDB('store_category')

    try {
      if (!this.index) await this.initialize()

      // Create searchable text from knowledge
      const searchText = `
        Category: ${knowledge.category}
        Subcategory: ${knowledge.subcategory || 'N/A'}
        Specs: ${knowledge.specs.map(s => `${s.key}: ${s.description}`).join(', ')}
        Pricing Factors: ${knowledge.pricingFactors.join(', ')}
        Lead Time Factors: ${knowledge.leadTimeFactors.join(', ')}
        Examples: ${knowledge.examples.join(', ')}
      `.trim()

      // Generate embedding
      const embedding = await generateEmbedding(searchText)

      // Store in Pinecone
      await this.index.upsert([
        {
          id: knowledge.id,
          values: embedding,
          metadata: {
            category: knowledge.category,
            subcategory: knowledge.subcategory,
            type: 'category_knowledge',
            data: JSON.stringify(knowledge),
            learnedAt: knowledge.learnedFrom.timestamp.toISOString(),
          },
        },
      ])

      monitor.end(true)
    } catch (error) {
      monitor.end(false)
      throw error
    }
  }

  /**
   * Store supplier-category knowledge
   */
  async storeSupplierKnowledge(knowledge: SupplierCategoryKnowledge): Promise<void> {
    const monitor = monitorDB('store_supplier_knowledge')

    try {
      if (!this.index) await this.initialize()

      const searchText = `
        Supplier: ${knowledge.supplierId}
        Category: ${knowledge.category}
        Capabilities: ${knowledge.capabilities.join(', ')}
        Certifications: ${knowledge.certifications.join(', ')}
        Lead Time: ${knowledge.leadTime.typical}
      `.trim()

      const embedding = await generateEmbedding(searchText)

      await this.index.upsert([
        {
          id: `${knowledge.supplierId}-${knowledge.category}`,
          values: embedding,
          metadata: {
            supplierId: knowledge.supplierId,
            category: knowledge.category,
            type: 'supplier_knowledge',
            data: JSON.stringify(knowledge),
          },
        },
      ])

      monitor.end(true)
    } catch (error) {
      monitor.end(false)
      throw error
    }
  }

  /**
   * Search for relevant category knowledge
   */
  async searchCategories(query: string, topK: number = 5): Promise<CategoryKnowledge[]> {
    const monitor = monitorDB('search_categories')

    try {
      if (!this.index) await this.initialize()

      // Generate query embedding
      const queryEmbedding = await generateEmbedding(query)

      // Search Pinecone
      const results = await this.index.query({
        vector: queryEmbedding,
        topK,
        filter: {
          type: { $eq: 'category_knowledge' },
        },
        includeMetadata: true,
      })

      // Parse results
      const categories: CategoryKnowledge[] = results.matches
        .filter((match: any) => match.metadata?.data)
        .map((match: any) => JSON.parse(match.metadata.data))

      monitor.end(true, { found: categories.length })
      return categories
    } catch (error) {
      monitor.end(false)
      console.error('[VECTOR_DB] Search error:', error)
      return []
    }
  }

  /**
   * Find suppliers for a category
   */
  async findSuppliersForCategory(
    category: string,
    requirements: Record<string, any>
  ): Promise<SupplierCategoryKnowledge[]> {
    const monitor = monitorDB('find_suppliers')

    try {
      if (!this.index) await this.initialize()

      const searchText = `
        Category: ${category}
        Requirements: ${JSON.stringify(requirements)}
      `.trim()

      const queryEmbedding = await generateEmbedding(searchText)

      const results = await this.index.query({
        vector: queryEmbedding,
        topK: 20,
        filter: {
          type: { $eq: 'supplier_knowledge' },
          category: { $eq: category },
        },
        includeMetadata: true,
      })

      const suppliers: SupplierCategoryKnowledge[] = results.matches
        .filter((match: any) => match.metadata?.data)
        .map((match: any) => JSON.parse(match.metadata.data))

      monitor.end(true, { found: suppliers.length })
      return suppliers
    } catch (error) {
      monitor.end(false)
      console.error('[VECTOR_DB] Find suppliers error:', error)
      return []
    }
  }

  /**
   * Check if category exists in knowledge base
   */
  async categoryExists(category: string): Promise<boolean> {
    try {
      if (!this.index) await this.initialize()

      const queryEmbedding = await generateEmbedding(category)

      const results = await this.index.query({
        vector: queryEmbedding,
        topK: 1,
        filter: {
          type: { $eq: 'category_knowledge' },
          category: { $eq: category },
        },
      })

      return results.matches.length > 0
    } catch (error) {
      console.error('[VECTOR_DB] Category exists check error:', error)
      return false
    }
  }

  /**
   * Get category statistics
   */
  async getCategoryStats(): Promise<{
    totalCategories: number
    totalSuppliers: number
    recentlyLearned: CategoryKnowledge[]
  }> {
    try {
      if (!this.index) await this.initialize()

      const stats = await this.index.describeIndexStats()

      // Get recently learned categories
      const recent = await this.searchCategories('', 10)

      return {
        totalCategories: stats.namespaces?.['']?.vectorCount || 0,
        totalSuppliers: 0, // Would need separate query
        recentlyLearned: recent,
      }
    } catch (error) {
      console.error('[VECTOR_DB] Stats error:', error)
      return {
        totalCategories: 0,
        totalSuppliers: 0,
        recentlyLearned: [],
      }
    }
  }

  /**
   * Update category knowledge
   */
  async updateCategory(id: string, updates: Partial<CategoryKnowledge>): Promise<void> {
    try {
      // Get existing knowledge
      const existing = await this.index.fetch([id])
      if (!existing.vectors[id]) {
        throw new Error(`Category ${id} not found`)
      }

      const currentData = JSON.parse(existing.vectors[id].metadata.data)
      const updatedData = { ...currentData, ...updates }

      // Store updated version
      await this.storeCategory(updatedData)
    } catch (error) {
      console.error('[VECTOR_DB] Update category error:', error)
      throw error
    }
  }

  /**
   * Delete category
   */
  async deleteCategory(id: string): Promise<void> {
    try {
      if (!this.index) await this.initialize()
      await this.index.deleteOne(id)
    } catch (error) {
      console.error('[VECTOR_DB] Delete category error:', error)
      throw error
    }
  }
}

// Export singleton
export const vectorDB = new VectorDB()

/**
 * Helper functions for category learning
 */

/**
 * Extract category information from conversation
 */
export function extractCategoryInfo(conversation: string): {
  category?: string
  specs?: string[]
  pricing?: string[]
  leadTime?: string[]
} {
  // Simple extraction - would use Claude for better results
  const categoryMatch = conversation.match(/category:?\s*([^\n]+)/i)
  const specsMatch = conversation.match(/specs?:?\s*([^\n]+)/i)
  const pricingMatch = conversation.match(/pricing:?\s*([^\n]+)/i)
  const leadTimeMatch = conversation.match(/lead\s*time:?\s*([^\n]+)/i)

  return {
    category: categoryMatch?.[1]?.trim(),
    specs: specsMatch?.[1]?.split(',').map(s => s.trim()),
    pricing: pricingMatch?.[1]?.split(',').map(p => p.trim()),
    leadTime: leadTimeMatch?.[1]?.split(',').map(l => l.trim()),
  }
}

/**
 * Generate category ID
 */
export function generateCategoryId(category: string, subcategory?: string): string {
  const base = category.toLowerCase().replace(/\s+/g, '-')
  const sub = subcategory ? `-${subcategory.toLowerCase().replace(/\s+/g, '-')}` : ''
  return `cat-${base}${sub}-${Date.now()}`
}
