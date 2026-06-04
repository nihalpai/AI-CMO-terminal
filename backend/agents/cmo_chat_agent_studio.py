"""CMO Chat Agent — powered by Lyzr Studio (USE_LYZR_STUDIO=true)."""
import json
import os


def get_cmo_reply(message: str, report_context: dict, session_id: str) -> str:
    from lyzr_studio_pipeline import call_agent_text
    return call_agent_text(
        agent_id=os.getenv("LYZR_AGENT_CMO_CHAT"),
        message={
            "report": json.dumps(report_context)[:3000],
            "message": message
        },
        session_id=session_id  # job_id ties memory to this analysis session
    )
