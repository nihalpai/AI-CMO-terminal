"""Standalone Higgsfield diagnostic probe — runs OUTSIDE the FastAPI pipeline.

Purpose: isolate whether UGC-video failures come from THIS project's pipeline or from
Higgsfield/the account, and map the reliable duration ceiling for marketing_studio_video.

It mirrors the EXACT CLI invocation that backend/routers/video.py:_generate_avatar_video
builds (same args at video.py:304-342, same flags with underscores), but deliberately omits
--avatars / --setting_id / --web_product_ids (all gated off in production) so a probe result
transfers 1:1 to what the pipeline actually sends.

No FastAPI, no Supabase — subprocess + stdlib + httpx only.

Examples:
    # FREE — no job created, no credits spent (validates params/auth):
    python backend/scripts/higgsfield_probe.py --cost-only --duration 15

    # One real generation (COSTS credits ~5/sec; refunded on failure):
    python backend/scripts/higgsfield_probe.py --duration 8
    python backend/scripts/higgsfield_probe.py --duration 15

    # Sweep several durations and print a ceiling table:
    python backend/scripts/higgsfield_probe.py --sweep 8,15
"""
import argparse
import json
import subprocess
import time

try:
    import httpx
except ImportError:  # httpx is in backend/requirements.txt; HEAD check is optional
    httpx = None

# The proven 35-word script that failed at duration 17 but completed at duration 8.
DEFAULT_SCRIPT = (
    "Stop betting your startup on Firebase—here's what's really costing you. Vendor lock-in "
    "silently kills your margins. Supabase gives you PostgreSQL, open-source infrastructure, and "
    "forecastable costs. No surprise bills. No rebuilds. Scale your way. Start free."
)


def run_cli(args: list[str], timeout: int = 600) -> dict:
    """Run `higgsfield <args>`; return raw result. Never raises on status:failed."""
    cmd = ["higgsfield"] + args
    t0 = time.monotonic()
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        rc, out, err = p.returncode, p.stdout, p.stderr
    except subprocess.TimeoutExpired as exc:
        rc, out, err = -1, exc.stdout or "", f"TIMEOUT after {timeout}s"
    wall = round(time.monotonic() - t0, 1)
    parsed = None
    try:
        parsed = json.loads(out)
    except Exception:
        pass
    return {
        "cmd": "higgsfield " + " ".join(args),
        "returncode": rc,
        "stdout": out,
        "stderr": (err or "").strip(),
        "parsed": parsed,
        "wall_s": wall,
    }


def _as_obj(parsed):
    if isinstance(parsed, list):
        return parsed[0] if parsed else {}
    return parsed or {}


def extract_status(parsed) -> str:
    return _as_obj(parsed).get("status", "unknown")


def extract_url(parsed) -> str:
    """Mirror of video.py:_extract_video_url key chain."""
    o = _as_obj(parsed)
    if o.get("status") == "failed":
        return ""
    return (
        o.get("result_url")
        or o.get("url")
        or o.get("video_url")
        or o.get("output_url")
        or (o.get("outputs") or [{}])[0].get("url", "")
        or ""
    )


def account_status() -> str:
    """Return the raw `higgsfield account status` line (credits)."""
    try:
        p = subprocess.run(
            ["higgsfield", "account", "status"], capture_output=True, text=True, timeout=30
        )
        return (p.stdout or p.stderr).strip()
    except Exception as exc:
        return f"(account status failed: {exc})"


def head_check(url: str) -> tuple:
    """HTTP HEAD the result URL. Returns (ok, status_code) or (None, None)."""
    if not url or httpx is None:
        return (None, None)
    try:
        r = httpx.head(url, follow_redirects=True, timeout=20.0)
        return (200 <= r.status_code < 400, r.status_code)
    except Exception:
        return (False, None)


def build_create_args(prompt, duration, aspect_ratio, mode, resolution, generate_audio) -> list[str]:
    """The EXACT args the pipeline sends (video.py:304-342), minus the gated-off flags."""
    args = [
        "generate", "create", "marketing_studio_video",
        "--prompt", prompt,
        "--duration", str(duration),
        "--aspect_ratio", aspect_ratio,
        "--mode", mode,
        "--generate_audio", "true" if generate_audio else "false",
        "--wait", "--json",
    ]
    if resolution:
        args += ["--resolution", resolution]
    return args


def build_cost_args(prompt, duration, aspect_ratio, mode, resolution) -> list[str]:
    args = [
        "generate", "cost", "marketing_studio_video",
        "--prompt", prompt,
        "--duration", str(duration),
        "--aspect_ratio", aspect_ratio,
        "--mode", mode,
        "--json",
    ]
    if resolution:
        args += ["--resolution", resolution]
    return args


def cost_only(prompt, duration, timeout, **opts):
    print("=" * 78)
    print(f"COST-ONLY (FREE — no job created, no credits spent) | duration={duration}")
    res = run_cli(build_cost_args(prompt, duration, opts["aspect_ratio"], opts["mode"],
                                  opts.get("resolution")), timeout=min(timeout, 60))
    print("cmd:", res["cmd"])
    print("response:", res["stdout"].strip() or res["stderr"])
    print("=" * 78)


def probe_once(prompt, duration, timeout, **opts) -> dict:
    print("=" * 78)
    print(f"PROBE (COSTS CREDITS ~5/sec, refunded on failure) | duration={duration}")
    cred_before = account_status()
    print("credits before:", cred_before)

    res = run_cli(build_create_args(prompt, duration, opts["aspect_ratio"], opts["mode"],
                                    opts.get("resolution"), opts["generate_audio"]), timeout=timeout)
    cred_after = account_status()
    status = extract_status(res["parsed"])
    url = extract_url(res["parsed"])
    head_ok, head_code = head_check(url)

    print("cmd       :", res["cmd"])
    print("exit       :", res["returncode"], "| wall:", res["wall_s"], "s")
    print("status     :", status)
    print("result_url :", url or "(none)")
    print("head check :", f"{head_code} (ok={head_ok})" if url else "(no url)")
    if res["stderr"]:
        print("stderr     :", res["stderr"][-800:])
    print("credits after:", cred_after)
    print("--- full JSON response ---")
    print(json.dumps(res["parsed"], indent=2) if res["parsed"] is not None else res["stdout"][:2000])
    print("=" * 78)

    return {
        "duration": duration, "status": status, "url": url,
        "head_code": head_code, "wall_s": res["wall_s"],
        "cred_before": cred_before, "cred_after": cred_after,
    }


def sweep(prompt, durations, timeout, **opts):
    rows = [probe_once(prompt, d, timeout, **opts) for d in durations]
    print("\nSWEEP RESULTS")
    print(f"{'DURATION':>8}  {'STATUS':<10}  {'HEAD':<5}  {'WALL(s)':>7}")
    for r in rows:
        print(f"{r['duration']:>8}  {r['status']:<10}  {str(r['head_code'] or '-'):<5}  {r['wall_s']:>7}")
    print("\ncredits before first / after last:")
    print("  before:", rows[0]["cred_before"] if rows else "-")
    print("  after :", rows[-1]["cred_after"] if rows else "-")


def main():
    ap = argparse.ArgumentParser(description="Standalone Higgsfield marketing_studio_video probe.")
    ap.add_argument("--prompt", "--script", dest="prompt", default=DEFAULT_SCRIPT)
    ap.add_argument("--duration", type=int, default=15)
    ap.add_argument("--aspect-ratio", dest="aspect_ratio", default="9:16")
    ap.add_argument("--mode", default="ugc")
    ap.add_argument("--resolution", default=None, choices=["480p", "720p", "1080p"])
    ap.add_argument("--generate-audio", dest="generate_audio", action="store_true", default=True)
    ap.add_argument("--no-generate-audio", dest="generate_audio", action="store_false")
    ap.add_argument("--sweep", default=None, help='comma list of durations, e.g. "8,15"')
    ap.add_argument("--cost-only", dest="cost_only", action="store_true",
                    help="FREE: estimate cost / validate params without generating")
    ap.add_argument("--timeout", type=int, default=600)
    a = ap.parse_args()

    opts = dict(aspect_ratio=a.aspect_ratio, mode=a.mode,
                resolution=a.resolution, generate_audio=a.generate_audio)

    if a.cost_only:
        cost_only(a.prompt, a.duration, a.timeout, **opts)
    elif a.sweep:
        sweep(a.prompt, [int(x) for x in a.sweep.split(",")], a.timeout, **opts)
    else:
        probe_once(a.prompt, a.duration, a.timeout, **opts)


if __name__ == "__main__":
    main()
