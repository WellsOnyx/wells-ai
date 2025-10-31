/**
 * Notion CRM Adapter
 *
 * For users who don't have a CRM, we provision Notion
 * - Free
 * - Familiar to most users
 * - Flexible (can customize fields)
 * - Already integrated with Wells AI
 */

import { Client } from '@notionhq/client'
import type {
  CRMAdapter,
  Contact,
  Deal,
  Activity,
} from './base'

export class NotionCRMAdapter implements CRMAdapter {
  name = 'Notion CRM'
  type = 'notion' as const

  private notion: Client
  private contactsDbId: string
  private dealsDbId: string
  private activitiesDbId: string

  constructor(config: {
    apiKey: string
    contactsDbId: string
    dealsDbId: string
    activitiesDbId: string
  }) {
    this.notion = new Client({ auth: config.apiKey })
    this.contactsDbId = config.contactsDbId
    this.dealsDbId = config.dealsDbId
    this.activitiesDbId = config.activitiesDbId
  }

  async getContact(id: string): Promise<Contact> {
    const page = await this.notion.pages.retrieve({ page_id: id })
    return this.mapNotionPageToContact(page as any)
  }

  async searchContacts(query: string): Promise<Contact[]> {
    const response = await this.notion.databases.query({
      database_id: this.contactsDbId,
      filter: {
        or: [
          {
            property: 'Name',
            title: {
              contains: query,
            },
          },
          {
            property: 'Email',
            email: {
              contains: query,
            },
          },
          {
            property: 'Company',
            rich_text: {
              contains: query,
            },
          },
        ],
      },
    })

    return response.results.map((page) => this.mapNotionPageToContact(page as any))
  }

  async createContact(contact: Omit<Contact, 'id'>): Promise<Contact> {
    const page = await this.notion.pages.create({
      parent: { database_id: this.contactsDbId },
      properties: {
        Name: {
          title: [{ text: { content: `${contact.firstName} ${contact.lastName}` } }],
        },
        'First Name': {
          rich_text: [{ text: { content: contact.firstName } }],
        },
        'Last Name': {
          rich_text: [{ text: { content: contact.lastName } }],
        },
        Email: {
          email: contact.email,
        },
        Phone: {
          phone_number: contact.phone || null,
        },
        Company: {
          rich_text: contact.company ? [{ text: { content: contact.company } }] : [],
        },
        Title: {
          rich_text: contact.title ? [{ text: { content: contact.title } }] : [],
        },
        LinkedIn: {
          url: contact.linkedInUrl || null,
        },
      },
    })

    return this.mapNotionPageToContact(page as any)
  }

  async updateContact(id: string, updates: Partial<Contact>): Promise<Contact> {
    const properties: any = {}

    if (updates.firstName || updates.lastName) {
      properties.Name = {
        title: [
          {
            text: {
              content: `${updates.firstName || ''} ${updates.lastName || ''}`.trim(),
            },
          },
        ],
      }
    }

    if (updates.email) {
      properties.Email = { email: updates.email }
    }

    if (updates.phone) {
      properties.Phone = { phone_number: updates.phone }
    }

    if (updates.company) {
      properties.Company = {
        rich_text: [{ text: { content: updates.company } }],
      }
    }

    if (updates.title) {
      properties.Title = {
        rich_text: [{ text: { content: updates.title } }],
      }
    }

    const page = await this.notion.pages.update({
      page_id: id,
      properties,
    })

    return this.mapNotionPageToContact(page as any)
  }

  async getDeal(id: string): Promise<Deal> {
    const page = await this.notion.pages.retrieve({ page_id: id })
    return this.mapNotionPageToDeal(page as any)
  }

  async getDeals(filters?: { stage?: string; wonLost?: 'won' | 'lost' }): Promise<Deal[]> {
    const notionFilters: any[] = []

    if (filters?.stage) {
      notionFilters.push({
        property: 'Stage',
        select: {
          equals: filters.stage,
        },
      })
    }

    if (filters?.wonLost) {
      notionFilters.push({
        property: 'Status',
        select: {
          equals: filters.wonLost === 'won' ? 'Won' : 'Lost',
        },
      })
    }

    const response = await this.notion.databases.query({
      database_id: this.dealsDbId,
      filter: notionFilters.length > 0 ? { and: notionFilters } : undefined,
    })

    return response.results.map((page) => this.mapNotionPageToDeal(page as any))
  }

  async createDeal(deal: Omit<Deal, 'id'>): Promise<Deal> {
    const page = await this.notion.pages.create({
      parent: { database_id: this.dealsDbId },
      properties: {
        Name: {
          title: [{ text: { content: deal.title } }],
        },
        Value: {
          number: deal.value,
        },
        Stage: {
          select: { name: deal.stage },
        },
        Contact: {
          relation: [{ id: deal.contactId }],
        },
      },
    })

    return this.mapNotionPageToDeal(page as any)
  }

  async updateDeal(id: string, updates: Partial<Deal>): Promise<Deal> {
    const properties: any = {}

    if (updates.title) {
      properties.Name = {
        title: [{ text: { content: updates.title } }],
      }
    }

    if (updates.value !== undefined) {
      properties.Value = { number: updates.value }
    }

    if (updates.stage) {
      properties.Stage = { select: { name: updates.stage } }
    }

    if (updates.wonLost) {
      properties.Status = {
        select: { name: updates.wonLost === 'won' ? 'Won' : 'Lost' },
      }
    }

    const page = await this.notion.pages.update({
      page_id: id,
      properties,
    })

    return this.mapNotionPageToDeal(page as any)
  }

  async getActivities(contactId: string): Promise<Activity[]> {
    const response = await this.notion.databases.query({
      database_id: this.activitiesDbId,
      filter: {
        property: 'Contact',
        relation: {
          contains: contactId,
        },
      },
      sorts: [
        {
          property: 'Date',
          direction: 'descending',
        },
      ],
    })

    return response.results.map((page) => this.mapNotionPageToActivity(page as any))
  }

  async logActivity(activity: Omit<Activity, 'id'>): Promise<Activity> {
    const page = await this.notion.pages.create({
      parent: { database_id: this.activitiesDbId },
      properties: {
        Type: {
          select: { name: activity.type },
        },
        Contact: {
          relation: [{ id: activity.contactId }],
        },
        Deal: activity.dealId
          ? {
              relation: [{ id: activity.dealId }],
            }
          : undefined,
        Subject: activity.subject
          ? {
              rich_text: [{ text: { content: activity.subject } }],
            }
          : undefined,
        Notes: activity.body
          ? {
              rich_text: [{ text: { content: activity.body } }],
            }
          : undefined,
        Date: {
          date: { start: activity.timestamp.toISOString() },
        },
      },
    })

    return this.mapNotionPageToActivity(page as any)
  }

  async analyzeWonDeals(): Promise<{
    avgDealSize: number
    topIndustries: string[]
    topTitles: string[]
    avgSalesCycle: number
    winRate: number
  }> {
    const wonDeals = await this.getDeals({ wonLost: 'won' })
    const allDeals = await this.getDeals()

    const avgDealSize =
      wonDeals.reduce((sum, deal) => sum + deal.value, 0) / wonDeals.length || 0

    // Get contact details for won deals
    const contacts = await Promise.all(
      wonDeals.map((deal) => this.getContact(deal.contactId))
    )

    // Count industries
    const industries = contacts
      .map((c) => c.customFields?.industry as string)
      .filter(Boolean)
    const topIndustries = this.getTopN(industries, 5)

    // Count titles
    const titles = contacts.map((c) => c.title).filter(Boolean) as string[]
    const topTitles = this.getTopN(titles, 5)

    // Calculate win rate
    const winRate = (wonDeals.length / allDeals.length) * 100 || 0

    // Avg sales cycle (would need created date)
    const avgSalesCycle = 30 // Placeholder

    return {
      avgDealSize,
      topIndustries,
      topTitles,
      avgSalesCycle,
      winRate,
    }
  }

  // ===== HELPER METHODS =====

  private mapNotionPageToContact(page: any): Contact {
    const props = page.properties

    return {
      id: page.id,
      firstName: this.getPlainText(props['First Name']) || '',
      lastName: this.getPlainText(props['Last Name']) || '',
      email: props.Email?.email || '',
      phone: props.Phone?.phone_number || undefined,
      company: this.getPlainText(props.Company) || undefined,
      title: this.getPlainText(props.Title) || undefined,
      linkedInUrl: props.LinkedIn?.url || undefined,
      twitterHandle: props.Twitter?.url || undefined,
    }
  }

  private mapNotionPageToDeal(page: any): Deal {
    const props = page.properties

    return {
      id: page.id,
      title: this.getPlainText(props.Name) || '',
      value: props.Value?.number || 0,
      stage: props.Stage?.select?.name || 'New',
      contactId: props.Contact?.relation?.[0]?.id || '',
      closedAt: props['Closed Date']?.date?.start
        ? new Date(props['Closed Date'].date.start)
        : undefined,
      wonLost: props.Status?.select?.name === 'Won' ? 'won' : 'lost',
    }
  }

  private mapNotionPageToActivity(page: any): Activity {
    const props = page.properties

    return {
      id: page.id,
      type: (props.Type?.select?.name || 'note') as Activity['type'],
      contactId: props.Contact?.relation?.[0]?.id || '',
      dealId: props.Deal?.relation?.[0]?.id || undefined,
      subject: this.getPlainText(props.Subject) || undefined,
      body: this.getPlainText(props.Notes) || undefined,
      timestamp: props.Date?.date?.start ? new Date(props.Date.date.start) : new Date(),
    }
  }

  private getPlainText(property: any): string | null {
    if (!property) return null

    if (property.title) {
      return property.title.map((t: any) => t.plain_text).join('')
    }

    if (property.rich_text) {
      return property.rich_text.map((t: any) => t.plain_text).join('')
    }

    return null
  }

  private getTopN(items: string[], n: number): string[] {
    const counts = items.reduce((acc, item) => {
      acc[item] = (acc[item] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, n)
      .map(([item]) => item)
  }
}

/**
 * Create Notion CRM databases for a new user
 */
export async function provisionNotionCRM(apiKey: string): Promise<{
  contactsDbId: string
  dealsDbId: string
  activitiesDbId: string
}> {
  const notion = new Client({ auth: apiKey })

  // In production, this would:
  // 1. Create a new Notion workspace (or use existing)
  // 2. Create Contacts database
  // 3. Create Deals database
  // 4. Create Activities database
  // 5. Set up relations between them

  // For now, return placeholder IDs
  return {
    contactsDbId: 'notion-contacts-db-placeholder',
    dealsDbId: 'notion-deals-db-placeholder',
    activitiesDbId: 'notion-activities-db-placeholder',
  }
}
