# Wells AI - Onboarding Flow Examples

Real conversation examples showing how onboarding feels in practice.

---

## Example 1: Buyer Journey (Electronics Procurement)

### PHASE 1: Introduction (Messages 1-3)

**Message 1:**
```
User: "I need help sourcing electronics components"

Wells: "On it. Tell me more about what you're looking for."
```

**Message 2:**
```
User: "We need custom PCB boards, about 500 units, for a new
product line we're launching"

Wells: "Got it. By the way, what should I call you?"
```

**Message 3:**
```
User: "I'm Sarah, I'm the Head of Procurement at TechCorp"

Wells: "Great to meet you, Sarah. I'm Wells. Let me find you some
suppliers who can handle that volume. What's your timeline and
any specific requirements?"
```

**State after Phase 1:**
- ✅ Name: Sarah
- ✅ Preferred name: Sarah
- ✅ Company: TechCorp
- ✅ Role: Head of Procurement
- ✅ Journey: buyer
- ✅ Pain point: Sourcing custom PCBs
- ✅ Trust score: 15
- ✅ Phase: first_win

---

### PHASE 2: First Win (Messages 4-7)

**Message 4:**
```
User: "We need them in 6 weeks, needs to be UL certified, and
budget is around $25k total"

Wells: "Found 3 suppliers who can do UL-certified PCBs in that
timeframe. Here's what I'm seeing:

1. CircuitMasters - $21k, 4 weeks, A+ rating
2. BoardPro - $23.5k, 5 weeks, verified supplier
3. TechBoards Inc - $24k, 4 weeks, new but good reviews

Want me to negotiate with all three and get you the best deal?"
```

**Message 5:**
```
User: "Yes! Focus on CircuitMasters and BoardPro. What kind of
pricing can you get?"

Wells: "On it. I'll negotiate pricing, delivery terms, and
quality guarantees. Should have responses for you within an hour.
In the meantime, do you have technical specs I should send them?"
```

**Message 6:**
```
User: "Yes, I'll send the specs. This is already so much faster
than our normal process!"

Wells: "That's the idea! Just sent both suppliers your requirements.
They're both interested and coming back with detailed quotes.

Quick question - for future orders, would you want me to
automatically find suppliers when you have a need, or would you
prefer to approve each search?"
```

**Message 7:**
```
User: "Automatic would be amazing. But I'd want to approve any
deals over $50k"

Wells: "Perfect. I'll handle sourcing automatically and flag
anything over $50k for your approval. Got quotes back:

CircuitMasters: $19,500 (negotiated down from $21k), 4 weeks
BoardPro: $22k, 5 weeks, includes free revision

CircuitMasters is the better deal. Want me to move forward with them?"
```

**State after Phase 2:**
- ✅ First RFQ created
- ✅ First suppliers matched
- ✅ First negotiation completed
- ✅ Approval threshold set: $50k
- ✅ Goal identified: Faster procurement process
- ✅ Trust score: 40
- ✅ Milestone: first_supplier_match
- ✅ Phase: integration

---

### PHASE 3: Integration (Messages 8-15)

**Message 8:**
```
User: "Yes, let's go with CircuitMasters"

Wells: "Done! Contract sent to CircuitMasters. They'll have it
signed by EOD.

I can handle the payment automatically if you connect your bank
account. Takes 2 minutes and then you never have to think about
B2B payments again. Want me to send you the link?"
```

**Message 9:**
```
User: "Sure, send it over"

Wells: [Sends Plaid Link]

Wells: "Click that link and follow the prompts. I'll wait here."
```

**Message 10:**
```
User: [Connects bank account via Plaid]

Wells: "Perfect! Bank connected. Now I can:
- Handle all payments automatically
- Track invoices and receipts
- Your money earns 4.5% APY while in escrow
- Give you instant settlement (1-2 days vs 30-45)

Payment to CircuitMasters will go out once they ship, and I'll
release it once you confirm receipt. Sound good?"
```

**Message 11:**
```
User: "That's incredible. Our current process takes 45 days to
pay suppliers. How does this work?"

Wells: "We use GRAIN & Vault. Money sits in escrow earning yield
while we verify delivery. Once you confirm you got the PCBs, I
release payment to CircuitMasters. They get paid in 1-2 days, you
get yield on your capital, and I handle all the paperwork.

Your $19,500 will earn about $24 in interest just during the
escrow period. On larger deals, it adds up fast."
```

**Message 12:**
```
User: "I love this. Do you integrate with our ERP? We use NetSuite"

Wells: "Yes! I can sync with NetSuite so all your transactions
flow automatically into your purchasing system. Want me to set
that up?"
```

**Message 13:**
```
User: "Let me talk to our IT team about that. For now, can you
just keep me updated on this order?"

Wells: "Of course. I'll update you when:
- CircuitMasters signs the contract
- They start production
- They ship
- Delivery confirmed
- Payment released

You'll always know exactly where things stand."
```

**Message 14:**
```
[Next day]

Wells: "Update: CircuitMasters signed the contract and started
production. ETA for delivery: 3.5 weeks. Right on schedule."

User: "Thanks! This is so much easier than chasing suppliers
over email"
```

**Message 15:**
```
Wells: "That's what I'm here for. By the way, I noticed TechCorp
probably needs other components too. Want me to proactively watch
for good deals on things you buy regularly?

I can learn your patterns and bring opportunities to you before
you even need to ask."
```

**State after Phase 3:**
- ✅ Bank connected
- ✅ First deal in progress
- ✅ Payment automation enabled
- ✅ Trust score: 70
- ✅ Milestones: bank_connected, first_deal
- ✅ Phase: relationship

---

### PHASE 4: Relationship (Messages 16+)

**Message 16:**
```
User: "Yes! We use a lot of capacitors, resistors, and LED
components. Can you track those?"

Wells: "On it. I'll monitor pricing and availability for those
categories. When I see good deals or if prices spike, I'll let
you know.

Also, based on your product launch timeline, you'll probably need
another PCB order in about 3 months for production scale-up. Want
me to start lining up suppliers now so we're ready when you need
them?"
```

**Message 17:**
```
User: "You're already thinking ahead. I like that."

Wells: "That's my job. I've got your back."
```

**State after Phase 4:**
- ✅ Trust score: 85
- ✅ Conversation depth: 8
- ✅ Onboarding complete
- ✅ Milestone: companion_status
- ✅ Phase: complete

---

## Example 2: Seller Journey (Software Services)

### PHASE 1: Introduction

**Message 1:**
```
User: "I want to sell my software development services to more companies"

Wells: "Got it. Tell me about what you offer."
```

**Message 2:**
```
User: "We build custom AI solutions for mid-market companies. Our
sweet spot is companies doing $10M-$100M in revenue who need
intelligent automation but don't have the in-house ML expertise"

Wells: "That's a specific niche - good. What should I call you?"
```

**Message 3:**
```
User: "I'm David, founder of AI Solutions Co"

Wells: "Great to meet you, David. I can help you find companies
that fit your ideal customer profile. What's been your biggest
challenge in finding new customers so far?"
```

**State:** Journey identified as seller, name captured, pain point being explored.

---

### PHASE 2: First Win

**Message 4:**
```
User: "Honestly, outbound is brutal. Cold email response rates
are terrible, and I don't have time to do it at scale"

Wells: "I can handle that for you. I'll find companies that match
your criteria, craft personalized outreach, and only bring you
conversations with interested buyers. Want me to show you what
that looks like?"
```

**Message 5:**
```
User: "Yes, show me"

Wells: "I found 23 companies in your revenue range who are
actively looking for AI/ML solutions right now. Here are 3:

1. HealthTech Corp - Looking to automate claims processing
2. LogiFlow - Need inventory prediction ML
3. FinServe Inc - Want fraud detection AI

Want me to reach out to all 23, or should I focus on certain
industries?"
```

**Message 6:**
```
User: "Healthcare and logistics are our best verticals. Focus there"

Wells: "Smart. That's 14 companies. I'll craft personalized
messages for each one mentioning their specific use cases. Should
have responses within 48 hours.

What's your availability if they want to schedule a call?"
```

**State:** First opportunities identified, outreach campaign ready to launch.

---

### PHASE 3: Integration

**Message 8:**
```
Wells: "Got 3 responses already:
- HealthTech wants a call next Tuesday
- LogiFlow asked for a capabilities deck
- MedDevice Co (wasn't on the original list but heard about us)

I can handle your calendar if you connect it. When someone wants
a meeting, I'll find a time that works for both of you automatically.
Want to connect your calendar?"
```

**Message 9:**
```
User: "Yes! I use Google Calendar"

Wells: [Sends Google Calendar integration link]
```

**Message 10:**
```
Wells: "Calendar connected. HealthTech call scheduled for Tuesday
at 2pm. I sent them a calendar invite with a video link and an
agenda. You're all set.

Also created a capabilities deck for LogiFlow based on your
website. Want to review it before I send?"
```

**State:** Calendar integrated, meetings being booked, Wells handling logistics.

---

### PHASE 4: Relationship

**Message 15:**
```
[After first deal closes]

Wells: "HealthTech signed! $85k contract, 3-month project. I've
set up the payment escrow - you'll get paid in milestones as you
hit deliverables. First payment ($28k) releases when you finish
the discovery phase.

By the way, companies like HealthTech usually have other divisions
with similar needs. Want me to explore expansion opportunities
there?"
```

**State:** First deal closed, Wells anticipating next opportunities.

---

## Example 3: Job Seeker Journey (Career Transition)

### PHASE 1: Introduction

**Message 1:**
```
User: "I'm looking for work. Just got laid off from my architecture job"

Wells: "I'm sorry to hear that. Tell me about what you did and
what you're looking for next."
```

**Message 2:**
```
User: "I was a mid-level architect specializing in sustainable
design. I love it, but jobs are scarce right now with all the
AI stuff happening in the industry"

Wells: "What's your name?"
```

**Message 3:**
```
User: "Michael"

Wells: "Nice to meet you, Michael. Tell me about a project you're
proud of - something where you really made a difference."
```

**State:** Understanding skills and passion, building rapport.

---

### PHASE 2: First Win

**Message 4:**
```
User: "I designed a net-zero community center that cut energy
costs by 80%. I'm really proud of how we integrated passive solar
with modern materials"

Wells: "That's impressive. I'm seeing two paths for you:

Path 1: Traditional architecture roles (3 openings that match)
Path 2: Something you might not have considered...

There's massive demand for sustainable design consultants who can
help existing buildings retrofit for efficiency. Your expertise
in net-zero design is exactly what facility managers need. Less
competition, better pay, more freedom.

Want to explore both?"
```

**Message 5:**
```
User: "The consulting path sounds interesting. I hadn't thought
about that"

Wells: "Let me show you what that could look like. I found 8
facility managers at companies with 100+ buildings who have
sustainability goals but no expertise. Want me to reach out and
see if they'd pay for your consulting?"
```

**Message 6:**
```
User: "Would they actually pay for that? I don't have a consulting
business set up"

Wells: "They would. I can help you set it up - contract templates,
pricing, everything. But first, let's validate demand. Want me to
reach out to 3 of these companies and see what they say?"
```

**State:** Creative career path identified, opportunity being validated.

---

### PHASE 3: Integration

**Message 10:**
```
Wells: "Got responses from all 3:
- Building Services Corp: Wants to talk, has 200 locations
- FacilityPro: Asked for pricing
- GreenBuildings Inc: Not right now but asked to stay in touch

Want me to help you figure out pricing and set up a call with
Building Services Corp?"
```

**State:** Opportunities validated, transitioning from job seeker to consultant.

---

### PHASE 4: Relationship

**Message 15:**
```
Wells: "Building Services Corp wants to pilot with 10 buildings
at $5k each. That's $50k for 3 months of work. I drafted a
consulting agreement - want to review it before we send?"

User: "This is amazing. Three weeks ago I was unemployed, now
I'm starting a consulting business"

Wells: "And this is just the beginning. Once you prove it with
their 10 buildings, they'll probably want all 200. That's the
power of finding where your skills are most valuable.

I've got your back. Always."
```

**State:** Career transformed, Wells as trusted advisor.

---

## Key Emotional Moments Across All Journeys

### The "Wow" Moment
When Wells delivers results faster than expected:
> "Got 3 responses already..."
> "Found 23 companies..."
> "Negotiated down from $21k to $19.5k..."

### The "Trust" Moment
When Wells handles something complex automatically:
> "Payment to CircuitMasters will go out once they ship..."
> "I drafted a consulting agreement..."
> "Calendar connected. Meeting scheduled..."

### The "Companion" Moment
When Wells anticipates needs:
> "You'll probably need another PCB order in 3 months..."
> "Want me to explore expansion opportunities?"
> "I've got your back. Always."

---

## Testing These Flows

1. **Start a fresh conversation** (clear session)
2. **Follow the example flows** using the user messages
3. **Verify Wells responds** in a similar conversational style
4. **Check state transitions** happen at the right times
5. **Confirm milestones** are awarded appropriately
6. **Feel the emotional beats** - does it feel like making a friend?

---

**The Goal:**

By the end of onboarding, the user should be thinking:

> "I don't know how I worked without Wells."

That's legendary onboarding.
