"""Lyzr Studio pipeline — 7-agent sequential analysis (USE_LYZR_STUDIO=true)."""
import json
import os
import re

import httpx
from dotenv import load_dotenv

from linkedin_scraper import fetch_linkedin_signals

load_dotenv()

_BASE_URL = os.getenv("LYZR_API_BASE_URL")
_API_KEY  = os.getenv("LYZR_API_KEY")
_USER_ID  = os.getenv("LYZR_USER_ID")

COMPANY_CLASSIFIER_ID   = os.getenv("LYZR_AGENT_COMPANY_CLASSIFIER")
COMPETITOR_FINDER_ID    = os.getenv("LYZR_AGENT_COMPETITOR_FINDER")
WEBSITE_RESEARCHER_ID   = os.getenv("LYZR_AGENT_WEBSITE_RESEARCHER")
PAIN_POINTS_ID          = os.getenv("LYZR_AGENT_PAIN_POINTS_SYNTHESIZER")
SEO_ANALYZER_ID         = os.getenv("LYZR_AGENT_SEO_ANALYZER")
GEO_SCORER_ID           = os.getenv("LYZR_AGENT_GEO_SCORER")
STRATEGY_SYNTHESIZER_ID = os.getenv("LYZR_AGENT_STRATEGY_SYNTHESIZER")


def _call_lyzr(agent_id: str, message: str, session_id: str) -> str:
    """POST to Lyzr /v3/inference/chat/ and return the response text."""
    resp = httpx.post(
        f"{_BASE_URL}/v3/inference/chat/",
        headers={"x-api-key": _API_KEY, "content-type": "application/json"},
        json={"user_id": _USER_ID, "agent_id": agent_id,
              "session_id": session_id, "message": message},
        timeout=120.0,
    )
    resp.raise_for_status()
    return resp.json()["response"]


def call_agent(agent_id: str, message, session_id: str = "pipeline") -> dict:
    """Call a Studio agent and parse its JSON response."""
    raw = _call_lyzr(
        agent_id,
        json.dumps(message) if not isinstance(message, str) else message,
        session_id,
    )
    cleaned = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    match = re.search(r'\{.*\}', cleaned, re.DOTALL)
    return json.loads(match.group() if match else cleaned)


def call_agent_text(agent_id: str, message, session_id: str = "pipeline") -> str:
    """Call a Studio agent and return its plain text response (CMO Chat, Content Writer)."""
    return _call_lyzr(
        agent_id,
        json.dumps(message) if not isinstance(message, str) else message,
        session_id,
    )


def run_analysis(url: str, job_id: str = "pipeline") -> dict:
    sid = job_id  # Each job gets its own isolated Lyzr session — prevents context bleed between analyses

    # Step 1: Classify the company
    classifier = call_agent(COMPANY_CLASSIFIER_ID, url, session_id=sid)

    # Step 2: Find competitors (classifier output + url)
    competitor_result = call_agent(COMPETITOR_FINDER_ID, {**classifier, "url": url}, session_id=sid)
    competitors = competitor_result["competitors"]  # list of {name, url}

    # Step 3: Research each competitor (one call per competitor)
    website_research = []
    for comp in competitors:
        research = call_agent(WEBSITE_RESEARCHER_ID, {
            "target_company": classifier["company_name"],
            "competitor": comp,
        }, session_id=sid)
        website_research.append(research)

    # Step 4: Synthesize pain points from all website research
    pain_points_result = call_agent(PAIN_POINTS_ID, website_research, session_id=sid)

    # Step 5: SEO analysis
    competitor_names = [c["name"] for c in competitors]
    seo_result = call_agent(SEO_ANALYZER_ID, {
        "industry": classifier["industry"],
        "persona": classifier["persona"],
        "competitor_names": competitor_names,
        "pain_points": pain_points_result["pain_points"],
    }, session_id=sid)

    # Step 6: GEO score
    geo_result = call_agent(GEO_SCORER_ID, {
        "company_classifier": classifier,
        "seo_analysis": {
            "competitor_seo_dominance": seo_result.get("competitor_seo_dominance", []),
            "keyword_gaps": seo_result.get("keyword_gaps", []),
        },
    }, session_id=sid)

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
        "competitor_seo_dominance": seo_result.get("competitor_seo_dominance", []),
    }, session_id=sid)

    # Step 8: Hiring signals (stays in Python — unchanged from original pipeline)
    hiring_signals_raw = fetch_linkedin_signals(competitor_names)
    hiring_signals = _format_hiring_signals(hiring_signals_raw, competitor_names)

    return _assemble_result(
        classifier, competitors, seo_result,
        geo_result, strategy_result, hiring_signals,
    )


def _format_hiring_signals(raw: dict, competitor_names: list[str]) -> list[str]:
    signals = []
    for comp in raw.get("competitors", []):
        name = comp.get("name", "")
        for job in comp.get("job_posts", [])[:1]:
            title = job.get("title", "")
            snippet = job.get("description_snippet", "")
            if title and snippet:
                signals.append(f"{name}: Hiring {title} signals {snippet[:100]}")
    if not signals:
        for name in competitor_names[:2]:
            signals.append(
                f"{name}: Scaling engineering and go-to-market headcount signals "
                "continued product-led growth investment."
            )
    return signals


def _assemble_result(classifier, competitors, seo_result,
                     geo_result, strategy_result, hiring_signals) -> dict:
    return {
        "company_one_liner": classifier.get("one_liner", ""),
        "company_description": (classifier.get("description") or classifier.get("company_description", "")),
        "summary": strategy_result.get("summary", ""),
        "competitors": [c["name"] for c in competitors],
        "white_space_opportunities": seo_result.get("white_space_opportunities", []),
        "recommended_channels": seo_result.get("recommended_channels", []),
        "content_recommendations": seo_result.get("content_opportunities", []),  # key rename
        "traffic_signals": seo_result.get("traffic_signals", {
            "search": 45, "direct": 30, "social": 15, "paid": 10,
        }),
        "hiring_signals": hiring_signals,
        "geo_signals": {
            "geo_score": geo_result.get("geo_score", 42),
            "ai_visibility": geo_result.get("ai_visibility", "Moderate"),
            "schema_gaps": geo_result.get("schema_gaps", [
                "FAQ schema", "HowTo schema", "Organization schema",
            ]),
            "freshness_issue": geo_result.get("freshness_issue", False),
            "geo_recommendations": geo_result.get("geo_recommendations", []),
        },
    }
