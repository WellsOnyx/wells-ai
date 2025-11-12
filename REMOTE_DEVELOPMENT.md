# Remote Development Setup

**Wells AI + GRAIN & Vault**

Comprehensive guide for accessing and developing on the Wells AI platform from any device.

---

## 🌐 Infrastructure Overview

### Primary Machine
- **MacBook Air** (Desktop setup with mouse/keyboard)
- **Location**: Office
- **Role**: Primary development workstation
- **Network**: Tailscale VPN (always-on)
- **Hostname**: `macbook-air.local` or Tailscale hostname

### Remote Access Methods
1. **SSH via Tailscale** - Terminal access from any device
2. **tmux** - Persistent terminal sessions
3. **code-server** - VS Code in browser (iPad-friendly)
4. **Git** - Commit and push from anywhere

---

## 🔐 SSH Access via Tailscale

### Prerequisites
Tailscale must be installed and configured on both machines.

### Connection
```bash
# From remote device (laptop, iPad with terminal, etc.)
ssh [your-username]@[tailscale-hostname]

# Example:
ssh jonah@macbook-air
```

### SSH Key Setup (Recommended)
```bash
# On remote device, generate SSH key if you don't have one:
ssh-keygen -t ed25519 -C "your_email@wellsonyx.com"

# Copy public key to MacBook Air:
ssh-copy-id [username]@[tailscale-hostname]

# Now you can SSH without password:
ssh [username]@[tailscale-hostname]
```

### SSH Config (Optional)
Add to `~/.ssh/config` on remote device:
```
Host wells-dev
    HostName [tailscale-hostname]
    User [your-username]
    IdentityFile ~/.ssh/id_ed25519
    ServerAliveInterval 60
    ServerAliveCountMax 3
```

Then connect with:
```bash
ssh wells-dev
```

---

## 📺 tmux Session Management

### Why tmux?
- Persistent sessions survive SSH disconnections
- Multiple terminal panes/windows
- Return to exactly where you left off
- Perfect for long-running processes

### Basic tmux Workflow

#### Starting a New Session
```bash
# SSH into MacBook Air
ssh wells-dev

# Start named tmux session
tmux new -s wells-ai

# Navigate to project
cd ~/Downloads/wells-ai-github-ready
```

#### Detaching from Session
When you need to disconnect but keep processes running:
```
Ctrl+b, then d    # Detach from session
```

#### Reattaching to Session
```bash
# SSH back in
ssh wells-dev

# List sessions
tmux ls

# Reattach to session
tmux attach -t wells-ai
```

#### Common tmux Commands
```bash
# Inside tmux (all start with Ctrl+b):
Ctrl+b c          # Create new window
Ctrl+b n          # Next window
Ctrl+b p          # Previous window
Ctrl+b "          # Split pane horizontally
Ctrl+b %          # Split pane vertically
Ctrl+b arrow      # Navigate between panes
Ctrl+b z          # Zoom pane (toggle fullscreen)
Ctrl+b d          # Detach session
```

### Persistent Development Workflow
```bash
# Session 1: Development server
tmux new -s dev
cd ~/Downloads/wells-ai-github-ready
npm run dev

# Detach: Ctrl+b d

# Session 2: Git/deployment
tmux new -s git
cd ~/Downloads/wells-ai-github-ready
git status
```

Later, from iPad or laptop:
```bash
ssh wells-dev
tmux attach -t dev    # Resume dev server
# or
tmux attach -t git    # Resume git work
```

---

## 💻 code-server (VS Code in Browser)

### What is code-server?
Open-source VS Code running in your browser. Perfect for iPad development.

### Installation
```bash
# On MacBook Air
curl -fsSL https://code-server.dev/install.sh | sh

# Or via Homebrew
brew install code-server
```

### Starting code-server
```bash
# In tmux session (so it stays running)
tmux new -s vscode
cd ~/Downloads/wells-ai-github-ready
code-server --bind-addr 0.0.0.0:8080 --auth password
```

### Accessing from iPad/Browser
1. Note the password from first run (stored in `~/.config/code-server/config.yaml`)
2. From any device on Tailscale network:
   - Open browser
   - Navigate to: `http://[tailscale-hostname]:8080`
   - Enter password
   - Full VS Code interface in browser!

### code-server Configuration
Edit `~/.config/code-server/config.yaml`:
```yaml
bind-addr: 0.0.0.0:8080
auth: password
password: [your-secure-password]
cert: false
```

### iPad Pro Tips
- Use Safari or Chrome on iPad
- Add to Home Screen for app-like experience
- Bluetooth keyboard + trackpad for best experience
- All VS Code extensions work!

---

## 🔄 Git Workflow from Remote Devices

### Basic Workflow
```bash
# 1. SSH into MacBook Air
ssh wells-dev

# 2. Attach to tmux session (or create new)
tmux attach -t git

# 3. Navigate to project
cd ~/Downloads/wells-ai-github-ready

# 4. Check status
git status

# 5. Make changes (via code-server or terminal editor)
vim some-file.ts
# or use code-server in browser

# 6. Commit changes
git add .
git commit -m "Your commit message"

# 7. Push to GitHub
git push
```

### Quick Commit Script
Create `~/scripts/quick-commit.sh`:
```bash
#!/bin/bash
cd ~/Downloads/wells-ai-github-ready
git add .
git commit -m "$1"
git push
echo "✅ Committed and pushed: $1"
```

Usage:
```bash
chmod +x ~/scripts/quick-commit.sh
~/scripts/quick-commit.sh "Fix integration bug"
```

### Deployment Workflow
```bash
# After pushing to GitHub, deploy to Vercel
cd ~/Downloads/wells-ai-github-ready
vercel --prod
```

---

## 📱 iPad-Specific Workflows

### Option 1: code-server + Browser
**Best for: Full development experience**
1. SSH tunnel to keep code-server running
2. Access via Safari at `http://[tailscale-hostname]:8080`
3. Full VS Code with extensions
4. Terminal integrated

### Option 2: Blink Shell + tmux
**Best for: Terminal-focused work**
1. Install Blink Shell (SSH client for iPad)
2. Configure SSH connection to MacBook Air
3. Use tmux for persistent sessions
4. vim/nano for quick edits

### Option 3: Working Copy + SSH
**Best for: Git-focused workflows**
1. Install Working Copy (Git client for iOS)
2. Clone GitHub repo
3. Make changes on iPad
4. Push to GitHub
5. SSH to MacBook Air to deploy

---

## 🚀 Common Remote Development Scenarios

### Scenario 1: Quick Bug Fix from iPad
```bash
# 1. Connect via Blink Shell or Safari SSH
ssh wells-dev

# 2. Attach to existing session
tmux attach -t dev

# 3. Edit file
vim lib/some-file.ts

# 4. Test locally (if dev server running in another pane)
# Ctrl+b n to switch to dev server pane

# 5. Commit and push
git add lib/some-file.ts
git commit -m "Fix bug in some-file"
git push

# 6. Deploy
vercel --prod
```

### Scenario 2: Long Build from Laptop
```bash
# 1. SSH and start tmux
ssh wells-dev
tmux new -s build

# 2. Start long-running task
npm run build
# or
npm run type-check

# 3. Detach (Ctrl+b d) and close laptop
# 4. Come back later, reattach:
ssh wells-dev
tmux attach -t build

# Build is still running or completed!
```

### Scenario 3: Monitoring Production
```bash
# 1. SSH to MacBook Air
ssh wells-dev

# 2. Create monitoring session
tmux new -s monitor

# 3. Split into panes
Ctrl+b "    # Split horizontally

# Top pane: Vercel logs
vercel logs wellsai.vercel.app --follow

# Bottom pane (Ctrl+b arrow to switch): Git status
watch -n 10 git status

# Detach and leave running
Ctrl+b d
```

---

## 🔧 Troubleshooting

### SSH Connection Issues
```bash
# Check Tailscale status
tailscale status

# Restart Tailscale
sudo tailscale up

# Check SSH service
sudo systemctl status ssh    # Linux
sudo launchctl list | grep ssh    # macOS
```

### tmux Session Lost
```bash
# List all sessions
tmux ls

# Kill stuck session
tmux kill-session -t session-name

# Start fresh
tmux new -s session-name
```

### code-server Won't Start
```bash
# Check if port is in use
lsof -i :8080

# Kill process using port
kill -9 [PID]

# Restart code-server
code-server --bind-addr 0.0.0.0:8080
```

### Git Push Fails
```bash
# Check remote
git remote -v

# Test GitHub authentication
gh auth status

# Re-authenticate if needed
gh auth login --web
```

---

## 🎯 Best Practices

### Security
- ✅ Use Tailscale (encrypted P2P VPN)
- ✅ SSH keys instead of passwords
- ✅ Strong code-server password
- ✅ Never expose ports to public internet
- ✅ Keep software updated

### Efficiency
- ✅ Name tmux sessions descriptively (`dev`, `git`, `monitor`)
- ✅ Use tmux panes for related tasks
- ✅ Keep dev server running in tmux
- ✅ Write quick scripts for common tasks
- ✅ Bookmark code-server URL on iPad

### Workflow
- ✅ Always work in tmux for remote sessions
- ✅ Commit frequently when remote
- ✅ Test locally before pushing
- ✅ Detach, don't kill sessions
- ✅ Document changes as you go

---

## 📊 Infrastructure Summary

### Backup Tiers
1. **Primary**: GitHub (source of truth)
2. **Secondary**: iCloud Drive (file-level backup, real-time sync)
3. **Tertiary**: Vercel (deployment snapshots)

### Access Methods
1. **Direct**: MacBook Air with mouse/keyboard
2. **SSH**: Terminal access via Tailscale
3. **tmux**: Persistent sessions
4. **code-server**: Browser-based VS Code
5. **Git**: Push/pull from anywhere

### Development Locations
- **Office**: Primary MacBook Air
- **Home**: SSH via Tailscale
- **Travel**: iPad + code-server or Blink Shell
- **Emergency**: Any device with SSH client

---

## 🆘 Emergency Contacts

**Primary Developer:**
- Jonah Manning
- Email: jonah@wellsonyx.com
- Phone: +1 (850) 456-1961

**Infrastructure:**
- GitHub: https://github.com/WellsOnyx/wells-ai
- Vercel: wellsai.vercel.app
- Tailscale: [Your Tailscale account]

---

**Last Updated**: 2025-11-12
**Next Review**: 2025-12-12
