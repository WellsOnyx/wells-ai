import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs';
import prisma from '@/lib/prisma';

/**
 * POST /api/gtm/co-sell/create
 *
 * Create a new co-sell playbook for a strategic partner
 *
 * This is the engine that powers Wells' 33-partner ecosystem.
 * Each playbook defines target accounts, value props, and automated outreach.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      partnerName,
      partnerContactEmail,
      targetAccounts,
      valueProposition,
      dealSplit,
      outreachStrategy,
    } = body;

    // Validation
    if (!partnerName || !partnerContactEmail) {
      return NextResponse.json(
        { error: 'Partner name and contact email required' },
        { status: 400 }
      );
    }

    if (!targetAccounts || targetAccounts.length === 0) {
      return NextResponse.json(
        { error: 'At least one target account required' },
        { status: 400 }
      );
    }

    // Create co-sell playbook
    const playbook = await prisma.coSellPlaybook.create({
      data: {
        partnerName,
        partnerContactEmail,
        valueProposition: valueProposition || generateDefaultValueProp(partnerName),
        dealSplit: dealSplit || { wells: 30, partner: 70 }, // Default split
        outreachStrategy: outreachStrategy || 'email-sequence',
        status: 'DRAFT',
        createdBy: userId,
        targetAccounts: {
          create: targetAccounts.map((account: any) => ({
            companyName: account.companyName,
            industry: account.industry,
            revenue: account.revenue,
            painPoint: account.painPoint,
            solution: account.solution,
            estimatedDealSize: account.estimatedDealSize || 500000,
            contactName: account.contactName,
            contactEmail: account.contactEmail,
            contactTitle: account.contactTitle,
          })),
        },
      },
      include: {
        targetAccounts: true,
      },
    });

    // Generate automated outreach sequence
    const emailSequence = await generateEmailSequence({
      partnerName,
      targetAccounts,
      valueProposition: playbook.valueProposition,
    });

    // Store email sequence
    await prisma.emailSequence.create({
      data: {
        playbookId: playbook.id,
        sequence: emailSequence,
      },
    });

    return NextResponse.json({
      success: true,
      playbook: {
        id: playbook.id,
        partnerName: playbook.partnerName,
        targetAccounts: playbook.targetAccounts.length,
        emailSequence: emailSequence.length,
        estimatedRevenue: calculateEstimatedRevenue(playbook),
      },
    });
  } catch (error) {
    console.error('Error creating co-sell playbook:', error);
    return NextResponse.json(
      { error: 'Failed to create playbook' },
      { status: 500 }
    );
  }
}

/**
 * Generate default value proposition based on partner
 */
function generateDefaultValueProp(partnerName: string): string {
  const valueProps: Record<string, string> = {
    IBM: 'Modernize mainframe infrastructure with AI-powered operations automation. Reduce operational costs by 70% while maintaining enterprise reliability.',
    SAP: 'Streamline B2B payments with instant GRAIN settlement. Convert 3-10 day payment cycles to sub-second settlements, improving cash flow by 90%.',
    Plaid: 'Enable instant ACH with Wells AI verification. Eliminate fraud, reduce chargebacks, and provide real-time payment confirmation.',
    Salesforce: 'AI-powered pipeline generation with automated outreach. 10x your SDR productivity with conversational AI that books meetings while you sleep.',
    Stripe: 'B2B payment optimization with GRAIN settlement layer. Reduce payment processing fees from 2.9% to 0.33% while settling instantly.',
    AvePoint: 'Microsoft 365 optimization with AI-powered governance. Automate compliance, reduce storage costs, and improve collaboration security.',
    BigCommerce: 'Wholesale B2B commerce with AI-assisted procurement. Enable suppliers to transact seamlessly with automated RFQ processing.',
    Coupa: 'Procurement transformation with GRAIN instant settlement. Convert 30-90 day payment terms to same-day settlement, unlocking supplier discounts.',
  };

  return (
    valueProps[partnerName] ||
    `Transform your operations with Wells AI. Reduce costs, improve efficiency, and accelerate growth through intelligent automation.`
  );
}

/**
 * Generate 7-touch email sequence for target accounts
 */
async function generateEmailSequence({
  partnerName,
  targetAccounts,
  valueProposition,
}: {
  partnerName: string;
  targetAccounts: any[];
  valueProposition: string;
}) {
  // This will be enhanced with AI-generated personalized emails
  // For now, return template sequence

  const sequence = [
    {
      day: 0,
      subject: `${partnerName} + Wells: Transforming ${targetAccounts[0]?.industry || 'your industry'}`,
      body: `Hi {{firstName}},

I'm reaching out because {{partnerName}} and Wells are partnering to help companies like {{companyName}} solve a critical challenge:

{{painPoint}}

{{valueProposition}}

Quick question: Would a 15-minute call this week make sense to explore how we can help?

Best,
{{senderName}}`,
      type: 'INTRO',
    },
    {
      day: 3,
      subject: 'Following up: {{companyName}} + {{partnerName}} + Wells',
      body: `Hi {{firstName}},

Following up on my email from Monday. I know your inbox is likely flooded, so I'll keep this short.

{{partnerName}} and Wells have helped companies like {{competitorName}} achieve:
- 70% reduction in operational costs
- 10x faster time-to-value
- 99.9% uptime with AI-powered monitoring

Worth a quick call to see if we can do the same for {{companyName}}?

Calendar link: {{calendarLink}}

Best,
{{senderName}}`,
      type: 'FOLLOW_UP_1',
    },
    {
      day: 7,
      subject: 'Case study: How {{competitorName}} saved $5M with {{partnerName}} + Wells',
      body: `Hi {{firstName}},

I wanted to share a recent case study that's relevant to {{companyName}}:

{{competitorName}} was facing {{painPoint}}. By implementing our {{partnerName}} + Wells solution, they achieved:

✅ $5M in annual cost savings
✅ 5x faster processing time
✅ 90% reduction in manual errors

Full case study attached. Would love to discuss how we can deliver similar results for {{companyName}}.

Available for a quick call this week?

Best,
{{senderName}}`,
      type: 'VALUE_PROOF',
    },
    {
      day: 10,
      subject: 'Quick question about {{companyName}}\'s {{painArea}} strategy',
      body: `Hi {{firstName}},

I've been researching {{companyName}} and noticed you're expanding in {{geography}}. This likely means you're dealing with:

1. Complex cross-border payments
2. Extended settlement times (7-10 days)
3. High transaction fees (2-5%)

Our {{partnerName}} + Wells solution was built specifically to solve this. We're helping companies like {{competitorName}} settle cross-border payments in < 1 second at 0.33% fees.

Worth exploring for {{companyName}}?

Best,
{{senderName}}`,
      type: 'PERSONALIZED_INSIGHT',
    },
    {
      day: 14,
      subject: 'Breaking up: Last email about {{partnerName}} + Wells',
      body: `Hi {{firstName}},

I know I've reached out a few times without hearing back. I'll take that as a signal this isn't a priority right now, and I'll stop reaching out.

But before I do, I wanted to leave you with this thought:

{{competitorName}} was skeptical too. They took a 15-minute call, ran a pilot, and are now processing $50M/month through our platform.

If you ever want to explore what this could look like for {{companyName}}, you know where to find me.

Best of luck,
{{senderName}}

P.S. If timing just isn't right, no worries. Feel free to reach out when it makes sense.`,
      type: 'BREAKUP',
    },
    {
      day: 30,
      subject: 'Resurface: New {{partnerName}} + Wells capability you should see',
      body: `Hi {{firstName}},

I know we haven't connected yet, but I wanted to resurface with something new:

{{partnerName}} and Wells just launched a capability specifically for {{industry}} companies dealing with {{painPoint}}.

Early adopters are seeing:
- 80% faster processing
- 60% cost reduction
- 99.9% accuracy with AI validation

5-minute demo available if you're curious: {{calendarLink}}

Best,
{{senderName}}`,
      type: 'RESURFACE',
    },
    {
      day: 60,
      subject: 'Final touch: {{companyName}} + {{partnerName}} + Wells',
      body: `Hi {{firstName}},

This will be my last email (promise!).

I wanted to share one final update: We recently helped {{competitorName}} achieve {{specificResult}} using our {{partnerName}} + Wells platform.

If you're ever interested in learning more, I'm here.

Otherwise, best of luck with {{companyName}}'s {{initiative}}.

Cheers,
{{senderName}}`,
      type: 'FINAL_TOUCH',
    },
  ];

  return sequence;
}

/**
 * Calculate estimated revenue from playbook
 */
function calculateEstimatedRevenue(playbook: any): number {
  const targetAccounts = playbook.targetAccounts || [];
  const avgDealSize = targetAccounts.reduce(
    (sum: number, account: any) => sum + (account.estimatedDealSize || 500000),
    0
  ) / (targetAccounts.length || 1);

  const conversionRate = 0.15; // 15% of target accounts close
  const wellsSplit = (playbook.dealSplit?.wells || 30) / 100;

  return targetAccounts.length * avgDealSize * conversionRate * wellsSplit;
}
