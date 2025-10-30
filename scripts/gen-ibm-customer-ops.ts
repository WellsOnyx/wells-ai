/**
 * IBM Customer Ops Co-Sell One-Pager Generator
 * Creates professional PDF for IBM partner outreach
 */

import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'

// ===== CONTENT =====

const CONTENT = {
  title: 'IBM + Wells Onyx — Customer Ops Co-Sell (90-Day Pilot)',
  subtitle: 'Pair IBM watsonx Assistant + Wells Onyx delivery to lift CX throughput in one quarter.',

  outcomes: [
    '20–40% faster case resolution via AI-assisted workflows',
    '15–25% reduction in average handle time (AHT)',
    'Deflection of common tickets with assistant + knowledge mining',
    'Clean handoffs to human agents; no disruption to existing stack',
    'Measurable ROI inside 90 days (shared scorecard)'
  ],

  whatWeBring: [
    'IBM-aligned playbook: discovery → 6-week sprint → 90-day pilot',
    'Human-in-the-loop automations mapped to your client\'s SOPs',
    'Consent-first, auditable actions; your ERP/CRM remains system-of-record'
  ],

  whatWeAsk: [
    'A quick strategy huddle with your Partner/Alliances lead',
    'Guidance on your preferred co-sell + deal-reg motion',
    '1–2 named accounts to prove value (we\'ll bring candidates too)'
  ],

  pilotGuardrails: [
    'No rip-and-replace; start in "assist" mode',
    'Weekly ROI snapshots; stop/continue gates at day 30/60/90',
    'Commercials align to your co-sell rules'
  ],

  contacts: [
    { name: 'Cath Garcia', title: 'Partners, Wells Onyx', role: 'Primary' },
    { name: 'Jonah Manning', title: 'CEO, Wells Onyx', role: 'Exec Sponsor' }
  ]
}

// ===== COLORS =====

const COLORS = {
  ibmBlue: '#0062FF',
  black: '#000000',
  darkGray: '#333333',
  mediumGray: '#666666',
  lightGray: '#999999',
  veryLightGray: '#E5E5E5'
}

// ===== PDF GENERATION =====

async function generatePDF() {
  console.log('🎨 Generating IBM Customer Ops One-Pager...\n')

  // Create output directory
  const outDir = path.join(process.cwd(), 'out')
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true })
  }

  const filename = 'ibm_customer_ops_co-sell_90day-pilot.pdf'
  const filepath = path.join(outDir, filename)

  // Create PDF
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
    .fontSize(10)
    .font('Helvetica')
    .fillColor(COLORS.mediumGray)
    .text('Wells Onyx × IBM PartnerWorld', 50, 50)

  // Horizontal line
  doc
    .strokeColor(COLORS.veryLightGray)
    .lineWidth(1)
    .moveTo(50, 70)
    .lineTo(562, 70)
    .stroke()

  // ===== TITLE =====

  doc
    .fontSize(24)
    .font('Helvetica-Bold')
    .fillColor(COLORS.black)
    .text(CONTENT.title, 50, 90, { width: 512, lineGap: 6 })

  // ===== SUBTITLE =====

  doc
    .fontSize(12)
    .font('Helvetica')
    .fillColor(COLORS.darkGray)
    .text(CONTENT.subtitle, 50, 145, { width: 512, lineGap: 4 })

  // ===== OUTCOMES SECTION =====

  let yPos = 185

  doc
    .fontSize(11)
    .font('Helvetica-Bold')
    .fillColor(COLORS.black)
    .text('OUTCOMES (pick 3)', 50, yPos)

  yPos += 20

  // First 3 outcomes (default selection)
  CONTENT.outcomes.slice(0, 3).forEach((outcome, idx) => {
    // Bullet point
    doc
      .circle(58, yPos + 6, 3)
      .fillColor(COLORS.ibmBlue)
      .fill()

    // Outcome text
    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor(COLORS.darkGray)
      .text(outcome, 75, yPos, { width: 487, lineGap: 3 })

    yPos += 30
  })

  yPos += 10

  // ===== WHAT WE BRING =====

  doc
    .fontSize(11)
    .font('Helvetica-Bold')
    .fillColor(COLORS.black)
    .text('What we bring', 50, yPos)

  yPos += 20

  CONTENT.whatWeBring.forEach((item) => {
    // Bullet
    doc
      .circle(58, yPos + 6, 3)
      .fillColor(COLORS.ibmBlue)
      .fill()

    // Text
    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor(COLORS.darkGray)
      .text(item, 75, yPos, { width: 487, lineGap: 3 })

    yPos += 30
  })

  yPos += 10

  // ===== WHAT WE ASK =====

  doc
    .fontSize(11)
    .font('Helvetica-Bold')
    .fillColor(COLORS.black)
    .text('What we ask', 50, yPos)

  yPos += 20

  CONTENT.whatWeAsk.forEach((item) => {
    // Bullet
    doc
      .circle(58, yPos + 6, 3)
      .fillColor(COLORS.ibmBlue)
      .fill()

    // Text
    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor(COLORS.darkGray)
      .text(item, 75, yPos, { width: 487, lineGap: 3 })

    yPos += 30
  })

  yPos += 10

  // ===== PILOT GUARDRAILS =====

  doc
    .fontSize(11)
    .font('Helvetica-Bold')
    .fillColor(COLORS.black)
    .text('Pilot guardrails', 50, yPos)

  yPos += 20

  CONTENT.pilotGuardrails.forEach((item) => {
    // Bullet
    doc
      .circle(58, yPos + 6, 3)
      .fillColor(COLORS.ibmBlue)
      .fill()

    // Text
    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor(COLORS.darkGray)
      .text(item, 75, yPos, { width: 487, lineGap: 3 })

    yPos += 30
  })

  yPos += 20

  // ===== CONTACTS =====

  doc
    .fontSize(11)
    .font('Helvetica-Bold')
    .fillColor(COLORS.black)
    .text('Contacts', 50, yPos)

  yPos += 20

  CONTENT.contacts.forEach((contact) => {
    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .fillColor(COLORS.darkGray)
      .text(`${contact.role}: ${contact.name}`, 50, yPos)

    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor(COLORS.mediumGray)
      .text(contact.title, 50, yPos + 14)

    yPos += 35
  })

  // ===== FOOTER =====

  doc
    .strokeColor(COLORS.veryLightGray)
    .lineWidth(1)
    .moveTo(50, 730)
    .lineTo(562, 730)
    .stroke()

  doc
    .fontSize(8)
    .font('Helvetica')
    .fillColor(COLORS.lightGray)
    .text(
      'Wells Onyx • Partner Ecosystem Automation Platform',
      50,
      745,
      { width: 512, align: 'center' }
    )

  doc
    .fontSize(8)
    .font('Helvetica')
    .fillColor(COLORS.lightGray)
    .text(
      `Generated: ${new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })}`,
      50,
      760,
      { width: 512, align: 'center' }
    )

  // Finalize
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
  try {
    const filepath = await generatePDF()

    console.log('✅ PDF generated successfully!')
    console.log(`📄 File: ${filepath}`)
    console.log(`📦 Size: ${(fs.statSync(filepath).size / 1024).toFixed(2)} KB\n`)

    console.log('Ready to attach to partner outreach emails! 🚀')
  } catch (error: any) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

main().catch(console.error)
