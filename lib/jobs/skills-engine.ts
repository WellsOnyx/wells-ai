/**
 * Skills Analysis Engine - Deep Understanding of Candidate Capabilities
 *
 * Comprehensive skills analysis system that:
 * - Parses resumes and extracts skills
 * - Identifies transferable skills across industries
 * - Performs gap analysis against target roles
 * - Recommends learning paths to fill gaps
 * - Estimates market value of skill combinations
 *
 * "Whatever you do, work at it with all your heart" - Colossians 3:23
 */

import Anthropic from '@anthropic-ai/sdk';
import { sqlQuery as sql } from '@/lib/db';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// ============================================================================
// TYPES
// ============================================================================

export interface Skill {
  name: string;
  normalizedName: string; // Standardized name for matching
  category: SkillCategory;
  level: SkillLevel;
  yearsUsed: number;
  lastUsed?: Date;
  proficiencyScore: number; // 0-100
  endorsements?: number;
  projects?: string[];
  certifications?: string[];
  marketDemand?: 'high' | 'medium' | 'low' | 'emerging' | 'declining';
  avgSalaryImpact?: number; // $ impact on annual salary
}

export type SkillCategory =
  | 'programming_language'
  | 'framework'
  | 'database'
  | 'cloud_platform'
  | 'devops'
  | 'data_science'
  | 'ai_ml'
  | 'design'
  | 'project_management'
  | 'leadership'
  | 'communication'
  | 'domain_expertise'
  | 'soft_skill'
  | 'tool'
  | 'methodology'
  | 'other';

export type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert' | 'thought_leader';

export interface SkillsProfile {
  userId: string;
  skills: Skill[];
  primaryDomain: string;
  secondaryDomains: string[];
  overallLevel: 'junior' | 'mid' | 'senior' | 'staff' | 'principal' | 'executive';
  uniqueStrengths: string[];
  skillGaps: SkillGap[];
  learningVelocity?: 'fast' | 'average' | 'methodical';
  lastUpdated: Date;
}

export interface SkillGap {
  skill: string;
  currentLevel: SkillLevel | 'none';
  requiredLevel: SkillLevel;
  importance: 'critical' | 'important' | 'nice_to_have';
  timeToAcquire: string; // e.g., "3-6 months"
  learningResources: LearningResource[];
  alternativeSkills?: string[]; // Skills that could substitute
}

export interface LearningResource {
  name: string;
  type: 'course' | 'book' | 'project' | 'certification' | 'mentorship' | 'tutorial';
  provider?: string;
  url?: string;
  duration?: string;
  cost?: string;
  rating?: number;
  relevanceScore: number;
}

export interface TransferableSkill {
  skill: string;
  currentContext: string; // Where they used it
  targetContext: string; // Where it applies
  transferStrength: 'direct' | 'strong' | 'moderate' | 'weak';
  narrativeExample: string; // How to present this
}

export interface SkillMarketValue {
  skill: string;
  category: SkillCategory;
  demandScore: number; // 0-100
  growthRate: number; // % annual growth
  salaryPremium: number; // % above baseline
  topPayingIndustries: string[];
  topPayingLocations: string[];
  complementarySkills: string[];
  rolesThatValue: string[];
  supplyLevel: 'scarce' | 'balanced' | 'abundant';
}

export interface ResumeParseResult {
  skills: Skill[];
  experiences: {
    title: string;
    company: string;
    duration: string;
    skills: string[];
    achievements: string[];
  }[];
  education: {
    degree: string;
    field: string;
    institution: string;
    year?: number;
  }[];
  certifications: string[];
  summary: string;
  totalYearsExperience: number;
  suggestedLevel: SkillsProfile['overallLevel'];
  primaryDomain: string;
}

// ============================================================================
// SKILL TAXONOMY
// ============================================================================

const SKILL_TAXONOMY: Record<string, { category: SkillCategory; aliases: string[]; marketDemand: Skill['marketDemand']; avgSalaryImpact: number }> = {
  // Programming Languages
  'python': { category: 'programming_language', aliases: ['python3', 'py'], marketDemand: 'high', avgSalaryImpact: 12000 },
  'javascript': { category: 'programming_language', aliases: ['js', 'ecmascript', 'es6', 'es2020'], marketDemand: 'high', avgSalaryImpact: 10000 },
  'typescript': { category: 'programming_language', aliases: ['ts'], marketDemand: 'high', avgSalaryImpact: 15000 },
  'java': { category: 'programming_language', aliases: ['jdk', 'j2ee'], marketDemand: 'high', avgSalaryImpact: 12000 },
  'go': { category: 'programming_language', aliases: ['golang'], marketDemand: 'high', avgSalaryImpact: 18000 },
  'rust': { category: 'programming_language', aliases: [], marketDemand: 'emerging', avgSalaryImpact: 22000 },
  'c++': { category: 'programming_language', aliases: ['cpp', 'c plus plus'], marketDemand: 'medium', avgSalaryImpact: 15000 },
  'c#': { category: 'programming_language', aliases: ['csharp', 'c sharp', '.net'], marketDemand: 'medium', avgSalaryImpact: 10000 },
  'ruby': { category: 'programming_language', aliases: ['rails', 'ruby on rails'], marketDemand: 'low', avgSalaryImpact: 5000 },
  'php': { category: 'programming_language', aliases: ['laravel'], marketDemand: 'low', avgSalaryImpact: 3000 },
  'swift': { category: 'programming_language', aliases: ['swiftui'], marketDemand: 'medium', avgSalaryImpact: 12000 },
  'kotlin': { category: 'programming_language', aliases: [], marketDemand: 'medium', avgSalaryImpact: 10000 },
  'sql': { category: 'programming_language', aliases: ['mysql', 'postgresql', 'mssql', 'tsql'], marketDemand: 'high', avgSalaryImpact: 8000 },

  // Frameworks
  'react': { category: 'framework', aliases: ['reactjs', 'react.js', 'react native'], marketDemand: 'high', avgSalaryImpact: 12000 },
  'next.js': { category: 'framework', aliases: ['nextjs', 'next'], marketDemand: 'high', avgSalaryImpact: 15000 },
  'vue': { category: 'framework', aliases: ['vuejs', 'vue.js', 'nuxt'], marketDemand: 'medium', avgSalaryImpact: 8000 },
  'angular': { category: 'framework', aliases: ['angularjs'], marketDemand: 'medium', avgSalaryImpact: 8000 },
  'node.js': { category: 'framework', aliases: ['nodejs', 'node', 'express', 'expressjs'], marketDemand: 'high', avgSalaryImpact: 10000 },
  'django': { category: 'framework', aliases: ['django rest framework', 'drf'], marketDemand: 'medium', avgSalaryImpact: 8000 },
  'spring': { category: 'framework', aliases: ['spring boot', 'springboot'], marketDemand: 'medium', avgSalaryImpact: 10000 },
  'flask': { category: 'framework', aliases: [], marketDemand: 'medium', avgSalaryImpact: 5000 },
  'fastapi': { category: 'framework', aliases: ['fast api'], marketDemand: 'high', avgSalaryImpact: 10000 },

  // Cloud & DevOps
  'aws': { category: 'cloud_platform', aliases: ['amazon web services', 'ec2', 's3', 'lambda'], marketDemand: 'high', avgSalaryImpact: 20000 },
  'gcp': { category: 'cloud_platform', aliases: ['google cloud', 'google cloud platform', 'bigquery'], marketDemand: 'high', avgSalaryImpact: 18000 },
  'azure': { category: 'cloud_platform', aliases: ['microsoft azure'], marketDemand: 'high', avgSalaryImpact: 15000 },
  'kubernetes': { category: 'devops', aliases: ['k8s', 'k8', 'kubectl'], marketDemand: 'high', avgSalaryImpact: 22000 },
  'docker': { category: 'devops', aliases: ['containers', 'containerization'], marketDemand: 'high', avgSalaryImpact: 12000 },
  'terraform': { category: 'devops', aliases: ['iac', 'infrastructure as code'], marketDemand: 'high', avgSalaryImpact: 15000 },
  'ci/cd': { category: 'devops', aliases: ['jenkins', 'github actions', 'gitlab ci', 'circleci'], marketDemand: 'high', avgSalaryImpact: 10000 },

  // AI/ML
  'machine learning': { category: 'ai_ml', aliases: ['ml', 'deep learning', 'neural networks'], marketDemand: 'high', avgSalaryImpact: 30000 },
  'tensorflow': { category: 'ai_ml', aliases: ['tf'], marketDemand: 'high', avgSalaryImpact: 20000 },
  'pytorch': { category: 'ai_ml', aliases: ['torch'], marketDemand: 'high', avgSalaryImpact: 22000 },
  'llm': { category: 'ai_ml', aliases: ['large language models', 'gpt', 'generative ai', 'genai'], marketDemand: 'emerging', avgSalaryImpact: 40000 },
  'nlp': { category: 'ai_ml', aliases: ['natural language processing'], marketDemand: 'high', avgSalaryImpact: 25000 },
  'computer vision': { category: 'ai_ml', aliases: ['cv', 'image recognition', 'opencv'], marketDemand: 'high', avgSalaryImpact: 25000 },

  // Data
  'data engineering': { category: 'data_science', aliases: ['etl', 'data pipelines', 'airflow'], marketDemand: 'high', avgSalaryImpact: 18000 },
  'data science': { category: 'data_science', aliases: ['data analysis', 'statistics'], marketDemand: 'high', avgSalaryImpact: 20000 },
  'spark': { category: 'data_science', aliases: ['apache spark', 'pyspark'], marketDemand: 'high', avgSalaryImpact: 18000 },
  'kafka': { category: 'data_science', aliases: ['apache kafka', 'streaming'], marketDemand: 'high', avgSalaryImpact: 15000 },

  // Databases
  'postgresql': { category: 'database', aliases: ['postgres', 'psql'], marketDemand: 'high', avgSalaryImpact: 8000 },
  'mongodb': { category: 'database', aliases: ['mongo', 'nosql'], marketDemand: 'medium', avgSalaryImpact: 6000 },
  'redis': { category: 'database', aliases: ['cache', 'in-memory'], marketDemand: 'high', avgSalaryImpact: 8000 },
  'elasticsearch': { category: 'database', aliases: ['elastic', 'search'], marketDemand: 'medium', avgSalaryImpact: 10000 },

  // Leadership & Soft Skills
  'team leadership': { category: 'leadership', aliases: ['team lead', 'tech lead', 'engineering manager'], marketDemand: 'high', avgSalaryImpact: 25000 },
  'project management': { category: 'project_management', aliases: ['pm', 'program management', 'scrum master'], marketDemand: 'high', avgSalaryImpact: 15000 },
  'agile': { category: 'methodology', aliases: ['scrum', 'kanban', 'sprint planning'], marketDemand: 'high', avgSalaryImpact: 5000 },
  'communication': { category: 'soft_skill', aliases: ['presentation', 'public speaking', 'stakeholder management'], marketDemand: 'high', avgSalaryImpact: 10000 },
  'mentoring': { category: 'leadership', aliases: ['coaching', 'developing talent'], marketDemand: 'medium', avgSalaryImpact: 8000 },

  // Design
  'system design': { category: 'design', aliases: ['architecture', 'software architecture', 'distributed systems'], marketDemand: 'high', avgSalaryImpact: 30000 },
  'ui/ux': { category: 'design', aliases: ['user experience', 'user interface', 'figma', 'sketch'], marketDemand: 'high', avgSalaryImpact: 12000 },
  'api design': { category: 'design', aliases: ['rest', 'graphql', 'grpc'], marketDemand: 'high', avgSalaryImpact: 10000 },
};

// ============================================================================
// SKILLS ENGINE CLASS
// ============================================================================

export class SkillsEngine {
  private anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || '',
    });
  }

  // ==========================================================================
  // RESUME PARSING
  // ==========================================================================

  /**
   * Parse a resume and extract skills
   */
  async parseResume(resumeText: string): Promise<ResumeParseResult> {
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250514',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: `Parse this resume and extract structured information. Be thorough and accurate.

RESUME:
${resumeText}

Return JSON with this structure:
{
  "skills": [
    { "name": "skill name", "level": "beginner/intermediate/advanced/expert", "yearsUsed": number }
  ],
  "experiences": [
    {
      "title": "job title",
      "company": "company name",
      "duration": "e.g., Jan 2020 - Present",
      "skills": ["skills used in this role"],
      "achievements": ["key achievements/accomplishments"]
    }
  ],
  "education": [
    { "degree": "degree type", "field": "field of study", "institution": "school name", "year": graduation year }
  ],
  "certifications": ["cert 1", "cert 2"],
  "summary": "2-3 sentence summary of the candidate",
  "totalYearsExperience": number,
  "suggestedLevel": "junior/mid/senior/staff/principal/executive",
  "primaryDomain": "main area of expertise"
}

Extract ALL skills mentioned, including soft skills. Infer skill levels from context.`,
        }],
      });

      const text = response.content[0]?.type === 'text' ? response.content[0].text : '{}';
      const jsonMatch = text.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        // Enrich skills with taxonomy data
        const enrichedSkills: Skill[] = (parsed.skills || []).map((s: { name: string; level: SkillLevel; yearsUsed: number }) =>
          this.enrichSkill(s.name, s.level, s.yearsUsed)
        );

        return {
          skills: enrichedSkills,
          experiences: parsed.experiences || [],
          education: parsed.education || [],
          certifications: parsed.certifications || [],
          summary: parsed.summary || '',
          totalYearsExperience: parsed.totalYearsExperience || 0,
          suggestedLevel: parsed.suggestedLevel || 'mid',
          primaryDomain: parsed.primaryDomain || 'Software Engineering',
        };
      }
    } catch (error) {
      console.error('[SkillsEngine] Parse error:', error);
    }

    return {
      skills: [],
      experiences: [],
      education: [],
      certifications: [],
      summary: '',
      totalYearsExperience: 0,
      suggestedLevel: 'mid',
      primaryDomain: 'Unknown',
    };
  }

  /**
   * Enrich a skill with taxonomy data
   */
  private enrichSkill(name: string, level: SkillLevel, yearsUsed: number): Skill {
    const normalized = this.normalizeSkillName(name);
    const taxonomyData = SKILL_TAXONOMY[normalized];

    return {
      name,
      normalizedName: normalized,
      category: taxonomyData?.category || 'other',
      level,
      yearsUsed,
      proficiencyScore: this.calculateProficiencyScore(level, yearsUsed),
      marketDemand: taxonomyData?.marketDemand || 'medium',
      avgSalaryImpact: taxonomyData?.avgSalaryImpact || 5000,
    };
  }

  /**
   * Normalize skill names for matching
   */
  private normalizeSkillName(name: string): string {
    const lower = name.toLowerCase().trim();

    // Check taxonomy for exact match or alias
    for (const [skillName, data] of Object.entries(SKILL_TAXONOMY)) {
      if (lower === skillName || data.aliases.includes(lower)) {
        return skillName;
      }
    }

    return lower;
  }

  /**
   * Calculate proficiency score from level and years
   */
  private calculateProficiencyScore(level: SkillLevel, yearsUsed: number): number {
    const levelScores: Record<SkillLevel, number> = {
      beginner: 20,
      intermediate: 45,
      advanced: 70,
      expert: 90,
      thought_leader: 100,
    };

    const baseScore = levelScores[level] || 50;
    const experienceBonus = Math.min(yearsUsed * 2, 20);

    return Math.min(100, baseScore + experienceBonus);
  }

  // ==========================================================================
  // TRANSFERABLE SKILLS
  // ==========================================================================

  /**
   * Identify transferable skills between industries/roles
   */
  async identifyTransferableSkills(
    currentSkills: Skill[],
    currentRole: string,
    targetRole: string
  ): Promise<TransferableSkill[]> {
    const transferable: TransferableSkill[] = [];

    // Direct skill transfers
    for (const skill of currentSkills) {
      // Check if skill is universally valuable
      if (skill.category === 'soft_skill' || skill.category === 'leadership' || skill.category === 'project_management') {
        transferable.push({
          skill: skill.name,
          currentContext: `Used in ${currentRole}`,
          targetContext: `Applies directly to ${targetRole}`,
          transferStrength: 'direct',
          narrativeExample: `My experience with ${skill.name} in ${currentRole} directly translates to the needs of ${targetRole}.`,
        });
      }

      // Technical skills with high market demand transfer well
      if (skill.marketDemand === 'high' && skill.proficiencyScore >= 70) {
        transferable.push({
          skill: skill.name,
          currentContext: currentRole,
          targetContext: targetRole,
          transferStrength: 'strong',
          narrativeExample: `My ${skill.level} proficiency in ${skill.name} from ${skill.yearsUsed} years of experience is directly applicable.`,
        });
      }
    }

    // Use AI to find non-obvious transfers
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250514',
        max_tokens: 800,
        messages: [{
          role: 'user',
          content: `Identify non-obvious transferable skills for a career transition.

FROM: ${currentRole}
TO: ${targetRole}

CURRENT SKILLS:
${currentSkills.map(s => `- ${s.name} (${s.level}, ${s.yearsUsed} years)`).join('\n')}

Find 3-4 skills that might not seem directly relevant but actually transfer well.
Return JSON array:
[
  {
    "skill": "skill name",
    "currentContext": "how they used it",
    "targetContext": "how it applies to new role",
    "transferStrength": "direct/strong/moderate/weak",
    "narrativeExample": "how to present this in an interview"
  }
]`,
        }],
      });

      const text = response.content[0]?.type === 'text' ? response.content[0].text : '[]';
      const jsonMatch = text.match(/\[[\s\S]*\]/);

      if (jsonMatch) {
        const aiTransfers = JSON.parse(jsonMatch[0]);
        transferable.push(...aiTransfers);
      }
    } catch (error) {
      console.error('[SkillsEngine] Transfer analysis error:', error);
    }

    return transferable;
  }

  // ==========================================================================
  // GAP ANALYSIS
  // ==========================================================================

  /**
   * Analyze gaps between current skills and target role requirements
   */
  async analyzeGaps(
    currentSkills: Skill[],
    targetRoleRequirements: string[],
    targetRolePreferred: string[]
  ): Promise<SkillGap[]> {
    const gaps: SkillGap[] = [];
    const currentNormalized = currentSkills.map(s => s.normalizedName);

    // Check required skills
    for (const required of targetRoleRequirements) {
      const normalized = this.normalizeSkillName(required);
      const existing = currentSkills.find(s => s.normalizedName === normalized);

      if (!existing) {
        gaps.push({
          skill: required,
          currentLevel: 'none',
          requiredLevel: 'intermediate',
          importance: 'critical',
          timeToAcquire: '3-6 months',
          learningResources: await this.getLearningResources(required),
        });
      } else if (existing.level === 'beginner') {
        gaps.push({
          skill: required,
          currentLevel: existing.level,
          requiredLevel: 'intermediate',
          importance: 'important',
          timeToAcquire: '1-3 months',
          learningResources: await this.getLearningResources(required, 'intermediate'),
        });
      }
    }

    // Check preferred skills
    for (const preferred of targetRolePreferred) {
      const normalized = this.normalizeSkillName(preferred);
      const existing = currentSkills.find(s => s.normalizedName === normalized);

      if (!existing && !gaps.some(g => this.normalizeSkillName(g.skill) === normalized)) {
        gaps.push({
          skill: preferred,
          currentLevel: 'none',
          requiredLevel: 'intermediate',
          importance: 'nice_to_have',
          timeToAcquire: '2-4 months',
          learningResources: await this.getLearningResources(preferred),
        });
      }
    }

    return gaps;
  }

  /**
   * Get learning resources for a skill
   */
  private async getLearningResources(skill: string, targetLevel?: SkillLevel): Promise<LearningResource[]> {
    const resources: LearningResource[] = [];
    const normalized = this.normalizeSkillName(skill);
    const taxonomyData = SKILL_TAXONOMY[normalized];

    // Generic resources based on skill type
    if (taxonomyData?.category === 'programming_language' || taxonomyData?.category === 'framework') {
      resources.push(
        {
          name: `${skill} - Official Documentation`,
          type: 'tutorial',
          provider: 'Official',
          duration: 'Self-paced',
          cost: 'Free',
          relevanceScore: 95,
        },
        {
          name: `Build a Project with ${skill}`,
          type: 'project',
          provider: 'Self-guided',
          duration: '2-4 weeks',
          cost: 'Free',
          relevanceScore: 90,
        }
      );
    }

    if (taxonomyData?.category === 'cloud_platform') {
      resources.push({
        name: `${skill} Certification`,
        type: 'certification',
        provider: skill.includes('aws') ? 'AWS' : skill.includes('gcp') ? 'Google' : 'Microsoft',
        duration: '2-3 months',
        cost: '$300-500',
        relevanceScore: 95,
      });
    }

    if (taxonomyData?.category === 'ai_ml') {
      resources.push(
        {
          name: 'Machine Learning Specialization',
          type: 'course',
          provider: 'Coursera / Andrew Ng',
          duration: '3 months',
          cost: '$49/month',
          relevanceScore: 90,
        },
        {
          name: 'Hands-on ML Project',
          type: 'project',
          provider: 'Kaggle',
          duration: '2-4 weeks',
          cost: 'Free',
          relevanceScore: 85,
        }
      );
    }

    // Add generic resources
    resources.push(
      {
        name: `${skill} Crash Course`,
        type: 'course',
        provider: 'Udemy',
        duration: '10-20 hours',
        cost: '$15-50',
        relevanceScore: 75,
      },
      {
        name: `${skill} for Professionals`,
        type: 'book',
        provider: "O'Reilly",
        duration: '2-4 weeks',
        cost: '$30-50',
        relevanceScore: 70,
      }
    );

    return resources;
  }

  // ==========================================================================
  // MARKET VALUE ESTIMATION
  // ==========================================================================

  /**
   * Estimate the market value of a skill or skill combination
   */
  async estimateSkillMarketValue(skills: Skill[]): Promise<{
    totalValue: number;
    breakdown: Array<{ skill: string; value: number; premium: number }>;
    synergies: Array<{ skills: string[]; bonusValue: number; reason: string }>;
    marketInsights: string[];
  }> {
    let totalValue = 0;
    const breakdown: Array<{ skill: string; value: number; premium: number }> = [];

    // Calculate individual skill values
    for (const skill of skills) {
      const taxonomyData = SKILL_TAXONOMY[skill.normalizedName];
      let baseValue = taxonomyData?.avgSalaryImpact || 5000;

      // Adjust for proficiency
      const proficiencyMultiplier = skill.proficiencyScore / 100;
      const adjustedValue = Math.round(baseValue * proficiencyMultiplier);

      totalValue += adjustedValue;
      breakdown.push({
        skill: skill.name,
        value: adjustedValue,
        premium: Math.round((adjustedValue / 150000) * 100), // % of typical tech salary
      });
    }

    // Identify synergies
    const synergies: Array<{ skills: string[]; bonusValue: number; reason: string }> = [];

    const skillNames = skills.map(s => s.normalizedName);

    // Full-stack synergy
    const frontendSkills = ['react', 'vue', 'angular', 'next.js', 'javascript', 'typescript'];
    const backendSkills = ['node.js', 'python', 'java', 'go', 'django', 'fastapi', 'spring'];
    const hasFrontend = frontendSkills.some(s => skillNames.includes(s));
    const hasBackend = backendSkills.some(s => skillNames.includes(s));

    if (hasFrontend && hasBackend) {
      synergies.push({
        skills: ['Frontend', 'Backend'],
        bonusValue: 15000,
        reason: 'Full-stack capability commands premium',
      });
      totalValue += 15000;
    }

    // DevOps + Cloud synergy
    const hasCloud = ['aws', 'gcp', 'azure'].some(s => skillNames.includes(s));
    const hasDevOps = ['kubernetes', 'docker', 'terraform', 'ci/cd'].some(s => skillNames.includes(s));

    if (hasCloud && hasDevOps) {
      synergies.push({
        skills: ['Cloud', 'DevOps'],
        bonusValue: 20000,
        reason: 'Cloud + DevOps is highly sought after',
      });
      totalValue += 20000;
    }

    // AI/ML + Engineering synergy
    const hasML = ['machine learning', 'tensorflow', 'pytorch', 'llm', 'nlp'].some(s => skillNames.includes(s));
    const hasEngineering = ['python', 'system design', 'data engineering'].some(s => skillNames.includes(s));

    if (hasML && hasEngineering) {
      synergies.push({
        skills: ['AI/ML', 'Engineering'],
        bonusValue: 30000,
        reason: 'ML Engineers are in extremely high demand',
      });
      totalValue += 30000;
    }

    // Generate market insights
    const marketInsights: string[] = [];

    const emergingSkills = skills.filter(s => s.marketDemand === 'emerging');
    if (emergingSkills.length > 0) {
      marketInsights.push(`Your emerging skills (${emergingSkills.map(s => s.name).join(', ')}) position you for future opportunities`);
    }

    const highDemandSkills = skills.filter(s => s.marketDemand === 'high' && s.proficiencyScore >= 70);
    if (highDemandSkills.length >= 3) {
      marketInsights.push(`Strong foundation in ${highDemandSkills.length} high-demand skills gives you significant leverage`);
    }

    const decliningSkills = skills.filter(s => s.marketDemand === 'declining');
    if (decliningSkills.length > 0) {
      marketInsights.push(`Consider upskilling beyond ${decliningSkills.map(s => s.name).join(', ')} as demand is declining`);
    }

    return {
      totalValue,
      breakdown,
      synergies,
      marketInsights,
    };
  }

  /**
   * Get market data for a specific skill
   */
  async getSkillMarketData(skillName: string): Promise<SkillMarketValue> {
    const normalized = this.normalizeSkillName(skillName);
    const taxonomyData = SKILL_TAXONOMY[normalized];

    // Calculate demand score
    const demandMap: Record<Skill['marketDemand'] & string, number> = {
      emerging: 95,
      high: 85,
      medium: 60,
      low: 35,
      declining: 20,
    };

    const demandScore = taxonomyData?.marketDemand ? demandMap[taxonomyData.marketDemand] || 50 : 50;
    const salaryPremium = taxonomyData?.avgSalaryImpact ? (taxonomyData.avgSalaryImpact / 150000) * 100 : 5;

    // Complementary skills
    const complementary: Record<string, string[]> = {
      python: ['machine learning', 'data science', 'django', 'fastapi'],
      react: ['typescript', 'next.js', 'node.js', 'graphql'],
      aws: ['terraform', 'kubernetes', 'docker', 'ci/cd'],
      kubernetes: ['docker', 'terraform', 'go', 'aws'],
      'machine learning': ['python', 'tensorflow', 'pytorch', 'data science'],
    };

    return {
      skill: skillName,
      category: taxonomyData?.category || 'other',
      demandScore,
      growthRate: taxonomyData?.marketDemand === 'emerging' ? 25 : taxonomyData?.marketDemand === 'high' ? 10 : 5,
      salaryPremium: Math.round(salaryPremium),
      topPayingIndustries: ['Technology', 'Finance', 'Healthcare Tech'],
      topPayingLocations: ['San Francisco', 'New York', 'Seattle', 'Remote'],
      complementarySkills: complementary[normalized] || [],
      rolesThatValue: this.getRolesThatValueSkill(normalized),
      supplyLevel: demandScore > 80 ? 'scarce' : demandScore > 50 ? 'balanced' : 'abundant',
    };
  }

  private getRolesThatValueSkill(skill: string): string[] {
    const roleMap: Record<string, string[]> = {
      python: ['Software Engineer', 'Data Scientist', 'ML Engineer', 'Backend Developer'],
      react: ['Frontend Developer', 'Full-Stack Engineer', 'UI Developer'],
      aws: ['Cloud Engineer', 'DevOps Engineer', 'Solutions Architect', 'SRE'],
      kubernetes: ['Platform Engineer', 'DevOps Engineer', 'SRE', 'Cloud Architect'],
      'machine learning': ['ML Engineer', 'Data Scientist', 'AI Researcher', 'Applied Scientist'],
      'system design': ['Staff Engineer', 'Principal Engineer', 'Architect', 'Tech Lead'],
      'team leadership': ['Engineering Manager', 'Tech Lead', 'Director of Engineering', 'VP of Engineering'],
    };

    return roleMap[skill] || ['Software Engineer', 'Technical Lead'];
  }

  // ==========================================================================
  // SKILLS PROFILE MANAGEMENT
  // ==========================================================================

  /**
   * Build a complete skills profile
   */
  async buildSkillsProfile(
    userId: string,
    skills: Skill[],
    experiences: ResumeParseResult['experiences']
  ): Promise<SkillsProfile> {
    // Determine primary domain
    const categoryCount: Record<string, number> = {};
    for (const skill of skills) {
      categoryCount[skill.category] = (categoryCount[skill.category] || 0) + skill.proficiencyScore;
    }

    const sortedCategories = Object.entries(categoryCount)
      .sort((a, b) => b[1] - a[1])
      .map(([cat]) => cat);

    const primaryDomain = this.categoryToDomain(sortedCategories[0] || 'other');
    const secondaryDomains = sortedCategories.slice(1, 4).map(c => this.categoryToDomain(c));

    // Determine overall level from experience
    const totalYears = Math.max(...experiences.map(e => {
      const duration = e.duration.toLowerCase();
      const years = parseInt(duration.match(/(\d+)\s*year/)?.[1] || '0');
      return years;
    }), skills.reduce((max, s) => Math.max(max, s.yearsUsed), 0));

    let overallLevel: SkillsProfile['overallLevel'];
    if (totalYears >= 15) overallLevel = 'executive';
    else if (totalYears >= 10) overallLevel = 'principal';
    else if (totalYears >= 7) overallLevel = 'staff';
    else if (totalYears >= 4) overallLevel = 'senior';
    else if (totalYears >= 2) overallLevel = 'mid';
    else overallLevel = 'junior';

    // Find unique strengths
    const uniqueStrengths = skills
      .filter(s => s.proficiencyScore >= 80 && (s.marketDemand === 'high' || s.marketDemand === 'emerging'))
      .slice(0, 5)
      .map(s => `${s.name} (${s.level})`);

    return {
      userId,
      skills,
      primaryDomain,
      secondaryDomains,
      overallLevel,
      uniqueStrengths,
      skillGaps: [], // Populated when compared to target role
      lastUpdated: new Date(),
    };
  }

  private categoryToDomain(category: string): string {
    const map: Record<string, string> = {
      programming_language: 'Software Development',
      framework: 'Software Development',
      database: 'Data Engineering',
      cloud_platform: 'Cloud/DevOps',
      devops: 'Cloud/DevOps',
      data_science: 'Data Science',
      ai_ml: 'AI/Machine Learning',
      design: 'Engineering',
      project_management: 'Management',
      leadership: 'Leadership',
      communication: 'Business',
      domain_expertise: 'Domain Expert',
      soft_skill: 'Professional Skills',
      tool: 'Technical',
      methodology: 'Process',
      other: 'General',
    };

    return map[category] || 'General';
  }

  /**
   * Save skills profile to database
   */
  async saveSkillsProfile(profile: SkillsProfile): Promise<{ success: boolean; message: string }> {
    try {
      await sql`
        INSERT INTO skills_profiles (
          user_id, skills, primary_domain, secondary_domains,
          overall_level, unique_strengths, skill_gaps, learning_velocity, updated_at
        ) VALUES (
          ${profile.userId},
          ${JSON.stringify(profile.skills)},
          ${profile.primaryDomain},
          ${profile.secondaryDomains},
          ${profile.overallLevel},
          ${profile.uniqueStrengths},
          ${JSON.stringify(profile.skillGaps)},
          ${profile.learningVelocity || 'average'},
          NOW()
        )
        ON CONFLICT (user_id) DO UPDATE SET
          skills = EXCLUDED.skills,
          primary_domain = EXCLUDED.primary_domain,
          secondary_domains = EXCLUDED.secondary_domains,
          overall_level = EXCLUDED.overall_level,
          unique_strengths = EXCLUDED.unique_strengths,
          skill_gaps = EXCLUDED.skill_gaps,
          learning_velocity = EXCLUDED.learning_velocity,
          updated_at = NOW()
      `;

      return { success: true, message: 'Skills profile saved successfully.' };
    } catch (error) {
      console.error('[SkillsEngine] Save error:', error);
      return { success: false, message: 'Failed to save skills profile.' };
    }
  }
}

// ============================================================================
// FACTORY & EXPORTS
// ============================================================================

let skillsEngineInstance: SkillsEngine | null = null;

export function getSkillsEngine(): SkillsEngine {
  if (!skillsEngineInstance) {
    skillsEngineInstance = new SkillsEngine();
  }
  return skillsEngineInstance;
}

export { SkillsEngine, SKILL_TAXONOMY };
export default SkillsEngine;
