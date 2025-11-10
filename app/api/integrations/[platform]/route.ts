/**
 * Wells Onyx AI Ops - Integration API
 */

import { NextRequest, NextResponse } from 'next/server';
import IntegrationManager, {
  Integration,
  IntegrationPlatform,
  AVAILABLE_INTEGRATIONS,
} from '@/lib/integrations';
import SlackIntegration from '@/lib/integrations/slack';
import JiraIntegration from '@/lib/integrations/jira';
import GmailIntegration from '@/lib/integrations/gmail';
import SalesforceIntegration from '@/lib/integrations/salesforce';
import { logMonitoringEvent } from '@/lib/monitoring';

// GET - Get integration status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  try {
    const { platform: platformName } = await params;
    const platform = platformName as IntegrationPlatform;
    const manager = IntegrationManager.getInstance();

    // Get client ID from query or auth
    const clientId = request.nextUrl.searchParams.get('clientId') || 'default_client';

    const integration = await manager.getIntegrationByPlatform(clientId, platform);

    if (!integration) {
      return NextResponse.json(
        { error: 'Integration not found' },
        { status: 404 }
      );
    }

    // Remove sensitive credentials from response
    const sanitized = {
      ...integration,
      credentials: {
        ...integration.credentials,
        accessToken: integration.credentials.accessToken ? '***' : undefined,
        apiKey: integration.credentials.apiKey ? '***' : undefined,
        refreshToken: integration.credentials.refreshToken ? '***' : undefined,
      },
    };

    return NextResponse.json({ integration: sanitized });
  } catch (error: any) {
    await logMonitoringEvent('integration_api_error', undefined, {
      endpoint: 'GET',
      error: error.message,
    });

    return NextResponse.json(
      { error: 'Failed to get integration', details: error.message },
      { status: 500 }
    );
  }
}

// POST - Connect integration
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  try {
    const { platform: platformName } = await params;
    const platform = platformName as IntegrationPlatform;
    const body = await request.json();
    const { credentials, config, clientId = 'default_client' } = body;

    const manager = IntegrationManager.getInstance();

    // Check if already connected
    const existing = await manager.getIntegrationByPlatform(clientId, platform);
    if (existing) {
      return NextResponse.json(
        { error: 'Integration already connected' },
        { status: 409 }
      );
    }

    // Get metadata
    const metadata = AVAILABLE_INTEGRATIONS.find(
      (i) => i.name.toLowerCase().replace(/\s+/g, '-') === platform
    );

    if (!metadata) {
      return NextResponse.json(
        { error: 'Invalid platform' },
        { status: 400 }
      );
    }

    // Create integration
    const integration = await manager.createIntegration({
      platform,
      clientId,
      status: 'configuring',
      credentials,
      lastSync: new Date().toISOString(),
      config: {
        autoSync: true,
        syncInterval: 60,
        retryAttempts: 3,
        timeout: 30000,
        ...config,
      },
      metadata: {
        ...metadata,
        actionsCount: 0,
        health: 'healthy',
      },
    });

    // Initialize the integration service
    const service = createIntegrationService(integration);
    await service.connect(clientId, credentials);

    // Update status
    await manager.updateIntegration(integration.id, {
      status: 'connected',
    });

    await logMonitoringEvent('integration_connected', undefined, {
      platform,
      clientId,
    });

    return NextResponse.json({
      success: true,
      integration: {
        ...integration,
        status: 'connected',
      },
    });
  } catch (error: any) {
    await logMonitoringEvent('integration_api_error', undefined, {
      endpoint: 'POST',
      error: error.message,
    });

    return NextResponse.json(
      { error: 'Failed to connect integration', details: error.message },
      { status: 500 }
    );
  }
}

// PATCH - Update integration config
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  try {
    const { platform: platformName } = await params;
    const platform = platformName as IntegrationPlatform;
    const body = await request.json();
    const { config, credentials, clientId = 'default_client' } = body;

    const manager = IntegrationManager.getInstance();
    const integration = await manager.getIntegrationByPlatform(clientId, platform);

    if (!integration) {
      return NextResponse.json(
        { error: 'Integration not found' },
        { status: 404 }
      );
    }

    // Update integration
    const updated = await manager.updateIntegration(integration.id, {
      config: {
        ...integration.config,
        ...config,
      },
      credentials: credentials || integration.credentials,
    });

    await logMonitoringEvent('integration_updated', undefined, {
      platform,
      clientId,
    });

    return NextResponse.json({
      success: true,
      integration: updated,
    });
  } catch (error: any) {
    await logMonitoringEvent('integration_api_error', undefined, {
      endpoint: 'PATCH',
      error: error.message,
    });

    return NextResponse.json(
      { error: 'Failed to update integration', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Disconnect integration
export async function DELETE(
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
        { error: 'Integration not found' },
        { status: 404 }
      );
    }

    // Disconnect using service
    const service = createIntegrationService(integration);
    await service.disconnect(clientId);

    // Delete integration
    await manager.deleteIntegration(integration.id);

    await logMonitoringEvent('integration_disconnected', undefined, {
      platform,
      clientId,
    });

    return NextResponse.json({
      success: true,
      message: 'Integration disconnected successfully',
    });
  } catch (error: any) {
    await logMonitoringEvent('integration_api_error', undefined, {
      endpoint: 'DELETE',
      error: error.message,
    });

    return NextResponse.json(
      { error: 'Failed to disconnect integration', details: error.message },
      { status: 500 }
    );
  }
}

// Helper function to create integration service instances
function createIntegrationService(integration: Integration) {
  switch (integration.platform) {
    case 'slack':
      return new SlackIntegration(integration);
    case 'jira':
      return new JiraIntegration(integration);
    case 'gmail':
      return new GmailIntegration(integration);
    case 'salesforce':
      return new SalesforceIntegration(integration);
    default:
      // For other platforms, use a generic mock service
      return new SlackIntegration(integration); // Fallback
  }
}
