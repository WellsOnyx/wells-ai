// ERP Integration Types
// "The Silent Invasion" - Type definitions

export type ERPProvider = 'quickbooks' | 'xero' | 'codat' | 'netsuite' | 'sap' | 'sage' | 'oracle' | 'dynamics365' | 'sage-intacct' | 'acumatica' | 'coupa' | 'workday' | 'infor';

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

  // Oracle specific
  oracle_host?: string;
  oracle_variant?: 'fusion' | 'ebs';
  business_unit_id?: string;

  // Dynamics 365 specific
  dynamics_host?: string;
  dynamics_variant?: 'finance_operations' | 'business_central';
  dynamics_tenant_id?: string;
  dynamics_company_id?: string;
  dynamics_environment?: string;

  // Coupa specific
  coupa_instance_url?: string;

  // Workday specific
  workday_tenant_alias?: string;
  workday_data_center?: 'us' | 'eu' | 'ca' | 'ap';
  workday_is_production?: boolean;

  // Infor specific
  infor_ion_host?: string;
  infor_tenant_id?: string;
  infor_product?: 'csf' | 'lnfin' | 'm3' | 'syteline';
  infor_logical_id?: string;
  infor_company_id?: string;

  // Acumatica specific
  acumatica_instance_url?: string;
  acumatica_tenant?: string;
  acumatica_branch?: string;
  acumatica_company_id?: string;
  acumatica_default_cash_account?: string;

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

// ============================================================================
// ORACLE SPECIFIC TYPES
// ============================================================================

export interface OracleFusionVendor {
  SupplierId: number;
  Supplier: string;
  SupplierNumber?: string;
  TaxpayerId?: string;
  EmailAddress?: string;
  PhoneNumber?: string;
  PaymentCurrency?: string;
  PaymentTerms?: string;
  CreationDate?: string;
  LastUpdateDate?: string;
}

export interface OracleFusionInvoice {
  InvoiceId: number;
  InvoiceNum: string;
  InvoiceAmount: number;
  InvoiceCurrencyCode: string;
  InvoiceDate: string;
  PaymentDueDate?: string;
  Supplier?: string;
  SupplierId?: number;
  InvoiceStatus?: string;
  Description?: string;
  PayGroupLookupCode?: string;
  PaymentStatusFlag?: string;
}

export interface OracleFusionPayment {
  PaymentId: number;
  PaymentNum?: string;
  PaymentAmount: number;
  PaymentCurrencyCode: string;
  PaymentDate: string;
  PaymentMethodCode: string;
  PaymentStatus?: string;
  BankAccountId?: number;
  PaymentReference?: string;
}

// ============================================================================
// DYNAMICS 365 SPECIFIC TYPES
// ============================================================================

// Finance & Operations Types
export interface DynamicsVendor {
  VendorAccountNumber: string;
  VendorOrganizationName: string;
  PrimaryContactEmail?: string;
  PrimaryContactPhone?: string;
  VendorGroupId?: string;
  CurrencyCode: string;
  PaymentTermsId?: string;
  TaxRegistrationNumber?: string;
  IsOnHold: boolean;
  DefaultPaymentMethodName?: string;
  BankAccountNumber?: string;
  BankRoutingNumber?: string;
  BankSWIFTCode?: string;
  BankIBAN?: string;
}

export interface DynamicsInvoice {
  InvoiceId: string;
  VendorInvoiceNumber: string;
  VendorAccountNumber: string;
  VendorName: string;
  InvoiceAmount: number;
  CurrencyCode: string;
  InvoiceDate: string;
  DueDate: string;
  InvoiceStatus: string;
  PurchaseOrderNumber?: string;
  Description?: string;
}

export interface DynamicsPayment {
  PaymentId: string;
  VendorAccountNumber: string;
  PaymentAmount: number;
  CurrencyCode: string;
  PaymentDate: string;
  PaymentMethod: string;
  PaymentStatus: string;
  PaymentReference?: string;
  BankAccountId?: string;
  TransactionId?: string;
}

// Business Central Types
export interface BCVendor {
  id: string;
  number: string;
  displayName: string;
  email?: string;
  phoneNumber?: string;
  taxRegistrationNumber?: string;
  currencyCode: string;
  paymentTermsId?: string;
  blocked?: string;
  lastModifiedDateTime: string;
}

export interface BCInvoice {
  id: string;
  number: string;
  vendorId: string;
  vendorNumber: string;
  vendorName: string;
  invoiceDate: string;
  dueDate: string;
  amount: number;
  currencyCode: string;
  status: string;
  purchaseOrderNumber?: string;
}

export interface BCPayment {
  id: string;
  vendorNumber: string;
  postingDate: string;
  amount: number;
  currencyCode: string;
  description?: string;
  externalDocumentNumber?: string;
}

// ============================================================================
// SAP SPECIFIC TYPES
// ============================================================================

// SAP Business Partner (Vendor)
export interface SAPVendor {
  CardCode: string;
  CardName: string;
  CardType: string;        // 'S' for Supplier
  EmailAddress?: string;
  Phone1?: string;
  FederalTaxID?: string;
  Currency?: string;
  GroupCode?: number;
  PayTermsGrpCode?: number;
  Valid: string;           // 'Y' or 'tYES' for active
  BPAddresses?: Array<{
    AddressName: string;
    Street?: string;
    City?: string;
    Country?: string;
    ZipCode?: string;
  }>;
  BPBankAccounts?: Array<{
    BankCode: string;
    AccountNo: string;
    Branch?: string;
    IBAN?: string;
    SwiftNum?: string;
  }>;
}

// SAP Purchase Invoice
export interface SAPInvoice {
  DocEntry: number;
  DocNum: number;
  CardCode: string;
  CardName: string;
  DocDate: string;
  DocDueDate: string;
  DocTotal: number;
  DocCurrency: string;
  DocumentStatus: string;  // 'O' = Open, 'C' = Closed
  PaidToDate?: number;
  Comments?: string;
  DocumentLines?: Array<{
    LineNum: number;
    ItemDescription: string;
    Quantity: number;
    Price: number;
    LineTotal: number;
    AccountCode?: string;
    CostingCode?: string;
  }>;
}

// SAP Vendor Payment
export interface SAPPayment {
  DocEntry?: number;
  DocNum?: number;
  DocType: string;         // 'S' for Supplier
  CardCode: string;
  DocDate: string;
  DocCurrency: string;
  CashSum?: number;
  TransferSum?: number;
  CheckSum?: number;
  PaymentInvoices?: Array<{
    DocEntry: number;
    InvoiceType: string;   // '18' for AP Invoice
    SumApplied: number;
  }>;
  TransferAccount?: string;
  TransferReference?: string;
  JournalRemarks?: string;
}

// ============================================================================
// NETSUITE SPECIFIC TYPES
// ============================================================================

// NetSuite Vendor Record
export interface NetSuiteVendor {
  id: string;
  entityId: string;
  companyName: string;
  email?: string;
  phone?: string;
  taxNumber?: string;
  currency?: string;
  terms?: string;
  isInactive: string;      // 'T' or 'F'
}

// NetSuite Vendor Bill
export interface NetSuiteBill {
  id: string;
  tranId: string;          // Transaction number
  entity: string;          // Vendor internal ID
  entityName?: string;
  tranDate: string;
  dueDate: string;
  total: number;
  amountRemaining: number;
  status: string;
  currency?: string;
  memo?: string;
}

// NetSuite Vendor Payment
export interface NetSuitePayment {
  id: string;
  tranId: string;
  entity: string;          // Vendor internal ID
  tranDate: string;
  account: string;         // Bank account internal ID
  total: number;
  status: string;
  memo?: string;
}

// ============================================================================
// ACUMATICA SPECIFIC TYPES
// ============================================================================

// Acumatica Vendor (Business Account)
export interface AcumaticaVendor {
  id: string;
  VendorID: { value: string };
  VendorName: { value: string };
  VendorClass: { value?: string };
  Status: { value: 'Active' | 'On Hold' | 'One Time' | 'Inactive' };
  MainContact?: {
    Email?: { value?: string };
    Phone1?: { value?: string };
    Address?: {
      AddressLine1?: { value?: string };
      AddressLine2?: { value?: string };
      City?: { value?: string };
      State?: { value?: string };
      PostalCode?: { value?: string };
      Country?: { value?: string };
    };
  };
  PrimaryContact?: {
    Email?: { value?: string };
    Phone1?: { value?: string };
  };
  PaymentMethod?: { value?: string };
  CashAccount?: { value?: string };
  PaymentLeadTime?: { value?: number };
  Terms?: { value?: string };
  CurrencyID?: { value?: string };
  TaxZone?: { value?: string };
  LandedCostVendor?: { value?: boolean };
  PaymentBy?: { value?: string };
  TaxRegistrationID?: { value?: string };
  LastModifiedDateTime?: { value?: string };
  custom?: Record<string, any>;
}

// Acumatica Bill (AP Bill / Vendor Invoice)
export interface AcumaticaBill {
  id: string;
  Type: { value: 'Bill' | 'Credit Adj.' | 'Debit Adj.' | 'Prepayment' | 'Quick Check' };
  ReferenceNbr: { value: string };
  Status: { value: 'Hold' | 'Balanced' | 'Voided' | 'Scheduled' | 'Open' | 'Closed' | 'Printed' | 'Prebooked' | 'Reserved' };
  Date: { value: string };
  PostPeriod?: { value?: string };
  DueDate?: { value?: string };
  CashDiscountDate?: { value?: string };
  Vendor: { value: string };
  VendorRef?: { value?: string };
  LocationID?: { value?: string };
  CurrencyID?: { value?: string };
  Amount: { value: number };
  Balance?: { value?: number };
  Hold?: { value?: boolean };
  Description?: { value?: string };
  Terms?: { value?: string };
  TaxTotal?: { value?: number };
  Branch?: { value?: string };
  Details?: Array<{
    Branch?: { value?: string };
    InventoryID?: { value?: string };
    TransactionDescr?: { value?: string };
    Qty?: { value?: number };
    UOM?: { value?: string };
    UnitCost?: { value?: number };
    Amount?: { value?: number };
    Account?: { value?: string };
    Subaccount?: { value?: string };
    Project?: { value?: string };
    ProjectTask?: { value?: string };
  }>;
  custom?: Record<string, any>;
}

// Acumatica Payment (AP Payment / Check)
export interface AcumaticaPayment {
  id: string;
  Type: { value: 'Check' | 'Prepayment' | 'Refund' | 'Voided Check' | 'Debit Adj.' };
  ReferenceNbr: { value: string };
  Status: { value: 'Hold' | 'Balanced' | 'Pending Print' | 'Pending Approval' | 'Rejected' | 'Closed' | 'Printed' | 'Voided' | 'Reserved' | 'Open' };
  ApplicationDate: { value: string };
  Vendor: { value: string };
  PaymentMethod?: { value?: string };
  CashAccount?: { value?: string };
  PaymentRef?: { value?: string };
  PaymentAmount: { value: number };
  CurrencyID?: { value?: string };
  UnappliedBalance?: { value?: number };
  Description?: { value?: string };
  Branch?: { value?: string };
  DocumentsToApply?: Array<{
    DocType?: { value?: string };
    ReferenceNbr?: { value?: string };
    AmountPaid?: { value?: number };
    Balance?: { value?: number };
  }>;
  custom?: Record<string, any>;
}

// ============================================================================
// WORKDAY SPECIFIC TYPES (CRITICAL FOR GRAIN TOKEN MODEL)
// ============================================================================

// Workday Worker (for contractor payroll - HUGE for GRAIN)
export interface WorkdayWorker {
  workerId: string;
  workerDescriptor: string;
  workerType: 'Employee' | 'Contingent_Worker';
  employeeId?: string;
  contingentWorkerId?: string;
  legalName: {
    firstName: string;
    lastName: string;
    middleName?: string;
  };
  email?: string;
  phone?: string;
  hireDate: string;
  terminationDate?: string;
  jobTitle?: string;
  department?: string;
  costCenter?: string;
  payGroup?: string;
  hourlyRate?: number;
  annualSalary?: number;
  currency: string;
  isActive: boolean;
  managerId?: string;
  location?: string;
  taxId?: string;
  bankAccountLastFour?: string;
}

// Workday Supplier/Vendor
export interface WorkdayVendor {
  supplierId: string;
  supplierReferenceId: string;
  supplierName: string;
  supplierCategory?: string;
  taxId?: string;
  email?: string;
  phone?: string;
  address?: {
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    stateProvince?: string;
    postalCode?: string;
    country?: string;
  };
  defaultCurrency: string;
  paymentTerms?: string;
  bankAccountNumber?: string;
  routingNumber?: string;
  swiftCode?: string;
  iban?: string;
  status: 'Active' | 'Inactive';
  isContractor: boolean;  // CRITICAL for GRAIN
  w9OnFile: boolean;
}

// Workday Supplier Invoice (Bill)
export interface WorkdayBill {
  invoiceId: string;
  invoiceNumber: string;
  supplierId: string;
  supplierName: string;
  invoiceDate: string;
  dueDate: string;
  totalAmount: number;
  currencyCode: string;
  status: 'Draft' | 'In_Progress' | 'Approved' | 'Paid' | 'Cancelled';
  paymentStatus: 'Unpaid' | 'Partial' | 'Paid';
  amountPaid: number;
  amountRemaining: number;
  purchaseOrderNumber?: string;
  companyId?: string;
  memo?: string;
  lineItems?: Array<{
    lineNumber: number;
    description: string;
    quantity: number;
    unitCost: number;
    extendedAmount: number;
    spendCategory?: string;
    costCenter?: string;
  }>;
}

// Workday Payment
export interface WorkdayPayment {
  paymentId: string;
  paymentNumber: string;
  supplierId: string;
  paymentDate: string;
  paymentAmount: number;
  currencyCode: string;
  paymentMethod: 'Check' | 'EFT' | 'Wire' | 'ACH' | 'Manual';
  paymentStatus: 'Initiated' | 'Approved' | 'In_Progress' | 'Completed' | 'Failed' | 'Cancelled';
  bankAccountId?: string;
  referenceNumber?: string;
  memo?: string;
  invoicesApplied?: Array<{
    invoiceId: string;
    amountApplied: number;
  }>;
}

// Workday Payroll Run (CRITICAL for GRAIN - contractor payments)
export interface WorkdayPayrollRun {
  payrollRunId: string;
  payGroupId: string;
  payGroupName: string;
  periodStartDate: string;
  periodEndDate: string;
  paymentDate: string;
  status: 'In_Progress' | 'Complete' | 'Confirmed';
  totalGrossPay: number;
  totalNetPay: number;
  totalDeductions: number;
  totalTaxes: number;
  currency: string;
  workerCount: number;
  contractorCount: number;   // HUGE for GRAIN
  contractorGrossPay: number; // HUGE for GRAIN
}

// Workday Contractor Payment Detail (CRITICAL for GRAIN)
export interface WorkdayContractorPayment {
  paymentId: string;
  workerId: string;
  workerName: string;
  contingentWorkerId: string;
  payPeriodStart: string;
  payPeriodEnd: string;
  paymentDate: string;
  grossPay: number;
  deductions: number;
  netPay: number;
  currency: string;
  hoursWorked?: number;
  hourlyRate?: number;
  payType: 'Hourly' | 'Fixed' | 'Project' | 'Milestone';
  projectCode?: string;
  costCenter?: string;
  supplierInvoiceId?: string;  // Links to supplier invoice if applicable
}

// GRAIN Token Eligibility Summary
export interface WorkdayGrainEligibility {
  eligible: boolean;
  contractorVolume: number;
  estimatedGrainTokens: number;
  contractorCount: number;
  averagePaymentSize: number;
  dateRange: {
    from: string;
    to: string;
  };
}

// ============================================================================
// COUPA SPECIFIC TYPES
// ============================================================================

// Coupa Supplier (Vendor)
export interface CoupaSupplier {
  id: number;
  name: string;
  display_name?: string;
  number?: string;
  status: 'active' | 'inactive' | 'pending';
  primary_contact?: {
    email?: string;
    phone_work?: string;
    phone_mobile?: string;
  };
  primary_address?: {
    street1?: string;
    street2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: {
      code: string;
      name: string;
    };
  };
  tax_id?: string;
  payment_term?: {
    id: number;
    code: string;
    description?: string;
  };
  default_currency?: {
    id: number;
    code: string;
  };
  remit_to_addresses?: Array<{
    id: number;
    remit_to_code?: string;
    bank_account_number?: string;
    bank_routing_number?: string;
    iban?: string;
    swift_code?: string;
  }>;
  created_at: string;
  updated_at: string;
}

// Coupa Invoice (Supplier Invoice - procurement focused)
export interface CoupaInvoice {
  id: number;
  invoice_number: string;
  supplier: {
    id: number;
    name: string;
    number?: string;
  };
  status: 'draft' | 'pending_approval' | 'approved' | 'disputed' | 'paid' | 'voided';
  invoice_date: string;
  payment_due_date?: string;
  total: string | number;
  currency: {
    id: number;
    code: string;
  };
  paid: string | number;
  invoice_lines?: Array<{
    id: number;
    description?: string;
    quantity: string | number;
    price: string | number;
    total: string | number;
    account?: {
      id: number;
      code: string;
      name: string;
    };
    order_line?: {
      id: number;
      order_header_id: number;
      order_header_number?: string;
    };
  }>;
  order_header?: {
    id: number;
    po_number: string;
  };
  payment_term?: {
    id: number;
    code: string;
  };
  remit_to_address?: {
    id: number;
    remit_to_code?: string;
  };
  notes?: string;
  created_at: string;
  updated_at: string;
}

// Coupa Purchase Order
export interface CoupaPurchaseOrder {
  id: number;
  po_number: string;
  supplier: {
    id: number;
    name: string;
    number?: string;
  };
  status: 'draft' | 'pending_approval' | 'ordered' | 'soft_closed' | 'closed' | 'cancelled';
  order_date?: string;
  total?: string | number;
  currency?: {
    id: number;
    code: string;
  };
  order_lines?: Array<{
    id: number;
    description?: string;
    quantity: string | number;
    price: string | number;
    total: string | number;
    received?: string | number;
    invoiced?: string | number;
  }>;
  payment_term?: {
    id: number;
    code: string;
  };
  created_at: string;
  updated_at: string;
}

// Coupa Payment
export interface CoupaPayment {
  id: number;
  payment_number?: string;
  supplier: {
    id: number;
    name: string;
  };
  amount: string | number;
  currency: {
    id: number;
    code: string;
  };
  payment_date: string;
  payment_method?: string;
  status: 'pending' | 'processing' | 'paid' | 'failed' | 'voided';
  bank_account?: {
    id: number;
    account_number?: string;
  };
  invoices?: Array<{
    id: number;
    invoice_number: string;
    amount_applied: string | number;
  }>;
  external_ref_number?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// INFOR SPECIFIC TYPES
// ============================================================================

// Infor Product Variants
export type InforProduct = 'csf' | 'lnfin' | 'm3' | 'syteline';

// CloudSuite Financials (CSF) Types
export interface InforCSFVendor {
  VendorNumber: string;
  VendorName: string;
  EmailAddress?: string;
  PhoneNumber?: string;
  TaxId?: string;
  CurrencyCode: string;
  PaymentTerms?: string;
  Status: 'Active' | 'Inactive' | 'Hold';
  BankAccountNumber?: string;
  BankRoutingNumber?: string;
  BankSwiftCode?: string;
  BankIBAN?: string;
  AddressLine1?: string;
  AddressLine2?: string;
  City?: string;
  StateProvince?: string;
  PostalCode?: string;
  Country?: string;
  LastModifiedDate?: string;
}

export interface InforCSFInvoice {
  InvoiceId: string;
  InvoiceNumber: string;
  VendorNumber: string;
  VendorName: string;
  InvoiceAmount: number;
  CurrencyCode: string;
  InvoiceDate: string;
  DueDate: string;
  PaymentStatus: 'Open' | 'Partial' | 'Paid' | 'Void';
  AmountPaid: number;
  AmountRemaining: number;
  PurchaseOrderNumber?: string;
  Description?: string;
  CompanyId?: string;
}

export interface InforCSFPayment {
  PaymentId: string;
  PaymentNumber?: string;
  VendorNumber: string;
  PaymentAmount: number;
  CurrencyCode: string;
  PaymentDate: string;
  PaymentMethod: string;
  PaymentStatus: string;
  BankAccountId?: string;
  ReferenceNumber?: string;
  CheckNumber?: string;
}

// LN Finance Types
export interface InforLNVendor {
  BusinessPartner: string;
  Name: string;
  Email?: string;
  Phone?: string;
  TaxRegistrationNumber?: string;
  Currency?: string;
  PaymentMethod?: string;
  Status: number;  // 1 = Active, 2 = Blocked
  BankAccount?: string;
  IBAN?: string;
  BIC?: string;
}

export interface InforLNInvoice {
  Invoice: string;
  TransactionNumber: string;
  BusinessPartner: string;
  BusinessPartnerName?: string;
  InvoiceAmount: number;
  Currency: string;
  InvoiceDate: string;
  DueDate: string;
  Status: number;  // 1 = Open, 2 = Partially Paid, 3 = Paid
  PaidAmount: number;
  OpenAmount: number;
  Description?: string;
}

export interface InforLNPayment {
  PaymentDocument: string;
  BusinessPartner: string;
  Amount: number;
  Currency: string;
  PaymentDate: string;
  PaymentMethod: string;
  BankReference?: string;
  Status: number;
}

// M3 Types
export interface InforM3Vendor {
  SUNO: string;           // Supplier Number
  SUNM: string;           // Supplier Name
  PHNO?: string;          // Phone
  EMAL?: string;          // Email
  VRNO?: string;          // VAT Registration Number
  CUCD?: string;          // Currency Code
  TEPY?: string;          // Terms of Payment
  STAT: string;           // Status: 20 = Active
  BKAC?: string;          // Bank Account
  IBAN?: string;
  SPTS?: string;          // Swift Code
}

export interface InforM3Invoice {
  SUNO: string;           // Supplier Number
  SINO: string;           // Supplier Invoice Number
  IVAM: number;           // Invoice Amount
  CUCD: string;           // Currency Code
  IVDT: string;           // Invoice Date (YYYYMMDD)
  DUDT: string;           // Due Date (YYYYMMDD)
  PYST: string;           // Payment Status
  PAAM: number;           // Paid Amount
  OPAM: number;           // Open Amount
  PUNO?: string;          // Purchase Order Number
  VTXT?: string;          // Voucher Text
}

export interface InforM3Payment {
  PPYN: string;           // Payment Proposal Number
  SUNO: string;           // Supplier Number
  PYAM: number;           // Payment Amount
  CUCD: string;           // Currency Code
  PYDT: string;           // Payment Date (YYYYMMDD)
  PMTP: string;           // Payment Method
  BKRF?: string;          // Bank Reference
  PYST: string;           // Payment Status
}

// SyteLine Types
export interface InforSyteLineVendor {
  VendNum: string;
  VendName: string;
  Email?: string;
  Phone?: string;
  TaxRegNum?: string;
  CurrCode: string;
  PaymentTerms?: string;
  VendStatus: string;
  BankAcct?: string;
  RoutingNum?: string;
}

export interface InforSyteLineVoucher {
  Voucher: string;
  VendNum: string;
  VendName?: string;
  VouchAmt: number;
  CurrCode: string;
  InvDate: string;
  DueDate: string;
  Status: string;
  AmtPaid: number;
  AmtOpen: number;
  PoNum?: string;
  Description?: string;
}

export interface InforSyteLinePayment {
  CheckNum: string;
  VendNum: string;
  CheckAmt: number;
  CurrCode: string;
  CheckDate: string;
  PayMethod: string;
  BankCode?: string;
  RefNum?: string;
}

// ============================================================================
// SAGE INTACCT SPECIFIC TYPES
// ============================================================================

// Sage Intacct Vendor
export interface IntacctVendor {
  VENDORID: string;
  NAME: string;
  DISPLAYCONTACT?: {
    CONTACTNAME?: string;
    EMAIL1?: string;
    PHONE1?: string;
    MAILADDRESS?: {
      ADDRESS1?: string;
      ADDRESS2?: string;
      CITY?: string;
      STATE?: string;
      ZIP?: string;
      COUNTRY?: string;
    };
  };
  STATUS: 'active' | 'inactive';
  TAXID?: string;
  CURRENCY?: string;
  TERMNAME?: string;
  PAYMETHOD?: string;
  BANKACCOUNTNO?: string;
  BANKROUTINGNO?: string;
  WHENMODIFIED?: string;
}

// Sage Intacct AP Bill
export interface IntacctBill {
  RECORDNO: string;
  RECORDID: string;
  VENDORID: string;
  VENDORNAME?: string;
  WHENCREATED: string;
  WHENDUE: string;
  TOTALAMOUNT: number;
  TOTALDUE: number;
  TOTALPAID: number;
  CURRENCY?: string;
  STATE: 'Posted' | 'Draft' | 'Submitted' | 'Approved' | 'Declined' | 'Partially Approved';
  DESCRIPTION?: string;
  LOCATIONID?: string;           // Entity ID for multi-entity
  DEPARTMENTID?: string;
  PROJECTID?: string;
  APBILLITEMS?: Array<{
    ACCOUNTNO: string;
    AMOUNT: number;
    MEMO?: string;
    LOCATIONID?: string;
    DEPARTMENTID?: string;
  }>;
}

// Sage Intacct AP Payment
export interface IntacctPayment {
  RECORDNO: string;
  PAYMENTMETHOD: string;
  VENDORID: string;
  VENDORNAME?: string;
  PAYMENTDATE: string;
  PAYMENTAMOUNT: number;
  CURRENCY?: string;
  DOCNUMBER?: string;
  BANKACCOUNTID?: string;
  DESCRIPTION?: string;
  STATE: string;
  LOCATIONID?: string;           // Entity ID for multi-entity
}

// Sage Intacct Entity (Location) for multi-entity accounting
export interface IntacctEntity {
  LOCATIONID: string;
  NAME: string;
  PARENTID?: string;
  STATUS: 'active' | 'inactive';
  CURRENCY?: string;
  STARTDATE?: string;
  ENDDATE?: string;
}

// Sage Intacct Session
export interface IntacctSession {
  sessionId: string;
  endpoint: string;
  expiresAt: Date;
}
