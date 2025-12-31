/**
 * Interview Preparation System
 *
 * Comprehensive interview preparation that:
 * - Researches companies in depth
 * - Generates role-specific questions
 * - Creates personalized answer suggestions based on experience
 * - Provides mock interview with AI feedback
 * - Coaches on delivery and presentation
 *
 * "For I will give you words and wisdom that none of your
 * adversaries will be able to resist or contradict." - Luke 21:15
 */

import Anthropic from '@anthropic-ai/sdk';
import { sqlQuery as sql } from '@/lib/db';
import { JobSeekerProfile, WorkExperience } from './job-seeker-agent';
import { JobOpening } from './employer-agent';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// ============================================================================
// TYPES
// ============================================================================

export interface InterviewPrep {
  id: string;
  userId: string;
  jobId: string;
  company: string;
  role: string;
  stage: InterviewStage;

  // Research
  companyResearch: CompanyResearch;

  // Questions
  expectedQuestions: PreparedQuestion[];
  questionsToAsk: string[];

  // Preparation
  keyTalkingPoints: string[];
  stories: STARStory[];
  strengths: string[];
  weaknessesFramed: string[];

  // Logistics
  interviewDate?: Date;
  interviewType: 'phone' | 'video' | 'onsite' | 'panel' | 'technical';
  interviewers?: string[];

  // Progress
  preparationScore: number;
  practiceRounds: number;

  createdAt: Date;
  updatedAt: Date;
}

export type InterviewStage =
  | 'recruiter_screen'
  | 'hiring_manager'
  | 'technical_screen'
  | 'technical_deep_dive'
  | 'system_design'
  | 'behavioral'
  | 'panel'
  | 'final_round'
  | 'executive';

export interface CompanyResearch {
  name: string;
  industry: string;
  size: string;
  founded?: number;
  headquarters: string;
  mission: string;
  values: string[];
  culture: string[];
  recentNews: Array<{
    title: string;
    summary: string;
    date: string;
    relevance: string;
  }>;
  products: string[];
  competitors: string[];
  challenges?: string[];
  opportunities?: string[];
  interviewProcess?: string;
  glassdoorRating?: number;
  interviewTips?: string[];
}

export interface PreparedQuestion {
  question: string;
  type: 'behavioral' | 'technical' | 'situational' | 'role_specific' | 'culture' | 'trick';
  difficulty: 'easy' | 'medium' | 'hard';
  frequency: 'very_common' | 'common' | 'occasional' | 'rare';
  suggestedAnswer: string;
  keyPoints: string[];
  pitfalls: string[];
  followUps?: string[];
  relatedExperience?: string;
}

export interface STARStory {
  id: string;
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  skills: string[];
  applicableTo: string[]; // question types this story works for
  impactMetrics?: string[];
  duration?: string;
}

export interface MockInterview {
  id: string;
  prepId: string;
  type: 'behavioral' | 'technical' | 'mixed';
  questions: Array<{
    question: string;
    candidateAnswer: string;
    feedback: InterviewFeedback;
    score: number; // 1-10
    timestamp: Date;
  }>;
  overallFeedback: string;
  overallScore: number;
  strengths: string[];
  improvements: string[];
  readinessLevel: 'not_ready' | 'needs_work' | 'good' | 'excellent';
  completedAt: Date;
}

export interface InterviewFeedback {
  score: number; // 1-10
  contentScore: number;
  structureScore: number;
  clarityScore: number;
  positive: string[];
  improvements: string[];
  reframedAnswer?: string;
  coachingTip: string;
}

// ============================================================================
// INTERVIEW PREP SYSTEM
// ============================================================================

export class InterviewPrepSystem {
  private anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || '',
    });
  }

  // ==========================================================================
  // COMPANY RESEARCH
  // ==========================================================================

  /**
   * Research a company in depth
   */
  async researchCompany(companyName: string, role?: string): Promise<CompanyResearch> {
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: `Research this company for an interview candidate. Provide comprehensive but realistic information.

Company: ${companyName}
${role ? `Role: ${role}` : ''}

Return JSON with this structure:
{
  "name": "company name",
  "industry": "primary industry",
  "size": "startup/small/medium/large/enterprise",
  "founded": year or null,
  "headquarters": "city, country",
  "mission": "company mission statement",
  "values": ["core values"],
  "culture": ["culture descriptors"],
  "recentNews": [
    {"title": "headline", "summary": "brief summary", "date": "approximate", "relevance": "why this matters for interview"}
  ],
  "products": ["main products/services"],
  "competitors": ["main competitors"],
  "challenges": ["industry/company challenges"],
  "opportunities": ["growth opportunities"],
  "interviewProcess": "typical interview process",
  "glassdoorRating": number or null,
  "interviewTips": ["tips from reviews/experience"]
}

Be helpful but note that some information may need verification.`,
        }],
      });

      const text = response.content[0]?.type === 'text' ? response.content[0].text : '{}';
      const jsonMatch = text.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('[InterviewPrep] Company research error:', error);
    }

    // Fallback research
    return {
      name: companyName,
      industry: 'Technology',
      size: 'medium',
      headquarters: 'Unknown',
      mission: 'Research the company website for their mission statement',
      values: ['Innovation', 'Excellence', 'Collaboration'],
      culture: ['Fast-paced', 'Collaborative'],
      recentNews: [],
      products: ['Research their products/services'],
      competitors: ['Research their competitive landscape'],
      interviewTips: [
        'Research their recent announcements',
        'Understand their market position',
        'Prepare questions about the team',
      ],
    };
  }

  // ==========================================================================
  // QUESTION PREPARATION
  // ==========================================================================

  /**
   * Generate expected interview questions with suggested answers
   */
  async generateQuestions(
    profile: JobSeekerProfile,
    job: JobOpening | { title: string; company?: string; level?: string; requiredSkills?: string[] },
    stage: InterviewStage
  ): Promise<PreparedQuestion[]> {
    const questions: PreparedQuestion[] = [];

    // Stage-specific question generation
    const stageQuestionTypes: Record<InterviewStage, string[]> = {
      recruiter_screen: ['behavioral', 'culture', 'role_specific'],
      hiring_manager: ['behavioral', 'situational', 'role_specific'],
      technical_screen: ['technical', 'situational'],
      technical_deep_dive: ['technical', 'situational'],
      system_design: ['technical', 'situational'],
      behavioral: ['behavioral', 'situational', 'culture'],
      panel: ['behavioral', 'situational', 'culture'],
      final_round: ['behavioral', 'culture', 'role_specific'],
      executive: ['behavioral', 'culture', 'role_specific'],
    };

    const questionTypes = stageQuestionTypes[stage] || ['behavioral', 'role_specific'];

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: `Generate interview questions for this candidate and role.

CANDIDATE:
- Current Role: ${profile.currentTitle || 'Professional'}
- Experience: ${profile.yearsExperience} years
- Key Skills: ${profile.skills.slice(0, 8).map(s => s.name).join(', ')}
- Key Achievement: ${profile.achievements[0] || 'Various professional accomplishments'}

ROLE:
- Title: ${job.title}
- Company: ${(job as { company?: string }).company || 'Company'}
- Level: ${(job as { level?: string }).level || 'Mid-Senior'}
- Required Skills: ${(job as JobOpening).requiredSkills?.join(', ') || (job as { requiredSkills?: string[] }).requiredSkills?.join(', ') || 'Various'}

INTERVIEW STAGE: ${stage}
QUESTION TYPES TO FOCUS ON: ${questionTypes.join(', ')}

Generate 8-10 questions. Return JSON array:
[
  {
    "question": "the interview question",
    "type": "behavioral/technical/situational/role_specific/culture",
    "difficulty": "easy/medium/hard",
    "frequency": "very_common/common/occasional",
    "suggestedAnswer": "a strong answer tailored to this candidate's background",
    "keyPoints": ["points to hit"],
    "pitfalls": ["things to avoid"],
    "followUps": ["likely follow-up questions"]
  }
]`,
        }],
      });

      const text = response.content[0]?.type === 'text' ? response.content[0].text : '[]';
      const jsonMatch = text.match(/\[[\s\S]*\]/);

      if (jsonMatch) {
        const aiQuestions = JSON.parse(jsonMatch[0]);
        questions.push(...aiQuestions);
      }
    } catch (error) {
      console.error('[InterviewPrep] Question generation error:', error);
    }

    // Add universal questions if we don't have enough
    if (questions.length < 5) {
      questions.push(
        {
          question: 'Tell me about yourself.',
          type: 'behavioral',
          difficulty: 'easy',
          frequency: 'very_common',
          suggestedAnswer: `I'm a ${profile.currentTitle || 'professional'} with ${profile.yearsExperience} years of experience. ${profile.headline || `I specialize in ${profile.skills[0]?.name || 'my field'}`}. Most recently, I ${profile.achievements[0]?.toLowerCase() || 'contributed to significant projects'}. I'm excited about this opportunity because it aligns with my passion for ${profile.targetRoles[0] || 'growth and impact'}.`,
          keyPoints: ['Brief career summary', 'Relevant highlights', 'Why this role'],
          pitfalls: ['Too long', 'Too personal', 'Not tailored to role'],
        },
        {
          question: 'Why are you interested in this role?',
          type: 'role_specific',
          difficulty: 'easy',
          frequency: 'very_common',
          suggestedAnswer: `I'm drawn to this ${job.title} role for three reasons: First, it aligns with my experience in ${profile.skills[0]?.name || 'key areas'}. Second, I'm excited about the opportunity to work on challenges at ${(job as { company?: string }).company || 'your company'}. Third, this role represents the natural next step in my career growth.`,
          keyPoints: ['Show research', 'Connect to experience', 'Show genuine interest'],
          pitfalls: ['Generic answers', 'Only mentioning money', 'Not knowing about company'],
        },
        {
          question: 'What is your greatest weakness?',
          type: 'behavioral',
          difficulty: 'medium',
          frequency: 'very_common',
          suggestedAnswer: 'I tend to be very detail-oriented, which sometimes means I spend more time than necessary perfecting things. I\'ve learned to balance this by setting time boundaries and prioritizing the most impactful details. It\'s actually become a strength in quality-critical work.',
          keyPoints: ['Be honest', 'Show self-awareness', 'Demonstrate improvement'],
          pitfalls: ['Fake weaknesses', 'Critical job-related weaknesses', 'No growth shown'],
        }
      );
    }

    return questions;
  }

  /**
   * Generate questions for the candidate to ask
   */
  async generateQuestionsToAsk(
    company: string,
    role: string,
    stage: InterviewStage
  ): Promise<string[]> {
    const questionsByStage: Record<InterviewStage, string[]> = {
      recruiter_screen: [
        'Can you tell me more about the team I would be working with?',
        'What does success look like in this role in the first 6 months?',
        'What is the typical career path for someone in this position?',
        'Can you walk me through the interview process?',
      ],
      hiring_manager: [
        'What are the biggest challenges facing the team right now?',
        'How would you describe your management style?',
        'What do the top performers in this role do differently?',
        'How does this role contribute to the company\'s larger goals?',
      ],
      technical_screen: [
        'What technologies is the team most excited about right now?',
        'How does the team approach technical debt?',
        'What does the code review process look like?',
        'How are technical decisions made on the team?',
      ],
      technical_deep_dive: [
        'What are the most interesting technical challenges you\'ve solved recently?',
        'How does the team stay current with new technologies?',
        'What\'s the testing philosophy on the team?',
        'How do you handle production incidents?',
      ],
      system_design: [
        'What scale does the system currently operate at?',
        'What are the biggest scalability challenges you\'re facing?',
        'How do you approach trade-offs between different design choices?',
      ],
      behavioral: [
        'How does the team celebrate wins?',
        'What\'s the biggest lesson the team has learned recently?',
        'How do cross-functional teams collaborate here?',
      ],
      panel: [
        'What do each of you enjoy most about working here?',
        'How does this role interact with your teams?',
        'What would you want to see from someone in this role?',
      ],
      final_round: [
        'What\'s the company\'s vision for the next 3-5 years?',
        'How does leadership support professional development?',
        'What keeps you excited about working here?',
      ],
      executive: [
        'What\'s your vision for this department/team?',
        'What are the company\'s biggest priorities this year?',
        'How do you see this role evolving?',
      ],
    };

    const baseQuestions = questionsByStage[stage] || questionsByStage.hiring_manager;

    // Add company-specific question
    baseQuestions.push(`I'm curious about ${company}'s approach to [mention something from your research]. Can you tell me more about that?`);

    return baseQuestions;
  }

  // ==========================================================================
  // STAR STORIES
  // ==========================================================================

  /**
   * Build STAR stories from experiences
   */
  async buildSTARStories(profile: JobSeekerProfile): Promise<STARStory[]> {
    const stories: STARStory[] = [];

    for (const exp of profile.experiences.slice(0, 3)) {
      for (const achievement of exp.achievements.slice(0, 2)) {
        try {
          const response = await this.anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 600,
            messages: [{
              role: 'user',
              content: `Convert this achievement into a STAR story for interviews.

CONTEXT:
Role: ${exp.title} at ${exp.company}
Achievement: ${achievement}
Skills used: ${exp.skills.join(', ')}

Return JSON:
{
  "title": "short title for the story",
  "situation": "context and background (2-3 sentences)",
  "task": "your specific responsibility (1-2 sentences)",
  "action": "specific actions you took (3-4 sentences, use 'I' not 'we')",
  "result": "measurable outcomes (2-3 sentences with numbers if possible)",
  "skills": ["skills this demonstrates"],
  "applicableTo": ["question types this works for - leadership, problem-solving, conflict, etc."],
  "impactMetrics": ["specific metrics if mentioned"]
}`,
            }],
          });

          const text = response.content[0]?.type === 'text' ? response.content[0].text : '{}';
          const jsonMatch = text.match(/\{[\s\S]*\}/);

          if (jsonMatch) {
            const story = JSON.parse(jsonMatch[0]);
            stories.push({
              id: `story_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
              ...story,
            });
          }
        } catch (error) {
          console.error('[InterviewPrep] STAR story error:', error);
        }
      }
    }

    // Add default stories if we don't have enough
    if (stories.length < 3) {
      stories.push({
        id: `story_default_${Date.now()}`,
        title: 'Build Your Story',
        situation: 'Think of a challenging project or situation from your experience.',
        task: 'What was your specific role or responsibility?',
        action: 'What actions did YOU take? Be specific about your contributions.',
        result: 'What was the outcome? Use numbers when possible (%, $, time saved).',
        skills: profile.skills.slice(0, 3).map(s => s.name),
        applicableTo: ['challenge', 'leadership', 'problem-solving'],
      });
    }

    return stories;
  }

  // ==========================================================================
  // MOCK INTERVIEW
  // ==========================================================================

  /**
   * Conduct a mock interview round
   */
  async conductMockInterview(
    profile: JobSeekerProfile,
    prep: InterviewPrep,
    questionCount: number = 5
  ): Promise<MockInterview> {
    const mockId = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const selectedQuestions = prep.expectedQuestions.slice(0, questionCount);

    const mockInterview: MockInterview = {
      id: mockId,
      prepId: prep.id,
      type: 'behavioral',
      questions: [],
      overallFeedback: '',
      overallScore: 0,
      strengths: [],
      improvements: [],
      readinessLevel: 'needs_work',
      completedAt: new Date(),
    };

    // This would be interactive in a real implementation
    // For now, we'll show the structure

    return mockInterview;
  }

  /**
   * Evaluate a mock interview answer
   */
  async evaluateAnswer(
    question: string,
    answer: string,
    profile: JobSeekerProfile
  ): Promise<InterviewFeedback> {
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        messages: [{
          role: 'user',
          content: `Evaluate this interview answer and provide coaching feedback.

QUESTION: ${question}

CANDIDATE'S ANSWER: ${answer}

CANDIDATE BACKGROUND:
- ${profile.yearsExperience} years experience
- Skills: ${profile.skills.slice(0, 5).map(s => s.name).join(', ')}

Evaluate and return JSON:
{
  "score": 1-10,
  "contentScore": 1-10 (relevance and substance),
  "structureScore": 1-10 (organization, STAR format if applicable),
  "clarityScore": 1-10 (clear, concise communication),
  "positive": ["what they did well"],
  "improvements": ["specific areas to improve"],
  "reframedAnswer": "how they could answer better (2-3 sentences example)",
  "coachingTip": "one actionable piece of advice"
}

Be encouraging but honest. Focus on actionable improvements.`,
        }],
      });

      const text = response.content[0]?.type === 'text' ? response.content[0].text : '{}';
      const jsonMatch = text.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('[InterviewPrep] Answer evaluation error:', error);
    }

    return {
      score: 6,
      contentScore: 6,
      structureScore: 6,
      clarityScore: 6,
      positive: ['Provided a response'],
      improvements: ['Add more specific examples', 'Use the STAR format'],
      coachingTip: 'Practice structuring your answers with Situation, Task, Action, Result.',
    };
  }

  // ==========================================================================
  // PREPARATION PLAN
  // ==========================================================================

  /**
   * Create a complete interview preparation plan
   */
  async createPrepPlan(
    profile: JobSeekerProfile,
    job: JobOpening | { title: string; company: string },
    interviewDate?: Date
  ): Promise<InterviewPrep> {
    const company = (job as { company: string }).company || 'Company';
    const role = job.title;

    // Research company
    const companyResearch = await this.researchCompany(company, role);

    // Generate questions for initial stage (recruiter screen)
    const expectedQuestions = await this.generateQuestions(profile, job, 'recruiter_screen');

    // Generate questions to ask
    const questionsToAsk = await this.generateQuestionsToAsk(company, role, 'recruiter_screen');

    // Build STAR stories
    const stories = await this.buildSTARStories(profile);

    // Generate talking points
    const keyTalkingPoints = [
      `${profile.yearsExperience} years of relevant experience`,
      profile.skills.filter(s => s.level === 'expert' || s.level === 'advanced')
        .slice(0, 3)
        .map(s => `Expert in ${s.name}`)
        .join(', '),
      profile.achievements[0] || 'Proven track record of delivery',
      `Passionate about ${profile.targetRoles[0] || role}`,
    ];

    // Frame weaknesses constructively
    const weaknessesFramed = [
      'I sometimes focus too much on details - I\'ve learned to balance perfection with pragmatism',
      'I can be impatient when projects slow down - I channel this into driving momentum',
      'Public speaking was challenging - I\'ve been actively improving through practice',
    ];

    // Identify strengths
    const strengths = [
      `Strong ${profile.skills[0]?.name || 'technical'} skills`,
      'Problem-solving mindset',
      'Collaborative team player',
      `${profile.yearsExperience}+ years of proven experience`,
    ];

    const prep: InterviewPrep = {
      id: `prep_${profile.userId}_${Date.now()}`,
      userId: profile.userId,
      jobId: (job as JobOpening).id || 'unknown',
      company,
      role,
      stage: 'recruiter_screen',
      companyResearch,
      expectedQuestions,
      questionsToAsk,
      keyTalkingPoints,
      stories,
      strengths,
      weaknessesFramed,
      interviewDate,
      interviewType: 'video',
      preparationScore: 20, // Starting score
      practiceRounds: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Save to database
    try {
      await sql`
        INSERT INTO interview_preps (
          id, user_id, job_id, company, role, stage,
          company_research, expected_questions, questions_to_ask,
          key_talking_points, stories, strengths, weaknesses_framed,
          interview_date, interview_type, preparation_score, practice_rounds
        ) VALUES (
          ${prep.id}, ${prep.userId}, ${prep.jobId}, ${prep.company}, ${prep.role},
          ${prep.stage}, ${JSON.stringify(prep.companyResearch)},
          ${JSON.stringify(prep.expectedQuestions)}, ${prep.questionsToAsk},
          ${prep.keyTalkingPoints}, ${JSON.stringify(prep.stories)},
          ${prep.strengths}, ${prep.weaknessesFramed},
          ${prep.interviewDate || null}, ${prep.interviewType},
          ${prep.preparationScore}, ${prep.practiceRounds}
        )
      `;
    } catch (error) {
      console.error('[InterviewPrep] Save error:', error);
    }

    return prep;
  }

  /**
   * Update prep for a different interview stage
   */
  async updateForStage(
    prep: InterviewPrep,
    profile: JobSeekerProfile,
    newStage: InterviewStage
  ): Promise<InterviewPrep> {
    // Generate new questions for the stage
    const job = {
      title: prep.role,
      company: prep.company,
      requiredSkills: profile.skills.map(s => s.name),
    };

    const expectedQuestions = await this.generateQuestions(profile, job, newStage);
    const questionsToAsk = await this.generateQuestionsToAsk(prep.company, prep.role, newStage);

    return {
      ...prep,
      stage: newStage,
      expectedQuestions,
      questionsToAsk,
      updatedAt: new Date(),
    };
  }

  // ==========================================================================
  // COACHING & TIPS
  // ==========================================================================

  /**
   * Get interview day tips
   */
  getInterviewDayTips(type: InterviewPrep['interviewType']): string[] {
    const commonTips = [
      'Get a good night\'s sleep the night before',
      'Eat a light, healthy meal beforehand',
      'Review your key talking points one more time',
      'Have your questions ready to ask',
      'Remember: they\'ve already shown interest in you',
    ];

    const typeTips: Record<string, string[]> = {
      video: [
        'Test your camera, microphone, and internet connection',
        'Choose a quiet, well-lit location with a clean background',
        'Look at the camera when speaking, not the screen',
        'Keep your notes nearby but don\'t read from them',
        'Dress professionally from head to toe',
      ],
      phone: [
        'Find a quiet place with good reception',
        'Keep your resume and notes visible',
        'Smile - it comes through in your voice',
        'Stand up to project energy',
        'Have a glass of water nearby',
      ],
      onsite: [
        'Plan to arrive 10-15 minutes early',
        'Bring extra copies of your resume',
        'Dress appropriately for the company culture',
        'Be friendly to everyone you meet',
        'Silence your phone completely',
      ],
      panel: [
        'Make eye contact with all interviewers',
        'Direct your answer to the person who asked, but include others',
        'Remember each interviewer\'s name',
        'Be prepared for rapid-fire questions',
        'Show consistent energy throughout',
      ],
      technical: [
        'Think out loud during problem-solving',
        'Ask clarifying questions before diving in',
        'Start with a simple solution, then optimize',
        'Test your solution with examples',
        'It\'s okay to not know everything - show how you learn',
      ],
    };

    return [...commonTips, ...(typeTips[type] || typeTips.video)];
  }

  /**
   * Get faith-based encouragement for interview
   */
  getInterviewEncouragement(): string {
    const encouragements = [
      "You've prepared well. Now trust the process. 'For I will give you words and wisdom.' - Luke 21:15",
      "Be confident in who you are. 'I praise you because I am fearfully and wonderfully made.' - Psalm 139:14",
      "Don't be anxious. 'Do not be anxious about anything, but in every situation, by prayer and petition, present your requests to God.' - Philippians 4:6",
      "You are capable. 'I can do all things through Christ who strengthens me.' - Philippians 4:13",
      "The right opportunity is coming. 'For I know the plans I have for you, plans to prosper you and not to harm you.' - Jeremiah 29:11",
    ];

    return encouragements[Math.floor(Math.random() * encouragements.length)];
  }
}

// ============================================================================
// FACTORY & EXPORTS
// ============================================================================

let interviewPrepInstance: InterviewPrepSystem | null = null;

export function getInterviewPrepSystem(): InterviewPrepSystem {
  if (!interviewPrepInstance) {
    interviewPrepInstance = new InterviewPrepSystem();
  }
  return interviewPrepInstance;
}

export { InterviewPrepSystem };
export default InterviewPrepSystem;
