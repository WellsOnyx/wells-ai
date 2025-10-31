// @ts-nocheck
import { Client } from '@notionhq/client';
import { NextResponse } from 'next/server';
import { withValidation } from '@/lib/validation';
import { supplierMatchSchema } from '@/lib/schemas';

const notion = new Client({ auth: process.env.NOTION_API_KEY });

export const POST = withValidation(supplierMatchSchema, async (request) => {
  try {
    const { category, requirements, organizationId } = request.validatedBody;

    // Build filter - include orgId if provided
    const filters: any[] = [
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
    ];

    // Add organization filter if provided
    if (organizationId) {
      filters.push({
        property: 'Organization ID',
        rich_text: {
          equals: organizationId,
        },
      });
    }

    const response = await notion.databases.query({
      database_id: process.env.NOTION_SUPPLIERS_DB!,
      filter: {
        and: filters,
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
})
