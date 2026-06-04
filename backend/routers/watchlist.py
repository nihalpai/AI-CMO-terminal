"""Competitor watchlist — save URLs, trigger re-analysis, manage alerts."""
import asyncio
import os
from datetime import datetime, timezone
from typing import Optional

from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from supabase import create_client

load_dotenv()

router = APIRouter()
_supabase = create_client(os.environ["SUPABASE_URL"], os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ["SUPABASE_KEY"])


class WatchlistItem(BaseModel):
    competitor_url: str
    label: Optional[str] = None
    user_email: str = "user@example.com"  # placeholder until auth is added


@router.post("/api/v1/watchlist")
async def add_to_watchlist(item: WatchlistItem) -> JSONResponse:
    """Add a competitor URL to the watchlist."""
    def _insert():
        return _supabase.table("watchlist").insert({
            "competitor_url": item.competitor_url.rstrip("/"),
            "label": item.label or item.competitor_url.replace("https://", "").replace("http://", "").split("/")[0],
            "user_email": item.user_email,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }).execute()

    try:
        result = await asyncio.to_thread(_insert)
        row = result.data[0] if result.data else {}
        return JSONResponse({"id": row.get("id"), "status": "added"}, status_code=201)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/v1/watchlist")
async def list_watchlist(user_email: str = "user@example.com") -> JSONResponse:
    """List all watchlist items for a user."""
    def _query():
        return _supabase.table("watchlist").select("*").eq("user_email", user_email).order("created_at", desc=True).execute()

    try:
        result = await asyncio.to_thread(_query)
        return JSONResponse({"items": result.data or []})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/api/v1/watchlist/{item_id}")
async def remove_from_watchlist(item_id: str) -> JSONResponse:
    """Remove a competitor from the watchlist."""
    def _delete():
        return _supabase.table("watchlist").delete().eq("id", item_id).execute()

    try:
        await asyncio.to_thread(_delete)
        return JSONResponse({"status": "removed"})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/v1/watchlist/run")
async def run_watchlist_analysis(user_email: str = "user@example.com") -> JSONResponse:
    """Manually trigger re-analysis of all watchlist items."""
    import uuid

    def _get_items():
        return _supabase.table("watchlist").select("*").eq("user_email", user_email).execute()

    try:
        result = await asyncio.to_thread(_get_items)
        items = result.data or []

        if not items:
            return JSONResponse({"status": "no items", "triggered": 0})

        # Import here to avoid circular imports
        from ai_pipeline import run_analysis

        triggered = []
        for item in items:
            url = item["competitor_url"]
            job_id = str(uuid.uuid4())

            # Fire and forget — don't await
            async def _run(jid=job_id, u=url, wid=item["id"]):
                try:
                    result = await asyncio.to_thread(run_analysis, u)
                    status = "completed"
                except Exception as e:
                    result = {"error": str(e)}
                    status = "error"

                def _save():
                    _supabase.table("analysis_jobs").insert({
                        "id": jid,
                        "status": status,
                        "url": u,
                        "result": result,
                        "created_at": datetime.now(timezone.utc).isoformat(),
                    }).execute()
                    _supabase.table("watchlist").update({
                        "last_checked_at": datetime.now(timezone.utc).isoformat(),
                        "last_job_id": jid,
                    }).eq("id", wid).execute()

                await asyncio.to_thread(_save)

            asyncio.create_task(_run())
            triggered.append({"url": url, "job_id": job_id})

        return JSONResponse({"status": "triggered", "triggered": len(triggered), "jobs": triggered})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
