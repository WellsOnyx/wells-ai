/**
 * Sage Intacct Payments API
 *
 * Create and manage AP payments in Sage Intacct
 */
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { createSageIntacctAdapter, SageIntacctConfig } from '@/lib/treasury-sdk/adapters/sage-intacct';

const _dbUrl = process.env.DATABASE_URL?.trim().replace(/^["']|["']$/g, "");
const sql = _dbUrl ? neon(_dbUrl) : null;

async function getAdapterForConnection(connectionId: string) {
  if (!sql) {
    throw new Error('Database not configured');
  }

  const [connection] = await sql`
    SELECT * FROM erp_connections
    WHERE id = ${connectionId}
      AND provider = 'sage-intacct'
      AND connection_status = 'active'
  `;

  if (!connection) {
    throw new Error('Sage Intacct connection not found or inactive');
  }

  const credentials = JSON.parse(connection.access_token || '{}');
  const metadata = connection.metadata || {};

  const config: SageIntacctConfig = {
    endpoint: 'https://api.intacct.com/ia/xml/xmlgw.phtml',
    credentials: { type: 'basic' },
    senderId: credentials.senderId,
    senderPassword: credentials.senderPassword,
    companyId: connection.realm_id,
    userId: credentials.userId,
    userPassword: credentials.userPassword,
    entityId: metadata.entityId,
    locationId: metadata.locationId,
    departmentId: metadata.departmentId,
  };

  const adapter = createSageIntacctAdapter(config);
  await adapter.connect();
  return { adapter, connection };
}

// GET - List payments
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const connectionId = searchParams.get('connectionId');
    const vendorId = searchParams.get('vendorId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const limit = parseInt(searchParams.get('limit') || '100');

    if (!connectionId) {
      return NextResponse.json(
        { error: 'Connection ID required' },
        { status: 400 }
      );
    }

    const { adapter, connection } = await getAdapterForConnection(connectionId);

    try {
      const payments = await adapter.getPayments({
        vendorId: vendorId || undefined,
        dateFrom: dateFrom ? new Date(dateFrom) : undefined,
        dateTo: dateTo ? new Date(dateTo) : undefined,
        limit,
      });

      // Calculate totals
      const totalAmount = payments.reduce((sum, pmt) => sum + pmt.amount, 0);
      const completedAmount = payments
        .filter(pmt => pmt.status === 'completed')
        .reduce((sum, pmt) => sum + pmt.amount, 0);

      return NextResponse.json({
        success: true,
        payments,
        count: payments.length,
        totalAmount,
        completedAmount,
        connectionId,
      });
    } finally {
      await adapter.disconnect();
    }

  } catch (error) {
    console.error('Sage Intacct payments error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch payments' },
      { status: 500 }
    );
  }
}

// POST - Create payment
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      connectionId,
      vendorId,
      invoiceId,
      amount,
      paymentDate,
      paymentMethod,
      bankAccount,
      reference,
      grainTransactionId,
    } = body;

    if (!connectionId || !vendorId || !amount) {
      return NextResponse.json(
        { error: 'Connection ID, vendor ID, and amount required' },
        { status: 400 }
      );
    }

    const { adapter, connection } = await getAdapterForConnection(connectionId);

    try {
      // Create payment in Sage Intacct
      const result = await adapter.createPayment({
        vendorId,
        invoiceId,
        amount,
        currency: 'USD',
        paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
        paymentMethod: paymentMethod || 'grain',
        bankAccount,
        reference: reference || `GRAIN Payment ${grainTransactionId || Date.now()}`,
        grainTransactionId,
      });

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Failed to create payment' },
          { status: 400 }
        );
      }

      // Log payment in local database
      if (sql && result.data) {
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
            reference_number,
            memo
          ) VALUES (
            ${connectionId},
            ${invoiceId || null},
            ${result.externalId},
            ${vendorId},
            ${amount},
            ${paymentMethod || 'grain'},
            ${new Date().toISOString()},
            true,
            ${grainTransactionId || null},
            ${amount * 0.01},
            ${reference || null},
            ${'GRAIN Payment via Sage Intacct'}
          )
        `.catch(e => console.warn('Failed to log payment to DB:', e.message));
      }

      return NextResponse.json({
        success: true,
        payment: result.data,
        externalId: result.externalId,
        message: 'Payment created successfully in Sage Intacct',
      });
    } finally {
      await adapter.disconnect();
    }

  } catch (error) {
    console.error('Sage Intacct create payment error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create payment' },
      { status: 500 }
    );
  }
}

// PUT - Sync existing payment
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { connectionId, payment } = body;

    if (!connectionId || !payment) {
      return NextResponse.json(
        { error: 'Connection ID and payment data required' },
        { status: 400 }
      );
    }

    const { adapter } = await getAdapterForConnection(connectionId);

    try {
      const result = await adapter.syncPayment(payment);

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Failed to sync payment' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        payment: result.data,
        externalId: result.externalId,
      });
    } finally {
      await adapter.disconnect();
    }

  } catch (error) {
    console.error('Sage Intacct sync payment error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync payment' },
      { status: 500 }
    );
  }
}
