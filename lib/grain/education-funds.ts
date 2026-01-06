/**
 * Education Fund Management - ESA/SFO Vertical
 *
 * Grain & Vault for Scholarship Fund Organizations (SFOs) and
 * Education Savings Account (ESA) program administrators.
 *
 * KEY VALUE PROPOSITION:
 * - SFO deposits state funds into VAULT (100% protected)
 * - Funds earn appreciation while protected
 * - Disbursements via GRAIN credit line to approved vendors
 * - Principal stays intact - appreciation subsidizes operations
 *
 * COMPLIANCE FEATURES:
 * - Per-student accounting and audit trails
 * - Eligible expense validation
 * - State reporting integration
 * - Vendor qualification and management
 *
 * SUPPORTED PROGRAMS:
 * - Arizona ESA (Empowerment Scholarship Accounts)
 * - Florida FES (Family Empowerment Scholarship)
 * - West Virginia Hope Scholarship
 * - Private scholarship funds
 * - 529-adjacent programs
 * - Microschool funding programs
 */

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface EducationFundOrganization {
  id: string
  name: string
  type: 'state_esa' | 'private_sfo' | 'microschool_fund' | '529_adjacent'
  state?: string
  programName?: string

  // Fund status
  totalDeposited: number        // Total deposited into VAULT
  protectedPrincipal: number    // Amount protected (always withdrawable)
  currentValue: number          // Current value including appreciation
  appreciationEarned: number    // Total appreciation earned

  // Credit line
  creditLineTotal: number       // Total credit line available
  creditLineUsed: number        // Amount currently disbursed
  creditLineAvailable: number   // Remaining credit

  // Stats
  totalStudents: number
  activeStudents: number
  totalVendors: number
  totalDisbursements: number

  // Compliance
  lastAuditDate: Date | null
  complianceStatus: 'compliant' | 'review_needed' | 'action_required'
  stateReportingEnabled: boolean

  createdAt: Date
  updatedAt: Date
}

export interface StudentAccount {
  id: string
  organizationId: string

  // Student info (PII should be encrypted in production)
  studentId: string             // Internal ID
  externalStudentId?: string    // State-assigned ID
  firstName: string
  lastName: string
  gradeLevel: string
  schoolYear: string

  // Fund allocation
  allocatedAmount: number       // Amount allocated to this student
  availableBalance: number      // Available for disbursement
  totalDisbursed: number        // Total disbursed for this student
  pendingDisbursements: number  // Pending disbursement amount

  // Status
  status: 'active' | 'inactive' | 'graduated' | 'transferred'
  enrollmentDate: Date

  // Eligible categories for this student
  eligibleCategories: ExpenseCategory[]

  createdAt: Date
  updatedAt: Date
}

export type ExpenseCategory =
  | 'tuition'
  | 'curriculum'
  | 'tutoring'
  | 'therapy_services'       // OT, PT, Speech
  | 'educational_technology'
  | 'testing_fees'
  | 'transportation'
  | 'uniforms'
  | 'extracurricular'
  | 'special_needs_services'
  | 'microschool_fees'

export interface ApprovedVendor {
  id: string
  organizationId: string

  // Vendor info
  name: string
  vendorType: ExpenseCategory[]
  taxId?: string

  // Contact
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  address?: string

  // Payment info
  paymentMethod: 'ach' | 'check' | 'grain_direct'
  bankAccountLast4?: string
  grainWalletId?: string

  // Status
  status: 'active' | 'pending_approval' | 'suspended' | 'inactive'
  verificationDate?: Date
  verificationMethod?: string

  // Stats
  totalPayments: number
  totalAmount: number
  lastPaymentDate?: Date

  createdAt: Date
  updatedAt: Date
}

export interface Disbursement {
  id: string
  organizationId: string
  studentAccountId: string
  vendorId: string

  // Amount
  amount: number
  grainAmount?: number
  grainPriceAtTime?: number

  // Details
  category: ExpenseCategory
  description: string
  invoiceNumber?: string
  invoiceDate?: Date

  // Status
  status: 'pending_approval' | 'approved' | 'processing' | 'completed' | 'rejected' | 'refunded'
  approvedBy?: string
  approvedAt?: Date
  processedAt?: Date
  completedAt?: Date
  rejectionReason?: string

  // Compliance
  complianceChecked: boolean
  complianceNotes?: string

  createdAt: Date
  updatedAt: Date
}

export interface StateReportingRecord {
  id: string
  organizationId: string
  reportType: 'quarterly' | 'annual' | 'audit' | 'disbursement_detail'
  reportingPeriodStart: Date
  reportingPeriodEnd: Date

  // Status
  status: 'draft' | 'submitted' | 'accepted' | 'revision_needed'
  submittedAt?: Date

  // Data
  totalFundsManaged: number
  totalDisbursements: number
  studentCount: number

  // File reference
  reportFileUrl?: string

  createdAt: Date
}

// ============================================================================
// EXPENSE VALIDATION
// ============================================================================

/**
 * Eligible expense definitions by program type
 * Each state ESA has different eligible expense categories
 */
export const ELIGIBLE_EXPENSES_BY_PROGRAM: Record<string, ExpenseCategory[]> = {
  'arizona_esa': [
    'tuition',
    'curriculum',
    'tutoring',
    'therapy_services',
    'educational_technology',
    'testing_fees',
    'transportation',
    'uniforms',
    'extracurricular',
    'special_needs_services',
    'microschool_fees'
  ],
  'florida_fes': [
    'tuition',
    'curriculum',
    'tutoring',
    'therapy_services',
    'educational_technology',
    'testing_fees',
    'transportation',
    'uniforms'
  ],
  'west_virginia_hope': [
    'tuition',
    'curriculum',
    'tutoring',
    'therapy_services',
    'educational_technology',
    'testing_fees'
  ],
  'private_scholarship': [
    'tuition',
    'curriculum',
    'tutoring',
    'therapy_services',
    'educational_technology',
    'testing_fees',
    'transportation',
    'uniforms',
    'extracurricular',
    'special_needs_services',
    'microschool_fees'
  ],
  'microschool_fund': [
    'tuition',
    'curriculum',
    'tutoring',
    'microschool_fees'
  ]
}

/**
 * Category display names
 */
export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  tuition: 'Tuition & Fees',
  curriculum: 'Curriculum & Textbooks',
  tutoring: 'Tutoring Services',
  therapy_services: 'Therapy Services (OT/PT/Speech)',
  educational_technology: 'Educational Technology',
  testing_fees: 'Testing & Assessment Fees',
  transportation: 'Transportation',
  uniforms: 'Uniforms & Dress Code',
  extracurricular: 'Extracurricular Activities',
  special_needs_services: 'Special Needs Services',
  microschool_fees: 'Microschool Fees'
}

/**
 * Validate if an expense is eligible for a student
 */
export function validateExpense(
  student: StudentAccount,
  category: ExpenseCategory,
  amount: number,
  vendor: ApprovedVendor
): { valid: boolean; reason?: string } {
  // Check if student is active
  if (student.status !== 'active') {
    return { valid: false, reason: 'Student account is not active' }
  }

  // Check if category is eligible for student
  if (!student.eligibleCategories.includes(category)) {
    return { valid: false, reason: `Category "${EXPENSE_CATEGORY_LABELS[category]}" is not eligible for this student` }
  }

  // Check if vendor supports this category
  if (!vendor.vendorType.includes(category)) {
    return { valid: false, reason: `Vendor is not approved for "${EXPENSE_CATEGORY_LABELS[category]}"` }
  }

  // Check if vendor is active
  if (vendor.status !== 'active') {
    return { valid: false, reason: 'Vendor is not currently active' }
  }

  // Check available balance
  if (amount > student.availableBalance) {
    return {
      valid: false,
      reason: `Amount $${amount.toFixed(2)} exceeds available balance of $${student.availableBalance.toFixed(2)}`
    }
  }

  return { valid: true }
}

// ============================================================================
// FUND MANAGEMENT FUNCTIONS
// ============================================================================

/**
 * Create a new student account
 */
export async function createStudentAccount(
  organizationId: string,
  data: {
    studentId: string
    firstName: string
    lastName: string
    gradeLevel: string
    schoolYear: string
    allocatedAmount: number
    eligibleCategories: ExpenseCategory[]
  }
): Promise<StudentAccount> {
  // In production, this would interact with the database
  const account: StudentAccount = {
    id: `stu_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    organizationId,
    studentId: data.studentId,
    firstName: data.firstName,
    lastName: data.lastName,
    gradeLevel: data.gradeLevel,
    schoolYear: data.schoolYear,
    allocatedAmount: data.allocatedAmount,
    availableBalance: data.allocatedAmount,
    totalDisbursed: 0,
    pendingDisbursements: 0,
    status: 'active',
    enrollmentDate: new Date(),
    eligibleCategories: data.eligibleCategories,
    createdAt: new Date(),
    updatedAt: new Date()
  }

  // TODO: Insert into database
  // await sql`INSERT INTO education_student_accounts ...`

  return account
}

/**
 * Process a disbursement request
 */
export async function createDisbursementRequest(
  organizationId: string,
  data: {
    studentAccountId: string
    vendorId: string
    amount: number
    category: ExpenseCategory
    description: string
    invoiceNumber?: string
    invoiceDate?: Date
  }
): Promise<Disbursement> {
  const disbursement: Disbursement = {
    id: `dis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    organizationId,
    studentAccountId: data.studentAccountId,
    vendorId: data.vendorId,
    amount: data.amount,
    category: data.category,
    description: data.description,
    invoiceNumber: data.invoiceNumber,
    invoiceDate: data.invoiceDate,
    status: 'pending_approval',
    complianceChecked: false,
    createdAt: new Date(),
    updatedAt: new Date()
  }

  // TODO: Insert into database
  // await sql`INSERT INTO education_disbursements ...`

  return disbursement
}

/**
 * Approve a disbursement and process via GRAIN credit line
 */
export async function approveDisbursement(
  disbursementId: string,
  approvedBy: string,
  grainPrice: number
): Promise<Disbursement> {
  // TODO: Fetch disbursement from database
  // TODO: Validate fund availability
  // TODO: Process via GRAIN credit line
  // TODO: Update student account balance
  // TODO: Record transaction

  // Mock implementation
  const disbursement: Disbursement = {
    id: disbursementId,
    organizationId: 'org_mock',
    studentAccountId: 'stu_mock',
    vendorId: 'ven_mock',
    amount: 0,
    category: 'tuition',
    description: 'Mock disbursement',
    status: 'approved',
    approvedBy,
    approvedAt: new Date(),
    grainPriceAtTime: grainPrice,
    complianceChecked: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }

  return disbursement
}

/**
 * Add an approved vendor
 */
export async function addApprovedVendor(
  organizationId: string,
  data: {
    name: string
    vendorType: ExpenseCategory[]
    taxId?: string
    contactName?: string
    contactEmail?: string
    paymentMethod: 'ach' | 'check' | 'grain_direct'
  }
): Promise<ApprovedVendor> {
  const vendor: ApprovedVendor = {
    id: `ven_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    organizationId,
    name: data.name,
    vendorType: data.vendorType,
    taxId: data.taxId,
    contactName: data.contactName,
    contactEmail: data.contactEmail,
    paymentMethod: data.paymentMethod,
    status: 'pending_approval',
    totalPayments: 0,
    totalAmount: 0,
    createdAt: new Date(),
    updatedAt: new Date()
  }

  // TODO: Insert into database
  // await sql`INSERT INTO education_vendors ...`

  return vendor
}

// ============================================================================
// COMPLIANCE & REPORTING
// ============================================================================

/**
 * Generate compliance report for state reporting
 */
export async function generateStateReport(
  organizationId: string,
  reportType: 'quarterly' | 'annual',
  periodStart: Date,
  periodEnd: Date
): Promise<StateReportingRecord> {
  // TODO: Aggregate data from database
  // TODO: Format according to state requirements
  // TODO: Generate PDF or required format

  const report: StateReportingRecord = {
    id: `rpt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    organizationId,
    reportType,
    reportingPeriodStart: periodStart,
    reportingPeriodEnd: periodEnd,
    status: 'draft',
    totalFundsManaged: 0,
    totalDisbursements: 0,
    studentCount: 0,
    createdAt: new Date()
  }

  return report
}

/**
 * Calculate fund health metrics
 */
export function calculateFundMetrics(org: EducationFundOrganization): {
  utilizationRate: number
  appreciationRate: number
  averagePerStudent: number
  complianceScore: number
  fundProtectionRatio: number
} {
  const utilizationRate = org.creditLineTotal > 0
    ? (org.creditLineUsed / org.creditLineTotal) * 100
    : 0

  const appreciationRate = org.totalDeposited > 0
    ? ((org.currentValue - org.totalDeposited) / org.totalDeposited) * 100
    : 0

  const averagePerStudent = org.activeStudents > 0
    ? org.currentValue / org.activeStudents
    : 0

  // Simple compliance score based on status
  const complianceScore = org.complianceStatus === 'compliant' ? 100
    : org.complianceStatus === 'review_needed' ? 75
    : 50

  // Fund protection: how much of the principal is protected
  const fundProtectionRatio = org.totalDeposited > 0
    ? (org.protectedPrincipal / org.totalDeposited) * 100
    : 100

  return {
    utilizationRate,
    appreciationRate,
    averagePerStudent,
    complianceScore,
    fundProtectionRatio
  }
}

// ============================================================================
// MOCK DATA GENERATORS (for demo/development)
// ============================================================================

/**
 * Generate mock organization data
 */
export function generateMockOrganization(): EducationFundOrganization {
  return {
    id: 'org_demo_123',
    name: 'Arizona Excellence Scholarship Fund',
    type: 'state_esa',
    state: 'AZ',
    programName: 'Empowerment Scholarship Account',
    totalDeposited: 2500000,
    protectedPrincipal: 2500000,
    currentValue: 2612500, // 4.5% appreciation
    appreciationEarned: 112500,
    creditLineTotal: 2500000,
    creditLineUsed: 1875000,
    creditLineAvailable: 625000,
    totalStudents: 342,
    activeStudents: 328,
    totalVendors: 156,
    totalDisbursements: 1247,
    lastAuditDate: new Date('2024-12-15'),
    complianceStatus: 'compliant',
    stateReportingEnabled: true,
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date()
  }
}

/**
 * Generate mock student accounts
 */
export function generateMockStudents(count: number = 10): StudentAccount[] {
  const firstNames = ['Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'Ethan', 'Sophia', 'Mason', 'Isabella', 'William']
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Martinez', 'Anderson']
  const grades = ['K', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th']

  return Array.from({ length: count }, (_, i) => ({
    id: `stu_demo_${i + 1}`,
    organizationId: 'org_demo_123',
    studentId: `STU${String(i + 1).padStart(5, '0')}`,
    externalStudentId: `AZ-ESA-${String(100000 + i)}`,
    firstName: firstNames[i % firstNames.length],
    lastName: lastNames[i % lastNames.length],
    gradeLevel: grades[Math.floor(Math.random() * grades.length)],
    schoolYear: '2024-2025',
    allocatedAmount: 7000 + Math.floor(Math.random() * 3000),
    availableBalance: 2000 + Math.floor(Math.random() * 3000),
    totalDisbursed: 3000 + Math.floor(Math.random() * 2000),
    pendingDisbursements: Math.floor(Math.random() * 500),
    status: Math.random() > 0.1 ? 'active' : 'inactive',
    enrollmentDate: new Date('2024-08-15'),
    eligibleCategories: ELIGIBLE_EXPENSES_BY_PROGRAM['arizona_esa'] as ExpenseCategory[],
    createdAt: new Date('2024-08-15'),
    updatedAt: new Date()
  }))
}

/**
 * Generate mock vendors
 */
export function generateMockVendors(count: number = 10): ApprovedVendor[] {
  const vendors = [
    { name: 'Sunrise Academy', types: ['tuition', 'uniforms'] as ExpenseCategory[] },
    { name: 'Math Mastery Tutoring', types: ['tutoring'] as ExpenseCategory[] },
    { name: 'Oak Tree Curriculum', types: ['curriculum'] as ExpenseCategory[] },
    { name: 'Therapy Partners AZ', types: ['therapy_services', 'special_needs_services'] as ExpenseCategory[] },
    { name: 'EdTech Solutions', types: ['educational_technology'] as ExpenseCategory[] },
    { name: 'Academic Testing Center', types: ['testing_fees'] as ExpenseCategory[] },
    { name: 'Desert Transport Services', types: ['transportation'] as ExpenseCategory[] },
    { name: 'Learning Tree Microschool', types: ['microschool_fees', 'curriculum'] as ExpenseCategory[] },
    { name: 'Valley Speech & Language', types: ['therapy_services'] as ExpenseCategory[] },
    { name: 'Phoenix Music Academy', types: ['extracurricular'] as ExpenseCategory[] }
  ]

  return vendors.slice(0, count).map((v, i) => ({
    id: `ven_demo_${i + 1}`,
    organizationId: 'org_demo_123',
    name: v.name,
    vendorType: v.types,
    status: Math.random() > 0.15 ? 'active' : 'pending_approval',
    paymentMethod: Math.random() > 0.5 ? 'ach' : 'grain_direct',
    totalPayments: Math.floor(Math.random() * 50),
    totalAmount: Math.floor(Math.random() * 50000),
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date()
  })) as ApprovedVendor[]
}

/**
 * Generate mock disbursement history
 */
export function generateMockDisbursements(count: number = 20): Disbursement[] {
  const categories: ExpenseCategory[] = ['tuition', 'curriculum', 'tutoring', 'therapy_services', 'educational_technology']
  const statuses: Disbursement['status'][] = ['completed', 'completed', 'completed', 'pending_approval', 'processing']

  return Array.from({ length: count }, (_, i) => {
    const amount = 100 + Math.floor(Math.random() * 900)
    const status = statuses[Math.floor(Math.random() * statuses.length)]
    const createdAt = new Date()
    createdAt.setDate(createdAt.getDate() - Math.floor(Math.random() * 30))

    return {
      id: `dis_demo_${i + 1}`,
      organizationId: 'org_demo_123',
      studentAccountId: `stu_demo_${Math.floor(Math.random() * 10) + 1}`,
      vendorId: `ven_demo_${Math.floor(Math.random() * 10) + 1}`,
      amount,
      grainAmount: amount / 1.045,
      grainPriceAtTime: 1.045,
      category: categories[Math.floor(Math.random() * categories.length)],
      description: `${categories[Math.floor(Math.random() * categories.length)]} expense`,
      invoiceNumber: `INV-${String(1000 + i)}`,
      status,
      complianceChecked: status === 'completed',
      approvedBy: status === 'completed' ? 'admin@sfo.org' : undefined,
      approvedAt: status === 'completed' ? createdAt : undefined,
      completedAt: status === 'completed' ? createdAt : undefined,
      createdAt,
      updatedAt: new Date()
    }
  })
}
