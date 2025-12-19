/**
 * Seller Profile API
 * GET: Get seller profile
 * POST: Create/Update seller profile
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  getSellerProfileByUserId,
  createSellerProfile,
  updateSellerProfile,
  parseProfileUpdatesFromText,
} from '@/lib/seller/profile-service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await getSellerProfileByUserId(userId);

    if (!profile) {
      return NextResponse.json({
        success: true,
        profile: null,
        needsOnboarding: true,
      });
    }

    return NextResponse.json({
      success: true,
      profile,
    });
  } catch (error: any) {
    console.error('Error fetching seller profile:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch profile' },
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
    const { action, data, text } = body;

    // Parse from natural language if provided
    let profileData = data || {};
    if (text) {
      const parsed = parseProfileUpdatesFromText(text);
      profileData = { ...profileData, ...parsed };
    }

    // Check if profile exists
    const existing = await getSellerProfileByUserId(userId);

    if (existing) {
      // Update
      const updated = await updateSellerProfile(existing.id, profileData);
      return NextResponse.json({
        success: true,
        profile: updated,
        message: 'Profile updated.',
      });
    } else {
      // Create
      const created = await createSellerProfile(userId, profileData);
      return NextResponse.json({
        success: true,
        profile: created,
        message: `Great, I've set up your seller profile for ${created.companyName}. You can start receiving RFQs and reaching out to prospects.`,
      });
    }
  } catch (error: any) {
    console.error('Error updating seller profile:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update profile' },
      { status: 500 }
    );
  }
}
