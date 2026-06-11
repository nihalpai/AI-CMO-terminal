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
            ↓ proxy.ts (password gate — checks auth_session cookie)
            ↓ NEXT_PUBLIC_API_BASE_URL
          Render (don-drapor.onrender.com)
            ↓ env vars in Render dashboard
          FastAPI + slowapi rate limiting
            ↓
          Supabase (analysis_jobs, watchlist)
          Gemini / Firecrawl / Serper
```

**Local dev:** Frontend on port 3000, backend on port 8000. `NEXT_PUBLIC_API_BASE_URL` defaults to `http://localhost:8000` if not set.

## 4a. Password Gate & Deep Links

**Password gate** — a single shared password protects the entire frontend. No per-user accounts.
- `frontend/proxy.ts` — intercepts every request, checks `auth_session` cookie against `SESSION_TOKEN` env var
- `frontend/app/login/page.tsx` — password entry form, styled to match the app
- `frontend/app/api/auth/login/route.ts` — server-side handler: checks `SHARED_PASSWORD`, sets `auth_session` cookie (httpOnly, 30-day expiry)
- Cookie value = `SESSION_TOKEN` (a random hex string). Changing it instantly invalidates all sessions.
- Env vars (Vercel only, not Render): `SHARED_PASSWORD`, `SESSION_TOKEN`

**Shareable deep links** — after analysis completes, the browser URL encodes the full dashboard state:
```
/?job=<uuid>&tab=<company|analytics|agents|reports>&site=<domain>
```
- Visiting a shared link auto-loads the analysis from Supabase and opens the correct tab
- If unauthenticated, middleware redirects to `/login?redirect=<original-url>` and returns there after login
- Tab switches update `?tab=` in-place (no new history entry) via `window.history.replaceState`
- `handleReset` clears URL back to bare `/`

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
- **Sprint 10:** Password gate + shareable deep links — `proxy.ts` shared-password gate, `/login` page, `/api/auth/login` route handler, URL params (`?job=&tab=&site=`) written after analysis and synced on tab switch, deep-link auto-load on page mount. Frontend env vars: `SHARED_PASSWORD`, `SESSION_TOKEN` (Vercel only).
- **Sprint 11:** UGC Video Generation Pipeline — Video Strategist agent (Agent 11, `LYZR_AGENT_VIDEO_STRATEGIST` set), `backend/routers/video.py` using Higgsfield CLI subprocess (OAuth auth via `~/.config/higgsfield/credentials.json`). Avatar model: `marketing_studio_video`. `VideoPanel.tsx` (Phase A script → Phase B async generation with resume-on-reopen). `video_jobs` Supabase table created with RLS enabled. (NOTE: the original preset-avatar / `--web_product_ids` / b-roll-composition design is superseded — see Sprint 11b.)
- **Sprint 11b:** Video generation **reliability fixes** (the original pipeline failed on nearly every real run). Root causes found & fixed, all in `backend/routers/video.py`:
  1. **Duration** — the killer. `marketing_studio_video` fails server-side (~5 min, `status: failed`, no error) on ≥17s; reliable ceiling ~15–16s. The backend was deriving duration from word count at 130 WPM (inflating 15s-designed scripts to 17–20s) and **ignoring** the agent's authoritative `target_duration_seconds=15`. Fixed: `_planned_duration()` uses the designed 15s, clamped by `VIDEO_MAX_DURATION` (default 15). **Proven:** the same script that failed 3× at 17s renders at 15s.
  2. **Preset `--avatars`**, **`--setting_id`**, **`--web_product_ids`** are gated off (`HIGGSFIELD_USE_AVATARS` / `HIGGSFIELD_USE_SETTING` / `HIGGSFIELD_USE_WEB_PRODUCTS`) as a **PRECAUTION, not a proven cause** — ⚠️ honesty note: every failing job that had them also had duration ≥17, and a bare call at 17 failed too, so **duration alone explains every failure we observed**; none of these three was ever isolated at a safe 15s. They may actually work now — re-test at 15s before assuming they're broken. The bare call at 15s is the only config *proven* to render. Treat duration as the primary suspect, not these. (Full evidence note: `video_strategist_agent.md` §3.)
  3. **Composition + Supabase upload** gated off (`VIDEO_COMPOSE`, default off) — Supabase bucket's 50 MB/file limit. Output is now the Higgsfield-CDN talking-head URL directly (free). So b-roll/product overlay is NOT in the current output.
  4. **Retry** safety net for transient failures (`HIGGSFIELD_MAX_ATTEMPTS`, default 2); failed video jobs refund credits.
  5. **Diagnostic logging** — `error_text` records the exact CLI command + a `[duration=… avatars=… setting_id=… web_product_ids=…]` summary. Plus a standalone probe: `backend/scripts/higgsfield_probe.py` (`--cost-only` is free; mirrors the pipeline's CLI call). Full failure-mode reference lives in `video_strategist_agent.md` → "Hard Constraints & Why Generation Breaks".
- **Sprint 11c:** Video **production architecture — queue + remote worker** (the only way video works in prod). The Higgsfield CLI is OAuth-based (no static API key; it wraps `fnf.higgsfield.ai` with device-login `access_token`+`refresh_token` in `~/.config/higgsfield/credentials.json`) and can't run on Render's ephemeral filesystem. So rendering is **decoupled from the web server**:
  - **Render web** only ENQUEUES: with `USE_VIDEO_WORKER=true`, `POST /api/v1/video/generate` just inserts a `pending` `video_jobs` row (it does NOT render). Locally, `USE_VIDEO_WORKER` unset = renders inline (dev convenience).
  - **The queue is the `video_jobs` Supabase table.** `_create_video_job` stores the FULL request in a new **`request_payload` jsonb** column so the worker can rebuild the `VideoGenerateRequest`. (Run once: `ALTER TABLE video_jobs ADD COLUMN request_payload jsonb;`.)
  - **The worker** `backend/scripts/video_worker.py` runs 24/7 on a **free Oracle Cloud Always-Free VM** (systemd service `dondrapor-videoworker`), where the Higgsfield CLI is authenticated. It polls `video_jobs` for `pending`, atomically claims, renders via the existing `run_video_pipeline`, writes the result back. Render, the VM, and the frontend never talk directly — they only share the Supabase table (the VM uses the same `backend/.env` Supabase service-role key, rsync'd to it). Full host setup: `backend/scripts/WORKER_SETUP.md`.
  - **GOTCHA — status CHECK constraint:** `video_jobs.status` only allows the pipeline's own statuses (`pending`/`generating_avatar`/`composing`/`completed`/`error`). The worker claims a job by setting `generating_avatar` — using an invented value like `"processing"` raises Postgres check-constraint 23514 and the worker can never claim. Don't introduce new status values without `ALTER`ing the constraint.
  - **NEVER run two renderers at once** (Mac inline + the VM, or two workers) → they race/double-render the same job. Now that the VM is the renderer, run ALL backends (local + Render) with `USE_VIDEO_WORKER=true`.
  - Worker env (optional): `VIDEO_WORKER_POLL_SECONDS` (10), `VIDEO_WORKER_STALE_MINUTES` (30 — reclaims jobs stuck in `generating_avatar`/`composing` back to `pending`, e.g. after a worker crash). The web-product scrape in `run_video_pipeline` is skipped unless `VIDEO_COMPOSE`/`HIGGSFIELD_USE_WEB_PRODUCTS` is on (it was a confusing ~1-2 min silent warm-up with no credit movement).
  - **Maintenance:** if video fails in prod, SSH the VM and re-`higgsfield auth login` (the only recurring upkeep); after code/.env changes, re-rsync `backend/` to the VM and `sudo systemctl restart dondrapor-videoworker`; logs: `journalctl -u dondrapor-videoworker -f`. The VM holds your Supabase service-role key + API keys → key-only SSH, no open ports.

## 11. Outstanding Security Items (Do Before Going Public)

**Already done (Sprint 10):**
- ✅ **Password gate** — `proxy.ts` + shared password protects the entire frontend. Sufficient for private invites.

**Still deferred — do not implement until explicitly requested:**
- **Rate limiting on `/api/v1/chat` and `/api/v1/watchlist/run`** — currently unprotected, anyone who knows the backend URL can spam Gemini calls. Extract shared limiter to `backend/limiter.py` to avoid circular imports.
- **Supabase Auth (`@supabase/ssr`)** — if per-user accounts are ever needed: magic link email allowlist login. Do NOT use NextAuth/Auth.js — it would create two auth systems competing with the existing `proxy.ts` session cookie. If Supabase Auth is added, remove the current password gate and replace `proxy.ts` entirely.
- **Supabase RLS** — enable row level security on `analysis_jobs` and `watchlist` tables.
- **Playwright smoke tests** — 3 golden-path tests: (1) home page loads, (2) submit URL → result renders, (3) dashboard elements visible. Run `npm init playwright@latest` in the frontend folder. Run tests against staging before every deploy.

## 12. Security Philosophy (Prompt Injection)
Do NOT use `guardrails-ai` for prompt injection — the `detect_prompt_injection` validator depends on Pinecone + a separate OpenAI API call per request, with no published accuracy numbers. Use structural isolation instead: user-supplied input must only ever appear in the `user` turn of the LLM prompt, never interpolated into the `system` prompt. This is the correct defense and requires no additional libraries.

## 13. Next Steps
**Sprints 1–8, 9, 10, 11, 11b, 11c (code) are complete.** Video generation works end-to-end both locally (inline) and in production (via the Oracle VM worker — Sprint 11c). Supabase `video_jobs` table created + `request_payload` column added.

**Production deployment env vars (the authoritative list):**
- **Render (backend)** — all of: `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `SERPER_API_KEY`, `FIRECRAWL_API_KEY`, `APIFY_API_TOKEN`, `LYZR_API_BASE_URL`, `LYZR_API_KEY`, `LYZR_USER_ID`, all 11 `LYZR_AGENT_*`, `USE_LYZR_STUDIO=true`, `USE_MOCK_APIFY=true`, **`CORS_ORIGINS=https://don-drapor.vercel.app`** (not in local .env — required or the browser is CORS-blocked), **`VIDEO_MAX_DURATION=15`**, **`USE_VIDEO_WORKER=true`** (enqueue-only; the VM renders). DO NOT set `HIGGSFIELD_AVATAR_ID` active / `HIGGSFIELD_USE_*` / `VIDEO_COMPOSE` — intentionally off (Sprint 11b).
- **Vercel (frontend)** — **`NEXT_PUBLIC_API_BASE_URL=https://don-drapor.onrender.com`** (not in local .env.local — required), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SHARED_PASSWORD`, `SESSION_TOKEN` (the last two are read by `proxy.ts`; the backend does NOT need them).
- **The Oracle VM worker** needs the same `backend/.env` (Supabase service-role + LYZR/SERPER) + an authenticated `higgsfield` CLI. It does NOT need `USE_VIDEO_WORKER` (only the web `/generate` endpoint reads that).

**To confirm prod video:** push → Render redeploys onto the new commit → generate on the live site → watch the VM render it (`journalctl -u dondrapor-videoworker -f` shows `rendering job … --duration 15 … finished`). The VM worker (systemd) was already verified live + polling.

**Sprint 12 backlog** — (a) shorter agent scripts so 15s isn't rushed; (b) re-enable product b-roll only by composing short clips (≤15s each) — needs a video-hosting target since composed files exceed the 50 MB Supabase bucket; (c) wire brain-activity virality scoring. Note: true 18–20s single-take is blocked by Higgsfield's ~16s render cliff (`multi_shots` is not CLI-controllable).

**Security hardening is on the backburner** — do not implement rate limiting on `/api/v1/chat`, Supabase Auth, or RLS until explicitly requested.

## 14. Workflow
- **ALWAYS use Plan Mode first** for any feature touching the pipeline or layout.
- **Context Compression:** Use `repomix` if context drift occurs.
- **Testing:** Always test with `USE_MOCK_APIFY=true` first; use `false` only for targeted live validation.
- **Next.js version:** This project runs Next.js 16.2.6 — APIs and conventions may differ from training data. Check `node_modules/next/dist/docs/` before writing any Next.js-specific code.
- **Security review:** Before each major feature release, review against the [OWASP LLM Top 10](https://github.com/owasp/www-project-top-10-for-large-language-model-applications) (LLM01–LLM05 are most relevant).
