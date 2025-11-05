# Vault Security Architecture: Security-First Design

**Date:** November 4, 2025
**Status:** FOUNDATIONAL SECURITY FRAMEWORK
**Principle:** Security is not added later—it's built into every layer from day one.

---

## Core Security Principles

### 1. **Defense in Depth**
Multiple layers of security so if one fails, others protect the system.

### 2. **Principle of Least Privilege**
Every component has ONLY the permissions it absolutely needs.

### 3. **Immutable Audit Trail**
Every action is logged on-chain—cannot be altered or deleted.

### 4. **Multi-Signature Control**
No single person can move funds—requires 2-of-3 or 3-of-5 signatures.

### 5. **Time-Locked Operations**
Large operations have mandatory delay periods (24-48 hours).

### 6. **Real-Time Monitoring**
Automated alerts for suspicious activity, 24/7 monitoring.

---

## Security Architecture: 7 Layers

```
Layer 7: Monitoring & Incident Response ←─ Real-time alerts
Layer 6: Access Control & Authentication ←─ Multi-factor, hardware keys
Layer 5: Application Security ←─────────── API rate limits, input validation
Layer 4: Smart Contract Security ←──────── Audited, time-locks, multi-sig
Layer 3: Cryptographic Security ←───────── Private keys, encryption
Layer 2: Network Security ←─────────────── RPC endpoints, DDoS protection
Layer 1: Physical Security ←────────────── Hardware wallets, secure facilities
```

---

## Layer 1: Physical Security (Hardware)

### **Hardware Wallet Storage (Cold Storage)**

**Primary Cold Storage:**
```
3 Ledger Nano X devices (one per founder)
- Store master private keys
- NEVER connected to internet except for signing
- Stored in separate physical locations
- Fireproof, waterproof safes

Location distribution:
- Device 1: Jonah's secure location
- Device 2: Jonathan's secure location
- Device 3: Third partner's secure location

Backup seeds:
- Stamped on metal plates (fireproof)
- Split using Shamir's Secret Sharing (2-of-3 recovery)
- Stored in bank safety deposit boxes
```

**Hot Wallet (Operational)**
```
1 hardware wallet for day-to-day operations
- Max balance: $100K
- Replenished from cold storage as needed
- Requires 2-of-3 multi-sig for any transaction
- Automated alerts if balance drops below $10K
```

### **Secure Facilities**
```
Office security:
- Locked server room (keycard + biometric)
- 24/7 surveillance cameras
- Network isolated from public WiFi
- Encrypted hard drives (BitLocker/FileVault)
```

---

## Layer 2: Network Security

### **RPC Node Security**

**Why This Matters:**
Your app talks to the blockchain via RPC nodes. If compromised, attackers can:
- Return fake balance data
- Manipulate transaction results
- Steal private keys if exposed

**Solution:**
```typescript
// Multiple redundant RPC providers
const RPC_PROVIDERS = [
  'https://mainnet.base.org',           // Coinbase official
  'https://base.llamarpc.com',          // LlamaNodes
  'https://base-mainnet.infura.io',     // Infura
]

// Fallback mechanism
async function sendTransaction(tx: Transaction) {
  for (const rpc of RPC_PROVIDERS) {
    try {
      const result = await rpc.send(tx)
      // Verify result with 2 other RPCs before accepting
      if (await verifyWithMultipleNodes(result)) {
        return result
      }
    } catch (err) {
      console.error(`RPC ${rpc} failed, trying next...`)
    }
  }
  throw new Error('All RPC providers failed')
}
```

**Security Measures:**
- Use private RPC endpoints (not public)
- Rotate API keys monthly
- Rate limit: 100 requests/second max
- DDoS protection via Cloudflare
- Monitor for unusual traffic patterns

---

## Layer 3: Cryptographic Security

### **Private Key Management**

**CRITICAL: Private keys = ownership. If compromised, funds are GONE.**

**Key Generation:**
```typescript
// NEVER generate keys in JavaScript (weak randomness)
// ALWAYS use hardware wallet or dedicated key generation tool

// Example: Using ethers.js ONLY for viewing, not generating
import { ethers } from 'ethers'

// ❌ WRONG - Don't do this in production
const weakWallet = ethers.Wallet.createRandom()

// ✅ RIGHT - Use hardware wallet
const provider = new ethers.providers.JsonRpcProvider(RPC_URL)
const signer = new HardwareWalletSigner(provider) // Ledger/Trezor
```

**Key Storage:**
```
NEVER store private keys:
❌ In code (even encrypted)
❌ In database
❌ In environment variables
❌ In browser localStorage
❌ On paper (except backup seeds in safe)

ALWAYS use:
✅ Hardware wallets (Ledger/Trezor)
✅ Multi-sig smart contracts (keys distributed)
✅ Threshold signatures (2-of-3 required)
```

**Encryption Standards:**
```
Data at rest: AES-256-GCM
Data in transit: TLS 1.3
Hashing: SHA-256 (blockchain standard)
Key derivation: BIP39 (mnemonic seeds)
```

---

## Layer 4: Smart Contract Security

### **Multi-Signature Vault**

**Why:** No single person can move funds. Requires 2-of-3 or 3-of-5 signatures.

```solidity
// contracts/MultiSigVault.sol
contract MultiSigVault {
    address[] public owners;
    uint256 public requiredSignatures;

    struct Transaction {
        address to;
        uint256 value;
        bytes data;
        bool executed;
        mapping(address => bool) signatures;
        uint256 signatureCount;
    }

    Transaction[] public transactions;

    modifier onlyOwner() {
        require(isOwner(msg.sender), "Not an owner");
        _;
    }

    modifier txExists(uint256 txId) {
        require(txId < transactions.length, "Transaction does not exist");
        _;
    }

    modifier notExecuted(uint256 txId) {
        require(!transactions[txId].executed, "Transaction already executed");
        _;
    }

    modifier notSigned(uint256 txId) {
        require(!transactions[txId].signatures[msg.sender], "Already signed");
        _;
    }

    constructor(address[] memory _owners, uint256 _requiredSignatures) {
        require(_owners.length >= _requiredSignatures, "Invalid setup");
        require(_requiredSignatures > 0, "Need at least 1 signature");

        owners = _owners;
        requiredSignatures = _requiredSignatures;
    }

    /**
     * Submit transaction (does NOT execute it)
     */
    function submitTransaction(address to, uint256 value, bytes memory data)
        public
        onlyOwner
        returns (uint256)
    {
        uint256 txId = transactions.length;
        transactions.push();
        Transaction storage t = transactions[txId];
        t.to = to;
        t.value = value;
        t.data = data;
        t.executed = false;
        t.signatureCount = 0;

        emit TransactionSubmitted(txId, to, value);
        return txId;
    }

    /**
     * Sign transaction (increments signature count)
     */
    function signTransaction(uint256 txId)
        public
        onlyOwner
        txExists(txId)
        notExecuted(txId)
        notSigned(txId)
    {
        Transaction storage t = transactions[txId];
        t.signatures[msg.sender] = true;
        t.signatureCount += 1;

        emit TransactionSigned(txId, msg.sender);

        // Auto-execute if enough signatures
        if (t.signatureCount >= requiredSignatures) {
            executeTransaction(txId);
        }
    }

    /**
     * Execute transaction (only if enough signatures)
     */
    function executeTransaction(uint256 txId)
        public
        onlyOwner
        txExists(txId)
        notExecuted(txId)
    {
        Transaction storage t = transactions[txId];
        require(t.signatureCount >= requiredSignatures, "Not enough signatures");

        t.executed = true;
        (bool success, ) = t.to.call{value: t.value}(t.data);
        require(success, "Transaction failed");

        emit TransactionExecuted(txId);
    }

    /**
     * Revoke signature (before execution)
     */
    function revokeSignature(uint256 txId)
        public
        onlyOwner
        txExists(txId)
        notExecuted(txId)
    {
        Transaction storage t = transactions[txId];
        require(t.signatures[msg.sender], "Not signed yet");

        t.signatures[msg.sender] = false;
        t.signatureCount -= 1;

        emit SignatureRevoked(txId, msg.sender);
    }

    // Events
    event TransactionSubmitted(uint256 indexed txId, address to, uint256 value);
    event TransactionSigned(uint256 indexed txId, address signer);
    event TransactionExecuted(uint256 indexed txId);
    event SignatureRevoked(uint256 indexed txId, address signer);
}
```

### **Time-Lock for Large Withdrawals**

**Why:** Gives time to detect and stop malicious transactions.

```solidity
// contracts/TimeLock.sol
contract TimeLock {
    uint256 public constant DELAY = 24 hours;

    mapping(bytes32 => uint256) public queuedTransactions;

    event TransactionQueued(bytes32 indexed txHash, uint256 executeTime);
    event TransactionExecuted(bytes32 indexed txHash);
    event TransactionCancelled(bytes32 indexed txHash);

    /**
     * Queue large withdrawal (must wait 24 hours)
     */
    function queueTransaction(address target, uint256 value, bytes memory data)
        public
        returns (bytes32)
    {
        bytes32 txHash = keccak256(abi.encode(target, value, data));
        uint256 executeTime = block.timestamp + DELAY;

        queuedTransactions[txHash] = executeTime;
        emit TransactionQueued(txHash, executeTime);

        return txHash;
    }

    /**
     * Execute queued transaction (only after delay)
     */
    function executeTransaction(address target, uint256 value, bytes memory data)
        public
    {
        bytes32 txHash = keccak256(abi.encode(target, value, data));
        uint256 executeTime = queuedTransactions[txHash];

        require(executeTime != 0, "Transaction not queued");
        require(block.timestamp >= executeTime, "Time lock not expired");

        delete queuedTransactions[txHash];

        (bool success, ) = target.call{value: value}(data);
        require(success, "Transaction failed");

        emit TransactionExecuted(txHash);
    }

    /**
     * Cancel queued transaction (emergency stop)
     */
    function cancelTransaction(bytes32 txHash) public {
        require(queuedTransactions[txHash] != 0, "Transaction not queued");
        delete queuedTransactions[txHash];
        emit TransactionCancelled(txHash);
    }
}
```

### **Emergency Pause Mechanism**

**Why:** If something goes wrong, freeze everything immediately.

```solidity
// contracts/EmergencyPause.sol
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract EmergencyPause is Pausable, AccessControl {
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    constructor() {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(PAUSER_ROLE, msg.sender);
    }

    /**
     * Pause all contract operations
     */
    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
        emit EmergencyPaused(msg.sender, block.timestamp);
    }

    /**
     * Unpause (requires admin role)
     */
    function unpause() public onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
        emit EmergencyUnpaused(msg.sender, block.timestamp);
    }

    event EmergencyPaused(address by, uint256 timestamp);
    event EmergencyUnpaused(address by, uint256 timestamp);
}
```

### **Smart Contract Audit Checklist**

Before deploying ANY smart contract to mainnet:

- [ ] **Reentrancy protection** (use OpenZeppelin's ReentrancyGuard)
- [ ] **Integer overflow protection** (Solidity 0.8+ has built-in checks)
- [ ] **Access control** (only authorized addresses can call sensitive functions)
- [ ] **Input validation** (check all parameters before processing)
- [ ] **Gas optimization** (minimize loops, expensive operations)
- [ ] **Event logging** (emit events for all state changes)
- [ ] **Emergency pause** (can freeze contract if needed)
- [ ] **Upgrade mechanism** (proxy pattern for future fixes)
- [ ] **External audit** (hire firm like OpenZeppelin, Trail of Bits)
- [ ] **Bug bounty** (offer rewards for finding vulnerabilities)

**Audit Firms to Consider:**
- OpenZeppelin ($15K-50K)
- Trail of Bits ($30K-100K)
- Consensys Diligence ($20K-80K)
- Certik ($10K-40K)

**Budget for DR Deal:** Use $50K from escrow service fee for audit.

---

## Layer 5: Application Security (Backend/Frontend)

### **API Security**

```typescript
// Rate limiting (prevent DDoS)
import rateLimit from 'express-rate-limit'

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Max 100 requests per IP per 15 min
  message: 'Too many requests, please try again later',
})

app.use('/api/', limiter)

// Input validation (prevent injection attacks)
import { z } from 'zod'

const TransferSchema = z.object({
  to: z.string().regex(/^0x[a-fA-F0-9]{40}$/), // Valid Ethereum address
  amount: z.number().positive().max(1_000_000), // Max $1M per transaction
  currency: z.enum(['USDC', 'GRAIN']),
})

app.post('/api/transfer', async (req, res) => {
  try {
    const { to, amount, currency } = TransferSchema.parse(req.body)
    // Process transfer...
  } catch (err) {
    return res.status(400).json({ error: 'Invalid input' })
  }
})

// Authentication (JWT + hardware key)
import jwt from 'jsonwebtoken'

function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'Not authenticated' })

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.userId = decoded.userId
    next()
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' })
  }
}

// SQL injection prevention (use parameterized queries)
// ❌ WRONG - Vulnerable to SQL injection
const userId = req.params.id
const query = `SELECT * FROM users WHERE id = ${userId}`

// ✅ RIGHT - Parameterized query
const userId = req.params.id
const query = prisma.user.findUnique({ where: { id: userId } })
```

### **Frontend Security**

```typescript
// XSS prevention (sanitize user input)
import DOMPurify from 'dompurify'

function renderUserContent(content: string) {
  const sanitized = DOMPurify.sanitize(content)
  return <div dangerouslySetInnerHTML={{ __html: sanitized }} />
}

// CSRF protection (token validation)
import { csrfProtection } from 'next-csrf'

export default csrfProtection(async (req, res) => {
  // API handler with CSRF protection
})

// Secure cookies
res.setHeader('Set-Cookie', [
  `token=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=3600`
])
```

---

## Layer 6: Access Control & Authentication

### **Multi-Factor Authentication (MFA)**

**Required for ALL administrative actions:**

```
Level 1: Password (minimum 16 characters)
Level 2: Hardware security key (YubiKey, Titan Key)
Level 3: Biometric (TouchID, FaceID)
Level 4: Time-based OTP (Google Authenticator)

Admin actions require Level 1 + Level 2 + Level 4
Financial transactions require ALL 4 levels
```

### **Role-Based Access Control (RBAC)**

```typescript
// lib/rbac.ts
export enum Role {
  ADMIN = 'ADMIN',           // Full access (Jonah, Jonathan)
  ORACLE = 'ORACLE',         // Can complete milestones
  AUDITOR = 'AUDITOR',       // Read-only access
  USER = 'USER',             // Normal user
}

export enum Permission {
  CREATE_ESCROW = 'CREATE_ESCROW',
  RELEASE_FUNDS = 'RELEASE_FUNDS',
  PAUSE_CONTRACT = 'PAUSE_CONTRACT',
  WITHDRAW_TREASURY = 'WITHDRAW_TREASURY',
  VIEW_AUDIT_LOG = 'VIEW_AUDIT_LOG',
}

const rolePermissions: Record<Role, Permission[]> = {
  [Role.ADMIN]: [
    Permission.CREATE_ESCROW,
    Permission.RELEASE_FUNDS,
    Permission.PAUSE_CONTRACT,
    Permission.WITHDRAW_TREASURY,
    Permission.VIEW_AUDIT_LOG,
  ],
  [Role.ORACLE]: [
    Permission.RELEASE_FUNDS, // Can complete milestones
    Permission.VIEW_AUDIT_LOG,
  ],
  [Role.AUDITOR]: [
    Permission.VIEW_AUDIT_LOG, // Read-only
  ],
  [Role.USER]: [], // No admin permissions
}

export function hasPermission(userRole: Role, permission: Permission): boolean {
  return rolePermissions[userRole].includes(permission)
}
```

### **IP Whitelisting for Admin Panel**

```typescript
// middleware.ts
const ADMIN_ALLOWED_IPS = [
  '203.0.113.0',    // Jonah's office
  '198.51.100.0',   // Jonathan's office
  '192.0.2.0',      // VPN endpoint
]

export function middleware(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || req.ip

  if (req.nextUrl.pathname.startsWith('/admin')) {
    if (!ADMIN_ALLOWED_IPS.includes(ip)) {
      return new Response('Forbidden', { status: 403 })
    }
  }

  return NextResponse.next()
}
```

---

## Layer 7: Monitoring & Incident Response

### **Real-Time Monitoring**

```typescript
// lib/monitoring.ts
import { ethers } from 'ethers'
import Sentry from '@sentry/nextjs'
import twilio from 'twilio'

const ALERT_PHONE = '+1234567890' // Jonah's phone
const ALERT_EMAIL = 'security@grainvault.com'

/**
 * Monitor Vault contract 24/7
 */
export async function monitorVault() {
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL)
  const vault = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, provider)

  // Listen for all events
  vault.on('*', async (event) => {
    console.log('Vault event:', event)

    // Check for suspicious activity
    if (event.event === 'LargeWithdrawal') {
      await alertSecurity({
        severity: 'HIGH',
        message: `Large withdrawal: ${ethers.utils.formatUnits(event.args.amount, 6)} USDC`,
        event,
      })
    }

    if (event.event === 'UnauthorizedAccess') {
      await alertSecurity({
        severity: 'CRITICAL',
        message: 'Unauthorized access attempt detected!',
        event,
      })
    }

    // Log to audit trail
    await prisma.auditLog.create({
      data: {
        eventType: event.event,
        contractAddress: VAULT_ADDRESS,
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber,
        args: JSON.stringify(event.args),
        timestamp: new Date(),
      },
    })
  })
}

/**
 * Alert security team
 */
async function alertSecurity(alert: {
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  message: string
  event?: any
}) {
  // Send SMS (for CRITICAL/HIGH alerts)
  if (alert.severity === 'CRITICAL' || alert.severity === 'HIGH') {
    const client = twilio(TWILIO_SID, TWILIO_TOKEN)
    await client.messages.create({
      to: ALERT_PHONE,
      from: TWILIO_PHONE,
      body: `🚨 SECURITY ALERT [${alert.severity}]\n\n${alert.message}`,
    })
  }

  // Send email
  await sendEmail({
    to: ALERT_EMAIL,
    subject: `Security Alert: ${alert.severity}`,
    body: alert.message,
  })

  // Log to Sentry
  Sentry.captureMessage(alert.message, {
    level: alert.severity.toLowerCase() as any,
    extra: alert.event,
  })

  // Log to database
  await prisma.securityAlert.create({
    data: {
      severity: alert.severity,
      message: alert.message,
      eventData: alert.event ? JSON.stringify(alert.event) : null,
      timestamp: new Date(),
    },
  })
}
```

### **Anomaly Detection**

```typescript
// Detect unusual patterns
export async function detectAnomalies() {
  // Check for unusual transaction volumes
  const last24h = await prisma.transaction.count({
    where: {
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  })

  const avg7d = await getAverageDaily(7)

  if (last24h > avg7d * 3) {
    await alertSecurity({
      severity: 'MEDIUM',
      message: `Unusual transaction volume: ${last24h} (avg: ${avg7d})`,
    })
  }

  // Check for repeated failed login attempts
  const failedLogins = await prisma.loginAttempt.count({
    where: {
      success: false,
      createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) },
    },
  })

  if (failedLogins > 10) {
    await alertSecurity({
      severity: 'HIGH',
      message: `Possible brute force attack: ${failedLogins} failed logins in 15 min`,
    })
  }

  // Check for large balance changes
  const currentBalance = await vault.getReserves()
  const lastBalance = await getLastRecordedBalance()

  const changePercent = Math.abs((currentBalance - lastBalance) / lastBalance) * 100

  if (changePercent > 10) {
    await alertSecurity({
      severity: 'HIGH',
      message: `Large balance change: ${changePercent.toFixed(2)}%`,
    })
  }
}

// Run every 5 minutes
setInterval(detectAnomalies, 5 * 60 * 1000)
```

### **Incident Response Playbook**

**If security breach detected:**

```
STEP 1: STOP (Within 5 minutes)
- Trigger emergency pause on all contracts
- Disable all API endpoints
- Revoke all active sessions
- Block suspicious IP addresses

STEP 2: ASSESS (Within 30 minutes)
- What was compromised?
- How much was affected?
- Is the attack ongoing?
- Who has been notified?

STEP 3: CONTAIN (Within 2 hours)
- Move funds to cold storage if possible
- Isolate affected systems
- Preserve forensic evidence
- Contact authorities if needed

STEP 4: COMMUNICATE (Within 4 hours)
- Notify affected users
- Post status page update
- Prepare public statement
- Contact insurance company

STEP 5: RECOVER (Within 24 hours)
- Fix vulnerability
- Deploy patched contracts
- Restore service gradually
- Compensate affected users if applicable

STEP 6: POST-MORTEM (Within 1 week)
- Write detailed incident report
- Identify root cause
- Implement preventive measures
- Update security policies
```

---

## Security Audit Schedule

### **Daily:**
- Automated monitoring (24/7)
- Review anomaly detection alerts
- Check system health dashboards

### **Weekly:**
- Manual review of all large transactions
- Review access logs for unusual activity
- Test emergency pause mechanism
- Verify multi-sig wallet configuration

### **Monthly:**
- Penetration testing (hire ethical hackers)
- Update dependencies (security patches)
- Review and rotate API keys
- Audit user permissions

### **Quarterly:**
- External security audit
- Disaster recovery drill
- Review and update incident response plan
- Security training for team

### **Annually:**
- Full smart contract audit by external firm
- Comprehensive penetration test
- Review insurance coverage
- Update security policies

---

## Security Budget (From $5M Escrow Fee)

```
Smart contract audit: $50K
Insurance (E&O, cyber, crime): $100K
Hardware wallets (3x Ledger): $1K
Security monitoring tools: $20K/year
Bug bounty program: $50K pool
Penetration testing: $30K/year
Incident response retainer: $25K/year
Total Year 1: $276K (5.5% of operating capital)
```

**This is NOT optional. Security = trust = business.**

---

## Next Steps for DR $3B Deal

### **Week 1 (Security Setup):**
- [ ] Order 3 Ledger Nano X devices
- [ ] Set up multi-sig wallet (2-of-3)
- [ ] Configure RPC providers with failover
- [ ] Set up monitoring infrastructure (Sentry, alerts)

### **Week 2 (Smart Contract Development):**
- [ ] Write EscrowVault.sol with all security features
- [ ] Write MultiSigVault.sol for treasury management
- [ ] Write TimeLock.sol for large withdrawals
- [ ] Deploy to Base Sepolia testnet

### **Week 3 (Testing & Audit):**
- [ ] Test all security mechanisms
- [ ] Attempt to break it (internal red team)
- [ ] Get external audit (fast-track: $50K)
- [ ] Fix any vulnerabilities found

### **Week 4 (Deploy & Present to DR):**
- [ ] Deploy to Base mainnet
- [ ] Fund with test $10K escrow
- [ ] Create transparency dashboard
- [ ] Jonathan presents to DR Central Bank

---

## The Bottom Line

**Security is not a feature. It's the foundation.**

When you're holding $3B of someone else's money:
- You can't afford a single mistake
- You can't recover from a hack
- You can't "move fast and break things"

**You move deliberately and build it right the first time.**

This architecture does that.

---

**Status:** Security-first foundation ready to build. 🔒

**Next:** Initialize Hardhat, implement these patterns in code.
