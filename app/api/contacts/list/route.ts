import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

interface ListParams {
  page?: number
  limit?: number
  sortBy?: 'name' | 'title' | 'company' | 'createdAt'
  sortOrder?: 'asc' | 'desc'
  source?: string
  targetingZone?: string
  hasEmail?: boolean
  hasPhone?: boolean
  hasLinkedin?: boolean
}

interface ListResult {
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
 * Contact List API
 * GET /api/contacts/list
 *
 * Features:
 * - Pagination support
 * - Filter options (source, targetingZone, hasEmail, hasPhone, hasLinkedin)
 * - Sort options (name, title, company, createdAt)
 * - User isolation
 */
export async function GET(request: NextRequest) {
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

    // Parse query params
    const searchParams = request.nextUrl.searchParams

    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT))))
    const sortBy = (searchParams.get('sortBy') || 'createdAt') as ListParams['sortBy']
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as ListParams['sortOrder']

    const source = searchParams.get('source') || undefined
    const targetingZone = searchParams.get('targetingZone') || undefined
    const hasEmail = searchParams.get('hasEmail') === 'true'
    const hasPhone = searchParams.get('hasPhone') === 'true'
    const hasLinkedin = searchParams.get('hasLinkedin') === 'true'

    // Build where clause
    const where: Prisma.ContactWhereInput = {
      userId, // User isolation
      AND: []
    }

    const andConditions: Prisma.ContactWhereInput[] = []

    // Filter by source
    if (source) {
      andConditions.push({ source })
    }

    // Filter by targeting zone
    if (targetingZone) {
      andConditions.push({ targetingZone })
    }

    // Filter by has email
    if (hasEmail) {
      andConditions.push({
        email: {
          not: null
        }
      })
    }

    // Filter by has phone
    if (hasPhone) {
      andConditions.push({
        phone: {
          not: null
        }
      })
    }

    // Filter by has LinkedIn
    if (hasLinkedin) {
      andConditions.push({
        linkedinUrl: {
          not: null
        }
      })
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

    const result: ListResult = {
      success: true,
      contacts,
      total,
      page,
      limit,
      totalPages
    }

    return NextResponse.json(result)

  } catch (error: any) {
    console.error('Contact list error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to list contacts',
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
