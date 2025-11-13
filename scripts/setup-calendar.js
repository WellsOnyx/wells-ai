#!/usr/bin/env node

/**
 * Calendar Integration Setup Script
 *
 * Generates encryption keys and validates Cal.com API configuration
 */

const crypto = require('crypto')
const https = require('https')

console.log('\n🗓️  Wells AI Calendar Integration Setup\n')

// Generate encryption key
const encryptionKey = crypto.randomBytes(32).toString('hex')

console.log('1️⃣  Generated Calendar Encryption Key:')
console.log('   Add this to your .env file:')
console.log(`   CALENDAR_ENCRYPTION_KEY=${encryptionKey}\n`)

// Check if Cal.com API key is set
const calcomApiKey = process.env.CALCOM_API_KEY

if (!calcomApiKey) {
  console.log('⚠️  Cal.com API Key not found in environment')
  console.log('   Get your API key at: https://app.cal.com/settings/developer/api-keys')
  console.log('   Then add to .env: CALCOM_API_KEY=cal_live_...\n')
} else {
  console.log('2️⃣  Validating Cal.com API Key...')

  // Test the API key
  const options = {
    hostname: 'api.cal.com',
    path: '/v1/me',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${calcomApiKey}`,
      'Content-Type': 'application/json'
    }
  }

  const req = https.request(options, (res) => {
    let data = ''

    res.on('data', (chunk) => {
      data += chunk
    })

    res.on('end', () => {
      if (res.statusCode === 200) {
        try {
          const user = JSON.parse(data)
          console.log(`   ✅ API Key Valid - Connected as: ${user.email || user.username || 'User'}`)
          console.log(`   User ID: ${user.id}`)
          console.log(`   Calendar URL: https://cal.com/${user.username}\n`)
        } catch (e) {
          console.log('   ✅ API Key Valid\n')
        }
      } else {
        console.log(`   ❌ API Key Invalid (Status: ${res.statusCode})`)
        console.log(`   Response: ${data}\n`)
      }
    })
  })

  req.on('error', (error) => {
    console.log('   ❌ Failed to validate API key')
    console.log(`   Error: ${error.message}\n`)
  })

  req.end()
}

// Database setup instructions
console.log('3️⃣  Database Setup:')
console.log('   Run the migration to create calendar tables:')
console.log('   psql $DATABASE_URL < prisma/migrations/add_calendar_tables.sql\n')

// Next steps
console.log('4️⃣  Next Steps:')
console.log('   1. Add the CALENDAR_ENCRYPTION_KEY to your .env file')
console.log('   2. Run the database migration')
console.log('   3. Restart your Next.js server')
console.log('   4. Users can connect calendars via /api/calendar/connect')
console.log('   5. Test scheduling: "Schedule a meeting with john@example.com"\n')

console.log('📚 Documentation:')
console.log('   See docs/CALENDAR_INTEGRATION.md for full setup guide\n')
