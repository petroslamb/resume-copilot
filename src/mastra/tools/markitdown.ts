import { MCPClient } from "@mastra/mcp";
import { RuntimeContext } from "@mastra/core/runtime-context";
import type { ToolsInput } from "@mastra/core/agent";
import type { MastraMCPServerDefinition } from "@mastra/mcp/dist/client/client";

const MARKITDOWN_TOOL_ID = "markitdown_convert_to_markdown";
const DEFAULT_MARKITDOWN_URL = "http://127.0.0.1:3001/mcp";
const DEFAULT_TIMEOUT = 120_000;

let markitdownClient: MCPClient | null = null;
let markitdownToolsPromise: Promise<ToolsInput> | null = null;

function parseTimeout(): number {
  const value = process.env.MARKITDOWN_MCP_TIMEOUT;
  if (!value) {
    return DEFAULT_TIMEOUT;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT;
}

function parseHeaders(): Record<string, string> | undefined {
  const raw = process.env.MARKITDOWN_MCP_HEADERS;
  if (!raw) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed).map(([key, value]) => [key, String(value)]),
    );
  } catch (error) {
    console.warn(
      "[markitdown] Failed to parse MARKITDOWN_MCP_HEADERS as JSON. Expected object of header key/value pairs.",
      error,
    );
    return undefined;
  }
}

function resolveServerDefinition(timeout: number): MastraMCPServerDefinition {
  const rawUrl = process.env.MARKITDOWN_MCP_URL?.trim() ?? DEFAULT_MARKITDOWN_URL;

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch (error) {
    throw new Error(
      `Invalid MARKITDOWN_MCP_URL value '${rawUrl}'. Provide a fully qualified URL (e.g. http://127.0.0.1:3001/mcp).`,
      error instanceof Error ? { cause: error } : undefined,
    );
  }

  const headers = parseHeaders();

  return {
    url,
    timeout,
    requestInit: headers ? { headers } : undefined,
  };
}

async function ensureClient(): Promise<MCPClient> {
  if (markitdownClient) {
    return markitdownClient;
  }

  const timeout = parseTimeout();
  const serverDefinition = resolveServerDefinition(timeout);

  markitdownClient = new MCPClient({
    servers: {
      markitdown: serverDefinition,
    },
    timeout,
  });

  return markitdownClient;
}

async function ensureTools(): Promise<ToolsInput> {
  if (markitdownToolsPromise) {
    return markitdownToolsPromise;
  }

  markitdownToolsPromise = (async () => {
    const client = await ensureClient();
    const tools = await client.getTools();

    if (!tools[MARKITDOWN_TOOL_ID]) {
      throw new Error(
        `MarkItDown MCP server did not expose '${MARKITDOWN_TOOL_ID}'. Ensure the server is running and reachable.`,
      );
    }

    return tools;
  })();

  try {
    return await markitdownToolsPromise;
  } catch (error) {
    markitdownToolsPromise = null;
    throw error;
  }
}

function extractMarkdown(callResult: unknown): string {
  if (typeof callResult === "string") {
    return callResult;
  }

  if (
    callResult &&
    typeof callResult === "object" &&
    "content" in callResult &&
    Array.isArray((callResult as { content: unknown }).content)
  ) {
    const { content } = callResult as { content: Array<Record<string, unknown>> };
    for (const item of content) {
      if (typeof item?.text === "string") {
        return item.text;
      }
    }
  }

  throw new Error("MarkItDown MCP response did not include text content.");
}

export async function getMarkitdownTools(): Promise<ToolsInput> {
  return ensureTools();
}

export async function convertUriToMarkdown(uri: string): Promise<string> {
  if (!uri || typeof uri !== "string") {
    throw new Error("A non-empty URI is required to convert with MarkItDown.");
  }

  const tools = await ensureTools();
  const tool = tools[MARKITDOWN_TOOL_ID];

  if (!tool?.execute) {
    throw new Error(
      "MarkItDown tool is not executable. Verify the MCP server configuration.",
    );
  }

  const runtimeContext = new RuntimeContext();
  const result = await tool.execute(
    {
      context: { uri },
      runtimeContext,
    },
    undefined,
  );

  return extractMarkdown(result);
}

export function resetMarkitdownClientForTests(): void {
  markitdownClient = null;
  markitdownToolsPromise = null;
}
