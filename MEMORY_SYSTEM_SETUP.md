# Wells Memory System Setup Guide

## What's Already Done ✅

- **Legendary onboarding system** with Ghost-from-Destiny personality
- **Memory & relationship tracking** (conversations, messages, user context, memories)
- **Full integration** into chat API with context injection
- **Prisma schema** designed and ready
- **Migration files** created and ready to run

## What's Needed: Database Configuration

The memory system requires a Vercel Postgres database. Currently, the Vercel CLI has issues creating databases, so it needs to be created through the web dashboard.

### Step 1: Create Vercel Postgres Database

1. Go to https://vercel.com/wellsonyxs-projects/wellsai
2. Click on the **"Storage"** tab
3. Click **"Create Database"** → **"Postgres"**
4. Configure the database:
   - **Name:** `wells-memory` (or any name you prefer)
   - **Region:** Select closest to your users (e.g., `sfo1` for San Francisco)
5. Click **"Create"**

Vercel will automatically add these environment variables to your project:
- `POSTGRES_URL`
- `POSTGRES_URL_NON_POOLING`
- `POSTGRES_USER`
- `POSTGRES_HOST`
- `POSTGRES_PASSWORD`
- `POSTGRES_DATABASE`

### Step 2: Update Local Environment

Pull the new environment variables to your local machine:

```bash
cd ~/Downloads/wells-ai-github-ready
vercel env pull .env.local
```

### Step 3: Add DATABASE_URL to Environment

The Prisma client needs a `DATABASE_URL` variable. Add it to Vercel environment variables:

```bash
# Get the Postgres URL that was created
grep POSTGRES_URL .env.local

# Add it as DATABASE_URL (use the non-pooling URL for migrations)
vercel env add DATABASE_URL
# When prompted, paste the value from POSTGRES_URL_NON_POOLING
# Add to: Production, Preview, Development
```

Pull again to get the new variable:

```bash
vercel env pull .env.local
```

### Step 4: Run Migrations

```bash
# Generate Prisma client
npx prisma generate

# Run migrations to create tables
npx prisma migrate deploy
```

### Step 5: Deploy to Production

```bash
# Commit the migration
git add prisma/migrations
git commit -m "Add memory system database migrations

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# Deploy
vercel --prod
```

## Testing the Memory System

### Test Onboarding Flow

1. Open https://wellsai.vercel.app
2. Start a conversation
3. Wells should guide you through onboarding
4. On return visits, Wells should greet you by name

### Test Memory Persistence

1. Have a conversation with Wells
2. Mention your company, role, or goals
3. Close the browser
4. Return to the site
5. Wells should remember what you told it

### Check Database

```bash
# Open Prisma Studio to view database
npx prisma studio
```

You should see:
- **Conversations** - Each session
- **Messages** - All chat messages
- **UserContext** - What Wells learned about each user
- **Memory** - Important memories Wells stored

## How Memory Works

### Context Injection

Every message Wells receives includes:
- Last 50 messages from the conversation
- User's profile (name, company, role, goals, pain points)
- Top 10 most important memories
- Relationship metrics (trust score, conversation depth)

### Learning

After each message, Wells:
1. Stores the user and assistant messages
2. Extracts key information (goals, pain points, facts)
3. Creates memories for important information
4. Updates user context
5. Tracks conversation metrics

### Personality

Wells shares what it's been thinking about/working on (like Ghost from Destiny):
- "I've been looking through semiconductor lead times this morning - they're getting WORSE. Wild."
- "I spent the last hour trying to figure out why every VC pitch deck uses the same buzzwords. Still confused."

This happens:
- When greeting returning users
- After trust score reaches 30+
- 24-hour cooldown between activities
- 20% random chance (feels natural)

## Troubleshooting

### "PrismaClient is unable to run in the browser"

This means the memory functions are being called client-side. Ensure they're only called in:
- API routes (`app/api/**/route.ts`)
- Server components
- Never in client components

### "Database connection error"

Check that:
1. `DATABASE_URL` is set in Vercel environment variables
2. Environment variables are pulled locally: `vercel env pull`
3. Prisma client is generated: `npx prisma generate`

### Memory not persisting

1. Check that database tables exist: `npx prisma studio`
2. Check API logs: `vercel logs https://wellsai.vercel.app`
3. Look for `[MEMORY]` log messages

## Architecture

### Database Schema

```
Conversation
├── Messages (1:many)
├── UserContext (1:1)
└── Onboarding state

UserContext
├── Basic info (name, email, userType)
├── Deep context (company, role, industry)
├── Preferences & behaviors
└── Memories (1:many)

Memory
├── Category (fact, preference, goal, pain_point, relationship, event)
├── Content & context
├── Importance (1-10)
└── Embeddings (for semantic search - future)
```

### Memory Functions

See `lib/memory.ts` for full API:

- `buildConversationContext()` - Load full context for Wells
- `storeMessage()` - Store a message
- `createMemory()` - Create a new memory
- `getRelevantMemories()` - Retrieve memories (by importance now, semantic search later)
- `extractAndStoreContext()` - Learn from conversations
- `formatContextForPrompt()` - Format context for Claude

## Next Steps

Once the database is configured and migrations are run:

1. **Test onboarding flow** - Ensure Wells guides users through the 5 phases
2. **Test memory persistence** - Ensure Wells remembers across sessions
3. **Monitor memory usage** - Check how memories are being created
4. **Implement semantic search** - Add vector embeddings for better memory retrieval
5. **Add memory management UI** - Let users view/edit what Wells remembers

## Status

- [x] Onboarding system built
- [x] Memory system built
- [x] Chat API integration complete
- [x] Frontend integration complete
- [x] Migration files created
- [ ] **Database created** ← YOU ARE HERE
- [ ] Migrations run
- [ ] System tested end-to-end
- [ ] Vector embeddings implemented
