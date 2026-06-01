"""
Hiring signal extraction.

Strategy (in priority order):
  USE_MOCK_APIFY=true  → dynamic mock data keyed to actual competitor names
  USE_MOCK_APIFY=false → ATS job boards (Greenhouse/Lever/Ashby) via Serper + Firecrawl
                         + company growth signals via Serper news search

Why ATS boards instead of LinkedIn:
  LinkedIn blocks all scraping tools (Firecrawl, Playwright, etc.).
  Public ATS systems like Greenhouse, Lever, and Ashby are openly accessible
  and return full job descriptions that Firecrawl can scrape cleanly.
"""
import os
import re

import requests
from dotenv import load_dotenv

load_dotenv(override=True)

SERPER_API_KEY = os.getenv("SERPER_API_KEY", "")
FIRECRAWL_API_KEY = os.getenv("FIRECRAWL_API_KEY", "")

# ATS domains that are publicly accessible (no login required)
_ATS_DOMAINS = [
    "greenhouse.io",
    "boards.greenhouse.io",
    "lever.co",
    "jobs.ashbyhq.com",
    "ashbyhq.com",
]


# ── Public entry point ────────────────────────────────────────────────────────

def fetch_linkedin_signals(competitor_names: list[str]) -> dict:
    use_mock = os.getenv("USE_MOCK_APIFY", "true").lower() == "true"
    print(
        f"[hiring_scraper] USE_MOCK_APIFY={os.getenv('USE_MOCK_APIFY')} "
        f"→ routing to {'MOCK' if use_mock else 'LIVE (ATS Boards + Serper)'}"
    )
    if use_mock:
        return _load_mock(competitor_names)
    return _live_scrape(competitor_names)


# ── Mock (dynamic — uses actual competitor names) ─────────────────────────────

def _load_mock(competitor_names: list[str]) -> dict:
    """Generate plausible mock hiring signals keyed to the actual discovered competitors."""
    job_templates = [
        ("Senior Software Engineer", "Remote", "2 weeks ago",
         "Building core product infrastructure and scaling platform reliability."),
        ("Head of Marketing", "San Francisco, CA", "1 week ago",
         "Leading demand generation, brand strategy, and growth initiatives."),
        ("Enterprise Account Executive", "New York, NY", "3 days ago",
         "Closing enterprise deals with Fortune 500 companies in target verticals."),
        ("Director of Product", "Austin, TX", "5 days ago",
         "Defining product roadmap and driving feature prioritisation across teams."),
        ("VP of Customer Success", "Chicago, IL", "1 week ago",
         "Scaling post-sales operations and improving net revenue retention."),
    ]
    post_templates = [
        "We just crossed a major product milestone and could not have done it without our incredible team.",
        "Thrilled to welcome several enterprise customers who chose us this quarter — growth is accelerating.",
        "We are doubling down on our platform strategy and hiring across engineering and go-to-market.",
        "Our latest integration launch has been a huge hit with customers — check out what they are saying.",
        "Big news: we just raised our next round to accelerate product development and market expansion.",
    ]

    competitors = []
    for i, name in enumerate(competitor_names[:3]):
        j1, j2 = (i * 2) % len(job_templates), (i * 2 + 1) % len(job_templates)
        competitors.append({
            "name": name,
            "job_posts": [
                {
                    "title": job_templates[j1][0],
                    "location": job_templates[j1][1],
                    "posted_date": job_templates[j1][2],
                    "description_snippet": f"{name} — {job_templates[j1][3]}",
                },
                {
                    "title": job_templates[j2][0],
                    "location": job_templates[j2][1],
                    "posted_date": job_templates[j2][2],
                    "description_snippet": f"{name} — {job_templates[j2][3]}",
                },
            ],
            "social_posts": [
                {
                    "posted_date": "1 week ago",
                    "text": f"{name}: {post_templates[i % len(post_templates)]}",
                    "likes": 120 + (i * 45),
                    "comments": 18 + (i * 7),
                }
            ],
        })

    return {"competitors": competitors}


# ── Live: ATS Boards (Greenhouse/Lever/Ashby) + Serper ───────────────────────

def _live_scrape(competitor_names: list[str]) -> dict:
    """
    For each competitor:
      1. Serper: find ATS job board pages (Greenhouse/Lever/Ashby) for this company
      2. Firecrawl: scrape up to 2 ATS pages → extract full job title, location, description
      3. Serper: find recent company growth/funding/news signals
    """
    from firecrawl import FirecrawlApp
    fc = FirecrawlApp(api_key=FIRECRAWL_API_KEY)

    results: list[dict] = []

    for name in competitor_names[:3]:
        jobs = _scrape_ats_jobs(name, fc)
        posts = _fetch_growth_signals(name)
        results.append({"name": name, "job_posts": jobs, "social_posts": posts})

    return {"competitors": results}


def _serper_search(query: str, num: int = 5) -> list[dict]:
    """Fire a Serper organic search and return results."""
    try:
        resp = requests.post(
            "https://google.serper.dev/search",
            headers={"X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json"},
            json={"q": query, "num": num},
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json().get("organic", [])
    except Exception as e:
        print(f"[hiring_scraper] Serper error: {e}")
        return []


def _scrape_ats_jobs(company_name: str, fc) -> list[dict]:
    """
    Search for the company's open roles on public ATS boards (Greenhouse, Lever, Ashby),
    then Firecrawl-scrape the individual job pages for full descriptions.
    Falls back to Serper snippets from a general hiring search.
    """
    # Step 1: Search for ATS board job pages via Serper
    query = (
        f'"{company_name}" site:greenhouse.io OR site:lever.co '
        f'OR site:jobs.ashbyhq.com OR site:boards.greenhouse.io'
    )
    organic = _serper_search(query, num=8)

    # Filter to ATS URLs only
    ats_urls = [
        r["link"] for r in organic
        if any(d in r.get("link", "") for d in _ATS_DOMAINS)
    ][:2]

    jobs: list[dict] = []

    # Step 2: Firecrawl-scrape each ATS page (these are publicly accessible)
    for url in ats_urls:
        try:
            result = fc.scrape(url, formats=["markdown"])
            md = result.markdown or ""

            title = _extract_title(md) or "Open role at " + company_name
            location = _extract_location(md) or "See posting"
            snippet = _extract_snippet(md)

            jobs.append({
                "title": title,
                "location": location,
                "posted_date": "recent",
                "description_snippet": snippet,
            })
            print(f"[hiring_scraper] Scraped ATS job: {title} @ {company_name}")
        except Exception as e:
            print(f"[hiring_scraper] ATS scrape error for {url}: {e}")
            # Use the Serper snippet for this result as fallback
            for r in organic[:1]:
                if any(d in r.get("link", "") for d in _ATS_DOMAINS):
                    title = re.sub(
                        r"\s*[\|·-]\s*(LinkedIn|Greenhouse|Lever|Ashby).*$",
                        "", r.get("title", f"Role at {company_name}")
                    ).strip()
                    jobs.append({
                        "title": title,
                        "location": "See posting",
                        "posted_date": "recent",
                        "description_snippet": r.get("snippet", "")[:300],
                    })

    # Step 3: Serper-snippet fallback if no ATS pages were found at all
    if not jobs:
        fallback = _serper_search(
            f'"{company_name}" engineer OR marketing OR sales hiring 2025 2026',
            num=4,
        )
        for r in fallback[:2]:
            title = re.sub(
                r"\s*[\|·-]\s*(LinkedIn|Greenhouse|Lever|Ashby|Indeed|Glassdoor).*$",
                "", r.get("title", f"Role at {company_name}")
            ).strip()
            snippet = r.get("snippet", "")[:300]
            if title:
                jobs.append({
                    "title": title,
                    "location": "See posting",
                    "posted_date": "recent",
                    "description_snippet": snippet,
                })

    return jobs


def _fetch_growth_signals(company_name: str) -> list[dict]:
    """Find company growth / momentum signals via news and announcement search."""
    query = (
        f'"{company_name}" funding OR "{company_name}" expands team '
        f'OR "{company_name}" launch OR "{company_name}" partnership 2025 2026'
    )
    organic = _serper_search(query, num=4)

    posts: list[dict] = []
    for r in organic[:2]:
        text = r.get("snippet") or r.get("title", "")
        if not text:
            continue
        posts.append({
            "posted_date": "recent",
            "text": f"{company_name}: {text[:500]}",
            "likes": 0,
            "comments": 0,
        })

    return posts


# ── Markdown extraction helpers ───────────────────────────────────────────────

def _extract_title(md: str) -> str:
    """Pull the first H1 or H2 from scraped markdown — usually the job title."""
    for line in md.splitlines():
        line = line.strip()
        if line.startswith("# "):
            return line[2:].strip()
        if line.startswith("## "):
            return line[3:].strip()
    return ""


def _extract_location(md: str) -> str:
    """Try to find a location line near the top of the page."""
    lines = md.splitlines()[:40]
    for line in lines:
        line = line.strip()
        if re.search(
            r"\b(Remote|Hybrid|On.site|San Francisco|New York|Austin|Seattle|"
            r"Boston|London|Chicago|Los Angeles|Denver|Atlanta|Toronto)\b",
            line, re.I,
        ):
            if len(line) < 80 and not line.startswith("#"):
                return line
    return ""


def _extract_snippet(md: str) -> str:
    """Return the first substantive paragraph from the job description."""
    paragraphs = [p.strip() for p in md.split("\n\n") if p.strip()]
    for para in paragraphs:
        if not para.startswith("#") and len(para) > 60:
            return para[:400]
    return md[:400] if md else ""
