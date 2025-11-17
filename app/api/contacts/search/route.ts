import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import {
  formatSearchResults,
  type ContactResult,
  type SearchResults
} from '@/lib/contacts/response-formatter'

interface SearchParams {
  query?: string
  firstName?: string
  lastName?: string
  email?: string
  title?: string
  company?: string
  location?: string
  industry?: string
  seniority?: string
  companySize?: string
  page?: number
  limit?: number
  sortBy?: 'name' | 'title' | 'company' | 'createdAt'
  sortOrder?: 'asc' | 'desc'
}

interface SearchResult {
  success: boolean
  contacts: any[]
  total: number
  page: number
  limit: number
  totalPages: number
  message?: string
}

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100

/**
 * Build fuzzy search condition for text fields
 */
function buildFuzzySearch(field: string, value: string): Prisma.StringFilter {
  return {
    contains: value,
    mode: 'insensitive' as Prisma.QueryMode
  }
}

/**
 * Contact Search API
 * GET/POST /api/contacts/search
 *
 * Features:
 * - Natural language query support
 * - Multi-field filtering (firstName, lastName, email, title, company, location)
 * - Fuzzy matching for names/companies
 * - Pagination (50 results per page)
 * - Sort options (name, title, company, createdAt)
 * - User isolation
 */
async function handleSearch(request: NextRequest, body?: any) {
  try {
    // Authenticate user
    const authResult = await auth()
    const userId = authResult.userId

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', contacts: [], total: 0 },
        { status: 401 }
      )
    }

    // Parse search params - support both GET (query params) and POST (body)
    let query, firstName, lastName, email, title, company, location, industry, seniority, companySize
    let page, limit, sortBy, sortOrder

    if (body) {
      // POST request with body
      query = body.query
      firstName = body.firstName || body.filters?.firstName
      lastName = body.lastName || body.filters?.lastName
      email = body.email || body.filters?.email
      title = body.title || body.filters?.title || (body.filters?.titles ? body.filters.titles[0] : undefined)
      company = body.company || body.filters?.company || (body.filters?.companies ? body.filters.companies[0] : undefined)
      location = body.location || body.filters?.location || (body.filters?.locations ? body.filters.locations[0] : undefined)
      industry = body.industry || body.filters?.industry || (body.filters?.industries ? body.filters.industries[0] : undefined)
      seniority = body.seniority || body.filters?.seniority
      companySize = body.companySize || body.filters?.companySize

      page = Math.max(1, parseInt(body.page || '1'))
      limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(body.limit || String(DEFAULT_LIMIT))))
      sortBy = (body.sortBy || 'createdAt') as SearchParams['sortBy']
      sortOrder = (body.sortOrder || 'desc') as SearchParams['sortOrder']
    } else {
      // GET request with query params
      const searchParams = request.nextUrl.searchParams

      query = searchParams.get('query') || undefined
      firstName = searchParams.get('firstName') || undefined
      lastName = searchParams.get('lastName') || undefined
      email = searchParams.get('email') || undefined
      title = searchParams.get('title') || undefined
      company = searchParams.get('company') || undefined
      location = searchParams.get('location') || undefined
      industry = searchParams.get('industry') || undefined
      seniority = searchParams.get('seniority') || undefined
      companySize = searchParams.get('companySize') || undefined

      page = Math.max(1, parseInt(searchParams.get('page') || '1'))
      limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT))))
      sortBy = (searchParams.get('sortBy') || 'createdAt') as SearchParams['sortBy']
      sortOrder = (searchParams.get('sortOrder') || 'desc') as SearchParams['sortOrder']
    }

    // Build where clause
    const where: Prisma.ContactWhereInput = {
      userId, // User isolation
      AND: []
    }

    const andConditions: Prisma.ContactWhereInput[] = []

    // Natural language query - search across multiple fields
    if (query) {
      andConditions.push({
        OR: [
          { firstName: buildFuzzySearch('firstName', query) },
          { lastName: buildFuzzySearch('lastName', query) },
          { email: buildFuzzySearch('email', query) },
          { company: buildFuzzySearch('company', query) },
          { title: buildFuzzySearch('title', query) },
          { location: buildFuzzySearch('location', query) }
        ]
      })
    }

    // Specific field filters
    if (firstName) {
      andConditions.push({ firstName: buildFuzzySearch('firstName', firstName) })
    }

    if (lastName) {
      andConditions.push({ lastName: buildFuzzySearch('lastName', lastName) })
    }

    if (email) {
      andConditions.push({ email: buildFuzzySearch('email', email) })
    }

    if (title) {
      andConditions.push({ title: buildFuzzySearch('title', title) })
    }

    if (company) {
      andConditions.push({ company: buildFuzzySearch('company', company) })
    }

    if (location) {
      andConditions.push({
        OR: [
          { location: buildFuzzySearch('location', location) },
          { city: buildFuzzySearch('city', location) },
          { state: buildFuzzySearch('state', location) },
          { country: buildFuzzySearch('country', location) }
        ]
      })
    }

    if (industry) {
      andConditions.push({ industry: buildFuzzySearch('industry', industry) })
    }

    if (seniority) {
      andConditions.push({ seniority: buildFuzzySearch('seniority', seniority) })
    }

    if (companySize) {
      andConditions.push({ companySize: buildFuzzySearch('companySize', companySize) })
    }

    // Apply AND conditions
    if (andConditions.length > 0) {
      where.AND = andConditions
    }

    // Build orderBy clause
    let orderBy: Prisma.ContactOrderByWithRelationInput = {}

    switch (sortBy) {
      case 'name':
        orderBy = [
          { firstName: sortOrder },
          { lastName: sortOrder }
        ]
        break
      case 'title':
        orderBy = { title: sortOrder }
        break
      case 'company':
        orderBy = { company: sortOrder }
        break
      case 'createdAt':
      default:
        orderBy = { uploadedAt: sortOrder }
        break
    }

    // Execute query with pagination
    const skip = (page - 1) * limit

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          linkedinUrl: true,
          company: true,
          title: true,
          department: true,
          seniority: true,
          location: true,
          city: true,
          state: true,
          country: true,
          companySize: true,
          companyRevenue: true,
          industry: true,
          companyType: true,
          keywords: true,
          skills: true,
          source: true,
          uploadedAt: true,
          lastEnriched: true,
          lastContacted: true,
          targetingScore: true,
          targetingZone: true
        }
      }),
      prisma.contact.count({ where })
    ])

    const totalPages = Math.ceil(total / limit)

    // Format response for conversational display
    const searchResults: SearchResults = {
      contacts: contacts as ContactResult[],
      total,
      limit,
      offset: skip,
      hasMore: total > skip + contacts.length
    }

    const formattedResponse = formatSearchResults(searchResults, query || '')

    const result: SearchResult = {
      success: true,
      contacts,
      total,
      page,
      limit,
      totalPages,
      message: formattedResponse
    }

    return NextResponse.json(result)

  } catch (error: any) {
    console.error('Contact search error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to search contacts',
        contacts: [],
        total: 0,
        page: 1,
        limit: DEFAULT_LIMIT,
        totalPages: 0
      },
      { status: 500 }
    )
  }
}

// Export GET handler
export async function GET(request: NextRequest) {
  return handleSearch(request)
}

// Export POST handler
export async function POST(request: NextRequest) {
  const body = await request.json()
  return handleSearch(request, body)
}
