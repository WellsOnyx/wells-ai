/**
 * Seller Catalog Service
 *
 * Manages the seller's product catalog through conversational interface.
 * Products can be added via:
 * - Natural conversation ("I sell ball bearings, $2-$10 per unit")
 * - CSV import
 * - Shopify/ERP sync
 *
 * Examples:
 * - "I sell ball bearings, prices range from $2-$10 per unit"
 * - "Add a 10% discount for orders over 1000 units"
 * - "My lead time is 5 days for stock items, 14 for custom"
 */

import { sql } from '@vercel/postgres';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// ============================================================================
// TYPES
// ============================================================================

export interface VolumeDiscount {
  minQuantity: number;
  maxQuantity?: number;
  discountPercent: number;
  discountType: 'percentage' | 'fixed';
  fixedDiscount?: number;
}

export interface ProductPricing {
  basePrice: number;
  currency: string;
  priceUnit: 'unit' | 'dozen' | 'case' | 'pallet' | 'kg' | 'lb';
  costPrice?: number;
  marginPercent?: number;
  volumeDiscounts: VolumeDiscount[];
  minOrderQuantity: number;
  maxOrderQuantity?: number;
}

export interface LeadTimeConfig {
  standardDays: number;
  rushDays?: number;
  rushPremiumPercent?: number;
  customLeadDays?: number;
  customPremiumPercent?: number;
}

export interface ProductAvailability {
  inStock: boolean;
  stockQuantity?: number;
  restockDate?: Date;
  madeToOrder: boolean;
  seasonalAvailability?: {
    startMonth: number;
    endMonth: number;
  };
}

export interface CatalogProduct {
  id: string;
  sellerId: string;

  // Basic info
  name: string;
  description: string;
  sku?: string;
  category: string;
  subcategory?: string;
  tags: string[];

  // Pricing
  pricing: ProductPricing;

  // Lead times
  leadTime: LeadTimeConfig;

  // Availability
  availability: ProductAvailability;

  // Specifications
  specifications: Record<string, string>;
  images: string[];

  // AI matching keywords
  searchKeywords: string[];
  matchingWeight: number;

  // Sync source
  sourceType: 'manual' | 'csv' | 'shopify' | 'erp' | 'conversation';
  sourceId?: string;
  lastSyncedAt?: Date;

  // Status
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CatalogSummary {
  totalProducts: number;
  activeProducts: number;
  categories: string[];
  priceRange: { min: number; max: number };
  averageLeadTime: number;
}

export interface ProductSearchResult {
  product: CatalogProduct;
  relevanceScore: number;
  matchedKeywords: string[];
}

// ============================================================================
// CONVERSATIONAL CATALOG MANAGEMENT
// ============================================================================

/**
 * Add products to catalog via natural conversation
 */
export async function addProductsViaConversation(
  sellerId: string,
  message: string
): Promise<{
  productsAdded: CatalogProduct[];
  response: string;
  needsClarification: boolean;
  clarificationQuestion?: string;
}> {
  const extractionPrompt = `You are helping a seller add products to their catalog via conversation.

The seller said: "${message}"

Extract product information and return JSON:
{
  "products": [
    {
      "name": "product name",
      "description": "brief description",
      "category": "category",
      "basePrice": number,
      "priceUnit": "unit|dozen|case|etc",
      "minPrice": number (if range mentioned),
      "maxPrice": number (if range mentioned),
      "minOrderQuantity": number (default 1),
      "leadTimeDays": number,
      "tags": ["tag1", "tag2"],
      "volumeDiscounts": [
        { "minQuantity": number, "discountPercent": number }
      ]
    }
  ],
  "needsClarification": boolean,
  "clarificationQuestion": "question if needed",
  "suggestedResponse": "confirmation message"
}

If the seller mentions:
- Price range (e.g., "$2-$10"): set minPrice and maxPrice, basePrice = average
- Volume discounts ("10% off for 1000+"): add to volumeDiscounts
- Lead time: extract standardDays
- Categories: infer from product type

Be smart about inferring missing information from context.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [
        { role: 'user', content: extractionPrompt }
      ]
    });

    const textBlock = response.content.find(block => block.type === 'text');
    const text = textBlock?.type === 'text' ? textBlock.text : '{}';

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const result = JSON.parse(jsonMatch?.[0] || '{ "products": [] }');

    const addedProducts: CatalogProduct[] = [];

    for (const productData of result.products || []) {
      const product = await createProduct(sellerId, {
        name: productData.name,
        description: productData.description || '',
        category: productData.category || 'General',
        pricing: {
          basePrice: productData.basePrice || productData.maxPrice || 0,
          currency: 'USD',
          priceUnit: productData.priceUnit || 'unit',
          volumeDiscounts: productData.volumeDiscounts || [],
          minOrderQuantity: productData.minOrderQuantity || 1,
        },
        leadTime: {
          standardDays: productData.leadTimeDays || 7,
        },
        availability: {
          inStock: true,
          madeToOrder: false,
        },
        tags: productData.tags || [],
        sourceType: 'conversation',
      });

      addedProducts.push(product);
    }

    return {
      productsAdded: addedProducts,
      response: result.suggestedResponse || `Added ${addedProducts.length} product(s) to your catalog.`,
      needsClarification: result.needsClarification || false,
      clarificationQuestion: result.clarificationQuestion,
    };
  } catch (error) {
    console.error('Error adding products via conversation:', error);
    return {
      productsAdded: [],
      response: "I had trouble understanding that. Could you describe your products again?",
      needsClarification: true,
      clarificationQuestion: "What products do you sell and at what price?",
    };
  }
}

/**
 * Update catalog via conversation
 */
export async function updateCatalogViaConversation(
  sellerId: string,
  message: string
): Promise<{
  updatedProducts: CatalogProduct[];
  response: string;
}> {
  // Get current catalog for context
  const catalog = await getSellerCatalog(sellerId);

  const updatePrompt = `You are helping update a seller's product catalog.

Current catalog summary:
${catalog.map(p => `- ${p.name}: $${p.pricing.basePrice}/${p.pricing.priceUnit}, ${p.category}`).join('\n')}

The seller said: "${message}"

Determine what updates are needed and return JSON:
{
  "updates": [
    {
      "productName": "name to match",
      "changes": {
        "basePrice": new_price,
        "volumeDiscounts": [...],
        "leadTimeDays": number,
        "isActive": boolean
      }
    }
  ],
  "response": "confirmation message",
  "appliedGlobally": boolean
}

Handle requests like:
- "Increase all prices by 5%" - apply to all products
- "Add 10% discount for orders over 1000" - add volume discount
- "Ball bearings now ship in 3 days" - update specific product lead time
- "Discontinue motor parts" - set isActive = false`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        { role: 'user', content: updatePrompt }
      ]
    });

    const textBlock = response.content.find(block => block.type === 'text');
    const text = textBlock?.type === 'text' ? textBlock.text : '{}';

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const result = JSON.parse(jsonMatch?.[0] || '{ "updates": [] }');

    const updatedProducts: CatalogProduct[] = [];

    for (const update of result.updates || []) {
      // Find matching product
      const product = catalog.find(p =>
        p.name.toLowerCase().includes(update.productName.toLowerCase())
      );

      if (product) {
        const updated = await updateProduct(product.id, update.changes);
        if (updated) {
          updatedProducts.push(updated);
        }
      }
    }

    return {
      updatedProducts,
      response: result.response || `Updated ${updatedProducts.length} product(s).`,
    };
  } catch (error) {
    console.error('Error updating catalog via conversation:', error);
    return {
      updatedProducts: [],
      response: "I couldn't process that update. Could you be more specific?",
    };
  }
}

// ============================================================================
// CATALOG CRUD OPERATIONS
// ============================================================================

/**
 * Create a new product
 */
export async function createProduct(
  sellerId: string,
  data: {
    name: string;
    description: string;
    sku?: string;
    category: string;
    subcategory?: string;
    pricing: Partial<ProductPricing>;
    leadTime: Partial<LeadTimeConfig>;
    availability: Partial<ProductAvailability>;
    specifications?: Record<string, string>;
    images?: string[];
    tags?: string[];
    sourceType: CatalogProduct['sourceType'];
    sourceId?: string;
  }
): Promise<CatalogProduct> {
  const id = `prod_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  // Generate search keywords from name, description, category, tags
  const searchKeywords = generateSearchKeywords(
    data.name,
    data.description,
    data.category,
    data.tags || []
  );

  const product: CatalogProduct = {
    id,
    sellerId,
    name: data.name,
    description: data.description,
    sku: data.sku,
    category: data.category,
    subcategory: data.subcategory,
    tags: data.tags || [],
    pricing: {
      basePrice: data.pricing.basePrice || 0,
      currency: data.pricing.currency || 'USD',
      priceUnit: data.pricing.priceUnit || 'unit',
      costPrice: data.pricing.costPrice,
      marginPercent: data.pricing.marginPercent,
      volumeDiscounts: data.pricing.volumeDiscounts || [],
      minOrderQuantity: data.pricing.minOrderQuantity || 1,
      maxOrderQuantity: data.pricing.maxOrderQuantity,
    },
    leadTime: {
      standardDays: data.leadTime.standardDays || 7,
      rushDays: data.leadTime.rushDays,
      rushPremiumPercent: data.leadTime.rushPremiumPercent,
      customLeadDays: data.leadTime.customLeadDays,
      customPremiumPercent: data.leadTime.customPremiumPercent,
    },
    availability: {
      inStock: data.availability.inStock !== false,
      stockQuantity: data.availability.stockQuantity,
      restockDate: data.availability.restockDate,
      madeToOrder: data.availability.madeToOrder || false,
      seasonalAvailability: data.availability.seasonalAvailability,
    },
    specifications: data.specifications || {},
    images: data.images || [],
    searchKeywords,
    matchingWeight: 1.0,
    sourceType: data.sourceType,
    sourceId: data.sourceId,
    lastSyncedAt: data.sourceType !== 'manual' ? new Date() : undefined,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Save to database
  await sql`
    INSERT INTO seller_catalog (
      id, seller_id, name, description, sku, category, subcategory,
      tags, pricing, lead_time, availability, specifications, images,
      search_keywords, matching_weight, source_type, source_id,
      last_synced_at, is_active, created_at, updated_at
    ) VALUES (
      ${product.id},
      ${product.sellerId},
      ${product.name},
      ${product.description},
      ${product.sku || null},
      ${product.category},
      ${product.subcategory || null},
      ${JSON.stringify(product.tags)},
      ${JSON.stringify(product.pricing)},
      ${JSON.stringify(product.leadTime)},
      ${JSON.stringify(product.availability)},
      ${JSON.stringify(product.specifications)},
      ${JSON.stringify(product.images)},
      ${JSON.stringify(product.searchKeywords)},
      ${product.matchingWeight},
      ${product.sourceType},
      ${product.sourceId || null},
      ${product.lastSyncedAt?.toISOString() || null},
      ${product.isActive},
      NOW(),
      NOW()
    )
  `;

  return product;
}

/**
 * Get seller's full catalog
 */
export async function getSellerCatalog(sellerId: string): Promise<CatalogProduct[]> {
  const result = await sql`
    SELECT * FROM seller_catalog
    WHERE seller_id = ${sellerId} AND is_active = true
    ORDER BY category, name
  `;

  return result.rows.map(rowToProduct);
}

/**
 * Get catalog summary
 */
export async function getCatalogSummary(sellerId: string): Promise<CatalogSummary> {
  const result = await sql`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE is_active = true) as active,
      ARRAY_AGG(DISTINCT category) as categories,
      MIN((pricing->>'basePrice')::numeric) as min_price,
      MAX((pricing->>'basePrice')::numeric) as max_price,
      AVG((lead_time->>'standardDays')::numeric) as avg_lead_time
    FROM seller_catalog
    WHERE seller_id = ${sellerId}
  `;

  const row = result.rows[0];
  return {
    totalProducts: parseInt(row.total) || 0,
    activeProducts: parseInt(row.active) || 0,
    categories: row.categories?.filter(Boolean) || [],
    priceRange: {
      min: parseFloat(row.min_price) || 0,
      max: parseFloat(row.max_price) || 0,
    },
    averageLeadTime: parseFloat(row.avg_lead_time) || 7,
  };
}

/**
 * Search catalog for matching products
 */
export async function searchCatalog(
  sellerId: string,
  query: string,
  options?: {
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    inStockOnly?: boolean;
  }
): Promise<ProductSearchResult[]> {
  const keywords = query.toLowerCase().split(/\s+/);

  let sqlQuery = sql`
    SELECT *,
      (
        SELECT COUNT(*)
        FROM unnest(search_keywords) AS kw
        WHERE ${keywords.map(k => sql`kw ILIKE ${'%' + k + '%'}`).reduce((a, b) => sql`${a} OR ${b}`)}
      ) as match_count
    FROM seller_catalog
    WHERE seller_id = ${sellerId}
      AND is_active = true
  `;

  if (options?.category) {
    sqlQuery = sql`${sqlQuery} AND category = ${options.category}`;
  }

  if (options?.inStockOnly) {
    sqlQuery = sql`${sqlQuery} AND (availability->>'inStock')::boolean = true`;
  }

  const result = await sql`
    ${sqlQuery}
    ORDER BY match_count DESC, matching_weight DESC
    LIMIT 20
  `;

  return result.rows
    .filter(row => parseInt(row.match_count) > 0)
    .map(row => ({
      product: rowToProduct(row),
      relevanceScore: parseInt(row.match_count) * 100 / keywords.length,
      matchedKeywords: keywords,
    }));
}

/**
 * Get product by ID
 */
export async function getProduct(productId: string): Promise<CatalogProduct | null> {
  const result = await sql`
    SELECT * FROM seller_catalog WHERE id = ${productId}
  `;

  if (result.rows.length === 0) return null;
  return rowToProduct(result.rows[0]);
}

/**
 * Update a product
 */
export async function updateProduct(
  productId: string,
  updates: Partial<CatalogProduct>
): Promise<CatalogProduct | null> {
  const existing = await getProduct(productId);
  if (!existing) return null;

  const merged = {
    ...existing,
    ...updates,
    pricing: updates.pricing ? { ...existing.pricing, ...updates.pricing } : existing.pricing,
    leadTime: updates.leadTime ? { ...existing.leadTime, ...updates.leadTime } : existing.leadTime,
    availability: updates.availability ? { ...existing.availability, ...updates.availability } : existing.availability,
    updatedAt: new Date(),
  };

  // Regenerate search keywords if name/description changed
  if (updates.name || updates.description || updates.tags) {
    merged.searchKeywords = generateSearchKeywords(
      merged.name,
      merged.description,
      merged.category,
      merged.tags
    );
  }

  await sql`
    UPDATE seller_catalog SET
      name = ${merged.name},
      description = ${merged.description},
      sku = ${merged.sku || null},
      category = ${merged.category},
      subcategory = ${merged.subcategory || null},
      tags = ${JSON.stringify(merged.tags)},
      pricing = ${JSON.stringify(merged.pricing)},
      lead_time = ${JSON.stringify(merged.leadTime)},
      availability = ${JSON.stringify(merged.availability)},
      specifications = ${JSON.stringify(merged.specifications)},
      images = ${JSON.stringify(merged.images)},
      search_keywords = ${JSON.stringify(merged.searchKeywords)},
      matching_weight = ${merged.matchingWeight},
      is_active = ${merged.isActive},
      updated_at = NOW()
    WHERE id = ${productId}
  `;

  return merged;
}

/**
 * Delete (deactivate) a product
 */
export async function deleteProduct(productId: string): Promise<void> {
  await sql`
    UPDATE seller_catalog
    SET is_active = false, updated_at = NOW()
    WHERE id = ${productId}
  `;
}

/**
 * Bulk update prices
 */
export async function bulkUpdatePrices(
  sellerId: string,
  adjustment: {
    type: 'percentage' | 'fixed';
    amount: number;
    category?: string;
  }
): Promise<number> {
  let query;

  if (adjustment.type === 'percentage') {
    query = sql`
      UPDATE seller_catalog
      SET
        pricing = jsonb_set(
          pricing,
          '{basePrice}',
          to_jsonb((pricing->>'basePrice')::numeric * ${1 + adjustment.amount / 100})
        ),
        updated_at = NOW()
      WHERE seller_id = ${sellerId}
        AND is_active = true
        ${adjustment.category ? sql`AND category = ${adjustment.category}` : sql``}
    `;
  } else {
    query = sql`
      UPDATE seller_catalog
      SET
        pricing = jsonb_set(
          pricing,
          '{basePrice}',
          to_jsonb((pricing->>'basePrice')::numeric + ${adjustment.amount})
        ),
        updated_at = NOW()
      WHERE seller_id = ${sellerId}
        AND is_active = true
        ${adjustment.category ? sql`AND category = ${adjustment.category}` : sql``}
    `;
  }

  const result = await query;
  return result.rowCount || 0;
}

/**
 * Add volume discount to all products
 */
export async function addGlobalVolumeDiscount(
  sellerId: string,
  discount: VolumeDiscount
): Promise<number> {
  const result = await sql`
    UPDATE seller_catalog
    SET
      pricing = jsonb_set(
        pricing,
        '{volumeDiscounts}',
        COALESCE(pricing->'volumeDiscounts', '[]'::jsonb) || ${JSON.stringify([discount])}::jsonb
      ),
      updated_at = NOW()
    WHERE seller_id = ${sellerId}
      AND is_active = true
  `;

  return result.rowCount || 0;
}

// ============================================================================
// HELPERS
// ============================================================================

function generateSearchKeywords(
  name: string,
  description: string,
  category: string,
  tags: string[]
): string[] {
  const text = `${name} ${description} ${category} ${tags.join(' ')}`.toLowerCase();

  // Remove common words and punctuation
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);

  const words = text
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));

  // Return unique keywords
  return [...new Set(words)];
}

function rowToProduct(row: Record<string, unknown>): CatalogProduct {
  return {
    id: row.id as string,
    sellerId: row.seller_id as string,
    name: row.name as string,
    description: row.description as string,
    sku: row.sku as string | undefined,
    category: row.category as string,
    subcategory: row.subcategory as string | undefined,
    tags: parseJson(row.tags) || [],
    pricing: parseJson(row.pricing),
    leadTime: parseJson(row.lead_time),
    availability: parseJson(row.availability),
    specifications: parseJson(row.specifications) || {},
    images: parseJson(row.images) || [],
    searchKeywords: parseJson(row.search_keywords) || [],
    matchingWeight: parseFloat(row.matching_weight as string) || 1.0,
    sourceType: row.source_type as CatalogProduct['sourceType'],
    sourceId: row.source_id as string | undefined,
    lastSyncedAt: row.last_synced_at ? new Date(row.last_synced_at as string) : undefined,
    isActive: row.is_active as boolean,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

function parseJson(value: unknown): unknown {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value as string);
  } catch {
    return null;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const CatalogService = {
  addProductsViaConversation,
  updateCatalogViaConversation,
  createProduct,
  getSellerCatalog,
  getCatalogSummary,
  searchCatalog,
  getProduct,
  updateProduct,
  deleteProduct,
  bulkUpdatePrices,
  addGlobalVolumeDiscount,
};

export default CatalogService;
