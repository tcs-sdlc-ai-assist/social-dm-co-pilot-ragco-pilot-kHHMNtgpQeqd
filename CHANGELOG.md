# Changelog

All notable changes to the Social DM Co-Pilot project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-10-28

### Added

#### DM Ingestion
- Ingest incoming direct messages from Facebook and Instagram via `/api/dm/ingest`
- Automatic intent detection using keyword-based NLP (pricing, booking, availability, location, general inquiry)
- Priority classification (high, medium, low) based on intent and urgency signals
- Confidence scoring computed from message content, intent specificity, and community name mentions
- SLA deadline computation with configurable breach threshold (`SLA_BREACH_MINUTES`)
- Community, property type, and bedroom count detection from message content
- Simulated DM generation for pilot testing via `simulateIncomingDMs()`

#### Unified Inbox
- Three-panel dashboard layout: inbox list, DM detail view, and lead capture sidebar
- Real-time inbox with polling at configurable intervals (`POLLING_INTERVAL_MS`)
- Status tags for all DM states: New, Drafted, Sent, Escalated
- Filtering by status, platform, priority, intent, and community name
- Sorting by timestamp, priority, confidence score, and SLA deadline
- Full-text search across sender name, handle, content, and community name
- Lazy loading with infinite scroll via IntersectionObserver
- Inbox stats summary with counts for total, new, drafted, sent, escalated, SLA breached, and high priority
- Mobile-responsive layout with bottom navigation for inbox, detail, and lead views

#### Draft Generation (RAG + GPT)
- Retrieval-Augmented Generation using a 25-entry Stockland property knowledge base
- Keyword-based relevance ranking across question, answer, tags, and category fields
- OpenAI GPT integration for draft response generation with configurable model (`OPENAI_MODEL`)
- Simulated response generation when OpenAI API key is not configured (pilot mode)
- Confidence scoring derived from knowledge base match quality (top score, average, coverage)
- Draft Composer component with inline editing, character count, and regeneration
- Knowledge base context panel showing matched entries with relevance scores
- "Insert Property Info" and "Suggest Next Step" quick-action buttons

#### Human-in-the-Loop Review and Approval
- Mandatory human review before any draft response is sent
- Reviewer ID tracking and validation on all draft submissions
- Compliance guardrail enforcement via `validateDraftForSending()`
- Critical violation blocking: unapproved drafts, missing reviewer, empty content
- Warning-level checks: low confidence threshold (< 0.6), reviewer mismatch
- Draft editing with tracked `editedContent` field
- Approval state management with `approved` and `reviewedBy` fields
- Audit logging of all review and approval actions

#### Lead Extraction and Capture
- NLP-based lead field extraction from DM content via `/api/lead/extract`
- Extracted fields: name, contact (email/phone), budget, location, intent
- Budget parsing supporting $XXXk, $X.Xm, comma-separated, and range formats
- Known community detection for Stockland properties
- Intent classification across buy, inspect, inquiry, invest, downsize, relocate, and first home categories
- Confidence scoring based on field completeness (weighted: budget 25%, contact 20%, location 20%, intent 20%, name 15%)
- Lead Capture Sidebar with editable fields, confidence indicators, and save functionality
- Lead creation via `/api/leads` with automatic extraction or pre-provided data
- Lead detail modal with full field display and action buttons

#### Salesforce Integration
- OAuth2 Username-Password flow authentication with token caching (55-minute TTL)
- Lead creation via Salesforce REST API (`/services/data/v59.0/sobjects/Lead/`)
- Retry logic with exponential backoff (max 3 retries, 500ms base backoff)
- Simulated mode when `SALESFORCE_INSTANCE_URL` is not configured
- `pending_manual` status for leads when Salesforce credentials are not available
- Lead status tracking: pending, created, auth_failed, creation_failed, error, pending_manual
- Per-lead Salesforce creation via `/api/leads/[leadId]/salesforce`

#### Lead Escalation and Priority Routing
- Rule-based escalation evaluation via `/api/leads/[leadId]/escalate`
- Escalation triggers: high intent keywords, high confidence (≥ 0.8), high budget (> $1M), SLA breach, manual flag, high engagement (≥ 10 messages)
- No demographic-based scoring per NFR-004 bias mitigation requirements
- Automatic escalation batch processing via `processAutoEscalations()`
- Escalation history tracking via audit log queries
- Priority flag toggle in Lead Capture Sidebar with Sales Consultant notification

#### Notification Center
- Dropdown notification panel with real-time polling
- Notification types: High Priority Lead, SLA Breach, Lead Created, Escalation
- Filter tabs: All, High Priority, SLA Breach
- Read/unread status management with optimistic UI updates
- Full-page notifications view at `/notifications` with bulk mark-as-read
- Date range filtering and type-based filtering
- Stats cards showing counts by notification type
- Navigation from notifications to related DMs or leads

#### SLA Breach Detection
- Configurable SLA response time threshold via `SLA_BREACH_MINUTES` (default: 60 minutes)
- Automated SLA breach scanning via `/api/sla/check`
- SLA breach badges on inbox items and DM detail views
- Automatic DM status escalation on SLA breach
- Linked lead priority escalation when SLA is breached
- SLA breach notifications sent to Sales Consultant recipients

#### Compliance Guardrails
- **PII Scrubbing**: Automatic redaction of emails, phone numbers, credit cards, TFNs, Medicare numbers, street addresses, postcodes, and dates of birth before LLM submission
- **PII Detection**: `containsPII()` utility for checking text for personally identifiable information
- **Audit Logging**: Immutable audit trail for all system actions via `AuditLogger` with in-memory storage
- **Audit Log API**: Query audit logs via `/api/audit` with filtering by action, actor, entity reference, and date range
- **Bias Mitigation**: Demographic field rejection in lead scoring (age, gender, ethnicity, religion, nationality, marital status, disability)
- **Draft Compliance**: Validation of draft approval state, reviewer assignment, content presence, and confidence threshold before sending
- **PII in Audit Logs**: Automatic PII scrubbing of audit log details via `scrubPII()`

#### Pilot Mode
- Simulated Salesforce API responses when credentials are not configured
- Simulated OpenAI GPT responses with intent-aware template matching
- Sample DM data (18 messages) pre-loaded from `data/sample-dms.json`
- Sample lead data (15 leads) pre-loaded from `data/sample-leads.json`
- Knowledge base with 25 Stockland property community entries in `data/knowledge-base.json`
- Simulated DM generation for testing ingestion pipeline

#### UI Components
- `StatusTag` — Color-coded status badges for DM states
- `ConfidenceMeter` — Progress bar with high/medium/low thresholds and warning indicators
- `NotificationBell` — Animated bell icon with unread count badge
- `Header` — Responsive navigation with role display and mobile menu
- `InboxPanel` — Filterable, searchable DM list with lazy loading
- `DMDetailView` — Full DM detail with workflow progress indicator
- `DraftComposer` — AI draft editing with knowledge base context panel
- `LeadCaptureSidebar` — Editable lead fields with Salesforce and escalation actions
- `NotificationCenter` — Dropdown notification panel with filtering

#### API Endpoints
- `GET /api/health` — Health check endpoint
- `POST /api/dm/ingest` — DM ingestion
- `GET /api/dm/inbox` — Inbox listing with filters and pagination
- `POST /api/dm/draft` — Draft generation
- `POST /api/dm/draft/submit` — Draft approval and submission
- `POST /api/lead/extract` — Lead data extraction
- `GET /api/leads` — Lead listing with filters
- `POST /api/leads` — Lead creation
- `GET /api/leads/[leadId]` — Lead detail retrieval
- `PATCH /api/leads/[leadId]` — Lead field updates
- `POST /api/leads/[leadId]/salesforce` — Salesforce lead creation
- `POST /api/leads/[leadId]/escalate` — Lead escalation
- `GET /api/notifications` — Notification retrieval
- `PATCH /api/notifications` — Mark notification as read
- `POST /api/sla/check` — SLA breach scan
- `GET /api/audit` — Audit log retrieval

#### Custom Hooks
- `useInbox` — Inbox data fetching, filtering, polling, and pagination
- `useDraft` — Draft generation, editing, and submission state management
- `useLead` — Lead CRUD, Salesforce integration, and escalation
- `useNotifications` — Notification fetching, polling, and mark-as-read

#### Testing
- Compliance guardrails test suite (PII scrubbing, draft validation, lead scoring, audit logging)
- PII scrubber test suite (email, phone, credit card, TFN, Medicare, address detection)
- Draft generation service test suite (generation, submission, compliance enforcement, end-to-end workflow)
- Lead manager test suite (CRUD, Salesforce integration, escalation, auto-escalation rules)
- DraftComposer component test suite (rendering, generation, editing, submission, confidence, error handling)
- InboxPanel component test suite (rendering, status tags, filters, search, selection, empty/loading/error states)
- LeadCaptureSidebar component test suite (auto-filled fields, editing, Salesforce creation, flag toggle, notifications)

[1.0.0]: https://github.com/stockland/social-dm-copilot/releases/tag/v1.0.0