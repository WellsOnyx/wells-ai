/**
 * Sage Intacct Invoices/Bills API
 *
 * Retrieve and manage AP bills from Sage Intacct
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

// GET - List invoices/bills
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const connectionId = searchParams.get('connectionId');
    const status = searchParams.get('status');
    const vendorId = searchParams.get('vendorId');
    const dueBefore = searchParams.get('dueBefore');
    const dueAfter = searchParams.get('dueAfter');
    const modifiedSince = searchParams.get('modifiedSince');
    const limit = parseInt(searchParams.get('limit') || '100');
    const payableOnly = searchParams.get('payableOnly') === 'true';

    if (!connectionId) {
      return NextResponse.json(
        { error: 'Connection ID required' },
        { status: 400 }
      );
    }

    const { adapter, connection } = await getAdapterForConnection(connectionId);

    try {
      let invoices;

      if (payableOnly) {
        // Get only open/partial invoices that can be paid
        invoices = await adapter.getPayableInvoices();
      } else {
        // Get invoices with filters
        const statusArray = status
          ? status.split(',') as ('open' | 'partial' | 'paid' | 'cancelled' | 'disputed')[]
          : undefined;

        invoices = await adapter.getInvoices({
          status: statusArray,
          vendorId: vendorId || undefined,
          dueBefore: dueBefore ? new Date(dueBefore) : undefined,
          dueAfter: dueAfter ? new Date(dueAfter) : undefined,
          modifiedSince: modifiedSince ? new Date(modifiedSince) : undefined,
          limit,
        });
      }

      // Calculate totals
      const totalAmount = invoices.reduce((sum, inv) => sum + inv.amount, 0);
      const openAmount = invoices
        .filter(inv => inv.status === 'open' || inv.status === 'partial')
        .reduce((sum, inv) => sum + inv.amount, 0);

      // Optionally sync to local database
      if (sql) {
        for (const invoice of invoices) {
          // Calculate Wells fee (1%)
          const wellsFee = invoice.amount * 0.01;
          const paymentCostSaved = 25; // Typical wire fee
          const netSavings = paymentCostSaved - wellsFee;

          await sql`
            INSERT INTO erp_bills (
              erp_connection_id,
              external_bill_id,
              external_vendor_id,
              bill_number,
              vendor_name,
              total_amount,
              currency,
              bill_date,
              due_date,
              status,
              paid_status,
              wells_fee_amount,
              payment_cost_saved,
              net_customer_savings,
              line_items,
              memo,
              raw_data
            ) VALUES (
              ${connectionId},
              ${invoice.externalId},
              ${invoice.vendorId},
              ${invoice.metadata?.docNumber || invoice.externalId},
              ${invoice.vendorName},
              ${invoice.amount},
              ${invoice.currency || 'USD'},
              ${invoice.invoiceDate.toISOString()},
              ${invoice.dueDate.toISOString()},
              ${invoice.status === 'paid' ? 'paid_external' : 'pending'},
              ${invoice.status === 'paid' ? 'paid' : invoice.status === 'partial' ? 'partial' : 'unpaid'},
              ${wellsFee},
              ${paymentCostSaved},
              ${netSavings},
              ${JSON.stringify(invoice.lineItems)}::jsonb,
              ${invoice.description || null},
              ${JSON.stringify(invoice)}::jsonb
            )
            ON CONFLICT (erp_connection_id, external_bill_id)
            DO UPDATE SET
              total_amount = EXCLUDED.total_amount,
              status = EXCLUDED.status,
              paid_status = EXCLUDED.paid_status,
              raw_data = EXCLUDED.raw_data,
              updated_at = NOW()
          `.catch(e => console.warn('Failed to sync invoice to DB:', e.message));
        }
      }

      return NextResponse.json({
        success: true,
        invoices,
        count: invoices.length,
        totalAmount,
        openAmount,
        connectionId,
      });
    } finally {
      await adapter.disconnect();
    }

  } catch (error) {
    console.error('Sage Intacct invoices error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch invoices' },
      { status: 500 }
    );
  }
}

// GET a specific invoice by ID
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { connectionId, invoiceId } = body;

    if (!connectionId || !invoiceId) {
      return NextResponse.json(
        { error: 'Connection ID and invoice ID required' },
        { status: 400 }
      );
    }

    const { adapter } = await getAdapterForConnection(connectionId);

    try {
      const invoice = await adapter.getInvoice(invoiceId);

      if (!invoice) {
        return NextResponse.json(
          { error: 'Invoice not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        invoice,
      });
    } finally {
      await adapter.disconnect();
    }

  } catch (error) {
    console.error('Sage Intacct get invoice error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch invoice' },
      { status: 500 }
    );
  }
}
