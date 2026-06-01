# Global Project Constitution: AI CMO Terminal

This project uses a headless architecture: a Next.js frontend and a Python FastAPI backend.

## 1. Core Directives (Never Override)
- **FastAPI Routing Lock:** Do NOT modify `main.py` routing logic. You may add `app.include_router(...)` calls only.
- **Design System Lock:** Keep the existing emerald/slate color palette and Plus Jakarta Sans font. Do not change `globals.css` color tokens.
- **Budget Protection Rule:** `USE_MOCK_APIFY` must remain `true` in `.env` during all development. Never trigger live Apify runs.
- **Component Reuse:** Always use existing `@/components/ui/*` primitives (Card, Button, Badge, ScrollArea, Separator, Skeleton) before writing new ones.
- **Secrets:** Never log or expose `.env` values. API keys live in `backend/.env` only.

## 2. Tech Stack
- **Frontend:** Next.js 16.2.6 (App Router + Turbopack), React, Tailwind CSS, Shadcn/Base UI
- **Backend:** Python FastAPI, Lyzr Automata, Gemini 2.5 Flash Lite (via OpenAI-compat endpoint)
- **Database:** Supabase (PostgreSQL) — `analysis_jobs` table, `watchlist` table
- **APIs:** Firecrawl (scraping), Serper.dev (search), Resend (email digest)

## 3. Architecture Overview
```
User → Next.js (port 3000)
         ↓ POST /api/v1/analyze
FastAPI (port 8000) → background task
         ↓
ai_pipeline.py: Researcher Agent → Strategist Agent → Execution Agent (Gemini 2.5 Flash Lite)
         ↓
Supabase: analysis_jobs (result jsonb, 7-day cache)
         ↓
Frontend polls /api/v1/analyze/{job_id} every 2s → renders 4-tab dashboard
```

## 4. Dashboard Tabs (All Complete)
| Tab | Component | Key Data |
|-----|-----------|----------|
| Company | `CompanyPanel.tsx` | `company_description`, competitors, navCards |
| Analytics | `AnalyticsCenter.tsx` | traffic_signals, white_space_opportunities, geo_signals |
| Agents | `AgentsFeed.tsx` + `AgentCard.tsx` | 7 agent cards, DraftPanel |
| Reports | `ReportsTab.tsx` | Full GTM report, hiring signals |

Fixed AI CMO Chat sidebar: `AICMOChat.tsx` (always visible, 340px)

## 5. Agent Pipeline Keys (Execution Agent JSON output)
All fields required in every analysis result:
- `company_description` — factual 2-3 sentence company overview
- `summary` — GTM strategy framing
- `competitors` — deduplicated list, no publisher domains
- `white_space_opportunities` — min 3 items
- `recommended_channels` — min 4 items
- `content_recommendations` — min 5 items (feeds agent cards)
- `hiring_signals` — min 2 items, format: `"[Competitor]: [Signal] signals [Implication]"`
- `traffic_signals` — `{search, direct, social, paid}` integers summing to ~100
- `geo_signals` — `{geo_score, ai_visibility, schema_gaps, freshness_issue, geo_recommendations}`

## 6. Hiring Signals Source
`backend/linkedin_scraper.py` — ATS job board strategy (NOT LinkedIn):
- `USE_MOCK_APIFY=true` → dynamic mock keyed to actual competitor names
- `USE_MOCK_APIFY=false` → Serper finds Greenhouse/Lever/Ashby URLs → Firecrawl scrapes → Serper news fallback
- LinkedIn is permanently blocked by Firecrawl — never attempt to scrape it

## 7. Competitor Extraction Rules
`_PUBLISHER_DOMAINS` blocklist in `ai_pipeline.py` filters out media/aggregator sites (Reddit, Forbes, YouTube, etc.) from being returned as competitors. Competitors are deduplicated with `list(dict.fromkeys(...))` after JSON parse.

## 8. Completed Sprints
- **Sprint 1:** Core pipeline (Researcher → Strategist → Execution), Supabase caching, FastAPI async background tasks
- **Sprint 2:** Tabbed layout, theme toggle (light/dark), DraftPanel, watchlist CRUD, weekly email digest
- **Sprint 3:** Apify removed, dynamic mock data, Serper-based hiring signals
- **Sprint 4:** Dashboard content fixes — company_description, geo_signals, real traffic tab, navCard documents, always-visible Draft button
- **Sprint 5:** URL normalization (`https://` prepend), null safety, LinkedIn → ATS job board scraping

## 9. Next Sprint Goal (Sprint 6) — Production Deployment
Feature development is frozen. Sprint 6 is entirely deployment and security hardening. **No pipeline or UI changes until Sprint 6 is complete.**

See `docs/PREFLIGHT_CHECKLIST.md` — all items there must be ticked before any code is written.

### What breaks in production right now (confirmed against code):
- CORS hardcoded to `localhost:3000` → `backend/main.py:33`
- Backend URL hardcoded to `localhost:8000` → `frontend/app/page.tsx:87`, `AICMOChat.tsx:104`, `DraftPanel.tsx:46`
- Resend sender hardcoded to `digest@yourdomain.com` → `backend/services/weekly_digest.py:88`
- No rate limiting on `/api/v1/chat` or `/api/v1/watchlist/run` → DoW exposure
- No user authentication → any caller can burn Gemini/Firecrawl/Serper quota
- No Supabase RLS → anon key has full read access to all rows

### Sprint 6 implementation order (after pre-flight checklist is done):
1. **Backend hardening** — CORS from env var, extract `limiter` to `backend/limiter.py`, add rate limiting to chat/watchlist/digest, parameterize `RESEND_FROM_EMAIL`
2. **Dockerfile** — `backend/Dockerfile`, Python 3.11-slim, non-root user, uvicorn with 2 workers
3. **ECS Task Definition + Service** — SSM Parameter Store secrets injection, ALB health check, CloudWatch logs
4. **Frontend API base URL** — replace all 3 `localhost:8000` hardcodes with `process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000'`
5. **Auth.js v5** — `frontend/lib/auth.ts` (EmailProvider + allowlist), `middleware.ts`, login page, API route
6. **Netlify deploy + DNS** — trigger first build after env vars are set, point domains
7. **Supabase RLS** — enable on `analysis_jobs` and `watchlist`, run policy SQL

### Sprint 6 target architecture:
```
Browser → Netlify (app.yourdomain.com)
            ↓ NEXT_PUBLIC_API_BASE_URL
          Cloudflare WAF (optional)
            ↓
          AWS ALB (443, ACM cert)
            ↓ port 8000 (ALB SG only)
          ECS Fargate (Docker, non-root)
            ↓ secrets from SSM Parameter Store
          FastAPI + slowapi
            ↓
          Supabase (RLS enforced)
```

## 10. Sprint 7 (After Deployment) — Agent Output Quality
Fine-tune all three pipeline agents for publication-ready content:
- Researcher: Extract specific pricing tiers, feature gaps, and verbatim positioning language
- Strategist: Named, attributed hiring insights with explicit strategic implications
- Execution Agent: Content recommendations with specific angles, not topic headings
- DraftPanel: Platform selector (X/LinkedIn/Reddit/Blog) + full publish-ready post output

## 11. Workflow
- **ALWAYS use Plan Mode first** for any feature touching the pipeline or layout.
- **Context Compression:** Use `repomix` if context drift occurs.
- **Testing:** Always test with `USE_MOCK_APIFY=true` first; use `false` only for targeted live validation.
- **Next.js version:** This project runs Next.js 16.2.6 — APIs and conventions may differ from training data. Check `node_modules/next/dist/docs/` before writing any Next.js-specific code.
