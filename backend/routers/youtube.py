"""YouTube Shorts upload endpoints — Sprint 12.

One-click upload of an already-rendered UGC video (video_jobs.final_video_url) to a single
app-owned YouTube channel via the official YouTube Data API v3 (videos.insert). Unlike video
RENDERING (Higgsfield CLI, worker-only), this runs in the normal FastAPI process: it's a plain
HTTPS API call and the clip is tiny (15s, a few MB).

Auth model: the app holds ONE long-lived refresh token (YOUTUBE_REFRESH_TOKEN, minted once via
backend/scripts/get_youtube_token.py) for ONE channel and uploads on behalf of every user — so
the click needs no per-user Google login.

Visibility: uploads are set to YOUTUBE_PRIVACY (default 'private'). Un-audited Google projects
FORCE private regardless; once the free YouTube API audit is approved, set YOUTUBE_PRIVACY=public
and redeploy — no code change.

Re-upload gate: the same video may be re-uploaded only once every YOUTUBE_REUPLOAD_DAYS (default 7)
to avoid spammy traffic / account strikes. Enforced server-side here (the UI also disables the
button). Tracked in the youtube_uploads table.
"""
import asyncio
import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from io import BytesIO

import httpx
from dotenv import load_dotenv
from fastapi import APIRouter, BackgroundTasks, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from supabase import create_client

load_dotenv()

logger = logging.getLogger("youtube")
logger.setLevel(logging.INFO)

router = APIRouter()

_supabase = create_client(
    os.environ["SUPABASE_URL"],
    os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ["SUPABASE_KEY"],
)

YOUTUBE_PRIVACY = os.getenv("YOUTUBE_PRIVACY", "private")
REUPLOAD_DAYS = int(os.getenv("YOUTUBE_REUPLOAD_DAYS", "7"))
SCOPES = ["https://www.googleapis.com/auth/youtube.upload"]


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class YouTubeUploadRequest(BaseModel):
    video_job_id: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _watch_url(video_id: str | None) -> str | None:
    # 15s + 9:16 auto-qualifies as a Short — the /shorts/ URL renders it in the Shorts player.
    return f"https://www.youtube.com/shorts/{video_id}" if video_id else None


def _parse_ts(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _next_allowed_at(completed_at: str | None) -> str | None:
    ts = _parse_ts(completed_at)
    if not ts:
        return None
    return (ts + timedelta(days=REUPLOAD_DAYS)).isoformat()


def _latest_upload(video_job_id: str):
    """Most recent youtube_uploads row for a video (any status), or None."""
    res = _supabase.table("youtube_uploads") \
        .select("id, status, youtube_video_id, error_text, completed_at, created_at") \
        .eq("video_job_id", video_job_id) \
        .order("created_at", desc=True) \
        .limit(1) \
        .execute()
    return res.data[0] if res.data else None


def _latest_completed(video_job_id: str):
    res = _supabase.table("youtube_uploads") \
        .select("completed_at") \
        .eq("video_job_id", video_job_id) \
        .eq("status", "completed") \
        .order("completed_at", desc=True) \
        .limit(1) \
        .execute()
    return res.data[0] if res.data else None


def _update_upload(upload_id: str, updates: dict) -> None:
    _supabase.table("youtube_uploads").update(updates).eq("id", upload_id).execute()


def _derive_title(script: str) -> str:
    """First sentence/line of the script, capped at YouTube's 100-char title limit."""
    first = (script or "").strip().splitlines()[0] if (script or "").strip() else ""
    first = first.split(". ")[0].strip()
    return (first or "AI Marketing Short")[:90]


def _yt_upload(upload_id: str, video_url: str, script: str) -> None:
    """Download the rendered clip and upload it to YouTube. Runs in a background thread."""
    try:
        # Lazy imports so the app still boots if google libs aren't installed yet.
        from google.oauth2.credentials import Credentials
        from googleapiclient.discovery import build
        from googleapiclient.http import MediaIoBaseUpload

        creds = Credentials(
            token=None,
            refresh_token=os.environ["YOUTUBE_REFRESH_TOKEN"],
            client_id=os.environ["YOUTUBE_CLIENT_ID"],
            client_secret=os.environ["YOUTUBE_CLIENT_SECRET"],
            token_uri="https://oauth2.googleapis.com/token",
            scopes=SCOPES,
        )

        resp = httpx.get(video_url, timeout=60.0, follow_redirects=True)
        resp.raise_for_status()
        media = MediaIoBaseUpload(BytesIO(resp.content), mimetype="video/mp4", resumable=True)

        title = _derive_title(script)
        description = ((script or "").strip() + "\n\n#Shorts").strip()
        body = {
            "snippet": {
                "title": title,
                "description": description,
                "tags": ["Shorts"],
                "categoryId": "22",  # People & Blogs
            },
            "status": {
                "privacyStatus": YOUTUBE_PRIVACY,
                "selfDeclaredMadeForKids": False,
            },
        }

        youtube = build("youtube", "v3", credentials=creds, cache_discovery=False)
        request = youtube.videos().insert(part="snippet,status", body=body, media_body=media)
        response = None
        while response is None:
            _, response = request.next_chunk()
        video_id = response["id"]

        _update_upload(upload_id, {
            "status": "completed",
            "youtube_video_id": video_id,
            "privacy": YOUTUBE_PRIVACY,
            "completed_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info("youtube upload %s -> video %s (%s)", upload_id, video_id, YOUTUBE_PRIVACY)

    except Exception as exc:
        logger.exception("youtube upload %s failed: %s", upload_id, exc)
        _update_upload(upload_id, {"status": "error", "error_text": str(exc)})


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/api/v1/youtube/upload", status_code=202)
async def upload_to_youtube(
    payload: YouTubeUploadRequest,
    background_tasks: BackgroundTasks,
) -> JSONResponse:
    """Enqueue a one-click upload of a completed video to YouTube as a Short."""
    def _video_row():
        return _supabase.table("video_jobs") \
            .select("status, final_video_url, avatar_video_url, script") \
            .eq("id", payload.video_job_id) \
            .single() \
            .execute()

    try:
        row = await asyncio.to_thread(_video_row)
    except Exception:
        raise HTTPException(status_code=404, detail="Video not found")

    data = row.data or {}
    if data.get("status") != "completed":
        raise HTTPException(status_code=409, detail="Video is not finished rendering yet")

    video_url = data.get("final_video_url") or data.get("avatar_video_url")
    if not video_url:
        raise HTTPException(status_code=409, detail="Video has no playable URL")

    # Weekly re-upload gate (server-side enforcement).
    completed = await asyncio.to_thread(_latest_completed, payload.video_job_id)
    if completed:
        next_allowed = _next_allowed_at(completed.get("completed_at"))
        na_ts = _parse_ts(next_allowed)
        if na_ts and na_ts > datetime.now(timezone.utc):
            return JSONResponse(
                {"detail": "Re-upload not allowed yet", "next_allowed_at": next_allowed},
                status_code=429,
            )

    # If an upload is already in flight for this video, return it (idempotent-ish).
    latest = await asyncio.to_thread(_latest_upload, payload.video_job_id)
    if latest and latest.get("status") == "uploading":
        return JSONResponse({"upload_id": latest["id"], "status": "uploading"}, status_code=202)

    upload_id = str(uuid.uuid4())

    def _create():
        _supabase.table("youtube_uploads").insert({
            "id": upload_id,
            "video_job_id": payload.video_job_id,
            "status": "uploading",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }).execute()

    await asyncio.to_thread(_create)
    background_tasks.add_task(asyncio.to_thread, _yt_upload, upload_id, video_url, data.get("script", ""))
    return JSONResponse({"upload_id": upload_id, "status": "uploading"}, status_code=202)


@router.get("/api/v1/youtube/status/{upload_id}")
async def youtube_status(upload_id: str) -> JSONResponse:
    """Poll a single upload's status."""
    def _query():
        return _supabase.table("youtube_uploads") \
            .select("status, youtube_video_id, error_text, completed_at") \
            .eq("id", upload_id) \
            .single() \
            .execute()

    try:
        row = await asyncio.to_thread(_query)
    except Exception:
        raise HTTPException(status_code=404, detail="Upload not found")

    d = row.data or {}
    return JSONResponse({
        "status": d.get("status"),
        "youtube_video_id": d.get("youtube_video_id"),
        "watch_url": _watch_url(d.get("youtube_video_id")),
        "next_allowed_at": _next_allowed_at(d.get("completed_at")),
        "error_text": d.get("error_text"),
    })


@router.get("/api/v1/youtube/by-video/{video_job_id}")
async def youtube_by_video(video_job_id: str) -> JSONResponse:
    """Latest upload for a video — rehydrates the Watch button + re-upload countdown on reopen."""
    latest = await asyncio.to_thread(_latest_upload, video_job_id)
    if not latest:
        raise HTTPException(status_code=404, detail="No upload found")
    return JSONResponse({
        "id": latest["id"],
        "status": latest.get("status"),
        "youtube_video_id": latest.get("youtube_video_id"),
        "watch_url": _watch_url(latest.get("youtube_video_id")),
        "next_allowed_at": _next_allowed_at(latest.get("completed_at")),
        "error_text": latest.get("error_text"),
    })
