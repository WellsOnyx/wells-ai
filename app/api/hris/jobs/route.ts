/**
 * HRIS Jobs API
 *
 * Get and search job postings from connected HRIS systems
 *
 * GET - Search job postings with filters
 * POST - Enrich job posting with salary/skills data
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getJobPostings,
  enrichJobPosting,
} from '@/lib/hris/merge-hris-client';
import {
  findMatchingJobs,
  getCandidateProfile,
} from '@/lib/jobs/candidate-agent';

// Search job postings
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const userId = searchParams.get('userId');
    const connectionId = searchParams.get('connectionId');
    const employerId = searchParams.get('employerId');
    const search = searchParams.get('search');
    const skills = searchParams.get('skills');
    const location = searchParams.get('location');
    const salaryMin = searchParams.get('salaryMin');
    const locationType = searchParams.get('locationType') as 'remote' | 'onsite' | 'hybrid' | null;
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const matchForUser = searchParams.get('matchForUser') === 'true';

    // If matching for user, use the candidate agent
    if (matchForUser && userId) {
      const minMatchScore = parseInt(searchParams.get('minMatchScore') || '50');

      const result = await findMatchingJobs(userId, {
        limit,
        minMatchScore,
      });

      return NextResponse.json({
        success: result.success,
        message: result.message,
        jobs: result.matches.map(m => ({
          ...m.job,
          matchScore: m.matchScore,
          matchReasons: m.matchReasons,
          concerns: m.concerns,
          recommendation: m.recommendation,
        })),
        total: result.totalMatches,
      });
    }

    // Standard job search
    const result = await getJobPostings({
      connectionId: connectionId || undefined,
      employerId: employerId || undefined,
      search: search || undefined,
      skills: skills ? skills.split(',') : undefined,
      location: location || undefined,
      salaryMin: salaryMin ? parseInt(salaryMin) : undefined,
      locationType: locationType || undefined,
      limit,
      offset,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in HRIS jobs GET:', error);
    return NextResponse.json({
      success: false,
      message: "I had trouble searching for jobs.",
      jobs: [],
      total: 0,
    }, { status: 500 });
  }
}

// Enrich job posting
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobId, enrichment } = body;

    if (!jobId || !enrichment) {
      return NextResponse.json({
        success: false,
        message: "I need a job ID and enrichment data.",
      }, { status: 400 });
    }

    const result = await enrichJobPosting(jobId, enrichment);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in HRIS jobs POST:', error);
    return NextResponse.json({
      success: false,
      message: "I couldn't update the job posting.",
    }, { status: 500 });
  }
}

// Parse natural language job search
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, userId } = body;

    if (!query) {
      return NextResponse.json({
        success: false,
        message: "What kind of job are you looking for?",
      }, { status: 400 });
    }

    // Parse the query for search parameters
    const { parseJobPreferences } = await import('@/lib/jobs/candidate-agent');
    const preferences = parseJobPreferences(query);

    // If user provided, update their preferences and search with them
    if (userId) {
      const profile = await getCandidateProfile(userId);

      const result = await findMatchingJobs(userId, {
        limit: 10,
        minMatchScore: 40,
      });

      return NextResponse.json({
        success: result.success,
        message: result.message,
        parsedPreferences: preferences,
        jobs: result.matches.map(m => ({
          ...m.job,
          matchScore: m.matchScore,
          matchReasons: m.matchReasons,
          recommendation: m.recommendation,
        })),
        total: result.totalMatches,
      });
    }

    // Search without user context
    const result = await getJobPostings({
      search: preferences.titles?.join(' OR '),
      skills: preferences.titles,
      location: preferences.locations?.[0],
      salaryMin: preferences.salary?.min,
      locationType: preferences.remote ? 'remote' : undefined,
      limit: 20,
    });

    return NextResponse.json({
      success: result.success,
      message: result.message,
      parsedPreferences: preferences,
      jobs: result.jobs,
      total: result.total,
    });
  } catch (error) {
    console.error('Error in HRIS jobs PUT:', error);
    return NextResponse.json({
      success: false,
      message: "I had trouble understanding that search.",
    }, { status: 500 });
  }
}
