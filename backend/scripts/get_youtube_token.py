"""One-time helper — mint a long-lived YouTube refresh token.

Run this LOCALLY, once, signed into the dedicated YouTube channel's Google account.
It opens a browser, you grant the youtube.upload scope (clicking through the
"unverified app" warning), and it prints the refresh token to paste into
backend/.env AND the Render dashboard as YOUTUBE_REFRESH_TOKEN.

Prereqs (in env or backend/.env):
  YOUTUBE_CLIENT_ID
  YOUTUBE_CLIENT_SECRET

The OAuth consent screen MUST be published "In production" (not Testing) so the
refresh token is long-lived — Testing-mode refresh tokens expire after 7 days.

Usage:
  python backend/scripts/get_youtube_token.py
"""
import os
import sys

from dotenv import load_dotenv

# Load backend/.env regardless of where this is invoked from.
_HERE = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(_HERE, "..", ".env"))

SCOPES = ["https://www.googleapis.com/auth/youtube.upload"]


def main() -> None:
    try:
        from google_auth_oauthlib.flow import InstalledAppFlow
    except ImportError:
        sys.exit("Missing deps. Run: pip install -r backend/requirements.txt")

    client_id = os.getenv("YOUTUBE_CLIENT_ID")
    client_secret = os.getenv("YOUTUBE_CLIENT_SECRET")
    if not client_id or not client_secret:
        sys.exit("Set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET in backend/.env first.")

    client_config = {
        "installed": {
            "client_id": client_id,
            "client_secret": client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": ["http://localhost"],
        }
    }

    flow = InstalledAppFlow.from_client_config(client_config, scopes=SCOPES)
    # access_type=offline + prompt=consent guarantees a refresh_token is returned.
    creds = flow.run_local_server(port=0, access_type="offline", prompt="consent")

    if not creds.refresh_token:
        sys.exit("No refresh token returned. Re-run; ensure you pick the dedicated account.")

    print("\n" + "=" * 60)
    print("Copy this line into backend/.env AND the Render dashboard:")
    print("=" * 60)
    print(f"YOUTUBE_REFRESH_TOKEN={creds.refresh_token}")
    print("=" * 60)


if __name__ == "__main__":
    main()
