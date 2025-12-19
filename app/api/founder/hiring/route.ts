/**
 * Founder Hiring API
 * GET: Get job postings and candidates
 * POST: Manage job postings, candidates, interviews, and offers
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  HiringService,
  HiringType,
  CandidateSource,
  CandidateStatus,
  InterviewType,
} from '@/lib/founder/hiring-service';

export const dynamic = 'force-dynamic';

// Parse job posting from natural language
function parseJobFromText(text: string): {
  title?: string;
  type?: HiringType;
  salaryMin?: number;
  salaryMax?: number;
  skills?: string[];
  location?: string;
  isRemote?: boolean;
  experienceYears?: number;
} {
  const lower = text.toLowerCase();
  const result: ReturnType<typeof parseJobFromText> = {};

  // Parse job type
  if (lower.includes('full time') || lower.includes('full-time')) {
    result.type = 'full_time';
  } else if (lower.includes('part time') || lower.includes('part-time')) {
    result.type = 'part_time';
  } else if (lower.includes('contract')) {
    result.type = 'contract';
  } else if (lower.includes('freelance')) {
    result.type = 'freelance';
  } else if (lower.includes('intern')) {
    result.type = 'internship';
  }

  // Parse remote
  if (lower.includes('remote')) {
    result.isRemote = true;
  }

  // Parse salary
  const salaryMatch = text.match(/\$?([\d,]+)(?:k|K)?\s*(?:-|to)\s*\$?([\d,]+)(?:k|K)?/);
  if (salaryMatch) {
    let min = parseFloat(salaryMatch[1].replace(/,/g, ''));
    let max = parseFloat(salaryMatch[2].replace(/,/g, ''));
    if (min < 1000) min *= 1000;
    if (max < 1000) max *= 1000;
    result.salaryMin = min;
    result.salaryMax = max;
  }

  // Parse experience
  const expMatch = text.match(/(\d+)\+?\s*(?:years?|yrs?)/i);
  if (expMatch) {
    result.experienceYears = parseInt(expMatch[1]);
  }

  // Parse skills
  const skillPatterns = [
    'react', 'node', 'python', 'javascript', 'typescript', 'java', 'go', 'rust',
    'aws', 'gcp', 'azure', 'sql', 'nosql', 'mongodb', 'postgres',
    'docker', 'kubernetes', 'terraform', 'figma', 'sketch',
    'product', 'design', 'marketing', 'sales', 'operations'
  ];
  const foundSkills = skillPatterns.filter(skill => lower.includes(skill));
  if (foundSkills.length > 0) result.skills = foundSkills;

  // Try to extract title from common patterns
  const titlePatterns = [
    /(?:hire|need|looking for|seeking)\s+(?:a\s+)?(.+?)(?:\s+for|\s+at|\s+\$|$)/i,
    /(.+?)\s+(?:role|position|job)/i,
  ];
  for (const pattern of titlePatterns) {
    const match = text.match(pattern);
    if (match && match[1].length < 50) {
      result.title = match[1].trim();
      break;
    }
  }

  return result;
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const jobId = searchParams.get('jobId');
    const candidateId = searchParams.get('candidateId');
    const status = searchParams.get('status');
    const projectId = searchParams.get('projectId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Get single candidate
    if (candidateId) {
      const result = await HiringService.getCandidate(candidateId);
      return NextResponse.json({
        success: result.success,
        candidate: result.candidate,
        message: result.message,
      });
    }

    // Get single job with candidates
    if (jobId) {
      const result = await HiringService.getJobPosting(jobId);
      return NextResponse.json({
        success: result.success,
        job: result.job,
        candidates: result.candidates,
        message: result.message,
      });
    }

    // Get all job postings
    const filters: { status?: string; projectId?: string; limit: number; offset: number } = {
      limit,
      offset,
    };
    if (status) filters.status = status;
    if (projectId) filters.projectId = projectId;

    const result = await HiringService.getJobPostings(userId, filters);

    return NextResponse.json({
      success: result.success,
      jobs: result.jobs,
      message: result.message,
    });
  } catch (error: any) {
    console.error('Error in hiring GET:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch hiring data' },
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
    const { action, text, data } = body;

    // Parse from natural language if provided
    let parsedData = data || {};
    if (text) {
      const parsed = parseJobFromText(text);
      parsedData = { ...parsed, ...parsedData };
    }

    switch (action) {
      case 'create_job': {
        if (!parsedData.title) {
          // Try AI parsing
          const parseResult = await HiringService.parseJobFromText(text || '');
          if (parseResult.success && parseResult.parsed?.title) {
            parsedData = { ...parseResult.parsed, ...parsedData };
          } else {
            return NextResponse.json({
              success: false,
              message: "What role are you hiring for? Tell me the job title and requirements.",
              parsed: parsedData,
            });
          }
        }

        if (!parsedData.skills || parsedData.skills.length === 0) {
          return NextResponse.json({
            success: false,
            message: `Got it - "${parsedData.title}". What skills or experience should candidates have?`,
            parsed: parsedData,
          });
        }

        const result = await HiringService.createJobPosting(userId, {
          title: parsedData.title,
          description: parsedData.description || text || `${parsedData.title} role`,
          type: parsedData.type || 'full_time',
          location: parsedData.location || 'Remote',
          isRemote: parsedData.isRemote ?? true,
          salaryMin: parsedData.salaryMin,
          salaryMax: parsedData.salaryMax,
          skills: parsedData.skills,
          experienceYears: parsedData.experienceYears,
          projectId: parsedData.projectId,
          inNetworkOnly: parsedData.inNetworkOnly,
        });

        return NextResponse.json({
          success: result.success,
          job: result.job,
          message: result.message,
        });
      }

      case 'publish_job': {
        const { jobId } = parsedData;
        if (!jobId) {
          return NextResponse.json({
            success: false,
            message: "Which job posting should I publish?",
          });
        }

        const result = await HiringService.publishJob(jobId);

        return NextResponse.json({
          success: result.success,
          job: result.job,
          networkMatches: result.networkMatches,
          message: result.message,
        });
      }

      case 'close_job': {
        const { jobId, reason } = parsedData;
        if (!jobId) {
          return NextResponse.json({
            success: false,
            message: "Which job posting should I close?",
          });
        }

        const result = await HiringService.closeJob(jobId, reason);

        return NextResponse.json({
          success: result.success,
          job: result.job,
          message: result.message,
        });
      }

      case 'search_network': {
        const { jobId } = parsedData;
        if (!jobId) {
          return NextResponse.json({
            success: false,
            message: "Which job should I search the Wells network for?",
          });
        }

        const result = await HiringService.searchNetworkForJob(jobId);

        return NextResponse.json({
          success: result.success,
          matches: result.matches,
          message: result.message,
        });
      }

      case 'invite_candidate': {
        const { jobId, workerId } = parsedData;
        if (!jobId || !workerId) {
          return NextResponse.json({
            success: false,
            message: "I need both the job ID and the worker ID to send an invite.",
          });
        }

        const result = await HiringService.inviteNetworkCandidate(jobId, workerId);

        return NextResponse.json({
          success: result.success,
          candidate: result.candidate,
          message: result.message,
        });
      }

      case 'add_candidate': {
        const { jobId, name, email, source } = parsedData;
        if (!jobId || !name || !email) {
          return NextResponse.json({
            success: false,
            message: "I need the job ID, candidate name, and email to add them.",
          });
        }

        const result = await HiringService.addCandidate(jobId, {
          name,
          email,
          phone: parsedData.phone,
          resumeUrl: parsedData.resumeUrl,
          linkedinUrl: parsedData.linkedinUrl,
          portfolioUrl: parsedData.portfolioUrl,
          source: source || 'direct_apply',
          notes: parsedData.notes,
        });

        return NextResponse.json({
          success: result.success,
          candidate: result.candidate,
          message: result.message,
        });
      }

      case 'update_candidate_status': {
        const { candidateId, status, notes } = parsedData;
        if (!candidateId || !status) {
          return NextResponse.json({
            success: false,
            message: "Which candidate and what status? Options: screening, interview_scheduled, interviewed, offer_pending, rejected, withdrawn.",
          });
        }

        const result = await HiringService.updateCandidateStatus(candidateId, status, notes);

        return NextResponse.json({
          success: result.success,
          candidate: result.candidate,
          message: result.message,
        });
      }

      case 'schedule_interview': {
        const { candidateId, type, scheduledAt, duration, interviewers } = parsedData;
        if (!candidateId) {
          return NextResponse.json({
            success: false,
            message: "Which candidate should I schedule an interview for?",
          });
        }

        const interviewDate = scheduledAt ? new Date(scheduledAt) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        const result = await HiringService.scheduleInterview(candidateId, {
          type: type || 'video_interview',
          scheduledAt: interviewDate,
          duration: duration || 60,
          interviewers: interviewers || [],
          location: parsedData.location,
          meetingUrl: parsedData.meetingUrl,
          notes: parsedData.notes,
        });

        return NextResponse.json({
          success: result.success,
          interview: result.interview,
          message: result.message,
        });
      }

      case 'record_feedback': {
        const { interviewId, feedback, rating, recommend } = parsedData;
        if (!interviewId || !feedback || rating === undefined) {
          return NextResponse.json({
            success: false,
            message: "I need the interview ID, feedback text, rating (1-5), and recommendation (yes/no).",
          });
        }

        const result = await HiringService.recordInterviewFeedback(
          interviewId,
          feedback,
          rating,
          recommend ?? true
        );

        return NextResponse.json({
          success: result.success,
          interview: result.interview,
          message: result.message,
        });
      }

      case 'create_offer': {
        const { candidateId, salary, startDate, equity, signingBonus, benefits } = parsedData;
        if (!candidateId || !salary) {
          return NextResponse.json({
            success: false,
            message: "I need the candidate ID and salary to create an offer. What's the compensation?",
          });
        }

        const result = await HiringService.createOffer(candidateId, {
          salary,
          salaryCurrency: parsedData.salaryCurrency || 'USD',
          equity,
          startDate: startDate ? new Date(startDate) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          signingBonus,
          benefits,
          otherTerms: parsedData.otherTerms,
          expiresAt: parsedData.expiresAt ? new Date(parsedData.expiresAt) : undefined,
        });

        return NextResponse.json({
          success: result.success,
          offer: result.offer,
          message: result.message,
        });
      }

      case 'send_offer': {
        const { candidateId } = parsedData;
        if (!candidateId) {
          return NextResponse.json({
            success: false,
            message: "Which candidate should I send the offer to?",
          });
        }

        const result = await HiringService.sendOffer(candidateId);

        return NextResponse.json({
          success: result.success,
          offer: result.offer,
          message: result.message,
        });
      }

      case 'record_offer_response': {
        const { candidateId, accepted, notes } = parsedData;
        if (!candidateId || accepted === undefined) {
          return NextResponse.json({
            success: false,
            message: "Did they accept or decline? I need the candidate ID and their response.",
          });
        }

        const result = await HiringService.recordOfferResponse(candidateId, accepted, notes);

        return NextResponse.json({
          success: result.success,
          message: result.message,
        });
      }

      case 'hire': {
        const { candidateId } = parsedData;
        if (!candidateId) {
          return NextResponse.json({
            success: false,
            message: "Which candidate are you hiring?",
          });
        }

        const result = await HiringService.hireCandidate(candidateId);

        return NextResponse.json({
          success: result.success,
          message: result.message,
        });
      }

      case 'get_schedule': {
        const { startDate, endDate } = parsedData;
        const result = await HiringService.getInterviewSchedule(
          userId,
          startDate && endDate ? { start: new Date(startDate), end: new Date(endDate) } : undefined
        );

        return NextResponse.json({
          success: result.success,
          interviews: result.interviews,
          message: result.message,
        });
      }

      case 'get_stats': {
        const result = await HiringService.getHiringStats(userId);

        return NextResponse.json({
          success: result.success,
          stats: result.stats,
          message: result.message,
        });
      }

      case 'get_pipeline': {
        const result = await HiringService.getHiringPipeline(userId);

        return NextResponse.json({
          success: result.success,
          pipelines: result.pipelines,
          message: result.message,
        });
      }

      case 'parse': {
        if (!text) {
          return NextResponse.json({
            success: false,
            message: "Describe the role you're hiring for and I'll help set it up.",
          });
        }

        const result = await HiringService.parseJobFromText(text);

        return NextResponse.json({
          success: result.success,
          parsed: result.parsed,
          message: result.message,
        });
      }

      default:
        return NextResponse.json({
          success: false,
          message: "I can help you hire. Try: 'Hire a senior React developer, $150-180k, remote' or 'Schedule an interview with John'.",
          availableActions: [
            'create_job', 'publish_job', 'close_job', 'search_network',
            'invite_candidate', 'add_candidate', 'update_candidate_status',
            'schedule_interview', 'record_feedback', 'create_offer',
            'send_offer', 'record_offer_response', 'hire',
            'get_schedule', 'get_stats', 'get_pipeline', 'parse',
          ],
        });
    }
  } catch (error: any) {
    console.error('Error in hiring POST:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process hiring action' },
      { status: 500 }
    );
  }
}
