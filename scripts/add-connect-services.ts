import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🤝 Adding Connect Services as partner...\n');

  // Check if partner already exists
  const existing = await prisma.partner.findUnique({
    where: { name: 'Connect Services' }
  });

  if (existing) {
    console.log('✅ Connect Services already exists:', existing.id);
    console.log('Referral URL:', existing.referralUrl);
    return;
  }

  // Create Connect Services partner
  const partner = await prisma.partner.create({
    data: {
      name: 'Connect Services',
      industry: 'Financial Services',
      website: 'https://connectservices.com',

      // Contact details (placeholder - update with real contact info)
      primaryContactName: 'Partner Contact',
      primaryContactEmail: 'partners@connectservices.com',

      // Partnership details
      partnershipType: 'Referral',
      status: 'active',

      // Deal split (100% referral commission to Wells Onyx)
      defaultDealSplit: {
        wells: 100,
        partner: 0
      },

      // Referral tracking
      referralUrl: 'https://connectservices.com/referral?rid=MzcwNzcwMDg3MDl8OTA=',
      referralCategory: 'Payment Processing',
      partnerDescription: 'Payment processing and merchant services for high-volume transactions',
      commissionRate: null, // TBD - need to confirm commission structure
      recommendationTriggers: [
        'payment processing',
        'merchant services',
        'credit card processing',
        'payment gateway',
        'transaction processing',
        'high volume payments',
        'accept payments'
      ]
    }
  });

  console.log('✅ Connect Services added successfully!\n');
  console.log('Partner ID:', partner.id);
  console.log('Referral URL:', partner.referralUrl);
  console.log('Category:', partner.referralCategory);
  console.log('\nRecommendation Triggers:');
  partner.recommendationTriggers.forEach(trigger => console.log('  -', trigger));

  console.log('\n🎯 Wells AI will now recommend Connect Services when users mention:');
  console.log('  "payment processing", "merchant services", "accept payments", etc.');
}

main()
  .catch((e) => {
    console.error('❌ Error adding Connect Services:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
