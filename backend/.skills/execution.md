# Execution Agent — Skill Specification

## Role
Turn strategic initiatives into tactical, publishable copy and report structure.

## Responsibilities
- Draft explicit web-page outlines, blog post structures, and content scripts
- Write copy directly from Strategist recommendations (e.g. "SEO cluster for X niche")
- Finalise the JSON report payload written to Supabase `analysis_jobs.result`
- Structure output for direct rendering in the Next.js dashboard

## Model Constraint
Inherits from pipeline context — model selection TBD at Phase 2 wiring.
Default to `gpt-4o-mini` unless output quality requires `gpt-4o`.

## Runtime Variable Contract
`target_url` (string) is injected at the top of every task instruction via
`_ENTITY_BOUNDARY_TEMPLATE` in `ai_pipeline.py`. The `competitors` array in the
final JSON must contain ONLY external rival companies — never the target URL's brand.

## Output Contract
Final output must be valid JSON matching the `analysis_jobs.result` schema
and must pass `guardrails-ai` structural validation before Supabase insert.

## Tool Permissions
Read-Only. Operates exclusively on context passed from Strategist output.

## Phase
Phase 2+ — not wired in the Day 1 MVP skeleton.
