# Current Sprint Plan: LinkedIn Mock Framework & Signal Extraction

## 1. Context & Objective
We need to extract LinkedIn hiring and content signals for our discovered competitors. To protect a strict $5 Apify budget, we are implementing a feature-flagged caching fixture. This allows the AI pipeline to develop complex downstream synthesis using static data for free.

## 2. Current Status
- **Frontend:** Complete and polling successfully. (LOCKED)
- **Database:** Supabase caching is operational. (LOCKED)
- **Competitor Discovery:** Serper integration is live and passing competitor URLs. (LOCKED)

## 3. Immediate Sprint Tasks (Objective: Cost-Isolated Extraction)
1. **Environment Config:** Define `USE_MOCK_APIFY=true` and `APIFY_API_TOKEN` in `.env`.
2. **Create Fixture Data:** Build a rich sample file (`backend/resources/mock_linkedin_signals.json`) containing realistic job openings (titles, descriptions hinting at strategic pivots) and recent social posts.
3. **Build Toggled Client:** Create `backend/linkedin_scraper.py`. If `USE_MOCK_APIFY` is true, return the fixture. If false, run the live async `apify-client` SDK call (throttled to a maximum of 3 items).
4. **Context Injection:** Format the output block into clean Markdown and bind it to the `Strategist Agent`'s input task.