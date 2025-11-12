# Wells AI + GRAIN & Vault

**Zero Friction B2B Commerce Platform**

Enterprise-grade conversational AI platform combining Wells AI (intelligent automation) with GRAIN & Vault (treasury-as-a-service). Deployed on Vercel with Next.js 15, powered by Claude AI.

---

## 🚀 Live Deployment

- **Production**: https://wellsai.vercel.app
- **Alt Domain**: https://grainandvault.com  
- **Status**: ✅ Active

---

## 📋 Project Overview

### Wells AI
Conversational AI assistant for B2B operations:
- **Universal GTM Engine**: Automated outreach for 6 use cases (hiring, sales, procurement, partnerships, finance, job seeking)
- **AI Ops Management**: Deploy and manage autonomous AI operations
- **Integration Hub**: Secure connections to Instantly, Clay, Apollo, Twilio, Notion, PhantomBuster
- **LinkedIn Content Engine**: AI-generated content for inbound lead generation

### GRAIN & Vault
Treasury-as-a-Service platform:
- **Escrow Services**: Vault-based transaction security
- **Payment Processing**: Multi-currency, multi-method
- **Negotiation Engine**: Real-time collaborative deal-making
- **Supplier Matching**: AI-powered procurement

---

## 🛠 Tech Stack

### Frontend
- **Framework**: Next.js 15 (App Router, RSC)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 3
- **Components**: React 19
- **Auth**: Clerk (OAuth + passwordless)

### Backend
- **Runtime**: Node.js (Vercel serverless)
- **API**: Next.js API Routes  
- **AI**: Anthropic Claude (Sonnet 4.5)
- **Storage**: In-memory → Postgres (migration planned)

### Infrastructure
- **Hosting**: Vercel
- **Monitoring**: Custom logging
- **CDN**: Vercel Edge Network

### Integrations
- Instantly.ai, Clay.earth, Apollo.io
- PhantomBuster, Twilio, Notion

---

## 📦 Installation

### Prerequisites
```bash
node >= 18.17.0
npm >= 9.0.0
```

### Local Setup
```bash
# Clone repository
git clone https://github.com/wellsonyx/wells-ai.git
cd wells-ai

# Install dependencies  
npm install

# Set up environment
cp .env.example .env.local
# Edit .env.local with your credentials

# Run dev server
npm run dev
```

---

## 🔐 Environment Variables

### Required
```bash
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Anthropic AI
ANTHROPIC_API_KEY=sk-ant-...

# Encryption (generate: openssl rand -hex 32)
ENCRYPTION_MASTER_SECRET=...

# Deployment
NEXT_PUBLIC_APP_URL=https://wellsai.vercel.app
```

### Optional
```bash
# Integrations
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
NOTION_API_KEY=...

# Database (future)
DATABASE_URL=postgresql://...
```

---

## 🚀 Deployment

### Vercel (Production)
```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

---

## 📁 Project Structure

```
wells-ai/
├── app/
│   ├── api/                # API Routes
│   │   ├── chat/          # Chat endpoints
│   │   ├── gtm/           # GTM automation
│   │   ├── integrations/  # Integration mgmt
│   │   └── webhooks/      # External webhooks
│   ├── components/        # React components
│   └── page.tsx          # Homepage
├── lib/                   # Core libraries
│   ├── gtm/              # GTM engine
│   ├── settings/         # Settings mgmt
│   ├── cache.ts
│   ├── monitoring.ts
│   └── notion.ts
├── public/               # Static assets
├── .env.example
├── package.json
└── README.md
```

---

## 🎯 Key Features

### 1. Universal GTM Engine
**6 Use Cases, Same Methodology:**
- Hiring (employer → candidates)
- Job Seeking (candidate → employers)
- Sales (vendor → customers)
- Procurement (buyer → suppliers)
- Partnerships (platform → partners)
- Finance (founder → investors)

**Components:**
- Use case detection
- Adaptive qualification (6 questions/use case)
- 80-90% zone targeting
- 3-line message formula
- Email/LinkedIn automation

### 2. Integration APIs
**4 Secure Endpoints:**
- `POST /api/integrations/connect` - Connect & test
- `POST /api/integrations/test` - Verify connection
- `POST /api/integrations/disconnect` - Remove credentials
- `GET /api/integrations/list` - List integrations

**Security:**
- AES-256-GCM encryption
- User-specific keys
- Connection testing
- Zero credential exposure

### 3. LinkedIn Content Engine
**Inbound Lead Generation:**
- 6 post types (insight, story, advice, milestone, question, controversial)
- Content strategies per GTM use case
- 7-day content calendar
- Engagement estimation
- Best practices built-in

### 4. Conversational Settings
**No Settings Pages:**
- Detect integration setup in chat
- Extract API keys from messages
- Inline connection UI
- Per-integration instructions

---

## 🔒 Security

### Credential Storage
- **Encryption**: AES-256-GCM
- **Key Derivation**: scrypt (memory-hard)
- **User Isolation**: Unique encryption keys
- **Master Secret**: Environment-based

### Authentication
- **Clerk**: Industry-standard OAuth
- **API Protection**: All endpoints authenticated
- **Session Management**: Token-based

---

## 📝 Recent Updates

### 2025-11-12
- ✅ Universal GTM Engine (6 use cases)
- ✅ LinkedIn Content Engine
- ✅ Integration APIs (4 endpoints)
- ✅ Encrypted Credential Storage
- ✅ Conversational Settings Detection

---

## 🗺 Roadmap

### Immediate
- [ ] Migrate to Postgres storage
- [ ] GitHub Actions CI/CD
- [ ] Integration tests

### Short-term
- [ ] iOS/macOS native apps
- [ ] Real-time collaboration
- [ ] Analytics dashboard

### Long-term
- [ ] Multi-tenant architecture
- [ ] AI agent orchestration
- [ ] Integration marketplace

---

## 📞 Support

**Wells Onyx Contact:**
- Email: jonah@wellsonyx.com
- Phone: +1 (850) 456-1961

---

## 📄 License

Proprietary - Wells Onyx LLC

---

**Built with ⚡️ by Wells Onyx**
