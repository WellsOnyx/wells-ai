/**
 * Wells Onyx AI Ops - Integration Actions API
 */

import { NextRequest, NextResponse } from 'next/server';
import IntegrationManager, { IntegrationAction, IntegrationPlatform } from '@/lib/integrations';

export async function GET(request: NextRequest) {
  try {
    const clientId = request.nextUrl.searchParams.get('clientId') || 'default_client';
    const platform = request.nextUrl.searchParams.get('platform') as IntegrationPlatform | null;
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '100');

    const manager = IntegrationManager.getInstance();
    let actions = await manager.getActions(clientId, limit);

    // If no actions, create some mock ones
    if (actions.length === 0) {
      const integrations = await manager.getClientIntegrations(clientId);

      const mockActions: IntegrationAction[] = [
        // Slack actions
        {
          id: 'action_001',
          integrationId: integrations.find((i) => i.platform === 'slack')?.id || 'int_slack',
          platform: 'slack',
          clientId,
          action: 'send-message',
          data: { channel: '#general', text: 'New lead from website!' },
          result: 'success',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          duration: 234,
        },
        {
          id: 'action_002',
          integrationId: integrations.find((i) => i.platform === 'slack')?.id || 'int_slack',
          platform: 'slack',
          clientId,
          action: 'send-message',
          data: { channel: '#sales', text: 'Deal closed: $50,000' },
          result: 'success',
          timestamp: new Date(Date.now() - 7200000).toISOString(),
          duration: 189,
        },
        // Jira actions
        {
          id: 'action_003',
          integrationId: integrations.find((i) => i.platform === 'jira')?.id || 'int_jira',
          platform: 'jira',
          clientId,
          action: 'create-issue',
          data: { project: 'PROJ', summary: 'Fix login bug', issueType: 'Bug' },
          result: 'success',
          timestamp: new Date(Date.now() - 10800000).toISOString(),
          duration: 456,
        },
        {
          id: 'action_004',
          integrationId: integrations.find((i) => i.platform === 'jira')?.id || 'int_jira',
          platform: 'jira',
          clientId,
          action: 'update-status',
          data: { issueKey: 'PROJ-101', status: 'In Progress' },
          result: 'success',
          timestamp: new Date(Date.now() - 14400000).toISOString(),
          duration: 312,
        },
        // Gmail actions
        {
          id: 'action_005',
          integrationId: integrations.find((i) => i.platform === 'gmail')?.id || 'int_gmail',
          platform: 'gmail',
          clientId,
          action: 'send-email',
          data: { to: 'client@company.com', subject: 'Project Update' },
          result: 'success',
          timestamp: new Date(Date.now() - 18000000).toISOString(),
          duration: 567,
        },
        {
          id: 'action_006',
          integrationId: integrations.find((i) => i.platform === 'gmail')?.id || 'int_gmail',
          platform: 'gmail',
          clientId,
          action: 'send-email',
          data: { to: 'team@company.com', subject: 'Weekly Report' },
          result: 'success',
          timestamp: new Date(Date.now() - 21600000).toISOString(),
          duration: 423,
        },
        // Salesforce actions
        {
          id: 'action_007',
          integrationId: integrations.find((i) => i.platform === 'salesforce')?.id || 'int_sf',
          platform: 'salesforce',
          clientId,
          action: 'create-lead',
          data: { firstName: 'John', lastName: 'Doe', company: 'Acme Corp' },
          result: 'success',
          timestamp: new Date(Date.now() - 25200000).toISOString(),
          duration: 678,
        },
        {
          id: 'action_008',
          integrationId: integrations.find((i) => i.platform === 'salesforce')?.id || 'int_sf',
          platform: 'salesforce',
          clientId,
          action: 'update-opportunity',
          data: { id: 'opp001', stage: 'Closed Won' },
          result: 'success',
          timestamp: new Date(Date.now() - 28800000).toISOString(),
          duration: 534,
        },
        // GitHub actions
        {
          id: 'action_009',
          integrationId: integrations.find((i) => i.platform === 'github')?.id || 'int_github',
          platform: 'github',
          clientId,
          action: 'create-pr',
          data: { repo: 'wellsonyx/app', title: 'Add new feature' },
          result: 'success',
          timestamp: new Date(Date.now() - 32400000).toISOString(),
          duration: 789,
        },
        // Some failures
        {
          id: 'action_010',
          integrationId: integrations.find((i) => i.platform === 'slack')?.id || 'int_slack',
          platform: 'slack',
          clientId,
          action: 'send-message',
          data: { channel: '#invalid', text: 'Test message' },
          result: 'failure',
          error: 'Channel not found',
          timestamp: new Date(Date.now() - 36000000).toISOString(),
          duration: 156,
        },
        {
          id: 'action_011',
          integrationId: integrations.find((i) => i.platform === 'jira')?.id || 'int_jira',
          platform: 'jira',
          clientId,
          action: 'create-issue',
          data: { project: 'INVALID', summary: 'Test issue' },
          result: 'failure',
          error: 'Project not found',
          timestamp: new Date(Date.now() - 39600000).toISOString(),
          duration: 234,
        },
        // More recent actions
        {
          id: 'action_012',
          integrationId: integrations.find((i) => i.platform === 'slack')?.id || 'int_slack',
          platform: 'slack',
          clientId,
          action: 'create-channel',
          data: { name: 'project-alpha', isPrivate: false },
          result: 'success',
          timestamp: new Date(Date.now() - 1800000).toISOString(),
          duration: 345,
        },
        {
          id: 'action_013',
          integrationId: integrations.find((i) => i.platform === 'gmail')?.id || 'int_gmail',
          platform: 'gmail',
          clientId,
          action: 'read-inbox',
          data: { maxResults: 50 },
          result: 'success',
          timestamp: new Date(Date.now() - 900000).toISOString(),
          duration: 678,
        },
        {
          id: 'action_014',
          integrationId: integrations.find((i) => i.platform === 'salesforce')?.id || 'int_sf',
          platform: 'salesforce',
          clientId,
          action: 'create-task',
          data: { subject: 'Follow up with client', status: 'Not Started' },
          result: 'success',
          timestamp: new Date(Date.now() - 600000).toISOString(),
          duration: 445,
        },
        {
          id: 'action_015',
          integrationId: integrations.find((i) => i.platform === 'jira')?.id || 'int_jira',
          platform: 'jira',
          clientId,
          action: 'search-issues',
          data: { jql: 'assignee = currentUser() AND status = "In Progress"' },
          result: 'success',
          timestamp: new Date(Date.now() - 300000).toISOString(),
          duration: 567,
        },
      ];

      // Store mock actions
      const key = `integration_actions:${clientId}`;
      const { cache } = await import('@/lib/cache');
      await cache.set(key, JSON.stringify(mockActions), 86400);

      actions = mockActions;
    }

    // Filter by platform if specified
    if (platform) {
      actions = actions.filter((a) => a.platform === platform);
    }

    return NextResponse.json({
      actions,
      total: actions.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to get actions', details: error.message },
      { status: 500 }
    );
  }
}
