import { createTool } from "@mastra/core/tools";
import { RuntimeContext } from "@mastra/core/runtime-context";
import { z } from "zod";
import { resumeFormatterAgent } from "../agents/formatter";

const FormatResumeResultSchema = z.object({
  markdown: z
    .string()
    .describe("The fully rewritten markdown resume with improved formatting."),
  summary: z
    .string()
    .describe("Short summary of the formatting adjustments that were made."),
});

const FormatResumeInputSchema = z.object({
  markdown: z
    .string()
    .min(1, "Provide the markdown content that should be reformatted.")
    .describe("Existing resume markdown to polish."),
  styleHints: z
    .string()
    .optional()
    .describe(
      "Optional high-level style direction such as ATS-friendly, modern, or academic.",
    ),
});

const DEFAULT_STYLE_HINT =
  "Ensure headings, spacing, and bullet lists follow best practices for a professional resume preview.";

type FormatResumeInput = z.infer<typeof FormatResumeInputSchema>;
type FormatResumeResult = z.infer<typeof FormatResumeResultSchema>;

async function runFormatterAgent(
  { markdown, styleHints }: FormatResumeInput,
  runtimeContext?: RuntimeContext,
): Promise<FormatResumeResult> {
  const messages = [
    {
      role: "user" as const,
      content: [
        {
          type: "text" as const,
          text: [
            "Polish the resume markdown so it renders cleanly in a professional preview.",
            `Style guidance: ${styleHints?.trim() || DEFAULT_STYLE_HINT}`,
            "",
            "Return ONLY a JSON object with this shape (no code fences):",
            '{ "markdown": "<full rewritten markdown>", "summary": "<short change summary>" }',
            "",
            "Resume markdown:",
            markdown,
          ].join("\n"),
        },
      ],
    },
  ];

  const response = await resumeFormatterAgent.generateVNext(messages, {
    runtimeContext,
    maxSteps: 3,
  });

  const rawText = typeof response.text === "string" ? response.text.trim() : "";
  if (rawText) {
    try {
      const sanitized = rawText
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```$/i, "")
        .trim();
      const parsed = JSON.parse(sanitized) as Partial<FormatResumeResult>;
      if (typeof parsed.markdown === "string" && typeof parsed.summary === "string") {
        return parsed as FormatResumeResult;
      }
    } catch {
      // fall through to final fallback
    }

    return {
      markdown: rawText,
      summary: "Formatter returned unstructured markdown; showing the direct output.",
    };
  }

  return {
    markdown,
    summary: "Formatter could not adjust the markdown. Showing original content.",
  };
}

export const formatResumeTool = createTool({
  id: "formatResumeMarkdown",
  description:
    "Clean up resume markdown by normalizing headings, spacing, and bullet lists without changing factual content.",
  inputSchema: FormatResumeInputSchema,
  outputSchema: FormatResumeResultSchema,
  execute: async ({ context, runtimeContext }) => {
    return runFormatterAgent(context, runtimeContext);
  },
});

export async function formatResumeMarkdown(
  input: FormatResumeInput,
  runtimeContext?: RuntimeContext,
): Promise<FormatResumeResult> {
  return runFormatterAgent(input, runtimeContext);
}

export function getFormatterTools() {
  return {
    formatResumeMarkdown: formatResumeTool,
  };
}
