/**
 * One-Pager Generator
 * Creates professional PDF one-pagers for partner outreach
 *
 * Usage:
 *   pnpm gen:onepager --partner ibm --wedge "Customer Ops"
 */

import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'
import { PARTNERS } from '../config/partners'

// ===== CLI ARGUMENT PARSING =====

function parseArgs() {
  const args = process.argv.slice(2)
  const parsed: Record<string, string> = {}

  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].substring(2)
      const value = args[i + 1]
      if (value && !value.startsWith('--')) {
        parsed[key] = value
        i++
      }
    }
  }

  return parsed
}

// ===== DEFAULT OUTCOMES =====

const DEFAULT_OUTCOMES = [
  'Accelerate deal registration cycles by 60% through automated opportunity discovery',
  'Increase co-sell attachment rates by 40% with AI-powered opportunity matching',
  'Reduce partner operations overhead by 50% via intelligent workflow automation'
]

// ===== PDF GENERATION =====

async function generateOnePager(options: {
  partner: string
  wedge: string
  outcomes?: string[]
}) {
  const { partner, wedge, outcomes = DEFAULT_OUTCOMES } = options

  // Get partner config
  const partnerConfig = PARTNERS[partner.toLowerCase()]
  if (!partnerConfig) {
    throw new Error(`Partner "${partner}" not found in config`)
  }

  // Create output directory
  const outDir = path.join(process.cwd(), 'out')
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true })
  }

  // Generate filename
  const filename = `${partner.toLowerCase()}_${wedge.toLowerCase().replace(/\s+/g, '_')}.pdf`
  const filepath = path.join(outDir, filename)

  // Create PDF document
  const doc = new PDFDocument({
    size: 'LETTER',
    margins: {
      top: 50,
      bottom: 50,
      left: 50,
      right: 50
    }
  })

  // Pipe to file
  const stream = fs.createWriteStream(filepath)
  doc.pipe(stream)

  // ===== HEADER =====
  doc
    .fontSize(28)
    .font('Helvetica-Bold')
    .fillColor('#000000')
    .text('Wells Onyx', 50, 50)

  doc
    .fontSize(10)
    .font('Helvetica')
    .fillColor('#666666')
    .text('Partner Ecosystem Automation', 50, 85)

  // Horizontal line
  doc
    .strokeColor('#E5E5E5')
    .lineWidth(1)
    .moveTo(50, 110)
    .lineTo(562, 110)
    .stroke()

  // ===== PARTNER INFO =====
  doc
    .fontSize(20)
    .font('Helvetica-Bold')
    .fillColor('#000000')
    .text(partnerConfig.displayName, 50, 130)

  doc
    .fontSize(14)
    .font('Helvetica')
    .fillColor('#666666')
    .text(partnerConfig.category, 50, 160)

  // ===== WEDGE STRATEGY =====
  doc
    .fontSize(12)
    .font('Helvetica-Bold')
    .fillColor('#000000')
    .text('WEDGE STRATEGY', 50, 200)

  doc
    .fontSize(24)
    .font('Helvetica-Bold')
    .fillColor(partnerConfig.brandColor || '#0066CC')
    .text(wedge, 50, 220)

  doc
    .fontSize(11)
    .font('Helvetica')
    .fillColor('#333333')
    .text(
      `Focused automation strategy targeting ${wedge} workflows within the ${partnerConfig.name} ecosystem.`,
      50,
      260,
      { width: 500, align: 'left' }
    )

  // ===== OUTCOMES SECTION =====
  doc
    .fontSize(12)
    .font('Helvetica-Bold')
    .fillColor('#000000')
    .text('KEY OUTCOMES', 50, 320)

  let yPos = 345
  outcomes.slice(0, 3).forEach((outcome, idx) => {
    // Outcome number circle
    doc
      .circle(58, yPos + 8, 12)
      .fillColor(partnerConfig.brandColor || '#0066CC')
      .fill()

    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .fillColor('#FFFFFF')
      .text(`${idx + 1}`, 54, yPos + 4)

    // Outcome text
    doc
      .fontSize(11)
      .font('Helvetica')
      .fillColor('#333333')
      .text(outcome, 85, yPos, { width: 470, align: 'left', lineGap: 4 })

    yPos += 70
  })

  // ===== CAPABILITIES SECTION =====
  const capabilities = []
  if (partnerConfig.capabilities.discover) capabilities.push('Opportunity Discovery')
  if (partnerConfig.capabilities.dealReg) capabilities.push('Deal Registration')
  if (partnerConfig.capabilities.coSell) capabilities.push('Co-Sell Automation')

  doc
    .fontSize(12)
    .font('Helvetica-Bold')
    .fillColor('#000000')
    .text('CAPABILITIES', 50, yPos + 20)

  doc
    .fontSize(11)
    .font('Helvetica')
    .fillColor('#666666')
    .text(capabilities.join(' • '), 50, yPos + 45)

  // ===== INTEGRATION INFO =====
  doc
    .fontSize(10)
    .font('Helvetica')
    .fillColor('#999999')
    .text(
      `Authentication: ${partnerConfig.authType === 'oauth2' ? 'OAuth 2.0' : partnerConfig.authType === 'api_key' ? 'API Key' : 'Standard'}`,
      50,
      yPos + 75
    )

  doc
    .fontSize(10)
    .font('Helvetica')
    .fillColor('#999999')
    .text(
      `Integration Status: ${partnerConfig.status === 'active' ? 'Production Ready' : partnerConfig.status === 'beta' ? 'Beta' : 'In Development'}`,
      50,
      yPos + 92
    )

  // ===== FOOTER =====
  doc
    .fontSize(8)
    .font('Helvetica')
    .fillColor('#CCCCCC')
    .text(
      'Wells Onyx • Partner Ecosystem Automation Platform',
      50,
      750,
      { width: 500, align: 'center' }
    )

  doc
    .fontSize(8)
    .font('Helvetica')
    .fillColor('#CCCCCC')
    .text(
      'Generated: ' + new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      50,
      765,
      { width: 500, align: 'center' }
    )

  // Finalize PDF
  doc.end()

  // Wait for stream to finish
  await new Promise<void>((resolve, reject) => {
    stream.on('finish', () => resolve())
    stream.on('error', reject)
  })

  return filepath
}

// ===== MAIN =====

async function main() {
  console.log('🎨 Wells Onyx One-Pager Generator\n')

  // Parse arguments
  const args = parseArgs()

  if (!args.partner) {
    console.error('❌ Error: --partner is required')
    console.log('\nUsage:')
    console.log('  pnpm gen:onepager --partner ibm --wedge "Customer Ops"')
    console.log('\nAvailable partners:')
    Object.keys(PARTNERS).forEach(p => {
      console.log(`  - ${p}`)
    })
    process.exit(1)
  }

  if (!args.wedge) {
    console.error('❌ Error: --wedge is required')
    console.log('\nUsage:')
    console.log('  pnpm gen:onepager --partner ibm --wedge "Customer Ops"')
    process.exit(1)
  }

  console.log(`📋 Partner: ${args.partner}`)
  console.log(`🎯 Wedge: ${args.wedge}`)
  console.log(`📝 Outcomes: ${DEFAULT_OUTCOMES.length} (default)\n`)

  try {
    const filepath = await generateOnePager({
      partner: args.partner,
      wedge: args.wedge
    })

    console.log('✅ PDF generated successfully!')
    console.log(`📄 File: ${filepath}`)
    console.log(`📦 Size: ${(fs.statSync(filepath).size / 1024).toFixed(2)} KB\n`)
  } catch (error: any) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

// Run
main().catch(console.error)
