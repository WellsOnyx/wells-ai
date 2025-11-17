# Contacts Database - Phase 1: Database & Import

Phase 1 of the Contacts Database Roadmap is now complete. This phase implements the core database operations and CSV import functionality for managing contacts.

## What Was Built

### 1. CSV Upload API
**Endpoint:** `POST /api/contacts/upload`

**Features:**
- Accepts CSV files with contact data
- Batch processing (1000 records at a time for performance)
- Duplicate detection by email per user
- Field validation (required: firstName, lastName, email)
- Progress tracking via UploadBatch model
- Detailed error reporting
- User isolation using Clerk userId

**Request Format:**
```bash
POST /api/contacts/upload
Content-Type: multipart/form-data

file: CSV file
```

**CSV Format:**
```csv
firstName,lastName,email,phone,linkedinUrl,company,title,department,seniority,location,city,state,country,companySize,companyRevenue,industry,companyType,keywords,bio,skills
John,Doe,john.doe@example.com,555-1234,https://linkedin.com/in/johndoe,Acme Corp,VP Engineering,Engineering,C-Level,San Francisco,San Francisco,CA,USA,201-500,$50M-100M,Technology,Mid-Market,B2B;SaaS;AI,Bio text here,Python;JavaScript;AWS
```

**Response:**
```json
{
  "success": true,
  "batchId": "clxxxxx",
  "totalRows": 100,
  "validRows": 95,
  "duplicates": 3,
  "errors": 2,
  "message": "Successfully uploaded 95 contacts. 3 duplicates skipped. 2 errors.",
  "errorDetails": [
    {
      "row": 5,
      "field": "email",
      "message": "Invalid email format",
      "data": { ... }
    }
  ]
}
```

### 2. Contact Search API
**Endpoint:** `GET /api/contacts/search`

**Features:**
- Natural language query support (searches across multiple fields)
- Multi-field filtering (firstName, lastName, email, title, company, location)
- Fuzzy matching for names and companies (case-insensitive)
- Pagination (default 50 results per page, max 100)
- Sort options (name, title, company, createdAt)
- Uses Postgres indexes for performance

**Query Parameters:**
- `query` - Natural language search across all fields
- `firstName` - Filter by first name
- `lastName` - Filter by last name
- `email` - Filter by email
- `title` - Filter by job title
- `company` - Filter by company name
- `location` - Filter by location (city, state, country)
- `industry` - Filter by industry
- `seniority` - Filter by seniority level
- `companySize` - Filter by company size
- `page` - Page number (default: 1)
- `limit` - Results per page (default: 50, max: 100)
- `sortBy` - Sort field (name, title, company, createdAt)
- `sortOrder` - Sort order (asc, desc)

**Example Requests:**
```bash
# Natural language search
GET /api/contacts/search?query=VP+Engineering

# Search by company and title
GET /api/contacts/search?company=Acme&title=VP&page=1&limit=25

# Search by location
GET /api/contacts/search?location=San+Francisco&sortBy=name&sortOrder=asc
```

**Response:**
```json
{
  "success": true,
  "contacts": [...],
  "total": 150,
  "page": 1,
  "limit": 50,
  "totalPages": 3
}
```

### 3. Contact List API
**Endpoint:** `GET /api/contacts/list`

**Features:**
- Simple list all contacts for authenticated user
- Pagination support
- Filter options (source, targetingZone, hasEmail, hasPhone, hasLinkedin)
- Sort options (name, title, company, createdAt)
- User isolation

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Results per page (default: 50, max: 100)
- `sortBy` - Sort field (name, title, company, createdAt)
- `sortOrder` - Sort order (asc, desc)
- `source` - Filter by source (uploaded, apollo, clay, manual)
- `targetingZone` - Filter by targeting zone
- `hasEmail` - Filter contacts with email (true/false)
- `hasPhone` - Filter contacts with phone (true/false)
- `hasLinkedin` - Filter contacts with LinkedIn URL (true/false)

**Example Requests:**
```bash
# List all contacts
GET /api/contacts/list?page=1&limit=50

# List uploaded contacts with emails
GET /api/contacts/list?source=uploaded&hasEmail=true

# List by targeting zone
GET /api/contacts/list?targetingZone=80-90&sortBy=company
```

### 4. Contact Detail API
**Endpoint:** `GET/PATCH/DELETE /api/contacts/[id]`

**Features:**

#### GET - Retrieve single contact
- Returns full contact details
- Includes associated campaigns
- Includes last 10 interactions
- User isolation enforced

**Example:**
```bash
GET /api/contacts/clxxxxx
```

**Response:**
```json
{
  "success": true,
  "contact": {
    "id": "clxxxxx",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "company": "Acme Corp",
    "title": "VP Engineering",
    "campaigns": [
      {
        "campaign": {
          "id": "clxxxxx",
          "name": "Q4 Outreach",
          "status": "active",
          "useCase": "sales"
        }
      }
    ],
    "interactions": [...]
  }
}
```

#### PATCH - Update contact
- Update any contact fields
- Email validation and duplicate checking
- User isolation enforced

**Example:**
```bash
PATCH /api/contacts/clxxxxx
Content-Type: application/json

{
  "phone": "555-9999",
  "department": "Engineering",
  "seniority": "VP"
}
```

#### DELETE - Delete contact
- Deletes contact and related records (cascading)
- User isolation enforced

**Example:**
```bash
DELETE /api/contacts/clxxxxx
```

## Database Schema

The Contact model (from `prisma/schema.prisma`):

```prisma
model Contact {
  id              String   @id @default(cuid())
  userId          String   // Clerk user ID - CRITICAL for user isolation

  // Basic Info
  firstName       String
  lastName        String
  email           String?
  phone           String?
  linkedinUrl     String?

  // Professional Info
  company         String?
  title           String?
  department      String?
  seniority       String?

  // Location
  location        String?
  city            String?
  state           String?
  country         String?

  // Company Details
  companySize     String?
  companyRevenue  String?
  industry        String?
  companyType     String?

  // Enriched Data
  keywords        String[]
  bio             String?  @db.Text
  skills          String[]

  // Targeting Signals
  targetingScore  Int?
  targetingZone   String?

  // Metadata
  source          String   // 'uploaded', 'apollo', 'clay', 'manual'
  uploadedAt      DateTime @default(now())
  lastEnriched    DateTime?
  lastContacted   DateTime?

  // Relationships
  campaigns       CampaignContact[]
  interactions    Interaction[]

  // Composite unique: One email per user
  @@unique([userId, email])

  // Indexes for fast queries with 300k+ records
  @@index([userId])
  @@index([userId, company])
  @@index([userId, title])
  @@index([userId, targetingZone])
  @@index([userId, lastContacted])
  @@index([userId, uploadedAt])
  @@index([email])

  @@map("gtm_contacts")
}
```

## Security Features

### User Isolation
All APIs enforce strict user isolation using Clerk's `auth()`:

```typescript
const authResult = await auth()
const userId = authResult.userId

// All queries include userId filter
const contacts = await prisma.contact.findMany({
  where: {
    userId, // User can only see their own contacts
    // ... other filters
  }
})
```

### Data Validation
- Required fields: firstName, lastName, email
- Email format validation
- Duplicate detection (by email per user)
- File size limits (10MB)
- CSV format validation

### Error Handling
- Comprehensive error messages
- Proper HTTP status codes
- Detailed error logging
- Validation error details returned to user

## Performance Optimizations

### Batch Processing
- CSV uploads process 1000 records at a time
- Reduces memory usage and improves reliability
- Prevents timeout on large uploads

### Database Indexes
Multiple indexes ensure fast queries even with 300k+ contacts:
- `userId` - Primary isolation
- `userId + company` - Company lookups
- `userId + title` - Title searches
- `userId + targetingZone` - Targeting queries
- `userId + lastContacted` - Follow-up queries
- `userId + uploadedAt` - Recent contacts
- `email` - Duplicate detection

### Pagination
- Default 50 results per page
- Maximum 100 results per page
- Prevents excessive data transfer

## Testing

A comprehensive test script is available at `scripts/test-contacts-api.ts`.

### Running Tests

```bash
# Set up auth token
export TEST_AUTH_TOKEN=your_clerk_token_here

# Run tests
npx tsx scripts/test-contacts-api.ts
```

### Test Coverage

The test suite validates:
1. CSV upload with valid data
2. CSV upload with invalid rows
3. Duplicate detection
4. Contact listing with pagination
5. Contact search (query and filters)
6. Contact detail retrieval
7. Contact updates
8. Pagination functionality

## Edge Cases Handled

1. **Empty CSV** - Returns appropriate error
2. **Malformed CSV** - Validates format and reports errors
3. **Missing required fields** - Validates and reports specific errors
4. **Invalid email format** - Validates and rejects
5. **Duplicate emails** - Detects and skips, reports count
6. **Large files** - 10MB limit enforced
7. **Non-CSV files** - File type validation
8. **Unauthorized access** - Authentication required
9. **Invalid contact IDs** - Returns 404
10. **Cross-user access** - User isolation prevents access to other users' contacts

## API Response Formats

All APIs return consistent JSON responses:

### Success Response
```json
{
  "success": true,
  // ... additional data
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message here"
}
```

## Next Steps (Future Phases)

Phase 1 is complete. Future phases will add:
- **Phase 2:** Contact enrichment (Apollo, Clay integrations)
- **Phase 3:** Campaign management and messaging
- **Phase 4:** Analytics and reporting
- **Phase 5:** AI-powered insights and recommendations

## Files Created

```
app/api/contacts/
├── upload/
│   └── route.ts          # CSV upload API
├── search/
│   └── route.ts          # Contact search API
├── list/
│   └── route.ts          # Contact list API
└── [id]/
    └── route.ts          # Contact detail API (GET/PATCH/DELETE)

scripts/
└── test-contacts-api.ts  # Test suite

CONTACTS_DATABASE_PHASE1.md  # This documentation
```

## Dependencies

- `@clerk/nextjs` - Authentication
- `@prisma/client` - Database ORM
- `next` - API routes framework

All dependencies are already installed in the project.
