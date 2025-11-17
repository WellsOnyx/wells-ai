# Contacts Database - Quick Start Guide

## Setup (5 minutes)

### 1. Run Database Migration

```bash
# Make sure you have POSTGRES_URL set
export POSTGRES_URL="your-postgres-connection-string"

# Run Phase 3 schema
psql $POSTGRES_URL -f scripts/schema-contacts-advanced.sql
```

### 2. Verify Setup

```bash
# Check tables were created
psql $POSTGRES_URL -c "\dt contact*"

# Should show:
# - contacts (Phase 1)
# - contact_campaigns
# - campaign_contacts
# - contact_interactions
# - contact_tags
# - contact_tag_assignments
# - contact_custom_fields
# - contact_custom_field_values
# - contact_notes
# - contact_sources
```

## Test the APIs

### Get Clerk Auth Token

```bash
# Login to your app and grab token from browser DevTools
# Look for: Authorization: Bearer <token>
export CLERK_TOKEN="your-clerk-token"
```

### 1. Create a Campaign

```bash
curl -X POST http://localhost:3000/api/contacts/campaigns \
  -H "Authorization: Bearer $CLERK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My First Campaign",
    "description": "Testing campaign creation",
    "status": "draft",
    "filters": {
      "relationship_type": "customer"
    }
  }'
```

### 2. Get Analytics

```bash
curl http://localhost:3000/api/contacts/analytics?metric=overview \
  -H "Authorization: Bearer $CLERK_TOKEN"
```

### 3. Export Contacts

```bash
# First, get some contact IDs
curl http://localhost:3000/api/contacts/list?limit=5 \
  -H "Authorization: Bearer $CLERK_TOKEN"

# Then export them
curl -X POST http://localhost:3000/api/contacts/bulk \
  -H "Authorization: Bearer $CLERK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "operation": "export",
    "contact_ids": ["id1", "id2", "id3"],
    "data": {
      "format": "csv"
    }
  }'
```

### 4. Log an Interaction

```bash
curl -X POST http://localhost:3000/api/contacts/{contact-id}/interactions \
  -H "Authorization: Bearer $CLERK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "call",
    "subject": "Product Demo",
    "description": "Showed new features, customer very interested",
    "outcome": "success",
    "interaction_date": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
    "duration_minutes": 30
  }'
```

## Common Workflows

### Create Campaign and Add Contacts

```javascript
// 1. Create campaign
const campaign = await fetch('/api/contacts/campaigns', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'Q1 Outreach',
    filters: {
      relationship_type: 'customer',
      importance_score: { min: 70 }
    },
    auto_populate: true // Automatically add matching contacts
  })
}).then(r => r.json());

// 2. View contacts in campaign
const details = await fetch(`/api/contacts/campaigns/${campaign.campaign.id}`)
  .then(r => r.json());

console.log(`Campaign has ${details.campaign.contact_count} contacts`);
```

### Bulk Update Contacts

```javascript
// Update multiple contacts at once
await fetch('/api/contacts/bulk', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    operation: 'update',
    contact_ids: ['id1', 'id2', 'id3'],
    data: {
      importance_score: 90,
      relationship_type: 'partner'
    }
  })
});
```

### Get Comprehensive Analytics

```javascript
// Get all analytics
const analytics = await fetch('/api/contacts/analytics?metric=all')
  .then(r => r.json());

console.log('Overview:', analytics.analytics.overview);
console.log('By Source:', analytics.analytics.by_source);
console.log('Engagement:', analytics.analytics.engagement);
console.log('Growth:', analytics.analytics.growth);
```

### Track Full Interaction Timeline

```javascript
// Log interaction
await fetch(`/api/contacts/${contactId}/interactions`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    type: 'meeting',
    subject: 'Partnership Discussion',
    description: 'Discussed potential partnership opportunity',
    outcome: 'success',
    interaction_date: new Date().toISOString(),
    duration_minutes: 60,
    metadata: {
      attendees: ['John Doe', 'Jane Smith'],
      next_steps: ['Send proposal', 'Schedule follow-up']
    }
  })
});

// Get full timeline
const timeline = await fetch(`/api/contacts/${contactId}/interactions`)
  .then(r => r.json());

console.log(`${timeline.statistics.total_interactions} total interactions`);
console.log(`${timeline.statistics.call_count} calls`);
console.log(`${timeline.statistics.meeting_count} meetings`);
```

## Frontend Integration Examples

### React Campaign Manager

```jsx
import { useState, useEffect } from 'react';

function CampaignManager() {
  const [campaigns, setCampaigns] = useState([]);

  useEffect(() => {
    fetch('/api/contacts/campaigns')
      .then(r => r.json())
      .then(data => setCampaigns(data.campaigns));
  }, []);

  async function createCampaign(name, filters) {
    const response = await fetch('/api/contacts/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        filters,
        auto_populate: true
      })
    });
    const data = await response.json();
    setCampaigns([...campaigns, data.campaign]);
  }

  return (
    <div>
      <h2>Campaigns</h2>
      {campaigns.map(campaign => (
        <div key={campaign.id}>
          <h3>{campaign.name}</h3>
          <p>{campaign.contact_count} contacts</p>
          <p>Status: {campaign.status}</p>
        </div>
      ))}
    </div>
  );
}
```

### React Analytics Dashboard

```jsx
import { useState, useEffect } from 'react';

function AnalyticsDashboard() {
  const [analytics, setAnalytics] = useState(null);

  useEffect(() => {
    fetch('/api/contacts/analytics?metric=all')
      .then(r => r.json())
      .then(data => setAnalytics(data.analytics));
  }, []);

  if (!analytics) return <div>Loading...</div>;

  return (
    <div>
      <h2>Contact Analytics</h2>

      <div className="overview">
        <h3>Overview</h3>
        <p>Total Contacts: {analytics.overview.total_contacts}</p>
        <p>Active: {analytics.overview.active_contacts}</p>
        <p>Contacted Last 30d: {analytics.overview.contacted_last_30d}</p>
        <p>New This Month: {analytics.overview.new_this_month}</p>
      </div>

      <div className="engagement">
        <h3>Engagement</h3>
        <p>High Engagement: {analytics.engagement.high_engagement}</p>
        <p>Medium Engagement: {analytics.engagement.medium_engagement}</p>
        <p>Low Engagement: {analytics.engagement.low_engagement}</p>
      </div>

      <div className="by-source">
        <h3>By Source</h3>
        {analytics.by_source.map(source => (
          <div key={source.source}>
            <strong>{source.source}</strong>: {source.total} contacts
          </div>
        ))}
      </div>
    </div>
  );
}
```

### React Interaction Timeline

```jsx
import { useState, useEffect } from 'react';

function InteractionTimeline({ contactId }) {
  const [interactions, setInteractions] = useState([]);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetch(`/api/contacts/${contactId}/interactions`)
      .then(r => r.json())
      .then(data => {
        setInteractions(data.interactions);
        setStats(data.statistics);
      });
  }, [contactId]);

  async function logInteraction(type, subject, description) {
    const response = await fetch(`/api/contacts/${contactId}/interactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        subject,
        description,
        interaction_date: new Date().toISOString()
      })
    });
    const data = await response.json();
    setInteractions([data.interaction, ...interactions]);
  }

  return (
    <div>
      <h3>Interaction Timeline</h3>

      {stats && (
        <div className="stats">
          <p>Total: {stats.total_interactions}</p>
          <p>Calls: {stats.call_count}</p>
          <p>Meetings: {stats.meeting_count}</p>
          <p>Emails: {stats.email_count}</p>
        </div>
      )}

      <div className="timeline">
        {interactions.map(interaction => (
          <div key={interaction.id} className="interaction">
            <div className="type">{interaction.type}</div>
            <div className="subject">{interaction.subject}</div>
            <div className="date">
              {new Date(interaction.interaction_date).toLocaleDateString()}
            </div>
            <div className="description">{interaction.description}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

## Environment Variables

Make sure these are set:

```bash
# .env.local
POSTGRES_URL="postgresql://..."
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
```

## Troubleshooting

### "Unauthorized" Error
- Make sure Clerk token is valid
- Check token is in Authorization header: `Bearer <token>`
- Verify Clerk middleware is set up correctly

### "Contact not found" Error
- Verify contact belongs to authenticated user
- Check contact ID is a valid UUID
- Ensure contact exists in database

### Slow Analytics Queries
- Run: `POST /api/contacts/analytics` to refresh materialized views
- Check indexes exist: `\di contact*` in psql
- Consider adding more specific indexes for your use case

### Campaign Not Auto-Populating
- Verify filters match existing contacts
- Check contacts have `status = 'active'`
- Ensure `auto_populate: true` is set

## Performance Tips

1. **Use pagination** - Always set `limit` and `offset` for large datasets
2. **Refresh analytics** - Run daily cron job to refresh materialized views
3. **Bulk operations** - Use bulk endpoints instead of loops
4. **Filter early** - Use campaign filters to target specific contacts
5. **Index usage** - Add custom indexes for your specific query patterns

## Next Steps

1. Read full documentation: `CONTACTS_PHASE3_DOCUMENTATION.md`
2. Review implementation: `PHASE3_IMPLEMENTATION_SUMMARY.md`
3. Build your UI using the API examples above
4. Set up analytics dashboard
5. Create your first campaign!

## Support

For questions or issues:
1. Check the full documentation
2. Review error messages carefully
3. Test with curl/Postman first
4. Verify database schema is correct

---

**Ready to go!** Start building your contact management system. 🚀
