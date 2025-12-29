/**
 * Seller Catalog API
 *
 * GET /api/seller/catalog - Get catalog products
 * POST /api/seller/catalog - Add products (via conversation or direct)
 * PUT /api/seller/catalog - Update products
 * DELETE /api/seller/catalog?productId=xxx - Delete a product
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  CatalogProduct,
  VolumeDiscount,
  getSellerCatalog,
  getCatalogSummary,
  createProduct,
  updateProduct,
  deleteProduct,
  searchCatalog,
  addProductsViaConversation,
  updateCatalogViaConversation,
  bulkUpdatePrices,
  addGlobalVolumeDiscount,
} from '@/lib/seller/catalog-service';

// ============================================================================
// GET - Get catalog products
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const view = url.searchParams.get('view') || 'list';
    const search = url.searchParams.get('search');
    const category = url.searchParams.get('category');

    // Search mode
    if (search) {
      const results = await searchCatalog(userId, search, { category: category || undefined });
      return NextResponse.json({
        results,
        count: results.length,
        query: search,
      });
    }

    // Summary mode
    if (view === 'summary') {
      const summary = await getCatalogSummary(userId);
      return NextResponse.json({ summary });
    }

    // Full catalog
    const products = await getSellerCatalog(userId);
    const summary = await getCatalogSummary(userId);

    return NextResponse.json({
      products,
      summary,
      count: products.length,
    });
  } catch (error) {
    console.error('Error getting catalog:', error);
    return NextResponse.json(
      { error: 'Failed to get catalog' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Add products to catalog
// ============================================================================

interface AddProductRequest {
  // Conversational mode
  mode?: 'conversation' | 'direct' | 'bulk';
  message?: string;

  // Direct mode - single product
  product?: {
    name: string;
    description?: string;
    sku?: string;
    category: string;
    basePrice: number;
    currency?: string;
    priceUnit?: 'unit' | 'dozen' | 'case' | 'pallet' | 'kg' | 'lb';
    minOrderQuantity?: number;
    volumeDiscounts?: VolumeDiscount[];
    standardLeadDays?: number;
    rushLeadDays?: number;
    rushPremiumPercent?: number;
    inStock?: boolean;
    stockQuantity?: number;
    specifications?: Record<string, string>;
    images?: string[];
    tags?: string[];
  };

  // Bulk mode - multiple products
  products?: Array<{
    name: string;
    description?: string;
    sku?: string;
    category: string;
    basePrice: number;
    minOrderQuantity?: number;
    standardLeadDays?: number;
    tags?: string[];
  }>;
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as AddProductRequest;
    const mode = body.mode || 'direct';

    // Conversational mode - describe products naturally
    if (mode === 'conversation' && body.message) {
      const result = await addProductsViaConversation(userId, body.message);

      return NextResponse.json({
        success: true,
        productsAdded: result.productsAdded.length,
        products: result.productsAdded,
        response: result.response,
        needsClarification: result.needsClarification,
        clarificationQuestion: result.clarificationQuestion,
      });
    }

    // Direct mode - single product
    if (mode === 'direct' && body.product) {
      const p = body.product;

      if (!p.name || !p.category || p.basePrice === undefined) {
        return NextResponse.json(
          { error: 'Missing required fields: name, category, basePrice' },
          { status: 400 }
        );
      }

      const product = await createProduct(userId, {
        name: p.name,
        description: p.description || '',
        sku: p.sku,
        category: p.category,
        pricing: {
          basePrice: p.basePrice,
          currency: p.currency || 'USD',
          priceUnit: p.priceUnit || 'unit',
          volumeDiscounts: p.volumeDiscounts || [],
          minOrderQuantity: p.minOrderQuantity || 1,
        },
        leadTime: {
          standardDays: p.standardLeadDays || 7,
          rushDays: p.rushLeadDays,
          rushPremiumPercent: p.rushPremiumPercent,
        },
        availability: {
          inStock: p.inStock !== false,
          stockQuantity: p.stockQuantity,
          madeToOrder: false,
        },
        specifications: p.specifications,
        images: p.images,
        tags: p.tags,
        sourceType: 'manual',
      });

      return NextResponse.json({
        success: true,
        message: `Added "${product.name}" to your catalog.`,
        product,
      });
    }

    // Bulk mode - multiple products
    if (mode === 'bulk' && body.products && body.products.length > 0) {
      const addedProducts: CatalogProduct[] = [];
      const errors: Array<{ product: string; error: string }> = [];

      for (const p of body.products) {
        try {
          if (!p.name || !p.category || p.basePrice === undefined) {
            errors.push({
              product: p.name || 'Unknown',
              error: 'Missing required fields',
            });
            continue;
          }

          const product = await createProduct(userId, {
            name: p.name,
            description: p.description || '',
            sku: p.sku,
            category: p.category,
            pricing: {
              basePrice: p.basePrice,
              currency: 'USD',
              priceUnit: 'unit',
              volumeDiscounts: [],
              minOrderQuantity: p.minOrderQuantity || 1,
            },
            leadTime: {
              standardDays: p.standardLeadDays || 7,
            },
            availability: {
              inStock: true,
              madeToOrder: false,
            },
            tags: p.tags,
            sourceType: 'manual',
          });

          addedProducts.push(product);
        } catch (err) {
          errors.push({
            product: p.name,
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      }

      return NextResponse.json({
        success: true,
        message: `Added ${addedProducts.length} products. ${errors.length} failed.`,
        productsAdded: addedProducts.length,
        products: addedProducts,
        errors: errors.length > 0 ? errors : undefined,
      });
    }

    return NextResponse.json(
      { error: 'Invalid request. Use mode: conversation, direct, or bulk' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error adding products:', error);
    return NextResponse.json(
      { error: 'Failed to add products' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PUT - Update catalog
// ============================================================================

interface UpdateCatalogRequest {
  // Conversational update
  mode?: 'conversation' | 'product' | 'bulk_price' | 'add_discount';
  message?: string;

  // Single product update
  productId?: string;
  updates?: Partial<{
    name: string;
    description: string;
    category: string;
    basePrice: number;
    minOrderQuantity: number;
    standardLeadDays: number;
    inStock: boolean;
    stockQuantity: number;
    isActive: boolean;
    tags: string[];
  }>;

  // Bulk price update
  priceAdjustment?: {
    type: 'percentage' | 'fixed';
    amount: number;
    category?: string;
  };

  // Add global discount
  volumeDiscount?: VolumeDiscount;
}

export async function PUT(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as UpdateCatalogRequest;
    const mode = body.mode || 'product';

    // Conversational update
    if (mode === 'conversation' && body.message) {
      const result = await updateCatalogViaConversation(userId, body.message);

      return NextResponse.json({
        success: true,
        updatedCount: result.updatedProducts.length,
        products: result.updatedProducts,
        response: result.response,
      });
    }

    // Single product update
    if (mode === 'product' && body.productId && body.updates) {
      const productUpdates: Partial<CatalogProduct> = {};

      if (body.updates.name) productUpdates.name = body.updates.name;
      if (body.updates.description) productUpdates.description = body.updates.description;
      if (body.updates.category) productUpdates.category = body.updates.category;
      if (body.updates.tags) productUpdates.tags = body.updates.tags;
      if (body.updates.isActive !== undefined) productUpdates.isActive = body.updates.isActive;

      if (body.updates.basePrice !== undefined ||
          body.updates.minOrderQuantity !== undefined) {
        productUpdates.pricing = {
          basePrice: body.updates.basePrice || 0,
          currency: 'USD',
          priceUnit: 'unit',
          volumeDiscounts: [],
          minOrderQuantity: body.updates.minOrderQuantity || 1,
        };
      }

      if (body.updates.standardLeadDays !== undefined) {
        productUpdates.leadTime = {
          standardDays: body.updates.standardLeadDays,
        };
      }

      if (body.updates.inStock !== undefined || body.updates.stockQuantity !== undefined) {
        productUpdates.availability = {
          inStock: body.updates.inStock !== false,
          stockQuantity: body.updates.stockQuantity,
          madeToOrder: false,
        };
      }

      const updated = await updateProduct(body.productId, productUpdates);

      if (!updated) {
        return NextResponse.json(
          { error: 'Product not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Updated "${updated.name}"`,
        product: updated,
      });
    }

    // Bulk price update
    if (mode === 'bulk_price' && body.priceAdjustment) {
      const count = await bulkUpdatePrices(userId, {
        type: body.priceAdjustment.type,
        amount: body.priceAdjustment.amount,
        category: body.priceAdjustment.category,
      });

      const changeDesc = body.priceAdjustment.type === 'percentage'
        ? `${body.priceAdjustment.amount > 0 ? '+' : ''}${body.priceAdjustment.amount}%`
        : `${body.priceAdjustment.amount > 0 ? '+' : ''}$${body.priceAdjustment.amount}`;

      return NextResponse.json({
        success: true,
        message: `Updated prices by ${changeDesc} for ${count} products`,
        productsUpdated: count,
      });
    }

    // Add global volume discount
    if (mode === 'add_discount' && body.volumeDiscount) {
      const count = await addGlobalVolumeDiscount(userId, body.volumeDiscount);

      return NextResponse.json({
        success: true,
        message: `Added ${body.volumeDiscount.discountPercent}% discount (${body.volumeDiscount.minQuantity}+ units) to ${count} products`,
        productsUpdated: count,
      });
    }

    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error updating catalog:', error);
    return NextResponse.json(
      { error: 'Failed to update catalog' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE - Remove product from catalog
// ============================================================================

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const productId = url.searchParams.get('productId');

    if (!productId) {
      return NextResponse.json(
        { error: 'Missing productId parameter' },
        { status: 400 }
      );
    }

    await deleteProduct(productId);

    return NextResponse.json({
      success: true,
      message: 'Product removed from catalog',
    });
  } catch (error) {
    console.error('Error deleting product:', error);
    return NextResponse.json(
      { error: 'Failed to delete product' },
      { status: 500 }
    );
  }
}
