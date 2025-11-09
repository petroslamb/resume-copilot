import "dotenv/config";
import { Agent } from "@mastra/core/agent";
import { createOpenAI } from "@ai-sdk/openai";
import { createOllama } from "ollama-ai-provider-v2";
import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";
import { AgentState } from "./schema";
import type { ToolsInput } from "@mastra/core/agent";
import { getMarkitdownTools } from "../tools/markitdown";
import { getFormatterTools } from "../tools/formatResume";
import { getPdfTools } from "../tools/pdfMcp";

const ollama = createOllama({
  baseURL: process.env.NOS_OLLAMA_API_URL || process.env.OLLAMA_API_URL,
});

const openAIKey = process.env.OPENAI_API_KEY;
const openai = openAIKey
  ? createOpenAI({
      apiKey: openAIKey,
      baseURL: process.env.OPENAI_BASE_URL,
      organization: process.env.OPENAI_ORG,
      project: process.env.OPENAI_PROJECT,
    })
  : null;

const resolveModel = () => {
  if (openai) {
    return openai.chat(process.env.OPENAI_MODEL || "gpt-4o-mini");
  }

  if (!process.env.NOS_OLLAMA_API_URL && !process.env.OLLAMA_API_URL) {
    throw new Error(
      "No LLM provider configured. Set OPENAI_API_KEY or provide NOS_OLLAMA_API_URL / OLLAMA_API_URL.",
    );
  }

  return ollama(process.env.NOS_MODEL_NAME_AT_ENDPOINT || process.env.MODEL_NAME_AT_ENDPOINT || "qwen3:8b");
};

async function resolveAgentTools(): Promise<ToolsInput> {
  const toolset: ToolsInput = {
    ...getFormatterTools(),
    ...getPdfTools(),
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
  model: resolveModel(),
  instructions: `You help users refine a markdown resume that is rendered on the frontend.

- When a session begins, open with a friendly greeting and proactively describe the tools and frontend actions you can use (markitdown_convert_to_markdown, formatResumeMarkdown, generateResumePdf, updateMarkdownResume, setThemeColor) so the user understands your capabilities.
- Keep every change grounded in the current markdown unless the user requests new content.
- Ask clarifying questions when requirements are unclear.
- When a user provides an external document (PDF, DOCX, etc.), use the MarkItDown tool (markitdown_convert_to_markdown) to transform the supplied URI—http(s), file, or data URI—into markdown before integrating it. If the remote tool is unavailable, you can still convert PDF uploads via the local fallback but mention that formatting may be lighter.
- Use the "formatResumeMarkdown" tool whenever the markdown structure, spacing, or bullet formatting looks uneven. The tool returns the full rewritten document and a short summary of the changes.
- Use the "generateResumePdf" tool to create downloadable PDFs by delegating to the Markdown2PDF MCP server. Adjust layout parameters like page size, margin, orientation, page numbers, or watermarking before suggesting copy edits when someone asks to fit within a page count. If the PDF service is unavailable, the tool will return the markdown content for download instead—let the user know when this fallback is used.
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
