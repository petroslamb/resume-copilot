import { NextRequest } from "next/server";
import {
  GenerateResumePdfInputSchema,
  generateResumePdf,
} from "@/mastra/tools/pdfMcp";

export const runtime = "nodejs";

export async function POST(req: NextRequest): Promise<Response> {
  let payload: unknown;

  try {
    payload = await req.json();
  } catch {
    return Response.json(
      { error: "Expected a JSON payload with resume markdown and layout options." },
      { status: 400 },
    );
  }

  const parsed = GenerateResumePdfInputSchema.safeParse(payload);

  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => issue.message).join("; ");
    return Response.json(
      { error: issues || "Invalid payload provided for PDF generation." },
      { status: 400 },
    );
  }

  try {
    const result = await generateResumePdf(parsed.data);
    return Response.json(result);
  } catch (error) {
    console.error("[generateResumePdf] Failed to render PDF", error);
    const message =
      error instanceof Error ? error.message : "PDF generator returned an unexpected response.";
    return Response.json({ error: message }, { status: 502 });
  }
}
