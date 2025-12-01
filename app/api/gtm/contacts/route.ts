// app/api/gtm/contacts/route.ts
// API for searching GTM contacts from Clay imports

import { PrismaClient } from '@prisma/client'
import { NextRequest } from 'next/server'

let prismaClient: PrismaClient | null = null

function getPrisma(): PrismaClient {
  if (!prismaClient) {
    prismaClient = new PrismaClient()
  }
  return prismaClient
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)

    // Pagination
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const skip = (page - 1) * limit

    // Search query
    const q = searchParams.get('q') || ''

    // Filters
    const industry = searchParams.get('industry') || ''
    const companySize = searchParams.get('company_size') || ''
    const seniority = searchParams.get('seniority') || ''
    const status = searchParams.get('status') || ''
    const state = searchParams.get('state') || ''

    const prisma = getPrisma()

    // Build where clause
    const where: any = {}
    const AND: any[] = []

    // Full-text search
    if (q) {
      AND.push({
        OR: [
          { first_name: { contains: q, mode: 'insensitive' } },
          { last_name: { contains: q, mode: 'insensitive' } },
          { company_name: { contains: q, mode: 'insensitive' } },
          { title: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } }
        ]
      })
    }

    // Apply filters
    if (industry) AND.push({ company_industry: { contains: industry, mode: 'insensitive' } })
    if (companySize) AND.push({ company_size: companySize })
    if (seniority) AND.push({ seniority_level: seniority })
    if (status) AND.push({ status })
    if (state) AND.push({ state })

    if (AND.length > 0) where.AND = AND

    // Get results and total count
    const [contacts, total] = await Promise.all([
      prisma.gtm_contacts.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' }
      }),
      prisma.gtm_contacts.count({ where })
    ])

    return Response.json({
      contacts,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    })

  } catch (error: any) {
    console.error('GTM contacts search error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}
