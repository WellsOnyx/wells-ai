/**
 * Catalog Import API
 *
 * POST /api/seller/catalog/import - Import products from various sources
 * GET /api/seller/catalog/import?jobId=xxx - Get import job status
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  ingestFromCSV,
  ingestFromShopify,
  ingestFromERP,
  getIngestionJob,
  getSellerIngestionHistory,
  FieldMapping,
} from '@/lib/seller/catalog-ingestion';

// ============================================================================
// GET - Get import job status or history
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const jobId = url.searchParams.get('jobId');

    // Get specific job status
    if (jobId) {
      const job = await getIngestionJob(jobId);

      if (!job) {
        return NextResponse.json(
          { error: 'Import job not found' },
          { status: 404 }
        );
      }

      if (job.sellerId !== userId) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 403 }
        );
      }

      return NextResponse.json({
        job,
        progress: job.totalRecords > 0
          ? Math.round((job.processedRecords / job.totalRecords) * 100)
          : 0,
      });
    }

    // Get import history
    const history = await getSellerIngestionHistory(userId);

    return NextResponse.json({
      history,
      count: history.length,
    });
  } catch (error) {
    console.error('Error getting import status:', error);
    return NextResponse.json(
      { error: 'Failed to get import status' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Start a new import
// ============================================================================

interface ImportRequest {
  source: 'csv' | 'shopify' | 'woocommerce' | 'erp';

  // For CSV import
  csvContent?: string;
  csvOptions?: {
    hasHeaders?: boolean;
    delimiter?: string;
    customMapping?: Partial<FieldMapping>;
  };

  // For Shopify import
  shopifyConfig?: {
    shopDomain: string;
    accessToken: string;
  };

  // For ERP import (via Merge.dev)
  erpConfig?: {
    connectionId: string;
    accountToken: string;
  };

  // Common options
  options?: {
    dryRun?: boolean;
    updateExisting?: boolean;
    categoryOverride?: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const contentType = request.headers.get('content-type') || '';

    // Handle multipart form data (file upload)
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const optionsStr = formData.get('options') as string | null;

      if (!file) {
        return NextResponse.json(
          { error: 'No file provided' },
          { status: 400 }
        );
      }

      const csvContent = await file.text();
      const options = optionsStr ? JSON.parse(optionsStr) : {};

      const job = await ingestFromCSV(userId, csvContent, {
        hasHeaders: options.hasHeaders !== false,
        delimiter: options.delimiter || ',',
        customMapping: options.customMapping,
      });

      return NextResponse.json({
        success: true,
        message: `Import started. Processing ${job.totalRecords} records.`,
        jobId: job.id,
        job,
      });
    }

    // Handle JSON request
    const body = (await request.json()) as ImportRequest;

    if (!body.source) {
      return NextResponse.json(
        { error: 'Missing source parameter' },
        { status: 400 }
      );
    }

    let job;

    switch (body.source) {
      case 'csv':
        if (!body.csvContent) {
          return NextResponse.json(
            { error: 'Missing csvContent for CSV import' },
            { status: 400 }
          );
        }

        job = await ingestFromCSV(userId, body.csvContent, body.csvOptions);
        break;

      case 'shopify':
        if (!body.shopifyConfig?.shopDomain || !body.shopifyConfig?.accessToken) {
          return NextResponse.json(
            { error: 'Missing shopifyConfig (shopDomain and accessToken required)' },
            { status: 400 }
          );
        }

        job = await ingestFromShopify(userId, body.shopifyConfig);
        break;

      case 'erp':
        if (!body.erpConfig?.connectionId || !body.erpConfig?.accountToken) {
          return NextResponse.json(
            { error: 'Missing erpConfig (connectionId and accountToken required)' },
            { status: 400 }
          );
        }

        job = await ingestFromERP(userId, body.erpConfig);
        break;

      case 'woocommerce':
        return NextResponse.json(
          { error: 'WooCommerce import coming soon' },
          { status: 501 }
        );

      default:
        return NextResponse.json(
          { error: `Unsupported source: ${body.source}` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      message: `Import started from ${body.source}. Processing ${job.totalRecords} records.`,
      jobId: job.id,
      job,
    });
  } catch (error) {
    console.error('Error starting import:', error);
    return NextResponse.json(
      { error: 'Failed to start import' },
      { status: 500 }
    );
  }
}
