/**
 * GRAIN Board Reports API
 *
 * GET /api/grain/reports - List available reports
 * POST /api/grain/reports - Generate a new report
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
  BoardReports,
  ReportType,
  DateRange,
  QuarterlyEndowmentSummary,
  FundPerformanceReport,
  GrantActivityReport,
  ComplianceFiduciaryReport,
  SpendingPolicyAdherenceReport,
} from '@/lib/grain/board-reports'

// ============================================================================
// GET - List reports and templates
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'list'
    const organizationId = searchParams.get('organizationId') || userId
    const type = searchParams.get('type') as ReportType | null
    const status = searchParams.get('status') as 'draft' | 'pending_review' | 'approved' | 'published' | null
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Get report templates
    if (action === 'templates') {
      const templates = BoardReports.getReportTemplates()
      return NextResponse.json({
        success: true,
        templates,
      })
    }

    // Get specific report by ID
    if (action === 'get') {
      const reportId = searchParams.get('id')
      if (!reportId) {
        return NextResponse.json(
          { success: false, error: 'Report ID required' },
          { status: 400 }
        )
      }

      const report = await BoardReports.getReportById(reportId)
      if (!report) {
        return NextResponse.json(
          { success: false, error: 'Report not found' },
          { status: 404 }
        )
      }

      return NextResponse.json({
        success: true,
        report,
      })
    }

    // List reports
    const { reports, total } = await BoardReports.listReports(organizationId, {
      type: type || undefined,
      status: status || undefined,
      limit,
      offset,
    })

    // Also include templates for easy access
    const templates = BoardReports.getReportTemplates()

    return NextResponse.json({
      success: true,
      reports,
      templates,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + reports.length < total,
      },
    })
  } catch (error: any) {
    console.error('[Reports API] GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch reports', details: error.message },
      { status: 500 }
    )
  }
}

// ============================================================================
// POST - Generate a new report
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const {
      type,
      organizationId,
      startDate,
      endDate,
    } = body as {
      type: ReportType
      organizationId?: string
      startDate: string
      endDate: string
    }

    // Validate required fields
    if (!type) {
      return NextResponse.json(
        { success: false, error: 'Report type is required' },
        { status: 400 }
      )
    }

    if (!startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: 'Date range (startDate and endDate) is required' },
        { status: 400 }
      )
    }

    // Validate report type
    const validTypes: ReportType[] = [
      'quarterly_endowment_summary',
      'fund_performance',
      'grant_activity',
      'compliance_fiduciary',
      'spending_policy_adherence',
    ]

    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { success: false, error: `Invalid report type. Valid types: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    const dateRange: DateRange = {
      start: new Date(startDate),
      end: new Date(endDate),
    }

    // Validate date range
    if (dateRange.start > dateRange.end) {
      return NextResponse.json(
        { success: false, error: 'Start date must be before end date' },
        { status: 400 }
      )
    }

    const orgId = organizationId || userId

    // Generate the appropriate report
    let report:
      | QuarterlyEndowmentSummary
      | FundPerformanceReport
      | GrantActivityReport
      | ComplianceFiduciaryReport
      | SpendingPolicyAdherenceReport

    switch (type) {
      case 'quarterly_endowment_summary':
        report = await BoardReports.generateQuarterlyEndowmentSummary(orgId, dateRange, userId)
        break

      case 'fund_performance':
        report = await BoardReports.generateFundPerformanceReport(orgId, dateRange, userId)
        break

      case 'grant_activity':
        report = await BoardReports.generateGrantActivityReport(orgId, dateRange, userId)
        break

      case 'compliance_fiduciary':
        report = await BoardReports.generateComplianceFiduciaryReport(orgId, dateRange, userId)
        break

      case 'spending_policy_adherence':
        report = await BoardReports.generateSpendingPolicyAdherenceReport(orgId, dateRange, userId)
        break

      default:
        return NextResponse.json(
          { success: false, error: 'Unknown report type' },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      report,
      message: `${type.replace(/_/g, ' ')} report generated successfully`,
    })
  } catch (error: any) {
    console.error('[Reports API] POST error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to generate report', details: error.message },
      { status: 500 }
    )
  }
}
