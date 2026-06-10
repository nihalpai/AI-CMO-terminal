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
| **Agents** | 8 agent cards (Reddit, SEO, X, Articles, HN, LinkedIn, UGC Video, GEO) + DraftPanel |
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

### Current: Sprint 9 — GEO Agent Card + LLMs.txt Generator
Adding an 8th agent card (GEO Agent) to the Agents tab, sourcing `geo_signals.geo_recommendations`. New LLMs.txt Generator agent (Agent 10) generates a deployment-ready `llms.txt` file for the user's company website — a Markdown file placed at `yourdomain.com/llms.txt` that helps AI assistants accurately cite the company, improving GEO score. Clicking "Draft →" on any GEO recommendation generates the full file.

### Future
| Feature | Goal |
|---------|------|
| Real-time monitoring | Daily Serper diff on watchlist items, alert on new hiring signal |
| Multi-URL analysis | Analyze 2-3 competitors side-by-side |
| GA4 OAuth | Replace LLM-estimated traffic mix with real GA4 data |
| Export | PDF report, Notion export, Slack digest |
