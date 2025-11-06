// @ts-nocheck
import { Client } from '@notionhq/client';
import { NextResponse } from 'next/server';

const notion = new Client({ auth: process.env.NOTION_API_KEY });

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const from = formData.get('From') as string;
    const body = formData.get('Body') as string;

    const supplierQuery = await notion.databases.query({
      database_id: process.env.NOTION_SUPPLIERS_DB!,
      filter: {
        property: 'Phone',
        phone_number: {
          equals: from,
        },
      },
    });

    if (supplierQuery.results.length === 0) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    }

    const supplier = supplierQuery.results[0] as any;
    const supplierName = supplier.properties.Name.title[0]?.plain_text;

    const requestsQuery = await notion.databases.query({
      database_id: process.env.NOTION_REQUESTS_DB!,
      filter: {
        and: [
          {
            property: 'Matched Suppliers',
            relation: {
              contains: supplier.id,
            },
          },
          {
            property: 'Status',
            select: {
              equals: 'Suppliers Notified',
            },
          },
        ],
      },
      sorts: [
        {
          property: 'Created',
          direction: 'descending',
        },
      ],
      page_size: 1,
    });

    if (requestsQuery.results.length === 0) {
      return NextResponse.json({ error: 'No active requests found' }, { status: 404 });
    }

    const activeRequest = requestsQuery.results[0];
    const bodyLower = body.toLowerCase().trim();

    // Handle numeric responses (1=Interested, 2=Pass)
    let responseStatus = 'Unknown';
    if (bodyLower === '1' || bodyLower.includes('interested') || bodyLower.includes('yes')) {
      responseStatus = 'Interested';
    } else if (bodyLower === '2' || bodyLower.includes('pass') || bodyLower.includes('no')) {
      responseStatus = 'Declined';
    }

    console.log(`[SMS Webhook] Supplier: ${supplierName} | Response: "${body}" | Status: ${responseStatus}`);

    await notion.comments.create({
      parent: { page_id: activeRequest.id },
      rich_text: [
        {
          text: {
            content: `${supplierName} responded: "${body}" [${responseStatus}]`,
          },
        },
      ],
    });

    // Wells Onyx Voice: Precise confirmation, clear next step
    const confirmationMessage = responseStatus === 'Interested'
      ? `Thanks ${supplierName}! We've recorded your interest. The buyer will connect with you within 24 hours.`
      : responseStatus === 'Declined'
      ? `Thanks ${supplierName}! We've recorded your response. We'll reach out with other opportunities.`
      : `Thanks ${supplierName}! We've recorded your response.`;

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${confirmationMessage}</Message>
</Response>`;

    console.log(`[SMS Webhook] Sent confirmation to ${supplierName}`);

    return new NextResponse(twiml, {
      headers: {
        'Content-Type': 'text/xml',
      },
    });

  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
