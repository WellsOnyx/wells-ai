// Oracle Payments API
// Create and list payments through Oracle Fusion Cloud / E-Business Suite
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { oracle } from '@/lib/erp/oracle';

const _dbUrl = process.env.DATABASE_URL?.trim().replace(/^["']|["']$/g, "");
const sql = _dbUrl ? neon(_dbUrl) : null;

// GET - List payments
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const connectionId = searchParams.get('connectionId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!connectionId) {
      return NextResponse.json({ error: 'connectionId required' }, { status: 400 });
    }

    // Verify connection exists and is active
    const [connection] = await sql`
      SELECT id, connection_status FROM erp_connections
      WHERE id = ${connectionId} AND provider = 'oracle'
    `;

    if (!connection) {
      return NextResponse.json({ error: 'Oracle connection not found' }, { status: 404 });
    }

    // Get payments from database
    const payments = await sql`
      SELECT
        p.id,
        p.external_payment_id,
        p.external_vendor_id,
        p.payment_amount,
        p.payment_method,
        p.payment_date,
        p.processed_by_wells,
        p.wells_transaction_id,
        p.wells_fee_collected,
        p.reference_number,
        p.memo,
        p.created_at,
        v.vendor_name
      FROM erp_payments p
      LEFT JOIN erp_vendors v ON p.external_vendor_id = v.external_vendor_id
        AND v.erp_connection_id = p.erp_connection_id
      WHERE p.erp_connection_id = ${connectionId}
      ${dateFrom ? sql`AND p.payment_date >= ${dateFrom}` : sql``}
      ${dateTo ? sql`AND p.payment_date <= ${dateTo}` : sql``}
      ORDER BY p.payment_date DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    const [{ count }] = await sql`
      SELECT COUNT(*) as count FROM erp_payments
      WHERE erp_connection_id = ${connectionId}
      ${dateFrom ? sql`AND payment_date >= ${dateFrom}` : sql``}
      ${dateTo ? sql`AND payment_date <= ${dateTo}` : sql``}
    `;

    // Calculate summary
    const [stats] = await sql`
      SELECT
        COUNT(*) as total_payments,
        SUM(payment_amount) as total_amount,
        SUM(CASE WHEN processed_by_wells THEN 1 ELSE 0 END) as wells_payments,
        SUM(CASE WHEN processed_by_wells THEN wells_fee_collected ELSE 0 END) as total_fees_collected
      FROM erp_payments
      WHERE erp_connection_id = ${connectionId}
    `;

    return NextResponse.json({
      payments,
      stats: {
        totalPayments: parseInt(stats.total_payments),
        totalAmount: parseFloat(stats.total_amount || 0),
        wellsPayments: parseInt(stats.wells_payments),
        totalFeesCollected: parseFloat(stats.total_fees_collected || 0),
      },
      pagination: {
        total: parseInt(count),
        limit,
        offset,
        hasMore: offset + limit < parseInt(count),
      },
    });
  } catch (error) {
    console.error('Oracle payments error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch payments' },
      { status: 500 }
    );
  }
}

// POST - Create a payment
export async function POST(req: NextRequest) {
  try {
    const {
      connectionId,
      invoiceId,
      vendorId,
      amount,
      paymentDate,
      paymentMethod,
      reference,
    } = await req.json();

    if (!connectionId || !invoiceId || !amount) {
      return NextResponse.json(
        { error: 'connectionId, invoiceId, and amount are required' },
        { status: 400 }
      );
    }

    // Verify connection exists and is active
    const [connection] = await sql`
      SELECT id, connection_status FROM erp_connections
      WHERE id = ${connectionId} AND provider = 'oracle'
    `;

    if (!connection) {
      return NextResponse.json({ error: 'Oracle connection not found' }, { status: 404 });
    }

    if (connection.connection_status !== 'active') {
      return NextResponse.json({ error: 'Oracle connection is not active' }, { status: 400 });
    }

    // Get invoice details if vendorId not provided
    let actualVendorId = vendorId;
    if (!actualVendorId) {
      const [bill] = await sql`
        SELECT external_vendor_id FROM erp_bills
        WHERE erp_connection_id = ${connectionId}
        AND external_bill_id = ${invoiceId}
      `;
      if (bill) {
        actualVendorId = bill.external_vendor_id;
      }
    }

    // Create payment in Oracle
    const payment = await oracle.createPayment(
      connectionId,
      invoiceId,
      amount,
      paymentDate ? new Date(paymentDate) : new Date(),
      paymentMethod || 'Electronic',
      reference
    );

    // Calculate Wells fee (1%)
    const wellsFee = amount * 0.01;

    // Record payment in database
    const [dbPayment] = await sql`
      INSERT INTO erp_payments (
        erp_connection_id,
        erp_bill_id,
        external_payment_id,
        external_vendor_id,
        payment_amount,
        payment_method,
        payment_date,
        processed_by_wells,
        wells_transaction_id,
        wells_fee_collected,
        reference_number,
        raw_data
      ) VALUES (
        ${connectionId},
        ${invoiceId},
        ${payment.PaymentId.toString()},
        ${actualVendorId},
        ${amount},
        ${paymentMethod || 'Electronic'},
        ${paymentDate || new Date().toISOString()},
        true,
        ${`WELLS-${Date.now()}`},
        ${wellsFee},
        ${reference || payment.PaymentReference},
        ${JSON.stringify(payment)}
      )
      RETURNING id
    `;

    // Update invoice status
    await sql`
      UPDATE erp_bills
      SET
        status = 'intercepted',
        paid_status = 'paid',
        amount_paid = total_amount,
        intercept_executed = true,
        intercept_executed_at = NOW(),
        updated_at = NOW()
      WHERE erp_connection_id = ${connectionId}
      AND external_bill_id = ${invoiceId}
    `;

    return NextResponse.json({
      success: true,
      payment: {
        id: dbPayment.id,
        externalPaymentId: payment.PaymentId,
        amount,
        wellsFee,
        reference: payment.PaymentReference,
      },
    });
  } catch (error) {
    console.error('Oracle create payment error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create payment' },
      { status: 500 }
    );
  }
}
