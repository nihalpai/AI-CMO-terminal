# Grand Vision: AI CMO Terminal

## 1. Product Vision
A terminal-style AI CMO SaaS for technical startup founders. The user submits any competitor's URL and receives a full competitive intelligence report — competitor discovery, deep website research, SEO gap analysis, GEO scoring, and a GTM strategy — surfaced through a 4-tab interactive dashboard with 7 specialized AI agent cards, a persistent AI CMO chat sidebar, and on-demand content drafting for Reddit, X, LinkedIn, HackerNews, blog, and email.

**Live:** https://don-drapor.vercel.app

---

## 2. Target Audience
Technical startup founders (e.g. YC alumni, indie hackers) who want actionable competitor intelligence without paying for enterprise tools like SimilarWeb or hiring a growth consultant.

---

## 3. Architecture

```
Browser → Vercel (don-drapor.vercel.app)
            ↓ NEXT_PUBLIC_API_BASE_URL
          Render free tier (don-drapor.onrender.com)
            ↓ env vars in Render dashboard
          FastAPI + slowapi
            ↓
          Supabase (PostgreSQL)
          Lyzr Studio Agents / Lyzr Automata (toggled by USE_LYZR_STUDIO)
          Claude Haiku / Perplexity Sonar Small / Gemini 2.5 Flash Lite
```

**Frontend:** Next.js 16.2.6 (App Router + Turbopack), React, Tailwind CSS, Shadcn UI — Vercel free tier

**Backend:** Python 3.11, FastAPI — Render free tier (~30s cold start after 15 min inactivity)

**Database:** Supabase (PostgreSQL) — `analysis_jobs` table (7-day cache), `watchlist` table

---

## 4. AI Agent Pipeline

Two pipelines run in parallel, switched by `USE_LYZR_STUDIO` env var:

### Active: Lyzr Studio Pipeline (`USE_LYZR_STUDIO=true`)

10 agents orchestrated by Python (`lyzr_studio_pipeline.py`). Each agent is a separate Lyzr Studio agent called via raw `httpx` against the Lyzr Agent API.

| # | Agent | Model | Purpose |
|---|---|---|---|
| 1 | **Company Classifier** | Claude Haiku | Classifies target company: industry, business model, persona, description |
| 2 | **Competitor Finder** | Perplexity Sonar Small | Finds top 5 direct competitors with name + URL using classifier output as context |
| 3 | **Website Researcher** | Perplexity Sonar Small | Researches each competitor individually (positioning, pricing, community complaints) |
| 4 | **Pain Points Synthesizer** | Claude Haiku | Consolidates all competitor complaints into 5 market pain point themes |
| 5 | **SEO Analyzer** | Perplexity Sonar Small | Searches buyer intent queries, identifies keyword gaps and white space |
| 6 | **GEO Scorer** | Perplexity Sonar Small | Scores how likely the company appears in AI-generated answers |
| 7 | **Strategy Synthesizer** | Claude Haiku | Writes the final GTM strategy summary from all agent outputs |
| 8 | **AI CMO Chat** | Claude Haiku | Conversational CMO powered by full report context + Lyzr Memory |
| 9 | **Content Writer** | Claude Haiku | Writes platform-specific copy (Reddit, X, LinkedIn, HN, blog, email) on demand |
| 10 | **LLMs.txt Generator** | Claude Haiku | Generates a deployment-ready `llms.txt` file to improve AI discoverability (GEO) |
| 11 | **Video Strategist** | Claude Haiku | Classifies company type, selects 2026 retention hook, writes script + shot plan for short-form ad (Phase A) |

**Data flow (Studio):**
1. User submits URL → `POST /api/v1/analyze` returns `job_id` instantly (202)
2. Background task: Company Classifier → Competitor Finder → Website Researcher ×5 → Pain Points Synthesizer → SEO Analyzer → GEO Scorer → Strategy Synthesizer → Hiring Signals (Python)
3. Assembled result inserted into Supabase `analysis_jobs`
4. Frontend polls → renders dashboard when `status = completed`

See `LYZR_INTEGRATION.md` for complete input/output specs for every agent.

### Legacy: Lyzr Automata Pipeline (`USE_LYZR_STUDIO=false`)

3-agent `LinearSyncPipeline` using Gemini 2.5 Flash Lite via OpenAI-compat endpoint. **Never modify `ai_pipeline.py`** — this pipeline stays intact as the fallback.

| Agent | Role |
|---|---|
| **Researcher** | Extracts pricing, positioning, SEO keywords from Firecrawl-scraped markdown |
| **Strategist** | Identifies GTM white-space and channel recommendations |
| **Execution** | Formats final output as strict JSON |

---

## 5. Dashboard (4 Tabs)

| Tab | Key Content |
|-----|-------------|
| **Company** | Company overview, competitor list, navCards |
| **Analytics** | Traffic mix (search/direct/social/paid), white space opportunities, GEO score |
| **Agents** | 8 agent cards (Reddit, SEO, X, Articles, HN, LinkedIn, UGC Video, GEO) + DraftPanel + VideoPanel (UGC Video) |
| **Reports** | Full GTM report, hiring signals, content recommendations |

Fixed sidebar: AI CMO Chat (`AICMOChat.tsx`) — always visible at 340px

---

## 6. Data Sources

| Source | Status | Usage |
|--------|--------|-------|
| Lyzr Studio Agents | ✅ Active | 10-agent pipeline (competitor research, SEO, GEO, strategy, content, LLMs.txt) |
| Perplexity Sonar Small | ✅ Active | Built-in search for Competitor Finder, Website Researcher, SEO Analyzer, GEO Scorer |
| Claude Haiku | ✅ Active | Company Classifier, Pain Points Synthesizer, Strategy Synthesizer, CMO Chat, Content Writer, LLMs.txt Generator |
| Serper.dev | ✅ Active | ATS job board URLs + news signals for hiring signals |
| ATS Job Boards (Greenhouse/Lever/Ashby) | ✅ Active (mock by default) | Hiring signals via `USE_MOCK_APIFY=false` |
| Gemini 2.5 Flash Lite | ✅ Legacy | Original 3-agent pipeline (`USE_LYZR_STUDIO=false`) |
| Firecrawl | ✅ Legacy | Used in original pipeline only — not used by Studio agents |
| DataForSEO | ❌ Not implemented | Traffic signals are LLM-estimated |
| Reddit/PRAW | ❌ Not implemented | Community insights come from Perplexity search results |
| LinkedIn scraping | ❌ Permanently blocked | Replaced with ATS job board strategy |

---

## 7. What Was Deliberately Changed

| Original Plan | Reality |
|---|---|
| Lyzr Automata as permanent orchestration layer | Replaced by Lyzr Studio agents — Automata kept as legacy fallback |
| Single Gemini model for all agents | Mixed model strategy: Claude Haiku (reasoning), Perplexity Sonar Small (search) |
| Firecrawl for all scraping | Studio agents use Perplexity built-in search — Firecrawl only in legacy pipeline |
| 5 separate content writing agents (Reddit, X, LinkedIn, etc.) | Replaced by 1 Content Writer agent with platform passed as input — 5x token saving |
| Competitor finding via Serper + publisher domain blocklist | Competitor Finder agent with classifier context — more accurate, no hardcoded blocklist |
| Separate Researcher/Strategist/Execution agents | 9 specialized agents with clear single responsibility each |
| Apify LinkedIn scraper | Removed — ATS job board strategy (Greenhouse/Lever/Ashby) |
| AWS ECS Fargate | Dropped — Render free tier sufficient |
| Weekly email digest | Scrapped — adds complexity for no core value |
| Custom domain | Not purchased — using production URLs as-is |

---

## 8. Security Status

| Item | Status |
|------|--------|
| CORS locked to production origin | ✅ Done |
| Rate limiting on `/api/v1/analyze` | ✅ Done — 10/minute via slowapi |
| Frontend API URL from env var | ✅ Done |
| Secrets in env vars | ✅ Done |
| Password gate (`proxy.ts` + shared password cookie) | ✅ Done — sufficient for private invites |
| Rate limiting on `/api/v1/chat` | ❌ Deferred — not blocking |
| Rate limiting on `/api/v1/watchlist/run` | ❌ Deferred — not blocking |
| Per-user authentication (Supabase Auth) | ❌ Deferred — not blocking |
| Supabase Row Level Security | ❌ Deferred — not blocking |

**Security hardening is intentionally deferred.** Do not implement until explicitly requested.

---

## 9. Roadmap

### ✅ Completed: Sprint 7 — Lyzr Studio Integration
`lyzr_studio_pipeline.py` and `cmo_chat_agent_studio.py` implemented. `USE_LYZR_STUDIO` toggle live in both `main.py` and `routers/agents.py`. All env vars filled locally and pipeline tested end-to-end. Pending: add Render dashboard env vars + flip toggle in production.

### ✅ Completed: Sprint 8 — DraftPanel Platform Selector + UI Polish
Content Writer agent wired to DraftPanel. Agent card "Draft →" buttons call `/api/v1/draft` with `platform` + `content_recommendation` → Content Writer returns publish-ready copy. `company_name` + `hiring_signals` now passed as context. Competitors stored as `{name, url}` objects and rendered as clickable links. Shared `text-utils.tsx` rendering utilities added. Full UI/UX pass across all 4 tabs.

### ✅ Completed: Sprint 10 — Password Gate + Shareable Deep Links
Entire frontend protected by a shared password via Next.js `proxy.ts` + httpOnly session cookie. Unauthenticated visitors are redirected to `/login?redirect=<original-url>` and land back at the correct page after logging in. After analysis completes the browser URL updates to `/?job=<uuid>&tab=<tabid>&site=<domain>` — shareable links auto-load the analysis from Supabase and open the correct tab. Tab switches keep `?tab=` in sync via `replaceState`. Frontend env vars: `SHARED_PASSWORD` + `SESSION_TOKEN` (Vercel only).

### ✅ Completed: Sprint 9 — GEO Agent Card + LLMs.txt Generator
GEO Agent card live in Agents tab. LLMs.txt Generator (Agent 10) created in Lyzr Studio and generates deployment-ready `llms.txt` files via GEO Agent card — fully working locally. Pending: add `LYZR_AGENT_LLMSTXT_GENERATOR` to Render env vars at production deploy time.

### ✅ Sprint 11 — UGC Video Generation Pipeline (working in production)
AI-driven short-form video. Video Strategist agent (Agent 11) classifies company type and writes a 2026-retention-optimised **15-second** script + shot plan (Phase A). Higgsfield CLI generates a `marketing_studio_video` talking-head (Phase B, ~5 min). VideoPanel shows progress + player. **A 15s talking-head renders reliably end-to-end.**

> **Sprint 11b — reliability fixes (done).** The first build failed on nearly every run. Root cause: the backend sent a word-count-inflated duration (17–20s) instead of the agent's designed 15s, and Higgsfield's `marketing_studio_video` fails server-side at ≥17s. Fixed by sending the designed 15s (`_planned_duration`, `VIDEO_MAX_DURATION=15`). Also gated off three flags — preset `--avatars`, `--setting_id`, `--web_product_ids` — though those were **precautionary, not proven causes** (every failing job with them also had a bad ≥17s duration; never isolated — may work at 15s). Disabled FFmpeg composition/Supabase upload (50 MB bucket limit), so the output is the bare Higgsfield-CDN talking-head (no b-roll overlay yet). Full evidence-graded docs: `video_strategist_agent.md` → "Hard Constraints & Why Generation Breaks".

> **Sprint 11c — production worker (done).** The Higgsfield CLI is OAuth-based (no static API key) and can't run on Render's ephemeral box. Solved with a **queue + remote worker**: Render only enqueues (`USE_VIDEO_WORKER=true`) a `pending` row into the `video_jobs` table; a free **Oracle Cloud Always-Free VM** runs `backend/scripts/video_worker.py` 24/7 (systemd), where the CLI is authenticated, and renders by polling that table. They communicate only through Supabase. Setup runbook: `backend/scripts/WORKER_SETUP.md`. See `CLAUDE.md` Sprint 11c for the full architecture + gotchas (status CHECK constraint, no double-renderers, re-auth maintenance).

### 🔜 Sprint 12 — Video Composition + Virality Scoring
Re-enable product b-roll by composing **short** clips (≤15s each, to stay under the render cliff) into one ad — needs a video-hosting target since composed files exceed the 50 MB Supabase bucket. Tighten agent scripts so 15s isn't rushed. Wire Higgsfield brain-activity virality scoring.

### Future
| Feature | Goal |
|---------|------|
| Real-time monitoring | Daily Serper diff on watchlist items, alert on new hiring signal |
| Multi-URL analysis | Analyze 2-3 competitors side-by-side |
| GA4 OAuth | Replace LLM-estimated traffic mix with real GA4 data |
| Export | PDF report, Notion export, Slack digest |
