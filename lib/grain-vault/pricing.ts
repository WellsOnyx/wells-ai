/**
 * GRAIN Pricing Engine
 *
 * Calculates GRAIN price based on total reserves and supply.
 * As Circle balance grows (4.5% APY), GRAIN price increases automatically.
 *
 * Formula: GRAIN_PRICE = TOTAL_RESERVES / TOTAL_SUPPLY
 */

import { getCircleBalance } from './circle'
import { prisma } from '@/lib/prisma'

/**
 * Get current GRAIN price
 *
 * This is the magic: price increases as Circle balance grows
 */
export async function getGrainPrice(): Promise<number> {
  try {
    // Get total reserves (USDC in Circle, including yield)
    const totalReserves = await getCircleBalance()

    // Get total GRAIN supply from database
    const totalSupply = await getTotalGrainSupply()

    if (totalSupply === 0) {
      return 1.00 // Default $1.00 before any GRAIN minted
    }

    // Price = Reserves / Supply
    // Example: $10.45M reserves / 10M GRAIN = $1.045/GRAIN
    const price = totalReserves / totalSupply

    return price
  } catch (error: any) {
    console.error('[PRICING] Get GRAIN price error:', error)
    throw new Error(`Failed to calculate GRAIN price: ${error.message}`)
  }
}

/**
 * Calculate user's GRAIN value in USD
 */
export async function calculateUserValue(grainAmount: number): Promise<{
  grainAmount: number
  currentPrice: number
  usdValue: number
  initialValue: number
  yieldEarned: number
  yieldPercent: number
}> {
  try {
    const price = await getGrainPrice()
    const usdValue = grainAmount * price

    // Calculate yield (vs $1.00 initial price)
    const initialValue = grainAmount * 1.00
    const yieldEarned = usdValue - initialValue
    const yieldPercent = initialValue > 0 ? (yieldEarned / initialValue) * 100 : 0

    return {
      grainAmount,
      currentPrice: price,
      usdValue,
      initialValue,
      yieldEarned,
      yieldPercent
    }
  } catch (error: any) {
    console.error('[PRICING] Calculate user value error:', error)
    throw new Error(`Failed to calculate user value: ${error.message}`)
  }
}

/**
 * Convert USD to GRAIN at current price
 */
export async function usdToGrain(usdAmount: number): Promise<{
  usdAmount: number
  grainAmount: number
  currentPrice: number
}> {
  try {
    const price = await getGrainPrice()
    const grainAmount = usdAmount / price

    return {
      usdAmount,
      grainAmount,
      currentPrice: price
    }
  } catch (error: any) {
    console.error('[PRICING] USD to GRAIN error:', error)
    throw new Error(`Failed to convert USD to GRAIN: ${error.message}`)
  }
}

/**
 * Convert GRAIN to USD at current price
 */
export async function grainToUsd(grainAmount: number): Promise<{
  grainAmount: number
  usdAmount: number
  currentPrice: number
}> {
  try {
    const price = await getGrainPrice()
    const usdAmount = grainAmount * price

    return {
      grainAmount,
      usdAmount,
      currentPrice: price
    }
  } catch (error: any) {
    console.error('[PRICING] GRAIN to USD error:', error)
    throw new Error(`Failed to convert GRAIN to USD: ${error.message}`)
  }
}

/**
 * Get total GRAIN supply from database
 */
async function getTotalGrainSupply(): Promise<number> {
  try {
    // Sum all GRAIN balances across all users
    const result = await prisma.$queryRaw<Array<{ total: bigint }>>`
      SELECT COALESCE(SUM(grain_balance), 0) as total
      FROM "UserGrainAccount"
    `

    if (!result || result.length === 0) {
      return 0
    }

    return Number(result[0].total)
  } catch (error: any) {
    console.error('[PRICING] Get total supply error:', error)
    // If table doesn't exist yet, return 0
    return 0
  }
}

/**
 * Calculate projected GRAIN price based on time
 *
 * Useful for showing users future value
 */
export async function projectGrainPrice(days: number): Promise<{
  currentPrice: number
  projectedPrice: number
  daysAhead: number
  expectedYield: number
}> {
  try {
    const currentPrice = await getGrainPrice()

    // Circle earns 4.5% APY compounded daily
    const dailyRate = 0.045 / 365
    const projectedMultiplier = Math.pow(1 + dailyRate, days)
    const projectedPrice = currentPrice * projectedMultiplier

    const expectedYield = ((projectedPrice / currentPrice) - 1) * 100

    return {
      currentPrice,
      projectedPrice,
      daysAhead: days,
      expectedYield
    }
  } catch (error: any) {
    console.error('[PRICING] Project price error:', error)
    throw new Error(`Failed to project GRAIN price: ${error.message}`)
  }
}

/**
 * Get historical GRAIN price data
 */
export async function getGrainPriceHistory(days: number = 30): Promise<Array<{
  date: Date
  price: number
  reserves: number
  supply: number
}>> {
  // TODO: Re-enable after adding grainPriceSnapshot table to schema.prisma
  return []
  // try {
  //   // Query price snapshots from database
  //   const snapshots = await prisma.grainPriceSnapshot.findMany({
  //     where: {
  //       createdAt: {
  //         gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  //       }
  //     },
  //     orderBy: {
  //       createdAt: 'asc'
  //     }
  //   })

  //   return snapshots.map(s => ({
  //     date: s.createdAt,
  //     price: s.price,
  //     reserves: s.totalReserves,
  //     supply: s.totalSupply
  //   }))
  // } catch (error: any) {
  //   console.error('[PRICING] Get price history error:', error)
  //   // If table doesn't exist, return empty array
  //   return []
  // }
}

/**
 * Take a price snapshot (run daily via cron)
 */
export async function takeGrainPriceSnapshot(): Promise<void> {
  try {
    const price = await getGrainPrice()
    const reserves = await getCircleBalance()
    const supply = await getTotalGrainSupply()

    await prisma.grainPriceSnapshot.create({
      data: {
        price,
        totalReserves: reserves,
        totalSupply: supply
      }
    })

    console.log('[PRICING] Snapshot taken:', {
      price: price.toFixed(4),
      reserves: reserves.toFixed(2),
      supply: supply.toFixed(2)
    })
  } catch (error: any) {
    console.error('[PRICING] Snapshot error:', error)
    // Don't throw - this is a background job
  }
}

/**
 * Calculate effective APY based on actual price changes
 */
export async function calculateEffectiveAPY(): Promise<{
  apy: number
  period: number
  priceChange: number
}> {
  try {
    // Get price from 365 days ago and now
    const history = await getGrainPriceHistory(365)

    if (history.length < 2) {
      return { apy: 4.5, period: 0, priceChange: 0 } // Default to Circle's rate
    }

    const oldestPrice = history[0].price
    const latestPrice = history[history.length - 1].price
    const days = history.length

    const priceChange = ((latestPrice / oldestPrice) - 1) * 100
    const apy = (Math.pow(latestPrice / oldestPrice, 365 / days) - 1) * 100

    return {
      apy,
      period: days,
      priceChange
    }
  } catch (error: any) {
    console.error('[PRICING] Calculate APY error:', error)
    return { apy: 4.5, period: 0, priceChange: 0 }
  }
}
