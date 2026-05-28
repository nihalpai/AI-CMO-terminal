# Global Project Constitution: AI Marketing Agent (Backend Optimization Phase)

This project uses a headless, decoupled architecture: a Next.js frontend and a Python FastAPI backend.

## 1. Core Directives & Anti-Assumptions
- **Frontend is Locked:** Do NOT modify, read, or suggest changes to the Next.js frontend, React components, or Tailwind styles.
- **Strict Scope:** We are optimizing the FastAPI backend. Only modify the specific Python routes and database queries requested.
- **No Pipeline Alterations:** Do NOT change the Lyzr AI pipeline prompts, Firecrawl implementation, or the structure of the JSON payload.

## 2. Tech Stack & Execution
- **Backend:** Python FastAPI. All endpoints must be async (`async def`). Dev server: `uvicorn main:app --reload` (Port 8000).
- **Database:** Supabase (PostgreSQL). Use the official `supabase` Python client.
- **Token Optimization:** Strictly respect `.cursorignore` to avoid scanning `node_modules`, `.next`, or `.venv`.

## 3. Security Non-Negotiables
- **Denial of Wallet:** Do not bypass the existing `slowapi` rate limits. 
- **Timezone Safety:** When comparing timestamps in PostgreSQL (`timestamptz`), ensure Python `datetime` objects are timezone-aware (e.g., using `datetime.now(timezone.utc)`).

## 4. The Native Workflow
- **ALWAYS use Plan Mode first:** Do not write code immediately. Enter Plan Mode, read the `main.py` routing logic, and draft an implementation plan.
- Wait for my approval before executing the plan.