/**
 * ICP Analyzer - Minimal Stub
 *
 * This is a simplified stub to allow campaign-engine to compile.
 * Full ICP analysis has been temporarily disabled pending Notion SDK fixes.
 */

export interface ICP {
  titles: string[]
  industries: string[]
  targetCompanySizes: string[]
  commonPainPoints: string[]
  avgDealSize: number
  summary: string
}

export interface SearchCriteria {
  titles: string[]
  industries: string[]
  companySize?: string
}

/**
 * Build ICP from Notion deals (stub implementation)
 */
export async function buildICPFromNotion(
  notionApiKey: string,
  notionDealsDbId: string
): Promise<ICP> {
  // Stub: Return default ICP
  console.warn('ICP analysis temporarily disabled - using default ICP')

  return {
    titles: ['CEO', 'CTO', 'VP of Engineering', 'Head of Product'],
    industries: ['Technology', 'SaaS', 'E-commerce'],
    targetCompanySizes: ['11-50', '51-200', '201-500'],
    commonPainPoints: ['Scaling challenges', 'Customer acquisition'],
    avgDealSize: 50000,
    summary: 'AI-powered B2B transaction platform for scaling companies in tech and e-commerce'
  }
}

/**
 * Convert ICP to search criteria (stub implementation)
 */
export function icpToSearchCriteria(icp: ICP): SearchCriteria {
  return {
    titles: icp.titles,
    industries: icp.industries,
    companySize: icp.targetCompanySizes[0]
  }
}
