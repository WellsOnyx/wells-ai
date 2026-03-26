/**
 * Catalog Ingestion Service
 *
 * Imports product catalogs from multiple sources:
 * - CSV upload
 * - Shopify API
 * - Connected ERP (via Merge.dev)
 * - Conversational setup
 *
 * AI-powered field mapping for messy data.
 */

import { sql } from '@vercel/postgres';
import Anthropic from '@anthropic-ai/sdk';
import { CatalogProduct, createProduct } from './catalog-service';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// ============================================================================
// TYPES
// ============================================================================

export type IngestionSource = 'csv' | 'shopify' | 'woocommerce' | 'erp' | 'manual' | 'conversation';

export interface IngestionJob {
  id: string;
  sellerId: string;
  source: IngestionSource;
  status: 'pending' | 'processing' | 'mapping' | 'importing' | 'completed' | 'failed';
  totalRecords: number;
  processedRecords: number;
  successfulRecords: number;
  failedRecords: number;
  errors: IngestionError[];
  fieldMapping?: FieldMapping;
  sourceConfig?: Record<string, unknown>;
  startedAt: Date;
  completedAt?: Date;
}

export interface IngestionError {
  row: number;
  field?: string;
  error: string;
  data?: Record<string, unknown>;
}

export interface FieldMapping {
  name: string;
  description?: string;
  sku?: string;
  category: string;
  basePrice: string;
  currency?: string;
  priceUnit?: string;
  minOrderQuantity?: string;
  leadTimeDays?: string;
  stockQuantity?: string;
  tags?: string;
  images?: string;
  specifications?: string[];
  confidence: number;
}

export interface CSVRow {
  [key: string]: string;
}

export interface ShopifyProduct {
  id: number;
  title: string;
  body_html: string;
  vendor: string;
  product_type: string;
  tags: string;
  variants: Array<{
    id: number;
    title: string;
    price: string;
    sku: string;
    inventory_quantity: number;
  }>;
  images: Array<{
    src: string;
  }>;
}

export interface ERPProduct {
  id: string;
  name: string;
  description?: string;
  sku?: string;
  category?: string;
  unit_price?: number;
  quantity_on_hand?: number;
  vendor_id?: string;
}

// ============================================================================
// CSV INGESTION
// ============================================================================

/**
 * Parse CSV content and start ingestion
 */
export async function ingestFromCSV(
  sellerId: string,
  csvContent: string,
  options?: {
    hasHeaders?: boolean;
    delimiter?: string;
    customMapping?: Partial<FieldMapping>;
  }
): Promise<IngestionJob> {
  const jobId = `ingest_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const hasHeaders = options?.hasHeaders !== false;
  const delimiter = options?.delimiter || ',';

  // Parse CSV
  const lines = csvContent.trim().split('\n');
  const headers = hasHeaders
    ? parseCSVLine(lines[0], delimiter)
    : generateDefaultHeaders(parseCSVLine(lines[0], delimiter).length);

  const dataLines = hasHeaders ? lines.slice(1) : lines;
  const rows: CSVRow[] = dataLines.map(line => {
    const values = parseCSVLine(line, delimiter);
    const row: CSVRow = {};
    headers.forEach((header, i) => {
      row[header] = values[i] || '';
    });
    return row;
  });

  // Create ingestion job
  const job: IngestionJob = {
    id: jobId,
    sellerId,
    source: 'csv',
    status: 'mapping',
    totalRecords: rows.length,
    processedRecords: 0,
    successfulRecords: 0,
    failedRecords: 0,
    errors: [],
    startedAt: new Date(),
  };

  // AI field mapping
  const mapping = options?.customMapping
    ? { ...await aiFieldMapping(headers, rows.slice(0, 5)), ...options.customMapping }
    : await aiFieldMapping(headers, rows.slice(0, 5));

  job.fieldMapping = mapping;
  job.status = 'importing';

  // Save job to database
  await saveIngestionJob(job);

  // Process rows
  for (let i = 0; i < rows.length; i++) {
    try {
      await importCSVRow(sellerId, rows[i], mapping);
      job.successfulRecords++;
    } catch (error) {
      job.failedRecords++;
      job.errors.push({
        row: i + (hasHeaders ? 2 : 1),
        error: error instanceof Error ? error.message : 'Unknown error',
        data: rows[i],
      });
    }
    job.processedRecords++;

    // Update progress every 100 records
    if (job.processedRecords % 100 === 0) {
      await updateIngestionJob(job);
    }
  }

  job.status = job.failedRecords === 0 ? 'completed' : 'completed';
  job.completedAt = new Date();
  await updateIngestionJob(job);

  return job;
}

/**
 * AI-powered field mapping for CSV columns
 */
async function aiFieldMapping(
  headers: string[],
  sampleRows: CSVRow[]
): Promise<FieldMapping> {
  const prompt = `You are mapping CSV columns to product catalog fields.

Headers: ${JSON.stringify(headers)}

Sample data (first 5 rows):
${sampleRows.map((row, i) => `Row ${i + 1}: ${JSON.stringify(row)}`).join('\n')}

Map these headers to catalog fields. Return JSON:
{
  "name": "column name for product name",
  "description": "column for description (optional)",
  "sku": "column for SKU (optional)",
  "category": "column for category",
  "basePrice": "column for price",
  "currency": "column for currency (optional, default USD)",
  "priceUnit": "column for unit type (optional)",
  "minOrderQuantity": "column for min order (optional)",
  "leadTimeDays": "column for lead time (optional)",
  "stockQuantity": "column for stock (optional)",
  "tags": "column for tags (optional)",
  "images": "column for image URLs (optional)",
  "specifications": ["list of columns to use as specs"],
  "confidence": 0.0-1.0
}

Be smart about:
- "Product Name", "Item", "Title" -> name
- "Price", "Unit Price", "Cost" -> basePrice
- "Qty", "Stock", "Inventory" -> stockQuantity
- If unsure, set confidence lower`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }]
    });

    const textBlock = response.content.find(block => block.type === 'text');
    const text = textBlock?.type === 'text' ? textBlock.text : '{}';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const mapping = JSON.parse(jsonMatch?.[0] || '{}');

    return {
      name: mapping.name || headers[0],
      description: mapping.description,
      sku: mapping.sku,
      category: mapping.category || 'General',
      basePrice: mapping.basePrice || headers.find(h => h.toLowerCase().includes('price')) || headers[1],
      currency: mapping.currency,
      priceUnit: mapping.priceUnit,
      minOrderQuantity: mapping.minOrderQuantity,
      leadTimeDays: mapping.leadTimeDays,
      stockQuantity: mapping.stockQuantity,
      tags: mapping.tags,
      images: mapping.images,
      specifications: mapping.specifications || [],
      confidence: mapping.confidence || 0.7,
    };
  } catch {
    // Fallback to simple heuristic mapping
    return {
      name: headers.find(h => h.toLowerCase().includes('name') || h.toLowerCase().includes('title')) || headers[0],
      category: headers.find(h => h.toLowerCase().includes('category') || h.toLowerCase().includes('type')) || 'General',
      basePrice: headers.find(h => h.toLowerCase().includes('price') || h.toLowerCase().includes('cost')) || headers[1],
      specifications: [],
      confidence: 0.5,
    };
  }
}

/**
 * Import a single CSV row
 */
async function importCSVRow(
  sellerId: string,
  row: CSVRow,
  mapping: FieldMapping
): Promise<CatalogProduct> {
  const getValue = (field: string | undefined) => field ? row[field] : undefined;

  const name = getValue(mapping.name);
  if (!name) throw new Error('Product name is required');

  const basePrice = parseFloat(getValue(mapping.basePrice) || '0');
  if (isNaN(basePrice)) throw new Error('Invalid price');

  // Parse tags
  const tagsRaw = getValue(mapping.tags);
  const tags = tagsRaw ? tagsRaw.split(/[,;]/).map(t => t.trim()).filter(Boolean) : [];

  // Parse images
  const imagesRaw = getValue(mapping.images);
  const images = imagesRaw ? imagesRaw.split(/[,;]/).map(u => u.trim()).filter(Boolean) : [];

  // Build specifications from mapped columns
  const specifications: Record<string, string> = {};
  for (const specCol of mapping.specifications || []) {
    const value = getValue(specCol);
    if (value) {
      specifications[specCol] = value;
    }
  }

  return createProduct(sellerId, {
    name,
    description: getValue(mapping.description) || '',
    sku: getValue(mapping.sku),
    category: getValue(mapping.category) || 'General',
    pricing: {
      basePrice,
      currency: getValue(mapping.currency) || 'USD',
      priceUnit: (getValue(mapping.priceUnit) as 'unit') || 'unit',
      volumeDiscounts: [],
      minOrderQuantity: parseInt(getValue(mapping.minOrderQuantity) || '1') || 1,
    },
    leadTime: {
      standardDays: parseInt(getValue(mapping.leadTimeDays) || '7') || 7,
    },
    availability: {
      inStock: true,
      stockQuantity: parseInt(getValue(mapping.stockQuantity) || '0') || undefined,
      madeToOrder: false,
    },
    specifications,
    images,
    tags,
    sourceType: 'csv',
  });
}

function parseCSVLine(line: string, delimiter: string = ','): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());

  return values;
}

function generateDefaultHeaders(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `Column_${i + 1}`);
}

// ============================================================================
// SHOPIFY INGESTION
// ============================================================================

/**
 * Import products from Shopify
 */
export async function ingestFromShopify(
  sellerId: string,
  shopifyConfig: {
    shopDomain: string;
    accessToken: string;
  }
): Promise<IngestionJob> {
  const jobId = `ingest_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  const job: IngestionJob = {
    id: jobId,
    sellerId,
    source: 'shopify',
    status: 'processing',
    totalRecords: 0,
    processedRecords: 0,
    successfulRecords: 0,
    failedRecords: 0,
    errors: [],
    sourceConfig: { shopDomain: shopifyConfig.shopDomain },
    startedAt: new Date(),
  };

  await saveIngestionJob(job);

  try {
    // Fetch products from Shopify
    const products = await fetchShopifyProducts(shopifyConfig);
    job.totalRecords = products.length;
    job.status = 'importing';
    await updateIngestionJob(job);

    for (const product of products) {
      try {
        await importShopifyProduct(sellerId, product);
        job.successfulRecords++;
      } catch (error) {
        job.failedRecords++;
        job.errors.push({
          row: product.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          data: { title: product.title },
        });
      }
      job.processedRecords++;
    }

    job.status = 'completed';
    job.completedAt = new Date();
  } catch (error) {
    job.status = 'failed';
    job.errors.push({
      row: 0,
      error: error instanceof Error ? error.message : 'Failed to connect to Shopify',
    });
  }

  await updateIngestionJob(job);
  return job;
}

async function fetchShopifyProducts(config: {
  shopDomain: string;
  accessToken: string;
}): Promise<ShopifyProduct[]> {
  const response = await fetch(
    `https://${config.shopDomain}/admin/api/2024-01/products.json?limit=250`,
    {
      headers: {
        'X-Shopify-Access-Token': config.accessToken,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Shopify API error: ${response.status}`);
  }

  const data = await response.json();
  return data.products || [];
}

async function importShopifyProduct(
  sellerId: string,
  product: ShopifyProduct
): Promise<CatalogProduct> {
  const variant = product.variants[0];
  const price = parseFloat(variant?.price || '0');

  return createProduct(sellerId, {
    name: product.title,
    description: stripHtml(product.body_html || ''),
    sku: variant?.sku,
    category: product.product_type || 'General',
    pricing: {
      basePrice: price,
      currency: 'USD',
      priceUnit: 'unit',
      volumeDiscounts: [],
      minOrderQuantity: 1,
    },
    leadTime: { standardDays: 7 },
    availability: {
      inStock: (variant?.inventory_quantity || 0) > 0,
      stockQuantity: variant?.inventory_quantity,
      madeToOrder: false,
    },
    images: product.images.map(img => img.src),
    tags: product.tags.split(',').map(t => t.trim()).filter(Boolean),
    sourceType: 'shopify',
    sourceId: product.id.toString(),
  });
}

// ============================================================================
// ERP INGESTION (via Merge.dev)
// ============================================================================

/**
 * Import products from connected ERP
 */
export async function ingestFromERP(
  sellerId: string,
  erpConfig: {
    connectionId: string;
    accountToken: string;
  }
): Promise<IngestionJob> {
  const jobId = `ingest_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  const job: IngestionJob = {
    id: jobId,
    sellerId,
    source: 'erp',
    status: 'processing',
    totalRecords: 0,
    processedRecords: 0,
    successfulRecords: 0,
    failedRecords: 0,
    errors: [],
    sourceConfig: { connectionId: erpConfig.connectionId },
    startedAt: new Date(),
  };

  await saveIngestionJob(job);

  try {
    // Fetch products from Merge.dev accounting API
    const products = await fetchERPProducts(erpConfig);
    job.totalRecords = products.length;
    job.status = 'importing';
    await updateIngestionJob(job);

    for (const product of products) {
      try {
        await importERPProduct(sellerId, product);
        job.successfulRecords++;
      } catch (error) {
        job.failedRecords++;
        job.errors.push({
          row: 0,
          field: product.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          data: { name: product.name },
        });
      }
      job.processedRecords++;
    }

    job.status = 'completed';
    job.completedAt = new Date();
  } catch (error) {
    job.status = 'failed';
    job.errors.push({
      row: 0,
      error: error instanceof Error ? error.message : 'Failed to connect to ERP',
    });
  }

  await updateIngestionJob(job);
  return job;
}

async function fetchERPProducts(config: {
  connectionId: string;
  accountToken: string;
}): Promise<ERPProduct[]> {
  const response = await fetch(
    'https://api.merge.dev/api/accounting/v1/items',
    {
      headers: {
        'Authorization': `Bearer ${process.env.MERGE_API_KEY}`,
        'X-Account-Token': config.accountToken,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Merge.dev API error: ${response.status}`);
  }

  const data = await response.json();
  return data.results || [];
}

async function importERPProduct(
  sellerId: string,
  product: ERPProduct
): Promise<CatalogProduct> {
  return createProduct(sellerId, {
    name: product.name,
    description: product.description || '',
    sku: product.sku,
    category: product.category || 'General',
    pricing: {
      basePrice: product.unit_price || 0,
      currency: 'USD',
      priceUnit: 'unit',
      volumeDiscounts: [],
      minOrderQuantity: 1,
    },
    leadTime: { standardDays: 7 },
    availability: {
      inStock: (product.quantity_on_hand || 0) > 0,
      stockQuantity: product.quantity_on_hand,
      madeToOrder: false,
    },
    tags: [],
    sourceType: 'erp',
    sourceId: product.id,
  });
}

// ============================================================================
// JOB MANAGEMENT
// ============================================================================

async function saveIngestionJob(job: IngestionJob): Promise<void> {
  await sql`
    INSERT INTO catalog_ingestion_jobs (
      id, seller_id, source, status,
      total_records, processed_records, successful_records, failed_records,
      errors, field_mapping, source_config, started_at, completed_at
    ) VALUES (
      ${job.id},
      ${job.sellerId},
      ${job.source},
      ${job.status},
      ${job.totalRecords},
      ${job.processedRecords},
      ${job.successfulRecords},
      ${job.failedRecords},
      ${JSON.stringify(job.errors)},
      ${JSON.stringify(job.fieldMapping || null)},
      ${JSON.stringify(job.sourceConfig || null)},
      ${job.startedAt.toISOString()},
      ${job.completedAt?.toISOString() || null}
    )
  `;
}

async function updateIngestionJob(job: IngestionJob): Promise<void> {
  await sql`
    UPDATE catalog_ingestion_jobs SET
      status = ${job.status},
      processed_records = ${job.processedRecords},
      successful_records = ${job.successfulRecords},
      failed_records = ${job.failedRecords},
      errors = ${JSON.stringify(job.errors)},
      completed_at = ${job.completedAt?.toISOString() || null}
    WHERE id = ${job.id}
  `;
}

/**
 * Get ingestion job status
 */
export async function getIngestionJob(jobId: string): Promise<IngestionJob | null> {
  const result = await sql`
    SELECT * FROM catalog_ingestion_jobs WHERE id = ${jobId}
  `;

  if (result.rows.length === 0) return null;
  return rowToJob(result.rows[0]);
}

/**
 * Get seller's ingestion history
 */
export async function getSellerIngestionHistory(sellerId: string): Promise<IngestionJob[]> {
  const result = await sql`
    SELECT * FROM catalog_ingestion_jobs
    WHERE seller_id = ${sellerId}
    ORDER BY started_at DESC
    LIMIT 20
  `;

  return result.rows.map(rowToJob);
}

function rowToJob(row: Record<string, unknown>): IngestionJob {
  return {
    id: row.id as string,
    sellerId: row.seller_id as string,
    source: row.source as IngestionSource,
    status: row.status as IngestionJob['status'],
    totalRecords: row.total_records as number,
    processedRecords: row.processed_records as number,
    successfulRecords: row.successful_records as number,
    failedRecords: row.failed_records as number,
    errors: parseJson(row.errors) || [],
    fieldMapping: parseJson(row.field_mapping) || undefined,
    sourceConfig: parseJson(row.source_config) || undefined,
    startedAt: new Date(row.started_at as string),
    completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
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

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ============================================================================
// EXPORTS
// ============================================================================

export const CatalogIngestion = {
  ingestFromCSV,
  ingestFromShopify,
  ingestFromERP,
  getIngestionJob,
  getSellerIngestionHistory,
};

export default CatalogIngestion;
