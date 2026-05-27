# Global Project Constitution: AI Marketing Agent

This project uses a headless, decoupled architecture: a Next.js (App Router) frontend and a Python FastAPI backend. 

## 1. Core Directives & Anti-Assumptions
- **No Unprompted Refactoring:** Do not add features, clean up surrounding code, or make "improvements" beyond the explicit prompt.
- **Mandatory Verification:** Do not guess naming conventions, database schemas, or architecture patterns. Use the `AskUserQuestion` tool to present options and wait for my approval.
- **Strict Scope:** Only build exactly what is required. Do not invent dummy data or fake API keys.
- **Progressive Disclosure:** For detailed architectural/domain rules, read the files in the `.skills/` directory when touching specific AI agent domains.

## 2. Tech Stack & Execution
- **Frontend:** Next.js (App Router), React, Tailwind CSS, Shadcn UI, React DOM. Dev server: `npm run dev` (Port 3000).
- **Backend:** Python FastAPI, Lyzr Automata SDK (`lyzr-automata`). All endpoints must be async (`async def`). Dev server: `uvicorn main:app --reload` (Port 8000).
- **AI Orchestration:** Programmatically define agents in code via Lyzr Python SDK. Do NOT use Lyzr Studio UI.
- **Database:** Supabase (PostgreSQL). No Vector DB/RAG for Phase 1.
- **Token Optimization:** Strictly respect `.cursorignore` to avoid scanning `node_modules`, `.next`, or `.venv`.

## 3. The Native Workflow (Plan Mode)
- **ALWAYS use Plan Mode first:** Do not write code immediately for new features. Enter Plan Mode, use MCP servers to map dependencies, and draft an implementation plan in your native plan file.
- Wait for my approval before executing the plan.
- Run `/clear` or `/compact` after completing and committing a task. If context is heavily degraded, ask me to run `repomix`.

## 4. Security Non-Negotiables
- **Denial of Wallet:** Do not expose endpoints without rate limits (`@upstash/ratelimit` for frontend, `slowapi` for FastAPI).
- **Insecure Output (XSS):** Treat AI-generated content as untrusted. Sanitize markdown on the frontend using `isomorphic-dompurify`.
- **Prompt Injection:** Use `guardrails-ai` to validate Lyzr agent outputs.
- **Least Privilege:** All AI agent tools must be hardcoded with Read-Only permissions.
- **Phase 1.5 Caching:** The FastAPI `/analyze` route must check Supabase for an exact competitor domain match from the last 7 days. If a cached report exists, return it instantly and bypass the Lyzr pipeline.

## 5. Agent Orchestration Domain Rules
When modifying or building the Lyzr pipeline, read the specific markdown files located in the `backend/.skills/` directory for system prompt instructions:
- `backend/.skills/researcher.md` -> For data extraction and Firecrawl/PRAW tool usage. MUST use `gpt-4o-mini`.
- `backend/.skills/strategist.md` -> For high-level business synthesis. Permitted to use `gpt-4o`.
- `backend/.skills/execution.md` -> For finalizing the report structure.