# Global Project Constitution: AI Marketing Agent (Apify Mocking Sprint)

This project uses a headless architecture: a Next.js frontend and a Python FastAPI backend.

## 1. Core Directives & Anti-Assumptions
- **Frontend is Locked:** Do NOT modify or read the Next.js frontend.
- **FastAPI Routing is Locked:** Do NOT modify `main.py`.
- **Strict Sprint Scope:** We are building the Apify LinkedIn signal extraction layer using a strict Mock/Live toggle framework to protect API credits. 

## 2. Tech Stack & Engineering Constraints
- **Backend Framework:** Python FastAPI.
- **AI Orchestration:** `lyzr-automata` using `gemini-2.5-flash-lite`.
- **Budget Protection Rule:** You are STRICTLY FORBIDDEN from executing live Apify actor runs during development. You must implement and default to a local JSON fixture file.
- **Toggle Mechanism:** Read `USE_MOCK_APIFY` from the `.env` file. If `true`, bypass the API entirely.

## 3. The Native Workflow
- **ALWAYS use Plan Mode first:** Enter Plan Mode, sketch the structure of the mock JSON payload, design the conditional routing logic in your client wrapper, and wait for approval.