/**
 * Job Seeker AI Agent - Wells Represents Candidates
 *
 * A sophisticated AI agent that acts on behalf of job seekers:
 * - Represents candidates in conversations with employers
 * - Negotiates salary, benefits, and terms
 * - Highlights relevant experience strategically
 * - Handles objections professionally
 * - Protects candidate interests while being collaborative
 * - Provides encouragement grounded in faith
 *
 * "Let us run with perseverance the race marked out for us" - Hebrews 12:1
 */

import Anthropic from '@anthropic-ai/sdk';
import { sqlQuery as sql } from '@/lib/db';
import type { CandidateProfile, CandidateConstraints } from './candidate-agent';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// ============================================================================
// TYPES
// ============================================================================

export interface JobSeekerProfile {
  id: string;
  userId: string;

  // Personal info
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  linkedinUrl?: string;
  portfolioUrl?: string;

  // Professional summary
  headline: string;
  summary: string;
  yearsExperience: number;
  currentTitle?: string;
  currentCompany?: string;

  // Skills and experience
  skills: SkillProfile[];
  experiences: WorkExperience[];
  education: Education[];
  certifications: Certification[];
  achievements: string[];

  // Career preferences
  targetRoles: string[];
  targetIndustries: string[];
  desiredCompanySize: ('startup' | 'small' | 'medium' | 'large' | 'enterprise')[];
  workStyle: 'remote' | 'hybrid' | 'onsite' | 'flexible';
  willingToRelocate: boolean;
  preferredLocations: string[];

  // Compensation expectations
  compensation: CompensationExpectations;

  // Values and culture
  culturePreferences: string[];
  dealBreakers: string[];
  mustHaves: string[];
  niceToHaves: string[];

  // Agent settings
  agentPersonality: 'professional' | 'confident' | 'collaborative' | 'assertive';
  negotiationStyle: 'conservative' | 'moderate' | 'aggressive';
  autoApplyEnabled: boolean;
  autoApplyThreshold: number;

  // Status
  availability: 'actively_looking' | 'open_to_opportunities' | 'not_looking' | 'employed_looking';
  noticePeriod?: number; // days
  availableFrom?: Date;

  // Faith foundation
  faithEnabled: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export interface SkillProfile {
  name: string;
  category: string;
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  yearsUsed: number;
  lastUsed?: Date;
  endorsed: boolean;
  endorsementCount?: number;
  projectsUsed?: string[];
}

export interface WorkExperience {
  id: string;
  title: string;
  company: string;
  companySize?: string;
  industry?: string;
  location?: string;
  startDate: Date;
  endDate?: Date;
  current: boolean;
  description: string;
  achievements: string[];
  skills: string[];
  managerName?: string;
  teamSize?: number;
  promotions?: string[];
}

export interface Education {
  degree: string;
  field: string;
  institution: string;
  graduationDate?: Date;
  gpa?: number;
  honors?: string[];
  relevantCoursework?: string[];
}

export interface Certification {
  name: string;
  issuer: string;
  dateObtained: Date;
  expirationDate?: Date;
  credentialId?: string;
  url?: string;
}

export interface CompensationExpectations {
  minimumBase: number;
  targetBase: number;
  idealBase: number;
  mustHaveBonus: boolean;
  minimumBonus?: number;
  mustHaveEquity: boolean;
  minimumEquity?: string;
  signingBonusExpected: boolean;
  minimumSigningBonus?: number;
  benefitsPriority: string[];
  totalCompFocus: boolean; // Focus on total comp vs base
}

export interface ConversationContext {
  sessionId: string;
  employerInfo?: {
    companyName: string;
    recruiterName?: string;
    jobTitle: string;
    jobId?: string;
    salaryRange?: { min: number; max: number };
  };
  stage: 'initial_contact' | 'screening' | 'interview_prep' | 'post_interview' | 'offer_discussion' | 'negotiation';
  messages: Array<{
    role: 'candidate' | 'employer' | 'wells';
    content: string;
    timestamp: Date;
  }>;
  currentOffer?: {
    baseSalary: number;
    signingBonus?: number;
    equity?: string;
    bonus?: number;
    benefits?: string[];
    startDate?: Date;
    otherTerms?: string;
  };
  negotiationRound: number;
  sentiments: {
    employerInterest: 'high' | 'medium' | 'low' | 'unknown';
    urgency: 'high' | 'medium' | 'low';
    flexibility: 'high' | 'medium' | 'low' | 'unknown';
  };
}

export interface AgentResponse {
  message: string;
  suggestedResponse?: string;
  internalAnalysis: string;
  recommendedActions: string[];
  riskAssessment?: {
    level: 'low' | 'medium' | 'high';
    factors: string[];
  };
  faithEncouragement?: string;
  emotionalSupport?: string;
}

// ============================================================================
// FAITH-BASED ENCOURAGEMENT
// ============================================================================

const FAITH_ENCOURAGEMENTS = {
  rejection: [
    "This door closing means a better one is opening. 'And we know that in all things God works for the good of those who love him.' - Romans 8:28",
    "Rejection is redirection. 'Trust in the Lord with all your heart and lean not on your own understanding.' - Proverbs 3:5-6",
    "Every 'no' brings you closer to your 'yes'. 'Let us not become weary in doing good, for at the proper time we will reap a harvest if we do not give up.' - Galatians 6:9",
  ],
  waiting: [
    "Patience is powerful. 'You need to persevere so that when you have done the will of God, you will receive what he has promised.' - Hebrews 10:36",
    "The waiting period is the preparation period. 'Be still before the Lord and wait patiently for him.' - Psalm 37:7",
    "Good things take time. 'But those who wait on the Lord shall renew their strength.' - Isaiah 40:31",
  ],
  negotiation: [
    "Know your worth, but approach with wisdom. 'The integrity of the upright guides them.' - Proverbs 11:3",
    "Ask confidently but graciously. 'If any of you lacks wisdom, you should ask God, who gives generously.' - James 1:5",
    "Stand firm in your value while remaining humble. 'Humility comes before honor.' - Proverbs 18:12",
  ],
  interview: [
    "You've prepared well. Trust the process. 'Commit to the Lord whatever you do, and he will establish your plans.' - Proverbs 16:3",
    "Speak your truth with confidence. 'For I will give you words and wisdom that none of your adversaries will be able to resist.' - Luke 21:15",
    "Be authentically you. 'For we are God's handiwork, created in Christ Jesus to do good works.' - Ephesians 2:10",
  ],
  success: [
    "Celebrate this moment! 'This is the day the Lord has made; let us rejoice and be glad in it.' - Psalm 118:24",
    "Your hard work and faith have paid off. 'Well done, good and faithful servant!' - Matthew 25:23",
    "May this new chapter bring you growth and purpose. 'For I know the plans I have for you, declares the Lord, plans to prosper you.' - Jeremiah 29:11",
  ],
};

function getFaithEncouragement(context: string): string {
  const encouragements = FAITH_ENCOURAGEMENTS[context as keyof typeof FAITH_ENCOURAGEMENTS] || FAITH_ENCOURAGEMENTS.waiting;
  return encouragements[Math.floor(Math.random() * encouragements.length)];
}

// ============================================================================
// JOB SEEKER AGENT CLASS
// ============================================================================

export class JobSeekerAgent {
  private profile: JobSeekerProfile;
  private anthropic: Anthropic;

  constructor(profile: JobSeekerProfile) {
    this.profile = profile;
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || '',
    });
  }

  // ==========================================================================
  // CORE AGENT CAPABILITIES
  // ==========================================================================

  /**
   * Generate a response on behalf of the candidate
   */
  async representCandidate(
    employerMessage: string,
    context: ConversationContext
  ): Promise<AgentResponse> {
    const systemPrompt = this.buildAgentSystemPrompt(context);

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250514',
        max_tokens: 1500,
        system: systemPrompt,
        messages: [
          ...this.formatConversationHistory(context),
          { role: 'user', content: `Employer message: "${employerMessage}"\n\nRespond as the candidate's representative.` },
        ],
      });

      const responseText = response.content[0]?.type === 'text' ? response.content[0].text : '';

      // Parse the response into structured format
      return this.parseAgentResponse(responseText, context);
    } catch (error) {
      console.error('[JobSeekerAgent] Response generation error:', error);
      return {
        message: "I'll help craft a response to this. Give me a moment to think about the best approach.",
        internalAnalysis: 'Error generating response',
        recommendedActions: ['Review the message and provide guidance manually'],
      };
    }
  }

  /**
   * Analyze an incoming message from an employer
   */
  async analyzeEmployerMessage(
    message: string,
    context: ConversationContext
  ): Promise<{
    sentiment: 'positive' | 'neutral' | 'negative' | 'urgent';
    intent: string;
    keyPoints: string[];
    concerns: string[];
    opportunities: string[];
    suggestedApproach: string;
  }> {
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250514',
        max_tokens: 800,
        messages: [{
          role: 'user',
          content: `Analyze this message from an employer in the context of a job application.

Message: "${message}"

Context:
- Job: ${context.employerInfo?.jobTitle || 'Unknown'} at ${context.employerInfo?.companyName || 'Unknown'}
- Stage: ${context.stage}
- Negotiation Round: ${context.negotiationRound}
${context.currentOffer ? `- Current Offer: $${context.currentOffer.baseSalary}` : ''}

Provide analysis as JSON:
{
  "sentiment": "positive/neutral/negative/urgent",
  "intent": "what the employer is trying to communicate",
  "keyPoints": ["important points from the message"],
  "concerns": ["any concerns or red flags"],
  "opportunities": ["leverage points or positive signals"],
  "suggestedApproach": "recommended approach for response"
}`,
        }],
      });

      const text = response.content[0]?.type === 'text' ? response.content[0].text : '{}';
      const jsonMatch = text.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('[JobSeekerAgent] Analysis error:', error);
    }

    return {
      sentiment: 'neutral',
      intent: 'General communication',
      keyPoints: [],
      concerns: [],
      opportunities: [],
      suggestedApproach: 'Respond professionally and gather more information',
    };
  }

  /**
   * Handle salary negotiation
   */
  async negotiateSalary(
    offer: {
      baseSalary: number;
      signingBonus?: number;
      equity?: string;
      bonus?: number;
    },
    context: ConversationContext
  ): Promise<{
    recommendation: 'accept' | 'counter' | 'decline' | 'ask_questions';
    suggestedCounter?: {
      baseSalary: number;
      signingBonus?: number;
      equity?: string;
      bonus?: number;
    };
    message: string;
    reasoning: string[];
    talkingPoints: string[];
    riskLevel: 'low' | 'medium' | 'high';
  }> {
    const { compensation } = this.profile;

    // Calculate how offer compares to expectations
    const baseGap = ((compensation.targetBase - offer.baseSalary) / compensation.targetBase) * 100;
    const meetsMinimum = offer.baseSalary >= compensation.minimumBase;
    const meetsTarget = offer.baseSalary >= compensation.targetBase;

    // Determine recommendation
    let recommendation: 'accept' | 'counter' | 'decline' | 'ask_questions';
    let suggestedCounter;
    const reasoning: string[] = [];
    const talkingPoints: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' = 'low';

    if (!meetsMinimum && baseGap > 20) {
      recommendation = 'decline';
      reasoning.push(`Offer ($${offer.baseSalary.toLocaleString()}) is significantly below your minimum ($${compensation.minimumBase.toLocaleString()})`);
      riskLevel = 'low';
    } else if (!meetsMinimum) {
      recommendation = 'counter';
      const counterBase = Math.round(compensation.targetBase / 1000) * 1000;
      suggestedCounter = {
        baseSalary: counterBase,
        signingBonus: compensation.minimumSigningBonus || Math.round(counterBase * 0.1),
        equity: offer.equity,
        bonus: offer.bonus,
      };
      reasoning.push(`Offer is ${Math.abs(baseGap).toFixed(0)}% below your target`);
      reasoning.push('Counter to your target range is reasonable given your experience');
      talkingPoints.push(`Based on my ${this.profile.yearsExperience} years of experience in this field...`);
      talkingPoints.push('I\'m very excited about this opportunity and confident we can find terms that work...');
      riskLevel = 'medium';
    } else if (!meetsTarget && baseGap > 5) {
      recommendation = 'counter';
      const counterBase = Math.round((offer.baseSalary + compensation.targetBase) / 2 / 1000) * 1000;
      suggestedCounter = {
        baseSalary: counterBase,
        signingBonus: offer.signingBonus || compensation.minimumSigningBonus,
        equity: offer.equity,
        bonus: offer.bonus,
      };
      reasoning.push('Offer is within range but below your target');
      reasoning.push('A moderate counter is appropriate');
      talkingPoints.push('Thank you for this offer. I\'m thrilled about the opportunity...');
      talkingPoints.push(`I was hoping we could discuss the base salary closer to $${counterBase.toLocaleString()}...`);
      riskLevel = 'low';
    } else {
      recommendation = 'accept';
      reasoning.push('Offer meets or exceeds your target');
      if (offer.baseSalary >= compensation.idealBase) {
        reasoning.push('This is an excellent offer!');
      }
      talkingPoints.push('Thank you for this generous offer. I\'m excited to accept...');
    }

    // Generate negotiation message
    let message: string;
    if (recommendation === 'accept') {
      message = `Great news! The offer of $${offer.baseSalary.toLocaleString()} ${meetsTarget ? 'meets' : 'is close to'} your target. I recommend accepting.`;
    } else if (recommendation === 'counter') {
      message = `The offer of $${offer.baseSalary.toLocaleString()} is ${Math.abs(baseGap).toFixed(0)}% below your target. I suggest countering at $${suggestedCounter!.baseSalary.toLocaleString()}.`;
    } else if (recommendation === 'decline') {
      message = `This offer is significantly below your requirements. I recommend either countering substantially or declining respectfully.`;
    } else {
      message = `I\'d recommend asking some clarifying questions about the total compensation package before making a decision.`;
    }

    // Add faith encouragement if enabled
    if (this.profile.faithEnabled) {
      message += '\n\n' + getFaithEncouragement('negotiation');
    }

    return {
      recommendation,
      suggestedCounter,
      message,
      reasoning,
      talkingPoints,
      riskLevel,
    };
  }

  /**
   * Handle objections professionally
   */
  async handleObjection(
    objection: string,
    objectionType: 'experience' | 'skills' | 'salary' | 'availability' | 'culture_fit' | 'other',
    context: ConversationContext
  ): Promise<{
    response: string;
    keyPoints: string[];
    alternativeAngle?: string;
    followUpQuestion?: string;
  }> {
    // Build objection handlers based on profile
    const handlers: Record<string, () => Promise<string>> = {
      experience: async () => {
        const relevantExp = this.profile.experiences
          .filter(e => e.skills.some(s =>
            context.employerInfo?.jobTitle?.toLowerCase().includes(s.toLowerCase())
          ))
          .slice(0, 2);

        if (relevantExp.length > 0) {
          return `While my title may have been different, my ${relevantExp[0].title} role at ${relevantExp[0].company} involved ${relevantExp[0].achievements[0] || 'similar responsibilities'}. This experience directly translates to what you're looking for.`;
        }
        return 'I\'d like to highlight some transferable experience that demonstrates my readiness for this role...';
      },

      skills: async () => {
        const missingSkillGuess = objection.toLowerCase();
        const relatedSkills = this.profile.skills.filter(s =>
          s.name.toLowerCase().includes(missingSkillGuess) ||
          s.category.toLowerCase().includes(missingSkillGuess)
        );

        if (relatedSkills.length > 0) {
          return `I have ${relatedSkills[0].yearsUsed} years with ${relatedSkills[0].name}. While you mentioned ${objection}, my background in this area means I can ramp up quickly.`;
        }
        return 'I\'m a quick learner and have picked up new technologies rapidly in my previous roles. For example...';
      },

      salary: async () => {
        return `I understand budget considerations. Given my ${this.profile.yearsExperience} years of experience and track record of ${this.profile.achievements[0] || 'delivering results'}, I believe the compensation reflects the value I'll bring. I'm open to discussing creative structures like signing bonuses or performance-based increases.`;
      },

      availability: async () => {
        const notice = this.profile.noticePeriod || 14;
        return `I can be available within ${notice} days. If you need someone sooner, I'm happy to discuss transition options or starting on a part-time basis while wrapping up my current commitments.`;
      },

      culture_fit: async () => {
        const culture = this.profile.culturePreferences[0] || 'collaborative teams';
        return `I thrive in ${culture}. In my previous role at ${this.profile.experiences[0]?.company || 'my current company'}, I contributed to team success by ${this.profile.experiences[0]?.achievements[0] || 'fostering collaboration'}. I'd love to learn more about your team culture.`;
      },

      other: async () => {
        return 'That\'s a great point. Let me address that...';
      },
    };

    try {
      const baseResponse = await handlers[objectionType]();

      // Enhance with AI
      const aiResponse = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250514',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: `Enhance this objection response for a job candidate. Make it confident but not defensive.

Objection: "${objection}"
Base Response: "${baseResponse}"
Candidate Experience: ${this.profile.yearsExperience} years
Current Role: ${this.profile.currentTitle || 'Professional'}

Provide:
1. Enhanced response (2-3 sentences)
2. 2-3 key supporting points
3. A follow-up question to ask the employer`,
        }],
      });

      const text = aiResponse.content[0]?.type === 'text' ? aiResponse.content[0].text : '';

      return {
        response: baseResponse,
        keyPoints: [
          `${this.profile.yearsExperience} years of relevant experience`,
          this.profile.achievements[0] || 'Proven track record',
        ],
        alternativeAngle: text.includes('alternatively') ? text.split('alternatively')[1]?.slice(0, 200) : undefined,
        followUpQuestion: 'What would success look like in this role in the first 90 days?',
      };
    } catch (error) {
      console.error('[JobSeekerAgent] Objection handling error:', error);
      return {
        response: 'I appreciate you sharing that concern. Let me address it...',
        keyPoints: [],
      };
    }
  }

  /**
   * Highlight relevant experience for a specific role
   */
  async highlightExperience(
    jobRequirements: string[],
    jobDescription: string
  ): Promise<{
    matchedExperiences: Array<{
      requirement: string;
      experience: WorkExperience;
      relevance: string;
      impactStatement: string;
    }>;
    skillHighlights: string[];
    uniqueValue: string;
    elevatorPitch: string;
  }> {
    const matchedExperiences: Array<{
      requirement: string;
      experience: WorkExperience;
      relevance: string;
      impactStatement: string;
    }> = [];

    // Match requirements to experiences
    for (const requirement of jobRequirements.slice(0, 5)) {
      const reqLower = requirement.toLowerCase();

      // Find best matching experience
      let bestMatch: WorkExperience | null = null;
      let bestScore = 0;

      for (const exp of this.profile.experiences) {
        let score = 0;

        // Check title match
        if (exp.title.toLowerCase().includes(reqLower) || reqLower.includes(exp.title.toLowerCase())) {
          score += 3;
        }

        // Check skills match
        const matchedSkills = exp.skills.filter(s => reqLower.includes(s.toLowerCase()));
        score += matchedSkills.length * 2;

        // Check description/achievements
        if (exp.description.toLowerCase().includes(reqLower)) {
          score += 2;
        }
        if (exp.achievements.some(a => a.toLowerCase().includes(reqLower))) {
          score += 3;
        }

        if (score > bestScore) {
          bestScore = score;
          bestMatch = exp;
        }
      }

      if (bestMatch && bestScore > 0) {
        matchedExperiences.push({
          requirement,
          experience: bestMatch,
          relevance: `${bestMatch.title} at ${bestMatch.company}`,
          impactStatement: bestMatch.achievements[0] || `Led key initiatives in ${bestMatch.title} role`,
        });
      }
    }

    // Get top skill highlights
    const skillHighlights = this.profile.skills
      .filter(s => s.level === 'expert' || s.level === 'advanced')
      .slice(0, 5)
      .map(s => `${s.name} (${s.yearsUsed} years)`);

    // Generate unique value proposition
    const uniqueValue = `I bring ${this.profile.yearsExperience} years of experience with a unique combination of ${skillHighlights.slice(0, 3).map(s => s.split(' (')[0]).join(', ')}, which positions me to ${this.profile.achievements[0]?.toLowerCase() || 'drive results'}.`;

    // Generate elevator pitch
    const elevatorPitch = `I'm a ${this.profile.currentTitle || 'professional'} with ${this.profile.yearsExperience} years of experience. ${this.profile.summary?.slice(0, 150) || `I specialize in ${this.profile.skills[0]?.name || 'delivering results'}.`} I'm excited about this role because ${this.profile.targetRoles[0] ? `it aligns with my goal of ${this.profile.targetRoles[0]}` : 'it matches my career aspirations'}.`;

    return {
      matchedExperiences,
      skillHighlights,
      uniqueValue,
      elevatorPitch,
    };
  }

  /**
   * Protect candidate interests in a conversation
   */
  async protectInterests(
    proposedTerms: Record<string, unknown>,
    context: ConversationContext
  ): Promise<{
    redFlags: string[];
    warnings: string[];
    safeguards: string[];
    questionsToAsk: string[];
    recommendation: string;
  }> {
    const redFlags: string[] = [];
    const warnings: string[] = [];
    const safeguards: string[] = [];
    const questionsToAsk: string[] = [];

    // Check salary against minimum
    if (proposedTerms.baseSalary) {
      const salary = proposedTerms.baseSalary as number;
      if (salary < this.profile.compensation.minimumBase) {
        redFlags.push(`Proposed salary ($${salary.toLocaleString()}) is below your minimum ($${this.profile.compensation.minimumBase.toLocaleString()})`);
        safeguards.push('Counter with your target salary backed by market data');
      } else if (salary < this.profile.compensation.targetBase) {
        warnings.push(`Salary is below your target. Gap: $${(this.profile.compensation.targetBase - salary).toLocaleString()}`);
        safeguards.push('Consider negotiating for signing bonus or guaranteed review at 6 months');
      }
    }

    // Check for deal breakers
    for (const dealBreaker of this.profile.dealBreakers) {
      const termValue = Object.entries(proposedTerms).find(([key, val]) =>
        key.toLowerCase().includes(dealBreaker.toLowerCase()) ||
        String(val).toLowerCase().includes(dealBreaker.toLowerCase())
      );
      if (termValue) {
        redFlags.push(`Deal breaker detected: ${dealBreaker}`);
      }
    }

    // Check must-haves
    for (const mustHave of this.profile.mustHaves) {
      const hasItem = Object.entries(proposedTerms).some(([key, val]) =>
        key.toLowerCase().includes(mustHave.toLowerCase()) ||
        String(val).toLowerCase().includes(mustHave.toLowerCase())
      );
      if (!hasItem) {
        warnings.push(`Missing must-have: ${mustHave}`);
        questionsToAsk.push(`Can you tell me more about ${mustHave}?`);
      }
    }

    // Check equity and vesting
    if (proposedTerms.equity && this.profile.compensation.mustHaveEquity) {
      questionsToAsk.push('What is the vesting schedule for the equity?');
      questionsToAsk.push('Is there a cliff period? How long?');
      questionsToAsk.push('What happens to unvested shares if I leave?');
      safeguards.push('Get equity terms in writing before accepting');
    }

    // Check start date flexibility
    if (proposedTerms.startDate) {
      const startDate = new Date(proposedTerms.startDate as string);
      const availableFrom = this.profile.availableFrom || new Date();
      if (startDate < availableFrom) {
        warnings.push('Proposed start date is before your available date');
        safeguards.push('Negotiate start date to align with your availability');
      }
    }

    // Generate recommendation
    let recommendation: string;
    if (redFlags.length > 0) {
      recommendation = 'Proceed with caution. There are significant concerns that should be addressed before moving forward.';
    } else if (warnings.length > 2) {
      recommendation = 'Several items need clarification. Ask questions before committing.';
    } else {
      recommendation = 'Terms look reasonable. Minor negotiations may improve the package.';
    }

    return {
      redFlags,
      warnings,
      safeguards,
      questionsToAsk,
      recommendation,
    };
  }

  // ==========================================================================
  // INTERNAL HELPERS
  // ==========================================================================

  private buildAgentSystemPrompt(context: ConversationContext): string {
    const personalityMap = {
      professional: 'professional, articulate, and measured',
      confident: 'confident, direct, and value-focused',
      collaborative: 'collaborative, warm, and relationship-focused',
      assertive: 'assertive, clear about boundaries, and self-assured',
    };

    const personality = personalityMap[this.profile.agentPersonality] || personalityMap.professional;

    return `You are Wells, an AI agent representing ${this.profile.firstName} ${this.profile.lastName} in their job search.

CANDIDATE PROFILE:
- Name: ${this.profile.firstName} ${this.profile.lastName}
- Current Role: ${this.profile.currentTitle || 'Professional'} at ${this.profile.currentCompany || 'Current Company'}
- Experience: ${this.profile.yearsExperience} years
- Target Roles: ${this.profile.targetRoles.join(', ')}
- Key Skills: ${this.profile.skills.slice(0, 5).map(s => s.name).join(', ')}

COMPENSATION EXPECTATIONS:
- Minimum: $${this.profile.compensation.minimumBase.toLocaleString()}
- Target: $${this.profile.compensation.targetBase.toLocaleString()}
- Ideal: $${this.profile.compensation.idealBase.toLocaleString()}
${this.profile.compensation.mustHaveEquity ? '- Equity is important' : ''}
${this.profile.compensation.signingBonusExpected ? '- Signing bonus expected' : ''}

CONVERSATION CONTEXT:
- Company: ${context.employerInfo?.companyName || 'Unknown'}
- Role: ${context.employerInfo?.jobTitle || 'Unknown'}
- Stage: ${context.stage}
- Negotiation Round: ${context.negotiationRound}

YOUR PERSONALITY: ${personality}

NEGOTIATION STYLE: ${this.profile.negotiationStyle}

KEY ACHIEVEMENTS TO HIGHLIGHT:
${this.profile.achievements.slice(0, 3).map(a => `- ${a}`).join('\n')}

DEAL BREAKERS (Don't accept):
${this.profile.dealBreakers.map(d => `- ${d}`).join('\n')}

MUST HAVES:
${this.profile.mustHaves.map(m => `- ${m}`).join('\n')}

YOUR TASK:
Represent ${this.profile.firstName} professionally. Be ${personality}. Protect their interests while building a positive relationship with the employer.

Respond with:
1. Your suggested response (what to say to the employer)
2. Internal analysis (for the candidate's eyes only)
3. Recommended next actions

${this.profile.faithEnabled ? `
FAITH FOUNDATION:
Incorporate wisdom and encouragement. "Whatever you do, work at it with all your heart, as working for the Lord." - Colossians 3:23
` : ''}`;
  }

  private formatConversationHistory(context: ConversationContext): Array<{ role: 'user' | 'assistant'; content: string }> {
    return context.messages.slice(-10).map(msg => ({
      role: msg.role === 'employer' ? 'user' as const : 'assistant' as const,
      content: `[${msg.role}]: ${msg.content}`,
    }));
  }

  private parseAgentResponse(response: string, context: ConversationContext): AgentResponse {
    // Try to parse structured response
    const suggestedMatch = response.match(/SUGGESTED RESPONSE:?\s*([\s\S]*?)(?=INTERNAL ANALYSIS|ANALYSIS|RECOMMENDED|$)/i);
    const analysisMatch = response.match(/(?:INTERNAL )?ANALYSIS:?\s*([\s\S]*?)(?=RECOMMENDED|ACTIONS|$)/i);
    const actionsMatch = response.match(/(?:RECOMMENDED )?(?:ACTIONS|NEXT STEPS):?\s*([\s\S]*?)$/i);

    const suggestedResponse = suggestedMatch?.[1]?.trim() || response;
    const internalAnalysis = analysisMatch?.[1]?.trim() || 'Response generated based on profile and context';

    let recommendedActions: string[] = [];
    if (actionsMatch) {
      recommendedActions = actionsMatch[1]
        .split(/\n|•|-/)
        .map(a => a.trim())
        .filter(a => a.length > 5);
    }

    // Add faith encouragement if enabled
    let faithEncouragement: string | undefined;
    let emotionalSupport: string | undefined;

    if (this.profile.faithEnabled) {
      if (context.stage === 'negotiation') {
        faithEncouragement = getFaithEncouragement('negotiation');
      } else if (context.stage === 'interview_prep') {
        faithEncouragement = getFaithEncouragement('interview');
      } else {
        faithEncouragement = getFaithEncouragement('waiting');
      }
    }

    return {
      message: suggestedResponse,
      suggestedResponse,
      internalAnalysis,
      recommendedActions,
      faithEncouragement,
      emotionalSupport,
    };
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a Job Seeker Agent from a user ID
 */
export async function createJobSeekerAgent(userId: string): Promise<JobSeekerAgent | null> {
  try {
    const result = await sql`
      SELECT * FROM job_seeker_profiles WHERE user_id = ${userId}
    `;

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    const profile: JobSeekerProfile = mapRowToProfile(row);

    return new JobSeekerAgent(profile);
  } catch (error) {
    console.error('[createJobSeekerAgent] Error:', error);
    return null;
  }
}

/**
 * Save a job seeker profile
 */
export async function saveJobSeekerProfile(profile: Partial<JobSeekerProfile> & { userId: string }): Promise<{
  success: boolean;
  message: string;
  profile?: JobSeekerProfile;
}> {
  try {
    const profileId = profile.id || `jseeker_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    await sql`
      INSERT INTO job_seeker_profiles (
        id, user_id, first_name, last_name, email, phone,
        linkedin_url, portfolio_url, headline, summary,
        years_experience, current_title, current_company,
        skills, experiences, education, certifications, achievements,
        target_roles, target_industries, desired_company_size, work_style,
        willing_to_relocate, preferred_locations,
        compensation, culture_preferences, deal_breakers, must_haves, nice_to_haves,
        agent_personality, negotiation_style, auto_apply_enabled, auto_apply_threshold,
        availability, notice_period, available_from, faith_enabled
      ) VALUES (
        ${profileId}, ${profile.userId},
        ${profile.firstName || null}, ${profile.lastName || null},
        ${profile.email || null}, ${profile.phone || null},
        ${profile.linkedinUrl || null}, ${profile.portfolioUrl || null},
        ${profile.headline || null}, ${profile.summary || null},
        ${profile.yearsExperience || 0}, ${profile.currentTitle || null}, ${profile.currentCompany || null},
        ${JSON.stringify(profile.skills || [])},
        ${JSON.stringify(profile.experiences || [])},
        ${JSON.stringify(profile.education || [])},
        ${JSON.stringify(profile.certifications || [])},
        ${profile.achievements || []},
        ${profile.targetRoles || []}, ${profile.targetIndustries || []},
        ${profile.desiredCompanySize || []}, ${profile.workStyle || 'flexible'},
        ${profile.willingToRelocate || false}, ${profile.preferredLocations || []},
        ${JSON.stringify(profile.compensation || {})},
        ${profile.culturePreferences || []}, ${profile.dealBreakers || []},
        ${profile.mustHaves || []}, ${profile.niceToHaves || []},
        ${profile.agentPersonality || 'professional'}, ${profile.negotiationStyle || 'moderate'},
        ${profile.autoApplyEnabled || false}, ${profile.autoApplyThreshold || 80},
        ${profile.availability || 'open_to_opportunities'},
        ${profile.noticePeriod || null}, ${profile.availableFrom || null},
        ${profile.faithEnabled ?? true}
      )
      ON CONFLICT (user_id) DO UPDATE SET
        first_name = COALESCE(EXCLUDED.first_name, job_seeker_profiles.first_name),
        last_name = COALESCE(EXCLUDED.last_name, job_seeker_profiles.last_name),
        email = COALESCE(EXCLUDED.email, job_seeker_profiles.email),
        phone = COALESCE(EXCLUDED.phone, job_seeker_profiles.phone),
        linkedin_url = COALESCE(EXCLUDED.linkedin_url, job_seeker_profiles.linkedin_url),
        portfolio_url = COALESCE(EXCLUDED.portfolio_url, job_seeker_profiles.portfolio_url),
        headline = COALESCE(EXCLUDED.headline, job_seeker_profiles.headline),
        summary = COALESCE(EXCLUDED.summary, job_seeker_profiles.summary),
        years_experience = COALESCE(EXCLUDED.years_experience, job_seeker_profiles.years_experience),
        current_title = COALESCE(EXCLUDED.current_title, job_seeker_profiles.current_title),
        current_company = COALESCE(EXCLUDED.current_company, job_seeker_profiles.current_company),
        skills = COALESCE(EXCLUDED.skills, job_seeker_profiles.skills),
        experiences = COALESCE(EXCLUDED.experiences, job_seeker_profiles.experiences),
        education = COALESCE(EXCLUDED.education, job_seeker_profiles.education),
        certifications = COALESCE(EXCLUDED.certifications, job_seeker_profiles.certifications),
        achievements = COALESCE(EXCLUDED.achievements, job_seeker_profiles.achievements),
        target_roles = COALESCE(EXCLUDED.target_roles, job_seeker_profiles.target_roles),
        target_industries = COALESCE(EXCLUDED.target_industries, job_seeker_profiles.target_industries),
        desired_company_size = COALESCE(EXCLUDED.desired_company_size, job_seeker_profiles.desired_company_size),
        work_style = COALESCE(EXCLUDED.work_style, job_seeker_profiles.work_style),
        willing_to_relocate = COALESCE(EXCLUDED.willing_to_relocate, job_seeker_profiles.willing_to_relocate),
        preferred_locations = COALESCE(EXCLUDED.preferred_locations, job_seeker_profiles.preferred_locations),
        compensation = COALESCE(EXCLUDED.compensation, job_seeker_profiles.compensation),
        culture_preferences = COALESCE(EXCLUDED.culture_preferences, job_seeker_profiles.culture_preferences),
        deal_breakers = COALESCE(EXCLUDED.deal_breakers, job_seeker_profiles.deal_breakers),
        must_haves = COALESCE(EXCLUDED.must_haves, job_seeker_profiles.must_haves),
        nice_to_haves = COALESCE(EXCLUDED.nice_to_haves, job_seeker_profiles.nice_to_haves),
        agent_personality = COALESCE(EXCLUDED.agent_personality, job_seeker_profiles.agent_personality),
        negotiation_style = COALESCE(EXCLUDED.negotiation_style, job_seeker_profiles.negotiation_style),
        auto_apply_enabled = COALESCE(EXCLUDED.auto_apply_enabled, job_seeker_profiles.auto_apply_enabled),
        auto_apply_threshold = COALESCE(EXCLUDED.auto_apply_threshold, job_seeker_profiles.auto_apply_threshold),
        availability = COALESCE(EXCLUDED.availability, job_seeker_profiles.availability),
        notice_period = COALESCE(EXCLUDED.notice_period, job_seeker_profiles.notice_period),
        available_from = COALESCE(EXCLUDED.available_from, job_seeker_profiles.available_from),
        faith_enabled = COALESCE(EXCLUDED.faith_enabled, job_seeker_profiles.faith_enabled),
        updated_at = NOW()
    `;

    return {
      success: true,
      message: `Got it! I've saved your profile. Ready to represent you in your job search. ${profile.faithEnabled !== false ? getFaithEncouragement('waiting') : ''}`,
    };
  } catch (error) {
    console.error('[saveJobSeekerProfile] Error:', error);
    return {
      success: false,
      message: 'I had trouble saving your profile. Let me try again.',
    };
  }
}

/**
 * Map database row to profile
 */
function mapRowToProfile(row: Record<string, unknown>): JobSeekerProfile {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    firstName: row.first_name as string,
    lastName: row.last_name as string,
    email: row.email as string,
    phone: row.phone as string,
    linkedinUrl: row.linkedin_url as string,
    portfolioUrl: row.portfolio_url as string,
    headline: row.headline as string,
    summary: row.summary as string,
    yearsExperience: (row.years_experience as number) || 0,
    currentTitle: row.current_title as string,
    currentCompany: row.current_company as string,
    skills: (row.skills as SkillProfile[]) || [],
    experiences: (row.experiences as WorkExperience[]) || [],
    education: (row.education as Education[]) || [],
    certifications: (row.certifications as Certification[]) || [],
    achievements: (row.achievements as string[]) || [],
    targetRoles: (row.target_roles as string[]) || [],
    targetIndustries: (row.target_industries as string[]) || [],
    desiredCompanySize: (row.desired_company_size as JobSeekerProfile['desiredCompanySize']) || [],
    workStyle: (row.work_style as JobSeekerProfile['workStyle']) || 'flexible',
    willingToRelocate: (row.willing_to_relocate as boolean) || false,
    preferredLocations: (row.preferred_locations as string[]) || [],
    compensation: (row.compensation as CompensationExpectations) || {
      minimumBase: 0,
      targetBase: 0,
      idealBase: 0,
      mustHaveBonus: false,
      mustHaveEquity: false,
      signingBonusExpected: false,
      benefitsPriority: [],
      totalCompFocus: true,
    },
    culturePreferences: (row.culture_preferences as string[]) || [],
    dealBreakers: (row.deal_breakers as string[]) || [],
    mustHaves: (row.must_haves as string[]) || [],
    niceToHaves: (row.nice_to_haves as string[]) || [],
    agentPersonality: (row.agent_personality as JobSeekerProfile['agentPersonality']) || 'professional',
    negotiationStyle: (row.negotiation_style as JobSeekerProfile['negotiationStyle']) || 'moderate',
    autoApplyEnabled: (row.auto_apply_enabled as boolean) || false,
    autoApplyThreshold: (row.auto_apply_threshold as number) || 80,
    availability: (row.availability as JobSeekerProfile['availability']) || 'open_to_opportunities',
    noticePeriod: row.notice_period as number,
    availableFrom: row.available_from ? new Date(row.available_from as string) : undefined,
    faithEnabled: (row.faith_enabled as boolean) ?? true,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  JobSeekerAgent,
  FAITH_ENCOURAGEMENTS,
  getFaithEncouragement,
};

export default JobSeekerAgent;
