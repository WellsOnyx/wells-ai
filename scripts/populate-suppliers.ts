/**
 * Populate Notion Suppliers Database with Sample Data
 * Run with: npx tsx scripts/populate-suppliers.ts
 */

import { Client } from '@notionhq/client'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const notion = new Client({ auth: process.env.NOTION_API_KEY })
const SUPPLIERS_DB = process.env.NOTION_SUPPLIERS_DB!

const sampleSuppliers = [
  {
    name: 'Circuit Solutions Inc',
    email: 'sales@circuitsolutions.com',
    phone: '+1-555-0100',
    capabilities: ['Electronics', 'Manufacturing'],
    responseTime: '< 4 hours',
    status: 'Active'
  },
  {
    name: 'TechForge Manufacturing',
    email: 'quotes@techforge.com',
    phone: '+1-555-0200',
    capabilities: ['Electronics', 'Manufacturing', 'IT Services'],
    responseTime: '< 8 hours',
    status: 'Active'
  },
  {
    name: 'Global PCB Systems',
    email: 'contact@globalpcb.com',
    phone: '+1-555-0300',
    capabilities: ['Electronics'],
    responseTime: '< 12 hours',
    status: 'Active'
  },
  {
    name: 'Premier Office Supply Co',
    email: 'sales@premieroffice.com',
    phone: '+1-555-0400',
    capabilities: ['Office Supplies'],
    responseTime: '< 4 hours',
    status: 'Active'
  },
  {
    name: 'Industrial Equipment Partners',
    email: 'info@indequip.com',
    phone: '+1-555-0500',
    capabilities: ['Manufacturing', 'Office Supplies'],
    responseTime: '< 24 hours',
    status: 'Active'
  },
  {
    name: 'Digital Marketing Hub',
    email: 'hello@digitalmarketinghub.com',
    phone: '+1-555-0600',
    capabilities: ['Marketing', 'IT Services'],
    responseTime: '< 4 hours',
    status: 'Active'
  },
  {
    name: 'Professional Services Group',
    email: 'contact@proservicesgroup.com',
    phone: '+1-555-0700',
    capabilities: ['Professional Services', 'IT Services'],
    responseTime: '< 8 hours',
    status: 'Active'
  },
  {
    name: 'Enterprise IT Solutions',
    email: 'sales@enterpriseit.com',
    phone: '+1-555-0800',
    capabilities: ['IT Services', 'Professional Services'],
    responseTime: '< 4 hours',
    status: 'Active'
  },
  {
    name: 'Advanced Manufacturing Corp',
    email: 'quotes@advancedmfg.com',
    phone: '+1-555-0900',
    capabilities: ['Manufacturing', 'Electronics'],
    responseTime: '< 12 hours',
    status: 'Active'
  },
  {
    name: 'Creative Marketing Agency',
    email: 'hi@creativemarketing.com',
    phone: '+1-555-1000',
    capabilities: ['Marketing'],
    responseTime: '< 8 hours',
    status: 'Active'
  }
]

async function populateSuppliers() {
  console.log('🚀 Starting supplier population...')
  console.log(`Database ID: ${SUPPLIERS_DB}`)

  let created = 0
  let errors = 0

  for (const supplier of sampleSuppliers) {
    try {
      console.log(`\n📦 Creating supplier: ${supplier.name}`)

      await notion.pages.create({
        parent: { database_id: SUPPLIERS_DB },
        properties: {
          Name: {
            title: [
              {
                text: {
                  content: supplier.name
                }
              }
            ]
          },
          Email: {
            email: supplier.email
          },
          Phone: {
            phone_number: supplier.phone
          },
          Capabilities: {
            multi_select: supplier.capabilities.map(cap => ({ name: cap }))
          },
          'Response Time': {
            select: {
              name: supplier.responseTime
            }
          },
          Status: {
            select: {
              name: supplier.status
            }
          }
        }
      })

      console.log(`✅ Created: ${supplier.name}`)
      created++
    } catch (error: any) {
      console.error(`❌ Error creating ${supplier.name}:`, error.message)
      errors++
    }
  }

  console.log(`\n🎉 Population complete!`)
  console.log(`   ✅ Created: ${created}`)
  console.log(`   ❌ Errors: ${errors}`)
  console.log(`   📊 Total: ${sampleSuppliers.length}`)
}

populateSuppliers().catch(console.error)
