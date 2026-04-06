# Social DM Co-Pilot

AI-powered social media DM management platform for Stockland property communities. Streamlines lead capture, drafts intelligent responses using RAG + GPT, and integrates with Salesforce CRM — all with human-in-the-loop compliance guardrails.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Business Context](#business-context)
- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Folder Structure](#folder-structure)
- [Setup Instructions](#setup-instructions)
- [Environment Variables](#environment-variables)
- [API Endpoint Documentation](#api-endpoint-documentation)
- [Component Hierarchy](#component-hierarchy)
- [Compliance & Privacy](#compliance--privacy)
- [Testing](#testing)
- [Deployment](#deployment)
- [License](#license)

---

## Project Overview

Social DM Co-Pilot is a pilot-stage internal tool designed for Stockland's Social Media Officers and Sales Consultants. It provides a unified inbox for Facebook and Instagram DMs, AI-generated draft responses grounded in a property knowledge base, structured lead extraction, SLA breach monitoring, and Salesforce CRM integration.

Key capabilities:

- **Unified DM Inbox** — Aggregates DMs from Facebook and Instagram with filtering, search, and SLA tracking.
- **RAG + GPT Draft Generation** — Retrieves relevant knowledge base entries and generates contextual draft responses via OpenAI GPT.
- **Human-in-the-Loop Review** — All AI-generated drafts require explicit human approval before sending. Reviewer identity is recorded in the audit log.
- **Lead Extraction & Capture** — NLP-based extraction of name, contact, budget, location, and intent from DM content.
- **Salesforce Integration** — Push confirmed leads to Salesforce CRM via OAuth2 REST API with retry logic and exponential backoff.
- **Escalation Engine** — Rule-based escalation to Sales Consultants based on intent signals, confidence scores, budget thresholds, and SLA breaches.
- **Notification System** — Real-time alerts for high-priority leads, SLA breaches, and escalations.
- **Compliance Guardrails** — PII scrubbing before LLM submission, demographic bias prevention in lead scoring, and full audit logging.

---

## Business Context

Stockland manages multiple residential property communities across Australia. Each community has active Facebook and Instagram pages that receive high volumes of DMs from prospective buyers. Social Media Officers need to:

1. Respond to DMs within a 60-minute SLA window.
2. Provide accurate, community-specific information about pricing, availability, location, and amenities.
3. Capture lead data and push qualified leads to the sales team via Salesforce.
4. Escalate high-intent or time-sensitive inquiries to Sales Consultants.

This platform automates the repetitive parts of that workflow while keeping humans in control of all outbound communication.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Next.js App Router                       │
│                                                                 │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────────────┐ │
│  │  Inbox   │  │  DM Detail   │  │  Lead Capture Sidebar     │ │
│  │  Panel   │  │  View +      │  │  + Salesforce Integration │ │
│  │          │  │  Draft       │  │                           │ │
│  │          │  │  Composer    │  │                           │ │
│  └──────────┘  └──────────────┘  └───────────────────────────┘ │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Notification Center + Header                │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                    Serverless API Routes
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
  ┌─────▼──────┐   ┌─────────▼────────┐   ┌───────▼────────┐
  │ DM Ingest  │   │ Draft Generation │   │ Lead Manager   │
  │ Service    │   │ Service (RAG+GPT)│   │ + Salesforce   │
  └─────┬──────┘   └─────────┬────────┘   └───────┬────────┘
        │                     │                     │
  ┌─────▼──────┐   ┌─────────▼────────┐   ┌───────▼────────┐
  │ DM Store   │   │ Knowledge Base   │   │ Lead Store     │
  │ (in-memory)│   │ Adapter (JSON)   │   │ (in-memory)    │
  └────────────┘   └──────────────────┘   └────────────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
                    ┌─────────▼────────┐
                    │  Compliance      │
                    │  Guardrails      │
                    │  + PII Scrubber  │
                    │  + Audit Logger  │
                    └──────────────────┘
```

### Data Flow

1. **DM Ingestion** — Incoming DMs are validated, enriched with intent/priority/confidence metadata, and stored in the in-memory DM store.
2. **Draft Generation (RAG Pipeline)** — When an officer requests a draft:
   - DM content is PII-scrubbed via `pii-scrubber`.
   - The knowledge base adapter performs keyword-based relevance ranking against `data/knowledge-base.json`.
   - A prompt is constructed with the top-ranked context entries and sent to OpenAI GPT (or a simulated response in pilot mode).
   - A confidence score is computed from knowledge base match quality.
   - The draft is stored in the draft store with `approved: false`.
3. **Human Review** — The officer reviews, optionally edits, and explicitly approves the draft. Compliance guardrails validate reviewer identity, approval status, and content before allowing submission.
4. **Lead Extraction** — Regex and keyword-based NLP extracts structured fields (name, contact, budget, location, intent) from DM content. Compliance checks reject any demographic fields.
5. **Salesforce Integration** — Confirmed leads are pushed to Salesforce via OAuth2 Username-Password flow with retry logic (max 3 retries, exponential backoff). Falls back to `pending_manual` status when Salesforce is not configured.
6. **Escalation** — Rule-based evaluation triggers escalation based on intent keywords, confidence thresholds, budget, SLA breaches, and manual officer flags.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| UI | React 18, Tailwind CSS |
| AI/LLM | OpenAI GPT-4 (via `openai` SDK) |
| Knowledge Base | Static JSON with keyword-based relevance ranking |
| CRM Integration | Salesforce REST API (OAuth2 Username-Password flow) |
| Authentication | NextAuth.js (configured, not enforced in pilot) |
| State Management | In-memory stores (DM, Draft, Lead, Notification) |
| Testing | Vitest, React Testing Library, jsdom |
| Deployment | Vercel (serverless) |
| Date Utilities | date-fns |
| ID Generation | uuid v4 |

---

## Folder Structure

```
social-dm-copilot/
├── app/                          # Next.js App Router pages and API routes
│   ├── api/
│   │   ├── audit/route.ts        # GET audit log entries with filters
│   │   ├── dm/
│   │   │   ├── draft/
│   │   │   │   ├── route.ts      # POST generate draft response
│   │   │   │   └── submit/route.ts # POST approve and send draft
│   │   │   ├── inbox/route.ts    # GET inbox with filters, search, pagination
│   │   │   └── ingest/route.ts   # POST ingest new DM
│   │   ├── health/route.ts       # GET health check
│   │   ├── lead/
│   │   │   └── extract/route.ts  # POST extract lead from DM
│   │   ├── leads/
│   │   │   ├── route.ts          # GET list leads, POST create lead
│   │   │   └── [leadId]/
│   │   │       ├── route.ts      # GET/PATCH lead by ID
│   │   │       ├── escalate/route.ts # POST escalate lead
│   │   │       └── salesforce/route.ts # POST create in Salesforce
│   │   ├── notifications/route.ts # GET/PATCH notifications
│   │   └── sla/check/route.ts   # POST check SLA breaches
│   ├── globals.css               # Tailwind base styles
│   ├── layout.tsx                # Root layout with Header
│   ├── page.tsx                  # Main dashboard (three-panel workspace)
│   ├── leads/page.tsx            # Leads management page
│   └── notifications/page.tsx    # Notifications listing page
│
├── components/
│   ├── draft/
│   │   ├── DraftComposer.tsx     # AI draft editing and approval UI
│   │   └── DraftComposer.test.tsx
│   ├── inbox/
│   │   ├── InboxPanel.tsx        # DM inbox list with filters and search
│   │   ├── InboxPanel.test.tsx
│   │   └── DMDetailView.tsx      # Full DM detail and workflow view
│   ├── lead/
│   │   ├── LeadCaptureSidebar.tsx # Lead data capture and Salesforce push
│   │   └── LeadCaptureSidebar.test.tsx
│   ├── layout/
│   │   └── Header.tsx            # App header with navigation and user info
│   ├── notifications/
│   │   └── NotificationCenter.tsx # Dropdown notification panel
│   └── ui/
│       ├── ConfidenceMeter.tsx   # Visual confidence score indicator
│       ├── NotificationBell.tsx  # Bell icon with unread badge
│       └── StatusTag.tsx         # DM status badge component
│
├── data/
│   ├── knowledge-base.json       # 25 Stockland community Q&A entries
│   ├── sample-dms.json           # 18 sample DM records
│   └── sample-leads.json         # 15 sample lead records
│
├── lib/
│   ├── compliance/
│   │   ├── compliance-guardrails.ts      # Human-in-the-loop, PII scrub, bias checks
│   │   ├── compliance-guardrails.test.ts
│   │   ├── pii-scrubber.ts              # PII detection and redaction
│   │   └── pii-scrubber.test.ts
│   ├── constants.ts              # SLA thresholds, status colors, API routes
│   ├── hooks/
│   │   ├── useDraft.ts           # Draft generation and submission hook
│   │   ├── useInbox.ts           # Inbox data fetching with polling
│   │   ├── useLead.ts            # Lead CRUD and Salesforce integration hook
│   │   └── useNotifications.ts   # Notification fetching and mark-as-read hook
│   ├── integrations/
│   │   └── salesforce-integration.ts # Salesforce OAuth2, lead creation, retry logic
│   ├── services/
│   │   ├── audit-logger.ts       # Immutable audit log with PII scrubbing
│   │   ├── dm-ingestion-service.ts # DM validation, enrichment, and storage
│   │   ├── draft-generation-service.ts # RAG pipeline + GPT draft generation
│   │   ├── draft-generation-service.test.ts
│   │   ├── escalation-service.ts # Rule-based escalation and SLA breach detection
│   │   ├── inbox-service.ts      # Inbox aggregation, filtering, and enrichment
│   │   ├── knowledge-base-adapter.ts # JSON knowledge base with relevance ranking
│   │   ├── lead-extraction-service.ts # NLP-based lead field extraction
│   │   ├── lead-manager.ts       # Lead CRUD, Salesforce push, auto-escalation
│   │   ├── lead-manager.test.ts
│   │   ├── notification-service.ts # Notification creation and retrieval
│   │   └── pii-scrubber.ts       # Service-layer PII scrubbing utility
│   ├── stores/
│   │   ├── dm-store.ts           # In-memory DM storage with sample data
│   │   ├── draft-store.ts        # In-memory draft storage
│   │   ├── lead-store.ts         # In-memory lead storage with sample data
│   │   └── notification-store.ts # In-memory notification storage
│   └── types.ts                  # Shared TypeScript interfaces and enums
│
├── .env.example                  # Environment variable template
├── next.config.mjs               # Next.js configuration
├── package.json                  # Dependencies and scripts
├── postcss.config.js             # PostCSS with Tailwind
├── tailwind.config.ts            # Tailwind theme customization
├── tsconfig.json                 # TypeScript configuration
├── vitest.config.ts              # Vitest test runner configuration
└── vercel.json                   # Vercel deployment configuration
```

---

## Setup Instructions

### Prerequisites

- **Node.js** 18.17 or later
- **npm** 9+ (or yarn/pnpm)
- An **OpenAI API key** (optional — the platform falls back to simulated responses without one)
- **Salesforce Connected App** credentials (optional — leads are marked `pending_manual` without configuration)

### 1. Clone the Repository

```bash
git clone <repository-url>
cd social-dm-copilot
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Copy the example environment file and fill in your values:

```bash
cp .env.example .env.local
```

See [Environment Variables](#environment-variables) below for details on each variable.

### 4. Start the Development Server

```bash
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000).

### 5. Run Tests

```bash
npm test
```

### 6. Build for Production

```bash
npm run build
npm start
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXTAUTH_URL` | No | Canonical URL of the site (e.g., `http://localhost:3000`) |
| `NEXTAUTH_SECRET` | No | Random secret for NextAuth token encryption. Generate with `openssl rand -base64 32` |
| `OPENAI_API_KEY` | No | OpenAI API key for GPT draft generation. Without this, simulated responses are used. |
| `OPENAI_MODEL` | No | OpenAI model identifier (default: `gpt-4`). Options: `gpt-4`, `gpt-4-turbo`, `gpt-3.5-turbo` |
| `SALESFORCE_CLIENT_ID` | No | Salesforce Connected App consumer key |
| `SALESFORCE_CLIENT_SECRET` | No | Salesforce Connected App consumer secret |
| `SALESFORCE_INSTANCE_URL` | No | Salesforce instance base URL (e.g., `https://yourorg.my.salesforce.com`) |
| `SALESFORCE_USERNAME` | No | Salesforce API username |
| `SALESFORCE_PASSWORD` | No | Salesforce password (with security token appended if required) |
| `SLA_BREACH_MINUTES` | No | Minutes before a DM is considered SLA-breached (default: `60`) |
| `HIGH_PRIORITY_THRESHOLD` | No | Confidence threshold for high-priority flagging (default: `0.8`) |

> **Note:** The platform is fully functional without any external API keys. OpenAI and Salesforce integrations gracefully degrade to simulated/manual modes.

---

## API Endpoint Documentation

### Health Check

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Returns service status, timestamp, and version |

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-10-28T09:00:00.000Z",
  "version": "0.1.0"
}
```

### DM Ingestion

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/dm/ingest` | Ingest a new DM from Facebook or Instagram |

**Request Body:**
```json
{
  "platform": "facebook",
  "sender_id": "user-101",
  "sender_name": "Sarah Mitchell",
  "sender_handle": "sarah.mitchell.92",
  "content": "Hi! I'm interested in the new townhouses at Willowdale.",
  "timestamp": "2024-10-28T09:15:00.000Z",
  "metadata": {
    "communityName": "Willowdale",
    "propertyType": "townhouse",
    "bedrooms": 3
  }
}
```

**Response (201):**
```json
{
  "status": "received",
  "dm_id": "dm-abc123",
  "dm": { ... }
}
```

### Inbox

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/dm/inbox` | Retrieve inbox with filters, search, and pagination |

**Query Parameters:**
- `status` — Filter by status: `new`, `drafted`, `sent`, `escalated`
- `platform` — Filter by platform: `facebook`, `instagram`
- `priority` — Filter by priority: `high`, `medium`, `low`
- `intent` — Filter by detected intent
- `communityName` — Filter by community name
- `search` — Full-text search across sender name, handle, content, community
- `sortBy` — Sort field: `timestamp`, `priority`, `confidenceScore`, `slaDeadline`
- `sortOrder` — Sort direction: `asc`, `desc` (default: `desc`)
- `page` — Page number (default: `1`)
- `limit` — Items per page (default: `20`, max: `100`)
- `startDate` — ISO8601 start date filter
- `endDate` — ISO8601 end date filter

**Response (200):**
```json
{
  "success": true,
  "data": {
    "items": [ ... ],
    "total": 18,
    "page": 1,
    "limit": 20,
    "totalPages": 1,
    "stats": {
      "total": 18,
      "new": 10,
      "drafted": 3,
      "sent": 2,
      "escalated": 1,
      "slaBreached": 2,
      "highPriority": 8
    }
  },
  "error": null
}
```

### Draft Generation

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/dm/draft` | Generate an AI draft response for a DM |

**Request Body:**
```json
{
  "dmId": "dm-001"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "draft_id": "draft-abc123",
    "dm_id": "dm-001",
    "draft_text": "Thank you for your interest in Willowdale! ...",
    "confidence": 0.85,
    "context": [
      {
        "id": "kb-001",
        "category": "pricing",
        "question": "What is the price range...",
        "answer": "Land lots start from $420,000...",
        "relevanceScore": 0.85,
        "propertyInfo": { ... }
      }
    ],
    "reviewed_by": null,
    "approved": false,
    "edited_content": null
  },
  "error": null
}
```

### Draft Submission

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/dm/draft/submit` | Approve and send a draft (human-in-the-loop) |

**Request Body:**
```json
{
  "draftId": "draft-abc123",
  "reviewerId": "officer-123",
  "editedContent": "Optional edited text"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "status": "submitted",
    "draftId": "draft-abc123",
    "dmId": "dm-001",
    "sentAt": "2024-10-28T10:00:00.000Z",
    "draft": { ... }
  },
  "error": null
}
```

**Error (403) — Compliance Violation:**
```json
{
  "success": false,
  "data": null,
  "error": "Compliance violations: A valid reviewer ID is required."
}
```

### Lead Extraction

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/lead/extract` | Extract structured lead data from a DM |

**Request Body:**
```json
{
  "dmId": "dm-001"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "dmId": "dm-001",
    "fields": {
      "name": "Sarah Mitchell",
      "contact": "sarah@example.com",
      "budget": "$500,000",
      "location": "Willowdale",
      "intent": "buy"
    },
    "confidence": 0.85,
    "fieldConfidence": {
      "name": 1.0,
      "contact": 1.0,
      "budget": 1.0,
      "location": 1.0,
      "intent": 1.0
    }
  },
  "error": null
}
```

### Leads

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/leads` | List leads with optional filters |
| `POST` | `/api/leads` | Create a new lead from DM data |
| `GET` | `/api/leads/[leadId]` | Get lead details by ID |
| `PATCH` | `/api/leads/[leadId]` | Update lead fields |
| `POST` | `/api/leads/[leadId]/escalate` | Escalate lead to Sales Consultant |
| `POST` | `/api/leads/[leadId]/salesforce` | Create lead in Salesforce CRM |

### Notifications

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/notifications?recipientId=...` | Get notifications for a recipient |
| `PATCH` | `/api/notifications` | Mark a notification as read |

### SLA Check

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/sla/check` | Scan all DMs for SLA breaches |

### Audit Log

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/audit` | Query audit log with optional filters |

**Query Parameters:**
- `action` — Filter by action type
- `actor` — Filter by actor ID
- `entityRef` — Filter by entity reference
- `startDate` — ISO8601 start date
- `endDate` — ISO8601 end date

---

## Component Hierarchy

```
RootLayout (app/layout.tsx)
├── Header
│   ├── Navigation (Inbox, Leads)
│   ├── NotificationBell
│   └── User Info
│
├── DashboardPage (app/page.tsx) — Three-panel workspace
│   ├── InboxPanel
│   │   ├── Search Input
│   │   ├── Status Filter Tabs
│   │   ├── Sort Controls
│   │   ├── Stats Summary
│   │   └── InboxItem[] (DM list)
│   │
│   ├── DMDetailView
│   │   ├── Message Content
│   │   ├── ConfidenceMeter
│   │   ├── DraftComposerSection
│   │   │   └── DraftComposer
│   │   │       ├── ConfidenceMeter
│   │   │       ├── Textarea (editable)
│   │   │       └── Action Buttons (Generate, Approve & Send, Regenerate)
│   │   ├── KnowledgeContextPanel
│   │   └── WorkflowProgress
│   │
│   ├── LeadCaptureSidebar
│   │   ├── Editable Fields (Name, Contact, Budget, Location, Intent)
│   │   ├── ConfidenceMeter
│   │   ├── Priority Flag Toggle
│   │   └── Action Buttons (Save, Create in Salesforce)
│   │
│   └── NotificationCenter (dropdown)
│       ├── Filter Tabs (All, High Priority, SLA Breach)
│       └── NotificationItem[]
│
├── LeadsPage (app/leads/page.tsx)
│   ├── StatsBar
│   ├── Filters (Status, Priority, Search)
│   ├── Sortable Table
│   │   └── LeadRow[] with StatusTag, PriorityBadge, ConfidenceMeter
│   └── LeadDetailModal
│
└── NotificationsPage (app/notifications/page.tsx)
    ├── Stats Cards
    ├── Filter Bar (Type, Read Status, Date Range)
    ├── Bulk Actions Bar
    └── NotificationRow[]
```

### Shared UI Components

| Component | Path | Description |
|---|---|---|
| `StatusTag` | `components/ui/StatusTag.tsx` | Color-coded status badge (New, Drafted, Sent, Escalated) |
| `ConfidenceMeter` | `components/ui/ConfidenceMeter.tsx` | Progress bar with high/medium/low color coding |
| `NotificationBell` | `components/ui/NotificationBell.tsx` | Bell icon with animated unread count badge |

### Custom Hooks

| Hook | Path | Description |
|---|---|---|
| `useDraft` | `lib/hooks/useDraft.ts` | Draft generation, editing, and submission state management |
| `useInbox` | `lib/hooks/useInbox.ts` | Inbox data fetching with filters, polling, and pagination |
| `useLead` | `lib/hooks/useLead.ts` | Lead CRUD, Salesforce integration, and escalation |
| `useNotifications` | `lib/hooks/useNotifications.ts` | Notification fetching, mark-as-read, and polling |

---

## Compliance & Privacy

### NFR-001: Human-in-the-Loop

All AI-generated draft responses **must** be explicitly reviewed and approved by a human officer before sending. The system enforces this through:

- `validateDraftForSending()` in `lib/compliance/compliance-guardrails.ts` checks:
  - Draft has `approved: true`
  - A valid `reviewedBy` reviewer ID is assigned
  - A valid `reviewerId` is provided at submission time
  - Content is non-empty
- Critical compliance violations block submission and are logged to the audit trail.
- The reviewer's identity is recorded in both the draft record and the audit log.

### NFR-002: PII Protection

Personally identifiable information is scrubbed before any data is sent to the LLM:

- **`lib/compliance/pii-scrubber.ts`** — Detects and redacts emails, phone numbers, credit cards, TFNs, Medicare numbers, street addresses, dates of birth, and postcodes.
- **`lib/compliance/compliance-guardrails.ts` → `scrubForLLM()`** — Applied to all DM content before prompt construction.
- **`lib/services/audit-logger.ts`** — All audit log entries are PII-scrubbed before storage.

Supported PII patterns:
- Email addresses → `[REDACTED EMAIL]`
- Australian mobile/landline numbers → `[REDACTED PHONE]`
- International phone numbers → `[REDACTED PHONE]`
- Credit card numbers → `[REDACTED CREDIT CARD]`
- Tax File Numbers (TFN) → `[REDACTED TFN]`
- Medicare numbers → `[REDACTED MEDICARE]`
- Street addresses → `[REDACTED ADDRESS]`

### NFR-003: Audit Logging

Every significant action is recorded in an immutable audit log:

- DM ingestion, draft generation, draft submission, lead creation, lead updates, Salesforce integration, escalation, SLA breach detection.
- Each entry includes: unique ID, action type, actor, timestamp, entity reference, and PII-scrubbed details.
- Audit logs are queryable via `GET /api/audit` with filters for action, actor, entity, and date range.

### NFR-004: Bias Mitigation

Lead scoring and prioritization **never** use demographic fields:

- `validateLeadScoring()` rejects any lead data containing: `age`, `gender`, `ethnicity`, `race`, `religion`, `nationality`, `maritalStatus`, `disability`, `sexualOrientation`, `politicalAffiliation`, `familyStatus`, or `pregnancyStatus`.
- Escalation rules are based solely on: declared intent keywords, confidence scores, budget thresholds, SLA breach status, engagement signals (message count), and manual officer flags.

---

## Testing

The project uses **Vitest** with **React Testing Library** and **jsdom** for testing.

### Run All Tests

```bash
npm test
```

### Run Tests in Watch Mode

```bash
npx vitest --watch
```

### Run a Specific Test File

```bash
npx vitest lib/services/draft-generation-service.test.ts
```

### Test Coverage

```bash
npx vitest --coverage
```

Coverage thresholds are configured at 70% for statements, branches, functions, and lines.

### Test Structure

| Test File | Coverage Area |
|---|---|
| `lib/compliance/compliance-guardrails.test.ts` | PII scrubbing, human-in-the-loop validation, demographic bias rejection |
| `lib/compliance/pii-scrubber.test.ts` | PII detection and redaction patterns |
| `lib/services/draft-generation-service.test.ts` | RAG pipeline, draft generation, submission, compliance enforcement |
| `lib/services/lead-manager.test.ts` | Lead CRUD, Salesforce integration, auto-escalation rules |
| `components/draft/DraftComposer.test.tsx` | Draft UI: generation, editing, submission, confidence display |
| `components/inbox/InboxPanel.test.tsx` | Inbox rendering, filtering, search, selection, loading/error states |
| `components/lead/LeadCaptureSidebar.test.tsx` | Lead field display, editing, Salesforce creation, priority flagging |

---

## Deployment

### Vercel (Recommended)

The project is configured for Vercel deployment with serverless API routes.

1. **Connect your repository** to Vercel via the Vercel dashboard.

2. **Set environment variables** in the Vercel project settings:
   - `OPENAI_API_KEY`
   - `OPENAI_MODEL`
   - `SALESFORCE_CLIENT_ID`
   - `SALESFORCE_CLIENT_SECRET`
   - `SALESFORCE_INSTANCE_URL`
   - `SALESFORCE_USERNAME`
   - `SALESFORCE_PASSWORD`
   - `NEXTAUTH_URL` (set to your production URL)
   - `NEXTAUTH_SECRET`
   - `SLA_BREACH_MINUTES`
   - `HIGH_PRIORITY_THRESHOLD`

3. **Deploy:**
   ```bash
   npx vercel --prod
   ```

   Or push to your connected Git branch for automatic deployment.

### Build Configuration

- **Framework Preset:** Next.js
- **Build Command:** `next build`
- **Output Directory:** `.next`
- **Node.js Version:** 18.x or later

### Important Notes

- **In-memory stores** reset on each serverless function cold start. For production use, replace with a persistent database (e.g., PostgreSQL, MongoDB).
- **Salesforce integration** requires a Connected App with OAuth2 Username-Password flow enabled. Ensure the Salesforce user has API access and the security token is appended to the password if IP restrictions are in place.
- **OpenAI API** costs are incurred per draft generation. Monitor usage via the OpenAI dashboard. The `OPENAI_MODEL` variable controls which model is used — `gpt-3.5-turbo` is significantly cheaper than `gpt-4`.

---

## License

Private. All rights reserved.