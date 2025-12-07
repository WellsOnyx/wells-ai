// ERP Integration Types
// "The Silent Invasion" - Type definitions

export type ERPProvider = 'quickbooks' | 'xero' | 'codat' | 'netsuite' | 'sage';

export interface ERPConnection {
  id: string;
  company_id: string;
  provider: ERPProvider;
  connection_status: 'active' | 'disconnected' | 'error' | 'pending';

  access_token?: string;
  refresh_token?: string;
  token_expires_at?: Date;
  realm_id?: string; // QuickBooks
  tenant_id?: string; // Xero
  company_key?: string; // Codat

  company_name?: string;
  company_currency: string;
  accounting_method?: 'accrual' | 'cash';
  fiscal_year_start?: Date;

  last_sync_at?: Date;
  last_sync_status?: string;
  last_sync_error?: string;
  next_sync_at?: Date;
  sync_frequency_hours: number;

  webhook_id?: string;
  webhook_secret?: string;
  webhook_enabled: boolean;

  auto_intercept_enabled: boolean;
  auto_vendor_enrollment: boolean;
  min_invoice_amount: number;
  max_invoice_amount: number;

  created_at: Date;
  updated_at: Date;
}

export interface ERPBill {
  id: string;
  erp_connection_id: string;

  external_bill_id: string;
  external_vendor_id?: string;

  bill_number?: string;
  vendor_name: string;
  vendor_email?: string;
  vendor_phone?: string;

  total_amount: number;
  tax_amount: number;
  currency: string;

  bill_date: Date;
  due_date: Date;
  payment_terms?: string;

  status: 'pending' | 'intercepted' | 'paid_external' | 'cancelled';
  paid_status: 'unpaid' | 'partial' | 'paid';
  amount_paid: number;

  intercept_proposed: boolean;
  intercept_proposed_at?: Date;
  intercept_accepted: boolean;
  intercept_accepted_at?: Date;
  intercept_executed: boolean;
  intercept_executed_at?: Date;

  wells_fee_amount?: number;
  payment_cost_saved?: number;
  net_customer_savings?: number;

  line_items?: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    amount: number;
    account_code?: string;
  }>;
  memo?: string;
  raw_data?: any;

  created_at: Date;
  updated_at: Date;
}

export interface ERPVendor {
  id: string;
  erp_connection_id: string;

  external_vendor_id: string;

  vendor_name: string;
  vendor_display_name?: string;
  email?: string;
  phone?: string;
  website?: string;

  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country: string;

  bank_account_number?: string;
  routing_number?: string;
  payment_method?: 'ach' | 'wire' | 'check' | 'card';

  tax_id?: string;
  vendor_type?: string;
  payment_terms?: string;
  default_currency: string;

  enrolled_in_wells: boolean;
  enrollment_date?: Date;
  enrollment_method?: 'erp_intercept' | 'manual' | 'widget';
  wells_supplier_id?: string;

  total_bills_count: number;
  total_amount_paid: number;
  last_payment_date?: Date;
  average_invoice_amount?: number;

  is_active: boolean;
  raw_data?: any;

  created_at: Date;
  updated_at: Date;
}

export interface ERPPayment {
  id: string;
  erp_connection_id: string;
  erp_bill_id?: string;

  external_payment_id: string;
  external_vendor_id?: string;

  payment_amount: number;
  payment_method: string;
  payment_date: Date;

  processed_by_wells: boolean;
  wells_transaction_id?: string;
  wells_fee_collected?: number;

  bank_account_id?: string;
  check_number?: string;
  reference_number?: string;

  memo?: string;
  raw_data?: any;

  created_at: Date;
  updated_at: Date;
}

export interface ERPIntercept {
  id: string;
  erp_bill_id: string;
  erp_connection_id: string;

  bill_amount: number;
  wells_fee: number;
  customer_current_cost?: number;
  customer_savings?: number;

  proposed_at: Date;
  proposal_expires_at?: Date;
  proposal_message?: string;

  status: 'proposed' | 'accepted' | 'rejected' | 'executed' | 'expired';
  responded_at?: Date;
  executed_at?: Date;

  wells_payment_id?: string;
  vendor_enrolled: boolean;
  vendor_enrollment_id?: string;

  revenue_captured?: number;

  created_at: Date;
  updated_at: Date;
}

export interface ERPSyncLog {
  id: string;
  erp_connection_id: string;

  sync_type: 'full' | 'incremental' | 'bills' | 'vendors' | 'payments';
  status: 'started' | 'completed' | 'failed';

  records_fetched: number;
  records_created: number;
  records_updated: number;
  records_failed: number;

  bills_found: number;
  vendors_found: number;
  payments_found: number;
  intercepts_created: number;

  error_message?: string;
  error_stack?: string;

  started_at: Date;
  completed_at?: Date;
  duration_seconds?: number;
}

// QuickBooks Specific Types
export interface QBOBill {
  Id: string;
  VendorRef: { value: string; name: string };
  TxnDate: string;
  DueDate: string;
  TotalAmt: number;
  Balance: number;
  DocNumber?: string;
  Line: Array<{
    Id: string;
    Description?: string;
    Amount: number;
    DetailType: string;
    AccountBasedExpenseLineDetail?: {
      AccountRef: { value: string; name: string };
      BillableStatus?: string;
    };
  }>;
  PrivateNote?: string;
}

export interface QBOVendor {
  Id: string;
  DisplayName: string;
  CompanyName?: string;
  PrimaryEmailAddr?: { Address: string };
  PrimaryPhone?: { FreeFormNumber: string };
  WebAddr?: { URI: string };
  BillAddr?: {
    Line1?: string;
    Line2?: string;
    City?: string;
    CountrySubDivisionCode?: string;
    PostalCode?: string;
    Country?: string;
  };
  Active: boolean;
  Balance?: number;
  AcctNum?: string;
  Vendor1099?: boolean;
  TaxIdentifier?: string;
}

export interface QBOPayment {
  Id: string;
  VendorRef: { value: string; name: string };
  TotalAmt: number;
  TxnDate: string;
  PayType?: string;
  CheckNum?: string;
  Line: Array<{
    Amount: number;
    LinkedTxn: Array<{
      TxnId: string;
      TxnType: string;
    }>;
  }>;
}

// Xero Specific Types
export interface XeroInvoice {
  InvoiceID: string;
  InvoiceNumber: string;
  Contact: {
    ContactID: string;
    Name: string;
    EmailAddress?: string;
  };
  Type: 'ACCPAY' | 'ACCREC';
  Status: 'DRAFT' | 'SUBMITTED' | 'AUTHORISED' | 'PAID' | 'VOIDED';
  Date: string;
  DueDate: string;
  Total: number;
  AmountDue: number;
  AmountPaid: number;
  CurrencyCode: string;
  LineItems: Array<{
    Description: string;
    Quantity: number;
    UnitAmount: number;
    LineAmount: number;
    AccountCode?: string;
  }>;
  Reference?: string;
}

export interface XeroContact {
  ContactID: string;
  Name: string;
  EmailAddress?: string;
  ContactNumber?: string;
  ContactStatus: 'ACTIVE' | 'ARCHIVED';
  IsSupplier: boolean;
  IsCustomer: boolean;
  Addresses?: Array<{
    AddressType: 'POBOX' | 'STREET';
    AddressLine1?: string;
    AddressLine2?: string;
    City?: string;
    Region?: string;
    PostalCode?: string;
    Country?: string;
  }>;
  Phones?: Array<{
    PhoneType: string;
    PhoneNumber: string;
  }>;
  TaxNumber?: string;
  AccountNumber?: string;
}

export interface XeroPayment {
  PaymentID: string;
  Invoice: {
    InvoiceID: string;
    InvoiceNumber: string;
  };
  Account: {
    AccountID: string;
    Code: string;
  };
  Date: string;
  Amount: number;
  Reference?: string;
  Status: 'AUTHORISED' | 'DELETED';
}

// Codat Specific Types
export interface CodatBill {
  id: string;
  supplierRef: {
    id: string;
    supplierName: string;
  };
  issueDate: string;
  dueDate: string;
  totalAmount: number;
  amountDue: number;
  currency: string;
  status: 'Draft' | 'Submitted' | 'PartiallyPaid' | 'Paid' | 'Void';
  lineItems: Array<{
    description: string;
    quantity: number;
    unitAmount: number;
    totalAmount: number;
    accountRef?: {
      id: string;
      name: string;
    };
  }>;
  note?: string;
}

export interface CodatSupplier {
  id: string;
  supplierName: string;
  contactName?: string;
  emailAddress?: string;
  phone?: string;
  status: 'Active' | 'Archived' | 'Unknown';
  addresses: Array<{
    type: 'Billing' | 'Delivery';
    line1?: string;
    line2?: string;
    city?: string;
    region?: string;
    postalCode?: string;
    country?: string;
  }>;
  taxNumber?: string;
}

// Intercept Calculation Types
export interface InterceptOpportunity {
  billId: string;
  billAmount: number;
  wellsFee: number; // 1%
  customerCurrentCost: number; // Wire fee, check processing, etc.
  customerSavings: number;
  netProfit: number; // Wells revenue
  vendorEnrollmentPotential: boolean;
  autoApprove: boolean; // If savings > threshold
}

export interface InterceptProposal {
  billId: string;
  message: string;
  wellsFee: number;
  yourSavings: number;
  currentCost: number;
  paymentDate: Date;
  expiresAt: Date;
}
