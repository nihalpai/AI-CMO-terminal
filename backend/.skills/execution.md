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

### `hiring_signals` Format Rule (strict)
Each string in the `hiring_signals` array must follow this exact semantic pattern:

```
"[Competitor Name]: [Observed Hiring Signal] signals [Strategic Implication/Pivot]"
```

**Valid examples:**
- `"Salesloft: Massive influx of Enterprise Account Executives signals an aggressive push upmarket, abandoning the SMB space."`
- `"Outreach.io: Pure engineering scaling with a complete freeze on marketing roles signals a defensive pivot toward product-led growth."`
- `"Apollo.io: Dominant SEO and Content Marketing hiring signals an intent to build a content moat and own the PLG acquisition channel."`

**Prohibited:**
- Raw job titles with no competitor name: `"Enterprise Account Executive"` ❌
- Signal without strategic implication: `"Salesloft is hiring salespeople"` ❌
- Missing competitor name prefix: `"Heavy enterprise sales hiring signals upmarket push"` ❌

## Tool Permissions
Read-Only. Operates exclusively on context passed from Strategist output.

## Phase
Phase 2+ — not wired in the Day 1 MVP skeleton.
