/**
 * Seller Agent Configuration API
 *
 * Endpoints:
 * - GET: Retrieve seller's agent configuration
 * - POST: Create or update agent configuration
 * - PATCH: Partial update to configuration
 *
 * This API manages the AI agent configuration that controls how
 * Wells represents sellers in negotiations.
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { SellerAgent, SellerAgentConfig } from '@/lib/seller/seller-agent';
import { getSellerConfig, updateSellerConfig, saveSellerConfig, getDefaultConfig } from '@/lib/seller/ai-agent-config';

// ============================================================================
// GET - Retrieve seller's agent configuration
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const sellerId = request.headers.get('x-seller-id') || request.nextUrl.searchParams.get('sellerId');

    if (!sellerId) {
      return NextResponse.json(
        { error: 'Seller ID is required' },
        { status: 400 }
      );
    }

    // Get full config from database
    const config = await getSellerConfig(sellerId);

    if (!config) {
      // Return defaults if not configured
      const defaults = getDefaultConfig(sellerId);
      return NextResponse.json({
        configured: false,
        config: {
          minMargin: defaults.pricingStrategy.minMargin,
          maxDiscount: 100 - defaults.pricingStrategy.minMargin,
          autoApproveBelow: defaults.autoResponse?.autoApproveUnder || 5000,
          responseTimeTarget: 'within_hour',
          negotiationStyle: defaults.negotiationStyle?.aggression || 'balanced',
          preferredPaymentTerms: ['NET30'],
          volumeDiscountTiers: defaults.pricingStrategy.volumeDiscountTiers,
          rushOrderPremium: defaults.pricingStrategy.urgencyPremium,
          standardLeadTimeDays: defaults.pricingStrategy.standardLeadTimeDays,
          rushLeadTimeDays: defaults.pricingStrategy.rushLeadTimeDays,
        },
        suggestions: [
          'Set your minimum margin to protect profitability',
          'Configure auto-approval limits to speed up small deals',
          'Choose a negotiation style that matches your business',
        ],
      });
    }

    // Convert internal config to SellerAgentConfig format
    const agentConfig: SellerAgentConfig = {
      minMargin: config.pricingStrategy.minMargin,
      maxDiscount: 100 - config.pricingStrategy.minMargin,
      autoApproveBelow: config.autoResponse.autoApproveUnder,
      responseTimeTarget: config.autoResponse.quoteResponseHours <= 1 ? 'immediate' :
        config.autoResponse.quoteResponseHours <= 4 ? 'within_hour' : 'within_day',
      negotiationStyle: config.negotiationStyle.aggression as 'aggressive' | 'balanced' | 'accommodating',
      preferredPaymentTerms: ['NET30'],
      volumeDiscountTiers: config.pricingStrategy.volumeDiscountTiers,
      rushOrderPremium: config.pricingStrategy.urgencyPremium,
      standardLeadTimeDays: config.pricingStrategy.standardLeadTimeDays,
      rushLeadTimeDays: config.pricingStrategy.rushLeadTimeDays,
      requireApprovalAbove: config.autoResponse.requireApprovalOver,
      autoApproveMarginOver: config.autoResponse.autoApproveMarginOver,
    };

    // Get buyer preferences
    let buyerPreferences = { excludedBuyers: [], priorityBuyers: [] };
    try {
      const prefResult = await sql`
        SELECT excluded_buyers, priority_buyers
        FROM seller_buyer_preferences
        WHERE seller_id = ${sellerId}
      `;
      if (prefResult.rows.length > 0) {
        buyerPreferences = {
          excludedBuyers: typeof prefResult.rows[0].excluded_buyers === 'string'
            ? JSON.parse(prefResult.rows[0].excluded_buyers)
            : prefResult.rows[0].excluded_buyers || [],
          priorityBuyers: typeof prefResult.rows[0].priority_buyers === 'string'
            ? JSON.parse(prefResult.rows[0].priority_buyers)
            : prefResult.rows[0].priority_buyers || [],
        };
      }
    } catch {
      // Table may not exist
    }

    return NextResponse.json({
      configured: true,
      sellerId,
      companyName: config.companyName,
      config: {
        ...agentConfig,
        excludedBuyers: buyerPreferences.excludedBuyers,
        priorityBuyers: buyerPreferences.priorityBuyers,
      },
      isActive: config.isActive,
      notifications: config.notifications,
      lastUpdated: config.updatedAt,
    });
  } catch (error) {
    console.error('Error fetching seller agent config:', error);
    return NextResponse.json(
      { error: 'Failed to fetch configuration' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Create or fully update agent configuration
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const sellerId = request.headers.get('x-seller-id');
    const body = await request.json();

    if (!sellerId) {
      return NextResponse.json(
        { error: 'Seller ID is required in x-seller-id header' },
        { status: 400 }
      );
    }

    // Validate required fields
    const config: SellerAgentConfig = {
      minMargin: body.minMargin ?? 15,
      maxDiscount: body.maxDiscount ?? 20,
      autoApproveBelow: body.autoApproveBelow ?? 5000,
      responseTimeTarget: body.responseTimeTarget ?? 'within_hour',
      negotiationStyle: body.negotiationStyle ?? 'balanced',
      preferredPaymentTerms: body.preferredPaymentTerms ?? ['NET30'],
      excludedBuyers: body.excludedBuyers,
      priorityBuyers: body.priorityBuyers,
      volumeDiscountTiers: body.volumeDiscountTiers,
      rushOrderPremium: body.rushOrderPremium ?? 20,
      standardLeadTimeDays: body.standardLeadTimeDays ?? 7,
      rushLeadTimeDays: body.rushLeadTimeDays ?? 3,
      requireApprovalAbove: body.requireApprovalAbove,
      autoApproveMarginOver: body.autoApproveMarginOver,
    };

    // Use SellerAgent to configure
    const agent = new SellerAgent();
    await agent.configureAgent(sellerId, config);

    // Get the saved config
    const savedConfig = await getSellerConfig(sellerId);

    return NextResponse.json({
      success: true,
      message: 'Agent configuration saved successfully',
      config: savedConfig,
    });
  } catch (error) {
    console.error('Error saving seller agent config:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save configuration' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATCH - Partial update to configuration
// ============================================================================

export async function PATCH(request: NextRequest) {
  try {
    const sellerId = request.headers.get('x-seller-id');
    const updates = await request.json();

    if (!sellerId) {
      return NextResponse.json(
        { error: 'Seller ID is required in x-seller-id header' },
        { status: 400 }
      );
    }

    // Check if config exists
    const existingConfig = await getSellerConfig(sellerId);
    if (!existingConfig) {
      return NextResponse.json(
        { error: 'Agent not configured. Use POST to create initial configuration.' },
        { status: 404 }
      );
    }

    // Build partial update
    const partialUpdate: Record<string, unknown> = {};

    if (updates.pricingStrategy) {
      partialUpdate.pricingStrategy = {
        ...existingConfig.pricingStrategy,
        ...updates.pricingStrategy,
      };
    }

    if (updates.negotiationStyle) {
      partialUpdate.negotiationStyle = {
        ...existingConfig.negotiationStyle,
        ...updates.negotiationStyle,
      };
    }

    if (updates.autoResponse) {
      partialUpdate.autoResponse = {
        ...existingConfig.autoResponse,
        ...updates.autoResponse,
      };
    }

    if (updates.notifications) {
      partialUpdate.notifications = {
        ...existingConfig.notifications,
        ...updates.notifications,
      };
    }

    if (updates.companyName) {
      partialUpdate.companyName = updates.companyName;
    }

    if (updates.isActive !== undefined) {
      partialUpdate.isActive = updates.isActive;
    }

    // Update config
    await updateSellerConfig(sellerId, partialUpdate);

    // Handle buyer preferences separately
    if (updates.excludedBuyers || updates.priorityBuyers) {
      await sql`
        INSERT INTO seller_buyer_preferences (seller_id, excluded_buyers, priority_buyers, updated_at)
        VALUES (
          ${sellerId},
          ${JSON.stringify(updates.excludedBuyers || [])},
          ${JSON.stringify(updates.priorityBuyers || [])},
          NOW()
        )
        ON CONFLICT (seller_id) DO UPDATE SET
          excluded_buyers = COALESCE(${updates.excludedBuyers ? JSON.stringify(updates.excludedBuyers) : null}, seller_buyer_preferences.excluded_buyers),
          priority_buyers = COALESCE(${updates.priorityBuyers ? JSON.stringify(updates.priorityBuyers) : null}, seller_buyer_preferences.priority_buyers),
          updated_at = NOW()
      `;
    }

    // Get updated config
    const updatedConfig = await getSellerConfig(sellerId);

    return NextResponse.json({
      success: true,
      message: 'Configuration updated',
      config: updatedConfig,
    });
  } catch (error) {
    console.error('Error updating seller agent config:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update configuration' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE - Deactivate the agent
// ============================================================================

export async function DELETE(request: NextRequest) {
  try {
    const sellerId = request.headers.get('x-seller-id');

    if (!sellerId) {
      return NextResponse.json(
        { error: 'Seller ID is required in x-seller-id header' },
        { status: 400 }
      );
    }

    // Deactivate (soft delete)
    await updateSellerConfig(sellerId, { isActive: false });

    return NextResponse.json({
      success: true,
      message: 'Seller agent deactivated',
    });
  } catch (error) {
    console.error('Error deactivating seller agent:', error);
    return NextResponse.json(
      { error: 'Failed to deactivate agent' },
      { status: 500 }
    );
  }
}
