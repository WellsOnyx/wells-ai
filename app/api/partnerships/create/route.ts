import { NextResponse } from 'next/server'
import { Client } from '@notionhq/client'

const notion = new Client({ auth: process.env.NOTION_API_KEY })

/**
 * Create new Category Pioneer partnership
 * Called after partnership intro call is booked
 */

export async function POST(request: Request) {
  try {
    const {
      categorySlug,
      categoryName,
      pioneerCompany,
      contactName,
      contactEmail,
      contactPhone,
      tier, // 1, 2, or 3
      marketSize,
      categoryDescription
    } = await request.json()

    if (!categorySlug || !categoryName || !pioneerCompany || !contactName || !contactEmail || !tier) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Calculate revenue share percentage
    const revenueShareMap: { [key: number]: number } = {
      1: 0.20,
      2: 0.35,
      3: 0.50
    }
    const revenueShare = revenueShareMap[tier]

    const tierNameMap: { [key: number]: string } = {
      1: 'Tier 1 (20%)',
      2: 'Tier 2 (35%)',
      3: 'Tier 3 (50%)'
    }

    if (!process.env.NOTION_PARTNERSHIPS_DB) {
      console.warn('NOTION_PARTNERSHIPS_DB not configured')
      return NextResponse.json({
        success: true,
        message: 'Partnership created (simulation mode - Notion not configured)',
        partnershipId: 'sim_' + Date.now()
      })
    }

    // Create partnership record
    const partnershipPage = await notion.pages.create({
      parent: { database_id: process.env.NOTION_PARTNERSHIPS_DB },
      properties: {
        'Name': {
          title: [{ text: { content: `${pioneerCompany} - ${categoryName}` } }]
        },
        'Category Slug': {
          rich_text: [{ text: { content: categorySlug } }]
        },
        'Category Name': {
          select: { name: categoryName }
        },
        'Pioneer Company': {
          rich_text: [{ text: { content: pioneerCompany } }]
        },
        'Contact Name': {
          rich_text: [{ text: { content: contactName } }]
        },
        'Contact Email': {
          email: contactEmail
        },
        ...(contactPhone && {
          'Contact Phone': {
            phone_number: contactPhone
          }
        }),
        'Partnership Tier': {
          select: { name: tierNameMap[tier] }
        },
        'Revenue Share %': {
          number: revenueShare
        },
        'Status': {
          select: { name: '🟡 In Negotiation' }
        },
        ...(marketSize && {
          'Market Size': {
            rich_text: [{ text: { content: marketSize } }]
          }
        }),
        ...(categoryDescription && {
          'Category Description': {
            rich_text: [{ text: { content: categoryDescription } }]
          }
        }),
        'Total Category Revenue': {
          number: 0
        },
        'Tier Requirements Met': {
          checkbox: false
        }
      }
    })

    // Create activity log entry
    if (process.env.NOTION_ACTIVITY_LOG_DB) {
      await notion.pages.create({
        parent: { database_id: process.env.NOTION_ACTIVITY_LOG_DB },
        properties: {
          'Name': {
            title: [{ text: { content: `Partnership inquiry: ${pioneerCompany} - ${categoryName}` } }]
          },
          'Activity Type': {
            select: { name: 'Inquiry Received' }
          },
          'Category': {
            rich_text: [{ text: { content: categoryName } }]
          },
          'Company': {
            rich_text: [{ text: { content: pioneerCompany } }]
          },
          'Details': {
            rich_text: [{
              text: {
                content: `${pioneerCompany} submitted partnership inquiry for ${categoryName}. Tier ${tier} selected (${revenueShare * 100}% revenue share). Contact: ${contactName} (${contactEmail})`
              }
            }]
          }
        }
      })
    }

    return NextResponse.json({
      success: true,
      partnershipId: partnershipPage.id,
      message: `Partnership created for ${pioneerCompany} - ${categoryName}`,
      partnership: {
        company: pioneerCompany,
        category: categoryName,
        tier,
        revenueShare: `${revenueShare * 100}%`,
        status: 'In Negotiation'
      }
    })

  } catch (error: any) {
    console.error('Partnership creation error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
