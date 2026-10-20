/**
 * In-memory deal agent. Mock data only. No network, no money movement.
 * Both people must confirm before a deal settles.
 * Private walk-away prices and private notes never cross to the other person.
 * Fee is 33 bps of the total, paid by the seller.
 */

export const FEE_BPS = 33

export type Side = 'buy' | 'sell'
export type Visibility = 'shareable' | 'private' | 'never-shared'
export type MemoryLayer = 'profile' | 'preferences' | 'relationship'

export interface MemoryItem {
  id: string
  layer: MemoryLayer
  text: string
  visibility: Visibility
  createdAt: string
  source: 'seed' | 'user' | 'chat'
}

export interface AgentProfile {
  agentId: string
  name: string
  personality: string
}

export interface Person {
  userId: string
  name: string
  business: string
  agent: AgentProfile
  memory: MemoryItem[]
  intents: Intent[]
}

export interface Intent {
  intentId: string
  userId: string
  side: Side
  category: string
  qtyMin: number
  qtyMax: number
  unit: string
  priceMinCents: number
  priceMaxCents: number
  region: string
  windowFrom: string
  windowTo: string
  approved: boolean
  status: 'draft' | 'approved'
}

export interface Match {
  matchId: string
  buyUserId: string
  sellUserId: string
  buyIntentId: string
  sellIntentId: string
  category: string
  region: string
}

export interface SessionSummary {
  category: string
  qty: number
  unit: string
  unitPriceCents: number
  totalCents: number
  region: string
  windowFrom: string
  windowTo: string
  buyerName: string
  sellerName: string
  buyerBusiness: string
  sellerBusiness: string
  feeBps: number
  feePayer: 'seller'
  feeCents: number
}

export interface Session {
  sessionId: string
  matchId: string
  buyUserId: string
  sellUserId: string
  status: 'AWAITING_USER_CONFIRM' | 'SETTLED' | 'DECLINED'
  confirms: Record<string, 'approve' | 'decline'>
  summary: SessionSummary
  txRef?: string
  settlementStatus?: 'MOCK_SETTLED_NO_REAL_MONEY'
}

export interface World {
  users: Person[]
  matches: Match[]
  sessions: Session[]
  blocked: { field: string; fromUserId: string }[]
}

export interface PublicDeal {
  counterpartyName: string
  counterpartyBusiness: string
  counterpartyInitial: string
  totalCents: number
  qty: number
  unit: string
  category: string
  unitPriceCents: number
  windowFrom: string
  windowTo: string
  youPayOrReceive: 'pay' | 'receive'
  amountCents: number
  feeCents: number
  feePaidByYou: boolean
  simulated: true
}

const FORBIDDEN = new Set([
  'walk_away_price',
  'reservation_price',
  'walkaway_price',
  'personal_memory',
  'relationship_memory',
  'walk_away',
  'reservation',
  'price_min_cents',
  'price_max_cents',
  'pricemincents',
  'pricemaxcents',
])

let seq = 0
function nid(prefix: string): string {
  seq += 1
  return `${prefix}-${seq.toString(36)}`
}

export function resetIds(): void {
  seq = 0
}

export function feeCents(totalCents: number): number {
  return Math.floor((totalCents * FEE_BPS + 5000) / 10000)
}

export function findForbidden(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findForbidden(item)
      if (found) return found
    }
    return null
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN.has(key.toLowerCase().replace(/[^a-z0-9_]/g, ''))) return key
      const found = findForbidden(child)
      if (found) return found
    }
  }
  return null
}

export function seedWorld(): World {
  const memory = (
    layer: MemoryLayer,
    text: string,
    visibility: Visibility
  ): MemoryItem => ({
    id: nid('mem'),
    layer,
    text,
    visibility,
    createdAt: '2026-10-17T21:29:46.000Z',
    source: 'seed',
  })

  const lena: Person = {
    userId: 'lena',
    name: 'Lena Ortiz',
    business: "Lena's Bakery",
    agent: { agentId: 'agent-pip', name: 'Pip', personality: 'warm, curious, a bit witty' },
    memory: [
      memory('profile', 'Bakery owner, buys bread flour, US-Southeast', 'shareable'),
      memory('preferences', 'Prefers weekday-morning delivery', 'private'),
      memory('relationship', 'Training her niece to run Saturday market days', 'never-shared'),
    ],
    intents: [],
  }

  const tomas: Person = {
    userId: 'tomas',
    name: 'Tomas Reed',
    business: 'Tomas Mill',
    agent: { agentId: 'agent-juno', name: 'Juno', personality: 'direct, dry humor' },
    memory: [
      memory('profile', 'Miller, sells bread flour, US-Southeast', 'shareable'),
      memory('preferences', 'Prefers orders of 100+ bags', 'private'),
      memory('relationship', 'Saving for a second delivery van', 'never-shared'),
    ],
    intents: [],
  }

  return { users: [lena, tomas], matches: [], sessions: [], blocked: [] }
}

function user(world: World, id: string): Person {
  const found = world.users.find((u) => u.userId === id)
  if (!found) throw new Error('user not found')
  return found
}

export interface IntentInput {
  userId: string
  side: Side
  category: string
  qtyMin: number
  qtyMax: number
  unit?: string
  priceMinCents: number
  priceMaxCents: number
  region: string
  windowFrom: string
  windowTo: string
}

export function addIntent(world: World, input: IntentInput): { world: World; intentId: string } {
  const next = structuredClone(world)
  const person = user(next, input.userId)
  const intent: Intent = {
    intentId: nid('intent'),
    userId: person.userId,
    side: input.side,
    category: input.category,
    qtyMin: input.qtyMin,
    qtyMax: input.qtyMax,
    unit: input.unit || 'bag',
    priceMinCents: input.priceMinCents,
    priceMaxCents: input.priceMaxCents,
    region: input.region,
    windowFrom: input.windowFrom,
    windowTo: input.windowTo,
    approved: false,
    status: 'draft',
  }
  person.intents.push(intent)
  return { world: next, intentId: intent.intentId }
}

export function approveIntent(world: World, intentId: string): World {
  const next = structuredClone(world)
  for (const person of next.users) {
    const intent = person.intents.find((item) => item.intentId === intentId)
    if (intent) {
      intent.approved = true
      intent.status = 'approved'
      return next
    }
  }
  throw new Error('intent not found')
}

function overlap(a1: number, a2: number, b1: number, b2: number): boolean {
  return Math.max(a1, b1) <= Math.min(a2, b2)
}

export function runMatching(world: World): World {
  const next = structuredClone(world)
  const intents: { person: Person; intent: Intent }[] = []
  for (const person of next.users) {
    for (const intent of person.intents) {
      if (intent.approved && intent.status === 'approved') intents.push({ person, intent })
    }
  }
  const buys = intents.filter((item) => item.intent.side === 'buy')
  const sells = intents.filter((item) => item.intent.side === 'sell')
  for (const buy of buys) {
    for (const sell of sells) {
      if (buy.person.userId === sell.person.userId) continue
      const bi = buy.intent
      const si = sell.intent
      if (bi.category.toLowerCase() !== si.category.toLowerCase()) continue
      if (bi.region.toLowerCase() !== si.region.toLowerCase()) continue
      if (!overlap(bi.qtyMin, bi.qtyMax, si.qtyMin, si.qtyMax)) continue
      if (!overlap(bi.priceMinCents, bi.priceMaxCents, si.priceMinCents, si.priceMaxCents)) continue
      if (!(bi.windowFrom <= si.windowTo && si.windowFrom <= bi.windowTo)) continue
      if (next.matches.some((m) => m.buyIntentId === bi.intentId && m.sellIntentId === si.intentId)) continue
      next.matches.push({
        matchId: nid('match'),
        buyUserId: buy.person.userId,
        sellUserId: sell.person.userId,
        buyIntentId: bi.intentId,
        sellIntentId: si.intentId,
        category: bi.category,
        region: bi.region,
      })
    }
  }
  return next
}

export function openSession(world: World, matchId: string): { world: World; session: Session } {
  const next = structuredClone(world)
  const existing = next.sessions.find((s) => s.matchId === matchId && s.status !== 'DECLINED')
  if (existing) return { world: next, session: existing }

  const match = next.matches.find((m) => m.matchId === matchId)
  if (!match) throw new Error('match not found')
  const buyer = user(next, match.buyUserId)
  const seller = user(next, match.sellUserId)
  const bi = buyer.intents.find((i) => i.intentId === match.buyIntentId)
  const si = seller.intents.find((i) => i.intentId === match.sellIntentId)
  if (!bi || !si) throw new Error('intent not found')

  const qtyLo = Math.max(bi.qtyMin, si.qtyMin)
  const qtyHi = Math.min(bi.qtyMax, si.qtyMax)
  const qty = Math.floor((qtyLo + qtyHi) / 2)
  const priceLo = Math.max(bi.priceMinCents, si.priceMinCents)
  const priceHi = Math.min(bi.priceMaxCents, si.priceMaxCents)
  const agreed = Math.floor((priceLo + priceHi) / 2)
  const total = qty * agreed

  const crossed = {
    category: bi.category,
    qty,
    unit: bi.unit,
    unitPriceCents: agreed,
    region: bi.region,
    windowFrom: bi.windowFrom > si.windowFrom ? bi.windowFrom : si.windowFrom,
    windowTo: bi.windowTo < si.windowTo ? bi.windowTo : si.windowTo,
  }
  const leaked = findForbidden(crossed)
  if (leaked) throw new Error(`private field blocked: ${leaked}`)

  const summary: SessionSummary = {
    ...crossed,
    totalCents: total,
    buyerName: buyer.name,
    sellerName: seller.name,
    buyerBusiness: buyer.business,
    sellerBusiness: seller.business,
    feeBps: FEE_BPS,
    feePayer: 'seller',
    feeCents: feeCents(total),
  }

  const session: Session = {
    sessionId: nid('sess'),
    matchId: match.matchId,
    buyUserId: buyer.userId,
    sellUserId: seller.userId,
    status: 'AWAITING_USER_CONFIRM',
    confirms: {},
    summary,
  }
  next.sessions.push(session)
  return { world: next, session }
}

export function confirmSession(
  world: World,
  sessionId: string,
  userId: string,
  decision: 'approve' | 'decline'
): { world: World; session: Session } {
  const next = structuredClone(world)
  const session = next.sessions.find((s) => s.sessionId === sessionId)
  if (!session) throw new Error('session not found')
  if (userId !== session.buyUserId && userId !== session.sellUserId) {
    throw new Error('not a party')
  }
  if (session.status === 'SETTLED' || session.status === 'DECLINED') {
    throw new Error(`session already ${session.status}`)
  }
  if (decision === 'decline') {
    session.confirms[userId] = 'decline'
    session.status = 'DECLINED'
    return { world: next, session }
  }
  session.confirms[userId] = 'approve'
  const both =
    session.confirms[session.buyUserId] === 'approve' &&
    session.confirms[session.sellUserId] === 'approve'
  if (both) {
    const tx = `mock-grain-${hash16(`${session.sessionId}:${session.summary.totalCents}`)}`
    session.status = 'SETTLED'
    session.txRef = tx
    session.settlementStatus = 'MOCK_SETTLED_NO_REAL_MONEY'
  }
  return { world: next, session }
}

function hash16(input: string): string {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(16).padStart(8, '0').slice(0, 16)
}

export function publicDeal(session: Session, viewerId: string): PublicDeal {
  const summary = session.summary
  const isBuyer = viewerId === session.buyUserId
  const deal: PublicDeal = {
    counterpartyName: isBuyer ? summary.sellerName : summary.buyerName,
    counterpartyBusiness: isBuyer ? summary.sellerBusiness : summary.buyerBusiness,
    counterpartyInitial: (isBuyer ? summary.sellerName : summary.buyerName).slice(0, 1),
    totalCents: summary.totalCents,
    qty: summary.qty,
    unit: summary.unit,
    category: summary.category,
    unitPriceCents: summary.unitPriceCents,
    windowFrom: summary.windowFrom,
    windowTo: summary.windowTo,
    youPayOrReceive: isBuyer ? 'pay' : 'receive',
    amountCents: isBuyer ? summary.totalCents : summary.totalCents - summary.feeCents,
    feeCents: summary.feeCents,
    feePaidByYou: !isBuyer,
    simulated: true,
  }
  const leaked = findForbidden(deal)
  if (leaked) throw new Error(`private field blocked: ${leaked}`)
  return deal
}

export function attemptCross(world: World, fromUserId: string, payload: unknown): { ok: boolean; field?: string } {
  const field = findForbidden(payload)
  if (!field) return { ok: true }
  const next = world
  next.blocked.push({ field, fromUserId })
  return { ok: false, field }
}

export function remember(world: World, userId: string, text: string): World {
  const next = structuredClone(world)
  const person = user(next, userId)
  person.memory.push({
    id: nid('mem'),
    layer: 'relationship',
    text,
    visibility: 'never-shared',
    createdAt: new Date().toISOString(),
    source: 'chat',
  })
  return next
}

export function updateMemory(world: World, userId: string, memoryId: string, text: string): World {
  const next = structuredClone(world)
  const person = user(next, userId)
  const item = person.memory.find((m) => m.id === memoryId)
  if (!item) throw new Error('memory not found')
  item.text = text
  return next
}

export function removeMemory(world: World, userId: string, memoryId: string): World {
  const next = structuredClone(world)
  const person = user(next, userId)
  const before = person.memory.length
  person.memory = person.memory.filter((m) => m.id !== memoryId)
  if (person.memory.length === before) throw new Error('memory not found')
  return next
}

/** What this person may see. Never includes the other person's private notes or prices. */
export function visibleMemory(world: World, userId: string): MemoryItem[] {
  return user(world, userId).memory.map((item) => ({ ...item }))
}

export function replyTo(world: World, userId: string, message: string): { reply: string; world: World } {
  const person = user(world, userId)
  const text = message.trim()
  const lower = text.toLowerCase()
  if (lower.startsWith('remember ')) {
    const note = text.slice(9).trim()
    const next = remember(world, userId, note || text)
    return {
      world: next,
      reply: `I'll remember that privately, ${person.name.split(' ')[0]}. It never leaves your agent.`,
    }
  }
  if (lower.includes('buy') || lower.includes('sell') || lower.includes('flour')) {
    return {
      world,
      reply: `I'm ${person.agent.name}, your agent. I only match on what you approve, and nothing settles until both of you say yes.`,
    }
  }
  if (lower.includes('know') || lower.includes('memory') || lower.includes('remember')) {
    return {
      world,
      reply: `I hold ${person.memory.length} notes for you. Locked ones stay with you. The other person never sees them.`,
    }
  }
  return {
    world,
    reply: `I'm ${person.agent.name}. Tell me what you need, or say “remember …” if something should stay private.`,
  }
}

export const FLOUR_WINDOWS = {
  category: 'bread flour',
  region: 'US-Southeast',
  unit: 'bag',
  windowFrom: '2026-10-26',
  windowTo: '2026-11-06',
}

/** The scripted introduction. Private price bands never leave each person. */
export function findFlour(world: World): { world: World; session: Session } {
  let current = world
  const lena = addIntent(current, {
    userId: 'lena',
    side: 'buy',
    ...FLOUR_WINDOWS,
    qtyMin: 150,
    qtyMax: 250,
    priceMinCents: 3500,
    priceMaxCents: 4000,
  })
  current = approveIntent(lena.world, lena.intentId)
  const tomas = addIntent(current, {
    userId: 'tomas',
    side: 'sell',
    ...FLOUR_WINDOWS,
    qtyMin: 100,
    qtyMax: 300,
    priceMinCents: 3700,
    priceMaxCents: 3900,
  })
  current = approveIntent(tomas.world, tomas.intentId)
  current = runMatching(current)
  const match = current.matches.find(
    (item) => item.buyIntentId === lena.intentId && item.sellIntentId === tomas.intentId
  )
  if (!match) throw new Error('No one is selling right now.')
  return openSession(current, match.matchId)
}

export function privateNumbers(world: World, userId: string): number[] {
  const person = user(world, userId)
  return person.intents.flatMap((intent) => [intent.priceMinCents, intent.priceMaxCents])
}
