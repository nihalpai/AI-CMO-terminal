# Lyzr Studio Integration Guide

All 9 Lyzr Studio agents are built and tested. The backend integration is complete (`lyzr_studio_pipeline.py`, `agents/cmo_chat_agent_studio.py`, toggles in `main.py` and `routers/agents.py`). This file documents the full spec for reference and future changes.

---

## 1. Overview & Toggle Architecture

The Lyzr Studio pipeline runs alongside the existing `ai_pipeline.py` — both produce identical Supabase result schemas. Switch between them with one env var:

```
USE_LYZR_STUDIO=true   → lyzr_studio_pipeline.py (9 Studio agents)
USE_LYZR_STUDIO=false  → ai_pipeline.py (original Lyzr Automata, untouched)
```

The toggle lives in two places:
- `backend/main.py` — `analyze_url_background()` function
- `backend/routers/agents.py` — `chat()` endpoint

**HTTP client:** The pipeline uses raw `httpx` (already in `requirements.txt` via supabase dependency). No additional package needed — `lyzr-agent-api` is NOT used.

---

## 2. Environment Variables

Add all of these to `backend/.env` AND the Render dashboard:

```bash
# Lyzr Studio credentials
LYZR_API_KEY=                          # Studio → Settings → API Keys
LYZR_USER_ID=your_email@example.com   # Your Lyzr account email

# Agent IDs (copy from each agent's page in Studio)
LYZR_AGENT_COMPANY_CLASSIFIER=
LYZR_AGENT_COMPETITOR_FINDER=
LYZR_AGENT_WEBSITE_RESEARCHER=
LYZR_AGENT_PAIN_POINTS_SYNTHESIZER=
LYZR_AGENT_SEO_ANALYZER=
LYZR_AGENT_GEO_SCORER=
LYZR_AGENT_STRATEGY_SYNTHESIZER=
LYZR_AGENT_CMO_CHAT=
LYZR_AGENT_CONTENT_WRITER=

# Toggle (keep false until fully tested locally)
USE_LYZR_STUDIO=false
```

---

## 3. The call_agent() Helper

Every agent call in the pipeline uses these two helpers. Put them at the top of `backend/lyzr_studio_pipeline.py`.

```python
import json
import os
import re

from lyzr_agent_api.client import AgentAPI
from lyzr_agent_api.models.chat import ChatRequest

_client = AgentAPI(x_api_key=os.getenv("LYZR_API_KEY"))
LYZR_USER_ID = os.getenv("LYZR_USER_ID")


def call_agent(agent_id: str, message, session_id: str = "pipeline") -> dict:
    """Call a Studio agent and parse its JSON response."""
    response = _client.chat_with_agent(
        json_body=ChatRequest(
            user_id=LYZR_USER_ID,
            agent_id=agent_id,
            session_id=session_id,
            message=json.dumps(message) if not isinstance(message, str) else message,
        )
    )
    raw = response["response"]
    cleaned = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    # Extract JSON from mixed text (some agents output reasoning + JSON)
    match = re.search(r'\{.*\}', cleaned, re.DOTALL)
    if match:
        return json.loads(match.group())
    return json.loads(cleaned)


def call_agent_text(agent_id: str, message, session_id: str = "pipeline") -> str:
    """Call a Studio agent and return its plain text response (CMO Chat, Content Writer)."""
    response = _client.chat_with_agent(
        json_body=ChatRequest(
            user_id=LYZR_USER_ID,
            agent_id=agent_id,
            session_id=session_id,
            message=json.dumps(message) if not isinstance(message, str) else message,
        )
    )
    return response["response"]
```

---

## 4. Agent Specifications

### Agent 1: Company Classifier
- **Env var:** `LYZR_AGENT_COMPANY_CLASSIFIER`
- **Model:** Claude Haiku | **Tool:** Tavily search | **Structured output:** Yes
- **Runs:** First in pipeline

**Input** — plain URL string (not a dict):
```python
call_agent(COMPANY_CLASSIFIER_ID, "https://supabase.com")
```

**Output:**
```json
{
  "company_name": "Supabase",
  "industry": "open-source backend-as-a-service",
  "business_model": "open-source software with a paid managed cloud tier",
  "persona": "startup developers",
  "description": "Supabase is an open-source Firebase alternative built on PostgreSQL..."
}
```

**Notes:** Output feeds every downstream agent. Must complete before Competitor Finder is called.

**Important — URL scoping fix:** The agent instructions begin with a URL-scoping rule that forces classification of the specific product at the URL, not the parent company's full portfolio. This was added after observing that `amazon.com` returned both ecommerce and AWS classifications. The fix is in the first line of the agent instructions in Lyzr Studio.

---

### Agent 2: Competitor Finder
- **Env var:** `LYZR_AGENT_COMPETITOR_FINDER`
- **Model:** Perplexity Sonar Small | **Tool:** None (built-in search) | **Structured output:** Yes
- **Runs:** After Company Classifier

**Input** — Company Classifier output + url field added by Python:
```json
{
  "company_name": "Supabase",
  "industry": "open-source backend-as-a-service",
  "business_model": "open-source software with a paid managed cloud tier",
  "persona": "startup developers",
  "description": "...",
  "url": "https://supabase.com"
}
```

**Output:**
```json
{
  "competitors": [
    {"name": "Firebase", "url": "https://firebase.google.com"},
    {"name": "Appwrite", "url": "https://appwrite.io"},
    {"name": "PocketBase", "url": "https://pocketbase.io"},
    {"name": "Nhost", "url": "https://nhost.io"},
    {"name": "Convex", "url": "https://convex.dev"}
  ],
  "count": 5
}
```

**Notes:** Runs two searches ("top competitors" + "alternatives"). Excludes media/aggregator domains and sister companies. Python adds the `"url"` field to the classifier output before passing.

---

### Agent 3: Website Researcher
- **Env var:** `LYZR_AGENT_WEBSITE_RESEARCHER`
- **Model:** Perplexity Sonar Small | **Tool:** None (built-in search) | **Structured output:** Yes
- **Runs:** Once per competitor — Python loops through the competitor list (5 separate calls)

**Input** — one competitor at a time:
```json
{
  "target_company": "Supabase",
  "competitor": {
    "name": "Firebase",
    "url": "https://firebase.google.com"
  }
}
```

**Output:**
```json
{
  "competitor_name": "Firebase",
  "competitor_url": "https://firebase.google.com",
  "positioning": "Firebase positions itself as a comprehensive BaaS platform...",
  "target_audience": "Mobile app developers and startups",
  "pricing_model": "Free Spark plan + pay-as-you-go Blaze plan from $0.015/MAU",
  "key_differentiators": ["Real-time database", "Google Cloud integration"],
  "community_complaints": ["NoSQL limitations", "Unpredictable billing", "Vendor lock-in"],
  "switch_reasons": ["Need for relational database", "Cost predictability", "More infrastructure control"]
}
```

**Notes:** 3 internal searches per call (positioning, pricing, community sentiment). Results collected into a list for the Pain Points Synthesizer.

---

### Agent 4: Pain Points Synthesizer
- **Env var:** `LYZR_AGENT_PAIN_POINTS_SYNTHESIZER`
- **Model:** Claude Haiku | **Tool:** None | **Structured output:** Yes
- **Runs:** After all 5 Website Researcher calls complete

**Input** — array of all Website Researcher outputs:
```json
[
  {
    "competitor_name": "Firebase",
    "community_complaints": ["NoSQL limitations", "Unpredictable billing", "Vendor lock-in"],
    "switch_reasons": ["Need for relational database", "Cost predictability"]
  },
  {
    "competitor_name": "Appwrite",
    "community_complaints": ["Self-hosting complexity", "Limited scalability"],
    "switch_reasons": ["Needed better managed hosting", "Missing enterprise support"]
  }
]
```

**Output:**
```json
{
  "pain_points": [
    "Existing solutions lock developers into proprietary ecosystems making migration costly",
    "Pricing models are unpredictable and become prohibitively expensive at production scale",
    "Most BaaS platforms lack relational database support forcing NoSQL workarounds",
    "Self-hosting and infrastructure management is too complex for small teams",
    "Enterprise teams cannot adopt most BaaS platforms due to missing SLAs and support"
  ]
}
```

**Notes:** Pure reasoning, no search. Reads only `community_complaints` and `switch_reasons` from input — all other fields are ignored. Consolidates into exactly 5 themes.

---

### Agent 5: SEO Analyzer
- **Env var:** `LYZR_AGENT_SEO_ANALYZER`
- **Model:** Perplexity Sonar Small | **Tool:** Tavily (if Sonar fallback needed) | **Structured output:** Yes (no schema — causes tool conflict)
- **Runs:** After Pain Points Synthesizer

**Input** — assembled from classifier + competitor finder + pain points synthesizer:
```json
{
  "industry": "open-source backend-as-a-service",
  "persona": "startup developers",
  "competitor_names": ["Firebase", "Appwrite", "PocketBase", "Nhost", "Convex"],
  "pain_points": [
    "Existing solutions lock developers into proprietary ecosystems...",
    "Pricing models are unpredictable at production scale...",
    "Most BaaS platforms lack relational database support...",
    "Self-hosting is too complex for small teams...",
    "Enterprise teams cannot adopt most BaaS platforms..."
  ]
}
```

**Python assembly before calling:**
```python
seo_input = {
    "industry": classifier["industry"],
    "persona": classifier["persona"],
    "competitor_names": [c["name"] for c in competitors],
    "pain_points": pain_points_result["pain_points"]
}
```

**Output:**
```json
{
  "competitor_seo_dominance": ["Firebase dominates BaaS queries with Google backing", "..."],
  "keyword_gaps": ["vendor lock-in free backend solutions", "predictable BaaS pricing at scale", "..."],
  "white_space_opportunities": ["Cost comparison calculators showing true TCO", "Migration guides from Firebase", "..."],
  "recommended_channels": ["YouTube deep-dives on architecture", "GitHub discussions", "..."],
  "content_opportunities": ["Firebase vs Supabase true cost analysis", "Migration playbook", "..."],
  "traffic_signals": {
    "search": 50,
    "direct": 25,
    "social": 15,
    "paid": 10
  }
}
```

**Notes:** Runs exactly 2 buyer intent searches. `traffic_signals` integers must sum to 100. No structured output JSON schema in Studio (causes tool/schema conflict with Sonar) — output format enforced via instructions only.

---

### Agent 6: GEO Scorer
- **Env var:** `LYZR_AGENT_GEO_SCORER`
- **Model:** Perplexity Sonar Small | **Tool:** None (built-in search) | **Structured output:** Yes
- **Runs:** After SEO Analyzer

**Input** — company classifier + SEO analysis subset:
```json
{
  "company_classifier": {
    "company_name": "Supabase",
    "industry": "open-source backend-as-a-service",
    "business_model": "open-source software with a paid managed cloud tier",
    "persona": "startup developers",
    "description": "..."
  },
  "seo_analysis": {
    "competitor_seo_dominance": ["Firebase dominates BaaS queries...", "..."],
    "keyword_gaps": ["vendor lock-in free backend solutions", "..."]
  }
}
```

**Output:**
```json
{
  "geo_score": 88,
  "ai_visibility": "Strong",
  "schema_gaps": ["FAQ schema", "Product schema", "SoftwareApplication schema"],
  "freshness_issue": false,
  "geo_recommendations": [
    "Add FAQ schema to high-traffic pages",
    "Publish comparison pages targeting vendor-lock-in queries",
    "Strengthen Organization schema with sameAs and logo fields"
  ]
}
```

**Notes:** Very fast (~5 iterations) because Perplexity's built-in search handles research without Composio tool overhead. `ai_visibility` must be exactly "Strong" (70+), "Moderate" (40-69), or "Weak" (0-39).

---

### Agent 7: Strategy Synthesizer
- **Env var:** `LYZR_AGENT_STRATEGY_SYNTHESIZER`
- **Model:** Claude Haiku | **Tool:** None | **Structured output:** Yes
- **Runs:** Last in pipeline — has the full picture

**Input** — assembled from all previous outputs:
```json
{
  "company_name": "Supabase",
  "industry": "open-source backend-as-a-service",
  "persona": "startup developers",
  "competitors": ["Firebase", "Appwrite", "PocketBase", "Nhost", "Convex"],
  "white_space_opportunities": ["Cost comparison calculators...", "Migration guides...", "..."],
  "keyword_gaps": ["vendor lock-in free backend...", "predictable pricing...", "..."],
  "geo_score": 88,
  "ai_visibility": "Strong",
  "competitor_seo_dominance": ["Firebase dominates BaaS queries...", "..."]
}
```

**Output:**
```json
{
  "summary": "Supabase's clearest GTM opportunity is owning the 'Firebase exit' narrative — Firebase dominates search but carries deep community resentment around vendor lock-in and unpredictable billing, gaps no competitor is currently addressing with dedicated content. With strong AI visibility already established, Supabase should prioritise migration-focused content and transparent pricing comparisons to convert high-intent Firebase users actively seeking alternatives."
}
```

**Notes:** Pure reasoning, no search. 2-3 sentences, references specific competitors and gaps. Output becomes the `summary` field in the final Supabase result.

---

### Agent 8: AI CMO Chat
- **Env var:** `LYZR_AGENT_CMO_CHAT`
- **Model:** Claude Haiku | **Tool:** None | **Feature:** Memory enabled in Studio
- **Called from:** `routers/agents.py` `chat()` endpoint when `USE_LYZR_STUDIO=true`

**Input per message:**
```json
{
  "report": "{...full report JSON capped at 3000 chars...}",
  "message": "What is the highest impact marketing move right now?"
}
```

**session_id:** Always use `job_id` from Supabase. This ties conversation memory to the specific analysis session — same user, same analysis = same memory thread.

**Output:** Plain text CMO response (not JSON). Use `call_agent_text()` not `call_agent()`.

**Notes:** Report JSON is fetched from Supabase and capped at 3000 chars before passing: `json.dumps(report_context)[:3000]`. Lyzr Memory stores conversation history per `session_id` automatically — no extra config needed beyond the Memory toggle in Studio.

---

### Agent 9: Content Writer
- **Env var:** `LYZR_AGENT_CONTENT_WRITER`
- **Model:** Claude Haiku | **Tool:** None | **Structured output:** None
- **Called from:** DraftPanel when user clicks Draft on an agent card — **never during analysis pipeline**

**Input:**
```json
{
  "platform": "reddit",
  "content_recommendation": "Predictable pricing comparison content for BaaS platforms",
  "company_name": "Supabase",
  "industry": "open-source backend-as-a-service",
  "persona": "startup developers",
  "white_space_opportunities": ["Cost comparison calculators...", "..."],
  "competitors": ["Firebase", "Appwrite", "PocketBase"],
  "community_complaints": ["Unpredictable billing", "Vendor lock-in", "NoSQL limitations"]
}
```

**Supported platforms:** `"reddit"`, `"twitter"`, `"linkedin"`, `"hackernews"`, `"blog"`, `"email"`

**Output:** Plain text copy, publish-ready. Use `call_agent_text()`.

**Notes:** Called on demand only. The backend constructs the input from the stored Supabase result + the platform the user selected in DraftPanel. Replaces all 5 separate content agent calls — one agent handles every platform.

---

## 5. Full Pipeline Orchestration

This is the complete `run_analysis()` function for `backend/lyzr_studio_pipeline.py`:

```python
import json
import os

from dotenv import load_dotenv
from linkedin_scraper import fetch_linkedin_signals

load_dotenv()

COMPANY_CLASSIFIER_ID    = os.getenv("LYZR_AGENT_COMPANY_CLASSIFIER")
COMPETITOR_FINDER_ID     = os.getenv("LYZR_AGENT_COMPETITOR_FINDER")
WEBSITE_RESEARCHER_ID    = os.getenv("LYZR_AGENT_WEBSITE_RESEARCHER")
PAIN_POINTS_ID           = os.getenv("LYZR_AGENT_PAIN_POINTS_SYNTHESIZER")
SEO_ANALYZER_ID          = os.getenv("LYZR_AGENT_SEO_ANALYZER")
GEO_SCORER_ID            = os.getenv("LYZR_AGENT_GEO_SCORER")
STRATEGY_SYNTHESIZER_ID  = os.getenv("LYZR_AGENT_STRATEGY_SYNTHESIZER")


def run_analysis(url: str) -> dict:
    # Step 1: Classify the company
    classifier = call_agent(COMPANY_CLASSIFIER_ID, url)

    # Step 2: Find competitors (classifier output + url)
    competitor_result = call_agent(COMPETITOR_FINDER_ID, {**classifier, "url": url})
    competitors = competitor_result["competitors"]  # list of {name, url}

    # Step 3: Research each competitor (one call per competitor)
    website_research = []
    for comp in competitors:
        research = call_agent(WEBSITE_RESEARCHER_ID, {
            "target_company": classifier["company_name"],
            "competitor": comp
        })
        website_research.append(research)

    # Step 4: Synthesize pain points from all website research
    pain_points_result = call_agent(PAIN_POINTS_ID, website_research)

    # Step 5: SEO analysis
    competitor_names = [c["name"] for c in competitors]
    seo_result = call_agent(SEO_ANALYZER_ID, {
        "industry": classifier["industry"],
        "persona": classifier["persona"],
        "competitor_names": competitor_names,
        "pain_points": pain_points_result["pain_points"]
    })

    # Step 6: GEO score
    geo_result = call_agent(GEO_SCORER_ID, {
        "company_classifier": classifier,
        "seo_analysis": {
            "competitor_seo_dominance": seo_result.get("competitor_seo_dominance", []),
            "keyword_gaps": seo_result.get("keyword_gaps", [])
        }
    })

    # Step 7: Strategy synthesis (runs last — has full picture)
    strategy_result = call_agent(STRATEGY_SYNTHESIZER_ID, {
        "company_name": classifier["company_name"],
        "industry": classifier["industry"],
        "persona": classifier["persona"],
        "competitors": competitor_names,
        "white_space_opportunities": seo_result.get("white_space_opportunities", []),
        "keyword_gaps": seo_result.get("keyword_gaps", []),
        "geo_score": geo_result.get("geo_score", 0),
        "ai_visibility": geo_result.get("ai_visibility", "Moderate"),
        "competitor_seo_dominance": seo_result.get("competitor_seo_dominance", [])
    })

    # Step 8: Hiring signals (stays in Python — unchanged from original pipeline)
    hiring_signals_raw = fetch_linkedin_signals(competitor_names)
    hiring_signals = _format_hiring_signals(hiring_signals_raw, competitor_names)

    # Step 9: Assemble final result matching Supabase schema
    return _assemble_result(
        classifier, competitors, seo_result,
        geo_result, strategy_result, hiring_signals
    )


def _format_hiring_signals(raw: dict, competitor_names: list[str]) -> list[str]:
    """Convert linkedin_scraper output to hiring_signals string format."""
    signals = []
    for comp in raw.get("competitors", []):
        name = comp.get("name", "")
        for job in comp.get("job_posts", [])[:1]:
            title = job.get("title", "")
            snippet = job.get("description_snippet", "")
            if title and snippet:
                signals.append(f"{name}: Hiring {title} signals {snippet[:100]}")
    # Fallback if no signals extracted
    if not signals:
        for name in competitor_names[:2]:
            signals.append(
                f"{name}: Scaling engineering and go-to-market headcount signals "
                "continued product-led growth investment."
            )
    return signals


def _assemble_result(classifier, competitors, seo_result,
                     geo_result, strategy_result, hiring_signals) -> dict:
    """Map new agent outputs to the existing frontend-expected Supabase schema."""
    return {
        # Company Classifier → company_name + company_description
        "company_name": classifier.get("company_name", ""),
        "company_description": (classifier.get("description") or classifier.get("company_description", "")),

        # Strategy Synthesizer → summary
        "summary": strategy_result.get("summary", ""),

        # Competitor Finder → {name, url} objects (frontend renders as clickable links)
        "competitors": [{"name": c["name"], "url": c.get("url", "")} for c in competitors],

        # SEO Analyzer
        "white_space_opportunities": seo_result.get("white_space_opportunities", []),
        "recommended_channels": seo_result.get("recommended_channels", []),
        "content_recommendations": seo_result.get("content_opportunities", []),  # key rename
        "traffic_signals": seo_result.get("traffic_signals", {
            "search": 45, "direct": 30, "social": 15, "paid": 10
        }),

        # Hiring signals from Python (linkedin_scraper.py)
        "hiring_signals": hiring_signals,

        # GEO Scorer → geo_signals object
        "geo_signals": {
            "geo_score": geo_result.get("geo_score", 42),
            "ai_visibility": geo_result.get("ai_visibility", "Moderate"),
            "schema_gaps": geo_result.get("schema_gaps", [
                "FAQ schema", "HowTo schema", "Organization schema"
            ]),
            "freshness_issue": geo_result.get("freshness_issue", False),
            "geo_recommendations": geo_result.get("geo_recommendations", [])
        },
    }
```

**Key schema mapping notes:**
- `company_name` — now stored explicitly (used by Content Writer + LLMs.txt Generator agents)
- `content_recommendations` (frontend key) ← `content_opportunities` (SEO Analyzer key)
- `geo_signals` (frontend object) ← assembled from GEO Scorer individual fields
- `competitors` ← `{name, url}` objects; frontend renders as clickable links with favicons

---

## 6. Files Created (Sprint 7 Complete)

### `backend/lyzr_studio_pipeline.py` ✅
Full pipeline: `call_agent()`, `call_agent_text()`, `run_analysis()`, `_format_hiring_signals()`, `_assemble_result()`. Uses raw `httpx` (not `lyzr-agent-api`). See Section 3 and Section 5 above for the reference spec.

### `backend/agents/cmo_chat_agent_studio.py` ✅
Studio chat wrapper — thin file that calls the CMO Chat agent:

```python
"""CMO Chat Agent — powered by Lyzr Studio (USE_LYZR_STUDIO=true)."""
import json
import os


def get_cmo_reply(message: str, report_context: dict, session_id: str) -> str:
    from lyzr_studio_pipeline import call_agent_text
    return call_agent_text(
        agent_id=os.getenv("LYZR_AGENT_CMO_CHAT"),
        message={
            "report": json.dumps(report_context)[:3000],
            "message": message
        },
        session_id=session_id  # job_id — ties memory to this analysis session
    )
```

---

## 7. Files Modified (Sprint 7 Complete)

### `backend/main.py` ✅
Add the toggle to `analyze_url_background()`. The `from ai_pipeline import run_analysis` line at the top of the file should be removed and replaced with a conditional import inside the function:

```python
# Add near top of file with other env reads
USE_LYZR_STUDIO = os.getenv("USE_LYZR_STUDIO", "false").lower() == "true"

# Replace the existing analyze_url_background function body:
async def analyze_url_background(job_id: str, url: str) -> None:
    try:
        if USE_LYZR_STUDIO:
            from lyzr_studio_pipeline import run_analysis
        else:
            from ai_pipeline import run_analysis
        result = await asyncio.to_thread(run_analysis, url)
        status = "completed"
    except Exception as e:
        result = {"error": str(e)}
        status = "error"
    # _insert() and the rest remain unchanged
```

Also remove the top-level `from ai_pipeline import run_analysis` import since it's now conditional.

### `backend/routers/agents.py` ✅
Toggle added to the `chat()` endpoint. The `session_id` (job_id) must be passed to the Studio version:

```python
# Add near top of file
USE_LYZR_STUDIO = os.getenv("USE_LYZR_STUDIO", "false").lower() == "true"

# Replace the chat() endpoint body:
@router.post("/api/v1/chat")
async def chat(payload: ChatRequest) -> JSONResponse:
    def _query():
        return _supabase.table("analysis_jobs").select("result").eq("id", payload.job_id).single().execute()

    try:
        row = await asyncio.to_thread(_query)
    except Exception:
        raise HTTPException(status_code=404, detail="Job not found")

    report_context = row.data.get("result", {}) if row.data else {}

    if USE_LYZR_STUDIO:
        from agents.cmo_chat_agent_studio import get_cmo_reply
        reply = await asyncio.to_thread(get_cmo_reply, payload.message, report_context, payload.job_id)
    else:
        from agents.cmo_chat_agent import get_cmo_reply
        reply = await asyncio.to_thread(get_cmo_reply, payload.message, report_context)

    return JSONResponse({"reply": reply})
```

### `backend/requirements.txt`
No change needed — pipeline uses `httpx` which is already present as a transitive dependency.

---

## 8. Testing Checklist

Sprint 7 local testing complete. Pending: Render env vars + production deploy.

1. ✅ **Regression test** — `USE_LYZR_STUDIO=false`, original pipeline still works.
2. ✅ **Studio pipeline test** — `USE_LYZR_STUDIO=true`, all required fields present in Supabase result (including `company_name`).
3. ✅ **Dashboard render test** — all 4 tabs render without errors using Studio result.
4. ✅ **Chat test** — `USE_LYZR_STUDIO=true`, CMO chat returns replies.
5. ✅ **Toggle switch test** — original pipeline still works after toggling back.
6. ✅ **Draft test** — clicking "Draft →" on any agent card item opens DraftPanel and returns platform-specific copy.
7. ⬜ **Production deploy** — add all `LYZR_AGENT_*` vars to Render dashboard, set `USE_LYZR_STUDIO=true`, redeploy.
8. ⬜ **LLMs.txt test** — clicking "Draft →" on any GEO Agent recommendation returns a valid `llms.txt` Markdown file starting with `# CompanyName`.

**Post-deploy check:** Hit `https://don-drapor.onrender.com/health` and run one live analysis to confirm Studio pipeline works on Render's Python environment.

---

## 9. Sprint 8 Additions (Complete)

### Content Writer agent input (current, as of Sprint 8)
The `/api/v1/draft` endpoint sends this payload to `LYZR_AGENT_CONTENT_WRITER`:
```python
{
    "platform": payload.platform,               # reddit|twitter|linkedin|hackernews|blog|email
    "content_recommendation": payload.content_recommendation,
    "company_name": result.get("company_name", ""),
    "company_description": result.get("company_description", ""),
    "summary": result.get("summary", ""),
    "white_space_opportunities": result.get("white_space_opportunities", []),
    "competitors": result.get("competitors", []),
    "hiring_signals": result.get("hiring_signals", []),
}
```

### Sprint 9 Addition: LLMs.txt Generator
When `platform == "llmstxt"`, `/api/v1/draft` calls `LYZR_AGENT_LLMSTXT_GENERATOR` instead:
```python
{
    "company_name": result.get("company_name", ""),
    "company_url": row.data.get("url", ""),       # from analysis_jobs table
    "company_description": result.get("company_description", ""),
    "summary": result.get("summary", ""),
    "competitors": result.get("competitors", []),
    "geo_recommendations": result.get("geo_signals", {}).get("geo_recommendations", []),
    "white_space_opportunities": result.get("white_space_opportunities", []),
    "recommended_channels": result.get("recommended_channels", []),
}
```
See `lyzr_agents.md` Agent 10 for the full LLMs.txt Generator agent spec.
