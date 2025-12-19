/**
 * Buyer ERP Scanner API
 * Proactive procurement opportunity detection
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  getERPConnections,
  getERPConnection,
  createERPConnection,
  updateScannerSettings,
  disconnectERP,
  scanForOpportunities,
  getOpportunities,
  actionOpportunity,
  parseERPSettingsFromText,
  parseOpportunityActionFromText,
} from '@/lib/buyer/erp-scanner';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const type = searchParams.get('type') || 'opportunities';

    if (type === 'connections') {
      const connections = await getERPConnections(userId);

      let message = '';
      if (connections.length === 0) {
        message = "You don't have any ERP systems connected yet. I can connect to QuickBooks, Xero, NetSuite, SAP, Coupa, or Oracle. Which do you use?";
      } else {
        const connected = connections.filter((c) => c.connectionStatus === 'connected');
        if (connected.length > 0) {
          message = `Connected to ${connected.map((c) => c.erpType).join(', ')}. I'm actively scanning for procurement opportunities.`;
        } else {
          message = `${connections.length} ERP connection${connections.length > 1 ? 's' : ''} configured but not currently connected. Want me to reconnect?`;
        }
      }

      return NextResponse.json({
        success: true,
        connections,
        message,
      });
    }

    // Default: get opportunities
    const status = searchParams.get('status') || undefined;
    const priority = searchParams.get('priority') || undefined;

    const opportunities = await getOpportunities(userId, { status, priority });

    const newOpps = opportunities.filter((o) => o.status === 'new');
    const urgentOpps = opportunities.filter((o) => o.priority === 'urgent' || o.priority === 'high');

    let message = '';
    if (urgentOpps.length > 0) {
      const topOpp = urgentOpps[0];
      message = `Heads up: ${urgentOpps.length} urgent procurement opportunit${urgentOpps.length > 1 ? 'ies' : 'y'}. `;
      message += `${topOpp.title}`;
      if (topOpp.estimatedSavings) {
        message += ` - potential savings of $${topOpp.estimatedSavings.toLocaleString()}`;
      }
      message += `. Want me to start an RFQ?`;
    } else if (newOpps.length > 0) {
      message = `Found ${newOpps.length} new procurement opportunit${newOpps.length > 1 ? 'ies' : 'y'} from your ERP data. Want to review them?`;
    } else if (opportunities.length > 0) {
      message = `${opportunities.length} opportunities in your queue. Want to take action on any of them?`;
    } else {
      message = "No procurement opportunities detected right now. I'll keep scanning and let you know when something comes up.";
    }

    return NextResponse.json({
      success: true,
      opportunities,
      message,
      stats: {
        total: opportunities.length,
        new: newOpps.length,
        urgent: urgentOpps.length,
      },
    });
  } catch (error: any) {
    console.error('Error fetching ERP data:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch ERP data' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, connectionId, opportunityId, erpType, text, data } = body;

    switch (action) {
      case 'connect': {
        if (!erpType) {
          return NextResponse.json({ error: 'erpType required' }, { status: 400 });
        }

        // Parse settings from natural language if provided
        let settings = data || {};
        if (text) {
          const parsed = parseERPSettingsFromText(text);
          settings = { ...settings, ...parsed };
        }

        const connection = await createERPConnection(userId, erpType, {
          // In production, would handle OAuth flow
          credentials: body.credentials,
          settings,
        });

        return NextResponse.json({
          success: true,
          connection,
          message: `Connected to ${erpType}! I'll start scanning for procurement opportunities. This usually takes a few minutes for the initial sync.`,
        });
      }

      case 'update_settings': {
        if (!connectionId) {
          return NextResponse.json({ error: 'connectionId required' }, { status: 400 });
        }

        let settings = data || {};
        if (text) {
          const parsed = parseERPSettingsFromText(text);
          settings = { ...settings, ...parsed };
        }

        const connection = await updateScannerSettings(connectionId, settings);

        return NextResponse.json({
          success: true,
          connection,
          message: `Updated your scanning preferences. I'll adjust what I look for accordingly.`,
        });
      }

      case 'disconnect': {
        if (!connectionId) {
          return NextResponse.json({ error: 'connectionId required' }, { status: 400 });
        }

        await disconnectERP(connectionId);

        return NextResponse.json({
          success: true,
          message: `Disconnected. I won't scan this ERP anymore. You can reconnect anytime.`,
        });
      }

      case 'scan': {
        // Trigger manual scan
        const { opportunities, summary } = await scanForOpportunities(userId, connectionId);

        return NextResponse.json({
          success: true,
          opportunities,
          message: summary,
        });
      }

      case 'action_opportunity': {
        if (!opportunityId) {
          return NextResponse.json({ error: 'opportunityId required' }, { status: 400 });
        }

        // Parse action from text if needed
        let opportunityAction = body.opportunityAction;
        if (text && !opportunityAction) {
          const parsed = parseOpportunityActionFromText(text);
          opportunityAction = parsed.action;
        }

        if (!opportunityAction) {
          return NextResponse.json({ error: 'opportunityAction required' }, { status: 400 });
        }

        const result = await actionOpportunity(opportunityId, opportunityAction, data);

        return NextResponse.json({
          success: true,
          ...result,
        });
      }

      case 'create_rfq': {
        if (!opportunityId) {
          return NextResponse.json({ error: 'opportunityId required' }, { status: 400 });
        }

        const result = await actionOpportunity(opportunityId, 'create_rfq', data);

        return NextResponse.json({
          success: true,
          ...result,
          message: `Created RFQ from this opportunity. I'm now matching suppliers. ${result.message || ''}`,
        });
      }

      case 'dismiss': {
        if (!opportunityId) {
          return NextResponse.json({ error: 'opportunityId required' }, { status: 400 });
        }

        const result = await actionOpportunity(opportunityId, 'dismiss', {
          reason: text || body.reason,
        });

        return NextResponse.json({
          success: true,
          ...result,
        });
      }

      case 'remind_later': {
        if (!opportunityId) {
          return NextResponse.json({ error: 'opportunityId required' }, { status: 400 });
        }

        const result = await actionOpportunity(opportunityId, 'remind_later', {
          remindAt: body.remindAt,
        });

        return NextResponse.json({
          success: true,
          ...result,
        });
      }

      case 'parse_action': {
        if (!text) {
          return NextResponse.json({ error: 'text required' }, { status: 400 });
        }

        const parsed = parseOpportunityActionFromText(text);

        return NextResponse.json({
          success: true,
          parsed,
        });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Error handling ERP action:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process action' },
      { status: 500 }
    );
  }
}
