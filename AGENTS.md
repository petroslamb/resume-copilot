# Repository Guidelines

## Project Structure & Module Organization
- `src/app/` holds the Next.js 15 UI, with `page.tsx` implementing the Resume Copilot surface and CopilotKit bindings.
- `src/mastra/` contains the Mastra runtime: `agents/` for agent logic and schemas, `mcp/` for Model Context Protocol wiring, and `tools/` for extendable tool definitions.
- `nos_job_def/` stores deployment manifests for Nosana; keep any runtime-specific changes in this directory.
- `assets/` and `public/` host static imagery used by the marketing pages and favicon.
- `logs/` captures local dev logs (`agent.log`, `ui.log`) and can be safely ignored in source review.

## Build, Test, and Development Commands
- `pnpm run dev:agent` – start the Mastra agent (default port 4111) with live reload.
- `pnpm run dev:ui` – launch the Next.js frontend (http://localhost:3000) via Turbopack.
- `pnpm run lint` – execute Next.js linting across the repo; must pass before sending a PR.
- `pnpm run build` / `pnpm run start` – create and serve a production build of both agent and UI.
- `docker build -t <image>` & `docker run -p 3000:3000 <image>` – validate the container you intend to ship to Nosana.

## Coding Style & Naming Conventions
- Use TypeScript with 2-space indentation (Next.js default); avoid mixing `var`/`require`.
- React components live in `.tsx` files and follow `PascalCase`; hooks/utilities use `camelCase`.
- Extend the resume schema via `src/mastra/agents/schema.ts`; keep zod definitions and agent instructions synchronized.
- Rely on ESLint (`pnpm run lint`) before committing; add comments only where logic is non-obvious.

## Testing Guidelines
- No automated test harness is bundled. When adding features, supply targeted checks (e.g., unit tests with Vitest or Playwright E2E) and document how to run them.
- At minimum, validate lint, exercise key Copilot actions in the UI, and confirm the Dockerized image boots.
- Co-locate future tests near their modules (`component.test.tsx`) to keep ownership clear.

## Commit & Pull Request Guidelines
- Write imperative, present-tense commit subjects (e.g., “Handle malformed resume updates”).
- Keep descriptions focused on the “why” and mention affected modules; group breaking schema changes in dedicated commits.
- Pull Requests should include: summary of changes, test evidence (lint/build logs), updated screenshots for UI shifts, and deployment notes when relevant.
- Reference related issues or challenge tasks, and call out schema or instruction changes that downstream agents must absorb.

## Agent-Specific Instructions
- The primary agent is `resumeAgent` in `src/mastra/agents/index.ts`; changes here should be mirrored in `README.md` so challenge reviewers understand capabilities.
- When adding new actions or tools, document their shape in the front-end action definition and update the agent instructions to reflect expected usage.
- Preserve graceful handling of malformed payloads—use shared utilities in `page.tsx` and extend them rather than bypassing validation.
