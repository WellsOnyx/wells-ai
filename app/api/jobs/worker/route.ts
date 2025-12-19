/**
 * Jobs Worker Profile API
 * Manage worker profiles with natural language parsing
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  getWorkerProfileByUserId,
  createWorkerProfile,
  updateWorkerProfile,
  addWorkerSkills,
  updateWorkerAvailability,
  getWorkerStats,
  parseWorkerProfileFromText,
  extractSkillsFromText,
} from '@/lib/jobs/worker-service';
import { AvailabilityStatus } from '@/lib/jobs/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const include = searchParams.get('include'); // 'stats' for additional stats

    // Get the worker profile
    const result = await getWorkerProfileByUserId(userId);

    if (!result.success || !result.profile) {
      return NextResponse.json({
        success: false,
        message: result.message,
        suggestions: result.suggestions || [
          "Tell me about yourself and your skills",
          "What kind of work are you looking for?",
          "What's your experience level and rate?"
        ],
      });
    }

    // Include stats if requested
    let stats = null;
    if (include === 'stats') {
      const statsResult = await getWorkerStats(result.profile.id);
      stats = statsResult.stats;
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      profile: result.profile,
      stats,
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
    const { action, text, ...data } = body;

    // First, check if profile exists
    const existingProfile = await getWorkerProfileByUserId(userId);

    switch (action) {
      case 'create_profile': {
        if (existingProfile.profile) {
          return NextResponse.json({
            success: false,
            message: "You already have a profile. Would you like to update it instead?",
            profile: existingProfile.profile,
          });
        }

        // Parse from natural language if text is provided
        let profileData = data;
        if (text) {
          const parsed = parseWorkerProfileFromText(text);
          profileData = { ...parsed, ...data };
        }

        const result = await createWorkerProfile(userId, profileData, data.referrerUserId);

        return NextResponse.json({
          success: result.success,
          message: result.message,
          profile: result.profile,
          nextSteps: result.nextSteps,
        });
      }

      case 'update_profile': {
        if (!existingProfile.profile) {
          return NextResponse.json({
            success: false,
            message: "You don't have a profile yet. Let me help you create one. What are your skills and experience?",
          });
        }

        // Parse from natural language if text is provided
        let updateData = data;
        if (text) {
          const parsed = parseWorkerProfileFromText(text);
          updateData = { ...parsed, ...data };
        }

        const result = await updateWorkerProfile(existingProfile.profile.id, updateData);

        return NextResponse.json({
          success: result.success,
          message: result.message,
          profile: result.profile,
        });
      }

      case 'add_skill': {
        if (!existingProfile.profile) {
          return NextResponse.json({
            success: false,
            message: "Create a profile first, then I can add skills to it.",
          });
        }

        // Extract skills from natural language or use provided skills
        let skills: string[] = data.skills || [];
        let levels = data.levels;

        if (text) {
          const extracted = extractSkillsFromText(text);
          skills = [...skills, ...extracted.map(e => e.skill)];

          // Build levels from extracted data
          if (!levels) {
            levels = {};
            for (const e of extracted) {
              if (e.level) {
                levels[e.skill] = e.level;
              }
            }
          }
        }

        if (skills.length === 0) {
          return NextResponse.json({
            success: false,
            message: "I didn't catch any skills. Try telling me what you're good at, like 'I'm experienced in React, Node.js, and Python'.",
          });
        }

        const result = await addWorkerSkills(existingProfile.profile.id, skills, levels);

        return NextResponse.json({
          success: result.success,
          message: result.message,
          profile: result.profile,
        });
      }

      case 'remove_skill': {
        if (!existingProfile.profile) {
          return NextResponse.json({
            success: false,
            message: "You don't have a profile yet.",
          });
        }

        const skillToRemove = data.skill?.toLowerCase();
        if (!skillToRemove) {
          return NextResponse.json({
            success: false,
            message: "Which skill would you like to remove?",
          });
        }

        const currentSkills = existingProfile.profile.skills || [];
        const updatedSkills = currentSkills.filter(
          s => s.toLowerCase() !== skillToRemove
        );

        if (updatedSkills.length === currentSkills.length) {
          return NextResponse.json({
            success: false,
            message: `I couldn't find "${data.skill}" in your skills. Your current skills are: ${currentSkills.join(', ')}.`,
          });
        }

        const result = await updateWorkerProfile(existingProfile.profile.id, {
          skills: updatedSkills,
        });

        return NextResponse.json({
          success: result.success,
          message: `Removed "${data.skill}" from your skills. You now have ${updatedSkills.length} skills listed.`,
          profile: result.profile,
        });
      }

      case 'update_availability': {
        if (!existingProfile.profile) {
          return NextResponse.json({
            success: false,
            message: "Create a profile first to set your availability.",
          });
        }

        let status: AvailabilityStatus = data.status || 'available';
        let hoursPerWeek = data.hoursPerWeek;

        // Parse from text if provided
        if (text) {
          const parsed = parseWorkerProfileFromText(text);
          if (parsed.availability) {
            status = parsed.availability;
          }
          if (parsed.hoursPerWeek) {
            hoursPerWeek = parsed.hoursPerWeek;
          }
        }

        const result = await updateWorkerAvailability(
          existingProfile.profile.id,
          status,
          hoursPerWeek
        );

        return NextResponse.json({
          success: result.success,
          message: result.message,
          profile: result.profile,
        });
      }

      case 'get_stats': {
        if (!existingProfile.profile) {
          return NextResponse.json({
            success: false,
            message: "Create a profile first to see your stats.",
          });
        }

        const statsResult = await getWorkerStats(existingProfile.profile.id);

        return NextResponse.json({
          success: statsResult.success,
          message: statsResult.message,
          stats: statsResult.stats,
        });
      }

      case 'parse_text': {
        // Utility to parse natural language without saving
        if (!text) {
          return NextResponse.json({
            success: false,
            message: "Please provide text to parse.",
          });
        }

        const parsed = parseWorkerProfileFromText(text);
        const skills = extractSkillsFromText(text);

        return NextResponse.json({
          success: true,
          message: "Here's what I understood from your message. Shall I update your profile with this?",
          parsed,
          extractedSkills: skills,
        });
      }

      default:
        return NextResponse.json(
          { error: 'Unknown action. Try: create_profile, update_profile, add_skill, remove_skill, update_availability, get_stats' },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('Error handling worker action:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process action' },
      { status: 500 }
    );
  }
}
