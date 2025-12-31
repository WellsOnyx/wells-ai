/**
 * GRAIN & Vault Explainer Content
 * Deep explanation for video, homepage, and all marketing collateral
 *
 * This file contains the canonical messaging for GRAIN & Vault.
 * Use this as the source of truth for all communications.
 *
 * KEY VALUE PROPOSITIONS:
 * 1. "Your deposit is always protected" - You can get your money back anytime
 * 2. "GRAIN grows in value" - The more the ecosystem grows, the more your GRAIN is worth
 * 3. "Real backing, real value" - Not crypto speculation, backed by real assets
 * 4. "Zero fees inside the ecosystem" - Payments within GRAIN are free
 */

// ============================================================================
// THE ONE-LINER
// ============================================================================

export const GRAIN_TAGLINE = "Your money, protected and growing."

export const GRAIN_ELEVATOR_PITCH = `
GRAIN is a smarter way to hold and use your money. Your deposit is always protected,
your value grows as the ecosystem expands, and you pay zero fees when transacting
with others in the network. It's your money, working harder for you.
`

// ============================================================================
// THE CORE VALUE PROPOSITION
// ============================================================================

export const VALUE_PROPS = {
  forConsumers: {
    headline: "Your deposit grows. Your money stays protected.",
    subhead: "Watch your value increase while keeping full access to your funds.",
    points: [
      "Protected deposit you can access anytime",
      "Your value grows as the ecosystem expands",
      "Zero fees when paying others in GRAIN",
      "Cash available whenever you need it"
    ]
  },

  forSellers: {
    headline: "Accept payments. Keep everything.",
    subhead: "No processing fees eating into your margins. Your money works for you.",
    points: [
      "Zero fees on payments within the ecosystem",
      "Your protected deposit is always accessible",
      "Watch your total value grow over time",
      "One account for all your business needs"
    ]
  },

  forFounders: {
    headline: "Treasury that grows while you build.",
    subhead: "Your company's reserves stay protected while gaining value.",
    points: [
      "Protected deposits your board can trust",
      "Value grows with ecosystem success",
      "Pay your team with zero fees",
      "Full visibility into your total value"
    ]
  },

  forEmployees: {
    headline: "Get paid. Watch it grow.",
    subhead: "Your salary is protected and gains value just by holding it.",
    points: [
      "Protected balance from day one",
      "Your value increases over time",
      "Zero fees when spending in the network",
      "Cash available when you need it"
    ]
  }
}

// ============================================================================
// THE EXPLAINER SCRIPT (For Video)
// ============================================================================

export const EXPLAINER_VIDEO_SCRIPT = {
  hook: {
    duration: "0:00 - 0:10",
    visual: "Split screen: money sitting idle vs money growing",
    narration: `
      What if your money could grow, just by holding it?
      Protected. Accessible. Always yours.
      Welcome to GRAIN.
    `
  },

  problem: {
    duration: "0:10 - 0:30",
    visual: "Animated flow showing value erosion over time",
    narration: `
      Here's what happens to your money today:

      You deposit $100 in a bank. It sits there.
      Inflation chips away at its purchasing power.
      Fees eat into it every time you move it.

      Your money works for the bank, not for you.
      And that's been the only option. Until now.
    `
  },

  solution: {
    duration: "0:30 - 1:00",
    visual: "GRAIN logo reveal, value growth animation",
    narration: `
      GRAIN is different.

      Your deposit is always protected. Every dollar you put in
      can be taken out whenever you want.

      But here's the magic: as more people join and the ecosystem grows,
      your GRAIN grows in value too. Not speculation. Real backing.

      And when you pay others in GRAIN? Zero fees. Your full value moves.
    `
  },

  howItWorks: {
    duration: "1:00 - 1:45",
    visual: "Step-by-step animation of the value journey",
    narration: `
      Here's how it works:

      Step 1: Make a deposit. Your money is protected from day one.

      Step 2: Watch your value grow. As the ecosystem expands,
      so does your current value. Real growth, real backing.

      Step 3: Use GRAIN for payments, payroll, vendors—all fee-free
      within the network. Your full value transfers instantly.

      Step 4: Need cash? It's always available. Your protected deposit
      plus any growth is yours to access anytime.
    `
  },

  whyItWorks: {
    duration: "1:45 - 2:15",
    visual: "Value growth visualization and success stories",
    narration: `
      Why do people choose GRAIN?

      Because their money finally works for them.

      Your protected deposit gives you peace of mind.
      The ecosystem growth gives you upside.
      Zero fees inside the network keeps more in your pocket.

      It's not about locking up your money. It's about
      giving it a better place to live—while you have full access.
    `
  },

  callToAction: {
    duration: "2:15 - 2:30",
    visual: "Sign up flow, dashboard showing value growth",
    narration: `
      Ready to let your money grow?

      Join GRAIN today. Your deposit is protected.
      Your value grows with the ecosystem.

      GRAIN. Your money, protected and growing.
    `
  }
}

// ============================================================================
// HOMEPAGE SECTIONS
// ============================================================================

export const HOMEPAGE_CONTENT = {
  hero: {
    headline: "Your money, protected and growing.",
    subhead: "GRAIN keeps your deposit safe while your value grows with the ecosystem. Zero fees when you pay within the network.",
    cta: "Start Growing",
    ctaSecondary: "See How It Works"
  },

  problemSection: {
    headline: "Your money deserves better",
    stats: [
      { value: "0%", label: "Growth in most accounts" },
      { value: "2-3%", label: "Lost to inflation yearly" },
      { value: "Hidden", label: "Fees on every transfer" },
      { value: "Days", label: "To access your own money" }
    ],
    body: `
      Traditional accounts let your money sit idle.
      Inflation erodes your purchasing power.
      Fees chip away every time you move it.
      Your money should work for you, not against you.
    `
  },

  solutionSection: {
    headline: "A smarter place for your money",
    subhead: "Your deposit is protected. Your value grows. Payments within the network are free.",
    features: [
      {
        icon: "Shield",
        title: "Protected Deposit",
        description: "Your money is backed by real assets. Access it anytime."
      },
      {
        icon: "TrendingUp",
        title: "Growing Value",
        description: "As the ecosystem expands, so does your current value."
      },
      {
        icon: "Zap",
        title: "Zero Fees Inside",
        description: "Pay anyone in the network instantly with no fees."
      },
      {
        icon: "Wallet",
        title: "Cash Available",
        description: "Your money is always accessible when you need it."
      }
    ]
  },

  howItWorksSection: {
    headline: "How your money grows",
    steps: [
      {
        number: 1,
        title: "Deposit",
        description: "Add funds to your account. Your deposit is protected from day one.",
        detail: "Bank transfer, card, or wire. Simple and secure."
      },
      {
        number: 2,
        title: "Watch It Grow",
        description: "As more people join, the ecosystem grows—and so does your value.",
        detail: "Real backing, real growth. Not speculation."
      },
      {
        number: 3,
        title: "Use It Freely",
        description: "Pay others in the network with zero fees. Instant transfers.",
        detail: "Your full value moves with you."
      },
      {
        number: 4,
        title: "Access Anytime",
        description: "Need cash? Your protected deposit is always available.",
        detail: "No lock-ups, no penalties, no waiting."
      }
    ]
  },

  savingsCalculator: {
    headline: "See your potential value",
    description: "Enter your deposit amount to see how your value could grow.",
    // Interactive calculator component
  },

  testimonialSection: {
    headline: "People who let their money grow",
    // Testimonials go here
  },

  faqSection: {
    headline: "Common questions",
    faqs: [
      {
        question: "Is my deposit safe?",
        answer: "Absolutely. Your deposit is backed by real assets and protected at all times. You can access your cash whenever you need it—no lock-ups, no restrictions."
      },
      {
        question: "How does my value grow?",
        answer: "As more people join and use the ecosystem, the total value grows. This growth is shared among all participants. It's real value from real activity—not speculation."
      },
      {
        question: "Why are payments free inside the network?",
        answer: "When you pay someone else in GRAIN, the money stays in the ecosystem. There's no payment processor taking a cut, no bank charging transfer fees. Your full value moves to the recipient."
      },
      {
        question: "Can I get my money out anytime?",
        answer: "Yes. Your protected deposit is always accessible. When you need cash, it's available. We believe your money should be accessible when you need it."
      },
      {
        question: "Is this like cryptocurrency?",
        answer: "No. GRAIN is backed by real assets, not speculation. There's no wild volatility or complicated technology to understand. Your deposit is protected, and your value grows with real ecosystem activity."
      },
      {
        question: "What makes GRAIN different from a savings account?",
        answer: "Traditional savings accounts offer minimal growth while banks profit from your deposits. GRAIN shares the benefits of ecosystem growth directly with you, while keeping your deposit protected and accessible."
      }
    ]
  },

  finalCta: {
    headline: "Ready to let your money grow?",
    subhead: "Join thousands of people whose deposits are protected and growing.",
    cta: "Get Started Free",
    ctaNote: "Your deposit is protected. Cash available anytime."
  }
}

// ============================================================================
// SELLER ONBOARDING CONTENT
// ============================================================================

export const SELLER_ONBOARDING = {
  welcome: {
    headline: "Welcome to GRAIN",
    subhead: "Your deposit is protected. Your value grows with the ecosystem.",
    steps: [
      "Set up your account",
      "Make your first deposit",
      "Watch your value grow"
    ]
  },

  dashboardTour: {
    balanceCard: {
      title: "Your Current Value",
      explanation: `
        This shows your total value in GRAIN. Your protected deposit forms the foundation,
        and your value grows as the ecosystem expands. Cash is always available when you need it.
      `
    },
    transactionsCard: {
      title: "Recent Activity",
      explanation: `
        See all your deposits, payments, and value changes in one place.
        Every transaction is instant with secure protection for all parties.
      `
    },
    payrollCard: {
      title: "Payroll",
      explanation: `
        Pay your team in GRAIN—zero fees within the network.
        Their deposits are protected too, and they can access cash anytime.
      `
    },
    vendorsCard: {
      title: "Payments",
      explanation: `
        Pay anyone in the network with zero fees. Full value transfers instantly.
        For those outside the network, cash is always available.
      `
    },
    savingsCard: {
      title: "Value Growth",
      explanation: `
        Track how your value has grown since your first deposit.
        Real ecosystem growth, real value—not speculation.
      `
    }
  },

  firstPaymentGuide: {
    headline: "Getting started",
    steps: [
      {
        title: "Make your first deposit",
        description: "Add funds to get started. Your deposit is protected from day one."
      },
      {
        title: "Share your GRAIN ID",
        description: "Every account has a unique ID. Share it to receive payments fee-free."
      },
      {
        title: "Watch your value",
        description: "As the ecosystem grows, so does your current value."
      },
      {
        title: "Access cash anytime",
        description: "Your protected deposit is always available when you need it."
      }
    ]
  }
}

// ============================================================================
// FOUNDER-SPECIFIC CONTENT
// ============================================================================

export const FOUNDER_CONTENT = {
  pitch: {
    headline: "Company reserves that grow",
    subhead: "Your protected deposits work harder while you build. Zero fees within the ecosystem.",
    painPoints: [
      "Watching reserves sit idle in a bank?",
      "Paying fees every time money moves?",
      "No visibility into where your value sits?",
      "Struggling to show financial health to investors?"
    ],
    solution: "GRAIN protects your deposits while they grow with the ecosystem. Full transparency. Full access."
  },

  treasuryBenefits: {
    headline: "Your reserves, protected and growing",
    points: [
      {
        title: "Protected deposits",
        description: "Your company's reserves are backed by real assets. Access cash when you need it."
      },
      {
        title: "Growing value",
        description: "As the ecosystem expands, your current value grows. Real backing, not speculation."
      },
      {
        title: "Full visibility",
        description: "See your total value, protected deposit, and growth in one dashboard."
      },
      {
        title: "Zero fees inside",
        description: "Pay anyone in the network without fees eating into your runway."
      }
    ]
  },

  payrollBenefits: {
    headline: "Pay your team, keep more",
    comparison: {
      traditional: {
        title: "Traditional Payroll",
        items: [
          "Fees on every payment",
          "Days for payments to process",
          "No value growth while funds sit",
          "Complexity and overhead"
        ]
      },
      grain: {
        title: "GRAIN Payroll",
        items: [
          "Zero fees within the network",
          "Instant payment delivery",
          "Your deposits grow while held",
          "Simple, transparent, accessible"
        ]
      }
    }
  },

  investorIntegration: {
    headline: "Investor-ready transparency",
    points: [
      "Real-time total value visibility",
      "Clear protected deposit tracking",
      "Ecosystem growth reporting",
      "Full transaction history"
    ]
  }
}

// ============================================================================
// KEY MESSAGING GUIDELINES
// ============================================================================

export const MESSAGING_GUIDELINES = {
  always: [
    "Your deposit is always protected",
    "Your value grows with the ecosystem",
    "Zero fees inside the network",
    "Cash available whenever you need it",
    "Real backing, real value—not speculation"
  ],

  never: [
    "Don't mention equity, liquidity, or treasury mechanics",
    "Don't use terms like coverage ratio or vault floor",
    "Don't show formulas or calculations",
    "Don't compare to crypto or blockchain",
    "Don't discuss technical backing ratios"
  ],

  preferredLanguage: {
    "principal": "protected deposit",
    "GRAIN price × balance": "current value",
    "platform valuation": "ecosystem growth",
    "USDC liquidity": "cash available",
    "equity value": "total value"
  },

  tone: {
    voice: "Premium financial product, trustworthy and confident",
    avoid: "Technical jargon, crypto language, complex mechanics",
    goal: "Communicate VALUE without revealing HOW"
  },

  keyMetric: "Value growth",
  keyEmotion: "Money working for you, protected and growing",
  keyAction: "Start growing your value"
}

// ============================================================================
// OBJECTION HANDLING
// ============================================================================

export const OBJECTION_RESPONSES = {
  "Is my money safe?": `
    Absolutely. Your deposit is protected by real assets at all times.
    You can access your cash whenever you need it—no waiting,
    no approval process. Your money is always there for you.
  `,

  "How does my value actually grow?": `
    As more people join and use the ecosystem, total value grows.
    That growth is shared among all participants. It's real activity
    creating real value—not speculation or promises.
  `,

  "Can I get my money out anytime?": `
    Yes. Your protected deposit is always accessible. When you need
    cash, it's available. We believe your money should work for you
    AND be accessible when you need it.
  `,

  "Is this like crypto or Bitcoin?": `
    No. GRAIN is backed by real assets, not speculation. There's no
    wild volatility or complicated technology. Your deposit is protected,
    and value growth comes from real ecosystem activity.
  `,

  "Why would I use this instead of a bank?": `
    Banks offer minimal growth while profiting from your deposits.
    GRAIN shares the benefits of ecosystem growth directly with you,
    keeps your deposit protected, and charges zero fees for payments
    within the network.
  `,

  "What happens to my money if something goes wrong?": `
    Your deposit is backed by real assets at all times. Your protected
    deposit is always accessible. We maintain full backing to ensure
    you can always access your value.
  `
}
