import {
  confirmSession,
  feeCents,
  findFlour,
  findForbidden,
  privateNumbers,
  publicDeal,
  resetIds,
  seedWorld,
  visibleMemory,
  attemptCross,
} from '../lib/grain-agent/engine'

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message)
}

resetIds()
const world = seedWorld()
const found = findFlour(world)
const session = found.session

assert(session.summary.qty === 200, 'qty')
assert(session.summary.unitPriceCents === 3800, 'price')
assert(session.summary.totalCents === 760000, 'total')
assert(session.summary.feeCents === 2508, 'fee')
assert(feeCents(760000) === 2508, 'fee fn')
assert(session.summary.feeBps === 33, 'bps')
assert(session.summary.feePayer === 'seller', 'payer')
assert(session.status === 'AWAITING_USER_CONFIRM', 'awaiting')

const lenaView = publicDeal(session, 'you')
const tomasView = publicDeal(session, 'mill')
assert(lenaView.youPayOrReceive === 'pay', 'lena pays')
assert(lenaView.amountCents === 760000, 'lena amount')
assert(tomasView.youPayOrReceive === 'receive', 'tomas receives')
assert(tomasView.amountCents === 760000 - 2508, 'tomas net')
assert(lenaView.feePaidByYou === false, 'seller pays, not lena')
assert(tomasView.feePaidByYou === true, 'seller pays')

const lenaJson = JSON.stringify(lenaView)
const tomasJson = JSON.stringify(tomasView)
for (const n of [3500, 4000, 3700, 3900]) {
  assert(!lenaJson.includes(String(n)), `lena view leaked ${n}`)
  assert(!tomasJson.includes(String(n)), `tomas view leaked ${n}`)
}
assert(findForbidden(lenaView) === null, 'lena clean')
assert(findForbidden(tomasView) === null, 'tomas clean')

const lenaNotes = visibleMemory(found.world, 'you').map((m) => m.text).join(' ')
const tomasNotes = visibleMemory(found.world, 'mill').map((m) => m.text).join(' ')
assert(!lenaNotes.includes('delivery van'), 'lena cannot see tomas note')
assert(!tomasNotes.includes('niece'), 'tomas cannot see lena note')
assert(!lenaJson.includes('niece') && !lenaJson.includes('van'), 'deal hides notes')

const one = confirmSession(found.world, session.sessionId, 'you', 'approve')
assert(one.session.status === 'AWAITING_USER_CONFIRM', 'one confirm is not enough')
assert(!one.session.txRef, 'no settlement yet')

const declined = confirmSession(found.world, session.sessionId, 'mill', 'decline')
assert(declined.session.status === 'DECLINED', 'decline stops it')
assert(!declined.session.txRef, 'decline does not settle')

const both = confirmSession(one.world, session.sessionId, 'mill', 'approve')
assert(both.session.status === 'SETTLED', 'both confirm settles')
assert(both.session.settlementStatus === 'MOCK_SETTLED_NO_REAL_MONEY', 'mock')
assert(both.session.txRef?.startsWith('mock-grain-'), 'mock ref')

const blocked = attemptCross(found.world, 'mill', { walk_away_price: 3700, note: 'hi' })
assert(blocked.ok === false && blocked.field === 'walk_away_price', 'walk-away blocked')

const bands = privateNumbers(found.world, 'you')
assert(bands.includes(4000) && bands.includes(3500), 'private bands stay on the person')

console.log('grain agent checks passed')
