# Native Apple Apps Setup Guide

## Prerequisites
- Xcode 15.0+ installed
- Apple Developer Account (paid - $99/year)
- macOS Sonoma 14.0+ or later

## Quick Start

### Option 1: Create Projects in Xcode (Recommended)

Since Xcode project files are complex, it's easiest to create the projects directly:

1. **Open Xcode**
2. **Create WellsAI App:**
   - File → New → Project
   - Select "Multiplatform" → "App"
   - Product Name: `WellsAI`
   - Team: Select your Apple Developer account
   - Organization Identifier: `io.wellsonyx`
   - Bundle Identifier: `io.wellsonyx.wellsai`
   - Interface: SwiftUI
   - Language: Swift
   - Storage: SwiftData
   - Check: Include Tests
   - Save to: `apple/WellsAI/`

3. **Create Grain & Vault App:**
   - File → New → Project
   - Select "Multiplatform" → "App"
   - Product Name: `GrainAndVault`
   - Team: Select your Apple Developer account
   - Organization Identifier: `com.grainandvault`
   - Bundle Identifier: `com.grainandvault.app`
   - Interface: SwiftUI
   - Language: Swift
   - Storage: SwiftData
   - Save to: `apple/GrainAndVault/`

4. **Add Source Files:**
   - Drag all `.swift` files from the existing folders into the Xcode project
   - Make sure "Copy items if needed" is unchecked (files are already in place)
   - Add to target: WellsAI (or GrainAndVault)

5. **Add Widget Extension (for each app):**
   - File → New → Target
   - Select "Widget Extension"
   - Name: `WellsAIWidget` (or `GrainVaultWidget`)
   - Include Configuration App Intent: Yes

6. **Configure Capabilities:**
   - Select the app target
   - Go to "Signing & Capabilities"
   - Add: App Groups, Keychain Sharing, Push Notifications

## Bundle Identifiers

### WellsAI
- App: `io.wellsonyx.wellsai`
- Widget: `io.wellsonyx.wellsai.widget`
- App Group: `group.io.wellsonyx.wellsai`

### Grain & Vault
- App: `com.grainandvault.app`
- Widget: `com.grainandvault.app.widget`
- App Group: `group.com.grainandvault.app`

## App Store Connect Setup

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Create new apps:
   - **WellsAI** - AI Commerce Assistant
   - **Grain & Vault** - Treasury & Payments

3. Fill in metadata:
   - App name
   - Subtitle
   - Privacy Policy URL (use your website)
   - Category: Business / Finance

## Required Info.plist Keys

Add these to your Info.plist for each app:

```xml
<!-- Face ID -->
<key>NSFaceIDUsageDescription</key>
<string>Authenticate to confirm payments and access your account</string>

<!-- Camera (for QR codes) -->
<key>NSCameraUsageDescription</key>
<string>Scan QR codes to send and receive payments</string>

<!-- Contacts (optional for payment recipients) -->
<key>NSContactsUsageDescription</key>
<string>Find friends to send payments to</string>
```

## Testing

1. **Simulator Testing:**
   - Select a simulator (iPhone 15 Pro recommended)
   - Build and run (Cmd + R)

2. **Device Testing:**
   - Connect your iPhone/iPad
   - Select your device in Xcode
   - Build and run

3. **TestFlight:**
   - Archive the app (Product → Archive)
   - Distribute to App Store Connect
   - Add testers in TestFlight

## App Intents (Spotlight Integration)

The apps are configured for **Spotlight and Shortcuts** integration only (no Siri).

Users can:
- Search "Check Balance" in Spotlight → Opens balance check
- Add shortcuts in Shortcuts app
- Use widgets on home screen

## Widgets

### WellsAI Widgets
- **Quick Chat** (small) - Tap to start conversation
- **Recent Chats** (medium) - See latest conversations

### Grain & Vault Widgets
- **Balance** (small/medium) - Current GRAIN balance
- **Credit Line** (small/medium) - Credit status
- **Quick Actions** (small/medium) - Send/Request/Draw buttons

## Submission Checklist

- [ ] App icons (all sizes) in Assets.xcassets
- [ ] Launch screen configured
- [ ] Privacy policy URL set
- [ ] App Store screenshots (6.7", 6.5", 5.5" for iPhone)
- [ ] App description and keywords
- [ ] Age rating questionnaire completed
- [ ] Export compliance (uses encryption: Yes - HTTPS)
- [ ] Sign in with Apple configured (if using)

## Troubleshooting

### "No signing certificate"
- Xcode → Settings → Accounts → Manage Certificates
- Click + to create a new certificate

### "Provisioning profile doesn't include capability"
- Go to Apple Developer Portal
- Edit the App ID to include missing capabilities
- Regenerate provisioning profile

### Widget not showing
- Make sure Widget Extension target is added
- Check App Group is configured in both app and widget
- Clean build folder (Cmd + Shift + K)

## API Endpoints

The apps connect to:
- **WellsAI**: `https://wellsonyx.io/api/`
- **Grain & Vault**: `https://grainandvault.com/api/`

Make sure your backend is deployed and accessible.
