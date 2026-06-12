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

## ✅ Sprint 10 — Password Gate + Shareable Deep Links (COMPLETE)

**Goal:** Protect the app with a single shared password and make every dashboard state shareable via URL.

| Task | File | Status |
|---|---|---|
| Next.js middleware — checks `auth_session` cookie on every request | `frontend/proxy.ts` | ✅ Done |
| Login page — password form, styled to match app | `frontend/app/login/page.tsx` | ✅ Done |
| Auth API route — validates password, sets httpOnly cookie (30 days) | `frontend/app/api/auth/login/route.ts` | ✅ Done |
| URL params written after analysis completes (`?job=&tab=&site=`) | `frontend/app/page.tsx` | ✅ Done |
| Deep-link loader — auto-fetches job from Supabase on page mount | `frontend/app/page.tsx` | ✅ Done |
| Tab changes sync `?tab=` in URL via `replaceState` | `frontend/components/dashboard/DashboardLayout.tsx` | ✅ Done |
| `initialTab` prop threads URL tab param into DashboardLayout | `frontend/components/dashboard/DashboardLayout.tsx` | ✅ Done |
| Add `SHARED_PASSWORD` + `SESSION_TOKEN` to `frontend/.env.local` | `frontend/.env.local` | ✅ Done |
| Add `SHARED_PASSWORD` + `SESSION_TOKEN` to Vercel dashboard | Vercel | ⬜ Pending |

**Shareable URL format:** `/?job=<uuid>&tab=<company|analytics|agents|reports>&site=<domain>`

**How it works end-to-end:** User shares URL → recipient hits `/login?redirect=<url>` → enters password → cookie set → redirected to exact tab with analysis auto-loaded from Supabase.

---

## ✅ Sprint 9 — GEO Agent Card + LLMs.txt Generator (COMPLETE)

**Goal:** Surface GEO recommendations in the Agents tab via a new GEO Agent card. Add an LLMs.txt Generator agent (Agent 10) that produces a deployment-ready `llms.txt` file for the user's company website — improving AI discoverability (GEO score).

### What is LLMs.txt?
A Markdown file placed at `yourdomain.com/llms.txt` (spec: llmstxt.org, created Sep 2024 by Jeremy Howard). Gives AI assistants a structured, low-token summary of a website — improving citation likelihood and GEO scores. Adopted by Anthropic, Stripe, Vercel, Cloudflare, Supabase.

### Tasks

| Task | File | Status |
|---|---|---|
| Create LLMs.txt Generator agent in Lyzr Studio | Lyzr Studio | ✅ Done |
| Add `LYZR_AGENT_LLMSTXT_GENERATOR` to `backend/.env` | `backend/.env` | ✅ Done |
| Add `LLMSTXT_GENERATOR_ID` env var to `lyzr_studio_pipeline.py` | `backend/lyzr_studio_pipeline.py` | ✅ Done |
| Add `"llmstxt"` platform branch to `/api/v1/draft` endpoint | `backend/routers/agents.py` | ✅ Done |
| Fetch `url` alongside `result` from Supabase in `draft()` | `backend/routers/agents.py` | ✅ Done |
| Add GEO Agent card to `_map_report_to_agents()` | `backend/routers/agents.py` | ✅ Done |
| Add `geo` icon to `AgentCard.tsx` icon map | `frontend/components/dashboard/AgentCard.tsx` | ✅ Done |
| Add `AGENT_PLATFORM['GEO Agent'] = 'llmstxt'` to DraftPanel maps | `frontend/components/dashboard/DraftPanel.tsx` | ✅ Done |
| Add GEO Agent card to AgentsFeed | `frontend/components/dashboard/AgentsFeed.tsx` | ✅ Done |
| Add `LYZR_AGENT_LLMSTXT_GENERATOR` to Render dashboard env vars | Render | ⬜ Pending (with production deploy) |

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

## ✅ Sprint 11 — UGC Video Generation Pipeline (COMPLETE)

**Goal:** Replace the UGC Videos Agent script stub with a full AI-driven short-form video production pipeline powered by Higgsfield CLI.

**Auth architecture decision (Sprint 11b):** Higgsfield uses rotating OAuth tokens in `~/.config/higgsfield/credentials.json`. These tokens expire and auto-refresh via the CLI — a static API key would break in days. `backend/routers/video.py` therefore invokes the Higgsfield CLI as a `subprocess.run()` call instead of making HTTP API calls. No `HIGGSFIELD_API_KEY` env var is needed or used.

| Task | File | Status |
|---|---|---|
| Add `industry`, `business_model`, `persona` to `_assemble_result()` | `backend/lyzr_studio_pipeline.py` | ✅ Done |
| Add `ugcvideo_script` platform branch to `/api/v1/draft` | `backend/routers/agents.py` | ✅ Done |
| Create `backend/routers/video.py` — CLI subprocess mode, Phase B endpoints | `backend/routers/video.py` | ✅ Done |
| Wire video router in `main.py` | `backend/main.py` | ✅ Done |
| Switch to CLI subprocess auth (remove API key dependency) | `backend/.env`, `backend/routers/video.py` | ✅ Done |
| Create `frontend/components/dashboard/VideoPanel.tsx` | `frontend/components/dashboard/VideoPanel.tsx` | ✅ Done |
| Add `videoAction` prop to `AgentCard.tsx` + `VideoPanel` integration | `frontend/components/dashboard/AgentCard.tsx` | ✅ Done |
| Update UGC Videos card to use `videoAction` | `frontend/components/dashboard/AgentsFeed.tsx` | ✅ Done |
| Create `video_strategist_agent.md` agent spec | `video_strategist_agent.md` | ✅ Done |
| Create `video_jobs` table in Supabase | Supabase SQL editor | ✅ Done |
| Create Video Strategist agent in Lyzr Studio | Lyzr Studio | ✅ Done |
| Fill `LYZR_AGENT_VIDEO_STRATEGIST` in `.env` | `backend/.env` | ✅ Done |
| Verify avatar model — `soul_v2` does NOT exist; correct model is `marketing_studio_video` | `backend/routers/video.py` | ✅ Done |
| Fix `_generate_avatar_video()` → `marketing_studio_video`, underscore flags, `--avatars` JSON format | `backend/routers/video.py` | ✅ Done |
| Set `HIGGSFIELD_AVATAR_ID` preset (Liam: `734451fd-...`) | `backend/.env` | ⚠️ Superseded (11b) — `--avatars` gated off as precaution (unproven cause; see 11b table) |
| Wire `higgsfield webproducts fetch` for real product screenshots (avatar + b-roll) | `backend/routers/video.py` | ⚠️ Superseded (11b) — `--web_product_ids` gated off as precaution (unproven; see 11b table) |
| Resume-on-reopen: `checkExistingJob()` + `GET /api/v1/video/by-analysis/{id}` | `VideoPanel.tsx`, `video.py` | ✅ Done |
| Cap avatar duration at 15s; block backdrop close during generation | `video.py`, `VideoPanel.tsx` | ⚠️ Reworked (11b) — old cap used word-count and inflated to 17-20s; now sends designed 15s |
| Local end-to-end test: Phase A draft → Phase B generate → video renders | local | ✅ Done (11b) — 15s talking-head renders end-to-end |
| Solve Render deployment: render the CLI somewhere persistent | queue + remote worker | ✅ Done (11c) — Render enqueues, Oracle VM worker renders. Do NOT try to run the CLI on Render. |
| Add `LYZR_AGENT_VIDEO_STRATEGIST` + all `LYZR_AGENT_*` + `USE_LYZR_STUDIO=true` + `VIDEO_MAX_DURATION=15` + `USE_VIDEO_WORKER=true` + `CORS_ORIGINS` to Render | Render dashboard | ✅ Done (set; see CLAUDE.md §13 for the full list) |

### Sprint 11b — Reliability fixes (all ✅ Done, `backend/routers/video.py`)

The original pipeline failed on nearly every real run. Causes found & fixed (full reference:
`video_strategist_agent.md` → "Hard Constraints & Why Generation Breaks"):

| Fix | Detail |
|---|---|
| **Duration source** (the PROVEN cause) | Backend computed duration from word count @130 WPM → inflated the agent's 15s scripts to 17–20s; `marketing_studio_video` fails at ≥17s. Now `_planned_duration()` uses `target_duration_seconds` (=15), clamped by `VIDEO_MAX_DURATION` (default 15). Proven: same script fails at 17s, renders at 15s & 8s. |
| **`--avatars` / `--setting_id` / `--web_product_ids` gated off** | ⚠️ PRECAUTION, **NOT proven causes.** Every failing job with these also had duration ≥17 (a bare 17s call failed too), so duration alone explains all observed failures; none was isolated at 15s. Gated via `HIGGSFIELD_USE_AVATARS`/`_SETTING`/`_WEB_PRODUCTS` (default off). May work at 15s — re-test before trusting they're broken. See `video_strategist_agent.md` §3. |
| **Composition off** | FFmpeg split-screen + Supabase upload disabled (`VIDEO_COMPOSE`, default off) — 50 MB bucket limit. Output = Higgsfield CDN talking-head URL. |
| **Retry + logging** | `HIGGSFIELD_MAX_ATTEMPTS` (default 2, transient safety net); `error_text` records exact CLI cmd + flags summary; standalone `backend/scripts/higgsfield_probe.py`. |

### Sprint 11c — Production worker (✅ Done)

Higgsfield's CLI is OAuth-based (no static API key) and can't live on Render's ephemeral box, so
rendering is decoupled from the web server:
- **Render web** with `USE_VIDEO_WORKER=true` → `/api/v1/video/generate` only inserts a `pending`
  `video_jobs` row (no inline render). `_create_video_job` stores the full request in a new
  `request_payload` jsonb column (`ALTER TABLE video_jobs ADD COLUMN request_payload jsonb;`).
- **Worker** `backend/scripts/video_worker.py` runs 24/7 on a free **Oracle Always-Free VM** (systemd
  `dondrapor-videoworker`), polls `video_jobs`, claims, and renders via `run_video_pipeline`. Setup:
  `backend/scripts/WORKER_SETUP.md`. Full architecture + gotchas: `CLAUDE.md` Sprint 11c.
- **Gotchas:** `video_jobs.status` has a CHECK constraint (only pipeline statuses) — claim with
  `generating_avatar`, not an invented value. Never run two renderers at once (race). The VM holds
  the Supabase service-role key → key-only SSH.

**Two-phase UX:**
- **Phase A** — `POST /api/v1/draft` with `platform: "ugcvideo_script"` → Video Strategist agent → 15s script + shot plan shown in VideoPanel (~5-10s)
- **Phase B** — `POST /api/v1/video/generate` → enqueues a `video_jobs` row → the VM worker renders `marketing_studio_video` at `--duration 15` → async polling → video player (~5 min). (Product b-roll/composition is gated off — see 11b.)

**Company type routing:** `saas`, `ecommerce_physical`, `consumer_product`, `b2b_service`, `marketplace` → image-to-video (Serper-scraped screenshots) or text-to-video (b2b_service)

**V1 scope:** No FFmpeg composition — avatar and b-roll as separate URLs. Virality scoring deferred. Both deferred to Sprint 13 (video composition + virality).

**Render deployment note:** The `higgsfield` CLI must be installed and authenticated on Render. Two paths:
- **(A) Build-step auth:** Add CLI install + `higgsfield auth login --token <refresh_token>` to `render-build.sh`. Store the refresh token as a Render secret env var.
- **(B) Local worker (recommended):** Run a local Python worker that polls `video_jobs` for `status = pending` rows and runs the CLI locally. No Render auth complexity. ✅ Done in Sprint 11c (Oracle VM worker).

---

## ✅ Sprint 12 — YouTube Shorts Upload (COMPLETE)

**Goal:** From the VideoPanel, let a user upload any completed UGC video to YouTube as a Short with **one click** — and after it lands, a "Watch on YouTube" button appears. Same video re-uploadable only once every 7 days. 100% free.

**Architecture:** Single-channel server-credential model. The app holds ONE long-lived OAuth refresh token for ONE dedicated YouTube channel and uploads on behalf of all users via the official YouTube Data API v3 `videos.insert` — so the click needs no per-user Google login. Runs in the **Render web process** (not the Oracle VM — it's a plain HTTPS call, the clip is a few MB).

| Task | File | Status |
|---|---|---|
| New router: `/upload`, `/status/{id}`, `/by-video/{id}` endpoints | `backend/routers/youtube.py` | ✅ Done |
| One-time refresh-token minter | `backend/scripts/get_youtube_token.py` | ✅ Done |
| Wire router in `main.py` (`include_router` only) | `backend/main.py` | ✅ Done |
| Google client libs | `backend/requirements.txt` | ✅ Done |
| Upload / Watch buttons + 7-day cooldown UI + resume-on-reopen | `frontend/components/dashboard/VideoPanel.tsx` | ✅ Done |
| `youtube_uploads` tracking table | Supabase SQL editor | ✅ Done |
| Dedicated Google account + channel, Cloud project, YouTube Data API v3 enabled, OAuth consent (Production), OAuth client | Google Cloud Console | ✅ Done |
| `YOUTUBE_CLIENT_ID` / `YOUTUBE_CLIENT_SECRET` / `YOUTUBE_REFRESH_TOKEN` / `YOUTUBE_PRIVACY=private` / `YOUTUBE_REUPLOAD_DAYS=7` | `backend/.env` + Render | ✅ Done |
| Local end-to-end test — upload → appears in YouTube Studio as a Short | local | ✅ Done — verified |

**Visibility (private → public):** Un-audited Google projects FORCE uploads to **Private** (the upload is real and shows in YouTube Studio → Content → Shorts, but not on the public channel / youtube.com browse). This is expected. Two ways to make a Short public:
- **Manual:** toggle Private → Public per-video in YouTube Studio (owner can do this anytime).
- **Automatic (the goal):** submit the free **YouTube API Services Audit**, then set `YOUTUBE_PRIVACY=public` + redeploy — uploads then go straight to public, no manual step. ⬜ Audit pending (does not block the feature). NOTE: don't set `YOUTUBE_PRIVACY=public` before audit — the API overrides it back to private.

**Key gotchas (also in `CLAUDE.md` §10 Sprint 12):**
- OAuth consent screen **must be "In production"**, else the refresh token expires after 7 days and breaks weekly uploads.
- 15s/9:16 clips auto-qualify as Shorts → watch URL `https://www.youtube.com/shorts/{id}`.
- `GET /by-video/{id}` returning **404** for a never-uploaded video is normal (UI reads it as "not uploaded yet").

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
