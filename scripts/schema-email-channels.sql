-- ============================================================================
-- EMAIL CHANNELS SCHEMA
-- Comprehensive email system for WellsAI
--
-- Supports:
-- 1. Native email (Wells sends as Wells)
-- 2. Passthrough email (Wells sends as User via Gmail/Outlook)
-- 3. Inbound processing (receiving and routing emails)
-- ============================================================================

-- ============================================================================
-- CONNECTED EMAIL ACCOUNTS (Gmail, Outlook OAuth)
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,

    -- Provider info
    provider TEXT NOT NULL CHECK (provider IN ('gmail', 'outlook')),
    email TEXT NOT NULL,
    display_name TEXT,

    -- OAuth tokens (encrypted at rest)
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    token_expiry TIMESTAMPTZ NOT NULL,

    -- User preferences
    signature TEXT,                    -- User's email signature
    is_default BOOLEAN DEFAULT false,  -- Primary sending account

    -- Health tracking
    is_active BOOLEAN DEFAULT true,
    is_valid BOOLEAN DEFAULT true,     -- Set false on persistent auth failures
    bounce_count INTEGER DEFAULT 0,
    last_bounce_at TIMESTAMPTZ,
    last_sync_at TIMESTAMPTZ,
    last_error TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    UNIQUE(user_id, email)
);

CREATE INDEX idx_email_accounts_user ON email_accounts(user_id);
CREATE INDEX idx_email_accounts_email ON email_accounts(email);
CREATE INDEX idx_email_accounts_active ON email_accounts(user_id, is_active) WHERE is_active = true;

-- ============================================================================
-- EMAIL THREADS (Conversation grouping)
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,

    -- Thread info
    subject TEXT NOT NULL,
    participants TEXT[] NOT NULL,      -- Email addresses involved

    -- Status
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'snoozed', 'spam')),
    labels TEXT[],                     -- User-defined labels
    is_starred BOOLEAN DEFAULT false,
    is_read BOOLEAN DEFAULT true,

    -- Counters
    message_count INTEGER DEFAULT 0,
    unread_count INTEGER DEFAULT 0,

    -- Timeline
    first_message_at TIMESTAMPTZ,
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    snoozed_until TIMESTAMPTZ,

    -- Metadata
    metadata JSONB,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_threads_user ON email_threads(user_id);
CREATE INDEX idx_email_threads_status ON email_threads(user_id, status);
CREATE INDEX idx_email_threads_last_message ON email_threads(user_id, last_message_at DESC);
CREATE INDEX idx_email_threads_participants ON email_threads USING GIN(participants);

-- ============================================================================
-- EMAIL MESSAGES (Individual emails)
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID REFERENCES email_threads(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,

    -- Sender info
    sender_type TEXT NOT NULL CHECK (sender_type IN ('wells', 'user', 'external')),
    account_id UUID REFERENCES email_accounts(id),  -- For passthrough sends

    -- Email addresses
    from_email TEXT NOT NULL,
    to_email TEXT NOT NULL,            -- Comma-separated for multiple
    cc_emails TEXT,
    bcc_emails TEXT,
    reply_to TEXT,

    -- Content
    subject TEXT NOT NULL,
    html_body TEXT,
    text_body TEXT,
    snippet TEXT,                      -- Preview text

    -- Threading headers
    in_reply_to TEXT,
    references_header TEXT,
    message_id_header TEXT,            -- Original Message-ID header

    -- Provider references
    resend_message_id TEXT,            -- Resend's message ID
    provider_message_id TEXT,          -- Gmail/Outlook message ID
    provider_thread_id TEXT,           -- Gmail/Outlook thread ID

    -- Status
    status TEXT DEFAULT 'sent' CHECK (status IN (
        'draft', 'queued', 'sending', 'sent', 'delivered',
        'failed', 'bounced', 'complained'
    )),
    error_message TEXT,

    -- Tracking
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,

    -- Attachments
    has_attachments BOOLEAN DEFAULT false,
    attachment_count INTEGER DEFAULT 0,

    -- Metadata
    metadata JSONB,
    tags TEXT[],

    -- Timestamps
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_messages_thread ON email_messages(thread_id);
CREATE INDEX idx_email_messages_user ON email_messages(user_id);
CREATE INDEX idx_email_messages_from ON email_messages(from_email);
CREATE INDEX idx_email_messages_to ON email_messages(to_email);
CREATE INDEX idx_email_messages_resend ON email_messages(resend_message_id);
CREATE INDEX idx_email_messages_status ON email_messages(status);
CREATE INDEX idx_email_messages_sent ON email_messages(user_id, sent_at DESC);
CREATE INDEX idx_email_messages_sender_type ON email_messages(user_id, sender_type, sent_at DESC);

-- ============================================================================
-- EMAIL EVENTS (Opens, clicks, bounces, etc.)
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID REFERENCES email_messages(id) ON DELETE CASCADE,
    resend_message_id TEXT,            -- Link to Resend's message

    -- Event details
    event_type TEXT NOT NULL CHECK (event_type IN (
        'sent', 'delivered', 'opened', 'clicked',
        'bounced', 'complained', 'unsubscribed'
    )),

    -- Event data
    event_data JSONB,
    ip_address TEXT,
    user_agent TEXT,
    link_url TEXT,                     -- For click events

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_events_message ON email_events(message_id);
CREATE INDEX idx_email_events_resend ON email_events(resend_message_id);
CREATE INDEX idx_email_events_type ON email_events(event_type);
CREATE INDEX idx_email_events_created ON email_events(created_at DESC);

-- ============================================================================
-- EMAIL TEMPLATES (Reusable templates)
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT,                      -- NULL for system templates

    -- Template info
    name TEXT NOT NULL,
    description TEXT,
    context TEXT NOT NULL CHECK (context IN (
        'cold_outreach', 'follow_up', 'notification',
        'meeting_request', 'deal_update', 'custom'
    )),

    -- Content
    subject TEXT NOT NULL,
    html_body TEXT NOT NULL,
    text_body TEXT,
    variables TEXT[],                  -- List of {{variable}} placeholders

    -- Usage stats
    use_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,

    -- Status
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, name)
);

CREATE INDEX idx_email_templates_user ON email_templates(user_id);
CREATE INDEX idx_email_templates_context ON email_templates(context);

-- ============================================================================
-- EMAIL UNSUBSCRIBES (Opt-outs)
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_unsubscribes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,

    -- Unsubscribe details
    reason TEXT CHECK (reason IN (
        'user_request', 'complaint', 'bounce', 'inbound_request'
    )),
    source_message_id UUID,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_unsubscribes_email ON email_unsubscribes(email);

-- ============================================================================
-- EMAIL INBOUND LOG (Processed incoming emails)
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_inbound_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Original email data
    message_id TEXT NOT NULL,
    from_email TEXT NOT NULL,
    from_name TEXT,
    to_emails TEXT[],
    subject TEXT,
    text_body TEXT,
    html_body TEXT,

    -- Classification
    intent TEXT CHECK (intent IN (
        'interested', 'not_interested', 'question', 'meeting_request',
        'meeting_confirmation', 'information', 'follow_up',
        'unsubscribe', 'out_of_office', 'bounce', 'spam', 'unknown'
    )),
    confidence DECIMAL(3,2),
    sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),
    urgency TEXT CHECK (urgency IN ('high', 'medium', 'low')),
    summary TEXT,

    -- Linking
    linked_thread_id UUID REFERENCES email_threads(id),
    linked_contact_id UUID,

    -- Processing
    auto_responded BOOLEAN DEFAULT false,
    auto_response_id UUID REFERENCES email_messages(id),
    requires_review BOOLEAN DEFAULT false,
    reviewed_by TEXT,
    review_notes TEXT,
    reviewed_at TIMESTAMPTZ,

    -- Raw data
    raw_payload JSONB,

    -- Timestamps
    received_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_inbound_from ON email_inbound_log(from_email);
CREATE INDEX idx_email_inbound_intent ON email_inbound_log(intent);
CREATE INDEX idx_email_inbound_review ON email_inbound_log(requires_review) WHERE requires_review = true;
CREATE INDEX idx_email_inbound_processed ON email_inbound_log(processed_at DESC);

-- ============================================================================
-- EMAIL ANALYTICS (Daily aggregates)
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_analytics_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    user_id TEXT,                      -- NULL for system-wide

    -- Counts by event
    event_type TEXT NOT NULL,
    count INTEGER DEFAULT 0,

    -- Unique constraint
    UNIQUE(date, user_id, event_type)
);

CREATE INDEX idx_email_analytics_date ON email_analytics_daily(date);
CREATE INDEX idx_email_analytics_user ON email_analytics_daily(user_id, date);

-- ============================================================================
-- INTEGRATION EVENTS (OAuth connection logs)
-- ============================================================================

CREATE TABLE IF NOT EXISTS integration_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    event TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_integration_events_user ON integration_events(user_id);
CREATE INDEX idx_integration_events_provider ON integration_events(provider, event);

-- ============================================================================
-- WEBHOOK LOGS (Debugging)
-- ============================================================================

CREATE TABLE IF NOT EXISTS webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL,
    payload JSONB,
    processed BOOLEAN DEFAULT false,
    error TEXT,
    received_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhook_logs_type ON webhook_logs(type);
CREATE INDEX idx_webhook_logs_received ON webhook_logs(received_at DESC);

-- ============================================================================
-- CONTACTS (For email relationship tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT,

    -- Contact info
    email TEXT NOT NULL,
    name TEXT,
    company TEXT,
    title TEXT,
    phone TEXT,
    linkedin_url TEXT,

    -- Source
    source TEXT CHECK (source IN (
        'manual', 'inbound_email', 'csv_import', 'linkedin', 'crm_sync', 'website'
    )),
    source_id TEXT,

    -- Email health
    email_valid BOOLEAN DEFAULT true,
    last_email_sent TIMESTAMPTZ,
    last_email_received TIMESTAMPTZ,
    email_count_sent INTEGER DEFAULT 0,
    email_count_received INTEGER DEFAULT 0,
    last_opened_at TIMESTAMPTZ,
    last_clicked_at TIMESTAMPTZ,
    last_replied_at TIMESTAMPTZ,

    -- Status
    status TEXT DEFAULT 'active' CHECK (status IN (
        'active', 'unsubscribed', 'bounced', 'blocked'
    )),

    -- Metadata
    tags TEXT[],
    metadata JSONB,
    notes TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, email)
);

CREATE INDEX idx_contacts_user ON contacts(user_id);
CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_company ON contacts(company);
CREATE INDEX idx_contacts_status ON contacts(status);
CREATE INDEX idx_contacts_tags ON contacts USING GIN(tags);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Update thread counters when messages are added
CREATE OR REPLACE FUNCTION update_thread_counters()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE email_threads SET
            message_count = message_count + 1,
            last_message_at = COALESCE(NEW.sent_at, NOW()),
            unread_count = CASE
                WHEN NEW.sender_type = 'external' AND NOT NEW.is_read
                THEN unread_count + 1
                ELSE unread_count
            END,
            updated_at = NOW()
        WHERE id = NEW.thread_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_thread_counters ON email_messages;
CREATE TRIGGER trigger_update_thread_counters
    AFTER INSERT ON email_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_thread_counters();

-- Update contact email stats
CREATE OR REPLACE FUNCTION update_contact_email_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.sender_type = 'wells' OR NEW.sender_type = 'user' THEN
        UPDATE contacts SET
            last_email_sent = COALESCE(NEW.sent_at, NOW()),
            email_count_sent = email_count_sent + 1,
            updated_at = NOW()
        WHERE email = NEW.to_email;
    ELSIF NEW.sender_type = 'external' THEN
        UPDATE contacts SET
            last_email_received = COALESCE(NEW.sent_at, NOW()),
            email_count_received = email_count_received + 1,
            updated_at = NOW()
        WHERE email = NEW.from_email;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_contact_email_stats ON email_messages;
CREATE TRIGGER trigger_update_contact_email_stats
    AFTER INSERT ON email_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_contact_email_stats();

-- Update timestamps automatically
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_email_accounts_updated ON email_accounts;
CREATE TRIGGER trigger_email_accounts_updated
    BEFORE UPDATE ON email_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_email_threads_updated ON email_threads;
CREATE TRIGGER trigger_email_threads_updated
    BEFORE UPDATE ON email_threads
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_email_messages_updated ON email_messages;
CREATE TRIGGER trigger_email_messages_updated
    BEFORE UPDATE ON email_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_contacts_updated ON contacts;
CREATE TRIGGER trigger_contacts_updated
    BEFORE UPDATE ON contacts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Active email accounts view
CREATE OR REPLACE VIEW active_email_accounts AS
SELECT
    ea.*,
    (SELECT COUNT(*) FROM email_messages WHERE account_id = ea.id) as message_count
FROM email_accounts ea
WHERE ea.is_active = true AND ea.is_valid = true;

-- Email performance by user
CREATE OR REPLACE VIEW email_performance_summary AS
SELECT
    user_id,
    COUNT(*) FILTER (WHERE status IN ('sent', 'delivered')) as sent,
    COUNT(*) FILTER (WHERE status = 'delivered') as delivered,
    COUNT(DISTINCT em.id) FILTER (WHERE EXISTS (
        SELECT 1 FROM email_events ee
        WHERE ee.message_id = em.id AND ee.event_type = 'opened'
    )) as opened,
    COUNT(DISTINCT em.id) FILTER (WHERE EXISTS (
        SELECT 1 FROM email_events ee
        WHERE ee.message_id = em.id AND ee.event_type = 'clicked'
    )) as clicked,
    COUNT(*) FILTER (WHERE status = 'bounced') as bounced,
    COUNT(*) FILTER (WHERE status = 'complained') as complained
FROM email_messages em
WHERE em.sender_type IN ('wells', 'user')
  AND em.sent_at >= NOW() - INTERVAL '30 days'
GROUP BY user_id;

-- Pending inbound reviews view
CREATE OR REPLACE VIEW pending_email_reviews AS
SELECT
    eil.*,
    c.name as contact_name,
    c.company as contact_company
FROM email_inbound_log eil
LEFT JOIN contacts c ON c.email = eil.from_email
WHERE eil.requires_review = true
ORDER BY
    CASE eil.urgency
        WHEN 'high' THEN 1
        WHEN 'medium' THEN 2
        WHEN 'low' THEN 3
    END,
    eil.processed_at DESC;

-- ============================================================================
-- GRANTS (adjust for your user)
-- ============================================================================

-- GRANT ALL ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO your_app_user;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE email_accounts IS 'Connected Gmail/Outlook accounts for passthrough sending';
COMMENT ON TABLE email_threads IS 'Email conversation threads, grouping related messages';
COMMENT ON TABLE email_messages IS 'Individual email messages, both sent and received';
COMMENT ON TABLE email_events IS 'Tracking events: opens, clicks, bounces, etc.';
COMMENT ON TABLE email_templates IS 'Reusable email templates with variable substitution';
COMMENT ON TABLE email_unsubscribes IS 'Opt-out list - never send to these addresses';
COMMENT ON TABLE email_inbound_log IS 'Processed incoming emails with intent classification';
COMMENT ON TABLE contacts IS 'Contact database with email engagement tracking';
