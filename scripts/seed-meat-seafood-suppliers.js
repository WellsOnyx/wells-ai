// scripts/seed-meat-seafood-suppliers.js
// Seed database with Keith's meat/seafood suppliers for Friday demo

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const suppliers = [
  {
    name: 'Sysco Meat & Seafood',
    email: 'quotes@sysco-meat.com',
    phone: '(800) 555-0101',
    categories: ['Meat & Protein', 'Seafood'],
    capabilities: ['Nationwide delivery', 'Same-day shipping', 'Custom cuts', 'HACCP certified'],
    certifications: ['USDA', 'SQF Level 3', 'GFSI']
  },
  {
    name: 'US Foods Protein Division',
    email: 'protein@usfoods.com',
    phone: '(800) 555-0102',
    categories: ['Meat & Protein'],
    capabilities: ['Next-day delivery', 'Portion control', 'Private label', 'Online ordering'],
    certifications: ['USDA Prime', 'Certified Angus Beef', 'Heritage Pork']
  },
  {
    name: 'Performance Food Group - Meat',
    email: 'meat@pfgc.com',
    phone: '(800) 555-0103',
    categories: ['Meat & Protein'],
    capabilities: ['Regional delivery', 'Portion-controlled cuts', 'Vacuum sealed', 'Temperature monitoring'],
    certifications: ['USDA', 'GAP Certified']
  },
  {
    name: 'Samuels Seafood',
    email: 'orders@samuelsseafood.com',
    phone: '(800) 555-0104',
    categories: ['Seafood'],
    capabilities: ['Daily fresh deliveries', 'Wild-caught specialty', 'Custom portioning', 'Sustainability focus'],
    certifications: ['MSC Certified', 'BAP Certified', 'Ocean Wise']
  },
  {
    name: 'Inland Market',
    email: 'sales@inlandmarket.com',
    phone: '(800) 555-0105',
    categories: ['Meat & Protein'],
    capabilities: ['Farm-to-table', 'Grass-fed beef', 'Game meats', 'Regional sourcing'],
    certifications: ['USDA', 'AWA Certified', 'Non-GMO']
  },
  {
    name: 'True World Foods',
    email: 'orders@trueworldfoods.com',
    phone: '(800) 555-0106',
    categories: ['Seafood'],
    capabilities: ['Sushi-grade quality', 'Japanese imports', 'Live seafood', 'Temperature controlled'],
    certifications: ['FDA Approved', 'JAS Certified', 'Sushi Safe']
  },
  {
    name: 'High Liner Foods',
    email: 'foodservice@highliner.com',
    phone: '(800) 555-0107',
    categories: ['Seafood'],
    capabilities: ['Frozen seafood', 'Breaded products', 'Bulk packaging', 'Long shelf life'],
    certifications: ['MSC', 'ASC', 'BAP', 'BRC']
  },
  {
    name: 'Trident Seafoods',
    email: 'orders@tridentseafoods.com',
    phone: '(800) 555-0108',
    categories: ['Seafood'],
    capabilities: ['Alaskan sourced', 'Wild-caught', 'Sustainable fishing', 'Flash frozen'],
    certifications: ['Alaska RFM', 'MSC', 'Alaska Seafood']
  }
]

async function seedSuppliers() {
  console.log('Seeding meat/seafood suppliers for Keith demo...\n')

  let created = 0
  let skipped = 0

  for (const supplier of suppliers) {
    try {
      // Check if supplier already exists
      const existing = await prisma.suppliers.findUnique({
        where: { email: supplier.email }
      })

      if (existing) {
        console.log(`[SKIP] ${supplier.name} - already exists`)
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
          rating: 4.8 + Math.random() * 0.2, // 4.8 - 5.0 rating
          completed_deals: Math.floor(Math.random() * 50) + 10 // 10-60 deals
        }
      })

      console.log(`[OK] ${supplier.name} - ${result.id}`)
      created++
    } catch (error) {
      console.error(`[ERROR] ${supplier.name}:`, error.message)
    }
  }

  console.log(`\nDone! Created: ${created}, Skipped: ${skipped}`)
  console.log('\nTo test quote requests:')
  console.log('POST /api/quotes/request with categories: ["Meat & Protein"] or ["Seafood"]')
}

seedSuppliers()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
