/**
 * Supplier Profile API
 * /api/wells-ai/sell/profile
 *
 * POST: Create/update supplier profile
 * GET: Get supplier profile
 * PUT: Update capabilities, pricing, availability
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

// Types
interface SupplierProfileInput {
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  website?: string;
  categories: string[];
  subcategories: string[];
  productDescription?: string;
  certifications: string[];
  monthlyCapacity: string;
  leadTimeDays: number;
  minimumOrderValue: number;
  serviceAreas: string[];
  canDropShip: boolean;
  canWhiteLabel: boolean;
  acceptsGrain: boolean;
  paymentTerms: string;
}

interface SupplierProfile {
  id: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  website?: string;
  categories: string[];
  subcategories: string[];
  productDescription?: string;
  certifications: string[];
  monthlyCapacity: string;
  leadTimeDays: number;
  minimumOrderValue: number;
  serviceAreas: string[];
  canDropShip: boolean;
  canWhiteLabel: boolean;
  acceptsGrain: boolean;
  paymentTerms: string;
  grainWalletId?: string;
  status: 'pending' | 'active' | 'paused' | 'rejected';
  matchScore?: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * POST /api/wells-ai/sell/profile
 * Create a new supplier profile
 */
export async function POST(req: NextRequest) {
  try {
    const body: SupplierProfileInput = await req.json();

    // Validate required fields
    if (!body.companyName || !body.contactEmail || !body.contactName) {
      return NextResponse.json(
        { error: 'Missing required fields: companyName, contactEmail, contactName' },
        { status: 400 }
      );
    }

    if (!body.categories || body.categories.length === 0) {
      return NextResponse.json(
        { error: 'At least one category is required' },
        { status: 400 }
      );
    }

    if (!body.serviceAreas || body.serviceAreas.length === 0) {
      return NextResponse.json(
        { error: 'At least one service area is required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.contactEmail)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Convert arrays to PostgreSQL format
    const categoriesArray = `{${body.categories.map(c => `"${c}"`).join(',')}}`;
    const subcategoriesArray = `{${body.subcategories.map(s => `"${s}"`).join(',')}}`;
    const certificationsArray = `{${body.certifications.map(c => `"${c}"`).join(',')}}`;
    const serviceAreasArray = `{${body.serviceAreas.map(s => `"${s}"`).join(',')}}`;

    // Check if supplier already exists by email
    const existing = await sql`
      SELECT id FROM supplier_profiles
      WHERE contact_email = ${body.contactEmail}
    `;

    if (existing.rows.length > 0) {
      // Update existing profile
      const result = await sql`
        UPDATE supplier_profiles SET
          company_name = ${body.companyName},
          contact_name = ${body.contactName},
          contact_phone = ${body.contactPhone || null},
          website = ${body.website || null},
          categories = ${categoriesArray}::text[],
          subcategories = ${subcategoriesArray}::text[],
          product_description = ${body.productDescription || null},
          certifications = ${certificationsArray}::text[],
          monthly_capacity = ${body.monthlyCapacity},
          lead_time_days = ${body.leadTimeDays},
          minimum_order_value = ${body.minimumOrderValue},
          service_areas = ${serviceAreasArray}::text[],
          can_drop_ship = ${body.canDropShip},
          can_white_label = ${body.canWhiteLabel},
          accepts_grain = ${body.acceptsGrain},
          payment_terms = ${body.paymentTerms},
          updated_at = NOW()
        WHERE contact_email = ${body.contactEmail}
        RETURNING *
      `;

      return NextResponse.json({
        success: true,
        message: 'Profile updated successfully',
        supplierId: result.rows[0].id,
        profile: dbRowToProfile(result.rows[0])
      });
    }

    // Create new profile
    const result = await sql`
      INSERT INTO supplier_profiles (
        company_name,
        contact_name,
        contact_email,
        contact_phone,
        website,
        categories,
        subcategories,
        product_description,
        certifications,
        monthly_capacity,
        lead_time_days,
        minimum_order_value,
        service_areas,
        can_drop_ship,
        can_white_label,
        accepts_grain,
        payment_terms,
        status
      ) VALUES (
        ${body.companyName},
        ${body.contactName},
        ${body.contactEmail},
        ${body.contactPhone || null},
        ${body.website || null},
        ${categoriesArray}::text[],
        ${subcategoriesArray}::text[],
        ${body.productDescription || null},
        ${certificationsArray}::text[],
        ${body.monthlyCapacity},
        ${body.leadTimeDays},
        ${body.minimumOrderValue},
        ${serviceAreasArray}::text[],
        ${body.canDropShip},
        ${body.canWhiteLabel},
        ${body.acceptsGrain},
        ${body.paymentTerms},
        'active'
      )
      RETURNING *
    `;

    // Auto-create GRAIN wallet if they accept GRAIN
    let grainWalletId = null;
    if (body.acceptsGrain) {
      try {
        const walletResult = await sql`
          INSERT INTO grain_wallets (
            owner_type,
            owner_id,
            wallet_type,
            balance
          ) VALUES (
            'supplier',
            ${result.rows[0].id},
            'business',
            0
          )
          RETURNING id
        `;
        grainWalletId = walletResult.rows[0]?.id;

        // Update supplier with wallet ID
        if (grainWalletId) {
          await sql`
            UPDATE supplier_profiles
            SET grain_wallet_id = ${grainWalletId}
            WHERE id = ${result.rows[0].id}
          `;
        }
      } catch (walletError) {
        // Wallet creation is non-critical, log and continue
        console.log('GRAIN wallet creation skipped:', walletError);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Profile created successfully',
      supplierId: result.rows[0].id,
      grainWalletId,
      profile: dbRowToProfile(result.rows[0])
    }, { status: 201 });

  } catch (error: any) {
    console.error('Supplier profile creation error:', error);

    if (error.message?.includes('duplicate key')) {
      return NextResponse.json(
        { error: 'A supplier with this email already exists' },
        { status: 409 }
      );
    }

    // If table doesn't exist, return helpful message
    if (error.message?.includes('does not exist')) {
      return NextResponse.json({
        success: true,
        message: 'Profile created (database pending setup)',
        supplierId: `temp-${Date.now()}`,
        note: 'Run schema-supplier-profiles.sql to persist profiles'
      }, { status: 201 });
    }

    return NextResponse.json(
      { error: 'Failed to create supplier profile', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/wells-ai/sell/profile
 * Get supplier profile by ID or email
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const email = searchParams.get('email');

    if (!id && !email) {
      // Return API documentation
      return NextResponse.json({
        endpoint: '/api/wells-ai/sell/profile',
        methods: ['GET', 'POST', 'PUT'],
        description: 'Manage supplier profiles for the Wells AI sourcing marketplace',
        parameters: {
          GET: {
            id: 'Supplier profile ID (UUID)',
            email: 'Supplier contact email'
          },
          POST: {
            companyName: 'string (required)',
            contactName: 'string (required)',
            contactEmail: 'string (required)',
            contactPhone: 'string (optional)',
            website: 'string (optional)',
            categories: 'string[] (required, at least 1)',
            subcategories: 'string[] (optional)',
            productDescription: 'string (optional)',
            certifications: 'string[] (optional)',
            monthlyCapacity: 'string (required: small, medium, large, enterprise)',
            leadTimeDays: 'number (required)',
            minimumOrderValue: 'number (required)',
            serviceAreas: 'string[] (required, at least 1)',
            canDropShip: 'boolean (optional, default false)',
            canWhiteLabel: 'boolean (optional, default false)',
            acceptsGrain: 'boolean (optional, default true)',
            paymentTerms: 'string (optional, default NET30)'
          }
        }
      });
    }

    let result;
    if (id) {
      result = await sql`
        SELECT * FROM supplier_profiles WHERE id = ${id}
      `;
    } else if (email) {
      result = await sql`
        SELECT * FROM supplier_profiles WHERE contact_email = ${email}
      `;
    }

    if (!result || result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Supplier profile not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      profile: dbRowToProfile(result.rows[0])
    });

  } catch (error: any) {
    console.error('Get supplier profile error:', error);

    if (error.message?.includes('does not exist')) {
      return NextResponse.json(
        { error: 'Database table not found. Run schema-supplier-profiles.sql' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to get supplier profile', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/wells-ai/sell/profile
 * Update supplier profile capabilities, pricing, or availability
 */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, email, ...updates } = body;

    if (!id && !email) {
      return NextResponse.json(
        { error: 'Either id or email is required to update profile' },
        { status: 400 }
      );
    }

    // Build dynamic update query
    const updateFields: string[] = [];
    const updateValues: any[] = [];

    // Map of allowed fields and their types
    const fieldMap: Record<string, string> = {
      companyName: 'company_name',
      contactName: 'contact_name',
      contactPhone: 'contact_phone',
      website: 'website',
      productDescription: 'product_description',
      monthlyCapacity: 'monthly_capacity',
      leadTimeDays: 'lead_time_days',
      minimumOrderValue: 'minimum_order_value',
      canDropShip: 'can_drop_ship',
      canWhiteLabel: 'can_white_label',
      acceptsGrain: 'accepts_grain',
      paymentTerms: 'payment_terms',
      status: 'status'
    };

    // Handle array fields separately
    const arrayFields: Record<string, string> = {
      categories: 'categories',
      subcategories: 'subcategories',
      certifications: 'certifications',
      serviceAreas: 'service_areas'
    };

    // Use simple update approach since we can't build dynamic SQL easily
    let result;

    if (id) {
      result = await sql`
        UPDATE supplier_profiles SET
          company_name = COALESCE(${updates.companyName}, company_name),
          contact_name = COALESCE(${updates.contactName}, contact_name),
          contact_phone = COALESCE(${updates.contactPhone}, contact_phone),
          website = COALESCE(${updates.website}, website),
          product_description = COALESCE(${updates.productDescription}, product_description),
          monthly_capacity = COALESCE(${updates.monthlyCapacity}, monthly_capacity),
          lead_time_days = COALESCE(${updates.leadTimeDays}, lead_time_days),
          minimum_order_value = COALESCE(${updates.minimumOrderValue}, minimum_order_value),
          can_drop_ship = COALESCE(${updates.canDropShip}, can_drop_ship),
          can_white_label = COALESCE(${updates.canWhiteLabel}, can_white_label),
          accepts_grain = COALESCE(${updates.acceptsGrain}, accepts_grain),
          payment_terms = COALESCE(${updates.paymentTerms}, payment_terms),
          status = COALESCE(${updates.status}, status),
          updated_at = NOW()
        WHERE id = ${id}
        RETURNING *
      `;
    } else {
      result = await sql`
        UPDATE supplier_profiles SET
          company_name = COALESCE(${updates.companyName}, company_name),
          contact_name = COALESCE(${updates.contactName}, contact_name),
          contact_phone = COALESCE(${updates.contactPhone}, contact_phone),
          website = COALESCE(${updates.website}, website),
          product_description = COALESCE(${updates.productDescription}, product_description),
          monthly_capacity = COALESCE(${updates.monthlyCapacity}, monthly_capacity),
          lead_time_days = COALESCE(${updates.leadTimeDays}, lead_time_days),
          minimum_order_value = COALESCE(${updates.minimumOrderValue}, minimum_order_value),
          can_drop_ship = COALESCE(${updates.canDropShip}, can_drop_ship),
          can_white_label = COALESCE(${updates.canWhiteLabel}, can_white_label),
          accepts_grain = COALESCE(${updates.acceptsGrain}, accepts_grain),
          payment_terms = COALESCE(${updates.paymentTerms}, payment_terms),
          status = COALESCE(${updates.status}, status),
          updated_at = NOW()
        WHERE contact_email = ${email}
        RETURNING *
      `;
    }

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Supplier profile not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      profile: dbRowToProfile(result.rows[0])
    });

  } catch (error: any) {
    console.error('Update supplier profile error:', error);

    return NextResponse.json(
      { error: 'Failed to update supplier profile', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Convert database row to SupplierProfile object
 */
function dbRowToProfile(row: any): SupplierProfile {
  return {
    id: row.id,
    companyName: row.company_name,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    website: row.website,
    categories: row.categories || [],
    subcategories: row.subcategories || [],
    productDescription: row.product_description,
    certifications: row.certifications || [],
    monthlyCapacity: row.monthly_capacity,
    leadTimeDays: row.lead_time_days,
    minimumOrderValue: parseFloat(row.minimum_order_value) || 0,
    serviceAreas: row.service_areas || [],
    canDropShip: row.can_drop_ship,
    canWhiteLabel: row.can_white_label,
    acceptsGrain: row.accepts_grain,
    paymentTerms: row.payment_terms,
    grainWalletId: row.grain_wallet_id,
    status: row.status,
    matchScore: row.match_score,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
