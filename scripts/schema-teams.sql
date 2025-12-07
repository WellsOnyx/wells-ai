-- ============================================================================
-- WELLS AI TEAM COLLABORATION SCHEMA
-- Run: psql $POSTGRES_URL < scripts/schema-teams.sql
-- ============================================================================
--
-- Enables businesses with human teams to collaborate effectively on Wells AI
-- Provides organization structure, roles, permissions, and team awareness
--

-- ============================================================================
-- ORGANIZATIONS (Companies)
-- ============================================================================

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Organization Details
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL, -- URL-friendly identifier (e.g., 'acme-corp')
  description TEXT,
  logo_url TEXT,
  website TEXT,

  -- Business Info
  industry TEXT,
  company_size TEXT, -- 'startup', 'smb', 'mid-market', 'enterprise'
  country TEXT,

  -- Settings
  settings JSONB DEFAULT '{}', -- Organization-wide settings

  -- Billing
  plan TEXT DEFAULT 'starter', -- 'starter', 'growth', 'enterprise'
  billing_email TEXT,

  -- Status
  status TEXT DEFAULT 'active', -- 'active', 'suspended', 'closed'

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_status ON organizations(status);
CREATE INDEX IF NOT EXISTS idx_organizations_created_at ON organizations(created_at DESC);

-- ============================================================================
-- ORGANIZATION MEMBERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL, -- Clerk user ID

  -- Role in organization
  role TEXT NOT NULL DEFAULT 'member', -- 'owner', 'admin', 'member', 'viewer'

  -- Permissions
  permissions JSONB DEFAULT '{}', -- Custom permissions for this user

  -- Profile
  display_name TEXT,
  title TEXT, -- Job title in the organization
  department TEXT,
  avatar_url TEXT,

  -- Invitation tracking
  invited_by TEXT, -- User ID of who invited them
  invited_at TIMESTAMP,

  -- Status
  status TEXT DEFAULT 'active', -- 'invited', 'active', 'suspended', 'removed'

  -- Timestamps
  joined_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  UNIQUE(org_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON organization_members(org_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_role ON organization_members(role);
CREATE INDEX IF NOT EXISTS idx_org_members_status ON organization_members(status);

-- ============================================================================
-- TEAMS (Sub-groups within organizations)
-- ============================================================================

CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Team Details
  name TEXT NOT NULL,
  slug TEXT NOT NULL, -- URL-friendly, unique within org
  description TEXT,

  -- Focus Area
  focus_area TEXT, -- 'sales', 'procurement', 'finance', 'hr', 'operations', 'engineering'

  -- Settings
  settings JSONB DEFAULT '{}',

  -- Status
  status TEXT DEFAULT 'active', -- 'active', 'archived'

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  UNIQUE(org_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_teams_org_id ON teams(org_id);
CREATE INDEX IF NOT EXISTS idx_teams_focus_area ON teams(focus_area);
CREATE INDEX IF NOT EXISTS idx_teams_status ON teams(status);

-- ============================================================================
-- TEAM MEMBERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL, -- Clerk user ID

  -- Role in team
  role TEXT NOT NULL DEFAULT 'member', -- 'lead', 'member'

  -- Timestamps
  joined_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),

  UNIQUE(team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);

-- ============================================================================
-- INVITES
-- ============================================================================

CREATE TABLE IF NOT EXISTS invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Invitee
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',

  -- Invitation Details
  token TEXT UNIQUE NOT NULL, -- Magic link token
  message TEXT, -- Optional personal message

  -- Inviter
  invited_by TEXT NOT NULL, -- User ID

  -- Status
  status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'expired', 'revoked'

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  accepted_at TIMESTAMP,
  revoked_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invites_org_id ON invites(org_id);
CREATE INDEX IF NOT EXISTS idx_invites_email ON invites(email);
CREATE INDEX IF NOT EXISTS idx_invites_token ON invites(token);
CREATE INDEX IF NOT EXISTS idx_invites_status ON invites(status);
CREATE INDEX IF NOT EXISTS idx_invites_expires_at ON invites(expires_at);

-- ============================================================================
-- ACTIVITY LOG (Organization-wide activity tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT, -- Who performed the action (null for system actions)

  -- Action Details
  action_type TEXT NOT NULL, -- 'deal.created', 'lead.assigned', 'payment.approved', etc.
  entity_type TEXT NOT NULL, -- 'deal', 'lead', 'supplier', 'payment', etc.
  entity_id TEXT NOT NULL, -- ID of the entity

  -- Metadata
  metadata JSONB DEFAULT '{}', -- Additional context about the action

  -- Changes (for audit trail)
  changes JSONB, -- Before/after values for updates

  -- IP and User Agent (for security audit)
  ip_address TEXT,
  user_agent TEXT,

  -- Timestamp
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_org_id ON activity_log(org_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON activity_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_action_type ON activity_log(action_type);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at DESC);

-- ============================================================================
-- PERMISSIONS (Role-based access control)
-- ============================================================================

CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Role
  role TEXT NOT NULL, -- 'owner', 'admin', 'member', 'viewer'

  -- Resource
  resource TEXT NOT NULL, -- 'deals', 'leads', 'suppliers', 'payments', 'treasury', 'settings'

  -- Actions
  can_view BOOLEAN DEFAULT FALSE,
  can_create BOOLEAN DEFAULT FALSE,
  can_edit BOOLEAN DEFAULT FALSE,
  can_delete BOOLEAN DEFAULT FALSE,
  can_approve BOOLEAN DEFAULT FALSE, -- For financial permissions

  -- Constraints
  constraints JSONB DEFAULT '{}', -- Additional constraints (e.g., "only assigned deals")

  UNIQUE(role, resource)
);

-- Seed default permissions
INSERT INTO permissions (role, resource, can_view, can_create, can_edit, can_delete, can_approve) VALUES
-- Owner permissions (full access)
('owner', 'deals', TRUE, TRUE, TRUE, TRUE, TRUE),
('owner', 'leads', TRUE, TRUE, TRUE, TRUE, FALSE),
('owner', 'suppliers', TRUE, TRUE, TRUE, TRUE, FALSE),
('owner', 'payments', TRUE, TRUE, TRUE, TRUE, TRUE),
('owner', 'treasury', TRUE, TRUE, TRUE, TRUE, TRUE),
('owner', 'settings', TRUE, TRUE, TRUE, TRUE, FALSE),
('owner', 'members', TRUE, TRUE, TRUE, TRUE, FALSE),
('owner', 'teams', TRUE, TRUE, TRUE, TRUE, FALSE),

-- Admin permissions (almost full access, limited treasury)
('admin', 'deals', TRUE, TRUE, TRUE, TRUE, TRUE),
('admin', 'leads', TRUE, TRUE, TRUE, TRUE, FALSE),
('admin', 'suppliers', TRUE, TRUE, TRUE, TRUE, FALSE),
('admin', 'payments', TRUE, TRUE, TRUE, FALSE, TRUE),
('admin', 'treasury', TRUE, FALSE, FALSE, FALSE, FALSE),
('admin', 'settings', TRUE, TRUE, TRUE, FALSE, FALSE),
('admin', 'members', TRUE, TRUE, TRUE, TRUE, FALSE),
('admin', 'teams', TRUE, TRUE, TRUE, TRUE, FALSE),

-- Member permissions (limited access)
('member', 'deals', TRUE, TRUE, TRUE, FALSE, FALSE),
('member', 'leads', TRUE, TRUE, TRUE, FALSE, FALSE),
('member', 'suppliers', TRUE, FALSE, FALSE, FALSE, FALSE),
('member', 'payments', TRUE, TRUE, FALSE, FALSE, FALSE),
('member', 'treasury', FALSE, FALSE, FALSE, FALSE, FALSE),
('member', 'settings', FALSE, FALSE, FALSE, FALSE, FALSE),
('member', 'members', TRUE, FALSE, FALSE, FALSE, FALSE),
('member', 'teams', TRUE, FALSE, FALSE, FALSE, FALSE),

-- Viewer permissions (read-only)
('viewer', 'deals', FALSE, FALSE, FALSE, FALSE, FALSE),
('viewer', 'leads', FALSE, FALSE, FALSE, FALSE, FALSE),
('viewer', 'suppliers', FALSE, FALSE, FALSE, FALSE, FALSE),
('viewer', 'payments', FALSE, FALSE, FALSE, FALSE, FALSE),
('viewer', 'treasury', FALSE, FALSE, FALSE, FALSE, FALSE),
('viewer', 'settings', FALSE, FALSE, FALSE, FALSE, FALSE),
('viewer', 'members', TRUE, FALSE, FALSE, FALSE, FALSE),
('viewer', 'teams', TRUE, FALSE, FALSE, FALSE, FALSE)
ON CONFLICT (role, resource) DO NOTHING;

-- ============================================================================
-- ASSIGNMENTS (Who is working on what)
-- ============================================================================

CREATE TABLE IF NOT EXISTS assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Entity being assigned
  entity_type TEXT NOT NULL, -- 'deal', 'lead', 'supplier_rfq', etc.
  entity_id TEXT NOT NULL, -- ID of the entity

  -- Assignment Details
  assigned_to TEXT NOT NULL, -- User ID
  assigned_by TEXT NOT NULL, -- User ID who made the assignment

  -- Status
  status TEXT DEFAULT 'active', -- 'active', 'completed', 'reassigned'

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,

  UNIQUE(entity_type, entity_id, assigned_to, status)
);

CREATE INDEX IF NOT EXISTS idx_assignments_assigned_to ON assignments(assigned_to);
CREATE INDEX IF NOT EXISTS idx_assignments_entity ON assignments(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON assignments(status);
CREATE INDEX IF NOT EXISTS idx_assignments_created_at ON assignments(created_at DESC);

-- ============================================================================
-- COMMENTS (Internal team discussions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Entity being commented on
  entity_type TEXT NOT NULL, -- 'deal', 'lead', 'supplier', etc.
  entity_id TEXT NOT NULL, -- ID of the entity

  -- Comment Details
  content TEXT NOT NULL,
  user_id TEXT NOT NULL, -- Who wrote the comment

  -- Threading
  parent_id UUID REFERENCES comments(id) ON DELETE CASCADE, -- For threaded replies

  -- Status
  is_internal BOOLEAN DEFAULT TRUE, -- Internal vs external (customer-visible)
  is_edited BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_entity ON comments(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at DESC);

-- ============================================================================
-- MENTIONS (Notifications via @mentions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL, -- Who was mentioned

  -- Status
  notified_at TIMESTAMP,
  read_at TIMESTAMP,

  -- Timestamp
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),

  UNIQUE(comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_mentions_user_id ON mentions(user_id);
CREATE INDEX IF NOT EXISTS idx_mentions_comment_id ON mentions(comment_id);
CREATE INDEX IF NOT EXISTS idx_mentions_notified_at ON mentions(notified_at);
CREATE INDEX IF NOT EXISTS idx_mentions_read_at ON mentions(read_at);

-- ============================================================================
-- HANDOFFS (Transfer conversations between team members)
-- ============================================================================

CREATE TABLE IF NOT EXISTS handoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Conversation/Entity being handed off
  entity_type TEXT NOT NULL, -- 'conversation', 'deal', 'lead'
  entity_id TEXT NOT NULL, -- ID of the entity

  -- Handoff Details
  from_user TEXT NOT NULL, -- User ID
  to_user TEXT NOT NULL, -- User ID
  reason TEXT, -- Why the handoff is happening
  message TEXT, -- Optional message to the recipient

  -- Status
  status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'declined'

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMP,
  declined_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_handoffs_org_id ON handoffs(org_id);
CREATE INDEX IF NOT EXISTS idx_handoffs_entity ON handoffs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_handoffs_from_user ON handoffs(from_user);
CREATE INDEX IF NOT EXISTS idx_handoffs_to_user ON handoffs(to_user);
CREATE INDEX IF NOT EXISTS idx_handoffs_status ON handoffs(status);
CREATE INDEX IF NOT EXISTS idx_handoffs_created_at ON handoffs(created_at DESC);

-- ============================================================================
-- SHARED CONTEXT (Team-shared knowledge)
-- ============================================================================

CREATE TABLE IF NOT EXISTS shared_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Context Details
  entity_type TEXT NOT NULL, -- 'deal', 'lead', 'supplier', 'customer'
  entity_id TEXT NOT NULL,

  -- Knowledge
  key TEXT NOT NULL, -- e.g., 'customer_preferences', 'negotiation_history'
  value JSONB NOT NULL, -- Structured data

  -- Visibility
  visibility TEXT DEFAULT 'organization', -- 'organization', 'team', 'private'
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE, -- If team-specific

  -- Author
  created_by TEXT NOT NULL,

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  UNIQUE(org_id, entity_type, entity_id, key)
);

CREATE INDEX IF NOT EXISTS idx_shared_context_org_id ON shared_context(org_id);
CREATE INDEX IF NOT EXISTS idx_shared_context_entity ON shared_context(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_shared_context_team_id ON shared_context(team_id);
CREATE INDEX IF NOT EXISTS idx_shared_context_visibility ON shared_context(visibility);

-- ============================================================================
-- NOTIFICATION PREFERENCES
-- ============================================================================

CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id TEXT NOT NULL UNIQUE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Channel Preferences
  email_enabled BOOLEAN DEFAULT TRUE,
  slack_enabled BOOLEAN DEFAULT FALSE,
  in_app_enabled BOOLEAN DEFAULT TRUE,

  -- Event Preferences
  notify_on_mention BOOLEAN DEFAULT TRUE,
  notify_on_assignment BOOLEAN DEFAULT TRUE,
  notify_on_handoff BOOLEAN DEFAULT TRUE,
  notify_on_deal_update BOOLEAN DEFAULT TRUE,
  notify_on_payment_approval BOOLEAN DEFAULT FALSE,

  -- Digest Settings
  daily_digest BOOLEAN DEFAULT FALSE,
  weekly_digest BOOLEAN DEFAULT TRUE,

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_org_id ON notification_preferences(org_id);

-- ============================================================================
-- AUDIT TRAIL (Comprehensive audit log for compliance)
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT, -- Who performed the action

  -- Action Details
  action TEXT NOT NULL, -- 'create', 'update', 'delete', 'approve', 'reject'
  resource_type TEXT NOT NULL, -- 'payment', 'deal', 'member'
  resource_id TEXT NOT NULL,

  -- Audit Data
  before_state JSONB, -- State before the action
  after_state JSONB, -- State after the action

  -- Context
  reason TEXT, -- Why this action was taken
  ip_address TEXT,
  user_agent TEXT,

  -- Timestamp
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_trail_org_id ON audit_trail(org_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_user_id ON audit_trail(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_resource ON audit_trail(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_created_at ON audit_trail(created_at DESC);
