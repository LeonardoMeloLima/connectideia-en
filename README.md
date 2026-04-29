# ConnectIdeia — English Landing Page

High-conversion landing page with AI-powered business diagnosis. A six-step interactive flow captures qualified leads, generates personalized diagnoses through Google Gemini, and routes them to WhatsApp for conversion.

**Live:** https://www.connectideia.com

---

## What it does

A visitor walks through six steps inside an in-page modal:

1. **Email** — basic contact, validated client-side
2. **Stage** — Idea / Operating / Scaling
3. **Bottleneck** — LP / App / Automation / Ecosystem
4. **Site URL** — visitor pastes the URL of their own business
5. **AI diagnosis** — backend scrapes the visitor's site (Jina AI primary, Cheerio fallback) and sends the content + stage + bottleneck to Gemini, which returns a 3-part personalized output: **business identification + main GAP + recommended action**
6. **Timing + WhatsApp** — visitor confirms urgency and shares contact, then is redirected to WhatsApp with a pre-filled summary of their lead

Steps 1–3 cost zero AI tokens. Step 4–5 only run if the visitor reaches them (high-intent traffic), keeping AI cost predictable.

---

## Architecture

```
                        Browser (www.connectideia.com)
                                       │
                                       │ static
                                       ▼
                              ┌─────────────────┐
                              │  Vercel CDN     │
                              │  (HTML/CSS/JS)  │
                              └─────────────────┘
                                       │
                  ┌────────────────────┴────────────────────┐
                  │                                         │
                  ▼                                         ▼
   ┌─────────────────────────────┐          ┌──────────────────────────┐
   │  Supabase Edge Function     │          │   Vercel Functions       │
   │  /functions/v1/analyze      │          │   /api/*                 │
   │  (Deno)                     │          │   (Node.js serverless)   │
   │                             │          │                          │
   │  • Origin allowlist         │          │   • save-lead            │
   │  • Per-IP rate limit        │          │   • get-leads (admin)    │
   │  • Scrape (Jina → Cheerio)  │          │   • admin / admin-login  │
   │  • Call Gemini 2.5 Flash    │          │   • whatsapp-send        │
   │                             │          │   • whatsapp-webhook     │
   │                             │          │   • analyze (fallback)   │
   └──────────────┬──────────────┘          └────────────┬─────────────┘
                  │                                      │
                  ▼                                      ▼
        ┌──────────────────┐                    ┌────────────────┐
        │ Google Gemini    │                    │ Supabase       │
        │ 2.5 Flash (REST) │                    │ Postgres       │
        └──────────────────┘                    └────────────────┘
                                                         │
                                                         ▼
                                            ┌────────────────────────┐
                                            │ Twilio  +  Z-API       │
                                            │ (WhatsApp send)        │
                                            └────────────────────────┘
```

The AI scoring path runs on a **Supabase Edge Function** (Deno, region-distributed). Lead persistence and WhatsApp routing run on **Vercel Functions** (Node.js). Visitor's browser talks to both.

---

## Stack

| Layer           | Tech                                                                      |
| --------------- | ------------------------------------------------------------------------- |
| Frontend        | Vanilla HTML/JS — Webflow template + custom logic in `js/lead-form.js`    |
| Static hosting  | Vercel                                                                    |
| AI / scraping   | Supabase Edge Function (Deno) → Gemini 2.5 Flash via REST                 |
| Lead store      | Supabase Postgres (via Vercel Function)                                   |
| WhatsApp        | Twilio + Z-API (dual integration)                                         |
| Admin dashboard | Vercel Function with password auth                                        |

---

## Project structure

```
.
├── index.html                       # The LP itself (Webflow template, customized)
├── js/
│   └── lead-form.js                 # Multi-step flow + Edge Function call + WhatsApp redirect
├── api/                             # Vercel serverless functions (Node.js)
│   ├── analyze.js                   #   Gemini call — kept as fallback
│   ├── save-lead.js                 #   POST  → Supabase Postgres
│   ├── get-leads.js                 #   GET   admin-only
│   ├── admin.js                     #   GET   admin dashboard data
│   ├── admin-login.js               #   POST  admin password check
│   ├── whatsapp-send.js             #   POST  outbound WhatsApp via Twilio/Z-API
│   ├── whatsapp-webhook.js          #   POST  inbound WhatsApp from Twilio
│   └── test.js                      #   GET   health check
├── supabase/
│   ├── config.toml                  # Edge Function declaration
│   └── functions/analyze/
│       ├── index.ts                 # Deno port — origin allowlist + rate limit
│       └── deno.json
├── *.jpg, *.png, favicon.svg        # LP assets (compressed)
├── package.json
├── vercel.json
└── README.md
```

---

## Environment variables

All variables live in the deployment platform (Vercel for `api/*`, Supabase secrets for the Edge Function). None of them ship to the browser.

| Variable                  | Where               | Used by                                       |
| ------------------------- | ------------------- | --------------------------------------------- |
| `GEMINI_API_KEY`          | Vercel + Supabase   | `api/analyze.js` (fallback) + Edge Function   |
| `OPENAI_API_KEY`          | Vercel              | `api/analyze.js` (alt fallback, optional)     |
| `SUPABASE_URL`            | Vercel              | save-lead, get-leads, whatsapp-webhook        |
| `SUPABASE_ANON_KEY`       | Vercel              | save-lead, get-leads, whatsapp-webhook        |
| `ADMIN_PASSWORD`          | Vercel              | admin, admin-login                            |
| `TWILIO_ACCOUNT_SID`      | Vercel              | whatsapp-send                                 |
| `TWILIO_AUTH_TOKEN`       | Vercel              | whatsapp-send                                 |
| `TWILIO_WHATSAPP_FROM`    | Vercel              | whatsapp-send (sender number)                 |
| `ZAPI_CLIENT_TOKEN`       | Vercel              | whatsapp-send (Z-API alternative)             |
| `ZAPI_INSTANCE_ID`        | Vercel              | whatsapp-send (Z-API alternative)             |
| `ZAPI_TOKEN`              | Vercel              | whatsapp-send (Z-API alternative)             |

The frontend embeds the **Supabase publishable key** (`sb_publishable_...`) directly in `js/lead-form.js`. This is by design — publishable keys are public-by-design and protected by the Edge Function's origin allowlist + rate limit.

---

## Local development

```bash
git clone https://github.com/LeonardoMeloLima/connectideia-en.git
cd connectideia-en
npm install

# Pull env vars from Vercel (must be project owner)
vercel link
vercel env pull .env.local

# Local dev server (proxies api/* to Vercel runtime)
npm run dev
# → http://localhost:3000
```

To deploy Edge Function changes:

```bash
supabase login
supabase functions deploy analyze --project-ref <project-ref>
```

---

## Deployment

```bash
npm run deploy        # Vercel preview (auth-protected URL)
npm run deploy:prod   # promote to www.connectideia.com
```

GitHub `main` is the source of truth. Pushes do **not** trigger automatic deploys — deployment is explicit via the CLI.

---

## Architectural decisions

- **Why Edge Function for the AI call, not Vercel serverless.** Migrated `analyze` from Vercel to Supabase to consolidate AI invocations in a separate platform: own quota, dedicated logs per function, region-distributed execution. The Vercel serverless version (`api/analyze.js`) is intentionally kept as a fallback during the rollout window — both endpoints work today.

- **Why origin allowlist + IP rate limit, not JWT.** The LP is fully public (no user accounts), so JWT issuance for anonymous visitors adds friction without much value. An origin allowlist (5 known domains) + 5 req/min/IP best-effort rate limit covers the practical attack surface for a marketing endpoint.

- **Why two scrape paths (Jina AI primary, Cheerio fallback).** Jina handles JS-rendered SPAs cleanly but occasionally times out; raw fetch + Cheerio is the resilience layer. Either path that returns ≥150 chars wins.

- **Why a Webflow template instead of a custom build.** The LP is a marketing surface — speed-to-market beat purity. Business logic (form flow + AI integration + WhatsApp routing) is fully isolated in `js/lead-form.js`, which makes a future migration to Astro / Next a contained project rather than a rewrite.

- **Why Twilio AND Z-API for WhatsApp.** Twilio is the audited integration; Z-API is a Brazilian provider with cheaper outbound for local numbers. Code path picks whichever credentials are configured.

---

## Known limitations

- **Git history still carries the original 89MB images.** `HEAD` is 13MB after compression, but a fresh clone pulls the older blobs through history. A `git filter-repo` rewrite is on the roadmap, blocked by the destructive force-push it requires.
- **No automated tests.** Conversion is monitored in production. CI-level smoke tests (HTML 200, JS 200, Edge Function 200) are the next planned addition.
- **Webflow CSS still in use.** Visual layer depends on `cdn.prod.website-files.com/...webflow.shared.min.css`. Migration to a custom Astro + Tailwind build is on the roadmap.
- **Rate limit is in-memory per Edge Function isolate.** Best-effort, not durable across cold starts. Will move to a Supabase counter table if abuse becomes measurable.
- **PT and EN versions live in separate repositories** sharing the same Supabase project. EN consumes the `analyze` function; the PT companion (planned) will deploy its own `analyze-pt`.

---

## Author

Built by [Leonardo Melo Lima](https://github.com/LeonardoMeloLima).

License: **UNLICENSED** — proprietary, all rights reserved.
