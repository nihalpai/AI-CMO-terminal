"""Video render worker — runs OUTSIDE the web server, where the Higgsfield CLI is authenticated.

Production architecture (zero-cost): the Render web service only ENQUEUES jobs (inserts a 'pending'
row in the video_jobs Supabase table when USE_VIDEO_WORKER=true). This worker polls that table,
atomically claims pending jobs, and renders them by reusing the exact pipeline in
backend/routers/video.py. Render can't run the CLI (ephemeral FS + rotating OAuth); this worker can,
because it runs on a machine where `higgsfield auth login` has been done (your Mac now, a free
always-on VM later — identical code).

Requirements on the host running this:
  - the project's backend/.env (Supabase SERVICE-ROLE key + LYZR/SERPER vars), and
  - an authenticated `higgsfield` CLI on PATH.

Run from anywhere:
    python backend/scripts/video_worker.py
or from backend/:
    .venv/bin/python -m scripts.video_worker

Env (all optional):
  VIDEO_WORKER_POLL_SECONDS   idle poll interval (default 10)
  VIDEO_WORKER_STALE_MINUTES  reclaim jobs stuck in 'processing' older than this (default 20)
"""
import logging
import os
import sys
import time
from datetime import datetime, timedelta, timezone

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

# Make `routers.video` importable and load backend/.env regardless of where this is launched from.
_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

from dotenv import load_dotenv  # noqa: E402

load_dotenv(os.path.join(_BACKEND_DIR, ".env"))

from routers.video import (  # noqa: E402  (must follow sys.path + dotenv setup)
    VideoGenerateRequest,
    _supabase,
    logger,
    run_video_pipeline,
)

POLL_SECONDS = int(os.getenv("VIDEO_WORKER_POLL_SECONDS", "10"))
STALE_MINUTES = int(os.getenv("VIDEO_WORKER_STALE_MINUTES", "30"))

# IMPORTANT: video_jobs.status has a CHECK constraint that ONLY allows the pipeline's own statuses
# (pending, generating_avatar, composing, completed, error). The worker must claim a job using one of
# those — an invented value like "processing" is rejected by the DB (constraint 23514). We claim with
# "generating_avatar" (which run_video_pipeline sets first anyway, so it's both valid and accurate).
_CLAIM_STATUS = "generating_avatar"
# Non-terminal in-progress statuses a crashed worker could leave behind, to be reclaimed to pending.
_IN_PROGRESS_STATUSES = ["generating_avatar", "composing"]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _reclaim_stale_jobs() -> None:
    """Reset jobs stuck mid-render (worker crashed) back to 'pending'.

    Safe because a live worker blocks inside run_video_pipeline (it isn't polling), so it can't
    reclaim its own active job; only genuinely abandoned jobs are older than STALE_MINUTES.
    """
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=STALE_MINUTES)).isoformat()
    try:
        res = (
            _supabase.table("video_jobs")
            .update({"status": "pending", "updated_at": _now_iso()})
            .in_("status", _IN_PROGRESS_STATUSES)
            .lt("updated_at", cutoff)
            .execute()
        )
        if res.data:
            logger.warning("video_worker: reclaimed %d stale in-progress job(s)", len(res.data))
    except Exception as exc:
        logger.warning("video_worker: reclaim check failed: %s", exc)


def _claim_next_job() -> dict | None:
    """Fetch the oldest pending job and atomically claim it. Returns the row, or None if none/lost."""
    rows = (
        _supabase.table("video_jobs")
        .select("*")
        .eq("status", "pending")
        .order("created_at")
        .limit(1)
        .execute()
    )
    if not rows.data:
        return None
    row = rows.data[0]
    # Atomic claim: the update only matches if the row is STILL 'pending', so two workers can't
    # both grab the same job.
    claim = (
        _supabase.table("video_jobs")
        .update({"status": _CLAIM_STATUS, "updated_at": _now_iso()})
        .eq("id", row["id"])
        .eq("status", "pending")
        .execute()
    )
    return row if claim.data else None


def _process(row: dict) -> None:
    job_id = row["id"]
    payload_data = row.get("request_payload")
    if not payload_data:
        # Pre-worker rows (created before the request_payload column existed) can't be rebuilt.
        logger.error("video_worker: job %s has no request_payload — marking error", job_id)
        _supabase.table("video_jobs").update({
            "status": "error",
            "error_text": "worker: missing request_payload (re-generate from the UI)",
            "updated_at": _now_iso(),
        }).eq("id", job_id).execute()
        return
    payload = VideoGenerateRequest(**payload_data)
    logger.info("video_worker: rendering job %s", job_id)
    run_video_pipeline(job_id, payload)  # updates the row to completed/error itself
    logger.info("video_worker: finished job %s", job_id)


def main() -> None:
    logger.info("video_worker: started (poll=%ss, stale-reclaim=%smin)", POLL_SECONDS, STALE_MINUTES)
    while True:
        try:
            _reclaim_stale_jobs()
            row = _claim_next_job()
            if row is None:
                time.sleep(POLL_SECONDS)
                continue
            _process(row)
        except KeyboardInterrupt:
            logger.info("video_worker: shutting down")
            break
        except Exception as exc:  # never let one bad job kill the loop
            logger.exception("video_worker: loop error: %s", exc)
            time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()
