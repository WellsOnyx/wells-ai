import { monitorAPI } from '../monitoring'

/**
 * Merge.dev ATS (Applicant Tracking System) Integration
 * Connects Wells AI to HR systems for job postings and applications
 *
 * Supported Systems:
 * - Greenhouse
 * - Lever
 * - Ashby
 * - BambooHR
 * - Workday
 * - JazzHR
 * - Greenhouse Recruiting
 * - iCIMS
 * - SmartRecruiters
 * - And 50+ more ATS platforms
 *
 * Use Case:
 * 1. Companies post jobs from their ATS to Wells AI
 * 2. Job seekers apply through Wells AI
 * 3. Applications automatically sync to company's ATS
 * 4. Two-way sync keeps everything in sync
 */

const MERGE_API_BASE = 'https://api.merge.dev/api'
const MERGE_API_KEY = process.env.MERGE_API_KEY || ''

/**
 * Popular ATS Systems supported by Merge.dev
 */
export const ATSSystems = {
  GREENHOUSE: 'greenhouse',
  LEVER: 'lever',
  ASHBY: 'ashby',
  BAMBOOHR: 'bamboohr',
  WORKDAY: 'workday',
  JAZZHR: 'jazzhr',
  ICIMS: 'icims',
  SMARTRECRUITERS: 'smartrecruiters',
  JOBVITE: 'jobvite',
  GREENHOUSE_RECRUITING: 'greenhouse_recruiting',
  BULLHORN: 'bullhorn',
  TEAMTAILOR: 'teamtailor',
  FOUNTAIN: 'fountain',
  SAP_SUCCESSFACTORS: 'sap_successfactors',
} as const

/**
 * Merge.dev Account Token for ATS integration
 */
export interface MergeATSAccountToken {
  accountToken: string
  integration: string
  organizationName: string
  isActive: boolean
}

/**
 * Job from ATS in Merge.dev format
 */
export interface MergeJob {
  id?: string
  remote_id?: string
  name: string
  description?: string
  code?: string
  status?: 'OPEN' | 'CLOSED' | 'DRAFT' | 'ARCHIVED' | 'PENDING'
  job_posting_urls?: Array<{
    url: string
    type?: string
  }>
  remote_created_at?: string
  remote_updated_at?: string
  confidential?: boolean
  departments?: Array<{
    id?: string
    name?: string
  }>
  offices?: Array<{
    id?: string
    name?: string
    location?: string
  }>
  hiring_managers?: Array<{
    id?: string
    first_name?: string
    last_name?: string
    email?: string
  }>
  recruiters?: Array<{
    id?: string
    first_name?: string
    last_name?: string
    email?: string
  }>
}

/**
 * Candidate/Application in Merge.dev format
 */
export interface MergeApplication {
  id?: string
  remote_id?: string
  candidate: string | MergeCandidate // Can be ID or full candidate object
  job: string // Job ID
  applied_at?: string
  rejected_at?: string
  source?: string
  credited_to?: {
    id?: string
    first_name?: string
    last_name?: string
  }
  current_stage?: {
    id?: string
    name?: string
  }
  reject_reason?: string
  remote_created_at?: string
  remote_updated_at?: string
}

/**
 * Candidate in Merge.dev format
 */
export interface MergeCandidate {
  id?: string
  remote_id?: string
  first_name: string
  last_name: string
  company?: string
  title?: string
  remote_created_at?: string
  remote_updated_at?: string
  last_interaction_at?: string
  is_private?: boolean
  can_email?: boolean
  locations?: string[]
  phone_numbers?: Array<{
    value?: string
    phone_number_type?: 'HOME' | 'WORK' | 'MOBILE' | 'SKYPE' | 'OTHER'
  }>
  email_addresses?: Array<{
    value?: string
    email_address_type?: 'PERSONAL' | 'WORK' | 'OTHER'
  }>
  urls?: Array<{
    value?: string
    url_type?: 'PERSONAL' | 'COMPANY' | 'PORTFOLIO' | 'BLOG' | 'SOCIAL_MEDIA' | 'OTHER'
  }>
  tags?: string[]
  applications?: string[] // Array of application IDs
  attachments?: Array<{
    id?: string
    file_name?: string
    file_url?: string
    attachment_type?: 'RESUME' | 'COVER_LETTER' | 'OFFER_LETTER' | 'OTHER'
  }>
}

/**
 * Employee data from HRIS
 */
export interface MergeEmployee {
  id?: string
  remote_id?: string
  employee_number?: string
  company?: string
  first_name?: string
  last_name?: string
  display_full_name?: string
  work_email?: string
  personal_email?: string
  mobile_phone_number?: string
  employments?: Array<{
    id?: string
    job_title?: string
    pay_rate?: number
    pay_period?: string
    pay_frequency?: string
    pay_currency?: string
    employment_type?: 'FULL_TIME' | 'PART_TIME' | 'INTERN' | 'CONTRACTOR' | 'FREELANCE'
  }>
  home_location?: {
    street_1?: string
    street_2?: string
    city?: string
    state?: string
    zip_code?: string
    country?: string
  }
  work_location?: {
    id?: string
    name?: string
  }
  manager?: {
    id?: string
    first_name?: string
    last_name?: string
  }
  team?: {
    id?: string
    name?: string
  }
  pay_group?: {
    id?: string
    name?: string
  }
  ssn?: string
  gender?: 'MALE' | 'FEMALE' | 'NON-BINARY' | 'OTHER' | 'DECLINE_TO_SELF_IDENTIFY'
  ethnicity?: string
  marital_status?: 'SINGLE' | 'MARRIED' | 'DOMESTIC_PARTNERSHIP' | 'WIDOWED' | 'DECLINE_TO_SELF_IDENTIFY'
  date_of_birth?: string
  hire_date?: string
  start_date?: string
  employment_status?: 'ACTIVE' | 'PENDING' | 'INACTIVE'
  termination_date?: string
  avatar?: string
}

/**
 * List all open jobs from ATS
 */
export async function listJobs(params: {
  accountToken: string
  status?: 'OPEN' | 'CLOSED' | 'DRAFT' | 'ARCHIVED'
  pageSize?: number
}): Promise<MergeJob[]> {
  const monitor = monitorAPI('merge_ats_list_jobs', 'GET')

  try {
    const queryParams = new URLSearchParams()
    if (params.status) {
      queryParams.set('status', params.status)
    }
    if (params.pageSize) {
      queryParams.set('page_size', params.pageSize.toString())
    }

    const url = `${MERGE_API_BASE}/ats/v1/jobs?${queryParams.toString()}`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${MERGE_API_KEY}`,
        'X-Account-Token': params.accountToken,
      },
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('[MERGE ATS] List jobs error:', error)
      throw new Error(`Merge ATS API error: ${error.message || response.statusText}`)
    }

    const result = await response.json()
    monitor.end(true)

    console.log(`[MERGE ATS] Retrieved ${result.results?.length || 0} jobs`)
    return result.results || []
  } catch (error) {
    monitor.end(false)
    console.error('[MERGE ATS] List jobs error:', error)
    throw error
  }
}

/**
 * Get a specific job by ID
 */
export async function getJob(params: {
  accountToken: string
  jobId: string
}): Promise<MergeJob> {
  try {
    const response = await fetch(`${MERGE_API_BASE}/ats/v1/jobs/${params.jobId}`, {
      headers: {
        Authorization: `Bearer ${MERGE_API_KEY}`,
        'X-Account-Token': params.accountToken,
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch job: ${response.statusText}`)
    }

    const result = await response.json()
    return result
  } catch (error) {
    console.error('[MERGE ATS] Get job error:', error)
    throw error
  }
}

/**
 * Create a candidate in the ATS
 */
export async function createCandidate(params: {
  accountToken: string
  candidate: MergeCandidate
}): Promise<any> {
  const monitor = monitorAPI('merge_ats_create_candidate', 'POST')

  try {
    const response = await fetch(`${MERGE_API_BASE}/ats/v1/candidates`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${MERGE_API_KEY}`,
        'X-Account-Token': params.accountToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: params.candidate,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('[MERGE ATS] Create candidate error:', error)
      throw new Error(`Merge ATS API error: ${error.message || response.statusText}`)
    }

    const result = await response.json()
    monitor.end(true)

    console.log('[MERGE ATS] Candidate created:', result.model.id)
    return result.model
  } catch (error) {
    monitor.end(false)
    console.error('[MERGE ATS] Create candidate error:', error)
    throw error
  }
}

/**
 * Create an application (submit candidate to a job)
 */
export async function createApplication(params: {
  accountToken: string
  application: MergeApplication
}): Promise<any> {
  const monitor = monitorAPI('merge_ats_create_application', 'POST')

  try {
    const response = await fetch(`${MERGE_API_BASE}/ats/v1/applications`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${MERGE_API_KEY}`,
        'X-Account-Token': params.accountToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: params.application,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('[MERGE ATS] Create application error:', error)
      throw new Error(`Merge ATS API error: ${error.message || response.statusText}`)
    }

    const result = await response.json()
    monitor.end(true)

    console.log('[MERGE ATS] Application created:', result.model.id)
    return result.model
  } catch (error) {
    monitor.end(false)
    console.error('[MERGE ATS] Create application error:', error)
    throw error
  }
}

/**
 * Get candidate by ID
 */
export async function getCandidate(params: {
  accountToken: string
  candidateId: string
}): Promise<MergeCandidate> {
  try {
    const response = await fetch(`${MERGE_API_BASE}/ats/v1/candidates/${params.candidateId}`, {
      headers: {
        Authorization: `Bearer ${MERGE_API_KEY}`,
        'X-Account-Token': params.accountToken,
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch candidate: ${response.statusText}`)
    }

    const result = await response.json()
    return result
  } catch (error) {
    console.error('[MERGE ATS] Get candidate error:', error)
    throw error
  }
}

/**
 * List applications for a specific job
 */
export async function listApplications(params: {
  accountToken: string
  jobId?: string
  candidateId?: string
  pageSize?: number
}): Promise<MergeApplication[]> {
  try {
    const queryParams = new URLSearchParams()
    if (params.jobId) {
      queryParams.set('job_id', params.jobId)
    }
    if (params.candidateId) {
      queryParams.set('candidate_id', params.candidateId)
    }
    if (params.pageSize) {
      queryParams.set('page_size', params.pageSize.toString())
    }

    const url = `${MERGE_API_BASE}/ats/v1/applications?${queryParams.toString()}`

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${MERGE_API_KEY}`,
        'X-Account-Token': params.accountToken,
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to list applications: ${response.statusText}`)
    }

    const result = await response.json()
    return result.results || []
  } catch (error) {
    console.error('[MERGE ATS] List applications error:', error)
    throw error
  }
}

/**
 * Sync employees from HRIS
 */
export async function syncEmployees(params: {
  accountToken: string
  pageSize?: number
}): Promise<MergeEmployee[]> {
  const monitor = monitorAPI('merge_hris_sync_employees', 'GET')

  try {
    const queryParams = new URLSearchParams()
    if (params.pageSize) {
      queryParams.set('page_size', params.pageSize.toString())
    }

    const url = `${MERGE_API_BASE}/hris/v1/employees?${queryParams.toString()}`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${MERGE_API_KEY}`,
        'X-Account-Token': params.accountToken,
      },
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('[MERGE HRIS] Sync employees error:', error)
      throw new Error(`Merge HRIS API error: ${error.message || response.statusText}`)
    }

    const result = await response.json()
    monitor.end(true)

    console.log(`[MERGE HRIS] Synced ${result.results?.length || 0} employees`)
    return result.results || []
  } catch (error) {
    monitor.end(false)
    console.error('[MERGE HRIS] Sync employees error:', error)
    throw error
  }
}

/**
 * Generate Merge Link Token for ATS connection
 * This creates the OAuth flow for customers to link their ATS
 */
export async function generateATSLinkToken(params: {
  customerId: string
  customerEmail: string
  companyName: string
}): Promise<string> {
  try {
    const response = await fetch(`${MERGE_API_BASE}/ats/v1/link-token`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${MERGE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        end_user_origin_id: params.customerId,
        end_user_email_address: params.customerEmail,
        end_user_organization_name: params.companyName,
        categories: ['ats', 'hris'], // Support both ATS and HRIS
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to generate link token: ${response.statusText}`)
    }

    const result = await response.json()
    return result.link_token
  } catch (error) {
    console.error('[MERGE ATS] Generate link token error:', error)
    throw error
  }
}

/**
 * Get ATS integration info
 */
export async function getATSIntegrationInfo(accountToken: string): Promise<any> {
  try {
    const response = await fetch(`${MERGE_API_BASE}/ats/v1/account-details`, {
      headers: {
        Authorization: `Bearer ${MERGE_API_KEY}`,
        'X-Account-Token': accountToken,
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to get integration info: ${response.statusText}`)
    }

    const result = await response.json()
    return result
  } catch (error) {
    console.error('[MERGE ATS] Get integration info error:', error)
    throw error
  }
}

/**
 * Convert Wells AI job seeker application to Merge ATS format
 */
export function convertToATSApplication(params: {
  jobSeeker: {
    firstName: string
    lastName: string
    email: string
    phone?: string
    resumeUrl?: string
    coverLetterUrl?: string
    linkedin?: string
    portfolio?: string
    currentCompany?: string
    currentTitle?: string
  }
  jobId: string
  source?: string
}): { candidate: MergeCandidate; application: Partial<MergeApplication> } {
  const candidate: MergeCandidate = {
    first_name: params.jobSeeker.firstName,
    last_name: params.jobSeeker.lastName,
    company: params.jobSeeker.currentCompany,
    title: params.jobSeeker.currentTitle,
    can_email: true,
    email_addresses: [
      {
        value: params.jobSeeker.email,
        email_address_type: 'PERSONAL',
      },
    ],
    phone_numbers: params.jobSeeker.phone
      ? [
          {
            value: params.jobSeeker.phone,
            phone_number_type: 'MOBILE',
          },
        ]
      : [],
    urls: [],
    attachments: [],
  }

  // Add URLs
  if (params.jobSeeker.linkedin) {
    candidate.urls?.push({
      value: params.jobSeeker.linkedin,
      url_type: 'SOCIAL_MEDIA',
    })
  }

  if (params.jobSeeker.portfolio) {
    candidate.urls?.push({
      value: params.jobSeeker.portfolio,
      url_type: 'PORTFOLIO',
    })
  }

  // Add attachments
  if (params.jobSeeker.resumeUrl) {
    candidate.attachments?.push({
      file_url: params.jobSeeker.resumeUrl,
      attachment_type: 'RESUME',
    })
  }

  if (params.jobSeeker.coverLetterUrl) {
    candidate.attachments?.push({
      file_url: params.jobSeeker.coverLetterUrl,
      attachment_type: 'COVER_LETTER',
    })
  }

  const application: Partial<MergeApplication> = {
    job: params.jobId,
    applied_at: new Date().toISOString(),
    source: params.source || 'Wells AI',
  }

  return { candidate, application }
}

/**
 * Health check - verify Merge.dev ATS connection
 */
export async function checkATSConnection(): Promise<boolean> {
  try {
    const response = await fetch(`${MERGE_API_BASE}/ats/v1/integrations`, {
      headers: {
        Authorization: `Bearer ${MERGE_API_KEY}`,
      },
    })

    return response.ok
  } catch (error) {
    console.error('[MERGE ATS] Connection check failed:', error)
    return false
  }
}
