/**
 * Supplier Database Functions
 *
 * Core database operations for supplier management
 */

import { sql } from '@vercel/postgres';
import { Supplier, SupplierOnboardingRequest, RFQDetails, SupplierMatch, MatchingResult } from './types';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Onboard a new supplier
 */
export async function createSupplier(data: SupplierOnboardingRequest): Promise<Supplier> {
  const productsArray = `{${data.products.map(p => `"${p}"`).join(',')}}`;
  const certificationsArray = `{${data.certifications.map(c => `"${c}"`).join(',')}}`;

  const result = await sql`
    INSERT INTO suppliers (
      company_name,
      contact_email,
      phone,
      website,
      products,
      pricing,
      capacity,
      certifications,
      lead_time,
      minimum_order,
      drop_ship_capable,
      white_label_capable,
      status
    ) VALUES (
      ${data.companyName},
      ${data.contactEmail},
      ${data.phone || null},
      ${data.website || null},
      ${productsArray}::text[],
      ${JSON.stringify(data.pricing)}::jsonb,
      ${JSON.stringify(data.capacity)}::jsonb,
      ${certificationsArray}::text[],
      ${data.leadTime},
      ${data.minimumOrder},
      ${data.dropShipCapable !== false},
      ${data.whiteLabelCapable || false},
      'pending'
    )
    RETURNING *
  `;

  return dbRowToSupplier(result.rows[0]);
}

/**
 * Get suppliers by category
 */
export async function getSuppliersByCategory(category: string): Promise<Supplier[]> {
  const result = await sql`
    SELECT * FROM suppliers
    WHERE ${category} = ANY(products)
    AND status = 'active'
    ORDER BY created_at DESC
  `;

  return result.rows.map(dbRowToSupplier);
}

/**
 * Get all active suppliers
 */
export async function getAllSuppliers(): Promise<Supplier[]> {
  const result = await sql`
    SELECT * FROM suppliers
    WHERE status = 'active'
    ORDER BY created_at DESC
  `;

  return result.rows.map(dbRowToSupplier);
}

/**
 * AI-powered supplier matching
 * Uses Claude to analyze suppliers against RFQ requirements
 */
export async function matchSuppliersToRequest(rfqDetails: RFQDetails): Promise<MatchingResult> {
  // Get suppliers that might match the category
  const suppliers = await getSuppliersByCategory(rfqDetails.category);

  if (suppliers.length === 0) {
    // Try to get all suppliers if no category match
    const allSuppliers = await getAllSuppliers();
    return {
      matches: [],
      rfqDetails,
      analyzedAt: new Date(),
      totalSuppliersConsidered: allSuppliers.length,
    };
  }

  // Use Claude to score and rank suppliers
  const prompt = `You are an expert procurement analyst. Analyze these suppliers against the RFQ requirements and score each one.

RFQ REQUIREMENTS:
- Category: ${rfqDetails.category}
- Description: ${rfqDetails.description}
- Quantity: ${rfqDetails.quantity}
- Target Price: ${rfqDetails.targetPrice ? `$${rfqDetails.targetPrice}` : 'Not specified'}
- Urgency: ${rfqDetails.urgency}
- Delivery Location: ${rfqDetails.deliveryLocation}
- Required Certifications: ${rfqDetails.requiredCertifications?.join(', ') || 'None specified'}
${rfqDetails.additionalRequirements ? `- Additional Requirements: ${rfqDetails.additionalRequirements}` : ''}

AVAILABLE SUPPLIERS:
${suppliers.map((s, i) => `
Supplier ${i + 1}: ${s.companyName}
- Products: ${s.products.join(', ')}
- Lead Time: ${s.leadTime} days
- Minimum Order: $${s.minimumOrder}
- Payment Terms: ${s.pricing.paymentTerms}
- Monthly Capacity: ${s.capacity.monthlyVolume} units
- Locations: ${s.capacity.locations.join(', ')}
- Certifications: ${s.certifications.join(', ') || 'None'}
- Drop Ship: ${s.dropShipCapable ? 'Yes' : 'No'}
`).join('\n')}

For each supplier, provide:
1. Match score (0-100)
2. Brief reasoning (2-3 sentences)
3. Strengths (list of 2-4 key advantages)
4. Concerns (list of 1-2 potential issues, if any)

Respond in JSON format:
{
  "matches": [
    {
      "supplierIndex": 0,
      "matchScore": 85,
      "reasoning": "...",
      "strengths": ["...", "..."],
      "concerns": ["..."]
    }
  ]
}

Only include suppliers with a match score of 40 or higher. Sort by match score descending.`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    // Parse Claude's response
    const analysis = JSON.parse(content.text);

    // Map the analysis to our SupplierMatch format
    const matches: SupplierMatch[] = analysis.matches.map((match: any) => {
      const supplier = suppliers[match.supplierIndex];
      return {
        supplier,
        matchScore: match.matchScore,
        reasoning: match.reasoning,
        strengths: match.strengths,
        concerns: match.concerns,
        estimatedLeadTime: supplier.leadTime,
      };
    });

    return {
      matches,
      rfqDetails,
      analyzedAt: new Date(),
      totalSuppliersConsidered: suppliers.length,
    };
  } catch (error) {
    console.error('AI matching error:', error);

    // Fallback to simple rule-based matching
    const matches: SupplierMatch[] = suppliers
      .map(supplier => {
        let score = 50; // Base score

        // Check certifications
        if (rfqDetails.requiredCertifications) {
          const hasAllCerts = rfqDetails.requiredCertifications.every(cert =>
            supplier.certifications.includes(cert)
          );
          if (hasAllCerts) score += 20;
          else score -= 30;
        }

        // Check lead time against urgency
        if (rfqDetails.urgency === 'critical' && supplier.leadTime <= 3) score += 15;
        else if (rfqDetails.urgency === 'urgent' && supplier.leadTime <= 7) score += 10;
        else if (rfqDetails.urgency === 'standard' && supplier.leadTime <= 14) score += 5;
        else score -= 10;

        // Check capacity
        if (supplier.capacity.monthlyVolume >= rfqDetails.quantity) score += 10;
        else score -= 20;

        // Check minimum order
        if (rfqDetails.targetPrice && supplier.minimumOrder <= rfqDetails.targetPrice) {
          score += 5;
        }

        return {
          supplier,
          matchScore: Math.max(0, Math.min(100, score)),
          reasoning: `Basic match based on capacity, lead time, and certifications.`,
          strengths: [
            `Lead time: ${supplier.leadTime} days`,
            `Monthly capacity: ${supplier.capacity.monthlyVolume} units`,
          ],
          estimatedLeadTime: supplier.leadTime,
        };
      })
      .filter(match => match.matchScore >= 40)
      .sort((a, b) => b.matchScore - a.matchScore);

    return {
      matches,
      rfqDetails,
      analyzedAt: new Date(),
      totalSuppliersConsidered: suppliers.length,
    };
  }
}

/**
 * Update supplier status
 */
export async function updateSupplierStatus(
  supplierId: string,
  status: Supplier['status']
): Promise<void> {
  await sql`
    UPDATE suppliers
    SET
      status = ${status},
      onboarded_at = CASE WHEN ${status} = 'active' AND onboarded_at IS NULL THEN NOW() ELSE onboarded_at END,
      updated_at = NOW()
    WHERE id = ${supplierId}
  `;
}

/**
 * Get supplier by ID
 */
export async function getSupplierById(supplierId: string): Promise<Supplier | null> {
  const result = await sql`
    SELECT * FROM suppliers WHERE id = ${supplierId}
  `;

  if (result.rows.length === 0) {
    return null;
  }

  return dbRowToSupplier(result.rows[0]);
}

/**
 * Convert database row to Supplier object
 */
function dbRowToSupplier(row: any): Supplier {
  return {
    id: row.id,
    companyName: row.company_name,
    contactEmail: row.contact_email,
    phone: row.phone,
    website: row.website,
    products: row.products,
    pricing: row.pricing,
    capacity: row.capacity,
    certifications: row.certifications,
    leadTime: row.lead_time,
    minimumOrder: row.minimum_order,
    dropShipCapable: row.drop_ship_capable,
    whiteLabelCapable: row.white_label_capable,
    status: row.status,
    onboardedAt: row.onboarded_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
