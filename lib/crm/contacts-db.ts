// Contacts Database for Cold Start CRM
// Supports CSV import and manages contact lifecycle for outreach campaigns

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.POSTGRES_URL || process.env.DATABASE_URL || '');

// Contact types
export interface Contact {
  id: string;
  // Core fields
  email: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  phone?: string;

  // Company info
  company?: string;
  title?: string;
  industry?: string;
  companySize?: string;
  revenue?: string;

  // Location
  city?: string;
  state?: string;
  country?: string;
  timezone?: string;

  // Social
  linkedinUrl?: string;
  twitterHandle?: string;
  website?: string;

  // CRM fields
  source: string;  // csv_import, api, manual, linkedin, apollo, etc
  sourceFile?: string;
  campaignId?: string;
  listName?: string;

  // Scoring
  icpScore?: number;  // 0-100 ideal customer profile match
  engagementScore?: number;  // 0-100 based on activity
  priority?: 'hot' | 'warm' | 'cold';

  // Status
  status: 'new' | 'contacted' | 'replied' | 'meeting_booked' | 'qualified' | 'customer' | 'churned' | 'unsubscribed' | 'bounced';
  lastContactedAt?: Date;
  nextFollowUpAt?: Date;

  // Tracking
  emailsSent: number;
  emailsOpened: number;
  emailsClicked: number;
  callsMade: number;
  meetingsBooked: number;

  // Custom fields (JSON)
  customFields?: Record<string, any>;
  tags?: string[];
  notes?: string;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

export interface ContactList {
  id: string;
  name: string;
  description?: string;
  source: string;
  contactCount: number;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

// Create contacts table
export async function createContactsTable(): Promise<boolean> {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS crm_contacts (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        first_name TEXT,
        last_name TEXT,
        full_name TEXT,
        phone TEXT,

        company TEXT,
        title TEXT,
        industry TEXT,
        company_size TEXT,
        revenue TEXT,

        city TEXT,
        state TEXT,
        country TEXT,
        timezone TEXT,

        linkedin_url TEXT,
        twitter_handle TEXT,
        website TEXT,

        source TEXT NOT NULL DEFAULT 'manual',
        source_file TEXT,
        campaign_id TEXT,
        list_name TEXT,

        icp_score INTEGER DEFAULT 0,
        engagement_score INTEGER DEFAULT 0,
        priority TEXT DEFAULT 'cold',

        status TEXT NOT NULL DEFAULT 'new',
        last_contacted_at TIMESTAMPTZ,
        next_follow_up_at TIMESTAMPTZ,

        emails_sent INTEGER DEFAULT 0,
        emails_opened INTEGER DEFAULT 0,
        emails_clicked INTEGER DEFAULT 0,
        calls_made INTEGER DEFAULT 0,
        meetings_booked INTEGER DEFAULT 0,

        custom_fields JSONB DEFAULT '{}',
        tags TEXT[] DEFAULT '{}',
        notes TEXT,

        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        created_by TEXT,

        CONSTRAINT unique_email_list UNIQUE (email, list_name)
      )
    `;

    // Create indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_crm_contacts_email ON crm_contacts(email)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_crm_contacts_company ON crm_contacts(company)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_crm_contacts_industry ON crm_contacts(industry)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_crm_contacts_status ON crm_contacts(status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_crm_contacts_priority ON crm_contacts(priority)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_crm_contacts_list ON crm_contacts(list_name)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_crm_contacts_campaign ON crm_contacts(campaign_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_crm_contacts_icp_score ON crm_contacts(icp_score DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_crm_contacts_tags ON crm_contacts USING GIN(tags)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_crm_contacts_created ON crm_contacts(created_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_crm_contacts_next_followup ON crm_contacts(next_follow_up_at)`;

    // Create lists table
    await sql`
      CREATE TABLE IF NOT EXISTS crm_contact_lists (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        source TEXT NOT NULL DEFAULT 'csv_import',
        contact_count INTEGER DEFAULT 0,
        tags TEXT[] DEFAULT '{}',
        filter_criteria JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // Activity log
    await sql`
      CREATE TABLE IF NOT EXISTS crm_contact_activities (
        id TEXT PRIMARY KEY,
        contact_id TEXT NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
        activity_type TEXT NOT NULL,
        channel TEXT,
        subject TEXT,
        content TEXT,
        outcome TEXT,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        created_by TEXT
      )
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_crm_activities_contact ON crm_contact_activities(contact_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_crm_activities_type ON crm_contact_activities(activity_type)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_crm_activities_created ON crm_contact_activities(created_at DESC)`;

    return true;
  } catch (error) {
    console.error('Failed to create contacts table:', error);
    return false;
  }
}

// CSV field mapping
const CSV_FIELD_MAPPINGS: Record<string, string[]> = {
  email: ['email', 'email_address', 'e-mail', 'work_email', 'business_email'],
  firstName: ['first_name', 'firstname', 'first', 'given_name', 'fname'],
  lastName: ['last_name', 'lastname', 'last', 'family_name', 'surname', 'lname'],
  fullName: ['full_name', 'fullname', 'name', 'contact_name', 'person_name'],
  phone: ['phone', 'phone_number', 'mobile', 'cell', 'telephone', 'work_phone', 'direct_phone'],
  company: ['company', 'company_name', 'organization', 'org', 'employer', 'account_name'],
  title: ['title', 'job_title', 'position', 'role', 'designation', 'person_title'],
  industry: ['industry', 'sector', 'vertical', 'business_type'],
  companySize: ['company_size', 'employees', 'employee_count', 'headcount', 'size'],
  revenue: ['revenue', 'annual_revenue', 'arr', 'company_revenue'],
  city: ['city', 'town', 'locality'],
  state: ['state', 'province', 'region', 'state_province'],
  country: ['country', 'nation', 'country_name'],
  linkedinUrl: ['linkedin', 'linkedin_url', 'linkedin_profile', 'li_url', 'person_linkedin_url'],
  twitterHandle: ['twitter', 'twitter_handle', 'twitter_url'],
  website: ['website', 'url', 'company_website', 'web', 'company_url'],
};

// Normalize CSV headers
function normalizeHeader(header: string): string {
  return header.toLowerCase().trim().replace(/[\s-]+/g, '_').replace(/[^a-z0-9_]/g, '');
}

// Map CSV row to contact
function mapCsvRowToContact(row: Record<string, string>, listName: string, sourceFile: string): Partial<Contact> {
  const normalizedRow: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    normalizedRow[normalizeHeader(key)] = value?.trim() || '';
  }

  const contact: Partial<Contact> = {
    source: 'csv_import',
    sourceFile,
    listName,
    status: 'new',
    priority: 'cold',
    emailsSent: 0,
    emailsOpened: 0,
    emailsClicked: 0,
    callsMade: 0,
    meetingsBooked: 0,
    customFields: {},
  };

  // Map known fields
  for (const [field, aliases] of Object.entries(CSV_FIELD_MAPPINGS)) {
    for (const alias of aliases) {
      if (normalizedRow[alias]) {
        (contact as any)[field] = normalizedRow[alias];
        break;
      }
    }
  }

  // Derive full name if not present
  if (!contact.fullName && (contact.firstName || contact.lastName)) {
    contact.fullName = [contact.firstName, contact.lastName].filter(Boolean).join(' ');
  }

  // Store unmapped fields as custom fields
  const mappedKeys = new Set(Object.values(CSV_FIELD_MAPPINGS).flat());
  for (const [key, value] of Object.entries(normalizedRow)) {
    if (value && !mappedKeys.has(key)) {
      contact.customFields![key] = value;
    }
  }

  return contact;
}

// Import contacts from CSV data
export async function importContactsFromCsv(
  csvRows: Record<string, string>[],
  listName: string,
  sourceFile: string,
  createdBy?: string
): Promise<{
  imported: number;
  duplicates: number;
  errors: number;
  contacts: Contact[];
}> {
  const result = {
    imported: 0,
    duplicates: 0,
    errors: 0,
    contacts: [] as Contact[],
  };

  // Ensure table exists
  await createContactsTable();

  // Create or get list
  const listId = `list_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await sql`
    INSERT INTO crm_contact_lists (id, name, source, description)
    VALUES (${listId}, ${listName}, 'csv_import', ${`Imported from ${sourceFile}`})
    ON CONFLICT (name) DO UPDATE SET
      updated_at = NOW(),
      contact_count = crm_contact_lists.contact_count + ${csvRows.length}
  `;

  for (const row of csvRows) {
    try {
      const contactData = mapCsvRowToContact(row, listName, sourceFile);

      if (!contactData.email) {
        result.errors++;
        continue;
      }

      const contactId = `con_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      const inserted = await sql`
        INSERT INTO crm_contacts (
          id, email, first_name, last_name, full_name, phone,
          company, title, industry, company_size, revenue,
          city, state, country,
          linkedin_url, twitter_handle, website,
          source, source_file, list_name,
          custom_fields, created_by
        )
        VALUES (
          ${contactId},
          ${contactData.email!.toLowerCase()},
          ${contactData.firstName || null},
          ${contactData.lastName || null},
          ${contactData.fullName || null},
          ${contactData.phone || null},
          ${contactData.company || null},
          ${contactData.title || null},
          ${contactData.industry || null},
          ${contactData.companySize || null},
          ${contactData.revenue || null},
          ${contactData.city || null},
          ${contactData.state || null},
          ${contactData.country || null},
          ${contactData.linkedinUrl || null},
          ${contactData.twitterHandle || null},
          ${contactData.website || null},
          'csv_import',
          ${sourceFile},
          ${listName},
          ${JSON.stringify(contactData.customFields || {})},
          ${createdBy || null}
        )
        ON CONFLICT (email, list_name) DO NOTHING
        RETURNING *
      `;

      if (inserted.length > 0) {
        result.imported++;
        result.contacts.push(inserted[0] as unknown as Contact);
      } else {
        result.duplicates++;
      }
    } catch (error) {
      console.error('Error importing contact:', error);
      result.errors++;
    }
  }

  // Update list count
  await sql`
    UPDATE crm_contact_lists
    SET contact_count = (
      SELECT COUNT(*) FROM crm_contacts WHERE list_name = ${listName}
    )
    WHERE name = ${listName}
  `;

  return result;
}

// Get contacts with filtering
export async function getContacts(options: {
  listName?: string;
  status?: string;
  priority?: string;
  industry?: string;
  minIcpScore?: number;
  search?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
}): Promise<{ contacts: Contact[]; total: number }> {
  const {
    listName,
    status,
    priority,
    industry,
    minIcpScore,
    search,
    tags,
    limit = 50,
    offset = 0,
  } = options;

  // Build dynamic query
  let whereClause = 'WHERE 1=1';
  const params: any[] = [];
  let paramIndex = 1;

  if (listName) {
    whereClause += ` AND list_name = $${paramIndex++}`;
    params.push(listName);
  }
  if (status) {
    whereClause += ` AND status = $${paramIndex++}`;
    params.push(status);
  }
  if (priority) {
    whereClause += ` AND priority = $${paramIndex++}`;
    params.push(priority);
  }
  if (industry) {
    whereClause += ` AND industry ILIKE $${paramIndex++}`;
    params.push(`%${industry}%`);
  }
  if (minIcpScore !== undefined) {
    whereClause += ` AND icp_score >= $${paramIndex++}`;
    params.push(minIcpScore);
  }
  if (search) {
    whereClause += ` AND (email ILIKE $${paramIndex} OR full_name ILIKE $${paramIndex} OR company ILIKE $${paramIndex})`;
    params.push(`%${search}%`);
    paramIndex++;
  }
  if (tags && tags.length > 0) {
    whereClause += ` AND tags && $${paramIndex++}`;
    params.push(tags);
  }

  // For now use simpler approach with tagged template
  const contacts = await sql`
    SELECT * FROM crm_contacts
    WHERE
      (${listName || null} IS NULL OR list_name = ${listName || null})
      AND (${status || null} IS NULL OR status = ${status || null})
      AND (${priority || null} IS NULL OR priority = ${priority || null})
      AND (${industry || null} IS NULL OR industry ILIKE ${'%' + (industry || '') + '%'})
      AND (${minIcpScore ?? null} IS NULL OR icp_score >= ${minIcpScore ?? 0})
    ORDER BY created_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  const countResult = await sql`
    SELECT COUNT(*) as total FROM crm_contacts
    WHERE
      (${listName || null} IS NULL OR list_name = ${listName || null})
      AND (${status || null} IS NULL OR status = ${status || null})
      AND (${priority || null} IS NULL OR priority = ${priority || null})
  `;

  return {
    contacts: contacts as unknown as Contact[],
    total: parseInt(countResult[0]?.total || '0'),
  };
}

// Update contact
export async function updateContact(
  contactId: string,
  updates: Partial<Contact>
): Promise<Contact | null> {
  const result = await sql`
    UPDATE crm_contacts
    SET
      status = COALESCE(${updates.status || null}, status),
      priority = COALESCE(${updates.priority || null}, priority),
      icp_score = COALESCE(${updates.icpScore ?? null}, icp_score),
      engagement_score = COALESCE(${updates.engagementScore ?? null}, engagement_score),
      last_contacted_at = COALESCE(${updates.lastContactedAt?.toISOString() || null}, last_contacted_at),
      next_follow_up_at = COALESCE(${updates.nextFollowUpAt?.toISOString() || null}, next_follow_up_at),
      emails_sent = COALESCE(${updates.emailsSent ?? null}, emails_sent),
      emails_opened = COALESCE(${updates.emailsOpened ?? null}, emails_opened),
      emails_clicked = COALESCE(${updates.emailsClicked ?? null}, emails_clicked),
      calls_made = COALESCE(${updates.callsMade ?? null}, calls_made),
      meetings_booked = COALESCE(${updates.meetingsBooked ?? null}, meetings_booked),
      notes = COALESCE(${updates.notes || null}, notes),
      tags = COALESCE(${updates.tags || null}, tags),
      updated_at = NOW()
    WHERE id = ${contactId}
    RETURNING *
  `;

  return result[0] as unknown as Contact || null;
}

// Log contact activity
export async function logContactActivity(
  contactId: string,
  activityType: string,
  options: {
    channel?: string;
    subject?: string;
    content?: string;
    outcome?: string;
    metadata?: Record<string, any>;
    createdBy?: string;
  }
): Promise<void> {
  const activityId = `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  await sql`
    INSERT INTO crm_contact_activities (
      id, contact_id, activity_type, channel, subject, content, outcome, metadata, created_by
    )
    VALUES (
      ${activityId},
      ${contactId},
      ${activityType},
      ${options.channel || null},
      ${options.subject || null},
      ${options.content || null},
      ${options.outcome || null},
      ${JSON.stringify(options.metadata || {})},
      ${options.createdBy || null}
    )
  `;

  // Update engagement score based on activity
  const scoreIncrease =
    activityType === 'email_opened' ? 10 :
    activityType === 'email_clicked' ? 20 :
    activityType === 'replied' ? 30 :
    activityType === 'meeting_booked' ? 50 :
    activityType === 'call_completed' ? 15 : 5;

  await sql`
    UPDATE crm_contacts
    SET
      engagement_score = LEAST(100, engagement_score + ${scoreIncrease}),
      updated_at = NOW()
    WHERE id = ${contactId}
  `;
}

// Get contact lists
export async function getContactLists(): Promise<ContactList[]> {
  const lists = await sql`
    SELECT * FROM crm_contact_lists
    ORDER BY created_at DESC
  `;
  return lists as unknown as ContactList[];
}

// Score contacts using ICP criteria
export async function scoreContactsWithIcp(
  listName: string,
  icpCriteria: {
    industries?: string[];
    companySizes?: string[];
    titles?: string[];
    countries?: string[];
    minRevenue?: string;
  }
): Promise<number> {
  const {
    industries = [],
    companySizes = [],
    titles = [],
    countries = [],
  } = icpCriteria;

  // Score based on matches
  let updated = 0;

  if (industries.length > 0) {
    const result = await sql`
      UPDATE crm_contacts
      SET icp_score = icp_score + 25
      WHERE list_name = ${listName}
        AND industry = ANY(${industries})
    `;
    updated += result.count || 0;
  }

  if (titles.length > 0) {
    await sql`
      UPDATE crm_contacts
      SET icp_score = icp_score + 25
      WHERE list_name = ${listName}
        AND title ILIKE ANY(${titles.map(t => `%${t}%`)})
    `;
  }

  if (companySizes.length > 0) {
    await sql`
      UPDATE crm_contacts
      SET icp_score = icp_score + 20
      WHERE list_name = ${listName}
        AND company_size = ANY(${companySizes})
    `;
  }

  if (countries.length > 0) {
    await sql`
      UPDATE crm_contacts
      SET icp_score = icp_score + 10
      WHERE list_name = ${listName}
        AND country = ANY(${countries})
    `;
  }

  // Set priority based on score
  await sql`
    UPDATE crm_contacts
    SET priority = CASE
      WHEN icp_score >= 70 THEN 'hot'
      WHEN icp_score >= 40 THEN 'warm'
      ELSE 'cold'
    END
    WHERE list_name = ${listName}
  `;

  return updated;
}

// Export module
export const contactsDb = {
  createTable: createContactsTable,
  importCsv: importContactsFromCsv,
  get: getContacts,
  update: updateContact,
  logActivity: logContactActivity,
  getLists: getContactLists,
  scoreWithIcp: scoreContactsWithIcp,
};
