/**
 * Wells Onyx AI Ops - Integration Test Connection API
 */

import { NextRequest, NextResponse } from 'next/server';
import IntegrationManager, { IntegrationPlatform } from '@/lib/integrations';
import SlackIntegration from '@/lib/integrations/slack';
import JiraIntegration from '@/lib/integrations/jira';
import GmailIntegration from '@/lib/integrations/gmail';
import SalesforceIntegration from '@/lib/integrations/salesforce';
import { logMonitoringEvent } from '@/lib/monitoring';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  try {
    const { platform: platformName } = await params;
    const platform = platformName as IntegrationPlatform;
    const clientId = request.nextUrl.searchParams.get('clientId') || 'default_client';

    const manager = IntegrationManager.getInstance();
    const integration = await manager.getIntegrationByPlatform(clientId, platform);

    if (!integration) {
      return NextResponse.json(
        { success: false, error: 'Integration not found' },
        { status: 404 }
      );
    }

    // Create service instance
    let service;
    switch (platform) {
      case 'slack':
        service = new SlackIntegration(integration);
        break;
      case 'jira':
        service = new JiraIntegration(integration);
        break;
      case 'gmail':
        service = new GmailIntegration(integration);
        break;
      case 'salesforce':
        service = new SalesforceIntegration(integration);
        break;
      default:
        service = new SlackIntegration(integration); // Fallback
    }

    // Test connection
    const startTime = Date.now();
    const connected = await service.testConnection();
    const duration = Date.now() - startTime;

    // Check health
    const health = await service.checkHealth();

    // Check rate limit
    const rateLimit = await service.checkRateLimit();

    await logMonitoringEvent('integration_test', undefined, {
      platform,
      clientId,
      connected,
      duration,
      health,
    });

    if (connected) {
      // Update integration health
      await manager.updateIntegration(integration.id, {
        metadata: {
          ...integration.metadata,
          health,
        },
      });

      return NextResponse.json({
        success: true,
        connected: true,
        health,
        duration,
        rateLimit,
        message: 'Connection test successful',
      });
    } else {
      return NextResponse.json({
        success: false,
        connected: false,
        health: 'down',
        duration,
        error: 'Connection test failed',
      });
    }
  } catch (error: any) {
    const { platform: platformName } = await params;
    await logMonitoringEvent('integration_test_error', undefined, {
      platform: platformName,
      error: error.message,
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Connection test failed',
        details: error.message
      },
      { status: 500 }
    );
  }
}
