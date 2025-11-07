/**
 * Seller Demo Script - AI-to-AI Negotiation from Seller's Perspective
 *
 * This demonstrates the core principle: **Humans never talk directly**
 * Seller ↔ Wells (Seller) ↔ Wells (Buyer) ↔ Buyer
 */

export const SELLER_DEMO_SCRIPT = [
  {
    id: 1,
    role: 'assistant',
    content: '**Good morning!** I have an opportunity for you.',
    delay: 800
  },
  {
    id: 2,
    role: 'assistant',
    content: 'A buyer just requested **5,000 custom PCB assemblies** for an aerospace project.\n\n**Their Requirements:**\n• ITAR compliance required\n• 8-week delivery\n• Budget: $75,000-$95,000\n• Quality: AS9100D certified\n\nThis matches your capabilities perfectly. Want me to handle this?',
    delay: 2000,
    component: {
      type: 'rfq-details',
      data: {
        item: 'Custom PCB Assemblies',
        quantity: 5000,
        industry: 'Aerospace & Defense',
        budget: '$75,000 - $95,000',
        timeline: '8 weeks',
        requirements: ['ITAR Compliance', 'AS9100D Certification', 'Full testing documentation'],
        buyerCompany: 'Aerospace Dynamics Corp',
        buyerType: 'Series C, 180 employees'
      }
    }
  },
  {
    id: 3,
    role: 'user',
    content: 'Yes, handle this for me. Try to get $92K if possible.'
  },
  {
    id: 4,
    role: 'assistant',
    content: 'Got it. I\'ll negotiate for **$92,000** with your standard 8-week timeline.\n\nI\'m now coordinating with the buyer\'s Wells to work out the details...',
    delay: 1200
  },
  {
    id: 5,
    role: 'assistant',
    content: '**Negotiation in progress...**\n\nMy AI ↔ Buyer\'s AI discussion:\n\n*"We can deliver 5,000 units at $92K with full ITAR compliance and AS9100D certification. 8-week timeline with weekly progress reports."*',
    delay: 2500,
    component: {
      type: 'ai-to-ai-negotiation',
      data: {
        status: 'negotiating',
        messages: [
          {
            from: 'seller_wells',
            to: 'buyer_wells',
            message: 'Initial offer: $92,000 for 5,000 units, 8-week delivery, full ITAR compliance'
          },
          {
            from: 'buyer_wells',
            to: 'seller_wells',
            message: 'Buyer prefers $85,000. Can you meet that or provide additional value at $92K?'
          },
          {
            from: 'seller_wells',
            to: 'buyer_wells',
            message: 'Proposed compromise: $89,000 with expedited 6-week delivery and enhanced testing package'
          }
        ]
      }
    }
  },
  {
    id: 6,
    role: 'assistant',
    content: '**Update:** Buyer\'s Wells countered at **$85K**.\n\nI proposed a compromise: **$89,000** with:\n• 6-week delivery (2 weeks faster)\n• Enhanced testing package ($3K value)\n• Weekly progress reports with photos\n\nThis still hits your margin targets. Should I accept this?',
    delay: 2000,
    component: {
      type: 'deal-comparison',
      data: {
        original: {
          price: 92000,
          timeline: '8 weeks',
          margin: '28%'
        },
        proposed: {
          price: 89000,
          timeline: '6 weeks',
          margin: '26%',
          extras: ['Enhanced testing', 'Photo updates', 'Priority queue']
        }
      }
    }
  },
  {
    id: 7,
    role: 'user',
    content: 'Yes, accept the $89K deal'
  },
  {
    id: 8,
    role: 'assistant',
    content: '**Deal accepted!**\n\nI\'ve finalized the agreement with the buyer\'s Wells:\n\n**Final Terms:**\n• Price: **$89,000**\n• Quantity: **5,000 units**\n• Timeline: **6 weeks**\n• Payment: 50% upfront, 50% on delivery\n• Your margin: **26%** ($23,140 profit)\n\nThe contract is being generated now. GRAIN payment will be held in escrow automatically.',
    delay: 1500,
    component: {
      type: 'deal-summary',
      data: {
        dealId: 'DEAL-2025-0007',
        price: 89000,
        quantity: 5000,
        timeline: '6 weeks',
        profit: 23140,
        margin: 26,
        paymentTerms: '50% upfront ($44,500), 50% on delivery ($44,500)',
        escrow: 'GRAIN Vault (7-day blockchain audit)',
        nextSteps: [
          'Review and e-sign contract',
          'Receive $44,500 GRAIN deposit',
          'Begin production',
          'Weekly progress updates'
        ]
      }
    }
  },
  {
    id: 9,
    role: 'user',
    content: 'Perfect. This is exactly what I needed.'
  },
  {
    id: 10,
    role: 'assistant',
    content: '**You\'re all set!**\n\nNotice what just happened:\n• You never talked to the buyer\n• I negotiated on your behalf\n• Deal closed in minutes, not days\n• Payment secured in GRAIN escrow\n• Contract auto-generated\n\nThis is how Wells works. **You focus on building. I handle everything else.**\n\nWant me to look for more opportunities like this?',
    delay: 2000
  }
]
