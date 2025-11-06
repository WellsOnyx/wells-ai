// Demo script - Procurement scenario showcasing Wells AI + Grain Vault

export interface DemoMessage {
  id: string
  role: 'assistant' | 'user'
  content: string
  delay?: number // ms delay before showing this message
  typing?: boolean // show typing indicator
  component?: {
    type: 'supplier-card' | 'payment-flow' | 'contract-preview' | 'savings-chart'
    data: any
  }
}

export interface DemoScene {
  id: string
  title: string
  duration: number // estimated seconds
  messages: DemoMessage[]
}

// Full 60-second demo flow
export const DEMO_SCRIPT: DemoScene[] = [
  // Scene 1: Welcome (8 seconds)
  {
    id: 'scene-1-welcome',
    title: 'Welcome',
    duration: 8,
    messages: [
      {
        id: 'msg-1',
        role: 'assistant',
        content: "Hi! I'm Wells, your AI commerce companion. I help you buy and sell anything—without ever speaking to a human.",
        typing: true,
        delay: 500
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content: "Let me show you how I work. Imagine you need to source 10,000 semiconductor chips for a new product launch...",
        typing: true,
        delay: 3000
      }
    ]
  },

  // Scene 2: The Problem (10 seconds)
  {
    id: 'scene-2-problem',
    title: 'The Problem',
    duration: 10,
    messages: [
      {
        id: 'msg-3',
        role: 'user',
        content: "Wells, I need 10,000 STM32 microcontrollers for Q1 production. Can you help me find suppliers?",
        typing: false,
        delay: 1000
      },
      {
        id: 'msg-4',
        role: 'assistant',
        content: "Absolutely. Let me search our global supplier network...",
        typing: true,
        delay: 2000
      },
      {
        id: 'msg-5',
        role: 'assistant',
        content: "I found 47 verified suppliers. Here are the top 3 matches based on your requirements:",
        typing: true,
        delay: 3500,
        component: {
          type: 'supplier-card',
          data: {
            suppliers: [
              {
                name: 'TechSource Global',
                location: 'Shenzhen, China',
                price: '$2.45/unit',
                moq: '5,000 units',
                leadTime: '6 weeks',
                rating: 4.8,
                verified: true,
                totalCost: '$24,500'
              },
              {
                name: 'Component Pro',
                location: 'Austin, TX',
                price: '$2.89/unit',
                moq: '1,000 units',
                leadTime: '3 weeks',
                rating: 4.9,
                verified: true,
                totalCost: '$28,900'
              },
              {
                name: 'Euro Electronics',
                location: 'Munich, Germany',
                price: '$2.67/unit',
                moq: '2,500 units',
                leadTime: '4 weeks',
                rating: 4.7,
                verified: true,
                totalCost: '$26,700'
              }
            ]
          }
        }
      }
    ]
  },

  // Scene 3: Wells Magic (20 seconds)
  {
    id: 'scene-3-wells-magic',
    title: 'Wells Magic',
    duration: 20,
    messages: [
      {
        id: 'msg-6',
        role: 'user',
        content: "TechSource Global looks good, but can you negotiate on price and lead time?",
        typing: false,
        delay: 1500
      },
      {
        id: 'msg-7',
        role: 'assistant',
        content: "I'll handle the negotiation. One moment...",
        typing: true,
        delay: 2500
      },
      {
        id: 'msg-8',
        role: 'assistant',
        content: "Great news! I negotiated:\n• Price: $2.45 → **$2.28/unit** (7% savings)\n• Lead time: 6 weeks → **4 weeks**\n• Payment terms: Net 30\n• Total: **$22,800** (saved $1,700)",
        typing: true,
        delay: 5000
      },
      {
        id: 'msg-9',
        role: 'user',
        content: "Perfect! Can you handle the payment and contracts?",
        typing: false,
        delay: 8000
      },
      {
        id: 'msg-10',
        role: 'assistant',
        content: "Already done. I've:\n✓ Generated contract with our legal templates\n✓ Routed payment through Grain Vault\n✓ Scheduled delivery tracking\n✓ Set up quality inspection checkpoints",
        typing: true,
        delay: 10000,
        component: {
          type: 'payment-flow',
          data: {
            amount: '$22,800',
            fee: '33 bps ($75.24)',
            netAmount: '$22,724.76',
            settlement: 'T+0 (instant)',
            treasuryYield: '4.8% APY on float'
          }
        }
      }
    ]
  },

  // Scene 4: The Magic Moment (12 seconds)
  {
    id: 'scene-4-magic-moment',
    title: 'The Magic Moment',
    duration: 12,
    messages: [
      {
        id: 'msg-11',
        role: 'assistant',
        content: "Here's what just happened in 60 seconds:\n\n**Traditional Process:**\n• 2 weeks of supplier research\n• 5 days of back-and-forth negotiation\n• 3 days for legal review\n• 2 days for payment processing\n\n**With Wells:**\n✨ 60 seconds, start to finish",
        typing: true,
        delay: 2000,
        component: {
          type: 'savings-chart',
          data: {
            timeSaved: '23 days',
            costSaved: '$1,700',
            efficiencyGain: '99.7%'
          }
        }
      }
    ]
  },

  // Scene 5: The Closer (10 seconds)
  {
    id: 'scene-5-closer',
    title: 'The Closer',
    duration: 10,
    messages: [
      {
        id: 'msg-12',
        role: 'assistant',
        content: "This is **Grain & Vault**:\n\n🌾 **Grain Vault** – Treasury that earns yield on every dollar\n⚡ **33 bps pricing** – Simple, transparent transaction fee\n🤖 **Wells AI** – Your 24/7 commerce companion\n🌍 **0 friction** – Buy or sell anything, anywhere",
        typing: true,
        delay: 2000
      },
      {
        id: 'msg-13',
        role: 'assistant',
        content: "Want to see this in your business? Create a free account and let's start with your first transaction.",
        typing: true,
        delay: 7000
      }
    ]
  }
]

// Calculate total demo duration
export const TOTAL_DEMO_DURATION = DEMO_SCRIPT.reduce(
  (total, scene) => total + scene.duration,
  0
)

// Get all messages in order
export const getAllMessages = (): DemoMessage[] => {
  return DEMO_SCRIPT.flatMap(scene => scene.messages)
}

// Get scene by ID
export const getSceneById = (id: string): DemoScene | undefined => {
  return DEMO_SCRIPT.find(scene => scene.id === id)
}
