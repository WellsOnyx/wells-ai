# Wells AI - Persistent File Storage Implementation

## Overview

Wells AI now has persistent file storage using **Vercel Blob**, providing reliable storage for:
- Generated documents (proposals, briefs, reports)
- Uploaded files (PDFs, images, text files)
- Document metadata and access URLs

## Storage Solution: Vercel Blob

### Why Vercel Blob?

1. **Vercel-Native**: Seamlessly integrates with Vercel deployments
2. **Simple API**: Easy-to-use SDK with minimal configuration
3. **Global CDN**: Fast file delivery worldwide
4. **Cost-Effective**: Pay-as-you-go pricing, free tier available
5. **No Infrastructure**: Fully managed, no servers to maintain

### Alternative Considered

- **AWS S3**: More complex setup, requires AWS credentials, overkill for this use case

## Architecture

### Storage Structure

```
vercel-blob://
└── wells-ai/
    ├── doc_1234567890_abc123/
    │   └── 1234567890-document_title.html
    ├── doc_1234567890_def456/
    │   └── 1234567890-proposal.html
    └── upload_1234567890_xyz789/
        └── 1234567890-user_file.pdf
```

Each document gets a unique folder identified by its document ID.

### File Organization

- **Generated Documents**: `doc_{timestamp}_{random}`
- **Uploaded Files**: `upload_{timestamp}_{random}`
- Files are stored with timestamps to prevent naming conflicts
- Filenames are sanitized for safe storage

## Implementation Files

### Core Storage Library

**`lib/storage.ts`**
- Main storage utilities
- Upload, delete, list operations
- File validation and sanitization
- TypeScript types and interfaces

Key Functions:
```typescript
uploadFile()           // Upload any file type
uploadHTMLDocument()   // Upload generated HTML documents
deleteFile()           // Delete a single file
deleteDocument()       // Delete all files for a document
listDocumentFiles()    // List all files for a document
fileExists()           // Check if file exists
getFileInfo()          // Get file metadata
```

### API Endpoints

**`app/api/documents/create/route.ts`** (Updated)
- Creates documents and saves to Vercel Blob
- Returns storage URLs and metadata
- Handles HTML generation and upload

**`app/api/documents/[docId]/route.ts`** (New)
- GET: Retrieve document metadata and URLs
- DELETE: Remove document and all files
- Validates document IDs

**`app/api/documents/[docId]/download/route.ts`** (New)
- Downloads document files
- Sets proper content-disposition headers
- Supports HEAD requests for file info

### Document Processor

**`lib/document-processor.ts`** (Updated)
- Now saves uploaded files to storage automatically
- Returns storage metadata with processed documents
- Optional `saveToStorage` parameter (default: true)

## Configuration

### Environment Variables

Add to your `.env` file:

```bash
# Vercel Blob Storage Token
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_XXXXXXXXXXXXXXXX

# Optional: Public app URL
NEXT_PUBLIC_APP_URL=https://wellsai.vercel.app
```

### Getting Your Blob Token

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Navigate to Storage → Blob
3. Create a new Blob store or select existing
4. Copy the `BLOB_READ_WRITE_TOKEN`
5. Add to your environment variables

### Vercel Deployment

The token is automatically available in Vercel deployments when you connect a Blob store to your project.

## Usage Examples

### Creating a Document

```typescript
POST /api/documents/create
{
  "title": "Business Proposal",
  "content": "## Overview\n\nThis is a proposal...",
  "type": "proposal",
  "recipient": "Client Name"
}

Response:
{
  "success": true,
  "document": {
    "id": "doc_1731513600_abc123",
    "title": "Business Proposal",
    "type": "proposal",
    "url": "/api/documents/doc_1731513600_abc123",
    "downloadUrl": "/api/documents/doc_1731513600_abc123/download",
    "storageUrl": "https://blob.vercel-storage.com/wells-ai/...",
    "createdAt": "2025-11-13T14:00:00.000Z",
    "expiresAt": "2025-12-13T14:00:00.000Z"
  }
}
```

### Retrieving a Document

```typescript
GET /api/documents/doc_1731513600_abc123

Response:
{
  "success": true,
  "document": {
    "id": "doc_1731513600_abc123",
    "url": "https://blob.vercel-storage.com/...",
    "downloadUrl": "/api/documents/doc_1731513600_abc123/download",
    "files": [
      {
        "url": "https://blob.vercel-storage.com/...",
        "pathname": "wells-ai/doc_1731513600_abc123/...",
        "size": 12345,
        "uploadedAt": "2025-11-13T14:00:00.000Z"
      }
    ]
  }
}
```

### Downloading a Document

```typescript
GET /api/documents/doc_1731513600_abc123/download

Response: HTML file with download headers
Content-Disposition: attachment; filename="business_proposal.html"
```

### Deleting a Document

```typescript
DELETE /api/documents/doc_1731513600_abc123

Response:
{
  "success": true,
  "message": "Document deleted successfully"
}
```

## File Constraints

### Size Limits
- **Maximum file size**: 10 MB per file
- Configurable in `lib/storage.ts` → `STORAGE_CONFIG.maxFileSizeMB`

### Supported MIME Types
- `application/pdf` - PDF documents
- `image/jpeg`, `image/jpg`, `image/png`, `image/webp`, `image/gif` - Images
- `text/plain`, `text/markdown`, `text/html` - Text files
- `application/json` - JSON files
- `application/vnd.openxmlformats-officedocument.wordprocessingml.document` - DOCX files

### File Expiration
- **Default expiration**: 30 days
- Configurable per upload
- After expiration, files may be automatically deleted by Vercel

## Storage Policies

### Automatic Cleanup

Files are set to expire after 30 days by default. Vercel Blob automatically handles cleanup of expired files.

### Manual Cleanup

You can manually delete files using:
```typescript
// Delete a single file
await deleteFile(pathname)

// Delete all files for a document
await deleteDocument(docId)
```

### Cost Management

Vercel Blob pricing (as of 2025):
- **Free Tier**: 100 GB storage, 100 GB bandwidth
- **Pro**: $0.15/GB storage, $0.10/GB bandwidth
- Files are cached on CDN for fast delivery

## Security

### Access Control

- All uploads require proper authentication (via Clerk)
- Document IDs are generated with timestamps and random suffixes
- Pathnames are sanitized to prevent directory traversal
- Files are public but URL-based access control

### Best Practices

1. Always validate file sizes before upload
2. Sanitize filenames to prevent injection
3. Verify MIME types match file content
4. Log all storage operations for audit trails
5. Implement rate limiting on upload endpoints

## Error Handling

### Common Errors

**File Too Large**
```json
{
  "success": false,
  "error": "File too large. Maximum size is 10MB. File is 15.23MB."
}
```

**Unsupported File Type**
```json
{
  "success": false,
  "error": "Unsupported file type: application/exe"
}
```

**Document Not Found**
```json
{
  "error": "Document not found"
}
```

**Storage Failure**
```json
{
  "success": false,
  "error": "Failed to upload file"
}
```

## Monitoring

### Logging

All storage operations are logged with:
- Document IDs
- File sizes
- Upload/delete timestamps
- User IDs (when available)
- Storage URLs

Example log:
```
[STORAGE] File uploaded: {
  documentId: 'doc_1731513600_abc123',
  filename: 'proposal.html',
  size: 12345,
  url: 'https://blob.vercel-storage.com/...'
}
```

### Vercel Dashboard

Monitor storage usage in Vercel Dashboard:
- Total storage used
- Bandwidth consumed
- Number of files
- Storage trends

## Migration Notes

### From In-Memory to Persistent Storage

Previous implementation stored documents in memory (lost on restart). New implementation:
1. ✅ Persists documents permanently
2. ✅ Survives server restarts
3. ✅ Accessible across all instances
4. ✅ Provides download URLs
5. ✅ Supports file expiration

### Backward Compatibility

Old document URLs remain unchanged:
- `/api/documents/{docId}` - Still works
- `/api/documents/{docId}/download` - Still works

Now backed by real storage instead of memory.

## Testing

### Local Development

1. Create a Vercel Blob store
2. Get your `BLOB_READ_WRITE_TOKEN`
3. Add to `.env.local`
4. Test with:

```bash
# Create a document
curl -X POST http://localhost:3000/api/documents/create \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Document",
    "content": "# Test\n\nThis is a test.",
    "type": "brief"
  }'

# Retrieve it
curl http://localhost:3000/api/documents/{docId}

# Download it
curl http://localhost:3000/api/documents/{docId}/download -o test.html
```

### Production Deployment

Storage "just works" when deployed to Vercel with a connected Blob store.

## Future Enhancements

### Potential Improvements

1. **Database Integration**: Store metadata in Postgres for querying
2. **Search**: Full-text search across stored documents
3. **Versions**: Support multiple versions of documents
4. **Thumbnails**: Generate thumbnails for images/PDFs
5. **Compression**: Compress files before storage
6. **Encryption**: Encrypt sensitive documents at rest
7. **CDN Optimization**: Advanced caching strategies
8. **Batch Operations**: Bulk upload/download/delete

### S3 Migration Path

If you need to migrate to S3:
1. Install `@aws-sdk/client-s3`
2. Update `lib/storage.ts` to use S3 client
3. Keep same function signatures
4. Update environment variables
5. No changes needed in API routes

## Support

### Troubleshooting

**Issue**: "Blob token not configured"
- **Solution**: Add `BLOB_READ_WRITE_TOKEN` to environment variables

**Issue**: "File upload fails"
- **Solution**: Check file size and MIME type constraints

**Issue**: "Document not found"
- **Solution**: Verify document ID format and existence

### Documentation

- [Vercel Blob Docs](https://vercel.com/docs/storage/vercel-blob)
- [@vercel/blob SDK](https://www.npmjs.com/package/@vercel/blob)

---

**Implementation Date**: November 13, 2025
**Version**: 1.0.0
**Status**: ✅ Production Ready
