/**
 * CCTP Supported Chains API
 *
 * Returns list of supported blockchains for cross-chain transfers
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getSupportedChains,
  getDefaultDestinationChain,
  CCTP_CHAINS,
} from '@/lib/circle/bridge'
import { CIRCLE_CONFIG } from '@/lib/circle/config'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const includeTestnets = searchParams.get('testnet') === 'true'

    // Use environment to determine if we show testnets
    const isTestnetEnv = CIRCLE_CONFIG.environment === 'sandbox'
    const showTestnets = includeTestnets || isTestnetEnv

    const chains = getSupportedChains(showTestnets)
    const defaultDestination = getDefaultDestinationChain(isTestnetEnv)

    // Format for frontend consumption
    const formattedChains = chains.map(chain => ({
      id: Object.keys(CCTP_CHAINS).find(key =>
        CCTP_CHAINS[key as keyof typeof CCTP_CHAINS] === chain
      ),
      name: chain.name,
      chainId: chain.chainId,
      domainId: chain.domainId,
      isTestnet: chain.isTestnet,
      usdcAddress: chain.usdc.address,
      explorerUrl: chain.explorerUrl,
    }))

    return NextResponse.json({
      success: true,
      chains: formattedChains,
      defaultDestination,
      environment: CIRCLE_CONFIG.environment,
    })
  } catch (error: any) {
    console.error('[Bridge Chains] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get chains' },
      { status: 500 }
    )
  }
}
