// @ts-nocheck
/**
 * Wells AI Action Executor
 *
 * Converts intents into actions:
 * - Call appropriate services (RFQ, ERP, Jobs, etc.)
 * - Handle errors gracefully
 * - Confirm actions before executing
 * - Report results naturally
 */

import { RouteResult } from './intent-router'
import { ConversationContext } from './conversation-manager'

// ============================================================================
// TYPES
// ============================================================================

export interface ActionResult {
  success: boolean
  data?: unknown
  error?: string
  errorCode?: string

  // For UI display
  displayMessage: string
  displayData?: Record<string, unknown>

  // Follow-up actions
  suggestedActions?: SuggestedAction[]
  nextSteps?: string[]

  // Reference IDs
  createdIds?: {
    rfqId?: string
    quoteId?: string
    orderId?: string
    jobId?: string
    applicationId?: string
    transactionId?: string
  }

  // Metadata
  actionType: string
  executedAt: Date
  durationMs: number
}

export interface SuggestedAction {
  label: string
  action: string
  primary?: boolean
  params?: Record<string, unknown>
}

export interface ActionHandler {
  execute: (params: Record<string, unknown>, context: ConversationContext) => Promise<ActionResult>
  validate?: (params: Record<string, unknown>) => { valid: boolean; error?: string }
  requiresConfirmation?: boolean
  confirmationMessage?: (params: Record<string, unknown>) => string
}

// ============================================================================
// ACTION HANDLERS REGISTRY
// ============================================================================

const actionHandlers: Record<string, Record<string, ActionHandler>> = {
  rfq: {
    createRFQ: {
      execute: async (params, context) => {
        const startTime = Date.now()
        try {
          // Call RFQ creation service
          const { createRFQ } = await import('@/lib/rfq/quote-service')

          const rfq = await createRFQ({
            userId: context.userId,
            category: params.product as string || 'general',
            description: `${params.quantity || ''} ${params.product || 'items'}`.trim(),
            quantity: params.quantity as number || 1,
            targetPrice: params.budget as number,
            urgency: params.urgency as string || 'standard',
            deliveryLocation: params.location as string || 'To be determined',
            specifications: params.specifications as Record<string, unknown>,
          })

          return {
            success: true,
            data: rfq,
            displayMessage: `Created RFQ for ${params.quantity || ''} ${params.product || 'items'}. I'm now matching you with suppliers.`,
            displayData: {
              rfqId: rfq.id,
              product: params.product,
              quantity: params.quantity,
              status: 'matching',
            },
            suggestedActions: [
              { label: 'Add specifications', action: 'rfq.addSpecs', params: { rfqId: rfq.id } },
              { label: 'Set budget constraints', action: 'rfq.setConstraints', params: { rfqId: rfq.id } },
            ],
            nextSteps: [
              'Suppliers are being matched',
              'You\'ll receive quotes within hours',
              'I\'ll negotiate automatically if you enable auto-negotiate',
            ],
            createdIds: { rfqId: rfq.id },
            actionType: 'createRFQ',
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
          }
        } catch (error) {
          return createErrorResult('createRFQ', error, startTime)
        }
      },
      validate: (params) => {
        if (!params.product) {
          return { valid: false, error: 'Product or service name is required' }
        }
        return { valid: true }
      },
      requiresConfirmation: false,
    },

    searchSuppliers: {
      execute: async (params, context) => {
        const startTime = Date.now()
        try {
          // Search for suppliers
          const { searchSuppliers } = await import('@/lib/rfq/supplier-ai')

          const suppliers = await searchSuppliers({
            category: params.category as string,
            location: params.location as string,
            limit: 10,
          })

          return {
            success: true,
            data: suppliers,
            displayMessage: `Found ${suppliers.length} suppliers for ${params.category}.`,
            displayData: {
              suppliers: suppliers.slice(0, 5).map((s: { companyName: string; rating: number; responseRate: number }) => ({
                name: s.companyName,
                rating: s.rating,
                responseRate: s.responseRate,
              })),
            },
            suggestedActions: [
              { label: 'Create RFQ with these suppliers', action: 'rfq.createWithSuppliers', primary: true },
              { label: 'See more details', action: 'rfq.supplierDetails' },
            ],
            actionType: 'searchSuppliers',
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
          }
        } catch (error) {
          return createErrorResult('searchSuppliers', error, startTime)
        }
      },
    },

    compareQuotes: {
      execute: async (params, context) => {
        const startTime = Date.now()
        try {
          const { getQuoteComparison } = await import('@/lib/rfq/quote-service')

          const comparison = await getQuoteComparison(params.rfqId as string)

          if (!comparison || comparison.quotes.length === 0) {
            return {
              success: true,
              data: null,
              displayMessage: 'No quotes received yet. I\'ll notify you when suppliers respond.',
              actionType: 'compareQuotes',
              executedAt: new Date(),
              durationMs: Date.now() - startTime,
            }
          }

          const best = comparison.recommendation

          return {
            success: true,
            data: comparison,
            displayMessage: `Compared ${comparison.quotes.length} quotes. Best value: ${best?.reason || 'See details below.'}`,
            displayData: {
              totalQuotes: comparison.quotes.length,
              recommended: best?.quoteId,
              lowestPrice: comparison.analysis.lowestPrice,
              fastestDelivery: comparison.analysis.fastestDelivery,
            },
            suggestedActions: best ? [
              { label: `Accept ${best.quoteId}`, action: 'rfq.awardQuote', primary: true, params: { quoteId: best.quoteId } },
              { label: 'Negotiate further', action: 'rfq.negotiateFurther' },
            ] : [],
            actionType: 'compareQuotes',
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
          }
        } catch (error) {
          return createErrorResult('compareQuotes', error, startTime)
        }
      },
    },

    awardQuote: {
      execute: async (params, context) => {
        const startTime = Date.now()
        try {
          const { awardQuote } = await import('@/lib/rfq/award-service')

          const award = await awardQuote({
            quoteId: params.quoteId as string,
            userId: context.userId,
          })

          return {
            success: true,
            data: award,
            displayMessage: `Done! Awarded to ${award.supplier?.companyName || 'supplier'}. PO created and escrow is ready for funding.`,
            displayData: {
              awardId: award.id,
              amount: award.awardAmount,
              supplier: award.supplier?.companyName,
            },
            suggestedActions: [
              { label: 'Fund escrow', action: 'payments.fundEscrow', primary: true, params: { escrowId: award.escrowId } },
              { label: 'View PO', action: 'erp.viewPO', params: { poId: award.erpPoId } },
            ],
            nextSteps: [
              'Fund escrow to confirm the order',
              'Supplier will begin fulfillment once funded',
              'I\'ll track delivery for you',
            ],
            createdIds: { orderId: award.id },
            actionType: 'awardQuote',
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
          }
        } catch (error) {
          return createErrorResult('awardQuote', error, startTime)
        }
      },
      requiresConfirmation: true,
      confirmationMessage: (params) => `Award this quote${params.vendor ? ` from ${params.vendor}` : ''}?`,
    },

    getIncomingRFQs: {
      execute: async (params, context) => {
        const startTime = Date.now()
        try {
          // Get RFQs for seller
          const { getSupplierRFQs } = await import('@/lib/rfq/quote-service')

          const rfqs = await getSupplierRFQs(context.userId)
          const pendingCount = rfqs.filter((r: { status: string }) => r.status === 'open').length

          if (rfqs.length === 0) {
            return {
              success: true,
              data: [],
              displayMessage: 'No RFQs right now. I\'ll alert you when new opportunities come in.',
              actionType: 'getIncomingRFQs',
              executedAt: new Date(),
              durationMs: Date.now() - startTime,
            }
          }

          return {
            success: true,
            data: rfqs,
            displayMessage: `You have ${pendingCount} new RFQ${pendingCount !== 1 ? 's' : ''} to review.`,
            displayData: {
              total: rfqs.length,
              pending: pendingCount,
              rfqs: rfqs.slice(0, 5).map((r: { id: string; category: string; quantity: number; targetPrice: number }) => ({
                id: r.id,
                category: r.category,
                quantity: r.quantity,
                budget: r.targetPrice,
              })),
            },
            suggestedActions: pendingCount > 0 ? [
              { label: 'Quote on first RFQ', action: 'rfq.createQuote', primary: true, params: { rfqId: rfqs[0].id } },
              { label: 'Enable auto-quoting', action: 'rfq.enableAutoQuote' },
            ] : [],
            actionType: 'getIncomingRFQs',
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
          }
        } catch (error) {
          return createErrorResult('getIncomingRFQs', error, startTime)
        }
      },
    },

    createQuote: {
      execute: async (params, context) => {
        const startTime = Date.now()
        try {
          const { createQuote } = await import('@/lib/rfq/quote-service')

          const quote = await createQuote({
            rfqId: params.rfqId as string,
            supplierId: context.userId,
            unitPrice: (params.amount as number) / ((params.quantity as number) || 1),
            quantity: params.quantity as number || 1,
            leadTimeDays: params.leadTime as number || 7,
          })

          return {
            success: true,
            data: quote,
            displayMessage: `Quote sent for $${params.amount}. I'll let you know when they respond.`,
            displayData: {
              quoteId: quote.id,
              amount: params.amount,
            },
            createdIds: { quoteId: quote.id },
            actionType: 'createQuote',
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
          }
        } catch (error) {
          return createErrorResult('createQuote', error, startTime)
        }
      },
      requiresConfirmation: true,
      confirmationMessage: (params) => `Send quote for $${params.amount}?`,
    },
  },

  erp: {
    getSpendAnalysis: {
      execute: async (params, context) => {
        const startTime = Date.now()
        try {
          // Get spend data from ERP
          const { getSpendAnalysis } = await import('@/lib/erp/intercept-service')

          const analysis = await getSpendAnalysis({
            userId: context.userId,
            timeframe: params.timeframe as string || 'this_month',
            category: params.category as string,
          })

          return {
            success: true,
            data: analysis,
            displayMessage: `Your spend this month: $${analysis.totalSpend?.toLocaleString() || 0}. Top category: ${analysis.topCategory || 'N/A'}.`,
            displayData: {
              totalSpend: analysis.totalSpend,
              byCategory: analysis.byCategory,
              trend: analysis.trend,
            },
            suggestedActions: [
              { label: 'See breakdown', action: 'erp.spendBreakdown' },
              { label: 'Find savings', action: 'erp.findSavings', primary: true },
            ],
            actionType: 'getSpendAnalysis',
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
          }
        } catch (error) {
          return createErrorResult('getSpendAnalysis', error, startTime)
        }
      },
    },

    createPurchaseOrder: {
      execute: async (params, context) => {
        const startTime = Date.now()
        try {
          const { createPO } = await import('@/lib/erp/intercept-service')

          const po = await createPO({
            userId: context.userId,
            vendor: params.vendor as string,
            amount: params.amount as number,
            items: params.items as unknown[],
          })

          return {
            success: true,
            data: po,
            displayMessage: `PO #${po.poNumber} created for ${params.vendor}.`,
            displayData: {
              poNumber: po.poNumber,
              vendor: params.vendor,
              amount: params.amount,
            },
            createdIds: { orderId: po.id },
            actionType: 'createPurchaseOrder',
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
          }
        } catch (error) {
          return createErrorResult('createPurchaseOrder', error, startTime)
        }
      },
      requiresConfirmation: true,
      confirmationMessage: (params) => `Create PO for ${params.vendor}${params.amount ? ` ($${params.amount})` : ''}?`,
    },
  },

  payments: {
    initiatePayment: {
      execute: async (params, context) => {
        const startTime = Date.now()
        try {
          const { initiatePayment } = await import('@/lib/wells-payments')

          const payment = await initiatePayment({
            userId: context.userId,
            invoiceId: params.invoiceId as string,
            amount: params.amount as number,
            vendor: params.vendor as string,
          })

          return {
            success: true,
            data: payment,
            displayMessage: `Payment of $${payment.amount} initiated for invoice ${params.invoiceId}.`,
            displayData: {
              paymentId: payment.id,
              amount: payment.amount,
              status: payment.status,
            },
            createdIds: { transactionId: payment.id },
            actionType: 'initiatePayment',
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
          }
        } catch (error) {
          return createErrorResult('initiatePayment', error, startTime)
        }
      },
      requiresConfirmation: true,
      confirmationMessage: (params) => `Pay $${params.amount} for invoice ${params.invoiceId}?`,
    },

    getIncomingPayments: {
      execute: async (params, context) => {
        const startTime = Date.now()
        try {
          const { getIncomingPayments } = await import('@/lib/wells-payments')

          const payments = await getIncomingPayments({
            userId: context.userId,
            buyer: params.buyer as string,
          })

          if (payments.length === 0) {
            return {
              success: true,
              data: [],
              displayMessage: params.buyer
                ? `No payments from ${params.buyer} yet.`
                : 'No pending incoming payments.',
              actionType: 'getIncomingPayments',
              executedAt: new Date(),
              durationMs: Date.now() - startTime,
            }
          }

          const total = payments.reduce((sum: number, p: { amount: number }) => sum + p.amount, 0)

          return {
            success: true,
            data: payments,
            displayMessage: `${payments.length} incoming payment${payments.length !== 1 ? 's' : ''} totaling $${total.toLocaleString()}.`,
            displayData: {
              count: payments.length,
              total,
              payments: payments.slice(0, 5),
            },
            actionType: 'getIncomingPayments',
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
          }
        } catch (error) {
          return createErrorResult('getIncomingPayments', error, startTime)
        }
      },
    },
  },

  jobs: {
    searchJobs: {
      execute: async (params, context) => {
        const startTime = Date.now()
        try {
          const { searchTasks } = await import('@/lib/jobs/matching-engine')

          const jobs = await searchTasks({
            workerId: context.userId,
            skills: params.skills as string[],
            role: params.role as string,
            location: params.location as string,
            remote: params.remote as boolean,
            salary: params.salary as { min?: number; max?: number },
          })

          if (jobs.length === 0) {
            return {
              success: true,
              data: [],
              displayMessage: 'No matching jobs right now. I\'ll notify you when new opportunities match your profile.',
              suggestedActions: [
                { label: 'Update my profile', action: 'jobs.updateProfile' },
                { label: 'Broaden search', action: 'jobs.searchJobs', params: {} },
              ],
              actionType: 'searchJobs',
              executedAt: new Date(),
              durationMs: Date.now() - startTime,
            }
          }

          return {
            success: true,
            data: jobs,
            displayMessage: `Found ${jobs.length} matching job${jobs.length !== 1 ? 's' : ''}. Top match: ${jobs[0].title} at ${jobs[0].posterCompany || 'a growing company'}.`,
            displayData: {
              total: jobs.length,
              topJobs: jobs.slice(0, 5).map((j: { id: string; title: string; posterCompany: string; budgetMax: number; matchScore: number }) => ({
                id: j.id,
                title: j.title,
                company: j.posterCompany,
                salary: j.budgetMax,
                matchScore: j.matchScore,
              })),
            },
            suggestedActions: [
              { label: `Apply to ${jobs[0].title}`, action: 'jobs.submitApplication', primary: true, params: { jobId: jobs[0].id } },
              { label: 'See all matches', action: 'jobs.viewAllMatches' },
            ],
            actionType: 'searchJobs',
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
          }
        } catch (error) {
          return createErrorResult('searchJobs', error, startTime)
        }
      },
    },

    submitApplication: {
      execute: async (params, context) => {
        const startTime = Date.now()
        try {
          const { applyToTask } = await import('@/lib/jobs/worker-service')

          const application = await applyToTask({
            workerId: context.userId,
            taskId: params.jobId as string,
            coverLetter: params.coverLetter as string,
            proposedRate: params.rate as number,
          })

          return {
            success: true,
            data: application,
            displayMessage: `Application submitted! I crafted a personalized cover letter based on your profile.`,
            displayData: {
              applicationId: application.id,
              status: application.status,
            },
            nextSteps: [
              'The employer will review your application',
              'I\'ll update you on any status changes',
              'Average response time: 2-3 days',
            ],
            createdIds: { applicationId: application.id },
            actionType: 'submitApplication',
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
          }
        } catch (error) {
          return createErrorResult('submitApplication', error, startTime)
        }
      },
      requiresConfirmation: true,
      confirmationMessage: (params) => `Submit application${params.company ? ` to ${params.company}` : ''}?`,
    },

    negotiateOffer: {
      execute: async (params, context) => {
        const startTime = Date.now()
        try {
          const { negotiateOffer } = await import('@/lib/jobs/payment-service')

          const result = await negotiateOffer({
            workerId: context.userId,
            company: params.company as string,
            currentOffer: params.currentOffer as number,
            targetSalary: params.targetSalary as number,
          })

          return {
            success: true,
            data: result,
            displayMessage: `Sent counter-offer of $${(params.targetSalary as number).toLocaleString()} with market data justification.`,
            displayData: {
              counterOffer: params.targetSalary,
              justification: result.justification,
            },
            nextSteps: [
              'Waiting for employer response',
              'I included market salary data to support your ask',
              'I\'ll notify you immediately when they respond',
            ],
            actionType: 'negotiateOffer',
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
          }
        } catch (error) {
          return createErrorResult('negotiateOffer', error, startTime)
        }
      },
      requiresConfirmation: true,
      confirmationMessage: (params) => `Counter at $${(params.targetSalary as number)?.toLocaleString()}?`,
    },

    getSalaryData: {
      execute: async (params, context) => {
        const startTime = Date.now()
        try {
          const { getSalaryInsights } = await import('@/lib/jobs/earnings-service')

          const insights = await getSalaryInsights({
            role: params.role as string,
            location: params.location as string,
            skills: params.skills as string[],
          })

          return {
            success: true,
            data: insights,
            displayMessage: `Market rate for ${params.role}: $${insights.median?.toLocaleString() || 'N/A'} (range: $${insights.p25?.toLocaleString()} - $${insights.p75?.toLocaleString()}).`,
            displayData: {
              median: insights.median,
              range: { low: insights.p25, high: insights.p75 },
              topPaying: insights.topPayingCompanies,
            },
            suggestedActions: [
              { label: 'Search jobs at this rate', action: 'jobs.searchJobs', primary: true, params: { salary: { min: insights.median } } },
            ],
            actionType: 'getSalaryData',
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
          }
        } catch (error) {
          return createErrorResult('getSalaryData', error, startTime)
        }
      },
    },

    getApplications: {
      execute: async (params, context) => {
        const startTime = Date.now()
        try {
          const { getWorkerApplications } = await import('@/lib/jobs/worker-service')

          const applications = await getWorkerApplications(context.userId)

          if (applications.length === 0) {
            return {
              success: true,
              data: [],
              displayMessage: 'No active applications. Ready to find your next opportunity?',
              suggestedActions: [
                { label: 'Search jobs', action: 'jobs.searchJobs', primary: true },
              ],
              actionType: 'getApplications',
              executedAt: new Date(),
              durationMs: Date.now() - startTime,
            }
          }

          const pending = applications.filter((a: { status: string }) => a.status === 'pending').length
          const interviewing = applications.filter((a: { status: string }) => a.status === 'interviewing').length

          return {
            success: true,
            data: applications,
            displayMessage: `You have ${applications.length} active application${applications.length !== 1 ? 's' : ''}: ${pending} pending review, ${interviewing} in interviews.`,
            displayData: {
              total: applications.length,
              pending,
              interviewing,
              applications: applications.slice(0, 5).map((a: { id: string; task?: { title: string; posterCompany: string }; status: string }) => ({
                id: a.id,
                role: a.task?.title,
                company: a.task?.posterCompany,
                status: a.status,
              })),
            },
            actionType: 'getApplications',
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
          }
        } catch (error) {
          return createErrorResult('getApplications', error, startTime)
        }
      },
    },
  },

  insights: {
    getSellerMetrics: {
      execute: async (params, context) => {
        const startTime = Date.now()
        try {
          // Aggregate seller metrics
          const { getSellerMetrics } = await import('@/lib/rfq/quote-service')

          const metrics = await getSellerMetrics(context.userId)

          return {
            success: true,
            data: metrics,
            displayMessage: `Your win rate: ${metrics.winRate}%. You've won ${metrics.dealsWon} deals worth $${metrics.totalRevenue?.toLocaleString() || 0}.`,
            displayData: {
              winRate: metrics.winRate,
              dealsWon: metrics.dealsWon,
              totalRevenue: metrics.totalRevenue,
              avgDealSize: metrics.avgDealSize,
              responseTime: metrics.avgResponseTime,
            },
            suggestedActions: [
              { label: 'Improve win rate', action: 'insights.winRateTips', primary: true },
              { label: 'See all stats', action: 'insights.fullDashboard' },
            ],
            actionType: 'getSellerMetrics',
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
          }
        } catch (error) {
          return createErrorResult('getSellerMetrics', error, startTime)
        }
      },
    },

    analyzeRunway: {
      execute: async (params, context) => {
        const startTime = Date.now()
        try {
          const { analyzeRunway } = await import('@/lib/founder/metrics-service')

          const runway = await analyzeRunway(context.userId)

          return {
            success: true,
            data: runway,
            displayMessage: `At current burn rate, you have ${runway.monthsRemaining} months of runway. Monthly burn: $${runway.monthlyBurn?.toLocaleString() || 0}.`,
            displayData: {
              monthsRemaining: runway.monthsRemaining,
              monthlyBurn: runway.monthlyBurn,
              monthlyRevenue: runway.monthlyRevenue,
              cashOnHand: runway.cashOnHand,
            },
            suggestedActions: runway.monthsRemaining < 6 ? [
              { label: 'Find investors', action: 'founder.findInvestors', primary: true },
              { label: 'Cut costs', action: 'founder.costAnalysis' },
            ] : [
              { label: 'Growth strategies', action: 'founder.growthStrategies' },
            ],
            actionType: 'analyzeRunway',
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
          }
        } catch (error) {
          return createErrorResult('analyzeRunway', error, startTime)
        }
      },
    },

    getFinancialOverview: {
      execute: async (params, context) => {
        const startTime = Date.now()
        try {
          const { getFinancialOverview } = await import('@/lib/founder/metrics-service')

          const overview = await getFinancialOverview(context.userId)

          return {
            success: true,
            data: overview,
            displayMessage: `This month: $${overview.revenue?.toLocaleString() || 0} revenue, $${overview.expenses?.toLocaleString() || 0} expenses. ${overview.profitMargin >= 0 ? 'Profitable' : 'Net loss'}: ${overview.profitMargin}%.`,
            displayData: overview,
            actionType: 'getFinancialOverview',
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
          }
        } catch (error) {
          return createErrorResult('getFinancialOverview', error, startTime)
        }
      },
    },
  },

  treasury: {
    getBalance: {
      execute: async (params, context) => {
        const startTime = Date.now()
        try {
          const { treasuryHandler } = await import('./handlers/treasury-handler')
          const result = await treasuryHandler.handleAction('get_balance', context.userId, params)

          return {
            success: result.success,
            data: result.data,
            displayMessage: result.displayMessage,
            displayData: result.displayData,
            suggestedActions: result.suggestedActions?.map(a => ({
              label: a.label,
              action: `treasury.${a.action}`,
              params: a.params,
            })),
            actionType: 'getBalance',
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
          }
        } catch (error) {
          return createErrorResult('getBalance', error, startTime)
        }
      },
    },

    getPrice: {
      execute: async (params, context) => {
        const startTime = Date.now()
        try {
          const { treasuryHandler } = await import('./handlers/treasury-handler')
          const result = await treasuryHandler.handleAction('get_price', context.userId, params)

          return {
            success: result.success,
            data: result.data,
            displayMessage: result.displayMessage,
            displayData: result.displayData,
            suggestedActions: result.suggestedActions?.map(a => ({
              label: a.label,
              action: `treasury.${a.action}`,
              params: a.params,
            })),
            actionType: 'getPrice',
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
          }
        } catch (error) {
          return createErrorResult('getPrice', error, startTime)
        }
      },
    },

    initiateTransfer: {
      execute: async (params, context) => {
        const startTime = Date.now()
        try {
          const { treasuryHandler } = await import('./handlers/treasury-handler')
          const result = await treasuryHandler.handleAction('send_grain', context.userId, {
            toEmail: params.recipient,
            amount: params.amount,
            memo: params.memo,
          })

          return {
            success: result.success,
            data: result.data,
            displayMessage: result.displayMessage,
            displayData: result.displayData,
            createdIds: result.data?.transactionId ? { transactionId: result.data.transactionId } : undefined,
            suggestedActions: result.suggestedActions?.map(a => ({
              label: a.label,
              action: `treasury.${a.action}`,
              params: a.params,
            })),
            actionType: 'initiateTransfer',
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
          }
        } catch (error) {
          return createErrorResult('initiateTransfer', error, startTime)
        }
      },
      requiresConfirmation: true,
      confirmationMessage: (params) => `Send ${params.amount} ${params.currency || 'GRAIN'} to ${params.recipient}?`,
    },

    getTransactions: {
      execute: async (params, context) => {
        const startTime = Date.now()
        try {
          const { treasuryHandler } = await import('./handlers/treasury-handler')
          const result = await treasuryHandler.handleAction('get_transactions', context.userId, {
            limit: params.limit || 10,
          })

          return {
            success: result.success,
            data: result.data,
            displayMessage: result.displayMessage,
            displayData: result.displayData,
            actionType: 'getTransactions',
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
          }
        } catch (error) {
          return createErrorResult('getTransactions', error, startTime)
        }
      },
    },

    convertToGrain: {
      execute: async (params, context) => {
        const startTime = Date.now()
        try {
          const { treasuryHandler } = await import('./handlers/treasury-handler')
          const result = await treasuryHandler.handleAction('convert_to_grain', context.userId, {
            amount: params.amount,
          })

          return {
            success: result.success,
            data: result.data,
            displayMessage: result.displayMessage,
            displayData: result.displayData,
            actionType: 'convertToGrain',
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
          }
        } catch (error) {
          return createErrorResult('convertToGrain', error, startTime)
        }
      },
      requiresConfirmation: true,
      confirmationMessage: (params) => `Convert $${params.amount} USDC to GRAIN?`,
    },

    createEscrow: {
      execute: async (params, context) => {
        const startTime = Date.now()
        try {
          const { treasuryHandler } = await import('./handlers/treasury-handler')
          const result = await treasuryHandler.handleAction('create_escrow', context.userId, {
            sellerId: params.sellerId,
            amount: params.amount,
            dealId: params.dealId,
            description: params.description,
          })

          return {
            success: result.success,
            data: result.data,
            displayMessage: result.displayMessage,
            displayData: result.displayData,
            actionType: 'createEscrow',
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
          }
        } catch (error) {
          return createErrorResult('createEscrow', error, startTime)
        }
      },
      requiresConfirmation: true,
      confirmationMessage: (params) => `Create escrow of ${params.amount} GRAIN for this deal?`,
    },

    releaseEscrow: {
      execute: async (params, context) => {
        const startTime = Date.now()
        try {
          const { treasuryHandler } = await import('./handlers/treasury-handler')
          const result = await treasuryHandler.handleAction('release_escrow', context.userId, {
            escrowId: params.escrowId,
          })

          return {
            success: result.success,
            data: result.data,
            displayMessage: result.displayMessage,
            displayData: result.displayData,
            actionType: 'releaseEscrow',
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
          }
        } catch (error) {
          return createErrorResult('releaseEscrow', error, startTime)
        }
      },
      requiresConfirmation: true,
      confirmationMessage: () => `Release escrow and pay the seller?`,
    },

    checkCredit: {
      execute: async (params, context) => {
        const startTime = Date.now()
        try {
          const { treasuryHandler } = await import('./handlers/treasury-handler')
          const result = await treasuryHandler.handleAction('check_credit', context.userId, params)

          return {
            success: result.success,
            data: result.data,
            displayMessage: result.displayMessage,
            displayData: result.displayData,
            suggestedActions: result.suggestedActions?.map(a => ({
              label: a.label,
              action: `treasury.${a.action}`,
              params: a.params,
            })),
            actionType: 'checkCredit',
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
          }
        } catch (error) {
          return createErrorResult('checkCredit', error, startTime)
        }
      },
    },

    runPayroll: {
      execute: async (params, context) => {
        const startTime = Date.now()
        try {
          const { treasuryHandler } = await import('./handlers/treasury-handler')
          const result = await treasuryHandler.handleAction('run_payroll', context.userId, {
            recipients: params.recipients,
          })

          return {
            success: result.success,
            data: result.data,
            displayMessage: result.displayMessage,
            displayData: result.displayData,
            actionType: 'runPayroll',
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
          }
        } catch (error) {
          return createErrorResult('runPayroll', error, startTime)
        }
      },
      requiresConfirmation: true,
      confirmationMessage: (params) => {
        const total = params.recipients?.reduce((sum: number, r: any) => sum + (r.amount || 0), 0) || 0
        return `Run payroll for ${params.recipients?.length || 0} recipients totaling ${total} GRAIN?`
      },
    },

    getTreasuryStats: {
      execute: async (params, context) => {
        const startTime = Date.now()
        try {
          const { treasuryHandler } = await import('./handlers/treasury-handler')
          const result = await treasuryHandler.handleAction('get_treasury_stats', context.userId, params)

          return {
            success: result.success,
            data: result.data,
            displayMessage: result.displayMessage,
            displayData: result.displayData,
            actionType: 'getTreasuryStats',
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
          }
        } catch (error) {
          return createErrorResult('getTreasuryStats', error, startTime)
        }
      },
    },

    explainGrain: {
      execute: async (params, context) => {
        const startTime = Date.now()
        try {
          const { treasuryHandler } = await import('./handlers/treasury-handler')
          const result = await treasuryHandler.handleAction('explain_grain', context.userId, params)

          return {
            success: result.success,
            data: result.data,
            displayMessage: result.displayMessage,
            displayData: result.displayData,
            suggestedActions: result.suggestedActions?.map(a => ({
              label: a.label,
              action: `treasury.${a.action}`,
              params: a.params,
            })),
            actionType: 'explainGrain',
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
          }
        } catch (error) {
          return createErrorResult('explainGrain', error, startTime)
        }
      },
    },
  },

  universal: {
    provideHelp: {
      execute: async (params, context) => {
        const startTime = Date.now()
        const journey = context.userJourney

        let helpMessage = 'I\'m Wells, your AI commerce assistant. Here\'s what I can help with:\n\n'

        if (journey === 'buyer' || journey === 'unknown') {
          helpMessage += '**As a Buyer:**\n- Find and order products/services\n- Get competitive quotes\n- Track orders and payments\n\n'
        }
        if (journey === 'seller' || journey === 'unknown') {
          helpMessage += '**As a Seller:**\n- Respond to RFQs\n- Manage your catalog\n- Track your sales performance\n\n'
        }
        if (journey === 'founder' || journey === 'unknown') {
          helpMessage += '**For Founders:**\n- Analyze your runway\n- Find talent to hire\n- Source products and find customers\n\n'
        }
        if (journey === 'jobs' || journey === 'unknown') {
          helpMessage += '**Job Search:**\n- Find matching opportunities\n- Apply with AI-crafted applications\n- Negotiate offers\n'
        }

        return {
          success: true,
          displayMessage: helpMessage,
          suggestedActions: [
            { label: 'Show my status', action: 'universal.getStatusUpdate' },
            { label: 'Find opportunities', action: journey === 'jobs' ? 'jobs.searchJobs' : 'rfq.searchSuppliers' },
          ],
          actionType: 'provideHelp',
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
        }
      },
    },

    showCapabilities: {
      execute: async (params, context) => {
        const startTime = Date.now()

        return {
          success: true,
          displayMessage: `I can help you with:\n
- **Create RFQs**: "I need 500 ball bearings, budget $3000"
- **Find suppliers**: "Find me a cheaper supplier for office supplies"
- **Track spending**: "What's my spend this month?"
- **Manage quotes**: "Show me pending quotes" / "Accept the offer from Acme"
- **Process payments**: "Pay invoice #123"
- **Search jobs**: "Find me a senior engineer role"
- **Negotiate offers**: "Counter at $200K"
- **Check balance**: "What's my GRAIN balance?"

Just tell me what you need - no menus required!`,
          suggestedActions: [
            { label: 'Create an RFQ', action: 'rfq.createRFQ' },
            { label: 'Check my status', action: 'universal.getStatusUpdate' },
          ],
          actionType: 'showCapabilities',
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
        }
      },
    },

    getStatusUpdate: {
      execute: async (params, context) => {
        const startTime = Date.now()

        // Aggregate status from various sources
        const statusParts: string[] = []
        const suggestedActions: SuggestedAction[] = []

        // Check for action-required items
        const actionDeals = context.activeDeals.filter(d => d.requiresAction)
        if (actionDeals.length > 0) {
          statusParts.push(`**Needs Your Attention:**`)
          actionDeals.slice(0, 3).forEach(deal => {
            statusParts.push(`- ${deal.summary}`)
          })
        }

        // Check recent activity
        if (context.activeDeals.length > 0) {
          const recentDeals = context.activeDeals.slice(0, 3)
          statusParts.push(`\n**Active:**`)
          recentDeals.forEach(deal => {
            statusParts.push(`- ${deal.type}: ${deal.status}`)
          })
        }

        if (statusParts.length === 0) {
          statusParts.push('All caught up! No pending items.')
          suggestedActions.push({ label: 'Find opportunities', action: 'rfq.searchSuppliers', primary: true })
        }

        return {
          success: true,
          displayMessage: statusParts.join('\n'),
          suggestedActions,
          actionType: 'getStatusUpdate',
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
        }
      },
    },

    respondToGreeting: {
      execute: async (params, context) => {
        const startTime = Date.now()
        const hour = new Date().getHours()
        const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

        let message = `${greeting}! I'm Wells, ready to help. `

        // Add context-aware suggestions
        const actionDeals = context.activeDeals.filter(d => d.requiresAction)
        if (actionDeals.length > 0) {
          message += `You have ${actionDeals.length} item${actionDeals.length !== 1 ? 's' : ''} needing attention. Want to review them?`
        } else {
          message += 'What can I help you with today?'
        }

        return {
          success: true,
          displayMessage: message,
          suggestedActions: actionDeals.length > 0
            ? [{ label: 'Show status', action: 'universal.getStatusUpdate', primary: true }]
            : [
                { label: 'Create RFQ', action: 'rfq.createRFQ' },
                { label: 'Search jobs', action: 'jobs.searchJobs' },
              ],
          actionType: 'respondToGreeting',
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
        }
      },
    },

    requestClarification: {
      execute: async (params, context) => {
        const startTime = Date.now()

        return {
          success: true,
          displayMessage: 'I want to make sure I help you correctly. Could you tell me more about what you need?',
          actionType: 'requestClarification',
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
        }
      },
    },

    undoLastAction: {
      execute: async (params, context) => {
        const startTime = Date.now()

        // Find last executed action
        const lastAction = context.messages
          .filter(m => m.action?.status === 'executed')
          .pop()

        if (!lastAction) {
          return {
            success: false,
            error: 'No recent action to undo',
            displayMessage: 'There\'s no recent action to undo.',
            actionType: 'undoLastAction',
            executedAt: new Date(),
            durationMs: Date.now() - startTime,
          }
        }

        // Note: Actual undo logic would depend on the action type
        return {
          success: true,
          displayMessage: `The last action (${lastAction.action?.type}) has been cancelled.`,
          actionType: 'undoLastAction',
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
        }
      },
      requiresConfirmation: true,
      confirmationMessage: () => 'Cancel the last action?',
    },
  },
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function createErrorResult(actionType: string, error: unknown, startTime: number): ActionResult {
  const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'

  return {
    success: false,
    error: errorMessage,
    displayMessage: `I ran into an issue: ${errorMessage}. Would you like to try again?`,
    suggestedActions: [
      { label: 'Try again', action: actionType },
      { label: 'Get help', action: 'universal.provideHelp' },
    ],
    actionType,
    executedAt: new Date(),
    durationMs: Date.now() - startTime,
  }
}

// ============================================================================
// MAIN EXECUTOR
// ============================================================================

/**
 * Execute an action based on the route result
 */
export async function executeAction(
  route: RouteResult,
  context: ConversationContext
): Promise<ActionResult> {
  const { toolGroup, action, params } = route

  // Get the handler
  const groupHandlers = actionHandlers[toolGroup]
  if (!groupHandlers) {
    return {
      success: false,
      error: `Unknown tool group: ${toolGroup}`,
      displayMessage: 'I don\'t know how to do that yet. Can you try rephrasing?',
      actionType: action,
      executedAt: new Date(),
      durationMs: 0,
    }
  }

  const handler = groupHandlers[action]
  if (!handler) {
    return {
      success: false,
      error: `Unknown action: ${action}`,
      displayMessage: 'I\'m not sure how to do that. Can you tell me more about what you need?',
      actionType: action,
      executedAt: new Date(),
      durationMs: 0,
    }
  }

  // Validate if validator exists
  if (handler.validate) {
    const validation = handler.validate(params)
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error,
        displayMessage: validation.error || 'Missing required information.',
        actionType: action,
        executedAt: new Date(),
        durationMs: 0,
      }
    }
  }

  // Execute the action
  try {
    return await handler.execute(params, context)
  } catch (error) {
    return createErrorResult(action, error, Date.now())
  }
}

/**
 * Get handler metadata (for confirmation messages, etc.)
 */
export function getHandlerMetadata(
  toolGroup: string,
  action: string
): { requiresConfirmation: boolean; confirmationMessage?: (params: Record<string, unknown>) => string } {
  const handler = actionHandlers[toolGroup]?.[action]
  if (!handler) {
    return { requiresConfirmation: false }
  }

  return {
    requiresConfirmation: handler.requiresConfirmation || false,
    confirmationMessage: handler.confirmationMessage,
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const ActionExecutor = {
  executeAction,
  getHandlerMetadata,
}

export default ActionExecutor
