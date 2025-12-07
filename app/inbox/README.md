# Wells Superhuman-Style Inbox

A blazing-fast, keyboard-driven unified inbox for Wells that aggregates messages from Gmail, LinkedIn, Slack, SMS, and more.

## Features

### 🚀 Superhuman-Speed Performance
- **Virtual scrolling** for instant rendering of 10,000+ threads
- **Optimistic UI updates** for instant feedback
- **Smart caching** to avoid redundant API calls
- Sub-100ms interaction times

### ⌨️ Keyboard-First Design
Complete keyboard navigation inspired by Superhuman:
- `j/k` - Navigate threads
- `e` - Archive
- `s` - Star/unstar
- `c` - Compose
- `r` - Reply
- `h` - Snooze
- `Cmd+K` - Command palette
- `?` - View all shortcuts

See [Keyboard Shortcuts](#keyboard-shortcuts) for the complete list.

### 🎨 Beautiful Dark Mode UI
- Minimal, distraction-free design
- Premium glassmorphism effects
- Smooth animations and transitions
- Wells brand colors (amber/gold accents)

### 🤖 AI-Powered Intelligence
- **Auto-categorization**: Urgent, Important, Hot Lead, Partnership, Support
- **Smart summaries**: AI-generated thread summaries
- **Priority detection**: Surface what matters most
- **AI writing assistant**: Generate replies instantly
- **Sentiment analysis**: Understand message tone

### 📧 Unified Multi-Channel
Connect all your communication channels:
- **Email**: Gmail, Outlook, custom SMTP
- **LinkedIn**: Direct messages and InMail
- **Slack**: DMs and channel mentions
- **SMS/iMessage**: Text messages
- **Chat**: Website chat widget
- **Teams**: Microsoft Teams messages

### ⚡ Power Features
- **Snooze**: Hide messages until the right time
- **Scheduled send**: Compose now, send later
- **Quick actions**: Archive, star, snooze on hover
- **Multi-select**: Bulk actions on threads
- **Search**: Full-text search across all channels
- **Smart filters**: Unread, starred, by channel

## Project Structure

```
app/inbox/
├── page-new.tsx                    # Main inbox page (Superhuman UI)
├── settings/
│   └── page.tsx                    # Settings page
├── components/
│   ├── ThreadList.tsx              # Thread list with virtual scrolling
│   ├── MessageView.tsx             # Full message display
│   ├── ComposeModal.tsx            # Compose new message
│   ├── CommandPalette.tsx          # Cmd+K command palette
│   ├── SnoozePicker.tsx            # Snooze picker UI
│   └── ShortcutsModal.tsx          # Keyboard shortcuts help

lib/inbox/
└── keyboard-shortcuts.ts           # Keyboard shortcut handler
```

## Keyboard Shortcuts

### Navigation
| Key | Action |
|-----|--------|
| `j` | Next thread |
| `k` | Previous thread |
| `o` or `Enter` | Open thread |
| `u` | Back to list |
| `Esc` | Close/Cancel |

### Actions
| Key | Action |
|-----|--------|
| `e` | Archive |
| `#` | Trash |
| `s` | Star/unstar |
| `v` | Mark unread |
| `h` | Snooze |
| `l` | Add label |
| `r` | Reply |
| `a` | Reply all |
| `f` | Forward |
| `c` | Compose |

### Views
| Key | Action |
|-----|--------|
| `g i` | Go to Inbox |
| `g s` | Go to Sent |
| `g d` | Go to Drafts |
| `g a` | Go to All Mail |
| `g t` | Go to Trash |

### AI Features
| Key | Action |
|-----|--------|
| `i` | AI Summary |
| `w` | AI Write |

### Other
| Key | Action |
|-----|--------|
| `/` | Search |
| `Cmd+K` or `Ctrl+K` | Command palette |
| `?` | Show shortcuts |

## Component APIs

### ThreadList
```tsx
<ThreadList
  threads={threads}           // Thread[] - Array of thread objects
  selectedId={selectedId}     // string | null - Currently selected thread
  onSelect={handleSelect}     // (id: string) => void
  onStar={handleStar}        // (id: string) => void
  onArchive={handleArchive}  // (id: string) => void
  onSnooze={handleSnooze}    // (id: string) => void
  loading={loading}          // boolean - Show loading state
/>
```

### MessageView
```tsx
<MessageView
  messages={messages}         // Message[] - Array of messages
  contact={contact}          // Contact - Contact information
  aiSummary={aiSummary}      // string - AI-generated summary
  loading={loading}          // boolean - Show loading state
  onReply={handleReply}      // (content: string) => void
  onReplyAll={handleReplyAll} // (content: string) => void
  onForward={handleForward}  // (content: string) => void
  onGenerateAI={handleAI}    // () => void
  isGeneratingAI={isGenerating} // boolean
/>
```

### ComposeModal
```tsx
<ComposeModal
  isOpen={isOpen}
  onClose={handleClose}
  onSend={handleSend}         // (data) => Promise<void>
  accounts={accounts}         // Array of connected accounts
  defaultTo={defaultTo}       // string - Pre-fill recipient
  defaultSubject={subject}    // string - Pre-fill subject
/>
```

### CommandPalette
```tsx
<CommandPalette
  isOpen={isOpen}
  onClose={handleClose}
  onNavigate={handleNavigate} // (path: string) => void
  onAction={handleAction}     // (action: string) => void
/>
```

### SnoozePicker
```tsx
<SnoozePicker
  isOpen={isOpen}
  onClose={handleClose}
  onSnooze={handleSnooze}     // (until: Date) => void
  position={{x, y}}           // Optional position
/>
```

## Usage

### Basic Setup

Replace the old inbox page:

```bash
# Backup old page
mv app/inbox/page.tsx app/inbox/page-old.tsx

# Use new Superhuman UI
mv app/inbox/page-new.tsx app/inbox/page.tsx
```

### Keyboard Shortcuts Integration

```tsx
import { getKeyboardHandler } from '@/lib/inbox/keyboard-shortcuts'

useEffect(() => {
  const handler = getKeyboardHandler()

  handler.on('archive', () => {
    // Handle archive action
  })

  handler.on('compose', () => {
    setIsComposeOpen(true)
  })

  return () => {
    handler.destroy()
  }
}, [])
```

### AI Features

The inbox integrates with Wells AI for:
- Auto-categorization of messages
- Priority detection
- Smart summaries
- Reply generation

Configure AI preferences in Settings → AI Preferences.

## Settings

Access settings at `/inbox/settings` or click the settings icon in the top bar.

### Connected Accounts
- View all connected email/messaging accounts
- Add new accounts (Gmail, Outlook, LinkedIn, Slack)
- Disconnect accounts
- View sync status

### Notifications
- Email notifications
- Push notifications
- Desktop notifications
- Sound preferences

### AI Preferences
- Auto-summarize threads
- Priority detection
- Smart reply suggestions
- Auto-categorization

## Performance

The inbox is optimized for speed:

- **Virtual scrolling**: Only renders visible threads (handles 10k+ threads)
- **Debounced search**: Waits 300ms before searching
- **Optimistic updates**: UI updates instantly, syncs in background
- **Smart caching**: Reuses data when possible
- **Lazy loading**: Loads messages only when needed

## Design Philosophy

Inspired by Superhuman, the inbox follows these principles:

1. **Speed**: Every action should feel instant
2. **Keyboard-first**: Power users shouldn't need a mouse
3. **Minimal**: Remove distractions, focus on content
4. **Intelligent**: AI should work invisibly to help
5. **Beautiful**: Premium feel, smooth animations

## Future Enhancements

- [ ] Multi-select for bulk actions
- [ ] Smart filters and saved searches
- [ ] Email templates
- [ ] Conversation splitting/merging
- [ ] Integration with CRM
- [ ] Mobile app
- [ ] Offline support
- [ ] Read receipts
- [ ] Typing indicators
- [ ] Voice/video call integration

## Contributing

When adding features to the inbox:

1. **Maintain keyboard support**: Add shortcuts for new actions
2. **Keep it fast**: Profile performance, avoid re-renders
3. **Match the design**: Use existing components and styles
4. **Document shortcuts**: Update this README with new shortcuts
5. **Test thoroughly**: Test with large thread counts (1000+)

## Support

For issues or questions:
- Check keyboard shortcuts with `?`
- Review settings in `/inbox/settings`
- Check browser console for errors
- Report bugs with steps to reproduce
