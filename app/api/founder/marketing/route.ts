/**
 * Founder Marketing API
 * GET: Get content, campaigns, ad spend
 * POST: Generate copy, manage campaigns, track spend, set budgets
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  MarketingService,
  ContentType,
  AdPlatform,
  CampaignObjective,
  ContentStatus,
  CampaignStatus,
} from '@/lib/founder/marketing-service';

export const dynamic = 'force-dynamic';

// Parse marketing request from natural language
function parseMarketingFromText(text: string): {
  contentType?: ContentType;
  platform?: AdPlatform;
  objective?: CampaignObjective;
  budget?: number;
  budgetType?: 'daily' | 'lifetime';
  product?: string;
  targetAudience?: string;
  tone?: string;
} {
  const lower = text.toLowerCase();
  const result: ReturnType<typeof parseMarketingFromText> = {};

  // Parse content type
  if (lower.includes('landing page')) result.contentType = 'landing_page';
  else if (lower.includes('email')) result.contentType = 'email';
  else if (lower.includes('social') || lower.includes('post')) result.contentType = 'social_post';
  else if (lower.includes('ad copy') || lower.includes('ad ')) result.contentType = 'ad_copy';
  else if (lower.includes('blog')) result.contentType = 'blog';
  else if (lower.includes('press release')) result.contentType = 'press_release';
  else if (lower.includes('product description')) result.contentType = 'product_description';
  else if (lower.includes('tagline')) result.contentType = 'tagline';
  else if (lower.includes('headline')) result.contentType = 'headline';

  // Parse platform
  if (lower.includes('google')) result.platform = 'google';
  else if (lower.includes('meta') || lower.includes('facebook') || lower.includes('instagram')) result.platform = 'meta';
  else if (lower.includes('linkedin')) result.platform = 'linkedin';
  else if (lower.includes('twitter') || lower.includes(' x ')) result.platform = 'twitter';
  else if (lower.includes('tiktok')) result.platform = 'tiktok';
  else if (lower.includes('reddit')) result.platform = 'reddit';

  // Parse objective
  if (lower.includes('awareness') || lower.includes('brand')) result.objective = 'awareness';
  else if (lower.includes('traffic') || lower.includes('clicks')) result.objective = 'traffic';
  else if (lower.includes('engagement') || lower.includes('likes')) result.objective = 'engagement';
  else if (lower.includes('leads') || lower.includes('signups')) result.objective = 'leads';
  else if (lower.includes('conversion')) result.objective = 'conversions';
  else if (lower.includes('sales') || lower.includes('purchase')) result.objective = 'sales';

  // Parse budget
  const budgetMatch = text.match(/\$?([\d,]+)(?:k|K)?/);
  if (budgetMatch) {
    let amount = parseFloat(budgetMatch[1].replace(/,/g, ''));
    if (lower.includes('k') && amount < 1000) amount *= 1000;
    result.budget = amount;
  }

  // Parse budget type
  if (lower.includes('/day') || lower.includes('per day') || lower.includes('daily')) {
    result.budgetType = 'daily';
  } else if (lower.includes('total') || lower.includes('lifetime')) {
    result.budgetType = 'lifetime';
  }

  // Parse tone
  if (lower.includes('professional')) result.tone = 'professional';
  else if (lower.includes('casual')) result.tone = 'casual';
  else if (lower.includes('playful') || lower.includes('fun')) result.tone = 'playful';
  else if (lower.includes('urgent')) result.tone = 'urgent';
  else if (lower.includes('inspirational') || lower.includes('inspiring')) result.tone = 'inspirational';

  return result;
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const view = searchParams.get('view') || 'content';
    const limit = parseInt(searchParams.get('limit') || '50');

    switch (view) {
      case 'content': {
        const type = searchParams.get('type') as ContentType | null;
        const status = searchParams.get('status') as ContentStatus | null;

        const filters: { type?: ContentType; status?: ContentStatus; limit: number } = { limit };
        if (type) filters.type = type;
        if (status) filters.status = status;

        const result = await MarketingService.getContent(userId, filters);
        return NextResponse.json({
          success: true,
          content: result.content,
          message: result.message,
        });
      }

      case 'campaigns': {
        const platform = searchParams.get('platform') as AdPlatform | null;
        const status = searchParams.get('status') as CampaignStatus | null;
        const objective = searchParams.get('objective') as CampaignObjective | null;

        const filters: { platform?: AdPlatform; status?: CampaignStatus; objective?: CampaignObjective; limit: number } = { limit };
        if (platform) filters.platform = platform;
        if (status) filters.status = status;
        if (objective) filters.objective = objective;

        const result = await MarketingService.getCampaigns(userId, filters);
        return NextResponse.json({
          success: true,
          campaigns: result.campaigns,
          message: result.message,
        });
      }

      case 'campaign': {
        const campaignId = searchParams.get('campaignId');
        if (!campaignId) {
          return NextResponse.json({
            success: false,
            message: "Which campaign? I need the campaign ID.",
          });
        }

        const result = await MarketingService.getCampaign(campaignId);
        return NextResponse.json({
          success: true,
          campaign: result.campaign,
          message: result.message,
        });
      }

      case 'spend': {
        const platform = searchParams.get('platform') as AdPlatform | null;
        const campaignId = searchParams.get('campaignId');
        const startDate = searchParams.get('start');
        const endDate = searchParams.get('end');

        const filters: any = { limit };
        if (platform) filters.platform = platform;
        if (campaignId) filters.campaignId = campaignId;
        if (startDate) filters.startDate = new Date(startDate);
        if (endDate) filters.endDate = new Date(endDate);

        const result = await MarketingService.getAdSpend(userId, filters);
        return NextResponse.json({
          success: true,
          spend: result.spend,
          total: result.total,
          message: result.message,
        });
      }

      case 'spend_by_platform': {
        const startDate = searchParams.get('start');
        const endDate = searchParams.get('end');
        const now = new Date();
        const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const result = await MarketingService.getSpendByPlatform(userId, {
          start: startDate ? new Date(startDate) : defaultStart,
          end: endDate ? new Date(endDate) : defaultEnd,
        });
        return NextResponse.json({
          success: true,
          breakdown: result.breakdown,
          total: result.total,
          message: result.message,
        });
      }

      case 'performance': {
        const campaignId = searchParams.get('campaignId');
        if (!campaignId) {
          return NextResponse.json({
            success: false,
            message: "Which campaign? I need the campaign ID to show performance.",
          });
        }

        const result = await MarketingService.getCampaignPerformance(campaignId);
        return NextResponse.json({
          success: true,
          performance: result.performance,
          insights: result.insights,
          message: result.message,
        });
      }

      case 'roi': {
        const startDate = searchParams.get('start');
        const endDate = searchParams.get('end');
        const now = new Date();
        const defaultStart = new Date(now.getFullYear(), now.getMonth() - 3, 1);

        const result = await MarketingService.getMarketingROI(userId, {
          start: startDate ? new Date(startDate) : defaultStart,
          end: endDate ? new Date(endDate) : now,
        });
        return NextResponse.json({
          success: true,
          totalSpend: result.totalSpend,
          totalRevenue: result.totalRevenue,
          roi: result.roi,
          roas: result.roas,
          message: result.message,
        });
      }

      case 'budget': {
        const period = searchParams.get('period') || new Date().toISOString().slice(0, 7);
        const result = await MarketingService.getMarketingBudget(userId, period);
        return NextResponse.json({
          success: true,
          budget: result.budget,
          message: result.message,
        });
      }

      case 'budget_utilization': {
        const period = searchParams.get('period') || new Date().toISOString().slice(0, 7);
        const result = await MarketingService.getBudgetUtilization(userId, period);
        return NextResponse.json({
          success: true,
          budget: result.budget,
          spent: result.spent,
          remaining: result.remaining,
          percentUsed: result.percentUsed,
          byPlatform: result.byPlatform,
          message: result.message,
        });
      }

      case 'benchmarks': {
        const platform = searchParams.get('platform') as AdPlatform || 'google';
        const result = await MarketingService.getBenchmarks(userId, platform);
        return NextResponse.json({
          success: true,
          yourMetrics: result.yourMetrics,
          benchmarks: result.benchmarks,
          comparison: result.comparison,
          message: result.message,
        });
      }

      default:
        return NextResponse.json({
          success: false,
          message: "What would you like to see? Options: content, campaigns, spend, spend_by_platform, performance, roi, budget, benchmarks.",
        });
    }
  } catch (error: any) {
    console.error('Error in marketing GET:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch marketing data' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, text, data } = body;

    // Parse from natural language if provided
    let parsedData = data || {};
    if (text) {
      const parsed = parseMarketingFromText(text);
      parsedData = { ...parsed, ...parsedData };
    }

    switch (action) {
      case 'generate_copy': {
        let contentType = parsedData.contentType || parsedData.type;

        if (!contentType) {
          // Try AI parsing
          const parseResult = await MarketingService.parseCopyBriefFromText(text || '');
          if (parseResult.brief?.type) {
            contentType = parseResult.brief.type;
            parsedData = { ...parseResult.brief, ...parsedData };
          } else {
            return NextResponse.json({
              success: false,
              message: "What type of copy? Options: landing_page, email, social_post, ad_copy, blog, press_release, product_description, tagline, headline.",
              parsed: parsedData,
            });
          }
        }

        const result = await MarketingService.generateCopy(userId, contentType, {
          product: parsedData.product,
          targetAudience: parsedData.targetAudience,
          tone: parsedData.tone,
          keyMessages: parsedData.keyMessages,
          keywords: parsedData.keywords,
          length: parsedData.length,
          callToAction: parsedData.callToAction,
          brandVoice: parsedData.brandVoice,
          competitors: parsedData.competitors,
          uniqueSellingPoints: parsedData.uniqueSellingPoints,
        });

        return NextResponse.json({
          success: true,
          content: result.content,
          message: result.message,
        });
      }

      case 'generate_variants': {
        const { contentId, count } = parsedData;
        if (!contentId) {
          return NextResponse.json({
            success: false,
            message: "Which content should I create variants for? I need the content ID.",
          });
        }

        const result = await MarketingService.generateVariants(contentId, count || 3);

        return NextResponse.json({
          success: true,
          variants: result.variants,
          message: result.message,
        });
      }

      case 'generate_headlines': {
        const { topic, count } = parsedData;
        if (!topic && !text) {
          return NextResponse.json({
            success: false,
            message: "What topic should I create headlines for?",
          });
        }

        const result = await MarketingService.generateHeadlines(userId, topic || text, count || 10);

        return NextResponse.json({
          success: true,
          headlines: result.headlines,
          message: result.message,
        });
      }

      case 'generate_ad_copy': {
        const { platform, product, audience } = parsedData;
        if (!platform || !product) {
          return NextResponse.json({
            success: false,
            message: "What platform and product? E.g., 'Generate Meta ad copy for our productivity app targeting remote workers'.",
          });
        }

        const result = await MarketingService.generateAdCopy(
          userId,
          platform,
          product,
          audience || 'general audience'
        );

        return NextResponse.json({
          success: true,
          headline: result.headline,
          description: result.description,
          callToAction: result.callToAction,
          message: result.message,
        });
      }

      case 'save_content': {
        const { type, title, content, tone, targetAudience, keywords } = parsedData;
        if (!type || !title || !content) {
          return NextResponse.json({
            success: false,
            message: "I need at least the content type, title, and content body to save.",
          });
        }

        const result = await MarketingService.saveContent(userId, {
          type,
          title,
          content,
          tone,
          targetAudience,
          keywords,
        });

        return NextResponse.json({
          success: true,
          content: result.content,
          message: result.message,
        });
      }

      case 'approve_content': {
        const { contentId } = parsedData;
        if (!contentId) {
          return NextResponse.json({
            success: false,
            message: "Which content should I approve?",
          });
        }

        const result = await MarketingService.approveContent(contentId);

        return NextResponse.json({
          success: true,
          content: result.content,
          message: result.message,
        });
      }

      case 'create_campaign': {
        const { name, platform, objective, budget, budgetType, startDate, endDate, targeting } = parsedData;

        if (!name && !text) {
          return NextResponse.json({
            success: false,
            message: "What should I call this campaign? Give me a name and platform.",
          });
        }

        if (!platform) {
          return NextResponse.json({
            success: false,
            message: "Which platform? Options: google, meta, linkedin, twitter, tiktok, reddit.",
            parsed: parsedData,
          });
        }

        const result = await MarketingService.createCampaign(userId, {
          name: name || `${platform} campaign - ${new Date().toLocaleDateString()}`,
          platform,
          objective: objective || 'conversions',
          budget: budget || 100,
          budgetType: budgetType || 'daily',
          startDate: startDate ? new Date(startDate) : undefined,
          endDate: endDate ? new Date(endDate) : undefined,
          targeting,
        });

        return NextResponse.json({
          success: true,
          campaign: result.campaign,
          message: result.message,
        });
      }

      case 'pause_campaign': {
        const { campaignId } = parsedData;
        if (!campaignId) {
          return NextResponse.json({
            success: false,
            message: "Which campaign should I pause?",
          });
        }

        const result = await MarketingService.pauseCampaign(campaignId);

        return NextResponse.json({
          success: true,
          campaign: result.campaign,
          message: result.message,
        });
      }

      case 'resume_campaign': {
        const { campaignId } = parsedData;
        if (!campaignId) {
          return NextResponse.json({
            success: false,
            message: "Which campaign should I resume?",
          });
        }

        const result = await MarketingService.resumeCampaign(campaignId);

        return NextResponse.json({
          success: true,
          campaign: result.campaign,
          message: result.message,
        });
      }

      case 'record_spend': {
        const { platform, campaignId, date, amount, impressions, clicks, conversions } = parsedData;

        if (!platform || !amount) {
          return NextResponse.json({
            success: false,
            message: "I need the platform and amount. E.g., 'Spent $500 on Meta ads today with 50,000 impressions and 500 clicks'.",
          });
        }

        const result = await MarketingService.recordAdSpend(userId, {
          platform,
          campaignId,
          date: date ? new Date(date) : new Date(),
          amount,
          impressions,
          clicks,
          conversions,
        });

        return NextResponse.json({
          success: true,
          spend: result.spend,
          message: result.message,
        });
      }

      case 'set_budget': {
        const { period, budget, allocation } = parsedData;

        if (!budget) {
          return NextResponse.json({
            success: false,
            message: "What's the total marketing budget? I can also help allocate it across platforms.",
          });
        }

        const periodStr = period || new Date().toISOString().slice(0, 7);
        const result = await MarketingService.setMarketingBudget(userId, periodStr, budget, allocation);

        return NextResponse.json({
          success: true,
          budget: result.budget,
          message: result.message,
        });
      }

      case 'suggest_allocation': {
        const { goal } = parsedData;
        const result = await MarketingService.suggestBudgetAllocation(userId, goal || 'balanced');

        return NextResponse.json({
          success: true,
          allocation: result.allocation,
          reasoning: result.reasoning,
          message: result.message,
        });
      }

      case 'improve_copy': {
        const { contentId, feedback } = parsedData;
        if (!contentId || (!feedback && !text)) {
          return NextResponse.json({
            success: false,
            message: "Which content and what feedback? E.g., 'Make it more urgent' or 'Shorter and punchier'.",
          });
        }

        const result = await MarketingService.improveCopy(contentId, feedback || text);

        return NextResponse.json({
          success: true,
          content: result.content,
          message: result.message,
        });
      }

      case 'translate': {
        const { contentId, language } = parsedData;
        if (!contentId || !language) {
          return NextResponse.json({
            success: false,
            message: "Which content and what language? E.g., Spanish, French, German, Japanese.",
          });
        }

        const result = await MarketingService.translateCopy(contentId, language);

        return NextResponse.json({
          success: true,
          translatedContent: result.translatedContent,
          message: result.message,
        });
      }

      case 'add_creative': {
        const { campaignId, type, headline, description, callToAction, mediaUrl, destinationUrl } = parsedData;
        if (!campaignId || !headline) {
          return NextResponse.json({
            success: false,
            message: "I need the campaign ID and at least a headline for the creative.",
          });
        }

        const result = await MarketingService.addCreative(campaignId, {
          type: type || 'text',
          headline,
          description,
          callToAction,
          mediaUrl,
          destinationUrl,
        });

        return NextResponse.json({
          success: true,
          creative: result.creative,
          message: result.message,
        });
      }

      case 'parse_brief': {
        if (!text) {
          return NextResponse.json({
            success: false,
            message: "Describe what copy you need and I'll help structure the brief.",
          });
        }

        const result = await MarketingService.parseCopyBriefFromText(text);

        return NextResponse.json({
          success: true,
          brief: result.brief,
          message: result.message,
        });
      }

      case 'parse_campaign': {
        if (!text) {
          return NextResponse.json({
            success: false,
            message: "Describe the campaign you want to create.",
          });
        }

        const result = await MarketingService.parseCampaignFromText(text);

        return NextResponse.json({
          success: true,
          campaign: result.campaign,
          message: result.message,
        });
      }

      default:
        return NextResponse.json({
          success: false,
          message: "I can help with marketing. Try: 'Generate landing page copy for my SaaS product', 'Create a Google ads campaign with $50/day budget', or 'Record $500 Meta ad spend'.",
          availableActions: [
            'generate_copy', 'generate_variants', 'generate_headlines', 'generate_ad_copy',
            'save_content', 'approve_content', 'create_campaign', 'pause_campaign',
            'resume_campaign', 'record_spend', 'set_budget', 'suggest_allocation',
            'improve_copy', 'translate', 'add_creative', 'parse_brief', 'parse_campaign',
          ],
        });
    }
  } catch (error: any) {
    console.error('Error in marketing POST:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process marketing action' },
      { status: 500 }
    );
  }
}
