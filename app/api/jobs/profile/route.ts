/**
 * Worker Profile API
 * GET: Get worker profile and stats
 * POST: Create/update worker profile (supports natural language)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  getWorkerProfileByUserId,
  createWorkerProfile,
  updateWorkerProfile,
  getWorkerStats,
  parseProfileFromText,
  WorkerService,
  workerService,
} from '@/lib/jobs/worker-service';
import { MergeHRISClient } from '@/lib/hris/merge-hris-client';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await getWorkerProfileByUserId(userId);

    if (!profile) {
      return NextResponse.json({
        success: true,
        profile: null,
        message: "You don't have a worker profile yet. Tell me about your skills and experience to get started.",
        suggestions: [
          "I'm a React developer with 5 years experience",
          "I specialize in data analysis and Python",
          "I'm a freelance writer looking for content work",
        ],
      });
    }

    // Get stats
    const stats = await getWorkerStats(profile.id);

    // Generate conversational summary
    let summary = '';
    if (profile.status === 'pending') {
      summary = `Welcome ${profile.displayName}. Your profile is pending verification. `;
      if (!profile.skills || profile.skills.length === 0) {
        summary += "Add your skills to start seeing matching opportunities.";
      } else {
        summary += `Skills: ${profile.skills.slice(0, 5).join(', ')}. Complete your profile for better matches.`;
      }
    } else if (profile.status === 'active') {
      summary = `${profile.displayName} - ${profile.headline || profile.availability}. `;
      if (stats.tasksInProgress > 0) {
        summary += `${stats.tasksInProgress} active task(s). `;
      }
      if (stats.applicationsActive > 0) {
        summary += `${stats.applicationsActive} pending application(s). `;
      }
      if (stats.totalEarnings > 0) {
        summary += `Total earned: $${stats.totalEarnings.toFixed(2)}.`;
      } else {
        summary += "Ready to find opportunities.";
      }
    } else {
      summary = `Profile status: ${profile.status}. Contact support if you need help.`;
    }

    return NextResponse.json({
      success: true,
      profile,
      stats,
      message: summary,
    });
  } catch (error: any) {
    console.error('Error fetching worker profile:', error);
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
    const { action, text, data } = body;

    // Check for existing profile
    const existingProfile = await getWorkerProfileByUserId(userId);

    switch (action) {
      case 'create':
      case 'update': {
        // Parse from natural language if provided
        let profileData = data || {};
        if (text) {
          const parsed = parseProfileFromText(text);
          profileData = { ...profileData, ...parsed };
        }

        let profile;
        let message: string;

        if (existingProfile) {
          // Update existing
          profile = await updateWorkerProfile(existingProfile.id, profileData);

          const updatedFields = Object.keys(profileData).filter(
            k => profileData[k] !== undefined
          );

          if (updatedFields.length > 0) {
            message = `Profile updated. Changed: ${updatedFields.join(', ')}. `;
          } else {
            message = 'No changes detected. ';
          }

          if (profile.skills && profile.skills.length > 0) {
            message += `Skills: ${profile.skills.slice(0, 5).join(', ')}.`;
          }
        } else {
          // Create new
          profile = await createWorkerProfile(userId, profileData);
          message = `Welcome ${profile.displayName}. Your worker profile has been created. `;

          if (profile.skills && profile.skills.length > 0) {
            message += `I see you have skills in ${profile.skills.slice(0, 3).join(', ')}. `;
          }

          message += "I'll start looking for matching opportunities.";
        }

        return NextResponse.json({
          success: true,
          profile,
          message,
          isNew: !existingProfile,
        });
      }

      case 'parse': {
        // Just parse, don't save
        if (!text) {
          return NextResponse.json({ error: 'text required' }, { status: 400 });
        }

        const parsed = parseProfileFromText(text);

        const fields = Object.keys(parsed).filter(k => (parsed as any)[k] !== undefined);

        let message = '';
        if (fields.length === 0) {
          message = "I couldn't extract profile info from that. Try: 'I'm a frontend developer with React and TypeScript skills, $75/hour, 5 years experience'";
        } else {
          message = `Extracted: ${fields.join(', ')}. Want me to save this to your profile?`;
        }

        return NextResponse.json({
          success: true,
          parsed,
          message,
        });
      }

      case 'set_availability': {
        if (!existingProfile) {
          return NextResponse.json({
            error: 'Create a profile first',
            message: "You need a profile before setting availability. Tell me about your skills.",
          }, { status: 400 });
        }

        const availability = data?.availability || body.availability;
        const hoursPerWeek = data?.hoursPerWeek || body.hoursPerWeek;

        const profile = await updateWorkerProfile(existingProfile.id, {
          availability,
          hoursPerWeek,
        });

        return NextResponse.json({
          success: true,
          profile,
          message: `Availability set to ${availability}${hoursPerWeek ? ` (${hoursPerWeek} hrs/week)` : ''}. Matching opportunities will be adjusted.`,
        });
      }

      case 'set_rate': {
        if (!existingProfile) {
          return NextResponse.json({
            error: 'Create a profile first',
          }, { status: 400 });
        }

        const preferredRate = data?.preferredRate || body.rate;
        const hourlyRateMin = data?.hourlyRateMin || body.min;
        const hourlyRateMax = data?.hourlyRateMax || body.max;

        const profile = await updateWorkerProfile(existingProfile.id, {
          preferredRate,
          hourlyRateMin,
          hourlyRateMax,
        });

        let message = '';
        if (preferredRate) {
          message = `Preferred rate set to $${preferredRate}/hr.`;
        } else if (hourlyRateMin && hourlyRateMax) {
          message = `Rate range set to $${hourlyRateMin}-${hourlyRateMax}/hr.`;
        }

        return NextResponse.json({
          success: true,
          profile,
          message,
        });
      }

      case 'add_skills': {
        if (!existingProfile) {
          return NextResponse.json({
            error: 'Create a profile first',
          }, { status: 400 });
        }

        let newSkills: string[] = data?.skills || [];
        if (text) {
          // Extract skills from text
          const parsed = parseProfileFromText(text);
          newSkills = [...newSkills, ...(parsed.skills || [])];
        }

        const currentSkills = existingProfile.skills || [];
        const allSkills = [...new Set([...currentSkills, ...newSkills])];

        const profile = await updateWorkerProfile(existingProfile.id, {
          skills: allSkills,
        });

        const addedSkills = newSkills.filter(s => !currentSkills.includes(s));

        return NextResponse.json({
          success: true,
          profile,
          message: addedSkills.length > 0
            ? `Added: ${addedSkills.join(', ')}. Total skills: ${allSkills.length}.`
            : 'No new skills added.',
        });
      }

      case 'toggle_ai': {
        if (!existingProfile) {
          return NextResponse.json({
            error: 'Create a profile first',
          }, { status: 400 });
        }

        const aiMatchingEnabled = data?.aiMatchingEnabled ?? !existingProfile.aiMatchingEnabled;
        const aiAutoApplyEnabled = data?.aiAutoApplyEnabled ?? existingProfile.aiAutoApplyEnabled;
        const aiAutoApplyThreshold = data?.aiAutoApplyThreshold ?? existingProfile.aiAutoApplyThreshold;

        const profile = await updateWorkerProfile(existingProfile.id, {
          aiMatchingEnabled,
          aiAutoApplyEnabled,
          aiAutoApplyThreshold,
        });

        let message = '';
        if (aiMatchingEnabled) {
          message = 'AI matching enabled. ';
          if (aiAutoApplyEnabled) {
            message += `Auto-apply on for opportunities above ${aiAutoApplyThreshold}% match.`;
          } else {
            message += "I'll suggest opportunities but you control applications.";
          }
        } else {
          message = 'AI matching disabled. You can browse opportunities manually.';
        }

        return NextResponse.json({
          success: true,
          profile,
          message,
        });
      }

      case 'set_referrer': {
        if (!existingProfile) {
          return NextResponse.json({
            error: 'Create a profile first',
          }, { status: 400 });
        }

        const referralCode = data?.referralCode || body.referralCode || body.code;
        if (!referralCode) {
          return NextResponse.json({ error: 'referralCode required' }, { status: 400 });
        }

        // Import and use setReferrer from earnings service
        const { setReferrer } = await import('@/lib/jobs/earnings-service');
        const result = await setReferrer(existingProfile.id, referralCode);

        return NextResponse.json({
          success: result.success,
          message: result.message,
        });
      }

      // ================================================================
      // HRIS INTEGRATION ACTIONS
      // ================================================================

      case 'connect_hris': {
        // Generate a link token for connecting to an HRIS system
        if (!existingProfile) {
          return NextResponse.json({
            error: 'Create a profile first',
          }, { status: 400 });
        }

        const { employerId, employerName, email } = data || body;
        if (!employerId || !employerName) {
          return NextResponse.json({
            error: 'employerId and employerName required',
          }, { status: 400 });
        }

        const result = await MergeHRISClient.generateLinkToken(
          employerId,
          employerName,
          email
        );

        return NextResponse.json({
          success: result.success,
          message: result.message,
          linkToken: result.linkToken,
          magicLinkUrl: result.magicLinkUrl,
        });
      }

      case 'exchange_hris_token': {
        // Exchange public token for account token after OAuth
        if (!existingProfile) {
          return NextResponse.json({
            error: 'Create a profile first',
          }, { status: 400 });
        }

        const { publicToken, employerId, employerName } = data || body;
        if (!publicToken || !employerId || !employerName) {
          return NextResponse.json({
            error: 'publicToken, employerId, and employerName required',
          }, { status: 400 });
        }

        const result = await MergeHRISClient.exchangeToken(
          publicToken,
          employerId,
          employerName
        );

        return NextResponse.json({
          success: result.success,
          message: result.message,
          connection: result.connection,
        });
      }

      case 'generate_resume': {
        // Generate AI-tailored resume for a specific job
        if (!existingProfile) {
          return NextResponse.json({
            error: 'Create a profile first',
          }, { status: 400 });
        }

        const { jobId } = data || body;
        if (!jobId) {
          return NextResponse.json({
            error: 'jobId required',
          }, { status: 400 });
        }

        try {
          const resume = await workerService.generateAIResume(existingProfile.id, jobId);

          return NextResponse.json({
            success: true,
            message: 'Generated tailored resume for the job',
            resume,
          });
        } catch (error: any) {
          return NextResponse.json({
            success: false,
            message: error.message || 'Failed to generate resume',
          }, { status: 400 });
        }
      }

      case 'interview_prep': {
        // Get interview preparation for a specific job
        if (!existingProfile) {
          return NextResponse.json({
            error: 'Create a profile first',
          }, { status: 400 });
        }

        const { jobId: prepJobId } = data || body;
        if (!prepJobId) {
          return NextResponse.json({
            error: 'jobId required',
          }, { status: 400 });
        }

        try {
          const prep = await workerService.prepareForInterview(existingProfile.id, prepJobId);

          return NextResponse.json({
            success: true,
            message: "Here's your interview preparation guide",
            prep,
          });
        } catch (error: any) {
          return NextResponse.json({
            success: false,
            message: error.message || 'Failed to generate interview prep',
          }, { status: 400 });
        }
      }

      case 'find_matches': {
        // Find matching jobs for the worker
        if (!existingProfile) {
          return NextResponse.json({
            error: 'Create a profile first',
          }, { status: 400 });
        }

        try {
          const matches = await workerService.findMatchingJobs(existingProfile.id);

          return NextResponse.json({
            success: true,
            message: matches.length > 0
              ? `Found ${matches.length} matching jobs for your profile`
              : 'No matching jobs found. Try updating your skills or preferences.',
            matches,
            count: matches.length,
          });
        } catch (error: any) {
          return NextResponse.json({
            success: false,
            message: error.message || 'Failed to find matching jobs',
          }, { status: 400 });
        }
      }

      default:
        // If no action, try to parse as profile update
        if (text) {
          const parsed = parseProfileFromText(text);
          if (Object.keys(parsed).length > 0) {
            if (existingProfile) {
              const profile = await updateWorkerProfile(existingProfile.id, parsed);
              return NextResponse.json({
                success: true,
                profile,
                message: `Updated: ${Object.keys(parsed).join(', ')}.`,
              });
            } else {
              const profile = await createWorkerProfile(userId, parsed);
              return NextResponse.json({
                success: true,
                profile,
                message: `Profile created. ${profile.skills?.length ? `Skills: ${profile.skills.join(', ')}.` : ''}`,
                isNew: true,
              });
            }
          }
        }

        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Error handling profile action:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process action' },
      { status: 500 }
    );
  }
}
