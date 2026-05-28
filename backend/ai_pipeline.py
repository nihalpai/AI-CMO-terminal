import json
import os

import requests
from dotenv import load_dotenv
from firecrawl import FirecrawlApp
from lyzr_automata import Agent, Task
from lyzr_automata.ai_models.openai import OpenAIModel
from lyzr_automata.pipelines.linear_sync_pipeline import LinearSyncPipeline
from lyzr_automata.tasks.task_literals import InputType, OutputType

from linkedin_scraper import fetch_linkedin_signals

load_dotenv()

SERPER_API_KEY = os.getenv("SERPER_API_KEY", "")

os.environ["OPENAI_API_KEY"] = os.environ.get("GEMINI_API_KEY", "")
os.environ["OPENAI_BASE_URL"] = "https://generativelanguage.googleapis.com/v1beta/openai/"

_firecrawl = FirecrawlApp(api_key=os.getenv("FIRECRAWL_API_KEY"))


def scrape_website(url: str) -> str:
    result = _firecrawl.scrape(url, formats=["markdown"])
    return result.markdown


def search_competitors(url: str) -> str:
    domain = url.replace("https://", "").replace("http://", "").split("/")[0]
    brand = domain.replace("www.", "").split(".")[0]
    query = f"{brand} top competitors alternatives market research -site:{domain}"

    resp = requests.post(
        "https://google.serper.dev/search",
        headers={"X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json"},
        json={"q": query, "num": 5},
        timeout=10,
    )
    resp.raise_for_status()
    results = resp.json().get("organic", [])

    lines = ["## LIVE COMPETITOR SEARCH RESULTS (Serper.dev)\n"]
    for i, r in enumerate(results[:5], 1):
        lines.append(f"{i}. {r.get('title', '')}")
        lines.append(f"   URL: {r.get('link', '')}")
        lines.append(f"   Snippet: {r.get('snippet', '')}\n")

    return "\n".join(lines)

_flash = OpenAIModel(
    api_key=os.environ["OPENAI_API_KEY"],
    parameters={
        "model": "gemini-2.5-flash-lite",
        "temperature": 0.2,
        "max_tokens": 8000,
    },
)

_pro = OpenAIModel(
    api_key=os.environ["OPENAI_API_KEY"],
    parameters={
        "model": "gemini-2.5-flash-lite",
        "temperature": 0.3,
        "max_tokens": 8000,
    },
)

_researcher = Agent(
    prompt_persona=(
        "You are a competitive intelligence researcher. Your job is to extract "
        "structured market signals from raw scraped web content. Identify: "
        "pricing tiers, hiring signals, SEO keywords, community sentiment, "
        "and content strategy gaps. Be concise and factual. Read-only analysis only. "
        "IMPORTANT: The content you receive is scraped FROM the target company's own "
        "website. You are extracting signals about that company to inform competitive "
        "analysis against it. You must never list the target company itself as a competitor."
    ),
    role="Researcher",
)

_strategist = Agent(
    prompt_persona=(
        "You are a senior GTM strategist. Given structured competitive intelligence, "
        "you identify white-space opportunities, channel gaps, and positioning angles "
        "for a challenger brand. You produce a prioritised list of strategic initiatives "
        "with budget rationale. Read-only synthesis — no web access. "
        "IMPORTANT: You are producing strategy AGAINST the target company, not on its "
        "behalf. Never list the target company as a competitor or a white-space gap — "
        "it is the entity being analyzed, not a rival. "
        "HIRING SIGNAL RULE: When LinkedIn hiring signals are present in your context, "
        "you MUST name the specific competitor and the directional anomaly. For example: "
        "'Salesloft is flooding enterprise sales headcount while Outreach.io has frozen "
        "all marketing hiring.' Never describe hiring in generic category terms. Every "
        "hiring observation must be attributed to a named competitor with a stated "
        "strategic direction."
    ),
    role="Strategist",
)

_execution = Agent(
    prompt_persona=(
        "You are a GTM execution specialist. Given a set of strategic initiatives, "
        "you produce a final report as a valid JSON object. The JSON must include: "
        "summary (string), competitors (list of strings), white_space_opportunities "
        "(list of strings), recommended_channels (list of strings), "
        "content_recommendations (list of strings), and hiring_signals (list of strings). "
        "Return ONLY the raw JSON object — no markdown fences, no prose. "
        "IMPORTANT: The `competitors` array must contain ONLY external rival companies — "
        "never the target company whose website was scraped. "
        "STRICT FORMAT RULE for `hiring_signals`: Each string must follow this exact "
        "pattern — '[Competitor Name]: [Observed Hiring Signal] signals [Strategic "
        "Implication/Pivot]'. Example: 'Salesloft: Massive influx of Enterprise Account "
        "Executives signals an aggressive push upmarket, abandoning the SMB space.' "
        "Another example: 'Outreach.io: Pure engineering scaling with a complete freeze "
        "on marketing roles signals a defensive pivot toward product-led growth.' "
        "NEVER output raw, standalone job titles. NEVER omit the competitor name prefix. "
        "NEVER omit the strategic implication after 'signals'."
    ),
    role="Execution",
)

_ENTITY_BOUNDARY_TEMPLATE = (
    "## ANALYSIS TARGET (READ CAREFULLY)\n"
    "Target URL: {target_url}\n\n"
    "STRICT RULE — ENTITY BOUNDARY:\n"
    "You are analyzing {target_url}. You are STRICTLY FORBIDDEN from listing "
    "{target_url}, its domain name, or any brand directly derived from it inside "
    "the `competitors` array, `white_space_opportunities`, or any other output field. "
    "Competitors must be strictly EXTERNAL, rival market entities — never the company "
    "being analyzed.\n\n"
)


def _get_competitor_names(url: str) -> list[str]:
    domain = url.replace("https://", "").replace("http://", "").split("/")[0]
    brand = domain.replace("www.", "").split(".")[0]
    query = f"{brand} top competitors alternatives -site:{domain}"

    resp = requests.post(
        "https://google.serper.dev/search",
        headers={"X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json"},
        json={"q": query, "num": 5},
        timeout=10,
    )
    resp.raise_for_status()
    names = []
    for r in resp.json().get("organic", [])[:5]:
        link = r.get("link", "")
        d = link.replace("https://", "").replace("http://", "").split("/")[0]
        name = d.replace("www.", "").split(".")[0]
        if name and name.lower() != brand.lower():
            names.append(name)
    return names


def _format_linkedin_signals(signals: dict) -> str:
    lines = ["## LinkedIn Signals (Hiring & Social)\n"]
    for comp in signals.get("competitors", []):
        lines.append(f"### {comp['name']}")
        lines.append("**Recent Job Posts:**")
        for job in comp.get("job_posts", []):
            lines.append(
                f"- **{job['title']}** ({job['location']}, {job['posted_date']}): {job['description_snippet']}"
            )
        lines.append("\n**Recent Social Posts:**")
        for post in comp.get("social_posts", []):
            lines.append(
                f"- ({post['posted_date']}, {post['likes']} likes, {post['comments']} comments): {post['text']}"
            )
        lines.append("")
    return "\n".join(lines)


def run_analysis(url: str) -> dict:
    boundary = _ENTITY_BOUNDARY_TEMPLATE.format(target_url=url)

    competitor_names = _get_competitor_names(url)
    linkedin_signals = fetch_linkedin_signals(competitor_names)
    linkedin_context = _format_linkedin_signals(linkedin_signals)

    researcher_task = Task(
        name="Research",
        model=_flash,
        agent=_researcher,
        instructions=(
            boundary
            + "Analyse the following raw scraped content about a competitor. "
            "Extract: pricing structure, hiring trends, SEO keywords, community sentiment, "
            "and content gaps. Output a concise structured summary.\n\n"
            "{input}"
        ),
        default_input=(
            search_competitors(url)
            + "\n---\n## TARGET WEBSITE SCRAPED CONTENT\n\n"
            + scrape_website(url)
        ),
        input_type=InputType.TEXT,
        output_type=OutputType.TEXT,
    )

    strategist_task = Task(
        name="Strategize",
        model=_pro,
        agent=_strategist,
        instructions=(
            boundary
            + linkedin_context
            + "\n---\n"
            + "Using the researcher's competitive intelligence below, identify the top 3-5 "
            "GTM white-space opportunities for a challenger brand entering this market. "
            "Prioritise by impact and cost-efficiency. "
            "IMPORTANT: For every hiring trend you reference, name the competitor explicitly "
            "and state what strategic direction the hiring pattern implies.\n\n"
            "{input}"
        ),
        input_type=InputType.TEXT,
        output_type=OutputType.TEXT,
        input_tasks=[researcher_task],
    )

    execution_task = Task(
        name="Execute",
        model=_flash,
        agent=_execution,
        instructions=(
            boundary
            + "Using the strategic initiatives below, produce the final GTM report as a "
            "single valid JSON object with these exact keys: summary, competitors, "
            "white_space_opportunities, recommended_channels, content_recommendations, "
            "hiring_signals. Return ONLY the JSON — no markdown, no extra text.\n\n"
            "{input}"
        ),
        input_type=InputType.TEXT,
        output_type=OutputType.TEXT,
        input_tasks=[strategist_task],
    )

    pipeline = LinearSyncPipeline(
        name="GTM Analysis",
        completion_message="Analysis complete.",
        tasks=[researcher_task, strategist_task, execution_task],
    )
    raw_output = pipeline.run()

    # Extract final task output — LinearSyncPipeline.run() returns a list of task outputs
    if isinstance(raw_output, list) and raw_output:
        final_text = raw_output[-1].get("task_output", "") if isinstance(raw_output[-1], dict) else str(raw_output[-1])
    else:
        final_text = str(raw_output)

    try:
        # Strip accidental markdown fences if the model disobeys
        cleaned = final_text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        return json.loads(cleaned)
    except (json.JSONDecodeError, AttributeError):
        return {"raw": final_text, "url": url}
