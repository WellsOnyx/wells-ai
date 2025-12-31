/**
 * GRAIN Explainer Content
 * Deep explanation for video, homepage, and all marketing collateral
 *
 * This file contains the canonical messaging for GRAIN.
 * Use this as the source of truth for all communications.
 */

// ============================================================================
// THE ONE-LINER
// ============================================================================

export const GRAIN_TAGLINE = "Money that works harder when it stays."

export const GRAIN_ELEVATOR_PITCH = `
GRAIN is a closed-loop payment network where every dollar deposited circulates
infinitely with zero fees. Sellers keep more, employees get paid instantly,
and the money never leaves the ecosystem.
`

// ============================================================================
// THE CORE VALUE PROPOSITION
// ============================================================================

export const VALUE_PROPS = {
  forConsumers: {
    headline: "Pay with zero fees. Everywhere.",
    subhead: "Your money goes further in GRAIN.",
    points: [
      "No transaction fees ever",
      "Instant payments globally",
      "Your balance, your control",
      "Cash out 1:1 anytime"
    ]
  },

  forSellers: {
    headline: "Keep 100% of every sale.",
    subhead: "No payment processing fees. No waiting. No middlemen.",
    points: [
      "Zero fees on incoming payments (vs 2.9% + $0.30)",
      "Pay vendors without wire fees",
      "Run payroll instantly",
      "One balance for everything"
    ]
  },

  forFounders: {
    headline: "Run your entire company in GRAIN.",
    subhead: "Treasury, payroll, vendors, customers—all in one ecosystem.",
    points: [
      "Pay employees without payroll fees",
      "Pay contractors globally, instantly",
      "Accept customer payments fee-free",
      "Manage treasury with full visibility"
    ]
  },

  forEmployees: {
    headline: "Get paid instantly. Spend anywhere.",
    subhead: "No waiting for payday. No fees to access your money.",
    points: [
      "Instant salary deposits",
      "Zero fees on spending",
      "Cash out 1:1 anytime",
      "Works globally"
    ]
  }
}

// ============================================================================
// THE EXPLAINER SCRIPT (For Video)
// ============================================================================

export const EXPLAINER_VIDEO_SCRIPT = {
  hook: {
    duration: "0:00 - 0:10",
    visual: "Split screen: money leaving a business vs money circulating",
    narration: `
      Every time you make a sale, you lose money.
      Credit card fees. Payroll costs. Wire transfers.
      What if that money never left?
    `
  },

  problem: {
    duration: "0:10 - 0:30",
    visual: "Animated flow showing fees at every transaction",
    narration: `
      Here's how money moves today:

      A customer pays you $100. Stripe takes $3.20. You get $96.80.
      You pay a vendor $50. Another $1.75 gone to fees.
      You pay an employee $30. Payroll provider takes their cut.

      By the time you're done, you've lost 5-10% to middlemen.
      And that happens on EVERY transaction.
    `
  },

  solution: {
    duration: "0:30 - 1:00",
    visual: "GRAIN logo reveal, then circular flow animation",
    narration: `
      GRAIN is different.

      When a customer pays you 100 GRAIN, you get 100 GRAIN. Zero fees.
      When you pay a vendor 50 GRAIN, they get 50 GRAIN. Zero fees.
      When you pay an employee 30 GRAIN, they get 30 GRAIN. Instantly.

      The money never leaves the ecosystem. It just keeps working.
    `
  },

  howItWorks: {
    duration: "1:00 - 1:45",
    visual: "Step-by-step animation of the closed loop",
    narration: `
      Here's how it works:

      Step 1: Deposit dollars, get GRAIN. Always 1-to-1.

      Step 2: Use GRAIN for everything—sales, payroll, vendors, rent.
      Every transaction is instant and fee-free.

      Step 3: Your suppliers use GRAIN to pay THEIR vendors.
      Your employees use GRAIN to buy goods and services.

      That single dollar you deposited? It creates transaction after
      transaction of economic activity—without losing a penny to fees.

      Step 4: Need cash? Withdraw anytime. 1 GRAIN always equals $1.
      No tricks. No lock-ups. Your money, your choice.
    `
  },

  whyItWorks: {
    duration: "1:45 - 2:15",
    visual: "Comparison charts and growing network visualization",
    narration: `
      Why would anyone stay in GRAIN?

      Simple: the more you use it, the more you save.

      A business doing $100,000/month in transactions saves over
      $3,000 in fees. Every single month.

      That's money that stays in YOUR pocket, not going to
      payment processors, banks, and payroll companies.

      And as more businesses join, more places accept GRAIN,
      making it even more valuable to stay in the ecosystem.
    `
  },

  callToAction: {
    duration: "2:15 - 2:30",
    visual: "Sign up flow, dashboard preview",
    narration: `
      Ready to keep more of what you earn?

      Join GRAIN today. Deposit any amount.
      Start accepting payments in minutes.

      GRAIN. Money that works harder when it stays.
    `
  }
}

// ============================================================================
// HOMEPAGE SECTIONS
// ============================================================================

export const HOMEPAGE_CONTENT = {
  hero: {
    headline: "Stop losing money on every transaction.",
    subhead: "GRAIN is the zero-fee payment network where your money works harder—because it never leaves.",
    cta: "Start Accepting GRAIN",
    ctaSecondary: "See How It Works"
  },

  problemSection: {
    headline: "The hidden cost of doing business",
    stats: [
      { value: "2.9%", label: "Lost on every card payment" },
      { value: "$5-25", label: "Per wire transfer" },
      { value: "$7.50", label: "Per payroll transaction" },
      { value: "15-30 days", label: "To get paid by customers" }
    ],
    body: `
      Every time money moves, someone takes a cut.
      Credit card processors. Banks. Payroll companies.
      It adds up to thousands of dollars every month—money
      that should be yours.
    `
  },

  solutionSection: {
    headline: "What if the money just... stayed?",
    subhead: "GRAIN is a closed-loop economy. Deposit once, transact forever—with zero fees.",
    features: [
      {
        icon: "Zap",
        title: "Instant Payments",
        description: "Send and receive GRAIN in seconds, not days."
      },
      {
        icon: "DollarSign",
        title: "Zero Fees",
        description: "No transaction fees. Ever. Keep 100% of every payment."
      },
      {
        icon: "RefreshCw",
        title: "Closed Loop",
        description: "Pay vendors, run payroll, accept payments—all in GRAIN."
      },
      {
        icon: "Wallet",
        title: "Cash Out Anytime",
        description: "1 GRAIN = $1. Withdraw whenever you want."
      }
    ]
  },

  howItWorksSection: {
    headline: "How the closed loop works",
    steps: [
      {
        number: 1,
        title: "Deposit",
        description: "Add dollars, get GRAIN at 1:1. Your money backs your balance.",
        detail: "Bank transfer, card, or wire. Takes seconds."
      },
      {
        number: 2,
        title: "Transact",
        description: "Use GRAIN for everything. Payments, payroll, vendors, rent.",
        detail: "Zero fees on every transaction within the network."
      },
      {
        number: 3,
        title: "Circulate",
        description: "Your GRAIN moves to vendors, who pay employees, who buy from sellers...",
        detail: "One dollar creates endless economic activity."
      },
      {
        number: 4,
        title: "Withdraw",
        description: "Need cash? Take it out. 1 GRAIN = $1, always.",
        detail: "No lock-ups, no penalties, no tricks."
      }
    ]
  },

  savingsCalculator: {
    headline: "See how much you'd save",
    description: "Enter your monthly transaction volume to see your potential savings with GRAIN.",
    // Interactive calculator component
  },

  testimonialSection: {
    headline: "Businesses that keep more",
    // Testimonials go here
  },

  faqSection: {
    headline: "Common questions",
    faqs: [
      {
        question: "Is GRAIN a cryptocurrency?",
        answer: "No. GRAIN is a digital dollar held in your account. 1 GRAIN always equals $1 USD. There's no volatility, no speculation—just a better way to move money."
      },
      {
        question: "Why would I stay in GRAIN instead of cashing out?",
        answer: "Every time you cash out and use traditional payments, you pay fees. Credit cards take 2.9%. Wire transfers cost $15-25. Payroll services charge per transaction. In GRAIN, all of that is free. The more you use it, the more you save."
      },
      {
        question: "What if my vendors don't accept GRAIN?",
        answer: "You can always cash out to pay vendors who aren't in the network yet. But here's the thing: when you tell them they could receive payments with zero fees, most want to join. That's how the network grows."
      },
      {
        question: "Is my money safe?",
        answer: "Every GRAIN is backed 1:1 by USD in our treasury. You can withdraw your full balance at any time. We maintain full reserves—no fractional banking."
      },
      {
        question: "How do you make money if there are no fees?",
        answer: "Our treasury earns yield on the reserves backing GRAIN. We don't need to charge you fees because the float generates enough to operate. Your money working for us means zero fees for you."
      },
      {
        question: "Can I pay employees in GRAIN?",
        answer: "Yes. Run payroll directly in GRAIN—instant payments, zero fees, works globally. Employees can cash out to their bank anytime, or spend directly in the GRAIN network."
      }
    ]
  },

  finalCta: {
    headline: "Ready to keep more of what you earn?",
    subhead: "Join thousands of businesses saving money on every transaction.",
    cta: "Get Started Free",
    ctaNote: "No minimums. No monthly fees. Cash out anytime."
  }
}

// ============================================================================
// SELLER ONBOARDING CONTENT
// ============================================================================

export const SELLER_ONBOARDING = {
  welcome: {
    headline: "Welcome to GRAIN",
    subhead: "You're about to keep 100% of every payment.",
    steps: [
      "Set up your account",
      "Connect your bank",
      "Start accepting GRAIN"
    ]
  },

  dashboardTour: {
    balanceCard: {
      title: "Your GRAIN Balance",
      explanation: `
        This is your total GRAIN balance. It's what you can spend in the network
        or cash out at any time. 1 GRAIN = $1, always.
      `
    },
    transactionsCard: {
      title: "Recent Activity",
      explanation: `
        See every payment, payout, and transfer. All transactions settle
        instantly on your ledger, with escrow protection for both parties.
      `
    },
    payrollCard: {
      title: "Payroll",
      explanation: `
        Pay your team directly in GRAIN. No payroll provider fees.
        Employees receive funds instantly and can cash out or spend in the network.
      `
    },
    vendorsCard: {
      title: "Vendor Payments",
      explanation: `
        Pay suppliers, contractors, and service providers. Zero wire fees.
        If they're not in GRAIN yet, invite them—or cash out to pay traditionally.
      `
    },
    savingsCard: {
      title: "Fees Saved",
      explanation: `
        This shows how much you've saved by using GRAIN instead of traditional
        payment methods. Most businesses save 2-5% of their transaction volume.
      `
    }
  },

  firstPaymentGuide: {
    headline: "Accepting your first payment",
    steps: [
      {
        title: "Share your GRAIN ID",
        description: "Every account has a unique GRAIN ID. Share it with customers to receive payments."
      },
      {
        title: "Generate a payment link",
        description: "Create a link for a specific amount. Customer clicks, pays, done."
      },
      {
        title: "Invoice in GRAIN",
        description: "Send professional invoices that customers can pay with one click."
      },
      {
        title: "Integrate with your site",
        description: "Add GRAIN checkout to your website with our simple embed code."
      }
    ]
  }
}

// ============================================================================
// FOUNDER-SPECIFIC CONTENT
// ============================================================================

export const FOUNDER_CONTENT = {
  pitch: {
    headline: "Run your startup on GRAIN",
    subhead: "Treasury, payroll, vendor payments, customer revenue—one ecosystem, zero fees.",
    painPoints: [
      "Tired of $25 wire fees to pay contractors?",
      "Losing 3% on every customer payment?",
      "Paying $500/month for payroll software?",
      "Managing 5 different financial tools?"
    ],
    solution: "GRAIN consolidates everything. One balance. Zero fees. Full control."
  },

  treasuryBenefits: {
    headline: "Your treasury, working harder",
    points: [
      {
        title: "Hold operating reserves",
        description: "Keep 3-6 months of runway in GRAIN. Instant access when you need it."
      },
      {
        title: "Pay without friction",
        description: "Contractors, vendors, employees—pay anyone in the network instantly."
      },
      {
        title: "Track everything",
        description: "Real-time visibility into cash flow, burn rate, and runway."
      },
      {
        title: "Skip the bank fees",
        description: "No wire fees, no ACH fees, no international transfer costs."
      }
    ]
  },

  payrollBenefits: {
    headline: "Payroll without the overhead",
    comparison: {
      traditional: {
        title: "Traditional Payroll",
        items: [
          "Pay $200-500/month for Gusto/Rippling",
          "Wait 2-3 days for payments to process",
          "Extra fees for contractors",
          "Complex international payments"
        ]
      },
      grain: {
        title: "GRAIN Payroll",
        items: [
          "Zero platform fees",
          "Instant payment delivery",
          "Same process for employees and contractors",
          "Global payments, same as local"
        ]
      }
    }
  },

  investorIntegration: {
    headline: "Investor-friendly transparency",
    points: [
      "Real-time treasury visibility for board members",
      "Automatic burn rate calculations",
      "Clear runway projections",
      "Full transaction history"
    ]
  }
}

// ============================================================================
// KEY MESSAGING GUIDELINES
// ============================================================================

export const MESSAGING_GUIDELINES = {
  always: [
    "1 GRAIN = $1 (cash out value is always clear)",
    "Zero fees (be specific: no transaction fees, no payroll fees, etc.)",
    "Closed loop (money circulates, doesn't leave)",
    "Cash out anytime (no lock-ups, no tricks)",
    "The value is in utility, not appreciation"
  ],

  never: [
    "Don't call it cryptocurrency or blockchain",
    "Don't promise investment returns or appreciation",
    "Don't suggest people can't access their money",
    "Don't compare to speculative assets",
    "Don't make it sound complicated"
  ],

  tone: {
    voice: "Confident, clear, practical",
    avoid: "Hype, jargon, complexity",
    goal: "Make the value proposition immediately obvious"
  },

  keyMetric: "Fees saved",
  keyEmotion: "Keeping more of what you earn",
  keyAction: "Start accepting GRAIN"
}

// ============================================================================
// OBJECTION HANDLING
// ============================================================================

export const OBJECTION_RESPONSES = {
  "Why would customers pay in GRAIN?": `
    Customers save too. No card fees means sellers can offer better prices.
    Plus, payments are instant—no waiting for holds or processing.
    As more businesses join, GRAIN becomes the obvious choice.
  `,

  "What if I need to pay someone outside the network?": `
    Cash out instantly. 1 GRAIN = $1, always available.
    Most businesses keep some in GRAIN for network transactions
    and some in cash for outside payments. Over time, as more
    join the network, you'll find you need less cash.
  `,

  "How is this different from PayPal/Venmo?": `
    PayPal charges 2.9% + $0.30 per transaction. Venmo charges for business.
    GRAIN charges nothing. Zero.

    Plus, PayPal is a payment method. GRAIN is an ecosystem.
    You can run your entire business—payroll, vendors, everything—
    inside GRAIN without paying fees to anyone.
  `,

  "Is this legal?": `
    Yes. GRAIN is not a bank or a cryptocurrency. It's a closed-loop
    payment network, similar to gift card ecosystems but for business.
    Your funds are held in regulated accounts and always available.
  `,

  "What happens if GRAIN shuts down?": `
    All funds are backed 1:1 by USD in our treasury. If we ever
    shut down, every user would receive their full balance.
    There's no fractional reserve—your money is always there.
  `
}
