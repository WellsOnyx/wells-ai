// @ts-nocheck
/**
 * Loan Application API
 * POST /api/lending/apply - Submit full loan application
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key'
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      // Personal info
      email,
      firstName,
      lastName,
      ssn,
      dateOfBirth,
      phone,
      streetAddress,
      city,
      state,
      zipCode,

      // Employment
      employerName,
      jobTitle,
      employmentType,
      employmentStartDate,
      annualIncome,
      additionalIncome,

      // Financial
      monthlyHousingPayment,
      monthlyDebtPayments,
      liquidAssets,
      totalAssets,

      // Loan details
      productCode,
      requestedAmount,
      loanPurpose,
      downPayment,

      // Property/Collateral (if applicable)
      propertyAddress,
      propertyCity,
      propertyState,
      propertyZip,
      propertyValue,
      propertyUse,

      // Vehicle (if applicable)
      vehicleYear,
      vehicleMake,
      vehicleModel,
      vehicleVin,
      vehicleMileage,
      vehicleValue,
      vehicleCondition,

      // Co-borrower
      hasCoBorrower,
      coBorrowerData,

      // GRAIN
      grainBalance,
      grainStaked,
    } = body;

    // Validation
    if (!email || !firstName || !lastName || !productCode || !requestedAmount) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields',
        },
        { status: 400 }
      );
    }

    // Create or update borrower profile
    const { data: borrowerProfile, error: borrowerError } = await supabase
      .from('borrower_profiles')
      .upsert(
        {
          email,
          first_name: firstName,
          last_name: lastName,
          ssn_encrypted: ssn, // In production, encrypt this
          date_of_birth: dateOfBirth,
          phone,
          street_address: streetAddress,
          city,
          state,
          zip_code: zipCode,
          employer_name: employerName,
          job_title: jobTitle,
          employment_type: employmentType,
          employment_start_date: employmentStartDate,
          annual_income: annualIncome,
          additional_income: additionalIncome,
          monthly_housing_payment: monthlyHousingPayment,
          monthly_debt_payments: monthlyDebtPayments,
          total_assets: totalAssets,
          grain_balance: grainBalance || 0,
          grain_staked: grainStaked || 0,
        },
        { onConflict: 'email' }
      )
      .select()
      .single();

    if (borrowerError) {
      console.error('Error creating borrower profile:', borrowerError);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to create borrower profile',
        },
        { status: 500 }
      );
    }

    // Get product info for LTV calculation
    const { data: product } = await supabase
      .from('loan_products')
      .select('*')
      .eq('product_code', productCode)
      .single();

    if (!product) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid product code',
        },
        { status: 400 }
      );
    }

    // Calculate LTV
    let loanToValue = null;
    if (product.product_type === 'mortgage' && propertyValue) {
      loanToValue = (requestedAmount / propertyValue) * 100;
    } else if (product.product_type === 'auto' && vehicleValue) {
      loanToValue = (requestedAmount / vehicleValue) * 100;
    }

    // Generate application number
    const applicationNumber = `APP-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    // Create loan application
    const { data: application, error: applicationError } = await supabase
      .from('loan_applications')
      .insert({
        application_number: applicationNumber,
        borrower_id: borrowerProfile.id,
        product_id: product.id,
        requested_amount: requestedAmount,
        loan_purpose: loanPurpose,
        down_payment: downPayment || 0,
        loan_to_value: loanToValue,

        // Property details
        property_address: propertyAddress,
        property_city: propertyCity,
        property_state: propertyState,
        property_zip: propertyZip,
        property_value: propertyValue,
        property_use: propertyUse,

        // Vehicle details
        vehicle_year: vehicleYear,
        vehicle_make: vehicleMake,
        vehicle_model: vehicleModel,
        vehicle_vin: vehicleVin,
        vehicle_mileage: vehicleMileage,
        vehicle_value: vehicleValue,
        vehicle_condition: vehicleCondition,

        // Co-borrower
        has_co_borrower: hasCoBorrower || false,
        co_borrower_data: coBorrowerData || null,

        // Status
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        current_step: 7,
        completed_steps: [1, 2, 3, 4, 5, 6, 7],
      })
      .select()
      .single();

    if (applicationError) {
      console.error('Error creating application:', applicationError);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to create application',
        },
        { status: 500 }
      );
    }

    // TODO: Trigger automated underwriting
    // This would be done via a background job or webhook

    return NextResponse.json({
      success: true,
      application: {
        id: application.id,
        applicationNumber: application.application_number,
        status: application.status,
        submittedAt: application.submitted_at,
      },
      message: 'Application submitted successfully. You will receive a decision shortly.',
    });
  } catch (error) {
    console.error('Error submitting application:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to submit application',
      },
      { status: 500 }
    );
  }
}
