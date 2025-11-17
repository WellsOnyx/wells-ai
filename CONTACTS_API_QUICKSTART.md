# Contacts API Quick Start Guide

This guide shows you how to use the Contact Management APIs implemented in Phase 1.

## Prerequisites

1. **Authentication:** You need a valid Clerk authentication token
2. **Database:** Ensure the database is migrated with the Contact schema
3. **Environment:** Set up your `.env.local` with required variables

## API Endpoints

### 1. Upload Contacts from CSV

Upload a CSV file containing contact data.

```bash
curl -X POST http://localhost:3000/api/contacts/upload \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN" \
  -F "file=@examples/contacts-sample.csv"
```

**Response:**
```json
{
  "success": true,
  "batchId": "clxxxxx",
  "totalRows": 10,
  "validRows": 10,
  "duplicates": 0,
  "errors": 0,
  "message": "Successfully uploaded 10 contacts. 0 duplicates skipped. 0 errors."
}
```

### 2. List All Contacts

Get a paginated list of all your contacts.

```bash
curl -X GET "http://localhost:3000/api/contacts/list?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "contacts": [
    {
      "id": "clxxxxx",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@acmecorp.com",
      "company": "Acme Corp",
      "title": "VP Engineering",
      ...
    }
  ],
  "total": 10,
  "page": 1,
  "limit": 10,
  "totalPages": 1
}
```

### 3. Search Contacts

Search contacts by various criteria.

**Natural language search:**
```bash
curl -X GET "http://localhost:3000/api/contacts/search?query=VP+Engineering" \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN"
```

**Search by company:**
```bash
curl -X GET "http://localhost:3000/api/contacts/search?company=Acme" \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN"
```

**Search by title and location:**
```bash
curl -X GET "http://localhost:3000/api/contacts/search?title=CTO&location=New+York" \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN"
```

**Filter by company size:**
```bash
curl -X GET "http://localhost:3000/api/contacts/search?companySize=201-500&sortBy=company" \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN"
```

### 4. Get Contact Details

Retrieve full details for a specific contact.

```bash
curl -X GET http://localhost:3000/api/contacts/CONTACT_ID \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "contact": {
    "id": "clxxxxx",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@acmecorp.com",
    "phone": "555-1234",
    "company": "Acme Corp",
    "title": "VP Engineering",
    "campaigns": [...],
    "interactions": [...]
  }
}
```

### 5. Update Contact

Update contact information.

```bash
curl -X PATCH http://localhost:3000/api/contacts/CONTACT_ID \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "555-9999",
    "department": "Engineering",
    "seniority": "VP"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Contact updated successfully",
  "contact": { ... }
}
```

### 6. Delete Contact

Delete a contact.

```bash
curl -X DELETE http://localhost:3000/api/contacts/CONTACT_ID \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "message": "Contact deleted successfully"
}
```

## Common Use Cases

### 1. Import Contacts from LinkedIn Export

1. Export your LinkedIn connections to CSV
2. Map the columns to our format (firstName, lastName, email, company, title)
3. Upload using the CSV upload endpoint

### 2. Find All VPs in San Francisco

```bash
curl -X GET "http://localhost:3000/api/contacts/search?title=VP&location=San+Francisco&sortBy=company" \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN"
```

### 3. Get Contacts by Company

```bash
curl -X GET "http://localhost:3000/api/contacts/search?company=Acme&sortBy=title" \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN"
```

### 4. Filter High-Value Targets

```bash
curl -X GET "http://localhost:3000/api/contacts/search?companySize=501-1000&companyRevenue=\$100M%2B&seniority=C-Level" \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN"
```

### 5. Get Recently Uploaded Contacts

```bash
curl -X GET "http://localhost:3000/api/contacts/list?sortBy=createdAt&sortOrder=desc&limit=25" \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN"
```

## CSV Format Reference

Here's the complete CSV format with all supported fields:

```csv
firstName,lastName,email,phone,linkedinUrl,company,title,department,seniority,location,city,state,country,companySize,companyRevenue,industry,companyType,keywords,bio,skills
John,Doe,john@example.com,555-1234,https://linkedin.com/in/johndoe,Acme Corp,VP Engineering,Engineering,VP,San Francisco Bay Area,San Francisco,CA,USA,201-500,$50M-100M,Technology,Mid-Market,B2B;SaaS;AI,Bio text,Python;AWS
```

**Required Fields:**
- firstName
- lastName
- email

**Optional Fields:**
- phone
- linkedinUrl
- company
- title
- department
- seniority (C-Level, VP, Director, Manager, IC)
- location
- city
- state
- country
- companySize (1-10, 11-50, 51-200, 201-500, 501-1000, 1000+)
- companyRevenue ($0-1M, $1M-10M, $10M-50M, $50M-100M, $100M+)
- industry
- companyType (Startup, SMB, Mid-Market, Enterprise)
- keywords (semicolon-separated: B2B;SaaS;AI)
- bio
- skills (semicolon-separated: Python;JavaScript;AWS)

## Query Parameters Reference

### List & Search APIs

**Pagination:**
- `page` - Page number (default: 1)
- `limit` - Results per page (default: 50, max: 100)

**Sorting:**
- `sortBy` - Field to sort by (name, title, company, createdAt)
- `sortOrder` - Sort direction (asc, desc)

**Filters (Search API):**
- `query` - Search across all fields
- `firstName` - Filter by first name
- `lastName` - Filter by last name
- `email` - Filter by email
- `title` - Filter by job title
- `company` - Filter by company name
- `location` - Filter by location (city, state, country)
- `industry` - Filter by industry
- `seniority` - Filter by seniority level
- `companySize` - Filter by company size

**Filters (List API):**
- `source` - Filter by source (uploaded, apollo, clay, manual)
- `targetingZone` - Filter by targeting zone
- `hasEmail` - Filter contacts with email (true/false)
- `hasPhone` - Filter contacts with phone (true/false)
- `hasLinkedin` - Filter contacts with LinkedIn URL (true/false)

## Error Handling

All APIs return consistent error responses:

```json
{
  "success": false,
  "error": "Error message here"
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `400` - Bad Request (invalid input)
- `401` - Unauthorized (missing or invalid auth)
- `404` - Not Found (contact doesn't exist)
- `500` - Internal Server Error

## Testing

Use the test script to validate your setup:

```bash
# Set auth token
export TEST_AUTH_TOKEN=your_clerk_token_here

# Run tests
npx tsx scripts/test-contacts-api.ts
```

## Integration Examples

### JavaScript/TypeScript

```typescript
// Upload CSV
const uploadContacts = async (file: File) => {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch('/api/contacts/upload', {
    method: 'POST',
    body: formData
  })

  return await response.json()
}

// Search contacts
const searchContacts = async (query: string) => {
  const response = await fetch(
    `/api/contacts/search?query=${encodeURIComponent(query)}`
  )

  return await response.json()
}

// Update contact
const updateContact = async (id: string, updates: any) => {
  const response = await fetch(`/api/contacts/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updates)
  })

  return await response.json()
}
```

### Python

```python
import requests

API_BASE = "http://localhost:3000"
AUTH_TOKEN = "your_clerk_token"

# Upload CSV
def upload_contacts(filepath):
    with open(filepath, 'rb') as f:
        files = {'file': f}
        headers = {'Authorization': f'Bearer {AUTH_TOKEN}'}
        response = requests.post(
            f'{API_BASE}/api/contacts/upload',
            files=files,
            headers=headers
        )
        return response.json()

# Search contacts
def search_contacts(query):
    headers = {'Authorization': f'Bearer {AUTH_TOKEN}'}
    params = {'query': query}
    response = requests.get(
        f'{API_BASE}/api/contacts/search',
        params=params,
        headers=headers
    )
    return response.json()

# Update contact
def update_contact(contact_id, updates):
    headers = {
        'Authorization': f'Bearer {AUTH_TOKEN}',
        'Content-Type': 'application/json'
    }
    response = requests.patch(
        f'{API_BASE}/api/contacts/{contact_id}',
        json=updates,
        headers=headers
    )
    return response.json()
```

## Next Steps

Once you've imported your contacts, you can:

1. **Create campaigns** - Use the campaign APIs to target specific contact segments
2. **Enrich data** - Integrate with Apollo or Clay to add more data
3. **Track interactions** - Record emails, calls, and meetings
4. **Analyze performance** - Use analytics APIs to measure campaign success

## Support

For issues or questions:
1. Check the full documentation in `CONTACTS_DATABASE_PHASE1.md`
2. Review the test script in `scripts/test-contacts-api.ts`
3. Check error messages in API responses
4. Review server logs for detailed error information
