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

## Output Contract
Final output must be valid JSON matching the `analysis_jobs.result` schema
and must pass `guardrails-ai` structural validation before Supabase insert.

## Tool Permissions
Read-Only. Operates exclusively on context passed from Strategist output.

## Phase
Phase 2+ — not wired in the Day 1 MVP skeleton.
