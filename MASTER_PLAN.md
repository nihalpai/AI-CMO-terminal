# Don Drapor — AI CMO Terminal: Master Plan

## Product Vision
A terminal-style AI CMO SaaS that takes any company URL and returns a full competitive intelligence report with actionable GTM strategy, surfaced through a 4-tab dashboard with 7 specialized AI agent cards.

**Live at:** https://don-drapor.vercel.app

---

## ✅ Sprint 1 — Core Pipeline (COMPLETE)

**Goal:** End-to-end analysis pipeline from URL → structured JSON report.

| File | What was built |
|------|---------------|
| `backend/ai_pipeline.py` | 3-agent linear pipeline: Researcher → Strategist → Execution (Lyzr Automata + Gemini 2.5 Flash Lite) |
| `backend/main.py` | FastAPI with `/api/v1/analyze` (202 async), Supabase 7-day cache, slowapi rate limiting |
| `backend/linkedin_scraper.py` | Feature-flagged hiring signals (`USE_MOCK_APIFY`) |
| `backend/routers/agents.py` | Agent card content + chat endpoints |
| `backend/routers/company.py` | Company info endpoints |

---

## ✅ Sprint 2 — Dashboard Layout + Features (COMPLETE)

**Goal:** Replace 4-panel layout with tabbed main + persistent AI CMO Chat sidebar.

| File | What was built |
|------|---------------|
| `frontend/components/dashboard/DashboardLayout.tsx` | Tabbed layout: Company / Analytics / Agents / Reports + fixed 340px chat sidebar |
| `frontend/components/dashboard/DraftPanel.tsx` | Slide-in content draft panel (calls `/api/v1/chat`) |
| `frontend/lib/theme.tsx` | ThemeContext with localStorage persistence; toggles `html.light` class |
| `backend/routers/watchlist.py` | CRUD: POST/GET/DELETE `/api/v1/watchlist` + POST `/api/v1/watchlist/run` |

---

## ✅ Sprint 3 — Mock Fix + Apify Removal (COMPLETE)

**Goal:** Remove Apify dependency entirely; fix mock data to use actual competitor names.

- `backend/linkedin_scraper.py`: Replaced Apify calls with Serper-based ATS search. Mock data now keyed to actual competitor names.

---

## ✅ Sprint 4 — Dashboard Content Fixes (COMPLETE)

**Goal:** Fix all 4 tabs — wrong text, broken documents, fake analytics, invisible button.

| Fix | File |
|-----|------|
| `company_description` + `geo_signals` fields | `backend/ai_pipeline.py` |
| Publisher domain blocklist + competitor deduplication | `backend/ai_pipeline.py` |
| About section, navCards, GEO tab, Draft button | `frontend/components/dashboard/*` |
| Remove fake GA/Search Console | `frontend/components/dashboard/AnalyticsCenter.tsx` |

---

## ✅ Sprint 5 — URL Fix + LinkedIn → ATS Job Boards (COMPLETE)

**Goal:** Fix URL crash; replace LinkedIn scraping (permanently blocked by Firecrawl).

| Fix | File |
|-----|------|
| URL normalization (`https://` prepend) | `backend/main.py` |
| Null safety on scrape result | `backend/ai_pipeline.py` |
| ATS job board strategy (Greenhouse/Lever/Ashby) | `backend/linkedin_scraper.py` |

---

## ✅ Sprint 6 — Production Deployment (COMPLETE)

**Goal:** Deploy the app publicly on free infrastructure.

| What was done | Detail |
|---|---|
| CORS from env var | `backend/main.py` reads `CORS_ORIGINS` env var |
| Frontend API base URL | All 3 `localhost:8000` hardcodes replaced with `NEXT_PUBLIC_API_BASE_URL` |
| Backend deployed | Render free tier → `https://don-drapor.onrender.com` |
| Frontend deployed | Vercel → `https://don-drapor.vercel.app` |
| Python version pinned | `backend/runtime.txt` → Python 3.11.9 |
| Weekly digest removed | Scrapped — adds complexity for no core value |

---

## 🚧 Sprint 7 — New Features (CURRENT)

Feature development resumes. Backlog items below — prioritise based on user direction.

---

## Backlog

### Security Hardening (Do Before Going Public)
- **Rate limit `/api/v1/chat` and `/api/v1/watchlist/run`** — extract shared limiter to `backend/limiter.py`, apply `@limiter.limit("10/minute")` decorator to both endpoints
- **Supabase Auth (`@supabase/ssr`)** — magic link + email allowlist. Do NOT use NextAuth — it conflicts with Supabase session management. Use `@supabase/ssr` + `middleware.ts` route protection.
- **Supabase RLS** — `own_rows` policy on `watchlist`, UUID-unguessable SELECT policy on `analysis_jobs`
- **Playwright smoke tests** — `npm init playwright@latest` in frontend; 3 tests: home loads, submit URL → result renders, dashboard elements visible. Hook into CI to run on every deploy.
- **DoW token budgeting** — estimate token cost upfront, reserve in Redis/Supabase, reject with 429 if daily budget exceeded. Implement after auth lands so budget is scoped per user.

### Agent Output Quality
- **Researcher:** Extract specific pricing tiers, verbatim positioning language, named feature gaps
- **Strategist:** Named + attributed hiring insights with explicit strategic implications
- **Execution Agent:** Content recommendations with specific angles — `"[Format]: [Angle] — [Why it wins against [Competitor]]"`
- **DraftPanel:** Platform selector (X, LinkedIn, Reddit, Blog) + full publish-ready post output

### Future Features
| Feature | Goal |
|---------|------|
| Real-time monitoring | Daily Serper diff on watchlist items, alert on new hiring signal |
| Multi-URL analysis | Analyze 2-3 competitors simultaneously, side-by-side view |
| GA4 OAuth | Replace AI-estimated traffic mix with real GA4 data |
| Export | PDF report, Notion export, Slack digest |

---

## Key Invariants (Never Change)
- `USE_MOCK_APIFY=true` in `.env` during all development
- Do not modify `main.py` routing logic (add `include_router` only)
- Keep emerald/slate design system
- Lyzr Automata `LinearSyncPipeline` is the orchestration layer — do not replace with raw LLM calls
