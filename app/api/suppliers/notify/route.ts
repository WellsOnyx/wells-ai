// @ts-nocheck
import { Client } from '@notionhq/client';
import twilio from 'twilio';
import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export async function POST(request: Request) {
  try {
    const { 
      supplierIds, 
      buyerName, 
      requirements, 
      category 
    } = await request.json();

    const requestRecord = await notion.pages.create({
      parent: { database_id: process.env.NOTION_REQUESTS_DB! },
      properties: {
        'Request ID': {
          title: [{ text: { content: `REQ-${Date.now()}` } }],
        },
        'Buyer Name': {
          rich_text: [{ text: { content: buyerName } }],
        },
        'Requirements': {
          rich_text: [{ text: { content: requirements } }],
        },
        'Category': {
          select: { name: category },
        },
        'Status': {
          select: { name: 'Suppliers Notified' },
        },
      },
    });

    const requestId = requestRecord.id;
    const notifications = [];

    for (const supplierId of supplierIds) {
      const supplier = await notion.pages.retrieve({ page_id: supplierId });
      const supplierData = supplier as any;
      
      const phone = supplierData.properties.Phone.phone_number;
      const name = supplierData.properties.Name.title[0]?.plain_text;

      const responseToken = randomBytes(16).toString('hex');

      const message = `Wells AI Opportunity - ${category}

Buyer: ${buyerName}
Requirements: ${requirements}

Respond: ${process.env.NEXT_PUBLIC_APP_URL}/respond/${responseToken}

Reply INTERESTED or PASS`;

      const sms = await twilioClient.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phone,
      });

      notifications.push({
        supplier: name,
        phone,
        status: sms.status,
        messageSid: sms.sid,
        responseToken,
      });

      await notion.pages.update({
        page_id: supplierId,
        properties: {
          'Last Contacted': {
            date: { start: new Date().toISOString() },
          },
        },
      });
    }

    await notion.pages.update({
      page_id: requestId,
      properties: {
        'Matched Suppliers': {
          relation: supplierIds.map((id: string) => ({ id })),
        },
      },
    });

    return NextResponse.json({
      success: true,
      requestId,
      notifications,
      message: `Notified ${notifications.length} suppliers`,
    });

  } catch (error: any) {
    console.error('Notification error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
