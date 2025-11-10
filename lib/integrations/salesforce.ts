/**
 * Wells Onyx AI Ops - Salesforce Integration
 */

import { IntegrationService, Integration } from './index';
import { cache } from '@/lib/cache';

export interface SalesforceAccount {
  Id: string;
  Name: string;
  Industry?: string;
  Phone?: string;
  Website?: string;
  BillingAddress?: SalesforceAddress;
  AnnualRevenue?: number;
  NumberOfEmployees?: number;
  Type?: string;
  OwnerId: string;
  CreatedDate: string;
  LastModifiedDate: string;
}

export interface SalesforceContact {
  Id: string;
  FirstName: string;
  LastName: string;
  Email: string;
  Phone?: string;
  Title?: string;
  AccountId?: string;
  MailingAddress?: SalesforceAddress;
  Department?: string;
  LeadSource?: string;
  OwnerId: string;
  CreatedDate: string;
}

export interface SalesforceLead {
  Id: string;
  FirstName: string;
  LastName: string;
  Company: string;
  Email: string;
  Phone?: string;
  Title?: string;
  Status: string;
  LeadSource?: string;
  Industry?: string;
  Rating?: string;
  OwnerId: string;
  CreatedDate: string;
  ConvertedAccountId?: string;
  ConvertedContactId?: string;
  ConvertedOpportunityId?: string;
}

export interface SalesforceOpportunity {
  Id: string;
  Name: string;
  AccountId: string;
  Amount: number;
  StageName: string;
  Probability: number;
  CloseDate: string;
  Type?: string;
  LeadSource?: string;
  NextStep?: string;
  Description?: string;
  OwnerId: string;
  CreatedDate: string;
  LastModifiedDate: string;
}

export interface SalesforceTask {
  Id: string;
  Subject: string;
  Description?: string;
  Status: string;
  Priority: string;
  ActivityDate: string;
  WhoId?: string; // Contact/Lead
  WhatId?: string; // Account/Opportunity
  OwnerId: string;
  CreatedDate: string;
}

export interface SalesforceCase {
  Id: string;
  CaseNumber: string;
  Subject: string;
  Description: string;
  Status: string;
  Priority: string;
  Origin: string;
  Type?: string;
  AccountId?: string;
  ContactId?: string;
  OwnerId: string;
  CreatedDate: string;
}

export interface SalesforceAddress {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface SalesforceQueryResult<T> {
  totalSize: number;
  done: boolean;
  records: T[];
}

export class SalesforceIntegration extends IntegrationService {
  private baseUrl = 'https://login.salesforce.com';
  private apiVersion = 'v58.0';

  constructor(integration: Integration) {
    super(integration);
  }

  async connect(clientId: string, credentials: any): Promise<void> {
    const { accessToken, instanceUrl, refreshToken, orgId } = credentials;

    this.integration.credentials = {
      accessToken,
      instanceUrl,
      refreshToken,
      orgId,
    };

    this.integration.status = 'connected';
    this.integration.lastSync = new Date().toISOString();

    await this.logAction('connect', { instanceUrl, orgId }, 'success');
  }

  async disconnect(clientId: string): Promise<void> {
    this.integration.status = 'disconnected';
    this.integration.credentials = {};

    await this.logAction('disconnect', {}, 'success');
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.apiCall('GET', '/services/data', {});
      return Array.isArray(response);
    } catch (error) {
      return false;
    }
  }

  async syncData(): Promise<any> {
    const [accounts, leads, opportunities] = await Promise.all([
      this.query<SalesforceAccount>('SELECT Id, Name FROM Account LIMIT 10'),
      this.query<SalesforceLead>('SELECT Id, FirstName, LastName, Company FROM Lead LIMIT 10'),
      this.query<SalesforceOpportunity>('SELECT Id, Name, Amount, StageName FROM Opportunity LIMIT 10'),
    ]);

    const syncData = {
      accounts: accounts.records,
      leads: leads.records,
      opportunities: opportunities.records,
      syncedAt: new Date().toISOString(),
    };

    const key = `salesforce_sync:${this.integration.clientId}`;
    await cache.set(key, JSON.stringify(syncData), { ttl: 3600 });

    this.integration.lastSync = new Date().toISOString();

    await this.logAction('sync', {
      accountCount: accounts.records.length,
      leadCount: leads.records.length,
      opportunityCount: opportunities.records.length,
    }, 'success');

    return syncData;
  }

  async sendAction(action: string, data: any): Promise<any> {
    const actionMap: Record<string, () => Promise<any>> = {
      'create-lead': () => this.createLead(data),
      'create-contact': () => this.createContact(data),
      'create-account': () => this.createAccount(data),
      'update-opportunity': () => this.updateOpportunity(data.id, data.updates),
      'query-records': () => this.query(data.soql),
      'create-task': () => this.createTask(data),
      'log-activity': () => this.logActivity(data),
      'get-account': () => this.getAccount(data.id),
      'update-custom-fields': () => this.updateRecord(data.object, data.id, data.fields),
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
    const state = Buffer.from(JSON.stringify({ clientId, timestamp: Date.now() })).toString('base64');

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: process.env.SALESFORCE_CLIENT_ID || 'mock_client_id',
      redirect_uri: redirectUri,
      state,
      scope: 'api refresh_token',
    });

    return `${this.baseUrl}/services/oauth2/authorize?${params.toString()}`;
  }

  // Salesforce-specific methods

  async query<T>(soql: string): Promise<SalesforceQueryResult<T>> {
    const response = await this.apiCall('GET', `/services/data/${this.apiVersion}/query`, {
      q: soql,
    });

    // Mock query results
    return {
      totalSize: 2,
      done: true,
      records: [] as T[], // Would be populated with real data
    };
  }

  async createLead(data: Partial<SalesforceLead>): Promise<SalesforceLead> {
    const response = await this.apiCall('POST', `/services/data/${this.apiVersion}/sobjects/Lead`, data);

    return {
      Id: response.id,
      FirstName: data.FirstName || '',
      LastName: data.LastName || '',
      Company: data.Company || '',
      Email: data.Email || '',
      Phone: data.Phone,
      Title: data.Title,
      Status: data.Status || 'Open - Not Contacted',
      LeadSource: data.LeadSource,
      Industry: data.Industry,
      Rating: data.Rating,
      OwnerId: 'mock_owner_id',
      CreatedDate: new Date().toISOString(),
    };
  }

  async createContact(data: Partial<SalesforceContact>): Promise<SalesforceContact> {
    const response = await this.apiCall('POST', `/services/data/${this.apiVersion}/sobjects/Contact`, data);

    return {
      Id: response.id,
      FirstName: data.FirstName || '',
      LastName: data.LastName || '',
      Email: data.Email || '',
      Phone: data.Phone,
      Title: data.Title,
      AccountId: data.AccountId,
      MailingAddress: data.MailingAddress,
      Department: data.Department,
      LeadSource: data.LeadSource,
      OwnerId: 'mock_owner_id',
      CreatedDate: new Date().toISOString(),
    };
  }

  async createAccount(data: Partial<SalesforceAccount>): Promise<SalesforceAccount> {
    const response = await this.apiCall('POST', `/services/data/${this.apiVersion}/sobjects/Account`, data);

    return {
      Id: response.id,
      Name: data.Name || '',
      Industry: data.Industry,
      Phone: data.Phone,
      Website: data.Website,
      BillingAddress: data.BillingAddress,
      AnnualRevenue: data.AnnualRevenue,
      NumberOfEmployees: data.NumberOfEmployees,
      Type: data.Type,
      OwnerId: 'mock_owner_id',
      CreatedDate: new Date().toISOString(),
      LastModifiedDate: new Date().toISOString(),
    };
  }

  async createOpportunity(data: Partial<SalesforceOpportunity>): Promise<SalesforceOpportunity> {
    const response = await this.apiCall('POST', `/services/data/${this.apiVersion}/sobjects/Opportunity`, data);

    return {
      Id: response.id,
      Name: data.Name || '',
      AccountId: data.AccountId || '',
      Amount: data.Amount || 0,
      StageName: data.StageName || 'Prospecting',
      Probability: data.Probability || 10,
      CloseDate: data.CloseDate || new Date(Date.now() + 86400000 * 30).toISOString(),
      Type: data.Type,
      LeadSource: data.LeadSource,
      NextStep: data.NextStep,
      Description: data.Description,
      OwnerId: 'mock_owner_id',
      CreatedDate: new Date().toISOString(),
      LastModifiedDate: new Date().toISOString(),
    };
  }

  async updateOpportunity(id: string, updates: Partial<SalesforceOpportunity>): Promise<void> {
    await this.updateRecord('Opportunity', id, updates);
  }

  async createTask(data: Partial<SalesforceTask>): Promise<SalesforceTask> {
    const response = await this.apiCall('POST', `/services/data/${this.apiVersion}/sobjects/Task`, data);

    return {
      Id: response.id,
      Subject: data.Subject || '',
      Description: data.Description,
      Status: data.Status || 'Not Started',
      Priority: data.Priority || 'Normal',
      ActivityDate: data.ActivityDate || new Date().toISOString(),
      WhoId: data.WhoId,
      WhatId: data.WhatId,
      OwnerId: 'mock_owner_id',
      CreatedDate: new Date().toISOString(),
    };
  }

  async createCase(data: Partial<SalesforceCase>): Promise<SalesforceCase> {
    const response = await this.apiCall('POST', `/services/data/${this.apiVersion}/sobjects/Case`, data);

    return {
      Id: response.id,
      CaseNumber: `CASE-${Math.floor(Math.random() * 100000)}`,
      Subject: data.Subject || '',
      Description: data.Description || '',
      Status: data.Status || 'New',
      Priority: data.Priority || 'Medium',
      Origin: data.Origin || 'Web',
      Type: data.Type,
      AccountId: data.AccountId,
      ContactId: data.ContactId,
      OwnerId: 'mock_owner_id',
      CreatedDate: new Date().toISOString(),
    };
  }

  async getAccount(id: string): Promise<SalesforceAccount> {
    const response = await this.apiCall('GET', `/services/data/${this.apiVersion}/sobjects/Account/${id}`, {});

    // Mock account
    return {
      Id: id,
      Name: 'Acme Corporation',
      Industry: 'Technology',
      Phone: '(555) 123-4567',
      Website: 'https://acme.com',
      BillingAddress: {
        street: '123 Main St',
        city: 'San Francisco',
        state: 'CA',
        postalCode: '94105',
        country: 'USA',
      },
      AnnualRevenue: 5000000,
      NumberOfEmployees: 150,
      Type: 'Customer',
      OwnerId: 'mock_owner_id',
      CreatedDate: new Date(Date.now() - 86400000 * 365).toISOString(),
      LastModifiedDate: new Date(Date.now() - 86400000 * 30).toISOString(),
    };
  }

  async getContact(id: string): Promise<SalesforceContact> {
    const response = await this.apiCall('GET', `/services/data/${this.apiVersion}/sobjects/Contact/${id}`, {});

    // Mock contact
    return {
      Id: id,
      FirstName: 'John',
      LastName: 'Smith',
      Email: 'john.smith@acme.com',
      Phone: '(555) 987-6543',
      Title: 'VP of Sales',
      AccountId: 'acc001',
      Department: 'Sales',
      LeadSource: 'Referral',
      OwnerId: 'mock_owner_id',
      CreatedDate: new Date(Date.now() - 86400000 * 180).toISOString(),
    };
  }

  async getLead(id: string): Promise<SalesforceLead> {
    const response = await this.apiCall('GET', `/services/data/${this.apiVersion}/sobjects/Lead/${id}`, {});

    // Mock lead
    return {
      Id: id,
      FirstName: 'Jane',
      LastName: 'Doe',
      Company: 'Tech Startup Inc',
      Email: 'jane@techstartup.com',
      Phone: '(555) 456-7890',
      Title: 'CEO',
      Status: 'Open - Not Contacted',
      LeadSource: 'Website',
      Industry: 'Technology',
      Rating: 'Hot',
      OwnerId: 'mock_owner_id',
      CreatedDate: new Date(Date.now() - 86400000 * 7).toISOString(),
    };
  }

  async getOpportunity(id: string): Promise<SalesforceOpportunity> {
    const response = await this.apiCall('GET', `/services/data/${this.apiVersion}/sobjects/Opportunity/${id}`, {});

    // Mock opportunity
    return {
      Id: id,
      Name: 'Enterprise Software Deal',
      AccountId: 'acc001',
      Amount: 125000,
      StageName: 'Negotiation/Review',
      Probability: 75,
      CloseDate: new Date(Date.now() + 86400000 * 30).toISOString(),
      Type: 'New Business',
      LeadSource: 'Partner Referral',
      NextStep: 'Send contract for review',
      Description: 'Large enterprise deal with 3-year contract',
      OwnerId: 'mock_owner_id',
      CreatedDate: new Date(Date.now() - 86400000 * 60).toISOString(),
      LastModifiedDate: new Date(Date.now() - 86400000 * 2).toISOString(),
    };
  }

  async updateRecord(objectType: string, id: string, fields: any): Promise<void> {
    await this.apiCall('PATCH', `/services/data/${this.apiVersion}/sobjects/${objectType}/${id}`, fields);
  }

  async deleteRecord(objectType: string, id: string): Promise<void> {
    await this.apiCall('DELETE', `/services/data/${this.apiVersion}/sobjects/${objectType}/${id}`, {});
  }

  async convertLead(leadId: string, options?: {
    accountId?: string;
    contactId?: string;
    createOpportunity?: boolean;
    opportunityName?: string;
  }): Promise<{ accountId: string; contactId: string; opportunityId?: string }> {
    const response = await this.apiCall('POST', '/services/data/v58.0/process/conversions', {
      leadId,
      accountId: options?.accountId,
      contactId: options?.contactId,
      doNotCreateOpportunity: !options?.createOpportunity,
      opportunityName: options?.opportunityName,
    });

    return {
      accountId: response.accountId || 'acc_converted',
      contactId: response.contactId || 'con_converted',
      opportunityId: options?.createOpportunity ? response.opportunityId || 'opp_converted' : undefined,
    };
  }

  async logActivity(data: {
    subject: string;
    description?: string;
    relatedTo?: string; // Account/Opportunity ID
    contact?: string; // Contact/Lead ID
  }): Promise<SalesforceTask> {
    return this.createTask({
      Subject: data.subject,
      Description: data.description,
      WhatId: data.relatedTo,
      WhoId: data.contact,
      Status: 'Completed',
      Priority: 'Normal',
      ActivityDate: new Date().toISOString(),
    });
  }

  async search(searchTerm: string): Promise<any[]> {
    const response = await this.apiCall('GET', `/services/data/${this.apiVersion}/search`, {
      q: `FIND {${searchTerm}} IN ALL FIELDS RETURNING Account(Name), Contact(Name, Email), Lead(Name, Company)`,
    });

    return response.searchRecords || [];
  }

  async getRecentItems(objectType?: string): Promise<any[]> {
    const endpoint = objectType
      ? `/services/data/${this.apiVersion}/sobjects/${objectType}/recent`
      : `/services/data/${this.apiVersion}/recent`;

    const response = await this.apiCall('GET', endpoint, {});

    return response || [];
  }

  async describeObject(objectType: string): Promise<any> {
    const response = await this.apiCall('GET', `/services/data/${this.apiVersion}/sobjects/${objectType}/describe`, {});

    return response;
  }

  // Private helper method
  private async apiCall(method: string, endpoint: string, data: any): Promise<any> {
    // Mock API call
    return {
      id: `sf${Date.now()}`,
      success: true,
      searchRecords: [],
    };
  }
}

export default SalesforceIntegration;
