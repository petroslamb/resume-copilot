# Resume Copilot

Resume Copilot is an AI-native resume editor that pairs a conversational agent with a live markdown canvas. Ask for rewrites, targeted highlight tweaks, formatting cleanups, or theme updates and see the rendered resume update instantly while preserving structure.

The project was originally prototyped during Nosana & Mastra's Builders' Challenge #3, but it now lives on as an independent open-source tool. The challenge is over—the goal today is to maintain a production-ready agentic resume assistant that anyone can run locally or deploy on Nosana's decentralized compute.

## Project Concept

The Resume Copilot blends conversational UX, live preview, and strict schema validation so users can iterate on their professional story with confidence. The agent keeps stateful memory, avoids malformed updates, and provides actionable feedback while the UI mirrors a polished resume layout.

Key goals:
- Support markdown resume editing with a responsive live preview.
- Provide a polished UI that mirrors exports and embeds.
- Keep the deployment ready for Nosana's GPU-backed, containerized environment.

## Architecture Overview

- **Frontend (Next.js 15 + React 19)** renders the resume experience and hosts CopilotKit actions that expose targeted functions (`setThemeColor`, `updateMarkdownResume`, `renderWorkingMemoryUpdate`).
- **CopilotKit** bridges the UI and the agent through declarative tool definitions (`useCopilotAction`) and readable streams (`useCopilotReadable`).
- **Mastra Agent Runtime** hosts the `resumeAgent`, powered by Ollama (Nosana-hosted or local) or OpenAI. Working memory uses LibSQL in-memory storage so the agent can reason over prior resume state, and the agent greets users on session startup while outlining its MarkItDown conversion, resume formatting, markdown update, and theme color actions.
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

- Node.js 20+ (matching the version used in the Docker image)
- [pnpm](https://pnpm.io/) or npm (scripts assume pnpm, adjust if needed)
- Docker (for the deployment stage)
- Optional: [Ollama](https://ollama.com/download) for local model experimentation
- Optional: OpenAI API key if you prefer OpenAI models during development

## Installation

```bash
git clone https://github.com/YOUR-USERNAME/resume-copilot.git
cd resume-copilot
cp .env.example .env     # set NOS_OLLAMA_API_URL / MODEL_NAME_AT_ENDPOINT / etc.
pnpm install
```

> The workspace whitelists Puppeteer's install script via `.npmrc`, so the first `pnpm install` will also download Chrome for Testing (v131) required by the Markdown-to-PDF MCP server.

## Environment Configuration

Update `.env` with one of the following:
- **Nosana-hosted LLM (recommended):**
  - `NOS_OLLAMA_API_URL` from your Nosana deployment (endpoint already appends `/api`).
  - `NOS_MODEL_NAME_AT_ENDPOINT=qwen3:8b`
- **Local Ollama:** run `ollama serve`, set `OLLAMA_API_URL=http://127.0.0.1:11434/api`, and pick a model name (e.g. `MODEL_NAME_AT_ENDPOINT=qwen3:0.6b`).
- **OpenAI:** set `OPENAI_API_KEY` (plus optional `OPENAI_MODEL`, `OPENAI_BASE_URL`) and the agent will automatically route to OpenAI.

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
docker build -t yourusername/resume-copilot:latest .

# Smoke-test locally
docker run -p 3000:3000 yourusername/resume-copilot:latest

# Push to your registry of choice
docker login
docker push yourusername/resume-copilot:latest
```

The Dockerfile runs the Mastra agent and Next.js UI inside a single container, mirroring the environment expected by Nosana job definitions (`nos_job_def/`) while keeping local hosting trivial. Deploy the image to Nosana (or any container platform) whenever you want a managed runtime for the agent.

## Project History

Resume Copilot started life during Nosana & Mastra's Builders' Challenge #3 as an experiment in agentic resume editing. After the challenge wrapped, the codebase kept maturing—new MCP integrations, formatter tooling, UI polish, and deployment scripts were added so the project could stand on its own. Contributions now focus on long-lived career tooling, portability, and community-driven improvements.

## LLM Provider Configuration
To run this project, you need to configure an LLM provider. Set the  environment variable with your OpenAI API key. Alternatively, you can configure  or  for Ollama.
