/**
 * Circle CCTP Bridge Integration
 *
 * Cross-Chain Transfer Protocol (CCTP) enables secure USDC transfers
 * between blockchains by burning on source and minting on destination.
 *
 * Supports:
 * - Fast Transfer: <30 seconds (soft finality)
 * - Standard Transfer: ~15-19 minutes (hard finality)
 *
 * @see https://developers.circle.com/cctp
 */

import { CIRCLE_CONFIG } from './config'

// =============================================================================
// TYPES
// =============================================================================

export type ChainIdentifier =
  | 'Ethereum' | 'Ethereum_Sepolia'
  | 'Base' | 'Base_Sepolia'
  | 'Arbitrum' | 'Arbitrum_Sepolia'
  | 'OP_Mainnet' | 'OP_Sepolia'
  | 'Polygon_PoS' | 'Polygon_Amoy'
  | 'Avalanche' | 'Avalanche_Fuji'
  | 'Solana' | 'Solana_Devnet'
  | 'Unichain' | 'Linea' | 'Sonic'

export type TransferSpeed = 'FAST' | 'STANDARD'

export interface ChainConfig {
  name: string
  chainId: number
  domainId: number
  isTestnet: boolean
  usdc: {
    address: string
    decimals: number
  }
  contracts: {
    tokenMessengerV2: string
    messageTransmitterV2: string
    tokenMinterV2: string
  }
  rpcUrl?: string
  explorerUrl: string
}

export interface BridgeEstimate {
  sourceChain: ChainIdentifier
  destinationChain: ChainIdentifier
  amount: string
  gasFees: {
    source: string
    destination: string
    total: string
  }
  protocolFee: string
  protocolFeeBps: number
  totalCost: string
  netAmount: string
  estimatedTime: string
  transferSpeed: TransferSpeed
}

export interface BridgeTransfer {
  id: string
  userId: string
  sourceChain: ChainIdentifier
  destinationChain: ChainIdentifier
  amount: string
  transferSpeed: TransferSpeed
  status: 'pending' | 'burning' | 'attesting' | 'minting' | 'completed' | 'failed'
  burnTxHash?: string
  mintTxHash?: string
  attestation?: string
  messageHash?: string
  error?: string
  createdAt: Date
  completedAt?: Date
}

export interface BridgeParams {
  userId: string
  sourceChain: ChainIdentifier
  destinationChain: ChainIdentifier
  amount: string
  recipientAddress?: string
  transferSpeed?: TransferSpeed
}

export interface BridgeResult {
  success: boolean
  transfer?: BridgeTransfer
  error?: string
}

// =============================================================================
// CHAIN CONFIGURATIONS
// =============================================================================

export const CCTP_CHAINS: Record<ChainIdentifier, ChainConfig> = {
  // Mainnets
  Ethereum: {
    name: 'Ethereum',
    chainId: 1,
    domainId: 0,
    isTestnet: false,
    usdc: {
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      decimals: 6,
    },
    contracts: {
      tokenMessengerV2: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
      messageTransmitterV2: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64',
      tokenMinterV2: '0xfd78EE919681417d192449715b2594ab58f5D002',
    },
    explorerUrl: 'https://etherscan.io',
  },
  Base: {
    name: 'Base',
    chainId: 8453,
    domainId: 6,
    isTestnet: false,
    usdc: {
      address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      decimals: 6,
    },
    contracts: {
      tokenMessengerV2: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
      messageTransmitterV2: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64',
      tokenMinterV2: '0xfd78EE919681417d192449715b2594ab58f5D002',
    },
    explorerUrl: 'https://basescan.org',
  },
  Arbitrum: {
    name: 'Arbitrum',
    chainId: 42161,
    domainId: 3,
    isTestnet: false,
    usdc: {
      address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      decimals: 6,
    },
    contracts: {
      tokenMessengerV2: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
      messageTransmitterV2: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64',
      tokenMinterV2: '0xfd78EE919681417d192449715b2594ab58f5D002',
    },
    explorerUrl: 'https://arbiscan.io',
  },
  OP_Mainnet: {
    name: 'OP Mainnet',
    chainId: 10,
    domainId: 2,
    isTestnet: false,
    usdc: {
      address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
      decimals: 6,
    },
    contracts: {
      tokenMessengerV2: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
      messageTransmitterV2: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64',
      tokenMinterV2: '0xfd78EE919681417d192449715b2594ab58f5D002',
    },
    explorerUrl: 'https://optimistic.etherscan.io',
  },
  Polygon_PoS: {
    name: 'Polygon PoS',
    chainId: 137,
    domainId: 7,
    isTestnet: false,
    usdc: {
      address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
      decimals: 6,
    },
    contracts: {
      tokenMessengerV2: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
      messageTransmitterV2: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64',
      tokenMinterV2: '0xfd78EE919681417d192449715b2594ab58f5D002',
    },
    explorerUrl: 'https://polygonscan.com',
  },
  Avalanche: {
    name: 'Avalanche',
    chainId: 43114,
    domainId: 1,
    isTestnet: false,
    usdc: {
      address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
      decimals: 6,
    },
    contracts: {
      tokenMessengerV2: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
      messageTransmitterV2: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64',
      tokenMinterV2: '0xfd78EE919681417d192449715b2594ab58f5D002',
    },
    explorerUrl: 'https://snowtrace.io',
  },
  Unichain: {
    name: 'Unichain',
    chainId: 130,
    domainId: 10,
    isTestnet: false,
    usdc: {
      address: '0x078D782b760474a361dDA0AF3839290b0EF57AD6',
      decimals: 6,
    },
    contracts: {
      tokenMessengerV2: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
      messageTransmitterV2: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64',
      tokenMinterV2: '0xfd78EE919681417d192449715b2594ab58f5D002',
    },
    explorerUrl: 'https://unichain.blockscout.com',
  },
  Linea: {
    name: 'Linea',
    chainId: 59144,
    domainId: 11,
    isTestnet: false,
    usdc: {
      address: '0x176211869cA2b568f2A7D4EE941E073a821EE1ff',
      decimals: 6,
    },
    contracts: {
      tokenMessengerV2: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
      messageTransmitterV2: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64',
      tokenMinterV2: '0xfd78EE919681417d192449715b2594ab58f5D002',
    },
    explorerUrl: 'https://lineascan.build',
  },
  Sonic: {
    name: 'Sonic',
    chainId: 146,
    domainId: 13,
    isTestnet: false,
    usdc: {
      address: '0x29219dd400f2Bf60E5a23d13Be72B486D4038894',
      decimals: 6,
    },
    contracts: {
      tokenMessengerV2: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
      messageTransmitterV2: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64',
      tokenMinterV2: '0xfd78EE919681417d192449715b2594ab58f5D002',
    },
    explorerUrl: 'https://sonicscan.org',
  },
  Solana: {
    name: 'Solana',
    chainId: 0, // Not EVM
    domainId: 5,
    isTestnet: false,
    usdc: {
      address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      decimals: 6,
    },
    contracts: {
      tokenMessengerV2: 'CCTPmbSD7gX1bxKPAmg77w8oFzNFpaQiQUWD43TKaecd',
      messageTransmitterV2: 'CCTPiPYPc6AsJuwueEnWgSgucamXDZwBd53dQ11YiKX3',
      tokenMinterV2: 'CCTPmDd1PkLAaPM4bZm9SYkHPyc6hHeCLnAmS4ubowcv',
    },
    explorerUrl: 'https://solscan.io',
  },

  // Testnets
  Ethereum_Sepolia: {
    name: 'Ethereum Sepolia',
    chainId: 11155111,
    domainId: 0,
    isTestnet: true,
    usdc: {
      address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
      decimals: 6,
    },
    contracts: {
      tokenMessengerV2: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
      messageTransmitterV2: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275',
      tokenMinterV2: '0xb43db544E2c27092c107639Ad201b3dEfAbcF192',
    },
    explorerUrl: 'https://sepolia.etherscan.io',
  },
  Base_Sepolia: {
    name: 'Base Sepolia',
    chainId: 84532,
    domainId: 6,
    isTestnet: true,
    usdc: {
      address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
      decimals: 6,
    },
    contracts: {
      tokenMessengerV2: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
      messageTransmitterV2: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275',
      tokenMinterV2: '0xb43db544E2c27092c107639Ad201b3dEfAbcF192',
    },
    explorerUrl: 'https://sepolia.basescan.org',
  },
  Arbitrum_Sepolia: {
    name: 'Arbitrum Sepolia',
    chainId: 421614,
    domainId: 3,
    isTestnet: true,
    usdc: {
      address: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
      decimals: 6,
    },
    contracts: {
      tokenMessengerV2: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
      messageTransmitterV2: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275',
      tokenMinterV2: '0xb43db544E2c27092c107639Ad201b3dEfAbcF192',
    },
    explorerUrl: 'https://sepolia.arbiscan.io',
  },
  OP_Sepolia: {
    name: 'OP Sepolia',
    chainId: 11155420,
    domainId: 2,
    isTestnet: true,
    usdc: {
      address: '0x5fd84259d66Cd46123540766Be93DFE6D43130D7',
      decimals: 6,
    },
    contracts: {
      tokenMessengerV2: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
      messageTransmitterV2: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275',
      tokenMinterV2: '0xb43db544E2c27092c107639Ad201b3dEfAbcF192',
    },
    explorerUrl: 'https://sepolia-optimism.etherscan.io',
  },
  Polygon_Amoy: {
    name: 'Polygon Amoy',
    chainId: 80002,
    domainId: 7,
    isTestnet: true,
    usdc: {
      address: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582',
      decimals: 6,
    },
    contracts: {
      tokenMessengerV2: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
      messageTransmitterV2: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275',
      tokenMinterV2: '0xb43db544E2c27092c107639Ad201b3dEfAbcF192',
    },
    explorerUrl: 'https://amoy.polygonscan.com',
  },
  Avalanche_Fuji: {
    name: 'Avalanche Fuji',
    chainId: 43113,
    domainId: 1,
    isTestnet: true,
    usdc: {
      address: '0x5425890298aed601595a70AB815c96711a31Bc65',
      decimals: 6,
    },
    contracts: {
      tokenMessengerV2: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
      messageTransmitterV2: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275',
      tokenMinterV2: '0xb43db544E2c27092c107639Ad201b3dEfAbcF192',
    },
    explorerUrl: 'https://testnet.snowtrace.io',
  },
  Solana_Devnet: {
    name: 'Solana Devnet',
    chainId: 0,
    domainId: 5,
    isTestnet: true,
    usdc: {
      address: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
      decimals: 6,
    },
    contracts: {
      tokenMessengerV2: 'CCTPmbSD7gX1bxKPAmg77w8oFzNFpaQiQUWD43TKaecd',
      messageTransmitterV2: 'CCTPiPYPc6AsJuwueEnWgSgucamXDZwBd53dQ11YiKX3',
      tokenMinterV2: 'CCTPmDd1PkLAaPM4bZm9SYkHPyc6hHeCLnAmS4ubowcv',
    },
    explorerUrl: 'https://solscan.io',
  },
}

// =============================================================================
// IRIS API (Attestation Service)
// =============================================================================

const IRIS_API = {
  testnet: 'https://iris-api-sandbox.circle.com',
  mainnet: 'https://iris-api.circle.com',
}

function getIrisApiUrl(): string {
  return CIRCLE_CONFIG.environment === 'production' ? IRIS_API.mainnet : IRIS_API.testnet
}

/**
 * Get attestation for a burn transaction
 */
export async function getAttestation(
  messageHash: string
): Promise<{ attestation: string | null; status: string }> {
  const url = `${getIrisApiUrl()}/v2/messages/${messageHash}`

  try {
    const response = await fetch(url)

    if (!response.ok) {
      if (response.status === 404) {
        return { attestation: null, status: 'pending' }
      }
      throw new Error(`Iris API error: ${response.status}`)
    }

    const data = await response.json()

    if (data.status === 'complete') {
      return { attestation: data.attestation, status: 'complete' }
    }

    return { attestation: null, status: data.status || 'pending' }
  } catch (error: any) {
    console.error('[CCTP] Attestation fetch error:', error)
    return { attestation: null, status: 'error' }
  }
}

/**
 * Get current transfer fees from Iris API
 */
export async function getTransferFees(
  sourceChain: ChainIdentifier,
  destinationChain: ChainIdentifier,
  transferSpeed: TransferSpeed = 'FAST'
): Promise<{ feeBps: number; feeAmount: string } | null> {
  const sourceConfig = CCTP_CHAINS[sourceChain]
  const destConfig = CCTP_CHAINS[destinationChain]

  if (!sourceConfig || !destConfig) {
    return null
  }

  const url = `${getIrisApiUrl()}/v2/burn/USDC/fees?sourceDomain=${sourceConfig.domainId}&destinationDomain=${destConfig.domainId}`

  try {
    const response = await fetch(url)

    if (!response.ok) {
      console.warn('[CCTP] Fee fetch failed:', response.status)
      return null
    }

    const data = await response.json()

    // Fast transfer fees vary by chain pair (0-14 bps)
    // Standard transfer is always 0 bps
    const feeBps = transferSpeed === 'FAST'
      ? (data.fastTransferFeeBps || 10)
      : 0

    return {
      feeBps,
      feeAmount: '0', // Calculated based on amount
    }
  } catch (error) {
    console.error('[CCTP] Fee fetch error:', error)
    return null
  }
}

// =============================================================================
// BRIDGE ESTIMATION
// =============================================================================

/**
 * Estimate costs for a cross-chain transfer
 */
export async function estimateBridgeTransfer(
  sourceChain: ChainIdentifier,
  destinationChain: ChainIdentifier,
  amount: string,
  transferSpeed: TransferSpeed = 'FAST'
): Promise<BridgeEstimate | null> {
  const sourceConfig = CCTP_CHAINS[sourceChain]
  const destConfig = CCTP_CHAINS[destinationChain]

  if (!sourceConfig || !destConfig) {
    console.error('[CCTP] Invalid chain configuration')
    return null
  }

  // Validate same network type (both mainnet or both testnet)
  if (sourceConfig.isTestnet !== destConfig.isTestnet) {
    console.error('[CCTP] Cannot bridge between mainnet and testnet')
    return null
  }

  const amountNum = parseFloat(amount)
  if (isNaN(amountNum) || amountNum <= 0) {
    return null
  }

  // Get protocol fees
  const fees = await getTransferFees(sourceChain, destinationChain, transferSpeed)
  const feeBps = fees?.feeBps || (transferSpeed === 'FAST' ? 10 : 0)
  const protocolFee = (amountNum * feeBps) / 10000

  // Estimate gas fees (simplified - actual would query RPC)
  const estimatedSourceGas = sourceChain.includes('Ethereum') ? '5.00' : '0.50'
  const estimatedDestGas = destinationChain.includes('Ethereum') ? '3.00' : '0.30'

  const totalGas = parseFloat(estimatedSourceGas) + parseFloat(estimatedDestGas)
  const totalCost = protocolFee + totalGas
  const netAmount = amountNum - protocolFee

  // Estimate time
  const estimatedTime = transferSpeed === 'FAST' ? '< 30 seconds' : '15-19 minutes'

  return {
    sourceChain,
    destinationChain,
    amount,
    gasFees: {
      source: estimatedSourceGas,
      destination: estimatedDestGas,
      total: totalGas.toFixed(2),
    },
    protocolFee: protocolFee.toFixed(6),
    protocolFeeBps: feeBps,
    totalCost: totalCost.toFixed(2),
    netAmount: netAmount.toFixed(6),
    estimatedTime,
    transferSpeed,
  }
}

// =============================================================================
// SUPPORTED CHAINS HELPERS
// =============================================================================

/**
 * Get list of supported chains for bridging
 */
export function getSupportedChains(includeTestnets: boolean = false): ChainConfig[] {
  return Object.values(CCTP_CHAINS).filter(chain =>
    includeTestnets || !chain.isTestnet
  )
}

/**
 * Get chain config by identifier
 */
export function getChainConfig(chain: ChainIdentifier): ChainConfig | null {
  return CCTP_CHAINS[chain] || null
}

/**
 * Check if a chain pair is supported for bridging
 */
export function isRoutSupported(
  sourceChain: ChainIdentifier,
  destinationChain: ChainIdentifier
): boolean {
  const source = CCTP_CHAINS[sourceChain]
  const dest = CCTP_CHAINS[destinationChain]

  if (!source || !dest) return false
  if (sourceChain === destinationChain) return false
  if (source.isTestnet !== dest.isTestnet) return false

  return true
}

/**
 * Get the default destination chain based on Grain & Vault preference
 * We prefer Base for low fees and fast finality
 */
export function getDefaultDestinationChain(isTestnet: boolean = false): ChainIdentifier {
  return isTestnet ? 'Base_Sepolia' : 'Base'
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  CCTP_CHAINS,
  getAttestation,
  getTransferFees,
  estimateBridgeTransfer,
  getSupportedChains,
  getChainConfig,
  isRoutSupported,
  getDefaultDestinationChain,
}
