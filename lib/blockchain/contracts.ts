/**
 * Grain & Vault Smart Contract Interfaces
 * Base Sepolia Testnet Deployment
 */

import { createPublicClient, createWalletClient, http, parseUnits, formatUnits } from 'viem'
import { baseSepolia } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

// ============================================================================
// CONTRACT ADDRESSES (Base Sepolia Testnet)
// ============================================================================

export const CONTRACTS = {
  GRAIN_TOKEN: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb8', // ERC20 GRAIN Token
  GRAIN_VAULT: '0x8F85c31C76D6FBa15c1f8f1dC0F3f4E4C9d4e2A3', // Vault Contract
  PRICE_ORACLE: '0x3D4a9b5F2e1c8B6a4E9f7c3D2e1A8b5c6d7e8f9a', // Price Oracle
  ESCROW: '0x5E6f8a9b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f', // Escrow System
  USDC_TOKEN: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // USDC on Base Sepolia
} as const

// ============================================================================
// ABI DEFINITIONS
// ============================================================================

export const GRAIN_TOKEN_ABI = [
  // ERC20 Standard
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalSupply',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Custom GRAIN Functions
  {
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'mint',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'amount', type: 'uint256' }],
    name: 'burn',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'from', type: 'address' },
      { indexed: true, name: 'to', type: 'address' },
      { indexed: false, name: 'value', type: 'uint256' },
    ],
    name: 'Transfer',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'to', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
      { indexed: false, name: 'timestamp', type: 'uint256' },
    ],
    name: 'GrainMinted',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'from', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
      { indexed: false, name: 'timestamp', type: 'uint256' },
    ],
    name: 'GrainBurned',
    type: 'event',
  },
] as const

export const PRICE_ORACLE_ABI = [
  {
    inputs: [],
    name: 'getCurrentNAV',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getTotalAssets',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getTotalSupply',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getAssetTiers',
    outputs: [
      { name: 'liquid', type: 'uint256' },
      { name: 'float', type: 'uint256' },
      { name: 'physical', type: 'uint256' },
      { name: 'investments', type: 'uint256' },
      { name: 'receivables', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'newNAV', type: 'uint256' },
      { name: 'newAssets', type: 'uint256' },
      { name: 'tiers', type: 'uint256[5]' },
    ],
    name: 'updateNAV',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: false, name: 'newNAV', type: 'uint256' },
      { indexed: false, name: 'totalAssets', type: 'uint256' },
      { indexed: false, name: 'timestamp', type: 'uint256' },
    ],
    name: 'NAVUpdated',
    type: 'event',
  },
] as const

export const VAULT_ABI = [
  {
    inputs: [{ name: 'usdcAmount', type: 'uint256' }],
    name: 'deposit',
    outputs: [{ name: 'grainAmount', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'grainAmount', type: 'uint256' }],
    name: 'withdraw',
    outputs: [{ name: 'usdcAmount', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'grainAmount', type: 'uint256' }],
    name: 'requestWithdrawal',
    outputs: [{ name: 'requestId', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'requestId', type: 'uint256' }],
    name: 'executeWithdrawal',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getFeePercentage',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'amount', type: 'uint256' }],
    name: 'calculateFee',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'user', type: 'address' },
      { indexed: false, name: 'usdcAmount', type: 'uint256' },
      { indexed: false, name: 'grainAmount', type: 'uint256' },
      { indexed: false, name: 'fee', type: 'uint256' },
    ],
    name: 'Deposit',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'user', type: 'address' },
      { indexed: false, name: 'grainAmount', type: 'uint256' },
      { indexed: false, name: 'usdcAmount', type: 'uint256' },
      { indexed: false, name: 'fee', type: 'uint256' },
    ],
    name: 'Withdrawal',
    type: 'event',
  },
] as const

export const ESCROW_ABI = [
  {
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'currency', type: 'address' },
      { name: 'seller', type: 'address' },
      { name: 'buyer', type: 'address' },
      { name: 'milestoneCount', type: 'uint256' },
      { name: 'resolver', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    name: 'createEscrow',
    outputs: [{ name: 'escrowId', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'escrowId', type: 'uint256' },
      { name: 'milestoneIndex', type: 'uint256' },
    ],
    name: 'completeMilestone',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'escrowId', type: 'uint256' },
      { name: 'reason', type: 'string' },
    ],
    name: 'raiseDispute',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'escrowId', type: 'uint256' },
      { name: 'sellerAmount', type: 'uint256' },
      { name: 'buyerAmount', type: 'uint256' },
    ],
    name: 'resolveDispute',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'escrowId', type: 'uint256' }],
    name: 'getEscrowDetails',
    outputs: [
      {
        components: [
          { name: 'amount', type: 'uint256' },
          { name: 'currency', type: 'address' },
          { name: 'seller', type: 'address' },
          { name: 'buyer', type: 'address' },
          { name: 'currentMilestone', type: 'uint256' },
          { name: 'totalMilestones', type: 'uint256' },
          { name: 'status', type: 'uint8' },
          { name: 'createdAt', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'escrowId', type: 'uint256' },
      { indexed: true, name: 'seller', type: 'address' },
      { indexed: true, name: 'buyer', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
      { indexed: false, name: 'currency', type: 'address' },
    ],
    name: 'EscrowCreated',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'escrowId', type: 'uint256' },
      { indexed: false, name: 'milestoneIndex', type: 'uint256' },
      { indexed: false, name: 'amountReleased', type: 'uint256' },
    ],
    name: 'MilestoneCompleted',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'escrowId', type: 'uint256' },
      { indexed: false, name: 'reason', type: 'string' },
      { indexed: false, name: 'raisedBy', type: 'address' },
    ],
    name: 'DisputeRaised',
    type: 'event',
  },
] as const

export const USDC_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

// ============================================================================
// CLIENT CONFIGURATION
// ============================================================================

const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org'
const PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY

export const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(RPC_URL),
})

export const getWalletClient = () => {
  if (!PRIVATE_KEY) {
    throw new Error('ADMIN_PRIVATE_KEY not configured')
  }

  const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`)

  return createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(RPC_URL),
  })
}

// ============================================================================
// CONTRACT HELPERS
// ============================================================================

export const GrainToken = {
  async balanceOf(address: string): Promise<bigint> {
    return await publicClient.readContract({
      address: CONTRACTS.GRAIN_TOKEN,
      abi: GRAIN_TOKEN_ABI,
      functionName: 'balanceOf',
      args: [address as `0x${string}`],
    })
  },

  async totalSupply(): Promise<bigint> {
    return await publicClient.readContract({
      address: CONTRACTS.GRAIN_TOKEN,
      abi: GRAIN_TOKEN_ABI,
      functionName: 'totalSupply',
    })
  },

  async mint(to: string, amount: bigint) {
    const walletClient = getWalletClient()
    const { request } = await publicClient.simulateContract({
      address: CONTRACTS.GRAIN_TOKEN,
      abi: GRAIN_TOKEN_ABI,
      functionName: 'mint',
      args: [to as `0x${string}`, amount],
      account: walletClient.account,
    })
    return await walletClient.writeContract(request)
  },

  async burn(amount: bigint) {
    const walletClient = getWalletClient()
    const { request } = await publicClient.simulateContract({
      address: CONTRACTS.GRAIN_TOKEN,
      abi: GRAIN_TOKEN_ABI,
      functionName: 'burn',
      args: [amount],
      account: walletClient.account,
    })
    return await walletClient.writeContract(request)
  },
}

export const PriceOracle = {
  async getCurrentNAV(): Promise<bigint> {
    return await publicClient.readContract({
      address: CONTRACTS.PRICE_ORACLE,
      abi: PRICE_ORACLE_ABI,
      functionName: 'getCurrentNAV',
    })
  },

  async getTotalAssets(): Promise<bigint> {
    return await publicClient.readContract({
      address: CONTRACTS.PRICE_ORACLE,
      abi: PRICE_ORACLE_ABI,
      functionName: 'getTotalAssets',
    })
  },

  async getTotalSupply(): Promise<bigint> {
    return await publicClient.readContract({
      address: CONTRACTS.PRICE_ORACLE,
      abi: PRICE_ORACLE_ABI,
      functionName: 'getTotalSupply',
    })
  },

  async getAssetTiers(): Promise<{
    liquid: bigint
    float: bigint
    physical: bigint
    investments: bigint
    receivables: bigint
  }> {
    const result = await publicClient.readContract({
      address: CONTRACTS.PRICE_ORACLE,
      abi: PRICE_ORACLE_ABI,
      functionName: 'getAssetTiers',
    }) as [bigint, bigint, bigint, bigint, bigint]

    return {
      liquid: result[0],
      float: result[1],
      physical: result[2],
      investments: result[3],
      receivables: result[4],
    }
  },

  async updateNAV(newNAV: bigint, newAssets: bigint, tiers: [bigint, bigint, bigint, bigint, bigint]) {
    const walletClient = getWalletClient()
    const { request } = await publicClient.simulateContract({
      address: CONTRACTS.PRICE_ORACLE,
      abi: PRICE_ORACLE_ABI,
      functionName: 'updateNAV',
      args: [newNAV, newAssets, tiers],
      account: walletClient.account,
    })
    return await walletClient.writeContract(request)
  },
}

export const Vault = {
  async calculateFee(amount: bigint): Promise<bigint> {
    return await publicClient.readContract({
      address: CONTRACTS.GRAIN_VAULT,
      abi: VAULT_ABI,
      functionName: 'calculateFee',
      args: [amount],
    })
  },

  async deposit(usdcAmount: bigint) {
    const walletClient = getWalletClient()
    const { request } = await publicClient.simulateContract({
      address: CONTRACTS.GRAIN_VAULT,
      abi: VAULT_ABI,
      functionName: 'deposit',
      args: [usdcAmount],
      account: walletClient.account,
    })
    return await walletClient.writeContract(request)
  },

  async requestWithdrawal(grainAmount: bigint) {
    const walletClient = getWalletClient()
    const { request } = await publicClient.simulateContract({
      address: CONTRACTS.GRAIN_VAULT,
      abi: VAULT_ABI,
      functionName: 'requestWithdrawal',
      args: [grainAmount],
      account: walletClient.account,
    })
    return await walletClient.writeContract(request)
  },

  async executeWithdrawal(requestId: bigint) {
    const walletClient = getWalletClient()
    const { request } = await publicClient.simulateContract({
      address: CONTRACTS.GRAIN_VAULT,
      abi: VAULT_ABI,
      functionName: 'executeWithdrawal',
      args: [requestId],
      account: walletClient.account,
    })
    return await walletClient.writeContract(request)
  },
}

export const Escrow = {
  async getEscrowDetails(escrowId: bigint) {
    return await publicClient.readContract({
      address: CONTRACTS.ESCROW,
      abi: ESCROW_ABI,
      functionName: 'getEscrowDetails',
      args: [escrowId],
    })
  },

  async createEscrow(
    amount: bigint,
    currency: string,
    seller: string,
    buyer: string,
    milestoneCount: bigint,
    resolver: string,
    deadline: bigint
  ) {
    const walletClient = getWalletClient()
    const { request } = await publicClient.simulateContract({
      address: CONTRACTS.ESCROW,
      abi: ESCROW_ABI,
      functionName: 'createEscrow',
      args: [
        amount,
        currency as `0x${string}`,
        seller as `0x${string}`,
        buyer as `0x${string}`,
        milestoneCount,
        resolver as `0x${string}`,
        deadline,
      ],
      account: walletClient.account,
    })
    return await walletClient.writeContract(request)
  },

  async completeMilestone(escrowId: bigint, milestoneIndex: bigint) {
    const walletClient = getWalletClient()
    const { request } = await publicClient.simulateContract({
      address: CONTRACTS.ESCROW,
      abi: ESCROW_ABI,
      functionName: 'completeMilestone',
      args: [escrowId, milestoneIndex],
      account: walletClient.account,
    })
    return await walletClient.writeContract(request)
  },

  async raiseDispute(escrowId: bigint, reason: string) {
    const walletClient = getWalletClient()
    const { request } = await publicClient.simulateContract({
      address: CONTRACTS.ESCROW,
      abi: ESCROW_ABI,
      functionName: 'raiseDispute',
      args: [escrowId, reason],
      account: walletClient.account,
    })
    return await walletClient.writeContract(request)
  },
}

// ============================================================================
// UTILITIES
// ============================================================================

export function toUSDC(amount: number): bigint {
  return parseUnits(amount.toString(), 6) // USDC has 6 decimals
}

export function fromUSDC(amount: bigint): number {
  return parseFloat(formatUnits(amount, 6))
}

export function toGRAIN(amount: number): bigint {
  return parseUnits(amount.toString(), 18) // GRAIN has 18 decimals
}

export function fromGRAIN(amount: bigint): number {
  return parseFloat(formatUnits(amount, 18))
}

export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}
