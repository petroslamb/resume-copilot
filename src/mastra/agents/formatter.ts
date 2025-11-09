import "dotenv/config";
import { Agent } from "@mastra/core/agent";
import { createOpenAI } from "@ai-sdk/openai";
import { createOllama } from "ollama-ai-provider-v2";
import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";

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

  return ollama(
    process.env.NOS_MODEL_NAME_AT_ENDPOINT ||
      process.env.MODEL_NAME_AT_ENDPOINT ||
      "qwen3:8b",
  );
};

export const resumeFormatterAgent = new Agent({
  name: "Resume Formatter",
  description:
    "A focused formatter that rewrites resume markdown into a polished, reader-friendly structure.",
  model: resolveModel(),
  instructions: `You specialize in polishing markdown resumes so they render cleanly in preview panes.

- Work only with the markdown provided to you.
- Preserve all factual content while restructuring headings, bullet lists, spacing, and emphasis.
- Prefer concise bullet lists, consistent heading levels, and blank lines between sections.
- Avoid introducing new sections or speculative content unless explicitly instructed.
- When returning output, follow the supplied schema exactly and keep line endings in UNIX format.
- Keep the summary short (one sentence) and highlight the biggest formatting changes.`,
  memory: new Memory({
    storage: new LibSQLStore({ url: "file::memory:" }),
    options: {
      workingMemory: {
        enabled: true,
      },
    },
  }),
  tools: {},
});
