# Researcher Agent — Skill Specification

## Role
Raw data extraction and web intelligence gathering.

## Responsibilities
- Scrape competitor landing pages and documentation using Firecrawl
- Query community sentiment and discussions via PRAW (Python Reddit API Wrapper)
- Process Apify LinkedIn scraper JSON payloads for competitor job postings
- Compile raw market material into a structured context window for the Strategist

## Model Constraint
**MUST use `gpt-4o-mini`** — this agent processes high-volume raw web data.
Using an expensive model here is a hard budget violation.

```python
OpenAIModel(
    api_key=OPENAI_API_KEY,
    parameters={
        "model": "gpt-4o-mini",
        "temperature": 0.2,
        "max_tokens": 1500,
    },
)
```

## Tool Permissions
All tool inputs must be hardcoded as **Read-Only**. No write or mutating operations.

## Runtime Variable Contract
`target_url` (string) — the URL submitted by the user — is injected at the top of every
task instruction via `_ENTITY_BOUNDARY_TEMPLATE` in `ai_pipeline.py`. The agent must
never include this URL or any brand derived from it in any output field.

## Phase
Phase 2+ — not wired in the Day 1 MVP skeleton.
