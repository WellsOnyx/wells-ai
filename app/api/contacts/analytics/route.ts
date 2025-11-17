import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { Pool } from '@vercel/postgres';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

// GET /api/contacts/analytics - Get comprehensive contact analytics
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const metric = searchParams.get('metric'); // specific metric or 'all'
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    let analytics: any = {};

    // If no specific metric requested, return all analytics
    const metricsToFetch = metric && metric !== 'all' ? [metric] : [
      'overview',
      'by_source',
      'by_relationship',
      'by_company',
      'by_role',
      'by_location',
      'engagement',
      'growth',
      'conversion',
    ];

    for (const metricName of metricsToFetch) {
      switch (metricName) {
        case 'overview':
          analytics.overview = await getOverview(userId);
          break;
        case 'by_source':
          analytics.by_source = await getBySource(userId);
          break;
        case 'by_relationship':
          analytics.by_relationship = await getByRelationship(userId);
          break;
        case 'by_company':
          analytics.by_company = await getByCompany(userId);
          break;
        case 'by_role':
          analytics.by_role = await getByRole(userId);
          break;
        case 'by_location':
          analytics.by_location = await getByLocation(userId);
          break;
        case 'engagement':
          analytics.engagement = await getEngagement(userId);
          break;
        case 'growth':
          analytics.growth = await getGrowth(userId, startDate, endDate);
          break;
        case 'conversion':
          analytics.conversion = await getConversion(userId);
          break;
      }
    }

    return NextResponse.json({ analytics });
  } catch (error: any) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics', details: error.message },
      { status: 500 }
    );
  }
}

// Overview metrics
async function getOverview(userId: string): Promise<any> {
  const result = await pool.query(
    `
    SELECT
      COUNT(*) as total_contacts,
      COUNT(*) FILTER (WHERE status = 'active') as active_contacts,
      COUNT(*) FILTER (WHERE status = 'inactive') as inactive_contacts,
      COUNT(*) FILTER (WHERE status = 'archived') as archived_contacts,
      AVG(importance_score)::numeric(10,2) as avg_importance_score,
      COUNT(*) FILTER (WHERE last_contact_date >= NOW() - INTERVAL '30 days') as contacted_last_30d,
      COUNT(*) FILTER (WHERE last_contact_date >= NOW() - INTERVAL '90 days') as contacted_last_90d,
      COUNT(*) FILTER (WHERE last_contact_date IS NULL OR last_contact_date < NOW() - INTERVAL '90 days') as dormant,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as new_this_week,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') as new_this_month
    FROM contacts
    WHERE user_id = $1
    `,
    [userId]
  );

  return result.rows[0];
}

// Contacts by source
async function getBySource(userId: string): Promise<any> {
  const result = await pool.query(
    `
    SELECT
      COALESCE(cs.name, 'Unknown') as source,
      COUNT(c.id) as total,
      COUNT(c.id) FILTER (WHERE c.status = 'active') as active,
      AVG(c.importance_score)::numeric(10,2) as avg_importance,
      MIN(c.created_at) as first_contact_date,
      MAX(c.created_at) as most_recent_date
    FROM contacts c
    LEFT JOIN contact_sources cs ON c.source_id = cs.id
    WHERE c.user_id = $1
    GROUP BY cs.name
    ORDER BY total DESC
    `,
    [userId]
  );

  return result.rows;
}

// Contacts by relationship type
async function getByRelationship(userId: string): Promise<any> {
  const result = await pool.query(
    `
    SELECT
      COALESCE(relationship_type, 'Unknown') as relationship_type,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'active') as active,
      AVG(importance_score)::numeric(10,2) as avg_importance,
      AVG(total_messages_received)::numeric(10,2) as avg_messages_received,
      AVG(total_messages_sent)::numeric(10,2) as avg_messages_sent,
      COUNT(*) FILTER (WHERE last_contact_date >= NOW() - INTERVAL '30 days') as active_last_30d
    FROM contacts
    WHERE user_id = $1
    GROUP BY relationship_type
    ORDER BY total DESC
    `,
    [userId]
  );

  return result.rows;
}

// Top companies
async function getByCompany(userId: string): Promise<any> {
  const result = await pool.query(
    `
    SELECT
      company,
      COUNT(*) as contact_count,
      AVG(importance_score)::numeric(10,2) as avg_importance,
      ARRAY_AGG(DISTINCT relationship_type) FILTER (WHERE relationship_type IS NOT NULL) as relationship_types,
      MAX(last_contact_date) as most_recent_contact
    FROM contacts
    WHERE user_id = $1 AND company IS NOT NULL AND company != ''
    GROUP BY company
    ORDER BY contact_count DESC, avg_importance DESC
    LIMIT 50
    `,
    [userId]
  );

  return result.rows;
}

// Top roles/titles
async function getByRole(userId: string): Promise<any> {
  const result = await pool.query(
    `
    SELECT
      role,
      COUNT(*) as contact_count,
      AVG(importance_score)::numeric(10,2) as avg_importance,
      ARRAY_AGG(DISTINCT relationship_type) FILTER (WHERE relationship_type IS NOT NULL) as relationship_types
    FROM contacts
    WHERE user_id = $1 AND role IS NOT NULL AND role != ''
    GROUP BY role
    ORDER BY contact_count DESC
    LIMIT 50
    `,
    [userId]
  );

  return result.rows;
}

// Location-based analytics (if we add location field)
async function getByLocation(userId: string): Promise<any> {
  // For now, return empty array since location isn't in the schema
  // This can be populated if location field is added to contacts
  return [];
}

// Engagement metrics
async function getEngagement(userId: string): Promise<any> {
  const result = await pool.query(
    `
    SELECT
      COUNT(*) as total_contacts,
      -- Message engagement
      SUM(total_messages_received) as total_messages_received,
      SUM(total_messages_sent) as total_messages_sent,
      AVG(total_messages_received)::numeric(10,2) as avg_messages_per_contact,

      -- Response time
      AVG(avg_response_time_minutes)::numeric(10,2) as avg_response_time_minutes,

      -- Channel preferences
      COUNT(*) FILTER (WHERE preferred_channel = 'email') as prefer_email,
      COUNT(*) FILTER (WHERE preferred_channel = 'slack') as prefer_slack,
      COUNT(*) FILTER (WHERE preferred_channel = 'sms') as prefer_sms,
      COUNT(*) FILTER (WHERE preferred_channel = 'discord') as prefer_discord,
      COUNT(*) FILTER (WHERE preferred_channel = 'teams') as prefer_teams,

      -- Engagement levels
      COUNT(*) FILTER (WHERE total_messages_received = 0) as no_engagement,
      COUNT(*) FILTER (WHERE total_messages_received BETWEEN 1 AND 5) as low_engagement,
      COUNT(*) FILTER (WHERE total_messages_received BETWEEN 6 AND 20) as medium_engagement,
      COUNT(*) FILTER (WHERE total_messages_received > 20) as high_engagement,

      -- Recent activity
      COUNT(*) FILTER (WHERE last_contact_date >= NOW() - INTERVAL '7 days') as active_last_7d,
      COUNT(*) FILTER (WHERE last_contact_date >= NOW() - INTERVAL '30 days') as active_last_30d,
      COUNT(*) FILTER (WHERE last_contact_date >= NOW() - INTERVAL '90 days') as active_last_90d
    FROM contacts
    WHERE user_id = $1 AND status = 'active'
    `,
    [userId]
  );

  return result.rows[0];
}

// Growth over time
async function getGrowth(
  userId: string,
  startDate?: string | null,
  endDate?: string | null
): Promise<any> {
  // Default to last 90 days if no dates provided
  const start = startDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const end = endDate || new Date().toISOString();

  const result = await pool.query(
    `
    SELECT
      DATE(created_at) as date,
      COUNT(*) as new_contacts,
      SUM(COUNT(*)) OVER (ORDER BY DATE(created_at)) as cumulative_total
    FROM contacts
    WHERE user_id = $1
      AND created_at >= $2
      AND created_at <= $3
    GROUP BY DATE(created_at)
    ORDER BY date
    `,
    [userId, start, end]
  );

  // Also get weekly summary
  const weeklyResult = await pool.query(
    `
    SELECT
      DATE_TRUNC('week', created_at) as week,
      COUNT(*) as new_contacts,
      ARRAY_AGG(DISTINCT relationship_type) FILTER (WHERE relationship_type IS NOT NULL) as relationship_types
    FROM contacts
    WHERE user_id = $1
      AND created_at >= $2
      AND created_at <= $3
    GROUP BY DATE_TRUNC('week', created_at)
    ORDER BY week
    `,
    [userId, start, end]
  );

  return {
    daily: result.rows,
    weekly: weeklyResult.rows,
  };
}

// Conversion funnel (if we track stages)
async function getConversion(userId: string): Promise<any> {
  // This is a placeholder for conversion tracking
  // You can enhance this based on your specific conversion stages
  const result = await pool.query(
    `
    SELECT
      relationship_type,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE importance_score >= 80) as high_value,
      COUNT(*) FILTER (WHERE total_messages_received > 0) as engaged,
      COUNT(*) FILTER (WHERE total_messages_received > 5) as highly_engaged
    FROM contacts
    WHERE user_id = $1 AND status = 'active'
    GROUP BY relationship_type
    ORDER BY total DESC
    `,
    [userId]
  );

  return {
    by_relationship: result.rows,
    summary: {
      total_contacts: result.rows.reduce((sum, row) => sum + parseInt(row.total), 0),
      high_value: result.rows.reduce((sum, row) => sum + parseInt(row.high_value), 0),
      engaged: result.rows.reduce((sum, row) => sum + parseInt(row.engaged), 0),
      highly_engaged: result.rows.reduce((sum, row) => sum + parseInt(row.highly_engaged), 0),
    },
  };
}

// POST /api/contacts/analytics - Trigger analytics refresh
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Refresh materialized views
    await pool.query('SELECT refresh_contact_analytics()');

    return NextResponse.json({
      success: true,
      message: 'Analytics refreshed successfully',
    });
  } catch (error: any) {
    console.error('Error refreshing analytics:', error);
    return NextResponse.json(
      { error: 'Failed to refresh analytics', details: error.message },
      { status: 500 }
    );
  }
}
