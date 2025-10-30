# Builders' Challenge #3: AI Agents 102 – Resume Copilot

![Agent](./assets/NosanaBuildersChallenge03.jpg)

This repository is our submission for **Builders' Challenge #3: AI Agents 102** by Nosana and Mastra. The brief is to ship a production-ready AI agent, deploy it on Nosana's decentralized compute network, and showcase the experience. We are building an intelligent **Resume Copilot** that helps users refactor and iterate on their professional story in real time.

## Project Concept

The Resume Copilot pairs a conversational agent with a live resume canvas. Users can ask for content rewrites, highlight tweaks, or visual adjustments, and see the rendered resume update instantly. The agent focuses on preserving structured data, avoiding malformed updates, and providing actionable feedback.

Key goals:
- Support structured resume editing with validation and graceful recovery from malformed payloads.
- Provide a polished UI that mirrors how the resume will look when exported or shared.
- Keep the deployment ready for Nosana's GPU-backed, containerized environment.

## Architecture Overview

- **Frontend (Next.js 15 + React 19)** renders the resume experience and hosts CopilotKit actions that expose targeted functions (`setThemeColor`, `updateResume`, `renderWorkingMemoryUpdate`).
- **CopilotKit** bridges the UI and the agent, wiring communications through shared state (`useCoAgent`) and declarative tool definitions (`useCopilotAction`).
- **Mastra Agent Runtime** hosts the `resumeAgent`, powered by Ollama (Nosana-hosted or local) or OpenAI. Working memory uses LibSQL in-memory storage so the agent can reason over prior resume state.
- **JSON Repair & Validation** (`jsonrepair`, `zod`) ensure malformed updates from the LLM are repaired, validated, and merged safely before touching UI state.
- **MCP Server** (Mastra MCP integration) is ready for additional tools or shared context streams.
- **Nosana Job Definition** (`nos_job_def/`) contains the manifests to push this stack onto Nosana's decentralized compute.

## Technology Stack

- Next.js 15 with the App Router and Turbopack dev server
- React 19 with functional components and hooks
- Tailwind-inspired utility classes for styling
- Mastra `@mastra/core`, `@mastra/memory`, and LibSQL storage
- CopilotKit UI and runtime bindings
- Ollama AI provider (default: Nosana-hosted Qwen3:8b) with optional OpenAI
- `jsonrepair` and `zod` for resilient payload handling
- Docker for containerization and Nosana deployment

## Frontend Experience

- Default resume data seeds a rich layout that highlights the agent's edits immediately.
- Theme accents can be changed interactively via Copilot commands.
- A memory update panel shows what context the agent is storing, supporting transparency for end users.
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
│       └── tools            # Placeholder for future tool implementations
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

Update `.env` with one of the following:
- **Nosana-hosted LLM (recommended):**
  - `NOS_OLLAMA_API_URL` from the challenge brief (endpoint already appends `/api`).
  - `NOS_MODEL_NAME_AT_ENDPOINT=qwen3:8b`
- **Local Ollama:** run `ollama serve`, set `OLLAMA_API_URL=http://127.0.0.1:11434/api`, and pick a model name (e.g. `MODEL_NAME_AT_ENDPOINT=qwen3:0.6b`).
- **OpenAI:** set `OPENAI_API_KEY`, switch the agent model in `src/mastra/agents/index.ts`.

## Running Locally

Open two terminals (or use a process manager such as `concurrently`):

```bash
# Terminal 1 – Mastra agent runtime (port 4111 by default)
pnpm run dev:agent

# Terminal 2 – Next.js frontend (http://localhost:3000)
pnpm run dev:ui
```

Visit `http://localhost:3000` to chat with the Resume Copilot. The Mastra playground remains available at `http://localhost:4111`.

### Useful Scripts

- `pnpm run lint` – Lint the codebase.
- `pnpm run build` – Build both the agent and the UI.
- `pnpm run start` – Start both services from the production build (uses `concurrently` under the hood).
- `pnpm run build:agent` / `pnpm run start:agent` – Mastra-only workflow.
- `pnpm run build:ui` / `pnpm run start:ui` – Next.js-only workflow.

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
