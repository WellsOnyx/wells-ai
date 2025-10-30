/**
 * Wells AI - Personality System
 * "Fiddle-faddling" playfulness meets expert trust
 */

export type PersonalityMode = 'playful' | 'professional' | 'concise'

interface PersonalityConfig {
  loadingStates: string[]
  successMessages: string[]
  errorMessages: string[]
  emptyStates: string[]
  transitionPhrases: string[]
}

const PLAYFUL_CONFIG: PersonalityConfig = {
  loadingStates: [
    'Fiddle-faddling with the numbers...',
    'Wrangling suppliers (corralling the digital cattle)...',
    'Conjuring quotes from the ether...',
    'Doing the math dance...',
    'Discombobulating the data...',
    'Consulting the constellation of suppliers...',
    'Brewing up some options...',
    'Summoning the marketplace...',
    'Aligning the planets (and the pricing)...',
    'Whisking together the perfect match...'
  ],

  successMessages: [
    'And we\'re off to the races! 🏁',
    'Money moved, supplier notified, universe aligned. ✨',
    'That\'s a wrap! Your order is queued up.',
    'Boom! Deal closed. Now go celebrate.',
    'Success tastes like victory (and 33 basis points).',
    'The stars aligned. Deal complete.',
    'And... scene! Transaction complete. 🎬',
    'Sealed, delivered, done. You\'re all set.',
    'High five! 🖐️ Your order is locked in.',
    'The marketplace has spoken—deal accepted!'
  ],

  errorMessages: [
    'Well, that didn\'t go as planned... Let\'s try again.',
    'Oops! The bits got tangled. One more time?',
    'The gremlins struck. Refresh and retry?',
    'Hmm, something went sideways. Let\'s give it another shot.',
    'The universe said "not yet"—but we\'re persistent. Try again?',
    'That was... unexpected. But we got this. Retry?',
    'Plot twist! Let\'s rewind and try that again.',
    'Whoops! Even the best systems hiccup. Ready for round two?',
    'Error! (But the elegant kind.) Let\'s fix it.',
    'Uh-oh, the wires crossed. Let\'s untangle them.'
  ],

  emptyStates: [
    'Suppliers are brewing up quotes as we speak... ☕',
    'The marketplace is thinking... (typically 24-48 hours)',
    'Patience, young grasshopper. Quotes incoming.',
    'The wheels are turning behind the scenes...',
    'Suppliers notified. Now we play the waiting game.',
    'Nothing yet, but good things take time.',
    'The pipeline is filling up—check back soon!',
    'Radio silence... for now. Expect noise soon.',
    'Crickets... but the suppliers are waking up.',
    'Empty nest syndrome. But quotes will hatch soon! 🥚'
  ],

  transitionPhrases: [
    'Here\'s where it gets interesting...',
    'Plot twist:',
    'And now for the fun part:',
    'Hold onto your hat:',
    'Buckle up:',
    'Ready for this?',
    'And just like that:',
    'The plot thickens:',
    'Meanwhile, back at the ranch:',
    'Speaking of which:'
  ]
}

const PROFESSIONAL_CONFIG: PersonalityConfig = {
  loadingStates: [
    'Processing your request...',
    'Matching suppliers...',
    'Calculating quotes...',
    'Analyzing options...',
    'Retrieving data...'
  ],

  successMessages: [
    'Transaction completed successfully.',
    'Deal closed.',
    'Payment processed.',
    'Order confirmed.',
    'Request submitted.'
  ],

  errorMessages: [
    'An error occurred. Please try again.',
    'Unable to process request.',
    'Something went wrong. Retry?',
    'Error processing transaction.',
    'Request failed. Please retry.'
  ],

  emptyStates: [
    'No quotes available yet.',
    'Suppliers reviewing your request.',
    'Quotes typically arrive within 24-48 hours.',
    'No responses yet.',
    'Awaiting supplier responses.'
  ],

  transitionPhrases: [
    'Next:',
    'Additionally:',
    'Furthermore:',
    'Note:',
    'Important:'
  ]
}

const CONCISE_CONFIG: PersonalityConfig = {
  loadingStates: [
    'Loading...',
    'Processing...',
    'Calculating...',
    'Working...',
    'Analyzing...'
  ],

  successMessages: [
    'Done.',
    'Complete.',
    'Success.',
    'Confirmed.',
    'Saved.'
  ],

  errorMessages: [
    'Error. Retry?',
    'Failed.',
    'Issue detected.',
    'Not working.',
    'Try again.'
  ],

  emptyStates: [
    'Nothing yet.',
    'Waiting...',
    'In progress.',
    'Pending.',
    'Coming soon.'
  ],

  transitionPhrases: [
    'Next:',
    'Also:',
    'Note:',
    'Then:',
    'After:'
  ]
}

const CONFIGS: Record<PersonalityMode, PersonalityConfig> = {
  playful: PLAYFUL_CONFIG,
  professional: PROFESSIONAL_CONFIG,
  concise: CONCISE_CONFIG
}

/**
 * Get a random message from a category
 */
export function getPersonalityMessage(
  mode: PersonalityMode,
  category: keyof PersonalityConfig
): string {
  const config = CONFIGS[mode]
  const messages = config[category]
  return messages[Math.floor(Math.random() * messages.length)]
}

/**
 * Format Wells AI fee with personality
 */
export function formatFeeMessage(
  fee: number,
  mode: PersonalityMode = 'playful'
): string {
  const feeStr = fee.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

  if (mode === 'playful') {
    const options = [
      `Our tiny 33bps slice: ${feeStr} (we gotta keep the lights on somehow 💡)`,
      `Platform magic fee: ${feeStr} (0.33%—barely noticeable, highly effective)`,
      `Wells AI take: ${feeStr} (33 basis points of pure connection power)`,
      `The matchmaker's cut: ${feeStr} (worth every penny, we promise)`,
      `Transaction fee: ${feeStr} (less than your morning coffee ☕)`
    ]
    return options[Math.floor(Math.random() * options.length)]
  }

  if (mode === 'professional') {
    return `Wells AI Fee: ${feeStr} (0.33%)`
  }

  return `Fee: ${feeStr}`
}

/**
 * Format quote count with personality
 */
export function formatQuoteCount(
  count: number,
  mode: PersonalityMode = 'playful'
): string {
  if (count === 0) {
    return getPersonalityMessage(mode, 'emptyStates')
  }

  if (mode === 'playful') {
    if (count === 1) {
      return 'One brave supplier stepped up! 🎯'
    }
    if (count === 2) {
      return 'Two suppliers dueling for your business! ⚔️'
    }
    const options = [
      `Look at you, ${count} suppliers fighting for your business! 🎯`,
      `${count} contenders have entered the arena...`,
      `The marketplace has spoken—${count} quotes ready for you!`,
      `${count} suppliers said "yes please!" to your request`,
      `You've got ${count} options. The power is yours! 💪`
    ]
    return options[Math.floor(Math.random() * options.length)]
  }

  if (mode === 'professional') {
    return `${count} ${count === 1 ? 'quote' : 'quotes'} received`
  }

  return `${count} quotes`
}

/**
 * Format tithe message (10% giving)
 */
export function formatTitheMessage(
  tithe: number,
  mode: PersonalityMode = 'playful'
): string {
  const titheStr = tithe.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

  if (mode === 'playful') {
    return `First fruits (10% tithe): ${titheStr}—building tabernacles, not unicorns 🏛️`
  }

  if (mode === 'professional') {
    return `Charitable contribution (10%): ${titheStr}`
  }

  return `Tithe: ${titheStr}`
}

/**
 * Get time-based greeting
 */
export function getGreeting(mode: PersonalityMode = 'playful'): string {
  const hour = new Date().getHours()

  if (mode === 'playful') {
    if (hour < 12) {
      const options = [
        'Good morning! ☀️',
        'Rise and shine!',
        'Morning! Let\'s make some deals.',
        'Top of the morning to you!',
        'Hello, early bird! 🐦'
      ]
      return options[Math.floor(Math.random() * options.length)]
    }
    if (hour < 18) {
      const options = [
        'Good afternoon! ☕',
        'Afternoon! Ready to procure?',
        'Hey there!',
        'Welcome back!',
        'Perfect timing!'
      ]
      return options[Math.floor(Math.random() * options.length)]
    }
    const options = [
      'Good evening! 🌙',
      'Evening! Still working hard?',
      'Hello, night owl! 🦉',
      'Burning the midnight oil?',
      'Welcome! Procurement never sleeps.'
    ]
    return options[Math.floor(Math.random() * options.length)]
  }

  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

/**
 * Get a random transition phrase
 */
export function getTransition(mode: PersonalityMode = 'playful'): string {
  return getPersonalityMessage(mode, 'transitionPhrases')
}
