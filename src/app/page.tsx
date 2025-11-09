"use client";
import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
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

type PdfLayoutOptions = {
  pageSize: "letter" | "a4" | "a3" | "a5" | "legal" | "tabloid";
  margin: "normal" | "narrow" | "wide";
  orientation: "portrait" | "landscape";
  showPageNumbers: boolean;
  watermark: string;
  watermarkScope: "all-pages" | "first-page";
};

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
    available: "remote",
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
        suggestions="manual"
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
  const [viewMode, setViewMode] = useState<"preview" | "edit">("preview");
  const [draftMarkdown, setDraftMarkdown] = useState(markdownResume);
  const [isFormatting, setIsFormatting] = useState(false);
  const [formattingStatus, setFormattingStatus] = useState<string | null>(null);
  const [formattingError, setFormattingError] = useState<string | null>(null);
  const [pdfOptions, setPdfOptions] = useState<PdfLayoutOptions>({
    pageSize: "letter",
    margin: "normal",
    orientation: "portrait",
    showPageNumbers: false,
    watermark: "",
    watermarkScope: "all-pages",
  });
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfStatus, setPdfStatus] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
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

  useEffect(() => {
    if (viewMode === "preview") {
      setDraftMarkdown(markdownResume);
    }
  }, [markdownResume, viewMode]);

  const enterEditMode = () => {
    setDraftMarkdown(markdownResume);
    setViewMode("edit");
  };

  const exitEditMode = () => {
    setDraftMarkdown(markdownResume);
    setViewMode("preview");
  };

  const handleSaveDraft = () => {
    const sanitizedDraft = sanitizeMarkdownPayload(draftMarkdown);
    applyResumeUpdate(sanitizedDraft);
    setViewMode("preview");
  };

  const handleImproveFormatting = useCallback(async () => {
    if (isFormatting) {
      return;
    }

    setIsFormatting(true);
    setFormattingStatus(null);
    setFormattingError(null);

    try {
      const response = await fetch("/api/format-resume", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          markdown: markdownResume,
        }),
      });

      const payload = (await response.json()) as {
        markdown?: string;
        summary?: string;
        error?: string;
      };

      if (!response.ok || typeof payload.markdown !== "string") {
        throw new Error(payload.error || "Formatter agent returned an unexpected response.");
      }

      const sanitized = sanitizeMarkdownPayload(payload.markdown);
      applyResumeUpdate(sanitized);
      setDraftMarkdown(sanitized);
      setFormattingStatus(payload.summary?.trim() || "Applied formatting improvements.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to format the resume markdown.";
      setFormattingError(message);
    } finally {
      setIsFormatting(false);
    }
  }, [applyResumeUpdate, isFormatting, markdownResume]);

  const updatePdfOption = useCallback(
    (key: keyof PdfLayoutOptions, value: PdfLayoutOptions[keyof PdfLayoutOptions]) => {
      setPdfOptions((prev) => {
        if (prev[key] === value) {
          return prev;
        }

        return {
          ...prev,
          [key]: value,
        };
      });
    },
    [],
  );

  const handleWatermarkChange = useCallback((value: string) => {
    const sanitized = value.toUpperCase().replace(/[^A-Z0-9 -]/g, "").slice(0, 15);
    setPdfOptions((prev) => {
      if (prev.watermark === sanitized) {
        return prev;
      }

      return {
        ...prev,
        watermark: sanitized,
      };
    });
  }, []);

  const handleDownloadPdf = useCallback(async () => {
    setIsGeneratingPdf(true);
    setPdfStatus(null);
    setPdfError(null);

    try {
      const watermarkValue = pdfOptions.watermark.trim();
      const requestPayload = {
        markdown: markdownResume,
        pageSize: pdfOptions.pageSize,
        margin: pdfOptions.margin,
        orientation: pdfOptions.orientation,
        showPageNumbers: pdfOptions.showPageNumbers,
        watermark: watermarkValue ? watermarkValue : undefined,
        watermarkScope: watermarkValue ? pdfOptions.watermarkScope : undefined,
      };

      const response = await fetch("/api/resume-pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestPayload),
      });

      const payload = (await response.json()) as
        | {
            kind: "pdf";
            pdfBase64: string;
            fileName: string;
            contentType: string;
            byteLength: number;
            layout?: {
              pageSize: PdfLayoutOptions["pageSize"];
              margin: PdfLayoutOptions["margin"];
              orientation: PdfLayoutOptions["orientation"];
              showPageNumbers: boolean;
              watermark?: string;
              watermarkScope?: PdfLayoutOptions["watermarkScope"];
            };
            log?: string;
            error?: string;
          }
        | {
            kind: "markdown-download";
            markdown: string;
            fileName: string;
            contentType: string;
            byteLength: number;
            reason?: string;
            error?: string;
          }
        | { error?: string };

      if (!response.ok) {
        throw new Error(
          (typeof payload === "object" && payload && "error" in payload && payload.error) ||
            "PDF generator returned an unexpected response.",
        );
      }

      if (
        typeof payload === "object" &&
        payload &&
        "kind" in payload &&
        payload.kind === "markdown-download"
      ) {
        const blob = new Blob([payload.markdown], {
          type: payload.contentType || "text/markdown",
        });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = payload.fileName.endsWith(".md")
          ? payload.fileName
          : `${payload.fileName}.md`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);

        const reason = payload.reason?.trim();
        const sanitizedReason = reason ? reason.replace(/\.*$/g, "") : null;
        const suffix = sanitizedReason ? ` (Fallback: ${sanitizedReason})` : "";
        setPdfStatus(`Downloaded ${payload.fileName}${suffix}.`);
        return;
      }

      const pdfPayload =
        payload &&
        typeof payload === "object" &&
        "pdfBase64" in payload &&
        typeof payload.pdfBase64 === "string" &&
        "fileName" in payload &&
        typeof payload.fileName === "string"
          ? (payload as {
              kind?: "pdf";
              pdfBase64: string;
              fileName: string;
              contentType?: string;
              layout?: {
                pageSize: PdfLayoutOptions["pageSize"];
                margin: PdfLayoutOptions["margin"];
                orientation: PdfLayoutOptions["orientation"];
                showPageNumbers: boolean;
                watermark?: string;
                watermarkScope?: PdfLayoutOptions["watermarkScope"];
              };
              log?: string;
            })
          : null;

      if (!pdfPayload) {
        throw new Error(
          (typeof payload === "object" && payload && "error" in payload && payload.error) ||
            "PDF generator returned an unexpected response.",
        );
      }

      const binary = window.atob(pdfPayload.pdfBase64);
      const buffer = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        buffer[index] = binary.charCodeAt(index);
      }

      const blob = new Blob([buffer], {
        type: pdfPayload.contentType || "application/pdf",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = pdfPayload.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      const layoutSummary = pdfPayload.layout
        ? [
            pdfPayload.layout.pageSize.toUpperCase(),
            pdfPayload.layout.orientation === "landscape" ? "Landscape" : "Portrait",
            `${pdfPayload.layout.margin} margin`,
            pdfPayload.layout.showPageNumbers ? "Page numbers" : null,
            pdfPayload.layout.watermark ? `Watermark (${pdfPayload.layout.watermarkScope})` : null,
          ]
            .filter(Boolean)
            .join(" • ")
        : undefined;
      setPdfStatus(
        layoutSummary
          ? `Downloaded ${pdfPayload.fileName} (${layoutSummary}).`
          : `Downloaded ${pdfPayload.fileName}.`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to generate the resume PDF.";
      setPdfError(message);
    } finally {
      setIsGeneratingPdf(false);
    }
  }, [markdownResume, pdfOptions]);

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
    available: "remote",
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
        <MarkdownResumePanel
          markdown={markdownResume}
          draftMarkdown={draftMarkdown}
          mode={viewMode}
          onEnterEditMode={enterEditMode}
          onCancelEdit={exitEditMode}
          onSaveDraft={handleSaveDraft}
          onDraftChange={setDraftMarkdown}
          themeColor={themeColor}
          onImproveFormatting={handleImproveFormatting}
          improvingFormatting={isFormatting}
          formattingStatus={formattingStatus}
          formattingError={formattingError}
          pdfOptions={pdfOptions}
          onPdfOptionChange={updatePdfOption}
          onWatermarkChange={handleWatermarkChange}
          onDownloadPdf={handleDownloadPdf}
          downloadingPdf={isGeneratingPdf}
          pdfStatus={pdfStatus}
          pdfError={pdfError}
        />
        {viewMode === "edit" && (
          <MarkitdownImportCard
            themeColor={themeColor}
            onImport={(markdown) => {
              const sanitized = sanitizeMarkdownPayload(markdown);
              setDraftMarkdown(sanitized);
              applyResumeUpdate(sanitized);
            }}
          />
        )}
        {viewMode === "preview" && (
          <p className="text-center text-sm text-white/80 max-w-2xl">
            Tip: Ask the copilot to rearrange sections, rewrite bullet points, or evolve
            the story you want to tell.
          </p>
        )}
      </div>
    </div>
  );
}

function MarkdownResumePanel({
  markdown,
  themeColor,
  draftMarkdown,
  onDraftChange,
  mode,
  onEnterEditMode,
  onCancelEdit,
  onSaveDraft,
  onImproveFormatting,
  improvingFormatting,
  formattingStatus,
  formattingError,
  pdfOptions,
  onPdfOptionChange,
  onWatermarkChange,
  onDownloadPdf,
  downloadingPdf,
  pdfStatus,
  pdfError,
}: {
  markdown: string;
  themeColor: string;
  draftMarkdown: string;
  onDraftChange: (value: string) => void;
  mode: "preview" | "edit";
  onEnterEditMode: () => void;
  onCancelEdit: () => void;
  onSaveDraft: () => void;
  onImproveFormatting: () => void;
  improvingFormatting: boolean;
  formattingStatus: string | null;
  formattingError: string | null;
  pdfOptions: PdfLayoutOptions;
  onPdfOptionChange: (
    key: keyof PdfLayoutOptions,
    value: PdfLayoutOptions[keyof PdfLayoutOptions],
  ) => void;
  onWatermarkChange: (value: string) => void;
  onDownloadPdf: () => void;
  downloadingPdf: boolean;
  pdfStatus: string | null;
  pdfError: string | null;
}) {
  const previewElements = renderMarkdown(mode === "edit" ? draftMarkdown : markdown);

  return (
    <section
      className="w-full max-w-5xl rounded-3xl border border-white/25 bg-white/10 text-white shadow-2xl backdrop-blur"
      style={{ borderColor: themeColor }}
    >
      <div className="px-8 py-8 md:py-10 space-y-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-[0.3em] text-white/60">
              Markdown Resume
            </span>
            <h2 className="text-3xl font-semibold" style={{ color: themeColor }}>
              {mode === "preview" ? "Preview" : "Edit Mode"}
            </h2>
            <p className="text-sm text-white/70">
              {mode === "preview"
                ? "Review the rendered resume. Switch to edit mode to make direct markdown updates."
                : "Adjust the markdown directly. Save changes to update the live preview and share with the copilot."}
            </p>
          </div>
          <div className="flex w-full flex-col items-start gap-3 md:w-auto md:items-end">
            {mode === "preview" && (
              <>
                <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center md:justify-end md:gap-3">
                  <button
                    type="button"
                    onClick={onImproveFormatting}
                    disabled={improvingFormatting}
                    className="rounded-full border border-white/30 px-4 py-2 text-sm font-medium text-white/80 transition-colors hover:text-white disabled:opacity-60"
                  >
                    {improvingFormatting ? "Formatting…" : "Improve Formatting"}
                  </button>
                  <button
                    type="button"
                    onClick={onEnterEditMode}
                    className="rounded-full border px-4 py-2 text-sm font-medium text-white transition-colors"
                    style={{
                      borderColor: themeColor,
                      backgroundColor: themeColor,
                    }}
                  >
                    Edit Resume
                  </button>
                </div>
                <div className="flex w-full flex-col gap-2 md:items-end">
                  <button
                    type="button"
                    onClick={onDownloadPdf}
                    disabled={downloadingPdf}
                    className="rounded-full border px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-60"
                    style={{
                      borderColor: themeColor,
                      backgroundColor: downloadingPdf ? "transparent" : themeColor,
                      color: downloadingPdf ? "rgba(255,255,255,0.8)" : "#ffffff",
                    }}
                  >
                    {downloadingPdf ? "Generating PDF…" : "Download PDF"}
                  </button>
                  <div className="grid w-full grid-cols-1 gap-3 text-xs text-white/80 md:w-[26rem] md:grid-cols-2">
                    <label className="flex flex-col gap-1">
                      <span className="uppercase tracking-[0.2em] text-white/50">
                        Page Size
                      </span>
                      <select
                        value={pdfOptions.pageSize}
                        onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                          onPdfOptionChange(
                            "pageSize",
                            event.target.value as PdfLayoutOptions["pageSize"],
                          )
                        }
                        className="rounded-2xl border border-white/30 bg-slate-950/60 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-white/30"
                      >
                        <option value="letter">Letter</option>
                        <option value="a4">A4</option>
                        <option value="legal">Legal</option>
                        <option value="a3">A3</option>
                        <option value="a5">A5</option>
                        <option value="tabloid">Tabloid</option>
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="uppercase tracking-[0.2em] text-white/50">
                        Orientation
                      </span>
                      <select
                        value={pdfOptions.orientation}
                        onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                          onPdfOptionChange(
                            "orientation",
                            event.target.value as PdfLayoutOptions["orientation"],
                          )
                        }
                        className="rounded-2xl border border-white/30 bg-slate-950/60 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-white/30"
                      >
                        <option value="portrait">Portrait</option>
                        <option value="landscape">Landscape</option>
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="uppercase tracking-[0.2em] text-white/50">
                        Margins
                      </span>
                      <select
                        value={pdfOptions.margin}
                        onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                          onPdfOptionChange(
                            "margin",
                            event.target.value as PdfLayoutOptions["margin"],
                          )
                        }
                        className="rounded-2xl border border-white/30 bg-slate-950/60 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-white/30"
                      >
                        <option value="normal">Normal</option>
                        <option value="narrow">Narrow</option>
                        <option value="wide">Wide</option>
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="uppercase tracking-[0.2em] text-white/50">
                        Page Numbers
                      </span>
                      <div className="rounded-2xl border border-white/30 bg-slate-950/60 px-3 py-2">
                        <label className="flex items-center gap-2 text-white/80">
                          <input
                            type="checkbox"
                            checked={pdfOptions.showPageNumbers}
                            onChange={(event: ChangeEvent<HTMLInputElement>) =>
                              onPdfOptionChange("showPageNumbers", event.target.checked)
                            }
                            className="h-4 w-4 accent-current"
                          />
                          <span>Show footer page numbers</span>
                        </label>
                      </div>
                    </label>
                    <label className="flex flex-col gap-1 md:col-span-2">
                      <span className="uppercase tracking-[0.2em] text-white/50">
                        Watermark
                      </span>
                      <input
                        type="text"
                        value={pdfOptions.watermark}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          onWatermarkChange(event.target.value)
                        }
                        placeholder="Optional (max 15 characters)"
                        className="rounded-2xl border border-white/30 bg-slate-950/60 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-white/30"
                      />
                    </label>
                    <label className="flex flex-col gap-1 md:col-span-2">
                      <span className="uppercase tracking-[0.2em] text-white/50">
                        Watermark Scope
                      </span>
                      <select
                        value={pdfOptions.watermarkScope}
                        onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                          onPdfOptionChange(
                            "watermarkScope",
                            event.target.value as PdfLayoutOptions["watermarkScope"],
                          )
                        }
                        disabled={pdfOptions.watermark.trim().length === 0}
                        className="rounded-2xl border border-white/30 bg-slate-950/60 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-white/30 disabled:opacity-60"
                      >
                        <option value="all-pages">All Pages</option>
                        <option value="first-page">First Page Only</option>
                      </select>
                    </label>
                  </div>
                </div>
              </>
            )}
            {mode === "edit" && (
              <>
                <button
                  type="button"
                  onClick={onSaveDraft}
                  className="rounded-full border px-4 py-2 text-sm font-medium text-white transition-colors"
                  style={{
                    borderColor: themeColor,
                    backgroundColor: themeColor,
                  }}
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={onCancelEdit}
                  className="rounded-full border border-white/25 px-4 py-2 text-sm font-medium text-white/80 transition-colors hover:text-white"
                >
                  Cancel
                </button>
              </>
            )}
            {mode === "preview" && (
              <div className="flex w-full flex-col gap-1 md:items-end">
                {formattingError && <p className="text-xs text-rose-300">{formattingError}</p>}
                {!formattingError && formattingStatus && (
                  <p className="text-xs text-emerald-300">{formattingStatus}</p>
                )}
                {pdfError && <p className="text-xs text-rose-300">{pdfError}</p>}
                {!pdfError && pdfStatus && (
                  <p className="text-xs text-emerald-300">{pdfStatus}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {mode === "preview" ? (
          <div className="space-y-4 leading-relaxed">
            {previewElements.length > 0 ? (
              previewElements
            ) : (
              <p className="text-sm text-white/60 italic">No markdown content yet.</p>
            )}
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="text-xs uppercase tracking-[0.25em] text-white/60">
                Live Preview
              </h3>
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
                Markdown Editor
              </h3>
              <textarea
                value={draftMarkdown}
                onChange={(event) => onDraftChange(event.target.value)}
                className="mt-3 min-h-[24rem] flex-1 rounded-2xl border border-white/20 bg-slate-950/60 p-4 text-sm font-mono text-white/90 focus:outline-none focus:ring-2"
                style={{ borderColor: themeColor }}
              />
            </div>
          </div>
        )}
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
            When the service is offline, PDF uploads fall back to a bundled parser so the import keeps working, while other formats still require the remote server.
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
            Ensure the MarkItDown MCP server is reachable (set <code>MARKITDOWN_MCP_URL</code>) for DOCX and other rich formats; PDF uploads fall back to the bundled parser when the service is offline.
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
