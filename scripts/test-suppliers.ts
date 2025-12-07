/**
 * Test script for supplier onboarding and matching system
 *
 * Run with: npx tsx scripts/test-suppliers.ts
 */

import { createSupplier, matchSuppliersToRequest, getAllSuppliers } from '../lib/suppliers/db';
import { SupplierOnboardingRequest, RFQDetails } from '../lib/suppliers/types';

async function testSupplierSystem() {
  console.log('🧪 Testing Supplier Onboarding and Matching System\n');

  try {
    // Test 1: Get all suppliers (should show seeded data)
    console.log('📋 Test 1: Getting all active suppliers...');
    const suppliers = await getAllSuppliers();
    console.log(`✅ Found ${suppliers.length} active suppliers:`);
    suppliers.forEach(s => {
      console.log(`   - ${s.companyName} (${s.products.join(', ')})`);
    });
    console.log();

    // Test 2: Onboard a new supplier
    console.log('📝 Test 2: Onboarding new supplier...');
    const newSupplier: SupplierOnboardingRequest = {
      companyName: 'Test Automation Components Inc.',
      contactEmail: 'sales@testautomation.com',
      phone: '+1-555-TEST-001',
      website: 'https://testautomation.com',
      products: ['automation', 'sensors', 'controllers'],
      pricing: {
        minimumOrder: 1000,
        currency: 'USD',
        paymentTerms: 'NET30',
        discountTiers: [
          { minQuantity: 100, discountPct: 5 },
          { minQuantity: 500, discountPct: 12 },
        ],
      },
      capacity: {
        monthlyVolume: 8000,
        leadTime: 7,
        locations: ['Dallas', 'Seattle'],
      },
      certifications: ['ISO9001', 'UL Listed'],
      leadTime: 7,
      minimumOrder: 1000,
      dropShipCapable: true,
      whiteLabelCapable: false,
    };

    const supplier = await createSupplier(newSupplier);
    console.log(`✅ Created supplier: ${supplier.companyName} (ID: ${supplier.id})`);
    console.log(`   Status: ${supplier.status}`);
    console.log();

    // Test 3: Match suppliers to RFQ
    console.log('🔍 Test 3: Matching suppliers to RFQ...');
    const rfq: RFQDetails = {
      category: 'bearings',
      description: 'Need high-precision ball bearings for industrial machinery, 6000 series, stainless steel',
      quantity: 500,
      targetPrice: 3000,
      urgency: 'urgent',
      deliveryLocation: 'Chicago, IL',
      requiredCertifications: ['ISO9001'],
      additionalRequirements: 'Must ship within 5 business days',
    };

    console.log(`   Category: ${rfq.category}`);
    console.log(`   Quantity: ${rfq.quantity}`);
    console.log(`   Urgency: ${rfq.urgency}`);
    console.log(`   Required certs: ${rfq.requiredCertifications?.join(', ')}`);
    console.log();

    const matchResult = await matchSuppliersToRequest(rfq);
    console.log(`✅ Analysis complete. Considered ${matchResult.totalSuppliersConsidered} suppliers`);
    console.log(`   Found ${matchResult.matches.length} matches:\n`);

    matchResult.matches.forEach((match, i) => {
      console.log(`   ${i + 1}. ${match.supplier.companyName} - Score: ${match.matchScore}/100`);
      console.log(`      Lead Time: ${match.estimatedLeadTime} days`);
      console.log(`      Reasoning: ${match.reasoning}`);
      console.log(`      Strengths: ${match.strengths.join(', ')}`);
      if (match.concerns && match.concerns.length > 0) {
        console.log(`      Concerns: ${match.concerns.join(', ')}`);
      }
      console.log();
    });

    console.log('✅ All tests passed!');

  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run tests
testSupplierSystem();
