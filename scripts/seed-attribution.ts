/**
 * Attribution Network Seed Data
 * Creates demo data for the Attribution feature
 *
 * Run: npx ts-node scripts/seed-attribution.ts
 * Or: tsx scripts/seed-attribution.ts
 */

import { sql } from '@vercel/postgres'

// Demo Users
const DEMO_USERS = [
  { id: 'demo_alice', name: 'Alice Chen', email: 'alice@example.com' },
  { id: 'demo_bob', name: 'Bob Martinez', email: 'bob@example.com' },
  { id: 'demo_carol', name: 'Carol Johnson', email: 'carol@example.com' },
  { id: 'demo_david', name: 'David Kim', email: 'david@example.com' },
  { id: 'demo_emma', name: 'Emma Wilson', email: 'emma@example.com' },
  { id: 'demo_frank', name: 'Frank Brown', email: 'frank@example.com' },
]

// Network structure:
// Alice (hub) ─┬─ Bob ─┬─ David
//              │       └─ Frank
//              ├─ Carol ── David (also connected to Bob)
//              └─ Emma
const DEMO_CONNECTIONS = [
  // Alice's direct connections
  { requester: 'demo_alice', accepter: 'demo_bob' },
  { requester: 'demo_alice', accepter: 'demo_carol' },
  { requester: 'demo_alice', accepter: 'demo_emma' },
  // Bob's connections
  { requester: 'demo_bob', accepter: 'demo_david' },
  { requester: 'demo_bob', accepter: 'demo_frank' },
  // Carol's connections
  { requester: 'demo_carol', accepter: 'demo_david' },
]

// Demo Offers
const DEMO_OFFERS = [
  {
    id: 'offer_saas_enterprise',
    owner: 'demo_alice',
    title: 'Enterprise SaaS Implementation - Fortune 500',
    description: 'Full-scale enterprise software implementation for a Fortune 500 company. Looking for introductions to decision makers.',
    value: 500000,
    l1: 8, l2: 4, l3: 2, l4: 1,
    status: 'active',
    category: 'enterprise',
  },
  {
    id: 'offer_consulting',
    owner: 'demo_bob',
    title: 'Strategic Consulting Engagement',
    description: 'High-level strategy consulting for Series B+ startups. Need introductions to founders and C-suite.',
    value: 150000,
    l1: 10, l2: 5, l3: 3, l4: 2,
    status: 'active',
    category: 'consulting',
  },
  {
    id: 'offer_cloud_migration',
    owner: 'demo_alice',
    title: 'Cloud Migration Project (CLOSED)',
    description: 'Successfully closed cloud migration project. Commissions distributed.',
    value: 250000,
    l1: 6, l2: 3, l3: 1.5, l4: 0.5,
    status: 'closed',
    category: 'enterprise',
  },
]

// Demo Introduction Chain for closed deal
// Alice -> Bob -> David -> Frank's contact closes
const DEMO_INTRODUCTIONS = [
  {
    offer: 'offer_cloud_migration',
    introducer: 'demo_alice',
    recipient: 'demo_bob',
    level: 1,
    l1: 'demo_bob',
    status: 'converted',
  },
  {
    offer: 'offer_cloud_migration',
    introducer: 'demo_bob',
    recipient: 'demo_david',
    level: 2,
    l1: 'demo_bob',
    l2: 'demo_david',
    status: 'converted',
  },
  {
    offer: 'offer_cloud_migration',
    introducer: 'demo_david',
    recipient: 'demo_frank',
    level: 3,
    l1: 'demo_bob',
    l2: 'demo_david',
    l3: 'demo_frank',
    status: 'converted',
  },
]

// Demo Closure (closed deal)
const DEMO_CLOSURE = {
  offer: 'offer_cloud_migration',
  closer: 'demo_frank',
  actualValue: 250000,
  l1: 'demo_bob',
  l2: 'demo_david',
  l3: 'demo_frank',
  l1Pct: 6,
  l2Pct: 3,
  l3Pct: 1.5,
  l4Pct: 0.5,
  status: 'paid',
}

// Demo Commissions from closed deal
// $250,000 deal:
// - Frank (L3): $250,000 * 1.5% = $3,750 -> 3,750,000 GRAIN
// - David (L2): $250,000 * 3% = $7,500 -> 7,500,000 GRAIN
// - Bob (L1): $250,000 * 6% = $15,000 -> 15,000,000 GRAIN
const DEMO_COMMISSIONS = [
  { recipient: 'demo_bob', level: 1, pct: 6, usd: 15000, grain: 15000000 },
  { recipient: 'demo_david', level: 2, pct: 3, usd: 7500, grain: 7500000 },
  { recipient: 'demo_frank', level: 3, pct: 1.5, usd: 3750, grain: 3750000 },
]

async function seedAttribution() {
  console.log('🌱 Starting Attribution seed...\n')

  try {
    // 1. Clear existing demo data
    console.log('🧹 Clearing existing demo data...')
    await sql`DELETE FROM attr_commissions WHERE recipient_id LIKE 'demo_%'`
    await sql`DELETE FROM attr_closures WHERE closer_id LIKE 'demo_%'`
    await sql`DELETE FROM attr_introductions WHERE introducer_id LIKE 'demo_%'`
    await sql`DELETE FROM attr_offers WHERE owner_id LIKE 'demo_%'`
    await sql`DELETE FROM attr_connections WHERE requester_id LIKE 'demo_%'`
    await sql`DELETE FROM attr_network_stats WHERE user_id LIKE 'demo_%'`

    // 2. Create connections
    console.log('👥 Creating demo connections...')
    for (const conn of DEMO_CONNECTIONS) {
      const requesterUser = DEMO_USERS.find(u => u.id === conn.requester)!
      const accepterUser = DEMO_USERS.find(u => u.id === conn.accepter)!

      await sql`
        INSERT INTO attr_connections (
          requester_id, accepter_id,
          requester_name, requester_email,
          accepter_name, accepter_email,
          status, accepted_at
        ) VALUES (
          ${conn.requester}, ${conn.accepter},
          ${requesterUser.name}, ${requesterUser.email},
          ${accepterUser.name}, ${accepterUser.email},
          'active', NOW()
        )
        ON CONFLICT DO NOTHING
      `
      console.log(`  ✓ ${requesterUser.name} ↔ ${accepterUser.name}`)
    }

    // 3. Create offers
    console.log('\n📋 Creating demo offers...')
    for (const offer of DEMO_OFFERS) {
      const owner = DEMO_USERS.find(u => u.id === offer.owner)!

      await sql`
        INSERT INTO attr_offers (
          id, owner_id, owner_name,
          title, description, value, currency,
          l1_commission_pct, l2_commission_pct, l3_commission_pct, l4_commission_pct,
          status, category
        ) VALUES (
          ${offer.id}, ${offer.owner}, ${owner.name},
          ${offer.title}, ${offer.description}, ${offer.value}, 'USD',
          ${offer.l1}, ${offer.l2}, ${offer.l3}, ${offer.l4},
          ${offer.status}, ${offer.category}
        )
        ON CONFLICT DO NOTHING
      `
      console.log(`  ✓ ${offer.title} (${offer.status})`)
    }

    // 4. Create introduction chain for closed deal
    console.log('\n🔗 Creating introduction chain...')
    let parentIntroId: string | null = null
    for (const intro of DEMO_INTRODUCTIONS) {
      const introducer = DEMO_USERS.find(u => u.id === intro.introducer)!
      const recipient = DEMO_USERS.find(u => u.id === intro.recipient)!

      const result = await sql`
        INSERT INTO attr_introductions (
          offer_id, introducer_id, recipient_id,
          introducer_name, recipient_name,
          level, parent_introduction_id,
          l1_user_id, l2_user_id, l3_user_id, l4_user_id,
          status
        ) VALUES (
          ${intro.offer}, ${intro.introducer}, ${intro.recipient},
          ${introducer.name}, ${recipient.name},
          ${intro.level}, ${parentIntroId},
          ${intro.l1 || null}, ${intro.l2 || null}, ${intro.l3 || null}, ${null},
          ${intro.status}
        )
        RETURNING id
      `
      parentIntroId = result.rows[0].id
      console.log(`  ✓ L${intro.level}: ${introducer.name} → ${recipient.name}`)
    }

    // 5. Create closure
    console.log('\n✅ Creating deal closure...')
    const closer = DEMO_USERS.find(u => u.id === DEMO_CLOSURE.closer)!
    const closureResult = await sql`
      INSERT INTO attr_closures (
        offer_id, closer_id, closer_name,
        actual_value, currency,
        l1_user_id, l2_user_id, l3_user_id, l4_user_id,
        l1_pct, l2_pct, l3_pct, l4_pct,
        status, verified_at, paid_at
      ) VALUES (
        ${DEMO_CLOSURE.offer}, ${DEMO_CLOSURE.closer}, ${closer.name},
        ${DEMO_CLOSURE.actualValue}, 'USD',
        ${DEMO_CLOSURE.l1}, ${DEMO_CLOSURE.l2}, ${DEMO_CLOSURE.l3}, ${null},
        ${DEMO_CLOSURE.l1Pct}, ${DEMO_CLOSURE.l2Pct}, ${DEMO_CLOSURE.l3Pct}, ${DEMO_CLOSURE.l4Pct},
        ${DEMO_CLOSURE.status}, NOW(), NOW()
      )
      RETURNING id
    `
    const closureId = closureResult.rows[0].id
    console.log(`  ✓ Deal closed by ${closer.name} for $${DEMO_CLOSURE.actualValue.toLocaleString()}`)

    // 6. Create commissions
    console.log('\n💰 Creating commissions...')
    for (const comm of DEMO_COMMISSIONS) {
      const recipient = DEMO_USERS.find(u => u.id === comm.recipient)!

      await sql`
        INSERT INTO attr_commissions (
          closure_id, offer_id, recipient_id, recipient_name,
          level, deal_value, commission_pct, commission_usd,
          grain_amount, grain_rate, status, credited_at
        ) VALUES (
          ${closureId}, ${DEMO_CLOSURE.offer}, ${comm.recipient}, ${recipient.name},
          ${comm.level}, ${DEMO_CLOSURE.actualValue}, ${comm.pct}, ${comm.usd},
          ${comm.grain}, 0.001, 'credited', NOW()
        )
      `
      console.log(`  ✓ ${recipient.name} (L${comm.level}): $${comm.usd.toLocaleString()} → ${comm.grain.toLocaleString()} GRAIN`)
    }

    // 7. Update network stats
    console.log('\n📊 Updating network stats...')
    for (const user of DEMO_USERS) {
      await sql`
        INSERT INTO attr_network_stats (user_id, direct_connections, updated_at)
        VALUES (${user.id}, 0, NOW())
        ON CONFLICT (user_id) DO UPDATE SET
          direct_connections = (
            SELECT COUNT(*) FROM attr_connections
            WHERE (requester_id = ${user.id} OR accepter_id = ${user.id}) AND status = 'active'
          ),
          total_offers_created = (
            SELECT COUNT(*) FROM attr_offers WHERE owner_id = ${user.id}
          ),
          total_introductions_made = (
            SELECT COUNT(*) FROM attr_introductions WHERE introducer_id = ${user.id}
          ),
          total_introductions_received = (
            SELECT COUNT(*) FROM attr_introductions WHERE recipient_id = ${user.id}
          ),
          total_earned = (
            SELECT COALESCE(SUM(commission_usd), 0) FROM attr_commissions
            WHERE recipient_id = ${user.id} AND status = 'credited'
          ),
          total_grain_earned = (
            SELECT COALESCE(SUM(grain_amount), 0) FROM attr_commissions
            WHERE recipient_id = ${user.id} AND status = 'credited'
          ),
          updated_at = NOW()
      `
      console.log(`  ✓ ${user.name}`)
    }

    console.log('\n✨ Attribution seed complete!\n')
    console.log('Demo Network Structure:')
    console.log('  Alice (hub) ─┬─ Bob ─┬─ David')
    console.log('               │       └─ Frank')
    console.log('               ├─ Carol ── David')
    console.log('               └─ Emma')
    console.log('')
    console.log('Closed Deal: "Cloud Migration Project" - $250,000')
    console.log('  Chain: Alice → Bob → David → Frank\'s contact')
    console.log('  Commissions:')
    console.log('    - Frank (L3): $3,750 (3.75M GRAIN)')
    console.log('    - David (L2): $7,500 (7.5M GRAIN)')
    console.log('    - Bob (L1): $15,000 (15M GRAIN)')
    console.log('')

  } catch (error) {
    console.error('❌ Seed failed:', error)
    throw error
  }
}

// Run if called directly
seedAttribution()
  .then(() => process.exit(0))
  .catch(() => process.exit(1))
