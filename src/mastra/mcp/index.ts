import { MCPServer } from "@mastra/mcp";
import { resumeAgent } from "../agents";

export const server = new MCPServer({
  name: "My Custom Server",
  version: "1.0.0",
  tools: {},
  agents: { resumeAgent }, // this agent will become tool "ask_resumeAgent"
  // workflows: {
  // dataProcessingWorkflow, // this workflow will become tool "run_dataProcessingWorkflow"
  // }
});
