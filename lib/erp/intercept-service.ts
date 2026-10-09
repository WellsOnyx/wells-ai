// ERP Intercept Service
// "The Silent Invasion" - Core logic for identifying and executing payment intercepts

import { neon } from '@neondatabase/serverless';
import type { ERPBill, ERPIntercept, InterceptOpportunity, InterceptProposal } from './types';
import { quickbooks } from './quickbooks';
import { xero } from './xero';
import { codat } from './codat';
import { netsuite } from './netsuite';
import { sap } from './sap';
import { oracle } from './oracle';
import { dynamics365 } from './dynamics365';

const _dbUrl = process.env.DATABASE_URL?.trim().replace(/^["']|["']$/g, "");
const sql = _dbUrl ? neon(_dbUrl) : null;

export class InterceptService {
  // Scan for payables across all connected ERPs
  async scanForPayables(erpConnectionId: string): Promise<{
    billsFound: number;
    interceptsCreated: number;
    potentialRevenue: number;
  }> {
    const [connection] = await sql`
      SELECT * FROM erp_connections
      WHERE id = ${erpConnectionId}
      AND connection_status = 'active'
      AND auto_intercept_enabled = true
    `;

    if (!connection) {
      throw new Error('ERP connection not found or auto-intercept disabled');
    }

    let billsFound = 0;
    let interceptsCreated = 0;
    let potentialRevenue = 0;

    try {
      // Fetch bills based on provider
      let bills: any[] = [];

      if (connection.provider === 'quickbooks') {
        bills = await quickbooks.fetchBills(erpConnectionId);
        // Sync to database
        for (const bill of bills) {
          await quickbooks['syncBillToDatabase'](erpConnectionId, bill);
        }
      } else if (connection.provider === 'xero') {
        bills = await xero.fetchInvoices(erpConnectionId, 'ACCPAY', 'AUTHORISED');
        // Sync to database
        for (const bill of bills) {
          await xero['syncInvoiceToDatabase'](erpConnectionId, bill);
        }
      } else if (connection.provider === 'codat') {
        const response = await codat.fetchBills(connection.company_key);
        bills = response.results;
        // Sync to database
        for (const bill of bills) {
          await codat.syncBillToDatabase(erpConnectionId, bill);
        }
      } else if (connection.provider === 'oracle') {
        const invoices = await oracle.fetchInvoices(erpConnectionId, {
          status: 'N', // Unpaid
          limit: 500,
        });
        // Sync to database
        for (const invoice of invoices) {
          await oracle.syncInvoiceToDatabase(erpConnectionId, invoice);
        }
        bills = invoices.map(inv => ({
          Id: inv.InvoiceId.toString(),
          TotalAmt: inv.InvoiceAmount,
          DueDate: inv.PaymentDueDate || inv.InvoiceDate,
        }));
      } else if (connection.provider === 'dynamics365') {
        const invoices = await dynamics365.fetchInvoices(erpConnectionId, {
          status: 'Open',
          limit: 500,
        });
        // Sync to database
        for (const invoice of invoices) {
          await dynamics365.syncInvoiceToDatabase(erpConnectionId, invoice, connection.dynamics_variant);
        }
        bills = invoices;
      } else if (connection.provider === 'netsuite') {
        // NetSuite vendor bills
        const nsBills = await netsuite.fetchBills(erpConnectionId);
        // Sync to database
        for (const bill of nsBills) {
          await netsuite.syncBillToDatabase(erpConnectionId, bill);
        }
        bills = nsBills.map(b => ({
          Id: b.id,
          TotalAmt: b.total,
          DueDate: b.dueDate,
        }));
      } else if (connection.provider === 'sap') {
        // SAP purchase invoices
        const sapBills = await sap.fetchBills(erpConnectionId);
        // Sync to database
        for (const bill of sapBills) {
          await sap.syncBillToDatabase(erpConnectionId, bill);
        }
        bills = sapBills.map(b => ({
          Id: String(b.DocEntry),
          TotalAmt: b.DocTotal,
          DueDate: b.DocDueDate,
        }));
      }

      billsFound = bills.length;

      // Now analyze bills in database for intercept opportunities
      const unpaidBills = await sql`
        SELECT * FROM erp_bills
        WHERE erp_connection_id = ${erpConnectionId}
        AND status = 'pending'
        AND paid_status = 'unpaid'
        AND intercept_proposed = false
        AND total_amount >= ${connection.min_invoice_amount}
        AND total_amount <= ${connection.max_invoice_amount}
        AND due_date >= CURRENT_DATE
      `;

      for (const bill of unpaidBills) {
        const opportunity = await this.calculateInterceptOpportunity(bill);

        // Auto-approve if savings is positive
        if (opportunity.customerSavings > 0 || opportunity.autoApprove) {
          await this.proposeIntercept(bill.id);
          interceptsCreated++;
          potentialRevenue += opportunity.wellsFee;
        }
      }

      // Update sync status
      await sql`
        UPDATE erp_connections
        SET
          last_sync_at = NOW(),
          last_sync_status = 'completed',
          next_sync_at = NOW() + INTERVAL '${connection.sync_frequency_hours} hours'
        WHERE id = ${erpConnectionId}
      `;

      return { billsFound, interceptsCreated, potentialRevenue };
    } catch (error) {
      // Log error
      await sql`
        UPDATE erp_connections
        SET
          last_sync_status = 'failed',
          last_sync_error = ${error.message}
        WHERE id = ${erpConnectionId}
      `;

      throw error;
    }
  }

  // Calculate intercept opportunity for a bill
  async calculateInterceptOpportunity(bill: ERPBill): Promise<InterceptOpportunity> {
    const billAmount = bill.total_amount;
    const wellsFee = billAmount * 0.01; // 1%

    // Calculate what they're currently paying to make this payment
    let customerCurrentCost = 0;

    // Payment method costs
    if (bill.total_amount > 10000) {
      customerCurrentCost = 30; // Wire fee
    } else if (bill.total_amount > 1000) {
      customerCurrentCost = 15; // ACH or check processing
    } else {
      customerCurrentCost = 5; // Small payment processing
    }

    // Add labor cost (10 minutes @ $30/hr = $5)
    customerCurrentCost += 5;

    const customerSavings = customerCurrentCost - wellsFee;
    const netProfit = wellsFee; // Our revenue

    // Check if vendor is already enrolled
    const [vendor] = await sql`
      SELECT enrolled_in_wells FROM erp_vendors
      WHERE erp_connection_id = ${bill.erp_connection_id}
      AND external_vendor_id = ${bill.external_vendor_id}
    `;

    const vendorEnrollmentPotential = !vendor?.enrolled_in_wells;

    // Auto-approve if:
    // 1. Customer saves money, OR
    // 2. Bill is under $500 (low risk), OR
    // 3. Vendor is already enrolled (seamless)
    const autoApprove =
      customerSavings > 0 ||
      billAmount < 500 ||
      vendor?.enrolled_in_wells;

    return {
      billId: bill.id,
      billAmount,
      wellsFee,
      customerCurrentCost,
      customerSavings,
      netProfit,
      vendorEnrollmentPotential,
      autoApprove,
    };
  }

  // Propose intercept to customer
  async proposeIntercept(billId: string): Promise<ERPIntercept> {
    const [bill] = await sql`
      SELECT * FROM erp_bills WHERE id = ${billId}
    `;

    if (!bill) {
      throw new Error('Bill not found');
    }

    const opportunity = await this.calculateInterceptOpportunity(bill);

    // Create proposal message
    const message = opportunity.customerSavings > 0
      ? `Save $${opportunity.customerSavings.toFixed(2)} by paying through Wells AI! We'll handle the payment for just $${opportunity.wellsFee.toFixed(2)} (1%), compared to your current cost of $${opportunity.customerCurrentCost.toFixed(2)}.`
      : `Pay through Wells AI for just $${opportunity.wellsFee.toFixed(2)} (1%). We'll handle the payment and enroll the vendor automatically.`;

    const expiresAt = new Date(bill.due_date);
    expiresAt.setDate(expiresAt.getDate() - 3); // Expire 3 days before due date

    // Create intercept record
    const [intercept] = await sql`
      INSERT INTO erp_intercepts (
        erp_bill_id,
        erp_connection_id,
        bill_amount,
        wells_fee,
        customer_current_cost,
        customer_savings,
        proposed_at,
        proposal_expires_at,
        proposal_message,
        status
      ) VALUES (
        ${billId},
        ${bill.erp_connection_id},
        ${opportunity.billAmount},
        ${opportunity.wellsFee},
        ${opportunity.customerCurrentCost},
        ${opportunity.customerSavings},
        NOW(),
        ${expiresAt.toISOString()},
        ${message},
        ${opportunity.autoApprove ? 'accepted' : 'proposed'}
      )
      RETURNING *
    `;

    // Update bill
    await sql`
      UPDATE erp_bills
      SET
        intercept_proposed = true,
        intercept_proposed_at = NOW(),
        intercept_accepted = ${opportunity.autoApprove},
        intercept_accepted_at = ${opportunity.autoApprove ? 'NOW()' : null}
      WHERE id = ${billId}
    `;

    // If auto-approved, queue for execution
    if (opportunity.autoApprove) {
      // Schedule payment for 1 day before due date
      const paymentDate = new Date(bill.due_date);
      paymentDate.setDate(paymentDate.getDate() - 1);

      // TODO: Queue payment job
      console.log(`Auto-approved intercept for bill ${billId}, scheduled for ${paymentDate}`);
    }

    return intercept;
  }

  // Execute intercept (actually make the payment)
  async executeIntercept(interceptId: string): Promise<void> {
    const [intercept] = await sql`
      SELECT i.*, b.*, c.provider, c.realm_id, c.tenant_id, c.company_key
      FROM erp_intercepts i
      JOIN erp_bills b ON i.erp_bill_id = b.id
      JOIN erp_connections c ON i.erp_connection_id = c.id
      WHERE i.id = ${interceptId}
      AND i.status = 'accepted'
    `;

    if (!intercept) {
      throw new Error('Intercept not found or not accepted');
    }

    try {
      // 1. Enroll vendor if not already enrolled
      const vendorId = await this.enrollVendor(
        intercept.erp_connection_id,
        intercept.external_vendor_id
      );

      // 2. Create payment in Wells system
      const wellsPaymentId = await this.createWellsPayment(
        intercept.erp_bill_id,
        vendorId,
        intercept.bill_amount,
        intercept.wells_fee
      );

      // 3. Record payment in ERP system
      if (intercept.provider === 'quickbooks') {
        await quickbooks.createPayment(
          intercept.erp_connection_id,
          intercept.external_bill_id,
          intercept.bill_amount,
          new Date(),
          'Wells AI Payment Account',
          `Paid via Wells AI - Transaction ${wellsPaymentId}`
        );
      } else if (intercept.provider === 'xero') {
        await xero.createPayment(
          intercept.erp_connection_id,
          intercept.external_bill_id,
          intercept.bill_amount,
          new Date(),
          'WELLS-PAYMENTS',
          `Paid via Wells AI - Transaction ${wellsPaymentId}`
        );
      } else if (intercept.provider === 'oracle') {
        await oracle.createPayment(
          intercept.erp_connection_id,
          intercept.external_bill_id,
          intercept.bill_amount,
          new Date(),
          'Electronic',
          `WELLS-${wellsPaymentId}`
        );
      } else if (intercept.provider === 'dynamics365') {
        await dynamics365.createPayment(
          intercept.erp_connection_id,
          intercept.external_bill_id,
          intercept.external_vendor_id || '',
          intercept.bill_amount,
          new Date(),
          `WELLS-${wellsPaymentId}`
        );
      } else if (intercept.provider === 'netsuite') {
        await netsuite.createPayment(
          intercept.erp_connection_id,
          intercept.external_vendor_id || '',
          intercept.external_bill_id,
          intercept.bill_amount,
          new Date(),
          '1', // Default bank account
          `Paid via Wells AI - Transaction ${wellsPaymentId}`
        );
      } else if (intercept.provider === 'sap') {
        await sap.createPayment(
          intercept.erp_connection_id,
          intercept.external_vendor_id || '',
          intercept.external_bill_id,
          intercept.bill_amount,
          new Date(),
          '100000', // Default bank account
          `Paid via Wells AI - Transaction ${wellsPaymentId}`
        );
      }

      // 4. Update intercept status
      await sql`
        UPDATE erp_intercepts
        SET
          status = 'executed',
          executed_at = NOW(),
          wells_payment_id = ${wellsPaymentId},
          vendor_enrolled = true,
          vendor_enrollment_id = ${vendorId},
          revenue_captured = ${intercept.wells_fee}
        WHERE id = ${interceptId}
      `;

      // 5. Update bill status
      await sql`
        UPDATE erp_bills
        SET
          status = 'intercepted',
          intercept_executed = true,
          intercept_executed_at = NOW()
        WHERE id = ${intercept.erp_bill_id}
      `;

      console.log(`Successfully executed intercept ${interceptId} for $${intercept.bill_amount}`);
    } catch (error) {
      // Log failure
      await sql`
        UPDATE erp_intercepts
        SET status = 'proposed'
        WHERE id = ${interceptId}
      `;

      throw error;
    }
  }

  // Enroll vendor silently
  async enrollVendor(
    erpConnectionId: string,
    externalVendorId: string
  ): Promise<string> {
    // Get vendor from ERP table
    const [vendor] = await sql`
      SELECT * FROM erp_vendors
      WHERE erp_connection_id = ${erpConnectionId}
      AND external_vendor_id = ${externalVendorId}
    `;

    if (!vendor) {
      throw new Error('Vendor not found in ERP data');
    }

    // Check if already enrolled
    if (vendor.enrolled_in_wells && vendor.wells_supplier_id) {
      return vendor.wells_supplier_id;
    }

    // Create supplier in Wells system
    const [supplier] = await sql`
      INSERT INTO suppliers (
        name,
        email,
        phone,
        address,
        city,
        state,
        zip,
        country,
        status,
        onboarding_method
      ) VALUES (
        ${vendor.vendor_name},
        ${vendor.email || `supplier-${vendor.id}@wellsai.placeholder`},
        ${vendor.phone},
        ${vendor.address_line1},
        ${vendor.city},
        ${vendor.state},
        ${vendor.postal_code},
        ${vendor.country},
        'pending_verification',
        'erp_intercept'
      )
      RETURNING id
    `;

    // Update vendor with Wells supplier ID
    await sql`
      UPDATE erp_vendors
      SET
        enrolled_in_wells = true,
        enrollment_date = NOW(),
        enrollment_method = 'erp_intercept',
        wells_supplier_id = ${supplier.id}
      WHERE id = ${vendor.id}
    `;

    console.log(`Silently enrolled vendor ${vendor.vendor_name} as supplier ${supplier.id}`);

    return supplier.id;
  }

  // Create payment in Wells system
  private async createWellsPayment(
    billId: string,
    supplierId: string,
    amount: number,
    fee: number
  ): Promise<string> {
    // Create transaction
    const [transaction] = await sql`
      INSERT INTO transactions (
        type,
        amount,
        fee,
        status,
        metadata
      ) VALUES (
        'erp_payment',
        ${amount},
        ${fee},
        'pending',
        ${JSON.stringify({ billId, supplierId })}
      )
      RETURNING id
    `;

    // TODO: Integrate with actual payment processor
    // For now, just return transaction ID

    return transaction.id;
  }

  // Get intercept proposal for display
  async getInterceptProposal(billId: string): Promise<InterceptProposal | null> {
    const [intercept] = await sql`
      SELECT i.*, b.vendor_name, b.due_date
      FROM erp_intercepts i
      JOIN erp_bills b ON i.erp_bill_id = b.id
      WHERE i.erp_bill_id = ${billId}
      AND i.status = 'proposed'
      ORDER BY i.proposed_at DESC
      LIMIT 1
    `;

    if (!intercept) {
      return null;
    }

    return {
      billId: intercept.erp_bill_id,
      message: intercept.proposal_message,
      wellsFee: intercept.wells_fee,
      yourSavings: intercept.customer_savings,
      currentCost: intercept.customer_current_cost,
      paymentDate: new Date(intercept.due_date),
      expiresAt: new Date(intercept.proposal_expires_at),
    };
  }

  // Approve intercept
  async approveIntercept(interceptId: string): Promise<void> {
    await sql`
      UPDATE erp_intercepts
      SET
        status = 'accepted',
        responded_at = NOW()
      WHERE id = ${interceptId}
      AND status = 'proposed'
    `;

    const [intercept] = await sql`
      SELECT erp_bill_id FROM erp_intercepts WHERE id = ${interceptId}
    `;

    await sql`
      UPDATE erp_bills
      SET
        intercept_accepted = true,
        intercept_accepted_at = NOW()
      WHERE id = ${intercept.erp_bill_id}
    `;
  }

  // Reject intercept
  async rejectIntercept(interceptId: string): Promise<void> {
    await sql`
      UPDATE erp_intercepts
      SET
        status = 'rejected',
        responded_at = NOW()
      WHERE id = ${interceptId}
      AND status = 'proposed'
    `;
  }

  // Get dashboard stats
  async getDashboardStats(erpConnectionId: string): Promise<{
    totalBills: number;
    interceptedBills: number;
    potentialRevenue: number;
    actualRevenue: number;
    vendorsEnrolled: number;
  }> {
    const [stats] = await sql`
      SELECT
        COUNT(*) as total_bills,
        SUM(CASE WHEN status = 'intercepted' THEN 1 ELSE 0 END) as intercepted_bills,
        SUM(CASE WHEN intercept_proposed THEN wells_fee_amount ELSE 0 END) as potential_revenue
      FROM erp_bills
      WHERE erp_connection_id = ${erpConnectionId}
    `;

    const [revenueStats] = await sql`
      SELECT
        SUM(revenue_captured) as actual_revenue
      FROM erp_intercepts
      WHERE erp_connection_id = ${erpConnectionId}
      AND status = 'executed'
    `;

    const [vendorStats] = await sql`
      SELECT
        COUNT(*) as vendors_enrolled
      FROM erp_vendors
      WHERE erp_connection_id = ${erpConnectionId}
      AND enrolled_in_wells = true
    `;

    return {
      totalBills: parseInt(stats.total_bills),
      interceptedBills: parseInt(stats.intercepted_bills),
      potentialRevenue: parseFloat(stats.potential_revenue || 0),
      actualRevenue: parseFloat(revenueStats?.actual_revenue || 0),
      vendorsEnrolled: parseInt(vendorStats.vendors_enrolled),
    };
  }
}

export const interceptService = new InterceptService();
