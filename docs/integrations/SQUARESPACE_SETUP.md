# Wells AI Squarespace Embed Setup

Your Wells AI app will automatically update on your Squarespace site whenever you deploy with `vercel --prod`.

## Stable URL
`https://wellsai.vercel.app` - This always points to your latest production deployment.

## Option 1: Full Page Embed (Recommended)

Use this for a dedicated Wells AI page. The `?embed=true` parameter hides the Wells AI header so only your Squarespace navigation shows.

### Steps:
1. In Squarespace, create a **new page**
2. Click **Add Section** → **Code**
3. Paste this embed code:

```html
<div style="width: 100%; height: 100vh; min-height: 800px; margin: 0; padding: 0;">
  <iframe
    src="https://wellsai.vercel.app?embed=true"
    style="width: 100%; height: 100%; border: none; display: block;"
    title="Wells AI Conversational Commerce Platform"
    loading="lazy"
    allow="clipboard-write"
  ></iframe>
</div>
```

4. Save and publish

---

## Option 2: Inline Section Embed

Use this to embed Wells AI as a section within a page.

### Steps:
1. Go to your existing page
2. Click **Add Section** → **Code**
3. Paste this embed code:

```html
<div style="width: 100%; height: 800px; max-width: 1400px; margin: 40px auto; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.1);">
  <iframe
    src="https://wellsai.vercel.app?embed=true"
    style="width: 100%; height: 100%; border: none; display: block;"
    title="Wells AI Conversational Commerce Platform"
    loading="lazy"
    allow="clipboard-write"
  ></iframe>
</div>
```

4. Save and publish

---

## Option 3: Custom Domain (Professional Setup)

For maximum branding control, point a custom domain to your Vercel app:

### Steps:
1. In your domain registrar (e.g., GoDaddy, Namecheap), add a CNAME record:
   - **Name:** `app` (or `ai` or `commerce`)
   - **Value:** `cname.vercel-dns.com`

2. In Vercel CLI, add the domain:
```bash
vercel domains add app.wellsonyx.com
```

3. Then in Squarespace, update the iframe src to your custom domain:
```html
src="https://app.wellsonyx.com?embed=true"
```

---

## How Auto-Updates Work

Every time you run `vercel --prod`:
1. New deployment is created
2. `https://wellsai.vercel.app` automatically redirects to the latest version
3. Your Squarespace embed shows the new version (no changes needed!)

---

## Troubleshooting

### If the iframe doesn't show:
1. Make sure Squarespace allows iframes (most plans do)
2. Check that you're using a **Code Block**, not a regular text block
3. Verify the URL is accessible: open `https://wellsai.vercel.app` in your browser

### If you see "Refused to connect":
- Add your Squarespace domain to allowed origins in your Wells AI app
- Contact Squarespace support to ensure iframe embeds are enabled for your plan

---

## Need a Button Instead?

If you want a button that opens Wells AI in a new tab:

```html
<a
  href="https://wellsai.vercel.app"
  target="_blank"
  style="
    display: inline-block;
    padding: 16px 40px;
    background: #183b6d;
    color: white;
    text-decoration: none;
    font-size: 14px;
    text-transform: uppercase;
    letter-spacing: 2px;
    border-radius: 2px;
    transition: all 0.3s;
  "
  onmouseover="this.style.background='#0d2545'"
  onmouseout="this.style.background='#183b6d'"
>
  Launch Wells AI
</a>
```
