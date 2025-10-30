import "dotenv/config";
import { Agent } from "@mastra/core/agent";
import { createOllama } from "ollama-ai-provider-v2";
import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";
import { AgentState } from "./schema";
import type { ToolsInput } from "@mastra/core/agent";
import { getMarkitdownTools } from "../tools/markitdown";
import { getFormatterTools } from "../tools/formatResume";

const ollama = createOllama({
  baseURL: process.env.NOS_OLLAMA_API_URL || process.env.OLLAMA_API_URL,
});

async function resolveAgentTools(): Promise<ToolsInput> {
  const toolset: ToolsInput = {
    ...getFormatterTools(),
  };

  try {
    Object.assign(toolset, await getMarkitdownTools());
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error while loading MarkItDown tools.";
    console.warn(`[markitdown] Falling back to no-op toolset: ${message}`);
  }

  return toolset;
}

export const resumeAgent = new Agent({
  name: "Resume Editor",
  tools: resolveAgentTools,
  // model: openai("gpt-4o"), // Uncomment to use OpenAI
  model: ollama(process.env.NOS_MODEL_NAME_AT_ENDPOINT || process.env.MODEL_NAME_AT_ENDPOINT || "qwen3:8b"),
  instructions: `You help users refine a markdown resume that is rendered on the frontend.

- When a session begins, open with a friendly greeting and proactively describe the tools and frontend actions you can use (markitdown_convert_to_markdown, formatResumeMarkdown, updateMarkdownResume, setThemeColor) so the user understands your capabilities.
- Keep every change grounded in the current markdown unless the user requests new content.
- Ask clarifying questions when requirements are unclear.
- When a user provides an external document (PDF, DOCX, etc.), use the MarkItDown tool (markitdown_convert_to_markdown) to transform the supplied URI—http(s), file, or data URI—into markdown before integrating it.
- Use the "formatResumeMarkdown" tool whenever the markdown structure, spacing, or bullet formatting looks uneven. The tool returns the full rewritten document and a short summary of the changes.
- Use the "updateMarkdownResume" frontend action to rewrite the resume. Always send the complete markdown document shaped by the shared headings.
- Use the "setThemeColor" frontend action when the user asks for palette tweaks.
- Preserve formatting suitable for a resume and be concise.
- Confirm meaningful changes after applying them.`,
  description: "An agent that collaborates on resume content and formatting.",
  memory: new Memory({
    storage: new LibSQLStore({ url: "file::memory:" }),
    options: {
      workingMemory: {
        enabled: true,
        schema: AgentState,
      },
    },
  }),
})

export { AgentState } from "./schema";
export { resumeFormatterAgent } from "./formatter";
