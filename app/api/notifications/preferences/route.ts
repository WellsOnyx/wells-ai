/**
 * Notification Preferences API
 *
 * GET /api/notifications/preferences - Get user preferences
 * PUT /api/notifications/preferences - Update user preferences
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getPreferences,
  updatePreferences,
  UpdatePreferencesInput,
} from '@/lib/notifications/preferences';

/**
 * GET /api/notifications/preferences
 */
export async function GET(request: NextRequest) {
  try {
    // TODO: Get userId from auth
    // const { user } = await auth(request);
    // if (!user) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    const userId = request.nextUrl.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    const preferences = await getPreferences(userId);

    return NextResponse.json({
      success: true,
      preferences,
    });
  } catch (error) {
    console.error('Error getting preferences:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/notifications/preferences
 */
export async function PUT(request: NextRequest) {
  try {
    // TODO: Get userId from auth
    // const { user } = await auth(request);
    // if (!user) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    const body = await request.json();
    const { userId, ...updates } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    const preferences = await updatePreferences(
      userId,
      updates as UpdatePreferencesInput
    );

    return NextResponse.json({
      success: true,
      preferences,
    });
  } catch (error) {
    console.error('Error updating preferences:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/notifications/preferences/opt-out
 *
 * Quick opt-out endpoints
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, type = 'all' } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    if (type === 'all') {
      await updatePreferences(userId, {
        emailEnabled: false,
        smsEnabled: false,
        pushEnabled: false,
        paymentNotifications: false,
        creditNotifications: false,
        marketingNotifications: false,
        transactionAlerts: false,
        partnerUpdates: false,
        securityAlerts: true, // Keep security alerts
      });
    } else if (type === 'marketing') {
      await updatePreferences(userId, {
        marketingNotifications: false,
        partnerUpdates: false,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Opted out of ${type} notifications`,
    });
  } catch (error) {
    console.error('Error opting out:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
