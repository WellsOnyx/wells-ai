/**
 * Grain Client - Connect to Grain Token & Vault smart contracts
 *
 * Provides TypeScript interface to interact with deployed contracts on Base L2
 */

import { ethers } from 'ethers'

// Contract ABIs (minimal interfaces for now - will be replaced with full ABIs after compilation)
const GRAIN_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function isFrozen(address account) view returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)',
]

const VAULT_ABI = [
  'function deposit(uint256 amount)',
  'function withdraw(uint256 amount)',
  'function payWithCredit(address seller, uint256 amount)',
  'function repayCredit(uint256 amount)',
  'function getAccountSummary(address user) view returns (uint256 deposited, uint256 creditAvailable, uint256 creditOutstanding, uint256 tier)',
  'function getCollateralRatio() view returns (uint256)',
  'function deposits(address user) view returns (uint256)',
  'function creditLines(address user) view returns (uint256)',
  'function creditUsed(address user) view returns (uint256)',
  'function creditTier(address user) view returns (uint256)',
  'function totalCollateral() view returns (uint256)',
  'function totalGrainSupply() view returns (uint256)',
  'function totalCreditExtended() view returns (uint256)',
  'event Deposited(address indexed user, uint256 amount)',
  'event Withdrawn(address indexed user, uint256 amount)',
  'event CreditLineOpened(address indexed user, uint256 amount, uint256 tier)',
  'event PaidWithCredit(address indexed buyer, address indexed seller, uint256 amount)',
  'event CreditRepaid(address indexed user, uint256 amount)',
]

const USDC_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function decimals() view returns (uint8)',
]

// Contract addresses (set via environment variables after deployment)
const GRAIN_ADDRESS = process.env.NEXT_PUBLIC_GRAIN_ADDRESS || ''
const VAULT_ADDRESS = process.env.NEXT_PUBLIC_VAULT_ADDRESS || ''
const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' // Base Mainnet USDC

// Base L2 RPC
const BASE_RPC_URL = process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org'

/**
 * Get read-only provider for Base L2
 */
export function getProvider(): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(BASE_RPC_URL)
}

/**
 * Get signer from private key (server-side only)
 */
export function getSigner(privateKey?: string): ethers.Wallet {
  const key = privateKey || process.env.GRAIN_PRIVATE_KEY
  if (!key) {
    throw new Error('Private key not provided')
  }
  const provider = getProvider()
  return new ethers.Wallet(key, provider)
}

/**
 * Get Grain token contract (read-only)
 */
export function getGrainContract(signerOrProvider?: ethers.Signer | ethers.Provider) {
  const provider = signerOrProvider || getProvider()
  return new ethers.Contract(GRAIN_ADDRESS, GRAIN_ABI, provider)
}

/**
 * Get Vault contract (read-only)
 */
export function getVaultContract(signerOrProvider?: ethers.Signer | ethers.Provider) {
  const provider = signerOrProvider || getProvider()
  return new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, provider)
}

/**
 * Get USDC contract (read-only)
 */
export function getUSDCContract(signerOrProvider?: ethers.Signer | ethers.Provider) {
  const provider = signerOrProvider || getProvider()
  return new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider)
}

// ===== GRAIN TOKEN FUNCTIONS =====

/**
 * Get GRAIN balance for an address
 * @param address Wallet address
 * @returns Balance in GRAIN (as string to avoid precision loss)
 */
export async function getGrainBalance(address: string): Promise<string> {
  const grain = getGrainContract()
  const balance = await grain.balanceOf(address)
  return ethers.formatUnits(balance, 18) // GRAIN has 18 decimals
}

/**
 * Get GRAIN total supply
 * @returns Total supply in GRAIN
 */
export async function getGrainTotalSupply(): Promise<string> {
  const grain = getGrainContract()
  const supply = await grain.totalSupply()
  return ethers.formatUnits(supply, 18)
}

/**
 * Check if account is frozen
 * @param address Address to check
 * @returns True if frozen
 */
export async function isAccountFrozen(address: string): Promise<boolean> {
  const grain = getGrainContract()
  return await grain.isFrozen(address)
}

// ===== VAULT FUNCTIONS =====

/**
 * Get account summary for a user
 * @param address User address
 * @returns Account details
 */
export async function getAccountSummary(address: string): Promise<{
  deposited: string // USDC deposited
  creditAvailable: string // Credit line available
  creditOutstanding: string // Credit currently used
  tier: number // Credit tier (1, 2, or 3)
  leverage: string // Leverage ratio (1.0, 1.5, or 2.0)
}> {
  const vault = getVaultContract()
  const [deposited, creditAvailable, creditOutstanding, tier] = await vault.getAccountSummary(address)

  // Convert to human-readable format
  const depositedUSDC = ethers.formatUnits(deposited, 6) // USDC has 6 decimals
  const creditAvailableUSDC = ethers.formatUnits(creditAvailable, 6)
  const creditOutstandingUSDC = ethers.formatUnits(creditOutstanding, 6)

  // Calculate leverage
  let leverage = '1.0'
  if (tier === 3n) leverage = '2.0'
  else if (tier === 2n) leverage = '1.5'

  return {
    deposited: depositedUSDC,
    creditAvailable: creditAvailableUSDC,
    creditOutstanding: creditOutstandingUSDC,
    tier: Number(tier),
    leverage,
  }
}

/**
 * Get Vault collateralization ratio
 * @returns Ratio as percentage (e.g., "150" = 150%)
 */
export async function getCollateralRatio(): Promise<string> {
  const vault = getVaultContract()
  const ratio = await vault.getCollateralRatio()
  return ratio.toString()
}

/**
 * Get Vault statistics
 * @returns Vault stats
 */
export async function getVaultStats(): Promise<{
  totalCollateral: string // Total USDC in vault
  totalGrainSupply: string // Total GRAIN minted
  totalCreditExtended: string // Total credit outstanding
  collateralRatio: string // Collateralization %
}> {
  const vault = getVaultContract()

  const [totalCollateral, totalGrainSupply, totalCreditExtended, collateralRatio] = await Promise.all([
    vault.totalCollateral(),
    vault.totalGrainSupply(),
    vault.totalCreditExtended(),
    vault.getCollateralRatio(),
  ])

  return {
    totalCollateral: ethers.formatUnits(totalCollateral, 6),
    totalGrainSupply: ethers.formatUnits(totalGrainSupply, 18),
    totalCreditExtended: ethers.formatUnits(totalCreditExtended, 6),
    collateralRatio: collateralRatio.toString(),
  }
}

// ===== USDC FUNCTIONS =====

/**
 * Get USDC balance for an address
 * @param address Wallet address
 * @returns Balance in USDC
 */
export async function getUSDCBalance(address: string): Promise<string> {
  const usdc = getUSDCContract()
  const balance = await usdc.balanceOf(address)
  return ethers.formatUnits(balance, 6) // USDC has 6 decimals
}

/**
 * Check USDC allowance for Vault
 * @param address Owner address
 * @returns Allowance in USDC
 */
export async function getUSDCAllowance(address: string): Promise<string> {
  const usdc = getUSDCContract()
  const allowance = await usdc.allowance(address, VAULT_ADDRESS)
  return ethers.formatUnits(allowance, 6)
}

// ===== TRANSACTION FUNCTIONS (REQUIRE SIGNER) =====

/**
 * Approve USDC spending by Vault
 * @param signer Wallet signer
 * @param amount Amount in USDC to approve
 * @returns Transaction receipt
 */
export async function approveUSDC(signer: ethers.Signer, amount: string) {
  const usdc = getUSDCContract(signer)
  const amountWei = ethers.parseUnits(amount, 6)
  const tx = await usdc.approve(VAULT_ADDRESS, amountWei)
  return await tx.wait()
}

/**
 * Deposit USDC to Vault
 * @param signer Wallet signer
 * @param amount Amount in USDC to deposit
 * @returns Transaction receipt
 */
export async function depositToVault(signer: ethers.Signer, amount: string) {
  const vault = getVaultContract(signer)
  const amountWei = ethers.parseUnits(amount, 6)
  const tx = await vault.deposit(amountWei)
  return await tx.wait()
}

/**
 * Withdraw USDC from Vault
 * @param signer Wallet signer
 * @param amount Amount in USDC to withdraw
 * @returns Transaction receipt
 */
export async function withdrawFromVault(signer: ethers.Signer, amount: string) {
  const vault = getVaultContract(signer)
  const amountWei = ethers.parseUnits(amount, 6)
  const tx = await vault.withdraw(amountWei)
  return await tx.wait()
}

/**
 * Pay seller using credit line
 * @param signer Buyer's wallet signer
 * @param sellerAddress Seller's address
 * @param amount Amount in USDC to pay
 * @returns Transaction receipt
 */
export async function payWithCredit(signer: ethers.Signer, sellerAddress: string, amount: string) {
  const vault = getVaultContract(signer)
  const amountWei = ethers.parseUnits(amount, 6)
  const tx = await vault.payWithCredit(sellerAddress, amountWei)
  return await tx.wait()
}

/**
 * Repay credit line
 * @param signer Wallet signer
 * @param amount Amount in USDC to repay
 * @returns Transaction receipt
 */
export async function repayCredit(signer: ethers.Signer, amount: string) {
  const vault = getVaultContract(signer)
  const amountWei = ethers.parseUnits(amount, 6)
  const tx = await vault.repayCredit(amountWei)
  return await tx.wait()
}

/**
 * Transfer GRAIN to another address
 * @param signer Wallet signer
 * @param to Recipient address
 * @param amount Amount in GRAIN to transfer
 * @returns Transaction receipt
 */
export async function transferGrain(signer: ethers.Signer, to: string, amount: string) {
  const grain = getGrainContract(signer)
  const amountWei = ethers.parseUnits(amount, 18)
  const tx = await grain.transfer(to, amountWei)
  return await tx.wait()
}

// ===== HELPER FUNCTIONS =====

/**
 * Format USDC amount (6 decimals) to display string
 * @param amount Amount in wei (6 decimals)
 * @returns Formatted string (e.g., "1,234.56")
 */
export function formatUSDC(amount: bigint): string {
  const formatted = ethers.formatUnits(amount, 6)
  const num = parseFloat(formatted)
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/**
 * Format GRAIN amount (18 decimals) to display string
 * @param amount Amount in wei (18 decimals)
 * @returns Formatted string (e.g., "1,234.56")
 */
export function formatGrain(amount: bigint): string {
  const formatted = ethers.formatUnits(amount, 18)
  const num = parseFloat(formatted)
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/**
 * Wait for transaction confirmation
 * @param txHash Transaction hash
 * @param confirmations Number of confirmations to wait for (default 1)
 * @returns Transaction receipt
 */
export async function waitForTransaction(txHash: string, confirmations: number = 1) {
  const provider = getProvider()
  return await provider.waitForTransaction(txHash, confirmations)
}

/**
 * Get current gas price on Base L2
 * @returns Gas price in gwei
 */
export async function getGasPrice(): Promise<string> {
  const provider = getProvider()
  const feeData = await provider.getFeeData()
  if (!feeData.gasPrice) return '0'
  return ethers.formatUnits(feeData.gasPrice, 'gwei')
}

/**
 * Estimate gas for a transaction
 * @param signer Wallet signer
 * @param to Contract address
 * @param data Transaction data
 * @returns Estimated gas in wei
 */
export async function estimateGas(signer: ethers.Signer, to: string, data: string): Promise<bigint> {
  return await signer.estimateGas({ to, data })
}

export default {
  // Contracts
  getProvider,
  getSigner,
  getGrainContract,
  getVaultContract,
  getUSDCContract,

  // Read functions
  getGrainBalance,
  getGrainTotalSupply,
  isAccountFrozen,
  getAccountSummary,
  getCollateralRatio,
  getVaultStats,
  getUSDCBalance,
  getUSDCAllowance,

  // Write functions
  approveUSDC,
  depositToVault,
  withdrawFromVault,
  payWithCredit,
  repayCredit,
  transferGrain,

  // Helpers
  formatUSDC,
  formatGrain,
  waitForTransaction,
  getGasPrice,
  estimateGas,
}
