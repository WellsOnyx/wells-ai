import { NextResponse } from 'next/server'
import { Client } from '@notionhq/client'
import { EMPLOYMENT_MODELS } from '@/lib/employment/models'

const notion = new Client({ auth: process.env.NOTION_API_KEY })

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { model, fullName, email, address, city, state, zip, ssn, entityName, ein } = body

    if (!model || !fullName || !email) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const employmentModel = EMPLOYMENT_MODELS[model as keyof typeof EMPLOYMENT_MODELS]
    if (!employmentModel) {
      return NextResponse.json(
        { success: false, error: 'Invalid employment model' },
        { status: 400 }
      )
    }

    if (!process.env.NOTION_HR_EMPLOYEES_DB) {
      console.warn('NOTION_HR_EMPLOYEES_DB not configured')
      return NextResponse.json({
        success: true,
        message: 'Employment record created (simulated - Notion not configured)',
        employmentId: 'sim_' + Date.now(),
        simulation: true
      })
    }

    // Create employment record in Notion
    const employeePage = await notion.pages.create({
      parent: { database_id: process.env.NOTION_HR_EMPLOYEES_DB },
      properties: {
        'Name': {
          title: [{ text: { content: fullName } }]
        },
        'Email': {
          email: email
        },
        'Employment Model': {
          select: { name: employmentModel.name }
        },
        'Legal Structure': {
          select: { name: employmentModel.legalStructure }
        },
        'Status': {
          select: { name: '📝 Pending Signature' }
        },
        'Address': {
          rich_text: [{
            text: { content: `${address}, ${city}, ${state} ${zip}` }
          }]
        },
        'State': {
          select: { name: state || 'Unknown' }
        },
        ...(ssn && {
          'SSN (Last 4)': {
            rich_text: [{ text: { content: ssn.slice(-4) } }]
          }
        }),
        ...(entityName && {
          'Entity Name': {
            rich_text: [{ text: { content: entityName } }]
          }
        }),
        ...(ein && {
          'EIN': {
            rich_text: [{ text: { content: ein } }]
          }
        }),
        'Platform Fee': {
          rich_text: [{ text: { content: employmentModel.pricing.platformFee } }]
        },
        'Payroll Fee': {
          rich_text: [{
            text: { content: employmentModel.pricing.payrollFee || 'N/A' }
          }]
        },
        'Benefits Included': {
          checkbox: employmentModel.benefits
        },
        'Unemployment Eligible': {
          checkbox: employmentModel.unemploymentEligible
        },
        'Start Date': {
          date: { start: new Date().toISOString().split('T')[0] }
        },
        'Created': {
          date: { start: new Date().toISOString() }
        }
      }
    })

    // Create activity log entry
    if (process.env.NOTION_ACTIVITY_LOG_DB) {
      try {
        await notion.pages.create({
          parent: { database_id: process.env.NOTION_ACTIVITY_LOG_DB },
          properties: {
            'Name': {
              title: [{ text: { content: `Employment record created: ${fullName}` } }]
            },
            'Activity Type': {
              select: { name: 'HR - New Employee' }
            },
            'Company': {
              rich_text: [{ text: { content: fullName } }]
            },
            'Details': {
              rich_text: [{
                text: {
                  content: `New employment record created\nModel: ${employmentModel.name}\nEmail: ${email}\nStatus: Pending Signature`
                }
              }]
            }
          }
        })
      } catch (error) {
        console.log('Could not create activity log:', error)
      }
    }

    // Generate DocuSign envelope (will implement later)
    // For now, return success with manual signing instructions

    return NextResponse.json({
      success: true,
      employmentId: employeePage.id,
      message: 'Employment record created successfully',
      nextSteps: {
        step1: 'Review full agreement (sent to email)',
        step2: 'Sign via DocuSign',
        step3: 'Complete I-9 verification (if W2)',
        step4: 'Submit W-4 or W-9 forms',
        step5: 'Onboarding complete - ready to start'
      },
      timeline: {
        agreementSent: 'Within 24 hours',
        signatureDeadline: '7 days',
        startDate: 'After all forms completed'
      },
      employmentDetails: {
        model: employmentModel.name,
        legalStructure: employmentModel.legalStructure,
        benefits: employmentModel.benefits,
        platformFee: employmentModel.pricing.platformFee,
        taxHandling: employmentModel.taxHandling
      }
    })

  } catch (error: any) {
    console.error('Error creating employment record:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create employment record' },
      { status: 500 }
    )
  }
}
