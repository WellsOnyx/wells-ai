/**
 * Supplier Onboarding API
 *
 * POST /api/suppliers/onboard
 * Register a new supplier into the system
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupplier, updateSupplierStatus } from '@/lib/suppliers/db';
import { SupplierOnboardingRequest } from '@/lib/suppliers/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate required fields
    const { companyName, contactEmail, products, pricing, capacity, leadTime, minimumOrder } = body;

    if (!companyName || !contactEmail || !products || !pricing || !capacity) {
      return NextResponse.json(
        { error: 'Missing required fields: companyName, contactEmail, products, pricing, capacity' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(contactEmail)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Validate products array
    if (!Array.isArray(products) || products.length === 0) {
      return NextResponse.json(
        { error: 'Products must be a non-empty array' },
        { status: 400 }
      );
    }

    // Validate pricing structure
    if (!pricing.minimumOrder || !pricing.currency || !pricing.paymentTerms) {
      return NextResponse.json(
        { error: 'Pricing must include minimumOrder, currency, and paymentTerms' },
        { status: 400 }
      );
    }

    // Validate capacity structure
    if (!capacity.monthlyVolume || !capacity.leadTime || !capacity.locations) {
      return NextResponse.json(
        { error: 'Capacity must include monthlyVolume, leadTime, and locations' },
        { status: 400 }
      );
    }

    // Create supplier onboarding request
    const onboardingRequest: SupplierOnboardingRequest = {
      companyName,
      contactEmail,
      phone: body.phone,
      website: body.website,
      products,
      pricing,
      capacity,
      certifications: body.certifications || [],
      leadTime: leadTime || capacity.leadTime,
      minimumOrder: minimumOrder || pricing.minimumOrder,
      dropShipCapable: body.dropShipCapable,
      whiteLabelCapable: body.whiteLabelCapable,
    };

    // Create the supplier
    const supplier = await createSupplier(onboardingRequest);

    // Auto-approve if they meet basic criteria (in production, this would be a review process)
    const autoApprove =
      supplier.certifications.length > 0 &&
      supplier.products.length >= 2 &&
      supplier.leadTime <= 14;

    if (autoApprove) {
      await updateSupplierStatus(supplier.id, 'active');
      supplier.status = 'active';
    }

    return NextResponse.json({
      success: true,
      supplier,
      message: autoApprove
        ? 'Supplier onboarded and automatically approved'
        : 'Supplier onboarded and pending review',
    }, { status: 201 });

  } catch (error: any) {
    console.error('Supplier onboarding error:', error);

    // Check for unique constraint violation (duplicate email)
    if (error.message?.includes('duplicate key')) {
      return NextResponse.json(
        { error: 'A supplier with this email already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to onboard supplier',
        details: error.message
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return NextResponse.json({
    endpoint: '/api/suppliers/onboard',
    method: 'POST',
    description: 'Onboard a new supplier',
    requiredFields: {
      companyName: 'string',
      contactEmail: 'string (valid email)',
      products: 'string[] (array of product categories)',
      pricing: {
        minimumOrder: 'number',
        currency: 'string (e.g., USD)',
        paymentTerms: 'string (e.g., NET30)',
        discountTiers: 'optional array of {minQuantity: number, discountPct: number}',
      },
      capacity: {
        monthlyVolume: 'number (units per month)',
        leadTime: 'number (days)',
        locations: 'string[] (cities/regions)',
      },
    },
    optionalFields: {
      phone: 'string',
      website: 'string',
      certifications: 'string[]',
      leadTime: 'number (overrides capacity.leadTime)',
      minimumOrder: 'number (overrides pricing.minimumOrder)',
      dropShipCapable: 'boolean',
      whiteLabelCapable: 'boolean',
    },
    exampleRequest: {
      companyName: 'Acme Industrial Supply',
      contactEmail: 'sales@acme.com',
      phone: '+1-555-0100',
      website: 'https://acme.com',
      products: ['bearings', 'industrial supplies', 'fasteners'],
      pricing: {
        minimumOrder: 500,
        currency: 'USD',
        paymentTerms: 'NET30',
        discountTiers: [
          { minQuantity: 100, discountPct: 5 },
          { minQuantity: 500, discountPct: 10 },
        ],
      },
      capacity: {
        monthlyVolume: 10000,
        leadTime: 5,
        locations: ['New York', 'Los Angeles', 'Chicago'],
      },
      certifications: ['ISO9001', 'ISO14001'],
      leadTime: 5,
      minimumOrder: 500,
      dropShipCapable: true,
      whiteLabelCapable: false,
    },
  });
}
