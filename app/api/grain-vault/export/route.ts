// @ts-nocheck
/**
 * Grain & Vault Export API
 * GET: Export transaction history and statements
 * Supports: CSV, JSON, and formatted statement (HTML/PDF-ready)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { sqlQuery as sql } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = req.nextUrl.searchParams
    const format = searchParams.get('format') || 'json' // json, csv, statement
    const type = searchParams.get('type') || 'transactions' // transactions, conversions, network, statement
    const startDate = searchParams.get('start') || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const endDate = searchParams.get('end') || new Date().toISOString().split('T')[0]
    const currency = searchParams.get('currency') || 'USD'

    // Fetch data based on type
    let data: any[] = []
    let headers: string[] = []

    switch (type) {
      case 'transactions':
        const txResult = await sql`
          SELECT
            id, type, status, amount, currency,
            destination_amount, destination_currency,
            fee_amount, counterparty_name, display_title,
            category, created_at, completed_at
          FROM gv_transactions
          WHERE user_id = ${userId}
          AND DATE(created_at) >= ${startDate}::date
          AND DATE(created_at) <= ${endDate}::date
          ORDER BY created_at DESC
        `
        data = txResult.rows
        headers = [
          'ID', 'Type', 'Status', 'Amount', 'Currency',
          'Dest Amount', 'Dest Currency', 'Fee', 'Counterparty',
          'Description', 'Category', 'Date', 'Completed'
        ]
        break

      case 'conversions':
        const fxResult = await sql`
          SELECT
            id, from_currency, to_currency,
            from_amount, to_amount,
            mid_market_rate, customer_rate, rate_spread_pct,
            provider_fee_amount, platform_margin_amount, total_fee_amount,
            volume_tier, status, created_at
          FROM gv_fx_conversions
          WHERE user_id = ${userId}
          AND DATE(created_at) >= ${startDate}::date
          AND DATE(created_at) <= ${endDate}::date
          ORDER BY created_at DESC
        `
        data = fxResult.rows
        headers = [
          'ID', 'From', 'To', 'From Amount', 'To Amount',
          'Mid Rate', 'Your Rate', 'Spread %',
          'Provider Fee', 'Platform Fee', 'Total Fee',
          'Tier', 'Status', 'Date'
        ]
        break

      case 'network':
        const networkResult = await sql`
          SELECT
            nc.id, nc.level, nc.transaction_amount, nc.platform_fee,
            nc.commission_pct, nc.commission_amount, nc.grain_amount,
            nc.status, nc.created_at
          FROM network_commissions nc
          WHERE nc.recipient_id = ${userId}
          AND DATE(nc.created_at) >= ${startDate}::date
          AND DATE(nc.created_at) <= ${endDate}::date
          ORDER BY nc.created_at DESC
        `
        data = networkResult.rows
        headers = [
          'ID', 'Level', 'Transaction Amount', 'Platform Fee',
          'Commission %', 'Commission Amount', 'GRAIN Earned',
          'Status', 'Date'
        ]
        break

      case 'statement':
        // Full account statement
        return await generateStatement(userId, startDate, endDate, currency, format)

      default:
        return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    }

    // Format response based on requested format
    if (format === 'csv') {
      const csvContent = generateCSV(data, headers)
      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="grain-vault-${type}-${startDate}-${endDate}.csv"`
        }
      })
    }

    if (format === 'json') {
      return NextResponse.json({
        export: {
          type,
          startDate,
          endDate,
          currency,
          recordCount: data.length,
          generatedAt: new Date().toISOString()
        },
        data
      })
    }

    return NextResponse.json({ error: 'Invalid format' }, { status: 400 })
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json({ error: 'Failed to export data' }, { status: 500 })
  }
}

function generateCSV(data: any[], headers: string[]): string {
  if (data.length === 0) {
    return headers.join(',') + '\n'
  }

  const keys = Object.keys(data[0])
  const lines = [headers.join(',')]

  for (const row of data) {
    const values = keys.map(key => {
      const val = row[key]
      if (val === null || val === undefined) return ''
      if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
        return `"${val.replace(/"/g, '""')}"`
      }
      return val
    })
    lines.push(values.join(','))
  }

  return lines.join('\n')
}

async function generateStatement(
  userId: string,
  startDate: string,
  endDate: string,
  currency: string,
  format: string
) {
  // Get account info
  const accountResult = await sql`
    SELECT * FROM gv_user_balances WHERE user_id = ${userId}
  `

  // Get opening balance (from snapshot or calculate)
  const openingResult = await sql`
    SELECT * FROM gv_balance_snapshots
    WHERE user_id = ${userId}
    AND snapshot_date <= ${startDate}::date
    ORDER BY snapshot_date DESC LIMIT 1
  `

  // Get transactions in period
  const txResult = await sql`
    SELECT * FROM gv_transaction_history
    WHERE user_id = ${userId}
    AND DATE(created_at) >= ${startDate}::date
    AND DATE(created_at) <= ${endDate}::date
    ORDER BY created_at ASC
  `

  // Get network earnings in period
  const networkResult = await sql`
    SELECT
      COALESCE(SUM(commission_amount), 0) as total_commissions,
      COALESCE(SUM(grain_amount), 0) as total_grain
    FROM network_commissions
    WHERE recipient_id = ${userId}
    AND DATE(created_at) >= ${startDate}::date
    AND DATE(created_at) <= ${endDate}::date
    AND status = 'completed'
  `

  // Get FX conversion summary
  const fxResult = await sql`
    SELECT
      COUNT(*) as conversion_count,
      COALESCE(SUM(from_amount), 0) as total_converted,
      COALESCE(SUM(total_fee_amount), 0) as total_fx_fees
    FROM gv_fx_conversions
    WHERE user_id = ${userId}
    AND DATE(created_at) >= ${startDate}::date
    AND DATE(created_at) <= ${endDate}::date
    AND status = 'completed'
  `

  const account = accountResult.rows[0] || {}
  const opening = openingResult.rows[0]
  const network = networkResult.rows[0] || {}
  const fx = fxResult.rows[0] || {}

  // Calculate summary
  const transactions = txResult.rows
  const deposits = transactions.filter(t => t.type === 'deposit').reduce((sum, t) => sum + parseFloat(t.amount), 0)
  const withdrawals = transactions.filter(t => t.type === 'withdrawal').reduce((sum, t) => sum + parseFloat(t.amount), 0)
  const fees = transactions.filter(t => t.type === 'fee').reduce((sum, t) => sum + parseFloat(t.amount), 0)

  const statement = {
    header: {
      title: 'Grain & Vault Account Statement',
      period: `${startDate} to ${endDate}`,
      currency,
      generatedAt: new Date().toISOString(),
      accountId: userId.substring(0, 8) + '...'
    },

    summary: {
      openingBalance: opening ? parseFloat(opening.total_portfolio_value) : 0,
      closingBalance: parseFloat(account.usd_total || 0) + parseFloat(account.grain_current_value || 0) - parseFloat(account.credit_line_used || 0),
      totalDeposits: deposits,
      totalWithdrawals: withdrawals,
      totalFees: fees,
      networkEarnings: parseFloat(network.total_commissions || 0),
      grainEarned: parseInt(network.total_grain || 0),
      fxConversions: parseInt(fx.conversion_count || 0),
      fxVolume: parseFloat(fx.total_converted || 0),
      fxFees: parseFloat(fx.total_fx_fees || 0)
    },

    balances: {
      usd: {
        available: parseFloat(account.usd_available || 0),
        pending: parseFloat(account.usd_pending || 0),
        total: parseFloat(account.usd_total || 0)
      },
      grain: {
        quantity: parseFloat(account.grain_quantity || 0),
        value: parseFloat(account.grain_current_value || 0),
        appreciation: parseFloat(account.grain_appreciation || 0)
      },
      credit: {
        available: parseFloat(account.credit_line_available || 0),
        used: parseFloat(account.credit_line_used || 0)
      }
    },

    transactions: transactions.map(t => ({
      date: t.created_at,
      type: t.type,
      description: t.display_title || t.type,
      amount: parseFloat(t.amount),
      currency: t.currency,
      fee: parseFloat(t.fee_amount || 0),
      status: t.status
    }))
  }

  if (format === 'json') {
    return NextResponse.json(statement)
  }

  if (format === 'csv') {
    // Return transactions as CSV
    const headers = ['Date', 'Type', 'Description', 'Amount', 'Currency', 'Fee', 'Status']
    const csvContent = [
      `# Grain & Vault Statement: ${startDate} to ${endDate}`,
      `# Opening Balance: ${statement.summary.openingBalance}`,
      `# Closing Balance: ${statement.summary.closingBalance}`,
      '',
      headers.join(','),
      ...statement.transactions.map(t =>
        [t.date, t.type, `"${t.description}"`, t.amount, t.currency, t.fee, t.status].join(',')
      )
    ].join('\n')

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="grain-vault-statement-${startDate}-${endDate}.csv"`
      }
    })
  }

  // HTML statement (for PDF generation on client)
  if (format === 'statement' || format === 'html') {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Grain & Vault Statement</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #0f172a; padding-bottom: 20px; }
    .header h1 { margin: 0; color: #0f172a; font-size: 24px; }
    .header p { color: #64748b; margin: 5px 0; }
    .summary { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
    .summary-box { background: #f8fafc; padding: 20px; border-radius: 8px; }
    .summary-box h3 { margin: 0 0 15px 0; color: #0f172a; font-size: 14px; text-transform: uppercase; }
    .summary-item { display: flex; justify-content: space-between; margin: 8px 0; }
    .summary-item .label { color: #64748b; }
    .summary-item .value { font-weight: 600; color: #0f172a; }
    .income { color: #2563eb !important; }
    .expense { color: #ea580c !important; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th { text-align: left; padding: 12px 8px; border-bottom: 2px solid #e2e8f0; color: #64748b; font-size: 12px; text-transform: uppercase; }
    td { padding: 12px 8px; border-bottom: 1px solid #f1f5f9; }
    .footer { margin-top: 40px; text-align: center; color: #94a3b8; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Grain & Vault</h1>
    <p>Account Statement</p>
    <p>${startDate} to ${endDate}</p>
  </div>

  <div class="summary">
    <div class="summary-box">
      <h3>Account Summary</h3>
      <div class="summary-item">
        <span class="label">Opening Balance</span>
        <span class="value">$${statement.summary.openingBalance.toFixed(2)}</span>
      </div>
      <div class="summary-item">
        <span class="label">Deposits</span>
        <span class="value income">+$${statement.summary.totalDeposits.toFixed(2)}</span>
      </div>
      <div class="summary-item">
        <span class="label">Withdrawals</span>
        <span class="value expense">-$${statement.summary.totalWithdrawals.toFixed(2)}</span>
      </div>
      <div class="summary-item">
        <span class="label">Fees</span>
        <span class="value expense">-$${statement.summary.totalFees.toFixed(2)}</span>
      </div>
      <div class="summary-item" style="border-top: 1px solid #e2e8f0; padding-top: 10px; margin-top: 10px;">
        <span class="label"><strong>Closing Balance</strong></span>
        <span class="value"><strong>$${statement.summary.closingBalance.toFixed(2)}</strong></span>
      </div>
    </div>

    <div class="summary-box">
      <h3>Network & GRAIN</h3>
      <div class="summary-item">
        <span class="label">Network Earnings</span>
        <span class="value income">+$${statement.summary.networkEarnings.toFixed(2)}</span>
      </div>
      <div class="summary-item">
        <span class="label">GRAIN Earned</span>
        <span class="value">G ${statement.summary.grainEarned.toLocaleString()}</span>
      </div>
      <div class="summary-item">
        <span class="label">FX Conversions</span>
        <span class="value">${statement.summary.fxConversions}</span>
      </div>
      <div class="summary-item">
        <span class="label">FX Volume</span>
        <span class="value">$${statement.summary.fxVolume.toFixed(2)}</span>
      </div>
    </div>
  </div>

  <h3>Transactions</h3>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Type</th>
        <th>Description</th>
        <th style="text-align: right;">Amount</th>
        <th style="text-align: right;">Fee</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${statement.transactions.map(t => `
        <tr>
          <td>${new Date(t.date).toLocaleDateString()}</td>
          <td>${t.type}</td>
          <td>${t.description}</td>
          <td style="text-align: right;" class="${['deposit', 'receive', 'commission'].includes(t.type) ? 'income' : 'expense'}">
            ${['deposit', 'receive', 'commission'].includes(t.type) ? '+' : '-'}$${Math.abs(t.amount).toFixed(2)}
          </td>
          <td style="text-align: right;">$${t.fee.toFixed(2)}</td>
          <td>${t.status}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="footer">
    <p>Generated on ${new Date().toLocaleString()}</p>
    <p>Grain & Vault - Your Treasury, Simplified</p>
  </div>
</body>
</html>
    `

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
        'Content-Disposition': `inline; filename="grain-vault-statement-${startDate}-${endDate}.html"`
      }
    })
  }

  return NextResponse.json(statement)
}
