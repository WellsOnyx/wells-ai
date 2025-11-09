/**
 * Wells Onyx AI Ops - Integration List API
 */

import { NextRequest, NextResponse } from 'next/server';
import IntegrationManager, { AVAILABLE_INTEGRATIONS } from '@/lib/integrations';

export async function GET(request: NextRequest) {
  try {
    const clientId = request.nextUrl.searchParams.get('clientId') || 'default_client';
    const manager = IntegrationManager.getInstance();

    const integrations = await manager.getClientIntegrations(clientId);

    // If no integrations, create some mock ones
    if (integrations.length === 0) {
      // Create 5 default connected integrations
      const defaultPlatforms = ['slack', 'jira', 'gmail', 'salesforce', 'github'];

      for (const platformName of defaultPlatforms) {
        const metadata = AVAILABLE_INTEGRATIONS.find(
          (i) => i.name.toLowerCase().replace(/\s+/g, '-') === platformName
        );

        if (metadata) {
          await manager.createIntegration({
            platform: platformName as any,
            clientId,
            status: 'connected',
            credentials: {
              accessToken: 'mock_token_' + platformName,
            },
            lastSync: new Date(Date.now() - Math.random() * 86400000).toISOString(),
            config: {
              autoSync: true,
              syncInterval: 60,
              retryAttempts: 3,
              timeout: 30000,
            },
            metadata: {
              ...metadata,
              actionsCount: Math.floor(Math.random() * 50),
              lastAction: new Date(Date.now() - Math.random() * 3600000).toISOString(),
              health: 'healthy',
            },
          });
        }
      }

      // Reload integrations
      const newIntegrations = await manager.getClientIntegrations(clientId);
      return NextResponse.json({
        integrations: newIntegrations,
        available: AVAILABLE_INTEGRATIONS,
      });
    }

    return NextResponse.json({
      integrations,
      available: AVAILABLE_INTEGRATIONS,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to list integrations', details: error.message },
      { status: 500 }
    );
  }
}
