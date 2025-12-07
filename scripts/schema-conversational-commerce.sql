-- ============================================================================
-- CONVERSATIONAL COMMERCE ENGINE
-- "Just Ask. We'll Handle It."
-- ============================================================================
--
-- THE VISION:
-- Procurement shouldn't require logging into 5 systems and filling out forms.
-- Just message: "I need 500 boxes of latex gloves by Friday"
-- We handle the rest.
--
-- CHANNELS:
-- - Slack (primary enterprise channel)
-- - Microsoft Teams (enterprise alt)
-- - Discord (small business/startup)
-- - SMS/WhatsApp (mobile)
-- - Web chat widget
-- - Voice (future)
--
-- CAPABILITIES:
-- - Search supplier catalog
-- - Get pricing quotes
-- - Create requisitions/POs
-- - Check order status
-- - Reorder previous items
-- - Spend analytics
-- - GRAIN balance & rewards
-- - Approve pending orders
--
-- ============================================================================

-- ============================================================================
-- WORKSPACE & CHANNEL INTEGRATIONS
-- ============================================================================

-- Workspace integrations (one per Slack workspace, Teams org, etc.)
CREATE TABLE IF NOT EXISTS chat_workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Customer link
  customer_id UUID REFERENCES erp_customers(id),

  -- Platform details
  platform VARCHAR(30) NOT NULL CHECK (platform IN (
    'slack', 'teams', 'discord', 'whatsapp', 'sms', 'web'
  )),

  -- External IDs
  external_workspace_id VARCHAR(255) NOT NULL, -- Slack team_id, Teams tenant_id, etc.
  external_workspace_name VARCHAR(255),

  -- OAuth tokens (encrypted in production)
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  bot_user_id VARCHAR(100), -- Our bot's ID in the workspace

  -- Webhook URLs
  incoming_webhook_url TEXT,

  -- Settings
  settings JSONB DEFAULT '{
    "default_approval_channel": null,
    "notify_on_ship": true,
    "notify_on_invoice": true,
    "auto_approve_under": 500,
    "require_cost_center": false,
    "default_ship_to": null
  }',

  -- Status
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN (
    'pending_auth', 'active', 'disconnected', 'suspended'
  )),

  -- Usage
  messages_processed INTEGER DEFAULT 0,
  orders_created INTEGER DEFAULT 0,
  last_activity_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (platform, external_workspace_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_customer ON chat_workspaces(customer_id);
CREATE INDEX IF NOT EXISTS idx_workspace_platform ON chat_workspaces(platform);

-- User mappings (link chat users to ERP users/roles)
CREATE TABLE IF NOT EXISTS chat_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES chat_workspaces(id),

  -- External identity
  external_user_id VARCHAR(255) NOT NULL, -- Slack user_id, etc.
  external_username VARCHAR(255),
  external_email VARCHAR(255),
  external_display_name VARCHAR(255),

  -- Internal identity
  erp_user_id VARCHAR(255),

  -- Permissions
  can_browse BOOLEAN DEFAULT TRUE,
  can_create_orders BOOLEAN DEFAULT TRUE,
  can_approve_orders BOOLEAN DEFAULT FALSE,
  approval_limit DECIMAL(20,2) DEFAULT 500,

  -- Preferences
  preferences JSONB DEFAULT '{
    "default_cost_center": null,
    "default_ship_to": null,
    "notification_level": "all"
  }',

  -- Activity
  last_message_at TIMESTAMPTZ,
  total_messages INTEGER DEFAULT 0,
  total_orders INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (workspace_id, external_user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_user_workspace ON chat_users(workspace_id);

-- ============================================================================
-- CONVERSATIONS & MESSAGES
-- ============================================================================

-- Conversations (threads)
CREATE TABLE IF NOT EXISTS chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES chat_workspaces(id),
  user_id UUID NOT NULL REFERENCES chat_users(id),

  -- Channel/thread info
  channel_id VARCHAR(255),
  thread_ts VARCHAR(255), -- Slack thread timestamp

  -- Conversation state
  state VARCHAR(30) DEFAULT 'active' CHECK (state IN (
    'active',         -- Ongoing
    'waiting_input',  -- Waiting for user response
    'processing',     -- AI processing
    'completed',      -- Finished
    'abandoned'       -- User left
  )),

  -- Context (what we're working on)
  context JSONB DEFAULT '{
    "intent": null,
    "entities": {},
    "cart": [],
    "pending_action": null
  }',

  -- Outcomes
  orders_created UUID[] DEFAULT '{}',

  -- Timing
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conv_workspace ON chat_conversations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_conv_user ON chat_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conv_state ON chat_conversations(state);

-- Individual messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES chat_conversations(id),

  -- Direction
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('inbound', 'outbound')),

  -- Content
  content TEXT NOT NULL,
  content_type VARCHAR(20) DEFAULT 'text' CHECK (content_type IN (
    'text', 'image', 'file', 'card', 'action'
  )),

  -- Attachments/rich content
  attachments JSONB DEFAULT '[]',

  -- If outbound, what generated it
  generated_by VARCHAR(30) CHECK (generated_by IN (
    'ai', 'template', 'system', 'human_agent'
  )),

  -- Platform message ID (for updates/reactions)
  external_message_id VARCHAR(255),

  -- Processing results (for inbound)
  intent VARCHAR(100),
  intent_confidence DECIMAL(5,4),
  entities JSONB DEFAULT '{}',

  -- Timing
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_msg_conversation ON chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_msg_intent ON chat_messages(intent);

-- ============================================================================
-- INTENT RECOGNITION & NLU
-- ============================================================================

-- Recognized intents
CREATE TABLE IF NOT EXISTS chat_intents (
  id VARCHAR(100) PRIMARY KEY,

  -- Categorization
  category VARCHAR(50) NOT NULL,

  -- Description
  display_name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Examples for training/reference
  example_phrases TEXT[] DEFAULT '{}',

  -- Handler
  handler_function VARCHAR(255),
  requires_confirmation BOOLEAN DEFAULT FALSE,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed intents
INSERT INTO chat_intents (id, category, display_name, description, example_phrases, handler_function, requires_confirmation) VALUES
  -- Product search
  ('search_products', 'catalog', 'Search Products', 'Search for products in the catalog',
   ARRAY['find latex gloves', 'search for office chairs', 'looking for safety glasses', 'show me 3M products'],
   'handleProductSearch', FALSE),

  -- Pricing
  ('get_pricing', 'catalog', 'Get Pricing', 'Get pricing for specific products',
   ARRAY['how much for 500 gloves', 'price check on SKU 12345', 'what''s our cost on these'],
   'handlePricing', FALSE),

  -- Order creation
  ('create_order', 'ordering', 'Create Order', 'Create a new purchase order',
   ARRAY['order 500 boxes of gloves', 'I need to buy office supplies', 'place an order for'],
   'handleCreateOrder', TRUE),

  -- Reorder
  ('reorder', 'ordering', 'Reorder Previous', 'Reorder items from a previous order',
   ARRAY['reorder last month''s supplies', 'order the same as before', 'repeat my last order'],
   'handleReorder', TRUE),

  -- Order status
  ('order_status', 'tracking', 'Order Status', 'Check status of an order',
   ARRAY['where is my order', 'status of PO 12345', 'when will my order arrive', 'track my shipment'],
   'handleOrderStatus', FALSE),

  -- Spend analytics
  ('spend_analytics', 'analytics', 'Spend Analytics', 'Get spending reports and analytics',
   ARRAY['how much did we spend', 'show me IT spend this quarter', 'what are our top categories'],
   'handleSpendAnalytics', FALSE),

  -- GRAIN balance
  ('grain_balance', 'rewards', 'GRAIN Balance', 'Check GRAIN token balance',
   ARRAY['what''s my GRAIN balance', 'how much GRAIN do I have', 'show my rewards'],
   'handleGrainBalance', FALSE),

  -- Approvals
  ('approve_order', 'workflow', 'Approve Order', 'Approve a pending order',
   ARRAY['approve order', 'approve PO 12345', 'yes, approve it'],
   'handleApproval', TRUE),

  ('reject_order', 'workflow', 'Reject Order', 'Reject a pending order',
   ARRAY['reject order', 'deny this order', 'no, reject it'],
   'handleRejection', TRUE),

  -- Help
  ('help', 'support', 'Help', 'Get help with using the system',
   ARRAY['help', 'what can you do', 'how do I', 'commands'],
   'handleHelp', FALSE),

  -- Greetings
  ('greeting', 'social', 'Greeting', 'Respond to greetings',
   ARRAY['hi', 'hello', 'hey', 'good morning'],
   'handleGreeting', FALSE),

  -- Unknown
  ('unknown', 'other', 'Unknown Intent', 'Unable to determine intent',
   '{}'::TEXT[],
   'handleUnknown', FALSE)

ON CONFLICT (id) DO NOTHING;

-- Entity types we extract
CREATE TABLE IF NOT EXISTS chat_entity_types (
  id VARCHAR(50) PRIMARY KEY,
  display_name VARCHAR(100) NOT NULL,
  extraction_patterns TEXT[], -- Regex patterns
  validation_function VARCHAR(255),
  examples TEXT[]
);

INSERT INTO chat_entity_types (id, display_name, extraction_patterns, examples) VALUES
  ('quantity', 'Quantity', ARRAY['\d+\s*(units?|boxes?|cases?|each)?', 'a dozen', 'hundred'],
   ARRAY['500', '100 boxes', '50 units']),
  ('product', 'Product Name', ARRAY['[a-zA-Z]+ [a-zA-Z]+'],
   ARRAY['latex gloves', 'safety glasses', 'office chairs']),
  ('sku', 'SKU/Part Number', ARRAY['SKU-?\d+', '[A-Z]{2,4}-?\d{4,}'],
   ARRAY['SKU-12345', 'GLOVE-001', '3M-7502']),
  ('po_number', 'PO Number', ARRAY['PO-?\d+', 'order #?\d+'],
   ARRAY['PO-123456', 'order #7890']),
  ('date', 'Date', ARRAY['\d{1,2}/\d{1,2}(/\d{2,4})?', 'today', 'tomorrow', 'next week', 'friday'],
   ARRAY['12/25', 'next Friday', 'tomorrow']),
  ('cost_center', 'Cost Center', ARRAY['CC-?\d+', 'cost center \d+'],
   ARRAY['CC-100', 'cost center 500']),
  ('category', 'Category', ARRAY['MRO', 'office', 'IT', 'safety', 'janitorial'],
   ARRAY['MRO', 'office supplies', 'IT equipment']),
  ('money', 'Money Amount', ARRAY['\$[\d,]+(\.\d{2})?', '\d+ dollars'],
   ARRAY['$500', '$1,234.56'])
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- PROCUREMENT ACTIONS (Orders created via chat)
-- ============================================================================

-- Chat-originated orders
CREATE TABLE IF NOT EXISTS chat_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES chat_conversations(id),
  user_id UUID NOT NULL REFERENCES chat_users(id),

  -- Link to actual order (once created)
  order_id UUID REFERENCES intercept_orders(id),

  -- Order details (before submission)
  status VARCHAR(30) DEFAULT 'draft' CHECK (status IN (
    'draft',           -- Being built
    'pending_confirm', -- Waiting for user to confirm
    'pending_approval',-- Needs manager approval
    'approved',        -- Ready to submit
    'submitted',       -- Sent to ERP
    'completed',       -- Order fulfilled
    'cancelled'        -- User cancelled
  )),

  -- Cart contents
  items JSONB DEFAULT '[]',
  /*
    [
      {
        "sku": "GLOVE-001",
        "description": "Latex Gloves, Medium",
        "quantity": 500,
        "unit_price": 12.99,
        "line_total": 6495.00,
        "supplier_id": "uuid"
      }
    ]
  */

  -- Totals
  subtotal DECIMAL(20,2) DEFAULT 0,
  estimated_shipping DECIMAL(20,2) DEFAULT 0,
  estimated_tax DECIMAL(20,2) DEFAULT 0,
  total DECIMAL(20,2) DEFAULT 0,

  -- Delivery
  ship_to JSONB,
  requested_delivery_date DATE,

  -- Approval workflow
  requires_approval BOOLEAN DEFAULT FALSE,
  approver_user_id UUID REFERENCES chat_users(id),
  approved_at TIMESTAMPTZ,
  approval_notes TEXT,

  -- Cost allocation
  cost_center VARCHAR(100),
  project_code VARCHAR(100),

  -- Metadata
  created_via_intent VARCHAR(100),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_orders_conv ON chat_orders(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_orders_user ON chat_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_orders_status ON chat_orders(status);

-- ============================================================================
-- QUICK RESPONSES & TEMPLATES
-- ============================================================================

-- Canned responses
CREATE TABLE IF NOT EXISTS chat_responses (
  id VARCHAR(100) PRIMARY KEY,

  -- Trigger
  trigger_intent VARCHAR(100) REFERENCES chat_intents(id),
  trigger_condition JSONB DEFAULT '{}', -- Additional conditions

  -- Content
  response_template TEXT NOT NULL,
  -- Supports variables: {{user_name}}, {{order_total}}, {{grain_balance}}, etc.

  -- Formatting
  include_buttons BOOLEAN DEFAULT FALSE,
  buttons JSONB DEFAULT '[]',
  /*
    [
      {"text": "Yes, place order", "action": "confirm_order"},
      {"text": "Cancel", "action": "cancel"}
    ]
  */

  -- Priority (higher = preferred)
  priority INTEGER DEFAULT 100,

  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed common responses
INSERT INTO chat_responses (id, trigger_intent, response_template, include_buttons, buttons) VALUES
  ('greeting_default', 'greeting',
   'Hi {{user_name}}! I''m here to help with your procurement needs. You can:\n• Search for products\n• Check order status\n• Create new orders\n• View your GRAIN rewards\n\nWhat can I help you with?',
   FALSE, '[]'),

  ('help_default', 'help',
   'Here''s what I can do:\n\n📦 **Orders**\n• "Order 500 latex gloves"\n• "Reorder last month''s supplies"\n• "Where is my order PO-12345?"\n\n🔍 **Search**\n• "Find 3M safety glasses"\n• "Price check on SKU-001"\n\n📊 **Analytics**\n• "Show IT spend this quarter"\n• "What''s my GRAIN balance?"\n\n✅ **Approvals**\n• "Show pending approvals"\n• "Approve PO-12345"\n\nJust ask naturally - I''ll figure it out!',
   FALSE, '[]'),

  ('confirm_order', 'create_order',
   'Ready to place your order:\n\n{{order_summary}}\n\n**Total: ${{order_total}}**\n\nShall I submit this order?',
   TRUE, '[{"text": "✅ Submit Order", "action": "submit_order"}, {"text": "✏️ Modify", "action": "modify_order"}, {"text": "❌ Cancel", "action": "cancel_order"}]'),

  ('order_created', 'create_order',
   '✅ Order submitted!\n\n**PO Number:** {{po_number}}\n**Total:** ${{order_total}}\n**Expected Delivery:** {{delivery_date}}\n\nYou earned **{{grain_earned}} GRAIN** on this order! 🌾\n\nI''ll notify you when it ships.',
   FALSE, '[]'),

  ('grain_balance_response', 'grain_balance',
   '🌾 **Your GRAIN Balance**\n\n**Current Balance:** {{grain_balance}} GRAIN\n**Value:** ${{grain_value}}\n**This Month Earned:** {{grain_month}} GRAIN\n\nGRAIN appreciates as our hard asset portfolio grows. Current rate: ${{grain_price}}/GRAIN',
   TRUE, '[{"text": "View Rewards History", "action": "view_rewards"}, {"text": "How GRAIN Works", "action": "explain_grain"}]'),

  ('unknown_intent', 'unknown',
   'I''m not sure I understood that. Could you try rephrasing? Or type "help" to see what I can do.',
   FALSE, '[]')

ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- FUNCTIONS: CONVERSATION PROCESSING
-- ============================================================================

-- Process incoming message
CREATE OR REPLACE FUNCTION process_chat_message(
  p_workspace_id UUID,
  p_user_external_id VARCHAR(255),
  p_channel_id VARCHAR(255),
  p_content TEXT,
  p_thread_ts VARCHAR(255) DEFAULT NULL
)
RETURNS TABLE (
  message_id UUID,
  conversation_id UUID,
  detected_intent VARCHAR(100),
  confidence DECIMAL(5,4),
  entities JSONB,
  response_text TEXT,
  response_buttons JSONB
) AS $$
DECLARE
  v_user_id UUID;
  v_conv_id UUID;
  v_msg_id UUID;
  v_intent VARCHAR(100) := 'unknown';
  v_confidence DECIMAL(5,4) := 0;
  v_entities JSONB := '{}';
  v_response RECORD;
BEGIN
  -- Get or create user
  SELECT id INTO v_user_id FROM chat_users
  WHERE workspace_id = p_workspace_id AND external_user_id = p_user_external_id;

  IF NOT FOUND THEN
    INSERT INTO chat_users (workspace_id, external_user_id)
    VALUES (p_workspace_id, p_user_external_id)
    RETURNING id INTO v_user_id;
  END IF;

  -- Get or create conversation
  SELECT id INTO v_conv_id FROM chat_conversations
  WHERE workspace_id = p_workspace_id
  AND user_id = v_user_id
  AND channel_id = p_channel_id
  AND (p_thread_ts IS NULL OR thread_ts = p_thread_ts)
  AND state IN ('active', 'waiting_input')
  AND last_message_at > NOW() - INTERVAL '30 minutes';

  IF NOT FOUND THEN
    INSERT INTO chat_conversations (workspace_id, user_id, channel_id, thread_ts)
    VALUES (p_workspace_id, v_user_id, p_channel_id, p_thread_ts)
    RETURNING id INTO v_conv_id;
  END IF;

  -- Simple intent detection (in production, use ML/Claude)
  -- This is a placeholder - real implementation would call AI
  SELECT
    CASE
      WHEN LOWER(p_content) ~ '(hi|hello|hey|good morning|good afternoon)' THEN 'greeting'
      WHEN LOWER(p_content) ~ '(help|what can you|how do i)' THEN 'help'
      WHEN LOWER(p_content) ~ '(order|buy|purchase|need to get)' THEN 'create_order'
      WHEN LOWER(p_content) ~ '(reorder|same as|repeat|again)' THEN 'reorder'
      WHEN LOWER(p_content) ~ '(where is|status|track|when will)' THEN 'order_status'
      WHEN LOWER(p_content) ~ '(search|find|looking for|show me)' THEN 'search_products'
      WHEN LOWER(p_content) ~ '(price|cost|how much)' THEN 'get_pricing'
      WHEN LOWER(p_content) ~ '(grain|balance|rewards)' THEN 'grain_balance'
      WHEN LOWER(p_content) ~ '(spend|analytics|report)' THEN 'spend_analytics'
      WHEN LOWER(p_content) ~ '(approve|yes.*order)' THEN 'approve_order'
      WHEN LOWER(p_content) ~ '(reject|deny|no.*order)' THEN 'reject_order'
      ELSE 'unknown'
    END,
    0.75
  INTO v_intent, v_confidence;

  -- Extract entities (simplified)
  v_entities := jsonb_build_object(
    'quantities', (SELECT jsonb_agg(match[1]) FROM regexp_matches(p_content, '(\d+)\s*(boxes?|units?|each)?', 'gi') AS match),
    'mentioned_sku', (SELECT jsonb_agg(match[1]) FROM regexp_matches(p_content, '(SKU-?\d+|[A-Z]{2,4}-\d{4,})', 'gi') AS match)
  );

  -- Store message
  INSERT INTO chat_messages (
    conversation_id, direction, content, intent, intent_confidence, entities
  ) VALUES (
    v_conv_id, 'inbound', p_content, v_intent, v_confidence, v_entities
  )
  RETURNING id INTO v_msg_id;

  -- Update conversation
  UPDATE chat_conversations SET
    last_message_at = NOW(),
    context = context || jsonb_build_object('last_intent', v_intent, 'last_entities', v_entities)
  WHERE id = v_conv_id;

  -- Update user activity
  UPDATE chat_users SET
    last_message_at = NOW(),
    total_messages = total_messages + 1
  WHERE id = v_user_id;

  -- Get response template
  SELECT * INTO v_response FROM chat_responses
  WHERE trigger_intent = v_intent AND is_active = TRUE
  ORDER BY priority DESC LIMIT 1;

  RETURN QUERY SELECT
    v_msg_id,
    v_conv_id,
    v_intent,
    v_confidence,
    v_entities,
    COALESCE(v_response.response_template, 'I''m processing your request...'),
    COALESCE(v_response.buttons, '[]'::JSONB);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VIEWS: CHAT ANALYTICS
-- ============================================================================

-- Workspace activity summary
CREATE OR REPLACE VIEW workspace_activity AS
SELECT
  cw.id,
  cw.platform,
  cw.external_workspace_name,
  ec.company_name as customer_name,
  cw.status,
  cw.messages_processed,
  cw.orders_created,
  cw.last_activity_at,
  (SELECT COUNT(*) FROM chat_users WHERE workspace_id = cw.id) as total_users,
  (SELECT COUNT(*) FROM chat_conversations WHERE workspace_id = cw.id
   AND created_at > NOW() - INTERVAL '7 days') as conversations_7d
FROM chat_workspaces cw
LEFT JOIN erp_customers ec ON cw.customer_id = ec.id;

-- Intent analytics
CREATE OR REPLACE VIEW intent_analytics AS
SELECT
  intent,
  COUNT(*) as message_count,
  AVG(intent_confidence) as avg_confidence,
  COUNT(DISTINCT conversation_id) as unique_conversations,
  DATE(sent_at) as message_date
FROM chat_messages
WHERE direction = 'inbound' AND intent IS NOT NULL
GROUP BY intent, DATE(sent_at)
ORDER BY message_date DESC, message_count DESC;

-- User engagement
CREATE OR REPLACE VIEW user_engagement AS
SELECT
  cu.id,
  cu.external_username,
  cu.external_display_name,
  cw.platform,
  cu.total_messages,
  cu.total_orders,
  cu.last_message_at,
  cu.approval_limit,
  (SELECT COUNT(*) FROM chat_orders WHERE user_id = cu.id AND status = 'completed') as completed_orders,
  (SELECT SUM(total) FROM chat_orders WHERE user_id = cu.id AND status = 'completed') as total_spend
FROM chat_users cu
JOIN chat_workspaces cw ON cu.workspace_id = cw.id;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE chat_workspaces IS 'Slack/Teams/Discord workspace integrations';
COMMENT ON TABLE chat_users IS 'Users mapped from chat platforms to ERP permissions';
COMMENT ON TABLE chat_conversations IS 'Conversation threads with context tracking';
COMMENT ON TABLE chat_messages IS 'Individual messages with NLU analysis';
COMMENT ON TABLE chat_intents IS 'Recognized intents and their handlers';
COMMENT ON TABLE chat_orders IS 'Orders created through conversational interface';
COMMENT ON TABLE chat_responses IS 'Template responses for common intents';

COMMENT ON FUNCTION process_chat_message IS 'Main entry point for processing incoming chat messages';

-- ============================================================================
-- THE EXPERIENCE
-- ============================================================================
--
-- USER: "Hey, I need to order some safety equipment"
-- BOT: "Hi Sarah! I can help with that. What safety equipment do you need?"
--
-- USER: "500 pairs of latex gloves and 50 safety glasses"
-- BOT: "Found some options:
--
--       🧤 Latex Gloves (500 count)
--       • 3M Model 5502 - $89.99 (Best Value)
--       • Ansell TouchNTuff - $94.50
--
--       👓 Safety Glasses (50 count)
--       • 3M SecureFit - $245.00 (In Stock)
--       • Honeywell Uvex - $198.50 (Ships 3 days)
--
--       Want me to add these to your cart?"
--
-- USER: "Yes, the 3M options for both"
-- BOT: "Added to cart:
--       • 3M Latex Gloves x500 - $89.99
--       • 3M SecureFit Glasses x50 - $245.00
--
--       Subtotal: $334.99
--       Est. Shipping: $12.50
--       Total: $347.49
--
--       [Submit Order] [Modify] [Cancel]"
--
-- USER: *clicks Submit Order*
-- BOT: "✅ Order PO-78901 submitted!
--       Expected delivery: Dec 12
--       You earned 35 GRAIN on this order! 🌾"
--
-- THAT'S IT. NO FORMS. NO LOGINS. JUST CONVERSATION.
-- ============================================================================
