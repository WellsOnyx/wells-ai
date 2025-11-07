/**
 * Wells Onyx Campaign API Tests
 *
 * Run with: npm test app/api/gtm/wells-onyx/campaign/__tests__/route.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import { prisma } from '@/lib/prisma'

// Mock Clerk auth
jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn(() => ({ userId: 'test-user-123' })),
}))

describe('Wells Onyx Campaign API', () => {
  let testCampaignId: string

  afterAll(async () => {
    // Cleanup: Delete test campaigns
    if (testCampaignId) {
      await prisma.wellsOnyxCampaign.deleteMany({
        where: { userId: 'test-user-123' },
      })
    }
    await prisma.$disconnect()
  })

  describe('POST /api/gtm/wells-onyx/campaign', () => {
    it('creates a campaign with valid data', async () => {
      const response = await fetch('http://localhost:3000/api/gtm/wells-onyx/campaign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          practiceGroupId: 'cybersecurity',
          targetCount: 5,
        }),
      })

      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.campaignId).toBeTruthy()
      expect(data.practiceGroup).toBe('Cybersecurity & Data Privacy Leadership')
      expect(data.messages).toHaveLength(5)
      expect(data.status).toBe('draft')

      // Save for cleanup
      testCampaignId = data.campaignId
    })

    it('rejects invalid practice group', async () => {
      const response = await fetch('http://localhost:3000/api/gtm/wells-onyx/campaign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          practiceGroupId: 'invalid-group',
          targetCount: 5,
        }),
      })

      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data.error).toContain('Practice group not found')
    })

    it('rejects targetCount > 100', async () => {
      const response = await fetch('http://localhost:3000/api/gtm/wells-onyx/campaign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          practiceGroupId: 'saas',
          targetCount: 150,
        }),
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('Invalid request data')
    })
  })

  describe('GET /api/gtm/wells-onyx/campaign', () => {
    beforeAll(async () => {
      // Create a test campaign
      const response = await fetch('http://localhost:3000/api/gtm/wells-onyx/campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          practiceGroupId: 'fintech',
          targetCount: 3,
        }),
      })
      const data = await response.json()
      testCampaignId = data.campaignId
    })

    it('retrieves campaign by ID', async () => {
      const response = await fetch(
        `http://localhost:3000/api/gtm/wells-onyx/campaign?campaignId=${testCampaignId}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )

      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.campaignId).toBe(testCampaignId)
      expect(data.practiceGroup).toBe('Fintech & Payments Leadership')
      expect(data.messages).toHaveLength(3)
      expect(data.status).toBe('draft')
    })

    it('returns 404 for non-existent campaign', async () => {
      const response = await fetch(
        'http://localhost:3000/api/gtm/wells-onyx/campaign?campaignId=wo_gtm_nonexistent',
        {
          method: 'GET',
        }
      )

      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data.error).toBe('Campaign not found')
    })

    it('requires campaignId parameter', async () => {
      const response = await fetch(
        'http://localhost:3000/api/gtm/wells-onyx/campaign',
        {
          method: 'GET',
        }
      )

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('campaignId required')
    })
  })

  describe('PATCH /api/gtm/wells-onyx/campaign', () => {
    beforeAll(async () => {
      // Create a test campaign
      const response = await fetch('http://localhost:3000/api/gtm/wells-onyx/campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          practiceGroupId: 'aerospace',
          targetCount: 10,
        }),
      })
      const data = await response.json()
      testCampaignId = data.campaignId
    })

    it('approves a single message', async () => {
      const response = await fetch('http://localhost:3000/api/gtm/wells-onyx/campaign', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          campaignId: testCampaignId,
          action: 'approve_message',
          messageIndex: 0,
        }),
      })

      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.message).toBe('Message approved')
      expect(data.approvedCount).toBe(1)
      expect(data.totalMessages).toBe(10)
    })

    it('rejects a single message', async () => {
      const response = await fetch('http://localhost:3000/api/gtm/wells-onyx/campaign', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          campaignId: testCampaignId,
          action: 'reject_message',
          messageIndex: 0,
        }),
      })

      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.message).toBe('Message rejected')
      expect(data.approvedCount).toBe(0)
    })

    it('approves all messages', async () => {
      const response = await fetch('http://localhost:3000/api/gtm/wells-onyx/campaign', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          campaignId: testCampaignId,
          action: 'approve_all',
        }),
      })

      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.message).toBe('All messages approved')
      expect(data.approvedCount).toBe(10)
      expect(data.status).toBe('ready')
    })

    it('rejects send without approved messages', async () => {
      // Create new campaign
      const createResponse = await fetch('http://localhost:3000/api/gtm/wells-onyx/campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          practiceGroupId: 'healthcare',
          targetCount: 2,
        }),
      })
      const { campaignId } = await createResponse.json()

      // Try to send without approval
      const sendResponse = await fetch('http://localhost:3000/api/gtm/wells-onyx/campaign', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          campaignId,
          action: 'send',
        }),
      })

      expect(sendResponse.status).toBe(400)
      const data = await sendResponse.json()
      expect(data.error).toContain('messages not approved')
    })

    it('validates messageIndex bounds', async () => {
      const response = await fetch('http://localhost:3000/api/gtm/wells-onyx/campaign', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          campaignId: testCampaignId,
          action: 'approve_message',
          messageIndex: 999,
        }),
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('Invalid messageIndex')
    })

    it('requires messageIndex for approve_message', async () => {
      const response = await fetch('http://localhost:3000/api/gtm/wells-onyx/campaign', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          campaignId: testCampaignId,
          action: 'approve_message',
        }),
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('messageIndex required for approve_message')
    })
  })

  describe('Database persistence', () => {
    it('stores campaign in database', async () => {
      const response = await fetch('http://localhost:3000/api/gtm/wells-onyx/campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          practiceGroupId: 'saas',
          targetCount: 5,
        }),
      })

      const { campaignId } = await response.json()

      // Verify in database
      const dbCampaign = await prisma.wellsOnyxCampaign.findUnique({
        where: { campaignId },
      })

      expect(dbCampaign).toBeTruthy()
      expect(dbCampaign?.practiceGroupId).toBe('saas')
      expect(dbCampaign?.prospectCount).toBe(5)
      expect(dbCampaign?.status).toBe('DRAFT')
    })

    it('updates approval count in database', async () => {
      // Create campaign
      const createResponse = await fetch('http://localhost:3000/api/gtm/wells-onyx/campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          practiceGroupId: 'fintech',
          targetCount: 3,
        }),
      })
      const { campaignId } = await createResponse.json()

      // Approve all
      await fetch('http://localhost:3000/api/gtm/wells-onyx/campaign', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId,
          action: 'approve_all',
        }),
      })

      // Verify in database
      const dbCampaign = await prisma.wellsOnyxCampaign.findUnique({
        where: { campaignId },
      })

      expect(dbCampaign?.approvedCount).toBe(3)
      expect(dbCampaign?.status).toBe('READY')
      expect(dbCampaign?.approvedAt).toBeTruthy()
    })
  })
})
