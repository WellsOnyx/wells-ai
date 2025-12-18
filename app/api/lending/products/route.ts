// @ts-nocheck
/**
 * Loan Products API
 * GET /api/lending/products - List available loan products with current rates
 */

import { NextResponse } from 'next/server';
import { getProductsByType, LOAN_PRODUCTS } from '@/lib/lending/products';
import { generateRateSheet, getTodaysRates } from '@/lib/lending/rates';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as 'mortgage' | 'auto' | 'personal' | null;

    let products;

    if (type) {
      products = getProductsByType(type);
    } else {
      products = Object.values(LOAN_PRODUCTS);
    }

    // Get today's rates for highlighting
    const todaysRates = getTodaysRates();

    // Generate rate sheets for each product
    const productsWithRates = products.map(product => {
      const rateSheet = generateRateSheet(product.code);
      return {
        ...product,
        rateSheet,
      };
    });

    return NextResponse.json({
      success: true,
      products: productsWithRates,
      todaysRates,
      asOfDate: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching loan products:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch loan products',
      },
      { status: 500 }
    );
  }
}
