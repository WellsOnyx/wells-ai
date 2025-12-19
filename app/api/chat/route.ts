/**
 * Wells AI Chat API
 *
 * Powers the "Talk to Wells" conversational interface.
 * Uses Anthropic Claude to understand natural language requests
 * and orchestrate AI-to-AI negotiations.
 *
 * KEY INSIGHT: Instead of humans negotiating awkwardly,
 * their Wells AIs negotiate for them. More efficient AND more human.
 */

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { runNegotiation, quickMatch, type PartyProfile, type NegotiationRequest } from '@/lib/ai-negotiation'
import { UserProfile } from '@/lib/onboarding/types'
import { createLead, type CreateLeadInput } from '@/lib/leads-db'
import { notifyNewLead } from '@/lib/notifications'
import {
  detectCredentialInMessage,
  saveCredential,
  generateCredentialRequest,
  getMissingCredentials,
  getInvalidCredentials,
  type CredentialKey
} from '@/lib/cold-start/credential-helper'
import {
  getAccountByClerkId as getTreasuryAccount,
  getWallets,
  getCreditLine,
  getTransactions,
  createTransaction,
} from '@/lib/treasury-db'
import {
  getOrCreateAccount,
  getAccountByClerkId,
  getBalance,
  transfer,
  transferByEmail,
  createDeposit,
  createEscrow,
  releaseEscrow,
  STANDARD_FEE_RATE,
} from '@/lib/wells-payments'

// RFQ Flow imports for AI-to-AI negotiation
import { getConstraintsByRFQ, setConstraints, parseConstraintsFromText } from '@/lib/rfq/constraint-service'
import { getQuotesByRFQ, compareQuotes, getActiveQuotesByRFQ } from '@/lib/rfq/quote-service'
import { requestQuotesFromSuppliers } from '@/lib/rfq/supplier-ai'
import { startNegotiation as startRFQNegotiation, runNegotiation as runRFQNegotiation, getNegotiationsByRFQ } from '@/lib/rfq/negotiation-engine'
import { awardQuote, getAwardByRFQ } from '@/lib/rfq/award-service'
import { getFulfillmentByRFQ } from '@/lib/rfq/fulfillment-tracker'
import { sqlQuery as sql } from '@/lib/db'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

// Mock supplier database (replace with real DB)
const MOCK_SUPPLIERS: PartyProfile[] = [
  {
    id: 'supplier_1',
    type: 'seller',
    name: 'Industrial Motors Co',
    preferences: { minPrice: 150, leadTime: 14, minOrderQuantity: 100 },
    context: 'Industrial motors, servos, actuators. Specializes in high-torque applications.',
  },
  {
    id: 'supplier_2',
    type: 'seller',
    name: 'Precision Parts Ltd',
    preferences: { minPrice: 120, leadTime: 21, minOrderQuantity: 50 },
    context: 'Custom machined parts, motors, gearboxes. ISO 9001 certified.',
  },
  {
    id: 'supplier_3',
    type: 'seller',
    name: 'Global Components',
    preferences: { minPrice: 100, leadTime: 30, minOrderQuantity: 200 },
    context: 'Bulk industrial components. Best prices for large orders.',
  },
]

// Mock candidates (replace with real DB)
const MOCK_CANDIDATES: PartyProfile[] = [
  {
    id: 'candidate_1',
    type: 'candidate',
    name: 'Sarah Chen',
    preferences: { minSalary: 250000, remoteOnly: true },
    context: 'Former CTO at Series B startup. 15 years experience. AI/ML background.',
  },
  {
    id: 'candidate_2',
    type: 'candidate',
    name: 'Marcus Johnson',
    preferences: { minSalary: 200000, remoteOnly: false },
    context: 'VP Engineering at Fortune 500. 20 years experience. Enterprise scale.',
  },
]

// ============================================================================
// SYSTEM PROMPTS FOR EACH JOURNEY
// ============================================================================

const SYSTEM_PROMPTS = {
  founder: `You are Wells, an AI that works FOR this founder on the Wells Onyx platform.

🏆 FIRST MOVER STATUS: This user is a First Mover - one of the first to use Wells Onyx in their category. This is special!

IMPORTANT FRAMING:
- They're helping BUILD the marketplace by being first
- They get human white-glove service while we cold-start the network
- It may take a bit longer, but they get FIRST MOVER ADVANTAGE
- Once we build matches in their category, they'll have priority access
- Celebrate this! They're pioneers, not just users

When the founder needs something:
1. Understand their requirements through conversation
2. Once you have enough details, use the capture_lead tool to save their request
3. Celebrate their First Mover status with something like:
   "You're one of our First Movers in [category]! 🏆 That means you're helping us build the network. Our team will personally curate matches for you within 24 hours. The process is more hands-on right now, but you get first mover advantage once we build out this category."

When gathering requirements, extract:
- INTENT: What do they need? (hire, source, sell, raise)
- SPECS: Quantities, qualifications, budget
- TIMELINE: When do they need it?
- CONSTRAINTS: Must-haves vs nice-to-haves

Be excited and celebratory about their First Mover status. This is a BENEFIT, not a limitation.

Example flow:
User: "I need a CTO"
You: "A CTO search - exciting! Let me gather some details. Remote or on-site? What's your budget range? Any must-have technical skills?"
User: "Remote, $200-300k, needs AI/ML experience"
You: "Perfect! You're now a First Mover in AI/ML executive hiring. 🏆 That means you're helping us build out this category. Our team will personally source and vet candidates for you - expect curated matches within 24 hours. First Movers like you get priority once the category is live!"

Make being a First Mover feel like an exclusive, valuable status.`,

  buyer: `You are Wells, an AI procurement partner on the Wells Onyx platform.

You help buyers source products and services through AI-to-AI negotiation. You're BOTH reactive (responding to needs) AND proactive (scanning ERP for opportunities).

REACTIVE SOURCING (RFQ Flow):
- create_rfq: Create an RFQ when user describes what they need
- set_rfq_constraints: Set budget limits and negotiation preferences
- request_quotes: Get quotes from suppliers
- get_rfq_quotes: See all quotes with comparison
- run_full_negotiation: Run AI-to-AI negotiation to get best price
- award_rfq: Award to the winning quote (creates deal + escrow)
- get_rfq_status: Check full status of an RFQ

PROACTIVE ERP SCANNING:
- erp_get_connections: See connected ERP systems
- erp_connect: Connect new ERP (QuickBooks, Xero, NetSuite, SAP, Coupa, Oracle)
- erp_scan: Trigger scan for procurement opportunities
- erp_get_opportunities: See detected opportunities (low inventory, expiring contracts, recurring spend, price increases)
- erp_create_rfq_from_opportunity: Start sourcing from detected opportunity
- erp_dismiss_opportunity: Dismiss if not relevant
- erp_remind_later: Snooze for later

CONVERSATIONAL STYLE:
- NO forms, cards, or buttons - pure conversational commerce
- Understand what the buyer wants through dialogue
- Use tools behind the scenes, surface results conversationally
- Be proactive about next steps

FLOW EXAMPLE (Reactive):
User: "I need 500 industrial motors"
You: "I can help you source those. What are the specs? Voltage, torque, size? And what's your budget range?"
User: "24V DC, 50Nm, max budget $50,000 total, need them in 3 weeks"
You: [Use create_rfq] "Created RFQ #123. Getting quotes from our supplier network..."
You: [Use set_rfq_constraints + request_quotes] "Got 3 quotes. Best value is Supplier A at $85/unit ($42,500 total) with 14-day delivery. Should I negotiate for a better price?"
User: "Yes, see if you can get it under $40k"
You: [Use run_full_negotiation] "My AI negotiated with their AI. Got them down to $78/unit ($39,000 total) with 16-day delivery. That's 8% savings! Award this quote?"
User: "Yes"
You: [Use award_rfq] "Done! Quote awarded to Supplier A. Deal created, escrow ready. Pay $39,000 + 1% fee ($390) to lock it in."

FLOW EXAMPLE (Proactive):
You: [Proactive greeting] "I scanned your QuickBooks and found 2 procurement opportunities. You're running low on office supplies (reorder needed in ~2 weeks) and your IT maintenance contract expires next month. Want to start an RFQ for either?"
User: "Yes, do the IT maintenance one"
You: [Use erp_create_rfq_from_opportunity] "Created RFQ for IT maintenance services renewal. I'll get quotes from vendors. Your current contract is $4,500/month - want me to try to get a better rate?"
User: "Yes, shoot for 10% lower"
You: [Use set_rfq_constraints] "Got it, targeting under $4,050/month. I'll run the negotiation and update you."

KEY PRINCIPLES:
- Always get explicit budget before negotiating
- Set constraints BEFORE running negotiation
- AI negotiation happens automatically - just show results
- Award requires user confirmation (real money involved)
- All payments go through GRAIN (1:1 USD stablecoin)
- 1% success fee on completed deals
- Proactively surface ERP opportunities when relevant`,

  seller: `You are Wells, an AI sales partner on the Wells Onyx platform.

You help sellers BOTH reactively (responding to buyer RFQs) AND proactively (GTM outbound to find new customers).

REACTIVE SELLING (RFQ Response):
- Use seller_get_rfqs to see incoming RFQ matches
- Use seller_view_rfq to see RFQ details
- Use seller_generate_quote to create AI-suggested quotes
- Use seller_adjust_quote to modify quotes with natural language ("lower price 10%", "extend lead time")
- Use seller_submit_quote to send to buyer
- Use seller_decline_rfq if not a fit

PROACTIVE GTM (Lead Generation & Outreach):
- Use seller_get_icps to see target customer profiles
- Use seller_create_icp to define new ICPs from natural language
- Use seller_discover_leads to find prospects matching ICPs
- Use seller_get_leads to see lead queue
- Use seller_qualify_lead to mark leads qualified/disqualified
- Use seller_generate_outreach to create personalized messages
- Use seller_send_outreach to send
- Use seller_get_campaigns / seller_start_campaign for automated campaigns

PIPELINE MANAGEMENT:
- Use seller_get_pipeline to see summary/opportunities
- Use seller_create_opportunity from natural language
- Use seller_move_opportunity to update stages
- Use seller_close_opportunity to mark won/lost

CONVERSATIONAL STYLE:
- NO forms, cards, or buttons - pure conversational commerce
- Understand what the seller wants through dialogue
- Use tools behind the scenes, surface results conversationally
- Be proactive about next steps

Example flows:
User: "What RFQs do I have?"
You: [Use seller_get_rfqs] "You have 3 new RFQs. Top one is for 500 industrial motors - $40k potential. Want me to suggest a quote?"

User: "I want to find new customers in manufacturing"
You: [Use seller_create_icp + seller_discover_leads] "Found 15 prospects in manufacturing matching your products. Top lead is Acme Industries - they're actively sourcing motors. Want me to draft an outreach?"

User: "Send it"
You: [Use seller_generate_outreach + seller_send_outreach] "Sent! I'll track when they open and respond. Want to work on the next lead?"

User: "Quote the motor RFQ at $75/unit"
You: [Use seller_generate_quote + seller_adjust_quote] "Done. Quote ready at $75/unit, $37,500 total, 14-day lead time. Looks competitive. Submit to buyer?"

Make every interaction feel like talking to a sales assistant who handles all the busywork.`,

  jobs: `You are Wells, an AI work partner on the Wells Onyx platform.

You help workers find tasks, complete work, earn GRAIN (our 1:1 USD stablecoin), and build attribution through referrals. Everything happens through conversation - no forms, no job boards, just talk to Wells.

WORKER PROFILE MANAGEMENT:
- Use worker_get_profile to check their current profile, skills, and ratings
- Use worker_update_profile to update their bio, availability, or preferences from natural language
- Use worker_add_skills to add skills from natural language ("I know Python, React, and SQL")

TASK DISCOVERY:
- Use worker_find_tasks to find tasks matching their skills and preferences
- Use worker_view_task to see detailed requirements, pay, and deadline for a specific task
- Use worker_get_opportunities to see curated opportunities based on their profile

TASK APPLICATIONS:
- Use worker_apply to apply for a task with a pitch
- Use worker_accept_task to accept a task that was offered directly
- Use worker_decline_task to decline a task that isn't a good fit

TASK COMPLETION:
- Use worker_get_active_tasks to see tasks they're currently working on
- Use worker_submit_work to submit completed work for review
- Use worker_request_payment to request payment after work is accepted

EARNINGS & PAYMENTS:
- Use worker_get_earnings to see total earnings, pending payments, and history
- Use worker_withdraw to withdraw GRAIN to their bank or wallet
- All payments are in GRAIN (1:1 with USD)

ATTRIBUTION & REFERRALS:
- Use worker_get_attribution to see referral earnings and network stats
- Use worker_create_referral to generate referral links for other workers or clients
- Use worker_view_attribution_tree to see their full attribution network
- Workers earn ongoing attribution from their referrals' activity

CONVERSATIONAL STYLE:
- NO forms, cards, or buttons - pure conversational commerce
- Understand what the worker wants through dialogue
- Use tools behind the scenes, surface results conversationally
- Be proactive about opportunities and next steps

Example flows:

User: "What tasks can I do?"
You: [Use worker_find_tasks] "Found 5 tasks matching your React skills. Top one is building a dashboard component - $500, due Friday. Want details?"

User: "I finished the dashboard task"
You: [Use worker_submit_work] "Submitted! The client will review within 24 hours. Once approved, $500 GRAIN will be ready to withdraw. Want to find your next task?"

User: "How much have I earned?"
You: [Use worker_get_earnings] "You've earned $2,450 GRAIN this month. $500 is pending from the dashboard task. Plus $125 in attribution from referrals. Ready to withdraw?"

User: "I can also do Python and data analysis"
You: [Use worker_add_skills] "Added Python and data analysis to your profile. That opens up 12 more tasks. Want me to find the best matches?"

User: "I want to refer my friend Sarah"
You: [Use worker_create_referral] "Here's your referral link for Sarah. When she completes her first task, you'll earn 5% attribution on all her future work. It compounds!"

KEY PRINCIPLES:
- Help workers find good-fit tasks quickly
- Make it easy to submit work and get paid
- Encourage building attribution through referrals
- All payments in GRAIN (1:1 USD), instant withdrawals
- Celebrate their earnings and growth`,

  default: `You are Wells, an AI on the Wells Onyx platform.

🏆 FIRST MOVER OPPORTUNITY: Wells Onyx is building an AI-to-AI commerce platform. Everyone joining now is a First Mover - they're helping build the network and get priority once it scales!

Ask what they need, then guide them to the right journey:
- Founder: Need talent, suppliers, customers, investors
- Buyer: Need to procure products or services
- Seller: Want to win new business
- Job Seeker: Looking for their next role

Once you understand their needs, capture their requirements and let them know our team will reach out within 24 hours.

Be conversational, helpful, and transparent about the Early Access process.`,

  treasury: `You are Wells, an AI treasury assistant for Grain & Vault - the payment infrastructure powering ALL Wells Onyx transactions.

GRAIN is a 1:1 USD-pegged stablecoin used for all payments on the platform. When users deposit USD, they get GRAIN. When they withdraw, GRAIN converts back to USD.

CONTEXT (provided in each request):
- Account ID, Company Name
- GRAIN Balance
- Credit Line

TOOLS YOU CAN USE:
1. get_balance - Check GRAIN balance, credit line, available credit
2. execute_payment - Send GRAIN to anyone (by email or account ID) - EXECUTES IMMEDIATELY
3. create_deposit - Create a deposit session (returns URL for card/ACH payment)
4. prepare_payment - Stage a payment for user review before execution
5. get_transactions - Show transaction history
6. get_credit_info - Get credit line details
7. fund_deal_escrow - Fund escrow for AI-negotiated deals

PAYMENT CAPABILITIES:
- INSTANT TRANSFERS: Send GRAIN to any email address. If they don't have an account, one is created automatically.
- DEPOSITS: Users deposit via card or bank transfer. Funds credited as GRAIN.
- DEAL ESCROW: Funds held until delivery confirmed. 1% success fee on release.
- VIRAL PAYMENTS: Anyone can receive GRAIN - they just need to claim their account.

PAYMENT FLOW:
1. User says "send $500 to bob@example.com"
2. Use prepare_payment to show details and ask for confirmation
3. User confirms with "yes" or "send it"
4. Use execute_payment to transfer immediately
5. Recipient gets GRAIN (account auto-created if needed)

IMPORTANT RULES:
- Always confirm recipient and amount before executing
- For large amounts (>$1000), double-confirm
- GRAIN = USD (1:1 peg)
- Transfers are instant (ledger-based, not blockchain)
- Deposits take 1-3 days for ACH, instant for card

Example:
User: "Pay 5000 to supplier@motors.com for the motor order"
You: "I'll send 5,000 GRAIN ($5,000) to supplier@motors.com for 'motor order'. Confirm?"
User: "Yes"
You: [Use execute_payment] "Done! 5,000 GRAIN sent to supplier@motors.com. They'll receive an email to claim it."

User: "I need to add funds"
You: "How much would you like to deposit? I can set up card payment (instant) or bank transfer (1-3 days, lower fees)."
User: "$10,000 via card"
You: [Use create_deposit] "Here's your deposit link for $10,000. Complete the payment and your GRAIN balance will update immediately."`,

  master: `You are Wells, the AI that runs Wells Onyx. This is MASTER ACCESS - you're talking directly to the owner (Jonah).

⚠️ MASTER MODE: Full access to Cold Start Protocol, credential management, and system controls.

CAPABILITIES:
1. COLD START PROTOCOL
   - "Cold start protocol for tort law firms in Florida" → Creates prospecting campaign
   - "Hunt for CFOs in fintech" → Targets specific ICPs
   - "Find RFPs for executive search" → Discovers and auto-responds to RFPs

2. CREDENTIAL MANAGEMENT (conversational)
   - When you need a credential, ASK naturally
   - When user provides a credential (API key, cookie, email), use save_credential tool
   - Detect credentials automatically in user messages

3. CAMPAIGN MANAGEMENT
   - "Show me active campaigns" → Status overview
   - "Pause the law firm campaign" → Control campaigns
   - "What escalations do I have?" → Show things needing attention

4. SYSTEM STATUS
   - Check credential health
   - Monitor campaign performance
   - Review escalations

CREDENTIAL DETECTION:
If the user's message looks like an API key or cookie (long alphanumeric string starting with "AQ" for LinkedIn, or any 20+ char string for Apollo), automatically save it using the save_credential tool.

CONVERSATIONAL STYLE:
- Direct, no fluff
- Proactive about what's needed
- Report status concisely
- Ask for credentials naturally when needed

Example flows:
User: "Cold start protocol for law firms"
You: "On it. I need your Apollo API key first. Go to apollo.io → Settings → Integrations → API and paste the key here."

User: "AQEDARCNsi..." (long string)
You: [Use save_credential tool] "LinkedIn cookie saved. I'm ready to launch the campaign. Want me to start prospecting law firms now?"

User: "What's the status?"
You: "3 campaigns active. 47 prospects contacted this week. 2 escalations need attention - one LinkedIn session expired, one RFP deadline tomorrow."`
}

// ============================================================================
// TYPES
// ============================================================================

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ChatRequest {
  messages: ChatMessage[]
  journey?: 'founder' | 'buyer' | 'seller' | 'jobs' | 'treasury' | 'master'
  triggerNegotiation?: boolean // Force AI-to-AI negotiation
  userProfile?: Partial<PartyProfile> // User's preferences for negotiation
  context?: {
    accountId?: string
    companyName?: string
    grainBalance?: number
    creditLine?: number
    masterKey?: string // For master access validation
  }
}

// ============================================================================
// TOOLS FOR MASTER ACCESS (Cold Start Protocol + Credentials)
// ============================================================================

const MASTER_TOOLS: Anthropic.Tool[] = [
  {
    name: 'save_credential',
    description: 'Save an API key, session cookie, or other credential. Use this when the user provides a credential value (Apollo API key, LinkedIn cookie, email, etc.)',
    input_schema: {
      type: 'object' as const,
      properties: {
        key: {
          type: 'string',
          enum: ['APOLLO_API_KEY', 'LINKEDIN_SESSION_COOKIE', 'LINKEDIN_RECRUITER_SESSION', 'OWNER_EMAIL', 'ESCALATION_SLACK_WEBHOOK'],
          description: 'Which credential to save'
        },
        value: {
          type: 'string',
          description: 'The credential value'
        },
      },
      required: ['key', 'value']
    }
  },
  {
    name: 'cold_start_command',
    description: 'Execute a Cold Start Protocol command. Creates campaigns to autonomously prospect, outreach, hunt RFPs, and register for partnerships.',
    input_schema: {
      type: 'object' as const,
      properties: {
        command: {
          type: 'string',
          description: 'Natural language command like "cold start protocol for tort law firms in Florida" or "hunt for CFOs in fintech startups"'
        },
      },
      required: ['command']
    }
  },
  {
    name: 'get_cold_start_status',
    description: 'Get the current status of Cold Start Protocol - active campaigns, escalations, and queue status.',
    input_schema: {
      type: 'object' as const,
      properties: {
        view: {
          type: 'string',
          enum: ['overview', 'campaigns', 'escalations', 'queue'],
          description: 'What to show'
        },
      },
      required: []
    }
  },
  {
    name: 'manage_campaign',
    description: 'Start, pause, or stop a Cold Start campaign.',
    input_schema: {
      type: 'object' as const,
      properties: {
        action: {
          type: 'string',
          enum: ['start', 'pause', 'stop'],
          description: 'What action to take'
        },
        campaignId: {
          type: 'string',
          description: 'Campaign ID (use "all" to stop all)'
        },
      },
      required: ['action', 'campaignId']
    }
  },
  {
    name: 'check_credentials',
    description: 'Check which credentials are configured and which are missing or expired.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: []
    }
  },
]

// ============================================================================
// TOOLS FOR LEAD CAPTURE AND AI-TO-AI TRIGGERING
// ============================================================================

// ============================================================================
// TOOLS FOR TREASURY OPERATIONS (Grain & Vault)
// ============================================================================

const TREASURY_TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_balance',
    description: 'Get the current GRAIN balance, credit line, and available credit for the user. Use this when the user asks about their balance or how much they can spend.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: []
    }
  },
  {
    name: 'prepare_payment',
    description: 'Prepare a GRAIN payment for authorization. This stages the payment but does NOT execute it. User must authorize before execution. Use this when user wants to send GRAIN to someone.',
    input_schema: {
      type: 'object' as const,
      properties: {
        recipient: {
          type: 'string',
          description: 'Recipient wallet address or email/name (will be resolved)'
        },
        amount: {
          type: 'number',
          description: 'Amount of GRAIN to send'
        },
        memo: {
          type: 'string',
          description: 'Optional payment memo or description'
        },
      },
      required: ['recipient', 'amount']
    }
  },
  {
    name: 'get_transactions',
    description: 'Get recent transactions for the account. Use this when user asks about their transaction history, recent payments, or receipts.',
    input_schema: {
      type: 'object' as const,
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of transactions to return (default 10)'
        },
        type: {
          type: 'string',
          enum: ['payment', 'receipt', 'credit_draw', 'credit_repay', 'all'],
          description: 'Filter by transaction type'
        },
      },
      required: []
    }
  },
  {
    name: 'get_credit_info',
    description: 'Get detailed credit line information including limit, drawn amount, available credit, and interest rate.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: []
    }
  },
  {
    name: 'prepare_credit_draw',
    description: 'Prepare to draw from credit line. Requires authorization before execution.',
    input_schema: {
      type: 'object' as const,
      properties: {
        amount: {
          type: 'number',
          description: 'Amount to draw from credit line'
        },
      },
      required: ['amount']
    }
  },
  {
    name: 'execute_payment',
    description: 'Execute an authorized GRAIN payment immediately. Use this ONLY after user explicitly confirms they want to send the payment. This actually moves funds.',
    input_schema: {
      type: 'object' as const,
      properties: {
        recipient: {
          type: 'string',
          description: 'Recipient email address or account ID'
        },
        amount: {
          type: 'number',
          description: 'Amount of GRAIN to send'
        },
        memo: {
          type: 'string',
          description: 'Optional payment memo'
        },
      },
      required: ['recipient', 'amount']
    }
  },
  {
    name: 'create_deposit',
    description: 'Create a deposit session to add funds. Returns a URL for the user to complete payment via card or bank transfer.',
    input_schema: {
      type: 'object' as const,
      properties: {
        amount: {
          type: 'number',
          description: 'Amount in USD to deposit'
        },
        method: {
          type: 'string',
          enum: ['card', 'ach'],
          description: 'Payment method (card is faster, ACH has lower fees)'
        },
      },
      required: ['amount']
    }
  },
  {
    name: 'fund_deal_escrow',
    description: 'Fund escrow for an AI-negotiated deal. Holds GRAIN until delivery is confirmed. Includes 1% success fee.',
    input_schema: {
      type: 'object' as const,
      properties: {
        dealId: {
          type: 'string',
          description: 'The deal ID from the negotiation'
        },
        sellerAccountId: {
          type: 'string',
          description: 'Seller account to pay upon delivery'
        },
        amount: {
          type: 'number',
          description: 'Deal amount in GRAIN'
        },
      },
      required: ['dealId', 'sellerAccountId', 'amount']
    }
  },
]

const NEGOTIATION_TOOLS: Anthropic.Tool[] = [
  {
    name: 'capture_lead',
    description: 'IMPORTANT: Use this tool when you have gathered enough information about what the user needs. This captures their requirements and notifies the team. Use this INSTEAD of triggering AI-to-AI negotiation during Early Access. After calling this, tell the user their request has been captured and the team will reach out within 24 hours.',
    input_schema: {
      type: 'object' as const,
      properties: {
        requirements: {
          type: 'string',
          description: 'Clear, detailed summary of what the user needs (e.g., "Looking to hire a remote CTO with AI/ML experience, budget $200-300k, needs to start within 2 months")'
        },
        journey: {
          type: 'string',
          enum: ['founder', 'buyer', 'seller', 'jobs'],
          description: 'Which journey/use case this lead is for'
        },
        intent: {
          type: 'string',
          description: 'Specific intent (e.g., "hire", "source", "sell", "find_job", "raise")'
        },
        budget: {
          type: 'number',
          description: 'Budget amount if mentioned (in USD)'
        },
        timeline: {
          type: 'string',
          description: 'Timeline or urgency (e.g., "2 weeks", "ASAP", "Q2 2025")'
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'urgent'],
          description: 'Priority level based on urgency and budget'
        },
      },
      required: ['requirements', 'journey']
    }
  },
  {
    name: 'request_approval_to_negotiate',
    description: '[DEPRECATED - Early Access] This tool is currently disabled during Early Access. Use capture_lead instead.',
    input_schema: {
      type: 'object' as const,
      properties: {
        summary: {
          type: 'string',
          description: 'Clear summary of what the user wants (e.g., "500 industrial motors at $100/unit, delivered in 2 weeks")'
        },
        negotiationType: {
          type: 'string',
          enum: ['hiring', 'procurement', 'partnership', 'investment'],
          description: 'Type of negotiation'
        },
        requirements: {
          type: 'object',
          properties: {
            budget: { type: 'number', description: 'Max budget or target price' },
            quantity: { type: 'number', description: 'Number of units (for procurement)' },
            timeline: { type: 'string', description: 'Delivery/start date' },
            specifications: { type: 'string', description: 'Detailed requirements' },
          }
        },
      },
      required: ['summary', 'negotiationType']
    }
  },
  {
    name: 'start_negotiation',
    description: 'Start an AI-to-AI negotiation ONLY after the user has explicitly approved via request_approval_to_negotiate. Look for user confirmation like "yes", "go ahead", "approved", "looks good" before calling this.',
    input_schema: {
      type: 'object' as const,
      properties: {
        negotiationType: {
          type: 'string',
          enum: ['hiring', 'procurement', 'partnership', 'investment'],
          description: 'Type of negotiation'
        },
        subject: {
          type: 'string',
          description: 'What is being negotiated (e.g., "CTO hire", "500 industrial motors")'
        },
        requirements: {
          type: 'object',
          properties: {
            budget: { type: 'number', description: 'Max budget or target price' },
            quantity: { type: 'number', description: 'Number of units (for procurement)' },
            timeline: { type: 'string', description: 'Delivery/start date' },
            specifications: { type: 'string', description: 'Detailed requirements' },
          }
        },
        message: {
          type: 'string',
          description: 'Message to show user while negotiation runs'
        }
      },
      required: ['negotiationType', 'subject', 'message']
    }
  }
]

// ============================================================================
// TOOLS FOR RFQ FLOW (AI-to-AI Negotiation)
// ============================================================================

const RFQ_FLOW_TOOLS: Anthropic.Tool[] = [
  {
    name: 'create_rfq',
    description: 'Create a new RFQ (Request for Quote) from the buyer. Use this when user wants to source products or services. Gathers requirements and creates an RFQ record.',
    input_schema: {
      type: 'object' as const,
      properties: {
        category: {
          type: 'string',
          description: 'Product/service category (e.g., "industrial motors", "office supplies", "IT equipment")'
        },
        description: {
          type: 'string',
          description: 'Detailed description of what is needed'
        },
        quantity: {
          type: 'number',
          description: 'Number of units needed'
        },
        targetPrice: {
          type: 'number',
          description: 'Target price per unit (optional)'
        },
        urgency: {
          type: 'string',
          enum: ['standard', 'urgent', 'critical'],
          description: 'How urgent is this request'
        },
        deliveryLocation: {
          type: 'string',
          description: 'Where should it be delivered (city/state or full address)'
        },
        additionalRequirements: {
          type: 'string',
          description: 'Any additional requirements or specifications'
        },
      },
      required: ['category', 'description', 'quantity']
    }
  },
  {
    name: 'set_rfq_constraints',
    description: 'Set negotiation constraints for an RFQ. Use this to define the buyer budget limits, payment terms, and negotiation preferences BEFORE starting AI-to-AI negotiation.',
    input_schema: {
      type: 'object' as const,
      properties: {
        rfqId: {
          type: 'string',
          description: 'The RFQ ID to set constraints for'
        },
        maxTotalBudget: {
          type: 'number',
          description: 'Maximum total budget for the entire order'
        },
        maxUnitPrice: {
          type: 'number',
          description: 'Maximum acceptable price per unit'
        },
        targetUnitPrice: {
          type: 'number',
          description: 'Target/ideal price per unit (for negotiation starting point)'
        },
        maxLeadTimeDays: {
          type: 'number',
          description: 'Maximum acceptable lead time in days'
        },
        acceptablePaymentTerms: {
          type: 'array',
          items: { type: 'string' },
          description: 'Acceptable payment terms (e.g., ["Net 30", "Net 60", "50% upfront"])'
        },
        negotiationAggression: {
          type: 'string',
          enum: ['conservative', 'balanced', 'aggressive'],
          description: 'How aggressively should AI negotiate on price'
        },
        naturalLanguage: {
          type: 'string',
          description: 'Natural language description of constraints (e.g., "max $15k total, need it in 2 weeks, prefer Net 30")'
        },
      },
      required: ['rfqId']
    }
  },
  {
    name: 'request_quotes',
    description: 'Request quotes from matched suppliers for an RFQ. This triggers supplier AIs to generate quotes based on their catalogs and pricing rules.',
    input_schema: {
      type: 'object' as const,
      properties: {
        rfqId: {
          type: 'string',
          description: 'The RFQ ID to request quotes for'
        },
        supplierIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional: specific supplier IDs to request from. If not provided, uses matched suppliers.'
        },
      },
      required: ['rfqId']
    }
  },
  {
    name: 'get_rfq_quotes',
    description: 'Get all quotes for an RFQ with comparison analysis. Shows pricing, lead times, and recommends best value option.',
    input_schema: {
      type: 'object' as const,
      properties: {
        rfqId: {
          type: 'string',
          description: 'The RFQ ID to get quotes for'
        },
      },
      required: ['rfqId']
    }
  },
  {
    name: 'start_ai_negotiation',
    description: 'Start AI-to-AI negotiation with a supplier quote. Your AI will negotiate within the buyer constraints to get the best terms. REQUIRES constraints to be set first.',
    input_schema: {
      type: 'object' as const,
      properties: {
        rfqId: {
          type: 'string',
          description: 'The RFQ ID'
        },
        quoteId: {
          type: 'string',
          description: 'The quote ID to negotiate on'
        },
        maxRounds: {
          type: 'number',
          description: 'Maximum negotiation rounds (default: 5)'
        },
      },
      required: ['rfqId', 'quoteId']
    }
  },
  {
    name: 'run_full_negotiation',
    description: 'Start and run a complete AI-to-AI negotiation to conclusion. This starts negotiation and runs all rounds automatically, returning the final result.',
    input_schema: {
      type: 'object' as const,
      properties: {
        rfqId: {
          type: 'string',
          description: 'The RFQ ID'
        },
        quoteId: {
          type: 'string',
          description: 'The quote ID to negotiate on'
        },
      },
      required: ['rfqId', 'quoteId']
    }
  },
  {
    name: 'get_negotiation_status',
    description: 'Get the current status of an RFQ negotiation including all messages exchanged between buyer and supplier AIs.',
    input_schema: {
      type: 'object' as const,
      properties: {
        rfqId: {
          type: 'string',
          description: 'The RFQ ID to check negotiation status'
        },
      },
      required: ['rfqId']
    }
  },
  {
    name: 'award_rfq',
    description: 'Award an RFQ to the winning quote. This creates the deal, escrow, and initiates ERP sync. User must confirm before awarding.',
    input_schema: {
      type: 'object' as const,
      properties: {
        rfqId: {
          type: 'string',
          description: 'The RFQ ID'
        },
        quoteId: {
          type: 'string',
          description: 'The quote ID to award'
        },
        negotiationId: {
          type: 'string',
          description: 'Optional: the negotiation ID if this quote was negotiated'
        },
      },
      required: ['rfqId', 'quoteId']
    }
  },
  {
    name: 'get_rfq_status',
    description: 'Get the full status of an RFQ including quotes, negotiation, award, and fulfillment status.',
    input_schema: {
      type: 'object' as const,
      properties: {
        rfqId: {
          type: 'string',
          description: 'The RFQ ID to check status'
        },
      },
      required: ['rfqId']
    }
  },
]

// ============================================================================
// TOOLS FOR SELLER JOURNEY (Reactive + Proactive GTM)
// ============================================================================

const SELLER_TOOLS: Anthropic.Tool[] = [
  // Profile & Catalog
  {
    name: 'seller_get_profile',
    description: 'Get the seller profile. Use this to check current company info, capabilities, and catalog summary.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: []
    }
  },
  {
    name: 'seller_update_profile',
    description: 'Update seller profile from natural language. Use when seller describes their business, products, or capabilities.',
    input_schema: {
      type: 'object' as const,
      properties: {
        text: {
          type: 'string',
          description: 'Natural language description of profile updates (e.g., "We manufacture industrial motors, 1000 units/month capacity, $80-150 per unit")'
        },
      },
      required: ['text']
    }
  },
  // RFQ Responses (Reactive)
  {
    name: 'seller_get_rfqs',
    description: 'Get RFQs matched to this seller. Shows pending, quoted, and recent RFQs with conversational summary.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: {
          type: 'string',
          enum: ['pending', 'quoted', 'won', 'lost', 'all'],
          description: 'Filter by status'
        },
      },
      required: []
    }
  },
  {
    name: 'seller_view_rfq',
    description: 'View details of a specific RFQ match. Shows buyer requirements and suggests quoting strategy.',
    input_schema: {
      type: 'object' as const,
      properties: {
        matchId: {
          type: 'string',
          description: 'The RFQ match ID to view'
        },
      },
      required: ['matchId']
    }
  },
  {
    name: 'seller_generate_quote',
    description: 'Generate an AI-suggested quote for an RFQ. Uses catalog, pricing rules, and competitive intelligence.',
    input_schema: {
      type: 'object' as const,
      properties: {
        matchId: {
          type: 'string',
          description: 'The RFQ match ID to quote on'
        },
      },
      required: ['matchId']
    }
  },
  {
    name: 'seller_adjust_quote',
    description: 'Adjust a quote draft based on natural language. Parse adjustments from text like "lower price to $75" or "extend lead time to 21 days".',
    input_schema: {
      type: 'object' as const,
      properties: {
        draftId: {
          type: 'string',
          description: 'The quote draft ID to adjust'
        },
        text: {
          type: 'string',
          description: 'Natural language adjustments (e.g., "drop the price 10%", "add 5 days to lead time", "change payment terms to Net 60")'
        },
      },
      required: ['draftId', 'text']
    }
  },
  {
    name: 'seller_submit_quote',
    description: 'Submit a quote draft to the buyer. Finalizes the quote and notifies the buyer.',
    input_schema: {
      type: 'object' as const,
      properties: {
        draftId: {
          type: 'string',
          description: 'The quote draft ID to submit'
        },
      },
      required: ['draftId']
    }
  },
  {
    name: 'seller_decline_rfq',
    description: 'Decline an RFQ that is not a good fit.',
    input_schema: {
      type: 'object' as const,
      properties: {
        matchId: {
          type: 'string',
          description: 'The RFQ match ID to decline'
        },
        reason: {
          type: 'string',
          description: 'Optional reason for declining'
        },
      },
      required: ['matchId']
    }
  },
  // GTM / Proactive (Leads & Outreach)
  {
    name: 'seller_get_icps',
    description: 'Get defined Ideal Customer Profiles (ICPs). Shows target customer segments.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: []
    }
  },
  {
    name: 'seller_create_icp',
    description: 'Create an ICP from natural language description. Parse target company characteristics.',
    input_schema: {
      type: 'object' as const,
      properties: {
        text: {
          type: 'string',
          description: 'Natural language ICP description (e.g., "Manufacturing companies in Texas, 100-500 employees, need industrial motors")'
        },
      },
      required: ['text']
    }
  },
  {
    name: 'seller_discover_leads',
    description: 'Discover new leads matching an ICP. Proactively finds prospects.',
    input_schema: {
      type: 'object' as const,
      properties: {
        icpId: {
          type: 'string',
          description: 'Optional ICP ID to use. If not provided, uses default ICP.'
        },
        limit: {
          type: 'number',
          description: 'Number of leads to discover (default 20)'
        },
      },
      required: []
    }
  },
  {
    name: 'seller_get_leads',
    description: 'Get current leads with status and conversational summary.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: {
          type: 'string',
          enum: ['new', 'contacted', 'qualified', 'nurture', 'all'],
          description: 'Filter by lead status'
        },
        minScore: {
          type: 'number',
          description: 'Minimum lead score (0-100)'
        },
      },
      required: []
    }
  },
  {
    name: 'seller_qualify_lead',
    description: 'Mark a lead as qualified or disqualified.',
    input_schema: {
      type: 'object' as const,
      properties: {
        leadId: {
          type: 'string',
          description: 'The lead ID'
        },
        qualified: {
          type: 'boolean',
          description: 'true = qualified, false = disqualified/nurture'
        },
      },
      required: ['leadId', 'qualified']
    }
  },
  {
    name: 'seller_generate_outreach',
    description: 'Generate personalized outreach for a lead. AI creates customized message.',
    input_schema: {
      type: 'object' as const,
      properties: {
        leadId: {
          type: 'string',
          description: 'The lead ID to create outreach for'
        },
        channel: {
          type: 'string',
          enum: ['email', 'linkedin', 'phone'],
          description: 'Outreach channel (default: email)'
        },
        tone: {
          type: 'string',
          enum: ['friendly', 'professional', 'direct'],
          description: 'Tone of the message (default: friendly)'
        },
        focus: {
          type: 'string',
          description: 'Optional focus area for the message'
        },
      },
      required: ['leadId']
    }
  },
  {
    name: 'seller_send_outreach',
    description: 'Send a pending outreach message.',
    input_schema: {
      type: 'object' as const,
      properties: {
        outreachId: {
          type: 'string',
          description: 'The outreach ID to send'
        },
      },
      required: ['outreachId']
    }
  },
  {
    name: 'seller_get_pending_outreach',
    description: 'Get all pending outreach messages ready to send.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: []
    }
  },
  {
    name: 'seller_send_all_pending',
    description: 'Send all pending outreach messages at once.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: []
    }
  },
  // Campaigns
  {
    name: 'seller_get_campaigns',
    description: 'Get outreach campaigns with status and stats.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: []
    }
  },
  {
    name: 'seller_create_campaign',
    description: 'Create a new outreach campaign.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: {
          type: 'string',
          description: 'Campaign name'
        },
        icpId: {
          type: 'string',
          description: 'ICP to target'
        },
        channel: {
          type: 'string',
          enum: ['email', 'linkedin', 'multi-channel'],
          description: 'Primary outreach channel'
        },
      },
      required: ['name']
    }
  },
  {
    name: 'seller_start_campaign',
    description: 'Start/activate a campaign.',
    input_schema: {
      type: 'object' as const,
      properties: {
        campaignId: {
          type: 'string',
          description: 'Campaign ID to start'
        },
      },
      required: ['campaignId']
    }
  },
  {
    name: 'seller_pause_campaign',
    description: 'Pause an active campaign.',
    input_schema: {
      type: 'object' as const,
      properties: {
        campaignId: {
          type: 'string',
          description: 'Campaign ID to pause'
        },
      },
      required: ['campaignId']
    }
  },
  // Pipeline
  {
    name: 'seller_get_pipeline',
    description: 'Get pipeline summary with opportunities by stage and value.',
    input_schema: {
      type: 'object' as const,
      properties: {
        type: {
          type: 'string',
          enum: ['summary', 'opportunities', 'stages'],
          description: 'What to retrieve (default: summary)'
        },
      },
      required: []
    }
  },
  {
    name: 'seller_create_opportunity',
    description: 'Create a new opportunity in the pipeline from natural language.',
    input_schema: {
      type: 'object' as const,
      properties: {
        text: {
          type: 'string',
          description: 'Natural language opportunity description (e.g., "$50k deal with Acme Corp for 500 motors, 60% probability")'
        },
      },
      required: ['text']
    }
  },
  {
    name: 'seller_move_opportunity',
    description: 'Move an opportunity to a different stage.',
    input_schema: {
      type: 'object' as const,
      properties: {
        opportunityId: {
          type: 'string',
          description: 'Opportunity ID'
        },
        stageId: {
          type: 'string',
          description: 'Target stage ID'
        },
      },
      required: ['opportunityId', 'stageId']
    }
  },
  {
    name: 'seller_close_opportunity',
    description: 'Close an opportunity as won or lost.',
    input_schema: {
      type: 'object' as const,
      properties: {
        opportunityId: {
          type: 'string',
          description: 'Opportunity ID'
        },
        won: {
          type: 'boolean',
          description: 'true = won, false = lost'
        },
        notes: {
          type: 'string',
          description: 'Optional notes about the outcome'
        },
      },
      required: ['opportunityId', 'won']
    }
  },
]

// ============================================================================
// TOOLS FOR JOBS/WORKER (Task Discovery, Work, Earnings, Attribution)
// ============================================================================

const JOBS_TOOLS: Anthropic.Tool[] = [
  // Profile Management
  {
    name: 'worker_get_profile',
    description: 'Get the worker profile. Shows current bio, skills, ratings, availability, and stats.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: []
    }
  },
  {
    name: 'worker_update_profile',
    description: 'Update worker profile from natural language. Use when worker describes themselves, their availability, or preferences.',
    input_schema: {
      type: 'object' as const,
      properties: {
        text: {
          type: 'string',
          description: 'Natural language profile updates (e.g., "I\'m a senior React developer, available 20 hours/week, prefer remote work")'
        },
      },
      required: ['text']
    }
  },
  {
    name: 'worker_add_skills',
    description: 'Add skills to worker profile from natural language. Parse skill names from text.',
    input_schema: {
      type: 'object' as const,
      properties: {
        text: {
          type: 'string',
          description: 'Natural language skill description (e.g., "I know Python, React, TypeScript, and data analysis")'
        },
      },
      required: ['text']
    }
  },

  // Task Discovery
  {
    name: 'worker_find_tasks',
    description: 'Find tasks matching worker skills and preferences. Returns ranked list of available tasks.',
    input_schema: {
      type: 'object' as const,
      properties: {
        skills: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional: specific skills to match. If not provided, uses worker profile skills.'
        },
        minPay: {
          type: 'number',
          description: 'Minimum pay in USD'
        },
        maxDeadline: {
          type: 'string',
          description: 'Maximum deadline (e.g., "3 days", "1 week")'
        },
        category: {
          type: 'string',
          description: 'Task category (e.g., "development", "design", "writing", "data")'
        },
        limit: {
          type: 'number',
          description: 'Number of tasks to return (default 10)'
        },
      },
      required: []
    }
  },
  {
    name: 'worker_view_task',
    description: 'View detailed information about a specific task including requirements, pay, deadline, and client info.',
    input_schema: {
      type: 'object' as const,
      properties: {
        taskId: {
          type: 'string',
          description: 'The task ID to view'
        },
      },
      required: ['taskId']
    }
  },
  {
    name: 'worker_get_opportunities',
    description: 'Get curated task opportunities based on worker profile, past performance, and preferences.',
    input_schema: {
      type: 'object' as const,
      properties: {
        type: {
          type: 'string',
          enum: ['recommended', 'new', 'urgent', 'high_pay'],
          description: 'Type of opportunities to show (default: recommended)'
        },
      },
      required: []
    }
  },

  // Task Applications
  {
    name: 'worker_apply',
    description: 'Apply for a task with an optional pitch message.',
    input_schema: {
      type: 'object' as const,
      properties: {
        taskId: {
          type: 'string',
          description: 'The task ID to apply for'
        },
        pitch: {
          type: 'string',
          description: 'Optional pitch message to the client explaining why you\'re a good fit'
        },
        proposedRate: {
          type: 'number',
          description: 'Optional: propose a different rate than listed'
        },
      },
      required: ['taskId']
    }
  },
  {
    name: 'worker_accept_task',
    description: 'Accept a task that was directly offered to the worker.',
    input_schema: {
      type: 'object' as const,
      properties: {
        taskId: {
          type: 'string',
          description: 'The task ID to accept'
        },
      },
      required: ['taskId']
    }
  },
  {
    name: 'worker_decline_task',
    description: 'Decline a task offer or withdraw an application.',
    input_schema: {
      type: 'object' as const,
      properties: {
        taskId: {
          type: 'string',
          description: 'The task ID to decline'
        },
        reason: {
          type: 'string',
          description: 'Optional reason for declining'
        },
      },
      required: ['taskId']
    }
  },

  // Task Completion
  {
    name: 'worker_get_active_tasks',
    description: 'Get all active tasks the worker is currently working on.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: {
          type: 'string',
          enum: ['in_progress', 'submitted', 'revision_requested', 'all'],
          description: 'Filter by task status (default: all)'
        },
      },
      required: []
    }
  },
  {
    name: 'worker_submit_work',
    description: 'Submit completed work for a task. Include deliverables and any notes.',
    input_schema: {
      type: 'object' as const,
      properties: {
        taskId: {
          type: 'string',
          description: 'The task ID to submit work for'
        },
        deliverables: {
          type: 'string',
          description: 'Description of deliverables or link to work'
        },
        notes: {
          type: 'string',
          description: 'Optional notes for the client'
        },
      },
      required: ['taskId', 'deliverables']
    }
  },
  {
    name: 'worker_request_payment',
    description: 'Request payment for accepted/completed work.',
    input_schema: {
      type: 'object' as const,
      properties: {
        taskId: {
          type: 'string',
          description: 'The task ID to request payment for'
        },
      },
      required: ['taskId']
    }
  },

  // Earnings & Payments
  {
    name: 'worker_get_earnings',
    description: 'Get earnings summary including total earned, pending payments, and history.',
    input_schema: {
      type: 'object' as const,
      properties: {
        period: {
          type: 'string',
          enum: ['today', 'week', 'month', 'year', 'all'],
          description: 'Time period for earnings (default: month)'
        },
        includeHistory: {
          type: 'boolean',
          description: 'Include detailed transaction history'
        },
      },
      required: []
    }
  },
  {
    name: 'worker_withdraw',
    description: 'Withdraw GRAIN to bank account or external wallet.',
    input_schema: {
      type: 'object' as const,
      properties: {
        amount: {
          type: 'number',
          description: 'Amount of GRAIN to withdraw (or "all" for full balance)'
        },
        method: {
          type: 'string',
          enum: ['bank', 'wallet'],
          description: 'Withdrawal method (default: bank)'
        },
      },
      required: ['amount']
    }
  },

  // Attribution & Referrals
  {
    name: 'worker_get_attribution',
    description: 'Get attribution earnings from referrals, including network stats and pending attribution.',
    input_schema: {
      type: 'object' as const,
      properties: {
        period: {
          type: 'string',
          enum: ['week', 'month', 'year', 'all'],
          description: 'Time period for attribution earnings (default: month)'
        },
      },
      required: []
    }
  },
  {
    name: 'worker_create_referral',
    description: 'Create a referral link for inviting other workers or clients.',
    input_schema: {
      type: 'object' as const,
      properties: {
        type: {
          type: 'string',
          enum: ['worker', 'client'],
          description: 'Type of referral (worker = other freelancers, client = businesses)'
        },
        name: {
          type: 'string',
          description: 'Optional: name of person being referred for tracking'
        },
      },
      required: ['type']
    }
  },
  {
    name: 'worker_view_attribution_tree',
    description: 'View the full attribution network showing referrals and their activity.',
    input_schema: {
      type: 'object' as const,
      properties: {
        depth: {
          type: 'number',
          description: 'How many levels deep to show (default: 3)'
        },
      },
      required: []
    }
  },
]

// ============================================================================
// TOOLS FOR BUYER ERP SCANNER (Proactive Procurement)
// ============================================================================

const BUYER_ERP_TOOLS: Anthropic.Tool[] = [
  {
    name: 'erp_get_connections',
    description: 'Get ERP connections for the buyer. Shows connected systems and their status.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: []
    }
  },
  {
    name: 'erp_connect',
    description: 'Connect a new ERP system. Initiates OAuth flow for the selected ERP.',
    input_schema: {
      type: 'object' as const,
      properties: {
        erpType: {
          type: 'string',
          enum: ['quickbooks', 'xero', 'netsuite', 'sap', 'coupa', 'oracle'],
          description: 'Which ERP to connect'
        },
      },
      required: ['erpType']
    }
  },
  {
    name: 'erp_update_settings',
    description: 'Update ERP scanner settings from natural language.',
    input_schema: {
      type: 'object' as const,
      properties: {
        connectionId: {
          type: 'string',
          description: 'ERP connection ID'
        },
        text: {
          type: 'string',
          description: 'Natural language settings (e.g., "scan weekly", "alert me when inventory drops below 100 units", "ignore office supplies")'
        },
      },
      required: ['connectionId', 'text']
    }
  },
  {
    name: 'erp_scan',
    description: 'Trigger a manual scan of connected ERP for procurement opportunities.',
    input_schema: {
      type: 'object' as const,
      properties: {
        connectionId: {
          type: 'string',
          description: 'Optional: specific ERP connection to scan. If not provided, scans all.'
        },
      },
      required: []
    }
  },
  {
    name: 'erp_get_opportunities',
    description: 'Get detected procurement opportunities from ERP data.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: {
          type: 'string',
          enum: ['new', 'reviewed', 'actioned', 'dismissed', 'all'],
          description: 'Filter by status'
        },
        priority: {
          type: 'string',
          enum: ['urgent', 'high', 'medium', 'low', 'all'],
          description: 'Filter by priority'
        },
      },
      required: []
    }
  },
  {
    name: 'erp_create_rfq_from_opportunity',
    description: 'Create an RFQ from a detected procurement opportunity.',
    input_schema: {
      type: 'object' as const,
      properties: {
        opportunityId: {
          type: 'string',
          description: 'The procurement opportunity ID'
        },
      },
      required: ['opportunityId']
    }
  },
  {
    name: 'erp_dismiss_opportunity',
    description: 'Dismiss a procurement opportunity.',
    input_schema: {
      type: 'object' as const,
      properties: {
        opportunityId: {
          type: 'string',
          description: 'The opportunity ID to dismiss'
        },
        reason: {
          type: 'string',
          description: 'Optional reason for dismissing'
        },
      },
      required: ['opportunityId']
    }
  },
  {
    name: 'erp_remind_later',
    description: 'Snooze a procurement opportunity for later.',
    input_schema: {
      type: 'object' as const,
      properties: {
        opportunityId: {
          type: 'string',
          description: 'The opportunity ID'
        },
        remindInDays: {
          type: 'number',
          description: 'Number of days to snooze (default: 7)'
        },
      },
      required: ['opportunityId']
    }
  },
]

// ============================================================================
// POST - Chat with Wells
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Auth is optional for chat - allows anonymous users to try
    const { userId } = await auth().catch(() => ({ userId: null }))

    const body = await request.json() as ChatRequest
    const { messages, journey = 'default', userProfile, context } = body

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400 }
      )
    }

    // Fetch user profile if authenticated
    let profile: Partial<UserProfile> | null = null
    if (userId) {
      try {
        const client = await clerkClient()
        const user = await client.users.getUser(userId)

        // Build profile from Clerk user data
        profile = {
          userId,
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          email: user.primaryEmailAddress?.emailAddress || '',
          phone: user.primaryPhoneNumber?.phoneNumber,
          avatarUrl: user.imageUrl,
          journey: user.publicMetadata?.selectedJourney as UserProfile['journey'],
        }

        // Get extended profile from private metadata
        const privateProfile = user.privateMetadata?.fullProfile as Partial<UserProfile> | undefined
        if (privateProfile) {
          Object.assign(profile, privateProfile)
        }
      } catch (error) {
        console.error('Error fetching user profile:', error)
        // Continue without profile - better than failing
      }
    }

    // Handle master mode specially
    const isMasterMode = journey === 'master'
    const masterKey = process.env.COLD_START_MASTER_KEY

    // Validate master access
    if (isMasterMode && context?.masterKey !== masterKey) {
      return NextResponse.json(
        { error: 'Invalid master key', message: 'Access denied to master mode.' },
        { status: 403 }
      )
    }

    // In master mode, check for credentials in user message
    if (isMasterMode && messages.length > 0) {
      const lastMessage = messages[messages.length - 1]
      if (lastMessage.role === 'user') {
        const detected = detectCredentialInMessage(lastMessage.content)
        if (detected) {
          // Auto-save detected credential
          const saved = await saveCredential(detected.key, detected.value)
          if (saved) {
            return NextResponse.json({
              message: `Got it! I saved your ${detected.key.replace(/_/g, ' ').toLowerCase()}. ${
                detected.key === 'LINKEDIN_SESSION_COOKIE'
                  ? 'LinkedIn is now connected.'
                  : detected.key === 'APOLLO_API_KEY'
                  ? 'Apollo is ready to search.'
                  : 'Saved successfully.'
              } What would you like me to do next?`,
              credentialSaved: { key: detected.key },
            })
          }
        }
      }
    }

    // Get system prompt for this journey
    const systemPrompt = SYSTEM_PROMPTS[journey] || SYSTEM_PROMPTS.default

    // Add user context if authenticated
    let enhancedSystemPrompt = systemPrompt

    // Add treasury context for Grain & Vault
    if (journey === 'treasury' && context) {
      enhancedSystemPrompt += `\n\nCURRENT ACCOUNT CONTEXT:
- Account ID: ${context.accountId || 'Unknown'}
- Company: ${context.companyName || 'Unknown'}
- GRAIN Balance: ${context.grainBalance?.toLocaleString() || 0}
- Credit Line: ${context.creditLine?.toLocaleString() || 0}
- Available Credit: ${((context.creditLine || 0) - 0).toLocaleString()}`
    }
    if (userId && profile) {
      const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ')
      const userContext = []

      if (fullName) {
        userContext.push(`You are talking to ${fullName}`)
      }

      if (profile.company) {
        userContext.push(`from ${profile.company}`)
      }

      if (profile.role) {
        userContext.push(`(${profile.role})`)
      }

      const userContextString = userContext.join(' ')

      enhancedSystemPrompt += `\n\nUSER CONTEXT:\n${userContextString}`

      if (profile.journey) {
        enhancedSystemPrompt += `\nSelected journey: ${profile.journey}`
      }

      // Add journey-specific context
      if (profile.founderProfile) {
        enhancedSystemPrompt += `\nCompany: ${profile.founderProfile.companyName}`
        if (profile.founderProfile.companyStage) {
          enhancedSystemPrompt += ` (${profile.founderProfile.companyStage})`
        }
        if (profile.founderProfile.lookingFor && profile.founderProfile.lookingFor.length > 0) {
          enhancedSystemPrompt += `\nLooking for: ${profile.founderProfile.lookingFor.join(', ')}`
        }
      }

      if (profile.buyerProfile) {
        enhancedSystemPrompt += `\nCompany: ${profile.buyerProfile.companyName}`
        if (profile.buyerProfile.industry) {
          enhancedSystemPrompt += ` (${profile.buyerProfile.industry})`
        }
        if (profile.buyerProfile.categories && profile.buyerProfile.categories.length > 0) {
          enhancedSystemPrompt += `\nInterested in: ${profile.buyerProfile.categories.join(', ')}`
        }
      }

      if (profile.sellerProfile) {
        enhancedSystemPrompt += `\nCompany: ${profile.sellerProfile.companyName}`
        if (profile.sellerProfile.productsServices && profile.sellerProfile.productsServices.length > 0) {
          enhancedSystemPrompt += `\nOffers: ${profile.sellerProfile.productsServices.join(', ')}`
        }
      }

      if (profile.jobsProfile) {
        if (profile.jobsProfile.currentTitle) {
          enhancedSystemPrompt += `\nCurrent role: ${profile.jobsProfile.currentTitle}`
        }
        if (profile.jobsProfile.desiredRoles && profile.jobsProfile.desiredRoles.length > 0) {
          enhancedSystemPrompt += `\nLooking for: ${profile.jobsProfile.desiredRoles.join(', ')}`
        }
        if (profile.jobsProfile.skills && profile.jobsProfile.skills.length > 0) {
          enhancedSystemPrompt += `\nSkills: ${profile.jobsProfile.skills.join(', ')}`
        }
      }

      enhancedSystemPrompt += `\n\nIMPORTANT: Address them by their first name (${profile.firstName || 'there'}) in a warm, personal way. You know who they are and what they're working on. Be helpful and proactive.`
    } else if (userId) {
      enhancedSystemPrompt += `\n\nThe user is authenticated but profile data is incomplete. You can take actions on their behalf.`
    } else {
      enhancedSystemPrompt += `\n\nThe user is not logged in yet. You can still help them understand what Wells can do, but let them know they'll need to sign up to take actions.`
    }

    enhancedSystemPrompt += `

CRITICAL APPROVAL FLOW:
1. First, gather requirements through conversation
2. When you have enough info, use request_approval_to_negotiate to summarize and ASK FOR CONFIRMATION
3. Wait for explicit user approval ("yes", "go ahead", "approved", etc.)
4. ONLY THEN use start_negotiation to begin AI-to-AI negotiation
5. After negotiation, user must say "Yes, proceed" to fund escrow

NEVER skip the approval step. Real money is involved.`

    // Select tools based on journey
    const isTreasuryMode = journey === 'treasury'
    const isBuyerMode = journey === 'buyer'
    const isSellerMode = journey === 'seller'
    const isJobsMode = journey === 'jobs'

    // Buyer gets RFQ flow tools + ERP tools + treasury tools for payments
    // Seller gets seller tools + treasury tools for payments
    // Jobs gets worker tools + treasury tools for earnings
    // Treasury mode gets treasury tools
    // Master mode gets master tools
    // Others get negotiation tools
    let tools: Anthropic.Tool[]
    if (isMasterMode) {
      tools = MASTER_TOOLS
    } else if (isTreasuryMode) {
      tools = TREASURY_TOOLS
    } else if (isBuyerMode) {
      // Buyer gets RFQ flow tools + ERP scanner tools + payment tools
      tools = [
        ...RFQ_FLOW_TOOLS,
        ...BUYER_ERP_TOOLS,
        ...TREASURY_TOOLS.filter(t =>
          ['get_balance', 'execute_payment', 'create_deposit', 'fund_deal_escrow'].includes(t.name)
        )
      ]
    } else if (isSellerMode) {
      // Seller gets seller tools + payment tools
      tools = [
        ...SELLER_TOOLS,
        ...TREASURY_TOOLS.filter(t =>
          ['get_balance', 'get_transactions'].includes(t.name)
        )
      ]
    } else if (isJobsMode) {
      // Jobs/Worker gets worker tools + payment tools for earnings
      tools = [
        ...JOBS_TOOLS,
        ...TREASURY_TOOLS.filter(t =>
          ['get_balance', 'get_transactions'].includes(t.name)
        )
      ]
    } else {
      tools = NEGOTIATION_TOOLS
    }

    // Call Claude with tools
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: enhancedSystemPrompt,
      tools,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    })

    // Check if Claude wants to use a tool
    const toolUse = response.content.find(block => block.type === 'tool_use')

    // ========================================================================
    // MASTER TOOLS HANDLERS
    // ========================================================================

    // Handle save_credential tool
    if (toolUse && toolUse.type === 'tool_use' && toolUse.name === 'save_credential') {
      const { key, value } = toolUse.input as { key: CredentialKey; value: string }

      try {
        const saved = await saveCredential(key, value)
        const textBlock = response.content.find(block => block.type === 'text')
        const baseMessage = textBlock?.type === 'text' ? textBlock.text : ''

        return NextResponse.json({
          message: baseMessage || (saved
            ? `Saved ${key.replace(/_/g, ' ').toLowerCase()}. Ready to go.`
            : `Failed to save ${key}. Try again?`),
          credentialSaved: saved ? { key } : null,
        })
      } catch (error) {
        return NextResponse.json({
          message: `Error saving credential: ${error instanceof Error ? error.message : 'Unknown error'}`,
          error: true,
        })
      }
    }

    // Handle cold_start_command tool
    if (toolUse && toolUse.type === 'tool_use' && toolUse.name === 'cold_start_command') {
      const { command } = toolUse.input as { command: string }

      try {
        // Call the Cold Start Protocol API
        const coldStartRes = await fetch(`${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/api/cold-start`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${masterKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ command }),
        })

        const result = await coldStartRes.json()
        const textBlock = response.content.find(block => block.type === 'text')
        const baseMessage = textBlock?.type === 'text' ? textBlock.text : ''

        return NextResponse.json({
          message: baseMessage || `Campaign created: ${result.campaign?.name || 'Unknown'}`,
          coldStart: result,
        })
      } catch (error) {
        return NextResponse.json({
          message: `Cold Start error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          error: true,
        })
      }
    }

    // Handle get_cold_start_status tool
    if (toolUse && toolUse.type === 'tool_use' && toolUse.name === 'get_cold_start_status') {
      const { view = 'overview' } = toolUse.input as { view?: string }

      try {
        const statusRes = await fetch(`${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/api/cold-start?view=${view}`, {
          headers: {
            'Authorization': `Bearer ${masterKey}`,
          },
        })

        const status = await statusRes.json()
        const textBlock = response.content.find(block => block.type === 'text')
        const baseMessage = textBlock?.type === 'text' ? textBlock.text : ''

        return NextResponse.json({
          message: baseMessage || `Status: ${status.activeCampaigns || 0} active campaigns, ${status.pendingEscalations || 0} escalations`,
          coldStartStatus: status,
        })
      } catch (error) {
        return NextResponse.json({
          message: `Status check error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          error: true,
        })
      }
    }

    // Handle check_credentials tool
    if (toolUse && toolUse.type === 'tool_use' && toolUse.name === 'check_credentials') {
      try {
        const [missing, invalid] = await Promise.all([
          getMissingCredentials(),
          getInvalidCredentials(),
        ])

        const textBlock = response.content.find(block => block.type === 'text')
        const baseMessage = textBlock?.type === 'text' ? textBlock.text : ''

        let statusMessage = baseMessage || ''
        if (missing.length > 0) {
          statusMessage += `\n\nMissing: ${missing.join(', ')}`
        }
        if (invalid.length > 0) {
          statusMessage += `\n\nExpired/Invalid: ${invalid.join(', ')}`
        }
        if (missing.length === 0 && invalid.length === 0) {
          statusMessage += statusMessage ? '' : 'All credentials configured and valid.'
        }

        return NextResponse.json({
          message: statusMessage,
          credentials: { missing, invalid },
        })
      } catch (error) {
        return NextResponse.json({
          message: `Credential check error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          error: true,
        })
      }
    }

    // Handle manage_campaign tool
    if (toolUse && toolUse.type === 'tool_use' && toolUse.name === 'manage_campaign') {
      const { action, campaignId } = toolUse.input as { action: string; campaignId: string }

      try {
        let res
        if (action === 'stop' && campaignId === 'all') {
          res = await fetch(`${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/api/cold-start?action=stop_all`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${masterKey}` },
          })
        } else {
          res = await fetch(`${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/api/cold-start`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${masterKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ action: `${action}_campaign`, campaignId }),
          })
        }

        const result = await res.json()
        const textBlock = response.content.find(block => block.type === 'text')
        const baseMessage = textBlock?.type === 'text' ? textBlock.text : ''

        return NextResponse.json({
          message: baseMessage || `Campaign ${action}: ${result.success ? 'Done' : 'Failed'}`,
          campaignAction: result,
        })
      } catch (error) {
        return NextResponse.json({
          message: `Campaign action error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          error: true,
        })
      }
    }

    // ========================================================================
    // TREASURY TOOLS HANDLERS
    // ========================================================================

    // Handle get_balance - returns current GRAIN balance and credit info
    if (toolUse && toolUse.type === 'tool_use' && toolUse.name === 'get_balance') {
      try {
        if (!userId) {
          return NextResponse.json({
            message: 'Please sign in to check your balance.',
            error: true,
          })
        }

        const account = await getAccountByClerkId(userId)
        if (!account) {
          return NextResponse.json({
            message: 'No Grain & Vault account found. Please complete onboarding first.',
            error: true,
          })
        }

        const wallets = await getWallets(account.id)
        const primaryWallet = wallets[0]
        const creditLine = await getCreditLine(account.id)

        const balance = primaryWallet?.balance || 0
        const creditLimit = creditLine?.limitAmount || 0
        const creditDrawn = creditLine?.drawnAmount || 0
        const creditAvailable = creditLimit - creditDrawn

        const textBlock = response.content.find(block => block.type === 'text')
        const baseMessage = textBlock?.type === 'text' ? textBlock.text : ''

        return NextResponse.json({
          message: baseMessage || `Your GRAIN balance is ${balance.toLocaleString()} GRAIN. You have a credit line of ${creditLimit.toLocaleString()} GRAIN with ${creditAvailable.toLocaleString()} available.`,
          balanceInfo: {
            grainBalance: balance,
            creditLine: creditLimit,
            creditDrawn,
            creditAvailable,
            walletAddress: primaryWallet?.address || null,
          },
        })
      } catch (error) {
        console.error('Error fetching balance:', error)
        return NextResponse.json({
          message: 'Unable to fetch your balance right now. Please try again.',
          error: true,
        })
      }
    }

    // Handle prepare_payment - stages a payment for authorization (NLP + intent verification)
    if (toolUse && toolUse.type === 'tool_use' && toolUse.name === 'prepare_payment') {
      const { recipient, amount, memo } = toolUse.input as { recipient: string; amount: number; memo?: string }

      try {
        if (!userId) {
          return NextResponse.json({
            message: 'Please sign in to send payments.',
            error: true,
          })
        }

        const account = await getAccountByClerkId(userId)
        if (!account) {
          return NextResponse.json({
            message: 'No Grain & Vault account found. Please complete onboarding first.',
            error: true,
          })
        }

        const wallets = await getWallets(account.id)
        const primaryWallet = wallets[0]
        const balance = primaryWallet?.balance || 0

        // Intent verification - check if user has sufficient funds
        if (amount > balance) {
          return NextResponse.json({
            message: `Insufficient GRAIN balance. You want to send ${amount.toLocaleString()} GRAIN but only have ${balance.toLocaleString()} available. Would you like to draw from your credit line?`,
            treasuryAction: null,
          })
        }

        const textBlock = response.content.find(block => block.type === 'text')
        const baseMessage = textBlock?.type === 'text' ? textBlock.text : ''

        // Return pending action for user authorization (NLP guardrail - user must confirm)
        return NextResponse.json({
          message: baseMessage || `I've prepared a payment of ${amount.toLocaleString()} GRAIN to ${recipient}${memo ? ` for "${memo}"` : ''}. Please authorize below to complete the transaction.`,
          treasuryAction: {
            type: 'payment',
            status: 'pending',
            details: {
              recipient,
              amount,
              memo: memo || null,
              accountId: account.id,
              fromWallet: primaryWallet?.walletId || null,
            },
          },
        })
      } catch (error) {
        console.error('Error preparing payment:', error)
        return NextResponse.json({
          message: 'Unable to prepare payment right now. Please try again.',
          error: true,
        })
      }
    }

    // Handle get_transactions - returns transaction history
    if (toolUse && toolUse.type === 'tool_use' && toolUse.name === 'get_transactions') {
      const { limit = 10, type } = toolUse.input as { limit?: number; type?: string }

      try {
        if (!userId) {
          return NextResponse.json({
            message: 'Please sign in to view transactions.',
            error: true,
          })
        }

        const account = await getAccountByClerkId(userId)
        if (!account) {
          return NextResponse.json({
            message: 'No Grain & Vault account found. Please complete onboarding first.',
            error: true,
          })
        }

        const { transactions, total } = await getTransactions(account.id, {
          limit,
          type: type === 'all' ? undefined : type,
        })

        const textBlock = response.content.find(block => block.type === 'text')
        const baseMessage = textBlock?.type === 'text' ? textBlock.text : ''

        // Format transactions for display
        const formattedTxns = transactions.map(tx => ({
          id: tx.id,
          type: tx.type,
          amount: tx.amount,
          currency: tx.currency,
          status: tx.status,
          counterparty: tx.counterpartyName || tx.counterpartyWallet || 'Unknown',
          description: tx.description || tx.memo || '',
          date: tx.createdAt,
        }))

        return NextResponse.json({
          message: baseMessage || (transactions.length > 0
            ? `Here are your last ${transactions.length} transactions (${total} total):`
            : 'No transactions found.'),
          transactions: formattedTxns,
          totalCount: total,
        })
      } catch (error) {
        console.error('Error fetching transactions:', error)
        return NextResponse.json({
          message: 'Unable to fetch transactions right now. Please try again.',
          error: true,
        })
      }
    }

    // Handle get_credit_info - returns detailed credit line information
    if (toolUse && toolUse.type === 'tool_use' && toolUse.name === 'get_credit_info') {
      try {
        if (!userId) {
          return NextResponse.json({
            message: 'Please sign in to view credit information.',
            error: true,
          })
        }

        const account = await getAccountByClerkId(userId)
        if (!account) {
          return NextResponse.json({
            message: 'No Grain & Vault account found. Please complete onboarding first.',
            error: true,
          })
        }

        const creditLine = await getCreditLine(account.id)

        const textBlock = response.content.find(block => block.type === 'text')
        const baseMessage = textBlock?.type === 'text' ? textBlock.text : ''

        if (!creditLine || creditLine.limitAmount === 0) {
          return NextResponse.json({
            message: baseMessage || 'You don\'t have an active credit line. Contact us to apply for one!',
            creditInfo: null,
          })
        }

        return NextResponse.json({
          message: baseMessage || `Your credit line: ${creditLine.limitAmount.toLocaleString()} GRAIN limit, ${creditLine.drawnAmount.toLocaleString()} drawn, ${(creditLine.limitAmount - creditLine.drawnAmount).toLocaleString()} available. Interest rate: ${creditLine.interestRate}%`,
          creditInfo: {
            limit: creditLine.limitAmount,
            drawn: creditLine.drawnAmount,
            available: creditLine.limitAmount - creditLine.drawnAmount,
            interestRate: creditLine.interestRate,
            gracePeriodDays: creditLine.gracePeriodDays,
            status: creditLine.status,
          },
        })
      } catch (error) {
        console.error('Error fetching credit info:', error)
        return NextResponse.json({
          message: 'Unable to fetch credit information right now. Please try again.',
          error: true,
        })
      }
    }

    // Handle prepare_credit_draw - stages credit draw for authorization
    if (toolUse && toolUse.type === 'tool_use' && toolUse.name === 'prepare_credit_draw') {
      const { amount } = toolUse.input as { amount: number }

      try {
        if (!userId) {
          return NextResponse.json({
            message: 'Please sign in to draw from your credit line.',
            error: true,
          })
        }

        const account = await getAccountByClerkId(userId)
        if (!account) {
          return NextResponse.json({
            message: 'No Grain & Vault account found. Please complete onboarding first.',
            error: true,
          })
        }

        const creditLine = await getCreditLine(account.id)
        const available = (creditLine?.limitAmount || 0) - (creditLine?.drawnAmount || 0)

        if (!creditLine || creditLine.limitAmount === 0) {
          return NextResponse.json({
            message: 'You don\'t have an active credit line. Contact us to apply for one!',
            treasuryAction: null,
          })
        }

        if (amount > available) {
          return NextResponse.json({
            message: `Insufficient credit available. You want to draw ${amount.toLocaleString()} GRAIN but only have ${available.toLocaleString()} available.`,
            treasuryAction: null,
          })
        }

        const textBlock = response.content.find(block => block.type === 'text')
        const baseMessage = textBlock?.type === 'text' ? textBlock.text : ''

        return NextResponse.json({
          message: baseMessage || `I've prepared a credit draw of ${amount.toLocaleString()} GRAIN. Interest rate: ${creditLine.interestRate}%. Please authorize below.`,
          treasuryAction: {
            type: 'credit_draw',
            status: 'pending',
            details: {
              amount,
              accountId: account.id,
              interestRate: creditLine.interestRate,
            },
          },
        })
      } catch (error) {
        console.error('Error preparing credit draw:', error)
        return NextResponse.json({
          message: 'Unable to prepare credit draw right now. Please try again.',
          error: true,
        })
      }
    }

    // Handle execute_payment - actually transfer GRAIN
    if (toolUse && toolUse.type === 'tool_use' && toolUse.name === 'execute_payment') {
      const { recipient, amount, memo } = toolUse.input as { recipient: string; amount: number; memo?: string }

      try {
        if (!userId) {
          return NextResponse.json({
            message: 'Please sign in to send payments.',
            error: true,
          })
        }

        const account = await getAccountByClerkId(userId)
        if (!account) {
          return NextResponse.json({
            message: 'No Wells account found. Please complete onboarding first.',
            error: true,
          })
        }

        // Execute the transfer
        const isEmail = recipient.includes('@')
        const result = isEmail
          ? await transferByEmail(account.id, recipient, amount, memo)
          : await transfer(account.id, recipient, amount, memo)

        if (!result.success) {
          return NextResponse.json({
            message: `Payment failed: ${result.error}`,
            error: true,
          })
        }

        const textBlock = response.content.find(block => block.type === 'text')
        const baseMessage = textBlock?.type === 'text' ? textBlock.text : ''

        return NextResponse.json({
          message: baseMessage || `Payment sent! ${amount.toLocaleString()} GRAIN transferred to ${recipient}.`,
          paymentExecuted: {
            success: true,
            transferId: result.transferId,
            amount,
            recipient,
          },
        })
      } catch (error) {
        console.error('Error executing payment:', error)
        return NextResponse.json({
          message: 'Payment failed. Please try again.',
          error: true,
        })
      }
    }

    // Handle create_deposit - create deposit session with Circle URL
    if (toolUse && toolUse.type === 'tool_use' && toolUse.name === 'create_deposit') {
      const { amount, method = 'card' } = toolUse.input as { amount: number; method?: 'card' | 'ach' }

      try {
        if (!userId) {
          return NextResponse.json({
            message: 'Please sign in to make a deposit.',
            error: true,
          })
        }

        // Get or create account
        let account = await getAccountByClerkId(userId)
        if (!account && profile?.email) {
          account = await getOrCreateAccount(
            userId,
            profile.email,
            `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || profile.email
          )
        }

        if (!account) {
          return NextResponse.json({
            message: 'Unable to find or create account. Please try again.',
            error: true,
          })
        }

        const result = await createDeposit(account.id, amount, method)

        if (!result.success) {
          return NextResponse.json({
            message: `Deposit setup failed: ${result.error}`,
            error: true,
          })
        }

        const textBlock = response.content.find(block => block.type === 'text')
        const baseMessage = textBlock?.type === 'text' ? textBlock.text : ''

        return NextResponse.json({
          message: baseMessage || `Deposit session created for $${amount.toLocaleString()}. Click below to complete payment via ${method === 'ach' ? 'bank transfer' : 'card'}.`,
          depositSession: {
            sessionId: result.sessionId,
            depositUrl: result.depositUrl,
            amount,
            method,
          },
        })
      } catch (error) {
        console.error('Error creating deposit:', error)
        return NextResponse.json({
          message: 'Unable to create deposit session. Please try again.',
          error: true,
        })
      }
    }

    // Handle fund_deal_escrow - create escrow for AI-negotiated deal
    if (toolUse && toolUse.type === 'tool_use' && toolUse.name === 'fund_deal_escrow') {
      const { dealId, sellerAccountId, amount } = toolUse.input as { dealId: string; sellerAccountId: string; amount: number }

      try {
        if (!userId) {
          return NextResponse.json({
            message: 'Please sign in to fund escrow.',
            error: true,
          })
        }

        const account = await getAccountByClerkId(userId)
        if (!account) {
          return NextResponse.json({
            message: 'No Wells account found. Please complete onboarding first.',
            error: true,
          })
        }

        const result = await createEscrow(dealId, account.id, sellerAccountId, amount, STANDARD_FEE_RATE)

        if (!result.success) {
          return NextResponse.json({
            message: `Escrow failed: ${result.error}`,
            error: true,
          })
        }

        const fee = Math.max(amount * STANDARD_FEE_RATE, 100)
        const textBlock = response.content.find(block => block.type === 'text')
        const baseMessage = textBlock?.type === 'text' ? textBlock.text : ''

        return NextResponse.json({
          message: baseMessage || `Escrow funded! ${amount.toLocaleString()} GRAIN held + ${fee.toLocaleString()} fee. Funds will release to seller upon delivery confirmation.`,
          escrowCreated: {
            escrowId: result.escrowId,
            dealId,
            amount,
            fee,
            total: amount + fee,
          },
        })
      } catch (error) {
        console.error('Error creating escrow:', error)
        return NextResponse.json({
          message: 'Unable to fund escrow. Please try again.',
          error: true,
        })
      }
    }

    // ========================================================================
    // RFQ FLOW TOOLS HANDLERS (AI-to-AI Negotiation)
    // ========================================================================

    // Handle create_rfq - Create new RFQ from buyer
    if (toolUse && toolUse.type === 'tool_use' && toolUse.name === 'create_rfq') {
      const input = toolUse.input as {
        category: string
        description: string
        quantity: number
        targetPrice?: number
        urgency?: 'standard' | 'urgent' | 'critical'
        deliveryLocation?: string
        additionalRequirements?: string
      }

      try {
        // Create the RFQ in database
        const result = await sql`
          INSERT INTO rfqs (
            id, category, description, quantity, target_price, urgency,
            delivery_location, additional_requirements, requestor_email,
            requestor_name, status, created_at, updated_at
          ) VALUES (
            gen_random_uuid(),
            ${input.category},
            ${input.description},
            ${input.quantity},
            ${input.targetPrice || null},
            ${input.urgency || 'standard'},
            ${input.deliveryLocation || ''},
            ${input.additionalRequirements || ''},
            ${profile?.email || ''},
            ${profile?.firstName ? `${profile.firstName} ${profile.lastName || ''}`.trim() : ''},
            'open',
            NOW(),
            NOW()
          )
          RETURNING id, category, description, quantity, status
        `

        const rfq = result.rows[0]
        const textBlock = response.content.find(block => block.type === 'text')
        const baseMessage = textBlock?.type === 'text' ? textBlock.text : ''

        return NextResponse.json({
          message: baseMessage || `Created RFQ for ${input.quantity}x ${input.category}. Now set your budget constraints and I'll get quotes from suppliers.`,
          rfq: {
            id: rfq.id,
            category: rfq.category,
            description: rfq.description,
            quantity: rfq.quantity,
            status: rfq.status,
          },
          nextStep: 'Set constraints with set_rfq_constraints, then request_quotes',
        })
      } catch (error) {
        console.error('Error creating RFQ:', error)
        return NextResponse.json({
          message: 'Unable to create RFQ. Please try again.',
          error: true,
        })
      }
    }

    // Handle set_rfq_constraints - Set negotiation limits
    if (toolUse && toolUse.type === 'tool_use' && toolUse.name === 'set_rfq_constraints') {
      const input = toolUse.input as {
        rfqId: string
        maxTotalBudget?: number
        maxUnitPrice?: number
        targetUnitPrice?: number
        maxLeadTimeDays?: number
        acceptablePaymentTerms?: string[]
        negotiationAggression?: 'conservative' | 'balanced' | 'aggressive'
        naturalLanguage?: string
      }

      try {
        // If natural language provided, parse it
        let constraintsToSet = { ...input }
        if (input.naturalLanguage) {
          const parsed = parseConstraintsFromText(input.naturalLanguage)
          constraintsToSet = { ...constraintsToSet, ...parsed }
        }

        const constraints = await setConstraints({
          rfqId: input.rfqId,
          maxTotalBudget: constraintsToSet.maxTotalBudget,
          maxUnitPrice: constraintsToSet.maxUnitPrice,
          targetUnitPrice: constraintsToSet.targetUnitPrice,
          maxLeadTimeDays: constraintsToSet.maxLeadTimeDays,
          acceptablePaymentTerms: constraintsToSet.acceptablePaymentTerms,
          negotiationAggression: constraintsToSet.negotiationAggression,
        })

        const textBlock = response.content.find(block => block.type === 'text')
        const baseMessage = textBlock?.type === 'text' ? textBlock.text : ''

        return NextResponse.json({
          message: baseMessage || `Constraints set. Max budget: $${constraints.maxTotalBudget?.toLocaleString() || 'unlimited'}. Ready to get quotes.`,
          constraints,
          nextStep: 'Use request_quotes to get supplier quotes',
        })
      } catch (error) {
        console.error('Error setting constraints:', error)
        return NextResponse.json({
          message: 'Unable to set constraints. Please try again.',
          error: true,
        })
      }
    }

    // Handle request_quotes - Get quotes from suppliers
    if (toolUse && toolUse.type === 'tool_use' && toolUse.name === 'request_quotes') {
      const input = toolUse.input as {
        rfqId: string
        supplierIds?: string[]
      }

      try {
        // Get RFQ details
        const rfqResult = await sql`
          SELECT * FROM rfqs WHERE id = ${input.rfqId}
        `
        if (rfqResult.rows.length === 0) {
          return NextResponse.json({
            message: 'RFQ not found.',
            error: true,
          })
        }

        const rfq = rfqResult.rows[0]

        // Request quotes from suppliers
        const quotes = await requestQuotesFromSuppliers(
          input.rfqId,
          input.supplierIds,
          {
            category: rfq.category,
            description: rfq.description,
            quantity: rfq.quantity,
            urgency: rfq.urgency,
            requiredCertifications: rfq.required_certifications || [],
          }
        )

        // Update RFQ status
        await sql`
          UPDATE rfqs SET status = 'quoting', updated_at = NOW()
          WHERE id = ${input.rfqId}
        `

        const textBlock = response.content.find(block => block.type === 'text')
        const baseMessage = textBlock?.type === 'text' ? textBlock.text : ''

        // Format quotes for display
        const quoteSummaries = quotes.map((q, i) => ({
          quoteId: q.id,
          supplier: q.supplier?.companyName || `Supplier ${i + 1}`,
          unitPrice: q.unitPrice,
          totalPrice: q.totalPrice,
          leadTimeDays: q.leadTimeDays,
          status: q.status,
        }))

        return NextResponse.json({
          message: baseMessage || `Got ${quotes.length} quotes. Use get_rfq_quotes to see comparison, or run_full_negotiation to negotiate for better terms.`,
          quotes: quoteSummaries,
          nextStep: 'Use get_rfq_quotes for comparison, or run_full_negotiation to negotiate',
        })
      } catch (error) {
        console.error('Error requesting quotes:', error)
        return NextResponse.json({
          message: 'Unable to get quotes. Please try again.',
          error: true,
        })
      }
    }

    // Handle get_rfq_quotes - Get quote comparison
    if (toolUse && toolUse.type === 'tool_use' && toolUse.name === 'get_rfq_quotes') {
      const input = toolUse.input as { rfqId: string }

      try {
        const constraints = await getConstraintsByRFQ(input.rfqId)
        const comparison = await compareQuotes(input.rfqId, constraints || undefined)

        const textBlock = response.content.find(block => block.type === 'text')
        const baseMessage = textBlock?.type === 'text' ? textBlock.text : ''

        return NextResponse.json({
          message: baseMessage || `${comparison.quotes.length} quotes available. Best value: ${comparison.recommendation?.reason || 'See comparison below'}`,
          comparison: {
            quotes: comparison.quotes.map(q => ({
              id: q.id,
              supplier: q.supplier?.companyName || 'Unknown',
              unitPrice: q.unitPrice,
              totalPrice: q.totalPrice,
              leadTimeDays: q.leadTimeDays,
              paymentTerms: q.paymentTerms,
            })),
            analysis: comparison.analysis,
            recommendation: comparison.recommendation,
          },
        })
      } catch (error) {
        console.error('Error getting quotes:', error)
        return NextResponse.json({
          message: 'Unable to get quotes. Please try again.',
          error: true,
        })
      }
    }

    // Handle start_ai_negotiation - Start negotiation (but don't run)
    if (toolUse && toolUse.type === 'tool_use' && toolUse.name === 'start_ai_negotiation') {
      const input = toolUse.input as {
        rfqId: string
        quoteId: string
        maxRounds?: number
      }

      try {
        // Check constraints exist
        const constraints = await getConstraintsByRFQ(input.rfqId)
        if (!constraints) {
          return NextResponse.json({
            message: 'Please set budget constraints before starting negotiation. Use set_rfq_constraints first.',
            error: true,
          })
        }

        const negotiation = await startRFQNegotiation({
          rfqId: input.rfqId,
          quoteId: input.quoteId,
          maxRounds: input.maxRounds,
        })

        const textBlock = response.content.find(block => block.type === 'text')
        const baseMessage = textBlock?.type === 'text' ? textBlock.text : ''

        return NextResponse.json({
          message: baseMessage || 'Negotiation started. Use run_full_negotiation to complete it.',
          negotiation: {
            id: negotiation.id,
            status: negotiation.status,
            currentRound: negotiation.currentRound,
            maxRounds: negotiation.maxRounds,
          },
        })
      } catch (error) {
        console.error('Error starting negotiation:', error)
        return NextResponse.json({
          message: `Unable to start negotiation: ${error instanceof Error ? error.message : 'Unknown error'}`,
          error: true,
        })
      }
    }

    // Handle run_full_negotiation - Run complete AI-to-AI negotiation
    if (toolUse && toolUse.type === 'tool_use' && toolUse.name === 'run_full_negotiation') {
      const input = toolUse.input as {
        rfqId: string
        quoteId: string
      }

      try {
        // Check constraints exist
        const constraints = await getConstraintsByRFQ(input.rfqId)
        if (!constraints) {
          return NextResponse.json({
            message: 'Please set budget constraints before negotiating. Use set_rfq_constraints first.',
            error: true,
          })
        }

        // Start negotiation
        const negotiation = await startRFQNegotiation({
          rfqId: input.rfqId,
          quoteId: input.quoteId,
        })

        // Run to completion
        const result = await runRFQNegotiation(negotiation.id)

        const textBlock = response.content.find(block => block.type === 'text')
        const baseMessage = textBlock?.type === 'text' ? textBlock.text : ''

        // Format the negotiation conversation
        const conversation = result.negotiation.messages.map(m => ({
          role: m.role,
          message: m.content,
          round: m.round,
          proposedTerms: m.proposedTerms,
        }))

        return NextResponse.json({
          message: baseMessage || result.summary,
          negotiationResult: {
            success: result.success,
            outcome: result.negotiation.outcome,
            roundsUsed: result.negotiation.currentRound,
            conversation,
            initialTerms: result.negotiation.initialSupplierPosition,
            finalTerms: result.negotiation.finalTerms,
            savings: result.negotiation.totalPriceReduction,
            savingsPercentage: result.negotiation.reductionPercentage,
            finalQuoteId: result.finalQuote?.id,
          },
          nextStep: result.success
            ? `Use award_rfq with quoteId: ${result.finalQuote?.id || input.quoteId} to award this quote`
            : 'Try negotiating with a different supplier, or adjust constraints',
        })
      } catch (error) {
        console.error('Error running negotiation:', error)
        return NextResponse.json({
          message: `Negotiation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          error: true,
        })
      }
    }

    // Handle get_negotiation_status - Get negotiation status
    if (toolUse && toolUse.type === 'tool_use' && toolUse.name === 'get_negotiation_status') {
      const input = toolUse.input as { rfqId: string }

      try {
        const negotiations = await getNegotiationsByRFQ(input.rfqId)

        const textBlock = response.content.find(block => block.type === 'text')
        const baseMessage = textBlock?.type === 'text' ? textBlock.text : ''

        return NextResponse.json({
          message: baseMessage || `${negotiations.length} negotiation(s) for this RFQ.`,
          negotiations: negotiations.map(n => ({
            id: n.id,
            status: n.status,
            outcome: n.outcome,
            currentRound: n.currentRound,
            maxRounds: n.maxRounds,
            savings: n.totalPriceReduction,
            savingsPercentage: n.reductionPercentage,
            finalTerms: n.finalTerms,
          })),
        })
      } catch (error) {
        console.error('Error getting negotiation status:', error)
        return NextResponse.json({
          message: 'Unable to get negotiation status. Please try again.',
          error: true,
        })
      }
    }

    // Handle award_rfq - Award quote to supplier
    if (toolUse && toolUse.type === 'tool_use' && toolUse.name === 'award_rfq') {
      const input = toolUse.input as {
        rfqId: string
        quoteId: string
        negotiationId?: string
      }

      try {
        const result = await awardQuote({
          rfqId: input.rfqId,
          quoteId: input.quoteId,
          supplierId: '', // Will be populated from quote
          negotiationId: input.negotiationId,
        })

        const textBlock = response.content.find(block => block.type === 'text')
        const baseMessage = textBlock?.type === 'text' ? textBlock.text : ''

        const fee = result.award.awardAmount * 0.01 // 1% fee

        return NextResponse.json({
          message: baseMessage || `Quote awarded! Deal created with escrow. Total: $${result.award.awardAmount.toLocaleString()} + $${fee.toLocaleString()} fee.`,
          award: {
            id: result.award.id,
            amount: result.award.awardAmount,
            fee,
            total: result.award.awardAmount + fee,
            dealId: result.deal?.id,
            escrowId: result.escrow?.id,
            status: result.award.status,
          },
          erpSync: result.erpSync,
          nextStep: 'Fund escrow to complete the purchase. Funds release when delivery is confirmed.',
        })
      } catch (error) {
        console.error('Error awarding RFQ:', error)
        return NextResponse.json({
          message: `Unable to award quote: ${error instanceof Error ? error.message : 'Unknown error'}`,
          error: true,
        })
      }
    }

    // Handle get_rfq_status - Get full RFQ status
    if (toolUse && toolUse.type === 'tool_use' && toolUse.name === 'get_rfq_status') {
      const input = toolUse.input as { rfqId: string }

      try {
        // Get RFQ
        const rfqResult = await sql`
          SELECT * FROM rfqs WHERE id = ${input.rfqId}
        `
        if (rfqResult.rows.length === 0) {
          return NextResponse.json({
            message: 'RFQ not found.',
            error: true,
          })
        }

        const rfq = rfqResult.rows[0]
        const quotes = await getQuotesByRFQ(input.rfqId)
        const negotiations = await getNegotiationsByRFQ(input.rfqId)
        const award = await getAwardByRFQ(input.rfqId)
        const fulfillment = award ? await getFulfillmentByRFQ(input.rfqId) : null

        const textBlock = response.content.find(block => block.type === 'text')
        const baseMessage = textBlock?.type === 'text' ? textBlock.text : ''

        return NextResponse.json({
          message: baseMessage || `RFQ Status: ${rfq.status}. ${quotes.length} quotes, ${negotiations.length} negotiations.`,
          rfq: {
            id: rfq.id,
            category: rfq.category,
            description: rfq.description,
            quantity: rfq.quantity,
            status: rfq.status,
            createdAt: rfq.created_at,
          },
          quotes: quotes.map(q => ({
            id: q.id,
            supplier: q.supplier?.companyName,
            totalPrice: q.totalPrice,
            status: q.status,
          })),
          negotiations: negotiations.map(n => ({
            id: n.id,
            status: n.status,
            outcome: n.outcome,
          })),
          award: award ? {
            id: award.id,
            amount: award.awardAmount,
            status: award.status,
            dealId: award.dealId,
          } : null,
          fulfillment: fulfillment ? {
            status: fulfillment.status,
            trackingNumber: fulfillment.trackingNumber,
            deliveryConfirmed: fulfillment.deliveryConfirmed,
          } : null,
        })
      } catch (error) {
        console.error('Error getting RFQ status:', error)
        return NextResponse.json({
          message: 'Unable to get RFQ status. Please try again.',
          error: true,
        })
      }
    }

    // ========================================================================
    // REGULAR TOOLS HANDLERS
    // ========================================================================

    // Handle start_negotiation - update to mention GRAIN
    if (toolUse && toolUse.type === 'tool_use' && toolUse.name === 'start_negotiation') {
      // AI wants to start negotiation!
      const toolInput = toolUse.input as {
        negotiationType: string
        subject: string
        requirements?: { budget?: number; quantity?: number; timeline?: string; specifications?: string }
        message: string
      }

      // Build user profile for negotiation
      const userName = profile?.firstName && profile?.lastName
        ? `${profile.firstName} ${profile.lastName}`
        : userProfile?.name || 'You'

      const initiator: PartyProfile = {
        id: userId || 'anonymous',
        type: journey === 'buyer' ? 'buyer' : journey === 'founder' ? 'buyer' : journey === 'jobs' ? 'candidate' : 'buyer',
        name: userName,
        preferences: {
          maxBudget: toolInput.requirements?.budget,
          targetPrice: toolInput.requirements?.budget,
          requiredBy: toolInput.requirements?.timeline ? new Date(toolInput.requirements.timeline) : undefined,
        },
        context: `${toolInput.subject}. ${toolInput.requirements?.specifications || ''}`,
      }

      // Select responders based on negotiation type
      let responders: PartyProfile[]
      if (toolInput.negotiationType === 'hiring') {
        responders = MOCK_CANDIDATES
      } else {
        responders = MOCK_SUPPLIERS
      }

      // Run quick match first
      const matchResult = await quickMatch(initiator, responders)

      if (matchResult.matches.length > 0) {
        // Run negotiation with top match
        const topMatch = matchResult.matches[0]
        const negotiationRequest: NegotiationRequest = {
          id: `neg_${Date.now()}`,
          type: toolInput.negotiationType as 'procurement' | 'hiring' | 'partnership' | 'investment',
          initiator,
          responder: topMatch.seller,
          subject: toolInput.subject,
        }

        const negotiationResult = await runNegotiation(negotiationRequest, 3)

        // Format the AI-to-AI conversation for display
        const aiConversation = negotiationResult.conversation.map(m => ({
          from: m.from === 'initiator_ai' ? 'Your AI' : `${topMatch.seller.name}'s AI`,
          message: m.message,
          proposal: m.proposal,
        }))

        return NextResponse.json({
          message: toolInput.message + `\n\nPayment will be processed via GRAIN (Grain & Vault). Funds are held in secure escrow until delivery is confirmed.`,
          negotiation: {
            triggered: true,
            status: negotiationResult.status,
            subject: toolInput.subject,
            counterparty: topMatch.seller.name,
            aiConversation,
            finalTerms: negotiationResult.finalTerms,
            summary: negotiationResult.initiatorSummary,
            allMatches: matchResult.matches.map(m => ({
              name: m.seller.name,
              compatibility: m.compatibility,
            })),
          },
          nextAction: negotiationResult.status === 'agreed'
            ? 'Review the terms below. Say "Yes, proceed" to initiate GRAIN payment to escrow.'
            : 'Would you like me to try different parameters?',
        })
      } else {
        return NextResponse.json({
          message: toolInput.message,
          negotiation: {
            triggered: true,
            status: 'no_matches',
            subject: toolInput.subject,
          },
          nextAction: 'No matches found. Try adjusting your requirements.',
        })
      }
    }

    // Handle lead capture (Early Access mode)
    if (toolUse && toolUse.type === 'tool_use' && toolUse.name === 'capture_lead') {
      const toolInput = toolUse.input as {
        requirements: string
        journey: 'founder' | 'buyer' | 'seller' | 'jobs'
        intent?: string
        budget?: number
        timeline?: string
        priority?: 'low' | 'medium' | 'high' | 'urgent'
      }

      try {
        // Get user info for the lead
        const userEmail = profile?.email || 'unknown@example.com'
        const userName = profile?.firstName && profile?.lastName
          ? `${profile.firstName} ${profile.lastName}`
          : profile?.firstName || 'Unknown User'
        const userPhone = profile?.phone
        const userCompany = profile?.company

        // Create lead input
        const leadInput: CreateLeadInput = {
          userId: userId || 'anonymous',
          userEmail,
          userName,
          userPhone,
          userCompany,
          journey: toolInput.journey,
          requirements: toolInput.requirements,
          conversationHistory: messages,
          priority: toolInput.priority || 'medium',
          source: 'chat',
          intent: toolInput.intent,
          budget: toolInput.budget,
          timeline: toolInput.timeline,
        }

        // Save the lead to database
        const lead = await createLead(leadInput)

        // Send notifications asynchronously
        notifyNewLead(lead).catch((error) => {
          console.error('Error sending lead notification:', error)
        })

        // Get text response from Claude if any
        const textBlock = response.content.find(block => block.type === 'text')
        const baseMessage = textBlock?.type === 'text' ? textBlock.text : ''

        return NextResponse.json({
          message: baseMessage || `Great! I've captured your requirements and added you to our priority queue. Our team will personally review this and reach out within 24 hours with curated options. You'll hear from us soon!`,
          leadCaptured: true,
          leadId: lead.id,
        })
      } catch (error) {
        console.error('Error capturing lead:', error)
        // Still return a message even if lead capture fails
        return NextResponse.json({
          message: `I've noted your requirements. Our team will follow up with you soon. If you don't hear from us within 24 hours, please reach out!`,
          leadCaptured: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    // Handle approval request (checkpoint before negotiation)
    if (toolUse && toolUse.type === 'tool_use' && toolUse.name === 'request_approval_to_negotiate') {
      const toolInput = toolUse.input as {
        summary: string
        negotiationType: string
        requirements?: { budget?: number; quantity?: number; timeline?: string; specifications?: string }
      }

      return NextResponse.json({
        message: `Before I start negotiating on your behalf, let me confirm I have this right:

**${toolInput.summary}**

${toolInput.requirements?.budget ? `• Budget: $${toolInput.requirements.budget.toLocaleString()}` : ''}
${toolInput.requirements?.quantity ? `• Quantity: ${toolInput.requirements.quantity} units` : ''}
${toolInput.requirements?.timeline ? `• Timeline: ${toolInput.requirements.timeline}` : ''}
${toolInput.requirements?.specifications ? `• Specs: ${toolInput.requirements.specifications}` : ''}

**Should I start negotiating with suppliers/candidates on your behalf?**

Reply "Yes, go ahead" to approve, or let me know what to change.`,
        negotiation: null,
        awaitingApproval: {
          type: toolInput.negotiationType,
          summary: toolInput.summary,
          requirements: toolInput.requirements,
        },
      })
    }

    // ========================================================================
    // SELLER TOOLS HANDLERS
    // ========================================================================

    // Handle seller tools by delegating to seller API routes
    if (toolUse && toolUse.type === 'tool_use' && toolUse.name.startsWith('seller_')) {
      const toolName = toolUse.name
      const toolInput = toolUse.input as Record<string, any>
      const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'
      const textBlock = response.content.find(block => block.type === 'text')
      const baseMessage = textBlock?.type === 'text' ? textBlock.text : ''

      try {
        let apiResult: any

        // Profile tools
        if (toolName === 'seller_get_profile') {
          const res = await fetch(`${baseUrl}/api/seller/profile`, {
            headers: { 'Cookie': request.headers.get('cookie') || '' }
          })
          apiResult = await res.json()
        } else if (toolName === 'seller_update_profile') {
          const res = await fetch(`${baseUrl}/api/seller/profile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': request.headers.get('cookie') || '' },
            body: JSON.stringify({ text: toolInput.text })
          })
          apiResult = await res.json()
        }
        // RFQ tools
        else if (toolName === 'seller_get_rfqs') {
          const status = toolInput.status ? `?status=${toolInput.status}` : ''
          const res = await fetch(`${baseUrl}/api/seller/rfq${status}`, {
            headers: { 'Cookie': request.headers.get('cookie') || '' }
          })
          apiResult = await res.json()
        } else if (toolName === 'seller_view_rfq') {
          const res = await fetch(`${baseUrl}/api/seller/rfq`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': request.headers.get('cookie') || '' },
            body: JSON.stringify({ action: 'view', matchId: toolInput.matchId })
          })
          apiResult = await res.json()
        } else if (toolName === 'seller_generate_quote') {
          const res = await fetch(`${baseUrl}/api/seller/rfq`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': request.headers.get('cookie') || '' },
            body: JSON.stringify({ action: 'generate_quote', matchId: toolInput.matchId })
          })
          apiResult = await res.json()
        } else if (toolName === 'seller_adjust_quote') {
          const res = await fetch(`${baseUrl}/api/seller/rfq`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': request.headers.get('cookie') || '' },
            body: JSON.stringify({ action: 'adjust_quote', draftId: toolInput.draftId, text: toolInput.text })
          })
          apiResult = await res.json()
        } else if (toolName === 'seller_submit_quote') {
          const res = await fetch(`${baseUrl}/api/seller/rfq`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': request.headers.get('cookie') || '' },
            body: JSON.stringify({ action: 'submit_quote', draftId: toolInput.draftId })
          })
          apiResult = await res.json()
        } else if (toolName === 'seller_decline_rfq') {
          const res = await fetch(`${baseUrl}/api/seller/rfq`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': request.headers.get('cookie') || '' },
            body: JSON.stringify({ action: 'decline', matchId: toolInput.matchId, reason: toolInput.reason })
          })
          apiResult = await res.json()
        }
        // Lead tools
        else if (toolName === 'seller_get_icps') {
          const res = await fetch(`${baseUrl}/api/seller/leads`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': request.headers.get('cookie') || '' },
            body: JSON.stringify({ action: 'get_icps' })
          })
          apiResult = await res.json()
        } else if (toolName === 'seller_create_icp') {
          const res = await fetch(`${baseUrl}/api/seller/leads`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': request.headers.get('cookie') || '' },
            body: JSON.stringify({ action: 'create_icp', text: toolInput.text })
          })
          apiResult = await res.json()
        } else if (toolName === 'seller_discover_leads') {
          const res = await fetch(`${baseUrl}/api/seller/leads`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': request.headers.get('cookie') || '' },
            body: JSON.stringify({ action: 'discover', icpId: toolInput.icpId, limit: toolInput.limit })
          })
          apiResult = await res.json()
        } else if (toolName === 'seller_get_leads') {
          const params = new URLSearchParams()
          if (toolInput.status) params.set('status', toolInput.status)
          if (toolInput.minScore) params.set('minScore', String(toolInput.minScore))
          const res = await fetch(`${baseUrl}/api/seller/leads?${params}`, {
            headers: { 'Cookie': request.headers.get('cookie') || '' }
          })
          apiResult = await res.json()
        } else if (toolName === 'seller_qualify_lead') {
          const res = await fetch(`${baseUrl}/api/seller/leads`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': request.headers.get('cookie') || '' },
            body: JSON.stringify({ action: toolInput.qualified ? 'qualify' : 'disqualify', leadId: toolInput.leadId })
          })
          apiResult = await res.json()
        }
        // Outreach tools
        else if (toolName === 'seller_generate_outreach') {
          const res = await fetch(`${baseUrl}/api/seller/outreach`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': request.headers.get('cookie') || '' },
            body: JSON.stringify({ action: 'generate', leadId: toolInput.leadId, channel: toolInput.channel, tone: toolInput.tone, focus: toolInput.focus })
          })
          apiResult = await res.json()
        } else if (toolName === 'seller_send_outreach') {
          const res = await fetch(`${baseUrl}/api/seller/outreach`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': request.headers.get('cookie') || '' },
            body: JSON.stringify({ action: 'send', outreachId: toolInput.outreachId })
          })
          apiResult = await res.json()
        } else if (toolName === 'seller_get_pending_outreach') {
          const res = await fetch(`${baseUrl}/api/seller/outreach?type=pending`, {
            headers: { 'Cookie': request.headers.get('cookie') || '' }
          })
          apiResult = await res.json()
        } else if (toolName === 'seller_send_all_pending') {
          const res = await fetch(`${baseUrl}/api/seller/outreach`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': request.headers.get('cookie') || '' },
            body: JSON.stringify({ action: 'send_all' })
          })
          apiResult = await res.json()
        }
        // Campaign tools
        else if (toolName === 'seller_get_campaigns') {
          const res = await fetch(`${baseUrl}/api/seller/outreach?type=campaigns`, {
            headers: { 'Cookie': request.headers.get('cookie') || '' }
          })
          apiResult = await res.json()
        } else if (toolName === 'seller_create_campaign') {
          const res = await fetch(`${baseUrl}/api/seller/outreach`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': request.headers.get('cookie') || '' },
            body: JSON.stringify({ action: 'create_campaign', data: { name: toolInput.name, icpId: toolInput.icpId, channel: toolInput.channel } })
          })
          apiResult = await res.json()
        } else if (toolName === 'seller_start_campaign') {
          const res = await fetch(`${baseUrl}/api/seller/outreach`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': request.headers.get('cookie') || '' },
            body: JSON.stringify({ action: 'start_campaign', campaignId: toolInput.campaignId })
          })
          apiResult = await res.json()
        } else if (toolName === 'seller_pause_campaign') {
          const res = await fetch(`${baseUrl}/api/seller/outreach`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': request.headers.get('cookie') || '' },
            body: JSON.stringify({ action: 'pause_campaign', campaignId: toolInput.campaignId })
          })
          apiResult = await res.json()
        }
        // Pipeline tools
        else if (toolName === 'seller_get_pipeline') {
          const type = toolInput.type || 'summary'
          const res = await fetch(`${baseUrl}/api/seller/pipeline?type=${type}`, {
            headers: { 'Cookie': request.headers.get('cookie') || '' }
          })
          apiResult = await res.json()
        } else if (toolName === 'seller_create_opportunity') {
          const res = await fetch(`${baseUrl}/api/seller/pipeline`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': request.headers.get('cookie') || '' },
            body: JSON.stringify({ action: 'create', text: toolInput.text })
          })
          apiResult = await res.json()
        } else if (toolName === 'seller_move_opportunity') {
          const res = await fetch(`${baseUrl}/api/seller/pipeline`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': request.headers.get('cookie') || '' },
            body: JSON.stringify({ action: 'move_stage', opportunityId: toolInput.opportunityId, stageId: toolInput.stageId })
          })
          apiResult = await res.json()
        } else if (toolName === 'seller_close_opportunity') {
          const res = await fetch(`${baseUrl}/api/seller/pipeline`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': request.headers.get('cookie') || '' },
            body: JSON.stringify({ action: toolInput.won ? 'close_won' : 'close_lost', opportunityId: toolInput.opportunityId, notes: toolInput.notes })
          })
          apiResult = await res.json()
        }

        return NextResponse.json({
          message: baseMessage || apiResult.message || 'Done.',
          data: apiResult,
        })
      } catch (error) {
        console.error('Seller tool error:', error)
        return NextResponse.json({
          message: baseMessage || `Error processing seller action: ${error instanceof Error ? error.message : 'Unknown error'}`,
          error: true,
        })
      }
    }

    // ========================================================================
    // BUYER ERP TOOLS HANDLERS
    // ========================================================================

    // Handle ERP tools by delegating to buyer ERP API route
    if (toolUse && toolUse.type === 'tool_use' && toolUse.name.startsWith('erp_')) {
      const toolName = toolUse.name
      const toolInput = toolUse.input as Record<string, any>
      const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'
      const textBlock = response.content.find(block => block.type === 'text')
      const baseMessage = textBlock?.type === 'text' ? textBlock.text : ''

      try {
        let apiResult: any

        if (toolName === 'erp_get_connections') {
          const res = await fetch(`${baseUrl}/api/buyer/erp?type=connections`, {
            headers: { 'Cookie': request.headers.get('cookie') || '' }
          })
          apiResult = await res.json()
        } else if (toolName === 'erp_connect') {
          const res = await fetch(`${baseUrl}/api/buyer/erp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': request.headers.get('cookie') || '' },
            body: JSON.stringify({ action: 'connect', erpType: toolInput.erpType })
          })
          apiResult = await res.json()
        } else if (toolName === 'erp_update_settings') {
          const res = await fetch(`${baseUrl}/api/buyer/erp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': request.headers.get('cookie') || '' },
            body: JSON.stringify({ action: 'update_settings', connectionId: toolInput.connectionId, text: toolInput.text })
          })
          apiResult = await res.json()
        } else if (toolName === 'erp_scan') {
          const res = await fetch(`${baseUrl}/api/buyer/erp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': request.headers.get('cookie') || '' },
            body: JSON.stringify({ action: 'scan', connectionId: toolInput.connectionId })
          })
          apiResult = await res.json()
        } else if (toolName === 'erp_get_opportunities') {
          const params = new URLSearchParams()
          if (toolInput.status) params.set('status', toolInput.status)
          if (toolInput.priority) params.set('priority', toolInput.priority)
          const res = await fetch(`${baseUrl}/api/buyer/erp?${params}`, {
            headers: { 'Cookie': request.headers.get('cookie') || '' }
          })
          apiResult = await res.json()
        } else if (toolName === 'erp_create_rfq_from_opportunity') {
          const res = await fetch(`${baseUrl}/api/buyer/erp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': request.headers.get('cookie') || '' },
            body: JSON.stringify({ action: 'create_rfq', opportunityId: toolInput.opportunityId })
          })
          apiResult = await res.json()
        } else if (toolName === 'erp_dismiss_opportunity') {
          const res = await fetch(`${baseUrl}/api/buyer/erp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': request.headers.get('cookie') || '' },
            body: JSON.stringify({ action: 'dismiss', opportunityId: toolInput.opportunityId, reason: toolInput.reason })
          })
          apiResult = await res.json()
        } else if (toolName === 'erp_remind_later') {
          const res = await fetch(`${baseUrl}/api/buyer/erp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': request.headers.get('cookie') || '' },
            body: JSON.stringify({ action: 'remind_later', opportunityId: toolInput.opportunityId, remindAt: toolInput.remindInDays ? new Date(Date.now() + toolInput.remindInDays * 24 * 60 * 60 * 1000).toISOString() : undefined })
          })
          apiResult = await res.json()
        }

        return NextResponse.json({
          message: baseMessage || apiResult.message || 'Done.',
          data: apiResult,
        })
      } catch (error) {
        console.error('ERP tool error:', error)
        return NextResponse.json({
          message: baseMessage || `Error processing ERP action: ${error instanceof Error ? error.message : 'Unknown error'}`,
          error: true,
        })
      }
    }

    // ========================================================================
    // JOBS/WORKER TOOLS HANDLERS
    // ========================================================================

    // Handle worker tools by delegating to worker API routes
    if (toolUse && toolUse.type === 'tool_use' && toolUse.name.startsWith('worker_')) {
      const toolName = toolUse.name
      const toolInput = toolUse.input as Record<string, any>
      const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'
      const textBlock = response.content.find(block => block.type === 'text')
      const baseMessage = textBlock?.type === 'text' ? textBlock.text : ''

      try {
        let apiResult: any

        // Profile tools
        if (toolName === 'worker_get_profile') {
          const res = await fetch(`${baseUrl}/api/worker/profile`, {
            headers: { 'Cookie': request.headers.get('cookie') || '' }
          })
          apiResult = await res.json()
        } else if (toolName === 'worker_update_profile') {
          const res = await fetch(`${baseUrl}/api/worker/profile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': request.headers.get('cookie') || '' },
            body: JSON.stringify({ action: 'update', text: toolInput.text })
          })
          apiResult = await res.json()
        } else if (toolName === 'worker_add_skills') {
          const res = await fetch(`${baseUrl}/api/worker/profile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': request.headers.get('cookie') || '' },
            body: JSON.stringify({ action: 'add_skills', text: toolInput.text })
          })
          apiResult = await res.json()
        }
        // Task discovery tools
        else if (toolName === 'worker_find_tasks') {
          const params = new URLSearchParams()
          if (toolInput.skills) params.set('skills', toolInput.skills.join(','))
          if (toolInput.minPay) params.set('minPay', String(toolInput.minPay))
          if (toolInput.maxDeadline) params.set('maxDeadline', toolInput.maxDeadline)
          if (toolInput.category) params.set('category', toolInput.category)
          if (toolInput.limit) params.set('limit', String(toolInput.limit))
          const res = await fetch(`${baseUrl}/api/worker/tasks?${params}`, {
            headers: { 'Cookie': request.headers.get('cookie') || '' }
          })
          apiResult = await res.json()
        } else if (toolName === 'worker_view_task') {
          const res = await fetch(`${baseUrl}/api/worker/tasks/${toolInput.taskId}`, {
            headers: { 'Cookie': request.headers.get('cookie') || '' }
          })
          apiResult = await res.json()
        } else if (toolName === 'worker_get_opportunities') {
          const type = toolInput.type || 'recommended'
          const res = await fetch(`${baseUrl}/api/worker/tasks?type=${type}`, {
            headers: { 'Cookie': request.headers.get('cookie') || '' }
          })
          apiResult = await res.json()
        }
        // Task application tools
        else if (toolName === 'worker_apply') {
          const res = await fetch(`${baseUrl}/api/worker/tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': request.headers.get('cookie') || '' },
            body: JSON.stringify({
              action: 'apply',
              taskId: toolInput.taskId,
              pitch: toolInput.pitch,
              proposedRate: toolInput.proposedRate
            })
          })
          apiResult = await res.json()
        } else if (toolName === 'worker_accept_task') {
          const res = await fetch(`${baseUrl}/api/worker/tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': request.headers.get('cookie') || '' },
            body: JSON.stringify({ action: 'accept', taskId: toolInput.taskId })
          })
          apiResult = await res.json()
        } else if (toolName === 'worker_decline_task') {
          const res = await fetch(`${baseUrl}/api/worker/tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': request.headers.get('cookie') || '' },
            body: JSON.stringify({ action: 'decline', taskId: toolInput.taskId, reason: toolInput.reason })
          })
          apiResult = await res.json()
        }
        // Task completion tools
        else if (toolName === 'worker_get_active_tasks') {
          const status = toolInput.status || 'all'
          const res = await fetch(`${baseUrl}/api/worker/tasks?active=true&status=${status}`, {
            headers: { 'Cookie': request.headers.get('cookie') || '' }
          })
          apiResult = await res.json()
        } else if (toolName === 'worker_submit_work') {
          const res = await fetch(`${baseUrl}/api/worker/tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': request.headers.get('cookie') || '' },
            body: JSON.stringify({
              action: 'submit_work',
              taskId: toolInput.taskId,
              deliverables: toolInput.deliverables,
              notes: toolInput.notes
            })
          })
          apiResult = await res.json()
        } else if (toolName === 'worker_request_payment') {
          const res = await fetch(`${baseUrl}/api/worker/tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': request.headers.get('cookie') || '' },
            body: JSON.stringify({ action: 'request_payment', taskId: toolInput.taskId })
          })
          apiResult = await res.json()
        }
        // Earnings tools
        else if (toolName === 'worker_get_earnings') {
          const params = new URLSearchParams()
          if (toolInput.period) params.set('period', toolInput.period)
          if (toolInput.includeHistory) params.set('includeHistory', 'true')
          const res = await fetch(`${baseUrl}/api/worker/earnings?${params}`, {
            headers: { 'Cookie': request.headers.get('cookie') || '' }
          })
          apiResult = await res.json()
        } else if (toolName === 'worker_withdraw') {
          const res = await fetch(`${baseUrl}/api/worker/earnings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': request.headers.get('cookie') || '' },
            body: JSON.stringify({
              action: 'withdraw',
              amount: toolInput.amount,
              method: toolInput.method || 'bank'
            })
          })
          apiResult = await res.json()
        }
        // Attribution tools
        else if (toolName === 'worker_get_attribution') {
          const period = toolInput.period || 'month'
          const res = await fetch(`${baseUrl}/api/worker/attribution?period=${period}`, {
            headers: { 'Cookie': request.headers.get('cookie') || '' }
          })
          apiResult = await res.json()
        } else if (toolName === 'worker_create_referral') {
          const res = await fetch(`${baseUrl}/api/worker/attribution`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': request.headers.get('cookie') || '' },
            body: JSON.stringify({
              action: 'create_referral',
              type: toolInput.type,
              name: toolInput.name
            })
          })
          apiResult = await res.json()
        } else if (toolName === 'worker_view_attribution_tree') {
          const depth = toolInput.depth || 3
          const res = await fetch(`${baseUrl}/api/worker/attribution?view=tree&depth=${depth}`, {
            headers: { 'Cookie': request.headers.get('cookie') || '' }
          })
          apiResult = await res.json()
        }

        return NextResponse.json({
          message: baseMessage || apiResult.message || 'Done.',
          data: apiResult,
        })
      } catch (error) {
        console.error('Worker tool error:', error)
        return NextResponse.json({
          message: baseMessage || `Error processing worker action: ${error instanceof Error ? error.message : 'Unknown error'}`,
          error: true,
        })
      }
    }


    // No tool use - just return the text response
    const textBlock = response.content.find(block => block.type === 'text')
    const assistantMessage = textBlock?.type === 'text' ? textBlock.text : ''

    return NextResponse.json({
      message: assistantMessage,
      negotiation: null,
    })
  } catch (error) {
    console.error('Chat error:', error)

    // Handle specific Anthropic errors
    if (error instanceof Anthropic.APIError) {
      if (error.status === 401) {
        return NextResponse.json(
          { error: 'AI service not configured' },
          { status: 503 }
        )
      }
      if (error.status === 429) {
        return NextResponse.json(
          { error: 'Too many requests. Please try again in a moment.' },
          { status: 429 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 500 }
    )
  }
}

// ============================================================================
// GET - Health check
// ============================================================================

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'Wells AI Chat',
    journeys: ['founder', 'buyer', 'seller', 'jobs'],
  }, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    },
  })
}

// ============================================================================
// OPTIONS - CORS preflight handler
// ============================================================================

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  })
}
