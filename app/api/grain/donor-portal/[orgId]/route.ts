/**
 * PUBLIC DONOR PORTAL API
 *
 * GET /api/grain/donor-portal/[orgId]
 *
 * Public endpoint - NO AUTH REQUIRED
 * Returns transparency data for a donor portal:
 * - Organization information
 * - Endowment summary
 * - Fund list with balances
 * - Recent grants
 * - Impact metrics
 * - Donor recognition (respecting privacy settings)
 *
 * All data is filtered through transparency settings
 * to ensure only permitted information is shared.
 */

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import {
  DonorPortal,
  DonorPortalOrg,
  DonorPortalEndowment,
  DonorPortalFund,
  DonorPortalGrant,
  DonorRecognition,
  TransparencySettings,
  ImpactMetrics,
  mockDonorPortalData,
} from '@/lib/grain/donor-portal'

// Public endpoint - no auth
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params

    // Track view for analytics
    const viewerIp = request.headers.get('x-forwarded-for') || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // In production, fetch from database
    // For now, check if orgId matches mock data or return mock
    let org: DonorPortalOrg | null = null
    let endowment: DonorPortalEndowment | null = null
    let funds: DonorPortalFund[] = []
    let grants: DonorPortalGrant[] = []
    let topDonors: DonorRecognition[] = []
    let settings: TransparencySettings | null = null

    // Try database first
    try {
      const orgResult = await query(`
        SELECT
          id, name, slug, mission, description,
          logo_url, banner_url, website,
          contact_email, contact_phone, address,
          ein, verified, verified_at,
          social_twitter, social_linkedin, social_facebook, social_instagram,
          brand_primary, brand_secondary, brand_accent,
          created_at, updated_at
        FROM donor_portal_orgs
        WHERE id = $1 OR slug = $1
        LIMIT 1
      `, [orgId])

      if (orgResult.rows.length > 0) {
        const row = orgResult.rows[0]
        org = {
          id: row.id,
          name: row.name,
          slug: row.slug,
          mission: row.mission,
          description: row.description,
          logoUrl: row.logo_url,
          bannerUrl: row.banner_url,
          website: row.website,
          contactEmail: row.contact_email,
          contactPhone: row.contact_phone,
          address: row.address,
          ein: row.ein,
          verified: row.verified,
          verifiedAt: row.verified_at,
          socialLinks: {
            twitter: row.social_twitter,
            linkedin: row.social_linkedin,
            facebook: row.social_facebook,
            instagram: row.social_instagram,
          },
          brandColors: {
            primary: row.brand_primary || '#10B981',
            secondary: row.brand_secondary || '#064E3B',
            accent: row.brand_accent || '#F59E0B',
          },
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }

        // Fetch endowment
        const endowmentResult = await query(`
          SELECT
            id, org_id, name, description,
            total_value, total_deposits, total_grants, protected_principal,
            grain_balance, grain_price, grain_value_usd,
            vault_coverage, liquidity_coverage,
            appreciation_to_date, appreciation_percent,
            status, created_at, updated_at
          FROM donor_portal_endowments
          WHERE org_id = $1
          LIMIT 1
        `, [org.id])

        if (endowmentResult.rows.length > 0) {
          const e = endowmentResult.rows[0]
          endowment = {
            id: e.id,
            orgId: e.org_id,
            name: e.name,
            description: e.description,
            totalValue: parseFloat(e.total_value),
            totalDeposits: parseFloat(e.total_deposits),
            totalGrants: parseFloat(e.total_grants),
            protectedPrincipal: parseFloat(e.protected_principal),
            grainBalance: parseFloat(e.grain_balance),
            grainPrice: parseFloat(e.grain_price),
            grainValueUsd: parseFloat(e.grain_value_usd),
            vaultCoverage: parseFloat(e.vault_coverage),
            liquidityCoverage: parseFloat(e.liquidity_coverage),
            appreciationToDate: parseFloat(e.appreciation_to_date),
            appreciationPercent: parseFloat(e.appreciation_percent),
            status: e.status,
            createdAt: e.created_at,
            updatedAt: e.updated_at,
          }
        }

        // Fetch funds
        const fundsResult = await query(`
          SELECT
            id, org_id, endowment_id, name, description,
            purpose, restrictions, designated_use,
            current_balance, total_donations, total_grants_made,
            donor_count, grants_count,
            status, target_amount,
            created_at, updated_at
          FROM donor_portal_funds
          WHERE org_id = $1
          ORDER BY created_at DESC
        `, [org.id])

        funds = fundsResult.rows.map(f => ({
          id: f.id,
          orgId: f.org_id,
          endowmentId: f.endowment_id,
          name: f.name,
          description: f.description,
          purpose: f.purpose,
          restrictions: f.restrictions,
          designatedUse: f.designated_use,
          currentBalance: parseFloat(f.current_balance),
          totalDonations: parseFloat(f.total_donations),
          totalGrantsMade: parseFloat(f.total_grants_made),
          donorCount: parseInt(f.donor_count),
          grantsCount: parseInt(f.grants_count),
          status: f.status,
          targetAmount: f.target_amount ? parseFloat(f.target_amount) : undefined,
          createdAt: f.created_at,
          updatedAt: f.updated_at,
        }))

        // Fetch grants
        const grantsResult = await query(`
          SELECT
            id, org_id, fund_id,
            recipient_name, recipient_description,
            amount, currency, purpose, category,
            impact_description, impact_metrics,
            status, disbursed_at, completed_at,
            created_at
          FROM donor_portal_grants
          WHERE org_id = $1
          ORDER BY created_at DESC
          LIMIT 20
        `, [org.id])

        grants = grantsResult.rows.map(g => ({
          id: g.id,
          orgId: g.org_id,
          fundId: g.fund_id,
          recipientName: g.recipient_name,
          recipientDescription: g.recipient_description,
          amount: parseFloat(g.amount),
          currency: g.currency,
          purpose: g.purpose,
          category: g.category,
          impactDescription: g.impact_description,
          impactMetrics: g.impact_metrics,
          status: g.status,
          disbursedAt: g.disbursed_at,
          completedAt: g.completed_at,
          createdAt: g.created_at,
        }))

        // Fetch transparency settings
        const settingsResult = await query(`
          SELECT *
          FROM donor_portal_settings
          WHERE org_id = $1
          LIMIT 1
        `, [org.id])

        if (settingsResult.rows.length > 0) {
          const s = settingsResult.rows[0]
          settings = {
            orgId: s.org_id,
            showEndowmentValue: s.show_endowment_value,
            showFundBalances: s.show_fund_balances,
            showGrantAmounts: s.show_grant_amounts,
            showDonorNames: s.show_donor_names,
            showImpactMetrics: s.show_impact_metrics,
            showFinancialBreakdown: s.show_financial_breakdown,
            showGrainPrice: s.show_grain_price,
            showAppreciation: s.show_appreciation,
            showProtectionRatio: s.show_protection_ratio,
            customFooterMessage: s.custom_footer_message,
            customCtaText: s.custom_cta_text,
            customCtaUrl: s.custom_cta_url,
            useCustomBranding: s.use_custom_branding,
            hideGrainVaultBranding: s.hide_grain_vault_branding,
            portalEnabled: s.portal_enabled,
            portalPassword: s.portal_password,
            updatedAt: s.updated_at,
          }
        }

        // Fetch donors (respecting privacy)
        if (settings?.showDonorNames) {
          const donorsResult = await query(`
            SELECT
              id, display_name, amount, message,
              is_anonymous, donated_at, tier
            FROM donor_portal_donors
            WHERE org_id = $1 AND is_anonymous = false
            ORDER BY amount DESC
            LIMIT 10
          `, [org.id])

          topDonors = donorsResult.rows.map(d => ({
            id: d.id,
            displayName: d.display_name,
            amount: parseFloat(d.amount),
            message: d.message,
            isAnonymous: d.is_anonymous,
            donatedAt: d.donated_at,
            tier: d.tier,
          }))
        }

        // Record view
        await query(`
          INSERT INTO donor_portal_views (org_id, ip_hash, user_agent, viewed_at)
          VALUES ($1, md5($2), $3, NOW())
          ON CONFLICT DO NOTHING
        `, [org.id, viewerIp, userAgent.substring(0, 500)]).catch(() => {
          // Ignore view tracking errors
        })
      }
    } catch (dbError) {
      console.log('[Donor Portal API] Database not available, using mock data')
    }

    // Fall back to mock data if no database results
    if (!org) {
      // Check if the orgId matches our mock data
      if (orgId === 'education-first' || orgId === 'org_001') {
        org = mockDonorPortalData.org
        endowment = mockDonorPortalData.endowment
        funds = mockDonorPortalData.funds
        grants = mockDonorPortalData.grants
        topDonors = mockDonorPortalData.topDonors
        settings = DonorPortal.getDefaultSettings(org.id)
      } else {
        // Return 404 for unknown org
        return NextResponse.json(
          {
            success: false,
            error: 'Organization not found',
            message: 'The transparency portal you are looking for does not exist.',
          },
          { status: 404 }
        )
      }
    }

    // Check if portal is enabled
    if (settings && !settings.portalEnabled) {
      return NextResponse.json(
        {
          success: false,
          error: 'Portal disabled',
          message: 'This transparency portal has been disabled by the organization.',
        },
        { status: 403 }
      )
    }

    // Calculate impact metrics
    const donations = topDonors.map(d => ({
      amount: d.amount,
      donorId: d.id,
      date: d.donatedAt,
    }))
    const impactMetrics = DonorPortal.calculateImpactMetrics(
      endowment ? [endowment] : [],
      funds,
      grants,
      donations
    )

    // Apply privacy filters if settings exist
    const filteredSettings = settings || DonorPortal.getDefaultSettings(org.id)

    // Filter data based on settings
    const filteredEndowment = endowment
      ? DonorPortal.applyPrivacyFilter(endowment, filteredSettings, 'endowment')
      : null

    const filteredFunds = funds.map(fund =>
      DonorPortal.applyPrivacyFilter(fund, filteredSettings, 'fund') as DonorPortalFund
    )

    const filteredGrants = grants.map(grant =>
      DonorPortal.applyPrivacyFilter(grant, filteredSettings, 'grant') as DonorPortalGrant
    )

    const filteredDonors = topDonors.map(donor =>
      DonorPortal.applyPrivacyFilter(donor, filteredSettings, 'donor') as DonorRecognition
    )

    // Generate protection explanation
    const protectionExplanation = endowment
      ? DonorPortal.generateProtectionExplanation(endowment)
      : null

    // Generate fund usage breakdown
    const fundUsageBreakdown = DonorPortal.generateFundUsageBreakdown(grants)

    // Build shareable links
    const portalLink = DonorPortal.generateOrgPortalLink(org)
    const embedCode = DonorPortal.generateEmbedCode(portalLink)

    return NextResponse.json({
      success: true,

      // Organization
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        mission: org.mission,
        description: org.description,
        logoUrl: org.logoUrl,
        bannerUrl: org.bannerUrl,
        website: org.website,
        verified: org.verified,
        verifiedAt: org.verifiedAt,
        socialLinks: org.socialLinks,
        brandColors: org.brandColors,
      },

      // Endowment (filtered)
      endowment: filteredEndowment,

      // Funds (filtered)
      funds: filteredFunds,

      // Grants (filtered)
      grants: filteredGrants,

      // Top Donors (filtered)
      topDonors: filteredDonors,

      // Impact Metrics
      impactMetrics: filteredSettings.showImpactMetrics ? impactMetrics : null,

      // Protection Info
      protection: protectionExplanation,

      // Fund Usage
      fundUsage: fundUsageBreakdown,

      // Sharing
      sharing: {
        portalUrl: portalLink.fullUrl,
        shortUrl: portalLink.shortUrl,
        embedCode: embedCode,
      },

      // Settings (public portion only)
      settings: {
        useCustomBranding: filteredSettings.useCustomBranding,
        customFooterMessage: filteredSettings.customFooterMessage,
        customCtaText: filteredSettings.customCtaText,
        customCtaUrl: filteredSettings.customCtaUrl,
        hideGrainVaultBranding: filteredSettings.hideGrainVaultBranding,
      },

      // Meta
      meta: {
        generatedAt: new Date().toISOString(),
        poweredBy: 'Grain & Vault',
      },
    })
  } catch (error: any) {
    console.error('[Donor Portal API] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch donor portal data',
        message: 'An unexpected error occurred. Please try again later.',
      },
      { status: 500 }
    )
  }
}

/**
 * Get specific fund data
 * GET /api/grain/donor-portal/[orgId]?fund=fundId
 */
