# Bot Configuration Guide

Complete setup instructions for Wells AI bot integrations across Slack, Microsoft Teams, Discord, and Google Chat.

---

## Quick Links

- [Slack Bot Setup](#slack-bot-setup)
- [Microsoft Teams Bot Setup](#microsoft-teams-bot-setup)
- [Discord Bot Setup](#discord-bot-setup)
- [Google Chat Bot Setup](#google-chat-bot-setup)
- [Testing Bots](#testing-bots)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

- Vercel deployment URL: `https://wellsai.vercel.app`
- Admin access to workspaces/servers where bots will be installed
- Environment variable access in Vercel project settings

---

## Slack Bot Setup

### Step 1: Create Slack App

1. Go to https://api.slack.com/apps
2. Click **"Create New App"**
3. Choose **"From scratch"**
4. App Name: `Wells AI`
5. Workspace: Select your development workspace
6. Click **"Create App"**

### Step 2: Configure Bot Basics

**App Home → Display Information:**
- App Name: `Wells AI`
- Short Description: `AI-powered procurement assistant`
- Long Description: `Wells AI helps you find suppliers, create RFQs, negotiate deals, and automate procurement workflows.`
- Background Color: `#0066FF` (Wells Onyx blue)
- Upload Icon: Use Wells AI logo

### Step 3: Configure OAuth & Permissions

**OAuth & Permissions → Bot Token Scopes:**

Add the following scopes:
- `chat:write` - Send messages as bot
- `chat:write.public` - Send messages to channels bot isn't in
- `commands` - Add slash commands
- `im:history` - Read DM history
- `im:read` - View DMs
- `im:write` - Send DMs
- `channels:history` - Read public channel messages
- `channels:read` - View public channels
- `groups:history` - Read private channel messages (if needed)
- `groups:read` - View private channels (if needed)
- `users:read` - Read user information
- `users:read.email` - Read user email addresses

**OAuth & Permissions → Redirect URLs:**
```
https://wellsai.vercel.app/api/slack/oauth
```

### Step 4: Add Slash Commands

**Slash Commands → Create New Command:**

**Command 1: /wells-rfq**
- Command: `/wells-rfq`
- Request URL: `https://wellsai.vercel.app/api/slack/commands`
- Short Description: `Create a Request for Quote`
- Usage Hint: `[description], quantity: X, budget: $Y, deadline: Z`

**Command 2: /wells-find**
- Command: `/wells-find`
- Request URL: `https://wellsai.vercel.app/api/slack/commands`
- Short Description: `Find suppliers`
- Usage Hint: `[search query]`

**Command 3: /wells-negotiate**
- Command: `/wells-negotiate`
- Request URL: `https://wellsai.vercel.app/api/slack/commands`
- Short Description: `Start real-time negotiation`
- Usage Hint: `[rfq-id]`

**Command 4: /wells-quote**
- Command: `/wells-quote`
- Request URL: `https://wellsai.vercel.app/api/slack/commands`
- Short Description: `View quotes for RFQ`
- Usage Hint: `[rfq-id]`

**Command 5: /wells-deals**
- Command: `/wells-deals`
- Request URL: `https://wellsai.vercel.app/api/slack/commands`
- Short Description: `View your deals`
- Usage Hint: (leave empty)

**Command 6: /wells-help**
- Command: `/wells-help`
- Request URL: `https://wellsai.vercel.app/api/slack/commands`
- Short Description: `Show Wells AI help`
- Usage Hint: (leave empty)

### Step 5: Enable Interactive Components

**Interactivity & Shortcuts:**
- Turn on **Interactivity**
- Request URL: `https://wellsai.vercel.app/api/slack/interactive`
- Click **Save Changes**

### Step 6: Enable Event Subscriptions

**Event Subscriptions:**
- Turn on **Enable Events**
- Request URL: `https://wellsai.vercel.app/api/slack/events`
- Wait for verification (should show "Verified ✓")

**Subscribe to Bot Events:**
- `app_mention` - Bot was @mentioned
- `message.im` - Message sent to bot DM
- `message.channels` - Message in channel (if bot needs to listen)

Click **Save Changes**

### Step 7: Get Credentials

**OAuth & Permissions:**
- Scroll to **OAuth Tokens for Your Workspace**
- Click **"Install to Workspace"**
- Authorize the app
- Copy **Bot User OAuth Token** (starts with `xoxb-`)

**Basic Information:**
- Scroll to **App Credentials**
- Copy **Client ID**
- Copy **Client Secret**
- Copy **Signing Secret** (for webhook verification)

### Step 8: Add to Vercel Environment Variables

Go to Vercel project settings → Environment Variables:

```bash
SLACK_BOT_TOKEN=xoxb-your-token-here
SLACK_CLIENT_ID=your-client-id
SLACK_CLIENT_SECRET=your-client-secret
SLACK_SIGNING_SECRET=your-signing-secret
```

**Important:** After adding environment variables, redeploy the app for changes to take effect.

### Step 9: Distribute Your App (Optional)

**Settings → Manage Distribution:**
- Follow checklist to make app publicly installable
- Add to Slack App Directory (optional)
- Or share OAuth installation link with customers

### Step 10: Test Slack Bot

In your Slack workspace:

1. **Test Slash Commands:**
   ```
   /wells-help
   /wells-rfq 100 office chairs, quantity: 100, budget: $5000
   /wells-find steel suppliers in Texas
   ```

2. **Test @Mentions:**
   ```
   @Wells AI help
   @Wells AI create rfq 50 laptops
   ```

3. **Test DMs:**
   - Send DM to Wells AI bot
   - Bot should respond with help message

---

## Microsoft Teams Bot Setup

### Step 1: Register Bot Framework Bot

1. Go to https://dev.botframework.com/
2. Sign in with Microsoft account
3. Click **"Create a Bot"**
4. Choose **"Register"** (not Azure bot)

**Bot Profile:**
- Display Name: `Wells AI`
- Bot Handle: `wellsai` (must be unique)
- Long Description: `AI-powered procurement assistant for enterprises`
- Messaging Endpoint: `https://wellsai.vercel.app/api/teams/messages`
- App Type: **Multi Tenant**

Click **"Register"**

### Step 2: Generate App Password

1. After registration, you'll see **Microsoft App ID**
2. Click **"Generate New Password"**
3. **IMPORTANT:** Copy the password immediately (you won't see it again)
4. Store securely

### Step 3: Configure Channels

**Channels:**
- **Microsoft Teams** should already be listed
- Click **Microsoft Teams** → **Configure**
- Enable features:
  - Calling
  - Messaging
  - Bots
- Click **Save**

### Step 4: Create Teams App Manifest

Create a file `teams-manifest.json`:

```json
{
  "$schema": "https://developer.microsoft.com/en-us/json-schemas/teams/v1.16/MicrosoftTeams.schema.json",
  "manifestVersion": "1.16",
  "version": "1.0.0",
  "id": "YOUR_MICROSOFT_APP_ID",
  "packageName": "com.wellsonyx.wellsai",
  "developer": {
    "name": "Wells Onyx",
    "websiteUrl": "https://wellsonyx.com",
    "privacyUrl": "https://wellsonyx.com/privacy",
    "termsOfUseUrl": "https://wellsonyx.com/terms"
  },
  "icons": {
    "color": "color-icon.png",
    "outline": "outline-icon.png"
  },
  "name": {
    "short": "Wells AI",
    "full": "Wells AI Procurement Assistant"
  },
  "description": {
    "short": "AI-powered procurement assistant",
    "full": "Wells AI helps you find suppliers, create RFQs, negotiate deals, and automate procurement workflows. From search to signed contract in hours, not weeks."
  },
  "accentColor": "#0066FF",
  "bots": [
    {
      "botId": "YOUR_MICROSOFT_APP_ID",
      "scopes": [
        "personal",
        "team",
        "groupchat"
      ],
      "supportsFiles": false,
      "isNotificationOnly": false,
      "commandLists": [
        {
          "scopes": [
            "personal",
            "team",
            "groupchat"
          ],
          "commands": [
            {
              "title": "help",
              "description": "Show Wells AI help and available commands"
            },
            {
              "title": "create rfq",
              "description": "Create a Request for Quote"
            },
            {
              "title": "find suppliers",
              "description": "Search for suppliers"
            }
          ]
        }
      ]
    }
  ],
  "permissions": [
    "identity",
    "messageTeamMembers"
  ],
  "validDomains": [
    "wellsai.vercel.app"
  ]
}
```

Replace `YOUR_MICROSOFT_APP_ID` with your actual App ID.

### Step 5: Package Teams App

1. Create icons:
   - `color-icon.png` - 192x192px, color version
   - `outline-icon.png` - 32x32px, white outline on transparent

2. Create ZIP file with:
   - teams-manifest.json
   - color-icon.png
   - outline-icon.png

3. Name: `wells-ai-teams.zip`

### Step 6: Upload to Teams

**Method 1: Developer Upload (Testing)**
1. Open Microsoft Teams
2. Click **Apps** in left sidebar
3. Click **"Upload a custom app"** (bottom left)
4. Select `wells-ai-teams.zip`
5. Click **"Add"**

**Method 2: Admin Upload (Organization)**
1. Go to Teams Admin Center
2. Teams Apps → Manage Apps
3. Click **"Upload"**
4. Upload `wells-ai-teams.zip`
5. Set policies to allow app

### Step 7: Add to Vercel Environment Variables

```bash
TEAMS_APP_ID=your-microsoft-app-id
TEAMS_APP_PASSWORD=your-app-password
```

Redeploy after adding variables.

### Step 8: Test Teams Bot

In Microsoft Teams:

1. Search for "Wells AI" in Apps
2. Click **"Add"**
3. Test commands:
   ```
   @Wells AI help
   @Wells AI create rfq 100 office chairs
   @Wells AI find steel suppliers
   ```

---

## Discord Bot Setup

### Step 1: Create Discord Application

1. Go to https://discord.com/developers/applications
2. Click **"New Application"**
3. Name: `Wells AI`
4. Click **"Create"**

### Step 2: Configure Bot

**General Information:**
- Upload icon (Wells AI logo)
- Add description: `AI-powered procurement assistant`
- Add tags: `productivity`, `business`, `automation`

**Bot Tab:**
1. Click **"Bot"** in left sidebar
2. Click **"Add Bot"** → **"Yes, do it!"**
3. **Privileged Gateway Intents:**
   - Enable **MESSAGE CONTENT INTENT** (to read message content)
   - Enable **SERVER MEMBERS INTENT** (optional, for member info)
4. Copy **Token** (click "Reset Token" if needed)
   - **IMPORTANT:** Keep this secret!

### Step 3: Configure OAuth2

**OAuth2 → URL Generator:**

Select **Scopes:**
- `bot`
- `applications.commands`

Select **Bot Permissions:**
- Send Messages
- Send Messages in Threads
- Embed Links
- Attach Files
- Read Message History
- Use Slash Commands
- Add Reactions

Copy generated URL (used for installation).

### Step 4: Register Slash Commands

**Important:** Discord slash commands must be registered via API. Run this script:

```javascript
// register-discord-commands.js
const { REST, Routes } = require('discord.js');

const commands = [
  {
    name: 'rfq',
    description: 'Create a Request for Quote',
    options: [
      {
        name: 'description',
        description: 'What do you need? (e.g., "100 office chairs")',
        type: 3, // STRING
        required: true,
      },
    ],
  },
  {
    name: 'find',
    description: 'Find suppliers',
    options: [
      {
        name: 'query',
        description: 'Search query (e.g., "steel suppliers in Texas")',
        type: 3, // STRING
        required: true,
      },
    ],
  },
  {
    name: 'negotiate',
    description: 'Start real-time negotiation',
  },
  {
    name: 'deals',
    description: 'View your deals',
  },
  {
    name: 'help',
    description: 'Show Wells AI help',
  },
];

const rest = new REST({ version: '10' }).setToken('YOUR_BOT_TOKEN');

(async () => {
  try {
    console.log('Registering slash commands...');

    await rest.put(
      Routes.applicationCommands('YOUR_APPLICATION_ID'),
      { body: commands },
    );

    console.log('✅ Slash commands registered!');
  } catch (error) {
    console.error('❌ Error:', error);
  }
})();
```

Replace `YOUR_BOT_TOKEN` and `YOUR_APPLICATION_ID`, then run:
```bash
node register-discord-commands.js
```

### Step 5: Configure Interactions Endpoint

**General Information → Interactions Endpoint URL:**
```
https://wellsai.vercel.app/api/discord/interactions
```

**Note:** Discord will verify this endpoint. Make sure your app is deployed first.

### Step 6: Add to Vercel Environment Variables

```bash
DISCORD_BOT_TOKEN=your-bot-token
DISCORD_CLIENT_ID=your-client-id
DISCORD_PUBLIC_KEY=your-public-key
```

Get these from:
- Bot Token: **Bot** tab
- Client ID: **OAuth2** tab → Client ID
- Public Key: **General Information** tab

### Step 7: Install Bot to Server

1. Use OAuth2 URL from Step 3
2. Select Discord server
3. Click **"Authorize"**
4. Complete CAPTCHA

### Step 8: Test Discord Bot

In your Discord server:

1. Type `/` to see slash commands
2. Test commands:
   ```
   /help
   /rfq description: 100 office chairs
   /find query: steel suppliers in Texas
   ```

---

## Google Chat Bot Setup

### Step 1: Create Google Cloud Project

1. Go to https://console.cloud.google.com/
2. Create new project: `Wells AI Chat Bot`
3. Note the **Project ID**

### Step 2: Enable Google Chat API

1. In Cloud Console, go to **APIs & Services** → **Library**
2. Search for "Google Chat API"
3. Click **Enable**

### Step 3: Configure OAuth Consent Screen

**APIs & Services → OAuth consent screen:**
- User Type: **Internal** (if Google Workspace) or **External**
- App Name: `Wells AI`
- User support email: Your email
- Developer contact: Your email
- Scopes: Add `https://www.googleapis.com/auth/chat.bot`
- Test users: Add your email

Click **Save and Continue**

### Step 4: Create Service Account

**IAM & Admin → Service Accounts:**
1. Click **"Create Service Account"**
2. Name: `wells-ai-chat-bot`
3. Description: `Service account for Wells AI Chat Bot`
4. Click **Create and Continue**
5. Grant role: **Project > Editor**
6. Click **Done**

### Step 5: Create Service Account Key

1. Click on created service account
2. **Keys** tab → **Add Key** → **Create new key**
3. Type: **JSON**
4. Download JSON file
5. Store securely (contains credentials)

### Step 6: Configure Google Chat App

**Google Chat API → Configuration:**

**App Name:** `Wells AI`

**Avatar URL:** `https://wellsai.vercel.app/wells-ai-logo.svg`

**Description:** `AI-powered procurement assistant for enterprises`

**Functionality:**
- Enable **1-on-1 messages**
- Enable **Spaces**
- Enable **App provides a link**
  - Link: `https://wellsai.vercel.app`

**Connection Settings:**
- **App URL:** `https://wellsai.vercel.app/api/gchat/messages`
- **Verification Token:** (will be generated)

**Permissions:**
- Enable **Make slash commands visible to users**

**Slash Commands:**

Add command `/rfq`:
- Command ID: `1`
- Name: `/rfq`
- Description: `Create a Request for Quote`
- Opens dialog: No

Add command `/find`:
- Command ID: `2`
- Name: `/find`
- Description: `Find suppliers`
- Opens dialog: No

Add command `/help`:
- Command ID: `3`
- Name: `/help`
- Description: `Show Wells AI help`
- Opens dialog: No

Click **Save**

### Step 7: Add to Vercel Environment Variables

From service account JSON file:

```bash
GOOGLE_CHAT_PROJECT_ID=your-project-id
GOOGLE_CHAT_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----
GOOGLE_CHAT_CLIENT_EMAIL=wells-ai-chat-bot@project-id.iam.gserviceaccount.com
GOOGLE_CHAT_VERIFICATION_TOKEN=token-from-chat-api-config
```

**Note:** For `GOOGLE_CHAT_PRIVATE_KEY`, replace actual newlines with `\n` when adding to Vercel.

### Step 8: Publish App

**Google Chat API → Publishing:**
1. Click **"Publish to Domain"** (for Google Workspace)
   - Or **"Publish to Google Chat"** (public)
2. Follow prompts
3. Wait for approval (internal apps approved instantly)

### Step 9: Install App

**Method 1: Direct Install**
1. Open Google Chat
2. Click **+** next to "Chat"
3. Search for "Wells AI"
4. Click **Add**

**Method 2: Space Install**
1. Open a Space
2. Click space name → **Apps & integrations**
3. Search "Wells AI" → **Add**

### Step 10: Test Google Chat Bot

1. **DM Test:**
   ```
   help
   create rfq 100 office chairs
   find steel suppliers
   ```

2. **Space Test:**
   ```
   @Wells AI help
   @Wells AI create rfq 50 laptops
   ```

---

## Testing Bots

### General Testing Checklist

**For Each Bot:**
- [ ] Bot responds to help command
- [ ] Bot can create RFQ
- [ ] Bot can search suppliers
- [ ] Bot shows proper error messages
- [ ] Bot responds within 3 seconds
- [ ] Bot handles @mentions correctly
- [ ] Bot works in DMs
- [ ] Bot works in channels/spaces

### Test RFQ Creation

**Test Input:**
```
100 office chairs, quantity: 100, budget: $5000, deadline: Dec 1
```

**Expected:**
- RFQ created in database
- Confirmation message with RFQ ID
- Message shows product name, quantity, budget
- Interactive buttons appear (if supported)

### Test Supplier Search

**Test Input:**
```
steel suppliers in Texas
```

**Expected:**
- List of 5 suppliers returned
- Each supplier shows: name, match score, industry, location
- Response within 2 seconds

### Error Handling Tests

**Test 1: Empty Command**
```
/wells-rfq
```
**Expected:** Usage hint message

**Test 2: Invalid Format**
```
/wells-find
```
**Expected:** Usage hint message

**Test 3: No Results**
```
/wells-find unicorn horns
```
**Expected:** "No suppliers found" message

---

## Troubleshooting

### Slack Issues

**Problem:** Slash command not working
- **Solution:** Check Request URL in Slash Commands config
- **Solution:** Verify bot token is correct in Vercel
- **Solution:** Reinstall app to workspace

**Problem:** Bot not responding to @mentions
- **Solution:** Check Event Subscriptions are enabled
- **Solution:** Verify Request URL shows "Verified ✓"
- **Solution:** Check bot has `app_mention` scope

**Problem:** Interactive buttons not working
- **Solution:** Verify Interactivity is enabled
- **Solution:** Check Request URL for interactive components

### Teams Issues

**Problem:** Can't upload app
- **Solution:** Verify manifest.json is valid JSON
- **Solution:** Check App ID matches in manifest
- **Solution:** Verify icons are correct size (192x192, 32x32)

**Problem:** Bot not responding
- **Solution:** Check Messaging Endpoint in Bot Framework
- **Solution:** Verify Teams channel is configured
- **Solution:** Check TEAMS_APP_PASSWORD in Vercel

**Problem:** Bot responds slowly
- **Solution:** Check Vercel function logs for errors
- **Solution:** Verify database connection is working

### Discord Issues

**Problem:** Slash commands not appearing
- **Solution:** Re-run command registration script
- **Solution:** Wait 5 minutes for cache to clear
- **Solution:** Kick and re-add bot to server

**Problem:** Interactions endpoint failing verification
- **Solution:** Verify PUBLIC_KEY is correct
- **Solution:** Check endpoint returns 200 for PING (type: 1)
- **Solution:** Ensure app is deployed before setting endpoint

**Problem:** Bot has no permissions
- **Solution:** Re-invite bot with correct OAuth URL
- **Solution:** Check bot permissions in Server Settings → Integrations

### Google Chat Issues

**Problem:** App not found in directory
- **Solution:** Verify app is published
- **Solution:** Check you're logged into correct Google Workspace
- **Solution:** Wait 10 minutes after publishing

**Problem:** Bot not responding
- **Solution:** Verify App URL in Chat API config
- **Solution:** Check service account has correct permissions
- **Solution:** Verify credentials in Vercel

**Problem:** Verification token mismatch
- **Solution:** Check GOOGLE_CHAT_VERIFICATION_TOKEN in Vercel
- **Solution:** Copy token exactly from Chat API configuration

### General Issues

**Problem:** All bots timing out
- **Solution:** Check Vercel deployment is live
- **Solution:** Verify database connection
- **Solution:** Check Vercel function logs

**Problem:** RFQ not being created
- **Solution:** Check database schema is migrated
- **Solution:** Verify POSTGRES_URL in Vercel
- **Solution:** Check API logs for SQL errors

**Problem:** Supplier search returning no results
- **Solution:** Verify suppliers table has data
- **Solution:** Check matching algorithm in lib/matching.ts
- **Solution:** Test direct database query

---

## Monitoring & Logs

### View Vercel Logs

```bash
vercel logs wellsai.vercel.app --since=1h
```

### Check Specific Function

```bash
vercel logs wellsai.vercel.app --since=10m --filter=/api/slack/commands
```

### Monitor in Real-time

```bash
vercel logs wellsai.vercel.app --follow
```

### Check Database Logs

```sql
-- Recent RFQs created via bots
SELECT id, product_name, source, metadata, created_at
FROM rfqs
WHERE source IN ('slack', 'teams', 'discord', 'gchat')
ORDER BY created_at DESC
LIMIT 10;

-- Bot command history (if tracking table exists)
SELECT * FROM bot_commands ORDER BY created_at DESC LIMIT 20;
```

---

## Security Best Practices

1. **Never commit secrets** to git
2. **Rotate tokens** every 90 days
3. **Use webhook verification** in production
4. **Validate all user input** before database writes
5. **Rate limit** bot commands (10 per minute per user)
6. **Log all bot interactions** for audit
7. **Restrict bot permissions** to minimum required
8. **Use HTTPS** for all webhook endpoints
9. **Verify signatures** from platforms (Slack signing secret, Discord public key)
10. **Monitor for abuse** (excessive commands, spam)

---

## Next Steps

After all bots are configured:

1. **Load Testing**
   - Test with multiple users simultaneously
   - Verify concurrent RFQ creation
   - Check database connection pool

2. **User Documentation**
   - Create bot command guide for end users
   - Add video tutorials
   - Create FAQ

3. **Analytics**
   - Track bot usage metrics
   - Monitor command success rates
   - Analyze user engagement

4. **Enhancements**
   - Add more interactive components
   - Implement conversation state
   - Add AI-powered responses (Claude integration)

---

## Support

For issues or questions:
- Email: support@wellsonyx.com
- Docs: https://wellsai.vercel.app/docs
- GitHub: https://github.com/YOUR_ORG/wells-ai/issues

---

Built with precision. Powered by trust. Designed for generations.
*Wells Onyx | Trust + Outcomes*
