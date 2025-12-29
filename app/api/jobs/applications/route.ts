/**
 * Applications API - Track and manage job applications
 *
 * GET /api/jobs/applications - List applications for a worker
 * GET /api/jobs/applications?applicationId=xxx - Get specific application
 * PUT /api/jobs/applications - Withdraw an application
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { workerService } from '@/lib/jobs/worker-service';
import { recordPlacementFee } from '@/lib/jobs/placement-fee-service';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const workerId = searchParams.get('workerId');
    const userId = searchParams.get('userId');
    const applicationId = searchParams.get('applicationId');
    const status = searchParams.get('status'); // Filter by status
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Get specific application
    if (applicationId) {
      const result = await sql`
        SELECT
          a.*,
          j.title as job_title,
          j.description as job_description,
          j.employer_name,
          j.location,
          j.location_type,
          j.salary_min,
          j.salary_max,
          j.salary_currency,
          j.salary_period,
          j.skills as job_skills,
          c.first_name || ' ' || c.last_name as candidate_name,
          c.worker_profile_id
        FROM hris_applications a
        JOIN hris_job_postings j ON a.job_posting_id = j.id
        JOIN hris_candidates c ON a.candidate_id = c.id
        WHERE a.id = ${applicationId}
      `;

      if (result.rows.length === 0) {
        return NextResponse.json(
          {
            success: false,
            message: "I couldn't find that application.",
          },
          { status: 404 }
        );
      }

      const app = result.rows[0];

      // Get status message
      const statusMessages: Record<string, string> = {
        applied: 'Your application has been submitted and is waiting for review.',
        screening: 'The employer is reviewing your application.',
        phone_screen: 'They want to schedule a phone screen with you!',
        interview: 'You have an interview coming up!',
        final_interview: "You're in the final interview stage!",
        offer: 'Congratulations! You received an offer!',
        offer_accepted: 'Offer accepted! The onboarding process will begin soon.',
        hired: 'Welcome to your new role!',
        rejected: 'Unfortunately, they decided to go another direction.',
        withdrawn: 'This application was withdrawn.',
      };

      return NextResponse.json({
        success: true,
        application: {
          id: app.id,
          remoteId: app.remote_id,
          status: app.status,
          statusMessage: statusMessages[app.status] || `Status: ${app.status}`,
          source: app.source,
          coverLetter: app.cover_letter,
          appliedAt: app.applied_at,
          screenedAt: app.screened_at,
          interviewedAt: app.interviewed_at,
          offeredAt: app.offered_at,
          hiredAt: app.hired_at,
          rejectedAt: app.rejected_at,
          rejectedReason: app.rejected_reason,
          createdAt: app.created_at,
          updatedAt: app.updated_at,
        },
        job: {
          id: app.job_posting_id,
          title: app.job_title,
          description: app.job_description,
          employerName: app.employer_name,
          location: app.location,
          locationType: app.location_type,
          salary: app.salary_min ? {
            min: app.salary_min,
            max: app.salary_max,
            currency: app.salary_currency || 'USD',
            period: app.salary_period || 'annual',
          } : undefined,
          skills: app.job_skills || [],
        },
      });
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
          message: 'Worker profile required to list applications.',
        },
        { status: 400 }
      );
    }

    // Build query conditions
    const conditions = ['c.worker_profile_id = $1'];
    const values: unknown[] = [workerProfile.id];
    let paramIndex = 2;

    if (status) {
      conditions.push(`a.status = $${paramIndex}`);
      values.push(status);
      paramIndex++;
    }

    // Get total count
    const countResult = await sql.query(
      `SELECT COUNT(*) as total
       FROM hris_applications a
       JOIN hris_candidates c ON a.candidate_id = c.id
       WHERE ${conditions.join(' AND ')}`,
      values
    );

    // Get applications
    values.push(limit, offset);
    const result = await sql.query(
      `SELECT
        a.*,
        j.title as job_title,
        j.employer_name,
        j.location,
        j.location_type,
        j.salary_min,
        j.salary_max,
        j.salary_currency,
        j.skills as job_skills,
        conn.provider as hris_provider
      FROM hris_applications a
      JOIN hris_candidates c ON a.candidate_id = c.id
      JOIN hris_job_postings j ON a.job_posting_id = j.id
      LEFT JOIN hris_connections conn ON j.connection_id = conn.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY a.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      values
    );

    // Group by status for summary
    const statusCounts: Record<string, number> = {
      applied: 0,
      screening: 0,
      phone_screen: 0,
      interview: 0,
      final_interview: 0,
      offer: 0,
      offer_accepted: 0,
      hired: 0,
      rejected: 0,
      withdrawn: 0,
    };

    const applications = result.rows.map(app => {
      statusCounts[app.status] = (statusCounts[app.status] || 0) + 1;

      return {
        id: app.id,
        remoteId: app.remote_id,
        status: app.status,
        source: app.source,
        appliedAt: app.applied_at,
        screenedAt: app.screened_at,
        interviewedAt: app.interviewed_at,
        offeredAt: app.offered_at,
        hiredAt: app.hired_at,
        rejectedAt: app.rejected_at,
        job: {
          id: app.job_posting_id,
          title: app.job_title,
          employerName: app.employer_name,
          location: app.location,
          locationType: app.location_type,
          salary: app.salary_min ? {
            min: app.salary_min,
            max: app.salary_max,
            currency: app.salary_currency || 'USD',
          } : undefined,
          skills: app.job_skills || [],
          hrisProvider: app.hris_provider,
        },
      };
    });

    const total = parseInt(countResult.rows[0].total);

    // Generate summary message
    let message = `You have ${total} application${total !== 1 ? 's' : ''}`;
    const activeCount = statusCounts.applied + statusCounts.screening +
                       statusCounts.phone_screen + statusCounts.interview +
                       statusCounts.final_interview + statusCounts.offer;
    if (activeCount > 0) {
      message += ` (${activeCount} active)`;
    }
    if (statusCounts.offer > 0) {
      message += `. ${statusCounts.offer} offer${statusCounts.offer !== 1 ? 's' : ''} pending!`;
    }

    return NextResponse.json({
      success: true,
      message,
      applications,
      summary: {
        total,
        active: activeCount,
        offers: statusCounts.offer,
        hired: statusCounts.hired,
        rejected: statusCounts.rejected,
        withdrawn: statusCounts.withdrawn,
        byStatus: statusCounts,
      },
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error('Error listing applications:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'I had trouble loading your applications.',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/jobs/applications - Withdraw application or accept/decline offer
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { applicationId, action, reason } = body;

    if (!applicationId) {
      return NextResponse.json(
        {
          success: false,
          message: 'Application ID is required.',
        },
        { status: 400 }
      );
    }

    if (!action || !['withdraw', 'accept_offer', 'decline_offer'].includes(action)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Valid action required: withdraw, accept_offer, or decline_offer',
        },
        { status: 400 }
      );
    }

    // Get current application
    const current = await sql`
      SELECT
        a.*,
        j.title as job_title,
        j.employer_name,
        c.worker_profile_id,
        c.user_id
      FROM hris_applications a
      JOIN hris_job_postings j ON a.job_posting_id = j.id
      JOIN hris_candidates c ON a.candidate_id = c.id
      WHERE a.id = ${applicationId}
    `;

    if (current.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "I couldn't find that application.",
        },
        { status: 404 }
      );
    }

    const app = current.rows[0];

    // Handle different actions
    if (action === 'withdraw') {
      // Can only withdraw if not already hired or withdrawn
      if (['hired', 'withdrawn'].includes(app.status)) {
        return NextResponse.json(
          {
            success: false,
            message: `Cannot withdraw - application is already ${app.status}.`,
          },
          { status: 400 }
        );
      }

      await sql`
        UPDATE hris_applications
        SET status = 'withdrawn',
            rejected_reason = ${reason || 'Withdrawn by candidate'},
            updated_at = NOW()
        WHERE id = ${applicationId}
      `;

      return NextResponse.json({
        success: true,
        message: `Withdrawn from ${app.job_title} at ${app.employer_name}.`,
        application: {
          id: applicationId,
          status: 'withdrawn',
        },
      });
    }

    if (action === 'accept_offer') {
      if (app.status !== 'offer') {
        return NextResponse.json(
          {
            success: false,
            message: `Cannot accept - application status is ${app.status}, not 'offer'.`,
          },
          { status: 400 }
        );
      }

      await sql`
        UPDATE hris_applications
        SET status = 'offer_accepted',
            updated_at = NOW()
        WHERE id = ${applicationId}
      `;

      // Record placement fee (1% of salary)
      try {
        // Get job salary info
        const jobResult = await sql`
          SELECT * FROM hris_job_postings WHERE id = ${app.job_posting_id}
        `;

        if (jobResult.rows.length > 0 && jobResult.rows[0].salary_min) {
          const salary = jobResult.rows[0].salary_max || jobResult.rows[0].salary_min;
          await recordPlacementFee({
            workerId: app.worker_profile_id,
            jobId: app.job_posting_id,
            applicationId,
            employerId: jobResult.rows[0].employer_id,
            employerName: app.employer_name,
            salary,
            startDate: new Date(),
          });
        }
      } catch (feeError) {
        console.error('Error recording placement fee:', feeError);
        // Don't fail the request
      }

      return NextResponse.json({
        success: true,
        message: `Congratulations! You accepted the offer for ${app.job_title} at ${app.employer_name}!`,
        application: {
          id: applicationId,
          status: 'offer_accepted',
        },
      });
    }

    if (action === 'decline_offer') {
      if (app.status !== 'offer') {
        return NextResponse.json(
          {
            success: false,
            message: `Cannot decline - application status is ${app.status}, not 'offer'.`,
          },
          { status: 400 }
        );
      }

      await sql`
        UPDATE hris_applications
        SET status = 'rejected',
            rejected_at = NOW(),
            rejected_reason = ${reason || 'Offer declined by candidate'},
            updated_at = NOW()
        WHERE id = ${applicationId}
      `;

      return NextResponse.json({
        success: true,
        message: `Declined the offer from ${app.employer_name}. Let me find you other opportunities.`,
        application: {
          id: applicationId,
          status: 'rejected',
        },
      });
    }

    return NextResponse.json(
      {
        success: false,
        message: 'Invalid action.',
      },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error updating application:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'I had trouble updating that application.',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/jobs/applications - Withdraw application (alternative method)
 */
export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const applicationId = searchParams.get('applicationId');

  if (!applicationId) {
    return NextResponse.json(
      {
        success: false,
        message: 'Application ID is required.',
      },
      { status: 400 }
    );
  }

  // Delegate to PUT handler with withdraw action
  const putRequest = new NextRequest(request.url, {
    method: 'PUT',
    body: JSON.stringify({ applicationId, action: 'withdraw' }),
    headers: request.headers,
  });

  return PUT(putRequest);
}
