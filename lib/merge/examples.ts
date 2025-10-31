/**
 * Example Usage of Wells AI ATS Integration
 *
 * Copy these examples into your application code
 */

import {
  listJobs,
  createCandidate,
  createApplication,
  syncEmployees,
  convertToATSApplication,
  generateATSLinkToken,
  getATSIntegrationInfo,
} from './ats'

/**
 * Example 1: Company connects their ATS
 */
export async function exampleConnectATS() {
  // Step 1: Generate link token
  const linkToken = await generateATSLinkToken({
    customerId: 'org_abc123',
    customerEmail: 'admin@company.com',
    companyName: 'Acme Corp',
  })

  // Step 2: Open Merge Link (in browser)
  // Use @mergeapi/react-merge-link package
  // When user completes OAuth flow, you'll receive:
  const accountToken = 'acc_production_xyz...' // Store this in your database

  // Step 3: Verify connection
  const integrationInfo = await getATSIntegrationInfo(accountToken)
  console.log('Connected to:', integrationInfo.integration_name)

  return accountToken
}

/**
 * Example 2: Sync jobs from ATS to display in Wells AI
 */
export async function exampleSyncJobs(accountToken: string) {
  // Fetch all open jobs
  const jobs = await listJobs({
    accountToken,
    status: 'OPEN',
    pageSize: 100,
  })

  // Save to database
  for (const job of jobs) {
    // await db.jobs.upsert({
    //   id: job.id,
    //   name: job.name,
    //   description: job.description,
    //   code: job.code,
    //   status: job.status,
    //   departments: job.departments,
    //   offices: job.offices,
    //   // ... other fields
    // })
    console.log(`Synced job: ${job.name}`)
  }

  return jobs
}

/**
 * Example 3: Job seeker applies to a job
 */
export async function exampleSubmitApplication(params: {
  accountToken: string
  jobId: string
  jobSeeker: {
    firstName: string
    lastName: string
    email: string
    phone?: string
    resumeUrl?: string
    coverLetterUrl?: string
    linkedin?: string
    portfolio?: string
  }
}) {
  const { accountToken, jobId, jobSeeker } = params

  // Step 1: Convert to ATS format
  const { candidate, application } = convertToATSApplication({
    jobSeeker,
    jobId,
    source: 'Wells AI',
  })

  // Step 2: Create candidate in ATS
  const createdCandidate = await createCandidate({
    accountToken,
    candidate,
  })

  console.log('Candidate created:', createdCandidate.id)

  // Step 3: Submit application (link candidate to job)
  const createdApplication = await createApplication({
    accountToken,
    application: {
      ...application,
      candidate: createdCandidate.id,
      job: jobId,
    },
  })

  console.log('Application submitted:', createdApplication.id)

  // Step 4: Send confirmation email to job seeker
  // await sendEmail({
  //   to: jobSeeker.email,
  //   subject: 'Application Submitted',
  //   body: `Your application has been submitted to ${jobId}`,
  // })

  return {
    candidateId: createdCandidate.id,
    applicationId: createdApplication.id,
  }
}

/**
 * Example 4: Sync employees for internal recruiting
 */
export async function exampleSyncEmployees(accountToken: string) {
  // Fetch all employees
  const employees = await syncEmployees({
    accountToken,
    pageSize: 1000,
  })

  // Save to database
  for (const employee of employees) {
    // await db.employees.upsert({
    //   id: employee.id,
    //   firstName: employee.first_name,
    //   lastName: employee.last_name,
    //   email: employee.work_email,
    //   title: employee.employments?.[0]?.job_title,
    //   department: employee.team?.name,
    //   // ... other fields
    // })
    console.log(
      `Synced employee: ${employee.first_name} ${employee.last_name}`
    )
  }

  return employees
}

/**
 * Example 5: React component for job application
 */
export function exampleJobApplicationForm() {
  return `
import { useState } from 'react'

export function JobApplicationForm({ job, accountToken }) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    resumeUrl: '',
    linkedin: '',
  })

  const handleSubmit = async (e) => {
    e.preventDefault()

    const response = await fetch('/api/ats/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobId: job.id,
        accountToken,
        jobSeeker: formData,
      }),
    })

    const result = await response.json()

    if (result.success) {
      alert('Application submitted!')
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="First Name"
        value={formData.firstName}
        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
      />
      <input
        type="text"
        placeholder="Last Name"
        value={formData.lastName}
        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
      />
      <input
        type="email"
        placeholder="Email"
        value={formData.email}
        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
      />
      <input
        type="tel"
        placeholder="Phone"
        value={formData.phone}
        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
      />
      <input
        type="url"
        placeholder="Resume URL"
        value={formData.resumeUrl}
        onChange={(e) => setFormData({ ...formData, resumeUrl: e.target.value })}
      />
      <input
        type="url"
        placeholder="LinkedIn"
        value={formData.linkedin}
        onChange={(e) => setFormData({ ...formData, linkedin: e.target.value })}
      />
      <button type="submit">Apply Now</button>
    </form>
  )
}
  `
}

/**
 * Example 6: Auto-sync jobs on a schedule
 */
export async function exampleAutoSyncCron() {
  return `
// In your cron job or webhook handler

import { listJobs } from '@/lib/merge/ats'

export async function syncAllOrganizationJobs() {
  // Get all organizations with ATS connected
  const orgs = await db.organizations.findMany({
    where: { atsAccountToken: { not: null } }
  })

  for (const org of orgs) {
    try {
      console.log(\`Syncing jobs for \${org.name}...\`)

      const jobs = await listJobs({
        accountToken: org.atsAccountToken,
        status: 'OPEN',
        pageSize: 100,
      })

      // Update database
      await db.jobs.deleteMany({ where: { organizationId: org.id } })
      await db.jobs.createMany({
        data: jobs.map(job => ({
          organizationId: org.id,
          externalId: job.id,
          name: job.name,
          description: job.description,
          status: job.status,
        }))
      })

      console.log(\`✅ Synced \${jobs.length} jobs for \${org.name}\`)
    } catch (error) {
      console.error(\`❌ Failed to sync \${org.name}:\`, error)
    }
  }
}

// Run every hour
setInterval(syncAllOrganizationJobs, 60 * 60 * 1000)
  `
}

/**
 * Example 7: Webhook handler for real-time sync
 */
export async function exampleWebhookHandler() {
  return `
// POST /api/webhooks/merge

import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const event = await req.json()

  // Merge.dev webhook payload
  const { event_type, model_id, model, account_token } = event

  switch (event_type) {
    case 'job.created':
      // New job posted in ATS
      await db.jobs.create({
        data: {
          externalId: model_id,
          name: model.name,
          description: model.description,
          // ...
        }
      })
      break

    case 'job.updated':
      // Job updated in ATS
      await db.jobs.update({
        where: { externalId: model_id },
        data: {
          name: model.name,
          status: model.status,
          // ...
        }
      })
      break

    case 'job.deleted':
      // Job closed/deleted in ATS
      await db.jobs.delete({
        where: { externalId: model_id }
      })
      break

    case 'application.created':
      // New application (could be from Wells AI or direct to ATS)
      // Update application status in Wells AI
      break
  }

  return NextResponse.json({ success: true })
}
  `
}
