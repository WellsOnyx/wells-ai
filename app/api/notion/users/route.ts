/**
 * Create user in Notion CRM
 * Called when user completes in-conversation signup
 */

import { NextResponse } from 'next/server'
import { Client } from '@notionhq/client'

export async function POST(request: Request) {
  try {
    const { name, email, userType, company, source, sessionId } = await request.json()

    if (!name || !email || !userType) {
      return NextResponse.json(
        { error: 'Missing required fields: name, email, userType' },
        { status: 400 }
      )
    }

    const notion = new Client({
      auth: process.env.NOTION_API_KEY
    })

    const databaseId = process.env.NOTION_CRM_DATABASE_ID

    if (!databaseId) {
      console.error('[NOTION_USERS] NOTION_CRM_DATABASE_ID not configured')
      return NextResponse.json(
        { error: 'Notion database not configured' },
        { status: 500 }
      )
    }

    // Create user in Notion CRM
    const response = await notion.pages.create({
      parent: { database_id: databaseId },
      properties: {
        Name: {
          title: [{ text: { content: name } }]
        },
        Email: {
          email: email
        },
        'User Type': {
          select: {
            name: userType === 'job_seeker' ? 'Job Seeker' :
                  userType === 'founder' ? 'Founder' :
                  userType === 'buyer' ? 'Buyer' :
                  userType === 'seller' ? 'Seller' :
                  'Both'
          }
        },
        ...(company ? {
          Company: {
            rich_text: [{ text: { content: company } }]
          }
        } : {}),
        Source: {
          select: { name: source || 'chat_signup' }
        },
        ...(sessionId ? {
          'Session ID': {
            rich_text: [{ text: { content: sessionId } }]
          }
        } : {}),
        Status: {
          select: { name: 'Active' }
        }
      }
    })

    console.log('[NOTION_USERS] User created:', email)

    return NextResponse.json({
      success: true,
      notionId: response.id,
      user: { name, email, userType }
    })
  } catch (error: any) {
    console.error('[NOTION_USERS] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create user' },
      { status: 500 }
    )
  }
}
