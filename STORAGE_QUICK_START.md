# Wells AI Storage - Quick Start Guide

## Setup (2 minutes)

### 1. Get Vercel Blob Token

```bash
# Visit Vercel Dashboard
https://vercel.com/dashboard/stores

# Create or select a Blob store
# Copy the BLOB_READ_WRITE_TOKEN
```

### 2. Add Environment Variable

```bash
# Add to .env.local (local dev) or Vercel environment variables (production)
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_XXXXXXXXXXXXXXXX
```

### 3. That's it!

Storage is now enabled. No database setup, no S3 buckets, no configuration.

## Usage

### Create & Store a Document

```typescript
// POST /api/documents/create
const response = await fetch('/api/documents/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'Q4 Business Proposal',
    content: '## Executive Summary\n\n...',
    type: 'proposal',
    recipient: 'Acme Corp'
  })
})

const { document } = await response.json()
// document.storageUrl = actual Vercel Blob URL
// document.downloadUrl = /api/documents/{docId}/download
```

### Retrieve a Document

```typescript
// GET /api/documents/{docId}
const response = await fetch(`/api/documents/${docId}`)
const { document } = await response.json()

console.log(document.files) // All files for this document
console.log(document.url)   // Direct Blob URL
```

### Download a Document

```html
<!-- Direct download link -->
<a href="/api/documents/{docId}/download" download>
  Download Document
</a>
```

### Upload & Store Files (Automatic)

```typescript
// When processing documents, files are automatically saved
import { processDocument } from '@/lib/document-processor'

const result = await processDocument(
  fileBuffer,
  'application/pdf',
  'contract.pdf',
  true, // saveToStorage = true (default)
  userId
)

if (result.storedFile) {
  console.log('File stored at:', result.storedFile.url)
}
```

### Delete a Document

```typescript
// DELETE /api/documents/{docId}
await fetch(`/api/documents/${docId}`, {
  method: 'DELETE'
})
// Deletes document and all associated files
```

## File Limits

- **Max Size**: 10 MB per file
- **Expiration**: 30 days (configurable)
- **Formats**: PDF, Images (PNG/JPG/WEBP), Text, HTML, JSON, DOCX

## Costs

### Vercel Blob Pricing

- **Free Tier**: 100 GB storage + 100 GB bandwidth
- **Beyond Free**: $0.15/GB storage, $0.10/GB bandwidth

### Example Costs

```
100 documents × 50 KB = 5 MB total = FREE
1,000 documents × 50 KB = 50 MB total = FREE
10,000 documents × 50 KB = 500 MB total = FREE
100,000 documents × 50 KB = 5 GB total = $0.75/month
```

For Wells AI use case: **Essentially free**

## How It Works

```
User Request → API Route → lib/storage.ts → Vercel Blob → Stored!
                   ↓
            Returns URL & Metadata
```

1. User creates/uploads document
2. API validates and processes
3. Storage library uploads to Vercel Blob
4. Returns permanent URL
5. File accessible forever (until expiration or manual deletion)

## Key Features

✅ **Persistent** - Files survive server restarts
✅ **Global CDN** - Fast downloads worldwide
✅ **Zero Config** - One environment variable
✅ **Type Safe** - Full TypeScript support
✅ **Auto Cleanup** - Files expire automatically
✅ **Simple API** - Upload, download, delete
✅ **Vercel Native** - Deployed in seconds

## Troubleshooting

### "Blob token not configured"

```bash
# Missing environment variable
# Add BLOB_READ_WRITE_TOKEN to .env.local
```

### "File too large"

```typescript
// Increase limit in lib/storage.ts
const STORAGE_CONFIG = {
  maxFileSizeMB: 20, // Changed from 10
  // ...
}
```

### "Unsupported file type"

```typescript
// Add MIME type in lib/storage.ts
const STORAGE_CONFIG = {
  allowedMimeTypes: [
    // ... existing types
    'application/zip', // Add new type
  ]
}
```

## Advanced Usage

### Custom Expiration

```typescript
import { uploadFile } from '@/lib/storage'

await uploadFile(buffer, {
  documentId: 'doc_123',
  filename: 'important.pdf',
  mimeType: 'application/pdf',
  expiresInDays: 90 // 90 days instead of 30
})
```

### List All Files for Document

```typescript
import { listDocumentFiles } from '@/lib/storage'

const result = await listDocumentFiles(docId)
console.log(result.files) // Array of all files
```

### Check if File Exists

```typescript
import { fileExists } from '@/lib/storage'

const exists = await fileExists('wells-ai/doc_123/file.html')
```

## Development vs Production

### Local Development

```bash
# .env.local
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_local_XXX
```

Files stored in your development Blob store.

### Production

```bash
# Vercel Dashboard → Settings → Environment Variables
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_prod_XXX
```

Files stored in production Blob store.

**Pro Tip**: Use different Blob stores for dev/prod to keep data separate.

## Next Steps

1. ✅ Add `BLOB_READ_WRITE_TOKEN` to environment
2. ✅ Test creating a document via API
3. ✅ Verify file appears in Vercel Dashboard → Blob
4. ✅ Test downloading the document
5. ✅ Deploy to production

## Resources

- [Full Documentation](./STORAGE_IMPLEMENTATION.md)
- [Vercel Blob Docs](https://vercel.com/docs/storage/vercel-blob)
- [Storage Library](./lib/storage.ts)

---

**Ready to store?** Just add the environment variable and you're done! 🚀
