# Master Implementation Plan: AI GTM Strategy Backend Caching

## 1. Role & Context
Act as a Senior Python Backend Engineer. We are optimizing our headless SaaS application (an "AI CMO" for technical startup founders). 

## 2. Current Implementation State
- **Frontend:** Next.js UI is complete and polling successfully. (LOCKED)
- **AI Pipeline:** Lyzr Automata + Firecrawl pipeline is working perfectly. (LOCKED)
- **Database:** Supabase (`analysis_jobs` table) is live. Schema: `id` (uuid), `status` (text), `url` (text), `result` (jsonb), `created_at` (timestamptz).

## 3. Phase Objective: The Caching Layer
Every time a user submits a URL, we currently pay for a Firecrawl scrape and a multi-agent Gemini 2.5 LLM execution. 

To prevent duplicate API burns and provide instant results for popular domains, we must implement a database-level caching mechanism inside the FastAPI `/analyze` route.

## 4. Execution Logic
1. A POST request hits `/api/v1/analyze` with a `url`.
2. Before processing, FastAPI queries the `analysis_jobs` table for a record matching:
   - `url` == requested url
   - `status` == 'completed'
   - `created_at` > (current_time - 7 days)
3. If a match exists, we immediately return the `job_id` of the cached record (Status 200). The frontend polling loop will pick this up instantly.
4. If no match exists, we fall back to the existing logic: generate a new `job_id`, spawn the background async pipeline, and return the new `job_id` (Status 202).