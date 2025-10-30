import { NextRequest } from "next/server";
import { formatResumeMarkdown } from "@/mastra/tools/formatResume";

export const runtime = "nodejs";

export async function POST(req: NextRequest): Promise<Response> {
  let payload: unknown;

  try {
    payload = await req.json();
  } catch {
    return Response.json(
      { error: "Expected a JSON payload with resume markdown." },
      { status: 400 },
    );
  }

  if (!payload || typeof payload !== "object") {
    return Response.json(
      { error: "Expected a JSON payload with resume markdown." },
      { status: 400 },
    );
  }

  const { markdown, styleHints } = payload as {
    markdown?: unknown;
    styleHints?: unknown;
  };

  if (typeof markdown !== "string" || markdown.trim().length === 0) {
    return Response.json(
      { error: "Provide non-empty markdown to format." },
      { status: 400 },
    );
  }

  try {
    const result = await formatResumeMarkdown({
      markdown,
      styleHints: typeof styleHints === "string" ? styleHints : undefined,
    });

    return Response.json({
      markdown: result.markdown.trim(),
      summary: result.summary,
    });
  } catch (error) {
    console.error("[formatResume] Failed to format resume", error);
    const message =
      error instanceof Error
        ? error.message
        : "Formatter agent returned an unexpected response.";
    return Response.json({ error: message }, { status: 502 });
  }
}
