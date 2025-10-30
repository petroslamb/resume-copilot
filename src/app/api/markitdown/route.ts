import { NextRequest } from "next/server";
import { convertUriToMarkdown } from "@/mastra/tools/markitdown";

const DEFAULT_MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

const parseMaxUploadBytes = (): number => {
  const raw = process.env.MARKITDOWN_MAX_UPLOAD_BYTES;
  if (!raw) {
    return DEFAULT_MAX_UPLOAD_BYTES;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_UPLOAD_BYTES;
};

export const runtime = "nodejs";

export async function POST(req: NextRequest): Promise<Response> {
  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return Response.json(
      { error: "Expected a single file upload under the `file` field." },
      { status: 400 },
    );
  }

  const maxUploadBytes = parseMaxUploadBytes();
  if (file.size > maxUploadBytes) {
    return Response.json(
      {
        error: `File is too large. The current limit is ${(maxUploadBytes / (1024 * 1024)).toFixed(1)} MB.`,
      },
      { status: 413 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const dataUri = `data:${file.type || "application/octet-stream"};base64,${buffer.toString("base64")}`;

  try {
    const markdown = await convertUriToMarkdown(dataUri);
    return Response.json({ markdown: markdown.trim(), fileName: file.name });
  } catch (error) {
    console.error("[markitdown] Failed to convert uploaded file", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to convert the uploaded file with MarkItDown.";
    return Response.json({ error: message }, { status: 502 });
  }
}
