/**
 * HRIS Connect API
 *
 * OAuth connection to employer HRIS systems via Merge.dev
 *
 * POST - Generate link token for OAuth flow
 * PUT - Exchange public token for account token after OAuth
 * GET - Get connection status
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  generateLinkToken,
  exchangeToken,
  getConnection,
  getEmployerConnections,
  syncJobPostings,
} from '@/lib/hris/merge-hris-client';

// Generate link token for OAuth
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { employerId, employerName } = body;

    if (!employerId || !employerName) {
      return NextResponse.json({
        success: false,
        message: "I need your employer ID and company name to set up the HRIS connection.",
      }, { status: 400 });
    }

    const result = await generateLinkToken(employerId, employerName);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in HRIS connect POST:', error);
    return NextResponse.json({
      success: false,
      message: "I had trouble starting the HRIS connection process.",
    }, { status: 500 });
  }
}

// Exchange public token after OAuth
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { publicToken, employerId, employerName } = body;

    if (!publicToken || !employerId || !employerName) {
      return NextResponse.json({
        success: false,
        message: "Missing required fields for token exchange.",
      }, { status: 400 });
    }

    const result = await exchangeToken(publicToken, employerId, employerName);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in HRIS connect PUT:', error);
    return NextResponse.json({
      success: false,
      message: "I couldn't complete the HRIS connection.",
    }, { status: 500 });
  }
}

// Get connection status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const connectionId = searchParams.get('connectionId');
    const employerId = searchParams.get('employerId');

    if (connectionId) {
      const connection = await getConnection(connectionId);

      if (!connection) {
        return NextResponse.json({
          success: false,
          message: "I couldn't find that HRIS connection.",
        }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        message: `Connected to ${connection.provider} for ${connection.employerName}. ${connection.jobPostingsCount} job postings synced.`,
        connection,
      });
    }

    if (employerId) {
      const connections = await getEmployerConnections(employerId);

      return NextResponse.json({
        success: true,
        message: connections.length > 0
          ? `Found ${connections.length} HRIS connection${connections.length > 1 ? 's' : ''}.`
          : "No HRIS connections found. Connect your ATS to start syncing job postings.",
        connections,
      });
    }

    return NextResponse.json({
      success: false,
      message: "Please provide a connectionId or employerId.",
    }, { status: 400 });
  } catch (error) {
    console.error('Error in HRIS connect GET:', error);
    return NextResponse.json({
      success: false,
      message: "I had trouble fetching connection status.",
    }, { status: 500 });
  }
}

// Trigger sync
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { connectionId } = body;

    if (!connectionId) {
      return NextResponse.json({
        success: false,
        message: "I need a connection ID to sync.",
      }, { status: 400 });
    }

    const result = await syncJobPostings(connectionId);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in HRIS connect PATCH:', error);
    return NextResponse.json({
      success: false,
      message: "I couldn't sync job postings.",
    }, { status: 500 });
  }
}
