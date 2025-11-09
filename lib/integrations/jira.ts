/**
 * Wells Onyx AI Ops - Jira Integration
 */

import { IntegrationService, Integration } from './index';
import { cache } from '@/lib/cache';

export interface JiraIssue {
  id: string;
  key: string;
  summary: string;
  description: string;
  status: string;
  priority: string;
  assignee?: JiraUser;
  reporter: JiraUser;
  created: string;
  updated: string;
  project: JiraProject;
  issueType: string;
  labels: string[];
  attachments: JiraAttachment[];
  comments: JiraComment[];
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
  description: string;
  lead: JiraUser;
  issueTypes: string[];
}

export interface JiraUser {
  accountId: string;
  displayName: string;
  email: string;
  avatarUrl: string;
  active: boolean;
}

export interface JiraComment {
  id: string;
  author: JiraUser;
  body: string;
  created: string;
  updated: string;
}

export interface JiraAttachment {
  id: string;
  filename: string;
  size: number;
  mimeType: string;
  created: string;
  author: JiraUser;
}

export interface JiraBoard {
  id: string;
  name: string;
  type: 'scrum' | 'kanban';
  projectId: string;
}

export interface JiraSprint {
  id: string;
  name: string;
  state: 'future' | 'active' | 'closed';
  startDate: string;
  endDate: string;
  goal: string;
}

export class JiraIntegration extends IntegrationService {
  private baseUrl = 'https://api.atlassian.com';

  constructor(integration: Integration) {
    super(integration);
  }

  async connect(clientId: string, credentials: any): Promise<void> {
    const { apiToken, email, cloudId, siteName } = credentials;

    this.integration.credentials = {
      apiToken,
      email,
      cloudId,
      siteName,
    };

    this.integration.status = 'connected';
    this.integration.lastSync = new Date().toISOString();

    await this.logAction('connect', { siteName, cloudId }, 'success');
  }

  async disconnect(clientId: string): Promise<void> {
    this.integration.status = 'disconnected';
    this.integration.credentials = {};

    await this.logAction('disconnect', {}, 'success');
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.apiCall('GET', '/rest/api/3/myself', {});
      return !!response.accountId;
    } catch (error) {
      return false;
    }
  }

  async syncData(): Promise<any> {
    const [projects, boards] = await Promise.all([
      this.getProjectList(),
      this.getBoardList(),
    ]);

    const syncData = {
      projects,
      boards,
      syncedAt: new Date().toISOString(),
    };

    const key = `jira_sync:${this.integration.clientId}`;
    await cache.set(key, JSON.stringify(syncData), 3600);

    this.integration.lastSync = new Date().toISOString();

    await this.logAction('sync', { projectCount: projects.length, boardCount: boards.length }, 'success');

    return syncData;
  }

  async sendAction(action: string, data: any): Promise<any> {
    const actionMap: Record<string, () => Promise<any>> = {
      'create-issue': () => this.createIssue(data.project, data.summary, data.description, data.issueType),
      'update-status': () => this.updateIssueStatus(data.issueKey, data.status),
      'add-comment': () => this.addComment(data.issueKey, data.comment),
      'assign-user': () => this.assignIssue(data.issueKey, data.accountId),
      'get-issue': () => this.getIssue(data.issueKey),
      'search-issues': () => this.searchIssues(data.jql, data.maxResults),
      'upload-attachment': () => this.uploadAttachment(data.issueKey, data.file),
      'transition-issue': () => this.transitionIssue(data.issueKey, data.transitionId),
    };

    const handler = actionMap[action];
    if (!handler) {
      throw new Error(`Unknown action: ${action}`);
    }

    try {
      const result = await handler();
      await this.logAction(action, data, 'success');
      return result;
    } catch (error: any) {
      await this.logAction(action, data, 'failure', error.message);
      throw error;
    }
  }

  async getOAuthUrl(clientId: string, redirectUri: string): Promise<string> {
    const scopes = [
      'read:jira-work',
      'write:jira-work',
      'read:jira-user',
      'offline_access',
    ];

    const state = Buffer.from(JSON.stringify({ clientId, timestamp: Date.now() })).toString('base64');

    const params = new URLSearchParams({
      audience: 'api.atlassian.com',
      client_id: process.env.JIRA_CLIENT_ID || 'mock_client_id',
      scope: scopes.join(' '),
      redirect_uri: redirectUri,
      state,
      response_type: 'code',
      prompt: 'consent',
    });

    return `https://auth.atlassian.com/authorize?${params.toString()}`;
  }

  // Jira-specific methods

  async createIssue(
    projectKey: string,
    summary: string,
    description: string,
    issueType: string = 'Task'
  ): Promise<JiraIssue> {
    const response = await this.apiCall('POST', '/rest/api/3/issue', {
      fields: {
        project: { key: projectKey },
        summary,
        description: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: description }],
            },
          ],
        },
        issuetype: { name: issueType },
      },
    });

    return {
      id: response.id,
      key: response.key,
      summary,
      description,
      status: 'To Do',
      priority: 'Medium',
      reporter: this.getMockUser(),
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      project: {
        id: 'proj001',
        key: projectKey,
        name: 'Mock Project',
        description: 'A mock project',
        lead: this.getMockUser(),
        issueTypes: ['Task', 'Bug', 'Story'],
      },
      issueType,
      labels: [],
      attachments: [],
      comments: [],
    };
  }

  async updateIssueStatus(issueKey: string, status: string): Promise<void> {
    const transitions = await this.getTransitions(issueKey);
    const transition = transitions.find((t) => t.name === status);

    if (!transition) {
      throw new Error(`Transition to ${status} not found`);
    }

    await this.transitionIssue(issueKey, transition.id);
  }

  async addComment(issueKey: string, comment: string): Promise<JiraComment> {
    const response = await this.apiCall('POST', `/rest/api/3/issue/${issueKey}/comment`, {
      body: {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: comment }],
          },
        ],
      },
    });

    return {
      id: response.id,
      author: this.getMockUser(),
      body: comment,
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
    };
  }

  async assignIssue(issueKey: string, accountId: string): Promise<void> {
    await this.apiCall('PUT', `/rest/api/3/issue/${issueKey}/assignee`, {
      accountId,
    });
  }

  async getIssue(issueKey: string): Promise<JiraIssue> {
    const response = await this.apiCall('GET', `/rest/api/3/issue/${issueKey}`, {});

    // Mock issue
    return {
      id: 'issue001',
      key: issueKey,
      summary: 'Mock Issue',
      description: 'This is a mock issue for testing',
      status: 'In Progress',
      priority: 'High',
      assignee: this.getMockUser(),
      reporter: this.getMockUser(),
      created: new Date(Date.now() - 86400000 * 7).toISOString(),
      updated: new Date(Date.now() - 3600000).toISOString(),
      project: {
        id: 'proj001',
        key: 'MOCK',
        name: 'Mock Project',
        description: 'A mock project',
        lead: this.getMockUser(),
        issueTypes: ['Task', 'Bug', 'Story', 'Epic'],
      },
      issueType: 'Task',
      labels: ['backend', 'api'],
      attachments: [],
      comments: [
        {
          id: 'comment001',
          author: this.getMockUser(),
          body: 'Started working on this',
          created: new Date(Date.now() - 7200000).toISOString(),
          updated: new Date(Date.now() - 7200000).toISOString(),
        },
      ],
    };
  }

  async searchIssues(jql: string, maxResults: number = 50): Promise<JiraIssue[]> {
    const response = await this.apiCall('POST', '/rest/api/3/search', {
      jql,
      maxResults,
    });

    // Mock search results
    return [
      {
        id: 'issue001',
        key: 'PROJ-101',
        summary: 'Implement user authentication',
        description: 'Add OAuth2 authentication flow',
        status: 'In Progress',
        priority: 'High',
        assignee: this.getMockUser(),
        reporter: this.getMockUser(),
        created: new Date(Date.now() - 86400000 * 5).toISOString(),
        updated: new Date(Date.now() - 3600000 * 2).toISOString(),
        project: this.getMockProject(),
        issueType: 'Story',
        labels: ['backend', 'security'],
        attachments: [],
        comments: [],
      },
      {
        id: 'issue002',
        key: 'PROJ-102',
        summary: 'Fix login bug',
        description: 'Users cannot log in with email',
        status: 'To Do',
        priority: 'Critical',
        reporter: this.getMockUser(),
        created: new Date(Date.now() - 86400000 * 2).toISOString(),
        updated: new Date(Date.now() - 86400000 * 2).toISOString(),
        project: this.getMockProject(),
        issueType: 'Bug',
        labels: ['frontend', 'urgent'],
        attachments: [],
        comments: [],
      },
    ];
  }

  async uploadAttachment(issueKey: string, file: any): Promise<JiraAttachment> {
    const response = await this.apiCall('POST', `/rest/api/3/issue/${issueKey}/attachments`, file);

    return {
      id: `attach${Date.now()}`,
      filename: file.name || 'file.txt',
      size: file.size || 1024,
      mimeType: file.type || 'text/plain',
      created: new Date().toISOString(),
      author: this.getMockUser(),
    };
  }

  async getProjectList(): Promise<JiraProject[]> {
    const response = await this.apiCall('GET', '/rest/api/3/project', {});

    // Mock projects
    return [
      {
        id: 'proj001',
        key: 'PROJ',
        name: 'Main Project',
        description: 'Primary project for development',
        lead: this.getMockUser(),
        issueTypes: ['Task', 'Bug', 'Story', 'Epic'],
      },
      {
        id: 'proj002',
        key: 'OPS',
        name: 'Operations',
        description: 'Operational tasks and incidents',
        lead: this.getMockUser(),
        issueTypes: ['Task', 'Incident', 'Change Request'],
      },
      {
        id: 'proj003',
        key: 'DESIGN',
        name: 'Design System',
        description: 'Design and UX work',
        lead: this.getMockUser(),
        issueTypes: ['Task', 'Story'],
      },
    ];
  }

  async getBoardList(): Promise<JiraBoard[]> {
    const response = await this.apiCall('GET', '/rest/agile/1.0/board', {});

    // Mock boards
    return [
      {
        id: 'board001',
        name: 'Engineering Board',
        type: 'scrum',
        projectId: 'proj001',
      },
      {
        id: 'board002',
        name: 'Operations Kanban',
        type: 'kanban',
        projectId: 'proj002',
      },
    ];
  }

  async getBoard(boardId: string): Promise<JiraBoard> {
    const response = await this.apiCall('GET', `/rest/agile/1.0/board/${boardId}`, {});

    return {
      id: boardId,
      name: 'Mock Board',
      type: 'scrum',
      projectId: 'proj001',
    };
  }

  async getSprints(boardId: string): Promise<JiraSprint[]> {
    const response = await this.apiCall('GET', `/rest/agile/1.0/board/${boardId}/sprint`, {});

    // Mock sprints
    return [
      {
        id: 'sprint001',
        name: 'Sprint 23',
        state: 'active',
        startDate: new Date(Date.now() - 86400000 * 7).toISOString(),
        endDate: new Date(Date.now() + 86400000 * 7).toISOString(),
        goal: 'Complete authentication and user management',
      },
      {
        id: 'sprint002',
        name: 'Sprint 24',
        state: 'future',
        startDate: new Date(Date.now() + 86400000 * 8).toISOString(),
        endDate: new Date(Date.now() + 86400000 * 21).toISOString(),
        goal: 'Payment integration',
      },
    ];
  }

  async getTransitions(issueKey: string): Promise<Array<{ id: string; name: string }>> {
    const response = await this.apiCall('GET', `/rest/api/3/issue/${issueKey}/transitions`, {});

    // Mock transitions
    return [
      { id: 'trans001', name: 'To Do' },
      { id: 'trans002', name: 'In Progress' },
      { id: 'trans003', name: 'In Review' },
      { id: 'trans004', name: 'Done' },
    ];
  }

  async transitionIssue(issueKey: string, transitionId: string): Promise<void> {
    await this.apiCall('POST', `/rest/api/3/issue/${issueKey}/transitions`, {
      transition: { id: transitionId },
    });
  }

  async updateIssue(issueKey: string, fields: any): Promise<void> {
    await this.apiCall('PUT', `/rest/api/3/issue/${issueKey}`, {
      fields,
    });
  }

  async deleteIssue(issueKey: string): Promise<void> {
    await this.apiCall('DELETE', `/rest/api/3/issue/${issueKey}`, {});
  }

  async linkIssues(inwardIssue: string, outwardIssue: string, linkType: string): Promise<void> {
    await this.apiCall('POST', '/rest/api/3/issueLink', {
      type: { name: linkType },
      inwardIssue: { key: inwardIssue },
      outwardIssue: { key: outwardIssue },
    });
  }

  // Private helper methods
  private async apiCall(method: string, endpoint: string, data: any): Promise<any> {
    // Mock API call
    return {
      id: `jira${Date.now()}`,
      key: `PROJ-${Math.floor(Math.random() * 1000)}`,
      accountId: 'acc123',
    };
  }

  private getMockUser(): JiraUser {
    return {
      accountId: 'acc001',
      displayName: 'John Developer',
      email: 'john@company.com',
      avatarUrl: 'https://ui-avatars.com/api/?name=John+Developer',
      active: true,
    };
  }

  private getMockProject(): JiraProject {
    return {
      id: 'proj001',
      key: 'PROJ',
      name: 'Mock Project',
      description: 'A mock project',
      lead: this.getMockUser(),
      issueTypes: ['Task', 'Bug', 'Story', 'Epic'],
    };
  }
}

export default JiraIntegration;
