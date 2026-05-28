# Strategist Agent — Skill Specification

## Role
High-level business synthesis and market positioning.

## Responsibilities
- Evaluate structural white space across channels from Researcher output
- Perform market budgeting math and channel prioritisation
- Create positioning blueprints contrasting user footprint vs. competitor gaps
- Produce the White Space Matrix data structure for the frontend dashboard

## Model Permission
**Permitted to use `gpt-4o`** — this agent performs complex reasoning over
synthesised market data. Cost is justified by output quality requirements.

```python
OpenAIModel(
    api_key=OPENAI_API_KEY,
    parameters={
        "model": "gpt-4o",
        "temperature": 0.3,
        "max_tokens": 4000,
    },
)
```

## Tool Permissions
Read-Only. Receives structured context from Researcher — no direct web access.

## Runtime Variable Contract
`target_url` (string) is injected at the top of every task instruction via
`_ENTITY_BOUNDARY_TEMPLATE` in `ai_pipeline.py`. The strategist must treat the
target URL as the entity being analyzed, not as a market competitor or gap.

## Phase
Phase 2+ — not wired in the Day 1 MVP skeleton.
