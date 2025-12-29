/**
 * Job Application API - Submit applications to jobs
 *
 * POST /api/jobs/apply - Submit an application
 *
 * Body:
 * - workerId: Worker profile ID
 * - jobId: Job posting ID
 * - coverLetter: (optional) Cover letter
 * - generateCoverLetter: (optional) boolean - Auto-generate cover letter
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { workerService } from '@/lib/jobs/worker-service';
import mergeHris from '@/lib/hris/merge-hris-client';
import { recordPlacementFee } from '@/lib/jobs/placement-fee-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      workerId,
      jobId,
      coverLetter,
      generateCoverLetter = false,
      userId, // Alternative: can use userId instead of workerId
    } = body;

    // Validate required fields
    if (!jobId) {
      return NextResponse.json(
        {
          success: false,
          message: 'I need to know which job you want to apply to.',
        },
        { status: 400 }
      );
    }

    // Get worker profile
    let workerProfile;
    if (workerId) {
      workerProfile = await workerService.getProfile(workerId);
    } else if (userId) {
      workerProfile = await workerService.getProfileByUserId(userId);
    }

    if (!workerProfile) {
      return NextResponse.json(
        {
          success: false,
          message: "I couldn't find your worker profile. Let's set that up first.",
        },
        { status: 404 }
      );
    }

    // Get job details
    const jobResult = await sql`
      SELECT j.*, c.employer_name as connection_employer_name
      FROM hris_job_postings j
      LEFT JOIN hris_connections c ON j.connection_id = c.id
      WHERE j.id = ${jobId}
    `;

    if (jobResult.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "That job posting doesn't exist or has been removed.",
        },
        { status: 404 }
      );
    }

    const job = jobResult.rows[0];

    if (job.status !== 'open') {
      return NextResponse.json(
        {
          success: false,
          message: `This job is ${job.status}. Let me find you similar open positions.`,
        },
        { status: 400 }
      );
    }

    // Check if already applied
    const existingResult = await sql`
      SELECT a.* FROM hris_applications a
      JOIN hris_candidates c ON a.candidate_id = c.id
      WHERE a.job_posting_id = ${jobId}
        AND c.worker_profile_id = ${workerProfile.id}
    `;

    if (existingResult.rows.length > 0) {
      const existing = existingResult.rows[0];
      return NextResponse.json({
        success: false,
        message: `You already applied to this job on ${new Date(existing.applied_at).toLocaleDateString()}. Status: ${existing.status}`,
        existingApplication: {
          id: existing.id,
          status: existing.status,
          appliedAt: existing.applied_at,
        },
      });
    }

    // Generate cover letter if requested
    let finalCoverLetter = coverLetter;
    if (generateCoverLetter && !coverLetter) {
      try {
        // Generate a basic cover letter from worker profile and job
        const employerName = job.employer_name || job.connection_employer_name;
        finalCoverLetter = generateBasicCoverLetter(workerProfile, job, employerName);
      } catch (error) {
        console.error('Error generating cover letter:', error);
        // Continue without cover letter
      }
    }

    // Submit application
    const application = await workerService.applyToJob(
      workerProfile.id,
      jobId,
      finalCoverLetter
    );

    // Log analytics event
    await sql`
      INSERT INTO analytics_events (
        event_type, entity_type, entity_id, user_id, metadata
      ) VALUES (
        'job_application_submitted',
        'application',
        ${application.id},
        ${workerProfile.userId},
        ${JSON.stringify({
          jobId,
          jobTitle: job.title,
          employerName: job.employer_name || job.connection_employer_name,
          hasCoverLetter: !!finalCoverLetter,
          coverLetterGenerated: generateCoverLetter && !coverLetter,
        })}
      )
    `.catch(() => {}); // Don't fail if analytics fails

    const employerName = job.employer_name || job.connection_employer_name;

    return NextResponse.json({
      success: true,
      message: `Applied to ${job.title} at ${employerName}! I'll let you know when they respond.`,
      application: {
        id: application.id,
        jobId: application.jobId,
        status: application.status,
        appliedAt: application.appliedAt,
        hasCoverLetter: !!finalCoverLetter,
      },
      job: {
        id: job.id,
        title: job.title,
        employerName,
        location: job.location,
        locationType: job.location_type,
      },
    });
  } catch (error) {
    console.error('Error submitting application:', error);
    return NextResponse.json(
      {
        success: false,
        message: "I couldn't submit that application. Let me try again.",
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Generate a basic cover letter based on worker profile and job
 */
function generateBasicCoverLetter(
  worker: any,
  job: any,
  employerName: string
): string {
  const workerSkills = worker.skills || [];
  const jobSkills = (job.skills || []) as string[];

  // Find matching skills
  const matchedSkills = workerSkills.filter((ws: string) =>
    jobSkills.some((js: string) =>
      js.toLowerCase().includes(ws.toLowerCase()) || ws.toLowerCase().includes(js.toLowerCase())
    )
  );

  const skillHighlight = matchedSkills.length > 0
    ? `My expertise in ${matchedSkills.slice(0, 3).join(', ')} aligns well with this role's requirements.`
    : '';

  const experienceHighlight = worker.experienceYears
    ? `With ${worker.experienceYears} years of professional experience, I bring proven expertise to this position.`
    : '';

  const trackRecord = worker.completedTasks > 0
    ? `I have successfully completed ${worker.completedTasks} projects with a ${worker.averageRating?.toFixed(1) || 'strong'}-star rating.`
    : '';

  const coverLetter = `
Dear ${employerName} Hiring Team,

I am writing to express my strong interest in the ${job.title} position.

${skillHighlight}

${experienceHighlight}

${trackRecord}

${worker.bio || `I am a dedicated professional committed to delivering high-quality work and contributing to team success.`}

I am excited about the opportunity to contribute to ${employerName} and would welcome the chance to discuss how my skills and experience align with your needs.

Best regards,
${worker.displayName}
`.trim();

  return coverLetter;
}

/**
 * GET /api/jobs/apply - Check application eligibility
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const workerId = searchParams.get('workerId');
    const userId = searchParams.get('userId');
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json(
        {
          success: false,
          message: 'Job ID is required',
        },
        { status: 400 }
      );
    }

    // Get worker profile
    let workerProfile;
    if (workerId) {
      workerProfile = await workerService.getProfile(workerId);
    } else if (userId) {
      workerProfile = await workerService.getProfileByUserId(userId);
    }

    if (!workerProfile) {
      return NextResponse.json({
        success: true,
        canApply: false,
        reason: 'no_profile',
        message: 'You need to create a worker profile before applying.',
      });
    }

    // Get job details
    const jobResult = await sql`
      SELECT j.*, c.employer_name as connection_employer_name
      FROM hris_job_postings j
      LEFT JOIN hris_connections c ON j.connection_id = c.id
      WHERE j.id = ${jobId}
    `;

    if (jobResult.rows.length === 0) {
      return NextResponse.json({
        success: true,
        canApply: false,
        reason: 'job_not_found',
        message: 'This job posting no longer exists.',
      });
    }

    const job = jobResult.rows[0];

    if (job.status !== 'open') {
      return NextResponse.json({
        success: true,
        canApply: false,
        reason: 'job_closed',
        message: `This job is ${job.status}.`,
      });
    }

    // Check if already applied
    const existingResult = await sql`
      SELECT a.* FROM hris_applications a
      JOIN hris_candidates c ON a.candidate_id = c.id
      WHERE a.job_posting_id = ${jobId}
        AND c.worker_profile_id = ${workerProfile.id}
    `;

    if (existingResult.rows.length > 0) {
      const existing = existingResult.rows[0];
      return NextResponse.json({
        success: true,
        canApply: false,
        reason: 'already_applied',
        message: 'You have already applied to this job.',
        existingApplication: {
          id: existing.id,
          status: existing.status,
          appliedAt: existing.applied_at,
        },
      });
    }

    // Calculate match score
    const workerSkills = (workerProfile.skills || []).map((s: string) => s.toLowerCase());
    const jobSkills = ((job.skills || []) as string[]).map((s: string) => s.toLowerCase());

    let matchScore = 0;
    const matchedSkills = workerSkills.filter((ws: string) =>
      jobSkills.some((js: string) => js.includes(ws) || ws.includes(js))
    );

    if (jobSkills.length > 0) {
      matchScore = Math.round((matchedSkills.length / jobSkills.length) * 100);
    }

    return NextResponse.json({
      success: true,
      canApply: true,
      matchScore,
      matchedSkills,
      missingSkills: jobSkills.filter(js =>
        !matchedSkills.some(ms => js.includes(ms) || ms.includes(js))
      ),
      job: {
        id: job.id,
        title: job.title,
        employerName: job.employer_name || job.connection_employer_name,
        location: job.location,
        locationType: job.location_type,
        skills: job.skills || [],
      },
      worker: {
        id: workerProfile.id,
        displayName: workerProfile.displayName,
        skills: workerProfile.skills,
      },
    });
  } catch (error) {
    console.error('Error checking application eligibility:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Error checking eligibility',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
