/**
 * Notion to Postgres sync script
 * Run with: npm run db:sync
 *
 * This script syncs data from Notion databases to Postgres
 * for better query performance at scale
 */

const { Client } = require('@notionhq/client')
const { sql } = require('@vercel/postgres')

const notion = new Client({ auth: process.env.NOTION_API_KEY })

/**
 * Sync suppliers from Notion to Postgres
 */
async function syncSuppliers() {
  console.log('🔄 Syncing suppliers from Notion...')

  try {
    const response = await notion.databases.query({
      database_id: process.env.NOTION_SUPPLIERS_DB_ID,
    })

    let synced = 0
    let errors = 0

    for (const page of response.results) {
      try {
        const properties = page.properties

        // Extract supplier data from Notion properties
        const supplier = {
          notion_id: page.id,
          name: properties.Name?.title?.[0]?.plain_text || 'Unknown',
          email: properties.Email?.email || '',
          phone: properties.Phone?.phone_number || '',
          categories: properties.Categories?.multi_select?.map(c => c.name) || [],
          capabilities: properties.Capabilities?.multi_select?.map(c => c.name) || [],
          certifications: properties.Certifications?.multi_select?.map(c => c.name) || [],
          rating: properties.Rating?.number || 0,
          completed_deals: properties['Completed Deals']?.number || 0,
        }

        // Upsert supplier
        await sql.query(
          `INSERT INTO suppliers (notion_id, name, email, phone, categories, capabilities, certifications, rating, completed_deals)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (notion_id)
           DO UPDATE SET
             name = EXCLUDED.name,
             email = EXCLUDED.email,
             phone = EXCLUDED.phone,
             categories = EXCLUDED.categories,
             capabilities = EXCLUDED.capabilities,
             certifications = EXCLUDED.certifications,
             rating = EXCLUDED.rating,
             completed_deals = EXCLUDED.completed_deals,
             updated_at = NOW()`,
          [
            supplier.notion_id,
            supplier.name,
            supplier.email,
            supplier.phone,
            supplier.categories,
            supplier.capabilities,
            supplier.certifications,
            supplier.rating,
            supplier.completed_deals,
          ]
        )

        synced++
      } catch (error) {
        console.error(`  ❌ Error syncing supplier ${page.id}:`, error.message)
        errors++
      }
    }

    console.log(`  ✅ Synced ${synced} suppliers (${errors} errors)`)
    return { synced, errors }

  } catch (error) {
    console.error('❌ Supplier sync failed:', error)
    throw error
  }
}

/**
 * Sync deals from Notion to Postgres
 */
async function syncDeals() {
  console.log('🔄 Syncing deals from Notion...')

  try {
    const response = await notion.databases.query({
      database_id: process.env.NOTION_DEALS_DB_ID,
    })

    let synced = 0
    let errors = 0

    for (const page of response.results) {
      try {
        const properties = page.properties

        // Extract deal data from Notion properties
        const deal = {
          notion_id: page.id,
          buyer_id: properties['Buyer ID']?.rich_text?.[0]?.plain_text || '',
          amount: properties.Amount?.number || 0,
          wells_fee: properties['Wells Fee']?.number || 0,
          status: properties.Status?.select?.name?.toLowerCase() || 'pending',
          payment_intent_id: properties['Payment Intent']?.rich_text?.[0]?.plain_text || null,
        }

        // Find supplier and quote by notion_id if available
        const supplierNotionId = properties.Supplier?.relation?.[0]?.id
        const quoteNotionId = properties.Quote?.relation?.[0]?.id

        let supplier_id = null
        let quote_id = null

        if (supplierNotionId) {
          const supplierResult = await sql.query(
            'SELECT id FROM suppliers WHERE notion_id = $1',
            [supplierNotionId]
          )
          supplier_id = supplierResult.rows[0]?.id
        }

        if (quoteNotionId) {
          const quoteResult = await sql.query(
            'SELECT id FROM quotes WHERE notion_id = $1',
            [quoteNotionId]
          )
          quote_id = quoteResult.rows[0]?.id
        }

        // Upsert deal
        await sql.query(
          `INSERT INTO deals (notion_id, supplier_id, buyer_id, quote_id, amount, wells_fee, status, payment_intent_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (notion_id)
           DO UPDATE SET
             supplier_id = EXCLUDED.supplier_id,
             buyer_id = EXCLUDED.buyer_id,
             quote_id = EXCLUDED.quote_id,
             amount = EXCLUDED.amount,
             wells_fee = EXCLUDED.wells_fee,
             status = EXCLUDED.status,
             payment_intent_id = EXCLUDED.payment_intent_id,
             completed_at = CASE WHEN EXCLUDED.status = 'completed' THEN NOW() ELSE deals.completed_at END`,
          [
            deal.notion_id,
            supplier_id,
            deal.buyer_id,
            quote_id,
            deal.amount,
            deal.wells_fee,
            deal.status,
            deal.payment_intent_id,
          ]
        )

        synced++
      } catch (error) {
        console.error(`  ❌ Error syncing deal ${page.id}:`, error.message)
        errors++
      }
    }

    console.log(`  ✅ Synced ${synced} deals (${errors} errors)`)
    return { synced, errors }

  } catch (error) {
    console.error('❌ Deal sync failed:', error)
    throw error
  }
}

/**
 * Sync GTM prospects from Notion to Postgres
 */
async function syncProspects() {
  console.log('🔄 Syncing GTM prospects from Notion...')

  try {
    const response = await notion.databases.query({
      database_id: process.env.NOTION_GTM_RELATIONSHIPS_DB_ID,
    })

    let synced = 0
    let errors = 0

    for (const page of response.results) {
      try {
        const properties = page.properties

        const prospect = {
          notion_id: page.id,
          practice_group: properties['Practice Group']?.select?.name || 'Unknown',
          company_name: properties.Company?.title?.[0]?.plain_text || 'Unknown',
          contact_name: properties.Contact?.rich_text?.[0]?.plain_text || '',
          contact_title: properties.Title?.rich_text?.[0]?.plain_text || '',
          contact_email: properties.Email?.email || '',
          contact_linkedin: properties.LinkedIn?.url || '',
          company_size: properties['Company Size']?.select?.name || '',
          industry: properties.Industry?.select?.name || '',
          icp_score: properties['ICP Score']?.number || 0,
          status: properties.Status?.select?.name?.toLowerCase() || 'discovered',
        }

        await sql.query(
          `INSERT INTO gtm_prospects (notion_id, practice_group, company_name, contact_name, contact_title, contact_email, contact_linkedin, company_size, industry, icp_score, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           ON CONFLICT (notion_id)
           DO UPDATE SET
             practice_group = EXCLUDED.practice_group,
             company_name = EXCLUDED.company_name,
             contact_name = EXCLUDED.contact_name,
             contact_title = EXCLUDED.contact_title,
             contact_email = EXCLUDED.contact_email,
             contact_linkedin = EXCLUDED.contact_linkedin,
             company_size = EXCLUDED.company_size,
             industry = EXCLUDED.industry,
             icp_score = EXCLUDED.icp_score,
             status = EXCLUDED.status,
             updated_at = NOW()`,
          [
            prospect.notion_id,
            prospect.practice_group,
            prospect.company_name,
            prospect.contact_name,
            prospect.contact_title,
            prospect.contact_email,
            prospect.contact_linkedin,
            prospect.company_size,
            prospect.industry,
            prospect.icp_score,
            prospect.status,
          ]
        )

        synced++
      } catch (error) {
        console.error(`  ❌ Error syncing prospect ${page.id}:`, error.message)
        errors++
      }
    }

    console.log(`  ✅ Synced ${synced} prospects (${errors} errors)`)
    return { synced, errors }

  } catch (error) {
    console.error('❌ Prospect sync failed:', error)
    throw error
  }
}

/**
 * Main sync function
 */
async function sync() {
  console.log('🚀 Starting Notion → Postgres sync...')
  console.log('⏰', new Date().toISOString())

  const startTime = Date.now()

  try {
    const results = {
      suppliers: await syncSuppliers(),
      deals: await syncDeals(),
      prospects: await syncProspects(),
    }

    const totalSynced = results.suppliers.synced + results.deals.synced + results.prospects.synced
    const totalErrors = results.suppliers.errors + results.deals.errors + results.prospects.errors
    const duration = ((Date.now() - startTime) / 1000).toFixed(2)

    console.log('\n✅ Sync completed!')
    console.log(`📊 Total synced: ${totalSynced} records`)
    console.log(`❌ Total errors: ${totalErrors}`)
    console.log(`⏱️  Duration: ${duration}s`)

    // Refresh materialized views
    console.log('\n🔄 Refreshing materialized views...')
    await sql.query('REFRESH MATERIALIZED VIEW CONCURRENTLY daily_metrics')
    console.log('  ✅ Refreshed daily_metrics')

  } catch (error) {
    console.error('❌ Sync failed:', error)
    process.exit(1)
  }
}

// Run sync if called directly
if (require.main === module) {
  sync()
}

module.exports = { sync, syncSuppliers, syncDeals, syncProspects }
