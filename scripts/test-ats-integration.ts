/**
 * Test Script for ATS Integration
 *
 * Run with: npx tsx scripts/test-ats-integration.ts
 */

import {
  checkATSConnection,
  listJobs,
  createCandidate,
  createApplication,
  syncEmployees,
  convertToATSApplication,
  ATSSystems,
} from '../lib/merge/ats'

const MERGE_API_KEY = process.env.MERGE_API_KEY
const TEST_ACCOUNT_TOKEN = process.env.TEST_MERGE_ACCOUNT_TOKEN || ''

async function testATSIntegration() {
  console.log('🧪 Testing Wells AI ATS Integration\n')

  // Test 1: Check connection
  console.log('1️⃣  Testing Merge.dev connection...')
  const isConnected = await checkATSConnection()
  console.log(`   ${isConnected ? '✅' : '❌'} Connection: ${isConnected ? 'OK' : 'FAILED'}`)

  if (!isConnected) {
    console.log('\n❌ Merge.dev connection failed. Check your MERGE_API_KEY.')
    console.log('   Set it in .env.local: MERGE_API_KEY=your_key_here')
    return
  }

  console.log('\n2️⃣  Supported ATS Systems:')
  Object.entries(ATSSystems).forEach(([name, slug]) => {
    console.log(`   - ${name.padEnd(25)} → ${slug}`)
  })

  // If no account token, stop here
  if (!TEST_ACCOUNT_TOKEN) {
    console.log('\n⚠️  No test account token provided.')
    console.log('   To test with real data:')
    console.log('   1. Connect an ATS at: http://localhost:3000/settings/ats')
    console.log('   2. Get account token from Merge Link')
    console.log('   3. Set TEST_MERGE_ACCOUNT_TOKEN in .env.local')
    return
  }

  // Test 2: List jobs
  console.log('\n3️⃣  Fetching jobs from ATS...')
  try {
    const jobs = await listJobs({
      accountToken: TEST_ACCOUNT_TOKEN,
      status: 'OPEN',
      pageSize: 5,
    })

    console.log(`   ✅ Retrieved ${jobs.length} jobs`)
    jobs.slice(0, 3).forEach((job) => {
      console.log(`      - ${job.name} (${job.code || 'no code'})`)
    })
  } catch (error: any) {
    console.log(`   ❌ Failed to fetch jobs: ${error.message}`)
  }

  // Test 3: Convert job seeker to ATS format
  console.log('\n4️⃣  Testing application format conversion...')
  const testJobSeeker = {
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane.doe@example.com',
    phone: '+1234567890',
    resumeUrl: 'https://example.com/resume.pdf',
    linkedin: 'https://linkedin.com/in/janedoe',
    currentCompany: 'TechCo',
    currentTitle: 'Software Engineer',
  }

  const { candidate, application } = convertToATSApplication({
    jobSeeker: testJobSeeker,
    jobId: 'test_job_123',
    source: 'Wells AI Test',
  })

  console.log('   ✅ Conversion successful')
  console.log(`      Candidate: ${candidate.first_name} ${candidate.last_name}`)
  console.log(`      Email: ${candidate.email_addresses?.[0]?.value}`)
  console.log(`      Phone: ${candidate.phone_numbers?.[0]?.value}`)
  console.log(`      URLs: ${candidate.urls?.length || 0}`)
  console.log(`      Attachments: ${candidate.attachments?.length || 0}`)

  // Test 4: Sync employees (if HRIS is connected)
  console.log('\n5️⃣  Testing employee sync...')
  try {
    const employees = await syncEmployees({
      accountToken: TEST_ACCOUNT_TOKEN,
      pageSize: 5,
    })

    console.log(`   ✅ Synced ${employees.length} employees`)
    employees.slice(0, 3).forEach((emp) => {
      console.log(
        `      - ${emp.display_full_name || emp.first_name} ${emp.last_name || ''} (${emp.employments?.[0]?.job_title || 'no title'})`
      )
    })
  } catch (error: any) {
    console.log(`   ⚠️  Employee sync not available: ${error.message}`)
    console.log('      (This is normal if HRIS is not connected)')
  }

  console.log('\n✅ ATS Integration Test Complete!\n')
  console.log('Next steps:')
  console.log('1. Visit http://localhost:3000/settings/ats to connect your ATS')
  console.log('2. Sync jobs and test the full workflow')
  console.log('3. Submit a test application from Wells AI')
  console.log('4. Verify it appears in your ATS')
}

// Run tests
testATSIntegration().catch((error) => {
  console.error('❌ Test failed:', error)
  process.exit(1)
})
