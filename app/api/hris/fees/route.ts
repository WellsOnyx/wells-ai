/**
 * HRIS Placement Fees API
 *
 * Track and manage placement fees for successful job placements
 *
 * GET - Get fee status for a candidate
 * POST - Create a placement fee record (called after offer acceptance)
 * PATCH - Update fee status (payment received, waived, etc.)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getCandidateFees,
  getPlacementFee,
  calculatePlacementFee,
} from '@/lib/jobs/placement-fee-service';
import { query } from '@/lib/db';

// Get placement fees for a user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const feeId = searchParams.get('feeId');

    if (feeId) {
      // Get specific fee status
      const fee = await getPlacementFee(feeId);
      if (!fee) {
        return NextResponse.json({
          success: false,
          message: "Fee not found.",
        }, { status: 404 });
      }
      return NextResponse.json({
        success: true,
        message: `Placement fee for ${fee.jobTitle} at ${fee.employerName}: $${fee.candidateFeeAmount.toLocaleString()} (your share). Status: ${fee.candidateFeeStatus}.`,
        fee,
      });
    }

    if (!userId) {
      return NextResponse.json({
        success: false,
        message: "I need your user ID to check your placement fees.",
      }, { status: 400 });
    }

    const result = await getCandidateFees(userId);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in HRIS fees GET:', error);
    return NextResponse.json({
      success: false,
      message: "I had trouble fetching your placement fees.",
      fees: [],
    }, { status: 500 });
  }
}

// Calculate fee (preview)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { annualSalary, preview } = body;

    if (!annualSalary) {
      return NextResponse.json({
        success: false,
        message: "I need the annual salary to calculate the placement fee.",
      }, { status: 400 });
    }

    const calculation = calculatePlacementFee(annualSalary);

    if (preview) {
      return NextResponse.json({
        success: true,
        message: `On a $${annualSalary.toLocaleString()} salary, the placement fee would be $${calculation.totalFeeAmount.toLocaleString()} (1% total: 0.5% from you, 0.5% from employer). Due 30 days after your start date.`,
        calculation,
        preview: true,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Placement fee calculated: $${calculation.totalFeeAmount.toLocaleString()} (1% of ${annualSalary.toLocaleString()})`,
      calculation,
    });
  } catch (error) {
    console.error('Error in HRIS fees POST:', error);
    return NextResponse.json({
      success: false,
      message: "I had trouble calculating the fee.",
    }, { status: 500 });
  }
}

// Update fee status
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { feeId, status, paymentId, notes } = body;

    if (!feeId || !status) {
      return NextResponse.json({
        success: false,
        message: "I need the fee ID and new status.",
      }, { status: 400 });
    }

    const validStatuses = ['pending', 'invoiced', 'paid', 'waived', 'refunded'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      }, { status: 400 });
    }

    // Update the fee
    const result = await query(
      `UPDATE hris_placement_fees SET
        status = $1,
        payment_id = COALESCE($2, payment_id),
        notes = COALESCE($3, notes),
        paid_at = CASE WHEN $1 = 'paid' THEN NOW() ELSE paid_at END,
        updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [status, paymentId, notes, feeId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        message: "Fee not found.",
      }, { status: 404 });
    }

    const fee = result.rows[0];
    const statusMessages: Record<string, string> = {
      pending: 'Fee is pending payment.',
      invoiced: 'Invoice sent. Payment due soon.',
      paid: 'Payment received. Thank you!',
      waived: 'Fee has been waived.',
      refunded: 'Fee has been refunded.',
    };

    return NextResponse.json({
      success: true,
      message: statusMessages[status] || `Fee status updated to ${status}.`,
      fee,
    });
  } catch (error) {
    console.error('Error in HRIS fees PATCH:', error);
    return NextResponse.json({
      success: false,
      message: "I had trouble updating the fee status.",
    }, { status: 500 });
  }
}
