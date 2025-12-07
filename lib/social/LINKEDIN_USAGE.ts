// @ts-nocheck
/**
 * WELLS AI LINKEDIN INFRASTRUCTURE - USAGE GUIDE
 *
 * Quick reference for using the LinkedIn API and content generation
 */

/**
 * =============================================================================
 * SETUP INSTRUCTIONS
 * =============================================================================
 *
 * 1. Get LinkedIn API Credentials:
 *    - Go to https://www.linkedin.com/developers/apps
 *    - Create a new app or use existing
 *    - Request access to "Share on LinkedIn" and "Sign In with LinkedIn"
 *    - Get your access token
 *
 * 2. Set Environment Variables (.env.local):
 *    LINKEDIN_ACCESS_TOKEN=your_access_token_here
 *    LINKEDIN_PERSON_URN=urn:li:person:YOUR_ID
 *    ANTHROPIC_API_KEY=your_claude_api_key_here
 *
 * 3. LinkedIn Profile Setup:
 *    - Create profile at linkedin.com/in/wellsai
 *    - Use the profile content from LINKEDIN_PROFILE in lib/social/linkedin.ts
 *
 * =============================================================================
 * QUICK START EXAMPLES
 * =============================================================================
 */

// Example 1: Generate a LinkedIn post
import { generateLinkedInPost } from './linkedin'

async function example1_GeneratePost() {
  const post = await generateLinkedInPost('ai_commerce')
  console.log(post.content)
  console.log(`Theme: ${post.theme}`)
  console.log(`Hashtags: ${post.hashtags.join(', ')}`)
}

// Example 2: Post to LinkedIn via API
async function example2_PostToLinkedIn() {
  const response = await fetch('/api/social/linkedin/post', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: 'Your post content here...',
      visibility: 'PUBLIC',
      hashtags: ['B2BCommerce', 'AI'],
      dryRun: false // Set to true to preview without posting
    })
  })

  const result = await response.json()
  console.log(result)
}

// Example 3: Use a sample post
import { SAMPLE_LINKEDIN_POSTS, formatSamplePost } from './sample-linkedin-posts'

async function example3_UseSamplePost() {
  const samplePost = SAMPLE_LINKEDIN_POSTS[0]
  const formatted = formatSamplePost(samplePost)

  const response = await fetch('/api/social/linkedin/post', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: formatted.content,
      hashtags: formatted.hashtags,
      theme: formatted.theme
    })
  })
}

// Example 4: Generate a response to a comment
import { generateLinkedInResponse } from './linkedin'

async function example4_RespondToComment() {
  const response = await generateLinkedInResponse(
    "This is interesting! How does Wells handle supplier verification?",
    {
      name: "John Smith",
      company: "Acme Corp",
      title: "Procurement Director"
    },
    "Comment on post about AI in procurement"
  )

  console.log(response)
}

// Example 5: Generate outreach message
import { generateLinkedInOutreach } from './linkedin'

async function example5_GenerateOutreach() {
  const message = await generateLinkedInOutreach({
    name: "Sarah Johnson",
    company: "TechCorp",
    title: "VP of Operations",
    industry: "Manufacturing",
    trigger: "Posted about procurement challenges on LinkedIn",
    connectionNote: true // For connection request (300 char limit)
  })

  console.log(message)
}

// Example 6: Schedule posts for the week
import { generateWeeklySchedule } from './linkedin-scheduler'

async function example6_ScheduleWeeklyPosts() {
  const schedule = await generateWeeklySchedule(new Date(), {
    autoGenerate: true,
    reviewRequired: true,
    postingTimes: {
      weekday: ['09:00', '14:00'],
      weekend: ['10:00']
    }
  })

  console.log(`Scheduled ${schedule.length} posts`)
  schedule.forEach(post => {
    console.log(`${post.scheduledFor.toLocaleString()}: ${post.theme}`)
  })
}

// Example 7: Get content themes
async function example7_GetContentThemes() {
  const response = await fetch('/api/social/linkedin/content?type=themes')
  const { themes } = await response.json()

  themes.forEach((theme: any) => {
    console.log(`${theme.name}: ${theme.topics.join(', ')}`)
  })
}

// Example 8: Get Wells' profile content
async function example8_GetProfileContent() {
  const response = await fetch('/api/social/linkedin/content?type=profile')
  const { profile } = await response.json()

  console.log(profile.headline)
  console.log(profile.about)
}

/**
 * =============================================================================
 * API ENDPOINTS
 * =============================================================================
 *
 * POST /api/social/linkedin/post
 * - Publish or schedule a LinkedIn post
 * - Body: { content, visibility?, mediaUrls?, hashtags?, schedule?, dryRun? }
 * - Returns: { success, postId, linkedInUrl }
 *
 * GET /api/social/linkedin/post?postId=xxx
 * - Get information about a specific post
 * - Returns: { post, metrics }
 *
 * POST /api/social/linkedin/content
 * - Generate LinkedIn content using Wells AI
 * - Body: { type: 'post'|'response'|'outreach', ...params }
 * - Returns: { content, theme, hashtags, metadata }
 *
 * GET /api/social/linkedin/content?type=themes
 * - Get available content themes
 *
 * GET /api/social/linkedin/content?type=profile
 * - Get Wells' LinkedIn profile content
 *
 * =============================================================================
 * CONTENT THEMES
 * =============================================================================
 *
 * Available themes (from LINKEDIN_CONTENT_THEMES):
 * - ai_commerce: AI in B2B Commerce
 * - procurement_insights: Procurement pain points and solutions
 * - wells_journey: Wells' learnings and updates
 * - industry_trends: Future of B2B, transparency, etc.
 * - practical_tips: Actionable advice for buyers/sellers
 *
 * =============================================================================
 * SAMPLE POSTS
 * =============================================================================
 *
 * 5 ready-to-use posts available in SAMPLE_LINKEDIN_POSTS:
 *
 * 1. procurement_pain - About time wasted in RFQ process
 * 2. ai_perspective - Learning human preferences and context
 * 3. transparency - Hot take on B2B fee structures
 * 4. practical_tip - How to write better RFQs
 * 5. milestone - $2.3M milestone and lessons learned
 *
 * Use them directly or as templates for new content.
 *
 * =============================================================================
 * CONTENT CALENDAR
 * =============================================================================
 *
 * Recommended posting schedule (from CONTENT_CALENDAR_TEMPLATE):
 *
 * Monday: Procurement Insights (start week with data)
 * Tuesday: Practical Tips (actionable value)
 * Wednesday: Wells Journey (mid-week story)
 * Thursday: Industry Trends (hot take, spark discussion)
 * Friday: AI Perspective (thought-provoking)
 *
 * Best posting times:
 * - Weekdays: 9 AM and 2 PM ET
 * - Weekends: 10 AM ET
 *
 * =============================================================================
 * AUTOMATION OPTIONS
 * =============================================================================
 *
 * Option 1: Manual (Review Each Post)
 * - Generate content via API
 * - Review and edit
 * - Post manually or via API
 *
 * Option 2: Semi-Automated (Approval Required)
 * - Schedule weekly content with reviewRequired: true
 * - Review scheduled posts
 * - Approve or regenerate
 * - Auto-post approved content
 *
 * Option 3: Fully Automated (Use with Caution)
 * - Schedule weekly content with reviewRequired: false
 * - Auto-generate and post
 * - Monitor engagement and adjust
 *
 * Recommended: Start with Option 1, move to Option 2 after building confidence
 *
 * =============================================================================
 * TESTING & DRY RUN
 * =============================================================================
 *
 * Always test with dryRun: true first:
 *
 * fetch('/api/social/linkedin/post', {
 *   method: 'POST',
 *   body: JSON.stringify({
 *     content: "Test post",
 *     dryRun: true  // Won't actually post
 *   })
 * })
 *
 * This lets you see what would be posted without publishing.
 *
 * =============================================================================
 * ENGAGEMENT TRACKING
 * =============================================================================
 *
 * Track post performance:
 * - Likes, comments, shares automatically saved to database
 * - Use analyzePostPerformance() to get insights
 * - Use getPostingRecommendations() to optimize schedule
 *
 * =============================================================================
 * TROUBLESHOOTING
 * =============================================================================
 *
 * Issue: "LinkedIn credentials not configured"
 * Fix: Set LINKEDIN_ACCESS_TOKEN and LINKEDIN_PERSON_URN in .env.local
 *
 * Issue: "Access token expired"
 * Fix: LinkedIn tokens expire. Refresh via OAuth flow or get new token
 *
 * Issue: "Post too long"
 * Fix: LinkedIn max is ~3000 characters. Keep posts 150-250 words for best engagement
 *
 * Issue: "Rate limit exceeded"
 * Fix: LinkedIn has posting limits. Don't post more than 1-2 times per day
 *
 * =============================================================================
 */

// Export examples for reference
export const USAGE_EXAMPLES = {
  example1_GeneratePost,
  example2_PostToLinkedIn,
  example3_UseSamplePost,
  example4_RespondToComment,
  example5_GenerateOutreach,
  example6_ScheduleWeeklyPosts,
  example7_GetContentThemes,
  example8_GetProfileContent
}

/**
 * IMMEDIATE NEXT STEPS:
 *
 * 1. Set up LinkedIn developer account and get credentials
 * 2. Create linkedin.com/in/wellsai profile
 * 3. Add credentials to .env.local
 * 4. Test with a dry run post
 * 5. Post one of the 5 sample posts to verify everything works
 * 6. Set up weekly schedule with review required
 * 7. Monitor engagement and iterate
 */
