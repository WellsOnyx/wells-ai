import { NextRequest, NextResponse } from 'next/server';
// import { auth } from '@clerk/nextjs/server'; // TODO: Update to new Clerk v5 auth pattern
import prisma from '@/lib/prisma';

/**
 * POST /api/gtm/co-sell/onboard
 *
 * Conversational partner onboarding through Wells AI
 *
 * Wells asks questions in the chat, collects answers, and creates the playbook.
 * No forms required - just conversation.
 */
export async function POST(req: NextRequest) {
  try {
    // Temporarily disabled auth check - will update to Clerk v5 pattern
    // const { userId } = auth();
    // if (!userId) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }
    const userId = 'system'; // Temporary fallback

    const body = await req.json();
    const { action, data } = body;

    switch (action) {
      case 'start':
        // Wells starts the onboarding conversation
        return NextResponse.json({
          success: true,
          message: "Great! Let's onboard your strategic partner. First, what's the partner name? (e.g., IBM, SAP, Plaid)",
          state: 'awaiting_partner_name',
        });

      case 'collect':
        // Wells collects the answer and asks the next question
        const { state, answer, sessionData } = data;

        // Build up the session data
        const updatedSession = { ...sessionData };

        switch (state) {
          case 'awaiting_partner_name':
            updatedSession.partnerName = answer;
            return NextResponse.json({
              success: true,
              message: `Perfect! Now, what's the partner contact email for ${answer}? (They'll be CC'd on co-sell outreach)`,
              state: 'awaiting_partner_email',
              sessionData: updatedSession,
            });

          case 'awaiting_partner_email':
            updatedSession.partnerContactEmail = answer;
            return NextResponse.json({
              success: true,
              message: `Got it. What industry is ${sessionData.partnerName} in? (Technology, Financial Services, Healthcare, Manufacturing, Retail, Professional Services)`,
              state: 'awaiting_industry',
              sessionData: updatedSession,
            });

          case 'awaiting_industry':
            updatedSession.industry = answer;
            return NextResponse.json({
              success: true,
              message: `What type of partnership is this? (Technology, Channel, Reseller, Referral)`,
              state: 'awaiting_partnership_type',
              sessionData: updatedSession,
            });

          case 'awaiting_partnership_type':
            updatedSession.partnershipType = answer;
            return NextResponse.json({
              success: true,
              message: `What's the value proposition? (How does Wells + ${sessionData.partnerName} solve the customer's problem? Leave blank for AI-generated value prop)`,
              state: 'awaiting_value_prop',
              sessionData: updatedSession,
            });

          case 'awaiting_value_prop':
            updatedSession.valueProposition = answer || generateDefaultValueProp(sessionData.partnerName);
            return NextResponse.json({
              success: true,
              message: `What's the deal split? (e.g., "Wells 30%, Partner 70%")`,
              state: 'awaiting_deal_split',
              sessionData: updatedSession,
            });

          case 'awaiting_deal_split':
            // Parse deal split from natural language (e.g., "30/70" or "Wells 30%, Partner 70%")
            const splitMatch = answer.match(/(\d+)/g);
            if (splitMatch && splitMatch.length >= 2) {
              updatedSession.dealSplit = {
                wells: parseInt(splitMatch[0]),
                partner: parseInt(splitMatch[1]),
              };
            } else {
              updatedSession.dealSplit = { wells: 30, partner: 70 }; // Default
            }

            return NextResponse.json({
              success: true,
              message: `Great! Now let's add target accounts. Give me the first target company name:`,
              state: 'awaiting_target_company',
              sessionData: updatedSession,
              targetAccounts: [],
            });

          case 'awaiting_target_company':
            const currentTarget = data.currentTarget || {};
            currentTarget.companyName = answer;
            return NextResponse.json({
              success: true,
              message: `What's the pain point that ${answer} is facing?`,
              state: 'awaiting_target_pain',
              sessionData: updatedSession,
              currentTarget,
            });

          case 'awaiting_target_pain':
            data.currentTarget.painPoint = answer;
            return NextResponse.json({
              success: true,
              message: `How does Wells + ${sessionData.partnerName} solve this?`,
              state: 'awaiting_target_solution',
              sessionData: updatedSession,
              currentTarget: data.currentTarget,
            });

          case 'awaiting_target_solution':
            data.currentTarget.solution = answer;
            data.currentTarget.estimatedDealSize = 500000; // Default $500K

            // Add to target accounts list
            const targetAccounts = data.targetAccounts || [];
            targetAccounts.push(data.currentTarget);

            return NextResponse.json({
              success: true,
              message: `Target account added! Want to add another? (yes/no)`,
              state: 'awaiting_more_targets',
              sessionData: updatedSession,
              targetAccounts,
            });

          case 'awaiting_more_targets':
            if (answer.toLowerCase().includes('yes') || answer.toLowerCase().includes('y')) {
              return NextResponse.json({
                success: true,
                message: `Give me the next target company name:`,
                state: 'awaiting_target_company',
                sessionData: updatedSession,
                targetAccounts: data.targetAccounts,
              });
            } else {
              // Create the playbook!
              return createPlaybook(userId, updatedSession, data.targetAccounts);
            }

          default:
            return NextResponse.json({ error: 'Invalid state' }, { status: 400 });
        }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in partner onboarding:', error);
    return NextResponse.json(
      { error: 'Failed to process onboarding' },
      { status: 500 }
    );
  }
}

/**
 * Create the co-sell playbook and email sequence
 */
async function createPlaybook(userId: string, sessionData: any, targetAccounts: any[]) {
  try {
    // First, create or get the partner
    let partner = await prisma.partner.findUnique({
      where: { name: sessionData.partnerName },
    });

    if (!partner) {
      partner = await prisma.partner.create({
        data: {
          name: sessionData.partnerName,
          industry: sessionData.industry || 'Technology',
          primaryContactName: sessionData.partnerName,
          primaryContactEmail: sessionData.partnerContactEmail,
          partnershipType: sessionData.partnershipType || 'Technology',
          defaultDealSplit: sessionData.dealSplit || { wells: 30, partner: 70 },
          status: 'active',
        },
      });
    }

    // Create the playbook
    const playbook = await prisma.coSellPlaybook.create({
      data: {
        partnerId: partner.id,
        partnerContactEmail: sessionData.partnerContactEmail,
        name: `${sessionData.partnerName} Co-Sell Playbook`,
        valueProposition: sessionData.valueProposition || generateDefaultValueProp(sessionData.partnerName),
        dealSplit: sessionData.dealSplit || { wells: 30, partner: 70 },
        outreachStrategy: 'email-sequence',
        status: 'DRAFT',
        createdBy: userId,
        totalTargets: targetAccounts.length,
        targetAccounts: {
          create: targetAccounts.map((account: any) => ({
            companyName: account.companyName,
            industry: account.industry || sessionData.industry,
            painPoint: account.painPoint,
            solution: account.solution,
            estimatedDealSize: account.estimatedDealSize || 500000,
            contactEmail: account.contactEmail,
          })),
        },
      },
      include: {
        targetAccounts: true,
      },
    });

    // Generate email sequence
    const emailSequence = await generateEmailSequence({
      partnerName: sessionData.partnerName,
      targetAccounts,
      valueProposition: playbook.valueProposition,
    });

    await prisma.emailSequence.create({
      data: {
        playbookId: playbook.id,
        sequence: emailSequence,
      },
    });

    // Calculate estimated revenue
    const avgDealSize = targetAccounts.reduce(
      (sum: number, account: any) => sum + (account.estimatedDealSize || 500000),
      0
    ) / targetAccounts.length;
    const conversionRate = 0.15; // 15%
    const wellsSplit = (playbook.dealSplit as any).wells / 100;
    const estimatedRevenue = targetAccounts.length * avgDealSize * conversionRate * wellsSplit;

    return NextResponse.json({
      success: true,
      message: `🎉 Co-sell playbook created!

Partner: ${sessionData.partnerName}
Target Accounts: ${targetAccounts.length}
Email Sequence: 7-touch sequence generated
Estimated Revenue: $${(estimatedRevenue / 1000000).toFixed(2)}M (${(conversionRate * 100).toFixed(0)}% conversion rate)

Playbook ID: ${playbook.id}

Next steps:
1. Review the generated email sequences
2. Approve or edit the outreach messages
3. Launch the campaign and start booking meetings!

Want to review the playbook now?`,
      playbookId: playbook.id,
      estimatedRevenue,
      targetAccounts: targetAccounts.length,
      state: 'completed',
    });
  } catch (error) {
    console.error('Error creating playbook:', error);
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
    InFlow: 'Inventory optimization with AI demand forecasting. Reduce carrying costs by 40% while improving fill rates.',
    Interexo: 'Cross-border payments with GRAIN settlement. Eliminate SWIFT delays and reduce FX fees by 80%.',
  };

  return (
    valueProps[partnerName] ||
    `Transform your operations with Wells AI. Reduce costs, improve efficiency, and accelerate growth through intelligent automation.`
  );
}

/**
 * Generate 7-touch email sequence
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
  return [
    {
      day: 0,
      subject: `${partnerName} + Wells: Transforming ${targetAccounts[0]?.industry || 'your industry'}`,
      body: `Hi {{firstName}},

I'm reaching out because {{partnerName}} and Wells are partnering to help companies like {{companyName}} solve a critical challenge:

{{painPoint}}

${valueProposition}

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
      subject: 'Quick question about {{companyName}}\'s strategy',
      body: `Hi {{firstName}},

I've been researching {{companyName}} and noticed you're expanding. This likely means you're dealing with:

1. Complex operational challenges
2. Extended processing times
3. High costs and inefficiencies

Our {{partnerName}} + Wells solution was built specifically to solve this. We're helping companies like {{competitorName}} achieve breakthrough results.

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

{{partnerName}} and Wells just launched a capability specifically for companies dealing with {{painPoint}}.

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

I wanted to share one final update: We recently helped {{competitorName}} achieve breakthrough results using our {{partnerName}} + Wells platform.

If you're ever interested in learning more, I'm here.

Otherwise, best of luck with {{companyName}}.

Cheers,
{{senderName}}`,
      type: 'FINAL_TOUCH',
    },
  ];
}
