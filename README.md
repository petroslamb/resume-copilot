# Builders' Challenge #3: AI Agents 102 – Resume Copilot

![Agent](./assets/NosanaBuildersChallenge03.jpg)

This repository is our submission for **Builders' Challenge #3: AI Agents 102** by Nosana and Mastra. The brief is to ship a production-ready AI agent, deploy it on Nosana's decentralized compute network, and showcase the experience. We are building an intelligent **Resume Copilot** that helps users refactor and iterate on their professional story in real time.

## Project Concept

The Resume Copilot pairs a conversational agent with a live resume canvas. Users can ask for content rewrites, highlight tweaks, or visual adjustments, and see the rendered resume update instantly. The agent focuses on preserving structured data, avoiding malformed updates, and providing actionable feedback.

Key goals:
- Support markdown resume editing with a responsive live preview.
- Provide a polished UI that mirrors how the resume will look when exported or shared.
- Keep the deployment ready for Nosana's GPU-backed, containerized environment.

## Architecture Overview

- **Frontend (Next.js 15 + React 19)** renders the resume experience and hosts CopilotKit actions that expose targeted functions (`setThemeColor`, `updateMarkdownResume`, `renderWorkingMemoryUpdate`).
- **CopilotKit** bridges the UI and the agent through declarative tool definitions (`useCopilotAction`) and readable streams (`useCopilotReadable`).
- **Mastra Agent Runtime** hosts the `resumeAgent`, powered by Ollama (Nosana-hosted or local) or OpenAI. Working memory uses LibSQL in-memory storage so the agent can reason over prior resume state, and the agent now greets users on session startup while outlining its MarkItDown conversion, resume formatting, markdown update, and theme color actions.
- **Formatter Agent Tooling** exposes a dedicated `formatResumeMarkdown` tool backed by a focused agent so both the UI and copilot can request layout cleanups without touching content.
- **MCP Server** (Mastra MCP integration) is ready for additional tools or shared context streams.
- **Nosana Job Definition** (`nos_job_def/`) contains the manifests to push this stack onto Nosana's decentralized compute.

## Technology Stack

- Next.js 15 with the App Router and Turbopack dev server
- React 19 with functional components and hooks
- Tailwind-inspired utility classes for styling
- Mastra `@mastra/core`, `@mastra/memory`, and LibSQL storage
- CopilotKit UI and runtime bindings
- Ollama AI provider (default: Nosana-hosted Qwen3:8b) with optional OpenAI
- `zod` for lightweight schema validation on agent working memory
- Docker for containerization and Nosana deployment

## Frontend Experience

- A markdown template gives the agent structured headings to expand without extra setup.
- Theme accents can be changed interactively via Copilot commands.
- A memory update panel shows what context the agent is storing, supporting transparency for end users.
- An "Improve Formatting" control triggers the formatter agent to normalize spacing, lists, and headings before updating the preview.
- A MarkItDown-powered import card lets you upload PDFs or DOCX files and instantly convert them to markdown inside the editor.
- Layout uses a radial gradient background with a paper-like resume shell to keep focus on content quality.

## Repository Layout

```text
.
├── src
│   ├── app
│   │   ├── api/copilotkit   # CopilotKit endpoint for streaming updates
│   │   ├── globals.css      # Global styles and Tailwind reset
│   │   ├── layout.tsx       # Next.js root layout
│   │   └── page.tsx         # Resume Copilot UI and CopilotKit bindings
│   └── mastra
│       ├── agents           # Mastra agent definition and zod schemas
│       ├── mcp              # MCP server bootstrap (extensible tool surface)
│       └── tools            # MarkItDown fallback, formatter, and Markdown2PDF integrations
├── nos_job_def              # Job definitions for Nosana deployment
├── Dockerfile               # Single container running agent + UI
├── logs                     # Dev logs for agent and UI processes
└── package.json             # Scripts for dev, build, and deployment
```

## Prerequisites

- Node.js 20+ (tested with the version shipped by Nosana’s starter)
- [pnpm](https://pnpm.io/) or npm (scripts assume pnpm, adjust if needed)
- Docker (for the deployment stage)
- Optional: [Ollama](https://ollama.com/download) for local model experimentation
- Optional: OpenAI API key if you prefer OpenAI models during development

## Installation

```bash
git clone https://github.com/YOUR-USERNAME/agent-challenge.git
cd agent-challenge
cp .env.example .env     # set NOS_OLLAMA_API_URL / MODEL_NAME_AT_ENDPOINT / etc.
pnpm install
```

> The workspace whitelists Puppeteer's install script via `.npmrc`, so the first `pnpm install` will also download Chrome for Testing (v131) required by the Markdown-to-PDF MCP server.

Update `.env` with one of the following:
- **Nosana-hosted LLM (recommended):**
  - `NOS_OLLAMA_API_URL` from the challenge brief (endpoint already appends `/api`).
  - `NOS_MODEL_NAME_AT_ENDPOINT=qwen3:8b`
- **Local Ollama:** run `ollama serve`, set `OLLAMA_API_URL=http://127.0.0.1:11434/api`, and pick a model name (e.g. `MODEL_NAME_AT_ENDPOINT=qwen3:0.6b`).
- **OpenAI:** `pnpm add @ai-sdk/openai`, set `OPENAI_API_KEY`, and update the agent model in `src/mastra/agents/index.ts`.

## Running Locally

Use the combined dev script or run each service separately:

```bash
# Start agent + UI together (http://localhost:3000 + 4111)
pnpm run dev
```

```bash
# Terminal 1 – Mastra agent runtime (port 4111 by default)
pnpm run dev:agent

# Terminal 2 – Next.js frontend (http://localhost:3000)
pnpm run dev:ui
```

Visit `http://localhost:3000` to chat with the Resume Copilot. The Mastra playground remains available at `http://localhost:4111`.

### Useful Scripts

- `pnpm run dev` – Start the Mastra agent and Next.js UI together.
- `pnpm run lint` – Lint the codebase.
- `pnpm run build` – Build both the agent and the UI.
- `pnpm run start` – Start both services from the production build (uses `concurrently` under the hood).
- `pnpm run build:agent` / `pnpm run start:agent` – Mastra-only workflow.
- `pnpm run build:ui` / `pnpm run start:ui` – Next.js-only workflow.

## MarkItDown MCP Integration

The agent exposes the remote `markitdown_convert_to_markdown` MCP tool so it can ingest PDFs, DOCX files, and other supported formats. The frontend includes an “Import a resume with MarkItDown” card that uploads a document, calls the tool, and swaps the editor content with the converted markdown. When the MCP server is offline, PDF uploads automatically fall back to a lightweight Node parser; the formatting is simpler than the official service, but the import flow keeps working.

### Quick start

1. Install the MCP server: `pip install markitdown-mcp`
2. Start it in HTTP mode: `markitdown-mcp --http --host 127.0.0.1 --port 3001`
3. Point the app at the server (optional—defaults to the value below):
   ```bash
   export MARKITDOWN_MCP_URL=http://127.0.0.1:3001/mcp
   ```
4. Run the agent/UI as usual (`pnpm run dev` or `pnpm run dev:agent` + `pnpm run dev:ui`) and use the upload card to import a document.

### Configuration

- `MARKITDOWN_MCP_URL` – Streamable HTTP endpoint for the MarkItDown MCP server. Defaults to `http://127.0.0.1:3001/mcp`.
- `MARKITDOWN_MCP_HEADERS` – Optional JSON object of additional request headers (e.g. API keys).
- `MARKITDOWN_MCP_TIMEOUT` – Override per-call timeout (milliseconds, default `120000`).
- `MARKITDOWN_MAX_UPLOAD_BYTES` – Limit for file uploads handled by `/api/markitdown` (default 5 MB).

If the tool cannot be reached, the agent starts without it and logs a warning so you can correct the configuration. PDF uploads still succeed thanks to the local fallback, but other formats require the MCP server.

## Markdown2PDF MCP Integration

Resume PDF export now expects an HTTP-accessible Markdown2PDF MCP server. Point the app at a reachable endpoint and the agent will call the `create_pdf_from_markdown` tool; otherwise the UI offers a Markdown download fallback so the user still receives a copy of their resume.

### Quick start

1. Launch the server (e.g. `markdown2pdf-mcp --stdio` behind an MCP HTTP bridge, or your hosted deployment).
2. Expose it over HTTP and note the MCP endpoint URL (default the app looks for `http://127.0.0.1:3002/mcp`).
3. Configure the app:
   ```bash
   export MARKDOWN2PDF_MCP_URL=http://127.0.0.1:3002/mcp
   ```
4. (Optional) Provide custom headers or timeouts via the environment variables below.

### Configuration

- `MARKDOWN2PDF_MCP_URL` – HTTP endpoint for the Markdown2PDF MCP server. Defaults to `http://127.0.0.1:3002/mcp`.
- `MARKDOWN2PDF_MCP_HEADERS` – Optional JSON of additional HTTP headers.
- `MARKDOWN2PDF_MCP_TIMEOUT` – Per-call timeout in milliseconds (default `120000`).
- `MARKDOWN2PDF_OUTPUT_DIR` – Directory where generated PDFs are written before being streamed back. Defaults to `.cache/markdown2pdf` inside the app workspace; ensure the MCP server can write to and read from the same path.

If the MCP endpoint is unreachable, the tool returns the markdown content alongside a warning so the UI can prompt the user to download a `.md` copy instead of failing the workflow.

## Containerization & Deployment

```bash
# Build the production image
docker build -t yourusername/agent-challenge:latest .

# Smoke-test locally
docker run -p 3000:3000 yourusername/agent-challenge:latest

# Push to your registry of choice
docker login
docker push yourusername/agent-challenge:latest
```

The Dockerfile runs the Mastra agent and Next.js UI inside a single container, mirroring the environment expected by Nosana job definitions (`nos_job_def/`).

## Submitting to the Challenge

1. **Register** for the Builders' Challenge via [SuperTeam](https://earn.superteam.fun/listing/nosana-builders-challenge-agents-102) and the [Luma page](https://luma.com/zkob1iae).
2. **Star** the required repositories (agent-challenge starter, Nosana CLI, Nosana SDK).
3. **Build & Tag** your Docker image and push it to Docker Hub (or another container registry supported by Nosana).
4. **Deploy on Nosana:** use the job definitions in `nos_job_def/` or your custom workflow to run the image on Nosana's decentralized network.
5. **Verify the deployment:** capture the live URL or a short screen recording showing the deployed Resume Copilot in action.
6. **Demo video (1–3 minutes):** highlight the agent’s capabilities, the frontend UX, and the deployment running on Nosana infrastructure.
7. **Submit your proof:** follow the challenge submission form to provide links to the repository, container image, deployment evidence, and demo video.

Need help? Reach out on the Nosana Discord (#builders-challenge) for guidance on model endpoints, deployment quirks, or additional Mastra/CopilotKit questions.
Happy shipping! 🚀
