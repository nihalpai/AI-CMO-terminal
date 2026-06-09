# Global Project Constitution: AI CMO Terminal

This project uses a headless architecture: a Next.js frontend and a Python FastAPI backend.

## 1. Core Directives (Never Override)
- **FastAPI Routing Lock:** Do NOT modify `main.py` routing logic. You may add `app.include_router(...)` calls only.
- **Design System Lock:** Keep the existing emerald/slate color palette and Plus Jakarta Sans font. Do not change `globals.css` color tokens.
- **Mock Hiring Data:** `USE_MOCK_APIFY` must remain `true` in `.env` during all development. Set to `false` only for targeted live ATS scraping tests.
- **Component Reuse:** Always use existing `@/components/ui/*` primitives (Card, Button, Badge, ScrollArea, Separator, Skeleton) before writing new ones.
- **Secrets:** Never log or expose env values. Backend secrets live in Render environment variables. Frontend secrets live in Vercel environment variables.

## 2. Tech Stack
- **Frontend:** Next.js 16.2.6 (App Router + Turbopack), React, Tailwind CSS, Shadcn/Base UI
- **Backend:** Python FastAPI, Lyzr Automata (legacy, keep untouched), Lyzr Studio Agents (active — 9 agents), Gemini 2.5 Flash Lite, Claude Haiku, Perplexity Sonar Small
- **Database:** Supabase (PostgreSQL) — `analysis_jobs` table, `watchlist` table
- **APIs:** Firecrawl (legacy pipeline only), Serper.dev (hiring signals), Lyzr Studio API (raw `httpx` calls — no extra client library needed)

## 2a. Lyzr Studio Toggle
`USE_LYZR_STUDIO=true/false` in `backend/.env` switches between pipelines:
- `true` → `lyzr_studio_pipeline.py` (10 Studio agents: Company Classifier, Competitor Finder, Website Researcher, Pain Points Synthesizer, SEO Analyzer, GEO Scorer, Strategy Synthesizer, CMO Chat, Content Writer, LLMs.txt Generator)
- `false` → `ai_pipeline.py` (original Lyzr Automata pipeline, never modify this file)

Both produce identical Supabase `result` schema. See `LYZR_INTEGRATION.md` for the complete integration spec including all agent input/output formats and the full orchestration code.

## 3. Production URLs
- **Frontend:** https://don-drapor.vercel.app (Vercel)
- **Backend:** https://don-drapor.onrender.com (Render, free tier — ~30s cold start after inactivity)
- **Health check:** https://don-drapor.onrender.com/health

## 4. Architecture Overview
```
Browser → Vercel (don-drapor.vercel.app)
            ↓ NEXT_PUBLIC_API_BASE_URL
          Render (don-drapor.onrender.com)
            ↓ env vars in Render dashboard
          FastAPI + slowapi rate limiting
            ↓
          Supabase (analysis_jobs, watchlist)
          Gemini / Firecrawl / Serper
```

**Local dev:** Frontend on port 3000, backend on port 8000. `NEXT_PUBLIC_API_BASE_URL` defaults to `http://localhost:8000` if not set.

## 5. Dashboard Tabs (All Complete)
Default landing tab: **Company** (set in `DashboardLayout.tsx`).

| Tab | Component | Key Data |
|-----|-----------|----------|
| Company | `CompanyPanel.tsx` | `company_description`, competitors, navCards (AI CMO Chat, Content Playbook, Full GTM Report, Analytics) |
| Analytics | `AnalyticsCenter.tsx` | traffic_signals, white_space_opportunities, geo_signals |
| Agents | `AgentsFeed.tsx` + `AgentCard.tsx` | 8 agent cards (incl. GEO Agent), DraftPanel |
| Reports | `ReportsTab.tsx` | Full GTM report, hiring signals |

Fixed AI CMO Chat sidebar: `AICMOChat.tsx` (always visible, 340px). Clicking "AI CMO Chat" in the Company navCards focuses the chat input via `focusTrigger` prop.

**Company/competitor logos:** Google favicon service (`https://www.google.com/s2/favicons?sz=64&domain={domain}`) — configured in `next.config.ts` `images.remotePatterns`. Used in `CompanyPanel.tsx`, `TerminalHeader.tsx`, `AgentCard.tsx`.

**Shared text utilities:** `frontend/lib/text-utils.tsx` — use `renderInline(text)` for markdown bold rendering, `cleanUrls(text)` to strip scraped markdown/URL artifacts from hiring signals, `renderBlocks(text)` for full multi-paragraph markdown rendering. Import these in any component that displays AI-generated or scraped text.

## 6. Agent Pipeline Keys (Required in every analysis result)
All fields required in the Supabase `result` blob — both pipelines must produce these:
- `company_name` — short human-readable company name (from Company Classifier)
- `company_description` — factual 3-4 sentence company overview (from Company Classifier)
- `summary` — GTM strategy framing (from Strategy Synthesizer)
- `competitors` — list of `{name, url}` objects, deduplicated, no publisher domains (from Competitor Finder)
- `white_space_opportunities` — min 3 items (from SEO Analyzer)
- `recommended_channels` — min 3 items (from SEO Analyzer)
- `content_recommendations` — min 3 items (from SEO Analyzer `content_opportunities` field — note key rename)
- `hiring_signals` — min 2 items, format: `"[Competitor]: [Signal] signals [Implication]"` (from `linkedin_scraper.py`)
- `traffic_signals` — `{search, direct, social, paid}` integers summing to ~100 (from SEO Analyzer)
- `geo_signals` — `{geo_score, ai_visibility, schema_gaps, freshness_issue, geo_recommendations}` (from GEO Scorer)

See `LYZR_INTEGRATION.md` Section 6 for the exact assembly mapping.

## 7. Hiring Signals Source
`backend/linkedin_scraper.py` — ATS job board strategy (NOT LinkedIn):
- `USE_MOCK_APIFY=true` → dynamic mock keyed to actual competitor names
- `USE_MOCK_APIFY=false` → Serper finds Greenhouse/Lever/Ashby URLs → Firecrawl scrapes → Serper news fallback
- LinkedIn is permanently blocked by Firecrawl — never attempt to scrape it

## 8. Lyzr Session ID Rules
- **Pipeline calls:** Every agent call in `run_analysis()` must use `job_id` as the `session_id`. Never use a hardcoded string like `"pipeline"` — shared session IDs cause context from previous analyses to bleed into new ones.
- **CMO Chat calls:** Use `job_id` from the Supabase row as `session_id` — ties conversation memory to the specific analysis.
- **Content Writer calls:** Use `job_id` as `session_id` for the same isolation reason.
- **LLMs.txt Generator calls:** Use `job_id` as `session_id` for the same isolation reason.

## 9. Competitor Extraction Rules
**Legacy pipeline (`ai_pipeline.py`):** `_PUBLISHER_DOMAINS` blocklist filters out media/aggregator sites. Competitors deduplicated with `list(dict.fromkeys(...))` after JSON parse.

**Studio pipeline (`lyzr_studio_pipeline.py`):** Competitor Finder agent handles filtering via its instructions. Publisher domain exclusion and sister-company exclusion are enforced in the agent prompt.

## 10. Completed Sprints
- **Sprint 1:** Core pipeline (Researcher → Strategist → Execution), Supabase caching, FastAPI async background tasks
- **Sprint 2:** Tabbed layout, theme toggle (light/dark), DraftPanel, watchlist CRUD
- **Sprint 3:** Apify removed, dynamic mock data, Serper-based hiring signals
- **Sprint 4:** Dashboard content fixes — company_description, geo_signals, real traffic tab, navCard documents, always-visible Draft button
- **Sprint 5:** URL normalization (`https://` prepend), null safety, LinkedIn → ATS job board scraping
- **Sprint 6:** Production deployment — Vercel + Render, CORS from env var, frontend API base URL from env var
- **Sprint 7:** Lyzr Studio 9-agent pipeline — `lyzr_studio_pipeline.py`, `cmo_chat_agent_studio.py`, `USE_LYZR_STUDIO` toggle. All env vars filled locally. Pending: Render dashboard env vars + production deploy.
- **Sprint 8:** DraftPanel platform selector — `/api/v1/draft` endpoint, Content Writer agent wired per platform (reddit/twitter/linkedin/hackernews/blog/email), `company_name` + `hiring_signals` passed as context. Competitor URLs stored in result. UI UX polish across all 4 tabs.

## 11. Outstanding Security Items (Do Before Going Public)
These are not blocking for private testing but must be done before sharing the URL widely:
- **Rate limiting on `/api/v1/chat` and `/api/v1/watchlist/run`** — currently unprotected, anyone can spam Gemini calls. Extract shared limiter to `backend/limiter.py` to avoid circular imports.
- **Supabase Auth (`@supabase/ssr`)** — magic link email allowlist login + `middleware.ts` route protection. Do NOT use NextAuth/Auth.js — adding it on top of Supabase creates two auth systems competing for session ownership. Use Supabase's own auth package instead.
- **Supabase RLS** — enable row level security on `analysis_jobs` and `watchlist` tables.
- **Playwright smoke tests** — 3 golden-path tests: (1) home page loads, (2) submit URL → result renders, (3) dashboard elements visible. Run `npm init playwright@latest` in the frontend folder. Run tests against staging before every deploy.

## 12. Security Philosophy (Prompt Injection)
Do NOT use `guardrails-ai` for prompt injection — the `detect_prompt_injection` validator depends on Pinecone + a separate OpenAI API call per request, with no published accuracy numbers. Use structural isolation instead: user-supplied input must only ever appear in the `user` turn of the LLM prompt, never interpolated into the `system` prompt. This is the correct defense and requires no additional libraries.

## 13. Next Steps
**Sprints 1–8 are complete.** Remaining for Sprint 7 production: add all `LYZR_AGENT_*` env vars + `USE_LYZR_STUDIO=true` to the Render dashboard, then redeploy.

**Sprint 9 — GEO Agent Card + LLMs.txt Generator:**
- Add an 8th agent card (GEO Agent) to the Agents tab, sourcing `geo_signals.geo_recommendations` from the Supabase result
- New Lyzr Studio agent: **LLMs.txt Generator** (`LYZR_AGENT_LLMSTXT_GENERATOR`) — generates a deployment-ready `llms.txt` file for the user's company website
- New backend endpoint: `/api/v1/draft` with `platform: "llmstxt"` branch calls the LLMs.txt Generator
- DraftPanel copy button lets user deploy the generated file to their web root
- See `lyzr_agents.md` Agent 10 for the full agent spec and `MASTER_PLAN.md` Sprint 9 for the task breakdown

**Security hardening is on the backburner** — do not implement rate limiting on `/api/v1/chat`, Supabase Auth, or RLS until explicitly requested.

## 14. Workflow
- **ALWAYS use Plan Mode first** for any feature touching the pipeline or layout.
- **Context Compression:** Use `repomix` if context drift occurs.
- **Testing:** Always test with `USE_MOCK_APIFY=true` first; use `false` only for targeted live validation.
- **Next.js version:** This project runs Next.js 16.2.6 — APIs and conventions may differ from training data. Check `node_modules/next/dist/docs/` before writing any Next.js-specific code.
- **Security review:** Before each major feature release, review against the [OWASP LLM Top 10](https://github.com/owasp/www-project-top-10-for-large-language-model-applications) (LLM01–LLM05 are most relevant).
