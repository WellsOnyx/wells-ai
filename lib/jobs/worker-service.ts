/**
 * Worker Profile Service for Wells AI Job Marketplace
 *
 * Manages worker profiles, skills, and availability with conversational interface.
 * All interactions return messages suitable for AI relay to users.
 *
 * Key Features:
 * - Natural language parsing for profile updates
 * - Skill management with proficiency levels (1-5)
 * - Availability tracking and scheduling
 * - Worker search and discovery
 * - Stats and earnings tracking
 */

import { sqlQuery as sql } from '@/lib/db';
import {
  WorkerProfile,
  WorkerStats,
  WorkerEarnings,
  WorkerAttribution,
  AttributionChain,
  AttributionLevel,
  EarningsFilters,
  ParsedWorkerProfile,
  SkillExtraction,
  AvailabilityStatus,
  SkillLevel,
  DEFAULT_ATTRIBUTION_PERCENTS,
  WorkerProfileResponse,
  WorkerStatsResponse,
  WorkerEarningsResponse,
  WorkerAttributionResponse,
  EarningsSummary,
} from './types';

// =====================================================
// TYPES FOR WORKER SERVICE
// =====================================================

export interface WorkerSkill {
  id: string;
  workerId: string;
  skill: string;
  proficiency: number; // 1-5 scale
  yearsExperience?: number;
  verified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkerAvailability {
  hoursPerWeek: number;
  preferredTimes: string[]; // e.g., ['morning', 'afternoon']
  availableDays: string[]; // e.g., ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
  timezone: string;
  startTime?: string; // e.g., '09:00'
  endTime?: string; // e.g., '17:00'
  notes?: string;
}

export interface WorkerSearchFilters {
  skills?: string[];
  minProficiency?: number;
  availability?: AvailabilityStatus;
  minHoursPerWeek?: number;
  maxHoursPerWeek?: number;
  minRate?: number;
  maxRate?: number;
  experienceYears?: number;
  remoteOnly?: boolean;
  timezone?: string;
  location?: string;
  categories?: string[];
  minRating?: number;
  verified?: boolean;
  sortBy?: 'rating' | 'experience' | 'rate_low' | 'rate_high' | 'tasks_completed' | 'match_score';
  limit?: number;
  offset?: number;
}

export interface WorkerSearchResult {
  success: boolean;
  message: string;
  workers: WorkerProfile[];
  total: number;
  filters: WorkerSearchFilters;
}

export interface ParsedAvailability {
  hoursPerWeek?: number;
  preferredTimes?: string[];
  availableDays?: string[];
  timezone?: string;
  startTime?: string;
  endTime?: string;
  status?: AvailabilityStatus;
  notes?: string;
}

// =====================================================
// PROFILE MANAGEMENT
// =====================================================

export async function getWorkerProfileByUserId(userId: string): Promise<WorkerProfileResponse> {
  try {
    const result = await sql`
      SELECT * FROM worker_profiles WHERE user_id = ${userId}
    `;

    if (result.rows.length === 0) {
      return {
        success: false,
        message: "I don't see a worker profile for you yet. Would you like me to help you create one? Just tell me about your skills and experience.",
        suggestions: [
          "Tell me about your skills and experience",
          "Share your hourly rate expectations",
          "Describe the type of work you're looking for"
        ]
      };
    }

    const profile = mapRowToProfile(result.rows[0]);
    return {
      success: true,
      message: `Found your profile. You're set up as a ${profile.availability} worker with ${profile.skills.length} skills listed.`,
      profile
    };
  } catch (error) {
    console.error('Error fetching worker profile:', error);
    return {
      success: false,
      message: "I ran into an issue looking up your profile. Let me try again in a moment."
    };
  }
}

export async function getWorkerProfile(workerId: string): Promise<WorkerProfile | null> {
  const result = await sql`
    SELECT * FROM worker_profiles WHERE id = ${workerId}
  `;

  if (result.rows.length === 0) return null;
  return mapRowToProfile(result.rows[0]);
}

export async function createWorkerProfile(
  userId: string,
  data: Partial<WorkerProfile>,
  referrerUserId?: string
): Promise<WorkerProfileResponse> {
  try {
    // Generate referral code
    const referralCode = generateReferralCode();

    const result = await sql`
      INSERT INTO worker_profiles (
        user_id, display_name, headline, bio, avatar_url,
        skills, skill_levels, categories, experience_years,
        hourly_rate_min, hourly_rate_max, preferred_rate, preferred_currency,
        portfolio_url, linkedin_url, github_url, website_url,
        availability, hours_per_week, timezone, locations, remote_only, willing_to_relocate,
        preferred_task_types, preferred_industries, min_task_value, max_tasks_active,
        email_verified, phone_verified, identity_verified, background_checked,
        ai_matching_enabled, ai_auto_apply_enabled, ai_auto_apply_threshold, proactive_opportunities,
        completed_tasks, total_earnings, average_rating, review_count, response_rate, completion_rate, success_rate,
        referred_by, referral_code, attribution_earnings,
        status
      ) VALUES (
        ${userId},
        ${data.displayName || 'Worker'},
        ${data.headline || null},
        ${data.bio || null},
        ${data.avatarUrl || null},
        ${data.skills || []},
        ${data.skillLevels ? JSON.stringify(data.skillLevels) : null},
        ${data.categories || []},
        ${data.experienceYears || null},
        ${data.hourlyRateMin || null},
        ${data.hourlyRateMax || null},
        ${data.preferredRate || null},
        ${data.preferredCurrency || 'USD'},
        ${data.portfolioUrl || null},
        ${data.linkedinUrl || null},
        ${data.githubUrl || null},
        ${data.websiteUrl || null},
        ${data.availability || 'freelance'},
        ${data.hoursPerWeek || null},
        ${data.timezone || 'America/New_York'},
        ${data.locations || null},
        ${data.remoteOnly ?? true},
        ${data.willingToRelocate ?? false},
        ${data.preferredTaskTypes || null},
        ${data.preferredIndustries || null},
        ${data.minTaskValue || null},
        ${data.maxTasksActive || 3},
        ${data.emailVerified ?? false},
        ${data.phoneVerified ?? false},
        ${data.identityVerified ?? false},
        ${data.backgroundChecked ?? false},
        ${data.aiMatchingEnabled ?? true},
        ${data.aiAutoApplyEnabled ?? false},
        ${data.aiAutoApplyThreshold || 85},
        ${data.proactiveOpportunities ?? true},
        0,
        0,
        null,
        0,
        null,
        null,
        null,
        ${referrerUserId || null},
        ${referralCode},
        0,
        'pending'
      )
      RETURNING *
    `;

    const profile = mapRowToProfile(result.rows[0]);

    // If referred, set up the attribution chain
    if (referrerUserId) {
      await createWorkerAttribution(profile.id, referrerUserId);
    }

    const skillsMessage = profile.skills.length > 0
      ? `I've noted your skills in ${profile.skills.slice(0, 3).join(', ')}${profile.skills.length > 3 ? ` and ${profile.skills.length - 3} more` : ''}.`
      : "You haven't added any skills yet - that's important for matching you with tasks.";

    return {
      success: true,
      message: `Welcome aboard! I've created your worker profile. ${skillsMessage}`,
      profile,
      nextSteps: [
        profile.skills.length === 0 ? "Add your skills to get matched with relevant tasks" : null,
        !profile.hourlyRateMin ? "Set your hourly rate range" : null,
        !profile.headline ? "Add a headline that describes what you do" : null,
      ].filter(Boolean) as string[]
    };
  } catch (error: any) {
    console.error('Error creating worker profile:', error);

    if (error.code === '23505') { // Unique violation
      return {
        success: false,
        message: "Looks like you already have a worker profile. Want me to show you your current profile instead?"
      };
    }

    return {
      success: false,
      message: "I had trouble creating your profile. Let me try again - could you tell me your name and main skills?"
    };
  }
}

export async function updateWorkerProfile(
  workerId: string,
  updates: Partial<WorkerProfile>
): Promise<WorkerProfileResponse> {
  try {
    const result = await sql`
      UPDATE worker_profiles
      SET
        display_name = COALESCE(${updates.displayName}, display_name),
        headline = COALESCE(${updates.headline}, headline),
        bio = COALESCE(${updates.bio}, bio),
        avatar_url = COALESCE(${updates.avatarUrl}, avatar_url),
        skills = COALESCE(${updates.skills}, skills),
        skill_levels = COALESCE(${updates.skillLevels ? JSON.stringify(updates.skillLevels) : null}, skill_levels),
        categories = COALESCE(${updates.categories}, categories),
        experience_years = COALESCE(${updates.experienceYears}, experience_years),
        hourly_rate_min = COALESCE(${updates.hourlyRateMin}, hourly_rate_min),
        hourly_rate_max = COALESCE(${updates.hourlyRateMax}, hourly_rate_max),
        preferred_rate = COALESCE(${updates.preferredRate}, preferred_rate),
        preferred_currency = COALESCE(${updates.preferredCurrency}, preferred_currency),
        portfolio_url = COALESCE(${updates.portfolioUrl}, portfolio_url),
        linkedin_url = COALESCE(${updates.linkedinUrl}, linkedin_url),
        github_url = COALESCE(${updates.githubUrl}, github_url),
        website_url = COALESCE(${updates.websiteUrl}, website_url),
        availability = COALESCE(${updates.availability}, availability),
        hours_per_week = COALESCE(${updates.hoursPerWeek}, hours_per_week),
        timezone = COALESCE(${updates.timezone}, timezone),
        locations = COALESCE(${updates.locations}, locations),
        remote_only = COALESCE(${updates.remoteOnly}, remote_only),
        willing_to_relocate = COALESCE(${updates.willingToRelocate}, willing_to_relocate),
        preferred_task_types = COALESCE(${updates.preferredTaskTypes}, preferred_task_types),
        preferred_industries = COALESCE(${updates.preferredIndustries}, preferred_industries),
        min_task_value = COALESCE(${updates.minTaskValue}, min_task_value),
        max_tasks_active = COALESCE(${updates.maxTasksActive}, max_tasks_active),
        ai_matching_enabled = COALESCE(${updates.aiMatchingEnabled}, ai_matching_enabled),
        ai_auto_apply_enabled = COALESCE(${updates.aiAutoApplyEnabled}, ai_auto_apply_enabled),
        ai_auto_apply_threshold = COALESCE(${updates.aiAutoApplyThreshold}, ai_auto_apply_threshold),
        proactive_opportunities = COALESCE(${updates.proactiveOpportunities}, proactive_opportunities),
        status = COALESCE(${updates.status}, status),
        updated_at = NOW()
      WHERE id = ${workerId}
      RETURNING *
    `;

    if (result.rows.length === 0) {
      return {
        success: false,
        message: "I couldn't find that worker profile to update. Are you sure you have the right profile?"
      };
    }

    const profile = mapRowToProfile(result.rows[0]);

    // Generate a helpful update message
    const changedFields: string[] = [];
    if (updates.skills) changedFields.push('skills');
    if (updates.hourlyRateMin || updates.hourlyRateMax) changedFields.push('rate');
    if (updates.availability) changedFields.push('availability');
    if (updates.headline) changedFields.push('headline');

    const message = changedFields.length > 0
      ? `Got it! I've updated your ${changedFields.join(', ')}. Your profile is looking good.`
      : "Your profile has been updated successfully.";

    return {
      success: true,
      message,
      profile
    };
  } catch (error) {
    console.error('Error updating worker profile:', error);
    return {
      success: false,
      message: "I ran into an issue updating your profile. Let's try that again."
    };
  }
}

// =====================================================
// SKILLS MANAGEMENT
// =====================================================

export async function getWorkerSkills(workerId: string): Promise<{
  success: boolean;
  message: string;
  skills: string[];
  skillLevels?: Record<string, SkillLevel>;
}> {
  try {
    const result = await sql`
      SELECT skills, skill_levels FROM worker_profiles WHERE id = ${workerId}
    `;

    if (result.rows.length === 0) {
      return {
        success: false,
        message: "I couldn't find that worker profile.",
        skills: []
      };
    }

    const skills = result.rows[0].skills || [];
    const skillLevels = result.rows[0].skill_levels;

    if (skills.length === 0) {
      return {
        success: true,
        message: "You haven't added any skills yet. Tell me what you're good at and I'll add them to your profile.",
        skills: []
      };
    }

    return {
      success: true,
      message: `You have ${skills.length} skills listed: ${skills.join(', ')}.`,
      skills,
      skillLevels
    };
  } catch (error) {
    console.error('Error fetching worker skills:', error);
    return {
      success: false,
      message: "I had trouble looking up your skills. Let me try again.",
      skills: []
    };
  }
}

export async function addWorkerSkills(
  workerId: string,
  newSkills: string[],
  levels?: Record<string, SkillLevel>
): Promise<WorkerProfileResponse> {
  try {
    // Get current skills
    const current = await sql`
      SELECT skills, skill_levels FROM worker_profiles WHERE id = ${workerId}
    `;

    if (current.rows.length === 0) {
      return {
        success: false,
        message: "I couldn't find your profile to add skills to."
      };
    }

    const currentSkills = current.rows[0].skills || [];
    const currentLevels = current.rows[0].skill_levels || {};

    // Merge skills (avoid duplicates)
    const mergedSkills = [...new Set([...currentSkills, ...newSkills])];
    const mergedLevels = { ...currentLevels, ...levels };

    const result = await sql`
      UPDATE worker_profiles
      SET
        skills = ${mergedSkills},
        skill_levels = ${JSON.stringify(mergedLevels)},
        updated_at = NOW()
      WHERE id = ${workerId}
      RETURNING *
    `;

    const profile = mapRowToProfile(result.rows[0]);
    const addedCount = mergedSkills.length - currentSkills.length;

    return {
      success: true,
      message: addedCount > 0
        ? `Added ${addedCount} new skill${addedCount > 1 ? 's' : ''} to your profile. You now have ${mergedSkills.length} skills listed.`
        : "Those skills were already on your profile. Want to add any others?",
      profile
    };
  } catch (error) {
    console.error('Error adding worker skills:', error);
    return {
      success: false,
      message: "I couldn't add those skills right now. Let's try again."
    };
  }
}

// =====================================================
// SKILL MANAGEMENT (with 1-5 proficiency)
// =====================================================

/**
 * Add a skill to a worker's profile with proficiency level (1-5)
 * 1 = Beginner, 2 = Basic, 3 = Intermediate, 4 = Advanced, 5 = Expert
 */
export async function addSkill(
  workerId: string,
  skill: string,
  proficiency: number = 3
): Promise<WorkerProfileResponse> {
  try {
    // Validate proficiency is 1-5
    const validProficiency = Math.min(5, Math.max(1, Math.round(proficiency)));

    // Get current skills and skill levels
    const current = await sql`
      SELECT skills, skill_levels FROM worker_profiles WHERE id = ${workerId}
    `;

    if (current.rows.length === 0) {
      return {
        success: false,
        message: "I couldn't find your profile. Would you like me to create one first?"
      };
    }

    const currentSkills: string[] = current.rows[0].skills || [];
    const currentLevels: Record<string, any> = current.rows[0].skill_levels || {};

    // Normalize skill name
    const normalizedSkill = skill.trim();
    const skillKey = normalizedSkill.toLowerCase();

    // Check if skill already exists
    const existingIndex = currentSkills.findIndex(s => s.toLowerCase() === skillKey);
    let updatedSkills: string[];
    let isUpdate = false;

    if (existingIndex >= 0) {
      // Skill exists, update in place
      updatedSkills = currentSkills;
      updatedSkills[existingIndex] = normalizedSkill;
      isUpdate = true;
    } else {
      // Add new skill
      updatedSkills = [...currentSkills, normalizedSkill];
    }

    // Map proficiency number to skill level
    const proficiencyToLevel: Record<number, SkillLevel> = {
      1: 'beginner',
      2: 'beginner',
      3: 'intermediate',
      4: 'advanced',
      5: 'expert'
    };

    const updatedLevels = {
      ...currentLevels,
      [skillKey]: {
        level: proficiencyToLevel[validProficiency],
        proficiency: validProficiency,
        updatedAt: new Date().toISOString()
      }
    };

    const result = await sql`
      UPDATE worker_profiles
      SET
        skills = ${updatedSkills},
        skill_levels = ${JSON.stringify(updatedLevels)},
        updated_at = NOW()
      WHERE id = ${workerId}
      RETURNING *
    `;

    const profile = mapRowToProfile(result.rows[0]);

    const proficiencyLabels: Record<number, string> = {
      1: 'beginner',
      2: 'basic',
      3: 'intermediate',
      4: 'advanced',
      5: 'expert'
    };

    const message = isUpdate
      ? `Updated ${normalizedSkill} to ${proficiencyLabels[validProficiency]} level (${validProficiency}/5).`
      : `Added ${normalizedSkill} as a ${proficiencyLabels[validProficiency]} skill (${validProficiency}/5). You now have ${updatedSkills.length} skills listed.`;

    return {
      success: true,
      message,
      profile
    };
  } catch (error) {
    console.error('Error adding skill:', error);
    return {
      success: false,
      message: "I had trouble adding that skill. Let's try again - what skill would you like to add?"
    };
  }
}

/**
 * Remove a skill from a worker's profile
 */
export async function removeSkill(
  workerId: string,
  skillId: string
): Promise<WorkerProfileResponse> {
  try {
    // Get current skills
    const current = await sql`
      SELECT skills, skill_levels FROM worker_profiles WHERE id = ${workerId}
    `;

    if (current.rows.length === 0) {
      return {
        success: false,
        message: "I couldn't find your profile."
      };
    }

    const currentSkills: string[] = current.rows[0].skills || [];
    const currentLevels: Record<string, any> = current.rows[0].skill_levels || {};

    // skillId can be either the skill name or an index
    let skillToRemove: string | null = null;
    const skillIndex = parseInt(skillId);

    if (!isNaN(skillIndex) && skillIndex >= 0 && skillIndex < currentSkills.length) {
      // It's an index
      skillToRemove = currentSkills[skillIndex];
    } else {
      // It's a skill name - find it case-insensitively
      const lowerSkillId = skillId.toLowerCase();
      skillToRemove = currentSkills.find(s => s.toLowerCase() === lowerSkillId) || null;
    }

    if (!skillToRemove) {
      return {
        success: false,
        message: `I couldn't find "${skillId}" in your skills. Your current skills are: ${currentSkills.join(', ') || 'none'}.`
      };
    }

    // Remove the skill
    const updatedSkills = currentSkills.filter(s => s.toLowerCase() !== skillToRemove!.toLowerCase());
    const skillKey = skillToRemove.toLowerCase();

    // Remove from skill levels
    const { [skillKey]: removed, ...updatedLevels } = currentLevels;

    const result = await sql`
      UPDATE worker_profiles
      SET
        skills = ${updatedSkills},
        skill_levels = ${JSON.stringify(updatedLevels)},
        updated_at = NOW()
      WHERE id = ${workerId}
      RETURNING *
    `;

    const profile = mapRowToProfile(result.rows[0]);

    return {
      success: true,
      message: `Removed ${skillToRemove} from your skills. You now have ${updatedSkills.length} skill${updatedSkills.length !== 1 ? 's' : ''} listed.`,
      profile
    };
  } catch (error) {
    console.error('Error removing skill:', error);
    return {
      success: false,
      message: "I had trouble removing that skill. Which skill would you like to remove?"
    };
  }
}

/**
 * Parse skills from natural language text
 * Example: "I know React, Node.js, Python, and some AWS"
 * Returns skills with inferred proficiency levels (1-5)
 */
export function parseSkillsFromText(text: string): Array<{ skill: string; proficiency: number }> {
  const skills: Array<{ skill: string; proficiency: number }> = [];
  const lowerText = text.toLowerCase();

  // Proficiency indicators mapped to 1-5 scale
  const expertIndicators = ['expert in', 'mastered', 'senior', 'lead', '10+ years', '8+ years', 'extensive'];
  const advancedIndicators = ['advanced', 'proficient in', 'strong', '5+ years', '6+ years', '7+ years', 'very experienced'];
  const intermediateIndicators = ['good at', 'know', 'familiar with', 'comfortable with', '2+ years', '3+ years', '4+ years', 'experienced'];
  const basicIndicators = ['some', 'basic', 'learning', 'a bit of', 'a little', 'starting', 'junior'];
  const beginnerIndicators = ['just started', 'beginner', 'new to', 'trying', 'interested in'];

  // Common skills to look for
  const commonSkills = [
    // Programming languages
    'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'ruby', 'go', 'golang', 'rust', 'swift', 'kotlin', 'php', 'scala',
    // Frontend
    'react', 'vue', 'vue.js', 'angular', 'svelte', 'next.js', 'nextjs', 'nuxt', 'gatsby', 'html', 'css', 'sass', 'scss', 'tailwind', 'bootstrap',
    // Backend
    'node.js', 'nodejs', 'node', 'express', 'fastify', 'django', 'flask', 'rails', 'spring', 'laravel', '.net', 'asp.net',
    // Databases
    'sql', 'postgresql', 'postgres', 'mysql', 'mongodb', 'redis', 'elasticsearch', 'dynamodb', 'cassandra', 'sqlite',
    // Cloud & DevOps
    'aws', 'gcp', 'google cloud', 'azure', 'docker', 'kubernetes', 'k8s', 'terraform', 'ansible', 'jenkins', 'ci/cd', 'github actions',
    // Data & AI
    'machine learning', 'ml', 'ai', 'data science', 'data analysis', 'tensorflow', 'pytorch', 'pandas', 'numpy', 'r',
    // Design
    'figma', 'sketch', 'photoshop', 'illustrator', 'ui/ux', 'ui design', 'ux design', 'product design', 'web design', 'graphic design',
    // Other tech
    'graphql', 'rest', 'api', 'git', 'agile', 'scrum', 'jira', 'linux', 'unix', 'blockchain', 'solidity', 'web3',
    // Business skills
    'project management', 'product management', 'marketing', 'seo', 'content writing', 'copywriting', 'social media', 'analytics', 'excel', 'powerpoint'
  ];

  // Extract skills mentioned in text
  for (const skill of commonSkills) {
    if (lowerText.includes(skill)) {
      // Determine proficiency based on context
      let proficiency = 3; // Default to intermediate

      // Look for proficiency indicators near the skill
      const skillIndex = lowerText.indexOf(skill);
      const contextStart = Math.max(0, skillIndex - 30);
      const contextEnd = Math.min(lowerText.length, skillIndex + skill.length + 30);
      const context = lowerText.substring(contextStart, contextEnd);

      if (expertIndicators.some(ind => context.includes(ind))) {
        proficiency = 5;
      } else if (advancedIndicators.some(ind => context.includes(ind))) {
        proficiency = 4;
      } else if (intermediateIndicators.some(ind => context.includes(ind))) {
        proficiency = 3;
      } else if (basicIndicators.some(ind => context.includes(ind))) {
        proficiency = 2;
      } else if (beginnerIndicators.some(ind => context.includes(ind))) {
        proficiency = 1;
      }

      // Capitalize skill name properly
      const formattedSkill = skill
        .split(/[\s-]/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(skill.includes('-') ? '-' : ' ');

      // Avoid duplicates
      if (!skills.some(s => s.skill.toLowerCase() === skill)) {
        skills.push({ skill: formattedSkill, proficiency });
      }
    }
  }

  // Also try to extract skills from comma/and separated lists
  const listPatterns = [
    /(?:I know|I can do|skills include|good at|experienced in|proficient in|work with)\s*:?\s*(.+?)(?:\.|$)/gi,
    /(?:my skills are|I specialize in)\s*:?\s*(.+?)(?:\.|$)/gi
  ];

  for (const pattern of listPatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const skillList = match[1]
        .split(/,|and|&/)
        .map(s => s.trim())
        .filter(s => s.length > 1 && s.length < 50 && !s.match(/^(the|a|an|to|for|with|in|on)$/i));

      for (const skillName of skillList) {
        // Check if this skill is already in our list
        if (!skills.some(s => s.skill.toLowerCase() === skillName.toLowerCase())) {
          // Determine proficiency from the pattern context
          let proficiency = 3;
          const lowerSkillName = skillName.toLowerCase();

          if (basicIndicators.some(ind => lowerSkillName.includes(ind.replace(/\s/g, '')))) {
            proficiency = 2;
          }

          skills.push({
            skill: skillName.charAt(0).toUpperCase() + skillName.slice(1),
            proficiency
          });
        }
      }
    }
  }

  return skills;
}

// =====================================================
// AVAILABILITY MANAGEMENT
// =====================================================

/**
 * Parse availability from natural language text
 * Example: "I can work mornings, about 4 hours a day, not weekends"
 */
export function parseAvailabilityFromText(text: string): ParsedAvailability {
  const availability: ParsedAvailability = {};
  const lowerText = text.toLowerCase();

  // Parse hours per week
  const hoursPatterns = [
    /(\d+)\s*(?:-\s*\d+\s*)?hours?\s*(?:per|a|\/)\s*week/i,
    /(\d+)\s*(?:-\s*\d+\s*)?hrs?\s*(?:per|a|\/)\s*week/i,
    /(?:about|around|roughly|approximately)\s*(\d+)\s*hours?/i,
    /(\d+)\s*hours?\s*(?:per|a)\s*day/i
  ];

  for (const pattern of hoursPatterns) {
    const match = text.match(pattern);
    if (match) {
      let hours = parseInt(match[1]);
      // If it's hours per day, multiply by 5 (workdays)
      if (pattern.source.includes('day')) {
        hours *= 5;
      }
      availability.hoursPerWeek = hours;
      break;
    }
  }

  // Parse preferred times
  const preferredTimes: string[] = [];

  if (lowerText.includes('morning') || lowerText.match(/\b(am|8|9|10)\s*(am|o'clock)?\b/)) {
    preferredTimes.push('morning');
  }
  if (lowerText.includes('afternoon') || lowerText.match(/\b(12|1|2|3|4)\s*(pm|o'clock)?\b/)) {
    preferredTimes.push('afternoon');
  }
  if (lowerText.includes('evening') || lowerText.match(/\b(5|6|7|8)\s*(pm|o'clock)?\b/)) {
    preferredTimes.push('evening');
  }
  if (lowerText.includes('night') || lowerText.match(/\b(9|10|11)\s*(pm|o'clock)?\b/)) {
    preferredTimes.push('night');
  }
  if (lowerText.includes('flexible') || lowerText.includes('anytime') || lowerText.includes('any time')) {
    preferredTimes.push('flexible');
  }

  if (preferredTimes.length > 0) {
    availability.preferredTimes = preferredTimes;
  }

  // Parse available days
  const allDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
  const weekendDays = ['saturday', 'sunday'];
  const availableDays: string[] = [];

  // Check for weekdays/weekends
  if (lowerText.includes('weekdays') || lowerText.includes('week days')) {
    availableDays.push(...weekdays);
  }
  if (lowerText.includes('weekends') || lowerText.includes('week ends')) {
    if (!lowerText.includes('not weekends') && !lowerText.includes('no weekends') && !lowerText.includes("except weekend")) {
      availableDays.push(...weekendDays);
    }
  }

  // Check for specific days
  for (const day of allDays) {
    if (lowerText.includes(day)) {
      if (!availableDays.includes(day)) {
        availableDays.push(day);
      }
    }
  }

  // Handle "not weekends" / "no weekends"
  if (lowerText.includes('not weekend') || lowerText.includes('no weekend') || lowerText.includes("except weekend")) {
    // Remove weekend days if present
    const index1 = availableDays.indexOf('saturday');
    const index2 = availableDays.indexOf('sunday');
    if (index1 > -1) availableDays.splice(index1, 1);
    if (index2 > -1) availableDays.splice(index2, 1);

    // If no days specified, assume weekdays
    if (availableDays.length === 0) {
      availableDays.push(...weekdays);
    }
  }

  // Default to weekdays if nothing specified but hours are
  if (availableDays.length === 0 && availability.hoursPerWeek) {
    availableDays.push(...weekdays);
  }

  if (availableDays.length > 0) {
    availability.availableDays = availableDays;
  }

  // Parse start/end times
  const timeRangeMatch = text.match(/(\d{1,2})\s*(?::|\.)?(\d{2})?\s*(am|pm)?\s*(?:to|-)\s*(\d{1,2})\s*(?::|\.)?(\d{2})?\s*(am|pm)?/i);
  if (timeRangeMatch) {
    let startHour = parseInt(timeRangeMatch[1]);
    let endHour = parseInt(timeRangeMatch[4]);
    const startAmPm = timeRangeMatch[3]?.toLowerCase();
    const endAmPm = timeRangeMatch[6]?.toLowerCase();

    // Convert to 24-hour format
    if (startAmPm === 'pm' && startHour !== 12) startHour += 12;
    if (startAmPm === 'am' && startHour === 12) startHour = 0;
    if (endAmPm === 'pm' && endHour !== 12) endHour += 12;
    if (endAmPm === 'am' && endHour === 12) endHour = 0;

    availability.startTime = `${startHour.toString().padStart(2, '0')}:${timeRangeMatch[2] || '00'}`;
    availability.endTime = `${endHour.toString().padStart(2, '0')}:${timeRangeMatch[5] || '00'}`;
  }

  // Parse timezone
  const tzPatterns = [
    /(?:timezone|time zone|tz)\s*(?:is|:)?\s*([A-Za-z_\/]+)/i,
    /\b(EST|PST|CST|MST|GMT|UTC|PT|ET|CT|MT)(?:\s|$)/i,
    /\b(Eastern|Pacific|Central|Mountain)\s*(?:Time|Standard|Daylight)?\b/i
  ];

  for (const pattern of tzPatterns) {
    const match = text.match(pattern);
    if (match) {
      const tz = match[1].toUpperCase();
      const tzMap: Record<string, string> = {
        'EST': 'America/New_York',
        'ET': 'America/New_York',
        'EASTERN': 'America/New_York',
        'PST': 'America/Los_Angeles',
        'PT': 'America/Los_Angeles',
        'PACIFIC': 'America/Los_Angeles',
        'CST': 'America/Chicago',
        'CT': 'America/Chicago',
        'CENTRAL': 'America/Chicago',
        'MST': 'America/Denver',
        'MT': 'America/Denver',
        'MOUNTAIN': 'America/Denver',
        'GMT': 'Europe/London',
        'UTC': 'UTC'
      };
      availability.timezone = tzMap[tz] || match[1];
      break;
    }
  }

  // Parse availability status
  if (lowerText.includes('full-time') || lowerText.includes('full time') || lowerText.includes('fulltime')) {
    availability.status = 'full_time';
  } else if (lowerText.includes('part-time') || lowerText.includes('part time') || lowerText.includes('parttime')) {
    availability.status = 'part_time';
  } else if (lowerText.includes('freelance') || lowerText.includes('flexible')) {
    availability.status = 'freelance';
  } else if (lowerText.includes('contract')) {
    availability.status = 'contract';
  } else if (lowerText.includes('available') || lowerText.includes('open') || lowerText.includes('ready')) {
    availability.status = 'available';
  } else if (lowerText.includes('busy') || lowerText.includes('not available') || lowerText.includes('unavailable')) {
    availability.status = 'busy';
  }

  // Extract any notes
  const notesMatch = text.match(/(?:note|prefer|prefer to|ideally|but)\s*:?\s*(.+?)(?:\.|$)/i);
  if (notesMatch && notesMatch[1].length > 5 && notesMatch[1].length < 200) {
    availability.notes = notesMatch[1].trim();
  }

  return availability;
}

/**
 * Update worker availability with parsed data
 */
export async function updateAvailability(
  workerId: string,
  availability: ParsedAvailability | WorkerAvailability
): Promise<WorkerProfileResponse> {
  try {
    // Build update fields based on what's provided
    const updates: Partial<WorkerProfile> = {};

    if ('hoursPerWeek' in availability && availability.hoursPerWeek) {
      updates.hoursPerWeek = availability.hoursPerWeek;
    }

    if ('status' in availability && availability.status) {
      updates.availability = availability.status;
    }

    if ('timezone' in availability && availability.timezone) {
      updates.timezone = availability.timezone;
    }

    const result = await sql`
      UPDATE worker_profiles
      SET
        hours_per_week = COALESCE(${updates.hoursPerWeek || null}, hours_per_week),
        availability = COALESCE(${updates.availability || null}, availability),
        timezone = COALESCE(${updates.timezone || null}, timezone),
        updated_at = NOW()
      WHERE id = ${workerId}
      RETURNING *
    `;

    if (result.rows.length === 0) {
      return {
        success: false,
        message: "I couldn't find your profile to update."
      };
    }

    const profile = mapRowToProfile(result.rows[0]);

    // Build a conversational response
    const parts: string[] = [];

    if (updates.hoursPerWeek) {
      parts.push(`${updates.hoursPerWeek} hours per week`);
    }

    if ('preferredTimes' in availability && availability.preferredTimes && availability.preferredTimes.length > 0) {
      parts.push(`${availability.preferredTimes.join(' and ')} shifts`);
    }

    if ('availableDays' in availability && availability.availableDays && availability.availableDays.length > 0) {
      if (availability.availableDays.length === 5 &&
          availability.availableDays.every(d => ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].includes(d))) {
        parts.push('weekdays only');
      } else if (availability.availableDays.length === 7) {
        parts.push('any day of the week');
      } else {
        parts.push(availability.availableDays.join(', '));
      }
    }

    if (updates.timezone) {
      parts.push(`${updates.timezone} timezone`);
    }

    const message = parts.length > 0
      ? `Got it! I've updated your availability: ${parts.join(', ')}.`
      : "Your availability has been updated.";

    return {
      success: true,
      message,
      profile
    };
  } catch (error) {
    console.error('Error updating availability:', error);
    return {
      success: false,
      message: "I had trouble updating your availability. Can you tell me again when you're free to work?"
    };
  }
}

export async function updateWorkerAvailability(
  workerId: string,
  status: AvailabilityStatus,
  hoursPerWeek?: number
): Promise<WorkerProfileResponse> {
  try {
    const result = await sql`
      UPDATE worker_profiles
      SET
        availability = ${status},
        hours_per_week = COALESCE(${hoursPerWeek}, hours_per_week),
        updated_at = NOW()
      WHERE id = ${workerId}
      RETURNING *
    `;

    if (result.rows.length === 0) {
      return {
        success: false,
        message: "I couldn't find your profile to update availability."
      };
    }

    const profile = mapRowToProfile(result.rows[0]);

    const statusMessages: Record<AvailabilityStatus, string> = {
      'available': "You're now marked as available for work. I'll start showing you relevant opportunities.",
      'busy': "Got it - you're busy right now. I'll pause new task suggestions until you're free.",
      'unavailable': "Understood - I've marked you as unavailable. Just let me know when you're ready to work again.",
      'looking': "Great! You're actively looking for work. I'll prioritize finding good matches for you.",
      'full_time': `Perfect, you're set for full-time work${hoursPerWeek ? ` at ${hoursPerWeek} hours per week` : ''}.`,
      'part_time': `You're set for part-time work${hoursPerWeek ? ` at ${hoursPerWeek} hours per week` : ''}.`,
      'contract': "You're available for contract work. I'll look for project-based opportunities.",
      'freelance': "You're in freelance mode - flexible and ready for various gigs."
    };

    return {
      success: true,
      message: statusMessages[status] || `Your availability is now set to ${status}.`,
      profile
    };
  } catch (error) {
    console.error('Error updating worker availability:', error);
    return {
      success: false,
      message: "I had trouble updating your availability. Want to try again?"
    };
  }
}

// =====================================================
// WORKER STATS
// =====================================================

export async function getWorkerStats(workerId: string): Promise<WorkerStatsResponse> {
  try {
    // Get earnings stats
    const earningsResult = await sql`
      SELECT
        COALESCE(SUM(CASE WHEN status IN ('available', 'paid', 'withdrawn') THEN net_amount ELSE 0 END), 0) as total_earnings,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN net_amount ELSE 0 END), 0) as pending_earnings,
        COALESCE(SUM(CASE WHEN status = 'available' THEN net_amount ELSE 0 END), 0) as available_balance,
        COALESCE(SUM(CASE WHEN type IN ('attribution', 'referral') THEN net_amount ELSE 0 END), 0) as attribution_earnings,
        COALESCE(SUM(CASE WHEN created_at >= date_trunc('month', CURRENT_DATE) THEN net_amount ELSE 0 END), 0) as this_month,
        COALESCE(SUM(CASE WHEN created_at >= date_trunc('month', CURRENT_DATE - interval '1 month') AND created_at < date_trunc('month', CURRENT_DATE) THEN net_amount ELSE 0 END), 0) as last_month
      FROM worker_earnings
      WHERE worker_id = ${workerId}
    `;

    // Get task stats
    const taskResult = await sql`
      SELECT
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status IN ('active', 'pending', 'submitted', 'under_review') THEN 1 END) as in_progress
      FROM task_assignments
      WHERE worker_id = ${workerId}
    `;

    // Get application stats
    const appResult = await sql`
      SELECT
        COUNT(CASE WHEN status IN ('pending', 'reviewed', 'shortlisted', 'interviewing') THEN 1 END) as active_apps,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_apps
      FROM task_applications
      WHERE worker_id = ${workerId}
    `;

    // Get rating stats
    const ratingResult = await sql`
      SELECT
        AVG(rating) as avg_rating,
        COUNT(rating) as total_ratings
      FROM task_reviews
      WHERE reviewee_id = ${workerId} AND status = 'published'
    `;

    // Get referral and network stats
    const networkResult = await sql`
      SELECT
        COUNT(DISTINCT wp.id) as referral_count,
        COUNT(DISTINCT wa.level1_referrer_id) + COUNT(DISTINCT wa.level2_referrer_id) +
        COUNT(DISTINCT wa.level3_referrer_id) + COUNT(DISTINCT wa.level4_referrer_id) as network_size
      FROM worker_profiles wp
      LEFT JOIN worker_attributions wa ON wa.worker_id = wp.id
      WHERE wp.referred_by = ${workerId} OR wa.level1_referrer_id = ${workerId}
    `;

    const earnings = earningsResult.rows[0] || {};
    const tasks = taskResult.rows[0] || {};
    const apps = appResult.rows[0] || {};
    const ratings = ratingResult.rows[0] || {};
    const network = networkResult.rows[0] || {};

    const totalEarnings = parseFloat(earnings.total_earnings) || 0;
    const thisMonth = parseFloat(earnings.this_month) || 0;
    const lastMonth = parseFloat(earnings.last_month) || 0;
    const tasksCompleted = parseInt(tasks.completed) || 0;
    const avgRating = ratings.avg_rating ? parseFloat(ratings.avg_rating) : null;

    // Calculate growth
    const earningsGrowth = lastMonth > 0
      ? ((thisMonth - lastMonth) / lastMonth) * 100
      : (thisMonth > 0 ? 100 : null);

    // Calculate success rate
    const totalApps = await sql`
      SELECT COUNT(*) as total FROM task_applications WHERE worker_id = ${workerId}
    `;
    const acceptedApps = await sql`
      SELECT COUNT(*) as accepted FROM task_applications WHERE worker_id = ${workerId} AND status = 'accepted'
    `;
    const totalAppCount = parseInt(totalApps.rows[0]?.total) || 0;
    const acceptedCount = parseInt(acceptedApps.rows[0]?.accepted) || 0;
    const successRate = totalAppCount > 0 ? (acceptedCount / totalAppCount) * 100 : null;

    const stats: WorkerStats = {
      totalEarnings,
      pendingEarnings: parseFloat(earnings.pending_earnings) || 0,
      availableBalance: parseFloat(earnings.available_balance) || 0,
      tasksCompleted,
      tasksInProgress: parseInt(tasks.in_progress) || 0,
      applicationsActive: parseInt(apps.active_apps) || 0,
      applicationsPending: parseInt(apps.pending_apps) || 0,
      averageRating: avgRating,
      totalRatings: parseInt(ratings.total_ratings) || 0,
      successRate,
      attributionEarnings: parseFloat(earnings.attribution_earnings) || 0,
      referralCount: parseInt(network.referral_count) || 0,
      networkSize: parseInt(network.network_size) || 0,
      thisMonthEarnings: thisMonth,
      lastMonthEarnings: lastMonth,
      earningsGrowth
    };

    // Generate conversational message
    let message = '';
    if (totalEarnings > 0) {
      message = `You've earned $${totalEarnings.toLocaleString()} total across ${tasksCompleted} completed tasks.`;
      if (avgRating) {
        message += ` Your rating is ${avgRating.toFixed(1)} stars.`;
      }
      if (earningsGrowth && earningsGrowth > 0) {
        message += ` Nice work - you're up ${earningsGrowth.toFixed(0)}% from last month!`;
      }
    } else if (tasksCompleted > 0) {
      message = `You've completed ${tasksCompleted} tasks. Keep going!`;
    } else {
      message = "You're just getting started. Complete your first task to see your stats here.";
    }

    return {
      success: true,
      message,
      stats
    };
  } catch (error) {
    console.error('Error fetching worker stats:', error);
    return {
      success: false,
      message: "I had trouble pulling your stats. Let me try again.",
      stats: {
        totalEarnings: 0,
        pendingEarnings: 0,
        availableBalance: 0,
        tasksCompleted: 0,
        tasksInProgress: 0,
        applicationsActive: 0,
        applicationsPending: 0,
        averageRating: null,
        totalRatings: 0,
        successRate: null,
        attributionEarnings: 0,
        referralCount: 0,
        networkSize: 0,
        thisMonthEarnings: 0,
        lastMonthEarnings: 0,
        earningsGrowth: null
      }
    };
  }
}

// =====================================================
// EARNINGS MANAGEMENT
// =====================================================

export async function getWorkerEarnings(
  workerId: string,
  filters?: EarningsFilters
): Promise<WorkerEarningsResponse> {
  try {
    // Build filter conditions
    let conditions = `worker_id = $1`;
    const params: any[] = [workerId];
    let paramIndex = 2;

    if (filters?.startDate) {
      conditions += ` AND created_at >= $${paramIndex}`;
      params.push(filters.startDate);
      paramIndex++;
    }

    if (filters?.endDate) {
      conditions += ` AND created_at <= $${paramIndex}`;
      params.push(filters.endDate);
      paramIndex++;
    }

    if (filters?.type && filters.type.length > 0) {
      conditions += ` AND type = ANY($${paramIndex})`;
      params.push(filters.type);
      paramIndex++;
    }

    if (filters?.status && filters.status.length > 0) {
      conditions += ` AND status = ANY($${paramIndex})`;
      params.push(filters.status);
      paramIndex++;
    }

    if (filters?.minAmount) {
      conditions += ` AND net_amount >= $${paramIndex}`;
      params.push(filters.minAmount);
      paramIndex++;
    }

    if (filters?.maxAmount) {
      conditions += ` AND net_amount <= $${paramIndex}`;
      params.push(filters.maxAmount);
      paramIndex++;
    }

    // Fetch earnings using raw query due to dynamic conditions
    const earningsQuery = `
      SELECT * FROM worker_earnings
      WHERE ${conditions}
      ORDER BY created_at DESC
      LIMIT 100
    `;

    // Use a simpler approach with sqlQuery
    const result = await sql`
      SELECT * FROM worker_earnings
      WHERE worker_id = ${workerId}
      ORDER BY created_at DESC
      LIMIT 100
    `;

    const earnings: WorkerEarnings[] = result.rows.map(mapRowToEarnings);

    // Filter in-memory for complex filters (for MVP, can optimize later)
    let filteredEarnings = earnings;
    if (filters?.startDate) {
      filteredEarnings = filteredEarnings.filter(e => e.createdAt >= filters.startDate!);
    }
    if (filters?.endDate) {
      filteredEarnings = filteredEarnings.filter(e => e.createdAt <= filters.endDate!);
    }
    if (filters?.type && filters.type.length > 0) {
      filteredEarnings = filteredEarnings.filter(e => filters.type!.includes(e.type));
    }
    if (filters?.status && filters.status.length > 0) {
      filteredEarnings = filteredEarnings.filter(e => filters.status!.includes(e.status));
    }

    // Calculate summary
    const summary: EarningsSummary = {
      totalGross: 0,
      totalNet: 0,
      totalFees: 0,
      totalPlatformFee: 0,
      totalProcessingFee: 0,
      byType: {},
      byStatus: {},
      availableBalance: 0,
      pendingAmount: 0
    };

    for (const earning of filteredEarnings) {
      summary.totalGross += earning.grossAmount;
      summary.totalNet += earning.netAmount;
      summary.totalPlatformFee += earning.platformFee;
      summary.totalProcessingFee += earning.processingFee;
      summary.totalFees += earning.platformFee + earning.processingFee;

      summary.byType[earning.type] = (summary.byType[earning.type] || 0) + earning.netAmount;
      summary.byStatus[earning.status] = (summary.byStatus[earning.status] || 0) + earning.netAmount;

      if (earning.status === 'available') {
        summary.availableBalance += earning.netAmount;
      }
      if (earning.status === 'pending') {
        summary.pendingAmount += earning.netAmount;
      }
    }

    // Generate conversational message
    let message = '';
    if (filteredEarnings.length === 0) {
      message = filters?.startDate || filters?.type
        ? "No earnings found matching those filters."
        : "No earnings recorded yet. Complete some tasks to start earning!";
    } else {
      message = `Found ${filteredEarnings.length} earnings totaling $${summary.totalNet.toLocaleString()} net.`;
      if (summary.availableBalance > 0) {
        message += ` You have $${summary.availableBalance.toLocaleString()} available to withdraw.`;
      }
    }

    return {
      success: true,
      message,
      earnings: filteredEarnings,
      summary,
      period: filters?.startDate && filters?.endDate
        ? { start: filters.startDate, end: filters.endDate }
        : undefined
    };
  } catch (error) {
    console.error('Error fetching worker earnings:', error);
    return {
      success: false,
      message: "I had trouble looking up your earnings. Let me try again.",
      earnings: [],
      summary: {
        totalGross: 0,
        totalNet: 0,
        totalFees: 0,
        totalPlatformFee: 0,
        totalProcessingFee: 0,
        byType: {},
        byStatus: {},
        availableBalance: 0,
        pendingAmount: 0
      }
    };
  }
}

// =====================================================
// ATTRIBUTION MANAGEMENT (4-Level Chain)
// =====================================================

export async function getWorkerAttribution(workerId: string): Promise<WorkerAttributionResponse> {
  try {
    const result = await sql`
      SELECT wa.*,
        l1.display_name as l1_name, l1.avatar_url as l1_avatar,
        l2.display_name as l2_name, l2.avatar_url as l2_avatar,
        l3.display_name as l3_name, l3.avatar_url as l3_avatar,
        l4.display_name as l4_name, l4.avatar_url as l4_avatar
      FROM worker_attributions wa
      LEFT JOIN worker_profiles l1 ON wa.level1_referrer_id = l1.id
      LEFT JOIN worker_profiles l2 ON wa.level2_referrer_id = l2.id
      LEFT JOIN worker_profiles l3 ON wa.level3_referrer_id = l3.id
      LEFT JOIN worker_profiles l4 ON wa.level4_referrer_id = l4.id
      WHERE wa.worker_id = ${workerId}
    `;

    if (result.rows.length === 0) {
      // Get the worker's referral code
      const profileResult = await sql`
        SELECT referral_code FROM worker_profiles WHERE id = ${workerId}
      `;
      const referralCode = profileResult.rows[0]?.referral_code;

      return {
        success: true,
        message: "You weren't referred by anyone, but you can still refer others and earn attribution!",
        attribution: null,
        chain: null,
        earnings: {
          totalGenerated: 0,
          totalReceived: 0,
          pendingAmount: 0,
          byLevel: {}
        },
        referralCode,
        referralLink: referralCode ? `https://wellsai.com/join?ref=${referralCode}` : undefined
      };
    }

    const row = result.rows[0];
    const attribution: WorkerAttribution = {
      id: row.id,
      workerId: row.worker_id,
      level1ReferrerId: row.level1_referrer_id,
      level1Percent: parseFloat(row.level1_percent) || DEFAULT_ATTRIBUTION_PERCENTS.level1,
      level2ReferrerId: row.level2_referrer_id,
      level2Percent: parseFloat(row.level2_percent) || DEFAULT_ATTRIBUTION_PERCENTS.level2,
      level3ReferrerId: row.level3_referrer_id,
      level3Percent: parseFloat(row.level3_percent) || DEFAULT_ATTRIBUTION_PERCENTS.level3,
      level4ReferrerId: row.level4_referrer_id,
      level4Percent: parseFloat(row.level4_percent) || DEFAULT_ATTRIBUTION_PERCENTS.level4,
      totalEarningsGenerated: parseFloat(row.total_earnings_generated) || 0,
      totalAttributionPaid: parseFloat(row.total_attribution_paid) || 0,
      isActive: row.is_active,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };

    // Build the chain
    const chain: AttributionChain = {
      workerId,
      chain: [],
      totalPercent: 0
    };

    if (row.level1_referrer_id) {
      chain.chain.push({
        level: 1,
        referrerId: row.level1_referrer_id,
        referrerName: row.l1_name,
        referrerAvatarUrl: row.l1_avatar,
        percent: attribution.level1Percent
      });
      chain.totalPercent += attribution.level1Percent;
    }

    if (row.level2_referrer_id) {
      chain.chain.push({
        level: 2,
        referrerId: row.level2_referrer_id,
        referrerName: row.l2_name,
        referrerAvatarUrl: row.l2_avatar,
        percent: attribution.level2Percent
      });
      chain.totalPercent += attribution.level2Percent;
    }

    if (row.level3_referrer_id) {
      chain.chain.push({
        level: 3,
        referrerId: row.level3_referrer_id,
        referrerName: row.l3_name,
        referrerAvatarUrl: row.l3_avatar,
        percent: attribution.level3Percent
      });
      chain.totalPercent += attribution.level3Percent;
    }

    if (row.level4_referrer_id) {
      chain.chain.push({
        level: 4,
        referrerId: row.level4_referrer_id,
        referrerName: row.l4_name,
        referrerAvatarUrl: row.l4_avatar,
        percent: attribution.level4Percent
      });
      chain.totalPercent += attribution.level4Percent;
    }

    // Get earnings breakdown by level
    const earningsResult = await sql`
      SELECT
        attribution_level,
        SUM(net_amount) as total
      FROM worker_earnings
      WHERE attributed_from_id = ${workerId} AND type = 'attribution'
      GROUP BY attribution_level
    `;

    const byLevel: Record<number, number> = {};
    for (const row of earningsResult.rows) {
      byLevel[row.attribution_level] = parseFloat(row.total) || 0;
    }

    // Get pending attribution earnings
    const pendingResult = await sql`
      SELECT COALESCE(SUM(net_amount), 0) as pending
      FROM worker_earnings
      WHERE attributed_from_id = ${workerId} AND type = 'attribution' AND status = 'pending'
    `;

    const referralCodeResult = await sql`
      SELECT referral_code FROM worker_profiles WHERE id = ${workerId}
    `;
    const referralCode = referralCodeResult.rows[0]?.referral_code;

    const referrerName = row.l1_name || 'someone';
    const message = `You were referred by ${referrerName}. Your earnings generate attribution up to 4 levels: ${chain.chain.map(l => `${l.referrerName || 'Level ' + l.level} (${l.percent}%)`).join(' -> ')}.`;

    return {
      success: true,
      message,
      attribution,
      chain,
      earnings: {
        totalGenerated: attribution.totalEarningsGenerated,
        totalReceived: attribution.totalAttributionPaid,
        pendingAmount: parseFloat(pendingResult.rows[0]?.pending) || 0,
        byLevel
      },
      referralCode,
      referralLink: referralCode ? `https://wellsai.com/join?ref=${referralCode}` : undefined
    };
  } catch (error) {
    console.error('Error fetching worker attribution:', error);
    return {
      success: false,
      message: "I had trouble looking up your attribution chain.",
      attribution: null,
      chain: null,
      earnings: {
        totalGenerated: 0,
        totalReceived: 0,
        pendingAmount: 0,
        byLevel: {}
      }
    };
  }
}

export async function createWorkerAttribution(
  workerId: string,
  referrerUserId: string
): Promise<WorkerAttributionResponse> {
  try {
    // First, get the referrer's worker profile
    const referrerResult = await sql`
      SELECT id FROM worker_profiles WHERE user_id = ${referrerUserId}
    `;

    if (referrerResult.rows.length === 0) {
      return {
        success: false,
        message: "The referrer doesn't have a worker profile yet.",
        attribution: null,
        chain: null,
        earnings: { totalGenerated: 0, totalReceived: 0, pendingAmount: 0, byLevel: {} }
      };
    }

    const referrerId = referrerResult.rows[0].id;

    // Get the referrer's attribution chain to build our chain
    const referrerAttribution = await sql`
      SELECT * FROM worker_attributions WHERE worker_id = ${referrerId}
    `;

    // Build the 4-level chain
    let level1 = referrerId;
    let level2: string | null = null;
    let level3: string | null = null;
    let level4: string | null = null;

    if (referrerAttribution.rows.length > 0) {
      const refAttr = referrerAttribution.rows[0];
      // Shift the chain down one level
      level2 = refAttr.level1_referrer_id;
      level3 = refAttr.level2_referrer_id;
      level4 = refAttr.level3_referrer_id;
      // level4 of referrer gets dropped (chain is only 4 levels)
    }

    // Create the attribution record
    const result = await sql`
      INSERT INTO worker_attributions (
        worker_id,
        level1_referrer_id, level1_percent,
        level2_referrer_id, level2_percent,
        level3_referrer_id, level3_percent,
        level4_referrer_id, level4_percent,
        total_earnings_generated, total_attribution_paid,
        is_active
      ) VALUES (
        ${workerId},
        ${level1}, ${DEFAULT_ATTRIBUTION_PERCENTS.level1},
        ${level2}, ${DEFAULT_ATTRIBUTION_PERCENTS.level2},
        ${level3}, ${DEFAULT_ATTRIBUTION_PERCENTS.level3},
        ${level4}, ${DEFAULT_ATTRIBUTION_PERCENTS.level4},
        0, 0,
        true
      )
      ON CONFLICT (worker_id) DO UPDATE SET
        level1_referrer_id = ${level1},
        level2_referrer_id = ${level2},
        level3_referrer_id = ${level3},
        level4_referrer_id = ${level4},
        updated_at = NOW()
      RETURNING *
    `;

    // Now fetch the full attribution with names
    return getWorkerAttribution(workerId);
  } catch (error) {
    console.error('Error creating worker attribution:', error);
    return {
      success: false,
      message: "I had trouble setting up the attribution chain.",
      attribution: null,
      chain: null,
      earnings: { totalGenerated: 0, totalReceived: 0, pendingAmount: 0, byLevel: {} }
    };
  }
}

// =====================================================
// WORKER SEARCH
// =====================================================

/**
 * Search workers by skills, availability, rate, and other criteria
 */
export async function searchWorkers(
  filters: WorkerSearchFilters
): Promise<WorkerSearchResult> {
  try {
    const limit = filters.limit || 20;
    const offset = filters.offset || 0;

    // Build the base query - we'll filter in SQL where possible
    let result = await sql`
      SELECT *,
        COALESCE(average_rating, 0) as sort_rating,
        COALESCE(completed_tasks, 0) as sort_tasks,
        COALESCE(hourly_rate_min, 0) as sort_rate
      FROM worker_profiles
      WHERE status = 'active'
      ORDER BY
        CASE WHEN average_rating IS NOT NULL THEN average_rating ELSE 0 END DESC,
        completed_tasks DESC
      LIMIT 200
    `;

    let workers: WorkerProfile[] = result.rows.map(mapRowToProfile);

    // Apply filters in-memory (can be optimized to SQL later)
    if (filters.skills && filters.skills.length > 0) {
      const searchSkills = filters.skills.map(s => s.toLowerCase());
      workers = workers.filter(w => {
        const workerSkills = w.skills.map(s => s.toLowerCase());
        return searchSkills.some(skill => workerSkills.some(ws => ws.includes(skill)));
      });
    }

    if (filters.minProficiency && filters.minProficiency > 1) {
      workers = workers.filter(w => {
        if (!w.skillLevels) return false;
        // Check if any skill meets the minimum proficiency
        return Object.values(w.skillLevels).some((level: any) => {
          const proficiency = level.proficiency || proficiencyFromLevel(level);
          return proficiency >= filters.minProficiency!;
        });
      });
    }

    if (filters.availability) {
      workers = workers.filter(w => w.availability === filters.availability);
    }

    if (filters.minHoursPerWeek) {
      workers = workers.filter(w => (w.hoursPerWeek || 0) >= filters.minHoursPerWeek!);
    }

    if (filters.maxHoursPerWeek) {
      workers = workers.filter(w => (w.hoursPerWeek || 40) <= filters.maxHoursPerWeek!);
    }

    if (filters.minRate) {
      workers = workers.filter(w => (w.hourlyRateMin || 0) >= filters.minRate!);
    }

    if (filters.maxRate) {
      workers = workers.filter(w => (w.hourlyRateMax || w.hourlyRateMin || 999999) <= filters.maxRate!);
    }

    if (filters.experienceYears) {
      workers = workers.filter(w => (w.experienceYears || 0) >= filters.experienceYears!);
    }

    if (filters.remoteOnly !== undefined) {
      workers = workers.filter(w => w.remoteOnly === filters.remoteOnly);
    }

    if (filters.timezone) {
      workers = workers.filter(w => w.timezone?.includes(filters.timezone!) || false);
    }

    if (filters.location) {
      const searchLocation = filters.location.toLowerCase();
      workers = workers.filter(w =>
        w.locations?.some(l => l.toLowerCase().includes(searchLocation)) || false
      );
    }

    if (filters.categories && filters.categories.length > 0) {
      const searchCats = filters.categories.map(c => c.toLowerCase());
      workers = workers.filter(w => {
        const workerCats = w.categories.map(c => c.toLowerCase());
        return searchCats.some(cat => workerCats.includes(cat));
      });
    }

    if (filters.minRating) {
      workers = workers.filter(w => (w.averageRating || 0) >= filters.minRating!);
    }

    if (filters.verified) {
      workers = workers.filter(w => w.identityVerified || w.emailVerified);
    }

    // Get total before pagination
    const total = workers.length;

    // Apply sorting
    if (filters.sortBy) {
      workers.sort((a, b) => {
        switch (filters.sortBy) {
          case 'rating':
            return (b.averageRating || 0) - (a.averageRating || 0);
          case 'experience':
            return (b.experienceYears || 0) - (a.experienceYears || 0);
          case 'rate_low':
            return (a.hourlyRateMin || 0) - (b.hourlyRateMin || 0);
          case 'rate_high':
            return (b.hourlyRateMax || b.hourlyRateMin || 0) - (a.hourlyRateMax || a.hourlyRateMin || 0);
          case 'tasks_completed':
            return (b.completedTasks || 0) - (a.completedTasks || 0);
          default:
            return 0;
        }
      });
    }

    // Apply pagination
    workers = workers.slice(offset, offset + limit);

    // Generate conversational message
    let message = '';
    if (workers.length === 0) {
      const filterDesc: string[] = [];
      if (filters.skills?.length) filterDesc.push(`skills in ${filters.skills.join(', ')}`);
      if (filters.availability) filterDesc.push(`${filters.availability} availability`);
      if (filters.maxRate) filterDesc.push(`under $${filters.maxRate}/hour`);

      message = filterDesc.length > 0
        ? `I couldn't find any workers matching ${filterDesc.join(' with ')}. Try broadening your search criteria.`
        : "I couldn't find any workers matching those criteria.";
    } else {
      const skillDesc = filters.skills?.length ? ` with ${filters.skills.join(', ')} skills` : '';
      const rateDesc = filters.maxRate ? ` under $${filters.maxRate}/hour` : '';

      message = `Found ${total} worker${total !== 1 ? 's' : ''}${skillDesc}${rateDesc}. `;

      if (workers.length > 0) {
        const topWorker = workers[0];
        message += `Top match: ${topWorker.displayName}`;
        if (topWorker.averageRating) {
          message += ` (${topWorker.averageRating.toFixed(1)} stars)`;
        }
        if (topWorker.hourlyRateMin) {
          message += ` at $${topWorker.hourlyRateMin}/hour`;
        }
        message += '.';
      }
    }

    return {
      success: true,
      message,
      workers,
      total,
      filters
    };
  } catch (error) {
    console.error('Error searching workers:', error);
    return {
      success: false,
      message: "I had trouble searching for workers. Let me try again - what kind of worker are you looking for?",
      workers: [],
      total: 0,
      filters
    };
  }
}

/**
 * Helper to convert skill level string to proficiency number
 */
function proficiencyFromLevel(level: SkillLevel | string): number {
  const levelMap: Record<string, number> = {
    'beginner': 1,
    'intermediate': 3,
    'advanced': 4,
    'expert': 5
  };
  return levelMap[level as string] || 3;
}

// =====================================================
// NATURAL LANGUAGE PARSING
// =====================================================

/**
 * Parse natural language profile updates
 * Example: "I'm a senior React developer, 5 years experience, available 20 hours/week, $75/hour"
 */
export function parseProfileFromText(text: string): ParsedWorkerProfile {
  const profile: ParsedWorkerProfile = {};

  // Name/headline
  const nameMatch = text.match(/(?:I'm|I am|name is|call me|this is)\s+["']?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
  if (nameMatch) {
    profile.displayName = nameMatch[1].trim();
  }

  // Skills extraction with multiple patterns
  const skillPatterns = [
    /(?:skills?|good at|experienced? in|know|can do|proficient in|expertise in)\s*(?:include|like|are|:)?\s*(.+?)(?:\.|,\s*(?:and|I|my)|$)/gi,
    /(?:specialize in|focus on|expert in|work with)\s+(.+?)(?:\.|,|$)/gi,
    /(?:I do|I work on|I build|I create|I design|I develop)\s+(.+?)(?:\.|,|$)/gi,
  ];

  const extractedSkills: string[] = [];
  for (const pattern of skillPatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const skills = match[1]
        .split(/,|and|&/)
        .map(s => s.trim())
        .filter(s => s.length > 1 && s.length < 50 && !s.match(/^(the|a|an|to|for|with)$/i));
      extractedSkills.push(...skills);
    }
  }

  if (extractedSkills.length > 0) {
    profile.skills = [...new Set(extractedSkills)]; // Remove duplicates
  }

  // Rate extraction
  const rateMatch = text.match(/\$?(\d+)\s*(?:\/|\s*per\s*)?(?:hr|hour)/i);
  if (rateMatch) {
    const rate = parseInt(rateMatch[1]);
    profile.hourlyRateMin = rate;
    profile.hourlyRateMax = rate;
  }

  const rateRangeMatch = text.match(/\$?(\d+)\s*(?:-|to)\s*\$?(\d+)\s*(?:\/|\s*per\s*)?(?:hr|hour)?/i);
  if (rateRangeMatch) {
    profile.hourlyRateMin = parseInt(rateRangeMatch[1]);
    profile.hourlyRateMax = parseInt(rateRangeMatch[2]);
  }

  // Experience years
  const expMatch = text.match(/(\d+)\s*(?:\+)?\s*years?\s*(?:of\s*)?(?:experience|exp|in the (?:field|industry))/i);
  if (expMatch) {
    profile.experienceYears = parseInt(expMatch[1]);
  }

  // Availability status
  if (text.match(/full\s*-?\s*time/i)) {
    profile.availability = 'full_time';
  } else if (text.match(/part\s*-?\s*time/i)) {
    profile.availability = 'part_time';
  } else if (text.match(/contract(?:or|ing)?/i)) {
    profile.availability = 'contract';
  } else if (text.match(/freelance|gig|flexible/i)) {
    profile.availability = 'freelance';
  } else if (text.match(/available|open to|looking for|ready for/i)) {
    profile.availability = 'available';
  } else if (text.match(/busy|not available|unavailable/i)) {
    profile.availability = 'busy';
  }

  // Hours per week
  const hoursMatch = text.match(/(\d+)\s*(?:-\s*\d+\s*)?hours?\s*(?:per|a|\/)\s*week/i);
  if (hoursMatch) {
    profile.hoursPerWeek = parseInt(hoursMatch[1]);
  }

  // Remote preference
  if (text.match(/remote\s*only|only\s*remote|100%?\s*remote|fully\s*remote/i)) {
    profile.remoteOnly = true;
  } else if (text.match(/on\s*-?\s*site|in\s*-?\s*person|office|not\s*remote|hybrid/i)) {
    profile.remoteOnly = false;
  }

  // Location
  const locationMatch = text.match(/(?:based in|located in|from|live in|working from)\s+([A-Za-z\s,]+?)(?:\.|,|$)/i);
  if (locationMatch) {
    profile.location = locationMatch[1].trim();
  }

  // Timezone
  const tzMatch = text.match(/(?:timezone|time zone|tz)(?:\s+is)?\s*:?\s*([A-Za-z\/\_]+|[A-Z]{2,4}|GMT[+-]\d+)/i);
  if (tzMatch) {
    profile.timezone = tzMatch[1].trim();
  }

  // Categories/industries
  const industries = [
    'technology', 'software', 'healthcare', 'finance', 'fintech', 'marketing',
    'design', 'writing', 'engineering', 'consulting', 'education', 'legal',
    'e-commerce', 'ecommerce', 'saas', 'ai', 'machine learning', 'data',
    'mobile', 'web', 'cloud', 'devops', 'security', 'blockchain', 'crypto'
  ];
  const foundCategories: string[] = [];
  const lowerText = text.toLowerCase();
  for (const ind of industries) {
    if (lowerText.includes(ind)) {
      foundCategories.push(ind.charAt(0).toUpperCase() + ind.slice(1));
    }
  }
  if (foundCategories.length > 0) {
    profile.categories = foundCategories;
  }

  // Task type preferences
  if (text.match(/quick|short|small|fast\s*turnaround/i)) {
    profile.preferredTaskTypes = [...(profile.preferredTaskTypes || []), 'quick'];
  }
  if (text.match(/project|larger|substantial|long\s*term/i)) {
    profile.preferredTaskTypes = [...(profile.preferredTaskTypes || []), 'project'];
  }
  if (text.match(/ongoing|recurring|regular|repeat/i)) {
    profile.preferredTaskTypes = [...(profile.preferredTaskTypes || []), 'ongoing'];
  }

  // Headline from bio-like text
  if (text.length > 50 && !profile.headline) {
    const sentences = text.split(/[.!?]/);
    const aboutMe = sentences.find(s =>
      s.match(/I\s+(?:am|specialize|help|work|build|create|design|develop)/i) &&
      s.length > 20 && s.length < 150
    );
    if (aboutMe) {
      profile.headline = aboutMe.trim();
    }
  }

  // Bio if we have a longer description
  if (text.length > 100 && !profile.bio) {
    // Use the whole text as bio if it seems descriptive
    if (text.match(/I\s+(?:am|have|specialize|help|work)/i)) {
      profile.bio = text.substring(0, 500);
    }
  }

  return profile;
}

/**
 * Alias for parseProfileFromText for backward compatibility
 */
export const parseWorkerProfileFromText = parseProfileFromText;

/**
 * Extract skills with confidence levels and experience from text
 */
export function extractSkillsFromText(text: string): SkillExtraction[] {
  const skills: SkillExtraction[] = [];
  const lowerText = text.toLowerCase();

  // Skill level indicators
  const expertIndicators = ['expert', 'mastered', 'advanced', 'senior', 'lead', '10+ years', '8+ years'];
  const advancedIndicators = ['proficient', 'experienced', 'strong', '5+ years', '6+ years', '7+ years'];
  const intermediateIndicators = ['familiar', 'comfortable', 'good', '2+ years', '3+ years', '4+ years'];
  const beginnerIndicators = ['learning', 'basic', 'beginner', 'junior', '1 year', 'new to'];

  // Common tech skills to look for
  const commonSkills = [
    'javascript', 'typescript', 'python', 'java', 'react', 'vue', 'angular', 'node.js', 'nodejs',
    'sql', 'postgresql', 'mysql', 'mongodb', 'redis', 'aws', 'gcp', 'azure', 'docker', 'kubernetes',
    'git', 'ci/cd', 'terraform', 'graphql', 'rest', 'api', 'html', 'css', 'sass', 'tailwind',
    'figma', 'sketch', 'photoshop', 'illustrator', 'ui/ux', 'product design', 'web design',
    'copywriting', 'content writing', 'seo', 'marketing', 'social media', 'analytics',
    'project management', 'scrum', 'agile', 'jira', 'notion', 'excel', 'data analysis'
  ];

  for (const skill of commonSkills) {
    if (lowerText.includes(skill)) {
      let level: SkillLevel = 'intermediate';
      let confidence = 0.7;

      // Check for level indicators near the skill
      const skillIndex = lowerText.indexOf(skill);
      const context = lowerText.substring(Math.max(0, skillIndex - 50), Math.min(lowerText.length, skillIndex + skill.length + 50));

      if (expertIndicators.some(ind => context.includes(ind))) {
        level = 'expert';
        confidence = 0.9;
      } else if (advancedIndicators.some(ind => context.includes(ind))) {
        level = 'advanced';
        confidence = 0.85;
      } else if (intermediateIndicators.some(ind => context.includes(ind))) {
        level = 'intermediate';
        confidence = 0.8;
      } else if (beginnerIndicators.some(ind => context.includes(ind))) {
        level = 'beginner';
        confidence = 0.75;
      }

      // Extract years if mentioned
      const yearsMatch = context.match(/(\d+)\s*(?:\+)?\s*years?/i);
      const yearsExperience = yearsMatch ? parseInt(yearsMatch[1]) : undefined;

      skills.push({
        skill: skill.charAt(0).toUpperCase() + skill.slice(1),
        level,
        yearsExperience,
        confidence
      });
    }
  }

  return skills;
}

// =====================================================
// HELPERS
// =====================================================

function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'W';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function mapRowToProfile(row: any): WorkerProfile {
  return {
    id: row.id,
    userId: row.user_id,
    displayName: row.display_name,
    headline: row.headline,
    bio: row.bio,
    avatarUrl: row.avatar_url,
    skills: row.skills || [],
    skillLevels: row.skill_levels,
    categories: row.categories || [],
    experienceYears: row.experience_years,
    hourlyRateMin: row.hourly_rate_min ? parseFloat(row.hourly_rate_min) : undefined,
    hourlyRateMax: row.hourly_rate_max ? parseFloat(row.hourly_rate_max) : undefined,
    preferredRate: row.preferred_rate ? parseFloat(row.preferred_rate) : undefined,
    preferredCurrency: row.preferred_currency || 'USD',
    portfolioUrl: row.portfolio_url,
    linkedinUrl: row.linkedin_url,
    githubUrl: row.github_url,
    websiteUrl: row.website_url,
    availability: row.availability,
    hoursPerWeek: row.hours_per_week,
    timezone: row.timezone,
    locations: row.locations,
    remoteOnly: row.remote_only ?? true,
    willingToRelocate: row.willing_to_relocate ?? false,
    preferredTaskTypes: row.preferred_task_types,
    preferredIndustries: row.preferred_industries,
    minTaskValue: row.min_task_value ? parseFloat(row.min_task_value) : undefined,
    maxTasksActive: row.max_tasks_active,
    emailVerified: row.email_verified ?? false,
    phoneVerified: row.phone_verified ?? false,
    identityVerified: row.identity_verified ?? false,
    backgroundChecked: row.background_checked ?? false,
    aiMatchingEnabled: row.ai_matching_enabled ?? true,
    aiAutoApplyEnabled: row.ai_auto_apply_enabled ?? false,
    aiAutoApplyThreshold: row.ai_auto_apply_threshold,
    proactiveOpportunities: row.proactive_opportunities ?? true,
    completedTasks: row.completed_tasks || 0,
    totalEarnings: row.total_earnings ? parseFloat(row.total_earnings) : 0,
    averageRating: row.average_rating ? parseFloat(row.average_rating) : undefined,
    reviewCount: row.review_count || 0,
    responseRate: row.response_rate ? parseFloat(row.response_rate) : undefined,
    completionRate: row.completion_rate ? parseFloat(row.completion_rate) : undefined,
    successRate: row.success_rate ? parseFloat(row.success_rate) : undefined,
    referredBy: row.referred_by,
    referralCode: row.referral_code,
    attributionEarnings: row.attribution_earnings ? parseFloat(row.attribution_earnings) : 0,
    status: row.status,
    suspendedAt: row.suspended_at ? new Date(row.suspended_at) : undefined,
    suspendedReason: row.suspended_reason,
    verifiedAt: row.verified_at ? new Date(row.verified_at) : undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapRowToEarnings(row: any): WorkerEarnings {
  return {
    id: row.id,
    workerId: row.worker_id,
    assignmentId: row.assignment_id,
    taskId: row.task_id,
    type: row.type,
    description: row.description,
    grossAmount: parseFloat(row.gross_amount) || 0,
    platformFee: parseFloat(row.platform_fee) || 0,
    processingFee: parseFloat(row.processing_fee) || 0,
    netAmount: parseFloat(row.net_amount) || 0,
    currency: row.currency || 'USD',
    attributedFromId: row.attributed_from_id,
    attributedFromName: row.attributed_from_name,
    attributionLevel: row.attribution_level,
    attributionPercent: row.attribution_percent ? parseFloat(row.attribution_percent) : undefined,
    status: row.status,
    availableAt: row.available_at ? new Date(row.available_at) : undefined,
    paidAt: row.paid_at ? new Date(row.paid_at) : undefined,
    payoutId: row.payout_id,
    withdrawnAt: row.withdrawn_at ? new Date(row.withdrawn_at) : undefined,
    metadata: row.metadata,
    createdAt: new Date(row.created_at),
    updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
  };
}
