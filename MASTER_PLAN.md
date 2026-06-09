# Don Drapor — AI CMO Terminal: Master Plan

## Product Vision
A terminal-style AI CMO SaaS that takes any company URL and returns a full competitive intelligence report with actionable GTM strategy, surfaced through a 4-tab dashboard with 8 specialized AI agent cards.

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

## ✅ Sprint 8 — DraftPanel Platform Selector (COMPLETE)

**Goal:** Wire the Content Writer agent to the DraftPanel. Agent card items become "Draft →" triggers; backend calls Content Writer with platform + full report context.

| Task | File | Status |
|---|---|---|
| Platform selector UI in DraftPanel (`AGENT_PLATFORM` + `AGENT_CONTENT_TYPE` maps) | `frontend/components/dashboard/DraftPanel.tsx` | ✅ Done |
| Add `/api/v1/draft` endpoint + `DraftRequest` model | `backend/routers/agents.py` | ✅ Done |
| Call Content Writer agent from `/api/v1/draft` | `backend/routers/agents.py` | ✅ Done |
| Pass `job_id` + `platform` + `content_recommendation` from frontend | frontend → backend | ✅ Done |
| Display plain text draft + Copy + Regenerate in DraftPanel | `frontend/components/dashboard/DraftPanel.tsx` | ✅ Done |
| Store `company_name` in Supabase result | `backend/lyzr_studio_pipeline.py` | ✅ Done |
| Pass `company_name` + `hiring_signals` to Content Writer | `backend/routers/agents.py` | ✅ Done |
| Update Content Writer agent instructions to match actual payload | `lyzr_agents.md` + Lyzr Studio | ✅ Done |
| Competitors stored as `{name, url}` objects; clickable links in UI | `lyzr_studio_pipeline.py`, `CompanyPanel.tsx`, `ReportsTab.tsx` | ✅ Done |

**Also completed:** UI/UX polish across all 4 tabs, `text-utils.tsx` shared rendering utilities, `TerminalHeader.tsx` redesign.

---

## 🚧 Sprint 9 — GEO Agent Card + LLMs.txt Generator (CURRENT)

**Goal:** Surface GEO recommendations in the Agents tab via a new GEO Agent card. Add an LLMs.txt Generator agent (Agent 10) that produces a deployment-ready `llms.txt` file for the user's company website — improving AI discoverability (GEO score).

### What is LLMs.txt?
A Markdown file placed at `yourdomain.com/llms.txt` (spec: llmstxt.org, created Sep 2024 by Jeremy Howard). Gives AI assistants a structured, low-token summary of a website — improving citation likelihood and GEO scores. Adopted by Anthropic, Stripe, Vercel, Cloudflare, Supabase.

### Tasks

| Task | File | Status |
|---|---|---|
| Create LLMs.txt Generator agent in Lyzr Studio | Lyzr Studio | ⬜ |
| Add `LYZR_AGENT_LLMSTXT_GENERATOR` to `backend/.env` | `backend/.env` | ⬜ |
| Add `LLMSTXT_GENERATOR_ID` env var to `lyzr_studio_pipeline.py` | `backend/lyzr_studio_pipeline.py` | ⬜ |
| Add `"llmstxt"` platform branch to `/api/v1/draft` endpoint | `backend/routers/agents.py` | ⬜ |
| Fetch `url` alongside `result` from Supabase in `draft()` | `backend/routers/agents.py` | ⬜ |
| Add GEO Agent card to `_map_report_to_agents()` | `backend/routers/agents.py` | ⬜ |
| Add `geo` icon to `AgentCard.tsx` icon map | `frontend/components/dashboard/AgentCard.tsx` | ⬜ |
| Add `AGENT_PLATFORM['GEO Agent'] = 'llmstxt'` to DraftPanel maps | `frontend/components/dashboard/DraftPanel.tsx` | ⬜ |
| Add GEO Agent card to AgentsFeed | `frontend/components/dashboard/AgentsFeed.tsx` | ⬜ |
| Add `LYZR_AGENT_LLMSTXT_GENERATOR` to Render dashboard env vars | Render | ⬜ |

### Agent Input (sent from `/api/v1/draft` when `platform == "llmstxt"`)
```python
{
    "company_name": result.get("company_name", ""),
    "company_url": row.data.get("url", ""),        # fetched from analysis_jobs.url
    "company_description": result.get("company_description", ""),
    "summary": result.get("summary", ""),
    "competitors": result.get("competitors", []),
    "geo_recommendations": result.get("geo_signals", {}).get("geo_recommendations", []),
    "white_space_opportunities": result.get("white_space_opportunities", []),
    "recommended_channels": result.get("recommended_channels", []),
}
```

### GEO Agent Card Data (in `_map_report_to_agents()`)
```python
geo = result.get("geo_signals", {})
agents.append({
    "name": "GEO Agent",
    "icon": "geo",
    "status": f"GEO score {geo.get('geo_score', 0)} · {len(geo.get('geo_recommendations', []))} recommendations",
    "items": geo.get("geo_recommendations", [])[:3],
})
```

See `lyzr_agents.md` Agent 10 for the full LLMs.txt Generator agent spec (role, goal, instructions, structured output).

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
