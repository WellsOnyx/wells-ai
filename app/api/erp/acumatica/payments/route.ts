/**
 * Acumatica Payments API
 *
 * Create and manage AP payments (Checks) in Acumatica
 */
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { createAcumaticaAdapter, AcumaticaConfig } from '@/lib/treasury-sdk/adapters/acumatica';

const sql = process.env.DATABASE_URL?.startsWith('postgres') ? neon(process.env.DATABASE_URL) : null;

async function getAdapterForConnection(connectionId: string) {
  if (!sql) {
    throw new Error('Database not configured');
  }

  const [connection] = await sql`
    SELECT * FROM erp_connections
    WHERE id = ${connectionId}
      AND provider = 'acumatica'
      AND connection_status = 'active'
  `;

  if (!connection) {
    throw new Error('Acumatica connection not found or inactive');
  }

  const metadata = connection.metadata || {};

  // Check if using stored OAuth tokens or credentials
  let config: AcumaticaConfig;

  if (connection.refresh_token) {
    // OAuth token flow
    config = {
      instanceUrl: connection.realm_id,
      clientId: metadata.clientId,
      clientSecret: metadata.clientSecret,
      endpoint: connection.realm_id,
      credentials: { type: 'oauth2' },
      branch: metadata.branch,
    };
  } else {
    // Resource owner password flow
    const credentials = JSON.parse(connection.access_token || '{}');
    config = {
      instanceUrl: connection.realm_id,
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret,
      username: credentials.username,
      password: credentials.password,
      companyName: connection.tenant_id,
      branch: metadata.branch,
      endpoint: connection.realm_id,
      credentials: { type: 'oauth2' },
    };
  }

  const adapter = createAcumaticaAdapter(config);
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
    console.error('Acumatica payments error:', error);
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
      // Create payment in Acumatica
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
            ${'GRAIN Payment via Acumatica'}
          )
        `.catch(e => console.warn('Failed to log payment to DB:', e.message));
      }

      return NextResponse.json({
        success: true,
        payment: result.data,
        externalId: result.externalId,
        message: 'Payment created successfully in Acumatica',
      });
    } finally {
      await adapter.disconnect();
    }

  } catch (error) {
    console.error('Acumatica create payment error:', error);
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
    console.error('Acumatica sync payment error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync payment' },
      { status: 500 }
    );
  }
}
