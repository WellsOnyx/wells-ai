/**
 * Grain & Vault Account Types
 * Types for treasury accounts, onboarding, and SDK access
 */

// ============================================================================
// ONBOARDING
// ============================================================================

export type GrainVaultOnboardingStep =
  | 'welcome'
  | 'company'
  | 'erp'
  | 'treasury'
  | 'complete'

export const GRAIN_VAULT_STEPS: GrainVaultOnboardingStep[] = [
  'welcome',
  'company',
  'erp',
  'treasury',
  'complete'
]

export const STEP_TITLES: Record<GrainVaultOnboardingStep, string> = {
  'welcome': 'Welcome',
  'company': 'Company Info',
  'erp': 'ERP Integration',
  'treasury': 'Treasury Setup',
  'complete': 'Ready!'
}

// ============================================================================
// ACCOUNT TYPES
// ============================================================================

export type ERPSystem =
  | 'sap'
  | 'oracle'
  | 'netsuite'
  | 'dynamics365'
  | 'workday'
  | 'coupa'
  | 'other'
  | 'none'

export type AccountTier = 'starter' | 'growth' | 'enterprise'
export type AccountStatus = 'pending' | 'active' | 'suspended' | 'closed'

export interface GrainVaultAccount {
  id: string
  userId: string

  // Company Info
  companyName: string
  companySize: 'startup' | 'smb' | 'mid-market' | 'enterprise'
  industry: string
  country: string

  // ERP Integration
  erpSystem: ERPSystem
  erpVersion?: string
  erpConnected: boolean

  // Treasury
  walletAddress?: string
  grainBalance: number
  creditLine: number
  usedCredit: number

  // Account
  tier: AccountTier
  status: AccountStatus
  apiKey?: string
  sdkEnabled: boolean

  // Timestamps
  createdAt: Date
  updatedAt: Date
  onboardingCompletedAt?: Date
}

export interface GrainVaultOnboardingState {
  userId: string
  currentStep: GrainVaultOnboardingStep
  completedSteps: GrainVaultOnboardingStep[]
  companyData?: Partial<CompanyData>
  erpData?: Partial<ERPData>
  treasuryData?: Partial<TreasuryData>
  startedAt: Date
  lastUpdatedAt: Date
}

// ============================================================================
// STEP DATA
// ============================================================================

export interface CompanyData {
  companyName: string
  companySize: 'startup' | 'smb' | 'mid-market' | 'enterprise'
  industry: string
  country: string
  role: string
  teamSize: number
  monthlyPaymentVolume: string
}

export interface ERPData {
  erpSystem: ERPSystem
  erpVersion?: string
  hasApiAccess: boolean
  primaryUseCase: 'vendor-payments' | 'receivables' | 'treasury-management' | 'all'
}

export interface TreasuryData {
  walletCreated: boolean
  walletAddress?: string
  initialDeposit?: number
  kycStatus: 'not-started' | 'pending' | 'approved' | 'rejected'
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const ERP_OPTIONS: { value: ERPSystem; label: string; popular?: boolean }[] = [
  { value: 'netsuite', label: 'Oracle NetSuite', popular: true },
  { value: 'sap', label: 'SAP S/4HANA', popular: true },
  { value: 'oracle', label: 'Oracle Fusion Cloud', popular: true },
  { value: 'dynamics365', label: 'Microsoft Dynamics 365', popular: true },
  { value: 'workday', label: 'Workday Financial Management' },
  { value: 'coupa', label: 'Coupa' },
  { value: 'other', label: 'Other ERP' },
  { value: 'none', label: 'No ERP (Getting Started)' }
]

export const INDUSTRY_OPTIONS = [
  'Technology',
  'Manufacturing',
  'Retail & E-commerce',
  'Healthcare',
  'Financial Services',
  'Professional Services',
  'Construction',
  'Logistics & Transportation',
  'Food & Beverage',
  'Other'
]

export const COMPANY_SIZE_OPTIONS: { value: CompanyData['companySize']; label: string; description: string }[] = [
  { value: 'startup', label: 'Startup', description: '1-20 employees' },
  { value: 'smb', label: 'Small Business', description: '21-100 employees' },
  { value: 'mid-market', label: 'Mid-Market', description: '101-1,000 employees' },
  { value: 'enterprise', label: 'Enterprise', description: '1,000+ employees' }
]

export const PAYMENT_VOLUME_OPTIONS = [
  'Under $100K/month',
  '$100K - $500K/month',
  '$500K - $2M/month',
  '$2M - $10M/month',
  '$10M+/month'
]
