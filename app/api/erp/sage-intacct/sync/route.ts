/**
 * Sage Intacct Sync API
 *
 * Full or incremental sync of data from Sage Intacct
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

// POST - Trigger sync
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      connectionId,
      syncType = 'full', // 'full' | 'incremental' | 'vendors' | 'bills' | 'payments' | 'accounts'
      modifiedSince,
    } = body;

    if (!connectionId) {
      return NextResponse.json(
        { error: 'Connection ID required' },
        { status: 400 }
      );
    }

    const { adapter, connection } = await getAdapterForConnection(connectionId);
    const startTime = Date.now();

    // Create sync log entry
    let syncLogId: string | null = null;
    if (sql) {
      const [log] = await sql`
        INSERT INTO erp_sync_logs (
          erp_connection_id,
          sync_type,
          status,
          started_at
        ) VALUES (
          ${connectionId},
          ${syncType},
          'started',
          NOW()
        )
        RETURNING id
      `;
      syncLogId = log.id;
    }

    try {
      const results = {
        vendors: { fetched: 0, created: 0, updated: 0, failed: 0 },
        bills: { fetched: 0, created: 0, updated: 0, failed: 0 },
        payments: { fetched: 0, created: 0, updated: 0, failed: 0 },
        accounts: { fetched: 0, created: 0, updated: 0, failed: 0 },
        costCenters: { fetched: 0, created: 0, updated: 0, failed: 0 },
        intercepts: { created: 0 },
      };

      const filters = modifiedSince ? { modifiedSince: new Date(modifiedSince) } : {};

      // Sync vendors
      if (syncType === 'full' || syncType === 'incremental' || syncType === 'vendors') {
        console.log('Syncing vendors...');
        const vendors = await adapter.getVendors({ ...filters, limit: 1000 });
        results.vendors.fetched = vendors.length;

        if (sql) {
          for (const vendor of vendors) {
            try {
              await sql`
                INSERT INTO erp_vendors (
                  erp_connection_id,
                  external_vendor_id,
                  vendor_name,
                  email,
                  phone,
                  tax_id,
                  default_currency,
                  payment_terms,
                  is_active,
                  raw_data
                ) VALUES (
                  ${connectionId},
                  ${vendor.externalId},
                  ${vendor.name},
                  ${vendor.email || null},
                  ${vendor.phone || null},
                  ${vendor.taxId || null},
                  ${vendor.currency || 'USD'},
                  ${vendor.paymentTerms || null},
                  true,
                  ${JSON.stringify(vendor)}::jsonb
                )
                ON CONFLICT (erp_connection_id, external_vendor_id)
                DO UPDATE SET
                  vendor_name = EXCLUDED.vendor_name,
                  email = EXCLUDED.email,
                  phone = EXCLUDED.phone,
                  raw_data = EXCLUDED.raw_data,
                  updated_at = NOW()
              `;
              results.vendors.created++;
            } catch (e) {
              results.vendors.failed++;
            }
          }
        }
      }

      // Sync bills/invoices
      if (syncType === 'full' || syncType === 'incremental' || syncType === 'bills') {
        console.log('Syncing bills...');
        const invoices = await adapter.getInvoices({ ...filters, limit: 1000 });
        results.bills.fetched = invoices.length;

        if (sql) {
          for (const invoice of invoices) {
            try {
              const wellsFee = invoice.amount * 0.01;
              const paymentCostSaved = 25;
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
              `;
              results.bills.created++;

              // Create intercept opportunity for open bills
              if (invoice.status === 'open' || invoice.status === 'partial') {
                try {
                  await sql`
                    INSERT INTO erp_intercepts (
                      erp_bill_id,
                      erp_connection_id,
                      bill_amount,
                      wells_fee,
                      customer_current_cost,
                      customer_savings,
                      proposed_at,
                      proposal_expires_at,
                      status
                    )
                    SELECT
                      b.id,
                      ${connectionId},
                      ${invoice.amount},
                      ${wellsFee},
                      ${paymentCostSaved},
                      ${netSavings},
                      NOW(),
                      NOW() + INTERVAL '7 days',
                      'proposed'
                    FROM erp_bills b
                    WHERE b.erp_connection_id = ${connectionId}
                      AND b.external_bill_id = ${invoice.externalId}
                    ON CONFLICT DO NOTHING
                  `;
                  results.intercepts.created++;
                } catch (e) {
                  // Ignore intercept creation errors
                }
              }
            } catch (e) {
              results.bills.failed++;
            }
          }
        }
      }

      // Sync payments
      if (syncType === 'full' || syncType === 'incremental' || syncType === 'payments') {
        console.log('Syncing payments...');
        const payments = await adapter.getPayments({ ...filters, limit: 1000 });
        results.payments.fetched = payments.length;

        if (sql) {
          for (const payment of payments) {
            try {
              await sql`
                INSERT INTO erp_payments (
                  erp_connection_id,
                  external_payment_id,
                  external_vendor_id,
                  payment_amount,
                  payment_method,
                  payment_date,
                  reference_number,
                  raw_data
                ) VALUES (
                  ${connectionId},
                  ${payment.externalId},
                  ${payment.vendorId},
                  ${payment.amount},
                  ${payment.paymentMethod},
                  ${payment.paymentDate.toISOString()},
                  ${payment.reference || null},
                  ${JSON.stringify(payment)}::jsonb
                )
                ON CONFLICT (erp_connection_id, external_payment_id)
                DO UPDATE SET
                  payment_amount = EXCLUDED.payment_amount,
                  raw_data = EXCLUDED.raw_data,
                  updated_at = NOW()
              `;
              results.payments.created++;
            } catch (e) {
              results.payments.failed++;
            }
          }
        }
      }

      // Sync GL accounts
      if (syncType === 'full' || syncType === 'accounts') {
        console.log('Syncing GL accounts...');
        const accounts = await adapter.getGLAccounts();
        results.accounts.fetched = accounts.length;
        // Store accounts in metadata or separate table as needed
      }

      // Sync cost centers
      if (syncType === 'full' || syncType === 'accounts') {
        console.log('Syncing cost centers...');
        const costCenters = await adapter.getCostCenters();
        results.costCenters.fetched = costCenters.length;
        // Store cost centers in metadata or separate table as needed
      }

      const duration = Math.round((Date.now() - startTime) / 1000);

      // Update sync log
      if (sql && syncLogId) {
        await sql`
          UPDATE erp_sync_logs
          SET
            status = 'completed',
            completed_at = NOW(),
            duration_seconds = ${duration},
            records_fetched = ${results.vendors.fetched + results.bills.fetched + results.payments.fetched},
            records_created = ${results.vendors.created + results.bills.created + results.payments.created},
            records_failed = ${results.vendors.failed + results.bills.failed + results.payments.failed},
            vendors_found = ${results.vendors.fetched},
            bills_found = ${results.bills.fetched},
            payments_found = ${results.payments.fetched},
            intercepts_created = ${results.intercepts.created}
          WHERE id = ${syncLogId}
        `;
      }

      // Update connection last sync
      if (sql) {
        await sql`
          UPDATE erp_connections
          SET
            last_sync_at = NOW(),
            last_sync_status = 'success',
            next_sync_at = NOW() + INTERVAL '24 hours'
          WHERE id = ${connectionId}
        `;
      }

      return NextResponse.json({
        success: true,
        syncType,
        duration: `${duration}s`,
        results,
        message: `Sync completed successfully in ${duration} seconds`,
      });

    } catch (syncError) {
      // Update sync log with error
      if (sql && syncLogId) {
        await sql`
          UPDATE erp_sync_logs
          SET
            status = 'failed',
            completed_at = NOW(),
            error_message = ${syncError instanceof Error ? syncError.message : 'Unknown error'}
          WHERE id = ${syncLogId}
        `;
      }

      throw syncError;
    } finally {
      await adapter.disconnect();
    }

  } catch (error) {
    console.error('Sage Intacct sync error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync' },
      { status: 500 }
    );
  }
}

// GET - Get sync status/history
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const connectionId = searchParams.get('connectionId');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!connectionId) {
      return NextResponse.json(
        { error: 'Connection ID required' },
        { status: 400 }
      );
    }

    if (!sql) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    const logs = await sql`
      SELECT
        id,
        sync_type,
        status,
        records_fetched,
        records_created,
        records_updated,
        records_failed,
        vendors_found,
        bills_found,
        payments_found,
        intercepts_created,
        error_message,
        started_at,
        completed_at,
        duration_seconds
      FROM erp_sync_logs
      WHERE erp_connection_id = ${connectionId}
      ORDER BY started_at DESC
      LIMIT ${limit}
    `;

    const [connection] = await sql`
      SELECT
        last_sync_at,
        last_sync_status,
        next_sync_at
      FROM erp_connections
      WHERE id = ${connectionId}
    `;

    return NextResponse.json({
      success: true,
      connection: {
        lastSyncAt: connection?.last_sync_at,
        lastSyncStatus: connection?.last_sync_status,
        nextSyncAt: connection?.next_sync_at,
      },
      history: logs,
    });

  } catch (error) {
    console.error('Sage Intacct sync status error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get sync status' },
      { status: 500 }
    );
  }
}
