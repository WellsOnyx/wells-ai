/**
 * ERP Audit Engine
 *
 * Analyzes customer's historical spend in their ERP and automatically
 * finds savings opportunities by running RFQs against Wells AI suppliers.
 *
 * User's vision: "What if we could do automated ERP audits once the user
 * installs us and suggest / autobid against their current spend to see if
 * we can save them money across everything"
 *
 * Flow:
 * 1. Connect to customer's ERP via Merge.dev
 * 2. Extract historical purchase orders and invoices
 * 3. Analyze spending patterns by category, vendor, frequency
 * 4. Automatically generate RFQs for comparable items
 * 5. Get bids from Wells AI supplier network
 * 6. Calculate potential savings
 * 7. Present savings report to customer
 * 8. One-click to switch suppliers or renegotiate
 */

import { monitorAPI } from '../monitoring';

const MERGE_API_BASE = 'https://api.merge.dev/api';
const MERGE_API_KEY = process.env.MERGE_API_KEY || '';

/**
 * Purchase Order from ERP (historical spend)
 */
export interface HistoricalPO {
  id: string;
  vendorId: string;
  vendorName: string;
  poNumber: string;
  issueDate: string;
  total: number;
  currency: string;
  status: string;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
    category?: string;
  }>;
}

/**
 * Spending analysis by category
 */
export interface CategorySpend {
  category: string;
  totalSpend: number;
  poCount: number;
  avgPOValue: number;
  vendors: Array<{
    name: string;
    spend: number;
    poCount: number;
  }>;
  topItems: Array<{
    description: string;
    totalSpend: number;
    quantity: number;
    avgUnitPrice: number;
  }>;
}

/**
 * Savings opportunity
 */
export interface SavingsOpportunity {
  category: string;
  currentVendor: string;
  currentSpend: number;
  proposedVendor: string;
  proposedPrice: number;
  estimatedSavings: number;
  savingsPercent: number;
  confidence: 'high' | 'medium' | 'low';
  itemDescription: string;
  annualizedSavings?: number;
}

/**
 * Complete ERP audit report
 */
export interface ERPAuditReport {
  customerId: string;
  auditDate: string;
  periodAnalyzed: {
    start: string;
    end: string;
  };
  summary: {
    totalSpend: number;
    poCount: number;
    vendorCount: number;
    categoryCount: number;
    potentialSavings: number;
    savingsPercent: number;
  };
  categoryBreakdown: CategorySpend[];
  savingsOpportunities: SavingsOpportunity[];
  recommendations: string[];
}

/**
 * Extract all purchase orders from customer's ERP
 *
 * @param accountToken - Customer's Merge account token
 * @param startDate - Start date for analysis (ISO 8601)
 * @param endDate - End date for analysis (ISO 8601)
 */
export async function extractHistoricalPOs(
  accountToken: string,
  startDate?: string,
  endDate?: string
): Promise<HistoricalPO[]> {
  const monitor = monitorAPI('erp_extract_pos', 'GET');

  try {
    // Build query parameters
    const params = new URLSearchParams();
    if (startDate) params.append('created_after', startDate);
    if (endDate) params.append('created_before', endDate);
    params.append('page_size', '100'); // Max results per page

    let allPOs: HistoricalPO[] = [];
    let nextPage: string | null = `${MERGE_API_BASE}/accounting/v1/purchase-orders?${params}`;

    // Paginate through all results
    while (nextPage) {
      const response: Response = await fetch(nextPage, {
        headers: {
          Authorization: `Bearer ${MERGE_API_KEY}`,
          'X-Account-Token': accountToken,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch POs: ${response.statusText}`);
      }

      const data: any = await response.json();

      // Convert Merge format to our format
      const pos = data.results.map((po: any) => ({
        id: po.id,
        vendorId: po.vendor?.id || 'unknown',
        vendorName: po.vendor?.vendor_name || 'Unknown Vendor',
        poNumber: po.po_number || po.id,
        issueDate: po.issue_date,
        total: po.total_amount || 0,
        currency: po.currency || 'USD',
        status: po.status || 'unknown',
        lineItems: (po.line_items || []).map((item: any) => ({
          description: item.description || 'Unknown Item',
          quantity: item.quantity || 1,
          unitPrice: item.unit_price || 0,
          total: item.total_price || 0,
          category: categorizeLineItem(item.description),
        })),
      }));

      allPOs = [...allPOs, ...pos];

      // Check for next page
      nextPage = data.next || null;
    }

    monitor.end(true);
    console.log(`[ERP AUDIT] Extracted ${allPOs.length} purchase orders`);
    return allPOs;

  } catch (error) {
    monitor.end(false);
    console.error('[ERP AUDIT] Extract POs error:', error);
    throw error;
  }
}

/**
 * Analyze spending patterns from historical POs
 */
export function analyzeSpending(pos: HistoricalPO[]): CategorySpend[] {
  const categoryMap = new Map<string, {
    totalSpend: number;
    poCount: number;
    vendors: Map<string, { spend: number; poCount: number }>;
    items: Map<string, { spend: number; quantity: number; prices: number[] }>;
  }>();

  // Process each PO
  pos.forEach(po => {
    po.lineItems.forEach(item => {
      const category = item.category || 'Uncategorized';

      // Initialize category if doesn't exist
      if (!categoryMap.has(category)) {
        categoryMap.set(category, {
          totalSpend: 0,
          poCount: 0,
          vendors: new Map(),
          items: new Map(),
        });
      }

      const cat = categoryMap.get(category)!;

      // Update category totals
      cat.totalSpend += item.total;
      cat.poCount++;

      // Update vendor data
      if (!cat.vendors.has(po.vendorName)) {
        cat.vendors.set(po.vendorName, { spend: 0, poCount: 0 });
      }
      const vendor = cat.vendors.get(po.vendorName)!;
      vendor.spend += item.total;
      vendor.poCount++;

      // Update item data
      const itemKey = normalizeItemDescription(item.description);
      if (!cat.items.has(itemKey)) {
        cat.items.set(itemKey, { spend: 0, quantity: 0, prices: [] });
      }
      const itemData = cat.items.get(itemKey)!;
      itemData.spend += item.total;
      itemData.quantity += item.quantity;
      itemData.prices.push(item.unitPrice);
    });
  });

  // Convert to CategorySpend format
  const categoryBreakdown: CategorySpend[] = [];

  categoryMap.forEach((data, category) => {
    categoryBreakdown.push({
      category,
      totalSpend: data.totalSpend,
      poCount: data.poCount,
      avgPOValue: data.totalSpend / data.poCount,
      vendors: Array.from(data.vendors.entries())
        .map(([name, data]) => ({
          name,
          spend: data.spend,
          poCount: data.poCount,
        }))
        .sort((a, b) => b.spend - a.spend),
      topItems: Array.from(data.items.entries())
        .map(([description, itemData]) => ({
          description,
          totalSpend: itemData.spend,
          quantity: itemData.quantity,
          avgUnitPrice: itemData.prices.reduce((a, b) => a + b, 0) / itemData.prices.length,
        }))
        .sort((a, b) => b.totalSpend - a.totalSpend)
        .slice(0, 10),
    });
  });

  return categoryBreakdown.sort((a, b) => b.totalSpend - a.totalSpend);
}

/**
 * Find savings opportunities by running RFQs against current spend
 *
 * This is the core "auto-bid" functionality:
 * - For each top spending item
 * - Generate RFQ with current specs
 * - Get quotes from Wells AI supplier network
 * - Compare against current pricing
 * - Calculate potential savings
 */
export async function findSavingsOpportunities(
  categorySpend: CategorySpend[],
  customerId: string
): Promise<SavingsOpportunity[]> {
  const opportunities: SavingsOpportunity[] = [];

  // For each category, analyze top items
  for (const category of categorySpend) {
    // Focus on categories with significant spend
    if (category.totalSpend < 10000) continue;

    // Analyze top 5 items in each category
    for (const item of category.topItems.slice(0, 5)) {
      // Skip items with low spend
      if (item.totalSpend < 5000) continue;

      try {
        // Generate RFQ for this item
        const rfq = {
          customerId,
          category: category.category,
          description: item.description,
          quantity: item.quantity,
          currentPrice: item.avgUnitPrice,
          currentVendor: category.vendors[0]?.name || 'Unknown',
        };

        // Get quotes from Wells AI network
        // (This would call the actual RFQ matching engine)
        const quotes = await getCompetitiveQuotes(rfq);

        // Find best quote that's better than current
        const bestQuote = quotes
          .filter(q => q.price < item.avgUnitPrice)
          .sort((a, b) => a.price - b.price)[0];

        if (bestQuote) {
          const savings = (item.avgUnitPrice - bestQuote.price) * item.quantity;
          const savingsPercent = ((item.avgUnitPrice - bestQuote.price) / item.avgUnitPrice) * 100;

          opportunities.push({
            category: category.category,
            currentVendor: category.vendors[0]?.name || 'Unknown',
            currentSpend: item.totalSpend,
            proposedVendor: bestQuote.vendorName,
            proposedPrice: bestQuote.price,
            estimatedSavings: savings,
            savingsPercent,
            confidence: savingsPercent > 20 ? 'high' : savingsPercent > 10 ? 'medium' : 'low',
            itemDescription: item.description,
            annualizedSavings: savings * 12, // Assuming monthly spend
          });
        }

      } catch (error) {
        console.error(`[ERP AUDIT] Error finding savings for ${item.description}:`, error);
      }
    }
  }

  return opportunities.sort((a, b) => b.estimatedSavings - a.estimatedSavings);
}

/**
 * Generate complete ERP audit report
 */
export async function generateAuditReport(
  accountToken: string,
  customerId: string,
  months: number = 12
): Promise<ERPAuditReport> {
  const monitor = monitorAPI('erp_generate_audit', 'POST');

  try {
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    console.log(`[ERP AUDIT] Analyzing ${months} months of spend for customer ${customerId}`);

    // Step 1: Extract historical POs
    const pos = await extractHistoricalPOs(
      accountToken,
      startDate.toISOString(),
      endDate.toISOString()
    );

    if (pos.length === 0) {
      throw new Error('No purchase orders found in the specified period');
    }

    // Step 2: Analyze spending
    const categoryBreakdown = analyzeSpending(pos);

    // Step 3: Find savings opportunities
    const savingsOpportunities = await findSavingsOpportunities(categoryBreakdown, customerId);

    // Step 4: Calculate summary
    const totalSpend = categoryBreakdown.reduce((sum, cat) => sum + cat.totalSpend, 0);
    const potentialSavings = savingsOpportunities.reduce((sum, opp) => sum + opp.estimatedSavings, 0);
    const savingsPercent = (potentialSavings / totalSpend) * 100;

    const vendorSet = new Set<string>();
    pos.forEach(po => vendorSet.add(po.vendorName));

    // Step 5: Generate recommendations
    const recommendations = generateRecommendations(categoryBreakdown, savingsOpportunities);

    const report: ERPAuditReport = {
      customerId,
      auditDate: new Date().toISOString(),
      periodAnalyzed: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      summary: {
        totalSpend,
        poCount: pos.length,
        vendorCount: vendorSet.size,
        categoryCount: categoryBreakdown.length,
        potentialSavings,
        savingsPercent,
      },
      categoryBreakdown,
      savingsOpportunities,
      recommendations,
    };

    monitor.end(true);
    console.log(`[ERP AUDIT] Report generated: $${potentialSavings.toFixed(2)} in potential savings (${savingsPercent.toFixed(1)}%)`);

    return report;

  } catch (error) {
    monitor.end(false);
    console.error('[ERP AUDIT] Generate report error:', error);
    throw error;
  }
}

/**
 * Helper: Categorize line item by description
 */
function categorizeLineItem(description: string): string {
  const desc = description.toLowerCase();

  if (desc.includes('pcb') || desc.includes('circuit')) return 'Electronics';
  if (desc.includes('semiconductor') || desc.includes('chip')) return 'Semiconductors';
  if (desc.includes('software') || desc.includes('license')) return 'Software';
  if (desc.includes('consulting') || desc.includes('service')) return 'Professional Services';
  if (desc.includes('shipping') || desc.includes('freight')) return 'Logistics';
  if (desc.includes('office') || desc.includes('supply')) return 'Office Supplies';
  if (desc.includes('marketing') || desc.includes('advertising')) return 'Marketing';
  if (desc.includes('legal') || desc.includes('attorney')) return 'Legal';
  if (desc.includes('insurance')) return 'Insurance';
  if (desc.includes('rent') || desc.includes('lease')) return 'Real Estate';

  return 'Other';
}

/**
 * Helper: Normalize item description for grouping
 */
function normalizeItemDescription(description: string): string {
  return description
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .substring(0, 100);
}

/**
 * Helper: Get competitive quotes from Wells AI network
 * (This is a stub - would integrate with actual RFQ matching engine)
 */
async function getCompetitiveQuotes(rfq: any): Promise<Array<{ vendorName: string; price: number }>> {
  // TODO: Integrate with actual RFQ matching engine
  // For now, return mock data showing 10-30% savings

  const savingsPercent = 10 + Math.random() * 20; // 10-30% savings
  const newPrice = rfq.currentPrice * (1 - savingsPercent / 100);

  return [
    {
      vendorName: 'Wells AI Verified Supplier',
      price: newPrice,
    },
  ];
}

/**
 * Helper: Generate actionable recommendations
 */
function generateRecommendations(
  categoryBreakdown: CategorySpend[],
  opportunities: SavingsOpportunity[]
): string[] {
  const recommendations: string[] = [];

  // High-value opportunities
  const highValueOpps = opportunities.filter(o => o.estimatedSavings > 50000);
  if (highValueOpps.length > 0) {
    recommendations.push(
      `Focus on top ${highValueOpps.length} opportunities first - potential savings of $${highValueOpps.reduce((sum, o) => sum + o.estimatedSavings, 0).toLocaleString()}`
    );
  }

  // Vendor consolidation
  const totalVendors = new Set(categoryBreakdown.flatMap(c => c.vendors.map(v => v.name))).size;
  if (totalVendors > 50) {
    recommendations.push(
      `Consider vendor consolidation - you have ${totalVendors} vendors which may lead to inefficiencies`
    );
  }

  // Category-specific
  const topCategory = categoryBreakdown[0];
  if (topCategory) {
    const categoryOpps = opportunities.filter(o => o.category === topCategory.category);
    if (categoryOpps.length > 0) {
      recommendations.push(
        `${topCategory.category} is your highest spend category ($${topCategory.totalSpend.toLocaleString()}) with ${categoryOpps.length} savings opportunities`
      );
    }
  }

  // High confidence opportunities
  const highConfidence = opportunities.filter(o => o.confidence === 'high');
  if (highConfidence.length > 0) {
    recommendations.push(
      `${highConfidence.length} high-confidence opportunities with 20%+ potential savings`
    );
  }

  return recommendations;
}
