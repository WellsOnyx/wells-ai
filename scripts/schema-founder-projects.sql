-- Founder Project Hub Schema
-- Comprehensive project management for founders with BOM, tasks, milestones, and financials

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE project_status AS ENUM (
    'draft',
    'planning',
    'active',
    'paused',
    'completed',
    'cancelled'
);

CREATE TYPE project_type AS ENUM (
    'product_launch',
    'service_delivery',
    'internal',
    'client_project'
);

CREATE TYPE project_visibility AS ENUM (
    'private',
    'team',
    'organization'
);

CREATE TYPE project_member_role AS ENUM (
    'owner',
    'lead',
    'member',
    'viewer'
);

CREATE TYPE bom_category AS ENUM (
    'raw_material',
    'component',
    'service',
    'equipment',
    'software'
);

CREATE TYPE bom_status AS ENUM (
    'needed',
    'rfq_sent',
    'quoted',
    'ordered',
    'received',
    'cancelled'
);

CREATE TYPE bom_priority AS ENUM (
    'critical',
    'high',
    'medium',
    'low'
);

CREATE TYPE milestone_status AS ENUM (
    'pending',
    'in_progress',
    'completed',
    'overdue'
);

CREATE TYPE financial_type AS ENUM (
    'budget_allocation',
    'expense',
    'income',
    'adjustment'
);

CREATE TYPE financial_category AS ENUM (
    'materials',
    'labor',
    'services',
    'overhead',
    'other'
);

CREATE TYPE activity_action AS ENUM (
    'created',
    'updated',
    'deleted',
    'member_added',
    'member_removed',
    'member_role_changed',
    'bom_added',
    'bom_updated',
    'bom_status_changed',
    'task_linked',
    'task_unlinked',
    'milestone_created',
    'milestone_completed',
    'milestone_overdue',
    'financial_recorded',
    'status_changed',
    'budget_updated'
);

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- 1. Projects - Core project entity
CREATE TABLE founder_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status project_status NOT NULL DEFAULT 'draft',
    budget_total DECIMAL(15, 2) DEFAULT 0,
    budget_spent DECIMAL(15, 2) DEFAULT 0,
    budget_remaining DECIMAL(15, 2) GENERATED ALWAYS AS (budget_total - budget_spent) STORED,
    start_date DATE,
    target_end_date DATE,
    actual_end_date DATE,
    project_type project_type NOT NULL DEFAULT 'internal',
    visibility project_visibility NOT NULL DEFAULT 'private',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT valid_dates CHECK (
        (target_end_date IS NULL OR start_date IS NULL OR target_end_date >= start_date) AND
        (actual_end_date IS NULL OR start_date IS NULL OR actual_end_date >= start_date)
    ),
    CONSTRAINT valid_budget CHECK (budget_total >= 0 AND budget_spent >= 0)
);

-- 2. Project Members - Team on the project
CREATE TABLE project_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES founder_projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    role project_member_role NOT NULL DEFAULT 'member',
    permissions JSONB DEFAULT '{
        "can_edit": false,
        "can_manage_members": false,
        "can_manage_budget": false,
        "can_approve_expenses": false,
        "can_create_rfqs": false
    }',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(project_id, user_id)
);

-- 3. Bill of Materials (BOM) - Materials/supplies needed
CREATE TABLE project_bom (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES founder_projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category bom_category NOT NULL DEFAULT 'component',
    quantity DECIMAL(15, 4) NOT NULL DEFAULT 1,
    unit VARCHAR(50) NOT NULL DEFAULT 'unit',
    unit_price_estimate DECIMAL(15, 2),
    supplier_id UUID,
    rfq_id UUID,
    status bom_status NOT NULL DEFAULT 'needed',
    priority bom_priority NOT NULL DEFAULT 'medium',
    lead_time_days INTEGER,
    required_by_date DATE,
    actual_price DECIMAL(15, 2),
    actual_quantity DECIMAL(15, 4),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT valid_quantities CHECK (quantity > 0 AND (actual_quantity IS NULL OR actual_quantity > 0)),
    CONSTRAINT valid_prices CHECK (
        (unit_price_estimate IS NULL OR unit_price_estimate >= 0) AND
        (actual_price IS NULL OR actual_price >= 0)
    )
);

-- 4. Project Tasks - Links to job marketplace tasks
CREATE TABLE project_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES founder_projects(id) ON DELETE CASCADE,
    task_id UUID NOT NULL,
    sequence_order INTEGER NOT NULL DEFAULT 0,
    dependency_ids UUID[] DEFAULT '{}',
    is_critical_path BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(project_id, task_id)
);

-- 5. Project Milestones - High-level project milestones
CREATE TABLE project_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES founder_projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    due_date DATE,
    completed_at TIMESTAMPTZ,
    status milestone_status NOT NULL DEFAULT 'pending',
    linked_bom_ids UUID[] DEFAULT '{}',
    linked_task_ids UUID[] DEFAULT '{}',
    budget_allocated DECIMAL(15, 2) DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT valid_milestone_budget CHECK (budget_allocated >= 0)
);

-- 6. Project Financials - Budget tracking
CREATE TABLE project_financials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES founder_projects(id) ON DELETE CASCADE,
    type financial_type NOT NULL,
    category financial_category NOT NULL DEFAULT 'other',
    amount DECIMAL(15, 2) NOT NULL,
    description TEXT,
    linked_bom_id UUID REFERENCES project_bom(id) ON DELETE SET NULL,
    linked_task_id UUID REFERENCES project_tasks(id) ON DELETE SET NULL,
    linked_rfq_id UUID,
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Project Activity Log - Audit trail
CREATE TABLE project_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES founder_projects(id) ON DELETE CASCADE,
    user_id UUID,
    action activity_action NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    old_value JSONB,
    new_value JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Owner lookups
CREATE INDEX idx_founder_projects_owner_id ON founder_projects(owner_id);
CREATE INDEX idx_founder_projects_owner_status ON founder_projects(owner_id, status);

-- Status filtering
CREATE INDEX idx_founder_projects_status ON founder_projects(status);
CREATE INDEX idx_founder_projects_type_status ON founder_projects(project_type, status);

-- Date range queries
CREATE INDEX idx_founder_projects_start_date ON founder_projects(start_date);
CREATE INDEX idx_founder_projects_target_end_date ON founder_projects(target_end_date);
CREATE INDEX idx_founder_projects_date_range ON founder_projects(start_date, target_end_date);

-- Project members
CREATE INDEX idx_project_members_project_id ON project_members(project_id);
CREATE INDEX idx_project_members_user_id ON project_members(user_id);
CREATE INDEX idx_project_members_user_role ON project_members(user_id, role);

-- BOM status tracking
CREATE INDEX idx_project_bom_project_id ON project_bom(project_id);
CREATE INDEX idx_project_bom_status ON project_bom(status);
CREATE INDEX idx_project_bom_project_status ON project_bom(project_id, status);
CREATE INDEX idx_project_bom_priority ON project_bom(priority);
CREATE INDEX idx_project_bom_required_by ON project_bom(required_by_date);
CREATE INDEX idx_project_bom_supplier ON project_bom(supplier_id) WHERE supplier_id IS NOT NULL;
CREATE INDEX idx_project_bom_rfq ON project_bom(rfq_id) WHERE rfq_id IS NOT NULL;

-- Project tasks
CREATE INDEX idx_project_tasks_project_id ON project_tasks(project_id);
CREATE INDEX idx_project_tasks_task_id ON project_tasks(task_id);
CREATE INDEX idx_project_tasks_critical_path ON project_tasks(project_id) WHERE is_critical_path = TRUE;
CREATE INDEX idx_project_tasks_sequence ON project_tasks(project_id, sequence_order);

-- Milestones
CREATE INDEX idx_project_milestones_project_id ON project_milestones(project_id);
CREATE INDEX idx_project_milestones_status ON project_milestones(status);
CREATE INDEX idx_project_milestones_due_date ON project_milestones(due_date);
CREATE INDEX idx_project_milestones_project_status ON project_milestones(project_id, status);

-- Financial aggregations
CREATE INDEX idx_project_financials_project_id ON project_financials(project_id);
CREATE INDEX idx_project_financials_type ON project_financials(type);
CREATE INDEX idx_project_financials_category ON project_financials(category);
CREATE INDEX idx_project_financials_project_type ON project_financials(project_id, type);
CREATE INDEX idx_project_financials_date ON project_financials(transaction_date);
CREATE INDEX idx_project_financials_project_date ON project_financials(project_id, transaction_date);
CREATE INDEX idx_project_financials_created_by ON project_financials(created_by);

-- Activity log
CREATE INDEX idx_project_activity_project_id ON project_activity_log(project_id);
CREATE INDEX idx_project_activity_user_id ON project_activity_log(user_id);
CREATE INDEX idx_project_activity_action ON project_activity_log(action);
CREATE INDEX idx_project_activity_created_at ON project_activity_log(created_at);
CREATE INDEX idx_project_activity_entity ON project_activity_log(entity_type, entity_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_founder_projects_updated_at
    BEFORE UPDATE ON founder_projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_bom_updated_at
    BEFORE UPDATE ON project_bom
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_tasks_updated_at
    BEFORE UPDATE ON project_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_milestones_updated_at
    BEFORE UPDATE ON project_milestones
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Auto-update budget_spent when financials change
CREATE OR REPLACE FUNCTION update_project_budget_spent()
RETURNS TRIGGER AS $$
DECLARE
    total_spent DECIMAL(15, 2);
BEGIN
    -- Calculate total expenses for the project
    SELECT COALESCE(SUM(
        CASE
            WHEN type = 'expense' THEN amount
            WHEN type = 'income' THEN -amount
            WHEN type = 'adjustment' THEN amount
            ELSE 0
        END
    ), 0)
    INTO total_spent
    FROM project_financials
    WHERE project_id = COALESCE(NEW.project_id, OLD.project_id);

    -- Update the project's budget_spent
    UPDATE founder_projects
    SET budget_spent = total_spent
    WHERE id = COALESCE(NEW.project_id, OLD.project_id);

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_budget_on_financial_insert
    AFTER INSERT ON project_financials
    FOR EACH ROW
    EXECUTE FUNCTION update_project_budget_spent();

CREATE TRIGGER trigger_update_budget_on_financial_delete
    AFTER DELETE ON project_financials
    FOR EACH ROW
    EXECUTE FUNCTION update_project_budget_spent();

-- Auto-update milestone status to overdue
CREATE OR REPLACE FUNCTION check_milestone_overdue()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status IN ('pending', 'in_progress')
       AND NEW.due_date IS NOT NULL
       AND NEW.due_date < CURRENT_DATE
       AND NEW.completed_at IS NULL THEN
        NEW.status = 'overdue';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_milestone_overdue
    BEFORE INSERT OR UPDATE ON project_milestones
    FOR EACH ROW
    EXECUTE FUNCTION check_milestone_overdue();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Calculate project budget status
CREATE OR REPLACE FUNCTION calculate_project_budget_status(p_project_id UUID)
RETURNS TABLE (
    budget_total DECIMAL(15, 2),
    budget_spent DECIMAL(15, 2),
    budget_remaining DECIMAL(15, 2),
    percent_used DECIMAL(5, 2),
    is_over_budget BOOLEAN,
    expenses_by_category JSONB,
    pending_bom_estimate DECIMAL(15, 2)
) AS $$
BEGIN
    RETURN QUERY
    WITH project_budget AS (
        SELECT
            p.budget_total,
            p.budget_spent,
            p.budget_remaining
        FROM founder_projects p
        WHERE p.id = p_project_id
    ),
    category_breakdown AS (
        SELECT jsonb_object_agg(
            pf.category::text,
            category_total
        ) as by_category
        FROM (
            SELECT
                category,
                SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as category_total
            FROM project_financials
            WHERE project_id = p_project_id
            GROUP BY category
        ) pf
    ),
    pending_bom AS (
        SELECT COALESCE(SUM(quantity * COALESCE(unit_price_estimate, 0)), 0) as pending_estimate
        FROM project_bom
        WHERE project_id = p_project_id
        AND status IN ('needed', 'rfq_sent', 'quoted')
    )
    SELECT
        pb.budget_total,
        pb.budget_spent,
        pb.budget_remaining,
        CASE
            WHEN pb.budget_total > 0 THEN ROUND((pb.budget_spent / pb.budget_total) * 100, 2)
            ELSE 0
        END as percent_used,
        pb.budget_spent > pb.budget_total as is_over_budget,
        COALESCE(cb.by_category, '{}'::jsonb) as expenses_by_category,
        pend.pending_estimate
    FROM project_budget pb
    CROSS JOIN category_breakdown cb
    CROSS JOIN pending_bom pend;
END;
$$ LANGUAGE plpgsql;

-- Get project timeline status
CREATE OR REPLACE FUNCTION get_project_timeline_status(p_project_id UUID)
RETURNS TABLE (
    start_date DATE,
    target_end_date DATE,
    actual_end_date DATE,
    days_elapsed INTEGER,
    days_remaining INTEGER,
    total_duration INTEGER,
    percent_time_elapsed DECIMAL(5, 2),
    on_track BOOLEAN,
    status_summary TEXT,
    overdue_milestones INTEGER,
    pending_milestones INTEGER,
    completed_milestones INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH project_dates AS (
        SELECT
            p.start_date,
            p.target_end_date,
            p.actual_end_date,
            p.status
        FROM founder_projects p
        WHERE p.id = p_project_id
    ),
    milestone_counts AS (
        SELECT
            COUNT(*) FILTER (WHERE status = 'overdue') as overdue_count,
            COUNT(*) FILTER (WHERE status IN ('pending', 'in_progress')) as pending_count,
            COUNT(*) FILTER (WHERE status = 'completed') as completed_count
        FROM project_milestones
        WHERE project_id = p_project_id
    )
    SELECT
        pd.start_date,
        pd.target_end_date,
        pd.actual_end_date,
        CASE
            WHEN pd.start_date IS NOT NULL THEN (CURRENT_DATE - pd.start_date)::INTEGER
            ELSE 0
        END as days_elapsed,
        CASE
            WHEN pd.target_end_date IS NOT NULL THEN (pd.target_end_date - CURRENT_DATE)::INTEGER
            ELSE NULL
        END as days_remaining,
        CASE
            WHEN pd.start_date IS NOT NULL AND pd.target_end_date IS NOT NULL
            THEN (pd.target_end_date - pd.start_date)::INTEGER
            ELSE NULL
        END as total_duration,
        CASE
            WHEN pd.start_date IS NOT NULL AND pd.target_end_date IS NOT NULL
                 AND pd.target_end_date > pd.start_date
            THEN ROUND(
                ((CURRENT_DATE - pd.start_date)::DECIMAL / (pd.target_end_date - pd.start_date)::DECIMAL) * 100,
                2
            )
            ELSE 0
        END as percent_time_elapsed,
        -- On track if: not overdue, no overdue milestones, and either no target date or target date is in future
        (pd.target_end_date IS NULL OR pd.target_end_date >= CURRENT_DATE)
            AND mc.overdue_count = 0
            AND pd.status NOT IN ('paused', 'cancelled') as on_track,
        CASE
            WHEN pd.status = 'completed' THEN 'Project completed'
            WHEN pd.status = 'cancelled' THEN 'Project cancelled'
            WHEN pd.status = 'paused' THEN 'Project paused'
            WHEN pd.target_end_date IS NOT NULL AND pd.target_end_date < CURRENT_DATE
                THEN 'Project overdue'
            WHEN mc.overdue_count > 0
                THEN 'Has overdue milestones'
            WHEN pd.target_end_date IS NOT NULL AND (pd.target_end_date - CURRENT_DATE) <= 7
                THEN 'Approaching deadline'
            ELSE 'On track'
        END as status_summary,
        mc.overdue_count::INTEGER as overdue_milestones,
        mc.pending_count::INTEGER as pending_milestones,
        mc.completed_count::INTEGER as completed_milestones
    FROM project_dates pd
    CROSS JOIN milestone_counts mc;
END;
$$ LANGUAGE plpgsql;

-- Get critical path items (BOM and tasks marked as critical)
CREATE OR REPLACE FUNCTION get_critical_path_items(p_project_id UUID)
RETURNS TABLE (
    item_type TEXT,
    item_id UUID,
    name TEXT,
    status TEXT,
    due_date DATE,
    is_blocking BOOLEAN,
    blocked_by UUID[],
    days_until_due INTEGER,
    priority TEXT
) AS $$
BEGIN
    RETURN QUERY
    -- Critical BOM items
    SELECT
        'bom'::TEXT as item_type,
        b.id as item_id,
        b.name::TEXT,
        b.status::TEXT,
        b.required_by_date as due_date,
        b.status IN ('needed', 'rfq_sent') as is_blocking,
        ARRAY[]::UUID[] as blocked_by,
        CASE
            WHEN b.required_by_date IS NOT NULL
            THEN (b.required_by_date - CURRENT_DATE)::INTEGER
            ELSE NULL
        END as days_until_due,
        b.priority::TEXT
    FROM project_bom b
    WHERE b.project_id = p_project_id
    AND b.priority = 'critical'
    AND b.status NOT IN ('received', 'cancelled')

    UNION ALL

    -- Critical path tasks
    SELECT
        'task'::TEXT as item_type,
        t.id as item_id,
        ('Task #' || t.sequence_order::TEXT)::TEXT as name,
        t.status::TEXT,
        NULL::DATE as due_date,
        t.status NOT IN ('completed', 'cancelled') as is_blocking,
        t.dependency_ids as blocked_by,
        NULL::INTEGER as days_until_due,
        'critical'::TEXT as priority
    FROM project_tasks t
    WHERE t.project_id = p_project_id
    AND t.is_critical_path = TRUE
    AND t.status NOT IN ('completed', 'cancelled')

    ORDER BY
        CASE WHEN days_until_due IS NOT NULL THEN days_until_due ELSE 9999 END ASC,
        priority ASC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ADDITIONAL HELPER VIEWS
-- ============================================================================

-- Project summary view
CREATE OR REPLACE VIEW v_project_summary AS
SELECT
    p.id,
    p.name,
    p.owner_id,
    p.status,
    p.project_type,
    p.budget_total,
    p.budget_spent,
    p.budget_remaining,
    CASE
        WHEN p.budget_total > 0 THEN ROUND((p.budget_spent / p.budget_total) * 100, 2)
        ELSE 0
    END as budget_percent_used,
    p.start_date,
    p.target_end_date,
    CASE
        WHEN p.target_end_date IS NOT NULL THEN (p.target_end_date - CURRENT_DATE)
        ELSE NULL
    END as days_remaining,
    (SELECT COUNT(*) FROM project_members pm WHERE pm.project_id = p.id) as member_count,
    (SELECT COUNT(*) FROM project_bom b WHERE b.project_id = p.id) as bom_item_count,
    (SELECT COUNT(*) FROM project_bom b WHERE b.project_id = p.id AND b.status = 'needed') as bom_pending_count,
    (SELECT COUNT(*) FROM project_tasks t WHERE t.project_id = p.id) as task_count,
    (SELECT COUNT(*) FROM project_milestones m WHERE m.project_id = p.id) as milestone_count,
    (SELECT COUNT(*) FROM project_milestones m WHERE m.project_id = p.id AND m.status = 'completed') as milestones_completed,
    (SELECT COUNT(*) FROM project_milestones m WHERE m.project_id = p.id AND m.status = 'overdue') as milestones_overdue,
    p.created_at,
    p.updated_at
FROM founder_projects p;

-- BOM status summary by project
CREATE OR REPLACE VIEW v_project_bom_summary AS
SELECT
    project_id,
    COUNT(*) as total_items,
    COUNT(*) FILTER (WHERE status = 'needed') as needed_count,
    COUNT(*) FILTER (WHERE status = 'rfq_sent') as rfq_sent_count,
    COUNT(*) FILTER (WHERE status = 'quoted') as quoted_count,
    COUNT(*) FILTER (WHERE status = 'ordered') as ordered_count,
    COUNT(*) FILTER (WHERE status = 'received') as received_count,
    COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_count,
    COUNT(*) FILTER (WHERE priority = 'critical') as critical_count,
    COALESCE(SUM(quantity * COALESCE(unit_price_estimate, 0)), 0) as estimated_total,
    COALESCE(SUM(COALESCE(actual_quantity, quantity) * COALESCE(actual_price, 0)), 0) as actual_total,
    MIN(required_by_date) FILTER (WHERE status NOT IN ('received', 'cancelled')) as next_required_date
FROM project_bom
GROUP BY project_id;

-- ============================================================================
-- SAMPLE DATA SEEDING FUNCTION (for development/testing)
-- ============================================================================

CREATE OR REPLACE FUNCTION seed_sample_project(p_owner_id UUID)
RETURNS UUID AS $$
DECLARE
    v_project_id UUID;
    v_bom_id UUID;
    v_milestone_id UUID;
BEGIN
    -- Create sample project
    INSERT INTO founder_projects (
        owner_id, name, description, status, project_type,
        budget_total, start_date, target_end_date
    ) VALUES (
        p_owner_id,
        'Sample Product Launch',
        'A sample project for demonstration purposes',
        'planning',
        'product_launch',
        50000.00,
        CURRENT_DATE,
        CURRENT_DATE + INTERVAL '90 days'
    ) RETURNING id INTO v_project_id;

    -- Add owner as project member
    INSERT INTO project_members (project_id, user_id, role, permissions)
    VALUES (
        v_project_id,
        p_owner_id,
        'owner',
        '{"can_edit": true, "can_manage_members": true, "can_manage_budget": true, "can_approve_expenses": true, "can_create_rfqs": true}'
    );

    -- Add sample BOM items
    INSERT INTO project_bom (project_id, name, category, quantity, unit, unit_price_estimate, priority, required_by_date)
    VALUES
        (v_project_id, 'Raw Materials Package', 'raw_material', 100, 'kg', 25.00, 'high', CURRENT_DATE + INTERVAL '14 days'),
        (v_project_id, 'Electronic Components', 'component', 500, 'unit', 5.50, 'critical', CURRENT_DATE + INTERVAL '21 days'),
        (v_project_id, 'Design Software License', 'software', 1, 'license', 299.99, 'medium', CURRENT_DATE + INTERVAL '7 days');

    -- Add sample milestones
    INSERT INTO project_milestones (project_id, name, description, due_date, status)
    VALUES
        (v_project_id, 'Design Complete', 'All product designs finalized and approved', CURRENT_DATE + INTERVAL '30 days', 'pending'),
        (v_project_id, 'Prototype Ready', 'First working prototype assembled', CURRENT_DATE + INTERVAL '60 days', 'pending'),
        (v_project_id, 'Launch Ready', 'Product ready for market launch', CURRENT_DATE + INTERVAL '90 days', 'pending');

    -- Add initial budget allocation
    INSERT INTO project_financials (project_id, type, category, amount, description, created_by)
    VALUES (v_project_id, 'budget_allocation', 'materials', 20000.00, 'Initial materials budget', p_owner_id);

    -- Log creation activity
    INSERT INTO project_activity_log (project_id, user_id, action, entity_type, entity_id, new_value)
    VALUES (v_project_id, p_owner_id, 'created', 'project', v_project_id,
        jsonb_build_object('name', 'Sample Product Launch', 'status', 'planning'));

    RETURN v_project_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PERMISSIONS (Row Level Security ready)
-- ============================================================================

-- Enable RLS on all tables (uncomment when ready to use)
-- ALTER TABLE founder_projects ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE project_bom ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE project_tasks ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE project_milestones ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE project_financials ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE project_activity_log ENABLE ROW LEVEL SECURITY;

-- Example RLS policies (uncomment and customize as needed)
-- CREATE POLICY project_owner_access ON founder_projects
--     FOR ALL
--     USING (owner_id = current_user_id() OR EXISTS (
--         SELECT 1 FROM project_members
--         WHERE project_id = founder_projects.id
--         AND user_id = current_user_id()
--     ));

COMMENT ON TABLE founder_projects IS 'Core project entity for the Founder Project Hub';
COMMENT ON TABLE project_members IS 'Team members assigned to projects with role-based permissions';
COMMENT ON TABLE project_bom IS 'Bill of Materials tracking for project supplies and components';
COMMENT ON TABLE project_tasks IS 'Links projects to job marketplace tasks';
COMMENT ON TABLE project_milestones IS 'High-level project milestones with due dates';
COMMENT ON TABLE project_financials IS 'Budget tracking and financial transactions';
COMMENT ON TABLE project_activity_log IS 'Audit trail for all project activities';

COMMENT ON FUNCTION calculate_project_budget_status IS 'Returns comprehensive budget status including spent, remaining, and category breakdown';
COMMENT ON FUNCTION get_project_timeline_status IS 'Returns timeline analysis including days remaining and on-track status';
COMMENT ON FUNCTION get_critical_path_items IS 'Returns all critical path BOM items and tasks that may block project completion';
