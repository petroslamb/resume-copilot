import "dotenv/config";
import { Agent } from "@mastra/core/agent";
import { createOllama } from "ollama-ai-provider-v2";
import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";
import { AgentState } from "./schema";

const ollama = createOllama({
  baseURL: process.env.NOS_OLLAMA_API_URL || process.env.OLLAMA_API_URL,
});

export const resumeAgent = new Agent({
  name: "Resume Editor",
  tools: {},
  // model: openai("gpt-4o"), // Uncomment to use OpenAI
  model: ollama(process.env.NOS_MODEL_NAME_AT_ENDPOINT || process.env.MODEL_NAME_AT_ENDPOINT || "qwen3:8b"),
  instructions: `You help users refine a resume that is rendered on the frontend.

- Keep every change grounded in the existing resume data unless the user requests something new.
- Ask clarifying questions when requirements are unclear.
- Use the "updateResume" frontend action to apply edits. Provide the specific resume fields you want to merge into the current state. When modifying list-based sections (experience, education, projects, skills), send the entire updated array.
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

export { AgentState, ResumeSchema } from "./schema";
