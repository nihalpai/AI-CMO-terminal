import json
import os


def fetch_linkedin_signals(competitor_names: list[str]) -> dict:
    use_mock = os.getenv("USE_MOCK_APIFY", "true").lower() != "false"
    if use_mock:
        return _load_mock()
    return _live_scrape(competitor_names)


def _load_mock() -> dict:
    fixture = os.path.join(os.path.dirname(__file__), "resources", "mock_linkedin_signals.json")
    with open(fixture) as f:
        return json.load(f)


def _live_scrape(competitor_names: list[str]) -> dict:
    from apify_client import ApifyClient

    client = ApifyClient(os.getenv("APIFY_API_TOKEN", ""))
    results: list[dict] = []

    for name in competitor_names[:5]:
        jobs: list[dict] = []
        posts: list[dict] = []

        try:
            jobs_run = client.actor("curious_coder/linkedin-jobs-scraper").call(
                run_input={"companyName": name, "maxResults": 3}
            )
            for item in client.dataset(jobs_run["defaultDatasetId"]).iterate_items():
                jobs.append({
                    "title": item.get("title", ""),
                    "location": item.get("location", ""),
                    "posted_date": item.get("postedDate", ""),
                    "description_snippet": (item.get("description", "") or "")[:300],
                })
        except Exception:
            pass

        try:
            posts_run = client.actor("curious_coder/linkedin-post-search-scraper").call(
                run_input={"searchKeywords": name, "maxResults": 3}
            )
            for item in client.dataset(posts_run["defaultDatasetId"]).iterate_items():
                posts.append({
                    "posted_date": item.get("date", ""),
                    "text": (item.get("text", "") or "")[:500],
                    "likes": item.get("likesCount", 0),
                    "comments": item.get("commentsCount", 0),
                })
        except Exception:
            pass

        results.append({"name": name, "job_posts": jobs, "social_posts": posts})

    return {"competitors": results}
