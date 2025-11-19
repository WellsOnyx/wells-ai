// scripts/seed-universal-suppliers.js
// Seed database with suppliers across ALL categories - UNIVERSAL platform

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const suppliers = [
  // ============ OFFICE SUPPLIES ============
  {
    name: 'Staples Business Advantage',
    email: 'quotes@staples-business.com',
    phone: '(800) 555-1001',
    categories: ['Office Supplies'],
    capabilities: ['Same-day delivery', 'Bulk discounts', 'Custom printing', 'Managed inventory'],
    certifications: ['FSC Certified', 'Green Business', 'Women-Owned']
  },
  {
    name: 'W.B. Mason',
    email: 'sales@wbmason.com',
    phone: '(800) 555-1002',
    categories: ['Office Supplies', 'Packaging'],
    capabilities: ['Free delivery', 'Next-day shipping', 'Furniture assembly', 'Account management'],
    certifications: ['Carbon Neutral', 'ENERGY STAR Partner']
  },

  // ============ IT / TECHNOLOGY ============
  {
    name: 'CDW Corporation',
    email: 'quotes@cdw.com',
    phone: '(800) 555-2001',
    categories: ['Technology'],
    capabilities: ['Enterprise solutions', 'Cloud services', '24/7 support', 'Configuration services'],
    certifications: ['Microsoft Gold Partner', 'Cisco Premier', 'Dell Titanium']
  },
  {
    name: 'SHI International',
    email: 'procurement@shi.com',
    phone: '(800) 555-2002',
    categories: ['Technology'],
    capabilities: ['Software licensing', 'Hardware lifecycle', 'Cloud optimization', 'Asset management'],
    certifications: ['ISO 27001', 'SOC 2 Type II', 'ITAR Registered']
  },
  {
    name: 'Insight Enterprises',
    email: 'sales@insight.com',
    phone: '(800) 555-2003',
    categories: ['Technology', 'Equipment'],
    capabilities: ['Data center solutions', 'Digital innovation', 'Security services', 'Managed services'],
    certifications: ['AWS Partner', 'Google Cloud Partner', 'VMware Premier']
  },

  // ============ FACILITIES / CLEANING ============
  {
    name: 'Grainger Industrial Supply',
    email: 'quotes@grainger.com',
    phone: '(800) 555-3001',
    categories: ['Cleaning Supplies', 'Equipment'],
    capabilities: ['MRO supplies', 'Safety equipment', 'Same-day pickup', 'Inventory management'],
    certifications: ['ISO 9001', 'OSHA Compliance', 'Green Seal']
  },
  {
    name: 'Cintas Corporation',
    email: 'service@cintas.com',
    phone: '(800) 555-3002',
    categories: ['Cleaning Supplies'],
    capabilities: ['Uniform rental', 'Facility services', 'First aid supplies', 'Fire protection'],
    certifications: ['ISSA CIMS', 'Green Business Bureau', 'NFPA Certified']
  },

  // ============ MARKETING / PRINT ============
  {
    name: 'Vistaprint Business',
    email: 'b2b@vistaprint.com',
    phone: '(800) 555-4001',
    categories: ['Other'],
    capabilities: ['Custom printing', 'Promotional items', 'Signage', 'Marketing materials'],
    certifications: ['FSC Certified', 'Sustainable Forestry']
  },
  {
    name: '4imprint Promotional',
    email: 'orders@4imprint.com',
    phone: '(800) 555-4002',
    categories: ['Other'],
    capabilities: ['Branded merchandise', 'Rush orders', 'Design services', 'Sample program'],
    certifications: ['PPAI Member', 'ASI Certified']
  },

  // ============ FREIGHT / LOGISTICS ============
  {
    name: 'XPO Logistics',
    email: 'quotes@xpo.com',
    phone: '(800) 555-5001',
    categories: ['Other'],
    capabilities: ['LTL freight', 'Last mile delivery', 'Warehousing', 'Supply chain solutions'],
    certifications: ['SmartWay Partner', 'C-TPAT Certified', 'ISO 14001']
  },
  {
    name: 'Echo Global Logistics',
    email: 'freight@echo.com',
    phone: '(800) 555-5002',
    categories: ['Other'],
    capabilities: ['Truckload', 'Intermodal', 'International', 'Managed transportation'],
    certifications: ['TIA Member', 'SmartWay Partner', 'Hazmat Certified']
  },

  // ============ CONSTRUCTION / BUILDING ============
  {
    name: 'Ferguson Enterprises',
    email: 'commercial@ferguson.com',
    phone: '(800) 555-6001',
    categories: ['Equipment'],
    capabilities: ['Plumbing supplies', 'HVAC equipment', 'Fire protection', 'Job site delivery'],
    certifications: ['LEED Certified', 'WaterSense Partner', 'ENERGY STAR']
  },
  {
    name: 'HD Supply',
    email: 'quotes@hdsupply.com',
    phone: '(800) 555-6002',
    categories: ['Equipment', 'Other'],
    capabilities: ['MRO products', 'Renovation supplies', 'Property improvement', 'Managed inventory'],
    certifications: ['ISO 9001', 'OSHA VPP', 'Green Building']
  },

  // ============ FOOD SERVICE (Non meat/seafood) ============
  {
    name: 'Sysco Produce Division',
    email: 'produce@sysco.com',
    phone: '(800) 555-7001',
    categories: ['Produce'],
    capabilities: ['Farm fresh delivery', 'Cut produce', 'Organic options', 'Seasonal sourcing'],
    certifications: ['USDA Organic', 'GAP Certified', 'Fair Trade']
  },
  {
    name: 'Dean Foods Dairy',
    email: 'orders@deanfoods.com',
    phone: '(800) 555-7002',
    categories: ['Dairy'],
    capabilities: ['Daily delivery', 'Private label', 'Plant-based options', 'Extended shelf'],
    certifications: ['Grade A', 'rBST Free', 'Kosher']
  },
  {
    name: 'Pepsi Beverages',
    email: 'foodservice@pepsico.com',
    phone: '(800) 555-7003',
    categories: ['Beverages'],
    capabilities: ['Fountain service', 'Equipment placement', 'Marketing support', 'Route delivery'],
    certifications: ['SQF Certified', 'Sustainable Sourcing', 'Alliance for Water']
  },
  {
    name: 'US Foods Bakery',
    email: 'bakery@usfoods.com',
    phone: '(800) 555-7004',
    categories: ['Bakery'],
    capabilities: ['Fresh baked daily', 'Par-baked options', 'Custom orders', 'Allergen-free'],
    certifications: ['SQF Level 3', 'Non-GMO', 'Kosher']
  },

  // ============ PACKAGING ============
  {
    name: 'Uline Shipping Supplies',
    email: 'quotes@uline.com',
    phone: '(800) 555-8001',
    categories: ['Packaging'],
    capabilities: ['Same-day shipping', '40,000+ products', 'Custom boxes', 'Warehouse supplies'],
    certifications: ['ISO 9001', 'SFI Certified', 'Responsible Forestry']
  },
  {
    name: 'Berlin Packaging',
    email: 'sales@berlinpackaging.com',
    phone: '(800) 555-8002',
    categories: ['Packaging'],
    capabilities: ['Custom containers', 'Design services', 'Warehousing', 'Quality testing'],
    certifications: ['FDA Registered', 'ISO 9001', 'BRC Certified']
  }
]

async function seedSuppliers() {
  console.log('═══════════════════════════════════════════════════════')
  console.log('  UNIVERSAL SUPPLIER SEED - Wells AI Marketplace')
  console.log('═══════════════════════════════════════════════════════\n')

  let created = 0
  let skipped = 0
  let errors = 0

  const categoryCount = {}

  for (const supplier of suppliers) {
    try {
      // Check if supplier already exists
      const existing = await prisma.suppliers.findUnique({
        where: { email: supplier.email }
      })

      if (existing) {
        console.log(`[SKIP] ${supplier.name}`)
        skipped++
        continue
      }

      // Create supplier
      const result = await prisma.suppliers.create({
        data: {
          name: supplier.name,
          email: supplier.email,
          phone: supplier.phone,
          categories: supplier.categories,
          capabilities: supplier.capabilities,
          certifications: supplier.certifications,
          rating: 4.5 + Math.random() * 0.5, // 4.5 - 5.0 rating
          completed_deals: Math.floor(Math.random() * 100) + 20 // 20-120 deals
        }
      })

      // Track categories
      for (const cat of supplier.categories) {
        categoryCount[cat] = (categoryCount[cat] || 0) + 1
      }

      console.log(`[OK] ${supplier.name} (${supplier.categories.join(', ')})`)
      created++
    } catch (error) {
      console.error(`[ERROR] ${supplier.name}:`, error.message)
      errors++
    }
  }

  console.log('\n═══════════════════════════════════════════════════════')
  console.log('  RESULTS')
  console.log('═══════════════════════════════════════════════════════')
  console.log(`Created: ${created}`)
  console.log(`Skipped: ${skipped}`)
  console.log(`Errors:  ${errors}`)

  console.log('\nSuppliers by Category:')
  for (const [cat, count] of Object.entries(categoryCount).sort()) {
    console.log(`  ${cat}: ${count}`)
  }

  // Get total count
  const total = await prisma.suppliers.count()
  console.log(`\nTotal suppliers in database: ${total}`)

  console.log('\n═══════════════════════════════════════════════════════')
  console.log('  TEST COMMANDS')
  console.log('═══════════════════════════════════════════════════════')
  console.log('Test quote requests with ANY category:\n')
  console.log('curl -X POST https://wellsai.vercel.app/api/quotes/request \\')
  console.log('  -H "Content-Type: application/json" \\')
  console.log('  -d \'{"categories": ["Technology"], "description": "Need 50 laptops", "quantity": "50 units", "deadline": "2 weeks", "contactEmail": "buyer@company.com"}\'')
  console.log('\nOther category examples:')
  console.log('  - ["Office Supplies"]')
  console.log('  - ["Cleaning Supplies"]')
  console.log('  - ["Packaging"]')
  console.log('  - ["Equipment"]')
  console.log('  - ["Produce", "Dairy", "Beverages"]')
  console.log('  - ["Meat & Protein", "Seafood"] (Keith demo)')
}

seedSuppliers()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
