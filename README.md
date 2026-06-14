# 🚀 Xeno Mini CRM — AI-First Campaign Builder

A full-stack, natural language-first CRM platform built as a Turborepo monorepo. Marketers can build segments using plain English, generate personalized messages using AI, run campaigns through a BullMQ job queue, and track real-time delivery stats through a simulated message delivery service.

---

## 🧭 Product Angle & Architecture

Xeno Mini CRM focuses on a streamlined, **AI-native workflow** where a marketer can go from intent to a running campaign in seconds:
1. **Natural Language Segmenting**: Marketer types an audience query (e.g., *"high spenders in Delhi who ordered more than 3 times"*) $\rightarrow$ The backend parses this into database rules (using Gemini AI with a robust local regex fallback) $\rightarrow$ Instantly previews matching customer count.
2. **AI message copywriting**: The system drafts 3 personalized message variants based on the channel and brand name.
3. **Queue-based sending**: The campaign is triggered and enqueued using BullMQ.
4. **Decoupled simulation**: A separate `channel-stub` service simulates message delivery with random delays and callbacks.
5. **Real-time analytics**: A Next.js dashboard polls and visualizes campaign stats (delivered, opened, clicked, failed) in real-time as callbacks flow back.

---

## 🛠️ Tech Stack

| Layer | Choice | Description / Purpose |
|---|---|---|
| **Monorepo** | [Turborepo](https://turbo.build/) | Package management and parallel build orchestration. |
| **Frontend** | [Next.js 16 (App Router)](https://nextjs.org/) | Modern UI styled using **Tailwind CSS v4** and customized glassmorphic components. |
| **CRM API** | [Express](https://expressjs.com/) + TypeScript | Lightweight Node.js server handling segment rules, campaigns, and callback ingestion. |
| **Channel Stub** | [Express](https://expressjs.com/) + TypeScript | Decoupled message sending simulator mimicking external providers (e.g., Twilio). |
| **AI Layer** | [Gemini API](https://ai.google.dev/) (SDK) | Natural language segment parsing and marketing copy generation (with automatic local regex/template fallbacks). |
| **Database** | PostgreSQL | Relational storage for customer profiles, orders, campaigns, and delivery logs. |
| **Job Queue** | [BullMQ](https://bullmq.io/) + Redis | High-throughput asynchronous message fan-out, retry handling, and concurrency limits. |

---

## 📐 System Architecture

```mermaid
graph TD
    subgraph CRM_Frontend ["CRM Frontend (Next.js 16)"]
        UI["Next.js Web UI"]
    end

    subgraph CRM_API_Service ["CRM API Service (Express)"]
        API["Express App (App.ts)"]
        SegmentEngine["Segment SQL Engine"]
        AIService["AI Service (Gemini / Fallback)"]
        BullMQ_Queue["BullMQ Send Queue"]
        BullMQ_Worker["BullMQ Worker (Concurrency: 5)"]
    end

    subgraph External_Datastores ["Infrastructure"]
        Postgres[("PostgreSQL DB")]
        Redis[("Redis (BullMQ & Cache)")]
    end

    subgraph Channel_Stub_Service ["Channel Stub (Express)"]
        StubAPI["POST /send"]
        Simulator["Delivery Outcome Simulator"]
    end

    UI <-->|REST API| API
    API <-->|AI Prompts| AIService
    API <-->|SQL Queries| SegmentEngine
    SegmentEngine <--> Postgres
    API <--> Postgres
    API -->|Queue Jobs| BullMQ_Queue
    BullMQ_Queue <--> Redis
    BullMQ_Worker <--> Redis
    BullMQ_Worker -->|POST /send| StubAPI
    StubAPI --> Simulator
    Simulator -->|Async Callback POST /receipt| API
```

---

## 🗄️ Database Schema (ER)

```
customers
 ├── id (UUID, PK)
 ├── name (VARCHAR)
 ├── email (VARCHAR, UNIQUE)
 ├── phone (VARCHAR)
 ├── city (VARCHAR)
 └── created_at (TIMESTAMP)

orders
 ├── id (UUID, PK)
 ├── customer_id (UUID, FK -> customers.id)
 ├── total_amount (DECIMAL)
 ├── ordered_at (TIMESTAMP)
 └── status (VARCHAR)

campaigns
 ├── id (UUID, PK)
 ├── name (VARCHAR)
 ├── channel (VARCHAR: email | sms | whatsapp | rcs)
 ├── status (VARCHAR: draft | sending | sent)
 ├── message_body (TEXT)
 ├── scheduled_at (TIMESTAMP)
 ├── sent_at (TIMESTAMP)
 └── created_at (TIMESTAMP)

segments
 ├── id (UUID, PK)
 ├── campaign_id (UUID, FK -> campaigns.id)
 ├── name (VARCHAR)
 ├── rules (JSONB: [{field, operator, value}])
 └── matched_count (INT)

campaign_recipients
 ├── id (UUID, PK)
 ├── campaign_id (UUID, FK -> campaigns.id)
 ├── customer_id (UUID, FK -> customers.id)
 ├── status (VARCHAR: queued | sent | delivered | opened | clicked | failed)
 ├── message_body (TEXT)
 └── sent_at (TIMESTAMP)

delivery_events
 ├── id (UUID, PK)
 ├── recipient_id (UUID, FK -> campaign_recipients.id)
 ├── event_type (VARCHAR: sent | delivered | opened | clicked | failed)
 ├── metadata (JSONB)
 └── occurred_at (TIMESTAMP)
```

---

## 📂 Directory Structure

```
xeno-crm/
├── apps/
│   ├── crm-frontend/         # Next.js 16 Frontend App
│   │   ├── src/app/          # Page routes (Dashboard, Customers, Campaigns)
│   │   └── src/components/   # Reusable UI components (Sidebar, SegmentBuilder, etc.)
│   │
│   ├── crm-api/              # Express CRM API (Backend)
│   │   ├── src/db/           # Database config, migration & seed scripts
│   │   ├── src/routes/       # API endpoints (customers, campaigns, receipts)
│   │   └── src/services/     # SQL Segment Engine, BullMQ worker & AI Service
│   │
│   └── channel-stub/         # Express delivery simulator
│       └── src/              # Simulator & Callback dispatcher
│
├── packages/
│   └── shared-types/         # Shared TypeScript interfaces (build-time package)
│
├── docker-compose.yml         # Postgres + Redis dev containers
├── turbo.json                # Turborepo configurations
└── package.json              # Monorepo root dependencies & scripts
```

---

## 🚀 Getting Started (Local Setup)

### Prerequisites
- **Node.js** (v18 or higher recommended)
- **Docker** & **Docker Compose** (for Postgres & Redis)

### Step 1: Clone and Install Dependencies
Install all workspace dependencies from the root directory:
```bash
npm install
```

### Step 2: Configure Environment Variables
Create `.env` files for the backend services:

1. **CRM API**: Create `apps/crm-api/.env`
   ```env
   DATABASE_URL=postgresql://xeno:xeno_secret@localhost:5432/xeno_crm
   REDIS_URL=redis://localhost:6379
   CHANNEL_STUB_URL=http://localhost:3002
   PORT=3001
   CRM_API_URL=http://localhost:3001
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

2. **Channel Stub**: Create `apps/channel-stub/.env`
   ```env
   PORT=3002
   CRM_API_URL=http://localhost:3001
   ```

3. **CRM Frontend**: Create `apps/crm-frontend/.env.local`
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:3001
   ```

### Step 3: Spin Up Infrastructure
Start PostgreSQL and Redis in the background using Docker Compose:
```bash
docker compose up -d
```

### Step 4: Run Migrations and Seed Data
Create the database tables and populate them with mock customers and orders (200 customers, 500+ orders spread across different cities and purchase timelines):
```bash
# Run migrations
npm run db:migrate

# Seed database
npm run db:seed
```

### Step 5: Start the Development Server
Run all services simultaneously in development mode:
```bash
npm run dev
```
* **Frontend**: [http://localhost:3000](http://localhost:3000)
* **CRM API**: [http://localhost:3001](http://localhost:3001)
* **Channel Stub**: [http://localhost:3002](http://localhost:3002)

---

## ⚡ Deployment Instructions

### 1. Backend Services (`crm-api` & `channel-stub` on Render)
Ensure you set the **Root Directory** setting to `empty` (the repo root) and configure:
* **crm-api**:
  * Build Command: `npm install && npx turbo run build --filter=crm-api...`
  * Start Command: `node apps/crm-api/dist/app.js`
  * Add the `.env` variables in Render's **Environment** settings.
  * To run migrations automatically on build, set the build command to:
    `npm install && npx turbo run build --filter=crm-api... && cd apps/crm-api && npx tsx src/db/migrate.ts`
* **channel-stub**:
  * Build Command: `npm install && npx turbo run build --filter=channel-stub...`
  * Start Command: `node apps/channel-stub/dist/app.js`

### 2. Frontend (`crm-frontend` on Vercel)
* Vercel will automatically detect the Next.js app.
* Set the Root Directory to `apps/crm-frontend`.
* Add `NEXT_PUBLIC_API_URL` pointing to your deployed Render `crm-api` URL.

---

## 🛡️ Key System Design Pillars

### 1. SQL Injection Prevention
The `segmentEngine.ts` maps AI-generated segment rules into parameterised SQL clauses. Table field names are checked against an explicit whitelist (`total_spend`, `order_count`, `days_since_last_order`, `city`), and user inputs are bound safely to PostgreSQL placeholders (`$1`, `$2`, etc.), preventing raw query manipulation.

### 2. Queue-based Decoupling & Concurrency
Campaign sends are queued immediately, returning a `202 Accepted` to the client. BullMQ processes these jobs asynchronously. The `sendWorker` runs with a concurrency limit of 5 to protect database connection pools and match downstream API rate limits.

### 3. Callback Idempotency
Because network channels are unreliable, the `channel-stub` retries delivery callbacks if the CRM endpoint is offline. To prevent duplicate stats tracking, `delivery_events` has a unique compound key constraint: `UNIQUE(recipient_id, event_type)`. Any duplicate callbacks sent during retries are safely ignored by the database.

### 4. AI Resiliency (API Fallback)
In case of Gemini API rate-limits (`429 Quota Exceeded`) or network downtime, the app falls back automatically to:
- A regex-based parser that interprets cities, spends, order counts, and inactivity limits locally.
- A local template-based copy generator that builds customized drafts based on channel types.
