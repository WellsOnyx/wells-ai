import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * POST /api/partners/recommend
 *
 * Finds partner recommendations based on conversation context
 * Used by Wells AI to recommend partners during conversations
 */
export async function POST(request: Request) {
  try {
    const { userId, context } = await request.json();

    if (!userId || !context) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, context' },
        { status: 400 }
      );
    }

    // Convert context to lowercase for matching
    const contextLower = context.toLowerCase();

    // Find active partners with matching recommendation triggers
    const partners = await prisma.partner.findMany({
      where: {
        status: 'active',
        partnershipType: 'Referral',
        referralUrl: { not: null },
        recommendationTriggers: { isEmpty: false }
      },
      select: {
        id: true,
        name: true,
        referralUrl: true,
        referralCategory: true,
        partnerDescription: true,
        recommendationTriggers: true,
        website: true
      }
    });

    // Score partners based on trigger matches
    const scoredPartners = partners
      .map(partner => {
        const matchedTriggers = partner.recommendationTriggers.filter(trigger =>
          contextLower.includes(trigger.toLowerCase())
        );

        return {
          ...partner,
          matchScore: matchedTriggers.length,
          matchedTriggers
        };
      })
      .filter(p => p.matchScore > 0)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 3); // Return top 3 matches

    // If we have matches, create referral tracking records
    if (scoredPartners.length > 0) {
      // Create referral records for tracking
      await Promise.all(
        scoredPartners.map(partner =>
          prisma.partnerReferral.create({
            data: {
              userId,
              partnerId: partner.id,
              referralUrl: partner.referralUrl!,
              context: context.substring(0, 1000), // Limit context length
              status: 'pending'
            }
          })
        )
      );
    }

    return NextResponse.json({
      recommendations: scoredPartners.map(p => ({
        partnerId: p.id,
        name: p.name,
        category: p.referralCategory,
        description: p.partnerDescription,
        referralUrl: p.referralUrl,
        website: p.website,
        matchScore: p.matchScore,
        matchedKeywords: p.matchedTriggers
      })),
      count: scoredPartners.length
    });

  } catch (error) {
    console.error('Error finding partner recommendations:', error);
    return NextResponse.json(
      { error: 'Failed to find recommendations' },
      { status: 500 }
    );
  }
}
