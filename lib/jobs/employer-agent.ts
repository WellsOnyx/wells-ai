/**
 * Employer AI Agent - Wells Represents Hiring Companies
 *
 * An AI agent that acts on behalf of employers/hiring managers:
 * - Evaluates candidates objectively
 * - Negotiates offers fairly
 * - Coordinates AI-to-AI interviews with candidate agents
 * - Streamlines hiring workflows
 * - Ensures compliance and fairness
 *
 * "Do nothing out of selfish ambition or vain conceit. Rather, in humility
 * value others above yourselves." - Philippians 2:3
 */

import Anthropic from '@anthropic-ai/sdk';
import { sqlQuery as sql } from '@/lib/db';
import { JobSeekerAgent, JobSeekerProfile, ConversationContext } from './job-seeker-agent';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// ============================================================================
// TYPES
// ============================================================================

export interface EmployerProfile {
  id: string;
  userId: string;
  companyId: string;

  // Company info
  companyName: string;
  industry: string;
  companySize: 'startup' | 'small' | 'medium' | 'large' | 'enterprise';
  companyStage?: 'seed' | 'series_a' | 'series_b' | 'series_c' | 'growth' | 'public';
  companyDescription: string;
  culture: string[];
  benefits: string[];
  techStack?: string[];

  // Hiring preferences
  hiringStyle: 'fast_mover' | 'thorough' | 'collaborative' | 'competitive';
  prioritizeCulture: boolean;
  prioritizeSkills: boolean;
  openToRemote: boolean;
  openToRelocation: boolean;

  // Budget parameters
  defaultBudgetFlexibility: number; // 0-1, how much above posted range they can go
  signingBonusBudget?: number;
  equityPoolAvailable: boolean;

  // Process preferences
  interviewStages: string[];
  typicalProcessDays: number;
  decisionMakers: string[];

  createdAt: Date;
  updatedAt: Date;
}

export interface JobOpening {
  id: string;
  employerId: string;
  companyId: string;

  // Role details
  title: string;
  department: string;
  level: 'entry' | 'mid' | 'senior' | 'staff' | 'principal' | 'director' | 'vp' | 'c_level';
  reportingTo: string;
  teamSize?: number;

  // Requirements
  requiredSkills: string[];
  preferredSkills: string[];
  requiredExperience: number; // years
  preferredExperience?: number;
  education?: string[];
  certifications?: string[];

  // Description
  description: string;
  responsibilities: string[];
  whatWeOffer: string[];

  // Compensation
  salaryRange: { min: number; max: number };
  bonusTarget?: number;
  equityRange?: { min: string; max: string };
  signingBonusBudget?: number;

  // Logistics
  location: string;
  workStyle: 'remote' | 'hybrid' | 'onsite';
  startDate?: Date;
  urgency: 'standard' | 'priority' | 'urgent';

  // Process
  interviewProcess: string[];
  hiringManagerId?: string;

  // Status
  status: 'draft' | 'open' | 'paused' | 'filled' | 'cancelled';
  applicationCount: number;
  interviewingCount: number;
  offersMade: number;

  createdAt: Date;
  updatedAt: Date;
}

export interface CandidateEvaluation {
  candidateId: string;
  jobOpeningId: string;
  overallScore: number; // 0-100
  scores: {
    skillsMatch: number;
    experienceMatch: number;
    cultureMatch: number;
    communicationStyle: number;
    potential: number;
  };
  strengths: string[];
  concerns: string[];
  recommendations: string[];
  interviewQuestions: string[];
  verdict: 'strong_yes' | 'yes' | 'maybe' | 'no' | 'strong_no';
  summary: string;
}

export interface NegotiationState {
  candidateId: string;
  jobOpeningId: string;
  round: number;
  currentOffer: {
    baseSalary: number;
    signingBonus?: number;
    equity?: string;
    bonus?: number;
    startDate?: Date;
    additionalTerms?: string;
  };
  candidateCounter?: {
    baseSalary: number;
    signingBonus?: number;
    equity?: string;
    bonus?: number;
    startDate?: Date;
    additionalTerms?: string;
  };
  budgetRemaining: {
    base: number;
    signing: number;
    equity: number;
  };
  status: 'initial_offer' | 'counter_received' | 'countering' | 'final_offer' | 'accepted' | 'declined' | 'expired';
  deadline?: Date;
  notes: string[];
}

export interface AIToAIConversation {
  id: string;
  employerAgentId: string;
  candidateAgentId: string;
  jobOpeningId: string;
  type: 'screening' | 'technical_discussion' | 'negotiation' | 'logistics';
  status: 'in_progress' | 'completed' | 'paused';
  messages: Array<{
    agentType: 'employer' | 'candidate';
    content: string;
    timestamp: Date;
    intent?: string;
  }>;
  outcome?: {
    decision: 'advance' | 'hold' | 'reject' | 'offer' | 'accept' | 'decline';
    reasoning: string;
    nextSteps: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// EMPLOYER AGENT CLASS
// ============================================================================

export class EmployerAgent {
  private profile: EmployerProfile;
  private anthropic: Anthropic;

  constructor(profile: EmployerProfile) {
    this.profile = profile;
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || '',
    });
  }

  // ==========================================================================
  // CANDIDATE EVALUATION
  // ==========================================================================

  /**
   * Evaluate a candidate for a specific role
   */
  async evaluateCandidate(
    candidate: JobSeekerProfile,
    jobOpening: JobOpening
  ): Promise<CandidateEvaluation> {
    // Calculate skill match
    const requiredSkills = jobOpening.requiredSkills.map(s => s.toLowerCase());
    const candidateSkills = candidate.skills.map(s => s.name.toLowerCase());
    const matchedRequired = requiredSkills.filter(rs =>
      candidateSkills.some(cs => cs.includes(rs) || rs.includes(cs))
    );
    const skillsMatchScore = requiredSkills.length > 0
      ? (matchedRequired.length / requiredSkills.length) * 100
      : 50;

    // Calculate experience match
    const expDiff = candidate.yearsExperience - jobOpening.requiredExperience;
    let experienceMatchScore: number;
    if (expDiff >= 0) {
      experienceMatchScore = Math.min(100, 70 + expDiff * 5);
    } else {
      experienceMatchScore = Math.max(0, 70 + expDiff * 15);
    }

    // Calculate culture match
    const culturalKeywords = this.profile.culture.map(c => c.toLowerCase());
    const candidateCulture = candidate.culturePreferences.map(c => c.toLowerCase());
    const cultureOverlap = culturalKeywords.filter(ck =>
      candidateCulture.some(cc => cc.includes(ck) || ck.includes(cc))
    );
    const cultureMatchScore = culturalKeywords.length > 0
      ? (cultureOverlap.length / culturalKeywords.length) * 100
      : 50;

    // Use AI for deeper evaluation
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250514',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `Evaluate this candidate for the role. Be fair and objective.

ROLE: ${jobOpening.title} at ${this.profile.companyName}
Required Skills: ${jobOpening.requiredSkills.join(', ')}
Required Experience: ${jobOpening.requiredExperience}+ years
Level: ${jobOpening.level}

CANDIDATE:
Name: ${candidate.firstName} ${candidate.lastName}
Experience: ${candidate.yearsExperience} years
Current Role: ${candidate.currentTitle || 'Not specified'}
Skills: ${candidate.skills.map(s => `${s.name} (${s.level})`).slice(0, 10).join(', ')}
Recent Achievements: ${candidate.achievements.slice(0, 3).join('; ')}

CALCULATED SCORES:
- Skills Match: ${skillsMatchScore.toFixed(0)}%
- Experience Match: ${experienceMatchScore.toFixed(0)}%
- Culture Fit: ${cultureMatchScore.toFixed(0)}%

Provide evaluation as JSON:
{
  "communicationStyleScore": 0-100 (inferred from profile quality),
  "potentialScore": 0-100 (growth potential),
  "strengths": ["3-4 key strengths"],
  "concerns": ["any concerns or gaps"],
  "recommendations": ["what to explore in interview"],
  "interviewQuestions": ["3-4 specific questions to ask"],
  "verdict": "strong_yes/yes/maybe/no/strong_no",
  "summary": "2-3 sentence summary"
}`,
        }],
      });

      const text = response.content[0]?.type === 'text' ? response.content[0].text : '{}';
      const jsonMatch = text.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const aiEval = JSON.parse(jsonMatch[0]);

        const overallScore = (
          skillsMatchScore * 0.3 +
          experienceMatchScore * 0.25 +
          cultureMatchScore * 0.15 +
          (aiEval.communicationStyleScore || 50) * 0.15 +
          (aiEval.potentialScore || 50) * 0.15
        );

        return {
          candidateId: candidate.id,
          jobOpeningId: jobOpening.id,
          overallScore: Math.round(overallScore),
          scores: {
            skillsMatch: Math.round(skillsMatchScore),
            experienceMatch: Math.round(experienceMatchScore),
            cultureMatch: Math.round(cultureMatchScore),
            communicationStyle: aiEval.communicationStyleScore || 50,
            potential: aiEval.potentialScore || 50,
          },
          strengths: aiEval.strengths || [],
          concerns: aiEval.concerns || [],
          recommendations: aiEval.recommendations || [],
          interviewQuestions: aiEval.interviewQuestions || [],
          verdict: aiEval.verdict || (overallScore >= 75 ? 'yes' : overallScore >= 50 ? 'maybe' : 'no'),
          summary: aiEval.summary || `Candidate scored ${Math.round(overallScore)}/100 overall.`,
        };
      }
    } catch (error) {
      console.error('[EmployerAgent] Evaluation error:', error);
    }

    // Fallback evaluation
    const overallScore = (skillsMatchScore * 0.4 + experienceMatchScore * 0.35 + cultureMatchScore * 0.25);

    return {
      candidateId: candidate.id,
      jobOpeningId: jobOpening.id,
      overallScore: Math.round(overallScore),
      scores: {
        skillsMatch: Math.round(skillsMatchScore),
        experienceMatch: Math.round(experienceMatchScore),
        cultureMatch: Math.round(cultureMatchScore),
        communicationStyle: 50,
        potential: 50,
      },
      strengths: matchedRequired.length > 0 ? [`Strong match on ${matchedRequired.slice(0, 3).join(', ')}`] : [],
      concerns: matchedRequired.length < requiredSkills.length * 0.5 ? ['Skill gaps in key areas'] : [],
      recommendations: ['Conduct technical screen', 'Assess culture fit'],
      interviewQuestions: [
        `Tell me about your experience with ${requiredSkills[0] || 'relevant technologies'}`,
        'Describe a challenging project you led recently',
      ],
      verdict: overallScore >= 75 ? 'yes' : overallScore >= 50 ? 'maybe' : 'no',
      summary: `Candidate has ${candidate.yearsExperience} years of experience with ${matchedRequired.length}/${requiredSkills.length} required skills.`,
    };
  }

  /**
   * Rank multiple candidates for a role
   */
  async rankCandidates(
    candidates: JobSeekerProfile[],
    jobOpening: JobOpening
  ): Promise<Array<{
    candidate: JobSeekerProfile;
    evaluation: CandidateEvaluation;
    rank: number;
  }>> {
    // Evaluate all candidates
    const evaluations = await Promise.all(
      candidates.map(c => this.evaluateCandidate(c, jobOpening))
    );

    // Combine and sort
    const ranked = candidates.map((candidate, index) => ({
      candidate,
      evaluation: evaluations[index],
      rank: 0,
    }));

    ranked.sort((a, b) => b.evaluation.overallScore - a.evaluation.overallScore);

    // Assign ranks
    ranked.forEach((item, index) => {
      item.rank = index + 1;
    });

    return ranked;
  }

  // ==========================================================================
  // OFFER NEGOTIATION
  // ==========================================================================

  /**
   * Generate an initial offer for a candidate
   */
  async generateOffer(
    candidate: JobSeekerProfile,
    jobOpening: JobOpening,
    evaluation: CandidateEvaluation
  ): Promise<{
    offer: NegotiationState['currentOffer'];
    reasoning: string[];
    negotiationRoom: {
      base: number;
      signing: number;
      equity: boolean;
    };
  }> {
    const { salaryRange, bonusTarget, equityRange, signingBonusBudget } = jobOpening;
    const candidateTarget = candidate.compensation.targetBase;

    // Calculate initial offer based on evaluation score
    const scoreMultiplier = evaluation.overallScore / 100;
    const rangeSpread = salaryRange.max - salaryRange.min;

    let baseSalary: number;
    if (evaluation.verdict === 'strong_yes') {
      // Strong candidates get top of range offers
      baseSalary = salaryRange.min + rangeSpread * 0.8;
    } else if (evaluation.verdict === 'yes') {
      // Good candidates get mid-high range
      baseSalary = salaryRange.min + rangeSpread * 0.6;
    } else {
      // Maybe candidates get lower offers
      baseSalary = salaryRange.min + rangeSpread * 0.4;
    }

    // Adjust for candidate expectations
    if (candidateTarget > baseSalary && candidateTarget <= salaryRange.max) {
      // If candidate target is reasonable, meet them partway
      baseSalary = Math.round((baseSalary + candidateTarget) / 2);
    }

    // Round to nearest 1000
    baseSalary = Math.round(baseSalary / 1000) * 1000;

    const reasoning: string[] = [
      `Base salary of $${baseSalary.toLocaleString()} (${((baseSalary - salaryRange.min) / rangeSpread * 100).toFixed(0)}% into range)`,
      `Based on ${evaluation.verdict} evaluation score of ${evaluation.overallScore}`,
    ];

    // Calculate signing bonus if applicable
    let signingBonus: number | undefined;
    if (signingBonusBudget && candidate.compensation.signingBonusExpected) {
      signingBonus = Math.round(signingBonusBudget * scoreMultiplier * 0.7 / 1000) * 1000;
      reasoning.push(`Signing bonus of $${signingBonus.toLocaleString()} to close the deal`);
    }

    // Calculate equity if applicable
    let equity: string | undefined;
    if (equityRange && candidate.compensation.mustHaveEquity) {
      equity = equityRange.min;
      reasoning.push(`Equity starting at ${equity}`);
    }

    // Calculate negotiation room
    const maxAboveRange = salaryRange.max * (1 + this.profile.defaultBudgetFlexibility);
    const negotiationRoom = {
      base: maxAboveRange - baseSalary,
      signing: (signingBonusBudget || 0) - (signingBonus || 0),
      equity: !!equityRange,
    };

    return {
      offer: {
        baseSalary,
        signingBonus,
        equity,
        bonus: bonusTarget,
        startDate: jobOpening.startDate,
      },
      reasoning,
      negotiationRoom,
    };
  }

  /**
   * Respond to a candidate's counter-offer
   */
  async respondToCounter(
    negotiation: NegotiationState,
    jobOpening: JobOpening
  ): Promise<{
    response: 'accept' | 'counter' | 'final' | 'decline';
    newOffer?: NegotiationState['currentOffer'];
    message: string;
    reasoning: string[];
  }> {
    if (!negotiation.candidateCounter) {
      return {
        response: 'decline',
        message: 'No counter-offer received',
        reasoning: ['No counter-offer to evaluate'],
      };
    }

    const counter = negotiation.candidateCounter;
    const current = negotiation.currentOffer;
    const budget = negotiation.budgetRemaining;

    // Calculate gaps
    const baseGap = counter.baseSalary - current.baseSalary;
    const signingGap = (counter.signingBonus || 0) - (current.signingBonus || 0);

    // Check if counter is within budget
    const canMeetBase = baseGap <= budget.base;
    const canMeetSigning = signingGap <= budget.signing;

    const reasoning: string[] = [];

    // Determine response strategy
    if (counter.baseSalary <= current.baseSalary) {
      // Candidate accepted or lowered - accept
      return {
        response: 'accept',
        message: 'Excellent! We\'re aligned on terms.',
        reasoning: ['Candidate accepted our offer'],
      };
    }

    if (canMeetBase && canMeetSigning) {
      // Can meet their counter
      if (baseGap <= budget.base * 0.3) {
        // Small ask - just accept
        return {
          response: 'accept',
          newOffer: counter,
          message: `We can meet you at $${counter.baseSalary.toLocaleString()}.`,
          reasoning: ['Counter is within acceptable range', 'Small gap - accept to close quickly'],
        };
      } else {
        // Meet halfway on remaining gap
        const meetPoint = Math.round((current.baseSalary + counter.baseSalary) / 2 / 1000) * 1000;
        return {
          response: 'counter',
          newOffer: {
            ...current,
            baseSalary: meetPoint,
            signingBonus: Math.round(((current.signingBonus || 0) + (counter.signingBonus || 0)) / 2 / 1000) * 1000 || undefined,
          },
          message: `We can go up to $${meetPoint.toLocaleString()}.`,
          reasoning: ['Meeting halfway on base', 'Still within budget'],
        };
      }
    }

    if (negotiation.round >= 2) {
      // Third round - final offer
      const finalBase = current.baseSalary + Math.min(baseGap, budget.base);
      return {
        response: 'final',
        newOffer: {
          ...current,
          baseSalary: Math.round(finalBase / 1000) * 1000,
          signingBonus: current.signingBonus ? current.signingBonus + Math.min(signingGap, budget.signing) : undefined,
        },
        message: `Our final offer is $${finalBase.toLocaleString()}. This is the best we can do.`,
        reasoning: ['Round 3 - making final offer', 'Maximized budget allocation'],
      };
    }

    // Counter with what we can afford
    const newBase = current.baseSalary + Math.min(baseGap * 0.6, budget.base * 0.7);
    return {
      response: 'counter',
      newOffer: {
        ...current,
        baseSalary: Math.round(newBase / 1000) * 1000,
      },
      message: `We can go to $${newBase.toLocaleString()}. Let me know if that works.`,
      reasoning: ['Counter with 60% of gap', 'Leaving room for final round'],
    };
  }

  // ==========================================================================
  // AI-TO-AI INTERVIEW COORDINATION
  // ==========================================================================

  /**
   * Conduct an AI-to-AI screening conversation
   */
  async conductAIScreening(
    candidateAgent: JobSeekerAgent,
    jobOpening: JobOpening,
    candidateProfile: JobSeekerProfile
  ): Promise<AIToAIConversation> {
    const conversationId = `ai_conv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const messages: AIToAIConversation['messages'] = [];

    // Initial employer message
    const openingMessage = await this.generateScreeningQuestion('opening', jobOpening);
    messages.push({
      agentType: 'employer',
      content: openingMessage,
      timestamp: new Date(),
      intent: 'introduction',
    });

    // Candidate response
    const candidateContext: ConversationContext = {
      sessionId: conversationId,
      employerInfo: {
        companyName: this.profile.companyName,
        jobTitle: jobOpening.title,
        jobId: jobOpening.id,
        salaryRange: jobOpening.salaryRange,
      },
      stage: 'screening',
      messages: [],
      negotiationRound: 0,
      sentiments: {
        employerInterest: 'unknown',
        urgency: 'medium',
        flexibility: 'unknown',
      },
    };

    // Simulate 3-4 round conversation
    const screeningTopics = ['experience', 'skills', 'motivation', 'availability'];

    for (const topic of screeningTopics) {
      // Employer question
      const question = await this.generateScreeningQuestion(topic, jobOpening);
      messages.push({
        agentType: 'employer',
        content: question,
        timestamp: new Date(),
        intent: topic,
      });

      // Candidate response
      candidateContext.messages = messages.map(m => ({
        role: m.agentType === 'employer' ? 'employer' as const : 'candidate' as const,
        content: m.content,
        timestamp: m.timestamp,
      }));

      const candidateResponse = await candidateAgent.representCandidate(question, candidateContext);
      messages.push({
        agentType: 'candidate',
        content: candidateResponse.suggestedResponse || candidateResponse.message,
        timestamp: new Date(),
        intent: 'response',
      });
    }

    // Generate outcome
    const outcome = await this.evaluateScreeningConversation(messages, jobOpening, candidateProfile);

    return {
      id: conversationId,
      employerAgentId: this.profile.id,
      candidateAgentId: candidateProfile.id,
      jobOpeningId: jobOpening.id,
      type: 'screening',
      status: 'completed',
      messages,
      outcome,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Generate screening questions based on topic
   */
  private async generateScreeningQuestion(
    topic: string,
    jobOpening: JobOpening
  ): Promise<string> {
    const questions: Record<string, string[]> = {
      opening: [
        `Hi! I'm excited to learn more about your background for our ${jobOpening.title} role at ${this.profile.companyName}. Could you start by telling me about your current role and what interests you about this opportunity?`,
        `Thank you for your interest in ${this.profile.companyName}! I'd love to hear about your journey and what drew you to our ${jobOpening.title} position.`,
      ],
      experience: [
        `Can you tell me about your most relevant experience for this ${jobOpening.level} ${jobOpening.title} role? Specifically, I'd love to hear about projects where you used ${jobOpening.requiredSkills[0] || 'key skills'}.`,
        `What's the most complex project you've led that relates to ${jobOpening.department}? Walk me through your approach.`,
      ],
      skills: [
        `Our tech stack includes ${this.profile.techStack?.join(', ') || jobOpening.requiredSkills.join(', ')}. How does your background align with these technologies?`,
        `Which of these skills - ${jobOpening.requiredSkills.slice(0, 3).join(', ')} - would you say is your strongest, and why?`,
      ],
      motivation: [
        `What excites you about joining ${this.profile.companyName}? What kind of impact are you looking to make?`,
        `Where do you see yourself growing over the next 2-3 years, and how does this role fit into that?`,
      ],
      availability: [
        `If we were to move forward, when would you be available to start? Any notice period considerations?`,
        `This role is ${jobOpening.workStyle}. Does that work with your situation?`,
      ],
    };

    const options = questions[topic] || questions.experience;
    return options[Math.floor(Math.random() * options.length)];
  }

  /**
   * Evaluate the screening conversation
   */
  private async evaluateScreeningConversation(
    messages: AIToAIConversation['messages'],
    jobOpening: JobOpening,
    candidate: JobSeekerProfile
  ): Promise<AIToAIConversation['outcome']> {
    try {
      const conversationText = messages
        .map(m => `${m.agentType.toUpperCase()}: ${m.content}`)
        .join('\n\n');

      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250514',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: `Evaluate this screening conversation between an employer and candidate.

ROLE: ${jobOpening.title}
REQUIRED: ${jobOpening.requiredSkills.join(', ')}

CONVERSATION:
${conversationText}

Provide evaluation as JSON:
{
  "decision": "advance" or "hold" or "reject",
  "reasoning": "brief explanation",
  "nextSteps": ["what should happen next"]
}`,
        }],
      });

      const text = response.content[0]?.type === 'text' ? response.content[0].text : '{}';
      const jsonMatch = text.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return {
          decision: result.decision,
          reasoning: result.reasoning,
          nextSteps: result.nextSteps,
        };
      }
    } catch (error) {
      console.error('[EmployerAgent] Screening evaluation error:', error);
    }

    return {
      decision: 'hold',
      reasoning: 'Needs human review',
      nextSteps: ['Schedule follow-up with hiring manager'],
    };
  }

  // ==========================================================================
  // MESSAGE GENERATION
  // ==========================================================================

  /**
   * Generate a message to send to a candidate
   */
  async generateCandidateMessage(
    context: 'initial_outreach' | 'interview_invite' | 'offer' | 'rejection' | 'follow_up',
    candidate: JobSeekerProfile,
    jobOpening: JobOpening,
    additionalContext?: Record<string, unknown>
  ): Promise<string> {
    const templates: Record<string, string> = {
      initial_outreach: `Hi ${candidate.firstName},

I came across your profile and was impressed by your background in ${candidate.skills[0]?.name || 'your field'}. We're building something exciting at ${this.profile.companyName} and think you could be a great fit for our ${jobOpening.title} role.

${jobOpening.description.slice(0, 200)}...

Would you be open to a quick chat to learn more?

Best,
${this.profile.companyName} Team`,

      interview_invite: `Hi ${candidate.firstName},

Thank you for your interest in the ${jobOpening.title} position at ${this.profile.companyName}! We've reviewed your application and would love to move forward with an interview.

Our process includes: ${jobOpening.interviewProcess.join(' -> ')}

Please let us know your availability in the next week or two.

Looking forward to speaking with you!`,

      offer: `Hi ${candidate.firstName},

I'm thrilled to extend an offer for the ${jobOpening.title} position at ${this.profile.companyName}!

We were impressed by ${(additionalContext as Record<string, string[]> | undefined)?.strengths?.[0] || 'your background'} and believe you'll make a significant impact on our team.

I'll send the formal offer letter with all details shortly. Please let me know if you have any questions.

Welcome to the team (pending your acceptance)!`,

      rejection: `Hi ${candidate.firstName},

Thank you for taking the time to interview for the ${jobOpening.title} position at ${this.profile.companyName}. We appreciated the opportunity to learn about your background.

After careful consideration, we've decided to move forward with other candidates whose experience more closely matches our current needs.

We were impressed by your ${candidate.skills[0]?.name || 'skills'} and encourage you to apply for future openings that match your profile.

Wishing you the best in your search.`,

      follow_up: `Hi ${candidate.firstName},

I wanted to follow up on our conversation about the ${jobOpening.title} role. Have you had a chance to think it over?

Happy to answer any questions or hop on a quick call.

Best,
${this.profile.companyName} Team`,
    };

    return templates[context] || templates.follow_up;
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create an Employer Agent from company/user ID
 */
export async function createEmployerAgent(companyId: string): Promise<EmployerAgent | null> {
  try {
    const result = await sql`
      SELECT * FROM employer_profiles WHERE company_id = ${companyId}
    `;

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    const profile: EmployerProfile = {
      id: row.id as string,
      userId: row.user_id as string,
      companyId: row.company_id as string,
      companyName: row.company_name as string,
      industry: row.industry as string,
      companySize: row.company_size as EmployerProfile['companySize'],
      companyStage: row.company_stage as EmployerProfile['companyStage'],
      companyDescription: row.company_description as string,
      culture: (row.culture as string[]) || [],
      benefits: (row.benefits as string[]) || [],
      techStack: row.tech_stack as string[],
      hiringStyle: (row.hiring_style as EmployerProfile['hiringStyle']) || 'thorough',
      prioritizeCulture: (row.prioritize_culture as boolean) || true,
      prioritizeSkills: (row.prioritize_skills as boolean) || true,
      openToRemote: (row.open_to_remote as boolean) || true,
      openToRelocation: (row.open_to_relocation as boolean) || false,
      defaultBudgetFlexibility: (row.default_budget_flexibility as number) || 0.1,
      signingBonusBudget: row.signing_bonus_budget as number,
      equityPoolAvailable: (row.equity_pool_available as boolean) || false,
      interviewStages: (row.interview_stages as string[]) || ['Phone Screen', 'Technical', 'Final'],
      typicalProcessDays: (row.typical_process_days as number) || 21,
      decisionMakers: (row.decision_makers as string[]) || [],
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };

    return new EmployerAgent(profile);
  } catch (error) {
    console.error('[createEmployerAgent] Error:', error);
    return null;
  }
}

/**
 * Save an employer profile
 */
export async function saveEmployerProfile(
  profile: Partial<EmployerProfile> & { userId: string; companyId: string }
): Promise<{ success: boolean; message: string }> {
  try {
    const profileId = profile.id || `employer_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    await sql`
      INSERT INTO employer_profiles (
        id, user_id, company_id, company_name, industry, company_size,
        company_stage, company_description, culture, benefits, tech_stack,
        hiring_style, prioritize_culture, prioritize_skills,
        open_to_remote, open_to_relocation,
        default_budget_flexibility, signing_bonus_budget, equity_pool_available,
        interview_stages, typical_process_days, decision_makers
      ) VALUES (
        ${profileId}, ${profile.userId}, ${profile.companyId},
        ${profile.companyName || null}, ${profile.industry || null},
        ${profile.companySize || 'medium'},
        ${profile.companyStage || null}, ${profile.companyDescription || null},
        ${profile.culture || []}, ${profile.benefits || []}, ${profile.techStack || []},
        ${profile.hiringStyle || 'thorough'},
        ${profile.prioritizeCulture ?? true}, ${profile.prioritizeSkills ?? true},
        ${profile.openToRemote ?? true}, ${profile.openToRelocation ?? false},
        ${profile.defaultBudgetFlexibility || 0.1},
        ${profile.signingBonusBudget || null}, ${profile.equityPoolAvailable ?? false},
        ${profile.interviewStages || []}, ${profile.typicalProcessDays || 21},
        ${profile.decisionMakers || []}
      )
      ON CONFLICT (company_id) DO UPDATE SET
        company_name = COALESCE(EXCLUDED.company_name, employer_profiles.company_name),
        industry = COALESCE(EXCLUDED.industry, employer_profiles.industry),
        company_size = COALESCE(EXCLUDED.company_size, employer_profiles.company_size),
        company_description = COALESCE(EXCLUDED.company_description, employer_profiles.company_description),
        culture = COALESCE(EXCLUDED.culture, employer_profiles.culture),
        benefits = COALESCE(EXCLUDED.benefits, employer_profiles.benefits),
        tech_stack = COALESCE(EXCLUDED.tech_stack, employer_profiles.tech_stack),
        hiring_style = COALESCE(EXCLUDED.hiring_style, employer_profiles.hiring_style),
        prioritize_culture = COALESCE(EXCLUDED.prioritize_culture, employer_profiles.prioritize_culture),
        prioritize_skills = COALESCE(EXCLUDED.prioritize_skills, employer_profiles.prioritize_skills),
        open_to_remote = COALESCE(EXCLUDED.open_to_remote, employer_profiles.open_to_remote),
        open_to_relocation = COALESCE(EXCLUDED.open_to_relocation, employer_profiles.open_to_relocation),
        default_budget_flexibility = COALESCE(EXCLUDED.default_budget_flexibility, employer_profiles.default_budget_flexibility),
        signing_bonus_budget = COALESCE(EXCLUDED.signing_bonus_budget, employer_profiles.signing_bonus_budget),
        equity_pool_available = COALESCE(EXCLUDED.equity_pool_available, employer_profiles.equity_pool_available),
        interview_stages = COALESCE(EXCLUDED.interview_stages, employer_profiles.interview_stages),
        typical_process_days = COALESCE(EXCLUDED.typical_process_days, employer_profiles.typical_process_days),
        decision_makers = COALESCE(EXCLUDED.decision_makers, employer_profiles.decision_makers),
        updated_at = NOW()
    `;

    return {
      success: true,
      message: 'Employer profile saved successfully.',
    };
  } catch (error) {
    console.error('[saveEmployerProfile] Error:', error);
    return {
      success: false,
      message: 'Failed to save employer profile.',
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export { EmployerAgent };
export default EmployerAgent;
