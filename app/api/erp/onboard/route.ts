// @ts-nocheck
/**
 * ERP Customer Onboarding API
 *
 * THE 15-MINUTE SETUP:
 * 1. Customer provides basic info
 * 2. We generate vendor setup instructions for their ERP
 * 3. They add "Wells Onyx" as a vendor (takes 15 mins)
 * 4. We start capturing spend immediately
 *
 * CROSS-SELL: Every new customer gets pitched on Grain & Vault
 * for treasury optimization
 */

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import crypto from 'crypto'

// POST: Onboard new customer
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      companyName, companyDomain, erpType, contactName, contactEmail,
      annualSpendEstimate, spendCategories, integrationPreference
    } = body

    // Validate required fields
    if (!companyName || !erpType || !contactEmail) {
      return NextResponse.json({
        error: 'Missing required fields: companyName, erpType, contactEmail'
      }, { status: 400 })
    }

    // Generate customer code
    const customerCode = generateCustomerCode(companyName)

    // Generate vendor number (what they'll use in their ERP)
    const vendorNumber = `WO-${Date.now().toString(36).toUpperCase()}`

    // Determine best integration type based on ERP
    const integrationType = determineIntegrationType(erpType, integrationPreference)

    // Create customer
    const customerResult = await sql`
      INSERT INTO erp_customers (
        customer_code, company_name, company_domain,
        erp_type, integration_type, vendor_number, vendor_name,
        annual_spend_estimate, spend_categories,
        primary_contact_name, primary_contact_email, procurement_contact_email,
        status, margin_share_pct
      ) VALUES (
        ${customerCode}, ${companyName}, ${companyDomain || null},
        ${erpType}, ${integrationType}, ${vendorNumber}, 'Wells Onyx LLC',
        ${annualSpendEstimate || null}, ${spendCategories || ['MRO', 'office_supplies']},
        ${contactName || null}, ${contactEmail}, ${contactEmail},
        'onboarding', 50.00
      )
      RETURNING *
    `

    const customer = customerResult.rows[0]

    // Generate punch-out credentials if applicable
    let punchoutCredentials = null
    if (integrationType === 'punchout_catalog' || integrationType === 'hybrid') {
      const sharedSecret = crypto.randomBytes(32).toString('hex')
      const secretHash = crypto.createHash('sha256').update(sharedSecret).digest('hex')

      await sql`
        INSERT INTO punchout_credentials (
          customer_id, from_domain, from_identity,
          shared_secret_hash, is_active
        ) VALUES (
          ${customer.id}, ${companyDomain || companyName.toLowerCase().replace(/\s+/g, '')},
          ${customerCode}, ${secretHash}, TRUE
        )
      `

      punchoutCredentials = {
        fromDomain: companyDomain || companyName.toLowerCase().replace(/\s+/g, ''),
        fromIdentity: customerCode,
        sharedSecret,  // Only shown once!
        toDomain: 'wellsonyx.io',
        toIdentity: 'WELLSONYX',
        punchoutUrl: 'https://wellsonyx.io/api/erp/punchout'
      }
    }

    // Generate EDI trading partner if applicable
    let ediCredentials = null
    if (integrationType === 'edi_direct' || integrationType === 'hybrid') {
      const isaId = customerCode.substring(0, 15).padEnd(15)
      const gsId = customerCode.substring(0, 15)

      await sql`
        INSERT INTO edi_trading_partners (
          customer_id, isa_qualifier, isa_id, gs_id,
          connection_type, supports_850, supports_855, supports_856, supports_810, supports_997,
          is_active
        ) VALUES (
          ${customer.id}, 'ZZ', ${isaId}, ${gsId},
          'api', TRUE, TRUE, TRUE, TRUE, TRUE, TRUE
        )
      `

      ediCredentials = {
        isaQualifier: 'ZZ',
        isaId: isaId.trim(),
        gsId,
        ediEndpoint: 'https://wellsonyx.io/api/erp/edi',
        supportedDocuments: ['850', '855', '856', '810', '997']
      }
    }

    // Generate setup instructions
    const setupInstructions = generateSetupInstructions(erpType, {
      vendorNumber,
      vendorName: 'Wells Onyx LLC',
      integrationTypeype: integrationTypeype,
      punchoutCredentials,
      ediCredentials
    })

    // Cross-sell opportunity tracking
    const crossSellOpportunity = {
      grainVault: true,
      reasons: [
        'New customer - opportunity for treasury optimization',
        'Procurement spend can be optimized with early payment discounts',
        'GRAIN rewards for payment acceleration'
      ],
      pitch: `Welcome to Wells AI! As part of our ecosystem, you also get access to Grain & Vault -
              our treasury optimization platform. Earn GRAIN rewards on early payments to suppliers,
              access 1:1 credit lines, and get the best FX rates for international suppliers.`
    }

    console.log(`🎉 NEW CUSTOMER: ${companyName} (${customerCode})`)
    console.log(`   ERP: ${erpType}, Integration: ${integrationTypeype}`)
    console.log(`   🎯 CROSS-SELL: Grain & Vault treasury optimization`)

    return NextResponse.json({
      success: true,
      customer: {
        id: customer.id,
        customerCode,
        vendorNumber,
        status: 'onboarding'
      },
      integration: {
        type: integrationTypeype,
        punchout: punchoutCredentials,
        edi: ediCredentials
      },
      setupInstructions,
      crossSell: crossSellOpportunity,
      nextSteps: [
        'Add Wells Onyx as a vendor in your ERP system',
        integrationTypeype === 'punchout_catalog' ? 'Configure punch-out catalog settings' : null,
        integrationTypeype === 'edi_direct' ? 'Set up EDI trading partner connection' : null,
        'Contact us when ready for testing',
        'Schedule onboarding call to maximize savings'
      ].filter(Boolean)
    })
  } catch (error: any) {
    if (error.message?.includes('duplicate key')) {
      return NextResponse.json({
        error: 'Customer already exists with this name'
      }, { status: 409 })
    }
    console.error('Onboard error:', error)
    return NextResponse.json({ error: 'Onboarding failed' }, { status: 500 })
  }
}

// GET: Get onboarding status or list customers
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const customerCode = searchParams.get('code')
  const status = searchParams.get('status')

  if (customerCode) {
    // Get specific customer onboarding status
    const result = await sql`
      SELECT
        ec.*,
        (SELECT COUNT(*) FROM punchout_credentials WHERE customer_id = ec.id) as has_punchout,
        (SELECT COUNT(*) FROM edi_trading_partners WHERE customer_id = ec.id) as has_edi
      FROM erp_customers ec
      WHERE ec.customer_code = ${customerCode}
    `

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    const customer = result.rows[0]

    // Determine onboarding progress
    const progress = calculateOnboardingProgress(customer)

    return NextResponse.json({
      customer,
      progress,
      readyForProduction: progress.percentage === 100
    })
  }

  // List customers by status
  let query
  if (status) {
    query = sql`
      SELECT * FROM erp_customers
      WHERE status = ${status}
      ORDER BY created_at DESC
    `
  } else {
    query = sql`
      SELECT * FROM erp_customers
      ORDER BY created_at DESC
      LIMIT 100
    `
  }

  const result = await query

  return NextResponse.json({
    customers: result.rows,
    count: result.rows.length
  })
}

// PUT: Update onboarding status
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const { customerCode, status, goLiveDate } = body

    if (!customerCode) {
      return NextResponse.json({ error: 'Missing customerCode' }, { status: 400 })
    }

    await sql`
      UPDATE erp_customers SET
        status = COALESCE(${status}, status),
        go_live_date = COALESCE(${goLiveDate}, go_live_date),
        updated_at = NOW()
      WHERE customer_code = ${customerCode}
    `

    // If going active, log cross-sell reminder
    if (status === 'active') {
      console.log(`✅ CUSTOMER ACTIVE: ${customerCode}`)
      console.log(`   🎯 Schedule Grain & Vault treasury optimization call`)
    }

    return NextResponse.json({
      success: true,
      message: `Customer ${customerCode} updated to ${status}`
    })
  } catch (error) {
    console.error('Update onboarding error:', error)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}

// Helper functions
function generateCustomerCode(companyName: string): string {
  const prefix = companyName
    .replace(/[^a-zA-Z0-9]/g, '')
    .substring(0, 8)
    .toUpperCase()
  const suffix = Date.now().toString(36).toUpperCase().substring(-4)
  return `${prefix}-${suffix}`
}

function determineIntegrationType(erpType: string, preference?: string): string {
  if (preference) return preference

  // Default based on ERP type
  const punchoutErps = ['sap_ariba', 'coupa', 'jaggaer', 'workday']
  const ediErps = ['sap_s4hana', 'sap_ecc', 'oracle_fusion', 'oracle_ebs']

  if (punchoutErps.includes(erpType)) return 'punchout_catalog'
  if (ediErps.includes(erpType)) return 'hybrid'
  return 'virtual_vendor'
}

function generateSetupInstructions(erpType: string, config: any): any {
  const base = {
    vendorSetup: {
      vendorNumber: config.vendorNumber,
      vendorName: 'Wells Onyx LLC',
      paymentTerms: 'Net 30',
      taxId: '**-*******', // Provide actual
      address: {
        street: '100 Procurement Way',
        city: 'Miami',
        state: 'FL',
        zip: '33131',
        country: 'US'
      },
      remitTo: {
        bankName: 'Wells Fargo',
        accountType: 'Checking',
        routingNumber: '******',
        accountNumber: '******'
      }
    }
  }

  // ERP-specific instructions
  const erpInstructions: Record<string, any> = {
    sap_s4hana: {
      tcode: 'XK01',
      steps: [
        'Transaction: XK01 (Create Vendor)',
        `Enter Vendor Number: ${config.vendorNumber}`,
        'Company Code: [Your company code]',
        'Purchasing Org: [Your purchasing org]',
        'Account Group: Standard Vendor',
        'Complete General Data, Company Code Data, Purchasing Data'
      ],
      punchoutConfig: config.punchoutCredentials ? {
        spro: 'External Catalog Management',
        catalogType: 'OCI',
        url: config.punchoutCredentials.punchoutUrl
      } : null
    },
    sap_ariba: {
      steps: [
        'Supplier Management > Create Supplier',
        `Supplier ID: ${config.vendorNumber}`,
        'Configure punch-out catalog in Catalog Management',
        'Set up cXML connection with provided credentials'
      ],
      punchoutConfig: config.punchoutCredentials
    },
    coupa: {
      steps: [
        'Admin > Suppliers > Create',
        `Supplier Name: Wells Onyx LLC`,
        'Configure Punch-out under Catalog tab',
        'Add cXML credentials'
      ],
      punchoutConfig: config.punchoutCredentials
    },
    oracle_fusion: {
      path: 'Procurement > Suppliers > Manage Suppliers',
      steps: [
        'Create new supplier',
        'Enter company information',
        'Configure procurement business unit',
        'Set up EDI trading partner if needed'
      ]
    }
  }

  return {
    ...base,
    erp: erpInstructions[erpType] || {
      steps: [
        'Create Wells Onyx as a new vendor',
        `Use vendor number: ${config.vendorNumber}`,
        'Configure payment terms: Net 30',
        'Contact support@wellsonyx.io for integration assistance'
      ]
    },
    punchout: config.punchoutCredentials,
    edi: config.ediCredentials
  }
}

function calculateOnboardingProgress(customer: any): any {
  const steps = [
    { name: 'Customer Created', complete: true, weight: 20 },
    { name: 'Integration Configured', complete: customer.has_punchout > 0 || customer.has_edi > 0, weight: 20 },
    { name: 'Vendor Added to ERP', complete: customer.status !== 'onboarding', weight: 30 },
    { name: 'Test Order Received', complete: customer.total_spend_captured > 0, weight: 20 },
    { name: 'Go Live', complete: customer.status === 'active', weight: 10 }
  ]

  const percentage = steps.reduce((sum, step) => sum + (step.complete ? step.weight : 0), 0)

  return {
    steps,
    percentage,
    currentStep: steps.find(s => !s.complete)?.name || 'Complete'
  }
}
