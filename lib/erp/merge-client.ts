/**
 * Merge.dev API Client
 *
 * Unified API for SAP, NetSuite, Oracle, Dynamics, QuickBooks, Xero, etc.
 * Used to inject Wells fees into invoices at creation time.
 */

const MERGE_API_URL = 'https://api.merge.dev/api/accounting/v1'

interface MergeConfig {
  apiKey: string
  accountToken: string // Customer's linked account token
}

interface MergeInvoice {
  id: string
  remote_id: string
  type: 'ACCOUNTS_PAYABLE' | 'ACCOUNTS_RECEIVABLE'
  contact: string
  number: string
  issue_date: string
  due_date: string
  paid_on_date?: string
  memo?: string
  currency: string
  total_amount: number
  balance: number
  line_items: MergeLineItem[]
  payments?: string[]
  remote_created_at: string
  remote_updated_at: string
}

interface MergeLineItem {
  id?: string
  remote_id?: string
  description: string
  unit_price: number
  quantity: number
  total_amount: number
  currency: string
  account?: string
  tracking_categories?: string[]
}

interface MergeContact {
  id: string
  remote_id: string
  name: string
  email_address?: string
  is_supplier: boolean
  is_customer: boolean
}

class MergeClient {
  private apiKey: string
  private accountToken: string

  constructor(config: MergeConfig) {
    this.apiKey = config.apiKey
    this.accountToken = config.accountToken
  }

  private async request<T>(
    method: string,
    endpoint: string,
    body?: unknown
  ): Promise<T> {
    const response = await fetch(`${MERGE_API_URL}${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'X-Account-Token': this.accountToken,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Merge API error: ${response.status} - ${error}`)
    }

    return response.json()
  }

  // List invoices
  async listInvoices(params?: {
    type?: 'ACCOUNTS_PAYABLE' | 'ACCOUNTS_RECEIVABLE'
    contact_id?: string
    created_after?: string
    modified_after?: string
  }): Promise<{ results: MergeInvoice[] }> {
    const searchParams = new URLSearchParams()
    if (params?.type) searchParams.set('type', params.type)
    if (params?.contact_id) searchParams.set('contact_id', params.contact_id)
    if (params?.created_after) searchParams.set('created_after', params.created_after)
    if (params?.modified_after) searchParams.set('modified_after', params.modified_after)

    const query = searchParams.toString()
    return this.request('GET', `/invoices${query ? `?${query}` : ''}`)
  }

  // Get single invoice
  async getInvoice(invoiceId: string): Promise<MergeInvoice> {
    return this.request('GET', `/invoices/${invoiceId}`)
  }

  // Create invoice with Wells fee line item included
  async createInvoice(invoice: {
    type: 'ACCOUNTS_PAYABLE' | 'ACCOUNTS_RECEIVABLE'
    contact: string
    number?: string
    issue_date: string
    due_date: string
    currency: string
    line_items: MergeLineItem[]
  }): Promise<{ model: MergeInvoice }> {
    return this.request('POST', '/invoices', { model: invoice })
  }

  // Update invoice (add line item)
  async updateInvoice(
    invoiceId: string,
    updates: Partial<MergeInvoice>
  ): Promise<{ model: MergeInvoice }> {
    return this.request('PATCH', `/invoices/${invoiceId}`, { model: updates })
  }

  // List contacts/vendors
  async listContacts(params?: {
    is_supplier?: boolean
    is_customer?: boolean
  }): Promise<{ results: MergeContact[] }> {
    const searchParams = new URLSearchParams()
    if (params?.is_supplier !== undefined) {
      searchParams.set('is_supplier', String(params.is_supplier))
    }
    if (params?.is_customer !== undefined) {
      searchParams.set('is_customer', String(params.is_customer))
    }

    const query = searchParams.toString()
    return this.request('GET', `/contacts${query ? `?${query}` : ''}`)
  }

  // Get linked account info
  async getAccountDetails(): Promise<{
    id: string
    integration: string
    integration_slug: string
    category: string
    end_user_origin_id: string
    end_user_organization_name: string
    end_user_email_address: string
    status: string
  }> {
    return this.request('GET', '/account-details')
  }
}

/**
 * Create a Merge client for a specific customer's linked account
 */
export function createMergeClient(accountToken: string): MergeClient {
  const apiKey = process.env.MERGE_API_KEY
  if (!apiKey) {
    throw new Error('MERGE_API_KEY not configured')
  }

  return new MergeClient({ apiKey, accountToken })
}

/**
 * Get the ERP system type from a Merge account
 */
export async function getErpSystem(
  accountToken: string
): Promise<'sap' | 'netsuite' | 'oracle' | 'dynamics' | 'quickbooks' | 'xero' | 'other'> {
  const client = createMergeClient(accountToken)
  const details = await client.getAccountDetails()

  const slug = details.integration_slug.toLowerCase()

  if (slug.includes('sap')) return 'sap'
  if (slug.includes('netsuite')) return 'netsuite'
  if (slug.includes('oracle')) return 'oracle'
  if (slug.includes('dynamics')) return 'dynamics'
  if (slug.includes('quickbooks') || slug.includes('qbo')) return 'quickbooks'
  if (slug.includes('xero')) return 'xero'

  return 'other'
}

export { MergeClient, type MergeInvoice, type MergeLineItem, type MergeContact }
