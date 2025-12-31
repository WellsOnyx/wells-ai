// @ts-nocheck
/**
 * File Analysis API Endpoint
 * POST: Analyze uploaded file with AI
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getFileById, getFileByUrl } from '@/lib/files/storage';
import {
  analyzeFile,
  summarizeDocument,
  extractData,
  compareDocuments,
  analyzeContract,
  analyzeFinancialDocument,
  analyzeResume,
  analyzeInvoice,
} from '@/lib/files/analyzer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Analysis types supported
type AnalysisType =
  | 'analyze'       // General analysis with custom prompt
  | 'summarize'     // Document summarization
  | 'extract'       // Structured data extraction
  | 'compare'       // Compare multiple documents
  | 'contract'      // Contract analysis
  | 'financial'     // Financial document analysis
  | 'resume'        // Resume/CV analysis
  | 'invoice';      // Invoice data extraction

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      fileId,
      fileUrl,
      fileUrls,
      type = 'analyze',
      prompt,
      schema,
      options,
    } = body as {
      fileId?: string;
      fileUrl?: string;
      fileUrls?: string[];
      type?: AnalysisType;
      prompt?: string;
      schema?: any;
      options?: Record<string, any>;
    };

    // Get file URL
    let targetUrl = fileUrl;
    if (fileId && !targetUrl) {
      const file = await getFileById(fileId);
      if (!file) {
        return NextResponse.json(
          { error: 'File not found' },
          { status: 404 }
        );
      }
      // Verify user owns the file
      if (file.userId !== userId) {
        return NextResponse.json(
          { error: 'Unauthorized to access this file' },
          { status: 403 }
        );
      }
      targetUrl = file.url;
    }

    // For comparison, we need multiple URLs
    if (type === 'compare') {
      if (!fileUrls || fileUrls.length < 2) {
        return NextResponse.json(
          { error: 'At least 2 file URLs are required for comparison' },
          { status: 400 }
        );
      }

      const result = await compareDocuments(fileUrls, options);
      return NextResponse.json(result);
    }

    // For other types, we need a single URL
    if (!targetUrl) {
      return NextResponse.json(
        { error: 'fileId or fileUrl is required' },
        { status: 400 }
      );
    }

    let result;

    switch (type) {
      case 'analyze':
        if (!prompt) {
          return NextResponse.json(
            { error: 'prompt is required for analyze type' },
            { status: 400 }
          );
        }
        result = await analyzeFile(targetUrl, prompt, options);
        break;

      case 'summarize':
        result = await summarizeDocument(targetUrl, options);
        break;

      case 'extract':
        if (!schema || !schema.fields) {
          return NextResponse.json(
            { error: 'schema with fields is required for extract type' },
            { status: 400 }
          );
        }
        result = await extractData(targetUrl, schema);
        break;

      case 'contract':
        result = await analyzeContract(targetUrl);
        break;

      case 'financial':
        result = await analyzeFinancialDocument(targetUrl);
        break;

      case 'resume':
        result = await analyzeResume(targetUrl);
        break;

      case 'invoice':
        result = await analyzeInvoice(targetUrl);
        break;

      default:
        return NextResponse.json(
          { error: `Unknown analysis type: ${type}` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: result.success,
      type,
      ...result,
    });
  } catch (error) {
    console.error('Error in file analysis:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to analyze file' },
      { status: 500 }
    );
  }
}

// GET: List available analysis types and their requirements
export async function GET() {
  return NextResponse.json({
    analysisTypes: [
      {
        type: 'analyze',
        description: 'General file analysis with a custom prompt',
        required: ['fileId or fileUrl', 'prompt'],
        optional: ['options.model', 'options.maxTokens', 'options.temperature'],
      },
      {
        type: 'summarize',
        description: 'Summarize a document',
        required: ['fileId or fileUrl'],
        optional: ['options.length (brief/standard/detailed)', 'options.format (paragraph/bullets/structured)', 'options.focus'],
      },
      {
        type: 'extract',
        description: 'Extract structured data from a document',
        required: ['fileId or fileUrl', 'schema'],
        schemaFormat: {
          fields: [
            {
              name: 'fieldName',
              type: 'string | number | boolean | date | array | object',
              description: 'Description of the field',
              required: true,
            },
          ],
          instructions: 'Optional additional instructions',
        },
      },
      {
        type: 'compare',
        description: 'Compare multiple documents',
        required: ['fileUrls (array of at least 2 URLs)'],
        optional: ['options.focus', 'options.detailed'],
      },
      {
        type: 'contract',
        description: 'Analyze a contract or legal document',
        required: ['fileId or fileUrl'],
      },
      {
        type: 'financial',
        description: 'Analyze a financial document',
        required: ['fileId or fileUrl'],
      },
      {
        type: 'resume',
        description: 'Analyze a resume or CV',
        required: ['fileId or fileUrl'],
      },
      {
        type: 'invoice',
        description: 'Extract data from an invoice',
        required: ['fileId or fileUrl'],
      },
    ],
  });
}
