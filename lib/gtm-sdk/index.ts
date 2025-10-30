/**
 * @wells/gtm-sdk
 * Complete GTM automation at 33bps on closed ACV
 *
 * Install in 1 line. Runs your entire outbound.
 *
 * @example
 * ```typescript
 * import { WellsGTM } from '@wells/gtm-sdk';
 *
 * const gtm = new WellsGTM({
 *   apiKey: 'wells_live_xxx',
 *   icp: { role: 'CPO', companySize: '500-5000' },
 *   goal: 'book 5 demos/week'
 * });
 *
 * await gtm.initialize();
 *
 * // That's it. Wells AI now:
 * // 1. Scrapes 10k CPOs
 * // 2. Crafts 100 InMails/day
 * // 3. Books meetings
 * // 4. Tracks pipeline
 * // 5. Invoices 0.33% of closed ACV
 * ```
 *
 * Revenue Model:
 * - 0 upfront
 * - 33 bps on closed ACV
 * - $10M pipeline → $33,000 fee
 */

export { WellsGTM } from './core'
export { ICPEngine } from './icp-engine'
export { ProspectDiscovery } from './discovery'
export { OutreachEngine } from './outreach'
export { MeetingBooking } from './booking'
export { PipelineTracker } from './pipeline'
export { RevenueCalculator } from './billing'

export * from './types'

// Version
export const VERSION = '1.0.0'
