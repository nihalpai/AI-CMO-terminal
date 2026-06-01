# Don Drapor — AI CMO Terminal: Master Plan

## Product Vision
A terminal-style AI CMO SaaS that takes any company URL and returns a full competitive intelligence report with actionable GTM strategy, surfaced through a 4-tab dashboard with 7 specialized AI agent cards.

---

## ✅ Sprint 1 — Core Pipeline (COMPLETE)

**Goal:** End-to-end analysis pipeline from URL → structured JSON report.

| File | What was built |
|------|---------------|
| `backend/ai_pipeline.py` | 3-agent linear pipeline: Researcher → Strategist → Execution (Lyzr Automata + Gemini 2.5 Flash Lite) |
| `backend/main.py` | FastAPI with `/api/v1/analyze` (202 async), `/api/v1/analyze/{job_id}` polling, Supabase 7-day cache, slowapi rate limiting |
| `backend/linkedin_scraper.py` | Feature-flagged hiring signals (`USE_MOCK_APIFY`) |
| `backend/routers/agents.py` | Agent card content endpoints |
| `backend/routers/company.py` | Company info endpoints |

---

## ✅ Sprint 2 — Dashboard Layout + Features (COMPLETE)

**Goal:** Replace 4-panel always-visible layout with tabbed main + persistent AI CMO Chat sidebar. Add theme, drafting, and watchlist.

| File | What was built |
|------|---------------|
| `frontend/components/dashboard/DashboardLayout.tsx` | Tabbed layout: Company / Analytics / Agents / Reports + fixed 340px chat sidebar |
| `frontend/components/dashboard/TabNav.tsx` | Tab navigation bar |
| `frontend/components/dashboard/ReportsTab.tsx` | Full-width GTM report reading view |
| `frontend/components/dashboard/DraftPanel.tsx` | Slide-in content draft panel (calls `/api/v1/chat`) |
| `frontend/components/dashboard/TerminalHeader.tsx` | Theme toggle (sun/moon icons) |
| `frontend/lib/theme.tsx` | ThemeContext with localStorage persistence; toggles `html.light` class |
| `frontend/app/globals.css` | `html.light .{class}` CSS specificity overrides for all Tailwind slate classes |
| `backend/routers/watchlist.py` | CRUD: POST/GET/DELETE `/api/v1/watchlist` + POST `/api/v1/watchlist/run` |
| `backend/services/weekly_digest.py` | Resend-powered weekly email digest for watchlist |

---

## ✅ Sprint 3 — Mock Fix + Apify Removal (COMPLETE)

**Goal:** Remove Apify dependency entirely; fix mock data to use actual competitor names.

- `backend/linkedin_scraper.py`: Replaced `_live_scrape()` Apify calls with Serper-based search. `_load_mock()` now generates data keyed to actual competitor names (not hardcoded Salesloft/Outreach/Apollo).

---

## ✅ Sprint 4 — Dashboard Content Fixes (COMPLETE)

**Goal:** Fix all 4 tabs — wrong text, broken documents, fake analytics, invisible button.

| Fix | File | Detail |
|-----|------|--------|
| `company_description` field | `backend/ai_pipeline.py` | Execution Agent outputs factual company overview separately from GTM `summary` |
| `geo_signals` field | `backend/ai_pipeline.py` | GEO score, AI visibility, schema gaps, recommendations |
| Publisher domain blocklist | `backend/ai_pipeline.py` | `_PUBLISHER_DOMAINS` filters Reddit/Forbes/YouTube from competitor extraction |
| Competitor deduplication | `backend/ai_pipeline.py` | `list(dict.fromkeys(...))` after JSON parse |
| About section fix | `frontend/.../CompanyPanel.tsx` | Uses `company_description` not GTM `summary` |
| Functional navCards | `frontend/.../CompanyPanel.tsx` | Documents → nav cards that switch tabs |
| Remove fake GA/Search Console | `frontend/.../AnalyticsCenter.tsx` | Replaced with AI-Estimated Traffic Mix section |
| GEO tab implementation | `frontend/.../AnalyticsCenter.tsx` | Score gauge, schema gap pills, recommendations |
| Draft button always visible | `frontend/.../AgentCard.tsx` | Removed `opacity-0 group-hover:opacity-100` |
| Reports tab fixes | `frontend/.../ReportsTab.tsx` | `company_description` above summary, deduped competitors |
| Turbopack fix | `frontend/next.config.ts` | `turbopack.root` set to prevent `~/package-lock.json` issue |

---

## ✅ Sprint 5 — URL Fix + LinkedIn → ATS Job Boards (COMPLETE)

**Goal:** Fix "Bad Request: URL must have valid top-level domain" crash; replace LinkedIn scraping (permanently blocked by Firecrawl).

| Fix | File | Detail |
|-----|------|--------|
| URL normalization | `backend/main.py` | `_normalize_url()` prepends `https://` for bare domains |
| Null safety | `backend/ai_pipeline.py` | `scrape_website()` returns `result.markdown or ""` |
| ATS job boards strategy | `backend/linkedin_scraper.py` | Full rewrite: Serper finds Greenhouse/Lever/Ashby URLs → Firecrawl scrapes → Serper news for growth signals |

**Why ATS instead of LinkedIn:** LinkedIn permanently blocks all scraping tools. Public ATS systems (Greenhouse, Lever, Ashby) are openly accessible and return full job descriptions.

---

## 🚧 Sprint 6 — Agent Output Quality (NEXT)

**Goal:** Fine-tune all three pipeline agents so their outputs are specific, named, actionable, and publication-ready. The infrastructure is solid — this sprint is entirely about prompt engineering and output quality.

### 6a — Researcher Agent
Current issue: Extracts generic summaries. Target: specific pricing tiers (exact numbers), verbatim positioning language from the scraped page, named feature gaps.

Changes:
- Update `_researcher` persona to require structured extraction tables for pricing
- Add explicit instruction to quote competitor positioning verbatim
- Require at least 3 specific SEO keywords found on the page (not inferred)

### 6b — Strategist Agent
Current issue: Hiring insights sometimes generic ("competitors are scaling engineering"). Target: always named + attributed with explicit strategic implication.

Changes:
- Strengthen `HIRING SIGNAL RULE` in `_strategist` persona — add penalty clause for generic output
- Add example of BAD output vs GOOD output in persona string
- Require `recommended_channels` to include specific tactics, not just channel names

### 6c — Execution Agent
Current issue: `content_recommendations` are topic headings ("Write a comparison article"). Target: specific, angled content hooks ready to hand to a writer.

Changes:
- Update `_execution` persona: each `content_recommendations` item must follow format: `"[Format]: [Specific angle] — [Why it wins against [Competitor]]"`
- Example: `"Long-form article: 'Supabase vs Firebase: Real pricing at 10M rows' — targets Firebase's opaque pricing, captures bottom-of-funnel switchers"`
- `hiring_signals` already has strict format; add same discipline to `content_recommendations`

### 6d — DraftPanel Quality
Current issue: `/api/v1/chat` prompt produces template-style output. Target: full publish-ready post.

Changes:
- Update `backend/routers/agents.py` (or wherever the chat prompt is built) to include: platform context, tone, length target, call-to-action requirement
- DraftPanel UI: add platform selector (Twitter/X, LinkedIn, Reddit, Blog) that adjusts the prompt

### 6e — ATS Scraping Enrichment (optional)
If ATS pages return sparse data (job title only), fall back to scraping the company's main `/careers` or `/jobs` page via Firecrawl as a secondary source.

---

## Future Sprints (Backlog)

| Sprint | Goal |
|--------|------|
| Sprint 7 | Real-time competitor monitoring — daily Serper diff on watchlist items, push alert if new hiring signal detected |
| Sprint 8 | Multi-URL analysis — analyze 2-3 competitor URLs simultaneously, side-by-side comparison view |
| Sprint 9 | GA4 OAuth integration — replace AI-estimated traffic mix with real GA4 data |
| Sprint 10 | Export — PDF report generation, Notion export, Slack digest |

---

## Key Invariants (Never Change)
- `USE_MOCK_APIFY=true` in `.env` during all development
- Do not modify `main.py` routing logic (add `include_router` only)
- Keep emerald/slate design system
- Lyzr Automata `LinearSyncPipeline` is the orchestration layer — do not replace with raw LLM calls
