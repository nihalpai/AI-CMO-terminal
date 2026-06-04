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

## ✅ Sprint 7 — Lyzr Studio Agent Integration (COMPLETE)

**Goal:** Replace the Lyzr Automata pipeline with 9 Lyzr Studio agents behind a `USE_LYZR_STUDIO` toggle. The original `ai_pipeline.py` remains untouched — both pipelines run in parallel, switched by env var.

See `LYZR_INTEGRATION.md` for the complete implementation spec.

| Task | File | Status |
|---|---|---|
| All 9 agents built and tested in Studio | Lyzr Studio | ✅ Done |
| Fill all `LYZR_AGENT_*` env vars in `.env` | `backend/.env` | ✅ Done |
| Pipeline uses raw `httpx` — no extra package needed | `backend/requirements.txt` | ✅ N/A |
| Create `lyzr_studio_pipeline.py` | `backend/` | ✅ Done |
| Create `agents/cmo_chat_agent_studio.py` | `backend/agents/` | ✅ Done |
| Add `USE_LYZR_STUDIO` toggle to `main.py` | `backend/main.py` | ✅ Done |
| Add `USE_LYZR_STUDIO` toggle to `routers/agents.py` | `backend/routers/agents.py` | ✅ Done |
| End-to-end test with `USE_LYZR_STUDIO=true` locally | local | ✅ Done |
| Add env vars to Render dashboard | Render | ⬜ Pending |
| Deploy to production with `USE_LYZR_STUDIO=true` | Render | ⬜ Pending |

**Bugs fixed during Sprint 7:**
- **URL scoping:** Company Classifier was classifying parent companies instead of the URL-specific product (e.g. `amazon.com` returned AWS + ecommerce together). Fixed by adding a URL-scoping rule as the first instruction in the agent: classify only the product/business unit at the exact URL provided, not the corporate parent's full portfolio.
- **Session ID bleed:** All pipeline agent calls were using `session_id="pipeline"` — a single shared session accumulating context from every analysis ever run. This caused context from previous analyses to bleed into new ones, producing inconsistent results vs. testing in Studio. Fixed: `run_analysis()` now accepts `job_id` and passes it as the `session_id` for all agent calls, giving each analysis its own isolated Lyzr session.
- **`one_liner` vs `description`:** Company Classifier agent in Studio was outputting `one_liner` instead of `description`, causing `company_description` to come back empty in the frontend. Fix: update the agent instructions and structured output schema in Studio to use `"description"` as the key.

---

## 🚧 Sprint 8 — DraftPanel Platform Selector (CURRENT)

**Goal:** Wire the Content Writer agent to the DraftPanel. User selects a platform (X, LinkedIn, Reddit, Blog, HN, Email), backend calls the Content Writer agent with that platform and the stored analysis context.

| Task | File | Status |
|---|---|---|
| Add platform selector UI to DraftPanel | `frontend/components/dashboard/DraftPanel.tsx` | ⬜ |
| Add `/api/v1/draft` endpoint | `backend/routers/agents.py` | ⬜ |
| Call Content Writer agent from backend | `backend/lyzr_studio_pipeline.py` | ⬜ |
| Pass `job_id` + `platform` + `content_recommendation` from frontend | frontend → backend | ⬜ |
| Display plain text draft response in DraftPanel | `frontend/components/dashboard/DraftPanel.tsx` | ⬜ |

---

## Backlog (On Hold)

### Security Hardening — Do Not Implement Until Explicitly Requested
- **Rate limit `/api/v1/chat` and `/api/v1/watchlist/run`** — extract shared limiter to `backend/limiter.py`
- **Supabase Auth (`@supabase/ssr`)** — magic link + email allowlist. Do NOT use NextAuth.
- **Supabase RLS** — `own_rows` policy on `watchlist`, UUID-unguessable SELECT on `analysis_jobs`
- **Playwright smoke tests** — 3 tests: home loads, submit URL → result renders, dashboard visible

### Future Features
| Feature | Goal |
|---------|------|
| DraftPanel platform selector | Platform selector (X, LinkedIn, Reddit, Blog, HN, Email) wired to Content Writer agent |
| Real-time monitoring | Daily Serper diff on watchlist items, alert on new hiring signal |
| Multi-URL analysis | Analyze 2-3 competitors simultaneously, side-by-side view |
| GA4 OAuth | Replace AI-estimated traffic mix with real GA4 data |
| Export | PDF report, Notion export, Slack digest |

---

## Key Invariants (Never Change)
- `USE_MOCK_APIFY=true` in `.env` during all development
- Do not modify `main.py` routing logic (add `include_router` only)
- Do not modify `ai_pipeline.py` — legacy pipeline must remain intact
- Keep emerald/slate design system
- Security hardening is intentionally deferred — do not implement until explicitly requested
