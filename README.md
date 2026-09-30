# SecureShield AI

Governed revenue intelligence: an AI-native B2B SaaS workspace that reads a sales pipeline, calls and accounts and turns them into briefings and next actions — with every workspace isolated at the database level.

> SecureShield AI is a sales/revenue intelligence platform. It is **not** a cybersecurity product and makes **no** certification or compliance claims. The website only describes controls that exist in this repository.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Supabase (Auth, PostgreSQL, Row Level Security, Storage) · Gemini API (server-side) · React Hook Form + Zod · Recharts

## What is in the box

| Area | What it does |
| --- | --- |
| Marketing site | Home, Security & Governance, Features, Pricing, About, Contact, Privacy, Terms |
| Auth | Sign up, sign in, sign out, forgot/reset password, protected routes, session refresh in `src/proxy.ts` |
| Onboarding | Profile + organization + revenue goals → creates the workspace through a database function |
| Pipeline / Accounts / Leads | CRUD, search, filter, sort, pagination, board + table views, stage history, contacts, activities, CSV import (upload → validate → preview → confirm) |
| Lead scoring | Transparent 100-point rule set (`src/lib/scoring.ts`), breakdown shown per lead, nothing stored or invented |
| Conversations | Paste/upload transcripts or upload audio (private storage); Gemini extracts summary, intent, sentiment, objections, commitments, competitors, decision criteria, next action |
| Briefings | Gemini writes from a stored metrics snapshot; the snapshot is displayed beside the briefing |
| Actions / Insights / Reports | Rule-based, evidence-carrying, zero-credit: derived only from workspace records. Reports export CSV/JSON/print |
| AI Assistant | Gemini answers from the signed-in user's workspace data only |
| Credits | Per-org balance, atomic debit + automatic refund on failure, ledger, monthly refresh, low-credit warning, Usage page |
| Plans | Free 200 credits · Starter $47 / 4,000 · Pro $57 / 7,000 · Scale $97 / 11,000. Upgrade buttons open *your* payment links |
| Team | Invitations (shareable link, bound to an email), role changes, removal |

### Credit costs

Briefing 100 · Conversation analysis 50 · Assistant question 10 · Follow-up draft 10. Scoring, insights, action finding, reports and imports are free. Defined in `src/lib/plans.ts`.

## Roles (enforced in the database)

See `src/lib/permissions.ts` (the single source for every permissions table on the site) and `supabase/migrations/0002_rls.sql`.

- **Member** – read everything in the workspace; create/edit accounts, leads, opportunities, activities, conversations, actions; use AI features.
- **Admin** – plus delete records, invite/remove members, edit workspace details.
- **Owner** – plus invite/remove admins and change roles.

## Setup

1. **Supabase project** – create one, then run `supabase/migrations/0001_schema.sql` and `0002_rls.sql` in the SQL editor (in order).
2. **Auth settings** – Authentication → URL Configuration: set *Site URL* to your domain and add `https://<your-domain>/auth/callback` (and `http://localhost:3000/auth/callback` for local use) to the redirect list. Decide whether *Confirm email* is on; both flows are handled.
3. **Environment** – copy `.env.example` to `.env.local` and fill it in. Never commit real values (`.env*` is git-ignored).
4. **Run** – `npm install && npm run dev`.

### Environment variables

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + server Supabase client (RLS protects data) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only**, used by `/api/billing/webhook` alone |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Server only. Use a key from a billing-enabled Google AI project |
| `STARTER_PAYMENT_LINK`, `PRO_PAYMENT_LINK`, `SCALE_PAYMENT_LINK` | Your payment-page URLs |
| `BILLING_WEBHOOK_SECRET` | 24+ char secret authenticating plan confirmations |
| `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_COMPANY_NAME` | Site metadata and footer/contact details |

### Payments

There is no payment gateway and no fake checkout. Upgrade buttons open your payment link in a new tab and the UI never claims a payment happened. A plan changes only when something authenticated confirms it:

```bash
curl -X POST https://<your-domain>/api/billing/webhook \
  -H "Authorization: Bearer $BILLING_WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"org_id":"<workspace uuid>","plan":"pro","status":"active","reference":"<payment ref>"}'
```

This calls the service-role-only `apply_plan()` function, which sets the plan and resets the credit allowance. Wire your payment provider's confirmation (or your own automation) to this endpoint.

## Testing

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run test:logic  # scoring, analytics, insights, actions, CSV, reports, plans
npm run test:db     # applies the migrations to an in-process Postgres and verifies RLS, roles, credits, storage isolation
npm run build
```

`test:db` runs the real migration files against PGlite with a minimal stub of Supabase's `auth`/`storage` schemas and checks cross-organization reads, writes, deletes, references, role permissions, credit atomicity/refunds and file-path isolation.

## Known limits

- Analytics load up to 10,000 rows per table per request; beyond that move aggregation into SQL views.
- Audio is sent to Gemini inline (12 MB limit); longer recordings should be transcribed first.
- Invitations are shareable links (no email is sent by the app).
- One workspace per user in the UI (the schema supports more).
- AI-drafted follow-ups are drafts; nothing is ever sent on a user's behalf.
