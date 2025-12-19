/**
 * GRAIN Token Contract Service
 *
 * Interacts with the GRAIN ERC-20 stablecoin on Base L2
 */

import { ethers } from 'ethers'

// Contract ABI (minimal interface for our needs)
const GRAIN_ABI = [
  // Read functions
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function totalUsdcBacking() view returns (uint256)',
  'function backingRatio() view returns (uint256)',

  // Write functions (require MINTER_ROLE or TREASURY_ROLE)
  'function mint(address to, uint256 amount, string reason)',
  'function burnWithReason(uint256 amount, string reason)',
  'function treasuryTransfer(address from, address to, uint256 amount, string dealId)',
  'function updateUsdcBacking(uint256 newBacking)',
  'function pause()',
  'function unpause()',

  // Standard ERC-20
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',

  // Events
  'event GrainMinted(address indexed to, uint256 amount, string reason)',
  'event GrainBurned(address indexed from, uint256 amount, string reason)',
  'event TreasuryTransfer(address indexed from, address indexed to, uint256 amount, string dealId)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
]

// Environment config
const GRAIN_CONTRACT_ADDRESS = process.env.GRAIN_CONTRACT_ADDRESS
const BASE_RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org'
const TREASURY_PRIVATE_KEY = process.env.TREASURY_PRIVATE_KEY

export interface GrainStats {
  totalSupply: string
  totalUsdcBacking: string
  backingRatio: string
}

export interface MintResult {
  txHash: string
  to: string
  amount: string
  reason: string
}

export interface TransferResult {
  txHash: string
  from: string
  to: string
  amount: string
  dealId: string
}

/**
 * Get read-only provider for Base L2
 */
function getProvider(): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(BASE_RPC_URL)
}

/**
 * Get signer for treasury operations (requires TREASURY_PRIVATE_KEY)
 */
function getTreasurySigner(): ethers.Wallet {
  if (!TREASURY_PRIVATE_KEY) {
    throw new Error('TREASURY_PRIVATE_KEY not configured')
  }
  return new ethers.Wallet(TREASURY_PRIVATE_KEY, getProvider())
}

/**
 * Get GRAIN contract instance (read-only)
 */
function getGrainContract(): ethers.Contract {
  if (!GRAIN_CONTRACT_ADDRESS) {
    throw new Error('GRAIN_CONTRACT_ADDRESS not configured')
  }
  return new ethers.Contract(GRAIN_CONTRACT_ADDRESS, GRAIN_ABI, getProvider())
}

/**
 * Get GRAIN contract with signer (for write operations)
 */
function getGrainContractWithSigner(): ethers.Contract {
  if (!GRAIN_CONTRACT_ADDRESS) {
    throw new Error('GRAIN_CONTRACT_ADDRESS not configured')
  }
  return new ethers.Contract(GRAIN_CONTRACT_ADDRESS, GRAIN_ABI, getTreasurySigner())
}

// ============================================================================
// READ FUNCTIONS
// ============================================================================

/**
 * Get GRAIN token statistics
 */
export async function getGrainStats(): Promise<GrainStats> {
  const contract = getGrainContract()

  const [totalSupply, totalUsdcBacking, backingRatio] = await Promise.all([
    contract.totalSupply(),
    contract.totalUsdcBacking(),
    contract.backingRatio(),
  ])

  return {
    totalSupply: ethers.formatUnits(totalSupply, 18),
    totalUsdcBacking: ethers.formatUnits(totalUsdcBacking, 6), // USDC has 6 decimals
    backingRatio: ethers.formatUnits(backingRatio, 18),
  }
}

/**
 * Get GRAIN balance for an address
 */
export async function getGrainBalance(address: string): Promise<string> {
  const contract = getGrainContract()
  const balance = await contract.balanceOf(address)
  return ethers.formatUnits(balance, 18)
}

/**
 * Check if GRAIN contract is deployed and accessible
 */
export async function isGrainContractLive(): Promise<boolean> {
  try {
    if (!GRAIN_CONTRACT_ADDRESS) return false
    const contract = getGrainContract()
    const name = await contract.name()
    return name === 'GRAIN'
  } catch {
    return false
  }
}

// ============================================================================
// WRITE FUNCTIONS (require treasury signer)
// ============================================================================

/**
 * Mint GRAIN tokens (when user deposits USDC)
 */
export async function mintGrain(
  to: string,
  amount: string,
  reason: string
): Promise<MintResult> {
  const contract = getGrainContractWithSigner()
  const amountWei = ethers.parseUnits(amount, 18)

  const tx = await contract.mint(to, amountWei, reason)
  const receipt = await tx.wait()

  return {
    txHash: receipt.hash,
    to,
    amount,
    reason,
  }
}

/**
 * Burn GRAIN tokens (when user withdraws USDC)
 */
export async function burnGrain(
  amount: string,
  reason: string
): Promise<{ txHash: string; amount: string; reason: string }> {
  const contract = getGrainContractWithSigner()
  const amountWei = ethers.parseUnits(amount, 18)

  const tx = await contract.burnWithReason(amountWei, reason)
  const receipt = await tx.wait()

  return {
    txHash: receipt.hash,
    amount,
    reason,
  }
}

/**
 * Treasury transfer (for escrow, supplier payments, fees)
 */
export async function treasuryTransfer(
  from: string,
  to: string,
  amount: string,
  dealId: string
): Promise<TransferResult> {
  const contract = getGrainContractWithSigner()
  const amountWei = ethers.parseUnits(amount, 18)

  const tx = await contract.treasuryTransfer(from, to, amountWei, dealId)
  const receipt = await tx.wait()

  return {
    txHash: receipt.hash,
    from,
    to,
    amount,
    dealId,
  }
}

/**
 * Update USDC backing amount (for transparency)
 */
export async function updateUsdcBacking(newBacking: string): Promise<string> {
  const contract = getGrainContractWithSigner()
  // USDC has 6 decimals
  const backingWei = ethers.parseUnits(newBacking, 6)

  const tx = await contract.updateUsdcBacking(backingWei)
  const receipt = await tx.wait()

  return receipt.hash
}

/**
 * Pause all GRAIN transfers (emergency)
 */
export async function pauseGrain(): Promise<string> {
  const contract = getGrainContractWithSigner()
  const tx = await contract.pause()
  const receipt = await tx.wait()
  return receipt.hash
}

/**
 * Unpause GRAIN transfers
 */
export async function unpauseGrain(): Promise<string> {
  const contract = getGrainContractWithSigner()
  const tx = await contract.unpause()
  const receipt = await tx.wait()
  return receipt.hash
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get Base L2 explorer URL for a transaction
 */
export function getExplorerUrl(txHash: string): string {
  return `https://basescan.org/tx/${txHash}`
}

/**
 * Get Base L2 explorer URL for GRAIN contract
 */
export function getContractExplorerUrl(): string {
  return `https://basescan.org/token/${GRAIN_CONTRACT_ADDRESS}`
}

/**
 * Convert USDC amount to GRAIN (1:1 but different decimals)
 * USDC = 6 decimals, GRAIN = 18 decimals
 */
export function usdcToGrain(usdcAmount: string): string {
  // Parse USDC (6 decimals), format as GRAIN (18 decimals)
  const usdc = ethers.parseUnits(usdcAmount, 6)
  // Multiply by 10^12 to convert 6 decimals to 18
  const grain = usdc * BigInt(10 ** 12)
  return ethers.formatUnits(grain, 18)
}

/**
 * Convert GRAIN amount to USDC (1:1 but different decimals)
 */
export function grainToUsdc(grainAmount: string): string {
  const grain = ethers.parseUnits(grainAmount, 18)
  // Divide by 10^12 to convert 18 decimals to 6
  const usdc = grain / BigInt(10 ** 12)
  return ethers.formatUnits(usdc, 6)
}
