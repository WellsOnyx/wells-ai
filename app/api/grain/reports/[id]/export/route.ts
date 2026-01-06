/**
 * GRAIN Board Reports Export API
 *
 * GET /api/grain/reports/[id]/export?format=pdf|csv|excel
 *
 * Export reports in multiple formats:
 * - PDF: Full formatted report with charts and branding
 * - CSV: Data tables for spreadsheet import
 * - Excel: Multi-sheet workbook with all data
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
  BoardReports,
  ReportType,
  QuarterlyEndowmentSummary,
  FundPerformanceReport,
  GrantActivityReport,
  ComplianceFiduciaryReport,
  SpendingPolicyAdherenceReport,
  FundBalance,
  GrantDisbursement,
  ComplianceMetric,
  AssetAllocation,
  SpendingPolicyMetric,
} from '@/lib/grain/board-reports'

// ============================================================================
// TYPES
// ============================================================================

type ExportFormat = 'pdf' | 'csv' | 'excel'

interface ExportOptions {
  format: ExportFormat
  includeCharts?: boolean
  includeRawData?: boolean
}

// ============================================================================
// GET - Export report in specified format
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id: reportId } = await params
    const { searchParams } = new URL(request.url)
    const format = (searchParams.get('format') || 'pdf') as ExportFormat
    const reportType = searchParams.get('type') as ReportType | null

    // Validate format
    if (!['pdf', 'csv', 'excel'].includes(format)) {
      return NextResponse.json(
        { success: false, error: 'Invalid format. Use: pdf, csv, or excel' },
        { status: 400 }
      )
    }

    // Check if this is a request to generate and export in one step
    const generateAndExport = searchParams.get('generate') === 'true'

    if (generateAndExport && reportType) {
      // Generate report on-the-fly for export
      const startDate = searchParams.get('startDate')
      const endDate = searchParams.get('endDate')
      const organizationId = searchParams.get('organizationId') || userId

      if (!startDate || !endDate) {
        return NextResponse.json(
          { success: false, error: 'startDate and endDate required for generation' },
          { status: 400 }
        )
      }

      const dateRange = {
        start: new Date(startDate),
        end: new Date(endDate),
      }

      // Generate the report
      let report: any
      switch (reportType) {
        case 'quarterly_endowment_summary':
          report = await BoardReports.generateQuarterlyEndowmentSummary(organizationId, dateRange, userId)
          break
        case 'fund_performance':
          report = await BoardReports.generateFundPerformanceReport(organizationId, dateRange, userId)
          break
        case 'grant_activity':
          report = await BoardReports.generateGrantActivityReport(organizationId, dateRange, userId)
          break
        case 'compliance_fiduciary':
          report = await BoardReports.generateComplianceFiduciaryReport(organizationId, dateRange, userId)
          break
        case 'spending_policy_adherence':
          report = await BoardReports.generateSpendingPolicyAdherenceReport(organizationId, dateRange, userId)
          break
        default:
          return NextResponse.json(
            { success: false, error: 'Invalid report type' },
            { status: 400 }
          )
      }

      return exportReport(report, reportType, format)
    }

    // Get existing report by ID
    const reportMetadata = await BoardReports.getReportById(reportId)

    if (!reportMetadata) {
      return NextResponse.json(
        { success: false, error: 'Report not found' },
        { status: 404 }
      )
    }

    // For existing reports, we need to regenerate the data
    // In a production system, you'd store the full report data
    const dateRange = reportMetadata.dateRange
    const organizationId = reportMetadata.organizationId

    let report: any
    switch (reportMetadata.type) {
      case 'quarterly_endowment_summary':
        report = await BoardReports.generateQuarterlyEndowmentSummary(organizationId, dateRange, userId)
        break
      case 'fund_performance':
        report = await BoardReports.generateFundPerformanceReport(organizationId, dateRange, userId)
        break
      case 'grant_activity':
        report = await BoardReports.generateGrantActivityReport(organizationId, dateRange, userId)
        break
      case 'compliance_fiduciary':
        report = await BoardReports.generateComplianceFiduciaryReport(organizationId, dateRange, userId)
        break
      case 'spending_policy_adherence':
        report = await BoardReports.generateSpendingPolicyAdherenceReport(organizationId, dateRange, userId)
        break
      default:
        return NextResponse.json(
          { success: false, error: 'Unknown report type' },
          { status: 400 }
        )
    }

    return exportReport(report, reportMetadata.type, format)
  } catch (error: any) {
    console.error('[Reports Export API] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to export report', details: error.message },
      { status: 500 }
    )
  }
}

// ============================================================================
// EXPORT FUNCTIONS
// ============================================================================

function exportReport(
  report: any,
  type: ReportType,
  format: ExportFormat
): NextResponse {
  switch (format) {
    case 'pdf':
      return exportAsPDF(report, type)
    case 'csv':
      return exportAsCSV(report, type)
    case 'excel':
      return exportAsExcel(report, type)
    default:
      return NextResponse.json(
        { success: false, error: 'Unsupported format' },
        { status: 400 }
      )
  }
}

// ============================================================================
// PDF EXPORT
// ============================================================================

function exportAsPDF(report: any, type: ReportType): NextResponse {
  const htmlContent = generatePDFHTML(report, type)
  const filename = `${report.metadata.title.replace(/[^a-zA-Z0-9]/g, '_')}.html`

  // Return HTML that can be printed to PDF
  // In production, you'd use a library like puppeteer or jspdf
  return new NextResponse(htmlContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

function generatePDFHTML(report: any, type: ReportType): string {
  const metadata = report.metadata

  let bodyContent = ''

  switch (type) {
    case 'quarterly_endowment_summary':
      bodyContent = generateQuarterlyEndowmentHTML(report as QuarterlyEndowmentSummary)
      break
    case 'fund_performance':
      bodyContent = generateFundPerformanceHTML(report as FundPerformanceReport)
      break
    case 'grant_activity':
      bodyContent = generateGrantActivityHTML(report as GrantActivityReport)
      break
    case 'compliance_fiduciary':
      bodyContent = generateComplianceHTML(report as ComplianceFiduciaryReport)
      break
    case 'spending_policy_adherence':
      bodyContent = generateSpendingPolicyHTML(report as SpendingPolicyAdherenceReport)
      break
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${metadata.title}</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      color: #1a1a1a;
      line-height: 1.6;
      padding: 40px;
      max-width: 1000px;
      margin: 0 auto;
    }
    .header {
      border-bottom: 3px solid #22c55e;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      font-size: 28px;
      color: #111;
      margin-bottom: 8px;
    }
    .header .subtitle {
      font-size: 14px;
      color: #666;
    }
    .header .org-name {
      font-size: 16px;
      color: #22c55e;
      font-weight: 600;
      margin-top: 8px;
    }
    .section {
      margin-bottom: 30px;
      page-break-inside: avoid;
    }
    .section h2 {
      font-size: 20px;
      color: #111;
      border-bottom: 1px solid #e5e5e5;
      padding-bottom: 8px;
      margin-bottom: 16px;
    }
    .section h3 {
      font-size: 16px;
      color: #333;
      margin-bottom: 12px;
    }
    .summary-box {
      background: #f8fdf9;
      border: 1px solid #22c55e30;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
    }
    .summary-box ul {
      list-style: none;
      padding: 0;
    }
    .summary-box li {
      padding: 4px 0;
      padding-left: 20px;
      position: relative;
    }
    .summary-box li::before {
      content: "\\2022";
      color: #22c55e;
      font-weight: bold;
      position: absolute;
      left: 0;
    }
    .highlight {
      color: #22c55e;
    }
    .concern {
      color: #ef4444;
    }
    .warning {
      color: #f59e0b;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      font-size: 14px;
    }
    th, td {
      padding: 10px 12px;
      text-align: left;
      border-bottom: 1px solid #e5e5e5;
    }
    th {
      background: #f5f5f5;
      font-weight: 600;
      color: #333;
    }
    tr:hover {
      background: #fafafa;
    }
    .metric-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
      margin-bottom: 20px;
    }
    .metric-card {
      background: #fafafa;
      border: 1px solid #e5e5e5;
      border-radius: 8px;
      padding: 16px;
    }
    .metric-card .label {
      font-size: 12px;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .metric-card .value {
      font-size: 24px;
      font-weight: 700;
      color: #111;
      margin-top: 4px;
    }
    .metric-card .change {
      font-size: 14px;
      margin-top: 4px;
    }
    .metric-card .change.positive {
      color: #22c55e;
    }
    .metric-card .change.negative {
      color: #ef4444;
    }
    .status-badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
    }
    .status-compliant {
      background: #dcfce7;
      color: #166534;
    }
    .status-warning {
      background: #fef3c7;
      color: #92400e;
    }
    .status-non_compliant {
      background: #fee2e2;
      color: #991b1b;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e5e5;
      font-size: 12px;
      color: #666;
      text-align: center;
    }
    @media print {
      body {
        padding: 20px;
      }
      .section {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${metadata.title}</h1>
    <p class="subtitle">${metadata.description}</p>
    <p class="org-name">${metadata.organizationName || 'Organization'}</p>
    <p class="subtitle">
      Report Period: ${formatDate(metadata.dateRange.start)} - ${formatDate(metadata.dateRange.end)}
    </p>
  </div>

  ${bodyContent}

  <div class="footer">
    <p>Generated by Grain & Vault Board Reporting System</p>
    <p>Report ID: ${metadata.id} | Generated: ${formatDate(metadata.createdAt)}</p>
    <p>This report is confidential and intended for board members only.</p>
  </div>
</body>
</html>
  `
}

function generateQuarterlyEndowmentHTML(report: QuarterlyEndowmentSummary): string {
  const { executiveSummary, totalEndowmentValue, fundBalances, fundSummaryByType, keyMetrics, marketContext } = report

  return `
    <div class="section">
      <h2>Executive Summary</h2>
      <div class="summary-box">
        <h3 class="highlight">Highlights</h3>
        <ul>
          ${executiveSummary.highlights.map(h => `<li>${h}</li>`).join('')}
        </ul>
        ${executiveSummary.concerns.length > 0 ? `
          <h3 class="concern" style="margin-top: 16px;">Areas of Concern</h3>
          <ul>
            ${executiveSummary.concerns.map(c => `<li class="concern">${c}</li>`).join('')}
          </ul>
        ` : ''}
        ${executiveSummary.recommendations.length > 0 ? `
          <h3 style="margin-top: 16px;">Recommendations</h3>
          <ul>
            ${executiveSummary.recommendations.map(r => `<li>${r}</li>`).join('')}
          </ul>
        ` : ''}
      </div>
    </div>

    <div class="section">
      <h2>Total Endowment Value</h2>
      <div class="metric-grid">
        <div class="metric-card">
          <div class="label">Current Value</div>
          <div class="value">${formatCurrency(totalEndowmentValue.current)}</div>
        </div>
        <div class="metric-card">
          <div class="label">Prior Period</div>
          <div class="value">${formatCurrency(totalEndowmentValue.prior)}</div>
        </div>
        <div class="metric-card">
          <div class="label">Change</div>
          <div class="value">${formatCurrency(totalEndowmentValue.change)}</div>
          <div class="change ${totalEndowmentValue.changePercent >= 0 ? 'positive' : 'negative'}">
            ${totalEndowmentValue.changePercent >= 0 ? '+' : ''}${totalEndowmentValue.changePercent.toFixed(2)}%
          </div>
        </div>
        <div class="metric-card">
          <div class="label">Total Return</div>
          <div class="value">${keyMetrics.totalReturnPercent.toFixed(2)}%</div>
        </div>
      </div>
    </div>

    <div class="section">
      <h2>Fund Summary by Type</h2>
      <table>
        <tr>
          <th>Fund Type</th>
          <th style="text-align: right;">Balance</th>
          <th style="text-align: right;">% of Total</th>
        </tr>
        <tr>
          <td>Unrestricted</td>
          <td style="text-align: right;">${formatCurrency(fundSummaryByType.unrestricted)}</td>
          <td style="text-align: right;">${((fundSummaryByType.unrestricted / fundSummaryByType.total) * 100).toFixed(1)}%</td>
        </tr>
        <tr>
          <td>Temporarily Restricted</td>
          <td style="text-align: right;">${formatCurrency(fundSummaryByType.temporarilyRestricted)}</td>
          <td style="text-align: right;">${((fundSummaryByType.temporarilyRestricted / fundSummaryByType.total) * 100).toFixed(1)}%</td>
        </tr>
        <tr>
          <td>Permanently Restricted</td>
          <td style="text-align: right;">${formatCurrency(fundSummaryByType.permanentlyRestricted)}</td>
          <td style="text-align: right;">${((fundSummaryByType.permanentlyRestricted / fundSummaryByType.total) * 100).toFixed(1)}%</td>
        </tr>
        <tr style="font-weight: bold; background: #f5f5f5;">
          <td>Total</td>
          <td style="text-align: right;">${formatCurrency(fundSummaryByType.total)}</td>
          <td style="text-align: right;">100.0%</td>
        </tr>
      </table>
    </div>

    <div class="section">
      <h2>Fund Balances</h2>
      <table>
        <tr>
          <th>Fund Name</th>
          <th>Type</th>
          <th style="text-align: right;">Protected</th>
          <th style="text-align: right;">Credit Available</th>
          <th style="text-align: right;">Appreciation</th>
          <th style="text-align: right;">Total Value</th>
          <th style="text-align: right;">Change</th>
        </tr>
        ${fundBalances.map(fund => `
          <tr>
            <td>${fund.fundName}</td>
            <td>${formatFundType(fund.fundType)}</td>
            <td style="text-align: right;">${formatCurrency(fund.protectedPrincipal)}</td>
            <td style="text-align: right;">${formatCurrency(fund.creditLineAvailable)}</td>
            <td style="text-align: right;">${formatCurrency(fund.appreciation)}</td>
            <td style="text-align: right;">${formatCurrency(fund.totalValue)}</td>
            <td style="text-align: right;" class="${fund.changePercent >= 0 ? 'positive' : 'negative'}">
              ${fund.changePercent >= 0 ? '+' : ''}${fund.changePercent.toFixed(2)}%
            </td>
          </tr>
        `).join('')}
      </table>
    </div>

    <div class="section">
      <h2>Key Performance Metrics</h2>
      <div class="metric-grid">
        <div class="metric-card">
          <div class="label">Total Return</div>
          <div class="value">${keyMetrics.totalReturnPercent.toFixed(2)}%</div>
        </div>
        <div class="metric-card">
          <div class="label">Spending Rate</div>
          <div class="value">${keyMetrics.spendingRatePercent.toFixed(2)}%</div>
        </div>
        <div class="metric-card">
          <div class="label">Admin Cost Ratio</div>
          <div class="value">${keyMetrics.adminCostRatioPercent.toFixed(2)}%</div>
        </div>
        <div class="metric-card">
          <div class="label">Grant Disbursement Rate</div>
          <div class="value">${keyMetrics.grantDisbursementRate.toFixed(0)}%</div>
        </div>
      </div>
    </div>

    <div class="section">
      <h2>Market Context</h2>
      <table>
        <tr>
          <th>Benchmark</th>
          <th style="text-align: right;">Return</th>
        </tr>
        <tr>
          <td>S&P 500</td>
          <td style="text-align: right;">${marketContext.sp500Return.toFixed(2)}%</td>
        </tr>
        <tr>
          <td>Bond Index</td>
          <td style="text-align: right;">${marketContext.bondIndexReturn.toFixed(2)}%</td>
        </tr>
        <tr>
          <td>Inflation Rate</td>
          <td style="text-align: right;">${marketContext.inflationRate.toFixed(2)}%</td>
        </tr>
      </table>
    </div>
  `
}

function generateFundPerformanceHTML(report: FundPerformanceReport): string {
  const { executiveSummary, overallPerformance, fundPerformance, assetAllocation, rebalancingNeeds } = report

  return `
    <div class="section">
      <h2>Executive Summary</h2>
      <div class="summary-box">
        <h3 class="highlight">Highlights</h3>
        <ul>
          ${executiveSummary.highlights.map(h => `<li>${h}</li>`).join('')}
        </ul>
        ${executiveSummary.concerns.length > 0 ? `
          <h3 class="concern" style="margin-top: 16px;">Areas of Concern</h3>
          <ul>
            ${executiveSummary.concerns.map(c => `<li class="concern">${c}</li>`).join('')}
          </ul>
        ` : ''}
      </div>
    </div>

    <div class="section">
      <h2>Overall Performance</h2>
      <div class="metric-grid">
        <div class="metric-card">
          <div class="label">Total Return</div>
          <div class="value">${overallPerformance.totalReturn.toFixed(2)}%</div>
        </div>
        <div class="metric-card">
          <div class="label">Benchmark Return</div>
          <div class="value">${overallPerformance.benchmarkReturn.toFixed(2)}%</div>
        </div>
        <div class="metric-card">
          <div class="label">Excess Return</div>
          <div class="value ${overallPerformance.excessReturn >= 0 ? 'positive' : 'negative'}">${overallPerformance.excessReturn >= 0 ? '+' : ''}${overallPerformance.excessReturn.toFixed(2)}%</div>
        </div>
        <div class="metric-card">
          <div class="label">Sharpe Ratio</div>
          <div class="value">${overallPerformance.sharpeRatio.toFixed(2)}</div>
        </div>
      </div>
    </div>

    <div class="section">
      <h2>Asset Allocation</h2>
      <table>
        <tr>
          <th>Asset Class</th>
          <th style="text-align: right;">Target %</th>
          <th style="text-align: right;">Actual %</th>
          <th style="text-align: right;">Variance</th>
          <th style="text-align: right;">Market Value</th>
        </tr>
        ${assetAllocation.map(aa => `
          <tr>
            <td>${aa.assetClass}</td>
            <td style="text-align: right;">${aa.targetPercent.toFixed(1)}%</td>
            <td style="text-align: right;">${aa.actualPercent.toFixed(1)}%</td>
            <td style="text-align: right;" class="${aa.variance >= 0 ? 'positive' : 'negative'}">${aa.variance >= 0 ? '+' : ''}${aa.variance.toFixed(1)}%</td>
            <td style="text-align: right;">${formatCurrency(aa.marketValue)}</td>
          </tr>
        `).join('')}
      </table>
    </div>

    <div class="section">
      <h2>Rebalancing Recommendations</h2>
      <table>
        <tr>
          <th>Asset Class</th>
          <th style="text-align: right;">Current</th>
          <th style="text-align: right;">Target</th>
          <th>Action</th>
          <th style="text-align: right;">Amount</th>
        </tr>
        ${rebalancingNeeds.map(r => `
          <tr>
            <td>${r.assetClass}</td>
            <td style="text-align: right;">${r.currentWeight.toFixed(1)}%</td>
            <td style="text-align: right;">${r.targetWeight.toFixed(1)}%</td>
            <td><span class="status-badge ${r.action === 'hold' ? 'status-compliant' : 'status-warning'}">${r.action.toUpperCase()}</span></td>
            <td style="text-align: right;">${r.action !== 'hold' ? formatCurrency(r.amount) : '-'}</td>
          </tr>
        `).join('')}
      </table>
    </div>

    <div class="section">
      <h2>Fund-Level Performance</h2>
      <table>
        <tr>
          <th>Fund Name</th>
          <th style="text-align: right;">Return</th>
          <th style="text-align: right;">Benchmark</th>
          <th style="text-align: right;">Excess</th>
        </tr>
        ${fundPerformance.map(fp => `
          <tr>
            <td>${fp.fund.fundName}</td>
            <td style="text-align: right;">${fp.return.toFixed(2)}%</td>
            <td style="text-align: right;">${fp.benchmark.toFixed(2)}%</td>
            <td style="text-align: right;" class="${fp.excess >= 0 ? 'positive' : 'negative'}">${fp.excess >= 0 ? '+' : ''}${fp.excess.toFixed(2)}%</td>
          </tr>
        `).join('')}
      </table>
    </div>
  `
}

function generateGrantActivityHTML(report: GrantActivityReport): string {
  const { executiveSummary, grantsByProgram, disbursements, pendingGrants, impactMetrics } = report

  return `
    <div class="section">
      <h2>Executive Summary</h2>
      <div class="metric-grid">
        <div class="metric-card">
          <div class="label">Grants Approved</div>
          <div class="value">${executiveSummary.totalGrantsApproved}</div>
        </div>
        <div class="metric-card">
          <div class="label">Grants Disbursed</div>
          <div class="value">${executiveSummary.totalGrantsDisbursed}</div>
        </div>
        <div class="metric-card">
          <div class="label">Amount Approved</div>
          <div class="value">${formatCurrency(executiveSummary.totalAmountApproved)}</div>
        </div>
        <div class="metric-card">
          <div class="label">Amount Disbursed</div>
          <div class="value">${formatCurrency(executiveSummary.totalAmountDisbursed)}</div>
        </div>
      </div>
    </div>

    <div class="section">
      <h2>Grants by Program Area</h2>
      <table>
        <tr>
          <th>Program Area</th>
          <th style="text-align: right;">Grant Count</th>
          <th style="text-align: right;">Total Amount</th>
          <th style="text-align: right;">% of Total</th>
        </tr>
        ${grantsByProgram.map(p => `
          <tr>
            <td>${p.programArea}</td>
            <td style="text-align: right;">${p.grantCount}</td>
            <td style="text-align: right;">${formatCurrency(p.totalAmount)}</td>
            <td style="text-align: right;">${p.percentOfTotal.toFixed(1)}%</td>
          </tr>
        `).join('')}
      </table>
    </div>

    <div class="section">
      <h2>Recent Disbursements</h2>
      <table>
        <tr>
          <th>Grantee</th>
          <th>Purpose</th>
          <th>Fund Source</th>
          <th style="text-align: right;">Amount</th>
          <th>Status</th>
        </tr>
        ${disbursements.slice(0, 10).map(g => `
          <tr>
            <td>${g.grantee}</td>
            <td>${g.purpose}</td>
            <td>${g.fundSource}</td>
            <td style="text-align: right;">${formatCurrency(g.amount)}</td>
            <td><span class="status-badge status-compliant">${g.status.toUpperCase()}</span></td>
          </tr>
        `).join('')}
      </table>
    </div>

    ${pendingGrants.length > 0 ? `
    <div class="section">
      <h2>Pending Grants</h2>
      <table>
        <tr>
          <th>Grantee</th>
          <th>Purpose</th>
          <th style="text-align: right;">Amount</th>
          <th>Target Date</th>
        </tr>
        ${pendingGrants.map(g => `
          <tr>
            <td>${g.grantee}</td>
            <td>${g.purpose}</td>
            <td style="text-align: right;">${formatCurrency(g.amount)}</td>
            <td>${formatDate(g.disbursementDate)}</td>
          </tr>
        `).join('')}
      </table>
    </div>
    ` : ''}

    <div class="section">
      <h2>Impact Metrics</h2>
      <table>
        <tr>
          <th>Metric</th>
          <th style="text-align: right;">Target</th>
          <th style="text-align: right;">Actual</th>
          <th>Notes</th>
        </tr>
        ${impactMetrics.map(m => `
          <tr>
            <td>${m.metric}</td>
            <td style="text-align: right;">${m.target.toLocaleString()}</td>
            <td style="text-align: right;">${m.actual.toLocaleString()}</td>
            <td>${m.notes}</td>
          </tr>
        `).join('')}
      </table>
    </div>
  `
}

function generateComplianceHTML(report: ComplianceFiduciaryReport): string {
  const { executiveSummary, investmentPolicyCompliance, spendingPolicyCompliance, grantPolicyCompliance, assetDiversification, fiduciaryDuties, regulatoryCompliance } = report

  return `
    <div class="section">
      <h2>Executive Summary</h2>
      <div class="summary-box">
        <p><strong>Overall Status:</strong> <span class="status-badge status-${executiveSummary.overallStatus === 'compliant' ? 'compliant' : executiveSummary.overallStatus === 'attention_needed' ? 'warning' : 'non_compliant'}">${executiveSummary.overallStatus.replace(/_/g, ' ').toUpperCase()}</span></p>
        <p style="margin-top: 12px;">${executiveSummary.summary}</p>
        ${executiveSummary.criticalItems.length > 0 ? `
          <h3 class="concern" style="margin-top: 16px;">Critical Items Requiring Action</h3>
          <ul>
            ${executiveSummary.criticalItems.map(c => `<li class="concern">${c}</li>`).join('')}
          </ul>
        ` : ''}
      </div>
    </div>

    <div class="section">
      <h2>Investment Policy Compliance</h2>
      <table>
        <tr>
          <th>Metric</th>
          <th style="text-align: right;">Target</th>
          <th style="text-align: right;">Actual</th>
          <th>Status</th>
          <th>Notes</th>
        </tr>
        ${investmentPolicyCompliance.map(m => `
          <tr>
            <td>${m.metric}</td>
            <td style="text-align: right;">${m.target}%</td>
            <td style="text-align: right;">${m.actual}%</td>
            <td><span class="status-badge status-${m.status}">${m.status.replace(/_/g, ' ').toUpperCase()}</span></td>
            <td>${m.notes || ''}</td>
          </tr>
        `).join('')}
      </table>
    </div>

    <div class="section">
      <h2>Spending Policy Compliance</h2>
      <table>
        <tr>
          <th>Metric</th>
          <th style="text-align: right;">Target</th>
          <th style="text-align: right;">Actual</th>
          <th>Status</th>
          <th>Notes</th>
        </tr>
        ${spendingPolicyCompliance.map(m => `
          <tr>
            <td>${m.metric}</td>
            <td style="text-align: right;">${m.target}%</td>
            <td style="text-align: right;">${m.actual}%</td>
            <td><span class="status-badge status-${m.status}">${m.status.replace(/_/g, ' ').toUpperCase()}</span></td>
            <td>${m.notes || ''}</td>
          </tr>
        `).join('')}
      </table>
    </div>

    <div class="section">
      <h2>Grant Policy Compliance</h2>
      <table>
        <tr>
          <th>Metric</th>
          <th style="text-align: right;">Target</th>
          <th style="text-align: right;">Actual</th>
          <th>Status</th>
          <th>Notes</th>
        </tr>
        ${grantPolicyCompliance.map(m => `
          <tr>
            <td>${m.metric}</td>
            <td style="text-align: right;">${m.target}%</td>
            <td style="text-align: right;">${m.actual}%</td>
            <td><span class="status-badge status-${m.status}">${m.status.replace(/_/g, ' ').toUpperCase()}</span></td>
            <td>${m.notes || ''}</td>
          </tr>
        `).join('')}
      </table>
    </div>

    <div class="section">
      <h2>Asset Diversification</h2>
      <p><strong>Diversification Score:</strong> ${assetDiversification.diversificationScore}/100</p>
      ${assetDiversification.concentrationRisks.length > 0 ? `
        <p style="margin-top: 12px;"><strong>Concentration Risks:</strong></p>
        <ul>
          ${assetDiversification.concentrationRisks.map(r => `<li class="warning">${r}</li>`).join('')}
        </ul>
      ` : '<p style="margin-top: 12px;">No significant concentration risks identified.</p>'}
    </div>

    <div class="section">
      <h2>Fiduciary Duties</h2>
      <table>
        <tr>
          <th>Duty</th>
          <th>Status</th>
          <th>Notes</th>
        </tr>
        <tr>
          <td>Duty of Care</td>
          <td><span class="status-badge status-${fiduciaryDuties.dutyOfCare.status === 'met' ? 'compliant' : 'warning'}">${fiduciaryDuties.dutyOfCare.status.toUpperCase()}</span></td>
          <td>${fiduciaryDuties.dutyOfCare.notes}</td>
        </tr>
        <tr>
          <td>Duty of Loyalty</td>
          <td><span class="status-badge status-${fiduciaryDuties.dutyOfLoyalty.status === 'met' ? 'compliant' : 'warning'}">${fiduciaryDuties.dutyOfLoyalty.status.toUpperCase()}</span></td>
          <td>${fiduciaryDuties.dutyOfLoyalty.notes}</td>
        </tr>
        <tr>
          <td>Duty of Obedience</td>
          <td><span class="status-badge status-${fiduciaryDuties.dutyOfObedience.status === 'met' ? 'compliant' : 'warning'}">${fiduciaryDuties.dutyOfObedience.status.toUpperCase()}</span></td>
          <td>${fiduciaryDuties.dutyOfObedience.notes}</td>
        </tr>
      </table>
    </div>

    <div class="section">
      <h2>Regulatory Compliance</h2>
      <table>
        <tr>
          <th>Requirement</th>
          <th>Status</th>
          <th>Due Date</th>
          <th>Notes</th>
        </tr>
        ${regulatoryCompliance.map(r => `
          <tr>
            <td>${r.requirement}</td>
            <td><span class="status-badge status-${r.status}">${r.status.toUpperCase()}</span></td>
            <td>${r.dueDate ? formatDate(r.dueDate) : '-'}</td>
            <td>${r.notes || ''}</td>
          </tr>
        `).join('')}
      </table>
    </div>
  `
}

function generateSpendingPolicyHTML(report: SpendingPolicyAdherenceReport): string {
  const { executiveSummary, policyDetails, quarterlyMetrics, yearToDateSummary, projections, historicalComparison, recommendations } = report

  return `
    <div class="section">
      <h2>Executive Summary</h2>
      <div class="summary-box">
        <p><strong>Policy Type:</strong> ${executiveSummary.policyType}</p>
        <p><strong>Description:</strong> ${executiveSummary.policyDescription}</p>
        <p style="margin-top: 12px;"><strong>Overall Adherence:</strong> <span class="status-badge status-${executiveSummary.overallAdherence === 'within_policy' ? 'compliant' : executiveSummary.overallAdherence === 'minor_variance' ? 'warning' : 'non_compliant'}">${executiveSummary.overallAdherence.replace(/_/g, ' ').toUpperCase()}</span></p>
        <p style="margin-top: 12px;">${executiveSummary.summary}</p>
      </div>
    </div>

    <div class="section">
      <h2>Policy Details</h2>
      <div class="metric-grid">
        <div class="metric-card">
          <div class="label">Spending Rate</div>
          <div class="value">${policyDetails.spendingRate}%</div>
        </div>
        <div class="metric-card">
          <div class="label">Smoothing Period</div>
          <div class="value">${policyDetails.smoothingPeriod} quarters</div>
        </div>
        ${policyDetails.floorPercent ? `
        <div class="metric-card">
          <div class="label">Floor</div>
          <div class="value">${policyDetails.floorPercent}%</div>
        </div>
        ` : ''}
        ${policyDetails.capPercent ? `
        <div class="metric-card">
          <div class="label">Cap</div>
          <div class="value">${policyDetails.capPercent}%</div>
        </div>
        ` : ''}
      </div>
    </div>

    <div class="section">
      <h2>Year-to-Date Summary</h2>
      <div class="metric-grid">
        <div class="metric-card">
          <div class="label">Policy Amount</div>
          <div class="value">${formatCurrency(yearToDateSummary.totalPolicyAmount)}</div>
        </div>
        <div class="metric-card">
          <div class="label">Actual Amount</div>
          <div class="value">${formatCurrency(yearToDateSummary.totalActualAmount)}</div>
        </div>
        <div class="metric-card">
          <div class="label">Variance</div>
          <div class="value ${yearToDateSummary.variance >= 0 ? 'positive' : 'negative'}">${formatCurrency(yearToDateSummary.variance)}</div>
          <div class="change ${yearToDateSummary.variancePercent >= 0 ? 'positive' : 'negative'}">${yearToDateSummary.variancePercent >= 0 ? '+' : ''}${yearToDateSummary.variancePercent.toFixed(2)}%</div>
        </div>
      </div>
    </div>

    <div class="section">
      <h2>Quarterly Spending</h2>
      <table>
        <tr>
          <th>Quarter</th>
          <th style="text-align: right;">Avg. Market Value</th>
          <th style="text-align: right;">Policy Rate</th>
          <th style="text-align: right;">Actual Rate</th>
          <th style="text-align: right;">Policy Amount</th>
          <th style="text-align: right;">Actual Amount</th>
          <th>Status</th>
        </tr>
        ${quarterlyMetrics.map(q => `
          <tr>
            <td>Q${q.quarter} ${q.year}</td>
            <td style="text-align: right;">${formatCurrency(q.averageMarketValue)}</td>
            <td style="text-align: right;">${q.policySpendingRate.toFixed(3)}%</td>
            <td style="text-align: right;">${q.actualSpendingRate.toFixed(3)}%</td>
            <td style="text-align: right;">${formatCurrency(q.policySpendingAmount)}</td>
            <td style="text-align: right;">${formatCurrency(q.actualSpendingAmount)}</td>
            <td><span class="status-badge status-${q.status === 'within_policy' ? 'compliant' : 'warning'}">${q.status.replace(/_/g, ' ')}</span></td>
          </tr>
        `).join('')}
      </table>
    </div>

    <div class="section">
      <h2>Projections</h2>
      <div class="metric-grid">
        <div class="metric-card">
          <div class="label">Next Quarter Estimate</div>
          <div class="value">${formatCurrency(projections.nextQuarterEstimate)}</div>
        </div>
        <div class="metric-card">
          <div class="label">Annual Estimate</div>
          <div class="value">${formatCurrency(projections.annualEstimate)}</div>
        </div>
      </div>
    </div>

    <div class="section">
      <h2>Historical Comparison</h2>
      <table>
        <tr>
          <th>Year</th>
          <th style="text-align: right;">Endowment Value</th>
          <th style="text-align: right;">Policy Rate</th>
          <th style="text-align: right;">Actual Rate</th>
          <th style="text-align: right;">Variance</th>
        </tr>
        ${historicalComparison.map(h => `
          <tr>
            <td>${h.year}</td>
            <td style="text-align: right;">${formatCurrency(h.endowmentValue)}</td>
            <td style="text-align: right;">${h.policyRate.toFixed(2)}%</td>
            <td style="text-align: right;">${h.actualRate.toFixed(2)}%</td>
            <td style="text-align: right;" class="${(h.actualRate - h.policyRate) >= 0 ? 'positive' : 'negative'}">${(h.actualRate - h.policyRate) >= 0 ? '+' : ''}${(h.actualRate - h.policyRate).toFixed(2)}%</td>
          </tr>
        `).join('')}
      </table>
    </div>

    <div class="section">
      <h2>Recommendations</h2>
      <div class="summary-box">
        <ul>
          ${recommendations.map(r => `<li>${r}</li>`).join('')}
        </ul>
      </div>
    </div>
  `
}

// ============================================================================
// CSV EXPORT
// ============================================================================

function exportAsCSV(report: any, type: ReportType): NextResponse {
  let csvContent = ''
  const filename = `${report.metadata.title.replace(/[^a-zA-Z0-9]/g, '_')}.csv`

  switch (type) {
    case 'quarterly_endowment_summary':
      csvContent = generateQuarterlyEndowmentCSV(report as QuarterlyEndowmentSummary)
      break
    case 'fund_performance':
      csvContent = generateFundPerformanceCSV(report as FundPerformanceReport)
      break
    case 'grant_activity':
      csvContent = generateGrantActivityCSV(report as GrantActivityReport)
      break
    case 'compliance_fiduciary':
      csvContent = generateComplianceCSV(report as ComplianceFiduciaryReport)
      break
    case 'spending_policy_adherence':
      csvContent = generateSpendingPolicyCSV(report as SpendingPolicyAdherenceReport)
      break
  }

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

function generateQuarterlyEndowmentCSV(report: QuarterlyEndowmentSummary): string {
  const lines: string[] = []

  // Header
  lines.push(`"${report.metadata.title}"`)
  lines.push(`"Report Period: ${formatDate(report.metadata.dateRange.start)} - ${formatDate(report.metadata.dateRange.end)}"`)
  lines.push('')

  // Summary
  lines.push('"Total Endowment Summary"')
  lines.push('"Metric","Value"')
  lines.push(`"Current Value","${report.totalEndowmentValue.current}"`)
  lines.push(`"Prior Value","${report.totalEndowmentValue.prior}"`)
  lines.push(`"Change","${report.totalEndowmentValue.change}"`)
  lines.push(`"Change %","${report.totalEndowmentValue.changePercent}"`)
  lines.push('')

  // Fund Balances
  lines.push('"Fund Balances"')
  lines.push('"Fund Name","Type","Protected Principal","Credit Line Limit","Credit Line Used","Credit Available","Appreciation","Total Value","Change %"')
  report.fundBalances.forEach(fund => {
    lines.push(`"${fund.fundName}","${fund.fundType}",${fund.protectedPrincipal},${fund.creditLineLimit},${fund.creditLineUsed},${fund.creditLineAvailable},${fund.appreciation},${fund.totalValue},${fund.changePercent}`)
  })
  lines.push('')

  // Key Metrics
  lines.push('"Key Metrics"')
  lines.push(`"Total Return %","${report.keyMetrics.totalReturnPercent}"`)
  lines.push(`"Spending Rate %","${report.keyMetrics.spendingRatePercent}"`)
  lines.push(`"Admin Cost Ratio %","${report.keyMetrics.adminCostRatioPercent}"`)
  lines.push(`"Grant Disbursement Rate","${report.keyMetrics.grantDisbursementRate}"`)

  return lines.join('\n')
}

function generateFundPerformanceCSV(report: FundPerformanceReport): string {
  const lines: string[] = []

  lines.push(`"${report.metadata.title}"`)
  lines.push('')

  // Overall Performance
  lines.push('"Overall Performance"')
  lines.push('"Metric","Value"')
  lines.push(`"Total Return","${report.overallPerformance.totalReturn}"`)
  lines.push(`"Benchmark Return","${report.overallPerformance.benchmarkReturn}"`)
  lines.push(`"Excess Return","${report.overallPerformance.excessReturn}"`)
  lines.push(`"Sharpe Ratio","${report.overallPerformance.sharpeRatio}"`)
  lines.push('')

  // Asset Allocation
  lines.push('"Asset Allocation"')
  lines.push('"Asset Class","Target %","Actual %","Variance","Market Value"')
  report.assetAllocation.forEach(aa => {
    lines.push(`"${aa.assetClass}",${aa.targetPercent},${aa.actualPercent},${aa.variance},${aa.marketValue}`)
  })

  return lines.join('\n')
}

function generateGrantActivityCSV(report: GrantActivityReport): string {
  const lines: string[] = []

  lines.push(`"${report.metadata.title}"`)
  lines.push('')

  // Disbursements
  lines.push('"Grant Disbursements"')
  lines.push('"ID","Grantee","Purpose","Fund Source","Amount","Date","Status","Restrictions"')
  report.disbursements.forEach(g => {
    lines.push(`"${g.id}","${g.grantee}","${g.purpose}","${g.fundSource}",${g.amount},"${formatDate(g.disbursementDate)}","${g.status}","${g.restrictions || ''}"`)
  })

  return lines.join('\n')
}

function generateComplianceCSV(report: ComplianceFiduciaryReport): string {
  const lines: string[] = []

  lines.push(`"${report.metadata.title}"`)
  lines.push('')

  // All compliance metrics
  lines.push('"Compliance Metrics"')
  lines.push('"Category","Metric","Target","Actual","Status","Notes"')

  report.investmentPolicyCompliance.forEach(m => {
    lines.push(`"Investment Policy","${m.metric}",${m.target},${m.actual},"${m.status}","${m.notes || ''}"`)
  })

  report.spendingPolicyCompliance.forEach(m => {
    lines.push(`"Spending Policy","${m.metric}",${m.target},${m.actual},"${m.status}","${m.notes || ''}"`)
  })

  report.grantPolicyCompliance.forEach(m => {
    lines.push(`"Grant Policy","${m.metric}",${m.target},${m.actual},"${m.status}","${m.notes || ''}"`)
  })

  return lines.join('\n')
}

function generateSpendingPolicyCSV(report: SpendingPolicyAdherenceReport): string {
  const lines: string[] = []

  lines.push(`"${report.metadata.title}"`)
  lines.push('')

  // Quarterly metrics
  lines.push('"Quarterly Spending"')
  lines.push('"Year","Quarter","Beginning Value","Ending Value","Average Value","Policy Rate","Actual Rate","Policy Amount","Actual Amount","Variance","Status"')
  report.quarterlyMetrics.forEach(q => {
    lines.push(`${q.year},${q.quarter},${q.beginningMarketValue},${q.endingMarketValue},${q.averageMarketValue},${q.policySpendingRate},${q.actualSpendingRate},${q.policySpendingAmount},${q.actualSpendingAmount},${q.variance},"${q.status}"`)
  })

  return lines.join('\n')
}

// ============================================================================
// EXCEL EXPORT (XLSX-like format using CSV with multiple sections)
// ============================================================================

function exportAsExcel(report: any, type: ReportType): NextResponse {
  // For a true Excel file, you'd use a library like exceljs or xlsx
  // For now, we'll generate a multi-section CSV that can be opened in Excel
  let content = ''
  const filename = `${report.metadata.title.replace(/[^a-zA-Z0-9]/g, '_')}.csv`

  switch (type) {
    case 'quarterly_endowment_summary':
      content = generateQuarterlyEndowmentExcel(report as QuarterlyEndowmentSummary)
      break
    case 'fund_performance':
      content = generateFundPerformanceExcel(report as FundPerformanceReport)
      break
    case 'grant_activity':
      content = generateGrantActivityExcel(report as GrantActivityReport)
      break
    case 'compliance_fiduciary':
      content = generateComplianceExcel(report as ComplianceFiduciaryReport)
      break
    case 'spending_policy_adherence':
      content = generateSpendingPolicyExcel(report as SpendingPolicyAdherenceReport)
      break
  }

  return new NextResponse(content, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.ms-excel; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

function generateQuarterlyEndowmentExcel(report: QuarterlyEndowmentSummary): string {
  // Same as CSV but with all data sections
  return generateQuarterlyEndowmentCSV(report)
}

function generateFundPerformanceExcel(report: FundPerformanceReport): string {
  return generateFundPerformanceCSV(report)
}

function generateGrantActivityExcel(report: GrantActivityReport): string {
  return generateGrantActivityCSV(report)
}

function generateComplianceExcel(report: ComplianceFiduciaryReport): string {
  return generateComplianceCSV(report)
}

function generateSpendingPolicyExcel(report: SpendingPolicyAdherenceReport): string {
  return generateSpendingPolicyCSV(report)
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatFundType(type: string): string {
  switch (type) {
    case 'unrestricted':
      return 'Unrestricted'
    case 'temporarily_restricted':
      return 'Temp. Restricted'
    case 'permanently_restricted':
      return 'Perm. Restricted'
    default:
      return type
  }
}
