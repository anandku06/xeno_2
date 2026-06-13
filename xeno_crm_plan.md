# Xeno Mini CRM — Full Walkthrough Plan

> SDE Internship Assignment | Deadline: June 15, 2026, 12 PM

---

## Product angle

Build a **natural language-first campaign builder**. The marketer types intent in plain English → AI parses it into a segment → AI drafts the message → campaign fires → async callbacks populate live stats. One opinionated flow, executed deeply.

---

## Tech stack

| Layer | Choice | Reason |
|---|---|---|
| Frontend | Next.js 14 (App Router) + Tailwind | Fast to ship, clean UI, SSR for stats pages |
| CRM API | Node.js + Express + TypeScript | Familiar, lightweight, great BullMQ support |
| AI layer | Claude API (Anthropic) | Segment parsing + message copy generation |
| Database | PostgreSQL 15 (Neon — serverless) | Relational, perfect for RFM queries, free prod tier |
| Job queue | BullMQ + Redis (Upstash) | Async fan-out, concurrency control, retries |
| Channel stub | Separate Express service | As assignment demands — different port + deployment |
| Deployment | Vercel (frontend) + Railway (API + stub) | Free tier, fast CI/CD, no ops overhead |
| Monorepo | Turborepo | Shared types between services, one repo to submit |

---

## System architecture

```
┌──────────────────────── CRM Service ─────────────────────────┐
│                                                               │
│  ┌─────────────────┐      ┌──────────────────┐               │
│  │  Next.js UI     │ ───▶ │  Express API      │               │
│  │  Campaign builder│      │  REST endpoints   │               │
│  └─────────────────┘      └────────┬─────────┘               │
│                                    │                           │
│              ┌─────────────────────┼──────────────────┐       │
│              ▼                     ▼                   ▼       │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐│
│  │  Claude API       │  │  PostgreSQL      │  │  BullMQ      ││
│  │  Segment + copy  │  │  Customers,      │  │  + Redis     ││
│  │  generation      │  │  campaigns       │  │  Send queue  ││
│  └──────────────────┘  └──────────────────┘  └──────┬───────┘│
│                                                       │        │
│                         ┌─────────────────────────────┘        │
│                         ▼                                       │
│              ┌──────────────────┐   ┌──────────────────┐       │
│              │  Campaign worker  │   │  Receipt handler │       │
│              │  Fan-out + send  │   │  Ingests callbacks│       │
│              └────────┬─────────┘   └──────────────────┘       │
│                       │                        ▲                │
└───────────────────────┼────────────────────────┼───────────────┘
                        │  POST /send             │ async POST /receipt
                        ▼                         │
┌──────────────────── Channel Stub ────────────────────────────┐
│                                                               │
│  ┌──────────────┐   ┌─────────────────┐   ┌───────────────┐ │
│  │  POST /send  │──▶│  Outcome        │──▶│  Callback     │ │
│  │  Accept job  │   │  simulator      │   │  dispatcher   │ │
│  │  → 202       │   │  Random delay   │   │  POST to CRM  │ │
│  └──────────────┘   │  + status       │   └───────────────┘ │
│                      └─────────────────┘                      │
└───────────────────────────────────────────────────────────────┘
```

---

## Data flow (DFD Level 1)

```
[Marketer] ──customer CSV──▶ (P1. Ingest data) ──write──▶ [D1: customers + orders]
[Marketer] ──NL query──────▶ (P2. AI segment)  ──reads──▶ [D1]
                                                ──write──▶ [D2: campaigns + recipients]
[Marketer] ──launch────────▶ (P3. Send campaign)──reads──▶ [D2]
                                                ──POST /send──▶ [Channel stub]
[Channel stub] ──async POST──▶ (P4. Callbacks)  ──write──▶ [D3: delivery events]
[D2 + D3] ─────────────────▶ (P5. Analytics)   ──stats──▶ [Marketer]
```

---

## Sequence: campaign send + async callback loop

```
Marketer     CRM API       BullMQ      Worker      Channel stub
   │             │             │           │              │
   │─POST /send─▶│             │           │              │
   │             │─enqueue N──▶│           │              │
   │◀──202───────│             │           │              │
   │             │             │─dequeue──▶│              │
   │             │             │           │─POST /send──▶│
   │             │             │           │◀──202────────│
   │             │◀─mark sent──│           │              │
   │             │             │           │   (2–10 s)   │
   │             │             │           │              │─simulate─┐
   │             │             │           │              │◀─────────┘
   │◀──stats─────│◀─POST /receipt──────────────────────────│
   │  (polling)  │─write event + update stats              │
```

---

## Database schema (ER)

```
customers
─────────────────────────────────────────
id            uuid        PK
name          varchar
email         varchar     UNIQUE
phone         varchar
city          varchar
created_at    timestamp

orders
─────────────────────────────────────────
id            uuid        PK
customer_id   uuid        FK → customers.id
total_amount  decimal
ordered_at    timestamp
status        varchar

campaigns
─────────────────────────────────────────
id            uuid        PK
name          varchar
channel       varchar     (whatsapp|sms|email|rcs)
status        varchar     (draft|sending|sent)
message_body  text
scheduled_at  timestamp
sent_at       timestamp
created_at    timestamp

segments
─────────────────────────────────────────
id            uuid        PK
campaign_id   uuid        FK → campaigns.id
name          varchar
rules         jsonb       [{field, operator, value}]
matched_count int

campaign_recipients
─────────────────────────────────────────
id            uuid        PK
campaign_id   uuid        FK → campaigns.id
customer_id   uuid        FK → customers.id
status        varchar     (queued|sent|delivered|opened|clicked|failed)
message_body  text        (personalised copy)
sent_at       timestamp

delivery_events
─────────────────────────────────────────
id            uuid        PK
recipient_id  uuid        FK → campaign_recipients.id
event_type    varchar     (sent|delivered|opened|clicked|failed)
metadata      jsonb
occurred_at   timestamp

Relationships:
customers     ||──o{   orders               (places)
customers     ||──o{   campaign_recipients  (receives)
campaigns     ||──||   segments             (has one)
campaigns     ||──o{   campaign_recipients  (targets)
campaign_recipients ||──o{  delivery_events (generates)
```

---

## Directory structure

```
xeno-crm/                          ← turborepo monorepo root
├── apps/
│   │
│   ├── crm-frontend/              ← Next.js 14 (App Router)
│   │   ├── app/
│   │   │   ├── (dashboard)/
│   │   │   │   └── page.tsx       ← overview + campaign list with stats
│   │   │   ├── customers/
│   │   │   │   └── page.tsx       ← searchable customer table
│   │   │   └── campaigns/
│   │   │       ├── page.tsx       ← all campaigns
│   │   │       ├── new/
│   │   │       │   └── page.tsx   ← AI campaign builder (main flow)
│   │   │       └── [id]/
│   │   │           └── page.tsx   ← live stats drilldown
│   │   ├── components/
│   │   │   ├── SegmentBuilder.tsx ← NL input + preview count
│   │   │   ├── MessageComposer.tsx← AI variants + editable textarea
│   │   │   ├── CampaignStats.tsx  ← live updating stats card
│   │   │   └── CustomerTable.tsx
│   │   └── next.config.ts
│   │
│   ├── crm-api/                   ← Express + Node.js + TypeScript
│   │   └── src/
│   │       ├── routes/
│   │       │   ├── customers.ts   ← GET, POST, bulk import
│   │       │   ├── campaigns.ts   ← CRUD + POST /:id/send
│   │       │   ├── segments.ts    ← POST /preview, POST /
│   │       │   └── receipt.ts     ← POST /receipt (callback ingestion)
│   │       ├── services/
│   │       │   ├── segmentEngine.ts  ← rules[] → parameterised SQL
│   │       │   ├── aiService.ts      ← Claude API: parse + generate
│   │       │   └── campaignSender.ts ← fan-out to BullMQ
│   │       ├── workers/
│   │       │   └── sendWorker.ts     ← BullMQ processor (concurrency: 5)
│   │       ├── db/
│   │       │   ├── client.ts         ← postgres connection
│   │       │   ├── migrations/       ← SQL migration files
│   │       │   └── seed.ts           ← Faker.js: 200 customers, 600 orders
│   │       └── app.ts
│   │
│   └── channel-stub/              ← Separate Express service (own deployment)
│       └── src/
│           ├── routes/
│           │   └── send.ts        ← POST /send → 202 Accepted
│           ├── simulator.ts       ← weighted random outcome + setTimeout delay
│           ├── callbackDispatcher.ts ← POST to CRM /receipt with retry
│           └── app.ts
│
├── packages/
│   └── shared-types/
│       └── index.ts               ← Campaign, Recipient, DeliveryEvent types
│
├── docker-compose.yml             ← postgres + redis for local dev
├── turbo.json
└── package.json
```

---

## Ordered execution plan

### Phase 1 — Foundation setup
**Day 1, morning**

1. Init turborepo monorepo with three workspaces: `crm-frontend`, `crm-api`, `channel-stub`
2. Write `docker-compose.yml` — PostgreSQL 15 + Redis 7
3. Write all 6 DB migration files (from schema above)
4. Run migrations, confirm schema
5. Write `seed.ts` using Faker.js — 200 customers with varied city, spend, recency; 500–800 orders
6. Run seed, inspect data in psql

> Tradeoff noted: using Neon (serverless Postgres) for prod — no ops, free tier, connection pooling built in.

---

### Phase 2 — Customer + order ingest API
**Day 1, afternoon**

7. Build `POST /customers` (single) and `POST /customers/bulk` (JSON array, or CSV parse via `csv-parse`)
8. Build `POST /orders` — link to customer by `customer_id`
9. Build `GET /customers` with pagination (`limit`, `offset`) and a search param
10. Test with Postman or curl against seeded data

---

### Phase 3 — Rule-based segment engine
**Day 2, morning**

11. Define rule schema in shared-types: `{ field: string, operator: 'gt'|'lt'|'eq'|'gte'|'lte', value: any }`
12. Implement `segmentEngine.ts` — maps rules array to a safe parameterised SQL WHERE clause
13. Supported fields: `total_spend` (sum of orders), `order_count`, `days_since_last_order`, `city`
14. Build `POST /segments/preview` — runs query, returns `{ count, sample: Customer[] }` with no DB writes
15. Build `POST /segments` — persists segment tied to a `campaign_id`
16. Write at least 3 unit tests for rule → SQL translation

> This is the most testable layer. Interviewers will ask how you prevent SQL injection here — answer: parameterised queries, never string interpolation.

---

### Phase 4 — AI layer (NL segment parsing + message generation)
**Day 2, afternoon**

17. Build `aiService.ts` with two functions:
    - `parseSegment(nlQuery)` — system prompt defines the rule schema as JSON, asks Claude to return only valid JSON rules
    - `generateMessage(segmentDescription, channel, brandName)` — returns 2–3 message copy variants
18. Build `POST /ai/parse-segment` — calls `parseSegment`, validates output against schema, returns rules
19. Build `POST /ai/generate-message` — calls `generateMessage`, returns variants array
20. Add validation: if Claude returns malformed JSON, return a 422 with a clear error (don't crash)
21. Test with real prompts: `"high spenders who haven't ordered in 45 days"`, `"customers in Mumbai who ordered twice"`

> Key differentiator. The NL → SQL loop, working live, is the thing to demo. Make sure the segment preview shows a real count pulled from the DB.

---

### Phase 5 — Campaign CRUD + send trigger
**Day 3, morning**

22. Build `POST /campaigns` — create campaign with `name`, `message_body`, `channel`, `segment_id`
23. Build `GET /campaigns` — list with summary stats
24. Build `POST /campaigns/:id/send`:
    - Fetch segment rules, execute against customers
    - Create one `campaign_recipients` row per matched customer
    - Enqueue one BullMQ job per recipient
    - Return `202 Accepted` immediately (do not wait for sends)
25. Implement `sendWorker.ts` — picks job, calls Channel stub `POST /send`, updates recipient status to `sent`
26. Set worker concurrency to 5 — explicit, mention this in video as a throughput/resource tradeoff

---

### Phase 6 — Channel stub (separate service)
**Day 3, afternoon**

27. Create standalone Express app in `apps/channel-stub/` — completely independent, different port
28. Build `POST /send` — accepts `{ recipientId, message, channel, callbackUrl }`, returns `202` immediately
29. Build `simulator.ts` — after `Math.random() * 8000 + 2000` ms delay, picks outcome:
    - `delivered`: 70% probability
    - `opened`: 50% of delivered
    - `clicked`: 20% of opened
    - `failed`: 10% flat
30. Build `callbackDispatcher.ts` — POSTs `{ recipientId, eventType, occurredAt }` to CRM `/receipt`
31. Add retry logic: on non-2xx from CRM, retry up to 3 times with exponential backoff (200ms, 400ms, 800ms)

> Tradeoff: `setTimeout` instead of a real queue for delay simulation. At production volume, use SQS or BullMQ here too. Fine for this scope — state this explicitly.

---

### Phase 7 — Receipt endpoint + event ingestion
**Day 4, morning**

32. Build `POST /receipt` in CRM API:
    - Validate payload schema
    - Write row to `delivery_events`
    - Update `campaign_recipients.status` to latest event type
    - Idempotency check: skip duplicate `(recipient_id, event_type)` pairs
33. Cache per-campaign stats in Redis: `{ sent, delivered, opened, clicked, failed }` counts — invalidate on each receipt
34. Test the full callback loop locally: send a campaign, watch `delivery_events` table populate over 10 s

> Idempotency is a system design question you'll be asked. Answer: duplicate callbacks from a retry should not double-count. The `(recipient_id, event_type)` unique constraint is the guard.

---

### Phase 8 — Analytics API
**Day 4, afternoon**

35. Build `GET /campaigns/:id/stats` — aggregate from `delivery_events`: counts + rates (delivered %, open rate, click rate)
36. Build `GET /campaigns` — list all campaigns with inline summary stats
37. Optional: `GET /campaigns/:id/recipients` — per-recipient status breakdown table

---

### Phase 9 — Frontend (campaign builder UI)
**Day 5**

38. **Dashboard page** — campaign list with sent/open/click shown as coloured percentage bars
39. **New campaign page** (the main flow):
    - Text input: `"Describe your audience in plain English"`
    - On submit: calls `POST /ai/parse-segment` → renders parsed rules → calls `POST /segments/preview` → shows `"23 customers matched"`
    - Message composer: calls `POST /ai/generate-message` → shows 2–3 variants as selectable cards → marketer edits chosen variant
    - Channel selector: WhatsApp / SMS / Email / RCS tabs
    - Send button: fires `POST /campaigns/:id/send` → begins polling `GET /campaigns/:id/stats` every 3 s
40. **Campaign detail page** — live stats card (updates as callbacks arrive) + recipient status table
41. **Customers page** — searchable table with order count and last order date visible
42. Keep UI minimal: clean Tailwind, no component library needed

> One impressive flow beats six mediocre pages. The NL → segment → message → send → live stats loop is the demo. Make that flawless before building anything else.

---

### Phase 10 — Deploy
**Day 6, morning**

43. Deploy `channel-stub` to Railway first — note its public URL (e.g. `https://channel-stub.railway.app`)
44. Set env vars in `crm-api`: `CHANNEL_STUB_URL`, `DATABASE_URL` (Neon), `REDIS_URL` (Upstash), `ANTHROPIC_API_KEY`
45. Deploy `crm-api` to Railway
46. Deploy `crm-frontend` to Vercel — set `NEXT_PUBLIC_API_URL` to Railway API URL
47. Run seed script against production DB: `npx ts-node src/db/seed.ts`
48. Full end-to-end smoke test:
    - Type an NL query → confirm segment count
    - Generate message → pick variant
    - Send campaign
    - Wait 10 s → confirm stats populate (delivered %, opens)

---

### Phase 11 — Walkthrough video
**Day 6, afternoon**

49. Record with Loom — narrate throughout, never click silently
50. Structure (5–6 min total):

| Segment | Time | What to cover |
|---|---|---|
| Product intro | 0–30 s | What you built: NL-first campaign builder. The problem: marketers shouldn't need to write SQL. |
| Live demo | 30 s–2 min | Full flow: NL query → segment preview → AI message → send → watch stats tick up |
| Architecture | 2–3 min | Excalidraw diagram — explain two-service design, async callback loop, BullMQ fan-out |
| Code walkthrough | 3–4 min | Show `segmentEngine.ts` (rule→SQL), `sendWorker.ts` (fan-out), `receipt.ts` (idempotency) |
| AI-native workflow | 4–5 min | Show how you used Claude to scaffold code, write system prompts, review output |

51. Explicitly state these tradeoffs in the video:
    - `setTimeout` in stub instead of real queue — fine for this scope, would use SQS at scale
    - No BullMQ dead-letter queue — would add in production for failed sends
    - Stats aggregated at query time, not materialised — add Redis cache or read replica at volume
    - No auth — deliberately skipped to focus on the core product loop
    - Worker concurrency set to 5 — would tune based on DB connection pool size at scale

---

## What NOT to build

- Multi-user auth / login flows
- Real WhatsApp / SMS / Email integration
- Deal pipelines, ticket systems, or support tooling
- Complex role-based permissions
- Billing or subscription management

---

## Key system design answers (prep these)

**Q: Why two separate services?**
The CRM and Channel stub are decoupled by design. The CRM doesn't care about delivery outcomes synchronously — it fires and moves on. This mirrors how real providers like Twilio work: you POST a message, they POST back when something happens. The callback-driven loop means the CRM stays responsive even if the channel is slow or retrying.

**Q: How do you prevent duplicate event counting?**
Idempotency check on `(recipient_id, event_type)` — a unique constraint at the DB level. If the stub retries a callback and the CRM already has that row, the insert is skipped. The stats stay accurate.

**Q: How does the segment engine prevent SQL injection?**
All rule values are passed as parameterised query placeholders, never interpolated into the SQL string directly. The field names are validated against a whitelist before being used in the query.

**Q: What would you change at 10× scale?**
Materialise campaign stats into a dedicated `campaign_stats` table updated by a trigger or worker, rather than aggregating at query time. Add a dead-letter queue in BullMQ for failed send jobs. Move the channel stub delay simulation to BullMQ with delayed jobs instead of `setTimeout`.

---

*Submission deadline: June 15, 2026, 12 PM*
