/**
 * CRM Contact Management
 * Handles contact CRUD, CSV import, and list management
 */

import { query, withTransaction } from '../db'
import type { Contact, ContactList, CSVImportMapping, CSVImportResult } from './types'

/**
 * Create a new contact
 */
export async function createContact(
  userId: string,
  data: Partial<Contact>
): Promise<Contact> {
  const result = await query<Contact>(
    `INSERT INTO crm_contacts (
      user_id, first_name, last_name, email, phone, company, title,
      twitter_handle, linkedin_url, tags, source, custom_fields
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    ON CONFLICT (user_id, email) DO UPDATE SET
      first_name = COALESCE(EXCLUDED.first_name, crm_contacts.first_name),
      last_name = COALESCE(EXCLUDED.last_name, crm_contacts.last_name),
      phone = COALESCE(EXCLUDED.phone, crm_contacts.phone),
      company = COALESCE(EXCLUDED.company, crm_contacts.company),
      title = COALESCE(EXCLUDED.title, crm_contacts.title),
      twitter_handle = COALESCE(EXCLUDED.twitter_handle, crm_contacts.twitter_handle),
      linkedin_url = COALESCE(EXCLUDED.linkedin_url, crm_contacts.linkedin_url),
      tags = array_cat(crm_contacts.tags, EXCLUDED.tags),
      custom_fields = crm_contacts.custom_fields || EXCLUDED.custom_fields,
      updated_at = NOW()
    RETURNING *`,
    [
      userId,
      data.first_name || '',
      data.last_name || '',
      data.email?.toLowerCase().trim() || null,
      data.phone?.replace(/\D/g, '') || null,
      data.company || null,
      data.title || null,
      data.twitter_handle?.replace('@', '') || null,
      data.linkedin_url || null,
      data.tags || [],
      data.source || 'manual',
      data.custom_fields || {}
    ]
  )
  return result.rows[0]
}

/**
 * Get contacts with filtering and pagination
 */
export async function getContacts(
  userId: string,
  options: {
    listId?: string
    tags?: string[]
    status?: string
    search?: string
    limit?: number
    offset?: number
    sortBy?: string
    sortDir?: 'asc' | 'desc'
  } = {}
): Promise<{ contacts: Contact[]; total: number }> {
  const {
    listId,
    tags,
    status,
    search,
    limit = 50,
    offset = 0,
    sortBy = 'created_at',
    sortDir = 'desc'
  } = options

  let whereClause = 'WHERE c.user_id = $1'
  const params: any[] = [userId]
  let paramIndex = 2

  if (listId) {
    whereClause += ` AND c.id IN (SELECT contact_id FROM crm_contact_lists WHERE list_id = $${paramIndex})`
    params.push(listId)
    paramIndex++
  }

  if (tags && tags.length > 0) {
    whereClause += ` AND c.tags && $${paramIndex}`
    params.push(tags)
    paramIndex++
  }

  if (status) {
    whereClause += ` AND c.status = $${paramIndex}`
    params.push(status)
    paramIndex++
  }

  if (search) {
    whereClause += ` AND (
      c.first_name ILIKE $${paramIndex} OR
      c.last_name ILIKE $${paramIndex} OR
      c.email ILIKE $${paramIndex} OR
      c.company ILIKE $${paramIndex}
    )`
    params.push(`%${search}%`)
    paramIndex++
  }

  // Get total count
  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM crm_contacts c ${whereClause}`,
    params
  )
  const total = parseInt(countResult.rows[0]?.count || '0', 10)

  // Get contacts with lists
  const allowedSortColumns = ['created_at', 'updated_at', 'first_name', 'last_name', 'email', 'company', 'engagement_score']
  const sortColumn = allowedSortColumns.includes(sortBy) ? sortBy : 'created_at'
  const sortDirection = sortDir === 'asc' ? 'ASC' : 'DESC'

  const result = await query<Contact & { lists: string[] }>(
    `SELECT c.*,
      COALESCE(
        array_agg(cl.list_id) FILTER (WHERE cl.list_id IS NOT NULL),
        '{}'
      ) as lists
    FROM crm_contacts c
    LEFT JOIN crm_contact_lists cl ON c.id = cl.contact_id
    ${whereClause}
    GROUP BY c.id
    ORDER BY c.${sortColumn} ${sortDirection}
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...params, limit, offset]
  )

  return {
    contacts: result.rows,
    total
  }
}

/**
 * Get a single contact by ID
 */
export async function getContact(userId: string, contactId: string): Promise<Contact | null> {
  const result = await query<Contact & { lists: string[] }>(
    `SELECT c.*,
      COALESCE(
        array_agg(cl.list_id) FILTER (WHERE cl.list_id IS NOT NULL),
        '{}'
      ) as lists
    FROM crm_contacts c
    LEFT JOIN crm_contact_lists cl ON c.id = cl.contact_id
    WHERE c.id = $1 AND c.user_id = $2
    GROUP BY c.id`,
    [contactId, userId]
  )
  return result.rows[0] || null
}

/**
 * Update a contact
 */
export async function updateContact(
  userId: string,
  contactId: string,
  data: Partial<Contact>
): Promise<Contact | null> {
  const updates: string[] = []
  const params: any[] = []
  let paramIndex = 1

  const updateableFields = [
    'first_name', 'last_name', 'email', 'phone', 'company', 'title',
    'twitter_handle', 'linkedin_url', 'tags', 'status', 'custom_fields'
  ]

  for (const field of updateableFields) {
    if (data[field as keyof Contact] !== undefined) {
      updates.push(`${field} = $${paramIndex}`)
      params.push(data[field as keyof Contact])
      paramIndex++
    }
  }

  if (updates.length === 0) return null

  params.push(contactId, userId)

  const result = await query<Contact>(
    `UPDATE crm_contacts
    SET ${updates.join(', ')}
    WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
    RETURNING *`,
    params
  )

  return result.rows[0] || null
}

/**
 * Delete a contact
 */
export async function deleteContact(userId: string, contactId: string): Promise<boolean> {
  const result = await query(
    'DELETE FROM crm_contacts WHERE id = $1 AND user_id = $2',
    [contactId, userId]
  )
  return result.rowCount > 0
}

/**
 * Bulk delete contacts
 */
export async function deleteContacts(userId: string, contactIds: string[]): Promise<number> {
  const result = await query(
    'DELETE FROM crm_contacts WHERE id = ANY($1) AND user_id = $2',
    [contactIds, userId]
  )
  return result.rowCount
}

/**
 * Parse CSV data
 */
export function parseCSV(csvText: string, delimiter = ','): string[][] {
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentField = ''
  let inQuotes = false

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i]
    const nextChar = csvText[i + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === delimiter && !inQuotes) {
      currentRow.push(currentField.trim())
      currentField = ''
    } else if ((char === '\n' || (char === '\r' && nextChar === '\n')) && !inQuotes) {
      if (char === '\r') i++
      currentRow.push(currentField.trim())
      if (currentRow.some(f => f)) rows.push(currentRow)
      currentRow = []
      currentField = ''
    } else {
      currentField += char
    }
  }

  // Last field and row
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim())
    if (currentRow.some(f => f)) rows.push(currentRow)
  }

  return rows
}

/**
 * Import contacts from CSV
 */
export async function importContactsFromCSV(
  userId: string,
  csvText: string,
  mapping: CSVImportMapping
): Promise<CSVImportResult> {
  const rows = parseCSV(csvText, mapping.delimiter)

  const headerRow = mapping.hasHeader ? rows[0] : null
  const dataRows = mapping.hasHeader ? rows.slice(1) : rows

  const result: CSVImportResult = {
    total: dataRows.length,
    imported: 0,
    updated: 0,
    skipped: 0,
    errors: []
  }

  // Build field index map
  const fieldMap: Record<string, number> = {}
  for (const col of mapping.columns) {
    if (col.mappedField) {
      const headerIndex = headerRow
        ? headerRow.findIndex(h => h.toLowerCase() === col.header.toLowerCase())
        : mapping.columns.indexOf(col)
      if (headerIndex >= 0) {
        fieldMap[col.mappedField] = headerIndex
      }
    }
  }

  // Process each row
  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i]
    try {
      const contactData: Partial<Contact> = {
        tags: mapping.tags || [],
        source: mapping.source || 'csv_import'
      }

      // Map fields
      for (const [field, index] of Object.entries(fieldMap)) {
        const value = row[index]?.trim()
        if (value) {
          (contactData as any)[field] = value
        }
      }

      // Skip if no email and no phone
      if (!contactData.email && !contactData.phone) {
        result.skipped++
        result.errors.push({
          row: i + (mapping.hasHeader ? 2 : 1),
          message: 'No email or phone provided'
        })
        continue
      }

      // Create/update contact
      const contact = await createContact(userId, contactData)

      // Add to list if specified
      if (mapping.listId) {
        await query(
          `INSERT INTO crm_contact_lists (contact_id, list_id)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING`,
          [contact.id, mapping.listId]
        )
      }

      result.imported++
    } catch (error: any) {
      result.errors.push({
        row: i + (mapping.hasHeader ? 2 : 1),
        message: error.message
      })
    }
  }

  return result
}

// ============ LIST MANAGEMENT ============

/**
 * Create a new list
 */
export async function createList(
  userId: string,
  name: string,
  description?: string
): Promise<ContactList> {
  const result = await query<ContactList>(
    `INSERT INTO crm_lists (user_id, name, description)
    VALUES ($1, $2, $3)
    RETURNING *,
      (SELECT COUNT(*) FROM crm_contact_lists WHERE list_id = crm_lists.id) as contact_count`,
    [userId, name, description || null]
  )
  return result.rows[0]
}

/**
 * Get all lists for a user
 */
export async function getLists(userId: string): Promise<ContactList[]> {
  const result = await query<ContactList>(
    `SELECT l.*,
      (SELECT COUNT(*) FROM crm_contact_lists WHERE list_id = l.id) as contact_count
    FROM crm_lists l
    WHERE l.user_id = $1
    ORDER BY l.created_at DESC`,
    [userId]
  )
  return result.rows
}

/**
 * Add contacts to a list
 */
export async function addContactsToList(
  userId: string,
  listId: string,
  contactIds: string[]
): Promise<number> {
  // Verify list ownership
  const list = await query(
    'SELECT id FROM crm_lists WHERE id = $1 AND user_id = $2',
    [listId, userId]
  )
  if (list.rowCount === 0) throw new Error('List not found')

  // Add contacts
  const result = await query(
    `INSERT INTO crm_contact_lists (contact_id, list_id)
    SELECT c.id, $2
    FROM crm_contacts c
    WHERE c.id = ANY($1) AND c.user_id = $3
    ON CONFLICT DO NOTHING`,
    [contactIds, listId, userId]
  )

  return result.rowCount
}

/**
 * Remove contacts from a list
 */
export async function removeContactsFromList(
  listId: string,
  contactIds: string[]
): Promise<number> {
  const result = await query(
    'DELETE FROM crm_contact_lists WHERE list_id = $1 AND contact_id = ANY($2)',
    [listId, contactIds]
  )
  return result.rowCount
}

/**
 * Delete a list (not the contacts)
 */
export async function deleteList(userId: string, listId: string): Promise<boolean> {
  const result = await query(
    'DELETE FROM crm_lists WHERE id = $1 AND user_id = $2',
    [listId, userId]
  )
  return result.rowCount > 0
}

/**
 * Get distinct tags for a user
 */
export async function getTags(userId: string): Promise<string[]> {
  const result = await query<{ tag: string }>(
    `SELECT DISTINCT unnest(tags) as tag
    FROM crm_contacts
    WHERE user_id = $1
    ORDER BY tag`,
    [userId]
  )
  return result.rows.map(r => r.tag)
}

/**
 * Add tags to contacts
 */
export async function addTagsToContacts(
  userId: string,
  contactIds: string[],
  tags: string[]
): Promise<number> {
  const result = await query(
    `UPDATE crm_contacts
    SET tags = array_cat(tags, $3)
    WHERE id = ANY($1) AND user_id = $2`,
    [contactIds, userId, tags]
  )
  return result.rowCount
}

/**
 * Remove tags from contacts
 */
export async function removeTagsFromContacts(
  userId: string,
  contactIds: string[],
  tags: string[]
): Promise<number> {
  const result = await query(
    `UPDATE crm_contacts
    SET tags = array_remove(tags, unnest($3::text[]))
    WHERE id = ANY($1) AND user_id = $2`,
    [contactIds, userId, tags]
  )
  return result.rowCount
}

/**
 * Get contact stats for dashboard
 */
export async function getContactStats(userId: string): Promise<{
  total: number
  active: number
  unsubscribed: number
  bounced: number
  bySource: Record<string, number>
  recentlyAdded: number
}> {
  const stats = await query<{
    total: string
    active: string
    unsubscribed: string
    bounced: string
    recently_added: string
  }>(
    `SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'active') as active,
      COUNT(*) FILTER (WHERE status = 'unsubscribed') as unsubscribed,
      COUNT(*) FILTER (WHERE status = 'bounced') as bounced,
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as recently_added
    FROM crm_contacts
    WHERE user_id = $1`,
    [userId]
  )

  const sourcesResult = await query<{ source: string; count: string }>(
    `SELECT source, COUNT(*) as count
    FROM crm_contacts
    WHERE user_id = $1 AND source IS NOT NULL
    GROUP BY source`,
    [userId]
  )

  const bySource: Record<string, number> = {}
  for (const row of sourcesResult.rows) {
    bySource[row.source] = parseInt(row.count, 10)
  }

  const s = stats.rows[0]
  return {
    total: parseInt(s?.total || '0', 10),
    active: parseInt(s?.active || '0', 10),
    unsubscribed: parseInt(s?.unsubscribed || '0', 10),
    bounced: parseInt(s?.bounced || '0', 10),
    bySource,
    recentlyAdded: parseInt(s?.recently_added || '0', 10)
  }
}
