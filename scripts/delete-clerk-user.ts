/**
 * Delete Clerk User Script
 * Usage: npx tsx scripts/delete-clerk-user.ts <email>
 */

import { clerkClient } from '@clerk/nextjs/server'

async function deleteUser(email: string) {
  try {
    console.log(`Looking for user with email: ${email}`)

    const client = await clerkClient()

    // Find user by email
    const users = await client.users.getUserList({
      emailAddress: [email]
    })

    if (users.data.length === 0) {
      console.log(`No user found with email: ${email}`)
      return
    }

    // Delete all users with this email (should only be one)
    for (const user of users.data) {
      console.log(`Deleting user: ${user.id} (${user.emailAddresses[0]?.emailAddress})`)
      await client.users.deleteUser(user.id)
      console.log(`✅ Successfully deleted user ${user.id}`)
    }

  } catch (error) {
    console.error('Error deleting user:', error)
    process.exit(1)
  }
}

const email = process.argv[2]

if (!email) {
  console.error('Usage: npx tsx scripts/delete-clerk-user.ts <email>')
  process.exit(1)
}

deleteUser(email)
