/**
 * Career Companion - Long-Term Career Guidance & Growth
 *
 * A supportive AI companion that:
 * - Provides long-term career guidance and planning
 * - Tracks career progression over time
 * - Suggests skill development opportunities
 * - Helps build professional networks
 * - Connects past experiences to future opportunities
 * - Celebrates milestones and provides encouragement
 *
 * "For I know the plans I have for you, declares the Lord,
 * plans to prosper you and not to harm you,
 * plans to give you hope and a future." - Jeremiah 29:11
 */

import Anthropic from '@anthropic-ai/sdk';
import { sqlQuery as sql } from '@/lib/db';
import { JobSeekerProfile, WorkExperience, Education } from './job-seeker-agent';
import { SkillsProfile, Skill, SkillGap, getSkillsEngine } from './skills-engine';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// ============================================================================
// TYPES
// ============================================================================

export interface CareerPath {
  id: string;
  userId: string;
  name: string;
  currentPosition: CareerMilestone;
  targetPosition: CareerMilestone;
  milestones: CareerMilestone[];
  timeline: string; // e.g., "3-5 years"
  confidence: 'high' | 'medium' | 'low';
  feasibility: string;
  alternativePaths?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CareerMilestone {
  title: string;
  level: string;
  company?: string;
  industry?: string;
  salary?: { min: number; max: number };
  skills: string[];
  yearsFromNow?: number;
  status: 'completed' | 'current' | 'planned' | 'stretch';
  achievements?: string[];
  learnings?: string[];
  dateAchieved?: Date;
}

export interface CareerInsight {
  type: 'strength' | 'opportunity' | 'trend' | 'encouragement' | 'action' | 'celebration';
  title: string;
  content: string;
  actionable: boolean;
  action?: {
    label: string;
    type: string;
    params?: Record<string, unknown>;
  };
  priority: 'high' | 'medium' | 'low';
  relatedTo?: string; // skill, experience, goal
  faithMessage?: string;
}

export interface ProgressUpdate {
  id: string;
  userId: string;
  date: Date;
  type: 'job_change' | 'promotion' | 'skill_acquired' | 'certification' | 'milestone' | 'goal_set' | 'reflection';
  title: string;
  description: string;
  impact: {
    salaryChange?: number;
    levelChange?: string;
    newSkills?: string[];
    networkGrowth?: number;
  };
  celebration?: string;
  nextSteps?: string[];
}

export interface NetworkSuggestion {
  type: 'person' | 'group' | 'event' | 'community';
  name: string;
  description: string;
  relevance: string;
  action: string;
  priority: 'high' | 'medium' | 'low';
}

export interface CareerReflection {
  userId: string;
  date: Date;
  prompt: string;
  response?: string;
  insights?: string[];
  goalsRefined?: boolean;
}

export interface GrowthPlan {
  userId: string;
  quarter: string; // e.g., "Q1 2025"
  goals: Array<{
    goal: string;
    type: 'skill' | 'network' | 'achievement' | 'habit';
    status: 'not_started' | 'in_progress' | 'completed';
    deadline?: Date;
    resources: string[];
    milestones: string[];
    progress: number;
  }>;
  theme: string;
  affirmation: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// FAITH-BASED AFFIRMATIONS FOR CAREER JOURNEY
// ============================================================================

const CAREER_AFFIRMATIONS = {
  beginning: [
    "Every expert was once a beginner. 'The Lord will fulfill his purpose for me.' - Psalm 138:8",
    "New beginnings are gifts. 'See, I am doing a new thing!' - Isaiah 43:19",
    "Trust the process. 'He who began a good work in you will carry it on to completion.' - Philippians 1:6",
  ],
  growth: [
    "Growth often comes through challenges. 'Consider it pure joy when you face trials, because the testing of your faith produces perseverance.' - James 1:2-3",
    "You're building something meaningful. 'Whatever you do, work at it with all your heart.' - Colossians 3:23",
    "Keep developing your gifts. 'Do you see someone skilled in their work? They will serve before kings.' - Proverbs 22:29",
  ],
  transition: [
    "Change is the path to growth. 'For everything there is a season, and a time for every matter under heaven.' - Ecclesiastes 3:1",
    "New doors are opening. 'Behold, I have set before you an open door, which no one is able to shut.' - Revelation 3:8",
    "Trust in divine timing. 'He has made everything beautiful in its time.' - Ecclesiastes 3:11",
  ],
  achievement: [
    "Celebrate this moment! 'Well done, good and faithful servant!' - Matthew 25:21",
    "Your hard work has borne fruit. 'Let us not become weary in doing good, for at the proper time we will reap a harvest.' - Galatians 6:9",
    "This is just the beginning. 'Now to him who is able to do immeasurably more than all we ask or imagine.' - Ephesians 3:20",
  ],
  waiting: [
    "Patience builds character. 'But those who wait on the Lord shall renew their strength.' - Isaiah 40:31",
    "Rest is part of the journey. 'Come to me, all you who are weary and burdened, and I will give you rest.' - Matthew 11:28",
    "Trust in the quiet seasons. 'Be still, and know that I am God.' - Psalm 46:10",
  ],
};

function getAffirmation(phase: keyof typeof CAREER_AFFIRMATIONS): string {
  const affirmations = CAREER_AFFIRMATIONS[phase];
  return affirmations[Math.floor(Math.random() * affirmations.length)];
}

// ============================================================================
// CAREER COMPANION CLASS
// ============================================================================

export class CareerCompanion {
  private anthropic: Anthropic;
  private skillsEngine = getSkillsEngine();

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || '',
    });
  }

  // ==========================================================================
  // CAREER PATH PLANNING
  // ==========================================================================

  /**
   * Plan a career path from current to target position
   */
  async planCareerPath(
    profile: JobSeekerProfile,
    targetRole: string,
    targetLevel: string,
    timeframe: number // years
  ): Promise<CareerPath> {
    // Build current milestone
    const current: CareerMilestone = {
      title: profile.currentTitle || 'Current Role',
      level: this.inferLevel(profile.yearsExperience),
      company: profile.currentCompany,
      skills: profile.skills.map(s => s.name),
      status: 'current',
      achievements: profile.achievements,
    };

    // Build target milestone
    const target: CareerMilestone = {
      title: targetRole,
      level: targetLevel,
      skills: [], // Will be populated
      yearsFromNow: timeframe,
      status: 'planned',
    };

    // Use AI to generate path
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: `Create a career path plan.

FROM:
- Role: ${current.title} at ${current.company || 'Current Company'}
- Level: ${current.level}
- Experience: ${profile.yearsExperience} years
- Key Skills: ${current.skills.slice(0, 10).join(', ')}

TO:
- Target Role: ${targetRole}
- Target Level: ${targetLevel}
- Timeframe: ${timeframe} years

Generate 3-4 intermediate milestones. Return JSON:
{
  "milestones": [
    {
      "title": "role title",
      "level": "level",
      "yearsFromNow": number,
      "skills": ["skills to develop"],
      "achievements": ["what to accomplish"]
    }
  ],
  "targetSkills": ["skills needed for final target"],
  "feasibility": "assessment of how realistic this path is",
  "alternativePaths": ["other routes to same goal"],
  "timeline": "e.g., 3-5 years",
  "confidence": "high/medium/low"
}`,
        }],
      });

      const text = response.content[0]?.type === 'text' ? response.content[0].text : '{}';
      const jsonMatch = text.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const plan = JSON.parse(jsonMatch[0]);

        const milestones: CareerMilestone[] = [
          current,
          ...(plan.milestones || []).map((m: Record<string, unknown>) => ({
            ...m,
            status: 'planned' as const,
          })),
          {
            ...target,
            skills: plan.targetSkills || [],
          },
        ];

        return {
          id: `path_${profile.userId}_${Date.now()}`,
          userId: profile.userId,
          name: `Path to ${targetRole}`,
          currentPosition: current,
          targetPosition: { ...target, skills: plan.targetSkills || [] },
          milestones,
          timeline: plan.timeline || `${timeframe} years`,
          confidence: plan.confidence || 'medium',
          feasibility: plan.feasibility || 'Achievable with focused effort',
          alternativePaths: plan.alternativePaths,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }
    } catch (error) {
      console.error('[CareerCompanion] Path planning error:', error);
    }

    // Fallback path
    return {
      id: `path_${profile.userId}_${Date.now()}`,
      userId: profile.userId,
      name: `Path to ${targetRole}`,
      currentPosition: current,
      targetPosition: target,
      milestones: [current, target],
      timeline: `${timeframe} years`,
      confidence: 'low',
      feasibility: 'Path needs more detail - let\'s discuss your goals',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Suggest next career moves based on current position
   */
  async suggestNextMoves(profile: JobSeekerProfile): Promise<Array<{
    move: string;
    type: 'lateral' | 'promotion' | 'pivot' | 'stretch';
    timeline: string;
    requirements: string[];
    benefits: string[];
    feasibility: 'high' | 'medium' | 'low';
  }>> {
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `Suggest career moves for this professional:

Current: ${profile.currentTitle || 'Professional'} at ${profile.currentCompany || 'Current Company'}
Experience: ${profile.yearsExperience} years
Skills: ${profile.skills.slice(0, 10).map(s => s.name).join(', ')}
Goals: ${profile.targetRoles.join(', ') || 'Growth and impact'}

Suggest 4 possible next moves (mix of types). Return JSON array:
[
  {
    "move": "specific role/opportunity",
    "type": "lateral/promotion/pivot/stretch",
    "timeline": "e.g., 6-12 months",
    "requirements": ["what they need"],
    "benefits": ["why this is good"],
    "feasibility": "high/medium/low"
  }
]`,
        }],
      });

      const text = response.content[0]?.type === 'text' ? response.content[0].text : '[]';
      const jsonMatch = text.match(/\[[\s\S]*\]/);

      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('[CareerCompanion] Move suggestion error:', error);
    }

    return [
      {
        move: 'Senior ' + (profile.currentTitle || 'role'),
        type: 'promotion',
        timeline: '1-2 years',
        requirements: ['Consistent high performance', 'Leadership demonstrated'],
        benefits: ['Higher compensation', 'More impact'],
        feasibility: 'medium',
      },
    ];
  }

  // ==========================================================================
  // PROGRESS TRACKING
  // ==========================================================================

  /**
   * Record a career progress update
   */
  async recordProgress(
    userId: string,
    update: Omit<ProgressUpdate, 'id' | 'celebration' | 'nextSteps'>
  ): Promise<ProgressUpdate> {
    // Generate celebration and next steps
    const celebration = await this.generateCelebration(update);
    const nextSteps = await this.suggestNextSteps(update);

    const fullUpdate: ProgressUpdate = {
      ...update,
      id: `progress_${userId}_${Date.now()}`,
      celebration,
      nextSteps,
    };

    // Save to database
    try {
      await sql`
        INSERT INTO career_progress (
          id, user_id, date, type, title, description,
          impact, celebration, next_steps
        ) VALUES (
          ${fullUpdate.id}, ${userId}, ${fullUpdate.date},
          ${fullUpdate.type}, ${fullUpdate.title}, ${fullUpdate.description},
          ${JSON.stringify(fullUpdate.impact)}, ${fullUpdate.celebration},
          ${fullUpdate.nextSteps}
        )
      `;
    } catch (error) {
      console.error('[CareerCompanion] Progress save error:', error);
    }

    return fullUpdate;
  }

  /**
   * Generate celebration message for achievement
   */
  private async generateCelebration(update: Omit<ProgressUpdate, 'id' | 'celebration' | 'nextSteps'>): Promise<string> {
    const affirmation = update.type === 'promotion' || update.type === 'job_change'
      ? getAffirmation('achievement')
      : update.type === 'skill_acquired' || update.type === 'certification'
      ? getAffirmation('growth')
      : getAffirmation('beginning');

    const celebrationMessages: Record<string, string> = {
      job_change: `Congratulations on your new role! This is an exciting new chapter. ${affirmation}`,
      promotion: `You earned this promotion through hard work and dedication. ${affirmation}`,
      skill_acquired: `Adding ${update.title} to your toolkit opens new doors. ${affirmation}`,
      certification: `This certification demonstrates your commitment to excellence. ${affirmation}`,
      milestone: `Reaching this milestone shows your progress. Keep going! ${affirmation}`,
      goal_set: `Setting clear goals is the first step to achieving them. ${affirmation}`,
      reflection: `Taking time to reflect shows wisdom. ${affirmation}`,
    };

    return celebrationMessages[update.type] || affirmation;
  }

  /**
   * Suggest next steps after an update
   */
  private async suggestNextSteps(update: Omit<ProgressUpdate, 'id' | 'celebration' | 'nextSteps'>): Promise<string[]> {
    const stepsByType: Record<string, string[]> = {
      job_change: [
        'Focus on learning the new environment in your first 90 days',
        'Build relationships with key stakeholders',
        'Identify quick wins to establish credibility',
        'Document your goals for the first year',
      ],
      promotion: [
        'Celebrate this achievement - you earned it!',
        'Set new goals for this level',
        'Identify skills to develop at this new stage',
        'Find a mentor who has been at this level',
      ],
      skill_acquired: [
        'Apply this skill in a real project',
        'Share your learning with others',
        'Identify complementary skills to learn next',
        'Update your resume and LinkedIn',
      ],
      certification: [
        'Add this to your LinkedIn profile',
        'Look for roles that value this certification',
        'Consider teaching others what you learned',
        'Plan your next learning goal',
      ],
      milestone: [
        'Reflect on what got you here',
        'Set your next milestone',
        'Share your journey to inspire others',
      ],
      goal_set: [
        'Break this goal into smaller milestones',
        'Identify resources you need',
        'Set a check-in schedule',
        'Find an accountability partner',
      ],
      reflection: [
        'Journal your key insights',
        'Identify one action to take this week',
        'Schedule your next reflection time',
      ],
    };

    return stepsByType[update.type] || ['Continue building on this progress'];
  }

  /**
   * Get career progress summary
   */
  async getProgressSummary(userId: string, timeframe: string = '1 year'): Promise<{
    updates: ProgressUpdate[];
    summary: string;
    highlights: string[];
    growthAreas: string[];
    momentum: 'strong' | 'steady' | 'building' | 'needs_attention';
    encouragement: string;
  }> {
    try {
      const result = await sql`
        SELECT * FROM career_progress
        WHERE user_id = ${userId}
          AND date >= NOW() - INTERVAL ${timeframe}
        ORDER BY date DESC
      `;

      const updates = result.rows.map(row => ({
        id: row.id as string,
        userId: row.user_id as string,
        date: new Date(row.date as string),
        type: row.type as ProgressUpdate['type'],
        title: row.title as string,
        description: row.description as string,
        impact: row.impact as ProgressUpdate['impact'],
        celebration: row.celebration as string,
        nextSteps: row.next_steps as string[],
      }));

      // Analyze momentum
      let momentum: 'strong' | 'steady' | 'building' | 'needs_attention';
      const significantUpdates = updates.filter(u =>
        ['job_change', 'promotion', 'certification'].includes(u.type)
      ).length;

      if (updates.length >= 10 && significantUpdates >= 2) {
        momentum = 'strong';
      } else if (updates.length >= 5) {
        momentum = 'steady';
      } else if (updates.length >= 2) {
        momentum = 'building';
      } else {
        momentum = 'needs_attention';
      }

      // Generate highlights
      const highlights = updates
        .filter(u => u.type === 'promotion' || u.type === 'job_change' || u.type === 'certification')
        .slice(0, 3)
        .map(u => u.title);

      // Identify growth areas
      const skillUpdates = updates.filter(u => u.type === 'skill_acquired');
      const growthAreas = skillUpdates.length > 0
        ? skillUpdates.map(u => u.title).slice(0, 3)
        : ['No skill updates recorded - consider tracking your learning'];

      const summary = updates.length > 0
        ? `Over the past ${timeframe}, you've logged ${updates.length} progress updates${significantUpdates > 0 ? ` including ${significantUpdates} major milestone${significantUpdates > 1 ? 's' : ''}` : ''}.`
        : 'Start tracking your progress to see your growth over time.';

      const encouragement = momentum === 'strong'
        ? getAffirmation('achievement')
        : momentum === 'needs_attention'
        ? getAffirmation('beginning')
        : getAffirmation('growth');

      return { updates, summary, highlights, growthAreas, momentum, encouragement };

    } catch (error) {
      console.error('[CareerCompanion] Progress summary error:', error);
      return {
        updates: [],
        summary: 'Unable to load progress. Keep moving forward!',
        highlights: [],
        growthAreas: [],
        momentum: 'building',
        encouragement: getAffirmation('growth'),
      };
    }
  }

  // ==========================================================================
  // SKILL DEVELOPMENT
  // ==========================================================================

  /**
   * Create a personalized growth plan
   */
  async createGrowthPlan(
    profile: JobSeekerProfile,
    quarter: string,
    focus: 'skills' | 'network' | 'leadership' | 'balanced'
  ): Promise<GrowthPlan> {
    // Analyze skill gaps
    const skillsProfile = await this.skillsEngine.buildSkillsProfile(
      profile.userId,
      profile.skills.map(s => ({
        ...s,
        normalizedName: s.name.toLowerCase(),
        proficiencyScore: s.level === 'expert' ? 90 : s.level === 'advanced' ? 75 : 60,
        category: 'other' as const,
      })),
      profile.experiences.map(e => ({
        ...e,
        duration: e.current ? 'Present' : 'Past',
      }))
    );

    // Generate goals based on focus
    const goals: GrowthPlan['goals'] = [];

    if (focus === 'skills' || focus === 'balanced') {
      // Add skill goals
      const targetSkills = profile.targetRoles.length > 0
        ? await this.identifySkillsForRole(profile.targetRoles[0])
        : ['leadership', 'communication'];

      goals.push({
        goal: `Develop proficiency in ${targetSkills[0]}`,
        type: 'skill',
        status: 'not_started',
        resources: ['Online courses', 'Side projects', 'Mentorship'],
        milestones: ['Complete introductory course', 'Build first project', 'Apply at work'],
        progress: 0,
      });
    }

    if (focus === 'network' || focus === 'balanced') {
      goals.push({
        goal: 'Expand professional network by 10 meaningful connections',
        type: 'network',
        status: 'not_started',
        resources: ['LinkedIn', 'Industry events', 'Coffee chats'],
        milestones: ['Attend 2 events', 'Reach out to 5 people', 'Deepen 3 relationships'],
        progress: 0,
      });
    }

    if (focus === 'leadership' || focus === 'balanced') {
      goals.push({
        goal: 'Take on a leadership opportunity',
        type: 'achievement',
        status: 'not_started',
        resources: ['Current projects', 'Cross-functional initiatives', 'Mentoring'],
        milestones: ['Identify opportunity', 'Volunteer', 'Lead and deliver'],
        progress: 0,
      });
    }

    // Add habit goal
    goals.push({
      goal: 'Establish weekly career reflection practice',
      type: 'habit',
      status: 'not_started',
      resources: ['Journal', 'Wells AI check-ins'],
      milestones: ['Set weekly time', 'Complete 4 reflections', 'Identify patterns'],
      progress: 0,
    });

    // Generate theme and affirmation
    const themes: Record<string, string> = {
      skills: 'Building Expertise',
      network: 'Expanding Connections',
      leadership: 'Growing Influence',
      balanced: 'Holistic Growth',
    };

    return {
      userId: profile.userId,
      quarter,
      goals,
      theme: themes[focus],
      affirmation: getAffirmation('growth'),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Identify skills needed for a target role
   */
  private async identifySkillsForRole(role: string): Promise<string[]> {
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: `List the top 5 most important skills for a ${role} role. Return as JSON array: ["skill1", "skill2", ...]`,
        }],
      });

      const text = response.content[0]?.type === 'text' ? response.content[0].text : '[]';
      const jsonMatch = text.match(/\[[\s\S]*\]/);

      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('[CareerCompanion] Skill identification error:', error);
    }

    return ['leadership', 'technical expertise', 'communication', 'problem-solving', 'collaboration'];
  }

  // ==========================================================================
  // NETWORK BUILDING
  // ==========================================================================

  /**
   * Suggest networking opportunities
   */
  async suggestNetworking(
    profile: JobSeekerProfile,
    goal: string
  ): Promise<NetworkSuggestion[]> {
    const suggestions: NetworkSuggestion[] = [];

    // Based on target roles
    if (profile.targetRoles.length > 0) {
      suggestions.push({
        type: 'person',
        name: `${profile.targetRoles[0]} professionals`,
        description: `Connect with people already in ${profile.targetRoles[0]} roles to learn about their path`,
        relevance: 'Directly relevant to your career goals',
        action: 'Search LinkedIn for people in this role',
        priority: 'high',
      });
    }

    // Based on target industries
    if (profile.targetIndustries.length > 0) {
      suggestions.push({
        type: 'community',
        name: `${profile.targetIndustries[0]} community`,
        description: `Join communities focused on ${profile.targetIndustries[0]}`,
        relevance: 'Build industry connections',
        action: 'Search for Slack groups, Discord servers, or meetups',
        priority: 'medium',
      });
    }

    // Skill-based
    const topSkill = profile.skills.find(s => s.level === 'expert' || s.level === 'advanced');
    if (topSkill) {
      suggestions.push({
        type: 'group',
        name: `${topSkill.name} practitioner group`,
        description: `Connect with others who specialize in ${topSkill.name}`,
        relevance: 'Share knowledge and learn advanced techniques',
        action: 'Find specialized forums or groups',
        priority: 'medium',
      });
    }

    // Events
    suggestions.push({
      type: 'event',
      name: 'Industry conferences and meetups',
      description: 'Attend events to meet people in person',
      relevance: 'Face-to-face connections are powerful',
      action: 'Search Eventbrite, Meetup, or industry-specific event sites',
      priority: 'medium',
    });

    return suggestions;
  }

  // ==========================================================================
  // CAREER INSIGHTS
  // ==========================================================================

  /**
   * Generate personalized career insights
   */
  async generateInsights(profile: JobSeekerProfile): Promise<CareerInsight[]> {
    const insights: CareerInsight[] = [];

    // Experience-based insights
    if (profile.yearsExperience >= 10 && !profile.currentTitle?.toLowerCase().includes('senior')) {
      insights.push({
        type: 'opportunity',
        title: 'Leadership Potential',
        content: `With ${profile.yearsExperience} years of experience, you may be ready for a senior or leadership role. Your expertise could guide others.`,
        actionable: true,
        action: {
          label: 'Explore Leadership Roles',
          type: 'search_jobs',
          params: { level: 'senior' },
        },
        priority: 'high',
      });
    }

    // Skill-based insights
    const highValueSkills = profile.skills.filter(s =>
      (s.level === 'expert' || s.level === 'advanced')
    );

    if (highValueSkills.length >= 3) {
      insights.push({
        type: 'strength',
        title: 'Strong Skill Foundation',
        content: `Your expertise in ${highValueSkills.slice(0, 3).map(s => s.name).join(', ')} puts you in a strong position. These skills are in demand.`,
        actionable: false,
        priority: 'medium',
        faithMessage: 'Your talents are gifts. Use them well.',
      });
    }

    // Goal alignment
    if (profile.targetRoles.length > 0) {
      const targetRole = profile.targetRoles[0];
      const currentTitle = profile.currentTitle || '';

      if (!currentTitle.toLowerCase().includes(targetRole.toLowerCase().split(' ')[0])) {
        insights.push({
          type: 'action',
          title: 'Path to ' + targetRole,
          content: `Your goal of becoming a ${targetRole} is achievable. Let's identify the gaps and build a plan.`,
          actionable: true,
          action: {
            label: 'Create Career Path',
            type: 'plan_career',
            params: { targetRole },
          },
          priority: 'high',
        });
      }
    }

    // Encouragement based on availability status
    if (profile.availability === 'actively_looking') {
      insights.push({
        type: 'encouragement',
        title: 'Stay Encouraged',
        content: 'Job searching can be challenging, but each application brings you closer to the right opportunity.',
        actionable: false,
        priority: 'high',
        faithMessage: getAffirmation('waiting'),
      });
    }

    // Market trends (simplified)
    insights.push({
      type: 'trend',
      title: 'Market Opportunity',
      content: 'AI and machine learning skills continue to be highly valued. Consider how you might develop or apply these skills.',
      actionable: true,
      action: {
        label: 'Explore AI Skills',
        type: 'skill_development',
        params: { skill: 'AI/ML' },
      },
      priority: 'medium',
    });

    return insights;
  }

  // ==========================================================================
  // EXPERIENCE CONNECTIONS
  // ==========================================================================

  /**
   * Connect past experience to future opportunities
   * "Your experience at X prepared you for Y"
   */
  async connectExperiences(
    profile: JobSeekerProfile,
    targetRole: string
  ): Promise<Array<{
    pastExperience: WorkExperience;
    connection: string;
    transferableSkills: string[];
    narrativeExample: string;
  }>> {
    const connections: Array<{
      pastExperience: WorkExperience;
      connection: string;
      transferableSkills: string[];
      narrativeExample: string;
    }> = [];

    for (const exp of profile.experiences.slice(0, 5)) {
      try {
        const response = await this.anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 300,
          messages: [{
            role: 'user',
            content: `Connect this past experience to a target role.

PAST EXPERIENCE:
- Role: ${exp.title} at ${exp.company}
- Skills used: ${exp.skills.join(', ')}
- Key achievement: ${exp.achievements[0] || 'Contributed to team success'}

TARGET ROLE: ${targetRole}

Explain how this experience prepared them for the target role. Return JSON:
{
  "connection": "one sentence connecting past to future",
  "transferableSkills": ["skills that transfer"],
  "narrativeExample": "how to talk about this in an interview"
}`,
          }],
        });

        const text = response.content[0]?.type === 'text' ? response.content[0].text : '{}';
        const jsonMatch = text.match(/\{[\s\S]*\}/);

        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0]);
          connections.push({
            pastExperience: exp,
            connection: result.connection,
            transferableSkills: result.transferableSkills,
            narrativeExample: result.narrativeExample,
          });
        }
      } catch (error) {
        console.error('[CareerCompanion] Connection error:', error);
      }
    }

    return connections;
  }

  // ==========================================================================
  // CAREER REFLECTION
  // ==========================================================================

  /**
   * Prompt for career reflection
   */
  async promptReflection(profile: JobSeekerProfile): Promise<CareerReflection> {
    const prompts = [
      'What accomplishment from the past month are you most proud of?',
      'What skill would you like to develop further?',
      'Who has been most helpful in your career recently? Have you thanked them?',
      'What would you do differently if you could start your career over?',
      'What energizes you most about your work?',
      'Where do you see yourself in 2 years?',
      'What fear is holding you back from taking the next step?',
      'What would success look like for you this quarter?',
    ];

    const prompt = prompts[Math.floor(Math.random() * prompts.length)];

    return {
      userId: profile.userId,
      date: new Date(),
      prompt,
    };
  }

  /**
   * Process reflection response and extract insights
   */
  async processReflection(
    reflection: CareerReflection,
    response: string
  ): Promise<CareerReflection> {
    try {
      const aiResponse = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: `Analyze this career reflection and extract insights.

PROMPT: ${reflection.prompt}
RESPONSE: ${response}

Return JSON:
{
  "insights": ["key insights from their reflection"],
  "goalsRefined": true/false (whether they mentioned career goals),
  "suggestedFollowUp": "a thoughtful follow-up question"
}`,
        }],
      });

      const text = aiResponse.content[0]?.type === 'text' ? aiResponse.content[0].text : '{}';
      const jsonMatch = text.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return {
          ...reflection,
          response,
          insights: result.insights,
          goalsRefined: result.goalsRefined,
        };
      }
    } catch (error) {
      console.error('[CareerCompanion] Reflection processing error:', error);
    }

    return {
      ...reflection,
      response,
      insights: ['Thank you for sharing. Your reflections show self-awareness.'],
      goalsRefined: false,
    };
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  private inferLevel(yearsExperience: number): string {
    if (yearsExperience >= 15) return 'Executive/Director';
    if (yearsExperience >= 10) return 'Principal/Staff';
    if (yearsExperience >= 6) return 'Senior';
    if (yearsExperience >= 3) return 'Mid-level';
    return 'Junior';
  }
}

// ============================================================================
// FACTORY & EXPORTS
// ============================================================================

let careerCompanionInstance: CareerCompanion | null = null;

export function getCareerCompanion(): CareerCompanion {
  if (!careerCompanionInstance) {
    careerCompanionInstance = new CareerCompanion();
  }
  return careerCompanionInstance;
}

export { CareerCompanion, CAREER_AFFIRMATIONS, getAffirmation };
export default CareerCompanion;
