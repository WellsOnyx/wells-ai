// @ts-nocheck
/**
 * Cold Start Credential Helper
 *
 * Conversational credential management for Wells AI.
 * Allows the chat to detect, request, and update credentials naturally.
 */

import { sql } from '@/lib/db'

// Credential types we track
export type CredentialKey =
  | 'APOLLO_API_KEY'
  | 'LINKEDIN_SESSION_COOKIE'
  | 'LINKEDIN_RECRUITER_SESSION'
  | 'OWNER_EMAIL'
  | 'ESCALATION_SLACK_WEBHOOK'

// Get a credential (DB first, then env var fallback)
export async function getCredential(key: CredentialKey): Promise<string | null> {
  try {
    const result = await sql`
      SELECT value FROM cold_start_credentials WHERE key = ${key}
    `
    if (result.length > 0) {
      return result[0].value as string
    }
  } catch (error) {
    // DB not available, fall through to env
  }

  // Fallback to environment variable
  return process.env[key] || null
}

// Save a credential to DB
export async function saveCredential(key: CredentialKey, value: string): Promise<boolean> {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS cold_start_credentials (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `

    await sql`
      INSERT INTO cold_start_credentials (key, value, updated_at)
      VALUES (${key}, ${value}, CURRENT_TIMESTAMP)
      ON CONFLICT (key) DO UPDATE SET
        value = ${value},
        updated_at = CURRENT_TIMESTAMP
    `
    return true
  } catch (error) {
    console.error('Failed to save credential:', error)
    return false
  }
}

// Check if a credential exists and is valid
export async function hasCredential(key: CredentialKey): Promise<boolean> {
  const value = await getCredential(key)
  return !!value && value.length > 0
}

// Test if a credential is working
export async function testCredential(key: CredentialKey): Promise<{ valid: boolean; error?: string }> {
  const value = await getCredential(key)

  if (!value) {
    return { valid: false, error: 'Credential not set' }
  }

  switch (key) {
    case 'APOLLO_API_KEY':
      return testApolloKey(value)
    case 'LINKEDIN_SESSION_COOKIE':
      return testLinkedInCookie(value)
    default:
      return { valid: true } // Can't test, assume valid
  }
}

// Test Apollo API key
async function testApolloKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await fetch('https://api.apollo.io/v1/auth/health', {
      headers: {
        'X-Api-Key': apiKey,
      },
    })
    return { valid: res.ok }
  } catch (error) {
    return { valid: false, error: 'Apollo API unreachable' }
  }
}

// Test LinkedIn session cookie
async function testLinkedInCookie(cookie: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await fetch('https://www.linkedin.com/voyager/api/identity/dash/profiles', {
      headers: {
        'Cookie': `li_at=${cookie}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
    })
    return { valid: res.status !== 401 && res.status !== 403 }
  } catch (error) {
    return { valid: false, error: 'LinkedIn unreachable' }
  }
}

// Detect if user message contains a credential
export function detectCredentialInMessage(message: string): { key: CredentialKey; value: string } | null {
  const trimmed = message.trim()

  // LinkedIn cookie detection (li_at cookies are specific format)
  // They're usually long alphanumeric strings
  if (trimmed.match(/^AQ[A-Za-z0-9_-]{100,}$/)) {
    return { key: 'LINKEDIN_SESSION_COOKIE', value: trimmed }
  }

  // Apollo API key detection (usually starts with specific patterns)
  if (trimmed.match(/^[a-zA-Z0-9]{20,}$/) && !trimmed.includes('@')) {
    // Could be Apollo key - check if we recently asked for it
    return { key: 'APOLLO_API_KEY', value: trimmed }
  }

  // Email detection
  if (trimmed.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
    return { key: 'OWNER_EMAIL', value: trimmed }
  }

  // Slack webhook detection
  if (trimmed.startsWith('https://hooks.slack.com/')) {
    return { key: 'ESCALATION_SLACK_WEBHOOK', value: trimmed }
  }

  return null
}

// Generate conversational request for a credential
export function generateCredentialRequest(key: CredentialKey, reason?: string): string {
  const requests: Record<CredentialKey, string> = {
    APOLLO_API_KEY: `I need your Apollo API key to search for prospects. You can get it from Apollo.io → Settings → Integrations → API. Just paste the key here and I'll save it.`,

    LINKEDIN_SESSION_COOKIE: `My LinkedIn session ${reason || 'needs to be refreshed'}. Here's how to get a new one:

1. Open LinkedIn in Chrome and make sure you're logged in
2. Press F12 to open Developer Tools
3. Go to Application → Cookies → linkedin.com
4. Find the cookie named "li_at" and copy its value

Just paste that value here and I'll update it immediately.`,

    LINKEDIN_RECRUITER_SESSION: `If you have LinkedIn Recruiter access, I can use it for enhanced search. Get the session cookie the same way as the regular LinkedIn cookie. Paste it here if you have it, or say "skip" to continue without it.`,

    OWNER_EMAIL: `What email should I send escalations and notifications to? Just type your email address.`,

    ESCALATION_SLACK_WEBHOOK: `If you want escalation alerts in Slack, paste your Slack webhook URL here. You can create one at api.slack.com/apps → Incoming Webhooks. Or say "skip" if you don't need Slack notifications.`,
  }

  return requests[key] || `I need your ${key}. Please provide it.`
}

// Check what credentials are missing
export async function getMissingCredentials(): Promise<CredentialKey[]> {
  const required: CredentialKey[] = ['APOLLO_API_KEY', 'OWNER_EMAIL']
  const optional: CredentialKey[] = ['LINKEDIN_SESSION_COOKIE']

  const missing: CredentialKey[] = []

  for (const key of [...required, ...optional]) {
    if (!(await hasCredential(key))) {
      missing.push(key)
    }
  }

  return missing
}

// Check what credentials are expired/invalid
export async function getInvalidCredentials(): Promise<CredentialKey[]> {
  const toTest: CredentialKey[] = ['APOLLO_API_KEY', 'LINKEDIN_SESSION_COOKIE']
  const invalid: CredentialKey[] = []

  for (const key of toTest) {
    if (await hasCredential(key)) {
      const result = await testCredential(key)
      if (!result.valid) {
        invalid.push(key)
      }
    }
  }

  return invalid
}
