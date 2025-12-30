// @ts-nocheck
/**
 * Cold Start Module Index
 *
 * Conversational cold-start and outreach system for WellsAI.
 * Everything through chat. No forms. No pages.
 */

// Contact Ingestion
export {
  parseCSV,
  detectColumnMapping,
  processCSVUpload,
  getContacts,
  parseSegmentDescription,
  segmentContacts,
  getSegmentStats,
  enrichContacts,
  generateUploadSummary,
  describeContacts,
} from './contact-ingestion'

export type {
  ContactUpload,
  Contact,
  ParsedCSVResult,
  IngestionResult,
  SegmentCriteria,
} from './contact-ingestion'

// Outreach Engine
export {
  createCampaign,
  previewCampaign,
  generateCampaignMessages,
  sendMessage,
  recordEvent,
  processReply,
  getCampaignStats,
  getUserOutreachStats,
  getPendingApprovals,
  approveMessage,
  rejectMessage,
  regenerateMessage,
} from './outreach-engine'

export type {
  OutreachMessage,
  OutreachEvent,
  Campaign,
  CampaignPreview,
  MessageContext,
} from './outreach-engine'

// Wells Voice
export {
  PERSONALITIES,
  WELLS_VOICE_PRINCIPLES,
  generateOutreachMessage,
  celebrateWin,
  setHonestExpectations,
  getWellsPhrase,
  WELLS_OUTREACH_PHRASES,
} from './wells-voice'

export type {
  PersonalityMode,
  WellsPersonality,
  OutreachContact,
  GeneratedMessage,
  WinEvent,
  CampaignExpectations,
} from './wells-voice'

// Default export for convenience
import contactIngestion from './contact-ingestion'
import outreachEngine from './outreach-engine'
import wellsVoice from './wells-voice'

export default {
  ...contactIngestion,
  ...outreachEngine,
  ...wellsVoice,
}
