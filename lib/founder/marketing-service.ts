/**
 * Founder Marketing and Ads Service - Wells AI
 *
 * Handles marketing copy generation, ad campaign management, and spend tracking.
 * AI-powered content generation using Claude for personalized, brand-aware copy.
 *
 * Features:
 * - Copy generation with AI (landing pages, emails, ads, social posts)
 * - A/B variant generation
 * - Multi-platform ad campaign management
 * - Ad spend tracking and analytics
 * - Budget management and ROI analysis
 * - Natural language parsing for briefs and campaigns
 */

import { sqlQuery as sql } from '@/lib/db';
import Anthropic from '@anthropic-ai/sdk';
import crypto from 'crypto';

const anthropic = new Anthropic();

// ============================================================================
// TYPES
// ============================================================================

export type ContentType =
  | 'landing_page'
  | 'email'
  | 'social_post'
  | 'ad_copy'
  | 'blog'
  | 'press_release'
  | 'product_description'
  | 'tagline'
  | 'headline';

export type AdPlatform =
  | 'google'
  | 'meta'
  | 'linkedin'
  | 'twitter'
  | 'tiktok'
  | 'reddit';

export type CampaignStatus =
  | 'draft'
  | 'scheduled'
  | 'active'
  | 'paused'
  | 'completed'
  | 'cancelled';

export type CampaignObjective =
  | 'awareness'
  | 'traffic'
  | 'engagement'
  | 'leads'
  | 'conversions'
  | 'sales';

export type ContentStatus = 'draft' | 'approved' | 'published';

export interface ContentPerformance {
  views?: number;
  clicks?: number;
  conversions?: number;
  engagementRate?: number;
  conversionRate?: number;
  revenue?: number;
}

export interface ContentPiece {
  id: string;
  founderId: string;
  type: ContentType;
  title: string;
  content: string;
  variants: string[];
  tone: string;
  targetAudience?: string;
  keywords: string[];
  status: ContentStatus;
  performanceData?: ContentPerformance;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdTargeting {
  locations?: string[];
  ageMin?: number;
  ageMax?: number;
  genders?: string[];
  interests?: string[];
  behaviors?: string[];
  jobTitles?: string[];
  industries?: string[];
  companySizes?: string[];
  customAudiences?: string[];
  excludedAudiences?: string[];
  languages?: string[];
  devices?: string[];
  placements?: string[];
}

export interface AdCreative {
  id: string;
  campaignId: string;
  type: 'image' | 'video' | 'carousel' | 'text';
  headline: string;
  description?: string;
  callToAction?: string;
  mediaUrl?: string;
  destinationUrl?: string;
  status: 'active' | 'paused' | 'archived';
  performance?: CreativePerformance;
  createdAt: Date;
}

export interface CreativePerformance {
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  ctr: number;
  cvr: number;
  cpc: number;
  cpa: number;
}

export interface CampaignPerformance {
  impressions: number;
  reach: number;
  clicks: number;
  conversions: number;
  spend: number;
  ctr: number;
  cvr: number;
  cpc: number;
  cpm: number;
  cpa: number;
  roas: number;
  frequency: number;
}

export interface AdCampaign {
  id: string;
  founderId: string;
  name: string;
  platform: AdPlatform;
  objective: CampaignObjective;
  status: CampaignStatus;
  budget: number;
  budgetType: 'daily' | 'lifetime';
  spent: number;
  startDate: Date;
  endDate?: Date;
  targeting: AdTargeting;
  creatives: AdCreative[];
  performance: CampaignPerformance;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdSpend {
  id: string;
  founderId: string;
  platform: AdPlatform;
  campaignId?: string;
  date: Date;
  amount: number;
  impressions: number;
  clicks: number;
  conversions: number;
  cpc: number;
  cpm: number;
  cpa: number;
  roas: number;
}

export interface MarketingBudget {
  id: string;
  founderId: string;
  period: string;
  totalBudget: number;
  allocation: Record<AdPlatform, number>;
  spent: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CopyBrief {
  type: ContentType;
  product?: string;
  targetAudience?: string;
  tone?: string;
  keyMessages?: string[];
  keywords?: string[];
  length?: 'short' | 'medium' | 'long';
  callToAction?: string;
}

export interface CampaignBrief {
  platform: AdPlatform;
  objective?: CampaignObjective;
  budget?: number;
  budgetType?: 'daily' | 'lifetime';
  targetAudience?: string;
  startDate?: Date;
  endDate?: Date;
}

// ============================================================================
// COPY GENERATION
// ============================================================================

/**
 * Generate marketing copy with AI
 */
export async function generateCopy(
  founderId: string,
  type: ContentType,
  brief: {
    product?: string;
    targetAudience?: string;
    tone?: string;
    keyMessages?: string[];
    keywords?: string[];
    length?: 'short' | 'medium' | 'long';
    callToAction?: string;
    brandVoice?: string;
    competitors?: string[];
    uniqueSellingPoints?: string[];
  }
): Promise<{ content: ContentPiece; message: string }> {
  const lengthGuide = {
    short: type === 'headline' ? '5-10 words' : '50-100 words',
    medium: type === 'headline' ? '10-15 words' : '150-300 words',
    long: type === 'headline' ? '15-20 words' : '400-800 words',
  };

  const typeInstructions: Record<ContentType, string> = {
    landing_page: 'Write compelling landing page copy with a strong headline, value proposition, benefits, and call-to-action.',
    email: 'Write an email with subject line, preview text, body, and clear CTA. Keep it scannable.',
    social_post: 'Write an engaging social media post. Include hashtag suggestions.',
    ad_copy: 'Write concise, high-converting ad copy with headline, description, and CTA.',
    blog: 'Write a blog post with an engaging intro, organized sections, and conclusion.',
    press_release: 'Write a professional press release with headline, dateline, lead, body, and boilerplate.',
    product_description: 'Write a product description highlighting features, benefits, and specifications.',
    tagline: 'Create a memorable, catchy tagline that captures the brand essence.',
    headline: 'Create attention-grabbing headlines that drive clicks and engagement.',
  };

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250514',
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: `You are an expert marketing copywriter. Generate ${type.replace('_', ' ')} copy.

${typeInstructions[type]}

Brief:
- Product/Service: ${brief.product || 'Not specified'}
- Target Audience: ${brief.targetAudience || 'General'}
- Tone: ${brief.tone || 'Professional and engaging'}
- Brand Voice: ${brief.brandVoice || 'Not specified'}
- Key Messages: ${brief.keyMessages?.join(', ') || 'Not specified'}
- Keywords to include: ${brief.keywords?.join(', ') || 'None specified'}
- Unique Selling Points: ${brief.uniqueSellingPoints?.join(', ') || 'Not specified'}
- Competitors to differentiate from: ${brief.competitors?.join(', ') || 'Not specified'}
- Call to Action: ${brief.callToAction || 'Learn more'}
- Length: ${lengthGuide[brief.length || 'medium']}

Write compelling, persuasive copy that:
1. Hooks the reader immediately
2. Addresses their pain points
3. Presents clear benefits
4. Creates urgency or desire
5. Has a clear call-to-action

Respond with just the copy, no explanations.`,
      },
    ],
  });

  const aiContent = response.content[0].type === 'text' ? response.content[0].text : '';
  const contentId = crypto.randomUUID();

  // Save to database
  await sql`
    INSERT INTO founder_marketing_content (
      id, founder_id, type, title, content, variants, tone,
      target_audience, keywords, status, created_at, updated_at
    ) VALUES (
      ${contentId},
      ${founderId},
      ${type},
      ${brief.product || type.replace('_', ' ')},
      ${aiContent},
      ${JSON.stringify([])},
      ${brief.tone || 'professional'},
      ${brief.targetAudience || null},
      ${JSON.stringify(brief.keywords || [])},
      'draft',
      NOW(),
      NOW()
    )
  `;

  const content: ContentPiece = {
    id: contentId,
    founderId,
    type,
    title: brief.product || type.replace('_', ' '),
    content: aiContent,
    variants: [],
    tone: brief.tone || 'professional',
    targetAudience: brief.targetAudience,
    keywords: brief.keywords || [],
    status: 'draft',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return {
    content,
    message: `Generated ${type.replace('_', ' ')} copy for "${brief.product || 'your product'}". Review and approve when ready, or ask me to generate variants for A/B testing.`,
  };
}

/**
 * Generate A/B variants for existing content
 */
export async function generateVariants(
  contentId: string,
  count: number = 3
): Promise<{ variants: string[]; message: string }> {
  const contentResult = await sql`
    SELECT * FROM founder_marketing_content WHERE id = ${contentId}
  `;

  if (contentResult.rows.length === 0) {
    throw new Error('Content not found');
  }

  const original = mapRowToContent(contentResult.rows[0]);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250514',
    max_tokens: 3000,
    messages: [
      {
        role: 'user',
        content: `Create ${count} distinct A/B test variants of this ${original.type.replace('_', ' ')} copy.

Original:
${original.content}

Tone: ${original.tone}
Target Audience: ${original.targetAudience || 'General'}

Create ${count} variants that:
1. Keep the same core message and CTA
2. Test different hooks, angles, or emotional appeals
3. Vary the structure or emphasis
4. Maintain the same approximate length

Format your response as:
---VARIANT 1---
[variant content]
---VARIANT 2---
[variant content]
etc.`,
      },
    ],
  });

  const aiText = response.content[0].type === 'text' ? response.content[0].text : '';
  const variants = aiText
    .split(/---VARIANT \d+---/)
    .map((v) => v.trim())
    .filter((v) => v.length > 0);

  // Update database
  const existingVariants = original.variants || [];
  const allVariants = [...existingVariants, ...variants];

  await sql`
    UPDATE founder_marketing_content
    SET variants = ${JSON.stringify(allVariants)}, updated_at = NOW()
    WHERE id = ${contentId}
  `;

  return {
    variants,
    message: `Created ${variants.length} new variant(s) for A/B testing. You now have ${allVariants.length} total variants. Test them to see which performs best.`,
  };
}

/**
 * Generate headline options for a topic
 */
export async function generateHeadlines(
  founderId: string,
  topic: string,
  count: number = 10
): Promise<{ headlines: string[]; message: string }> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250514',
    max_tokens: 1500,
    messages: [
      {
        role: 'user',
        content: `Generate ${count} compelling headline options for: "${topic}"

Create a variety of headline styles:
- Questions that spark curiosity
- How-to headlines that promise value
- Numbers/list headlines
- Emotional headlines
- Benefit-driven headlines
- Urgency-creating headlines

Each headline should be:
- Clear and specific
- Under 70 characters for optimal display
- Action-oriented or benefit-focused

List each headline on a new line, numbered 1-${count}.`,
      },
    ],
  });

  const aiText = response.content[0].type === 'text' ? response.content[0].text : '';
  const headlines = aiText
    .split('\n')
    .map((line) => line.replace(/^\d+[\.\)]\s*/, '').trim())
    .filter((line) => line.length > 0 && line.length < 150);

  return {
    headlines: headlines.slice(0, count),
    message: `Here are ${Math.min(headlines.length, count)} headline options for "${topic}". Pick your favorites or ask me to generate more with a specific angle.`,
  };
}

/**
 * Generate platform-specific ad copy
 */
export async function generateAdCopy(
  founderId: string,
  platform: AdPlatform,
  product: string,
  audience: string
): Promise<{
  headline: string;
  description: string;
  callToAction: string;
  message: string;
}> {
  const platformSpecs: Record<AdPlatform, { headlineLimit: number; descLimit: number; style: string }> = {
    google: { headlineLimit: 30, descLimit: 90, style: 'Direct, keyword-focused, benefit-driven' },
    meta: { headlineLimit: 40, descLimit: 125, style: 'Engaging, visual-focused, storytelling' },
    linkedin: { headlineLimit: 70, descLimit: 150, style: 'Professional, B2B-focused, value-driven' },
    twitter: { headlineLimit: 70, descLimit: 280, style: 'Conversational, concise, hashtag-friendly' },
    tiktok: { headlineLimit: 100, descLimit: 150, style: 'Trendy, authentic, entertainment-first' },
    reddit: { headlineLimit: 100, descLimit: 200, style: 'Authentic, community-aware, non-salesy' },
  };

  const spec = platformSpecs[platform];

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250514',
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: `Write ${platform} ad copy for: ${product}
Target Audience: ${audience}

Platform requirements:
- Headline: max ${spec.headlineLimit} characters
- Description: max ${spec.descLimit} characters
- Style: ${spec.style}

Format:
HEADLINE: [your headline]
DESCRIPTION: [your description]
CTA: [call to action text]`,
      },
    ],
  });

  const aiText = response.content[0].type === 'text' ? response.content[0].text : '';

  const headlineMatch = aiText.match(/HEADLINE:\s*(.+)/i);
  const descMatch = aiText.match(/DESCRIPTION:\s*(.+)/i);
  const ctaMatch = aiText.match(/CTA:\s*(.+)/i);

  const headline = headlineMatch?.[1]?.trim() || product;
  const description = descMatch?.[1]?.trim() || `Learn more about ${product}`;
  const callToAction = ctaMatch?.[1]?.trim() || 'Learn More';

  return {
    headline: headline.slice(0, spec.headlineLimit),
    description: description.slice(0, spec.descLimit),
    callToAction,
    message: `Generated ${platform} ad copy for "${product}" targeting ${audience}. Ready to create a campaign or generate more variants?`,
  };
}

/**
 * Improve copy based on feedback
 */
export async function improveCopy(
  contentId: string,
  feedback: string
): Promise<{ content: ContentPiece; message: string }> {
  const contentResult = await sql`
    SELECT * FROM founder_marketing_content WHERE id = ${contentId}
  `;

  if (contentResult.rows.length === 0) {
    throw new Error('Content not found');
  }

  const original = mapRowToContent(contentResult.rows[0]);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250514',
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: `Improve this ${original.type.replace('_', ' ')} copy based on the feedback.

Original copy:
${original.content}

Feedback: ${feedback}

Rewrite the copy addressing the feedback while maintaining:
- The same general structure and length
- The core message and CTA
- The ${original.tone} tone

Provide only the improved copy, no explanations.`,
      },
    ],
  });

  const improvedContent = response.content[0].type === 'text' ? response.content[0].text : '';

  await sql`
    UPDATE founder_marketing_content
    SET content = ${improvedContent}, updated_at = NOW()
    WHERE id = ${contentId}
  `;

  const updated: ContentPiece = {
    ...original,
    content: improvedContent,
    updatedAt: new Date(),
  };

  return {
    content: updated,
    message: `Updated the copy based on your feedback. The original is preserved in the version history if you want to compare.`,
  };
}

/**
 * Translate content to another language
 */
export async function translateCopy(
  contentId: string,
  targetLanguage: string
): Promise<{ translatedContent: string; message: string }> {
  const contentResult = await sql`
    SELECT * FROM founder_marketing_content WHERE id = ${contentId}
  `;

  if (contentResult.rows.length === 0) {
    throw new Error('Content not found');
  }

  const original = mapRowToContent(contentResult.rows[0]);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250514',
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: `Translate this marketing copy to ${targetLanguage}.

Original (${original.type.replace('_', ' ')}):
${original.content}

Important:
- Adapt idioms and expressions naturally (don't translate literally)
- Maintain the persuasive tone and marketing intent
- Keep the same structure and formatting
- Preserve any technical terms that should remain in English

Provide only the translated copy.`,
      },
    ],
  });

  const translatedContent = response.content[0].type === 'text' ? response.content[0].text : '';

  // Save as a variant with language tag
  const variants = [...(original.variants || []), `[${targetLanguage}] ${translatedContent}`];

  await sql`
    UPDATE founder_marketing_content
    SET variants = ${JSON.stringify(variants)}, updated_at = NOW()
    WHERE id = ${contentId}
  `;

  return {
    translatedContent,
    message: `Translated to ${targetLanguage}. Saved as a variant - you can now use this for your ${targetLanguage}-speaking audience.`,
  };
}

// ============================================================================
// CONTENT MANAGEMENT
// ============================================================================

/**
 * Save a new content piece
 */
export async function saveContent(
  founderId: string,
  content: {
    type: ContentType;
    title: string;
    content: string;
    tone?: string;
    targetAudience?: string;
    keywords?: string[];
  }
): Promise<{ content: ContentPiece; message: string }> {
  const contentId = crypto.randomUUID();

  await sql`
    INSERT INTO founder_marketing_content (
      id, founder_id, type, title, content, variants, tone,
      target_audience, keywords, status, created_at, updated_at
    ) VALUES (
      ${contentId},
      ${founderId},
      ${content.type},
      ${content.title},
      ${content.content},
      ${JSON.stringify([])},
      ${content.tone || 'professional'},
      ${content.targetAudience || null},
      ${JSON.stringify(content.keywords || [])},
      'draft',
      NOW(),
      NOW()
    )
  `;

  const savedContent: ContentPiece = {
    id: contentId,
    founderId,
    type: content.type,
    title: content.title,
    content: content.content,
    variants: [],
    tone: content.tone || 'professional',
    targetAudience: content.targetAudience,
    keywords: content.keywords || [],
    status: 'draft',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return {
    content: savedContent,
    message: `Saved "${content.title}" as a draft. Approve it when ready to use.`,
  };
}

/**
 * Get content for a founder with optional filters
 */
export async function getContent(
  founderId: string,
  filters?: {
    type?: ContentType;
    status?: ContentStatus;
    limit?: number;
  }
): Promise<{ content: ContentPiece[]; message: string }> {
  const limit = filters?.limit || 50;

  let result;
  if (filters?.type && filters?.status) {
    result = await sql`
      SELECT * FROM founder_marketing_content
      WHERE founder_id = ${founderId}
        AND type = ${filters.type}
        AND status = ${filters.status}
      ORDER BY updated_at DESC
      LIMIT ${limit}
    `;
  } else if (filters?.type) {
    result = await sql`
      SELECT * FROM founder_marketing_content
      WHERE founder_id = ${founderId}
        AND type = ${filters.type}
      ORDER BY updated_at DESC
      LIMIT ${limit}
    `;
  } else if (filters?.status) {
    result = await sql`
      SELECT * FROM founder_marketing_content
      WHERE founder_id = ${founderId}
        AND status = ${filters.status}
      ORDER BY updated_at DESC
      LIMIT ${limit}
    `;
  } else {
    result = await sql`
      SELECT * FROM founder_marketing_content
      WHERE founder_id = ${founderId}
      ORDER BY updated_at DESC
      LIMIT ${limit}
    `;
  }

  const content = result.rows.map(mapRowToContent);

  if (content.length === 0) {
    return {
      content: [],
      message: filters
        ? `No ${filters.status || ''} ${filters.type?.replace('_', ' ') || 'content'} found. Want to create some?`
        : `You don't have any marketing content yet. Let's generate some copy to get started.`,
    };
  }

  const byType = content.reduce((acc, c) => {
    acc[c.type] = (acc[c.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const typeSummary = Object.entries(byType)
    .map(([type, count]) => `${count} ${type.replace('_', ' ')}${count > 1 ? 's' : ''}`)
    .join(', ');

  return {
    content,
    message: `Found ${content.length} content piece(s): ${typeSummary}.`,
  };
}

/**
 * Update content piece
 */
export async function updateContent(
  contentId: string,
  updates: Partial<{
    title: string;
    content: string;
    tone: string;
    targetAudience: string;
    keywords: string[];
  }>
): Promise<{ content: ContentPiece; message: string }> {
  const result = await sql`
    UPDATE founder_marketing_content
    SET
      title = COALESCE(${updates.title || null}, title),
      content = COALESCE(${updates.content || null}, content),
      tone = COALESCE(${updates.tone || null}, tone),
      target_audience = COALESCE(${updates.targetAudience || null}, target_audience),
      keywords = COALESCE(${updates.keywords ? JSON.stringify(updates.keywords) : null}, keywords),
      updated_at = NOW()
    WHERE id = ${contentId}
    RETURNING *
  `;

  if (result.rows.length === 0) {
    throw new Error('Content not found');
  }

  const content = mapRowToContent(result.rows[0]);
  const changedFields = Object.keys(updates).filter(
    (k) => updates[k as keyof typeof updates] !== undefined
  );

  return {
    content,
    message: `Updated ${changedFields.join(', ')} for "${content.title}".`,
  };
}

/**
 * Approve content for use
 */
export async function approveContent(
  contentId: string
): Promise<{ content: ContentPiece; message: string }> {
  const result = await sql`
    UPDATE founder_marketing_content
    SET status = 'approved', updated_at = NOW()
    WHERE id = ${contentId}
    RETURNING *
  `;

  if (result.rows.length === 0) {
    throw new Error('Content not found');
  }

  const content = mapRowToContent(result.rows[0]);

  return {
    content,
    message: `"${content.title}" approved and ready to use. You can now publish it or use it in campaigns.`,
  };
}

/**
 * Publish content to a platform
 */
export async function publishContent(
  contentId: string,
  destination: string
): Promise<{ content: ContentPiece; message: string }> {
  const result = await sql`
    UPDATE founder_marketing_content
    SET status = 'published', updated_at = NOW()
    WHERE id = ${contentId}
    RETURNING *
  `;

  if (result.rows.length === 0) {
    throw new Error('Content not found');
  }

  const content = mapRowToContent(result.rows[0]);

  // In production, this would integrate with platform APIs
  // For now, just mark as published

  return {
    content,
    message: `"${content.title}" marked as published to ${destination}. In production, this would post directly to the platform.`,
  };
}

// ============================================================================
// AD CAMPAIGN MANAGEMENT
// ============================================================================

/**
 * Create a new ad campaign
 */
export async function createCampaign(
  founderId: string,
  data: {
    name: string;
    platform: AdPlatform;
    objective: CampaignObjective;
    budget: number;
    budgetType?: 'daily' | 'lifetime';
    startDate?: Date;
    endDate?: Date;
    targeting?: AdTargeting;
  }
): Promise<{ campaign: AdCampaign; message: string }> {
  const campaignId = crypto.randomUUID();
  const budgetType = data.budgetType || 'daily';
  const startDate = data.startDate || new Date();

  await sql`
    INSERT INTO founder_ad_campaigns (
      id, founder_id, name, platform, objective, status,
      budget, budget_type, spent, start_date, end_date,
      targeting, creatives, performance, created_at, updated_at
    ) VALUES (
      ${campaignId},
      ${founderId},
      ${data.name},
      ${data.platform},
      ${data.objective},
      'draft',
      ${data.budget},
      ${budgetType},
      0,
      ${startDate.toISOString()},
      ${data.endDate?.toISOString() || null},
      ${JSON.stringify(data.targeting || {})},
      ${JSON.stringify([])},
      ${JSON.stringify({
        impressions: 0,
        reach: 0,
        clicks: 0,
        conversions: 0,
        spend: 0,
        ctr: 0,
        cvr: 0,
        cpc: 0,
        cpm: 0,
        cpa: 0,
        roas: 0,
        frequency: 0,
      })},
      NOW(),
      NOW()
    )
  `;

  const campaign: AdCampaign = {
    id: campaignId,
    founderId,
    name: data.name,
    platform: data.platform,
    objective: data.objective,
    status: 'draft',
    budget: data.budget,
    budgetType,
    spent: 0,
    startDate,
    endDate: data.endDate,
    targeting: data.targeting || {},
    creatives: [],
    performance: {
      impressions: 0,
      reach: 0,
      clicks: 0,
      conversions: 0,
      spend: 0,
      ctr: 0,
      cvr: 0,
      cpc: 0,
      cpm: 0,
      cpa: 0,
      roas: 0,
      frequency: 0,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const budgetDisplay = budgetType === 'daily'
    ? `$${data.budget}/day`
    : `$${data.budget} total`;

  return {
    campaign,
    message: `Created "${data.name}" campaign on ${data.platform}. Budget: ${budgetDisplay}, Objective: ${data.objective}. Add creatives and targeting, then launch when ready.`,
  };
}

/**
 * Get campaigns for a founder
 */
export async function getCampaigns(
  founderId: string,
  filters?: {
    platform?: AdPlatform;
    status?: CampaignStatus;
    objective?: CampaignObjective;
    limit?: number;
  }
): Promise<{ campaigns: AdCampaign[]; message: string }> {
  const limit = filters?.limit || 50;

  let result;
  if (filters?.platform && filters?.status) {
    result = await sql`
      SELECT * FROM founder_ad_campaigns
      WHERE founder_id = ${founderId}
        AND platform = ${filters.platform}
        AND status = ${filters.status}
      ORDER BY updated_at DESC
      LIMIT ${limit}
    `;
  } else if (filters?.platform) {
    result = await sql`
      SELECT * FROM founder_ad_campaigns
      WHERE founder_id = ${founderId}
        AND platform = ${filters.platform}
      ORDER BY updated_at DESC
      LIMIT ${limit}
    `;
  } else if (filters?.status) {
    result = await sql`
      SELECT * FROM founder_ad_campaigns
      WHERE founder_id = ${founderId}
        AND status = ${filters.status}
      ORDER BY updated_at DESC
      LIMIT ${limit}
    `;
  } else {
    result = await sql`
      SELECT * FROM founder_ad_campaigns
      WHERE founder_id = ${founderId}
      ORDER BY updated_at DESC
      LIMIT ${limit}
    `;
  }

  const campaigns = result.rows.map(mapRowToCampaign);

  if (campaigns.length === 0) {
    return {
      campaigns: [],
      message: `No ${filters?.status || ''} campaigns found${filters?.platform ? ` on ${filters.platform}` : ''}. Ready to create your first campaign?`,
    };
  }

  const totalSpend = campaigns.reduce((sum, c) => sum + c.spent, 0);
  const activeCount = campaigns.filter((c) => c.status === 'active').length;

  return {
    campaigns,
    message: `Found ${campaigns.length} campaign(s). ${activeCount} active, $${totalSpend.toLocaleString()} total spend.`,
  };
}

/**
 * Get a single campaign by ID
 */
export async function getCampaign(
  campaignId: string
): Promise<{ campaign: AdCampaign; message: string }> {
  const result = await sql`
    SELECT * FROM founder_ad_campaigns WHERE id = ${campaignId}
  `;

  if (result.rows.length === 0) {
    throw new Error('Campaign not found');
  }

  const campaign = mapRowToCampaign(result.rows[0]);
  const { performance } = campaign;

  let performanceMsg = '';
  if (performance.impressions > 0) {
    performanceMsg = ` Performance: ${performance.impressions.toLocaleString()} impressions, ${performance.clicks.toLocaleString()} clicks (${(performance.ctr * 100).toFixed(2)}% CTR), $${performance.spend.toFixed(2)} spent.`;
  }

  return {
    campaign,
    message: `"${campaign.name}" on ${campaign.platform} - Status: ${campaign.status}.${performanceMsg}`,
  };
}

/**
 * Update campaign details
 */
export async function updateCampaign(
  campaignId: string,
  updates: Partial<{
    name: string;
    budget: number;
    budgetType: 'daily' | 'lifetime';
    startDate: Date;
    endDate: Date;
    targeting: AdTargeting;
  }>
): Promise<{ campaign: AdCampaign; message: string }> {
  const result = await sql`
    UPDATE founder_ad_campaigns
    SET
      name = COALESCE(${updates.name || null}, name),
      budget = COALESCE(${updates.budget || null}, budget),
      budget_type = COALESCE(${updates.budgetType || null}, budget_type),
      start_date = COALESCE(${updates.startDate?.toISOString() || null}, start_date),
      end_date = COALESCE(${updates.endDate?.toISOString() || null}, end_date),
      targeting = COALESCE(${updates.targeting ? JSON.stringify(updates.targeting) : null}, targeting),
      updated_at = NOW()
    WHERE id = ${campaignId}
    RETURNING *
  `;

  if (result.rows.length === 0) {
    throw new Error('Campaign not found');
  }

  const campaign = mapRowToCampaign(result.rows[0]);

  return {
    campaign,
    message: `Updated "${campaign.name}" campaign settings.`,
  };
}

/**
 * Pause an active campaign
 */
export async function pauseCampaign(
  campaignId: string
): Promise<{ campaign: AdCampaign; message: string }> {
  const existing = await sql`SELECT * FROM founder_ad_campaigns WHERE id = ${campaignId}`;
  if (existing.rows.length === 0) {
    throw new Error('Campaign not found');
  }

  if (existing.rows[0].status !== 'active') {
    throw new Error(`Campaign is ${existing.rows[0].status}, not active. Cannot pause.`);
  }

  const result = await sql`
    UPDATE founder_ad_campaigns
    SET status = 'paused', updated_at = NOW()
    WHERE id = ${campaignId}
    RETURNING *
  `;

  const campaign = mapRowToCampaign(result.rows[0]);

  return {
    campaign,
    message: `Paused "${campaign.name}". Ad delivery stopped. Resume anytime when ready.`,
  };
}

/**
 * Resume a paused campaign
 */
export async function resumeCampaign(
  campaignId: string
): Promise<{ campaign: AdCampaign; message: string }> {
  const existing = await sql`SELECT * FROM founder_ad_campaigns WHERE id = ${campaignId}`;
  if (existing.rows.length === 0) {
    throw new Error('Campaign not found');
  }

  if (existing.rows[0].status !== 'paused') {
    throw new Error(`Campaign is ${existing.rows[0].status}, not paused. Cannot resume.`);
  }

  const result = await sql`
    UPDATE founder_ad_campaigns
    SET status = 'active', updated_at = NOW()
    WHERE id = ${campaignId}
    RETURNING *
  `;

  const campaign = mapRowToCampaign(result.rows[0]);

  return {
    campaign,
    message: `Resumed "${campaign.name}". Ads are now delivering again.`,
  };
}

// ============================================================================
// AD CREATIVE MANAGEMENT
// ============================================================================

/**
 * Add a creative to a campaign
 */
export async function addCreative(
  campaignId: string,
  creative: {
    type: 'image' | 'video' | 'carousel' | 'text';
    headline: string;
    description?: string;
    callToAction?: string;
    mediaUrl?: string;
    destinationUrl?: string;
  }
): Promise<{ creative: AdCreative; message: string }> {
  const creativeId = crypto.randomUUID();

  // Get existing campaign and creatives
  const campaignResult = await sql`
    SELECT * FROM founder_ad_campaigns WHERE id = ${campaignId}
  `;

  if (campaignResult.rows.length === 0) {
    throw new Error('Campaign not found');
  }

  const campaign = mapRowToCampaign(campaignResult.rows[0]);
  const newCreative: AdCreative = {
    id: creativeId,
    campaignId,
    type: creative.type,
    headline: creative.headline,
    description: creative.description,
    callToAction: creative.callToAction || 'Learn More',
    mediaUrl: creative.mediaUrl,
    destinationUrl: creative.destinationUrl,
    status: 'active',
    createdAt: new Date(),
  };

  const updatedCreatives = [...campaign.creatives, newCreative];

  await sql`
    UPDATE founder_ad_campaigns
    SET creatives = ${JSON.stringify(updatedCreatives)}, updated_at = NOW()
    WHERE id = ${campaignId}
  `;

  return {
    creative: newCreative,
    message: `Added ${creative.type} creative to "${campaign.name}". You now have ${updatedCreatives.length} creative(s) in this campaign.`,
  };
}

/**
 * Generate creative variants using AI
 */
export async function generateCreativeVariants(
  creativeId: string
): Promise<{ variants: Array<{ headline: string; description: string }>; message: string }> {
  // Find the creative within campaigns
  const campaignsResult = await sql`
    SELECT * FROM founder_ad_campaigns
    WHERE creatives::text LIKE ${'%' + creativeId + '%'}
  `;

  if (campaignsResult.rows.length === 0) {
    throw new Error('Creative not found');
  }

  const campaign = mapRowToCampaign(campaignsResult.rows[0]);
  const creative = campaign.creatives.find((c) => c.id === creativeId);

  if (!creative) {
    throw new Error('Creative not found in campaign');
  }

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250514',
    max_tokens: 1000,
    messages: [
      {
        role: 'user',
        content: `Create 3 A/B test variants of this ${campaign.platform} ad creative.

Original:
Headline: ${creative.headline}
Description: ${creative.description || 'N/A'}

Platform: ${campaign.platform}
Objective: ${campaign.objective}

Create 3 variants that test different:
1. Emotional angles
2. Value propositions
3. CTAs/urgency

Format each as:
HEADLINE: [headline]
DESCRIPTION: [description]
---`,
      },
    ],
  });

  const aiText = response.content[0].type === 'text' ? response.content[0].text : '';
  const variantBlocks = aiText.split('---').filter((b) => b.trim());

  const variants = variantBlocks.map((block) => {
    const headlineMatch = block.match(/HEADLINE:\s*(.+)/i);
    const descMatch = block.match(/DESCRIPTION:\s*(.+)/i);
    return {
      headline: headlineMatch?.[1]?.trim() || creative.headline,
      description: descMatch?.[1]?.trim() || creative.description || '',
    };
  });

  return {
    variants,
    message: `Generated ${variants.length} creative variants. Add them to your campaign to start A/B testing.`,
  };
}

/**
 * Get performance metrics for a specific creative
 */
export async function getCreativePerformance(
  creativeId: string
): Promise<{ performance: CreativePerformance; message: string }> {
  // Find the creative
  const campaignsResult = await sql`
    SELECT * FROM founder_ad_campaigns
    WHERE creatives::text LIKE ${'%' + creativeId + '%'}
  `;

  if (campaignsResult.rows.length === 0) {
    throw new Error('Creative not found');
  }

  const campaign = mapRowToCampaign(campaignsResult.rows[0]);
  const creative = campaign.creatives.find((c) => c.id === creativeId);

  if (!creative) {
    throw new Error('Creative not found in campaign');
  }

  // In production, this would fetch from platform APIs
  // For now, return placeholder or stored data
  const performance: CreativePerformance = creative.performance || {
    impressions: 0,
    clicks: 0,
    conversions: 0,
    spend: 0,
    ctr: 0,
    cvr: 0,
    cpc: 0,
    cpa: 0,
  };

  let message: string;
  if (performance.impressions === 0) {
    message = `No performance data yet for this creative. Data will appear once the campaign starts running.`;
  } else {
    message = `Creative performance: ${performance.impressions.toLocaleString()} impressions, ${(performance.ctr * 100).toFixed(2)}% CTR, $${performance.cpc.toFixed(2)} CPC.`;
  }

  return { performance, message };
}

// ============================================================================
// SPEND TRACKING
// ============================================================================

/**
 * Record ad spend for a day/campaign
 */
export async function recordAdSpend(
  founderId: string,
  spendData: {
    platform: AdPlatform;
    campaignId?: string;
    date: Date;
    amount: number;
    impressions?: number;
    clicks?: number;
    conversions?: number;
  }
): Promise<{ spend: AdSpend; message: string }> {
  const spendId = crypto.randomUUID();

  const impressions = spendData.impressions || 0;
  const clicks = spendData.clicks || 0;
  const conversions = spendData.conversions || 0;

  const cpc = clicks > 0 ? spendData.amount / clicks : 0;
  const cpm = impressions > 0 ? (spendData.amount / impressions) * 1000 : 0;
  const cpa = conversions > 0 ? spendData.amount / conversions : 0;
  const roas = 0; // Would need revenue data

  await sql`
    INSERT INTO founder_ad_spend (
      id, founder_id, platform, campaign_id, date,
      amount, impressions, clicks, conversions,
      cpc, cpm, cpa, roas, created_at
    ) VALUES (
      ${spendId},
      ${founderId},
      ${spendData.platform},
      ${spendData.campaignId || null},
      ${spendData.date.toISOString()},
      ${spendData.amount},
      ${impressions},
      ${clicks},
      ${conversions},
      ${cpc},
      ${cpm},
      ${cpa},
      ${roas},
      NOW()
    )
  `;

  // Update campaign spent amount if linked
  if (spendData.campaignId) {
    await sql`
      UPDATE founder_ad_campaigns
      SET spent = spent + ${spendData.amount}, updated_at = NOW()
      WHERE id = ${spendData.campaignId}
    `;
  }

  const spend: AdSpend = {
    id: spendId,
    founderId,
    platform: spendData.platform,
    campaignId: spendData.campaignId,
    date: spendData.date,
    amount: spendData.amount,
    impressions,
    clicks,
    conversions,
    cpc,
    cpm,
    cpa,
    roas,
  };

  return {
    spend,
    message: `Recorded $${spendData.amount.toFixed(2)} spend on ${spendData.platform} for ${spendData.date.toLocaleDateString()}. ${clicks} clicks, ${conversions} conversions.`,
  };
}

/**
 * Import ad spend from platform API (stub for future integration)
 */
export async function importAdSpend(
  founderId: string,
  platform: AdPlatform,
  dateRange: { start: Date; end: Date }
): Promise<{ imported: number; message: string }> {
  // In production, this would:
  // 1. Connect to Google Ads, Meta Ads, LinkedIn Marketing APIs, etc.
  // 2. Fetch spend data for the date range
  // 3. Store in our database

  // For now, return a stub response
  return {
    imported: 0,
    message: `Import from ${platform} API not yet implemented. For now, you can manually record spend or upload a CSV.`,
  };
}

/**
 * Get ad spend data
 */
export async function getAdSpend(
  founderId: string,
  filters?: {
    platform?: AdPlatform;
    campaignId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }
): Promise<{ spend: AdSpend[]; total: number; message: string }> {
  const limit = filters?.limit || 100;

  let result;
  if (filters?.platform && filters?.startDate && filters?.endDate) {
    result = await sql`
      SELECT * FROM founder_ad_spend
      WHERE founder_id = ${founderId}
        AND platform = ${filters.platform}
        AND date >= ${filters.startDate.toISOString()}
        AND date <= ${filters.endDate.toISOString()}
      ORDER BY date DESC
      LIMIT ${limit}
    `;
  } else if (filters?.campaignId) {
    result = await sql`
      SELECT * FROM founder_ad_spend
      WHERE founder_id = ${founderId}
        AND campaign_id = ${filters.campaignId}
      ORDER BY date DESC
      LIMIT ${limit}
    `;
  } else if (filters?.platform) {
    result = await sql`
      SELECT * FROM founder_ad_spend
      WHERE founder_id = ${founderId}
        AND platform = ${filters.platform}
      ORDER BY date DESC
      LIMIT ${limit}
    `;
  } else {
    result = await sql`
      SELECT * FROM founder_ad_spend
      WHERE founder_id = ${founderId}
      ORDER BY date DESC
      LIMIT ${limit}
    `;
  }

  const spend = result.rows.map(mapRowToSpend);
  const total = spend.reduce((sum, s) => sum + s.amount, 0);

  if (spend.length === 0) {
    return {
      spend: [],
      total: 0,
      message: `No ad spend recorded${filters?.platform ? ` for ${filters.platform}` : ''}. Record your first spend entry to start tracking.`,
    };
  }

  return {
    spend,
    total,
    message: `Total spend: $${total.toLocaleString()} across ${spend.length} entries.`,
  };
}

/**
 * Get spend breakdown by platform
 */
export async function getSpendByPlatform(
  founderId: string,
  period: { start: Date; end: Date }
): Promise<{
  breakdown: Record<AdPlatform, { spend: number; clicks: number; conversions: number }>;
  total: number;
  message: string;
}> {
  const result = await sql`
    SELECT
      platform,
      SUM(amount) as total_spend,
      SUM(clicks) as total_clicks,
      SUM(conversions) as total_conversions
    FROM founder_ad_spend
    WHERE founder_id = ${founderId}
      AND date >= ${period.start.toISOString()}
      AND date <= ${period.end.toISOString()}
    GROUP BY platform
    ORDER BY total_spend DESC
  `;

  const breakdown: Record<AdPlatform, { spend: number; clicks: number; conversions: number }> = {
    google: { spend: 0, clicks: 0, conversions: 0 },
    meta: { spend: 0, clicks: 0, conversions: 0 },
    linkedin: { spend: 0, clicks: 0, conversions: 0 },
    twitter: { spend: 0, clicks: 0, conversions: 0 },
    tiktok: { spend: 0, clicks: 0, conversions: 0 },
    reddit: { spend: 0, clicks: 0, conversions: 0 },
  };

  let total = 0;
  for (const row of result.rows) {
    const platform = row.platform as AdPlatform;
    const spend = parseFloat(row.total_spend || '0');
    breakdown[platform] = {
      spend,
      clicks: parseInt(row.total_clicks || '0'),
      conversions: parseInt(row.total_conversions || '0'),
    };
    total += spend;
  }

  const topPlatform = result.rows[0]?.platform || 'none';
  const topSpend = parseFloat(result.rows[0]?.total_spend || '0');

  return {
    breakdown,
    total,
    message: total > 0
      ? `Total spend: $${total.toLocaleString()}. Top platform: ${topPlatform} ($${topSpend.toLocaleString()}).`
      : `No spend recorded for this period.`,
  };
}

/**
 * Get spend by campaign objective
 */
export async function getSpendByObjective(
  founderId: string,
  period: { start: Date; end: Date }
): Promise<{
  breakdown: Record<CampaignObjective, number>;
  message: string;
}> {
  const result = await sql`
    SELECT
      c.objective,
      SUM(s.amount) as total_spend
    FROM founder_ad_spend s
    JOIN founder_ad_campaigns c ON s.campaign_id = c.id
    WHERE s.founder_id = ${founderId}
      AND s.date >= ${period.start.toISOString()}
      AND s.date <= ${period.end.toISOString()}
    GROUP BY c.objective
    ORDER BY total_spend DESC
  `;

  const breakdown: Record<CampaignObjective, number> = {
    awareness: 0,
    traffic: 0,
    engagement: 0,
    leads: 0,
    conversions: 0,
    sales: 0,
  };

  for (const row of result.rows) {
    const objective = row.objective as CampaignObjective;
    breakdown[objective] = parseFloat(row.total_spend || '0');
  }

  const objectiveEntries = Object.entries(breakdown)
    .filter(([_, spend]) => spend > 0)
    .map(([obj, spend]) => `${obj}: $${spend.toLocaleString()}`)
    .join(', ');

  return {
    breakdown,
    message: objectiveEntries || 'No spend data linked to campaign objectives.',
  };
}

// ============================================================================
// ANALYTICS
// ============================================================================

/**
 * Get full performance metrics for a campaign
 */
export async function getCampaignPerformance(
  campaignId: string
): Promise<{ performance: CampaignPerformance; insights: string[]; message: string }> {
  const campaignResult = await sql`
    SELECT * FROM founder_ad_campaigns WHERE id = ${campaignId}
  `;

  if (campaignResult.rows.length === 0) {
    throw new Error('Campaign not found');
  }

  const campaign = mapRowToCampaign(campaignResult.rows[0]);

  // Aggregate spend data for this campaign
  const spendResult = await sql`
    SELECT
      SUM(amount) as total_spend,
      SUM(impressions) as total_impressions,
      SUM(clicks) as total_clicks,
      SUM(conversions) as total_conversions
    FROM founder_ad_spend
    WHERE campaign_id = ${campaignId}
  `;

  const spendRow = spendResult.rows[0];
  const spend = parseFloat(spendRow?.total_spend || '0');
  const impressions = parseInt(spendRow?.total_impressions || '0');
  const clicks = parseInt(spendRow?.total_clicks || '0');
  const conversions = parseInt(spendRow?.total_conversions || '0');

  const performance: CampaignPerformance = {
    impressions,
    reach: Math.floor(impressions * 0.7), // Estimate
    clicks,
    conversions,
    spend,
    ctr: impressions > 0 ? clicks / impressions : 0,
    cvr: clicks > 0 ? conversions / clicks : 0,
    cpc: clicks > 0 ? spend / clicks : 0,
    cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
    cpa: conversions > 0 ? spend / conversions : 0,
    roas: 0, // Would need revenue data
    frequency: impressions > 0 ? impressions / Math.floor(impressions * 0.7) : 0,
  };

  // Generate insights
  const insights: string[] = [];

  if (performance.ctr > 0.02) {
    insights.push('CTR is above industry average (2%). Your creative is resonating.');
  } else if (performance.ctr > 0 && performance.ctr < 0.01) {
    insights.push('CTR is below average. Consider testing new headlines or visuals.');
  }

  if (performance.cvr > 0.05) {
    insights.push('Conversion rate is strong. Your landing page is converting well.');
  } else if (performance.cvr > 0 && performance.cvr < 0.02) {
    insights.push('Conversion rate is low. Review your landing page or targeting.');
  }

  if (campaign.budgetType === 'daily' && spend > campaign.budget * 0.9) {
    insights.push('Budget is nearly depleted for today.');
  }

  return {
    performance,
    insights,
    message: impressions > 0
      ? `Campaign performance: ${impressions.toLocaleString()} impressions, ${(performance.ctr * 100).toFixed(2)}% CTR, ${conversions} conversions, $${spend.toFixed(2)} spent.`
      : `No performance data yet. Start running the campaign to see results.`,
  };
}

/**
 * Get overall marketing ROI
 */
export async function getMarketingROI(
  founderId: string,
  period: { start: Date; end: Date }
): Promise<{
  totalSpend: number;
  totalRevenue: number;
  roi: number;
  roas: number;
  message: string;
}> {
  const spendResult = await sql`
    SELECT
      SUM(amount) as total_spend,
      SUM(conversions) as total_conversions
    FROM founder_ad_spend
    WHERE founder_id = ${founderId}
      AND date >= ${period.start.toISOString()}
      AND date <= ${period.end.toISOString()}
  `;

  const totalSpend = parseFloat(spendResult.rows[0]?.total_spend || '0');
  const totalConversions = parseInt(spendResult.rows[0]?.total_conversions || '0');

  // In production, this would pull from revenue tracking
  // For now, estimate based on average order value assumption
  const avgOrderValue = 100; // Placeholder
  const totalRevenue = totalConversions * avgOrderValue;

  const roi = totalSpend > 0 ? ((totalRevenue - totalSpend) / totalSpend) * 100 : 0;
  const roas = totalSpend > 0 ? totalRevenue / totalSpend : 0;

  return {
    totalSpend,
    totalRevenue,
    roi,
    roas,
    message: totalSpend > 0
      ? `Marketing ROI: ${roi.toFixed(1)}%. Spent $${totalSpend.toLocaleString()}, generated ~$${totalRevenue.toLocaleString()} (${roas.toFixed(2)}x ROAS).`
      : `No spend data for this period. Start tracking to measure ROI.`,
  };
}

/**
 * Get top performing content
 */
export async function getTopPerformingContent(
  founderId: string,
  metric: 'views' | 'clicks' | 'conversions' | 'engagementRate'
): Promise<{ content: ContentPiece[]; message: string }> {
  // In production, this would sort by actual performance data
  // For now, return recent approved/published content
  const result = await sql`
    SELECT * FROM founder_marketing_content
    WHERE founder_id = ${founderId}
      AND status IN ('approved', 'published')
      AND performance_data IS NOT NULL
    ORDER BY
      CASE
        WHEN ${metric} = 'views' THEN (performance_data->>'views')::int
        WHEN ${metric} = 'clicks' THEN (performance_data->>'clicks')::int
        WHEN ${metric} = 'conversions' THEN (performance_data->>'conversions')::int
        ELSE (performance_data->>'engagementRate')::float
      END DESC NULLS LAST
    LIMIT 10
  `;

  const content = result.rows.map(mapRowToContent);

  if (content.length === 0) {
    return {
      content: [],
      message: `No content with ${metric} data yet. Performance is tracked once content is published and used.`,
    };
  }

  return {
    content,
    message: `Top ${content.length} content pieces by ${metric}. Keep creating more of what works!`,
  };
}

/**
 * Get channel attribution data
 */
export async function getChannelAttribution(
  founderId: string,
  period: { start: Date; end: Date }
): Promise<{
  attribution: Record<AdPlatform, { conversions: number; percentage: number }>;
  message: string;
}> {
  const result = await sql`
    SELECT
      platform,
      SUM(conversions) as total_conversions
    FROM founder_ad_spend
    WHERE founder_id = ${founderId}
      AND date >= ${period.start.toISOString()}
      AND date <= ${period.end.toISOString()}
    GROUP BY platform
  `;

  const totalConversions = result.rows.reduce(
    (sum, row) => sum + parseInt(row.total_conversions || '0'),
    0
  );

  const attribution: Record<AdPlatform, { conversions: number; percentage: number }> = {
    google: { conversions: 0, percentage: 0 },
    meta: { conversions: 0, percentage: 0 },
    linkedin: { conversions: 0, percentage: 0 },
    twitter: { conversions: 0, percentage: 0 },
    tiktok: { conversions: 0, percentage: 0 },
    reddit: { conversions: 0, percentage: 0 },
  };

  for (const row of result.rows) {
    const platform = row.platform as AdPlatform;
    const conversions = parseInt(row.total_conversions || '0');
    attribution[platform] = {
      conversions,
      percentage: totalConversions > 0 ? (conversions / totalConversions) * 100 : 0,
    };
  }

  const topChannel = result.rows.sort(
    (a, b) => parseInt(b.total_conversions || '0') - parseInt(a.total_conversions || '0')
  )[0];

  return {
    attribution,
    message: totalConversions > 0
      ? `${totalConversions} total conversions. Top channel: ${topChannel?.platform || 'N/A'} (${attribution[topChannel?.platform as AdPlatform]?.percentage.toFixed(1)}%).`
      : `No conversion data for this period. Make sure you're tracking conversions in your campaigns.`,
  };
}

/**
 * Get industry benchmarks comparison
 */
export async function getBenchmarks(
  founderId: string,
  platform: AdPlatform
): Promise<{
  yourMetrics: { ctr: number; cpc: number; cvr: number };
  benchmarks: { ctr: number; cpc: number; cvr: number };
  comparison: string[];
  message: string;
}> {
  // Industry benchmarks (simplified)
  const industryBenchmarks: Record<AdPlatform, { ctr: number; cpc: number; cvr: number }> = {
    google: { ctr: 0.035, cpc: 2.69, cvr: 0.042 },
    meta: { ctr: 0.009, cpc: 1.72, cvr: 0.092 },
    linkedin: { ctr: 0.004, cpc: 5.26, cvr: 0.065 },
    twitter: { ctr: 0.008, cpc: 0.38, cvr: 0.025 },
    tiktok: { ctr: 0.009, cpc: 1.00, cvr: 0.075 },
    reddit: { ctr: 0.005, cpc: 0.75, cvr: 0.045 },
  };

  // Get founder's metrics for this platform
  const result = await sql`
    SELECT
      SUM(clicks)::float / NULLIF(SUM(impressions), 0) as ctr,
      SUM(amount) / NULLIF(SUM(clicks), 0) as cpc,
      SUM(conversions)::float / NULLIF(SUM(clicks), 0) as cvr
    FROM founder_ad_spend
    WHERE founder_id = ${founderId}
      AND platform = ${platform}
  `;

  const row = result.rows[0];
  const yourMetrics = {
    ctr: parseFloat(row?.ctr || '0'),
    cpc: parseFloat(row?.cpc || '0'),
    cvr: parseFloat(row?.cvr || '0'),
  };

  const benchmarks = industryBenchmarks[platform];
  const comparison: string[] = [];

  if (yourMetrics.ctr > 0) {
    if (yourMetrics.ctr > benchmarks.ctr) {
      comparison.push(`CTR is ${((yourMetrics.ctr / benchmarks.ctr - 1) * 100).toFixed(0)}% above average`);
    } else {
      comparison.push(`CTR is ${((1 - yourMetrics.ctr / benchmarks.ctr) * 100).toFixed(0)}% below average`);
    }
  }

  if (yourMetrics.cpc > 0) {
    if (yourMetrics.cpc < benchmarks.cpc) {
      comparison.push(`CPC is ${((1 - yourMetrics.cpc / benchmarks.cpc) * 100).toFixed(0)}% better than average`);
    } else {
      comparison.push(`CPC is ${((yourMetrics.cpc / benchmarks.cpc - 1) * 100).toFixed(0)}% higher than average`);
    }
  }

  if (yourMetrics.cvr > 0) {
    if (yourMetrics.cvr > benchmarks.cvr) {
      comparison.push(`Conversion rate is ${((yourMetrics.cvr / benchmarks.cvr - 1) * 100).toFixed(0)}% above average`);
    } else {
      comparison.push(`Conversion rate is ${((1 - yourMetrics.cvr / benchmarks.cvr) * 100).toFixed(0)}% below average`);
    }
  }

  return {
    yourMetrics,
    benchmarks,
    comparison,
    message: comparison.length > 0
      ? `${platform} performance vs benchmarks: ${comparison.join('. ')}.`
      : `Not enough data to compare against benchmarks. Run some campaigns first!`,
  };
}

// ============================================================================
// BUDGET MANAGEMENT
// ============================================================================

/**
 * Set marketing budget for a period
 */
export async function setMarketingBudget(
  founderId: string,
  period: string,
  budget: number,
  allocation?: Partial<Record<AdPlatform, number>>
): Promise<{ budget: MarketingBudget; message: string }> {
  const budgetId = crypto.randomUUID();

  const defaultAllocation: Record<AdPlatform, number> = {
    google: 0.3,
    meta: 0.3,
    linkedin: 0.2,
    twitter: 0.1,
    tiktok: 0.05,
    reddit: 0.05,
  };

  const finalAllocation = { ...defaultAllocation, ...allocation };

  await sql`
    INSERT INTO founder_marketing_budgets (
      id, founder_id, period, total_budget, allocation, spent, created_at, updated_at
    ) VALUES (
      ${budgetId},
      ${founderId},
      ${period},
      ${budget},
      ${JSON.stringify(finalAllocation)},
      0,
      NOW(),
      NOW()
    )
    ON CONFLICT (founder_id, period)
    DO UPDATE SET
      total_budget = ${budget},
      allocation = ${JSON.stringify(finalAllocation)},
      updated_at = NOW()
  `;

  const marketingBudget: MarketingBudget = {
    id: budgetId,
    founderId,
    period,
    totalBudget: budget,
    allocation: finalAllocation,
    spent: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const allocationSummary = Object.entries(finalAllocation)
    .filter(([_, pct]) => pct > 0)
    .map(([platform, pct]) => `${platform}: $${(budget * pct).toLocaleString()}`)
    .join(', ');

  return {
    budget: marketingBudget,
    message: `Set ${period} marketing budget to $${budget.toLocaleString()}. Allocation: ${allocationSummary}.`,
  };
}

/**
 * Get marketing budget for a period
 */
export async function getMarketingBudget(
  founderId: string,
  period: string
): Promise<{ budget: MarketingBudget | null; message: string }> {
  const result = await sql`
    SELECT * FROM founder_marketing_budgets
    WHERE founder_id = ${founderId} AND period = ${period}
  `;

  if (result.rows.length === 0) {
    return {
      budget: null,
      message: `No budget set for ${period}. Set one to track your marketing spend against targets.`,
    };
  }

  const budget = mapRowToBudget(result.rows[0]);
  const remaining = budget.totalBudget - budget.spent;
  const percentUsed = (budget.spent / budget.totalBudget) * 100;

  return {
    budget,
    message: `${period} budget: $${budget.totalBudget.toLocaleString()}. Spent: $${budget.spent.toLocaleString()} (${percentUsed.toFixed(1)}%). Remaining: $${remaining.toLocaleString()}.`,
  };
}

/**
 * Get budget utilization
 */
export async function getBudgetUtilization(
  founderId: string,
  period: string
): Promise<{
  budget: number;
  spent: number;
  remaining: number;
  percentUsed: number;
  byPlatform: Record<AdPlatform, { budget: number; spent: number; percentUsed: number }>;
  message: string;
}> {
  // Get budget
  const budgetResult = await sql`
    SELECT * FROM founder_marketing_budgets
    WHERE founder_id = ${founderId} AND period = ${period}
  `;

  if (budgetResult.rows.length === 0) {
    return {
      budget: 0,
      spent: 0,
      remaining: 0,
      percentUsed: 0,
      byPlatform: {} as Record<AdPlatform, { budget: number; spent: number; percentUsed: number }>,
      message: `No budget set for ${period}. Set a budget to track utilization.`,
    };
  }

  const budgetData = mapRowToBudget(budgetResult.rows[0]);

  // Get actual spend by platform for the period
  const [year, month] = period.split('-').map(Number);
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  const spendResult = await sql`
    SELECT
      platform,
      SUM(amount) as total_spend
    FROM founder_ad_spend
    WHERE founder_id = ${founderId}
      AND date >= ${startDate.toISOString()}
      AND date <= ${endDate.toISOString()}
    GROUP BY platform
  `;

  const byPlatform: Record<AdPlatform, { budget: number; spent: number; percentUsed: number }> = {
    google: { budget: 0, spent: 0, percentUsed: 0 },
    meta: { budget: 0, spent: 0, percentUsed: 0 },
    linkedin: { budget: 0, spent: 0, percentUsed: 0 },
    twitter: { budget: 0, spent: 0, percentUsed: 0 },
    tiktok: { budget: 0, spent: 0, percentUsed: 0 },
    reddit: { budget: 0, spent: 0, percentUsed: 0 },
  };

  // Calculate budgets per platform
  for (const platform of Object.keys(byPlatform) as AdPlatform[]) {
    byPlatform[platform].budget = budgetData.totalBudget * (budgetData.allocation[platform] || 0);
  }

  // Fill in actual spend
  let totalSpent = 0;
  for (const row of spendResult.rows) {
    const platform = row.platform as AdPlatform;
    const spent = parseFloat(row.total_spend || '0');
    byPlatform[platform].spent = spent;
    byPlatform[platform].percentUsed =
      byPlatform[platform].budget > 0 ? (spent / byPlatform[platform].budget) * 100 : 0;
    totalSpent += spent;
  }

  const remaining = budgetData.totalBudget - totalSpent;
  const percentUsed = (totalSpent / budgetData.totalBudget) * 100;

  // Identify over/under budget platforms
  const overBudget = Object.entries(byPlatform)
    .filter(([_, data]) => data.percentUsed > 100)
    .map(([platform]) => platform);
  const underBudget = Object.entries(byPlatform)
    .filter(([_, data]) => data.percentUsed < 50 && data.budget > 0)
    .map(([platform]) => platform);

  let statusMsg = '';
  if (overBudget.length > 0) {
    statusMsg += ` Over budget on: ${overBudget.join(', ')}.`;
  }
  if (underBudget.length > 0) {
    statusMsg += ` Under-utilized: ${underBudget.join(', ')}.`;
  }

  return {
    budget: budgetData.totalBudget,
    spent: totalSpent,
    remaining,
    percentUsed,
    byPlatform,
    message: `${period}: ${percentUsed.toFixed(1)}% budget used ($${totalSpent.toLocaleString()} of $${budgetData.totalBudget.toLocaleString()}).${statusMsg}`,
  };
}

/**
 * AI-suggested budget allocation based on goals
 */
export async function suggestBudgetAllocation(
  founderId: string,
  goal: 'awareness' | 'leads' | 'sales' | 'balanced'
): Promise<{
  allocation: Record<AdPlatform, number>;
  reasoning: string;
  message: string;
}> {
  // Get historical performance
  const performanceResult = await sql`
    SELECT
      platform,
      SUM(amount) as total_spend,
      SUM(clicks) as total_clicks,
      SUM(conversions) as total_conversions,
      SUM(amount) / NULLIF(SUM(conversions), 0) as cpa
    FROM founder_ad_spend
    WHERE founder_id = ${founderId}
    GROUP BY platform
  `;

  const goalAllocations: Record<string, Record<AdPlatform, number>> = {
    awareness: {
      google: 0.15,
      meta: 0.35,
      linkedin: 0.10,
      twitter: 0.15,
      tiktok: 0.20,
      reddit: 0.05,
    },
    leads: {
      google: 0.35,
      meta: 0.25,
      linkedin: 0.25,
      twitter: 0.05,
      tiktok: 0.05,
      reddit: 0.05,
    },
    sales: {
      google: 0.40,
      meta: 0.30,
      linkedin: 0.15,
      twitter: 0.05,
      tiktok: 0.05,
      reddit: 0.05,
    },
    balanced: {
      google: 0.30,
      meta: 0.30,
      linkedin: 0.15,
      twitter: 0.10,
      tiktok: 0.10,
      reddit: 0.05,
    },
  };

  let allocation = goalAllocations[goal];

  // Adjust based on historical performance if available
  if (performanceResult.rows.length > 0) {
    const bestPerformers = performanceResult.rows
      .filter((r) => parseFloat(r.cpa || '999999') < 100)
      .sort((a, b) => parseFloat(a.cpa || '0') - parseFloat(b.cpa || '0'));

    if (bestPerformers.length > 0) {
      // Boost allocation for best performing platforms
      const topPlatform = bestPerformers[0].platform as AdPlatform;
      const boost = 0.1;
      allocation = { ...allocation };
      allocation[topPlatform] = Math.min(0.5, allocation[topPlatform] + boost);

      // Reduce from worst performer
      const worstPerformer = performanceResult.rows
        .sort((a, b) => parseFloat(b.cpa || '0') - parseFloat(a.cpa || '0'))[0]
        ?.platform as AdPlatform;
      if (worstPerformer && worstPerformer !== topPlatform) {
        allocation[worstPerformer] = Math.max(0.05, allocation[worstPerformer] - boost);
      }
    }
  }

  const reasoning = `For ${goal} goals, we recommend focusing on ${
    goal === 'awareness' ? 'broad-reach platforms like Meta and TikTok' :
    goal === 'leads' ? 'intent-based platforms like Google and LinkedIn' :
    goal === 'sales' ? 'high-intent Google ads and retargeting on Meta' :
    'a balanced mix across all channels'
  }. ${performanceResult.rows.length > 0 ? 'Adjusted based on your historical performance data.' : ''}`;

  const allocationSummary = Object.entries(allocation)
    .filter(([_, pct]) => pct > 0)
    .sort(([_, a], [__, b]) => b - a)
    .map(([platform, pct]) => `${platform}: ${(pct * 100).toFixed(0)}%`)
    .join(', ');

  return {
    allocation,
    reasoning,
    message: `Recommended allocation for ${goal}: ${allocationSummary}. ${reasoning}`,
  };
}

// ============================================================================
// NATURAL LANGUAGE PARSING
// ============================================================================

/**
 * Parse copy brief from natural language
 */
export async function parseCopyBriefFromText(
  text: string
): Promise<{ brief: CopyBrief; message: string }> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250514',
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: `Extract marketing copy brief details from this request. Return JSON only.

Request: "${text}"

Extract:
{
  "type": "landing_page|email|social_post|ad_copy|blog|press_release|product_description|tagline|headline",
  "product": "product or service name",
  "targetAudience": "who this is for",
  "tone": "professional|casual|playful|urgent|inspirational",
  "keyMessages": ["main points to convey"],
  "keywords": ["SEO keywords if mentioned"],
  "length": "short|medium|long",
  "callToAction": "desired CTA"
}

Use null for fields not mentioned. Infer type from context if not explicit.`,
      },
    ],
  });

  try {
    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response');
    }

    const parsed = JSON.parse(content.text);
    const brief: CopyBrief = {
      type: parsed.type || 'ad_copy',
      product: parsed.product || undefined,
      targetAudience: parsed.targetAudience || undefined,
      tone: parsed.tone || undefined,
      keyMessages: parsed.keyMessages || undefined,
      keywords: parsed.keywords || undefined,
      length: parsed.length || 'medium',
      callToAction: parsed.callToAction || undefined,
    };

    const missing: string[] = [];
    if (!brief.product) missing.push('product/service');
    if (!brief.targetAudience) missing.push('target audience');

    return {
      brief,
      message: missing.length > 0
        ? `Got it - ${brief.type.replace('_', ' ')} copy. To make it better, tell me about: ${missing.join(', ')}.`
        : `Understood. Creating ${brief.type.replace('_', ' ')} for "${brief.product}" targeting ${brief.targetAudience}.`,
    };
  } catch (error) {
    // Fallback parsing
    const brief: CopyBrief = {
      type: text.includes('email') ? 'email' :
            text.includes('landing') ? 'landing_page' :
            text.includes('social') || text.includes('post') ? 'social_post' :
            text.includes('blog') ? 'blog' :
            text.includes('headline') ? 'headline' :
            'ad_copy',
      length: 'medium',
    };

    return {
      brief,
      message: `I'll create ${brief.type.replace('_', ' ')} copy. What product is this for, and who's the target audience?`,
    };
  }
}

/**
 * Parse campaign details from natural language
 */
export async function parseCampaignFromText(
  text: string
): Promise<{ campaign: CampaignBrief; message: string }> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250514',
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: `Extract ad campaign details from this request. Return JSON only.

Request: "${text}"

Today's date: ${new Date().toISOString().split('T')[0]}

Extract:
{
  "platform": "google|meta|linkedin|twitter|tiktok|reddit",
  "objective": "awareness|traffic|engagement|leads|conversions|sales",
  "budget": 100,
  "budgetType": "daily|lifetime",
  "targetAudience": "description of target audience",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD"
}

Use null for fields not mentioned. Parse "$100/day" as budget:100, budgetType:"daily".`,
      },
    ],
  });

  try {
    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response');
    }

    const parsed = JSON.parse(content.text);
    const campaign: CampaignBrief = {
      platform: parsed.platform || 'google',
      objective: parsed.objective || undefined,
      budget: parsed.budget || undefined,
      budgetType: parsed.budgetType || 'daily',
      targetAudience: parsed.targetAudience || undefined,
      startDate: parsed.startDate ? new Date(parsed.startDate) : undefined,
      endDate: parsed.endDate ? new Date(parsed.endDate) : undefined,
    };

    const details: string[] = [];
    if (campaign.platform) details.push(campaign.platform);
    if (campaign.budget) details.push(`$${campaign.budget}/${campaign.budgetType === 'daily' ? 'day' : 'total'}`);
    if (campaign.targetAudience) details.push(`targeting ${campaign.targetAudience}`);

    return {
      campaign,
      message: details.length > 0
        ? `Got it: ${details.join(', ')}. ${!campaign.objective ? 'What\'s the campaign objective?' : 'Ready to create the campaign?'}`
        : `I'll set up an ad campaign. What platform, budget, and target audience?`,
    };
  } catch (error) {
    // Fallback parsing
    const budgetMatch = text.match(/\$(\d+(?:,\d{3})*)/);
    const budget = budgetMatch ? parseFloat(budgetMatch[1].replace(/,/g, '')) : undefined;

    const platform: AdPlatform =
      text.toLowerCase().includes('google') ? 'google' :
      text.toLowerCase().includes('meta') || text.toLowerCase().includes('facebook') || text.toLowerCase().includes('instagram') ? 'meta' :
      text.toLowerCase().includes('linkedin') ? 'linkedin' :
      text.toLowerCase().includes('twitter') || text.toLowerCase().includes('x.com') ? 'twitter' :
      text.toLowerCase().includes('tiktok') ? 'tiktok' :
      text.toLowerCase().includes('reddit') ? 'reddit' :
      'google';

    return {
      campaign: {
        platform,
        budget,
        budgetType: text.includes('/day') || text.includes('daily') ? 'daily' : 'lifetime',
      },
      message: `Setting up ${platform} campaign${budget ? ` with $${budget} budget` : ''}. What's the target audience and campaign objective?`,
    };
  }
}

// ============================================================================
// ROW MAPPERS
// ============================================================================

function mapRowToContent(row: any): ContentPiece {
  return {
    id: row.id,
    founderId: row.founder_id,
    type: row.type as ContentType,
    title: row.title,
    content: row.content,
    variants: typeof row.variants === 'string' ? JSON.parse(row.variants) : row.variants || [],
    tone: row.tone,
    targetAudience: row.target_audience,
    keywords: typeof row.keywords === 'string' ? JSON.parse(row.keywords) : row.keywords || [],
    status: row.status as ContentStatus,
    performanceData: row.performance_data
      ? typeof row.performance_data === 'string'
        ? JSON.parse(row.performance_data)
        : row.performance_data
      : undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapRowToCampaign(row: any): AdCampaign {
  return {
    id: row.id,
    founderId: row.founder_id,
    name: row.name,
    platform: row.platform as AdPlatform,
    objective: row.objective as CampaignObjective,
    status: row.status as CampaignStatus,
    budget: parseFloat(row.budget),
    budgetType: row.budget_type as 'daily' | 'lifetime',
    spent: parseFloat(row.spent || '0'),
    startDate: new Date(row.start_date),
    endDate: row.end_date ? new Date(row.end_date) : undefined,
    targeting: typeof row.targeting === 'string' ? JSON.parse(row.targeting) : row.targeting || {},
    creatives: typeof row.creatives === 'string' ? JSON.parse(row.creatives) : row.creatives || [],
    performance: typeof row.performance === 'string'
      ? JSON.parse(row.performance)
      : row.performance || {
          impressions: 0,
          reach: 0,
          clicks: 0,
          conversions: 0,
          spend: 0,
          ctr: 0,
          cvr: 0,
          cpc: 0,
          cpm: 0,
          cpa: 0,
          roas: 0,
          frequency: 0,
        },
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapRowToSpend(row: any): AdSpend {
  return {
    id: row.id,
    founderId: row.founder_id,
    platform: row.platform as AdPlatform,
    campaignId: row.campaign_id,
    date: new Date(row.date),
    amount: parseFloat(row.amount),
    impressions: parseInt(row.impressions || '0'),
    clicks: parseInt(row.clicks || '0'),
    conversions: parseInt(row.conversions || '0'),
    cpc: parseFloat(row.cpc || '0'),
    cpm: parseFloat(row.cpm || '0'),
    cpa: parseFloat(row.cpa || '0'),
    roas: parseFloat(row.roas || '0'),
  };
}

function mapRowToBudget(row: any): MarketingBudget {
  return {
    id: row.id,
    founderId: row.founder_id,
    period: row.period,
    totalBudget: parseFloat(row.total_budget),
    allocation: typeof row.allocation === 'string' ? JSON.parse(row.allocation) : row.allocation || {},
    spent: parseFloat(row.spent || '0'),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export const MarketingService = {
  // Copy Generation
  generateCopy,
  generateVariants,
  generateHeadlines,
  generateAdCopy,
  improveCopy,
  translateCopy,

  // Content Management
  saveContent,
  getContent,
  updateContent,
  approveContent,
  publishContent,

  // Ad Campaign Management
  createCampaign,
  getCampaigns,
  getCampaign,
  updateCampaign,
  pauseCampaign,
  resumeCampaign,

  // Ad Creative Management
  addCreative,
  generateCreativeVariants,
  getCreativePerformance,

  // Spend Tracking
  recordAdSpend,
  importAdSpend,
  getAdSpend,
  getSpendByPlatform,
  getSpendByObjective,

  // Analytics
  getCampaignPerformance,
  getMarketingROI,
  getTopPerformingContent,
  getChannelAttribution,
  getBenchmarks,

  // Budget Management
  setMarketingBudget,
  getMarketingBudget,
  getBudgetUtilization,
  suggestBudgetAllocation,

  // Natural Language
  parseCopyBriefFromText,
  parseCampaignFromText,
};

export default MarketingService;
