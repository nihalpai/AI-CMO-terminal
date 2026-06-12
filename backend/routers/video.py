"""Video generation endpoints — Sprint 11 (Higgsfield CLI subprocess mode).

Auth note: The Higgsfield CLI reads ~/.config/higgsfield/credentials.json and handles
OAuth token refresh automatically. No API key env var is required.
"""
import asyncio
import json
import logging
import math
import os
import subprocess
import time
import uuid
from datetime import datetime, timezone

import httpx
from dotenv import load_dotenv
from fastapi import APIRouter, BackgroundTasks, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from supabase import create_client

load_dotenv()

logger = logging.getLogger("video")
logger.setLevel(logging.INFO)

router = APIRouter()

_supabase = create_client(
    os.environ["SUPABASE_URL"],
    os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ["SUPABASE_KEY"],
)

SERPER_API_KEY = os.getenv("SERPER_API_KEY", "")

def _get_setting_id(_company_type: str) -> str:
    return os.getenv("HIGGSFIELD_SETTING_ID", "")


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class VideoGenerateRequest(BaseModel):
    job_id: str                    # analysis_jobs.id
    script: str                    # Phase A: Video Strategist output
    company_type: str
    hook_type: str
    avatar_style: str
    broll_prompt: str
    image_search_query: str
    target_duration_seconds: int
    shots: list[dict]


# ---------------------------------------------------------------------------
# Supabase helpers
# ---------------------------------------------------------------------------

def _create_video_job(video_job_id: str, analysis_job_id: str, payload: VideoGenerateRequest) -> None:
    # Store the FULL request payload so a separate worker (backend/scripts/video_worker.py) can
    # rebuild it and render later. The individual columns below are kept for convenience/back-compat.
    request_payload = payload.model_dump() if hasattr(payload, "model_dump") else payload.dict()
    _supabase.table("video_jobs").insert({
        "id": video_job_id,
        "analysis_job_id": analysis_job_id,
        "status": "pending",
        "script": payload.script,
        "company_type": payload.company_type,
        "hook_type": payload.hook_type,
        "shots": payload.shots,
        "request_payload": request_payload,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).execute()


def _update_video_job(video_job_id: str, updates: dict) -> None:
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    _supabase.table("video_jobs").update(updates).eq("id", video_job_id).execute()


def _update_status(video_job_id: str, status: str) -> None:
    _update_video_job(video_job_id, {"status": status})


# ---------------------------------------------------------------------------
# Image download helpers
# ---------------------------------------------------------------------------

def _download_image_from_url(url: str) -> str:
    """Download an image URL to /tmp and return the local path."""
    resp = httpx.get(url, timeout=15.0, follow_redirects=True)
    resp.raise_for_status()
    content_type = resp.headers.get("content-type", "")
    ext = ".png" if "png" in content_type else ".jpg"
    path = f"/tmp/broll_{uuid.uuid4().hex}{ext}"
    with open(path, "wb") as f:
        f.write(resp.content)
    return path


def _search_and_download_image(query: str) -> str:
    """Search Serper for images, download the first valid result to /tmp."""
    resp = httpx.post(
        "https://google.serper.dev/images",
        headers={"X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json"},
        json={"q": query, "num": 5},
        timeout=15.0,
    )
    resp.raise_for_status()
    images = resp.json().get("images", [])

    for img in images[:3]:
        image_url = img.get("imageUrl") or img.get("link", "")
        if not image_url:
            continue
        try:
            return _download_image_from_url(image_url)
        except Exception:
            continue

    raise RuntimeError(f"Could not download any image for query: {query}")


def _download_file(url: str, path: str) -> None:
    """Download any URL (video or image) to a local path."""
    resp = httpx.get(url, timeout=60.0, follow_redirects=True)
    resp.raise_for_status()
    with open(path, "wb") as f:
        f.write(resp.content)


# ---------------------------------------------------------------------------
# Higgsfield web products
# ---------------------------------------------------------------------------

def _fetch_web_product(company_url: str) -> tuple[str, list[str]]:
    """Fetch a Higgsfield web product for the company URL.

    Returns (web_product_id, [screenshot_url, ...]) ordered desktop-first.
    Falls back to ("", []) on any failure so the pipeline always continues.
    """
    try:
        result = subprocess.run(
            ["higgsfield", "marketing-studio", "webproducts", "fetch",
             "--url", company_url, "--wait", "--json"],
            capture_output=True, text=True, timeout=120,
        )
        if result.returncode != 0:
            return ("", [])
        data = json.loads(result.stdout)
        if isinstance(data, list):
            data = data[0]
        wp_id = data.get("id", "")
        medias = data.get("medias", [])
        urls = [m["url"] for m in medias if m.get("type") == "desktop"]
        urls += [m["url"] for m in medias if m.get("type") == "mobile"]
        urls += [m["url"] for m in medias if m.get("type") not in ("desktop", "mobile")]
        return (wp_id, urls)
    except Exception:
        return ("", [])


# ---------------------------------------------------------------------------
# FFmpeg composition helpers
# ---------------------------------------------------------------------------

def _build_product_section(screenshot_paths: list[str], duration: int, output_path: str) -> None:
    """Ken Burns slideshow from 1–2 screenshots → 768×538 video at 30fps.

    2 screenshots: screenshot 1 zooms in for 8s, screenshot 2 pans for 7s,
    1s xfade crossfade between them.
    1 screenshot: slow zoom-in for the full duration.
    """
    if len(screenshot_paths) >= 2:
        filter_complex = (
            "[0:v]scale=1200:800,"
            "zoompan=z='min(zoom+0.0008,1.1)':"
            "x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=240:s=768x538:fps=30,"
            "trim=end=8,setpts=PTS-STARTPTS[s0];"
            "[1:v]scale=1200:800,"
            "zoompan=z='min(zoom+0.0006,1.08)':"
            "x='if(lte(on\\,1)\\,iw/4\\,x+0.5)':y='ih/2-(ih/zoom/2)':d=210:s=768x538:fps=30,"
            "trim=end=7,setpts=PTS-STARTPTS[s1];"
            "[s0][s1]xfade=transition=fade:duration=1:offset=7[product]"
        )
        inputs = [
            "-loop", "1", "-t", str(duration), "-i", screenshot_paths[0],
            "-loop", "1", "-t", str(duration), "-i", screenshot_paths[1],
        ]
        map_arg = "[product]"
    else:
        filter_complex = (
            "[0:v]scale=1200:800,"
            "zoompan=z='min(zoom+0.0005,1.1)':"
            "x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=450:s=768x538:fps=30[product]"
        )
        inputs = ["-loop", "1", "-t", str(duration), "-i", screenshot_paths[0]]
        map_arg = "[product]"

    subprocess.run([
        "ffmpeg", "-y", *inputs,
        "-filter_complex", filter_complex,
        "-map", map_arg,
        "-c:v", "libx264", "-preset", "fast", "-crf", "23",
        "-movflags", "+faststart", "-t", str(duration),
        output_path,
    ], check=True, timeout=180)


def _compose_split_screen(product_path: str, avatar_path: str, output_path: str, duration: int) -> None:
    """Stack product section (top 40%, 768×538) above avatar crop (bottom 60%, 768×806).

    Avatar crop takes the top 806px of the 1344px 9:16 frame — shows face and upper body.
    Final output: 768×1344 (9:16), audio from avatar.
    """
    subprocess.run([
        "ffmpeg", "-y",
        "-i", product_path,
        "-i", avatar_path,
        "-filter_complex",
            "[0:v]scale=768:538,setsar=1[top];"
            "[1:v]crop=768:806:0:0,setsar=1[bot];"
            "[top][bot]vstack=inputs=2[composed]",
        "-map", "[composed]", "-map", "1:a?",
        "-c:v", "libx264", "-preset", "fast", "-crf", "23",
        "-c:a", "aac", "-b:a", "128k",
        "-movflags", "+faststart", "-t", str(duration),
        output_path,
    ], check=True, timeout=120)


def _upload_to_storage(local_path: str, filename: str) -> str:
    """Upload a local file to the Supabase Storage 'videos' bucket and return the public URL."""
    with open(local_path, "rb") as f:
        _supabase.storage.from_("videos").upload(
            filename, f, {"content-type": "video/mp4", "upsert": "true"}
        )
    return _supabase.storage.from_("videos").get_public_url(filename)


# ---------------------------------------------------------------------------
# Higgsfield CLI helpers
# ---------------------------------------------------------------------------

def _cli(args: list[str], timeout: int = 600) -> dict | list:
    """Run a Higgsfield CLI command with --wait --json, return parsed output.

    The CLI reads ~/.config/higgsfield/credentials.json and refreshes OAuth
    tokens automatically — no API key required.
    """
    logger.info("higgsfield %s", " ".join(args))
    result = subprocess.run(
        ["higgsfield"] + args,
        capture_output=True,
        text=True,
        timeout=timeout,
    )
    # CLI stderr carries progress/warnings that never make it into the JSON; log it so a
    # status:failed job (which still exits 0) leaves a breadcrumb in the server console.
    if result.stderr.strip():
        logger.warning("higgsfield stderr: %s", result.stderr.strip()[-1000:])
    if result.returncode != 0:
        raise RuntimeError(
            f"higgsfield CLI error (exit {result.returncode}): "
            f"{result.stderr.strip() or result.stdout.strip()}"
        )
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Unexpected CLI output: {result.stdout[:500]}") from exc


def _extract_video_url(cli_output: dict | list) -> str:
    """Extract video URL from CLI --wait --json output.

    Higgsfield job objects use 'result_url', 'url', 'video_url', or nested 'outputs[0].url'.
    The CLI may return a list (one element per job) or a single object.
    Also checks for failed status to give a cleaner error.
    """
    if isinstance(cli_output, list):
        cli_output = cli_output[0]
    if cli_output.get("status") == "failed":
        raise RuntimeError(
            f"Higgsfield job failed — full response: {json.dumps(cli_output)}"
        )
    return (
        cli_output.get("result_url")
        or cli_output.get("url")
        or cli_output.get("video_url")
        or cli_output.get("output_url")
        or (cli_output.get("outputs") or [{}])[0].get("url", "")
    )


def _generate_avatar_video(script: str, duration: int, web_product_id: str = "", setting_id: str = "") -> str:
    """Generate talking-head UGC avatar via marketing_studio_video CLI.

    Model verified June 2026: soul_v2 does not exist. marketing_studio_video is
    the correct UGC talking-head model. Preset avatars available via:
        higgsfield marketing-studio avatars list
    setting_id is passed in from _get_setting_id(company_type) so the background
    matches the company context (office for SaaS, bedroom for ecommerce, etc).
    """
    avatar_id = os.getenv("HIGGSFIELD_AVATAR_ID", "")
    base_args = [
        "generate", "create", "marketing_studio_video",
        "--prompt", script,
        "--duration", str(duration),
        "--aspect_ratio", "9:16",
        "--mode", "ugc",
        "--generate_audio", "true",
        "--wait", "--json",
    ]
    # Higgsfield server-side regression (confirmed June 2026): passing --avatars with
    # ANY preset avatar makes marketing_studio_video run ~5 min then return status:failed
    # with no error detail. The same job without --avatars completes and returns a video URL
    # (Higgsfield auto-selects a creator). Verified failing with Liam + Jayden preset ids.
    # Gated off by default; flip HIGGSFIELD_USE_AVATARS=true to re-enable in one place once
    # Higgsfield fixes their side. HIGGSFIELD_AVATAR_ID stays set so re-enabling is zero-config.
    use_avatars = os.getenv("HIGGSFIELD_USE_AVATARS", "false").lower() == "true"
    if avatar_id and use_avatars:
        base_args += ["--avatars", json.dumps([{"id": avatar_id, "type": "preset"}])]
    # Higgsfield regression (confirmed June 2026): passing --setting_id switches the server-side
    # prompt enhancer to a face-locked multi-shot template ("Character refs: @image_1 … Woman …
    # match face and outfit exactly"). Against the auto-generated creator reference this fails ~5 min
    # in with status:failed. Jobs WITHOUT a setting use the simple "<<<creator>>>" template that
    # completes (verified: a setting:null call succeeded; setting:Office calls failed; an earlier
    # long-script job from before setting was configured also succeeded — so duration is NOT the cause).
    # Gated off by default; flip HIGGSFIELD_USE_SETTING=true to re-enable once Higgsfield fixes it.
    use_setting = os.getenv("HIGGSFIELD_USE_SETTING", "false").lower() == "true"
    if setting_id and use_setting:
        base_args += ["--setting_id", setting_id]
    # Higgsfield bug (confirmed June 2026): passing --web_product_ids attaches the scraped
    # product screenshot as a role:image media, which marketing_studio_video's UGC mode then
    # treats as a CHARACTER/face reference (the enhanced_prompt describes "@image_1" as a
    # person to "match face and outfit exactly"). A product screenshot is not a face, so the
    # talking-head generation runs ~5 min then returns status:failed. The product still appears
    # in the final video via the FFmpeg split-screen composition (_build_product_section), which
    # uses the same screenshots independently — so dropping this flag loses nothing visually.
    # Gated off by default; flip HIGGSFIELD_USE_WEB_PRODUCTS=true to re-enable once Higgsfield fixes it.
    use_web_products = os.getenv("HIGGSFIELD_USE_WEB_PRODUCTS", "false").lower() == "true"
    if web_product_id and use_web_products:
        base_args += ["--web_product_ids", json.dumps([web_product_id])]

    # Diagnostic: the exact flags we sent. On failure this is the fastest way to see whether a
    # gated flag (--avatars / --setting_id / --web_product_ids) leaked back in, or the duration.
    sent_cmd = "higgsfield " + " ".join(base_args)
    flags_summary = (
        f"duration={duration} "
        f"avatars={'--avatars' in base_args} "
        f"setting_id={'--setting_id' in base_args} "
        f"web_product_ids={'--web_product_ids' in base_args}"
    )
    # The main cause of failures is video LENGTH (see _planned_duration / VIDEO_MAX_DURATION) — long
    # ~17-20s jobs fail deterministically, which is why retrying them was useless and just burned
    # ~5 min per attempt. With duration pinned to the designed ~15s (below the failure cliff), jobs
    # succeed first try. This retry is now only a safety net for GENUINE transient failures
    # (Higgsfield refunds video credits on failure, so a retry is cheap). Default 2 attempts to bound
    # latency. Raise HIGGSFIELD_MAX_ATTEMPTS only if you see real intermittent failures at 15s.
    max_attempts = max(1, int(os.getenv("HIGGSFIELD_MAX_ATTEMPTS", "2")))
    last_err = ""
    for attempt in range(1, max_attempts + 1):
        try:
            output = _cli(base_args)
            url = _extract_video_url(output)
            if url:
                if attempt > 1:
                    logger.info("marketing_studio_video succeeded on attempt %d/%d", attempt, max_attempts)
                return url
            last_err = f"No video URL in marketing_studio_video output: {output}"
        except RuntimeError as exc:
            last_err = str(exc)
        logger.warning("marketing_studio_video attempt %d/%d failed [%s]", attempt, max_attempts, flags_summary)
        if attempt < max_attempts:
            time.sleep(8)  # brief backoff before retrying the flaky job
    logger.error("marketing_studio_video gave up after %d attempts [%s] — cmd: %s",
                 max_attempts, flags_summary, sent_cmd)
    raise RuntimeError(
        f"{last_err}\n--- failed all {max_attempts} attempt(s); we sent [{flags_summary}]: {sent_cmd}"
    )


# ---------------------------------------------------------------------------
# Background pipeline task
# ---------------------------------------------------------------------------

def _get_company_url(job_id: str) -> str:
    """Look up the company URL from analysis_jobs by job_id."""
    try:
        row = _supabase.table("analysis_jobs").select("url").eq("id", job_id).single().execute()
        return row.data.get("url", "") if row.data else ""
    except Exception:
        return ""


def _planned_duration(payload: "VideoGenerateRequest") -> int:
    """Duration the strategy DESIGNED for, clamped to the reliable max (VIDEO_MAX_DURATION).

    Priority: target_duration_seconds  ->  sum(shots[].duration_seconds)  ->  word-count estimate.

    Why this is the fix for the recurring render failures: marketing_studio_video reliably renders
    SHORT clips but fails server-side (~5 min then status:failed) on long ~17-20s single-take UGC.
    Proven 2026-06-10: the identical 35-word script that failed 3x at duration 17 completed at
    duration 8; a real production success was a 15s job. The Video Strategist pins
    target_duration_seconds=15 and writes ~35-40 words for 15s at 150 WPM — but the OLD code
    recomputed duration from word count at 130 WPM (words/2.17), inflating those scripts to 17-20s
    and tipping them over the failure cliff. We now trust the DESIGNED duration and only clamp it.
    Default cap 15 (the only production-confirmed length; raise VIDEO_MAX_DURATION to 16 only after
    the standalone probe — backend/scripts/higgsfield_probe.py — shows 16 actually renders).
    """
    max_dur = int(os.getenv("VIDEO_MAX_DURATION", "15"))
    designed = getattr(payload, "target_duration_seconds", 0) or 0
    if designed <= 0:
        designed = sum(int(s.get("duration_seconds", 0)) for s in (payload.shots or []))
    if designed <= 0:
        designed = math.ceil(len(payload.script.split()) / 2.5)  # 150 WPM = 2.5 words/sec
    return max(1, min(designed, max_dur))


def run_video_pipeline(video_job_id: str, payload: VideoGenerateRequest) -> None:
    """Full video generation pipeline. Runs in a background thread via asyncio.to_thread."""
    try:
        duration = _planned_duration(payload)

        # Product screenshots are ONLY consumed by the FFmpeg composition (VIDEO_COMPOSE) or the
        # --web_product_ids path (HIGGSFIELD_USE_WEB_PRODUCTS) — both gated off by default. When
        # neither is enabled, scraping the company site (a ~1-2 min Higgsfield webproducts call +
        # Serper) is wasted work AND a confusing silent warm-up before the render starts. Skip it so
        # the render (and credit usage) begins within seconds of claiming the job.
        web_product_id, screenshot_urls, serper_paths = "", [], []  # type: ignore[var-annotated]
        want_products = (
            os.getenv("VIDEO_COMPOSE", "false").lower() == "true"
            or os.getenv("HIGGSFIELD_USE_WEB_PRODUCTS", "false").lower() == "true"
        )
        if want_products:
            company_url = _get_company_url(payload.job_id)
            web_product_id, screenshot_urls = _fetch_web_product(company_url) if company_url else ("", [])
            if not screenshot_urls:  # Serper fallback if webproducts returned nothing
                try:
                    serper_paths = [_search_and_download_image(payload.image_search_query)]
                except Exception:
                    pass

        # Generate avatar talking-head video
        _update_status(video_job_id, "generating_avatar")
        avatar_url = _generate_avatar_video(
            script=payload.script,
            duration=duration,
            web_product_id=web_product_id,
            setting_id=_get_setting_id(payload.company_type),
        )

        # FFmpeg split-screen composition uploads a composed file (often >50 MB) to the Supabase
        # 'videos' bucket, which exceeds the free-tier per-file size limit, so the upload fails.
        # Off by default: the pipeline uses the Higgsfield-hosted talking-head URL directly —
        # free, no size cap, nothing to store. Set VIDEO_COMPOSE=true to re-enable the product
        # overlay (and raise the bucket's file-size limit in the Supabase dashboard first).
        final_url = avatar_url
        first_screenshot_url = screenshot_urls[0] if screenshot_urls else ""
        try:
            if os.getenv("VIDEO_COMPOSE", "false").lower() != "true":
                raise RuntimeError("composition disabled (VIDEO_COMPOSE != true)")
            _update_status(video_job_id, "composing")

            avatar_tmp   = f"/tmp/avatar_{video_job_id}.mp4"
            composed_tmp = f"/tmp/composed_{video_job_id}.mp4"
            product_tmp  = f"/tmp/product_{video_job_id}.mp4"

            # Collect up to 2 screenshot paths (webproducts URLs → /tmp, or pre-downloaded Serper paths)
            shot_paths: list[str] = []
            if screenshot_urls:
                for i, url in enumerate(screenshot_urls[:2]):
                    p = f"/tmp/shot{i}_{video_job_id}.jpg"
                    _download_file(url, p)
                    shot_paths.append(p)
            else:
                shot_paths = serper_paths[:2]

            if shot_paths:
                _download_file(avatar_url, avatar_tmp)
                _build_product_section(shot_paths, duration, product_tmp)
                _compose_split_screen(product_tmp, avatar_tmp, composed_tmp, duration)
                final_url = _upload_to_storage(composed_tmp, f"{video_job_id}_final.mp4")

        except Exception:
            pass  # silent fallback — final_url stays as avatar_url

        _update_video_job(video_job_id, {
            "status": "completed",
            "avatar_video_url": avatar_url,
            "broll_video_url": first_screenshot_url or None,
            "final_video_url": final_url,
        })

    except Exception as exc:
        logger.exception("video pipeline failed for job %s: %s", video_job_id, exc)
        _update_video_job(video_job_id, {
            "status": "error",
            "error_text": str(exc),
        })


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/api/v1/video/generate", status_code=202)
async def generate_video(
    payload: VideoGenerateRequest,
    background_tasks: BackgroundTasks,
) -> JSONResponse:
    """Phase B — enqueue async video generation. Returns video_job_id for polling.

    USE_VIDEO_WORKER=true (production/Render): only enqueue a 'pending' video_jobs row; a separate
    worker (backend/scripts/video_worker.py) running where the Higgsfield CLI is authenticated picks
    it up and renders. The web host (Render) can't run the CLI (ephemeral FS + rotating OAuth), so it
    must NOT render inline there.
    USE_VIDEO_WORKER unset/false (local default): render inline in this process — handy for local dev.
    """
    video_job_id = str(uuid.uuid4())
    await asyncio.to_thread(_create_video_job, video_job_id, payload.job_id, payload)
    if os.getenv("USE_VIDEO_WORKER", "false").lower() != "true":
        background_tasks.add_task(asyncio.to_thread, run_video_pipeline, video_job_id, payload)
    return JSONResponse({"video_job_id": video_job_id, "status": "pending"}, status_code=202)


@router.get("/api/v1/video/by-analysis/{analysis_job_id}")
async def get_video_by_analysis(analysis_job_id: str) -> JSONResponse:
    """Return the most recent completed video job, falling back to most recent of any status. 404 if none exists."""
    def _query():
        completed = _supabase.table("video_jobs") \
            .select("id, status, avatar_video_url, broll_video_url, final_video_url, virality_score, error_text") \
            .eq("analysis_job_id", analysis_job_id) \
            .eq("status", "completed") \
            .order("created_at", desc=True) \
            .limit(1) \
            .execute()
        if completed.data:
            return completed
        return _supabase.table("video_jobs") \
            .select("id, status, avatar_video_url, broll_video_url, final_video_url, virality_score, error_text") \
            .eq("analysis_job_id", analysis_job_id) \
            .order("created_at", desc=True) \
            .limit(1) \
            .execute()

    row = await asyncio.to_thread(_query)
    if not row.data:
        raise HTTPException(status_code=404, detail="No video job found")
    return JSONResponse(row.data[0])


@router.get("/api/v1/video/history/{analysis_job_id}")
async def get_video_history(analysis_job_id: str) -> JSONResponse:
    """Return all completed video jobs for an analysis, newest first."""
    def _query():
        return _supabase.table("video_jobs") \
            .select("id, status, avatar_video_url, final_video_url, script, created_at") \
            .eq("analysis_job_id", analysis_job_id) \
            .eq("status", "completed") \
            .order("created_at", desc=True) \
            .execute()
    rows = await asyncio.to_thread(_query)
    return JSONResponse(rows.data or [])


@router.get("/api/v1/video/{video_job_id}")
async def get_video_status(video_job_id: str) -> JSONResponse:
    """Poll video generation status. Returns status, URLs, and virality score when done."""
    def _query():
        return _supabase.table("video_jobs") \
            .select("status, avatar_video_url, broll_video_url, final_video_url, virality_score, error_text") \
            .eq("id", video_job_id) \
            .single() \
            .execute()

    try:
        row = await asyncio.to_thread(_query)
    except Exception:
        raise HTTPException(status_code=404, detail="Video job not found")

    if not row.data:
        raise HTTPException(status_code=404, detail="Video job not found")

    return JSONResponse(row.data)
