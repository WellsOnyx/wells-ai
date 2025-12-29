/**
 * HRIS Apply API
 *
 * Apply to jobs on behalf of candidates
 *
 * POST - Apply to a single job
 * PUT - Bulk apply to multiple jobs
 * GET - Get application status
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  applyToJob,
  bulkApply,
  getApplicationStatus,
} from '@/lib/jobs/candidate-agent';

// Apply to a single job
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, jobId, coverLetter, customMessage } = body;

    if (!userId || !jobId) {
      return NextResponse.json({
        success: false,
        message: "I need your user ID and the job ID to apply.",
      }, { status: 400 });
    }

    const result = await applyToJob(userId, jobId, {
      coverLetter,
      customMessage,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in HRIS apply POST:', error);
    return NextResponse.json({
      success: false,
      message: "I had trouble submitting that application.",
    }, { status: 500 });
  }
}

// Bulk apply to jobs
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      jobIds,
      excludeEmployers,
      minMatchScore,
      maxApplications,
      autoApplyMatches,
    } = body;

    if (!userId) {
      return NextResponse.json({
        success: false,
        message: "I need your user ID to apply to jobs.",
      }, { status: 400 });
    }

    const result = await bulkApply(userId, {
      jobIds,
      excludeEmployers,
      minMatchScore,
      maxApplications,
      autoApplyMatches,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in HRIS apply PUT:', error);
    return NextResponse.json({
      success: false,
      message: "I had trouble with the bulk applications.",
      applied: 0,
      skipped: 0,
      errors: 0,
      applications: [],
    }, { status: 500 });
  }
}

// Get application status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const statusFilter = searchParams.get('status');

    if (!userId) {
      return NextResponse.json({
        success: false,
        message: "I need your user ID to check your applications.",
      }, { status: 400 });
    }

    const result = await getApplicationStatus(userId);

    // Filter by status if requested
    if (statusFilter && result.applications) {
      const statuses = statusFilter.split(',');
      result.applications = result.applications.filter(a =>
        statuses.includes(a.status)
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in HRIS apply GET:', error);
    return NextResponse.json({
      success: false,
      message: "I had trouble fetching your application status.",
      summary: { total: 0, active: 0, interviewing: 0, offers: 0, rejected: 0 },
      applications: [],
    }, { status: 500 });
  }
}

// Withdraw application
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const applicationId = searchParams.get('applicationId');
    const userId = searchParams.get('userId');

    if (!applicationId || !userId) {
      return NextResponse.json({
        success: false,
        message: "I need the application ID and user ID to withdraw.",
      }, { status: 400 });
    }

    // Import from HRIS client
    const { updateApplicationStatus } = await import('@/lib/hris/merge-hris-client');

    const result = await updateApplicationStatus(applicationId, 'withdrawn');

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in HRIS apply DELETE:', error);
    return NextResponse.json({
      success: false,
      message: "I had trouble withdrawing that application.",
    }, { status: 500 });
  }
}
