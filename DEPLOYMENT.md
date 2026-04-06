# Deployment Guide — Social DM Co-Pilot

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Vercel Deployment](#vercel-deployment)
  - [1. Connect GitHub Repository](#1-connect-github-repository)
  - [2. Configure Environment Variables](#2-configure-environment-variables)
  - [3. Project Settings](#3-project-settings)
  - [4. Deploy](#4-deploy)
- [Environment Variable Reference](#environment-variable-reference)
- [Domain Configuration](#domain-configuration)
- [CI/CD Pipeline](#cicd-pipeline)
  - [Automatic Deployments](#automatic-deployments)
  - [Preview Deployments](#preview-deployments)
  - [Branch Protection](#branch-protection)
- [Monitoring and Logging](#monitoring-and-logging)
  - [Vercel Dashboard](#vercel-dashboard)
  - [Runtime Logs](#runtime-logs)
  - [Audit Logs](#audit-logs)
  - [Health Check Endpoint](#health-check-endpoint)
- [Scaling Considerations](#scaling-considerations)
  - [Serverless Function Limits](#serverless-function-limits)
  - [In-Memory Store Limitations](#in-memory-store-limitations)
  - [OpenAI API Rate Limits](#openai-api-rate-limits)
  - [Salesforce API Limits](#salesforce-api-limits)
  - [Migration Path to Production](#migration-path-to-production)
- [Troubleshooting](#troubleshooting)
  - [Build Failures](#build-failures)
  - [Environment Variable Issues](#environment-variable-issues)
  - [API Route Errors](#api-route-errors)
  - [Salesforce Integration Issues](#salesforce-integration-issues)
  - [OpenAI Integration Issues](#openai-integration-issues)
  - [SLA and Notification Issues](#sla-and-notification-issues)
- [Security Notes](#security-notes)

---

## Overview

Social DM Co-Pilot is a Next.js 14 (App Router) application deployed on Vercel. It provides AI-powered DM management for Stockland property communities, including lead capture, draft response generation, Salesforce CRM integration, and SLA monitoring.

The application is designed as a **pilot deployment** with in-memory data stores. For production use, the in-memory stores should be replaced with a persistent database (see [Migration Path to Production](#migration-path-to-production)).

**Tech Stack:**
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **AI:** OpenAI GPT-4 (configurable model)
- **CRM:** Salesforce REST API (OAuth2 Username-Password flow)
- **Auth:** NextAuth.js (configured but not enforced in pilot)
- **Testing:** Vitest + React Testing Library
- **Hosting:** Vercel

---

## Prerequisites

Before deploying, ensure you have:

1. A [GitHub](https://github.com) account with the repository pushed
2. A [Vercel](https://vercel.com) account (free tier is sufficient for pilot)
3. An [OpenAI](https://platform.openai.com) API key with access to GPT-4 (or GPT-3.5-turbo)
4. (Optional) A Salesforce Connected App configured for OAuth2 Username-Password flow
5. Node.js 18+ installed locally for development and testing

---

## Vercel Deployment

### 1. Connect GitHub Repository

1. Log in to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New…"** → **"Project"**
3. Select **"Import Git Repository"**
4. Authorize Vercel to access your GitHub account if not already connected
5. Find and select the `social-dm-copilot` repository
6. Click **"Import"**

### 2. Configure Environment Variables

Before the first deployment, configure all required environment variables in the Vercel project settings.

1. In the Vercel project dashboard, navigate to **Settings** → **Environment Variables**
2. Add each variable listed in the [Environment Variable Reference](#environment-variable-reference) section below
3. Set the appropriate **Environment** scope for each variable:
   - **Production** — variables used in the live deployment
   - **Preview** — variables used in PR preview deployments
   - **Development** — variables used when running `vercel dev` locally

> **Important:** Never commit `.env` or `.env.local` files to the repository. The `.gitignore` file already excludes these.

### 3. Project Settings

In the Vercel project dashboard under **Settings** → **General**, verify the following:

| Setting | Value |
|---|---|
| **Framework Preset** | Next.js |
| **Root Directory** | `./` (repository root) |
| **Build Command** | `next build` (default) |
| **Output Directory** | `.next` (default) |
| **Install Command** | `npm install` (default) |
| **Node.js Version** | 18.x or 20.x |

Under **Settings** → **Functions**, verify:

| Setting | Value |
|---|---|
| **Region** | Select the region closest to your primary users (e.g., `syd1` for Sydney, Australia) |
| **Max Duration** | 10 seconds (default for Hobby plan; increase on Pro plan if needed) |

### 4. Deploy

1. After configuring environment variables and project settings, click **"Deploy"** from the project overview page
2. Vercel will automatically:
   - Install dependencies (`npm install`)
   - Run the build (`next build`)
   - Deploy the application to a `.vercel.app` domain
3. Once the deployment completes, verify the application is running by visiting:
   - `https://your-project.vercel.app` — main application
   - `https://your-project.vercel.app/api/health` — health check endpoint

---

## Environment Variable Reference

All environment variables from `.env.example` with descriptions and configuration guidance:

### NextAuth.js Configuration

| Variable | Required | Description | Example |
|---|---|---|---|
| `NEXTAUTH_URL` | Yes | The canonical URL of your deployed site. Must match the actual deployment URL. | `https://social-dm-copilot.vercel.app` |
| `NEXTAUTH_SECRET` | Yes | A random secret used to encrypt tokens and sign cookies. Generate with: `openssl rand -base64 32` | `a1b2c3d4e5f6...` (32+ character random string) |

> **Generating NEXTAUTH_SECRET:**
> ```bash
> openssl rand -base64 32
> ```
> Copy the output and paste it as the value for `NEXTAUTH_SECRET` in Vercel.

### OpenAI API Configuration

| Variable | Required | Description | Example |
|---|---|---|---|
| `OPENAI_API_KEY` | Yes | Your OpenAI API key for generating DM response suggestions. Obtain from [OpenAI Platform](https://platform.openai.com/api-keys). | `sk-proj-abc123...` |
| `OPENAI_MODEL` | No | The OpenAI model to use for generating responses. Defaults to `gpt-4`. | `gpt-4`, `gpt-4-turbo`, `gpt-3.5-turbo` |

> **Note:** If `OPENAI_API_KEY` is not set, the application falls back to simulated (template-based) responses. This is useful for pilot testing without incurring API costs.

### Salesforce OAuth2 Configuration

| Variable | Required | Description | Example |
|---|---|---|---|
| `SALESFORCE_CLIENT_ID` | No* | The Connected App consumer key from Salesforce Setup. | `3MVG9...` |
| `SALESFORCE_CLIENT_SECRET` | No* | The Connected App consumer secret from Salesforce Setup. | `ABC123DEF456...` |
| `SALESFORCE_INSTANCE_URL` | No* | The base URL of your Salesforce instance. | `https://yourorg.my.salesforce.com` |
| `SALESFORCE_USERNAME` | No* | The Salesforce username for API authentication. | `admin@yourorg.com` |
| `SALESFORCE_PASSWORD` | No* | The Salesforce password with security token appended if required. | `MyPassword123SecurityToken` |

> **\*Salesforce variables are optional for pilot.** If `SALESFORCE_INSTANCE_URL` is not configured, the application operates in **simulated mode** — lead creation requests return mock success responses with a `pending_manual` status. This allows the full workflow to be tested without a live Salesforce connection.

**Setting up a Salesforce Connected App:**

1. In Salesforce Setup, navigate to **App Manager** → **New Connected App**
2. Enable **OAuth Settings**
3. Set the callback URL to `https://your-project.vercel.app/api/auth/callback/salesforce`
4. Select OAuth scopes: `api`, `refresh_token`, `offline_access`
5. Save and note the **Consumer Key** and **Consumer Secret**
6. Append your Salesforce security token to your password if IP restrictions are enabled

### SLA and Priority Configuration

| Variable | Required | Description | Default | Example |
|---|---|---|---|---|
| `SLA_BREACH_MINUTES` | No | Number of minutes before a DM is considered to have breached the SLA response time. | `60` | `60`, `30`, `120` |
| `HIGH_PRIORITY_THRESHOLD` | No | Confidence threshold (0.0 to 1.0) above which a message is flagged as high priority. | `0.8` | `0.8`, `0.9`, `0.75` |

---

## Domain Configuration

### Custom Domain Setup

1. In the Vercel project dashboard, navigate to **Settings** → **Domains**
2. Click **"Add"** and enter your custom domain (e.g., `dm-copilot.stockland.com.au`)
3. Vercel will provide DNS records to configure:
   - **A Record:** `76.76.21.21` (for apex domains)
   - **CNAME Record:** `cname.vercel-dns.com` (for subdomains)
4. Add the DNS records to your domain registrar or DNS provider
5. Vercel will automatically provision an SSL certificate via Let's Encrypt
6. Update `NEXTAUTH_URL` to match your custom domain

### Recommended Domain Structure

| Environment | Domain |
|---|---|
| Production | `dm-copilot.stockland.com.au` |
| Staging | `staging-dm-copilot.stockland.com.au` |
| Preview | Auto-generated `*.vercel.app` URLs |

---

## CI/CD Pipeline

### Automatic Deployments

Vercel automatically deploys the application when changes are pushed to the repository:

| Branch | Deployment Type | URL |
|---|---|---|
| `main` | **Production** | `https://your-project.vercel.app` (or custom domain) |
| Any other branch | **Preview** | `https://your-project-<hash>.vercel.app` |

Every push to `main` triggers a new production deployment. The deployment process:

1. Vercel detects the push via GitHub webhook
2. Dependencies are installed (`npm install`)
3. The application is built (`next build`)
4. If the build succeeds, the new version is deployed atomically
5. If the build fails, the previous production deployment remains active

### Preview Deployments

Every pull request automatically receives a preview deployment:

1. Open a PR against `main` (or any configured branch)
2. Vercel creates a unique preview URL for the PR
3. The preview URL is posted as a comment on the PR
4. Each subsequent push to the PR branch updates the preview deployment
5. Preview deployments use the **Preview** environment variables configured in Vercel

Preview deployments are useful for:
- QA review before merging
- Stakeholder review of UI changes
- Testing environment variable changes in isolation

### Branch Protection

Recommended GitHub branch protection rules for `main`:

1. Navigate to **GitHub** → **Settings** → **Branches** → **Branch protection rules**
2. Add a rule for `main` with:
   - ✅ Require pull request reviews before merging
   - ✅ Require status checks to pass before merging (select the Vercel deployment check)
   - ✅ Require branches to be up to date before merging
   - ✅ Do not allow bypassing the above settings

---

## Monitoring and Logging

### Vercel Dashboard

The Vercel project dashboard provides:

- **Deployments** — history of all deployments with status, duration, and logs
- **Analytics** — page views, web vitals (LCP, FID, CLS), and visitor metrics (Pro plan)
- **Speed Insights** — real user performance monitoring (Pro plan)
- **Logs** — real-time and historical function invocation logs

### Runtime Logs

Access runtime logs for API routes and server-side functions:

1. Navigate to **Vercel Dashboard** → **Your Project** → **Logs**
2. Filter by:
   - **Level:** Error, Warning, Info
   - **Source:** Build, Edge, Serverless Function
   - **Status Code:** 4xx, 5xx for error investigation
   - **Path:** Filter by specific API route (e.g., `/api/dm/draft`)

### Audit Logs

The application maintains an internal audit log accessible via the API:

```
GET /api/audit
```

Query parameters for filtering:
- `action` — Filter by action type (e.g., `DRAFT_GENERATED`, `LEAD_CREATED`, `SALESFORCE_LEAD_CREATION_INITIATED`)
- `actor` — Filter by actor (e.g., `system`, `officer-123`)
- `entityRef` — Filter by entity reference (e.g., a DM ID or lead ID)
- `startDate` — ISO8601 start date for time range filtering
- `endDate` — ISO8601 end date for time range filtering

> **Note:** In the pilot deployment, audit logs are stored in-memory and are reset on each deployment or serverless function cold start. For production, integrate with a persistent logging service.

### Health Check Endpoint

Monitor application availability using the health check endpoint:

```
GET /api/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2024-10-28T09:15:00.000Z",
  "version": "0.1.0"
}
```

Configure an uptime monitoring service (e.g., UptimeRobot, Pingdom, or Vercel's built-in monitoring) to poll this endpoint at regular intervals.

---

## Scaling Considerations

### Serverless Function Limits

Vercel serverless functions have the following limits:

| Limit | Hobby Plan | Pro Plan |
|---|---|---|
| **Execution Duration** | 10 seconds | 60 seconds |
| **Memory** | 1024 MB | 1024 MB (configurable to 3008 MB) |
| **Payload Size** | 4.5 MB | 4.5 MB |
| **Concurrent Executions** | 10 | 1000 |

For the pilot deployment, the Hobby plan limits are sufficient. If draft generation via OpenAI exceeds 10 seconds, consider:
- Switching to `gpt-3.5-turbo` for faster responses
- Upgrading to the Vercel Pro plan for 60-second function duration
- Implementing streaming responses for the draft generation endpoint

### In-Memory Store Limitations

The pilot uses in-memory stores (`dm-store.ts`, `lead-store.ts`, `draft-store.ts`, `notification-store.ts`). This means:

- **Data is not persisted** across deployments or serverless function cold starts
- **Each serverless function instance** has its own copy of the in-memory store
- **Sample data** from `data/sample-dms.json` and `data/sample-leads.json` is loaded on initialization
- **Concurrent requests** may be handled by different function instances with different state

This is acceptable for pilot testing and demonstrations. For production, see [Migration Path to Production](#migration-path-to-production).

### OpenAI API Rate Limits

OpenAI enforces rate limits based on your plan:

| Tier | Requests per Minute | Tokens per Minute |
|---|---|---|
| Free | 3 | 40,000 |
| Tier 1 | 60 | 60,000 |
| Tier 2 | 100 | 80,000 |
| Tier 3+ | 500+ | 160,000+ |

If rate limits are hit, the draft generation service falls back to simulated (template-based) responses. Monitor your OpenAI usage at [platform.openai.com/usage](https://platform.openai.com/usage).

### Salesforce API Limits

Salesforce enforces daily API call limits based on your edition:

| Edition | Daily API Calls |
|---|---|
| Developer | 15,000 |
| Professional | 100,000 |
| Enterprise | 100,000+ |

The application uses the Salesforce REST API with retry logic (max 3 retries with exponential backoff). Monitor API usage in Salesforce Setup under **System Overview**.

### Migration Path to Production

For production deployment beyond the pilot phase:

1. **Database:** Replace in-memory stores with a persistent database:
   - PostgreSQL via Vercel Postgres or Supabase
   - MongoDB via MongoDB Atlas
   - Prisma ORM for type-safe database access

2. **Authentication:** Enable and enforce NextAuth.js authentication:
   - Configure Salesforce as an OAuth provider
   - Add role-based access control (Social Media Officer, Sales Consultant, Admin)

3. **Caching:** Add Redis (Vercel KV or Upstash) for:
   - Knowledge base caching
   - Session management
   - Rate limiting

4. **Queue Processing:** Move long-running tasks to background jobs:
   - Draft generation via OpenAI
   - Salesforce lead creation
   - SLA breach scanning

5. **Observability:** Integrate with a monitoring platform:
   - Sentry for error tracking
   - Datadog or New Relic for APM
   - Structured logging with a log aggregation service

6. **Webhook Integration:** Replace polling with real-time webhooks:
   - Facebook/Instagram Messenger Platform webhooks for incoming DMs
   - Salesforce Platform Events for CRM status updates

---

## Troubleshooting

### Build Failures

**Symptom:** Deployment fails during the build step.

**Common causes and solutions:**

1. **TypeScript errors:**
   ```
   Type error: Property 'x' does not exist on type 'Y'
   ```
   - Run `npx tsc --noEmit` locally to identify type errors
   - Fix all type errors before pushing

2. **Missing dependencies:**
   ```
   Module not found: Can't resolve 'package-name'
   ```
   - Ensure the package is listed in `package.json`
   - Run `npm install` and commit the updated `package-lock.json`

3. **Import path errors:**
   ```
   Module not found: Can't resolve '@/lib/...'
   ```
   - Verify the `@/*` path alias is configured in `tsconfig.json`
   - Ensure the imported file exists at the specified path

4. **Node.js version mismatch:**
   - Verify the Node.js version in Vercel matches your local version
   - Set the Node.js version in Vercel under **Settings** → **General** → **Node.js Version**

### Environment Variable Issues

**Symptom:** Application runs but features are broken or returning errors.

1. **Variables not available at runtime:**
   - Verify variables are added in Vercel under **Settings** → **Environment Variables**
   - Ensure the correct environment scope is selected (Production, Preview, Development)
   - Redeploy after adding or changing environment variables

2. **NEXTAUTH_URL mismatch:**
   - `NEXTAUTH_URL` must exactly match the deployment URL (including `https://`)
   - Update this value when switching between custom domains and `.vercel.app` URLs

3. **OpenAI API key invalid:**
   - Verify the key starts with `sk-` and is active at [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
   - Check that the key has not been revoked or expired

4. **Variables with special characters:**
   - Salesforce passwords with special characters may need URL encoding
   - Wrap values in double quotes if they contain spaces or special characters

### API Route Errors

**Symptom:** API routes return 500 errors.

1. **Check Vercel function logs:**
   - Navigate to **Vercel Dashboard** → **Logs**
   - Filter by the failing API route path
   - Look for stack traces and error messages

2. **Common 500 errors:**
   - `DM not found` — The requested DM ID does not exist in the in-memory store (may have been cleared on cold start)
   - `Draft not found` — The draft was created in a different serverless function instance
   - `Lead not found` — The lead was created in a different serverless function instance

3. **Timeout errors:**
   - OpenAI API calls may exceed the serverless function timeout
   - Reduce the `max_tokens` parameter or switch to a faster model
   - Upgrade to Vercel Pro for longer function execution times

### Salesforce Integration Issues

**Symptom:** Lead creation in Salesforce fails or returns errors.

1. **Authentication failures (`auth_failed` status):**
   - Verify all five Salesforce environment variables are set correctly
   - Ensure the Salesforce password includes the security token (append it directly)
   - Check that the Connected App is activated and the OAuth scopes are correct
   - Verify the Salesforce user has API access enabled in their profile

2. **Lead creation failures (`creation_failed` status):**
   - Check Salesforce validation rules that may reject the lead data
   - Ensure required fields (LastName, Company) are populated
   - Review Salesforce debug logs for detailed error messages

3. **Simulated mode active when live mode expected:**
   - Verify `SALESFORCE_INSTANCE_URL` is set and not empty
   - Redeploy after adding the environment variable

### OpenAI Integration Issues

**Symptom:** Draft generation returns generic/template responses instead of AI-generated content.

1. **Simulated mode active:**
   - Verify `OPENAI_API_KEY` is set in Vercel environment variables
   - The application falls back to simulated responses when the key is missing or invalid

2. **Rate limit errors:**
   - Check your OpenAI usage dashboard for rate limit hits
   - Consider upgrading your OpenAI plan or reducing request frequency

3. **Model not available:**
   - Verify the model specified in `OPENAI_MODEL` is available on your OpenAI account
   - GPT-4 requires a separate access approval from OpenAI for some accounts
   - Fall back to `gpt-3.5-turbo` if GPT-4 is not available

### SLA and Notification Issues

**Symptom:** SLA breaches are not detected or notifications are not appearing.

1. **SLA breach detection:**
   - SLA breaches are checked via `POST /api/sla/check` — this must be called periodically
   - Configure a cron job or external scheduler to call this endpoint every 5-10 minutes
   - Vercel Cron Jobs (Pro plan) can be configured in `vercel.json`:
     ```json
     {
       "crons": [
         {
           "path": "/api/sla/check",
           "schedule": "*/5 * * * *"
         }
       ]
     }
     ```

2. **Notifications not appearing:**
   - Notifications are stored in-memory and may be lost on cold starts
   - Verify the `recipientId` parameter matches the expected recipient
   - Check the notification API: `GET /api/notifications?recipientId=sales-consultant-default`

3. **SLA threshold configuration:**
   - Default SLA threshold is 60 minutes
   - Adjust via the `SLA_BREACH_MINUTES` environment variable
   - Redeploy after changing the value

---

## Security Notes

1. **Environment Variables:** All secrets (API keys, passwords, tokens) must be stored as Vercel environment variables. Never commit secrets to the repository.

2. **PII Protection:** The application includes a PII scrubber (`lib/compliance/pii-scrubber.ts`) that redacts personal information before sending content to the OpenAI API and before writing to audit logs. This complies with Australian Privacy Act requirements.

3. **Human-in-the-Loop:** All AI-generated draft responses require explicit human review and approval before sending. The compliance guardrails (`lib/compliance/compliance-guardrails.ts`) enforce this requirement and log all approval actions.

4. **Bias Mitigation:** Lead scoring does not use demographic fields (age, gender, ethnicity, religion, nationality, marital status, disability). The compliance guardrails reject any lead scoring attempt that includes prohibited demographic fields.

5. **Audit Trail:** All significant actions (DM ingestion, draft generation, draft approval, lead creation, Salesforce integration, escalation) are logged via the audit logger with actor identification, timestamps, and PII-scrubbed details.

6. **HTTPS:** Vercel enforces HTTPS on all deployments by default. Custom domains receive automatic SSL certificates via Let's Encrypt.

7. **CORS:** Next.js API routes are same-origin by default. If cross-origin access is needed, configure CORS headers explicitly in the API route handlers.