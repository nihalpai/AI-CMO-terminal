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


async def run_mock_analysis(job_id: str, url: str) -> None:
    await asyncio.sleep(10)

    def _insert():
        client = create_client(SUPABASE_URL, SUPABASE_KEY)
        client.table("analysis_jobs").insert(
            {
                "id": job_id,
                "status": "completed",
                "url": url,
                "result": {"status": "completed", "url": url},
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
    background_tasks.add_task(run_mock_analysis, job_id, payload.url)
    return JSONResponse({"job_id": job_id, "status": "processing"}, status_code=202)
