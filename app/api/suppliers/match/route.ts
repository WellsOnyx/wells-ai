/**
 * Supplier Matching API
 *
 * POST /api/suppliers/match
 * AI-powered matching of suppliers to RFQ requirements
 */

import { NextRequest, NextResponse } from 'next/server';
import { matchSuppliersToRequest } from '@/lib/suppliers/db';
import { RFQDetails } from '@/lib/suppliers/types';
import { sql } from '@vercel/postgres';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate required fields
    const { category, description, quantity, deliveryLocation } = body;

    if (!category || !description || !quantity || !deliveryLocation) {
      return NextResponse.json(
        {
          error: 'Missing required fields',
          required: ['category', 'description', 'quantity', 'deliveryLocation']
        },
        { status: 400 }
      );
    }

    // Validate quantity
    if (typeof quantity !== 'number' || quantity <= 0) {
      return NextResponse.json(
        { error: 'Quantity must be a positive number' },
        { status: 400 }
      );
    }

    // Validate urgency
    const validUrgencies = ['standard', 'urgent', 'critical'];
    const urgency = body.urgency || 'standard';
    if (!validUrgencies.includes(urgency)) {
      return NextResponse.json(
        { error: `Urgency must be one of: ${validUrgencies.join(', ')}` },
        { status: 400 }
      );
    }

    // Build RFQ details
    const rfqDetails: RFQDetails = {
      category,
      description,
      quantity,
      targetPrice: body.targetPrice,
      urgency,
      deliveryLocation,
      requiredCertifications: body.requiredCertifications || [],
      additionalRequirements: body.additionalRequirements,
    };

    // Store RFQ in database
    const requiredCertsArray = `{${(rfqDetails.requiredCertifications || []).map(c => `"${c}"`).join(',')}}`;

    const rfqResult = await sql`
      INSERT INTO rfqs (
        category,
        description,
        quantity,
        target_price,
        urgency,
        delivery_location,
        required_certifications,
        additional_requirements,
        requestor_email,
        requestor_name,
        status
      ) VALUES (
        ${rfqDetails.category},
        ${rfqDetails.description},
        ${rfqDetails.quantity},
        ${rfqDetails.targetPrice || null},
        ${rfqDetails.urgency},
        ${rfqDetails.deliveryLocation},
        ${requiredCertsArray}::text[],
        ${rfqDetails.additionalRequirements || null},
        ${body.requestorEmail || null},
        ${body.requestorName || null},
        'open'
      )
      RETURNING id
    `;

    const rfqId = rfqResult.rows[0].id;

    // Perform AI-powered matching
    const matchingResult = await matchSuppliersToRequest(rfqDetails);

    // Store matches in database
    for (const match of matchingResult.matches) {
      const strengthsArray = `{${(match.strengths || []).map(s => `"${s.replace(/"/g, '\\"')}"`).join(',')}}`;
      const concernsArray = `{${(match.concerns || []).map(c => `"${c.replace(/"/g, '\\"')}"`).join(',')}}`;

      await sql`
        INSERT INTO supplier_matches (
          rfq_id,
          supplier_id,
          match_score,
          reasoning,
          strengths,
          concerns,
          estimated_price,
          estimated_lead_time,
          status
        ) VALUES (
          ${rfqId},
          ${match.supplier.id},
          ${match.matchScore},
          ${match.reasoning},
          ${strengthsArray}::text[],
          ${concernsArray}::text[],
          ${match.estimatedPrice || null},
          ${match.estimatedLeadTime || null},
          'pending'
        )
      `;
    }

    // Update RFQ status if we found matches
    if (matchingResult.matches.length > 0) {
      await sql`
        UPDATE rfqs
        SET status = 'matched', updated_at = NOW()
        WHERE id = ${rfqId}
      `;
    }

    return NextResponse.json({
      success: true,
      rfqId,
      matches: matchingResult.matches.map(match => ({
        supplier: {
          id: match.supplier.id,
          companyName: match.supplier.companyName,
          contactEmail: match.supplier.contactEmail,
          phone: match.supplier.phone,
          website: match.supplier.website,
          products: match.supplier.products,
          leadTime: match.supplier.leadTime,
          minimumOrder: match.supplier.minimumOrder,
          certifications: match.supplier.certifications,
        },
        matchScore: match.matchScore,
        reasoning: match.reasoning,
        strengths: match.strengths,
        concerns: match.concerns,
        estimatedLeadTime: match.estimatedLeadTime,
      })),
      totalSuppliersConsidered: matchingResult.totalSuppliersConsidered,
      analyzedAt: matchingResult.analyzedAt,
    }, { status: 200 });

  } catch (error: any) {
    console.error('Supplier matching error:', error);

    return NextResponse.json(
      {
        error: 'Failed to match suppliers',
        details: error.message
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return NextResponse.json({
    endpoint: '/api/suppliers/match',
    method: 'POST',
    description: 'AI-powered matching of suppliers to RFQ requirements using Claude',
    requiredFields: {
      category: 'string (product category, e.g., "bearings", "electronics")',
      description: 'string (detailed description of what you need)',
      quantity: 'number (quantity needed)',
      deliveryLocation: 'string (city or region for delivery)',
    },
    optionalFields: {
      targetPrice: 'number (target price in USD)',
      urgency: 'string ("standard" | "urgent" | "critical", default: "standard")',
      requiredCertifications: 'string[] (e.g., ["ISO9001", "UL Listed"])',
      additionalRequirements: 'string (any other requirements)',
      requestorEmail: 'string (email of person requesting)',
      requestorName: 'string (name of person requesting)',
    },
    exampleRequest: {
      category: 'bearings',
      description: 'Need high-precision ball bearings for industrial machinery, stainless steel, 6000 series',
      quantity: 500,
      targetPrice: 2500,
      urgency: 'urgent',
      deliveryLocation: 'Chicago, IL',
      requiredCertifications: ['ISO9001'],
      additionalRequirements: 'Must be able to ship within 5 days',
      requestorEmail: 'buyer@company.com',
      requestorName: 'John Smith',
    },
    response: {
      success: true,
      rfqId: 'uuid',
      matches: [
        {
          supplier: {
            id: 'uuid',
            companyName: 'Supplier Name',
            contactEmail: 'sales@supplier.com',
            products: ['bearings', 'industrial supplies'],
            leadTime: 3,
            certifications: ['ISO9001'],
          },
          matchScore: 85,
          reasoning: 'AI-generated analysis of why this supplier is a good match',
          strengths: ['Fast lead time', 'Has required certifications'],
          concerns: ['Slightly higher pricing tier'],
          estimatedLeadTime: 3,
        },
      ],
      totalSuppliersConsidered: 5,
      analyzedAt: '2025-01-01T00:00:00.000Z',
    },
  });
}
