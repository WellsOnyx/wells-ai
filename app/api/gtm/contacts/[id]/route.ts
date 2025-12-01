// app/api/gtm/contacts/[id]/route.ts
// API for fetching, updating, and deleting individual GTM contacts

import { PrismaClient } from '@prisma/client'
import { NextRequest } from 'next/server'

let prismaClient: PrismaClient | null = null

function getPrisma(): PrismaClient {
  if (!prismaClient) {
    prismaClient = new PrismaClient()
  }
  return prismaClient
}

// GET single contact by ID
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const prisma = getPrisma()

    const contact = await prisma.gtm_contacts.findUnique({
      where: { id }
    })

    if (!contact) {
      return Response.json({ error: 'Contact not found' }, { status: 404 })
    }

    return Response.json({ contact })

  } catch (error: any) {
    console.error('GTM contact fetch error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}

// PATCH update contact by ID
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await req.json()
    const prisma = getPrisma()

    // Only allow updating specific fields
    const allowedFields = [
      'first_name',
      'last_name',
      'title',
      'email',
      'linkedin_url',
      'company_name',
      'company_domain',
      'company_size',
      'company_industry',
      'city',
      'state',
      'country',
      'seniority_level',
      'status',
      'tags',
      'notes'
    ]

    const updateData: any = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    updateData.updated_at = new Date()

    const contact = await prisma.gtm_contacts.update({
      where: { id },
      data: updateData
    })

    return Response.json({ success: true, contact })

  } catch (error: any) {
    console.error('GTM contact update error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}

// DELETE contact by ID
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const prisma = getPrisma()

    await prisma.gtm_contacts.delete({
      where: { id }
    })

    return Response.json({ success: true, message: 'Contact deleted' })

  } catch (error: any) {
    console.error('GTM contact delete error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}
