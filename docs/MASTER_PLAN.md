# Master Implementation Plan: AI GTM Strategy & Competitive Analysis Agent

## 1. Role & Context
Act as a Senior Full-Stack AI Architect. We are building a headless, decoupled SaaS application from scratch. We do not use expensive enterprise data APIs (like SimilarWeb); instead, we rely on developer-friendly endpoints, open-source python packages, and terminal-level MCP servers to gather competitive intelligence.

## 2. Product Vision & Target Audience
- **Product Core:** A lead-generation SaaS platform designed as an "AI CMO" for technical startup founders (e.g., YC alumni).
- **Core Loop:** The user provides their company URL and an optional brief description. The system aggressively scrapes the web, extracts competitor footprints, benchmarks their positioning, and returns a prescriptive, interactive Go-To-Market (GTM) dashboard.
- **Lead Generation Hook:** High-visibility "Book a Demo" Call-to-Action (CTA) elements are embedded throughout the interface to convert traffic into high-value enterprise sales leads.

## 3. UI / UX Paradigm (Okara.ai / Enterprise Portal Inspired)
- **The Main Dashboard:** Multi-column view featuring dynamic visual charts for web traffic breakdowns, an interactive organizational tree mapping competitor hires, and actionable content/feature recommendations.
- **The White Space Matrix:** A direct comparative grid contrasting the user's current corporate footprint against discovered market gaps.
- **Embedded Agent Feed (Skott 2.0 Style):** An interactive chatbot layout nested right alongside the dashboard data. Users can chat directly with specialized sub-agents to execute on the data (e.g., *"Write the blog post you just recommended"* or *"Explain the execution behind this Reddit strategy"*).

## 4. Core Features & Data Pipeline
1. **Dynamic Competitor Discovery:** Accept a user URL, then deploy Google Search API via Serper.dev paired with an LLM prompt to automatically discover 3 to 5 direct or adjacent market competitors.
2. **Traffic Breakdown & Sources:** Query the DataForSEO API to generate estimates on competitor acquisition channels (Search, Direct, Social, Paid).
3. **Org Structure & Talent Shifts:** Execute Apify LinkedIn Scrapers to pull recent job postings from competitors, using an LLM to infer strategic pivots (e.g., *"Hiring 5 Enterprise Account Executives signals an aggressive upmarket enterprise push"*).
4. **Multi-Channel Audit (~15 Channels):** Leverage PRAW (Python Reddit API Wrapper) to extract community sentiment/discussions regarding the niche, and deploy Firecrawl to extract raw text/markdown from competitor documentation and product landing pages.
5. **Emerging Trend Spotting:** Run custom extraction loops to flag modern marketing growth plays (e.g., decentralized YouTube distribution channels, AI-authored thematic SEO networks).

## 5. Technical Architecture & Deployment
- **Frontend Architecture:** Next.js (App Router), React, Tailwind CSS, Shadcn UI components. Hosted on Vercel.
- **Backend Architecture:** Python 3.11+, FastAPI web framework. Hosted on Render or Railway.
- **Asynchronous Task Architecture (Headless Paradigm):** To bypass serverless runtime limitations (Vercel's execution time limits), the Next.js frontend must hand off a request to FastAPI, receive a unique Job ID instantly, and poll a Supabase table. FastAPI processes the long-running Lyzr multi-agent pipeline asynchronously in the background.
- **Database Engine:** Supabase (PostgreSQL) handling real-time data states, historical reports, user sessions, and email collection leads.

## 6. AI Agent "Skill" Architecture (Lyzr Automata)
The Python backend implements a Progressive Disclosure model utilizing modular instruction files stored under a `backend/.skills/` directory:
1. **Researcher Agent:** Responsible for interacting with raw infrastructure tools (Firecrawl, PRAW, Apify JSON payloads) to compile raw market material.
2. **Strategist Agent:** Evaluates structural white space across channels, handles market budgeting math, and creates positioning blueprints.
3. **Execution Agent:** Turns strategic initiatives into tactical copy, drafting explicit web-page outlines and content scripts.

## 7. Security & Safety Guardrails (OWASP Top 10 for LLMs)
- **Denial of Wallet (DoW) Protection:** Protect public endpoints from brute-force token depletion. Apply `@upstash/ratelimit` middleware via Vercel KV on the Next.js API layer and `slowapi` decorators on FastAPI endpoint routes.
- **Cross-Site Scripting (XSS) Prevention:** Treat all Markdown arrays returned from Lyzr agents as untrusted data. Sanitize all outputs using `isomorphic-dompurify` on the React DOM before rendering.
- **Prompt Injection Defense:** Implement `guardrails-ai/guardrails` inside the FastAPI backend. Every chunk of markdown or HTML scraped via Firecrawl must pass through a structural validation layer to intercept and block indirect prompt injections.
- **Excessive Agency Mitigation:** Hardcode all tool inputs inside the Lyzr execution pipeline to have strict Read-Only system permissions.

## 8. Automated Tooling & Context Guidelines
- **Native Plan Mode:** For major features, invoke Claude Code's native `/plan` command before generating code files to ensure dependency tree mapping.
- **Context Compression:** If the terminal agent experiences context memory drift or slow response cycles, use `repomix` to serialize the codebase into an optimized structural XML container.
- **Directory Scoping:** Use precise `.claude/rules/frontend.md` and `.claude/rules/backend.md` rulesets to ensure domain isolation during execution.

## 9. Phase 1 MVP Scope (First 48 Hours)
- **Goal:** Prove the backend-to-frontend headless polling loop works alongside a mock Lyzr execution string.
- **Day 1 Focus (FastAPI Skeleton):** Setup an asynchronous FastAPI route (`/api/v1/analyze`) that generates a UUID Job ID, spawns a background task that sleeps for 10 seconds (mocking a slow scrape), writes a mock JSON payload to a Supabase table, and terminates.
- **Day 2 Focus (Next.js Polling UI):** Create a basic submission form in Next.js. Upon submission, it fires the API call, grabs the Job ID, opens an interval loop fetching data from Supabase, and renders a clean UI card when the processing state flags as `completed`.

## 10. Architecture Addendum (Cost & Data Rules)
- **SDK Over Studio:** We strictly use the `lyzr-automata` Python package to define our agents in code. We do not use the drag-and-drop Lyzr Studio.
- **Tiered Model Routing:** To prevent Token/Wallet drain, the `Researcher Agent` MUST use a cheap model (e.g., `gpt-4o-mini`) to parse raw web data. Only the `Strategist Agent` is permitted to use an expensive reasoning model (e.g., `gpt-4o`).
- **Data Ingestion (No RAG):** For the MVP, do not build a Vector Database. The backend will feed scraped Firecrawl markdown directly into the Lyzr prompt context window.
- **Phase 1.5 Caching:** The FastAPI `/analyze` route must check Supabase for an exact competitor domain match from the last 7 days. If a cached report exists, it must return it instantly and bypass the Lyzr generation pipeline entirely.

