"use client";
import { ReactNode, useCallback, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useCopilotAction, useCopilotReadable, useCoAgent } from "@copilotkit/react-core";
import { CopilotKitCSSProperties, CopilotSidebar } from "@copilotkit/react-ui";
import type { AgentStateType } from "@/mastra/agents/schema";

const markdownResumeTemplate = `# Resume Snapshot

## Summary

- 

## Experience

- 

## Education

- 

## Projects

- 

## Skills

- `;

function sanitizeMarkdownPayload(input: string): string {
  const trimmed = input.trim();
  if (!trimmed.startsWith("```")) {
    return input;
  }

  const fenceMatch = trimmed.match(/^```[a-zA-Z0-9_-]*\s*\n([\s\S]*?)\n?```$/);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }

  return input;
}

export default function CopilotKitPage() {
  const [themeColor, setThemeColor] = useState("#2563eb");

  useCopilotAction({
    name: "setThemeColor",
    parameters: [
      {
        name: "themeColor",
        description: "Hex or CSS color value for the resume accent.",
        required: true,
      },
    ],
    handler({ themeColor }) {
      if (!themeColor) return;
      setThemeColor(themeColor);
    },
  });

  return (
    <main
      style={{ "--copilot-kit-primary-color": themeColor } as CopilotKitCSSProperties}
    >
      <YourMainContent themeColor={themeColor} />
      <CopilotSidebar
        clickOutsideToClose={false}
        defaultOpen={true}
        labels={{
          title: "Resume Copilot",
          initial:
            "👋 I help you polish this resume. Try: \"Add a bullet about leading design workshops\" or \"Update the skills to emphasize AI tooling\". I can also rewrite the markdown panel or tweak the accent color with \"Set the theme to emerald\".",
        }}
      />
    </main>
  );
}

function YourMainContent({ themeColor }: { themeColor: string }) {
  const { state: agentState, setState: setAgentState } = useCoAgent<AgentStateType>({
    name: "resumeAgent",
    initialState: { markdownResume: markdownResumeTemplate },
  });
  const markdownResume = agentState?.markdownResume ?? markdownResumeTemplate;
  const applyResumeUpdate = useCallback(
    (nextMarkdown: string) => {
      setAgentState((prev) => {
        const current = prev ?? { markdownResume: markdownResumeTemplate };
        const previousValue = typeof current.markdownResume === "string" ? current.markdownResume : "";
        if (previousValue.trim() === nextMarkdown.trim()) {
          return current;
        }

        return {
          ...current,
          markdownResume: nextMarkdown,
        };
      });
    },
    [setAgentState],
  );

  useCopilotReadable(
    {
      description: "Markdown resume template content",
      value: markdownResume,
      convert: (_, value) => String(value ?? ""),
    },
    [markdownResume],
  );

  useCopilotAction({
    name: "updateMarkdownResume",
    description:
      "Replace the markdown resume document shown in the preview panel. Always send the complete markdown string shaped by the shared headings.",
    parameters: [
      {
        name: "markdown",
        description: "Full markdown resume document using the provided headings.",
        required: true,
      },
    ],
    handler({ markdown }) {
      if (typeof markdown !== "string") {
        console.warn("Markdown resume update ignored: expected a string payload.");
        return;
      }

      const sanitizedMarkdown = sanitizeMarkdownPayload(markdown);

      applyResumeUpdate(sanitizedMarkdown);
    },
  });

  useCopilotAction({
    name: "renderWorkingMemoryUpdate",
    available: "frontend",
    render: ({ args }) => (
      <div
        className="rounded-2xl max-w-md w-full text-white p-4 border border-white/20 bg-white/10 backdrop-blur"
        style={{ borderColor: themeColor }}
      >
        <p className="font-semibold">Markdown resume updated</p>
        {args?.summary && (
          <p className="text-sm text-white/80 mt-1">{String(args.summary)}</p>
        )}
        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-white/80">
            See context sent to memory
          </summary>
          <pre className="overflow-x-auto text-xs bg-white/20 p-3 rounded-lg mt-2">
            {JSON.stringify(args, null, 2)}
          </pre>
        </details>
      </div>
    ),
  });

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center px-4 py-12 transition-colors duration-300"
      style={{
        background: `radial-gradient(circle at top, ${themeColor} 0%, #0f172a 55%, #020617 100%)`,
      }}
    >
      <div className="w-full flex flex-col items-center gap-8">
        <MarkdownResumePanel markdown={markdownResume} themeColor={themeColor} />
        <MarkitdownImportCard
          themeColor={themeColor}
          onImport={(markdown) => {
            applyResumeUpdate(sanitizeMarkdownPayload(markdown));
          }}
        />
        <p className="text-center text-sm text-white/80 max-w-2xl">
          Tip: Ask the copilot to rearrange sections, rewrite bullet points, or evolve
          the story you want to tell.
        </p>
      </div>
    </div>
  );
}

function MarkdownResumePanel({
  markdown,
  themeColor,
}: {
  markdown: string;
  themeColor: string;
}) {
  const previewElements = renderMarkdown(markdown);

  return (
    <section
      className="w-full max-w-5xl rounded-3xl border border-white/25 bg-white/10 text-white shadow-2xl backdrop-blur"
      style={{ borderColor: themeColor }}
    >
      <div className="px-8 py-8 md:py-10 space-y-4">
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-[0.3em] text-white/60">
            Markdown Resume
          </span>
          <h2 className="text-3xl font-semibold" style={{ color: themeColor }}>
            Template View
          </h2>
          <p className="text-sm text-white/70">
            Copilot can rewrite this document via the <code>updateMarkdownResume</code> action.
            Start from the empty headings below and evolve the narrative as needed.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="text-xs uppercase tracking-[0.25em] text-white/60">Preview</h3>
            <div className="mt-3 space-y-4 leading-relaxed">
              {previewElements.length > 0 ? (
                previewElements
              ) : (
                <p className="text-sm text-white/60 italic">No markdown content yet.</p>
              )}
            </div>
          </div>
          <div className="flex flex-col">
            <h3 className="text-xs uppercase tracking-[0.25em] text-white/60">
              Markdown Source
            </h3>
            <pre className="mt-3 flex-1 whitespace-pre-wrap break-words rounded-2xl border border-white/15 bg-slate-950/40 p-4 text-xs font-mono text-white/80">
              {markdown || " "}
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}

function MarkitdownImportCard({
  themeColor,
  onImport,
}: {
  themeColor: string;
  onImport: (markdown: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFileSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setIsUploading(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/markitdown", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as {
        markdown?: string;
        error?: string;
        fileName?: string;
      };

      if (!response.ok || typeof payload.markdown !== "string") {
        throw new Error(payload.error || "MarkItDown conversion failed.");
      }

      onImport(payload.markdown);
      setStatusMessage(
        `${payload.fileName ?? file.name} converted with MarkItDown. Adjust the result as needed.`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to convert the file.";
      setErrorMessage(message);
    } finally {
      setIsUploading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  return (
    <div
      className="w-full max-w-3xl rounded-3xl border border-white/20 bg-white/10 backdrop-blur px-6 py-5 shadow-lg"
      style={{ borderColor: themeColor }}
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-white font-semibold">Import a resume with MarkItDown</p>
          <p className="text-sm text-white/80">
            Upload a PDF or DOCX to convert it into markdown using the MarkItDown MCP server.
            The converted text replaces the editor content so you can continue refining it with the copilot.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.doc,.docx,.html,.txt,.md"
            onChange={handleFileSelection}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
            className="rounded-full border px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
            style={{
              borderColor: themeColor,
              backgroundColor: isUploading ? "transparent" : themeColor,
            }}
          >
            {isUploading ? "Converting…" : "Select File"}
          </button>
        </div>
      </div>
      <div className="mt-3 text-sm">
        {statusMessage && <p className="text-emerald-300">{statusMessage}</p>}
        {errorMessage && <p className="text-rose-300">{errorMessage}</p>}
        {!statusMessage && !errorMessage && (
          <p className="text-white/60">
            Ensure the MarkItDown MCP server is reachable (set <code>MARKITDOWN_MCP_URL</code>) before uploading.
          </p>
        )}
      </div>
    </div>
  );
}
function renderMarkdown(markdown: string): ReactNode[] {
  const elements: ReactNode[] = [];
  let listBuffer: string[] = [];

  const flushList = (key: string) => {
    if (listBuffer.length === 0) {
      return;
    }

    elements.push(
      <ul key={`${key}-list`} className="list-disc pl-5 space-y-2 text-sm text-white/90">
        {listBuffer.map((item, index) => (
          <li key={`${key}-item-${index}`}>{item}</li>
        ))}
      </ul>,
    );

    listBuffer = [];
  };

  const lines = markdown.split(/\r?\n/);

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    const key = `md-${index}`;

    if (!trimmed) {
      flushList(key);
      return;
    }

    if (trimmed.startsWith("- ")) {
      listBuffer.push(trimmed.slice(2).trim());
      return;
    }

    flushList(key);

    if (trimmed.startsWith("### ")) {
      elements.push(
        <h3 key={key} className="text-lg font-semibold text-white">
          {trimmed.slice(4).trim()}
        </h3>,
      );
      return;
    }

    if (trimmed.startsWith("## ")) {
      elements.push(
        <h2 key={key} className="text-2xl font-semibold text-white">
          {trimmed.slice(3).trim()}
        </h2>,
      );
      return;
    }

    if (trimmed.startsWith("# ")) {
      elements.push(
        <h1 key={key} className="text-3xl font-semibold text-white">
          {trimmed.slice(2).trim()}
        </h1>,
      );
      return;
    }

    elements.push(
      <p key={key} className="text-sm text-white/90">
        {trimmed}
      </p>,
    );
  });

  flushList("final");

  return elements;
}
