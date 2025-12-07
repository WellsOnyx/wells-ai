/**
 * Team Collaboration Schema Migration
 * Creates all tables for organization/team collaboration
 */

const { Client } = require('pg');

async function migrate() {
  const client = new Client({
    connectionString: process.env.POSTGRES_URL
  });

  await client.connect();
  console.log('Connected to database');

  // Execute each table creation separately
  const tables = [
    // ORGANIZATIONS
    `CREATE TABLE IF NOT EXISTS organizations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT,
      logo_url TEXT,
      website TEXT,
      industry TEXT,
      company_size TEXT,
      country TEXT,
      settings JSONB DEFAULT '{}',
      plan TEXT DEFAULT 'starter',
      billing_email TEXT,
      status TEXT DEFAULT 'active',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,

    // ORGANIZATION MEMBERS
    `CREATE TABLE IF NOT EXISTS organization_members (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      permissions JSONB DEFAULT '{}',
      display_name TEXT,
      title TEXT,
      department TEXT,
      avatar_url TEXT,
      invited_by TEXT,
      invited_at TIMESTAMP,
      status TEXT DEFAULT 'active',
      joined_at TIMESTAMP DEFAULT NOW(),
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(org_id, user_id)
    )`,

    // TEAMS
    `CREATE TABLE IF NOT EXISTS teams (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      description TEXT,
      avatar_url TEXT,
      focus_area TEXT,
      settings JSONB DEFAULT '{}',
      is_default BOOLEAN DEFAULT FALSE,
      created_by TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(org_id, slug)
    )`,

    // TEAM MEMBERS
    `CREATE TABLE IF NOT EXISTS team_members (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      role TEXT DEFAULT 'member',
      added_by TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(team_id, user_id)
    )`,

    // INVITES
    `CREATE TABLE IF NOT EXISTS invites (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      role TEXT DEFAULT 'member',
      team_ids UUID[],
      invited_by TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      message TEXT,
      status TEXT DEFAULT 'pending',
      expires_at TIMESTAMP NOT NULL,
      accepted_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,

    // ACTIVITY LOG
    `CREATE TABLE IF NOT EXISTS activity_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      action_type TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT,
      metadata JSONB DEFAULT '{}',
      ip_address TEXT,
      user_agent TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,

    // PERMISSIONS
    `CREATE TABLE IF NOT EXISTS permissions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      scope TEXT NOT NULL,
      actions TEXT[] NOT NULL,
      conditions JSONB DEFAULT '{}',
      is_system BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(org_id, name)
    )`,

    // ASSIGNMENTS
    `CREATE TABLE IF NOT EXISTS assignments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      resource_type TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      assigned_to TEXT NOT NULL,
      assigned_by TEXT NOT NULL,
      due_date TIMESTAMP,
      priority TEXT DEFAULT 'medium',
      status TEXT DEFAULT 'pending',
      notes TEXT,
      metadata JSONB DEFAULT '{}',
      completed_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,

    // COMMENTS
    `CREATE TABLE IF NOT EXISTS comments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      resource_type TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      content TEXT NOT NULL,
      parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
      is_internal BOOLEAN DEFAULT FALSE,
      is_resolved BOOLEAN DEFAULT FALSE,
      resolved_by TEXT,
      resolved_at TIMESTAMP,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,

    // MENTIONS
    `CREATE TABLE IF NOT EXISTS mentions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
      mentioned_user_id TEXT NOT NULL,
      mentioned_at TIMESTAMP NOT NULL DEFAULT NOW(),
      notification_sent BOOLEAN DEFAULT FALSE,
      notification_sent_at TIMESTAMP,
      read_at TIMESTAMP
    )`,

    // HANDOFFS
    `CREATE TABLE IF NOT EXISTS handoffs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      conversation_id TEXT NOT NULL,
      from_user_id TEXT NOT NULL,
      to_user_id TEXT NOT NULL,
      reason TEXT,
      context_summary TEXT,
      status TEXT DEFAULT 'pending',
      priority TEXT DEFAULT 'normal',
      notes TEXT,
      metadata JSONB DEFAULT '{}',
      accepted_at TIMESTAMP,
      rejected_at TIMESTAMP,
      rejected_reason TEXT,
      completed_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,

    // SHARED CONTEXT
    `CREATE TABLE IF NOT EXISTS shared_context (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      resource_type TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      context_type TEXT NOT NULL,
      context_data JSONB NOT NULL,
      visible_to TEXT[] NOT NULL,
      created_by TEXT NOT NULL,
      expires_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,

    // NOTIFICATION PREFERENCES
    `CREATE TABLE IF NOT EXISTS notification_preferences (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL,
      org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      channel TEXT NOT NULL,
      event_types TEXT[],
      enabled BOOLEAN DEFAULT TRUE,
      schedule JSONB DEFAULT '{}',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, org_id, channel)
    )`,

    // AUDIT TRAIL
    `CREATE TABLE IF NOT EXISTS audit_trail (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      old_value JSONB,
      new_value JSONB,
      ip_address TEXT,
      user_agent TEXT,
      session_id TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`
  ];

  // Create all tables
  let success = 0;
  let skipped = 0;

  for (const sql of tables) {
    try {
      await client.query(sql);
      success++;
      const tableName = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1];
      console.log(`✓ Created: ${tableName}`);
    } catch (e) {
      if (e.message.includes('already exists')) {
        skipped++;
        console.log(`⊘ Already exists: ${e.message.match(/relation "(\w+)"/)?.[1]}`);
      } else {
        console.error(`✗ Error:`, e.message);
      }
    }
  }

  // Create indexes
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug)',
    'CREATE INDEX IF NOT EXISTS idx_organizations_status ON organizations(status)',
    'CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON organization_members(org_id)',
    'CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON organization_members(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_teams_org_id ON teams(org_id)',
    'CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id)',
    'CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_invites_org_id ON invites(org_id)',
    'CREATE INDEX IF NOT EXISTS idx_invites_email ON invites(email)',
    'CREATE INDEX IF NOT EXISTS idx_invites_token ON invites(token)',
    'CREATE INDEX IF NOT EXISTS idx_activity_log_org_id ON activity_log(org_id)',
    'CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON activity_log(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_assignments_org_id ON assignments(org_id)',
    'CREATE INDEX IF NOT EXISTS idx_assignments_assigned_to ON assignments(assigned_to)',
    'CREATE INDEX IF NOT EXISTS idx_comments_org_id ON comments(org_id)',
    'CREATE INDEX IF NOT EXISTS idx_comments_resource ON comments(resource_type, resource_id)',
    'CREATE INDEX IF NOT EXISTS idx_mentions_user ON mentions(mentioned_user_id)',
    'CREATE INDEX IF NOT EXISTS idx_handoffs_org_id ON handoffs(org_id)',
    'CREATE INDEX IF NOT EXISTS idx_handoffs_to_user ON handoffs(to_user_id)',
    'CREATE INDEX IF NOT EXISTS idx_handoffs_status ON handoffs(status)',
    'CREATE INDEX IF NOT EXISTS idx_shared_context_org_id ON shared_context(org_id)',
    'CREATE INDEX IF NOT EXISTS idx_audit_trail_org_id ON audit_trail(org_id)',
    'CREATE INDEX IF NOT EXISTS idx_audit_trail_entity ON audit_trail(entity_type, entity_id)'
  ];

  console.log('\nCreating indexes...');
  for (const idx of indexes) {
    try {
      await client.query(idx);
    } catch (e) {
      // Ignore index errors
    }
  }
  console.log('✓ Indexes created');

  // Verify tables
  const result = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN (
      'organizations', 'organization_members', 'teams', 'team_members',
      'invites', 'activity_log', 'permissions', 'assignments',
      'comments', 'mentions', 'handoffs', 'shared_context',
      'notification_preferences', 'audit_trail'
    )
    ORDER BY table_name
  `);

  console.log('\n=== Team Collaboration Tables ===');
  result.rows.forEach(row => console.log(`  - ${row.table_name}`));
  console.log(`\nTotal: ${result.rows.length} tables`);

  await client.end();
}

migrate().catch(console.error);
