"""Weekly digest email service using Resend."""
import json
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from dotenv import load_dotenv

load_dotenv()


def send_weekly_digest(user_email: str = "user@example.com") -> dict:
    """
    Fetch watchlist items, gather their latest analysis results,
    and send a digest email via Resend.

    Returns: {"status": "sent" | "no_items" | "no_resend_key", "email": user_email}
    """
    resend_key = os.getenv("RESEND_API_KEY", "")
    if not resend_key:
        return {"status": "no_resend_key", "email": user_email}

    try:
        import resend
        from supabase import create_client
        resend.api_key = resend_key
        supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])
    except ImportError:
        return {"status": "resend_not_installed", "email": user_email}

    # Get watchlist items with their latest job results
    watchlist = supabase.table("watchlist").select(
        "*, analysis_jobs!last_job_id(result, created_at)"
    ).eq("user_email", user_email).execute()

    items = watchlist.data or []
    if not items:
        return {"status": "no_items", "email": user_email}

    # Build email body
    sections = []
    for item in items:
        label = item.get("label") or item["competitor_url"]
        job_data = item.get("analysis_jobs") or {}
        result = job_data.get("result") or {}

        if not result:
            sections.append(f"<h3>{label}</h3><p>No analysis data yet.</p>")
            continue

        hiring = result.get("hiring_signals", [])
        wso = result.get("white_space_opportunities", [])
        channels = result.get("recommended_channels", [])

        section_html = f"""
        <h3 style="color:#10b981;margin-bottom:8px;">{label}</h3>
        <p style="color:#94a3b8;font-size:13px;">{result.get('summary', '')[:200]}...</p>
        """

        if hiring:
            section_html += "<p><strong>Hiring Signals:</strong></p><ul>"
            for h in hiring[:2]:
                section_html += f"<li style='color:#cbd5e1;font-size:13px;'>{h}</li>"
            section_html += "</ul>"

        if wso:
            section_html += "<p><strong>Opportunities:</strong></p><ul>"
            for w in wso[:2]:
                section_html += f"<li style='color:#cbd5e1;font-size:13px;'>{w}</li>"
            section_html += "</ul>"

        sections.append(section_html)

    date_str = datetime.now(timezone.utc).strftime("%B %d, %Y")
    body_html = f"""
    <div style="font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;padding:32px;max-width:600px;margin:0 auto;border-radius:12px;">
      <h1 style="color:#10b981;font-size:22px;margin-bottom:4px;">AI CMO Weekly Digest</h1>
      <p style="color:#64748b;font-size:14px;margin-top:0;">{date_str} — {len(items)} competitor{'s' if len(items) != 1 else ''} monitored</p>
      <hr style="border:none;border-top:1px solid #1e293b;margin:24px 0;">
      {'<hr style="border:none;border-top:1px solid #1e293b;margin:20px 0;">'.join(sections)}
      <hr style="border:none;border-top:1px solid #1e293b;margin:24px 0;">
      <p style="color:#475569;font-size:12px;text-align:center;">AI CMO Terminal · Unsubscribe</p>
    </div>
    """

    try:
        resend.Emails.send({
            "from": "AI CMO <digest@yourdomain.com>",
            "to": [user_email],
            "subject": f"AI CMO Weekly Digest — {date_str}",
            "html": body_html,
        })
        return {"status": "sent", "email": user_email, "items_count": len(items)}
    except Exception as e:
        return {"status": "error", "error": str(e), "email": user_email}
