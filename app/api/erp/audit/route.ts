import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { generateAuditReport } from '@/lib/erp/audit';
import { createNotionClient } from '@/lib/notion';

/**
 * ERP Audit API
 *
 * POST /api/erp/audit
 * - Analyzes customer's historical ERP spend
 * - Finds savings opportunities by auto-bidding against current vendors
 * - Returns comprehensive savings report
 *
 * GET /api/erp/audit
 * - Retrieves previously generated audit reports
 */

/**
 * Generate new ERP audit report
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { months = 12 } = await req.json();

    // Get customer's Merge account token from Notion
    const accountToken = await getMergeAccountToken(userId);

    if (!accountToken) {
      return NextResponse.json({
        error: 'ERP not connected',
        message: 'Please connect your ERP system first',
        connectUrl: '/settings/integrations',
      }, { status: 400 });
    }

    console.log(`[ERP AUDIT] Generating audit for user ${userId}, ${months} months`);

    // Generate audit report
    const report = await generateAuditReport(accountToken, userId, months);

    // Store report in Notion for future reference
    await saveAuditReport(userId, report);

    // Return report
    return NextResponse.json({
      success: true,
      report,
      message: `Found $${report.summary.potentialSavings.toLocaleString()} in potential savings (${report.summary.savingsPercent.toFixed(1)}%)`,
    });

  } catch (error: any) {
    console.error('[ERP AUDIT] Error:', error);

    return NextResponse.json({
      error: 'Audit failed',
      message: error.message || 'Failed to generate ERP audit report',
    }, { status: 500 });
  }
}

/**
 * Get audit reports for user
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get audit reports from Notion
    const reports = await getAuditReports(userId);

    return NextResponse.json({
      success: true,
      reports,
      count: reports.length,
    });

  } catch (error: any) {
    console.error('[ERP AUDIT] Get reports error:', error);

    return NextResponse.json({
      error: 'Failed to fetch reports',
      message: error.message,
    }, { status: 500 });
  }
}

/**
 * Helper: Get Merge account token for user
 */
async function getMergeAccountToken(userId: string): Promise<string | null> {
  const dbId = process.env.NOTION_MERGE_TOKENS_DATABASE_ID;

  if (!dbId) {
    console.warn('[ERP AUDIT] NOTION_MERGE_TOKENS_DATABASE_ID not configured');
    return null;
  }

  try {
    const notion = createNotionClient();

    // @ts-ignore
    const response = await notion.databases.query({
      database_id: dbId,
      filter: {
        and: [
          {
            property: 'User ID',
            rich_text: {
              equals: userId,
            },
          },
          {
            property: 'Active',
            checkbox: {
              equals: true,
            },
          },
        ],
      },
      page_size: 1,
    });

    if (response.results.length === 0) {
      return null;
    }

    const token = response.results[0] as any;
    return token.properties['Account Token']?.rich_text?.[0]?.text?.content || null;

  } catch (error) {
    console.error('[ERP AUDIT] Error getting account token:', error);
    return null;
  }
}

/**
 * Helper: Save audit report to Notion
 */
async function saveAuditReport(userId: string, report: any): Promise<void> {
  const dbId = process.env.NOTION_ERP_AUDITS_DATABASE_ID;

  if (!dbId) {
    console.warn('[ERP AUDIT] NOTION_ERP_AUDITS_DATABASE_ID not configured - skipping save');
    return;
  }

  try {
    const notion = createNotionClient();

    await notion.pages.create({
      parent: { database_id: dbId },
      properties: {
        'User ID': {
          rich_text: [{ text: { content: userId } }],
        },
        'Audit Date': {
          date: { start: report.auditDate },
        },
        'Period Start': {
          date: { start: report.periodAnalyzed.start },
        },
        'Period End': {
          date: { start: report.periodAnalyzed.end },
        },
        'Total Spend': {
          number: report.summary.totalSpend,
        },
        'Potential Savings': {
          number: report.summary.potentialSavings,
        },
        'Savings Percent': {
          number: report.summary.savingsPercent,
        },
        'PO Count': {
          number: report.summary.poCount,
        },
        'Vendor Count': {
          number: report.summary.vendorCount,
        },
        'Opportunities Found': {
          number: report.savingsOpportunities.length,
        },
        'Report Data': {
          rich_text: [{ text: { content: JSON.stringify(report).substring(0, 2000) } }],
        },
      } as any,
    });

    console.log('[ERP AUDIT] Report saved to Notion');

  } catch (error) {
    console.error('[ERP AUDIT] Error saving report:', error);
    // Don't throw - saving is best-effort
  }
}

/**
 * Helper: Get previous audit reports
 */
async function getAuditReports(userId: string): Promise<any[]> {
  const dbId = process.env.NOTION_ERP_AUDITS_DATABASE_ID;

  if (!dbId) {
    return [];
  }

  try {
    const notion = createNotionClient();

    // @ts-ignore
    const response = await notion.databases.query({
      database_id: dbId,
      filter: {
        property: 'User ID',
        rich_text: {
          equals: userId,
        },
      },
      sorts: [
        {
          property: 'Audit Date',
          direction: 'descending',
        },
      ],
      page_size: 10,
    });

    return response.results.map((page: any) => ({
      id: page.id,
      auditDate: page.properties['Audit Date']?.date?.start,
      totalSpend: page.properties['Total Spend']?.number || 0,
      potentialSavings: page.properties['Potential Savings']?.number || 0,
      savingsPercent: page.properties['Savings Percent']?.number || 0,
      poCount: page.properties['PO Count']?.number || 0,
      vendorCount: page.properties['Vendor Count']?.number || 0,
      opportunitiesFound: page.properties['Opportunities Found']?.number || 0,
    }));

  } catch (error) {
    console.error('[ERP AUDIT] Error fetching reports:', error);
    return [];
  }
}
