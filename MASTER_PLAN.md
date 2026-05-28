# Current Sprint Plan: Live Competitor Discovery via Serper.dev

## 1. Context & Objective
The pipeline successfully isolates the target URL using runtime entity boundaries, but it suffers from Context Starvation. It relies on the LLM's internal weights to guess competitors. To make detection reliable, we must ground the pipeline in live search results.

## 2. Current Status
- **Frontend:** Complete and polling successfully. (LOCKED)
- **Database:** Supabase (`analysis_jobs`) is operational. Caching logic is verified. (LOCKED)
- **AI Pipeline:** Modularized task generation inside `run_analysis(url)` is live. (UNLOCKED)

## 3. Immediate Sprint Tasks (Objective: Live Grounding)
1. **Environment Setup:** Read `SERPER_API_KEY` from the backend environment variables.
2. **Build Serper Client:** Implement a clean, async-compatible search helper function that queries Google via Serper for `"{target_company} top competitors alternatives market research"`.
3. **Data Ingestion Loop:** Extract the top 5 organic search result titles, snippets, and URLs from the Serper response.
4. **Context Injection:** Inject this raw text block directly into the `Researcher Agent`'s task input, transforming its role from a static page reader into a live data synthesis engine.