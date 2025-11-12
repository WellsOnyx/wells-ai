/**
 * Conversational Settings Detection
 * Detects when users want to configure integrations or settings in conversation
 */

export interface SettingsIntent {
  detected: boolean
  action: 'connect' | 'disconnect' | 'view' | 'test' | 'update' | null
  integration: 'instantly' | 'clay' | 'apollo' | 'phantombuster' | 'twilio' | 'notion' | null
  confidence: number
  extractedData?: {
    apiKey?: string
    email?: string
    accountId?: string
  }
}

/**
 * Detect if user wants to configure integrations or settings
 */
export function detectSettingsIntent(message: string): SettingsIntent {
  const lowerMessage = message.toLowerCase()

  // Integration keywords
  const integrationPatterns = {
    instantly: /instantly\.ai|instantly ai|instantly/i,
    clay: /clay\.earth|clay earth|clay/i,
    apollo: /apollo\.io|apollo io|apollo/i,
    phantombuster: /phantom\s?buster|phantombuster/i,
    twilio: /twilio/i,
    notion: /notion/i
  }

  // Action keywords
  const actionPatterns = {
    connect: /connect|add|link|integrate|set\s?up|configure|enable/i,
    disconnect: /disconnect|remove|unlink|delete|disable/i,
    view: /show|view|display|what.*connected|my\s+integrations|my\s+settings/i,
    test: /test|check|verify/i,
    update: /update|change|modify|edit/i
  }

  // Check for actions
  let detectedAction: SettingsIntent['action'] = null
  let actionConfidence = 0

  for (const [action, pattern] of Object.entries(actionPatterns)) {
    if (pattern.test(lowerMessage)) {
      detectedAction = action as SettingsIntent['action']
      actionConfidence = 0.8
      break
    }
  }

  // Check for integrations
  let detectedIntegration: SettingsIntent['integration'] = null
  let integrationConfidence = 0

  for (const [integration, pattern] of Object.entries(integrationPatterns)) {
    if (pattern.test(lowerMessage)) {
      detectedIntegration = integration as SettingsIntent['integration']
      integrationConfidence = 0.9
      break
    }
  }

  // Calculate overall confidence
  const detected = detectedAction !== null && detectedIntegration !== null
  const confidence = detected ? (actionConfidence + integrationConfidence) / 2 : 0

  // Extract API key if present (common patterns)
  const extractedData: SettingsIntent['extractedData'] = {}

  // API key patterns
  const apiKeyMatch = message.match(/(?:api[_\s]?key|key)[\s:=]+([a-zA-Z0-9_-]{20,})/i)
  if (apiKeyMatch) {
    extractedData.apiKey = apiKeyMatch[1]
  }

  // Email patterns
  const emailMatch = message.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/i)
  if (emailMatch) {
    extractedData.email = emailMatch[1]
  }

  return {
    detected,
    action: detectedAction,
    integration: detectedIntegration,
    confidence,
    extractedData: Object.keys(extractedData).length > 0 ? extractedData : undefined
  }
}

/**
 * Get integration display name
 */
export function getIntegrationDisplayName(integration: SettingsIntent['integration']): string {
  const names: Record<NonNullable<SettingsIntent['integration']>, string> = {
    instantly: 'Instantly.ai',
    clay: 'Clay.earth',
    apollo: 'Apollo.io',
    phantombuster: 'PhantomBuster',
    twilio: 'Twilio',
    notion: 'Notion'
  }
  return integration ? names[integration] : 'Unknown'
}

/**
 * Get integration setup instructions
 */
export function getIntegrationInstructions(integration: SettingsIntent['integration']): {
  title: string
  steps: string[]
  apiKeyLocation: string
  requiredFields: string[]
} {
  const instructions: Record<NonNullable<SettingsIntent['integration']>, any> = {
    instantly: {
      title: 'Connect Instantly.ai',
      steps: [
        'Go to Instantly.ai → Settings → API',
        'Copy your API Key',
        'Paste it in the field below',
        'I\'ll verify the connection'
      ],
      apiKeyLocation: 'https://app.instantly.ai/app/settings/integrations',
      requiredFields: ['apiKey']
    },
    clay: {
      title: 'Connect Clay.earth',
      steps: [
        'Go to Clay → Settings → API Keys',
        'Create a new API key',
        'Copy the key',
        'Paste it below'
      ],
      apiKeyLocation: 'https://app.clay.com/settings/api',
      requiredFields: ['apiKey']
    },
    apollo: {
      title: 'Connect Apollo.io',
      steps: [
        'Go to Apollo.io → Settings → Integrations',
        'Find API Key section',
        'Copy your API key',
        'Paste it below'
      ],
      apiKeyLocation: 'https://app.apollo.io/#/settings/integrations',
      requiredFields: ['apiKey']
    },
    phantombuster: {
      title: 'Connect PhantomBuster',
      steps: [
        'Go to PhantomBuster → Settings → API',
        'Copy your API Key',
        'Paste it below'
      ],
      apiKeyLocation: 'https://phantombuster.com/api',
      requiredFields: ['apiKey']
    },
    twilio: {
      title: 'Connect Twilio',
      steps: [
        'Go to Twilio Console',
        'Copy Account SID and Auth Token',
        'Paste them below'
      ],
      apiKeyLocation: 'https://console.twilio.com/',
      requiredFields: ['accountSid', 'authToken']
    },
    notion: {
      title: 'Connect Notion',
      steps: [
        'Go to Notion → Settings → Integrations',
        'Create Internal Integration',
        'Copy Integration Token',
        'Paste it below'
      ],
      apiKeyLocation: 'https://www.notion.so/my-integrations',
      requiredFields: ['apiKey']
    }
  }

  return integration ? instructions[integration] : {
    title: 'Unknown Integration',
    steps: [],
    apiKeyLocation: '',
    requiredFields: []
  }
}

/**
 * Validate API key format
 */
export function validateApiKeyFormat(integration: SettingsIntent['integration'], apiKey: string): {
  valid: boolean
  error?: string
} {
  if (!apiKey || apiKey.length < 10) {
    return { valid: false, error: 'API key too short' }
  }

  // Integration-specific validation
  switch (integration) {
    case 'instantly':
      // Instantly keys are typically base64
      if (!/^[A-Za-z0-9+/=]+$/.test(apiKey)) {
        return { valid: false, error: 'Invalid Instantly.ai API key format' }
      }
      break

    case 'clay':
      // Clay keys start with 'clay_'
      if (!apiKey.startsWith('clay_')) {
        return { valid: false, error: 'Clay API keys should start with "clay_"' }
      }
      break

    case 'apollo':
      // Apollo keys are alphanumeric
      if (!/^[A-Za-z0-9-]+$/.test(apiKey)) {
        return { valid: false, error: 'Invalid Apollo.io API key format' }
      }
      break
  }

  return { valid: true }
}

/**
 * Example usage:
 *
 * User: "I want to connect my Instantly account"
 * -> { detected: true, action: 'connect', integration: 'instantly', confidence: 0.85 }
 *
 * User: "here's my API key: abc123xyz..."
 * -> { detected: true, extractedData: { apiKey: 'abc123xyz...' } }
 *
 * User: "show my integrations"
 * -> { detected: true, action: 'view', integration: null, confidence: 0.8 }
 */
