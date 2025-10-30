import { NextResponse } from 'next/server'
import { Client } from '@notionhq/client'

const notion = new Client({ auth: process.env.NOTION_API_KEY })

/**
 * Close deal and calculate Wells AI transaction fee
 * Updates all related records and triggers billing
 */

export async function POST(request: Request) {
  try {
    const {
      targetId,
      dealValue,
      paymentTerms = '50% upfront, 50% on delivery',
      startDate,
      notes
    } = await request.json()

    if (!targetId || !dealValue) {
      return NextResponse.json(
        { success: false, error: 'targetId and dealValue required' },
        { status: 400 }
      )
    }

    // Calculate Wells AI 33bps transaction fee
    const wellsAIFee = dealValue * 0.0033

    // Get target details
    const targetPage = await notion.pages.retrieve({ page_id: targetId })
    const targetProps = (targetPage as any).properties

    const targetData = {
      name: targetProps.Name?.title?.[0]?.plain_text || 'Unknown',
      company: targetProps.Company?.rich_text?.[0]?.plain_text || '',
      email: targetProps.Email?.email || ''
    }

    // Get campaign details
    const campaignId = targetProps.Campaign?.relation?.[0]?.id
    let serviceOffering = 'Unknown'
    if (campaignId) {
      const campaignPage = await notion.pages.retrieve({ page_id: campaignId })
      const campaignProps = (campaignPage as any).properties
      serviceOffering = campaignProps['Service Offering']?.select?.name || 'Unknown'
    }

    // Create or update deal in Deals database
    let dealId: string

    if (process.env.NOTION_DEALS_DB) {
      const dealPage = await notion.pages.create({
        parent: { database_id: process.env.NOTION_DEALS_DB },
        properties: {
          'Name': {
            title: [{
              text: { content: `${targetData.company} - ${serviceOffering}` }
            }]
          },
          'Contact': {
            relation: [{ id: targetId }]
          },
          'Status': {
            select: { name: 'Closed Won' }
          },
          'Deal Value': {
            number: dealValue
          },
          'Wells AI Fee (33bps)': {
            number: wellsAIFee
          },
          'Payment Terms': {
            rich_text: [{ text: { content: paymentTerms } }]
          },
          'Start Date': {
            date: { start: startDate || new Date().toISOString().split('T')[0] }
          },
          'Closed Date': {
            date: { start: new Date().toISOString().split('T')[0] }
          },
          'Service Offering': {
            select: { name: serviceOffering }
          }
        }
      })

      dealId = dealPage.id
    } else {
      // Fallback: update target with deal info
      dealId = targetId
    }

    // Update target stage to Closed Won
    await notion.pages.update({
      page_id: targetId,
      properties: {
        'Stage': { select: { name: 'Closed Won' } },
        'Deal Value': { number: dealValue },
        'Wells AI Fee': { number: wellsAIFee },
        'Closed Date': { date: { start: new Date().toISOString().split('T')[0] } }
      }
    })

    // Create interaction record for the close
    if (process.env.NOTION_INTERACTIONS_DB) {
      await notion.pages.create({
        parent: { database_id: process.env.NOTION_INTERACTIONS_DB },
        properties: {
          'Name': {
            title: [{ text: { content: `Deal Closed: ${targetData.company}` } }]
          },
          'Type': {
            select: { name: 'Deal Closed' }
          },
          'Contact': {
            relation: [{ id: targetId }]
          },
          'Date': {
            date: { start: new Date().toISOString() }
          },
          'Notes': {
            rich_text: [{
              text: {
                content: `Deal closed: ${serviceOffering} for ${targetData.company}.\n\nDeal Value: $${dealValue.toLocaleString()}\nWells AI Fee (33bps): $${wellsAIFee.toLocaleString()}\nPayment Terms: ${paymentTerms}\n\n${notes || ''}`
              }
            }]
          }
        }
      })
    }

    // Update campaign stats
    if (campaignId) {
      try {
        const campaignPage = await notion.pages.retrieve({ page_id: campaignId })
        const campaignProps = (campaignPage as any).properties

        const currentDeals = campaignProps['Deals Closed']?.number || 0
        const currentRevenue = campaignProps['Total Revenue']?.number || 0

        await notion.pages.update({
          page_id: campaignId,
          properties: {
            'Deals Closed': { number: currentDeals + 1 },
            'Total Revenue': { number: currentRevenue + dealValue }
          }
        })
      } catch (error) {
        console.log('Could not update campaign stats:', error)
      }
    }

    // Check for Category Pioneer partnership and update revenue share
    // TODO: Fix Notion SDK query method compatibility
    let partnershipData: {
      hasPartnership: boolean
      partnerCompany: string
      revenueShare: string
      partnerShareAmount: number
      newCategoryTotal: number
    } | null = null
    if (false && process.env.NOTION_PARTNERSHIPS_DB && serviceOffering) {
      try {
        // Find active partnership for this category
        // const partnershipsResponse = await notion.databases.query({
        //   database_id: process.env.NOTION_PARTNERSHIPS_DB,
        //   filter: {
        //     and: [
        //       {
        //         property: 'Category Name',
        //         select: { equals: serviceOffering }
        //       },
        //       {
        //         property: 'Status',
        //         select: { equals: '✅ Live' }
        //       }
        //     ]
        //   }
        // })

        // if (partnershipsResponse.results.length > 0) {
        //   const partnershipPage = partnershipsResponse.results[0]
        //   const partnershipProps = (partnershipPage as any).properties

          // Get current revenue and add this deal
          // const currentCategoryRevenue = partnershipProps['Total Category Revenue']?.number || 0
          // const newCategoryRevenue = currentCategoryRevenue + dealValue

          // Get revenue share %
          // const revenueShare = partnershipProps['Revenue Share %']?.number || 0

          // Calculate partner share from Wells AI fee
          // const partnerShare = wellsAIFee * revenueShare

          // Update partnership revenue
          // await notion.pages.update({
          //   page_id: partnershipPage.id,
          //   properties: {
          //     'Total Category Revenue': { number: newCategoryRevenue }
          //     // Formulas will auto-calculate Wells AI Fee, Partner Share, Wells Onyx Net
          //   }
          // })

          // Create activity log entry
          // if (process.env.NOTION_ACTIVITY_LOG_DB) {
          //   const pioneerCompany = partnershipProps['Pioneer Company']?.rich_text?.[0]?.plain_text || 'Partner'

          //   await notion.pages.create({
          //     parent: { database_id: process.env.NOTION_ACTIVITY_LOG_DB },
          //     properties: {
          //       'Name': {
          //         title: [{ text: { content: `Deal closed in ${serviceOffering}: $${dealValue.toLocaleString()}` } }]
          //       },
          //       'Activity Type': {
          //         select: { name: 'Deal Closed' }
          //       },
          //       'Category': {
          //         rich_text: [{ text: { content: serviceOffering } }]
          //       },
          //       'Company': {
          //         rich_text: [{ text: { content: pioneerCompany } }]
          //       },
          //       'Details': {
          //         rich_text: [{
          //           text: {
          //             content: `Deal closed: ${targetData.company} - $${dealValue.toLocaleString()}. Partner share: $${partnerShare.toLocaleString()} (${(revenueShare * 100)}%)`
          //           }
          //         }]
          //       },
          //       'Amount': {
          //         number: dealValue
          //       }
          //     }
          //   })
          // }

          // partnershipData = {
          //   hasPartnership: true,
          //   partnerCompany: partnershipProps['Pioneer Company']?.rich_text?.[0]?.plain_text || 'Unknown',
          //   revenueShare: `${(revenueShare * 100)}%`,
          //   partnerShareAmount: partnerShare,
          //   newCategoryTotal: newCategoryRevenue
          // }

          // console.log(`✅ Partnership revenue updated: ${serviceOffering} - Partner earns $${partnerShare.toLocaleString()}`)
        // }
      } catch (error) {
        console.log('Could not update partnership revenue:', error)
      }
    }

    return NextResponse.json({
      success: true,
      dealId,
      dealValue,
      wellsAIFee,
      partnershipData,
      message: `Deal closed! ${targetData.company} - $${dealValue.toLocaleString()}`,
      billing: {
        totalDealValue: dealValue,
        wellsAIFee: wellsAIFee,
        feePercentage: '0.33%',
        paymentTerms
      }
    })

  } catch (error: any) {
    console.error('Deal close error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
