# Grand Vision: AI CMO Terminal

## 1. Product Vision
A terminal-style AI CMO SaaS for technical startup founders. The user submits any competitor's URL and receives a full competitive intelligence report — scraping, analysis, and GTM strategy — surfaced through a 4-tab interactive dashboard with 7 specialized AI agent cards and a persistent AI CMO chat sidebar.

**Live:** https://don-drapor.vercel.app

---

## 2. Target Audience
Technical startup founders (e.g. YC alumni, indie hackers) who want actionable competitor intelligence without paying for enterprise tools like SimilarWeb or hiring a growth consultant.

---

## 3. Current Architecture (Production)

```
Browser → Vercel (don-drapor.vercel.app)
            ↓ NEXT_PUBLIC_API_BASE_URL
          Render free tier (don-drapor.onrender.com)
            ↓ env vars in Render dashboard
          FastAPI + slowapi
            ↓
          Supabase (PostgreSQL)
          Gemini 2.5 Flash Lite / Firecrawl / Serper.dev
```

**Frontend:** Next.js 16.2.6 (App Router + Turbopack), React, Tailwind CSS, Shadcn UI — hosted on Vercel free tier

**Backend:** Python 3.11, FastAPI, Lyzr Automata — hosted on Render free tier (note: ~30s cold start after 15 min inactivity)

**Database:** Supabase (PostgreSQL) — `analysis_jobs` table (7-day cache), `watchlist` table

---

## 4. AI Agent Pipeline

Three agents chained via Lyzr Automata `LinearSyncPipeline`. All agents use **Gemini 2.5 Flash Lite** via the OpenAI-compatibility endpoint (`https://generativelanguage.googleapis.com/v1beta/openai/`).

| Agent | Role |
|---|---|
| **Researcher** | Extracts pricing tiers, competitor positioning, SEO keywords, and hiring signals from Firecrawl-scraped markdown |
| **Strategist** | Identifies GTM white-space opportunities and channel recommendations for a challenger brand |
| **Execution** | Formats final output as strict JSON with all required dashboard fields |

**Data flow:**
1. User submits URL → `POST /api/v1/analyze` returns `job_id` instantly (202)
2. Background task: Firecrawl scrapes the URL → Serper searches for competitors → Lyzr pipeline runs (~2–3 min)
3. Result inserted into Supabase `analysis_jobs`
4. Frontend polls Supabase every 2s → renders dashboard when `status = completed`

---

## 5. Dashboard (4 Tabs, All Complete)

| Tab | Key Content |
|-----|-------------|
| **Company** | Company overview, competitor list, navCards linking to other tabs |
| **Analytics** | AI-estimated traffic mix (search/direct/social/paid), white space opportunities, GEO/AI visibility score |
| **Agents** | 7 agent cards (Reddit, SEO, X, Articles, HN, LinkedIn, UGC Video) + DraftPanel slide-out |
| **Reports** | Full GTM report, hiring signals, content recommendations |

Fixed sidebar: AI CMO Chat (`AICMOChat.tsx`) — always visible at 340px, powered by `/api/v1/chat`

---

## 6. Data Sources (What's Actually Implemented)

| Source | Status | Usage |
|--------|--------|-------|
| Firecrawl | ✅ Live | Scrapes competitor URLs for raw markdown |
| Serper.dev | ✅ Live | Finds competitors, ATS job board URLs, news signals |
| Gemini 2.5 Flash Lite | ✅ Live | All three pipeline agents |
| ATS Job Boards (Greenhouse/Lever/Ashby) | ✅ Live (mock by default) | Hiring signals via `USE_MOCK_APIFY=false` |
| DataForSEO | ❌ Not implemented | Traffic data is LLM-estimated, not real |
| Reddit/PRAW | ❌ Not implemented | White space opportunities are LLM-generated |
| LinkedIn scraping | ❌ Permanently blocked | Replaced with ATS job board strategy |

---

## 7. What Was Deliberately Removed or Changed

| Original Plan | Reality |
|---|---|
| Hosted on Vercel (frontend) | ✅ Correct — Vercel free tier |
| Hosted on Render or Railway (backend) | ✅ Render free tier |
| AWS ECS Fargate | Dropped — unnecessary complexity and cost for this scale |
| Apify LinkedIn scraper | Removed — replaced with Serper + Firecrawl ATS strategy |
| DataForSEO traffic data | Never implemented — traffic mix is LLM-estimated |
| PRAW Reddit API | Never implemented — Reddit insights are LLM-generated |
| `guardrails-ai` prompt injection | Commented out in requirements.txt — future hardening item |
| `@upstash/ratelimit` on Next.js layer | Not implemented — using `slowapi` on FastAPI instead |
| `gpt-4o-mini` / `gpt-4o` model routing | All agents use Gemini 2.5 Flash Lite |
| Weekly email digest | Scrapped — adds complexity for no core value |
| Custom domain | Not purchased — using `don-drapor.vercel.app` and `don-drapor.onrender.com` |

---

## 8. Security Status

| Item | Status |
|------|--------|
| CORS locked to production origin | ✅ Done — reads from `CORS_ORIGINS` env var |
| Rate limiting on `/api/v1/analyze` | ✅ Done — 10/minute via slowapi |
| Frontend API URL from env var | ✅ Done — `NEXT_PUBLIC_API_BASE_URL` |
| Secrets in env vars (not in code) | ✅ Done — Render + Vercel dashboards |
| Rate limiting on `/api/v1/chat` | ❌ Not yet — DoW exposure |
| Rate limiting on `/api/v1/watchlist/run` | ❌ Not yet — DoW exposure |
| User authentication | ❌ Not yet — all endpoints publicly accessible |
| Supabase Row Level Security | ❌ Not yet — anon key has full table access |

---

## 9. Roadmap

### Immediate (Security — before going public)
1. Rate limit `/api/v1/chat` and `/api/v1/watchlist/run`
2. Auth.js v5 — email allowlist, magic link login, `middleware.ts` route protection
3. Supabase RLS — per-user row isolation on `watchlist`

### Near-term (Quality)
- Agent output quality — specific pricing tiers, verbatim positioning, publication-ready content hooks
- DraftPanel platform selector (X, LinkedIn, Reddit, Blog)

### Future
- Real-time competitor monitoring (daily Serper diff on watchlist)
- Multi-URL side-by-side comparison
- GA4 OAuth — real traffic data
- PDF / Notion / Slack export
