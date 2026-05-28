# Global Project Constitution: AI Marketing Agent (Serper Integration Sprint)

This project uses a headless, decoupled architecture: a Next.js frontend and a Python FastAPI backend.

## 1. Core Directives & Anti-Assumptions
- **Frontend is Locked:** Do NOT modify, read, or suggest changes to the Next.js frontend, React components, or Tailwind styles.
- **FastAPI Routing is Locked:** Do NOT modify `main.py` or the polling endpoint structures.
- **Strict Sprint Scope:** We are exclusively building the live competitor discovery mechanism using Serper.dev within `backend/ai_pipeline.py`. 

## 2. Tech Stack & Engineering Constraints
- **Backend Framework:** Python FastAPI.
- **AI Orchestration:** `lyzr-automata` using `gemini-2.5-flash-lite`.
- **Search Engine Layer:** Serper.dev JSON API.
- **Entity Boundary Rule:** The target company URL must never be included in the `competitors` or `white_space_opportunities` arrays. Tasks must dynamically construct f-string exclusions using the requested URL string.

## 3. The Native Workflow
- **ALWAYS use Plan Mode first:** Enter Plan Mode, read `backend/ai_pipeline.py`, design the standalone Serper wrapper, and outline how the search results will be appended to the Researcher Agent's input context. Wait for approval.