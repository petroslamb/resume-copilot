import { MCPServer } from "@mastra/mcp";
import { resumeAgent } from "../agents";

export const server = new MCPServer({
  name: "resume-copilot-mcp",
  version: "0.1.0",
  tools: {},
  agents: { resumeAgent },
});
