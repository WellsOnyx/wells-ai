// SAP Payments API
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { sap } from '@/lib/erp/sap';

const sql = process.env.DATABASE_URL?.startsWith('postgres') ? neon(process.env.DATABASE_URL) : null;

// GET: List payments from SAP
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const connectionId = searchParams.get('connectionId');
    const vendorId = searchParams.get('vendorId');
    const startDate = searchParams.get('startDate');
    const refresh = searchParams.get('refresh') === 'true';

    if (!connectionId) {
      return NextResponse.json({ error: 'connectionId required' }, { status: 400 });
    }

    // Verify connection exists and is active
    const [connection] = await sql`
      SELECT id, connection_status FROM erp_connections
      WHERE id = ${connectionId} AND provider = 'sap'
    `;

    if (!connection) {
      return NextResponse.json({ error: 'SAP connection not found' }, { status: 404 });
    }

    if (connection.connection_status !== 'active') {
      return NextResponse.json({ error: 'SAP connection is not active' }, { status: 400 });
    }

    // If refresh requested, fetch from SAP and sync
    if (refresh) {
      try {
        const filterDate = startDate ? new Date(startDate) : undefined;
        const payments = await sap.fetchPayments(connectionId, filterDate);
        for (const payment of payments) {
          await sap.syncPaymentToDatabase(connectionId, payment);
        }
      } catch (error: any) {
        console.error('Failed to refresh payments from SAP:', error);
        // Continue to return cached data
      }
    }

    // Build query based on filters
    let payments;
    if (vendorId) {
      payments = await sql`
        SELECT
          p.*,
          v.vendor_name
        FROM erp_payments p
        LEFT JOIN erp_vendors v ON p.external_vendor_id = v.external_vendor_id
          AND p.erp_connection_id = v.erp_connection_id
        WHERE p.erp_connection_id = ${connectionId}
        AND p.external_vendor_id = ${vendorId}
        ORDER BY p.payment_date DESC
      `;
    } else {
      payments = await sql`
        SELECT
          p.*,
          v.vendor_name
        FROM erp_payments p
        LEFT JOIN erp_vendors v ON p.external_vendor_id = v.external_vendor_id
          AND p.erp_connection_id = v.erp_connection_id
        WHERE p.erp_connection_id = ${connectionId}
        ORDER BY p.payment_date DESC
        LIMIT 100
      `;
    }

    // Get summary stats
    const [stats] = await sql`
      SELECT
        COUNT(*) as total_count,
        COALESCE(SUM(payment_amount), 0) as total_amount,
        COUNT(*) FILTER (WHERE processed_by_wells = true) as wells_count,
        COALESCE(SUM(wells_fee_collected), 0) as wells_fees_collected
      FROM erp_payments
      WHERE erp_connection_id = ${connectionId}
    `;

    return NextResponse.json({
      payments,
      count: payments.length,
      stats: {
        totalCount: parseInt(stats.total_count),
        totalAmount: parseFloat(stats.total_amount),
        wellsCount: parseInt(stats.wells_count),
        wellsFeesCollected: parseFloat(stats.wells_fees_collected),
      },
      connectionId,
    });
  } catch (error: any) {
    console.error('Get SAP payments error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get payments' },
      { status: 500 }
    );
  }
}

// POST: Create a payment in SAP
export async function POST(req: NextRequest) {
  try {
    const {
      connectionId,
      vendorId,
      billId,
      amount,
      paymentDate,
      bankAccountId,
      memo,
    } = await req.json();

    if (!connectionId || !vendorId || !billId || !amount) {
      return NextResponse.json(
        { error: 'connectionId, vendorId, billId, and amount are required' },
        { status: 400 }
      );
    }

    // Verify connection
    const [connection] = await sql`
      SELECT id, connection_status FROM erp_connections
      WHERE id = ${connectionId} AND provider = 'sap'
    `;

    if (!connection || connection.connection_status !== 'active') {
      return NextResponse.json({ error: 'Active SAP connection not found' }, { status: 404 });
    }

    // Get the bill to verify it exists
    const [bill] = await sql`
      SELECT * FROM erp_bills
      WHERE erp_connection_id = ${connectionId}
      AND external_bill_id = ${billId}
    `;

    if (!bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    // Create payment in SAP
    const payment = await sap.createPayment(
      connectionId,
      vendorId,
      billId,
      parseFloat(amount),
      paymentDate ? new Date(paymentDate) : new Date(),
      bankAccountId || '100000', // Default bank account if not specified (SAP GL account)
      memo || `Wells AI Payment - Invoice ${bill.bill_number || billId}`
    );

    // Record payment in database
    await sql`
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
        memo
      ) VALUES (
        ${connectionId},
        ${bill.id},
        ${String(payment.DocEntry)},
        ${vendorId},
        ${amount},
        'sap',
        ${paymentDate || new Date().toISOString()},
        true,
        ${String(payment.DocEntry)},
        ${bill.wells_fee_amount || amount * 0.01},
        ${memo || null}
      )
    `;

    // Update bill status
    await sql`
      UPDATE erp_bills
      SET
        status = 'intercepted',
        paid_status = 'paid',
        amount_paid = total_amount,
        intercept_executed = true,
        intercept_executed_at = NOW(),
        updated_at = NOW()
      WHERE id = ${bill.id}
    `;

    // Update vendor stats
    await sql`
      UPDATE erp_vendors
      SET
        total_bills_count = total_bills_count + 1,
        total_amount_paid = total_amount_paid + ${amount},
        last_payment_date = NOW(),
        updated_at = NOW()
      WHERE erp_connection_id = ${connectionId}
      AND external_vendor_id = ${vendorId}
    `;

    return NextResponse.json({
      success: true,
      payment: {
        id: String(payment.DocEntry),
        vendorId,
        billId,
        amount,
        paymentDate: payment.DocDate,
        status: 'completed',
      },
      message: 'Payment created successfully in SAP',
    });
  } catch (error: any) {
    console.error('Create SAP payment error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create payment' },
      { status: 500 }
    );
  }
}
