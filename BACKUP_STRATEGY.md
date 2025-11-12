# Backup & Disaster Recovery Strategy

**Wells AI + GRAIN & Vault**

Critical infrastructure for data protection and business continuity.

---

## 🎯 Backup Hierarchy

### 1. Primary: GitHub (Version Control)
**Repository**: https://github.com/wellsonyx/wells-ai  
**Purpose**: Source code, configuration, documentation  
**Frequency**: Every commit  
**Retention**: Infinite (git history)

**What's Backed Up:**
- All source code
- Configuration files
- Documentation
- Environment templates (.env.example)
- Build scripts
- Git history

**What's NOT Backed Up:**
- Environment secrets (.env.local)
- node_modules/
- .next/ build cache
- User data (stored in Vercel/future Postgres)

### 2. Secondary: iCloud Drive  
**Location**: `~/Library/Mobile Documents/com~apple~CloudDocs/Wells/`  
**Purpose**: File-level redundancy, cross-device access  
**Frequency**: Real-time (iCloud sync)  
**Retention**: As long as stored in iCloud

**What's Synced:**
- Complete project directory
- Local environment files (encrypted)
- Development notes
- Temporary work

### 3. Tertiary: Vercel Deployment Artifacts
**Platform**: Vercel (wellsai.vercel.app)  
**Purpose**: Production code snapshots  
**Frequency**: Every deployment  
**Retention**: Last 100 deployments

**What's Preserved:**
- Built application code
- Deployment configuration
- Environment variables (encrypted)
- Build logs

---

## 📋 Recovery Procedures

### Scenario 1: Local Machine Failure
**Impact**: Development machine dies  
**Recovery Time**: < 30 minutes

**Steps:**
1. Get new machine
2. Install development tools:
   ```bash
   # Install Node.js 18+
   brew install node
   
   # Install Vercel CLI
   npm i -g vercel
   ```

3. Clone from GitHub:
   ```bash
   git clone https://github.com/wellsonyx/wells-ai.git
   cd wells-ai
   npm install
   ```

4. Restore environment variables from secure storage
5. Test local dev: `npm run dev`

**Alternative (if iCloud available):**
```bash
# Link to iCloud synced copy
cd ~/Library/Mobile\ Documents/com~apple~CloudDocs/Wells/wells-ai
npm install
npm run dev
```

### Scenario 2: GitHub Repository Loss
**Impact**: GitHub repo deleted/corrupted  
**Recovery Time**: < 15 minutes

**Steps:**
1. Access iCloud Drive copy:
   ```bash
   cd ~/Library/Mobile\ Documents/com~apple~CloudDocs/Wells/wells-ai
   ```

2. Create new GitHub repo
3. Re-add remote and push:
   ```bash
   git remote add origin https://github.com/wellsonyx/wells-ai-new.git
   git push -u origin main
   ```

4. Update Vercel to use new repo

### Scenario 3: Vercel Platform Outage
**Impact**: Production site down  
**Recovery Time**: 1-2 hours

**Steps:**
1. Deploy to alternative platform (Netlify/Railway):
   ```bash
   # Netlify
   npm run build
   netlify deploy --prod
   
   # Or Railway
   railway up
   ```

2. Update DNS to point to new platform
3. Verify environment variables transferred
4. Test production deployment

### Scenario 4: Complete Data Loss
**Impact**: All systems compromised  
**Recovery Time**: 2-4 hours

**Requires:**
- GitHub credentials
- Vercel account access
- iCloud account access
- Environment variable backup (password manager)

**Steps:**
1. Recover from GitHub (most recent)
2. If GitHub unavailable, use iCloud
3. If both unavailable, redeploy from Vercel source
4. Reconstruct environment variables from documentation
5. Rebuild and redeploy

---

## 🔐 Environment Variable Backup

**Critical Variables (never in git):**
- `CLERK_SECRET_KEY`
- `ANTHROPIC_API_KEY`
- `ENCRYPTION_MASTER_SECRET`
- Integration API keys

**Storage Strategy:**
1. **Primary**: 1Password/LastPass secure note
2. **Secondary**: Encrypted file in iCloud
3. **Tertiary**: Vercel dashboard (production only)

**Backup Process:**
```bash
# Create encrypted backup
cat .env.local | openssl enc -aes-256-cbc -salt -out env.backup.enc

# Restore
openssl enc -aes-256-cbc -d -in env.backup.enc -out .env.local
```

---

## 📊 Backup Verification

### Weekly Checks
- [ ] Verify GitHub has latest commits
- [ ] Confirm iCloud sync is active
- [ ] Check Vercel deployment status
- [ ] Test git clone from GitHub

### Monthly Checks
- [ ] Full recovery drill (clone → build → run)
- [ ] Verify environment variable backup accessible
- [ ] Check backup file sizes (shouldn't grow unexpectedly)
- [ ] Review .gitignore (no secrets committed)

### After Major Changes
- [ ] Commit and push to GitHub immediately
- [ ] Verify iCloud sync completed
- [ ] Create tagged release for major versions
- [ ] Update this document if process changes

---

## 🚨 Emergency Contacts

**Primary Developer:**
- Jonah Manning
- Email: jonah@wellsonyx.com
- Phone: +1 (850) 456-1961

**Platform Access:**
- GitHub: wellsonyx org
- Vercel: wellsonyx team
- iCloud: Personal account

---

## 📝 Backup Log

### 2025-11-12
- ✅ Initial GitHub setup
- ✅ README.md updated
- ✅ BACKUP_STRATEGY.md created
- ✅ All code committed to GitHub

### Future Entries
Add significant backup events here:
- Major releases
- Recovery drill results
- Platform migrations
- Infrastructure changes

---

## 🔄 Continuous Improvement

### Planned Enhancements
- [ ] Automated daily backup verification script
- [ ] GitHub Actions for automated testing
- [ ] Database backup strategy (when migrating to Postgres)
- [ ] Encrypted backup to S3/R2 for additional redundancy

---

**Last Updated**: 2025-11-12  
**Next Review**: 2025-12-12
