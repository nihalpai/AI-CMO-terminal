"""Agent status and CMO chat endpoints."""
import os
import asyncio
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

USE_LYZR_STUDIO = os.getenv("USE_LYZR_STUDIO", "false").lower() == "true"

router = APIRouter()

_supabase = create_client(os.environ["SUPABASE_URL"], os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ["SUPABASE_KEY"])


def _map_report_to_agents(result: dict) -> list[dict]:
    """Map report JSON keys to agent feed cards."""
    agents = []

    # Reddit Agent — white space opportunities
    wso = result.get("white_space_opportunities", [])
    agents.append({
        "name": "Reddit Agent",
        "icon": "reddit",
        "status": f"{len(wso)} opportunities ready",
        "items": wso[:3],
    })

    # SEO Agent — recommended channels that mention SEO
    channels = result.get("recommended_channels", [])
    seo_items = [c for c in channels if any(k in c.lower() for k in ["seo", "search", "organic", "keyword", "content"])]
    agents.append({
        "name": "SEO Agent",
        "icon": "seo",
        "status": f"{max(len(seo_items), 1)} recommendations ready",
        "items": seo_items or channels[:2],
    })

    # X Agent — content recommendations
    content = result.get("content_recommendations", [])
    agents.append({
        "name": "X Agent",
        "icon": "x",
        "status": f"{min(len(content), 2)} ideas ready",
        "items": content[:2],
    })

    # Articles Agent
    agents.append({
        "name": "Articles Agent",
        "icon": "articles",
        "status": f"{min(len(content), 1)} topic ready",
        "items": content[2:4] if len(content) > 2 else content[:1],
    })

    # Hacker News Agent
    agents.append({
        "name": "Hacker News Agent",
        "icon": "hn",
        "status": "1 post ready",
        "items": content[-1:] if content else ["Explore niche communities for traction opportunities"],
    })

    # LinkedIn Agent — hiring signals
    hiring = result.get("hiring_signals", [])
    agents.append({
        "name": "LinkedIn Agent",
        "icon": "linkedin",
        "status": f"{len(hiring)} post ready",
        "items": hiring[:3],
    })

    # UGC Videos Agent — placeholder
    agents.append({
        "name": "UGC Videos Agent",
        "icon": "video",
        "status": "1 video ready",
        "items": ["Short-form explainer: address the top white-space opportunity in under 60 seconds"],
    })

    return agents


@router.get("/api/v1/agents/status/{job_id}")
async def get_agent_status(job_id: str) -> JSONResponse:
    def _query():
        return _supabase.table("analysis_jobs").select("status, result").eq("id", job_id).single().execute()

    try:
        row = await asyncio.to_thread(_query)
    except Exception as e:
        raise HTTPException(status_code=404, detail="Job not found")

    data = row.data
    if not data:
        raise HTTPException(status_code=404, detail="Job not found")

    if data["status"] != "completed":
        return JSONResponse({"status": data["status"], "agents": []})

    agents = _map_report_to_agents(data["result"] or {})
    return JSONResponse({"status": "completed", "agents": agents})


class ChatRequest(BaseModel):
    job_id: str
    message: str


class DraftRequest(BaseModel):
    job_id: str
    platform: str
    content_recommendation: str


@router.post("/api/v1/draft")
async def draft(payload: DraftRequest) -> JSONResponse:
    def _query():
        return _supabase.table("analysis_jobs").select("result").eq("id", payload.job_id).single().execute()

    try:
        row = await asyncio.to_thread(_query)
    except Exception:
        raise HTTPException(status_code=404, detail="Job not found")

    result = row.data.get("result", {}) if row.data else {}

    if USE_LYZR_STUDIO:
        from lyzr_studio_pipeline import call_agent_text
        agent_input = {
            "platform": payload.platform,
            "content_recommendation": payload.content_recommendation,
            "company_description": result.get("company_description", ""),
            "summary": result.get("summary", ""),
            "white_space_opportunities": result.get("white_space_opportunities", []),
            "competitors": result.get("competitors", []),
        }
        reply = await asyncio.to_thread(
            call_agent_text,
            os.getenv("LYZR_AGENT_CONTENT_WRITER"),
            agent_input,
            payload.job_id,
        )
    else:
        from agents.cmo_chat_agent import get_cmo_reply
        message = (
            f"Please draft a complete, publish-ready {payload.platform} post based on "
            f"this recommendation: \"{payload.content_recommendation}\". "
            "Output only the final draft — no preamble."
        )
        reply = await asyncio.to_thread(get_cmo_reply, message, result)

    return JSONResponse({"reply": reply})


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
