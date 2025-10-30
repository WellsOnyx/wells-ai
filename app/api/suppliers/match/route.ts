// @ts-nocheck
import { Client } from '@notionhq/client';
import { NextResponse } from 'next/server';

const notion = new Client({ auth: process.env.NOTION_API_KEY });

export async function POST(request: Request) {
  try {
    const { category, requirements } = await request.json();

    const response = await notion.databases.query({
      database_id: process.env.NOTION_SUPPLIERS_DB!,
      filter: {
        and: [
          {
            property: 'Status',
            select: {
              equals: 'Active',
            },
          },
          {
            property: 'Capabilities',
            multi_select: {
              contains: category,
            },
          },
        ],
      },
      sorts: [
        {
          property: 'Response Time',
          direction: 'ascending',
        },
      ],
      page_size: 5,
    });

    const suppliers = response.results.map((page: any) => ({
      id: page.id,
      name: page.properties.Name.title[0]?.plain_text,
      phone: page.properties.Phone.phone_number,
      email: page.properties.Email.email,
      capabilities: page.properties.Capabilities.multi_select.map((c: any) => c.name),
      responseTime: page.properties['Response Time'].select?.name,
    }));

    return NextResponse.json({ 
      success: true, 
      suppliers,
      count: suppliers.length 
    });

  } catch (error: any) {
    console.error('Notion query error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
