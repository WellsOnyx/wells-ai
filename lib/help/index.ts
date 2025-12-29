/**
 * Help System Index
 *
 * Exports all help and guidance utilities for the Wells AI platform.
 * Provides contextual, conversational assistance that feels like asking a friend.
 *
 * @module lib/help
 */

export {
  // Main functions
  ConversationalHelp,
  getConversationalHelp,
  detectHelpIntent,
  detectFeatureTopic,
  getContextualHelp,
  generateProTips,
  troubleshoot,
  generateTutorial,
  discoverCapabilities,

  // Knowledge bases
  PLATFORM_FEATURES,
  JOURNEY_GUIDANCE,

  // Types
  type HelpIntent,
  type HelpContext,
  type HelpResponse,
} from './conversational-help'

export default {
  getConversationalHelp,
  detectHelpIntent,
  detectFeatureTopic,
  getContextualHelp,
  generateProTips,
  troubleshoot,
  generateTutorial,
  discoverCapabilities,
  PLATFORM_FEATURES,
  JOURNEY_GUIDANCE,
}
