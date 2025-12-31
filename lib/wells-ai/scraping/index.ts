/**
 * Web Scraping Supplier Discovery - Public API
 */

// Types
export * from './types'
export * from './sources'

// Core functionality
export { scrapeSuppliers, searchGooglePlaces, executeScrapingJob } from './scraper'
export { enrichSupplier, enrichSuppliers, extractEmailsFromWebsite } from './enrichment'
export { sendOutreachToSupplier, sendBatchOutreach, generateOutreachEmail, generateLinkedInMessage, generatePhoneScript } from './outreach'

// Discovery engine
export {
  runSupplierDiscovery,
  runScheduledDiscovery,
  matchContactsToRequest,
  convertContactToSupplier,
  type BuyerRequest,
  type DiscoveryResult,
  type ScheduledDiscoveryConfig,
  type ImportedContact,
} from './discovery-engine'
