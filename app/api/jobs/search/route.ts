/**
 * Job Search API - Search jobs across connected HRIS systems
 *
 * GET /api/jobs/search - Search for jobs
 *
 * Query parameters:
 * - q: Search query (searches title, description)
 * - skills: Comma-separated list of skills
 * - location: Location filter
 * - locationType: 'remote' | 'onsite' | 'hybrid'
 * - salaryMin: Minimum salary
 * - salaryMax: Maximum salary
 * - experienceLevel: Experience level
 * - limit: Number of results (default 20)
 * - offset: Pagination offset
 * - workerId: (optional) Worker ID to get personalized matches
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { workerService, type JobMatch } from '@/lib/jobs/worker-service';
import { createHRISClientFromConnection, MergeHRISClient, type JobSearchParams } from '@/lib/hris/merge-hris-client';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Parse query parameters
    const query = searchParams.get('q') || '';
    const skillsParam = searchParams.get('skills');
    const location = searchParams.get('location') || '';
    const locationType = searchParams.get('locationType') as 'remote' | 'onsite' | 'hybrid' | null;
    const salaryMin = searchParams.get('salaryMin');
    const salaryMax = searchParams.get('salaryMax');
    const experienceLevel = searchParams.get('experienceLevel') || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const workerId = searchParams.get('workerId');
    const connectionId = searchParams.get('connectionId');

    const skills = skillsParam ? skillsParam.split(',').map(s => s.trim()) : [];

    // If worker ID provided, return personalized matches
    if (workerId) {
      try {
        const matches = await workerService.findMatchingJobs(workerId);
        return NextResponse.json({
          success: true,
          message: `Found ${matches.length} matching jobs for your profile`,
          jobs: matches,
          total: matches.length,
          personalized: true,
        });
      } catch (error) {
        console.error('Error finding matched jobs:', error);
        // Fall through to general search
      }
    }

    // Build SQL query
    const conditions: string[] = ["status = 'open'"];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (query) {
      conditions.push(`(title ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`);
      values.push(`%${query}%`);
      paramIndex++;
    }

    if (location) {
      conditions.push(`(location ILIKE $${paramIndex} OR $${paramIndex} = ANY(offices))`);
      values.push(`%${location}%`);
      paramIndex++;
    }

    if (locationType) {
      conditions.push(`location_type = $${paramIndex}`);
      values.push(locationType);
      paramIndex++;
    }

    if (salaryMin) {
      conditions.push(`(salary_max IS NULL OR salary_max >= $${paramIndex})`);
      values.push(parseInt(salaryMin));
      paramIndex++;
    }

    if (salaryMax) {
      conditions.push(`(salary_min IS NULL OR salary_min <= $${paramIndex})`);
      values.push(parseInt(salaryMax));
      paramIndex++;
    }

    if (experienceLevel) {
      conditions.push(`experience_level ILIKE $${paramIndex}`);
      values.push(`%${experienceLevel}%`);
      paramIndex++;
    }

    if (skills.length > 0) {
      conditions.push(`skills && $${paramIndex}`);
      values.push(skills);
      paramIndex++;
    }

    if (connectionId) {
      conditions.push(`connection_id = $${paramIndex}`);
      values.push(connectionId);
      paramIndex++;
    }

    // Get total count
    const countResult = await sql.query(
      `SELECT COUNT(*) as total FROM hris_job_postings WHERE ${conditions.join(' AND ')}`,
      values
    );

    // Get jobs
    values.push(limit, offset);
    const result = await sql.query(
      `SELECT
        j.*,
        c.employer_name as connection_employer_name,
        c.provider as hris_provider
      FROM hris_job_postings j
      LEFT JOIN hris_connections c ON j.connection_id = c.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY j.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      values
    );

    const jobs = result.rows.map(row => ({
      id: row.id,
      remoteId: row.remote_id,
      title: row.title,
      description: row.description,
      code: row.code,
      status: row.status,
      departments: row.departments || [],
      offices: row.offices || [],
      hiringManagers: row.hiring_managers || [],
      recruiters: row.recruiters || [],
      salary: row.salary_min ? {
        min: row.salary_min,
        max: row.salary_max,
        currency: row.salary_currency || 'USD',
        period: row.salary_period || 'annual',
      } : undefined,
      location: row.location,
      locationType: row.location_type,
      experienceLevel: row.experience_level,
      skills: row.skills || [],
      benefits: row.benefits || [],
      employerId: row.employer_id,
      employerName: row.employer_name || row.connection_employer_name,
      connectionId: row.connection_id,
      hrisProvider: row.hris_provider,
      remoteCreatedAt: row.remote_created_at,
      remoteUpdatedAt: row.remote_updated_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return NextResponse.json({
      success: true,
      message: jobs.length > 0
        ? `Found ${jobs.length} jobs matching your search`
        : 'No jobs found matching your criteria',
      jobs,
      total: parseInt(countResult.rows[0].total),
      limit,
      offset,
      query: query || undefined,
      filters: {
        location: location || undefined,
        locationType: locationType || undefined,
        salaryRange: salaryMin || salaryMax ? { min: salaryMin, max: salaryMax } : undefined,
        skills: skills.length > 0 ? skills : undefined,
        experienceLevel: experienceLevel || undefined,
      },
    });
  } catch (error) {
    console.error('Error searching jobs:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'I had trouble searching for jobs. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/jobs/search - Search with body parameters (for complex queries)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      query,
      skills,
      location,
      locationType,
      salaryMin,
      salaryMax,
      experienceLevel,
      departments,
      companies,
      limit = 20,
      offset = 0,
      workerId,
      sortBy = 'created_at',
      sortOrder = 'desc',
    } = body;

    // If worker ID provided, return personalized matches
    if (workerId) {
      try {
        const matches = await workerService.findMatchingJobs(workerId);

        // Apply additional filters to matches
        let filteredMatches = matches;

        if (query) {
          const q = query.toLowerCase();
          filteredMatches = filteredMatches.filter(m =>
            m.job.title.toLowerCase().includes(q) ||
            (m.job.description?.toLowerCase().includes(q))
          );
        }

        if (locationType) {
          filteredMatches = filteredMatches.filter(m =>
            m.job.locationType === locationType
          );
        }

        if (skills && skills.length > 0) {
          filteredMatches = filteredMatches.filter(m =>
            skills.some((s: string) =>
              m.job.skills?.some(js =>
                js.toLowerCase().includes(s.toLowerCase())
              )
            )
          );
        }

        return NextResponse.json({
          success: true,
          message: `Found ${filteredMatches.length} personalized job matches`,
          jobs: filteredMatches.slice(offset, offset + limit),
          total: filteredMatches.length,
          personalized: true,
        });
      } catch (error) {
        console.error('Error finding matched jobs:', error);
        // Fall through to general search
      }
    }

    // Build conditions for general search
    const conditions: string[] = ["status = 'open'"];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (query) {
      conditions.push(`(title ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`);
      values.push(`%${query}%`);
      paramIndex++;
    }

    if (location) {
      conditions.push(`(location ILIKE $${paramIndex} OR $${paramIndex} = ANY(offices))`);
      values.push(`%${location}%`);
      paramIndex++;
    }

    if (locationType) {
      conditions.push(`location_type = $${paramIndex}`);
      values.push(locationType);
      paramIndex++;
    }

    if (salaryMin) {
      conditions.push(`(salary_max IS NULL OR salary_max >= $${paramIndex})`);
      values.push(salaryMin);
      paramIndex++;
    }

    if (salaryMax) {
      conditions.push(`(salary_min IS NULL OR salary_min <= $${paramIndex})`);
      values.push(salaryMax);
      paramIndex++;
    }

    if (experienceLevel) {
      conditions.push(`experience_level ILIKE $${paramIndex}`);
      values.push(`%${experienceLevel}%`);
      paramIndex++;
    }

    if (skills && skills.length > 0) {
      conditions.push(`skills && $${paramIndex}`);
      values.push(skills);
      paramIndex++;
    }

    if (departments && departments.length > 0) {
      conditions.push(`departments && $${paramIndex}`);
      values.push(departments);
      paramIndex++;
    }

    if (companies && companies.length > 0) {
      conditions.push(`employer_name = ANY($${paramIndex})`);
      values.push(companies);
      paramIndex++;
    }

    // Validate sort column
    const allowedSortColumns = ['created_at', 'title', 'salary_min', 'salary_max', 'employer_name'];
    const safeSort = allowedSortColumns.includes(sortBy) ? sortBy : 'created_at';
    const safeSortOrder = sortOrder === 'asc' ? 'ASC' : 'DESC';

    // Get total count
    const countResult = await sql.query(
      `SELECT COUNT(*) as total FROM hris_job_postings WHERE ${conditions.join(' AND ')}`,
      values
    );

    // Get jobs
    values.push(Math.min(limit, 100), offset);
    const result = await sql.query(
      `SELECT
        j.*,
        c.employer_name as connection_employer_name,
        c.provider as hris_provider
      FROM hris_job_postings j
      LEFT JOIN hris_connections c ON j.connection_id = c.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY j.${safeSort} ${safeSortOrder}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      values
    );

    const jobs = result.rows.map(row => ({
      id: row.id,
      remoteId: row.remote_id,
      title: row.title,
      description: row.description,
      code: row.code,
      status: row.status,
      departments: row.departments || [],
      offices: row.offices || [],
      hiringManagers: row.hiring_managers || [],
      recruiters: row.recruiters || [],
      salary: row.salary_min ? {
        min: row.salary_min,
        max: row.salary_max,
        currency: row.salary_currency || 'USD',
        period: row.salary_period || 'annual',
      } : undefined,
      location: row.location,
      locationType: row.location_type,
      experienceLevel: row.experience_level,
      skills: row.skills || [],
      benefits: row.benefits || [],
      employerId: row.employer_id,
      employerName: row.employer_name || row.connection_employer_name,
      connectionId: row.connection_id,
      hrisProvider: row.hris_provider,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return NextResponse.json({
      success: true,
      message: jobs.length > 0
        ? `Found ${countResult.rows[0].total} jobs (showing ${jobs.length})`
        : 'No jobs found matching your criteria',
      jobs,
      total: parseInt(countResult.rows[0].total),
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error searching jobs:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'I had trouble with that search. Let me try again.',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
