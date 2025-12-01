# GRAIN & Vault Frontend Integration Guide

## Overview

This guide covers the complete frontend implementation for the GRAIN & Vault system - an institutional-grade, asset-backed stablecoin with real-world utility.

## Architecture

The frontend is built using:
- **Next.js 16** - React framework with App Router
- **TypeScript** - Type-safe development
- **Wagmi** - React hooks for Ethereum
- **Viem** - TypeScript Ethereum library
- **RainbowKit** - Wallet connection UI
- **Tailwind CSS** - Utility-first styling
- **Recharts** - Data visualization

## Smart Contract Addresses

Configure these in your `.env.local`:

```bash
# Base Mainnet (Production)
NEXT_PUBLIC_GRAIN_ADDRESS=0x...
NEXT_PUBLIC_VAULT_ADDRESS=0x...
NEXT_PUBLIC_ESCROW_ADDRESS=0x...
NEXT_PUBLIC_ADMIN_ADDRESS=0x...

# WalletConnect Project ID
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id

# Network
NEXT_PUBLIC_CHAIN_ID=8453  # Base Mainnet
```

## Project Structure

```
app/
├── grain/
│   ├── invest/          # Founding Investor Portal
│   │   └── page.tsx
│   ├── dashboard/       # Public Dashboard
│   │   └── page.tsx
│   └── escrow/          # Escrow Management
│       └── page.tsx
├── admin/
│   └── grain/           # Admin Panel
│       └── page.tsx
├── api/
│   └── grain/           # API Routes
│       ├── escrow/
│       └── admin/
├── hooks/               # React Hooks
│   ├── useGrain.ts
│   ├── useVault.ts
│   └── useEscrow.ts
└── components/
    └── grain/           # UI Components
        ├── Web3Provider.tsx
        ├── WalletConnect.tsx
        ├── GrainCard.tsx
        ├── MetricCard.tsx
        ├── NavDisplay.tsx
        ├── CountdownTimer.tsx
        ├── InvestmentCalculator.tsx
        ├── VestingTimeline.tsx
        ├── AssetBreakdown.tsx
        ├── NavChart.tsx
        └── EscrowCard.tsx
```

## Core Components

### 1. Web3Provider

Wraps your app with Web3 functionality:

```typescript
// app/layout.tsx
import { Web3Provider } from '@/app/components/grain/Web3Provider';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <Web3Provider>
          {children}
        </Web3Provider>
      </body>
    </html>
  );
}
```

### 2. React Hooks

#### useGrain

Interact with GRAIN token:

```typescript
import { useGrain } from '@/app/hooks/useGrain';

function MyComponent() {
  const { balance, nav, mint, burn, transfer, vestingSchedule } = useGrain();

  // Mint GRAIN
  const handleMint = async () => {
    await mint('1000'); // Mint 1000 GRAIN
  };

  return (
    <div>
      <p>Balance: {balance?.total} GRAIN</p>
      <p>NAV: ${nav}</p>
      <p>Locked: {balance?.locked}</p>
      <p>Unlocked: {balance?.unlocked}</p>
    </div>
  );
}
```

#### useVault

Access vault data and operations:

```typescript
import { useVault, AssetTier } from '@/app/hooks/useVault';

function VaultComponent() {
  const { totalAssets, nav, tiers, history, deposit, withdraw } = useVault();

  // Deposit to Tier 1 (Liquid)
  const handleDeposit = async () => {
    await deposit(AssetTier.LIQUID, '1000000'); // $1M
  };

  return (
    <div>
      <p>Total Assets: ${totalAssets}</p>
      <p>NAV: ${nav}</p>
      {tiers.map(tier => (
        <div key={tier.tier}>
          <p>{tier.name}: ${tier.amount}</p>
        </div>
      ))}
    </div>
  );
}
```

#### useEscrow

Manage milestone-based escrows:

```typescript
import { useEscrow } from '@/app/hooks/useEscrow';

function EscrowComponent() {
  const { activeEscrows, create, releaseMilestone, dispute } = useEscrow();

  // Create escrow
  const handleCreate = async () => {
    await create(
      '0xCounterpartyAddress',
      '1000',
      [
        { name: 'Milestone 1', percentage: 50 },
        { name: 'Milestone 2', percentage: 50 },
      ],
      '0xResolverAddress'
    );
  };

  return (
    <div>
      {activeEscrows.map(escrow => (
        <div key={escrow.id}>
          <p>Escrow #{escrow.id}</p>
          <p>Amount: {escrow.amount} GRAIN</p>
          <p>Progress: {escrow.progressPercentage}%</p>
        </div>
      ))}
    </div>
  );
}
```

## Key Features

### 1. Founding Investor Portal (`/grain/invest`)

**Features:**
- Hero section with locked $1.00 price
- Real-time NAV display ($1.0417)
- Spots remaining counter (87/100)
- Countdown timer to launch
- Investment calculator
- KYC collection flow
- Wallet connection & approval
- GRAIN minting at locked price
- Vesting schedule display

**User Flow:**
1. Land on page → See value proposition
2. Connect wallet
3. Complete KYC (name, email, address, accreditation)
4. Choose investment amount (min $10K)
5. Approve USDC
6. Mint GRAIN at $1.00
7. View confirmation & vesting details

### 2. Public Dashboard (`/grain/dashboard`)

**Features:**
- Real-time NAV display (large, prominent)
- 24h/7d/30d/ATH metrics
- Total supply & total assets
- Price history chart
- Asset tier breakdown (pie chart)
- Reserve proof & backing ratio
- Audit reports & insurance docs
- Investor portfolio (if connected):
  - Total/locked/unlocked balances
  - Unrealized gains/losses
  - Vesting timeline
  - Transaction history

**Access:**
- Public (read-only)
- Wallet connection optional
- Enhanced view for token holders

### 3. Escrow Management (`/grain/escrow`)

**Features:**
- Create new escrow
- Define milestones with percentages
- Select dispute resolver
- View active/completed/disputed escrows
- Release milestones (creator only)
- Raise disputes
- Track progress & released amounts

**User Flow:**
1. Connect wallet
2. Click "Create Escrow"
3. Enter counterparty address
4. Define total amount
5. Add milestones (must total 100%)
6. Select resolver
7. Approve & create
8. Monitor escrow progress
9. Release milestones as completed
10. Dispute if needed

### 4. Admin Panel (`/admin/grain`)

**Features:**
- System health monitoring
- NAV management:
  - View current NAV
  - Manual NAV update (with warnings)
  - NAV calculation breakdown
- Asset tier management:
  - View all tier values
  - Deposit/withdraw from tiers
- User management:
  - Founding investor list
  - Vesting schedules
  - KYC status
- Emergency controls:
  - Circuit breaker (pause/unpause)
  - Transaction logs
  - Alert configuration

**Access Control:**
- Wallet address must match `NEXT_PUBLIC_ADMIN_ADDRESS`
- All actions logged for audit
- Multi-sig recommended for production

## Styling & Theming

### Color Palette

```javascript
// Wells brand colors (from tailwind.config.js)
'wells-blue': '#183b6d',
'wells-gold': '#dba63f',
'wells-black': '#000000',
'wells-gray-dark': '#575757',
'wells-gray-light': '#9ea1a7',
```

### Dark Mode (Default)

The entire interface uses dark mode by default:
- Background: `#000000` (black)
- Cards: `#1f2937` (gray-900)
- Borders: `#374151` (gray-800)
- Text: `#ffffff` (white)
- Accent: `#dba63f` (wells-gold)

### Component Styling

All components follow the same pattern:

```typescript
<div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
  {/* Content */}
</div>
```

## Real-Time Updates

### WebSocket Integration (Recommended)

For production, implement WebSocket connections:

```typescript
// lib/websocket.ts
export function useRealtimeNav() {
  const [nav, setNav] = useState('0.00');

  useEffect(() => {
    const ws = new WebSocket('wss://api.grainvault.com/ws');

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'NAV_UPDATE') {
        setNav(data.value);
      }
    };

    return () => ws.close();
  }, []);

  return nav;
}
```

### Polling Alternative

For simpler implementation:

```typescript
useEffect(() => {
  const interval = setInterval(() => {
    refetch(); // From hook
  }, 30000); // Every 30s

  return () => clearInterval(interval);
}, [refetch]);
```

## Deployment Checklist

### Pre-Deployment

- [ ] Update all contract addresses in `.env.local`
- [ ] Test wallet connections on testnet
- [ ] Verify NAV calculations
- [ ] Test all escrow flows
- [ ] Audit smart contract interactions
- [ ] Set up monitoring & alerts
- [ ] Configure rate limiting on APIs
- [ ] Enable error tracking (Sentry)
- [ ] Test responsive design
- [ ] Run accessibility audit (WCAG 2.1 AA)

### Environment Variables

```bash
# Required
NEXT_PUBLIC_GRAIN_ADDRESS=0x...
NEXT_PUBLIC_VAULT_ADDRESS=0x...
NEXT_PUBLIC_ESCROW_ADDRESS=0x...
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...
NEXT_PUBLIC_CHAIN_ID=8453

# Optional
NEXT_PUBLIC_ADMIN_ADDRESS=0x...
NEXT_PUBLIC_ANALYTICS_ID=...
NEXT_PUBLIC_SENTRY_DSN=...
```

### Build & Deploy

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Start production server
npm start

# Or deploy to Vercel
vercel --prod
```

## Security Considerations

### Smart Contract Safety

1. **Read-Only by Default**: Most hooks are read-only
2. **User Confirmation**: Always require user approval for transactions
3. **Gas Estimation**: Estimate gas before transactions
4. **Error Handling**: Graceful error handling with user feedback
5. **Slippage Protection**: Warn users of price changes

### Frontend Security

1. **No Private Keys**: Never store private keys in frontend
2. **Env Variables**: Use `.env.local`, never commit to git
3. **Input Validation**: Validate all user inputs
4. **XSS Protection**: Sanitize user-generated content
5. **CSRF Tokens**: Implement for state-changing operations

### Admin Panel

1. **Address Whitelist**: Only specific addresses can access
2. **Action Logging**: Log all admin actions
3. **Confirmation Dialogs**: Require confirmation for dangerous ops
4. **Multi-Sig**: Use multi-sig wallet for admin operations

## Performance Optimization

### Code Splitting

```typescript
// Lazy load heavy components
const AdminPanel = lazy(() => import('@/app/admin/grain/page'));
```

### Caching

```typescript
// Use SWR or React Query for caching
const { data, error } = useSWR('/api/grain/nav', fetcher, {
  refreshInterval: 30000, // 30s
});
```

### Image Optimization

```typescript
import Image from 'next/image';

<Image
  src="/grain-logo.png"
  width={200}
  height={200}
  alt="GRAIN"
  priority
/>
```

## Testing

### Unit Tests

```bash
npm test
```

### E2E Tests

```bash
npm run test:e2e
```

### Manual Testing Checklist

- [ ] Connect wallet (MetaMask, WalletConnect)
- [ ] Switch networks
- [ ] View dashboard without wallet
- [ ] View dashboard with wallet
- [ ] Create escrow
- [ ] Release milestone
- [ ] Raise dispute
- [ ] Update NAV (admin)
- [ ] Pause contracts (admin)
- [ ] Responsive on mobile
- [ ] Dark mode rendering
- [ ] Chart rendering
- [ ] Form validation

## Troubleshooting

### Common Issues

**Wallet won't connect:**
- Check WalletConnect Project ID
- Verify network configuration
- Clear browser cache

**Transactions failing:**
- Check gas prices
- Verify contract addresses
- Ensure sufficient balance
- Check network congestion

**Data not loading:**
- Verify RPC endpoint
- Check contract deployment
- Inspect browser console
- Test API endpoints

## Support & Resources

### Documentation
- [Wagmi Docs](https://wagmi.sh)
- [Viem Docs](https://viem.sh)
- [RainbowKit Docs](https://rainbowkit.com)
- [Next.js Docs](https://nextjs.org/docs)

### Community
- Discord: [Join Server]
- Telegram: [@grainvault]
- Twitter: [@grainvault]

### Developer Support
- Email: dev@grainvault.com
- GitHub Issues: [Link]

## Roadmap

### Q1 2026
- [ ] Mobile app (React Native)
- [ ] Advanced charts & analytics
- [ ] Portfolio management tools
- [ ] Governance module

### Q2 2026
- [ ] Multi-chain support
- [ ] Fiat on/off ramps
- [ ] Automated tax reporting
- [ ] API for partners

### Q3 2026
- [ ] Institutional dashboard
- [ ] White-label solution
- [ ] Advanced escrow features
- [ ] Derivatives trading

---

## Quick Start

```bash
# Clone the repository
git clone https://github.com/yourorg/grain-vault.git

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your contract addresses

# Run development server
npm run dev

# Open browser
open http://localhost:3000/grain/dashboard
```

## License

MIT License - See LICENSE file for details

---

**Built with trust. Backed by assets. Ready for $3B.**
