/**
 * Seller Profile Service
 * Manages seller profiles and catalog through conversational interface
 */

import { sqlQuery as sql } from '@/lib/db';
import {
  SellerProfile,
  CatalogItem,
  VolumeDiscount,
  PipelineStage,
} from './types';

// =====================================================
// PROFILE MANAGEMENT
// =====================================================

export async function getSellerProfileByUserId(userId: string): Promise<SellerProfile | null> {
  const result = await sql`
    SELECT * FROM seller_profiles WHERE user_id = ${userId}
  `;

  if (result.rows.length === 0) return null;
  return mapRowToProfile(result.rows[0]);
}

export async function getSellerProfile(sellerId: string): Promise<SellerProfile | null> {
  const result = await sql`
    SELECT * FROM seller_profiles WHERE id = ${sellerId}
  `;

  if (result.rows.length === 0) return null;
  return mapRowToProfile(result.rows[0]);
}

export async function createSellerProfile(
  userId: string,
  data: Partial<SellerProfile>
): Promise<SellerProfile> {
  const result = await sql`
    INSERT INTO seller_profiles (
      user_id, company_name, company_description, website, logo_url,
      industry, company_size, years_in_business, locations,
      categories, certifications, min_order_value, max_order_value, typical_lead_time_days,
      accepted_payment_methods, default_payment_terms,
      ai_enabled, ai_aggression, auto_quote_enabled, auto_negotiate_enabled, min_margin_percent,
      gtm_enabled, gtm_budget_monthly, gtm_target_industries, gtm_target_company_sizes, gtm_target_locations,
      status
    ) VALUES (
      ${userId},
      ${data.companyName || 'My Company'},
      ${data.companyDescription || null},
      ${data.website || null},
      ${data.logoUrl || null},
      ${data.industry || null},
      ${data.companySize || null},
      ${data.yearsInBusiness || null},
      ${data.locations || null},
      ${data.categories || null},
      ${data.certifications || null},
      ${data.minOrderValue || null},
      ${data.maxOrderValue || null},
      ${data.typicalLeadTimeDays || null},
      ${data.acceptedPaymentMethods || ['credit_card', 'ach', 'grain']},
      ${data.defaultPaymentTerms || 'Net 30'},
      ${data.aiEnabled ?? true},
      ${data.aiAggression || 'balanced'},
      ${data.autoQuoteEnabled ?? true},
      ${data.autoNegotiateEnabled ?? true},
      ${data.minMarginPercent || 15},
      ${data.gtmEnabled ?? false},
      ${data.gtmBudgetMonthly || null},
      ${data.gtmTargetIndustries || null},
      ${data.gtmTargetCompanySizes || null},
      ${data.gtmTargetLocations || null},
      'pending'
    )
    RETURNING *
  `;

  const profile = mapRowToProfile(result.rows[0]);

  // Create default pipeline stages
  await createDefaultPipelineStages(profile.id);

  return profile;
}

export async function updateSellerProfile(
  sellerId: string,
  updates: Partial<SellerProfile>
): Promise<SellerProfile> {
  // Build dynamic update query
  const updateFields: string[] = [];
  const values: any[] = [];

  if (updates.companyName !== undefined) {
    updateFields.push('company_name');
    values.push(updates.companyName);
  }
  if (updates.companyDescription !== undefined) {
    updateFields.push('company_description');
    values.push(updates.companyDescription);
  }
  if (updates.website !== undefined) {
    updateFields.push('website');
    values.push(updates.website);
  }
  if (updates.industry !== undefined) {
    updateFields.push('industry');
    values.push(updates.industry);
  }
  if (updates.companySize !== undefined) {
    updateFields.push('company_size');
    values.push(updates.companySize);
  }
  if (updates.categories !== undefined) {
    updateFields.push('categories');
    values.push(updates.categories);
  }
  if (updates.locations !== undefined) {
    updateFields.push('locations');
    values.push(updates.locations);
  }
  if (updates.aiAggression !== undefined) {
    updateFields.push('ai_aggression');
    values.push(updates.aiAggression);
  }
  if (updates.autoQuoteEnabled !== undefined) {
    updateFields.push('auto_quote_enabled');
    values.push(updates.autoQuoteEnabled);
  }
  if (updates.autoNegotiateEnabled !== undefined) {
    updateFields.push('auto_negotiate_enabled');
    values.push(updates.autoNegotiateEnabled);
  }
  if (updates.minMarginPercent !== undefined) {
    updateFields.push('min_margin_percent');
    values.push(updates.minMarginPercent);
  }
  if (updates.gtmEnabled !== undefined) {
    updateFields.push('gtm_enabled');
    values.push(updates.gtmEnabled);
  }
  if (updates.gtmBudgetMonthly !== undefined) {
    updateFields.push('gtm_budget_monthly');
    values.push(updates.gtmBudgetMonthly);
  }
  if (updates.gtmTargetIndustries !== undefined) {
    updateFields.push('gtm_target_industries');
    values.push(updates.gtmTargetIndustries);
  }

  if (updateFields.length === 0) {
    const existing = await getSellerProfile(sellerId);
    if (!existing) throw new Error('Profile not found');
    return existing;
  }

  // Use simple update for now
  const result = await sql`
    UPDATE seller_profiles
    SET
      company_name = COALESCE(${updates.companyName}, company_name),
      company_description = COALESCE(${updates.companyDescription}, company_description),
      website = COALESCE(${updates.website}, website),
      industry = COALESCE(${updates.industry}, industry),
      company_size = COALESCE(${updates.companySize}, company_size),
      categories = COALESCE(${updates.categories}, categories),
      locations = COALESCE(${updates.locations}, locations),
      ai_aggression = COALESCE(${updates.aiAggression}, ai_aggression),
      auto_quote_enabled = COALESCE(${updates.autoQuoteEnabled}, auto_quote_enabled),
      auto_negotiate_enabled = COALESCE(${updates.autoNegotiateEnabled}, auto_negotiate_enabled),
      min_margin_percent = COALESCE(${updates.minMarginPercent}, min_margin_percent),
      gtm_enabled = COALESCE(${updates.gtmEnabled}, gtm_enabled),
      gtm_budget_monthly = COALESCE(${updates.gtmBudgetMonthly}, gtm_budget_monthly),
      gtm_target_industries = COALESCE(${updates.gtmTargetIndustries}, gtm_target_industries),
      updated_at = NOW()
    WHERE id = ${sellerId}
    RETURNING *
  `;

  return mapRowToProfile(result.rows[0]);
}

// =====================================================
// CATALOG MANAGEMENT
// =====================================================

export async function getCatalogItems(sellerId: string): Promise<CatalogItem[]> {
  const result = await sql`
    SELECT * FROM seller_catalog
    WHERE seller_id = ${sellerId} AND is_active = true
    ORDER BY category, name
  `;

  return result.rows.map(mapRowToCatalogItem);
}

export async function getCatalogItem(itemId: string): Promise<CatalogItem | null> {
  const result = await sql`
    SELECT * FROM seller_catalog WHERE id = ${itemId}
  `;

  if (result.rows.length === 0) return null;
  return mapRowToCatalogItem(result.rows[0]);
}

export async function addCatalogItem(
  sellerId: string,
  item: Partial<CatalogItem>
): Promise<CatalogItem> {
  const result = await sql`
    INSERT INTO seller_catalog (
      seller_id, sku, name, description, category, subcategory,
      base_price, currency, price_unit, min_quantity,
      volume_discounts,
      in_stock, stock_quantity, lead_time_days,
      ai_pricing_enabled, floor_price, ceiling_price, competitor_match,
      tags, images, specifications,
      is_active
    ) VALUES (
      ${sellerId},
      ${item.sku || null},
      ${item.name || 'Unnamed Product'},
      ${item.description || null},
      ${item.category || 'General'},
      ${item.subcategory || null},
      ${item.basePrice || 0},
      ${item.currency || 'USD'},
      ${item.priceUnit || 'each'},
      ${item.minQuantity || 1},
      ${JSON.stringify(item.volumeDiscounts || [])},
      ${item.inStock ?? true},
      ${item.stockQuantity || null},
      ${item.leadTimeDays || null},
      ${item.aiPricingEnabled ?? true},
      ${item.floorPrice || null},
      ${item.ceilingPrice || null},
      ${item.competitorMatch ?? false},
      ${item.tags || null},
      ${item.images || null},
      ${item.specifications ? JSON.stringify(item.specifications) : null},
      true
    )
    RETURNING *
  `;

  return mapRowToCatalogItem(result.rows[0]);
}

export async function updateCatalogItem(
  itemId: string,
  updates: Partial<CatalogItem>
): Promise<CatalogItem> {
  const result = await sql`
    UPDATE seller_catalog
    SET
      name = COALESCE(${updates.name}, name),
      description = COALESCE(${updates.description}, description),
      category = COALESCE(${updates.category}, category),
      base_price = COALESCE(${updates.basePrice}, base_price),
      in_stock = COALESCE(${updates.inStock}, in_stock),
      stock_quantity = COALESCE(${updates.stockQuantity}, stock_quantity),
      lead_time_days = COALESCE(${updates.leadTimeDays}, lead_time_days),
      floor_price = COALESCE(${updates.floorPrice}, floor_price),
      ceiling_price = COALESCE(${updates.ceilingPrice}, ceiling_price),
      updated_at = NOW()
    WHERE id = ${itemId}
    RETURNING *
  `;

  return mapRowToCatalogItem(result.rows[0]);
}

export async function removeCatalogItem(itemId: string): Promise<void> {
  await sql`
    UPDATE seller_catalog
    SET is_active = false, updated_at = NOW()
    WHERE id = ${itemId}
  `;
}

export async function searchCatalog(
  sellerId: string,
  query: string
): Promise<CatalogItem[]> {
  const result = await sql`
    SELECT * FROM seller_catalog
    WHERE seller_id = ${sellerId}
      AND is_active = true
      AND (
        name ILIKE ${'%' + query + '%'}
        OR description ILIKE ${'%' + query + '%'}
        OR category ILIKE ${'%' + query + '%'}
        OR sku ILIKE ${'%' + query + '%'}
      )
    ORDER BY name
    LIMIT 20
  `;

  return result.rows.map(mapRowToCatalogItem);
}

// =====================================================
// PIPELINE STAGES
// =====================================================

async function createDefaultPipelineStages(sellerId: string): Promise<void> {
  const stages = [
    { name: 'Lead', order: 1, probability: 10, isWon: false, isLost: false },
    { name: 'Qualified', order: 2, probability: 20, isWon: false, isLost: false },
    { name: 'Proposal', order: 3, probability: 40, isWon: false, isLost: false },
    { name: 'Negotiation', order: 4, probability: 60, isWon: false, isLost: false },
    { name: 'Verbal Commit', order: 5, probability: 80, isWon: false, isLost: false },
    { name: 'Won', order: 6, probability: 100, isWon: true, isLost: false },
    { name: 'Lost', order: 7, probability: 0, isWon: false, isLost: true },
  ];

  for (const stage of stages) {
    await sql`
      INSERT INTO seller_pipeline_stages (
        seller_id, name, order_index, probability, is_won, is_lost
      ) VALUES (
        ${sellerId}, ${stage.name}, ${stage.order}, ${stage.probability}, ${stage.isWon}, ${stage.isLost}
      )
    `;
  }
}

export async function getPipelineStages(sellerId: string): Promise<PipelineStage[]> {
  const result = await sql`
    SELECT * FROM seller_pipeline_stages
    WHERE seller_id = ${sellerId} AND is_active = true
    ORDER BY order_index
  `;

  return result.rows.map((row: any) => ({
    id: row.id,
    sellerId: row.seller_id,
    name: row.name,
    description: row.description,
    orderIndex: row.order_index,
    probability: parseFloat(row.probability),
    isWon: row.is_won,
    isLost: row.is_lost,
    requiredActions: row.required_actions,
    isActive: row.is_active,
    createdAt: new Date(row.created_at),
  }));
}

// =====================================================
// CONVERSATIONAL HELPERS
// =====================================================

/**
 * Parse profile updates from natural language
 */
export function parseProfileUpdatesFromText(text: string): Partial<SellerProfile> {
  const updates: Partial<SellerProfile> = {};

  // Company name patterns
  const nameMatch = text.match(/(?:company|business|we're|we are|called|named?)\s+(?:is\s+)?["']?([A-Z][^"',.\n]+)/i);
  if (nameMatch) {
    updates.companyName = nameMatch[1].trim();
  }

  // Industry patterns
  const industries = ['technology', 'healthcare', 'manufacturing', 'retail', 'finance', 'construction', 'logistics', 'hospitality'];
  for (const ind of industries) {
    if (text.toLowerCase().includes(ind)) {
      updates.industry = ind.charAt(0).toUpperCase() + ind.slice(1);
      break;
    }
  }

  // Categories (what they sell)
  const categoryPatterns = [
    /(?:we sell|selling|offer|provide|specialize in)\s+(.+?)(?:\.|,|and|$)/i,
    /(?:products?|services?)\s+(?:include|like|such as)\s+(.+?)(?:\.|,|$)/i,
  ];
  for (const pattern of categoryPatterns) {
    const match = text.match(pattern);
    if (match) {
      updates.categories = match[1].split(/,|and/).map(c => c.trim()).filter(c => c.length > 0);
      break;
    }
  }

  // Margin preferences
  const marginMatch = text.match(/(?:margin|markup)\s*(?:of|at|around|at least)?\s*(\d+)/i);
  if (marginMatch) {
    updates.minMarginPercent = parseInt(marginMatch[1]);
  }

  // AI aggression
  if (text.match(/aggressive|push hard|maximize/i)) {
    updates.aiAggression = 'aggressive';
  } else if (text.match(/conservative|careful|safe/i)) {
    updates.aiAggression = 'conservative';
  }

  // GTM enablement
  if (text.match(/(?:want|need|enable|start|begin)\s+(?:outbound|gtm|prospecting|lead gen)/i)) {
    updates.gtmEnabled = true;
  }

  return updates;
}

/**
 * Parse catalog item from natural language
 */
export function parseCatalogItemFromText(text: string): Partial<CatalogItem> {
  const item: Partial<CatalogItem> = {};

  // Product name (often in quotes or after "called/named")
  const nameMatch = text.match(/["']([^"']+)["']/) ||
                    text.match(/(?:called|named|product|item)\s+["']?([^"',.\n]+)/i);
  if (nameMatch) {
    item.name = nameMatch[1].trim();
  }

  // Price extraction
  const priceMatch = text.match(/\$?([\d,]+(?:\.\d{2})?)\s*(?:per|each|\/)?/i);
  if (priceMatch) {
    item.basePrice = parseFloat(priceMatch[1].replace(',', ''));
  }

  // Category
  const categoryMatch = text.match(/(?:category|in the|type of)\s+["']?([^"',.\n]+)/i);
  if (categoryMatch) {
    item.category = categoryMatch[1].trim();
  }

  // Lead time
  const leadTimeMatch = text.match(/(\d+)\s*(?:day|week)s?\s*(?:lead|delivery|ship)/i);
  if (leadTimeMatch) {
    const num = parseInt(leadTimeMatch[1]);
    item.leadTimeDays = text.includes('week') ? num * 7 : num;
  }

  // Floor price
  const floorMatch = text.match(/(?:floor|minimum|never below|at least)\s*\$?([\d,]+(?:\.\d{2})?)/i);
  if (floorMatch) {
    item.floorPrice = parseFloat(floorMatch[1].replace(',', ''));
  }

  return item;
}

// =====================================================
// ROW MAPPERS
// =====================================================

function mapRowToProfile(row: any): SellerProfile {
  return {
    id: row.id,
    userId: row.user_id,
    companyName: row.company_name,
    companyDescription: row.company_description,
    website: row.website,
    logoUrl: row.logo_url,
    industry: row.industry,
    companySize: row.company_size,
    yearsInBusiness: row.years_in_business,
    locations: row.locations,
    categories: row.categories,
    certifications: row.certifications,
    minOrderValue: row.min_order_value ? parseFloat(row.min_order_value) : undefined,
    maxOrderValue: row.max_order_value ? parseFloat(row.max_order_value) : undefined,
    typicalLeadTimeDays: row.typical_lead_time_days,
    acceptedPaymentMethods: row.accepted_payment_methods,
    defaultPaymentTerms: row.default_payment_terms,
    aiEnabled: row.ai_enabled,
    aiAggression: row.ai_aggression,
    autoQuoteEnabled: row.auto_quote_enabled,
    autoNegotiateEnabled: row.auto_negotiate_enabled,
    minMarginPercent: parseFloat(row.min_margin_percent),
    gtmEnabled: row.gtm_enabled,
    gtmBudgetMonthly: row.gtm_budget_monthly ? parseFloat(row.gtm_budget_monthly) : undefined,
    gtmTargetIndustries: row.gtm_target_industries,
    gtmTargetCompanySizes: row.gtm_target_company_sizes,
    gtmTargetLocations: row.gtm_target_locations,
    status: row.status,
    verifiedAt: row.verified_at ? new Date(row.verified_at) : undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapRowToCatalogItem(row: any): CatalogItem {
  return {
    id: row.id,
    sellerId: row.seller_id,
    sku: row.sku,
    name: row.name,
    description: row.description,
    category: row.category,
    subcategory: row.subcategory,
    basePrice: parseFloat(row.base_price),
    currency: row.currency,
    priceUnit: row.price_unit,
    minQuantity: row.min_quantity,
    volumeDiscounts: row.volume_discounts || [],
    inStock: row.in_stock,
    stockQuantity: row.stock_quantity,
    leadTimeDays: row.lead_time_days,
    aiPricingEnabled: row.ai_pricing_enabled,
    floorPrice: row.floor_price ? parseFloat(row.floor_price) : undefined,
    ceilingPrice: row.ceiling_price ? parseFloat(row.ceiling_price) : undefined,
    competitorMatch: row.competitor_match,
    tags: row.tags,
    images: row.images,
    specifications: row.specifications,
    isActive: row.is_active,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}
