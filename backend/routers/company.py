"""Company profile endpoint for dashboard left panel."""
import asyncio
import os
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

router = APIRouter()
_supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])


def _extract_domain(url: str) -> str:
    domain = url.replace("https://", "").replace("http://", "").split("/")[0]
    return domain.replace("www.", "")


@router.get("/api/v1/company/{job_id}")
async def get_company(job_id: str) -> JSONResponse:
    def _query():
        return _supabase.table("analysis_jobs").select("url, status, result").eq("id", job_id).single().execute()

    try:
        row = await asyncio.to_thread(_query)
    except Exception:
        raise HTTPException(status_code=404, detail="Job not found")

    data = row.data
    if not data:
        raise HTTPException(status_code=404, detail="Job not found")

    result = data.get("result") or {}
    url = data.get("url", "")
    domain = _extract_domain(url)
    brand = domain.split(".")[0].capitalize()

    return JSONResponse({
        "domain": domain,
        "brand": brand,
        "url": url,
        "summary": result.get("summary", ""),
        "competitors": result.get("competitors", []),
        "status": data["status"],
    })
