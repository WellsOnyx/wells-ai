// @ts-nocheck
/**
 * Integration Setup Guide
 *
 * This knowledge base is used by Wells AI to guide users through
 * setting up various integrations step-by-step in conversation.
 */

export interface SetupStep {
  step: number
  title: string
  description: string
  action?: string // URL or command
  fields?: string[] // Fields to collect
  note?: string
}

export interface IntegrationGuide {
  id: string
  name: string
  category: 'inbox' | 'payments' | 'social' | 'infrastructure'
  priority: number // 1 = highest
  estimatedTime: string
  approvalTime?: string // For APIs requiring review
  prerequisites?: string[]
  envVars: string[]
  steps: SetupStep[]
  webhookUrl?: string
  testCommand?: string
}

export const INTEGRATION_GUIDES: IntegrationGuide[] = [
  // ============================================================================
  // PRIORITY 1: GMAIL (Unified Inbox)
  // ============================================================================
  {
    id: 'gmail',
    name: 'Gmail Integration',
    category: 'inbox',
    priority: 1,
    estimatedTime: '15-20 minutes',
    envVars: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI'],
    webhookUrl: 'https://wellsonyx.io/api/inbox/gmail/webhook',
    steps: [
      {
        step: 1,
        title: 'Go to Google Cloud Console',
        description: 'Open the Google Cloud Console to create a new project or select an existing one.',
        action: 'https://console.cloud.google.com',
      },
      {
        step: 2,
        title: 'Create a New Project',
        description: 'Click "Select a project" → "New Project". Name it "Wells Onyx Inbox" or similar.',
        note: 'If you already have a project, you can skip this step.',
      },
      {
        step: 3,
        title: 'Enable Gmail API',
        description: 'Go to "APIs & Services" → "Library". Search for "Gmail API" and click "Enable".',
        action: 'https://console.cloud.google.com/apis/library/gmail.googleapis.com',
      },
      {
        step: 4,
        title: 'Configure OAuth Consent Screen',
        description: 'Go to "APIs & Services" → "OAuth consent screen". Select "External" user type.',
        action: 'https://console.cloud.google.com/apis/credentials/consent',
        note: 'Add your email as a test user during development. For production, submit for verification.',
      },
      {
        step: 5,
        title: 'Fill Consent Screen Details',
        description: 'Enter app name: "Wells Onyx", support email, and developer contact.',
        fields: ['App name', 'User support email', 'Developer contact email'],
      },
      {
        step: 6,
        title: 'Add Scopes',
        description: 'Click "Add or Remove Scopes" and add these Gmail scopes:',
        note: `Required scopes:
• https://www.googleapis.com/auth/gmail.readonly
• https://www.googleapis.com/auth/gmail.send
• https://www.googleapis.com/auth/gmail.modify
• https://www.googleapis.com/auth/gmail.labels`,
      },
      {
        step: 7,
        title: 'Add Test Users',
        description: 'Add the email addresses that will test the integration before going live.',
        fields: ['Test user email addresses'],
      },
      {
        step: 8,
        title: 'Create OAuth 2.0 Credentials',
        description: 'Go to "APIs & Services" → "Credentials" → "Create Credentials" → "OAuth client ID".',
        action: 'https://console.cloud.google.com/apis/credentials',
      },
      {
        step: 9,
        title: 'Configure OAuth Client',
        description: 'Select "Web application" as the application type. Name it "Wells Onyx Web".',
        fields: ['Application type: Web application', 'Name: Wells Onyx Web'],
      },
      {
        step: 10,
        title: 'Add Authorized Redirect URI',
        description: 'Under "Authorized redirect URIs", add:',
        note: 'https://wellsonyx.io/api/inbox/gmail/callback',
      },
      {
        step: 11,
        title: 'Copy Credentials',
        description: 'Copy your Client ID and Client Secret. You\'ll need these for Vercel.',
        fields: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
      },
      {
        step: 12,
        title: 'Add to Vercel Environment Variables',
        description: 'Go to Vercel → Project Settings → Environment Variables. Add:',
        action: 'https://vercel.com/wellsonyxs-projects/wellsai/settings/environment-variables',
        fields: [
          'GOOGLE_CLIENT_ID = (your client ID)',
          'GOOGLE_CLIENT_SECRET = (your client secret)',
          'GOOGLE_REDIRECT_URI = https://wellsonyx.io/api/inbox/gmail/callback',
        ],
      },
      {
        step: 13,
        title: 'Redeploy',
        description: 'Trigger a new deployment for the environment variables to take effect.',
        note: 'You can do this by pushing any commit or clicking "Redeploy" in Vercel.',
      },
      {
        step: 14,
        title: 'Test the Integration',
        description: 'Go to the inbox settings page and click "Connect Gmail".',
        action: 'https://wellsonyx.io/inbox/settings',
      },
    ],
    testCommand: 'curl https://wellsonyx.io/api/inbox/gmail/accounts',
  },

  // ============================================================================
  // PRIORITY 2: TWILIO SMS
  // ============================================================================
  {
    id: 'twilio',
    name: 'Twilio SMS Integration',
    category: 'inbox',
    priority: 2,
    estimatedTime: '10-15 minutes',
    envVars: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER'],
    webhookUrl: 'https://wellsonyx.io/api/inbox/sms/webhook',
    steps: [
      {
        step: 1,
        title: 'Create Twilio Account',
        description: 'Sign up for a Twilio account if you don\'t have one.',
        action: 'https://www.twilio.com/try-twilio',
      },
      {
        step: 2,
        title: 'Get Account Credentials',
        description: 'From the Twilio Console dashboard, find your Account SID and Auth Token.',
        action: 'https://console.twilio.com',
        fields: ['Account SID', 'Auth Token'],
      },
      {
        step: 3,
        title: 'Buy a Phone Number',
        description: 'Go to Phone Numbers → Buy a Number. Choose a number with SMS capability.',
        action: 'https://console.twilio.com/us1/develop/phone-numbers/manage/search',
        note: 'Choose a local number or toll-free based on your needs. Local numbers start at $1/month.',
      },
      {
        step: 4,
        title: 'Configure Webhook',
        description: 'Go to your phone number settings and set the webhook for incoming messages:',
        note: `Messaging Configuration:
• A MESSAGE COMES IN: Webhook
• URL: https://wellsonyx.io/api/inbox/sms/webhook
• HTTP Method: POST`,
      },
      {
        step: 5,
        title: 'Add to Vercel Environment Variables',
        description: 'Add these environment variables to your Vercel project:',
        action: 'https://vercel.com/wellsonyxs-projects/wellsai/settings/environment-variables',
        fields: [
          'TWILIO_ACCOUNT_SID = (your account SID)',
          'TWILIO_AUTH_TOKEN = (your auth token)',
          'TWILIO_PHONE_NUMBER = (your Twilio number, e.g., +1234567890)',
        ],
      },
      {
        step: 6,
        title: 'Test SMS',
        description: 'Send a text message to your Twilio number and check if it appears in the inbox.',
      },
    ],
    testCommand: 'curl -X POST https://wellsonyx.io/api/inbox/sms/send -H "Content-Type: application/json" -d \'{"to": "+1234567890", "message": "Test from Wells"}\'',
  },

  // ============================================================================
  // PRIORITY 3: PUSHER (Real-time)
  // ============================================================================
  {
    id: 'pusher',
    name: 'Pusher Real-time Updates',
    category: 'infrastructure',
    priority: 3,
    estimatedTime: '5-10 minutes',
    envVars: ['PUSHER_APP_ID', 'PUSHER_KEY', 'PUSHER_SECRET', 'PUSHER_CLUSTER', 'NEXT_PUBLIC_PUSHER_KEY', 'NEXT_PUBLIC_PUSHER_CLUSTER'],
    steps: [
      {
        step: 1,
        title: 'Create Pusher Account',
        description: 'Sign up for Pusher Channels (free tier available).',
        action: 'https://dashboard.pusher.com/accounts/sign_up',
      },
      {
        step: 2,
        title: 'Create a Channels App',
        description: 'Click "Create app" and name it "wells-onyx". Choose the closest cluster.',
        note: 'Recommended cluster: us2 (Virginia) or us3 (Oregon) for US-based users.',
      },
      {
        step: 3,
        title: 'Get App Keys',
        description: 'Go to "App Keys" tab and copy all credentials.',
        fields: ['app_id', 'key', 'secret', 'cluster'],
      },
      {
        step: 4,
        title: 'Add to Vercel Environment Variables',
        description: 'Add these environment variables:',
        fields: [
          'PUSHER_APP_ID = (your app id)',
          'PUSHER_KEY = (your key)',
          'PUSHER_SECRET = (your secret)',
          'PUSHER_CLUSTER = (your cluster, e.g., us2)',
          'NEXT_PUBLIC_PUSHER_KEY = (same as PUSHER_KEY)',
          'NEXT_PUBLIC_PUSHER_CLUSTER = (same as PUSHER_CLUSTER)',
        ],
        note: 'NEXT_PUBLIC_ variables are exposed to the browser for client-side connections.',
      },
    ],
  },

  // ============================================================================
  // PRIORITY 4: RESEND (Transactional Email)
  // ============================================================================
  {
    id: 'resend',
    name: 'Resend Email Service',
    category: 'infrastructure',
    priority: 4,
    estimatedTime: '10-15 minutes',
    envVars: ['RESEND_API_KEY'],
    steps: [
      {
        step: 1,
        title: 'Create Resend Account',
        description: 'Sign up for Resend (free tier: 3,000 emails/month).',
        action: 'https://resend.com/signup',
      },
      {
        step: 2,
        title: 'Verify Your Domain',
        description: 'Go to Domains → Add Domain. Enter "wellsonyx.io".',
        action: 'https://resend.com/domains',
      },
      {
        step: 3,
        title: 'Add DNS Records',
        description: 'Add the DNS records Resend provides to your domain registrar:',
        note: `You'll need to add:
• 1 TXT record for SPF
• 1 TXT record for DKIM
• 1 MX record (optional, for receiving)`,
      },
      {
        step: 4,
        title: 'Wait for Verification',
        description: 'DNS propagation can take up to 24 hours, but usually completes in minutes.',
      },
      {
        step: 5,
        title: 'Get API Key',
        description: 'Go to API Keys → Create API Key. Name it "Wells Production".',
        action: 'https://resend.com/api-keys',
      },
      {
        step: 6,
        title: 'Add to Vercel',
        description: 'Add RESEND_API_KEY to your Vercel environment variables.',
        fields: ['RESEND_API_KEY = re_xxxxx...'],
      },
    ],
  },

  // ============================================================================
  // PRIORITY 5: STRIPE (Payments)
  // ============================================================================
  {
    id: 'stripe',
    name: 'Stripe Payments',
    category: 'payments',
    priority: 5,
    estimatedTime: '20-30 minutes',
    envVars: ['STRIPE_SECRET_KEY', 'STRIPE_PUBLISHABLE_KEY', 'STRIPE_WEBHOOK_SECRET'],
    webhookUrl: 'https://wellsonyx.io/api/webhooks/stripe',
    steps: [
      {
        step: 1,
        title: 'Create Stripe Account',
        description: 'Sign up for Stripe and complete business verification.',
        action: 'https://dashboard.stripe.com/register',
      },
      {
        step: 2,
        title: 'Complete Business Profile',
        description: 'Add your business details, bank account, and tax information.',
        note: 'This is required before you can accept live payments.',
      },
      {
        step: 3,
        title: 'Get API Keys',
        description: 'Go to Developers → API keys. Copy both publishable and secret keys.',
        action: 'https://dashboard.stripe.com/apikeys',
        fields: ['Publishable key (pk_live_...)', 'Secret key (sk_live_...)'],
        note: 'Use test keys (pk_test_, sk_test_) for development.',
      },
      {
        step: 4,
        title: 'Create Webhook Endpoint',
        description: 'Go to Developers → Webhooks → Add endpoint.',
        action: 'https://dashboard.stripe.com/webhooks',
        note: `Endpoint URL: https://wellsonyx.io/api/webhooks/stripe
Events to send:
• checkout.session.completed
• payment_intent.succeeded
• payment_intent.payment_failed
• customer.subscription.created
• customer.subscription.updated
• customer.subscription.deleted`,
      },
      {
        step: 5,
        title: 'Get Webhook Secret',
        description: 'After creating the webhook, click to reveal the signing secret.',
        fields: ['Signing secret (whsec_...)'],
      },
      {
        step: 6,
        title: 'Add to Vercel',
        description: 'Add all Stripe environment variables:',
        fields: [
          'STRIPE_SECRET_KEY = sk_live_...',
          'STRIPE_PUBLISHABLE_KEY = pk_live_...',
          'STRIPE_WEBHOOK_SECRET = whsec_...',
          'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = pk_live_...',
        ],
      },
    ],
  },

  // ============================================================================
  // PRIORITY 6: CIRCLE (USDC/Crypto)
  // ============================================================================
  {
    id: 'circle',
    name: 'Circle USDC Payments',
    category: 'payments',
    priority: 6,
    estimatedTime: '30-45 minutes',
    approvalTime: '1-3 business days',
    envVars: ['CIRCLE_API_KEY', 'CIRCLE_ENVIRONMENT'],
    steps: [
      {
        step: 1,
        title: 'Create Circle Account',
        description: 'Sign up for Circle\'s developer program.',
        action: 'https://console.circle.com/signup',
      },
      {
        step: 2,
        title: 'Complete KYB Verification',
        description: 'Submit business documentation for Know Your Business verification.',
        note: 'Required documents: Business registration, EIN, beneficial owner info.',
      },
      {
        step: 3,
        title: 'Create API Key',
        description: 'Once approved, go to Developer → API Keys → Create Key.',
        action: 'https://console.circle.com/api-keys',
      },
      {
        step: 4,
        title: 'Configure Environment',
        description: 'Start with sandbox for testing, then switch to production.',
        note: 'Sandbox: Free testing with fake USDC. Production: Real money.',
      },
      {
        step: 5,
        title: 'Add to Vercel',
        description: 'Add Circle environment variables:',
        fields: [
          'CIRCLE_API_KEY = (your API key)',
          'CIRCLE_ENVIRONMENT = sandbox (or production)',
        ],
      },
    ],
  },

  // ============================================================================
  // PRIORITY 7: LINKEDIN (Requires Partnership)
  // ============================================================================
  {
    id: 'linkedin',
    name: 'LinkedIn Integration',
    category: 'social',
    priority: 7,
    estimatedTime: '30 minutes to apply',
    approvalTime: '1-2 weeks',
    envVars: ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET'],
    steps: [
      {
        step: 1,
        title: 'Create LinkedIn App',
        description: 'Go to LinkedIn Developers and create a new app.',
        action: 'https://www.linkedin.com/developers/apps/new',
      },
      {
        step: 2,
        title: 'Fill App Details',
        description: 'Enter app name, LinkedIn Page, and app logo.',
        fields: ['App name: Wells Onyx', 'LinkedIn Page (required)', 'App logo'],
      },
      {
        step: 3,
        title: 'Request Products',
        description: 'Go to Products tab and request access to:',
        note: `Required products:
• Sign In with LinkedIn using OpenID Connect
• Share on LinkedIn
• Marketing Developer Platform (for messaging)`,
      },
      {
        step: 4,
        title: 'Add OAuth Redirect',
        description: 'In Auth tab, add authorized redirect URL:',
        note: 'https://wellsonyx.io/api/inbox/linkedin/callback',
      },
      {
        step: 5,
        title: 'Wait for Approval',
        description: 'Marketing Developer Platform requires LinkedIn approval (1-2 weeks).',
      },
      {
        step: 6,
        title: 'Get Credentials',
        description: 'Once approved, copy Client ID and Client Secret from Auth tab.',
        fields: ['Client ID', 'Client Secret'],
      },
      {
        step: 7,
        title: 'Add to Vercel',
        description: 'Add LinkedIn credentials to environment variables.',
        fields: [
          'LINKEDIN_CLIENT_ID = (your client ID)',
          'LINKEDIN_CLIENT_SECRET = (your client secret)',
        ],
      },
    ],
  },

  // ============================================================================
  // PRIORITY 8: TWITTER/X
  // ============================================================================
  {
    id: 'twitter',
    name: 'Twitter/X Integration',
    category: 'social',
    priority: 8,
    estimatedTime: '20 minutes to apply',
    approvalTime: 'Instant to 1 week',
    envVars: ['TWITTER_CLIENT_ID', 'TWITTER_CLIENT_SECRET', 'TWITTER_BEARER_TOKEN'],
    steps: [
      {
        step: 1,
        title: 'Apply for Developer Account',
        description: 'Apply for Twitter Developer access.',
        action: 'https://developer.twitter.com/en/portal/petition/essential/basic-info',
      },
      {
        step: 2,
        title: 'Describe Use Case',
        description: 'Explain that you\'re building a unified inbox for business communications.',
        note: 'Be specific about reading DMs and sending messages on behalf of authenticated users.',
      },
      {
        step: 3,
        title: 'Create Project & App',
        description: 'Once approved, create a new Project and App.',
        action: 'https://developer.twitter.com/en/portal/projects-and-apps',
      },
      {
        step: 4,
        title: 'Set Up OAuth 2.0',
        description: 'Enable OAuth 2.0 in your app settings.',
        note: `Type: Web App
Callback URL: https://wellsonyx.io/api/inbox/twitter/callback
Website: https://wellsonyx.io`,
      },
      {
        step: 5,
        title: 'Request Elevated Access',
        description: 'Apply for elevated access if you need DM read/write.',
        note: 'Basic access is limited. Elevated access unlocks full DM functionality.',
      },
      {
        step: 6,
        title: 'Get Credentials',
        description: 'Copy your OAuth 2.0 Client ID, Secret, and Bearer Token.',
        fields: ['Client ID', 'Client Secret', 'Bearer Token'],
      },
      {
        step: 7,
        title: 'Add to Vercel',
        description: 'Add Twitter credentials to environment variables.',
        fields: [
          'TWITTER_CLIENT_ID = (your client ID)',
          'TWITTER_CLIENT_SECRET = (your client secret)',
          'TWITTER_BEARER_TOKEN = (your bearer token)',
        ],
      },
    ],
  },

  // ============================================================================
  // PRIORITY 9: INSTAGRAM
  // ============================================================================
  {
    id: 'instagram',
    name: 'Instagram Integration',
    category: 'social',
    priority: 9,
    estimatedTime: '30 minutes to apply',
    approvalTime: '1-2 weeks',
    prerequisites: ['Facebook Business account', 'Instagram Business/Creator account'],
    envVars: ['INSTAGRAM_CLIENT_ID', 'INSTAGRAM_CLIENT_SECRET'],
    steps: [
      {
        step: 1,
        title: 'Set Up Facebook Business',
        description: 'Ensure you have a Facebook Business account linked to your Instagram.',
        action: 'https://business.facebook.com',
      },
      {
        step: 2,
        title: 'Convert to Business Account',
        description: 'Your Instagram account must be a Business or Creator account.',
        note: 'Go to Instagram Settings → Account → Switch to Professional Account.',
      },
      {
        step: 3,
        title: 'Create Facebook App',
        description: 'Create a new app on Meta for Developers.',
        action: 'https://developers.facebook.com/apps/create/',
        note: 'Choose "Business" as the app type.',
      },
      {
        step: 4,
        title: 'Add Instagram Product',
        description: 'In your app, add the "Instagram" product.',
      },
      {
        step: 5,
        title: 'Configure Instagram Basic Display',
        description: 'Set up Instagram Basic Display API with your redirect URI.',
        note: 'Redirect URI: https://wellsonyx.io/api/inbox/instagram/callback',
      },
      {
        step: 6,
        title: 'Add Messenger Product',
        description: 'Add the Messenger product for Instagram DM access.',
        note: 'This requires additional permissions and app review.',
      },
      {
        step: 7,
        title: 'Submit for App Review',
        description: 'Submit your app for review to access instagram_manage_messages permission.',
        note: 'Include a screencast showing how you\'ll use the API.',
      },
      {
        step: 8,
        title: 'Get Credentials',
        description: 'Once approved, get your App ID and App Secret.',
        fields: ['Instagram App ID', 'Instagram App Secret'],
      },
      {
        step: 9,
        title: 'Add to Vercel',
        description: 'Add Instagram credentials to environment variables.',
        fields: [
          'INSTAGRAM_CLIENT_ID = (your app ID)',
          'INSTAGRAM_CLIENT_SECRET = (your app secret)',
        ],
      },
    ],
  },
]

// ============================================================================
// HELPER FUNCTIONS FOR CHAT
// ============================================================================

export function getGuideById(id: string): IntegrationGuide | undefined {
  return INTEGRATION_GUIDES.find(g => g.id === id)
}

export function getGuidesByCategory(category: IntegrationGuide['category']): IntegrationGuide[] {
  return INTEGRATION_GUIDES.filter(g => g.category === category).sort((a, b) => a.priority - b.priority)
}

export function getGuidesByPriority(maxPriority?: number): IntegrationGuide[] {
  const guides = INTEGRATION_GUIDES.sort((a, b) => a.priority - b.priority)
  return maxPriority ? guides.filter(g => g.priority <= maxPriority) : guides
}

export function formatGuideForChat(guide: IntegrationGuide): string {
  let output = `## ${guide.name} Setup Guide\n\n`
  output += `**Estimated time:** ${guide.estimatedTime}\n`
  if (guide.approvalTime) {
    output += `**Approval time:** ${guide.approvalTime}\n`
  }
  if (guide.prerequisites?.length) {
    output += `**Prerequisites:** ${guide.prerequisites.join(', ')}\n`
  }
  output += `**Environment variables needed:** ${guide.envVars.join(', ')}\n\n`
  output += `---\n\n`

  guide.steps.forEach(step => {
    output += `### Step ${step.step}: ${step.title}\n\n`
    output += `${step.description}\n\n`
    if (step.action) {
      output += `**Link:** ${step.action}\n\n`
    }
    if (step.fields?.length) {
      output += `**Fields to complete:**\n`
      step.fields.forEach(field => {
        output += `- ${field}\n`
      })
      output += `\n`
    }
    if (step.note) {
      output += `> **Note:** ${step.note}\n\n`
    }
  })

  if (guide.webhookUrl) {
    output += `---\n\n**Webhook URL:** \`${guide.webhookUrl}\`\n\n`
  }

  if (guide.testCommand) {
    output += `**Test command:**\n\`\`\`bash\n${guide.testCommand}\n\`\`\`\n\n`
  }

  return output
}

export function formatAllGuidesChecklist(): string {
  let output = `# Integration Setup Checklist\n\n`

  const categories = ['inbox', 'infrastructure', 'payments', 'social'] as const
  const categoryNames = {
    inbox: 'Unified Inbox',
    infrastructure: 'Infrastructure',
    payments: 'Payments',
    social: 'Social Media',
  }

  categories.forEach(category => {
    const guides = getGuidesByCategory(category)
    if (guides.length === 0) return

    output += `## ${categoryNames[category]}\n\n`
    guides.forEach(guide => {
      const approvalNote = guide.approvalTime ? ` *(${guide.approvalTime} approval)*` : ''
      output += `- [ ] **${guide.name}** - ${guide.estimatedTime}${approvalNote}\n`
      output += `  - Env vars: \`${guide.envVars.join('`, `')}\`\n`
    })
    output += `\n`
  })

  return output
}

// Quick reference for Monday execution
export const MONDAY_PRIORITIES = {
  immediate: ['gmail', 'twilio', 'pusher', 'resend'],
  thisWeek: ['stripe', 'circle', 'twitter'],
  longerTerm: ['linkedin', 'instagram'],
}

export function getMondayExecutionPlan(): string {
  let output = `# Monday Execution Plan\n\n`

  output += `## Do First (1-2 hours total)\n\n`
  MONDAY_PRIORITIES.immediate.forEach(id => {
    const guide = getGuideById(id)
    if (guide) {
      output += `1. **${guide.name}** (~${guide.estimatedTime})\n`
      guide.envVars.forEach(env => {
        output += `   - \`${env}\`\n`
      })
    }
  })

  output += `\n## This Week\n\n`
  MONDAY_PRIORITIES.thisWeek.forEach(id => {
    const guide = getGuideById(id)
    if (guide) {
      output += `- **${guide.name}** - ${guide.estimatedTime}${guide.approvalTime ? ` (approval: ${guide.approvalTime})` : ''}\n`
    }
  })

  output += `\n## Apply & Wait\n\n`
  MONDAY_PRIORITIES.longerTerm.forEach(id => {
    const guide = getGuideById(id)
    if (guide) {
      output += `- **${guide.name}** - Apply now, approval takes ${guide.approvalTime || 'varies'}\n`
    }
  })

  return output
}
