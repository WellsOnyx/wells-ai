/**
 * HRIS Candidate API
 *
 * Manage candidate profiles for job seekers
 *
 * GET - Get candidate profile
 * POST - Create/update candidate profile
 * PUT - Update constraints/preferences
 * DELETE - Deactivate candidate profile
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  saveCandidateProfile,
  getCandidateProfile,
  updateConstraints,
  parseJobPreferences,
} from '@/lib/jobs/candidate-agent';

// Get candidate profile
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({
        success: false,
        message: "I need your user ID to find your profile.",
      }, { status: 400 });
    }

    const result = await getCandidateProfile(userId);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in HRIS candidate GET:', error);
    return NextResponse.json({
      success: false,
      message: "I had trouble fetching your profile.",
    }, { status: 500 });
  }
}

// Create or update candidate profile
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, ...profileData } = body;

    if (!userId) {
      return NextResponse.json({
        success: false,
        message: "I need your user ID to save your profile.",
      }, { status: 400 });
    }

    // Parse natural language if provided
    if (body.naturalLanguageInput) {
      const preferences = parseJobPreferences(body.naturalLanguageInput);

      // Merge parsed preferences with explicit data
      if (preferences.titles && !profileData.desiredTitles) {
        profileData.desiredTitles = preferences.titles;
      }
      if (preferences.salary) {
        if (!profileData.constraints) profileData.constraints = {};
        if (preferences.salary.min && !profileData.constraints.minSalary) {
          profileData.constraints.minSalary = preferences.salary.min;
        }
        if (preferences.salary.target && !profileData.constraints.targetSalary) {
          profileData.constraints.targetSalary = preferences.salary.target;
        }
      }
      if (preferences.locations) {
        if (!profileData.constraints) profileData.constraints = {};
        if (!profileData.constraints.locations) {
          profileData.constraints.locations = preferences.locations;
        }
      }
      if (preferences.remote !== undefined) {
        if (!profileData.constraints) profileData.constraints = {};
        profileData.constraints.remotePreference = preferences.remote ? 'remote_only' : 'flexible';
      }
      if (preferences.excludeCompanies) {
        if (!profileData.constraints) profileData.constraints = {};
        profileData.constraints.excludeCompanies = preferences.excludeCompanies;
      }
    }

    const result = await saveCandidateProfile(userId, profileData);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in HRIS candidate POST:', error);
    return NextResponse.json({
      success: false,
      message: "I had trouble saving your profile.",
    }, { status: 500 });
  }
}

// Update constraints
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, constraints, naturalLanguageInput } = body;

    if (!userId) {
      return NextResponse.json({
        success: false,
        message: "I need your user ID to update your preferences.",
      }, { status: 400 });
    }

    let parsedConstraints = constraints || {};

    // Parse natural language if provided
    if (naturalLanguageInput) {
      const preferences = parseJobPreferences(naturalLanguageInput);

      if (preferences.salary?.min) {
        parsedConstraints.minSalary = preferences.salary.min;
      }
      if (preferences.salary?.target) {
        parsedConstraints.targetSalary = preferences.salary.target;
      }
      if (preferences.locations) {
        parsedConstraints.locations = preferences.locations;
      }
      if (preferences.remote !== undefined) {
        parsedConstraints.remotePreference = preferences.remote ? 'remote_only' : 'flexible';
      }
      if (preferences.excludeCompanies) {
        parsedConstraints.excludeCompanies = preferences.excludeCompanies;
      }
    }

    const result = await updateConstraints(userId, parsedConstraints);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in HRIS candidate PUT:', error);
    return NextResponse.json({
      success: false,
      message: "I had trouble updating your preferences.",
    }, { status: 500 });
  }
}

// Deactivate profile
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({
        success: false,
        message: "I need your user ID to deactivate your profile.",
      }, { status: 400 });
    }

    // Import query from db
    const { query } = await import('@/lib/db');

    await query(
      `UPDATE candidate_profiles SET
        auto_apply_enabled = false,
        notify_on_new_matches = false,
        updated_at = NOW()
       WHERE user_id = $1`,
      [userId]
    );

    return NextResponse.json({
      success: true,
      message: "Your job search is paused. I'll stop looking for roles and won't apply to anything new. Let me know when you're ready to resume!",
    });
  } catch (error) {
    console.error('Error in HRIS candidate DELETE:', error);
    return NextResponse.json({
      success: false,
      message: "I had trouble deactivating your profile.",
    }, { status: 500 });
  }
}
