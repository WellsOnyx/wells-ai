import { NextRequest, NextResponse } from 'next/server'
import { monitorAPI } from '@/lib/monitoring'
import {
  sendDiscordMessage,
  formatRFQEmbed,
  formatQuoteEmbed,
  formatDealEmbed,
  formatHelpEmbed,
} from '@/lib/discord'
import { RFQs } from '@/lib/db'
import { matchSuppliers } from '@/lib/matching'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

/**
 * Discord Interactions Handler
 * POST /api/discord/interactions
 *
 * Handles Discord slash commands and button interactions
 */
export async function POST(req: NextRequest) {
  const monitor = monitorAPI('/api/discord/interactions', 'POST')

  try {
    const interaction = await req.json()

    console.log('[DISCORD] Interaction received:', interaction.type, interaction)

    // Verify Discord signature (in production)
    // const signature = req.headers.get('x-signature-ed25519')
    // const timestamp = req.headers.get('x-signature-timestamp')
    // if (!verifyDiscordSignature(signature, timestamp, body)) {
    //   return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    // }

    // Handle interaction types
    let response

    switch (interaction.type) {
      case 1: // PING
        response = { type: 1 }
        break

      case 2: // APPLICATION_COMMAND (slash command)
        response = await handleSlashCommand(interaction)
        break

      case 3: // MESSAGE_COMPONENT (button click)
        response = await handleButtonClick(interaction)
        break

      default:
        response = { type: 4, data: { content: 'Unknown interaction type' } }
    }

    monitor.end(true)
    return NextResponse.json(response)
  } catch (error) {
    monitor.end(false)
    console.error('[DISCORD] Interaction error:', error)

    return NextResponse.json({
      type: 4,
      data: {
        content: '❌ Something went wrong. Please try again.',
        flags: 64, // Ephemeral
      },
    })
  }
}

/**
 * Handle slash commands
 */
async function handleSlashCommand(interaction: any) {
  const commandName = interaction.data.name
  const options = interaction.data.options || []

  console.log('[DISCORD] Slash command:', commandName, options)

  switch (commandName) {
    case 'rfq':
      return await handleCreateRFQ(interaction, options)

    case 'find':
      return await handleFindSuppliers(interaction, options)

    case 'negotiate':
      return await handleNegotiate(interaction, options)

    case 'deals':
      return await handleViewDeals(interaction)

    case 'help':
      return await handleHelp(interaction)

    default:
      return {
        type: 4,
        data: {
          content: `Unknown command: /${commandName}`,
          flags: 64,
        },
      }
  }
}

/**
 * Handle button clicks
 */
async function handleButtonClick(interaction: any) {
  const customId = interaction.data.custom_id

  console.log('[DISCORD] Button clicked:', customId)

  // Parse button action
  const [action, ...params] = customId.split(':')

  switch (action) {
    case 'view_rfq':
      return {
        type: 4,
        data: {
          content: `View RFQ: ${process.env.NEXT_PUBLIC_BASE_URL}/rfqs/${params[0]}`,
          flags: 64,
        },
      }

    case 'find_suppliers':
      return {
        type: 4,
        data: {
          content: `🔍 Finding suppliers for RFQ ${params[0]}...`,
        },
      }

    case 'accept_quote':
      return {
        type: 4,
        data: {
          content: `✅ Accepting quote ${params[0]}...\n\nCreating deal and generating contract.`,
        },
      }

    default:
      return {
        type: 4,
        data: {
          content: 'Action not implemented yet.',
          flags: 64,
        },
      }
  }
}

// Command handlers

async function handleCreateRFQ(interaction: any, options: any[]) {
  const description = options.find((o) => o.name === 'description')?.value

  if (!description) {
    return {
      type: 4,
      data: {
        content: '❌ Please provide an RFQ description.',
        flags: 64,
      },
    }
  }

  try {
    // Simple parsing (avoid Claude API TypeScript issues)
    const parsed = {
      description,
      quantity: undefined,
      budget: undefined,
      deadline: undefined,
    }

    // Create RFQ
    const rfq = await RFQs.create({
      buyerEmail: `discord_${interaction.member.user.id}@wellsai.com`,
      productName: parsed.description?.split(',')[0] || 'Unnamed Product',
      description: parsed.description || description,
      quantity: parsed.quantity,
      budget: parsed.budget,
      deadline: parsed.deadline,
      status: 'pending',
      source: 'discord',
      metadata: {
        discordUserId: interaction.member.user.id,
        discordUsername: interaction.member.user.username,
        discordChannelId: interaction.channel_id,
        discordGuildId: interaction.guild_id,
      },
    })

    return {
      type: 4,
      data: {
        content: `✅ RFQ created: ${rfq.productName}`,
        embeds: [formatRFQEmbed(rfq)],
      },
    }
  } catch (error) {
    console.error('[DISCORD] Create RFQ error:', error)
    return {
      type: 4,
      data: {
        content: '❌ Failed to create RFQ. Please try again.',
        flags: 64,
      },
    }
  }
}

async function handleFindSuppliers(interaction: any, options: any[]) {
  const query = options.find((o) => o.name === 'query')?.value

  if (!query) {
    return {
      type: 4,
      data: {
        content: '❌ Please provide a search query.',
        flags: 64,
      },
    }
  }

  try {
    const matches = await matchSuppliers({
      productName: query,
      description: query,
    })

    if (matches.length === 0) {
      return {
        type: 4,
        data: {
          content: `❌ No suppliers found for: "${query}"`,
          flags: 64,
        },
      }
    }

    const supplierList = matches
      .slice(0, 5)
      .map(
        (match, i) =>
          `${i + 1}. **${match.supplier.name}** (${match.score}/100 match)\n   ${match.supplier.industry || 'N/A'} | ${match.supplier.location || 'N/A'}`
      )
      .join('\n\n')

    return {
      type: 4,
      data: {
        content: `🔍 Found ${matches.length} suppliers:\n\n${supplierList}`,
      },
    }
  } catch (error) {
    console.error('[DISCORD] Find suppliers error:', error)
    return {
      type: 4,
      data: {
        content: '❌ Failed to search suppliers.',
        flags: 64,
      },
    }
  }
}

async function handleNegotiate(interaction: any, options: any[]) {
  return {
    type: 4,
    data: {
      content: `🤝 **Real-time Negotiation**\n\nVisit: ${process.env.NEXT_PUBLIC_BASE_URL}/negotiate\n\n_Direct Discord negotiation coming soon._`,
      flags: 64,
    },
  }
}

async function handleViewDeals(interaction: any) {
  return {
    type: 4,
    data: {
      content: `📦 **Your Deals**\n\nView at: ${process.env.NEXT_PUBLIC_BASE_URL}/deals`,
      flags: 64,
    },
  }
}

async function handleHelp(interaction: any) {
  return {
    type: 4,
    data: {
      embeds: [formatHelpEmbed()],
      flags: 64,
    },
  }
}
