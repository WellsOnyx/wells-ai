/**
 * AI-Powered Resume Parser
 *
 * Uses Claude to extract structured data from resumes
 */

export interface ParsedResume {
  name?: string
  email?: string
  phone?: string
  currentRole?: string
  desiredRole?: string
  skills: string[]
  experience: string
  education?: string
  achievements?: string[]
  suggestions: string[]
  atsScore: number
}

/**
 * Parse resume text using Claude
 */
export async function parseResume(resumeText: string): Promise<ParsedResume> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured')
  }

  const systemPrompt = `You are an expert resume parser and career coach. Analyze the resume and extract structured information.

Your response must be valid JSON with this exact structure:
{
  "name": "string or null",
  "email": "string or null",
  "phone": "string or null",
  "currentRole": "string or null (most recent job title)",
  "skills": ["array", "of", "skills"],
  "experience": "string (summary of work history)",
  "education": "string or null (degrees, institutions)",
  "achievements": ["array", "of", "key", "accomplishments"],
  "suggestions": ["array", "of", "improvement", "suggestions"],
  "atsScore": number (0-100, how well optimized for ATS systems)
}

For ATS score, consider:
- Clear section headings
- Standard formatting
- Keyword density
- Measurable achievements
- No tables, images, or complex formatting`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: `Parse this resume and return JSON:\n\n${resumeText}`
          }
        ],
        system: systemPrompt
      })
    })

    if (!response.ok) {
      throw new Error('Failed to parse resume with Claude')
    }

    const data = await response.json()
    const assistantMessage = data.content?.[0]?.text

    if (!assistantMessage) {
      throw new Error('No response from Claude')
    }

    // Extract JSON from response (handle markdown code blocks)
    let jsonText = assistantMessage
    const jsonMatch = assistantMessage.match(/```json\n([\s\S]*?)\n```/) ||
                      assistantMessage.match(/```\n([\s\S]*?)\n```/)
    if (jsonMatch) {
      jsonText = jsonMatch[1]
    }

    const parsed = JSON.parse(jsonText)

    return {
      name: parsed.name || undefined,
      email: parsed.email || undefined,
      phone: parsed.phone || undefined,
      currentRole: parsed.currentRole || undefined,
      desiredRole: parsed.desiredRole || undefined,
      skills: Array.isArray(parsed.skills) ? parsed.skills : [],
      experience: parsed.experience || '',
      education: parsed.education || undefined,
      achievements: Array.isArray(parsed.achievements) ? parsed.achievements : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      atsScore: typeof parsed.atsScore === 'number' ? parsed.atsScore : 50
    }
  } catch (error) {
    console.error('Resume parsing error:', error)
    throw new Error('Failed to parse resume')
  }
}

/**
 * Generate AI-powered cover letter
 */
export async function generateCoverLetter(
  jobSeekerProfile: {
    name: string
    currentRole: string
    experience: string
    skills: string[]
  },
  rfq: {
    company: string
    productName: string
    specifications: string
    contactName?: string
  }
): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured')
  }

  const systemPrompt = `You are an expert career coach writing personalized cover letters.

Write a professional, compelling cover letter that:
- Is concise (250-350 words)
- Highlights relevant experience and skills
- Shows enthusiasm for the specific role
- Demonstrates understanding of the company's needs
- Uses professional but warm tone
- Includes specific examples of achievements
- Ends with a clear call to action

Do not include address blocks or date - just the letter body starting with the greeting.`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: `Write a cover letter for this opportunity:

JOB SEEKER PROFILE:
Name: ${jobSeekerProfile.name}
Current Role: ${jobSeekerProfile.currentRole}
Skills: ${jobSeekerProfile.skills.join(', ')}
Experience Summary: ${jobSeekerProfile.experience}

JOB OPPORTUNITY:
Company: ${rfq.company}
Position: ${rfq.productName}
Requirements: ${rfq.specifications}
${rfq.contactName ? `Hiring Manager: ${rfq.contactName}` : ''}

Write the cover letter now:`
          }
        ],
        system: systemPrompt
      })
    })

    if (!response.ok) {
      throw new Error('Failed to generate cover letter with Claude')
    }

    const data = await response.json()
    const coverLetter = data.content?.[0]?.text

    if (!coverLetter) {
      throw new Error('No cover letter generated')
    }

    return coverLetter
  } catch (error) {
    console.error('Cover letter generation error:', error)
    throw new Error('Failed to generate cover letter')
  }
}

/**
 * Optimize resume for ATS
 */
export async function optimizeResumeForATS(resumeText: string): Promise<{
  optimizedResume: string
  improvements: string[]
  atsScore: number
}> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured')
  }

  const systemPrompt = `You are an ATS (Applicant Tracking System) optimization expert.

Analyze the resume and provide:
1. An optimized version with better formatting and keywords
2. Specific improvements made
3. An ATS compatibility score (0-100)

Return JSON:
{
  "optimizedResume": "string (the optimized resume text)",
  "improvements": ["array", "of", "specific", "improvements"],
  "atsScore": number
}`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: `Optimize this resume for ATS and return JSON:\n\n${resumeText}`
          }
        ],
        system: systemPrompt
      })
    })

    if (!response.ok) {
      throw new Error('Failed to optimize resume')
    }

    const data = await response.json()
    const assistantMessage = data.content?.[0]?.text

    if (!assistantMessage) {
      throw new Error('No response from Claude')
    }

    // Extract JSON from response
    let jsonText = assistantMessage
    const jsonMatch = assistantMessage.match(/```json\n([\s\S]*?)\n```/) ||
                      assistantMessage.match(/```\n([\s\S]*?)\n```/)
    if (jsonMatch) {
      jsonText = jsonMatch[1]
    }

    const parsed = JSON.parse(jsonText)

    return {
      optimizedResume: parsed.optimizedResume || resumeText,
      improvements: Array.isArray(parsed.improvements) ? parsed.improvements : [],
      atsScore: typeof parsed.atsScore === 'number' ? parsed.atsScore : 50
    }
  } catch (error) {
    console.error('Resume optimization error:', error)
    throw new Error('Failed to optimize resume')
  }
}
