import asyncio
import os
import uuid
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from supabase import create_client

from ai_pipeline import run_analysis

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]

supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="GTM Agent API", version="0.1.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from routers import agents as agents_router, company as company_router, watchlist as watchlist_router
app.include_router(agents_router.router)
app.include_router(company_router.router)
app.include_router(watchlist_router.router)


class AnalyzeRequest(BaseModel):
    url: str


def _normalize_url(url: str) -> str:
    url = url.strip()
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    return url.rstrip("/")


async def _find_cached_job(url: str) -> str | None:
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)

    def _query():
        result = supabase_client.table("analysis_jobs") \
            .select("id") \
            .eq("url", url) \
            .eq("status", "completed") \
            .gte("created_at", cutoff.isoformat()) \
            .order("created_at", desc=True) \
            .limit(1) \
            .execute()
        return result.data

    rows = await asyncio.to_thread(_query)
    return rows[0]["id"] if rows else None


async def analyze_url_background(job_id: str, url: str) -> None:
    try:
        result = await asyncio.to_thread(run_analysis, url)
        status = "completed"
    except Exception as e:
        result = {"error": str(e)}
        status = "error"

    def _insert():
        supabase_client.table("analysis_jobs").insert({
            "id": job_id,
            "status": status,
            "url": url,
            "result": result,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }).execute()

    await asyncio.to_thread(_insert)


@app.get("/health")
async def health() -> JSONResponse:
    return JSONResponse({"status": "ok"})


@app.post("/api/v1/digest/run")
async def run_digest(user_email: str = "user@example.com") -> JSONResponse:
    """Manually trigger the weekly digest email."""
    from services.weekly_digest import send_weekly_digest
    result = await asyncio.to_thread(send_weekly_digest, user_email)
    return JSONResponse(result)


@app.post("/api/v1/analyze", status_code=202)
@limiter.limit("10/minute")
async def analyze(
    request: Request,
    response: Response,
    payload: AnalyzeRequest,
    background_tasks: BackgroundTasks,
) -> JSONResponse:
    url = _normalize_url(payload.url)

    cached_id = await _find_cached_job(url)
    if cached_id:
        return JSONResponse({"job_id": cached_id, "status": "completed"}, status_code=200)

    job_id = str(uuid.uuid4())
    background_tasks.add_task(analyze_url_background, job_id, url)
    return JSONResponse({"job_id": job_id, "status": "processing"}, status_code=202)
