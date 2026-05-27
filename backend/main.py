import asyncio
import os
import uuid
from datetime import datetime, timezone

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

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="GTM Agent API", version="0.1.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    url: str


async def analyze_url_background(job_id: str, url: str) -> None:
    try:
        result = await asyncio.to_thread(run_analysis, url)
        status = "completed"
    except Exception as e:
        result = {"error": str(e)}
        status = "error"

    def _insert():
        client = create_client(SUPABASE_URL, SUPABASE_KEY)
        client.table("analysis_jobs").insert(
            {
                "id": job_id,
                "status": status,
                "url": url,
                "result": result,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        ).execute()

    await asyncio.to_thread(_insert)


@app.get("/health")
async def health() -> JSONResponse:
    return JSONResponse({"status": "ok"})


@app.post("/api/v1/analyze", status_code=202)
@limiter.limit("10/minute")
async def analyze(
    request: Request,
    response: Response,
    payload: AnalyzeRequest,
    background_tasks: BackgroundTasks,
) -> JSONResponse:
    job_id = str(uuid.uuid4())
    background_tasks.add_task(analyze_url_background, job_id, payload.url)
    return JSONResponse({"job_id": job_id, "status": "processing"}, status_code=202)
