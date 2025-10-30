// @ts-nocheck
import { Client } from '@notionhq/client';
import { NextResponse } from 'next/server';

const notion = new Client({ auth: process.env.NOTION_API_KEY });

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const from = formData.get('From') as string;
    const body = formData.get('Body') as string;

    // TODO: Fix Notion SDK
    const supplierQuery = { results: [] as any[] }
    // const supplierQuery = await notion.databases.query({
    //   database_id: process.env.NOTION_SUPPLIERS_DB!,
    //   filter: {
    //     property: 'Phone',
    //     phone_number: {
    //       equals: from,
    //     },
    //   },
    // });

    if (supplierQuery.results.length === 0) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    }

    const supplier = supplierQuery.results[0] as any;
    const supplierName = supplier.properties.Name.title[0]?.plain_text;

    // TODO: Fix Notion SDK
    const requestsQuery = { results: [] as any[] }
    // const requestsQuery = await notion.databases.query({
    //   database_id: process.env.NOTION_REQUESTS_DB!,
    //   filter: {
    //     and: [
    //       {
    //         property: 'Matched Suppliers',
    //         relation: {
    //           contains: supplier.id,
    //         },
    //       },
    //       {
    //         property: 'Status',
    //         select: {
    //           equals: 'Suppliers Notified',
    //         },
    //       },
    //     ],
    //   },
    //   sorts: [
    //     {
    //       property: 'Created',
    //       direction: 'descending',
    //     },
    //   ],
    //   page_size: 1,
    // });

    if (requestsQuery.results.length === 0) {
      return NextResponse.json({ error: 'No active requests found' }, { status: 404 });
    }

    const request = requestsQuery.results[0];
    const bodyLower = body.toLowerCase();

    let responseStatus = 'Unknown';
    if (bodyLower.includes('interested') || bodyLower.includes('yes')) {
      responseStatus = 'Interested';
    } else if (bodyLower.includes('pass') || bodyLower.includes('no')) {
      responseStatus = 'Declined';
    }

    await notion.comments.create({
      parent: { page_id: request.id },
      rich_text: [
        {
          text: {
            content: `${supplierName} responded: "${body}" [${responseStatus}]`,
          },
        },
      ],
    });

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Thanks ${supplierName}! We've recorded your response. Wells AI team will follow up shortly.</Message>
</Response>`;

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
