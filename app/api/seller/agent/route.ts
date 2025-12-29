/**
 * Seller AI Agent Configuration API
 *
 * POST /api/seller/agent - Create/update agent configuration
 * GET /api/seller/agent - Get current configuration
 * PUT /api/seller/agent - Update configuration via conversation
 * DELETE /api/seller/agent - Deactivate agent
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  SellerAIConfig,
  getDefaultConfig,
  saveSellerConfig,
  getSellerConfig,
  updateSellerConfig,
  deactivateAgent,
  activateAgent,
  processSetupMessage,
  ConversationalSetupContext,
  SetupStep,
} from '@/lib/seller/ai-agent-config';

// ============================================================================
// GET - Get seller's agent configuration
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const config = await getSellerConfig(userId);

    if (!config) {
      return NextResponse.json({
        configured: false,
        message: 'Agent not configured. Use POST to set up.',
        defaultConfig: getDefaultConfig(userId),
      });
    }

    return NextResponse.json({
      configured: true,
      config,
    });
  } catch (error) {
    console.error('Error getting seller config:', error);
    return NextResponse.json(
      { error: 'Failed to get configuration' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Create or update agent configuration
// ============================================================================

interface CreateAgentRequest {
  // Quick setup mode
  mode?: 'quick' | 'conversational';

  // For quick setup - direct configuration
  companyName?: string;
  businessDescription?: string;
  productCategories?: string[];
  contactEmail?: string;
  contactPhone?: string;

  // Pricing (simplified)
  targetMargin?: number;
  minMargin?: number;

  // Auto-response settings
  autoResponseEnabled?: boolean;
  autoApproveUnder?: number;
  quoteResponseHours?: number;

  // Negotiation style
  negotiationStyle?: 'conservative' | 'balanced' | 'aggressive';

  // For conversational setup - message and context
  message?: string;
  setupContext?: ConversationalSetupContext;
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as CreateAgentRequest;
    const mode = body.mode || 'quick';

    // Conversational setup mode
    if (mode === 'conversational') {
      if (!body.message) {
        // Start new conversational setup
        const context: ConversationalSetupContext = {
          sellerId: userId,
          currentStep: 'business_description',
          collectedData: getDefaultConfig(userId),
          conversationHistory: [],
        };

        return NextResponse.json({
          response: "Let's set up your seller AI. What does your company sell?",
          context,
          step: 'business_description',
          isComplete: false,
        });
      }

      // Continue conversational setup
      const context = body.setupContext || {
        sellerId: userId,
        currentStep: 'business_description' as SetupStep,
        collectedData: getDefaultConfig(userId),
        conversationHistory: [],
      };

      const result = await processSetupMessage(context, body.message);

      // Update context
      const updatedContext: ConversationalSetupContext = {
        ...context,
        currentStep: result.nextStep,
        collectedData: {
          ...context.collectedData,
          ...result.extractedData,
        },
        conversationHistory: [
          ...context.conversationHistory,
          { role: 'seller', content: body.message, timestamp: new Date() },
          { role: 'wells', content: result.response, timestamp: new Date() },
        ],
      };

      // If complete, save configuration
      if (result.isComplete) {
        const config = await saveSellerConfig({
          ...getDefaultConfig(userId),
          ...updatedContext.collectedData,
          id: `seller_${userId}_${Date.now()}`,
          sellerId: userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as SellerAIConfig);

        return NextResponse.json({
          response: result.response,
          context: updatedContext,
          step: 'complete',
          isComplete: true,
          config,
        });
      }

      return NextResponse.json({
        response: result.response,
        context: updatedContext,
        step: result.nextStep,
        isComplete: false,
      });
    }

    // Quick setup mode - direct configuration
    if (!body.companyName || !body.contactEmail) {
      return NextResponse.json(
        { error: 'Missing required fields: companyName, contactEmail' },
        { status: 400 }
      );
    }

    const defaults = getDefaultConfig(userId);

    const config: SellerAIConfig = {
      id: `seller_${userId}_${Date.now()}`,
      sellerId: userId,
      companyName: body.companyName,
      businessDescription: body.businessDescription || '',
      productCategories: body.productCategories || [],
      specializations: [],

      pricingStrategy: {
        ...defaults.pricingStrategy!,
        targetMargin: body.targetMargin || defaults.pricingStrategy!.targetMargin,
        minMargin: body.minMargin || defaults.pricingStrategy!.minMargin,
      },

      negotiationStyle: {
        ...defaults.negotiationStyle!,
        aggression: body.negotiationStyle || 'balanced',
      },

      autoResponse: {
        ...defaults.autoResponse!,
        enabled: body.autoResponseEnabled !== false,
        autoApproveUnder: body.autoApproveUnder || defaults.autoResponse!.autoApproveUnder,
        quoteResponseHours: body.quoteResponseHours || defaults.autoResponse!.quoteResponseHours,
      },

      notifications: defaults.notifications!,
      preferredContactMethod: 'email',
      contactEmail: body.contactEmail,
      contactPhone: body.contactPhone,

      agentTone: 'professional',
      valuePropositions: [],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const savedConfig = await saveSellerConfig(config);

    return NextResponse.json({
      success: true,
      message: 'Seller AI agent configured successfully!',
      config: savedConfig,
    });
  } catch (error) {
    console.error('Error creating seller config:', error);
    return NextResponse.json(
      { error: 'Failed to create configuration' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PUT - Update agent configuration
// ============================================================================

interface UpdateAgentRequest {
  // Can update individual fields
  companyName?: string;
  businessDescription?: string;
  productCategories?: string[];

  // Pricing updates
  targetMargin?: number;
  minMargin?: number;
  walkAwayMargin?: number;

  // Auto-response updates
  autoResponseEnabled?: boolean;
  autoApproveUnder?: number;
  requireApprovalOver?: number;

  // Negotiation updates
  negotiationStyle?: 'conservative' | 'balanced' | 'aggressive';
  maxConcessions?: number;

  // Notification updates
  notifyEmail?: boolean;
  notifySms?: boolean;

  // Conversational update
  message?: string;
}

export async function PUT(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as UpdateAgentRequest;

    // Handle conversational updates
    if (body.message) {
      // Use AI to interpret the update request
      const config = await getSellerConfig(userId);
      if (!config) {
        return NextResponse.json(
          { error: 'Agent not configured' },
          { status: 404 }
        );
      }

      // TODO: Process conversational update via AI
      // For now, return instructions
      return NextResponse.json({
        message: 'Conversational updates coming soon. Use direct field updates for now.',
        currentConfig: config,
      });
    }

    // Direct field updates
    const updates: Partial<SellerAIConfig> = {};

    if (body.companyName) updates.companyName = body.companyName;
    if (body.businessDescription) updates.businessDescription = body.businessDescription;
    if (body.productCategories) updates.productCategories = body.productCategories;

    // Pricing updates
    if (body.targetMargin !== undefined || body.minMargin !== undefined || body.walkAwayMargin !== undefined) {
      const existing = await getSellerConfig(userId);
      updates.pricingStrategy = {
        ...existing?.pricingStrategy!,
        targetMargin: body.targetMargin ?? existing?.pricingStrategy.targetMargin ?? 30,
        minMargin: body.minMargin ?? existing?.pricingStrategy.minMargin ?? 15,
        walkAwayMargin: body.walkAwayMargin ?? existing?.pricingStrategy.walkAwayMargin ?? 5,
      };
    }

    // Auto-response updates
    if (body.autoResponseEnabled !== undefined || body.autoApproveUnder !== undefined) {
      const existing = await getSellerConfig(userId);
      updates.autoResponse = {
        ...existing?.autoResponse!,
        enabled: body.autoResponseEnabled ?? existing?.autoResponse.enabled ?? true,
        autoApproveUnder: body.autoApproveUnder ?? existing?.autoResponse.autoApproveUnder ?? 5000,
        requireApprovalOver: body.requireApprovalOver ?? existing?.autoResponse.requireApprovalOver ?? 25000,
      };
    }

    // Negotiation updates
    if (body.negotiationStyle || body.maxConcessions !== undefined) {
      const existing = await getSellerConfig(userId);
      updates.negotiationStyle = {
        ...existing?.negotiationStyle!,
        aggression: body.negotiationStyle ?? existing?.negotiationStyle.aggression ?? 'balanced',
        maxConcessions: body.maxConcessions ?? existing?.negotiationStyle.maxConcessions ?? 3,
      };
    }

    const updatedConfig = await updateSellerConfig(userId, updates);

    if (!updatedConfig) {
      return NextResponse.json(
        { error: 'Agent not configured' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Configuration updated',
      config: updatedConfig,
    });
  } catch (error) {
    console.error('Error updating seller config:', error);
    return NextResponse.json(
      { error: 'Failed to update configuration' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE - Deactivate agent
// ============================================================================

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    if (action === 'reactivate') {
      await activateAgent(userId);
      return NextResponse.json({
        success: true,
        message: 'Agent reactivated',
      });
    }

    await deactivateAgent(userId);

    return NextResponse.json({
      success: true,
      message: 'Agent deactivated. Your settings are preserved. Use ?action=reactivate to turn it back on.',
    });
  } catch (error) {
    console.error('Error deactivating agent:', error);
    return NextResponse.json(
      { error: 'Failed to deactivate agent' },
      { status: 500 }
    );
  }
}
