"""CMO Chat Agent — conversational AI CMO powered by Lyzr Automata."""
import json
import os

from dotenv import load_dotenv
from lyzr_automata import Agent, Task
from lyzr_automata.ai_models.openai import OpenAIModel
from lyzr_automata.pipelines.linear_sync_pipeline import LinearSyncPipeline
from lyzr_automata.tasks.task_literals import InputType, OutputType

load_dotenv()

os.environ.setdefault("OPENAI_API_KEY", os.environ.get("GEMINI_API_KEY", ""))
os.environ.setdefault("OPENAI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai/")

_chat_model = OpenAIModel(
    api_key=os.environ["OPENAI_API_KEY"],
    parameters={
        "model": "gemini-2.5-flash-lite",
        "temperature": 0.6,
        "max_tokens": 1000,
    },
)

_cmo_agent = Agent(
    prompt_persona=(
        "You are an AI CMO (Chief Marketing Officer). You have deep expertise in GTM strategy, "
        "content marketing, SEO, paid acquisition, community building, and competitive positioning. "
        "You speak directly and practically — no fluff. You help startup founders execute on "
        "marketing opportunities. When given a competitive analysis report, you answer questions "
        "about it and help draft executional assets (emails, blog posts, ad copy, Reddit replies, etc.). "
        "Keep responses concise and actionable. Max 3 paragraphs unless asked to write copy."
    ),
    role="AI CMO",
)


def get_cmo_reply(message: str, report_context: dict) -> str:
    """Get a reply from the AI CMO given a user message and report context."""
    context_str = json.dumps(report_context, indent=2)[:3000]  # cap context to 3k chars

    task = Task(
        name="CMO Chat",
        model=_chat_model,
        agent=_cmo_agent,
        instructions=(
            f"## COMPETITIVE ANALYSIS REPORT CONTEXT\n```json\n{context_str}\n```\n\n"
            "## USER MESSAGE\n{input}\n\n"
            "Respond as the AI CMO. Be direct and actionable."
        ),
        default_input=message,
        input_type=InputType.TEXT,
        output_type=OutputType.TEXT,
    )

    pipeline = LinearSyncPipeline(
        name="CMO Chat",
        completion_message="Reply generated.",
        tasks=[task],
    )

    raw = pipeline.run()
    if isinstance(raw, list) and raw:
        last = raw[-1]
        return last.get("task_output", str(last)) if isinstance(last, dict) else str(last)
    return str(raw)
