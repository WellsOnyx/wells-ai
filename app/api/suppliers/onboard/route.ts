import { NextRequest, NextResponse } from 'next/server'
import { Suppliers } from '@/lib/db'
import { vectorDB, SupplierCategoryKnowledge, generateCategoryId } from '@/lib/vector-db'
import { monitorAPI } from '@/lib/monitoring'
import { Client } from '@notionhq/client'

const notion = new Client({ auth: process.env.NOTION_API_KEY })

/**
 * Supplier Self-Service Onboarding API
 * Allows suppliers to register and add their capabilities
 */
export async function POST(req: NextRequest) {
  const monitor = monitorAPI('/api/suppliers/onboard', 'POST')

  try {
    const data = await req.json()

    const {
      companyName,
      email,
      phone,
      website,
      categories,
      capabilities,
      certifications,
      minOrderValue,
      typicalLeadTime,
      description,
    } = data

    // Validate required fields
    if (!companyName || !email || !phone || !categories || categories.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Create supplier in Postgres
    const supplier = await Suppliers.create({
      name: companyName,
      email,
      phone,
      categories: categories || [],
      capabilities: capabilities || [],
      certifications: certifications || [],
      rating: 0,
      completedDeals: 0,
    })

    // Store in Notion for backup/review
    if (process.env.NOTION_SUPPLIERS_DB_ID) {
      try {
        await notion.pages.create({
          parent: { database_id: process.env.NOTION_SUPPLIERS_DB_ID },
          properties: {
            Name: {
              title: [{ text: { content: companyName } }],
            },
            Email: {
              email: email,
            },
            Phone: {
              phone_number: phone,
            },
            Categories: {
              multi_select: categories.map((cat: string) => ({ name: cat })),
            },
            Capabilities: {
              multi_select: capabilities.map((cap: string) => ({ name: cap })),
            },
            Certifications: {
              multi_select: certifications.map((cert: string) => ({ name: cert })),
            },
            Status: {
              select: { name: 'Pending Review' },
            },
          },
        })
      } catch (notionError) {
        console.error('[API] Notion backup error:', notionError)
        // Continue even if Notion fails
      }
    }

    // Store supplier-category knowledge in vector DB
    for (const category of categories) {
      const supplierKnowledge: SupplierCategoryKnowledge = {
        supplierId: supplier.id,
        category: category,
        capabilities: capabilities || [],
        typicalSpecs: {},
        pricingRange: {
          min: 0,
          max: 0,
          unit: 'USD',
        },
        leadTime: {
          typical: typicalLeadTime || 'Not specified',
          rush: 'Not specified',
        },
        minimumOrder: minOrderValue,
        certifications: certifications || [],
      }

      await vectorDB.storeSupplierKnowledge(supplierKnowledge)
    }

    // Send notification (would integrate with email service)
    console.log(`[ONBOARDING] New supplier: ${companyName} (${email})`)

    monitor.end(true, { supplierId: supplier.id, categories: categories.length })

    return NextResponse.json({
      success: true,
      supplierId: supplier.id,
      message: 'Application submitted successfully',
    })
  } catch (error) {
    monitor.end(false)
    console.error('[API] Supplier onboarding error:', error)

    return NextResponse.json(
      {
        error: 'Failed to process onboarding',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
