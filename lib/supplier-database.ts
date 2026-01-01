/**
 * Supplier Database Engine
 *
 * Comprehensive supplier management with industry codes (NAICS/SIC)
 * for targeted outreach and "sneaky" buyer attraction through seller onboarding
 */

import { sql } from '@vercel/postgres'

// ============================================================================
// TYPES
// ============================================================================

export interface NAICSCode {
  code: string
  title: string
  description?: string
  sectorCode: string
  sectorName: string
  subsectorCode?: string
  subsectorName?: string
  industryGroupCode?: string
  industryGroupName?: string
}

export interface SICCode {
  code: string
  title: string
  description?: string
  division: string
  divisionName: string
  majorGroup?: string
  majorGroupName?: string
}

export interface Supplier {
  id: string
  companyName: string
  contactEmail: string
  phone?: string
  website?: string

  // Industry classification
  primaryNaicsCode?: string
  secondaryNaicsCodes?: string[]
  sicCodes?: string[]

  // Business identifiers
  dunsNumber?: string
  cageCode?: string
  samUei?: string
  ein?: string

  // Location
  headquartersCity?: string
  headquartersState?: string
  headquartersCountry?: string
  serviceRegions?: string[]
  canShipInternationally?: boolean

  // Business metrics
  employeeCountRange?: string
  annualRevenueRange?: string
  yearsInBusiness?: number
  foundedYear?: number

  // Diversity certifications
  isSmallBusiness?: boolean
  isMinorityOwned?: boolean
  isWomanOwned?: boolean
  isVeteranOwned?: boolean
  isServiceDisabledVeteran?: boolean
  is8aCertified?: boolean
  isHubzone?: boolean
  isLgbtqOwned?: boolean

  // Products & capabilities
  products: string[]
  certifications?: string[]

  // Status
  status: 'pending' | 'active' | 'paused' | 'rejected'
  inviteStatus: 'not_invited' | 'invited' | 'opened' | 'clicked' | 'registered' | 'declined'

  // Tracking
  source?: string
  sourceUrl?: string
  trustScore?: number
  profileCompleteness?: number
  isVerified?: boolean

  createdAt: Date
  updatedAt: Date
}

export interface SupplierCampaign {
  id: string
  name: string
  description?: string

  // Targeting
  targetNaicsCodes?: string[]
  targetSicCodes?: string[]
  targetStates?: string[]
  targetEmployeeRanges?: string[]
  targetRevenueRanges?: string[]
  targetCertifications?: string[]
  targetDiversities?: string[]

  // Content
  emailSubject?: string
  emailTemplate?: string
  smsTemplate?: string
  linkedinMessage?: string
  headline?: string
  benefits?: string[]
  ctaText?: string

  // Status
  status: 'draft' | 'active' | 'paused' | 'completed'
  scheduledStart?: Date
  scheduledEnd?: Date

  // Metrics
  totalTargeted: number
  totalInvited: number
  totalOpened: number
  totalClicked: number
  totalRegistered: number
  conversionRate: number

  createdAt: Date
}

export interface SupplierInvite {
  id: string
  supplierId: string
  campaignId?: string
  inviteCode: string
  inviteUrl: string
  personalizedMessage?: string
  valueProp?: string
  status: 'pending' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'registered' | 'bounced'
  channel: 'email' | 'sms' | 'linkedin' | 'phone'
  sentAt?: Date
  openedAt?: Date
  clickedAt?: Date
  registeredAt?: Date
  openCount: number
  clickCount: number
  createdAt: Date
}

// ============================================================================
// INDUSTRY CODES
// ============================================================================

/**
 * Get all NAICS sectors (2-digit codes)
 */
export async function getNAICSSectors(): Promise<NAICSCode[]> {
  try {
    const result = await sql`
      SELECT DISTINCT
        code,
        title,
        description,
        sector_code,
        sector_name
      FROM naics_codes
      WHERE LENGTH(code) = 2
      ORDER BY code
    `

    return result.rows.map(row => ({
      code: row.code,
      title: row.title,
      description: row.description,
      sectorCode: row.sector_code,
      sectorName: row.sector_name
    }))
  } catch (error) {
    console.error('Error fetching NAICS sectors:', error)
    return []
  }
}

/**
 * Get NAICS codes by sector
 */
export async function getNAICSBySecter(sectorCode: string): Promise<NAICSCode[]> {
  try {
    const result = await sql`
      SELECT *
      FROM naics_codes
      WHERE sector_code = ${sectorCode}
      ORDER BY code
    `

    return result.rows.map(row => ({
      code: row.code,
      title: row.title,
      description: row.description,
      sectorCode: row.sector_code,
      sectorName: row.sector_name,
      subsectorCode: row.subsector_code,
      subsectorName: row.subsector_name,
      industryGroupCode: row.industry_group_code,
      industryGroupName: row.industry_group_name
    }))
  } catch (error) {
    console.error('Error fetching NAICS by sector:', error)
    return []
  }
}

/**
 * Search NAICS codes by keyword
 */
export async function searchNAICS(query: string): Promise<NAICSCode[]> {
  try {
    const searchTerm = `%${query.toLowerCase()}%`
    const result = await sql`
      SELECT *
      FROM naics_codes
      WHERE LOWER(title) LIKE ${searchTerm}
         OR LOWER(description) LIKE ${searchTerm}
         OR code LIKE ${searchTerm}
      ORDER BY code
      LIMIT 50
    `

    return result.rows.map(row => ({
      code: row.code,
      title: row.title,
      description: row.description,
      sectorCode: row.sector_code,
      sectorName: row.sector_name
    }))
  } catch (error) {
    console.error('Error searching NAICS:', error)
    return []
  }
}

/**
 * Get SIC divisions
 */
export async function getSICDivisions(): Promise<SICCode[]> {
  try {
    const result = await sql`
      SELECT DISTINCT
        division,
        division_name
      FROM sic_codes
      ORDER BY division
    `

    return result.rows.map(row => ({
      code: row.division,
      title: row.division_name,
      division: row.division,
      divisionName: row.division_name
    }))
  } catch (error) {
    console.error('Error fetching SIC divisions:', error)
    return []
  }
}

/**
 * Search SIC codes
 */
export async function searchSIC(query: string): Promise<SICCode[]> {
  try {
    const searchTerm = `%${query.toLowerCase()}%`
    const result = await sql`
      SELECT *
      FROM sic_codes
      WHERE LOWER(title) LIKE ${searchTerm}
         OR code LIKE ${searchTerm}
      ORDER BY code
      LIMIT 50
    `

    return result.rows.map(row => ({
      code: row.code,
      title: row.title,
      description: row.description,
      division: row.division,
      divisionName: row.division_name,
      majorGroup: row.major_group,
      majorGroupName: row.major_group_name
    }))
  } catch (error) {
    console.error('Error searching SIC:', error)
    return []
  }
}

// ============================================================================
// SUPPLIER MANAGEMENT
// ============================================================================

/**
 * Add a new supplier to the database
 */
export async function addSupplier(supplier: Partial<Supplier>): Promise<Supplier | null> {
  try {
    const result = await sql`
      INSERT INTO suppliers (
        company_name,
        contact_email,
        phone,
        website,
        primary_naics_code,
        secondary_naics_codes,
        sic_codes,
        duns_number,
        cage_code,
        sam_uei,
        ein,
        headquarters_city,
        headquarters_state,
        headquarters_country,
        service_regions,
        can_ship_internationally,
        employee_count_range,
        annual_revenue_range,
        years_in_business,
        founded_year,
        is_small_business,
        is_minority_owned,
        is_woman_owned,
        is_veteran_owned,
        is_service_disabled_veteran,
        is_8a_certified,
        is_hubzone,
        is_lgbtq_owned,
        products,
        certifications,
        source,
        source_url,
        status,
        invite_status
      ) VALUES (
        ${supplier.companyName},
        ${supplier.contactEmail},
        ${supplier.phone || null},
        ${supplier.website || null},
        ${supplier.primaryNaicsCode || null},
        ${supplier.secondaryNaicsCodes || []},
        ${supplier.sicCodes || []},
        ${supplier.dunsNumber || null},
        ${supplier.cageCode || null},
        ${supplier.samUei || null},
        ${supplier.ein || null},
        ${supplier.headquartersCity || null},
        ${supplier.headquartersState || null},
        ${supplier.headquartersCountry || 'USA'},
        ${supplier.serviceRegions || []},
        ${supplier.canShipInternationally || false},
        ${supplier.employeeCountRange || null},
        ${supplier.annualRevenueRange || null},
        ${supplier.yearsInBusiness || null},
        ${supplier.foundedYear || null},
        ${supplier.isSmallBusiness || false},
        ${supplier.isMinorityOwned || false},
        ${supplier.isWomanOwned || false},
        ${supplier.isVeteranOwned || false},
        ${supplier.isServiceDisabledVeteran || false},
        ${supplier.is8aCertified || false},
        ${supplier.isHubzone || false},
        ${supplier.isLgbtqOwned || false},
        ${supplier.products || []},
        ${supplier.certifications || []},
        ${supplier.source || 'manual'},
        ${supplier.sourceUrl || null},
        'pending',
        'not_invited'
      )
      RETURNING *
    `

    return mapSupplierRow(result.rows[0])
  } catch (error) {
    console.error('Error adding supplier:', error)
    return null
  }
}

/**
 * Bulk import suppliers
 */
export async function bulkImportSuppliers(suppliers: Partial<Supplier>[], source: string): Promise<{
  imported: number
  failed: number
  errors: string[]
}> {
  let imported = 0
  let failed = 0
  const errors: string[] = []

  for (const supplier of suppliers) {
    try {
      const result = await addSupplier({
        ...supplier,
        source
      })

      if (result) {
        imported++
      } else {
        failed++
        errors.push(`Failed to import: ${supplier.companyName}`)
      }
    } catch (error: any) {
      failed++
      errors.push(`${supplier.companyName}: ${error.message}`)
    }
  }

  return { imported, failed, errors }
}

/**
 * Search suppliers with filters
 */
export async function searchSuppliers(filters: {
  query?: string
  naicsCodes?: string[]
  sicCodes?: string[]
  states?: string[]
  status?: string
  inviteStatus?: string
  diversities?: string[]
  employeeRanges?: string[]
  revenueRanges?: string[]
  limit?: number
  offset?: number
}): Promise<{ suppliers: Supplier[]; total: number }> {
  try {
    let whereClause = 'WHERE 1=1'
    const params: any[] = []
    let paramIndex = 1

    if (filters.query) {
      whereClause += ` AND (
        LOWER(company_name) LIKE $${paramIndex}
        OR LOWER(contact_email) LIKE $${paramIndex}
        OR $${paramIndex + 1} = ANY(ARRAY(SELECT LOWER(unnest(products))))
      )`
      params.push(`%${filters.query.toLowerCase()}%`, filters.query.toLowerCase())
      paramIndex += 2
    }

    if (filters.naicsCodes?.length) {
      whereClause += ` AND (
        primary_naics_code = ANY($${paramIndex})
        OR secondary_naics_codes && $${paramIndex}
      )`
      params.push(filters.naicsCodes)
      paramIndex++
    }

    if (filters.sicCodes?.length) {
      whereClause += ` AND sic_codes && $${paramIndex}`
      params.push(filters.sicCodes)
      paramIndex++
    }

    if (filters.states?.length) {
      whereClause += ` AND headquarters_state = ANY($${paramIndex})`
      params.push(filters.states)
      paramIndex++
    }

    if (filters.status) {
      whereClause += ` AND status = $${paramIndex}`
      params.push(filters.status)
      paramIndex++
    }

    if (filters.inviteStatus) {
      whereClause += ` AND invite_status = $${paramIndex}`
      params.push(filters.inviteStatus)
      paramIndex++
    }

    if (filters.diversities?.length) {
      const diversityConditions = filters.diversities.map(d => {
        switch (d) {
          case 'minority_owned': return 'is_minority_owned = TRUE'
          case 'woman_owned': return 'is_woman_owned = TRUE'
          case 'veteran_owned': return 'is_veteran_owned = TRUE'
          case 'small_business': return 'is_small_business = TRUE'
          case '8a_certified': return 'is_8a_certified = TRUE'
          case 'hubzone': return 'is_hubzone = TRUE'
          default: return null
        }
      }).filter(Boolean)

      if (diversityConditions.length) {
        whereClause += ` AND (${diversityConditions.join(' OR ')})`
      }
    }

    if (filters.employeeRanges?.length) {
      whereClause += ` AND employee_count_range = ANY($${paramIndex})`
      params.push(filters.employeeRanges)
      paramIndex++
    }

    if (filters.revenueRanges?.length) {
      whereClause += ` AND annual_revenue_range = ANY($${paramIndex})`
      params.push(filters.revenueRanges)
      paramIndex++
    }

    const limit = filters.limit || 50
    const offset = filters.offset || 0

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM suppliers ${whereClause}`
    // Note: Using raw query for complex filtering
    const countResult = await sql.query(countQuery, params)
    const total = parseInt(countResult.rows[0].count, 10)

    // Get suppliers
    const dataQuery = `
      SELECT * FROM suppliers
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `
    const dataResult = await sql.query(dataQuery, params)

    return {
      suppliers: dataResult.rows.map(mapSupplierRow),
      total
    }
  } catch (error) {
    console.error('Error searching suppliers:', error)
    return { suppliers: [], total: 0 }
  }
}

/**
 * Get supplier by ID
 */
export async function getSupplier(id: string): Promise<Supplier | null> {
  try {
    const result = await sql`
      SELECT * FROM suppliers WHERE id = ${id}
    `

    if (result.rows.length === 0) return null
    return mapSupplierRow(result.rows[0])
  } catch (error) {
    console.error('Error fetching supplier:', error)
    return null
  }
}

/**
 * Update supplier
 */
export async function updateSupplier(id: string, updates: Partial<Supplier>): Promise<Supplier | null> {
  try {
    const result = await sql`
      UPDATE suppliers SET
        company_name = COALESCE(${updates.companyName}, company_name),
        contact_email = COALESCE(${updates.contactEmail}, contact_email),
        phone = COALESCE(${updates.phone}, phone),
        website = COALESCE(${updates.website}, website),
        primary_naics_code = COALESCE(${updates.primaryNaicsCode}, primary_naics_code),
        headquarters_state = COALESCE(${updates.headquartersState}, headquarters_state),
        headquarters_city = COALESCE(${updates.headquartersCity}, headquarters_city),
        status = COALESCE(${updates.status}, status),
        invite_status = COALESCE(${updates.inviteStatus}, invite_status),
        is_verified = COALESCE(${updates.isVerified}, is_verified),
        trust_score = COALESCE(${updates.trustScore}, trust_score),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `

    if (result.rows.length === 0) return null
    return mapSupplierRow(result.rows[0])
  } catch (error) {
    console.error('Error updating supplier:', error)
    return null
  }
}

// ============================================================================
// CAMPAIGNS & INVITES
// ============================================================================

/**
 * Create an outreach campaign
 */
export async function createCampaign(campaign: Partial<SupplierCampaign>): Promise<SupplierCampaign | null> {
  try {
    const result = await sql`
      INSERT INTO supplier_campaigns (
        name,
        description,
        target_naics_codes,
        target_sic_codes,
        target_states,
        target_employee_ranges,
        target_revenue_ranges,
        target_certifications,
        target_diversities,
        email_subject,
        email_template,
        sms_template,
        linkedin_message,
        headline,
        benefits,
        cta_text,
        status
      ) VALUES (
        ${campaign.name},
        ${campaign.description || null},
        ${campaign.targetNaicsCodes || []},
        ${campaign.targetSicCodes || []},
        ${campaign.targetStates || []},
        ${campaign.targetEmployeeRanges || []},
        ${campaign.targetRevenueRanges || []},
        ${campaign.targetCertifications || []},
        ${campaign.targetDiversities || []},
        ${campaign.emailSubject || null},
        ${campaign.emailTemplate || null},
        ${campaign.smsTemplate || null},
        ${campaign.linkedinMessage || null},
        ${campaign.headline || null},
        ${campaign.benefits || []},
        ${campaign.ctaText || 'Join Wells AI'},
        'draft'
      )
      RETURNING *
    `

    return mapCampaignRow(result.rows[0])
  } catch (error) {
    console.error('Error creating campaign:', error)
    return null
  }
}

/**
 * Get suppliers matching campaign criteria
 */
export async function getCampaignTargets(campaignId: string): Promise<Supplier[]> {
  try {
    const campaign = await sql`
      SELECT * FROM supplier_campaigns WHERE id = ${campaignId}
    `

    if (campaign.rows.length === 0) return []

    const c = campaign.rows[0]

    const { suppliers } = await searchSuppliers({
      naicsCodes: c.target_naics_codes,
      sicCodes: c.target_sic_codes,
      states: c.target_states,
      employeeRanges: c.target_employee_ranges,
      revenueRanges: c.target_revenue_ranges,
      diversities: c.target_diversities,
      inviteStatus: 'not_invited',
      limit: 1000
    })

    return suppliers
  } catch (error) {
    console.error('Error getting campaign targets:', error)
    return []
  }
}

/**
 * Generate unique invite code
 */
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

/**
 * Create invite for a supplier
 */
export async function createSupplierInvite(
  supplierId: string,
  campaignId?: string,
  personalizedMessage?: string
): Promise<SupplierInvite | null> {
  try {
    const inviteCode = generateInviteCode()
    const inviteUrl = `https://wellsai.com/join?ref=${inviteCode}`

    const result = await sql`
      INSERT INTO supplier_invites (
        supplier_id,
        campaign_id,
        invite_code,
        invite_url,
        personalized_message,
        status,
        channel,
        expires_at
      ) VALUES (
        ${supplierId},
        ${campaignId || null},
        ${inviteCode},
        ${inviteUrl},
        ${personalizedMessage || null},
        'pending',
        'email',
        NOW() + INTERVAL '30 days'
      )
      RETURNING *
    `

    // Update supplier status
    await sql`
      UPDATE suppliers SET
        invite_status = 'invited',
        invite_sent_at = NOW()
      WHERE id = ${supplierId}
    `

    return mapInviteRow(result.rows[0])
  } catch (error) {
    console.error('Error creating invite:', error)
    return null
  }
}

/**
 * Track invite open
 */
export async function trackInviteOpen(inviteCode: string): Promise<void> {
  try {
    await sql`
      UPDATE supplier_invites SET
        status = 'opened',
        opened_at = COALESCE(opened_at, NOW()),
        open_count = open_count + 1
      WHERE invite_code = ${inviteCode}
    `

    // Update supplier
    await sql`
      UPDATE suppliers SET
        invite_status = 'opened',
        invite_opened_at = NOW()
      WHERE id = (SELECT supplier_id FROM supplier_invites WHERE invite_code = ${inviteCode})
    `

    // Update campaign metrics
    await sql`
      UPDATE supplier_campaigns SET
        total_opened = total_opened + 1
      WHERE id = (SELECT campaign_id FROM supplier_invites WHERE invite_code = ${inviteCode})
    `
  } catch (error) {
    console.error('Error tracking invite open:', error)
  }
}

/**
 * Track invite click
 */
export async function trackInviteClick(inviteCode: string): Promise<void> {
  try {
    await sql`
      UPDATE supplier_invites SET
        status = 'clicked',
        clicked_at = COALESCE(clicked_at, NOW()),
        click_count = click_count + 1
      WHERE invite_code = ${inviteCode}
    `

    await sql`
      UPDATE suppliers SET
        invite_status = 'clicked',
        invite_clicked_at = NOW()
      WHERE id = (SELECT supplier_id FROM supplier_invites WHERE invite_code = ${inviteCode})
    `

    await sql`
      UPDATE supplier_campaigns SET
        total_clicked = total_clicked + 1
      WHERE id = (SELECT campaign_id FROM supplier_invites WHERE invite_code = ${inviteCode})
    `
  } catch (error) {
    console.error('Error tracking invite click:', error)
  }
}

/**
 * Track invite registration
 */
export async function trackInviteRegistration(inviteCode: string, userId: string): Promise<void> {
  try {
    await sql`
      UPDATE supplier_invites SET
        status = 'registered',
        registered_at = NOW(),
        registered_user_id = ${userId}
      WHERE invite_code = ${inviteCode}
    `

    await sql`
      UPDATE suppliers SET
        invite_status = 'registered',
        invite_registered_at = NOW(),
        status = 'active'
      WHERE id = (SELECT supplier_id FROM supplier_invites WHERE invite_code = ${inviteCode})
    `

    await sql`
      UPDATE supplier_campaigns SET
        total_registered = total_registered + 1,
        conversion_rate = CASE
          WHEN total_invited > 0 THEN (total_registered + 1)::DECIMAL / total_invited * 100
          ELSE 0
        END
      WHERE id = (SELECT campaign_id FROM supplier_invites WHERE invite_code = ${inviteCode})
    `
  } catch (error) {
    console.error('Error tracking registration:', error)
  }
}

// ============================================================================
// STATISTICS
// ============================================================================

/**
 * Get supplier database statistics
 */
export async function getSupplierStats(): Promise<{
  totalSuppliers: number
  byStatus: Record<string, number>
  byInviteStatus: Record<string, number>
  byIndustry: { code: string; name: string; count: number }[]
  byState: { state: string; count: number }[]
  diversityBreakdown: Record<string, number>
  conversionFunnel: {
    notInvited: number
    invited: number
    opened: number
    clicked: number
    registered: number
  }
}> {
  try {
    // Total count
    const totalResult = await sql`SELECT COUNT(*) FROM suppliers`
    const totalSuppliers = parseInt(totalResult.rows[0].count, 10)

    // By status
    const statusResult = await sql`
      SELECT status, COUNT(*) as count
      FROM suppliers
      GROUP BY status
    `
    const byStatus: Record<string, number> = {}
    statusResult.rows.forEach(row => {
      byStatus[row.status] = parseInt(row.count, 10)
    })

    // By invite status
    const inviteResult = await sql`
      SELECT invite_status, COUNT(*) as count
      FROM suppliers
      GROUP BY invite_status
    `
    const byInviteStatus: Record<string, number> = {}
    inviteResult.rows.forEach(row => {
      byInviteStatus[row.invite_status] = parseInt(row.count, 10)
    })

    // By industry (top 10)
    const industryResult = await sql`
      SELECT
        s.primary_naics_code as code,
        COALESCE(n.title, 'Unknown') as name,
        COUNT(*) as count
      FROM suppliers s
      LEFT JOIN naics_codes n ON s.primary_naics_code = n.code
      WHERE s.primary_naics_code IS NOT NULL
      GROUP BY s.primary_naics_code, n.title
      ORDER BY count DESC
      LIMIT 10
    `
    const byIndustry = industryResult.rows.map(row => ({
      code: row.code,
      name: row.name,
      count: parseInt(row.count, 10)
    }))

    // By state (top 10)
    const stateResult = await sql`
      SELECT headquarters_state as state, COUNT(*) as count
      FROM suppliers
      WHERE headquarters_state IS NOT NULL
      GROUP BY headquarters_state
      ORDER BY count DESC
      LIMIT 10
    `
    const byState = stateResult.rows.map(row => ({
      state: row.state,
      count: parseInt(row.count, 10)
    }))

    // Diversity breakdown
    const diversityResult = await sql`
      SELECT
        SUM(CASE WHEN is_small_business THEN 1 ELSE 0 END) as small_business,
        SUM(CASE WHEN is_minority_owned THEN 1 ELSE 0 END) as minority_owned,
        SUM(CASE WHEN is_woman_owned THEN 1 ELSE 0 END) as woman_owned,
        SUM(CASE WHEN is_veteran_owned THEN 1 ELSE 0 END) as veteran_owned,
        SUM(CASE WHEN is_8a_certified THEN 1 ELSE 0 END) as certified_8a,
        SUM(CASE WHEN is_hubzone THEN 1 ELSE 0 END) as hubzone
      FROM suppliers
    `
    const diversityBreakdown: Record<string, number> = {
      smallBusiness: parseInt(diversityResult.rows[0].small_business || 0, 10),
      minorityOwned: parseInt(diversityResult.rows[0].minority_owned || 0, 10),
      womanOwned: parseInt(diversityResult.rows[0].woman_owned || 0, 10),
      veteranOwned: parseInt(diversityResult.rows[0].veteran_owned || 0, 10),
      certified8a: parseInt(diversityResult.rows[0].certified_8a || 0, 10),
      hubzone: parseInt(diversityResult.rows[0].hubzone || 0, 10)
    }

    // Conversion funnel
    const conversionFunnel = {
      notInvited: byInviteStatus['not_invited'] || 0,
      invited: byInviteStatus['invited'] || 0,
      opened: byInviteStatus['opened'] || 0,
      clicked: byInviteStatus['clicked'] || 0,
      registered: byInviteStatus['registered'] || 0
    }

    return {
      totalSuppliers,
      byStatus,
      byInviteStatus,
      byIndustry,
      byState,
      diversityBreakdown,
      conversionFunnel
    }
  } catch (error) {
    console.error('Error fetching supplier stats:', error)
    return {
      totalSuppliers: 0,
      byStatus: {},
      byInviteStatus: {},
      byIndustry: [],
      byState: [],
      diversityBreakdown: {},
      conversionFunnel: {
        notInvited: 0,
        invited: 0,
        opened: 0,
        clicked: 0,
        registered: 0
      }
    }
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function mapSupplierRow(row: any): Supplier {
  return {
    id: row.id,
    companyName: row.company_name,
    contactEmail: row.contact_email,
    phone: row.phone,
    website: row.website,
    primaryNaicsCode: row.primary_naics_code,
    secondaryNaicsCodes: row.secondary_naics_codes,
    sicCodes: row.sic_codes,
    dunsNumber: row.duns_number,
    cageCode: row.cage_code,
    samUei: row.sam_uei,
    ein: row.ein,
    headquartersCity: row.headquarters_city,
    headquartersState: row.headquarters_state,
    headquartersCountry: row.headquarters_country,
    serviceRegions: row.service_regions,
    canShipInternationally: row.can_ship_internationally,
    employeeCountRange: row.employee_count_range,
    annualRevenueRange: row.annual_revenue_range,
    yearsInBusiness: row.years_in_business,
    foundedYear: row.founded_year,
    isSmallBusiness: row.is_small_business,
    isMinorityOwned: row.is_minority_owned,
    isWomanOwned: row.is_woman_owned,
    isVeteranOwned: row.is_veteran_owned,
    isServiceDisabledVeteran: row.is_service_disabled_veteran,
    is8aCertified: row.is_8a_certified,
    isHubzone: row.is_hubzone,
    isLgbtqOwned: row.is_lgbtq_owned,
    products: row.products || [],
    certifications: row.certifications,
    status: row.status,
    inviteStatus: row.invite_status || 'not_invited',
    source: row.source,
    sourceUrl: row.source_url,
    trustScore: row.trust_score,
    profileCompleteness: row.profile_completeness,
    isVerified: row.is_verified,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  }
}

function mapCampaignRow(row: any): SupplierCampaign {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    targetNaicsCodes: row.target_naics_codes,
    targetSicCodes: row.target_sic_codes,
    targetStates: row.target_states,
    targetEmployeeRanges: row.target_employee_ranges,
    targetRevenueRanges: row.target_revenue_ranges,
    targetCertifications: row.target_certifications,
    targetDiversities: row.target_diversities,
    emailSubject: row.email_subject,
    emailTemplate: row.email_template,
    smsTemplate: row.sms_template,
    linkedinMessage: row.linkedin_message,
    headline: row.headline,
    benefits: row.benefits,
    ctaText: row.cta_text,
    status: row.status,
    scheduledStart: row.scheduled_start ? new Date(row.scheduled_start) : undefined,
    scheduledEnd: row.scheduled_end ? new Date(row.scheduled_end) : undefined,
    totalTargeted: row.total_targeted || 0,
    totalInvited: row.total_invited || 0,
    totalOpened: row.total_opened || 0,
    totalClicked: row.total_clicked || 0,
    totalRegistered: row.total_registered || 0,
    conversionRate: parseFloat(row.conversion_rate || 0),
    createdAt: new Date(row.created_at)
  }
}

function mapInviteRow(row: any): SupplierInvite {
  return {
    id: row.id,
    supplierId: row.supplier_id,
    campaignId: row.campaign_id,
    inviteCode: row.invite_code,
    inviteUrl: row.invite_url,
    personalizedMessage: row.personalized_message,
    valueProp: row.value_prop,
    status: row.status,
    channel: row.channel,
    sentAt: row.sent_at ? new Date(row.sent_at) : undefined,
    openedAt: row.opened_at ? new Date(row.opened_at) : undefined,
    clickedAt: row.clicked_at ? new Date(row.clicked_at) : undefined,
    registeredAt: row.registered_at ? new Date(row.registered_at) : undefined,
    openCount: row.open_count || 0,
    clickCount: row.click_count || 0,
    createdAt: new Date(row.created_at)
  }
}
