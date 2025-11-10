/**
 * Wells Onyx AI Ops - Client Tech Stack Integration Layer
 * Main Integration Service
 */

import { cache } from '@/lib/cache';
import { logMonitoringEvent } from '@/lib/monitoring';

export type IntegrationPlatform =
  | 'slack'
  | 'teams'
  | 'jira'
  | 'linear'
  | 'asana'
  | 'gmail'
  | 'outlook'
  | 'salesforce'
  | 'hubspot'
  | 'github'
  | 'gitlab'
  | 'notion'
  | 'google-calendar'
  | 'zoom'
  | 'quickbooks';

export type IntegrationStatus = 'connected' | 'disconnected' | 'error' | 'configuring';

export interface Integration {
  id: string;
  platform: IntegrationPlatform;
  clientId: string;
  status: IntegrationStatus;
  credentials: Record<string, any>;
  lastSync: string;
  connectedAt: string;
  config: IntegrationConfig;
  metadata: IntegrationMetadata;
}

export interface IntegrationConfig {
  webhookUrl?: string;
  apiKey?: string;
  oauthToken?: string;
  refreshToken?: string;
  scopes?: string[];
  autoSync?: boolean;
  syncInterval?: number; // minutes
  retryAttempts?: number;
  timeout?: number; // milliseconds
  customSettings?: Record<string, any>;
}

export interface IntegrationMetadata {
  name: string;
  description: string;
  category: 'communication' | 'project-management' | 'email' | 'crm' | 'code' | 'docs' | 'calendar' | 'meetings' | 'accounting';
  logoUrl: string;
  color: string;
  features: string[];
  actionsCount: number;
  lastAction?: string;
  health: 'healthy' | 'degraded' | 'down';
}

export interface IntegrationAction {
  id: string;
  integrationId: string;
  platform: IntegrationPlatform;
  clientId: string;
  action: string;
  data: any;
  result: 'success' | 'failure';
  error?: string;
  timestamp: string;
  duration: number; // milliseconds
}

export interface WebhookEvent {
  id: string;
  integrationId: string;
  platform: IntegrationPlatform;
  event: string;
  payload: any;
  receivedAt: string;
  processed: boolean;
  retryCount: number;
}

export interface IntegrationTemplate {
  id: string;
  name: string;
  description: string;
  platforms: IntegrationPlatform[];
  trigger: string;
  actions: string[];
  config: Record<string, any>;
}

// Abstract base class for all integrations
export abstract class IntegrationService {
  protected integration: Integration;

  constructor(integration: Integration) {
    this.integration = integration;
  }

  // Core methods all integrations must implement
  abstract connect(clientId: string, credentials: any): Promise<void>;
  abstract disconnect(clientId: string): Promise<void>;
  abstract testConnection(): Promise<boolean>;
  abstract syncData(): Promise<any>;
  abstract sendAction(action: string, data: any): Promise<any>;

  // OAuth flow
  async getOAuthUrl(clientId: string, redirectUri: string): Promise<string> {
    throw new Error('OAuth not implemented for this integration');
  }

  async handleOAuthCallback(code: string, state: string): Promise<void> {
    throw new Error('OAuth not implemented for this integration');
  }

  // Token management
  async refreshAccessToken(): Promise<void> {
    if (!this.integration.config.refreshToken) {
      throw new Error('No refresh token available');
    }

    await logMonitoringEvent('integration_token_refresh', undefined, {
      platform: this.integration.platform,
      clientId: this.integration.clientId,
    });

    // Implementation specific to each platform
  }

  // Health check
  async checkHealth(): Promise<'healthy' | 'degraded' | 'down'> {
    try {
      const connected = await this.testConnection();
      return connected ? 'healthy' : 'down';
    } catch (error) {
      return 'down';
    }
  }

  // Rate limiting
  async checkRateLimit(): Promise<{ remaining: number; resetAt: string }> {
    const key = `rate_limit:${this.integration.platform}:${this.integration.clientId}`;
    const data = await cache.get<string>(key);

    if (!data) {
      return { remaining: 1000, resetAt: new Date(Date.now() + 3600000).toISOString() };
    }

    return JSON.parse(data);
  }

  // Logging
  protected async logAction(action: string, data: any, result: 'success' | 'failure', error?: string): Promise<void> {
    const actionLog: IntegrationAction = {
      id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      integrationId: this.integration.id,
      platform: this.integration.platform,
      clientId: this.integration.clientId,
      action,
      data,
      result,
      error,
      timestamp: new Date().toISOString(),
      duration: Math.floor(Math.random() * 500) + 100,
    };

    const key = `integration_actions:${this.integration.clientId}`;
    const existing = await cache.get<string>(key);
    const actions = existing ? JSON.parse(existing) : [];
    actions.unshift(actionLog);

    // Keep last 100 actions
    if (actions.length > 100) {
      actions.length = 100;
    }

    await cache.set(key, JSON.stringify(actions), { ttl: 86400 }); // 24 hours

    await logMonitoringEvent('integration_action', undefined, {
      platform: this.integration.platform,
      action,
      result,
    });
  }
}

// Integration Manager - orchestrates all integrations
export class IntegrationManager {
  private static instance: IntegrationManager;
  private integrations: Map<string, Integration> = new Map();

  private constructor() {
    this.loadIntegrations();
  }

  static getInstance(): IntegrationManager {
    if (!IntegrationManager.instance) {
      IntegrationManager.instance = new IntegrationManager();
    }
    return IntegrationManager.instance;
  }

  private async loadIntegrations(): Promise<void> {
    // Load from cache or database
    const key = 'integrations:all';
    const cached = await cache.get<string>(key);

    if (cached) {
      const data = JSON.parse(cached);
      data.forEach((integration: Integration) => {
        this.integrations.set(integration.id, integration);
      });
    }
  }

  async getIntegration(id: string): Promise<Integration | undefined> {
    return this.integrations.get(id);
  }

  async getClientIntegrations(clientId: string): Promise<Integration[]> {
    return Array.from(this.integrations.values()).filter(
      (integration) => integration.clientId === clientId
    );
  }

  async getIntegrationByPlatform(clientId: string, platform: IntegrationPlatform): Promise<Integration | undefined> {
    return Array.from(this.integrations.values()).find(
      (integration) => integration.clientId === clientId && integration.platform === platform
    );
  }

  async createIntegration(integration: Omit<Integration, 'id' | 'connectedAt'>): Promise<Integration> {
    const newIntegration: Integration = {
      ...integration,
      id: `int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      connectedAt: new Date().toISOString(),
    };

    this.integrations.set(newIntegration.id, newIntegration);
    await this.saveIntegrations();

    await logMonitoringEvent('integration_created', undefined, {
      platform: newIntegration.platform,
      clientId: newIntegration.clientId,
    });

    return newIntegration;
  }

  async updateIntegration(id: string, updates: Partial<Integration>): Promise<Integration> {
    const integration = this.integrations.get(id);
    if (!integration) {
      throw new Error('Integration not found');
    }

    const updated = { ...integration, ...updates };
    this.integrations.set(id, updated);
    await this.saveIntegrations();

    return updated;
  }

  async deleteIntegration(id: string): Promise<void> {
    const integration = this.integrations.get(id);
    if (!integration) {
      throw new Error('Integration not found');
    }

    this.integrations.delete(id);
    await this.saveIntegrations();

    await logMonitoringEvent('integration_deleted', undefined, {
      platform: integration.platform,
      clientId: integration.clientId,
    });
  }

  private async saveIntegrations(): Promise<void> {
    const key = 'integrations:all';
    const data = Array.from(this.integrations.values());
    await cache.set(key, JSON.stringify(data), { ttl: 86400 });
  }

  async getActions(clientId: string, limit: number = 100): Promise<IntegrationAction[]> {
    const key = `integration_actions:${clientId}`;
    const cached = await cache.get<string>(key);

    if (!cached) {
      return [];
    }

    const actions = JSON.parse(cached);
    return actions.slice(0, limit);
  }

  async getWebhooks(integrationId: string): Promise<WebhookEvent[]> {
    const key = `webhooks:${integrationId}`;
    const cached = await cache.get<string>(key);

    if (!cached) {
      return [];
    }

    return JSON.parse(cached);
  }

  async processWebhook(event: Omit<WebhookEvent, 'id' | 'receivedAt'>): Promise<void> {
    const webhookEvent: WebhookEvent = {
      ...event,
      id: `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      receivedAt: new Date().toISOString(),
    };

    const key = `webhooks:${event.integrationId}`;
    const existing = await cache.get<string>(key);
    const webhooks = existing ? JSON.parse(existing) : [];
    webhooks.unshift(webhookEvent);

    // Keep last 50 webhooks
    if (webhooks.length > 50) {
      webhooks.length = 50;
    }

    await cache.set(key, JSON.stringify(webhooks), { ttl: 86400 });

    await logMonitoringEvent('webhook_received', undefined, {
      platform: event.platform,
      event: event.event,
    });
  }
}

// Integration Templates
export const INTEGRATION_TEMPLATES: IntegrationTemplate[] = [
  {
    id: 'template_1',
    name: 'New Lead Notification',
    description: 'Send Slack notification when new lead is created in Salesforce',
    platforms: ['salesforce', 'slack'],
    trigger: 'salesforce.lead.created',
    actions: ['slack.message.send'],
    config: {
      channel: '#sales',
      messageTemplate: 'New lead: {{lead.name}} from {{lead.company}}',
    },
  },
  {
    id: 'template_2',
    name: 'Daily Standup Report',
    description: 'Send daily summary of Jira tickets to Slack',
    platforms: ['jira', 'slack'],
    trigger: 'schedule.daily.9am',
    actions: ['jira.issues.search', 'slack.message.send'],
    config: {
      jql: 'assignee = currentUser() AND status != Done',
      channel: '#standup',
    },
  },
  {
    id: 'template_3',
    name: 'Invoice Approval Workflow',
    description: 'Email notification and QuickBooks entry when invoice is approved',
    platforms: ['gmail', 'quickbooks'],
    trigger: 'invoice.approved',
    actions: ['gmail.email.send', 'quickbooks.invoice.create'],
    config: {
      emailTemplate: 'invoice_approved',
      autoSend: true,
    },
  },
  {
    id: 'template_4',
    name: 'Contract Signed Workflow',
    description: 'Update Salesforce opportunity and create Notion page when contract signed',
    platforms: ['salesforce', 'notion'],
    trigger: 'contract.signed',
    actions: ['salesforce.opportunity.update', 'notion.page.create'],
    config: {
      stage: 'Closed Won',
      notionDatabase: 'Active Customers',
    },
  },
  {
    id: 'template_5',
    name: 'Code Review Request',
    description: 'Send Slack message when GitHub PR is ready for review',
    platforms: ['github', 'slack'],
    trigger: 'github.pull_request.opened',
    actions: ['slack.message.send'],
    config: {
      channel: '#code-reviews',
      mentions: ['@team-leads'],
    },
  },
];

// Available integrations catalog
export const AVAILABLE_INTEGRATIONS: IntegrationMetadata[] = [
  {
    name: 'Slack',
    description: 'Team communication and collaboration',
    category: 'communication',
    logoUrl: '/integrations/slack.svg',
    color: '#4A154B',
    features: ['Send messages', 'Create channels', 'File sharing', 'Reactions'],
    actionsCount: 0,
    health: 'healthy',
  },
  {
    name: 'Microsoft Teams',
    description: 'Enterprise team collaboration',
    category: 'communication',
    logoUrl: '/integrations/teams.svg',
    color: '#6264A7',
    features: ['Send messages', 'Create teams', 'Video calls', 'File sharing'],
    actionsCount: 0,
    health: 'healthy',
  },
  {
    name: 'Jira',
    description: 'Project and issue tracking',
    category: 'project-management',
    logoUrl: '/integrations/jira.svg',
    color: '#0052CC',
    features: ['Create issues', 'Update status', 'Search tickets', 'Comments'],
    actionsCount: 0,
    health: 'healthy',
  },
  {
    name: 'Linear',
    description: 'Modern issue tracking for software teams',
    category: 'project-management',
    logoUrl: '/integrations/linear.svg',
    color: '#5E6AD2',
    features: ['Create issues', 'Update workflow', 'Assign tasks', 'Labels'],
    actionsCount: 0,
    health: 'healthy',
  },
  {
    name: 'Asana',
    description: 'Work management and collaboration',
    category: 'project-management',
    logoUrl: '/integrations/asana.svg',
    color: '#F06A6A',
    features: ['Create tasks', 'Update projects', 'Assign work', 'Timelines'],
    actionsCount: 0,
    health: 'healthy',
  },
  {
    name: 'Gmail',
    description: 'Email communication',
    category: 'email',
    logoUrl: '/integrations/gmail.svg',
    color: '#EA4335',
    features: ['Send email', 'Read inbox', 'Search', 'Labels'],
    actionsCount: 0,
    health: 'healthy',
  },
  {
    name: 'Outlook',
    description: 'Microsoft email and calendar',
    category: 'email',
    logoUrl: '/integrations/outlook.svg',
    color: '#0078D4',
    features: ['Send email', 'Calendar events', 'Contacts', 'Tasks'],
    actionsCount: 0,
    health: 'healthy',
  },
  {
    name: 'Salesforce',
    description: 'Customer relationship management',
    category: 'crm',
    logoUrl: '/integrations/salesforce.svg',
    color: '#00A1E0',
    features: ['Manage leads', 'Track opportunities', 'Custom objects', 'Reports'],
    actionsCount: 0,
    health: 'healthy',
  },
  {
    name: 'HubSpot',
    description: 'CRM and marketing automation',
    category: 'crm',
    logoUrl: '/integrations/hubspot.svg',
    color: '#FF7A59',
    features: ['Manage contacts', 'Track deals', 'Email campaigns', 'Analytics'],
    actionsCount: 0,
    health: 'healthy',
  },
  {
    name: 'GitHub',
    description: 'Code hosting and version control',
    category: 'code',
    logoUrl: '/integrations/github.svg',
    color: '#181717',
    features: ['Create repos', 'Pull requests', 'Issues', 'Actions'],
    actionsCount: 0,
    health: 'healthy',
  },
  {
    name: 'GitLab',
    description: 'DevOps platform for Git',
    category: 'code',
    logoUrl: '/integrations/gitlab.svg',
    color: '#FC6D26',
    features: ['Repositories', 'CI/CD', 'Issues', 'Merge requests'],
    actionsCount: 0,
    health: 'healthy',
  },
  {
    name: 'Notion',
    description: 'All-in-one workspace',
    category: 'docs',
    logoUrl: '/integrations/notion.svg',
    color: '#000000',
    features: ['Create pages', 'Update databases', 'Sync content', 'Search'],
    actionsCount: 0,
    health: 'healthy',
  },
  {
    name: 'Google Calendar',
    description: 'Calendar and scheduling',
    category: 'calendar',
    logoUrl: '/integrations/google-calendar.svg',
    color: '#4285F4',
    features: ['Create events', 'Update schedule', 'Invitations', 'Reminders'],
    actionsCount: 0,
    health: 'healthy',
  },
  {
    name: 'Zoom',
    description: 'Video conferencing and meetings',
    category: 'meetings',
    logoUrl: '/integrations/zoom.svg',
    color: '#2D8CFF',
    features: ['Schedule meetings', 'Start calls', 'Recordings', 'Webinars'],
    actionsCount: 0,
    health: 'healthy',
  },
  {
    name: 'QuickBooks',
    description: 'Accounting and bookkeeping',
    category: 'accounting',
    logoUrl: '/integrations/quickbooks.svg',
    color: '#2CA01C',
    features: ['Invoices', 'Expenses', 'Reports', 'Payments'],
    actionsCount: 0,
    health: 'healthy',
  },
];

export default IntegrationManager;
