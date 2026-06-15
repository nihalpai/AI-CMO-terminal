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
        return _supabase.table("analysis_jobs").select("result, url").eq("id", payload.job_id).single().execute()

    try:
        row = await asyncio.to_thread(_query)
    except Exception:
        raise HTTPException(status_code=404, detail="Job not found")

    result = row.data.get("result", {}) if row.data else {}
    company_url = row.data.get("url", "") if row.data else ""

    if USE_LYZR_STUDIO:
        from lyzr_studio_pipeline import call_agent_text
        if payload.platform == "llmstxt":
            agent_input = {
                "company_name": result.get("company_name", ""),
                "company_url": company_url,
                "company_description": result.get("company_description", ""),
                "summary": result.get("summary", ""),
                "competitors": result.get("competitors", []),
                "geo_recommendations": result.get("geo_signals", {}).get("geo_recommendations", []),
                "white_space_opportunities": result.get("white_space_opportunities", []),
                "recommended_channels": result.get("recommended_channels", []),
            }
            reply = await asyncio.to_thread(
                call_agent_text,
                os.getenv("LYZR_AGENT_LLMSTXT_GENERATOR"),
                agent_input,
                payload.job_id,
            )
        elif payload.platform == "ugcvideo_script":
            # Phase A: Video Strategist agent — returns raw JSON string for VideoPanel to parse
            agent_input = {
                "company_name": result.get("company_name", ""),
                "company_description": result.get("company_description", ""),
                "industry": result.get("industry", ""),
                "business_model": result.get("business_model", ""),
                "persona": result.get("persona", ""),
                "summary": result.get("summary", ""),
                "white_space_opportunities": result.get("white_space_opportunities", [])[:3],
                "competitors": [
                    c["name"] if isinstance(c, dict) else c
                    for c in result.get("competitors", [])[:3]
                ],
            }
            reply = await asyncio.to_thread(
                call_agent_text,
                os.getenv("LYZR_AGENT_VIDEO_STRATEGIST"),
                agent_input,
                payload.job_id,
            )
        else:
            agent_input = {
                "platform": payload.platform,
                "content_recommendation": payload.content_recommendation,
                "company_name": result.get("company_name", ""),
                "company_description": result.get("company_description", ""),
                "summary": result.get("summary", ""),
                "white_space_opportunities": result.get("white_space_opportunities", []),
                "competitors": result.get("competitors", []),
                "hiring_signals": result.get("hiring_signals", []),
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
