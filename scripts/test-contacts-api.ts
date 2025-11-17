/**
 * Test script for Contact Management APIs
 * Phase 1: Database & Import
 *
 * Usage: npx tsx scripts/test-contacts-api.ts
 */

import fs from 'fs'
import path from 'path'

const API_BASE = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

// You'll need to replace this with a real Clerk auth token
const AUTH_TOKEN = process.env.TEST_AUTH_TOKEN || ''

interface TestResult {
  test: string
  passed: boolean
  error?: string
  response?: any
}

const results: TestResult[] = []

async function runTest(name: string, fn: () => Promise<void>) {
  console.log(`\n🧪 Testing: ${name}`)
  try {
    await fn()
    results.push({ test: name, passed: true })
    console.log(`✅ PASSED: ${name}`)
  } catch (error: any) {
    results.push({ test: name, passed: false, error: error.message })
    console.log(`❌ FAILED: ${name}`)
    console.error(error.message)
  }
}

async function testCsvUpload() {
  // Create a test CSV file
  const csvContent = `firstName,lastName,email,phone,company,title,location
John,Doe,john.doe@example.com,555-1234,Acme Corp,VP Engineering,San Francisco
Jane,Smith,jane.smith@example.com,555-5678,TechStart,CTO,New York
Bob,Johnson,bob.johnson@example.com,,StartupCo,CEO,Austin
Invalid,Row,not-an-email,555-9999,BadCo,Developer,Seattle`

  const formData = new FormData()
  const blob = new Blob([csvContent], { type: 'text/csv' })
  formData.append('file', blob, 'test-contacts.csv')

  const response = await fetch(`${API_BASE}/api/contacts/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${AUTH_TOKEN}`
    },
    body: formData
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(`Upload failed: ${data.error}`)
  }

  if (!data.success) {
    throw new Error('Upload reported failure')
  }

  if (data.validRows !== 3) {
    throw new Error(`Expected 3 valid rows, got ${data.validRows}`)
  }

  if (data.errors !== 1) {
    throw new Error(`Expected 1 error, got ${data.errors}`)
  }

  console.log(`   ✓ Uploaded ${data.validRows} contacts`)
  console.log(`   ✓ Detected ${data.errors} errors`)
  console.log(`   ✓ Skipped ${data.duplicates} duplicates`)
}

async function testContactList() {
  const response = await fetch(`${API_BASE}/api/contacts/list?page=1&limit=10`, {
    headers: {
      Authorization: `Bearer ${AUTH_TOKEN}`
    }
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(`List failed: ${data.error}`)
  }

  if (!data.success) {
    throw new Error('List reported failure')
  }

  console.log(`   ✓ Retrieved ${data.contacts.length} contacts`)
  console.log(`   ✓ Total contacts: ${data.total}`)
  console.log(`   ✓ Page ${data.page} of ${data.totalPages}`)
}

async function testContactSearch() {
  // Search by query
  const response1 = await fetch(
    `${API_BASE}/api/contacts/search?query=John&page=1&limit=10`,
    {
      headers: {
        Authorization: `Bearer ${AUTH_TOKEN}`
      }
    }
  )

  const data1 = await response1.json()

  if (!response1.ok) {
    throw new Error(`Search failed: ${data1.error}`)
  }

  console.log(`   ✓ Query search found ${data1.contacts.length} contacts`)

  // Search by company
  const response2 = await fetch(
    `${API_BASE}/api/contacts/search?company=Acme&page=1&limit=10`,
    {
      headers: {
        Authorization: `Bearer ${AUTH_TOKEN}`
      }
    }
  )

  const data2 = await response2.json()

  if (!response2.ok) {
    throw new Error(`Company search failed: ${data2.error}`)
  }

  console.log(`   ✓ Company search found ${data2.contacts.length} contacts`)
}

async function testContactDetail() {
  // First, get a contact ID from the list
  const listResponse = await fetch(`${API_BASE}/api/contacts/list?page=1&limit=1`, {
    headers: {
      Authorization: `Bearer ${AUTH_TOKEN}`
    }
  })

  const listData = await listResponse.json()

  if (!listData.contacts || listData.contacts.length === 0) {
    throw new Error('No contacts found to test detail operations')
  }

  const contactId = listData.contacts[0].id

  // Test GET
  const getResponse = await fetch(`${API_BASE}/api/contacts/${contactId}`, {
    headers: {
      Authorization: `Bearer ${AUTH_TOKEN}`
    }
  })

  const getData = await getResponse.json()

  if (!getResponse.ok) {
    throw new Error(`GET failed: ${getData.error}`)
  }

  console.log(`   ✓ Retrieved contact: ${getData.contact.firstName} ${getData.contact.lastName}`)

  // Test PATCH
  const patchResponse = await fetch(`${API_BASE}/api/contacts/${contactId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${AUTH_TOKEN}`
    },
    body: JSON.stringify({
      phone: '555-0000',
      department: 'Engineering'
    })
  })

  const patchData = await patchResponse.json()

  if (!patchResponse.ok) {
    throw new Error(`PATCH failed: ${patchData.error}`)
  }

  console.log(`   ✓ Updated contact successfully`)

  // Test DELETE (optional - comment out if you want to keep test data)
  // const deleteResponse = await fetch(`${API_BASE}/api/contacts/${contactId}`, {
  //   method: 'DELETE',
  //   headers: {
  //     Authorization: `Bearer ${AUTH_TOKEN}`
  //   }
  // })

  // const deleteData = await deleteResponse.json()

  // if (!deleteResponse.ok) {
  //   throw new Error(`DELETE failed: ${deleteData.error}`)
  // }

  // console.log(`   ✓ Deleted contact successfully`)
}

async function testDuplicateDetection() {
  // Upload the same CSV twice to test duplicate detection
  const csvContent = `firstName,lastName,email,phone,company,title
Duplicate,Test,duplicate@example.com,555-1111,DupCo,Manager`

  const formData1 = new FormData()
  const blob1 = new Blob([csvContent], { type: 'text/csv' })
  formData1.append('file', blob1, 'duplicate-test-1.csv')

  const response1 = await fetch(`${API_BASE}/api/contacts/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${AUTH_TOKEN}`
    },
    body: formData1
  })

  const data1 = await response1.json()

  if (!response1.ok) {
    throw new Error(`First upload failed: ${data1.error}`)
  }

  // Upload same contact again
  const formData2 = new FormData()
  const blob2 = new Blob([csvContent], { type: 'text/csv' })
  formData2.append('file', blob2, 'duplicate-test-2.csv')

  const response2 = await fetch(`${API_BASE}/api/contacts/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${AUTH_TOKEN}`
    },
    body: formData2
  })

  const data2 = await response2.json()

  if (!response2.ok) {
    throw new Error(`Second upload failed: ${data2.error}`)
  }

  if (data2.duplicates !== 1) {
    throw new Error(`Expected 1 duplicate, got ${data2.duplicates}`)
  }

  console.log(`   ✓ Duplicate detection working correctly`)
}

async function testPagination() {
  const page1 = await fetch(`${API_BASE}/api/contacts/list?page=1&limit=2`, {
    headers: {
      Authorization: `Bearer ${AUTH_TOKEN}`
    }
  })

  const data1 = await page1.json()

  const page2 = await fetch(`${API_BASE}/api/contacts/list?page=2&limit=2`, {
    headers: {
      Authorization: `Bearer ${AUTH_TOKEN}`
    }
  })

  const data2 = await page2.json()

  if (data1.contacts.length > 0 && data2.contacts.length > 0) {
    if (data1.contacts[0].id === data2.contacts[0].id) {
      throw new Error('Pagination returned same results')
    }
  }

  console.log(`   ✓ Pagination working correctly`)
  console.log(`   ✓ Page 1: ${data1.contacts.length} contacts`)
  console.log(`   ✓ Page 2: ${data2.contacts.length} contacts`)
}

async function main() {
  console.log('🚀 Starting Contact Management API Tests')
  console.log(`   Base URL: ${API_BASE}`)
  console.log(`   Auth: ${AUTH_TOKEN ? 'Configured' : '⚠️  Not configured - tests will fail'}`)

  if (!AUTH_TOKEN) {
    console.log('\n⚠️  WARNING: TEST_AUTH_TOKEN not set. Tests will fail.')
    console.log('   Set TEST_AUTH_TOKEN environment variable to run tests.')
    console.log('   Example: export TEST_AUTH_TOKEN=your_clerk_token_here')
    process.exit(1)
  }

  await runTest('CSV Upload', testCsvUpload)
  await runTest('Contact List', testContactList)
  await runTest('Contact Search', testContactSearch)
  await runTest('Contact Detail', testContactDetail)
  await runTest('Duplicate Detection', testDuplicateDetection)
  await runTest('Pagination', testPagination)

  console.log('\n\n📊 Test Results Summary')
  console.log('━'.repeat(50))

  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length

  results.forEach(result => {
    const icon = result.passed ? '✅' : '❌'
    console.log(`${icon} ${result.test}`)
    if (result.error) {
      console.log(`   Error: ${result.error}`)
    }
  })

  console.log('━'.repeat(50))
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`)

  if (failed > 0) {
    process.exit(1)
  }
}

main().catch(console.error)
