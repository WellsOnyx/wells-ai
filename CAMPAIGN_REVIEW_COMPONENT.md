# Wells Onyx Campaign Review Component

## Overview
A luxury-aesthetic campaign review UI component that enables users to review and approve GTM campaigns before sending messages to prospects. Built with the Wells Onyx black and gold design language.

## File Location
`/app/components/WellsOnyxCampaignReview.tsx`

## Features

### 1. Campaign Overview Display
- Campaign name, practice group, and status
- Real-time statistics dashboard showing:
  - Total prospects identified
  - Approved messages count
  - Pending messages count
  - Sent messages count
- Visual stats grid with luxury dark theme styling

### 2. Prospect Intelligence Display
- List of all prospects with their details:
  - Name, title, company, industry
  - Contact information (email, phone, LinkedIn)
  - Match score (80-90% zone highlighting)
  - Buying signals with color-coded importance
- Signal types tracked:
  - Score-based color coding (green for 90+, gold for 80-90)
  - Signal descriptions and types
- Filterable by match score

### 3. Message Preview & Management
- Individual message cards showing:
  - Prospect details
  - Channel (email, SMS, LinkedIn)
  - Subject line (for emails)
  - Message body with full preview
  - Why this prospect was selected (signals)
- Per-message actions:
  - Approve individual messages
  - Reject individual messages
  - Real-time status updates

### 4. Bulk Actions
- Approve All pending messages at once
- Reject All pending messages at once
- Quick action buttons with confirmation

### 5. Send Approved Messages
- Primary CTA button to send all approved messages
- Loading state during send process
- Prevents sending if no approved messages
- Success confirmation with count

### 6. Real-Time Status Updates
- Toast notifications for all actions:
  - Success notifications (green)
  - Error notifications (red)
  - Info notifications (blue)
- Auto-dismiss after 5 seconds
- Animated slide-in from top

### 7. Multi-Tab Interface
- **Overview Tab**: Campaign ICP, top prospects
- **Prospects Tab**: Full prospect list with signals
- **Messages Tab**: All messages with approve/reject actions
- Smooth tab transitions
- Active tab highlighting in gold

### 8. Responsive Design
- Fully responsive layout
- Mobile-friendly interactions
- Optimized for desktop workflow
- Smooth transitions and animations

### 9. Error Handling
- Loading states with animated spinner
- Error state with helpful messaging
- Network error handling
- API error display
- Fallback UI for missing data

## TypeScript Types

```typescript
interface Signal {
  type: string
  description: string
  score: number
}

interface Prospect {
  id: string
  name: string
  title: string
  company: string
  industry: string
  email?: string
  phone?: string
  linkedInUrl?: string
  matchScore: number
  signals: Signal[]
}

interface Message {
  id: string
  prospectId: string
  prospectName: string
  channel: 'email' | 'sms' | 'linkedin'
  subject?: string
  body: string
  status: 'pending' | 'approved' | 'rejected' | 'sent'
  canSend: boolean
  blockReason?: string
}

interface Campaign {
  id: string
  name: string
  practiceGroup: string
  status: 'draft' | 'pending_review' | 'approved' | 'sending' | 'sent' | 'completed'
  prospects: Prospect[]
  messages: Message[]
  icp: {
    industries: string[]
    titles: string[]
    companySizes: string[]
    geography: string[]
  }
  createdAt: string
  stats: {
    totalProspects: number
    totalMessages: number
    approvedMessages: number
    rejectedMessages: number
    sentMessages: number
  }
}
```

## API Integration

### Expected API Endpoints

1. **GET** `/api/gtm/campaign/:id` - Load campaign data
2. **POST** `/api/gtm/outreach/approve` - Approve a message
   ```json
   { "messageId": "string" }
   ```
3. **POST** `/api/gtm/outreach/reject` - Reject a message
   ```json
   { "messageId": "string" }
   ```
4. **POST** `/api/gtm/campaign/:id/send` - Send approved messages
   ```json
   { "messageIds": ["string"] }
   ```

### API Response Format

```typescript
// Campaign Load Response
{
  campaign: Campaign
}

// Approve/Reject Response
{
  success: boolean
  error?: string
}

// Send Response
{
  success: boolean
  sentCount: number
  error?: string
}
```

## Usage

```tsx
import WellsOnyxCampaignReview from '@/app/components/WellsOnyxCampaignReview'

// Basic usage
<WellsOnyxCampaignReview
  campaignId="campaign_123"
  onComplete={() => console.log('Campaign sent!')}
  onCancel={() => router.back()}
/>

// With custom handlers
<WellsOnyxCampaignReview
  campaignId={currentCampaignId}
  onComplete={() => {
    showSuccessMessage('Campaign launched!')
    refreshDashboard()
  }}
  onCancel={() => {
    saveDraft()
    router.push('/campaigns')
  }}
/>
```

## Component Props

```typescript
interface WellsOnyxCampaignReviewProps {
  campaignId?: string         // Campaign ID to load (defaults to 'latest')
  onComplete?: () => void     // Called after successful send
  onCancel?: () => void       // Called when user cancels
}
```

## Design Tokens

### Colors
- **Background**: `#0a0a0a` (deep black)
- **Cards**: `#1a1a1a` (dark gray)
- **Primary (Gold)**: `#dba63f`
- **Primary Hover**: `#c89430`
- **Success**: `green-400`, `green-700`, `green-900`
- **Error**: `red-400`, `red-700`, `red-900`
- **Info**: `blue-400`, `blue-700`, `blue-900`
- **Borders**: `gray-800`, `gray-700`
- **Text Primary**: `white`
- **Text Secondary**: `gray-400`
- **Text Muted**: `gray-500`

### Typography
- **Headings**: Font Serif
- **Body**: System font stack
- **Labels**: Uppercase, tracked (0.05em)
- **Sizes**: xs (0.75rem), sm (0.875rem), base (1rem), lg (1.125rem), xl-3xl (1.875rem-3rem)

### Spacing
- **Padding**: 4, 5, 6, 8 (1rem, 1.25rem, 1.5rem, 2rem)
- **Gaps**: 2, 3, 4, 8 (0.5rem, 0.75rem, 1rem, 2rem)
- **Borders**: 1px solid
- **Border Radius**: sm (0.125rem)

### Effects
- **Shadows**: `shadow-lg shadow-[#dba63f]/20`
- **Transitions**: `transition-all`
- **Hover States**: Subtle border color changes
- **Loading**: Spin animation

## Key Features Breakdown

### 80-90% Zone Highlighting
Prospects with match scores between 80-90% are highlighted in the Overview tab:
- Gold accent color for scores 80-89%
- Green accent color for scores 90+%
- Visual progress bars
- Signal badges with color coding

### Smart Message Status
Messages have multiple states with visual indicators:
- **Pending**: Gray badge, shows approve/reject buttons
- **Approved**: Green badge, included in send count
- **Rejected**: Red badge, excluded from sending
- **Sent**: Blue badge, shows timestamp
- **Blocked**: Orange badge with reason

### Channel-Specific Handling
Different visual treatments for each channel:
- **Email**: Blue icon, subject line displayed
- **SMS**: Orange icon, character count aware
- **LinkedIn**: Purple icon, copy-to-clipboard button

### Real-Time Updates
Component updates locally after API calls:
- Optimistic UI updates
- Network state handling
- Error rollback capability
- Success confirmation

## Accessibility

- Semantic HTML structure
- Keyboard navigation support
- ARIA labels on interactive elements
- Focus visible states
- Color contrast compliance
- Screen reader friendly notifications

## Performance Optimizations

- Lazy loading of prospect details
- Efficient re-renders with React hooks
- Debounced API calls
- Optimistic UI updates
- Minimal bundle size
- No heavy dependencies

## Testing Recommendations

### Unit Tests
1. Component renders with mock data
2. Tab switching works correctly
3. Approve/reject buttons trigger API calls
4. Bulk actions handle multiple messages
5. Error states display correctly
6. Loading states show spinner

### Integration Tests
1. End-to-end campaign review flow
2. Message approval workflow
3. Sending approved messages
4. Error handling and recovery
5. Navigation and routing

### E2E Tests
1. Full campaign creation to send
2. Multi-user collaboration
3. Real-time updates across devices
4. Performance under load

## Future Enhancements

### Phase 2
- [ ] Message editing capability
- [ ] AI-powered message regeneration
- [ ] A/B testing variants
- [ ] Schedule send for later
- [ ] Custom fields per message

### Phase 3
- [ ] Real-time collaboration (multiple reviewers)
- [ ] Comment threads on messages
- [ ] Approval workflows (multi-stage)
- [ ] Analytics dashboard integration
- [ ] Export campaign reports

### Phase 4
- [ ] Machine learning signal scoring
- [ ] Auto-approve based on rules
- [ ] Dynamic message personalization
- [ ] Response tracking integration
- [ ] Revenue attribution

## Integration with Wells Onyx System

This component integrates with:
1. **GTM Discovery System**: Receives prospects from discovery
2. **Message Generation**: Uses AI-generated personalized messages
3. **Notion Backend**: Syncs with Notion campaign database
4. **Email/SMS Services**: Integrates with Instantly and Twilio
5. **Analytics System**: Tracks approval rates and campaign performance

## Support & Troubleshooting

### Common Issues

**Campaign won't load**
- Check API endpoint configuration
- Verify campaign ID is valid
- Check network connectivity
- Review API error logs

**Messages won't send**
- Verify approved messages exist
- Check email/SMS service credentials
- Review message validation rules
- Check rate limits

**UI not updating**
- Clear browser cache
- Check React state management
- Review API response format
- Verify WebSocket connection (if real-time)

## Conclusion

The Wells Onyx Campaign Review component provides a beautiful, functional interface for reviewing and approving GTM campaigns. It combines luxury aesthetics with powerful functionality, making the campaign review process efficient and elegant.
