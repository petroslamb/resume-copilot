import path from "node:path";
import { promises as fs } from "node:fs";
import crypto from "node:crypto";
import { MCPClient } from "@mastra/mcp";
import type { MastraMCPServerDefinition } from "@mastra/mcp/dist/client/client";
import { RuntimeContext } from "@mastra/core/runtime-context";
import { createTool } from "@mastra/core/tools";
import type { ToolsInput } from "@mastra/core/agent";
import { z } from "zod";

const PDF_MCP_TOOL_ID = "create_pdf_from_markdown";
const DEFAULT_TIMEOUT = 120_000;
const DEFAULT_OUTPUT_DIR = path.join(process.cwd(), ".cache", "markdown2pdf");
const DEFAULT_WRAPPER_SCRIPT = path.resolve(
  process.cwd(),
  "scripts",
  "start-markdown2pdf-mcp.mjs",
);
const DEFAULT_COMMAND = process.execPath;
const DEFAULT_COMMAND_ARGS = [DEFAULT_WRAPPER_SCRIPT];
const FALLBACK_COMMAND = "npx";
const FALLBACK_ARGS = ["-y", "markdown2pdf-mcp@latest"];

const PageSizeEnum = z.enum(["letter", "a4", "a3", "a5", "legal", "tabloid"]);
const MarginEnum = z.enum(["narrow", "normal", "wide"]);
const OrientationEnum = z.enum(["portrait", "landscape"]);
const WatermarkScopeEnum = z.enum(["all-pages", "first-page"]);

export const GenerateResumePdfInputSchema = z.object({
  markdown: z
    .string()
    .min(1, "Provide the resume markdown to convert to PDF.")
    .describe("Full markdown resume document."),
  pageSize: PageSizeEnum.optional().describe("Paper size to request from the PDF renderer."),
  margin: MarginEnum.optional().describe("Margin preset that maps to renderer border spacing."),
  orientation: OrientationEnum.optional().describe("Orientation toggle for the PDF output."),
  showPageNumbers: z
    .boolean()
    .optional()
    .describe("Include page numbers in the PDF footer."),
  watermark: z
    .string()
    .max(15)
    .regex(/^[A-Z0-9\s-]+$/, "Watermark may only include uppercase letters, digits, spaces, or dashes.")
    .optional()
    .describe("Optional uppercase watermark (max 15 characters)."),
  watermarkScope: WatermarkScopeEnum.optional().describe("Where the watermark should display."),
  fileName: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .optional()
    .describe("Optional filename for the generated PDF."),
});

export const GenerateResumePdfResultSchema = z.object({
  pdfBase64: z.string().describe("Base64-encoded PDF payload."),
  fileName: z.string().describe("Resolved filename for the PDF."),
  contentType: z.literal("application/pdf"),
  byteLength: z.number().describe("Size of the encoded PDF in bytes."),
  layout: z.object({
    pageSize: PageSizeEnum,
    margin: MarginEnum,
    orientation: OrientationEnum,
    showPageNumbers: z.boolean(),
    watermark: z.string().optional(),
    watermarkScope: WatermarkScopeEnum.optional(),
  }),
  log: z.string().optional(),
});

export type GenerateResumePdfInput = z.infer<typeof GenerateResumePdfInputSchema>;
export type GenerateResumePdfResult = z.infer<typeof GenerateResumePdfResultSchema>;

type PageSize = z.infer<typeof PageSizeEnum>;
type Margin = z.infer<typeof MarginEnum>;
type Orientation = z.infer<typeof OrientationEnum>;

interface NormalizedOptions {
  pageSize: PageSize;
  margin: Margin;
  orientation: Orientation;
  showPageNumbers: boolean;
  watermark?: string;
  watermarkScope?: z.infer<typeof WatermarkScopeEnum>;
  fileName: string;
}

let pdfClient: MCPClient | null = null;
let pdfToolsPromise: Promise<ToolsInput> | null = null;
let resolvedOutputDir: string | null = null;

function parseTimeout(): number {
  const raw = process.env.MARKDOWN2PDF_MCP_TIMEOUT;
  if (!raw) {
    return DEFAULT_TIMEOUT;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT;
}

function parseHeaders(): Record<string, string> | undefined {
  const raw = process.env.MARKDOWN2PDF_MCP_HEADERS;
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
      "[markdown2pdf] Failed to parse MARKDOWN2PDF_MCP_HEADERS as JSON. Expected object of header key/value pairs.",
      error,
    );
    return undefined;
  }
}

function parseCommandArgs(): string[] | undefined {
  const raw = process.env.MARKDOWN2PDF_MCP_ARGS;
  if (!raw) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.map((value) => String(value));
    }
  } catch {
    // fall through
  }

  return raw
    .split(/\s+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseCommandEnv(): Record<string, string> | undefined {
  const raw = process.env.MARKDOWN2PDF_MCP_ENV;
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
      "[markdown2pdf] Failed to parse MARKDOWN2PDF_MCP_ENV as JSON. Expected object of env key/value pairs.",
      error,
    );
    return undefined;
  }
}

async function ensureOutputDirectory(): Promise<string> {
  if (resolvedOutputDir) {
    return resolvedOutputDir;
  }

  const configured =
    process.env.MARKDOWN2PDF_OUTPUT_DIR?.trim() || DEFAULT_OUTPUT_DIR;
  const absolutePath = path.resolve(configured);
  await fs.mkdir(absolutePath, { recursive: true });
  resolvedOutputDir = absolutePath;
  return absolutePath;
}

async function resolveServerDefinition(timeout: number): Promise<MastraMCPServerDefinition> {
  const rawUrl = process.env.MARKDOWN2PDF_MCP_URL?.trim();
  if (rawUrl) {
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch (error) {
      throw new Error(
        `Invalid MARKDOWN2PDF_MCP_URL value '${rawUrl}'. Provide a fully qualified URL (e.g. http://127.0.0.1:3002/mcp).`,
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

  let command = process.env.MARKDOWN2PDF_MCP_COMMAND?.trim() || DEFAULT_COMMAND;
  const parsedArgs = parseCommandArgs();
  let args =
    parsedArgs && parsedArgs.length > 0 ? parsedArgs : DEFAULT_COMMAND_ARGS;

  if (args === DEFAULT_COMMAND_ARGS) {
    try {
      await fs.access(DEFAULT_WRAPPER_SCRIPT);
    } catch (error) {
      console.warn(
        "[markdown2pdf] Wrapper script missing; falling back to npx runner.",
        error,
      );
      command = FALLBACK_COMMAND;
      args = FALLBACK_ARGS;
    }
  }

  const outputDir = await ensureOutputDirectory();
  const extraEnv = parseCommandEnv();

  return {
    command,
    args,
    env: {
      ...process.env,
      M2P_OUTPUT_DIR: outputDir,
      ...(extraEnv ?? {}),
    },
    timeout,
  };
}

async function ensureClient(): Promise<MCPClient> {
  if (pdfClient) {
    return pdfClient;
  }

  const timeout = parseTimeout();
  const serverDefinition = await resolveServerDefinition(timeout);

  pdfClient = new MCPClient({
    servers: {
      markdown2pdf: serverDefinition,
    },
    timeout,
  });

  return pdfClient;
}

async function ensureTools(): Promise<ToolsInput> {
  if (pdfToolsPromise) {
    return pdfToolsPromise;
  }

  pdfToolsPromise = (async () => {
    const client = await ensureClient();
    const tools = await client.getTools();
    const namespacedId = Object.keys(tools).find((key) =>
      key === PDF_MCP_TOOL_ID || key.endsWith(`_${PDF_MCP_TOOL_ID}`),
    );

    if (!namespacedId) {
      throw new Error(
        `Markdown2PDF MCP server did not expose '${PDF_MCP_TOOL_ID}'. Ensure the server is running and reachable.`,
      );
    }

    return {
      [PDF_MCP_TOOL_ID]: tools[namespacedId],
    } satisfies ToolsInput;
  })();

  try {
    return await pdfToolsPromise;
  } catch (error) {
    pdfToolsPromise = null;
    throw error;
  }
}

function normalizeInput(input: GenerateResumePdfInput): NormalizedOptions {
  const fileName =
    (input.fileName && sanitizeFilename(input.fileName)) ||
    generateDefaultFilename();

  return {
    pageSize: input.pageSize ?? "letter",
    margin: input.margin ?? "normal",
    orientation: input.orientation ?? "portrait",
    showPageNumbers: input.showPageNumbers ?? false,
    watermark: input.watermark?.trim() || undefined,
    watermarkScope: input.watermarkScope,
    fileName,
  };
}

function sanitizeFilename(candidate: string): string {
  const base = candidate.replace(/[\/\\?%*:|"<>]/g, " ").trim();
  if (!base) {
    return generateDefaultFilename();
  }

  return base.toLowerCase().endsWith(".pdf") ? base : `${base}.pdf`;
}

function generateDefaultFilename(): string {
  return `resume-${crypto.randomUUID().slice(0, 8)}.pdf`;
}

function mapMarginToBorder(margin: Margin): string {
  switch (margin) {
    case "narrow":
      return "12mm";
    case "wide":
      return "25mm";
    case "normal":
    default:
      return "20mm";
  }
}

function extractPdfPath(log: string): { path: string; log: string } {
  const match = log.match(/PDF file created successfully at:\s*(.+)$/im);
  if (match && match[1]) {
    return { path: match[1].trim(), log };
  }

  throw new Error(
    "PDF generator did not report an output path. Ensure the Markdown2PDF MCP server is configured with M2P_OUTPUT_DIR.",
  );
}

async function invokePdfTool(input: GenerateResumePdfInput): Promise<GenerateResumePdfResult> {
  const normalized = normalizeInput(input);
  const tools = await ensureTools();
  const tool = tools[PDF_MCP_TOOL_ID];

  if (!tool?.execute) {
    throw new Error(
      "Markdown2PDF tool is not executable. Verify the MCP server configuration.",
    );
  }

  const runtimeContext = new RuntimeContext();
  const callResult = await tool.execute(
    {
      context: {
        markdown: input.markdown,
        outputFilename: normalized.fileName,
        paperFormat: normalized.pageSize,
        paperOrientation: normalized.orientation,
        paperBorder: mapMarginToBorder(normalized.margin),
        watermark: normalized.watermark,
        watermarkScope: normalized.watermarkScope,
        showPageNumbers: normalized.showPageNumbers,
      },
      runtimeContext,
    },
    undefined,
  );

  const log = extractToolLog(callResult);
  const { path: pdfPath } = extractPdfPath(log);

  const resolvedPath = path.resolve(pdfPath);
  const buffer = await fs.readFile(resolvedPath);

  try {
    await fs.unlink(resolvedPath);
  } catch (error) {
    console.warn(
      `[markdown2pdf] Unable to remove generated PDF '${resolvedPath}'.`,
      error,
    );
  }

  return {
    pdfBase64: buffer.toString("base64"),
    fileName: normalized.fileName,
    contentType: "application/pdf",
    byteLength: buffer.byteLength,
    layout: {
      pageSize: normalized.pageSize,
      margin: normalized.margin,
      orientation: normalized.orientation,
      showPageNumbers: normalized.showPageNumbers,
      watermark: normalized.watermark,
      watermarkScope: normalized.watermarkScope,
    },
    log,
  };
}

function extractToolLog(callResult: unknown): string {
  if (typeof callResult === "string") {
    return callResult;
  }

  if (
    callResult &&
    typeof callResult === "object" &&
    "content" in callResult &&
    Array.isArray((callResult as { content: unknown }).content)
  ) {
    const { content } = callResult as {
      content: Array<Record<string, unknown>>;
    };
    for (const item of content) {
      if (typeof item?.text === "string") {
        return item.text;
      }
    }
  }

  throw new Error("Markdown2PDF MCP response did not include textual output.");
}

export const generateResumePdfTool = createTool({
  id: "generateResumePdf",
  description:
    "Render the resume markdown into a PDF via an external Markdown2PDF MCP server. Adjust page size, margins, orientation, page numbers, and optional watermarking.",
  inputSchema: GenerateResumePdfInputSchema,
  outputSchema: GenerateResumePdfResultSchema,
  execute: async ({ context }) => {
    return invokePdfTool(context);
  },
});

export async function generateResumePdf(
  input: GenerateResumePdfInput,
): Promise<GenerateResumePdfResult> {
  return invokePdfTool(input);
}

export function getPdfTools(): ToolsInput {
  return {
    generateResumePdf: generateResumePdfTool,
  };
}
