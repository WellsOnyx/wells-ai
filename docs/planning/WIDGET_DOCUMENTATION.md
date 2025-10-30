# Wells AI Widget - Installation Guide

**One-line installation for any website. No coding required.**

The Wells AI Widget is an embeddable procurement assistant that helps your website visitors source products, get quotes, and connect with suppliers - all powered by AI.

---

## 🚀 Quick Start (30 seconds)

### Step 1: Get Your API Key

Contact Wells AI to get your unique API key, or use the demo key for testing:
```
wells_widget_demo_1234567890abcdef
```

### Step 2: Add One Line to Your Website

Copy and paste this code **before the closing `</body>` tag** on your website:

```html
<script src="https://wellsai.vercel.app/widget.js" data-wells-key="YOUR_API_KEY"></script>
```

That's it! The Wells AI chat widget will now appear on your website.

---

## 📝 Platform-Specific Installation

### Squarespace

1. Go to **Settings → Advanced → Code Injection**
2. Paste the script in the **Footer** section:
   ```html
   <script src="https://wellsai.vercel.app/widget.js" data-wells-key="YOUR_API_KEY"></script>
   ```
3. Click **Save**
4. Visit your live site - the widget appears in the bottom right

### WordPress

1. Install the **Insert Headers and Footers** plugin (or use your theme's footer editor)
2. Go to **Settings → Insert Headers and Footers**
3. Paste the script in the **Scripts in Footer** section
4. Click **Save**

### Shopify

1. Go to **Online Store → Themes → Actions → Edit Code**
2. Open **Layout → theme.liquid**
3. Find the closing `</body>` tag
4. Paste the script **above** the `</body>` tag
5. Click **Save**

### Wix

1. Go to **Settings → Custom Code**
2. Click **+ Add Custom Code**
3. Paste the script, select **Body - end**, apply to **All pages**
4. Click **Apply**

### Webflow

1. Go to **Project Settings → Custom Code**
2. Paste the script in the **Footer Code** section
3. Click **Save** and **Publish**

### HTML/Static Sites

Add the script before the closing `</body>` tag in your HTML files:

```html
<!DOCTYPE html>
<html>
<head>
  <title>My Website</title>
</head>
<body>
  <!-- Your website content -->

  <script src="https://wellsai.vercel.app/widget.js" data-wells-key="YOUR_API_KEY"></script>
</body>
</html>
```

---

## ⚙️ Configuration Options

Customize the widget with data attributes:

```html
<script
  src="https://wellsai.vercel.app/widget.js"
  data-wells-key="YOUR_API_KEY"
  data-position="bottom-right"
  data-theme="light"
  data-greeting="Hi! Need help sourcing something?"
></script>
```

### Available Options

| Attribute | Options | Default | Description |
|-----------|---------|---------|-------------|
| `data-wells-key` | Your API key | `demo` | **Required.** Your Wells AI API key |
| `data-position` | `bottom-right`, `bottom-left`, `top-right`, `top-left` | `bottom-right` | Widget position on screen |
| `data-theme` | `light`, `dark` | `light` | Color theme (coming soon) |
| `data-greeting` | Any text | `Hi! Need to source something?` | First message shown to visitors |

### Examples

**Bottom-left position:**
```html
<script
  src="https://wellsai.vercel.app/widget.js"
  data-wells-key="YOUR_API_KEY"
  data-position="bottom-left"
></script>
```

**Custom greeting:**
```html
<script
  src="https://wellsai.vercel.app/widget.js"
  data-wells-key="YOUR_API_KEY"
  data-greeting="👋 Looking for supplies? I can help!"
></script>
```

---

## 🎨 Advanced Usage (JavaScript API)

The widget exposes a global `WellsAI` object for programmatic control.

### Open/Close Widget

```javascript
// Open the widget
WellsAI.open();

// Close the widget
WellsAI.close();
```

### Send Messages Programmatically

```javascript
// Send a message on behalf of the user
WellsAI.send("I need 100 laptops for my office");
```

### Get Conversation History

```javascript
// Get all messages in current conversation
const messages = WellsAI.getMessages();
console.log(messages);
```

### Example: Trigger Widget from Button

```html
<button onclick="WellsAI.open()">
  Need Help? Chat with Wells AI
</button>
```

### Example: Auto-open on Page Load

```html
<script src="https://wellsai.vercel.app/widget.js" data-wells-key="YOUR_API_KEY"></script>
<script>
  // Wait for widget to load
  setTimeout(() => {
    WellsAI.open();
  }, 2000);
</script>
```

### Example: Pre-fill Message

```html
<button onclick="WellsAI.open(); WellsAI.send('I need office supplies');">
  Get Office Supplies Quote
</button>
```

---

## 🎯 Use Cases

### E-commerce Sites
- Help customers find bulk product suppliers
- Get wholesale quotes automatically
- Connect buyers with distributors

### B2B Marketplaces
- Instant procurement assistant for all visitors
- Reduce support tickets with AI-powered help
- Track sourcing requests and conversions

### Manufacturing Sites
- Help engineers find raw material suppliers
- Get instant quotes for components
- Connect with verified suppliers

### Service Businesses
- Source equipment and materials for projects
- Compare supplier quotes in real-time
- Automate procurement workflows

---

## 📊 Analytics & Tracking

### View Widget Stats

Get your widget performance metrics:

```bash
curl https://wellsai.vercel.app/api/widget/track/stats
```

Response:
```json
{
  "stats": {
    "activeInstallations": 53,
    "eventCounts": [
      { "event": "widget_loaded", "count": 1247 },
      { "event": "widget_opened", "count": 423 },
      { "event": "message_sent", "count": 891 }
    ],
    "topWebsites": [
      { "url": "https://example.com", "count": 342 },
      { "url": "https://myshop.com", "count": 187 }
    ]
  }
}
```

### Tracked Events

The widget automatically tracks:
- `widget_loaded` - Widget script loaded on page
- `widget_opened` - User opened the chat window
- `message_sent` - User sent a message
- Custom events (via API)

---

## 🔧 Troubleshooting

### Widget Not Appearing

**1. Check if script is loaded:**
Open browser console (F12), run:
```javascript
console.log(window.WellsAI);
```
Should output an object with `version`, `open`, `close`, etc.

**2. Check for JavaScript errors:**
Open browser console (F12) and look for red error messages.

**3. Verify API key:**
Make sure your API key is correct in the `data-wells-key` attribute.

**4. Check z-index conflicts:**
If other elements cover the widget, add this CSS to your site:
```css
#wells-ai-widget {
  z-index: 99999 !important;
}
```

### Widget Loads But Doesn't Respond

**1. Check network requests:**
Open browser DevTools → Network tab, send a message, look for:
- `POST https://wellsai.vercel.app/api/widget/chat`

**2. Check CORS:**
If you see CORS errors, contact Wells AI support - your domain may need to be whitelisted.

**3. Check API key limits:**
Your API key may have reached its monthly message limit. Contact Wells AI to upgrade.

### Widget Appears in Wrong Position

Use the `data-position` attribute:
```html
<script
  src="https://wellsai.vercel.app/widget.js"
  data-wells-key="YOUR_API_KEY"
  data-position="bottom-left"
></script>
```

### Widget Conflicts with Existing Chat

If you have another chat widget (Intercom, Drift, etc.), you may need to adjust positioning:

```html
<script
  src="https://wellsai.vercel.app/widget.js"
  data-wells-key="YOUR_API_KEY"
  data-position="bottom-left"
></script>
```

Or hide the other widget on specific pages where Wells AI is active.

---

## 🔒 Privacy & Security

### Data Collection

The widget collects:
- Messages sent by users
- Website URL where widget is installed
- Anonymous usage analytics (loads, opens, messages)
- IP address (for abuse prevention)

### Data Usage

- **AI Responses:** Messages are sent to Claude (Anthropic) for AI-powered responses
- **Analytics:** Aggregated usage stats (no personally identifiable info)
- **Improvements:** Anonymous data used to improve widget performance

### GDPR Compliance

Wells AI Widget is GDPR-compliant:
- No cookies stored (localStorage only)
- No user tracking across sites
- Data retention: 90 days for messages, 1 year for analytics
- Right to deletion: Contact support@wellsai.com

### API Key Security

**Do not share your API key publicly.** If compromised, contact Wells AI immediately to revoke and generate a new key.

---

## 📦 Technical Details

### Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Mobile browsers (iOS Safari, Chrome Mobile)

### Performance

- Widget size: **~15KB gzipped**
- Initial load: **<100ms**
- No external dependencies (except Wells AI API)
- Fully self-contained (CSS inline)

### Mobile Responsive

The widget automatically adapts to mobile screens:
- On desktop: 380px × 600px floating window
- On mobile (<480px): Full-screen overlay

---

## 🚀 What Can Users Ask?

The Wells AI widget can help with:

### Procurement Questions
- "I need 50 office chairs"
- "Where can I find bulk steel suppliers?"
- "Get me quotes for 1000 custom t-shirts"

### Supplier Discovery
- "Find me suppliers in Texas"
- "Who sells industrial pumps?"
- "Connect me with electronics distributors"

### Pricing Inquiries
- "What's the typical price for X?"
- "Compare quotes from multiple suppliers"
- "Get me the best deal on Y"

### General Help
- "How does Wells AI work?"
- "What's an RFQ?"
- "How do I place an order?"

---

## 📞 Support

### Get Help
- Email: support@wellsai.com
- Documentation: https://wellsai.vercel.app/docs
- Status: https://status.wellsai.com

### Request Features
Have an idea? Email us at features@wellsai.com

### Report Issues
Found a bug? Email bugs@wellsai.com or open an issue on GitHub.

---

## 💎 Upgrade Plans

### Free Plan
- 1,000 messages/month
- Unlimited installations
- Basic analytics
- Community support

### Pro Plan ($99/month)
- 10,000 messages/month
- Priority support
- Advanced analytics
- Custom branding
- API access

### Enterprise Plan (Custom pricing)
- Unlimited messages
- Dedicated support
- White-label option
- Custom integrations
- SLA guarantee

**Contact sales@wellsai.com to upgrade.**

---

## 🎉 Success Metrics

Track your widget's impact:

### Conversion Tracking
- RFQs created through widget
- Quotes received
- Deals closed
- Revenue generated

### User Engagement
- Widget open rate
- Message volume
- Response satisfaction
- Average session time

### ROI Calculation
```
Wells AI Widget ROI = (Revenue from Widget Conversions - Wells AI Cost) / Wells AI Cost × 100%
```

Example:
- 10 deals closed via widget = $50,000 revenue
- Wells AI cost = $99/month
- ROI = ($50,000 - $99) / $99 × 100% = **50,404% ROI**

---

## 🌟 Best Practices

### 1. Place on High-Traffic Pages
Install the widget on:
- Homepage
- Product pages
- Pricing page
- Contact page

### 2. Use Clear CTAs
Add buttons that trigger the widget:
```html
<button onclick="WellsAI.open()">Get Instant Quote</button>
```

### 3. Customize Greeting
Make it relevant to your audience:
- B2B: "Need industrial supplies? Let's find you a supplier."
- Retail: "Looking for wholesale products? I can help!"
- Manufacturing: "Need raw materials? Get instant quotes."

### 4. Monitor Analytics
Check your widget stats weekly to optimize placement and messaging.

### 5. Train Your Team
Make sure your sales team knows about the widget and can follow up on leads.

---

## 📚 Additional Resources

### Example Sites Using Wells AI Widget
- https://example-manufacturing.com (bottom-right)
- https://wholesale-supplies.com (bottom-left, custom greeting)
- https://industrial-equipment.com (programmatic triggers)

### Video Tutorials
- [Install on Squarespace](https://youtube.com/watch?v=example) (3 min)
- [Install on Shopify](https://youtube.com/watch?v=example) (2 min)
- [Advanced Configuration](https://youtube.com/watch?v=example) (8 min)

### API Documentation
Full API reference: https://wellsai.vercel.app/api-docs

---

## ✅ Installation Checklist

- [ ] Got API key from Wells AI
- [ ] Added script to website footer
- [ ] Verified widget appears on live site
- [ ] Tested sending a message
- [ ] Customized position and greeting
- [ ] Added widget to all key pages
- [ ] Set up analytics tracking
- [ ] Trained team on widget features
- [ ] Added custom CTAs (buttons) if desired
- [ ] Checked mobile responsiveness

---

**🎊 Congratulations! Your Wells AI Widget is now live and helping visitors source products 24/7.**

Questions? Email support@wellsai.com or chat with us at https://wellsai.vercel.app
