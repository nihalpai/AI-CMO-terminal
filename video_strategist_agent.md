# Agent 11: Video Strategist

All agents live at **https://studio.lyzr.ai** → Agent Builder.

---

## Overview

| Field | Value |
|-------|-------|
| **Role** | `Video Marketing Strategist` |
| **Model** | Claude Haiku |
| **Temperature** | 0.7 |
| **Tool** | None |
| **Structured Output** | On (see schema below) |
| **Env var** | `LYZR_AGENT_VIDEO_STRATEGIST` |
| **Session ID** | `job_id` — same isolation rule as Content Writer and LLMs.txt Generator |
| **Called from** | `/api/v1/draft` when `platform == "ugcvideo_script"` (triggered by UGC Videos Agent card "Script & Film →" button) |

---

## Goal

```
To design a complete, production-ready short-form video strategy for a company based on its
competitive analysis, selecting the optimal 2026 retention hook, avatar style, b-roll approach,
and shot-by-shot script that maximises viral potential within 15 seconds.
```

---

## ⚠️ CRITICAL: Hard Constraints & Why Generation Breaks

Higgsfield's `marketing_studio_video` model is the single most failure-prone part of this project.
Every constraint below was learned by debugging real `status: failed` jobs (June 2026). Violating
any of them makes a job run ~5 minutes and then fail server-side with **no error message**. Read
this before changing this agent, its schema, or `backend/routers/video.py`.

### 1. Total video duration MUST stay ≤ 15 seconds — this is the #1 cause of failure
- **Proven:** the *identical* 35-word script that failed 3× at duration **17s** completed cleanly at
  **8s** and at **15s**. Durations of **17–20s fail deterministically** (not flaky — they fail every
  time). The reliable render ceiling is **~15–16s**; only **15s** is production-confirmed.
- Therefore `target_duration_seconds` is **hard-pinned to 15** (schema `minimum: 15, maximum: 15`).
  Do not raise it. The backend trusts this value and sends `--duration 15` to Higgsfield.
- **Shots must SUM to ~15s**, not 15s each. The per-shot `maximum: 15` is just an upper bound on a
  single shot; the *total* of all `duration_seconds` must be ~15. (A 4-shot plan of 4+5+3+3 = 15 ✓.
  A plan of 5+8+6+7+5 = 31 ✗ — that describes a 31s video and will fail.)

### 2. Script MUST be ≤ 40 words (target 35) — long scripts break generation
- At 150 WPM, 35–40 words ≈ 15 seconds. This is a **hard cap, not a guideline.**
- **Why it broke before:** the backend used to estimate duration from *word count* at 130 WPM
  (`words / 2.17`) and **ignored** `target_duration_seconds`. A 35-word script computed to
  `ceil(35/2.17) = 17s` → sent `--duration 17` → **failed every time.** Wordier scripts (45–64 words)
  pushed it to 20s. This is now fixed in `backend/routers/video.py` (`_planned_duration` uses the
  designed 15s), but a bloated script still risks rushed/garbled audio. **Count your words. Stay ≤40.**
- The old example in this file was a 64-word script — that alone would have failed. Keep examples ≤40.

### 3. Backend flags that BROKE generation (now gated OFF by default in `video.py`)
These are enforced in `backend/routers/video.py`, not by this agent, but documented here because they
were all separate causes of the same opaque `status: failed`:

| Flag / behavior | Why it failed | Env gate (default off) |
|---|---|---|
| `--avatars` (preset avatar id) | Preset avatars fail server-side (tested Liam + Jayden). Higgsfield auto-selects a creator if omitted. | `HIGGSFIELD_USE_AVATARS` |
| `--setting_id` (e.g. Office) | Switches the server-side enhancer to a face-locked multi-shot template that fails. | `HIGGSFIELD_USE_SETTING` |
| `--web_product_ids` (scraped screenshot) | The product screenshot gets used as a *character/face* reference ("match face exactly") → fails. | `HIGGSFIELD_USE_WEB_PRODUCTS` |

With all three off, the call is bare (`--prompt --duration --aspect_ratio 9:16 --mode ugc
--generate_audio true`), which is the only configuration proven to render reliably.

### 4. Other hard facts
- **No multi-shot stitching via CLI.** `multi_shots`/`multi_prompt` are server-side only and not CLI
  controllable, so a true 18–20s single-take is **not achievable** — 15s is the practical maximum.
- **Composition is OFF** (`VIDEO_COMPOSE` default off). The pipeline uses Higgsfield's CDN `result_url`
  directly (free, no size cap). The FFmpeg split-screen + Supabase upload is disabled because the
  Supabase bucket has a 50 MB/file limit. So the b-roll/product-overlay does **not** currently appear
  in the final video — the output is the talking-head only.
- **Retry** is a transient safety net only: `HIGGSFIELD_MAX_ATTEMPTS` (default 2). Failed video jobs
  **refund their credits** (Higgsfield keeps only ~1.5 credits for the creator-reference image), so a
  retry is cheap — but retrying a *deterministic* failure (e.g. duration 17) just wastes ~5 min/attempt.
- **No failure reason from Higgsfield.** `status: failed` carries no error detail (confirmed via
  `generate get`). Diagnose by isolating inputs, not by reading an error message.

### 5. Diagnostic tool
`backend/scripts/higgsfield_probe.py` calls Higgsfield directly (outside FastAPI), mirroring the
pipeline's exact CLI args. Use it to isolate "pipeline bug vs Higgsfield" and to test durations:
- `python backend/scripts/higgsfield_probe.py --cost-only --duration 15` — FREE, validates params.
- `python backend/scripts/higgsfield_probe.py --duration 15` — one real render (~75 credits, ~5 min).
- `python backend/scripts/higgsfield_probe.py --sweep 8,15,16` — map the ceiling.

---

## Instructions

```
Your response must begin with { and end with }. Do not output any text, analysis, thinking,
summaries, or markdown before or after the JSON object. Output only the raw JSON object and nothing else.

You will receive a JSON object with: company_name, company_description, industry, business_model,
persona, summary, white_space_opportunities, competitors.

Step 1 — Classify the company type. Assign one of: "saas", "ecommerce_physical",
"consumer_product", "b2b_service", "marketplace".
- "saas": software sold as subscription to businesses or developers
- "ecommerce_physical": sells tangible physical goods online
- "consumer_product": consumer packaged goods, food, supplements, lifestyle
- "b2b_service": professional services, consulting, agency, B2B non-software
- "marketplace": platform connecting two distinct user groups

Step 2 — Choose the strongest 2026 retention hook type for this company and audience:
- "transformation": "I went from [bad state] to [good state] using [product]" — SaaS, products with clear before/after
- "contrarian": "Stop doing X — here's why it's costing you Y" — B2B, SaaS with entrenched wrong beliefs
- "pov": "POV: you just found the hack that [specific outcome]" — ecommerce, consumer, marketplaces
- "behind_the_scenes": "Here's what actually happens when [product process]" — physical products, B2B services

Step 3 — Write the script. Requirements:
- Hook line lands in the first 3 seconds (~10-14 spoken words)
- Names one competitor from the competitors list by name (credibility contrast)
- References the top white_space_opportunity from the input as the problem being solved
- States the company_name solution in plain language
- Closes with a single clear call-to-action
- 35-40 words total, HARD MAXIMUM 40 (~15 seconds at 150 WPM). Longer scripts break video
  generation — see "Hard Constraints & Why Generation Breaks" above. Count the words.
- Written as spoken aloud — contractions, direct address, no marketing jargon

Step 4 — Design 4-6 shots:
- Shot 1: always talking head delivering the hook
- Shots 2-4: b-roll showing the product working or problem being solved
- Final shot: call-to-action (talking head or product screen)
- Each shot: visual description, what is happening, duration in seconds
- The shot `duration_seconds` values MUST SUM to ~15 (the whole video is 15s, not 15s per shot).
  e.g. 4 + 5 + 3 + 3 = 15. A plan that sums to >16 describes a video that will fail to render.

Step 5 — Select avatar style:
- "saas": "professional_developer" — casual blazer, clean desk, home office
- "ecommerce_physical" or "consumer_product": "lifestyle_creator" — natural lighting, modern home
- "b2b_service": "executive_advisor" — business casual, neutral background
- "marketplace": "excited_discoverer" — casual, bright energetic background

Step 6 — Write the broll_prompt. Text-to-video generation prompt describing product footage.
For SaaS: describe a dashboard interaction with specific UI elements. For physical product:
describe a product beauty shot or unboxing. For marketplace: describe a transaction moment.
Be specific about what appears on screen.

Step 7 — Write the image_search_query. Serper image search query used as a fallback if
Higgsfield webproducts fetch fails. The backend first tries to scrape the company URL directly
via `higgsfield marketing-studio webproducts fetch` for real product screenshots.
SaaS: "[company_name] dashboard screenshot"
Physical product: "[company_name] product photo"
Marketplace: "[company_name] app screenshot"

Step 8 — Output the JSON object immediately.
```

---

## Structured Output Schema

```json
{
  "name": "VideoStrategistSchema",
  "strict": true,
  "schema": {
    "type": "object",
    "properties": {
      "company_type": {
        "type": "string",
        "enum": ["saas", "ecommerce_physical", "consumer_product", "b2b_service", "marketplace"]
      },
      "hook_type": {
        "type": "string",
        "enum": ["transformation", "contrarian", "pov", "behind_the_scenes"]
      },
      "hook_line": { "type": "string" },
      "script": { "type": "string" },
      "shots": {
        "type": "array",
        "minItems": 4,
        "maxItems": 6,
        "items": {
          "type": "object",
          "properties": {
            "shot_number": { "type": "integer" },
            "type": {
              "type": "string",
              "enum": ["talking_head", "broll", "screen_recording", "cta"]
            },
            "description": { "type": "string" },
            "duration_seconds": { "type": "integer", "minimum": 3, "maximum": 15 }
          },
          "required": ["shot_number", "type", "description", "duration_seconds"],
          "additionalProperties": false
        }
      },
      "avatar_style": { "type": "string" },
      "broll_prompt": { "type": "string" },
      "image_search_query": { "type": "string" },
      "target_duration_seconds": { "type": "integer", "minimum": 15, "maximum": 15 }
    },
    "required": [
      "company_type", "hook_type", "hook_line", "script", "shots",
      "avatar_style", "broll_prompt", "image_search_query", "target_duration_seconds"
    ],
    "additionalProperties": false
  }
}
```

---

## Backend Input

Assembled in `routers/agents.py` when `platform == "ugcvideo_script"`:

```python
{
    "company_name": result.get("company_name", ""),
    "company_description": result.get("company_description", ""),
    "industry": result.get("industry", ""),           # stored by _assemble_result() since Sprint 11
    "business_model": result.get("business_model", ""),
    "persona": result.get("persona", ""),
    "summary": result.get("summary", ""),
    "white_space_opportunities": result.get("white_space_opportunities", [])[:3],
    "competitors": [
        c["name"] if isinstance(c, dict) else c
        for c in result.get("competitors", [])[:3]
    ],
}
```

**Output:** Raw JSON string matching `VideoStrategistSchema`. Returned as `{"reply": "<json_string>"}` from `/api/v1/draft`. `VideoPanel.tsx` parses with `JSON.parse(data.reply)`.

**Company URL:** The backend looks up `analysis_jobs.url` using `job_id` at generation time and can fetch real product screenshots via `higgsfield marketing-studio webproducts fetch` (with `image_search_query` as a Serper fallback). **However, passing those screenshots to the avatar video via `--web_product_ids` is currently DISABLED** (gated behind `HIGGSFIELD_USE_WEB_PRODUCTS`, default off) because it made the avatar render fail — see "Hard Constraints" §3. The screenshots were only ever consumed by the FFmpeg composition, which is also off (`VIDEO_COMPOSE`, default off). So today the strategist's `broll_prompt` / `image_search_query` are produced but not used in the rendered output; the final video is the bare talking-head from Higgsfield's CDN.

---

## Example Output (Supabase company)

This exact script (35 words, shots summing to 15s) was **verified to render successfully** at
duration 15. Use it as the template for length and structure — NOT the longer style that was here
before (a 64-word / 31s-of-shots example, which would fail to generate).

```json
{
  "company_type": "saas",
  "hook_type": "contrarian",
  "hook_line": "Stop betting your startup on Firebase—here's what's really costing you.",
  "script": "Stop betting your startup on Firebase—here's what's really costing you. Vendor lock-in silently kills your margins. Supabase gives you PostgreSQL, open-source infrastructure, and forecastable costs. No surprise bills. No rebuilds. Scale your way. Start free.",
  "shots": [
    { "shot_number": 1, "type": "talking_head", "description": "Developer at desk, casual blazer, leans in — delivers the Firebase hook", "duration_seconds": 4 },
    { "shot_number": 2, "type": "screen_recording", "description": "Supabase dashboard — Postgres table editor, auth panel", "duration_seconds": 5 },
    { "shot_number": 3, "type": "broll", "description": "Cost chart: Supabase flat line vs Firebase spiking upward", "duration_seconds": 3 },
    { "shot_number": 4, "type": "cta", "description": "Developer nods to camera; clean card reads supabase.com — start free", "duration_seconds": 3 }
  ],
  "avatar_style": "professional_developer",
  "broll_prompt": "Clean modern SaaS dashboard UI with a dark theme, green accent colours, showing a database table editor with rows of data, smooth cursor interactions, split view with SQL query panel",
  "image_search_query": "Supabase dashboard screenshot UI",
  "target_duration_seconds": 15
}
```

> Word count: 35. Shot durations: 4 + 5 + 3 + 3 = **15**. Both within limits. ✓

---

## Company Type → Video Style Routing (Python)

> **Status note (June 2026):** This routing describes the *intended* b-roll design. B-roll /
> image-to-video and the FFmpeg composition are **currently disabled** (see "Hard Constraints" §4) —
> the rendered output is the talking-head only. The table is retained for when composition is
> re-enabled (would also re-open the video-hosting question, since composed files exceed the 50 MB
> Supabase bucket limit).

Handled by `COMPANY_TYPE_VIDEO_CONFIG` in `backend/routers/video.py`:

| Company Type | Image-to-Video | B-Roll Model |
|---|---|---|
| `saas` | ✅ Yes (dashboard screenshot) | `kling3_0` |
| `ecommerce_physical` | ✅ Yes (product photo) | `kling3_0` |
| `consumer_product` | ✅ Yes (product photo) | `kling3_0` |
| `b2b_service` | ❌ No (text-to-video) | `kling3_0` |
| `marketplace` | ✅ Yes (app screenshot) | `kling3_0` |

---

## Hook Formulas by Company Type (2026 Research)

| Hook Type | Formula | Best For |
|---|---|---|
| **transformation** | "I went from [bad] to [good] in [timeframe] using [product]" | SaaS, consumer products |
| **contrarian** | "Stop doing X — here's why it's costing you Y" | B2B, developer tools |
| **pov** | "POV: you just found the hack that [specific outcome]" | E-commerce, marketplaces |
| **behind_the_scenes** | "Here's what actually happens when [product process]" | Physical products, services |

**Key timing constraint:** Hook must land in first 3 seconds (~10-14 spoken words). First 3 seconds drive 80% of completion variance on Shorts/Reels.
