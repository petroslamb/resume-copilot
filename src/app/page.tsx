"use client";
import { ReactNode, useState } from "react";
import { z } from "zod";
import { useCoAgent, useCopilotAction } from "@copilotkit/react-core";
import { CopilotKitCSSProperties, CopilotSidebar } from "@copilotkit/react-ui";
import { AgentState as AgentStateSchema, ResumeSchema } from "@/mastra/agents/schema";
import { jsonrepair } from "jsonrepair";

type AgentState = z.infer<typeof AgentStateSchema>;
type Resume = AgentState["resume"];

const defaultResume: Resume = {
  basics: {
    name: "Jordan Carter",
    title: "Senior Product Engineer",
    location: "San Francisco, CA",
    email: "jordan.carter@example.com",
    phone: "(415) 555-1287",
    website: "https://jordancarter.dev",
  },
  summary:
    "Builder and storyteller who bridges product vision with polished execution. 8+ years shipping user-first web experiences, leading cross-functional squads, and mentoring engineers.",
  experience: [
    {
      role: "Senior Product Engineer",
      company: "Northwind Labs",
      start: "2021",
      end: "Present",
      location: "Remote",
      highlights: [
        "Led a squad of 5 engineers to deliver a multi-tenant analytics suite used by 30+ enterprise clients.",
        "Partnered with design and research to rework onboarding, boosting activation by 18%.",
        "Introduced a component library and documentation that cut prototyping time in half.",
      ],
    },
    {
      role: "Full-Stack Engineer",
      company: "Lighthouse Systems",
      start: "2017",
      end: "2021",
      location: "Austin, TX",
      highlights: [
        "Owned the customer insights pipeline, scaling it to process 2M+ monthly events.",
        "Implemented accessibility checks across the build pipeline and championed inclusive design.",
        "Mentored 6 junior developers through their first production launches.",
      ],
    },
  ],
  education: [
    {
      school: "University of Texas at Austin",
      degree: "B.S. in Computer Science",
      start: "2013",
      end: "2017",
      location: "Austin, TX",
      details: "Dean's List, Human Centered Design track",
    },
  ],
  projects: [
    {
      name: "LaunchPad",
      description:
        "Open-source starter kit for SaaS dashboards with theming, auth, and billing scaffolding.",
      link: "https://github.com/jordancarter/launchpad",
      timeframe: "2023",
      highlights: [
        "Hit 1.2k GitHub stars in 3 months with contributions from 40+ developers.",
      ],
    },
  ],
  skills: [
    "Product Strategy",
    "TypeScript",
    "React & Next.js",
    "Design Systems",
    "Node.js",
    "Team Leadership",
  ],
};

const partialResumeSchema = ResumeSchema.deepPartial();
type ResumeUpdate = z.infer<typeof partialResumeSchema>;

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
            "👋 I help you polish this resume. Try: \"Add a bullet about leading design workshops\" or \"Update the skills to emphasize AI tooling\". I can also tweak the accent color with \"Set the theme to emerald\".",
        }}
      />
    </main>
  );
}

function YourMainContent({ themeColor }: { themeColor: string }) {
  const { state, setState } = useCoAgent<AgentState>({
    name: "resumeAgent",
    initialState: {
      resume: defaultResume,
    },
  });

  const resume = state.resume ?? defaultResume;

  useCopilotAction({
    name: "updateResume",
    description:
      "Apply structured edits to the resume shared state. Provide only the fields that should change. When editing list sections, send the entire updated array.",
    parameters: [
      {
        name: "resume",
        description:
          "Partial resume object (JSON) that will be merged with the current state.",
        required: true,
      },
    ],
    handler({ resume: updates }) {
      let parsed: unknown = updates;

      if (typeof parsed === "string") {
        parsed = parseWithRepair(parsed);
      }

      if (parsed === undefined) {
        return;
      }

      const result = partialResumeSchema.safeParse(parsed);
      if (!result.success) {
        console.warn("Resume update rejected:", result.error.flatten());
        return;
      }

      setState((previous) => {
        const currentResume = previous.resume ?? defaultResume;

        return {
          ...previous,
          resume: mergeResume(currentResume, result.data),
        };
      });
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
        <p className="font-semibold">Resume updated</p>
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
      <ResumeView resume={resume} themeColor={themeColor} />
      <p className="mt-6 text-center text-sm text-white/80 max-w-2xl">
        Tip: Ask the copilot to rearrange sections, rewrite bullet points, or evolve
        the story you want to tell.
      </p>
    </div>
  );
}

function ResumeView({ resume, themeColor }: { resume: Resume; themeColor: string }) {
  return (
    <article className="w-full max-w-5xl bg-white/95 text-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-white/40">
      <header
        className="px-8 py-10 text-white"
        style={{
          background: `linear-gradient(140deg, ${themeColor}, #1f2937)`,
        }}
      >
        <p className="text-sm tracking-[0.2em] uppercase text-white/70">
          {resume.basics.title}
        </p>
        <h1 className="text-4xl md:text-5xl font-semibold mt-3">
          {resume.basics.name}
        </h1>
        <p className="mt-4 text-xs md:text-sm uppercase tracking-[0.3em] text-white/70">
          {[resume.basics.location, resume.basics.email, resume.basics.phone]
            .filter(Boolean)
            .join(" | ")}
        </p>
      </header>

      <div className="grid gap-10 md:grid-cols-[2fr,1fr] p-8 md:p-10">
        <div className="space-y-10">
          <Section title="Summary">
            <p>{resume.summary}</p>
          </Section>

          {resume.experience.length > 0 && (
            <Section title="Experience">
              {resume.experience.map((item, index) => (
                <div key={`${item.company}-${item.role}-${index}`} className="space-y-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-base font-semibold text-slate-900">
                      {item.role} · {item.company}
                    </p>
                    <p className="text-xs text-slate-500">
                      {item.start} - {item.end}
                    </p>
                  </div>
                  {item.location && (
                    <p className="text-xs uppercase tracking-wide text-slate-400">
                      {item.location}
                    </p>
                  )}
                  {item.highlights.length > 0 && (
                    <ul className="list-disc pl-5 space-y-1 text-sm text-slate-700">
                      {item.highlights.map((highlight, highlightIndex) => (
                        <li key={highlightIndex}>{highlight}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </Section>
          )}

          {resume.projects.length > 0 && (
            <Section title="Projects">
              {resume.projects.map((project, index) => (
                <div key={`${project.name}-${index}`} className="space-y-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-base font-semibold text-slate-900">
                      {project.name}
                    </p>
                    {project.timeframe && (
                      <p className="text-xs text-slate-500">{project.timeframe}</p>
                    )}
                  </div>
                  <p className="text-sm text-slate-700">{project.description}</p>
                  {project.link && (
                    <a
                      className="text-sm font-medium"
                      style={{ color: themeColor }}
                      href={project.link}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {project.link}
                    </a>
                  )}
                  {project.highlights.length > 0 && (
                    <ul className="list-disc pl-5 space-y-1 text-sm text-slate-700">
                      {project.highlights.map((highlight, highlightIndex) => (
                        <li key={highlightIndex}>{highlight}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </Section>
          )}
        </div>

        <aside className="space-y-8">
          <Section title="Contact">
            <ContactLine label="Location" value={resume.basics.location} />
            <ContactLine label="Email" value={resume.basics.email} />
            <ContactLine label="Phone" value={resume.basics.phone} />
            {resume.basics.website && (
              <ContactLine label="Website" value={resume.basics.website} />
            )}
          </Section>

          {resume.skills.length > 0 && (
            <Section title="Skills">
              <div className="flex flex-wrap gap-2">
                {resume.skills.map((skill) => (
                  <span
                    key={skill}
                    className="px-3 py-1 rounded-full text-xs font-semibold text-white"
                    style={{ backgroundColor: themeColor }}
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {resume.education.length > 0 && (
            <Section title="Education">
              {resume.education.map((item, index) => (
                <div key={`${item.school}-${index}`} className="space-y-1">
                  <p className="text-base font-semibold text-slate-900">
                    {item.degree}
                  </p>
                  <p className="text-sm text-slate-700">{item.school}</p>
                  <p className="text-xs text-slate-500">
                    {item.start} - {item.end}
                  </p>
                  {item.location && (
                    <p className="text-xs uppercase tracking-wide text-slate-400">
                      {item.location}
                    </p>
                  )}
                  {item.details && (
                    <p className="text-xs text-slate-500">{item.details}</p>
                  )}
                </div>
              ))}
            </Section>
          )}
        </aside>
      </div>
    </article>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-xs font-semibold tracking-[0.25em] uppercase text-slate-500">
        {title}
      </h2>
      <div className="space-y-4 text-sm text-slate-700">{children}</div>
    </section>
  );
}

function ContactLine({ label, value }: { label: string; value?: string }) {
  if (!value) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1 text-sm">
      <span className="text-xs uppercase tracking-wide text-slate-400">{label}</span>
      <span className="font-medium text-slate-700 break-words">{value}</span>
    </div>
  );
}

function parseCandidate(value: string): unknown {
  if (!value.trim()) {
    return undefined;
  }

  try {
    return JSON.parse(value);
  } catch {
    try {
      return JSON.parse(jsonrepair(value));
    } catch {
      return undefined;
    }
  }
}

function stripCodeFence(raw: string): string | undefined {
  const match = raw.trim().match(/```[a-zA-Z0-9-]*\s*\n([\s\S]*?)\n?```/);
  return match ? match[1].trim() : undefined;
}

function extractLikelyJsonFragment(raw: string): string | undefined {
  const trimmed = raw.trim();
  const braceIndex = trimmed.indexOf("{");
  const bracketIndex = trimmed.indexOf("[");
  const startCandidates = [braceIndex, bracketIndex].filter((index) => index !== -1);
  if (startCandidates.length === 0) {
    return undefined;
  }

  const start = Math.min(...startCandidates);
  const remainder = trimmed.slice(start);
  const braceEnd = remainder.lastIndexOf("}");
  const bracketEnd = remainder.lastIndexOf("]");
  const endCandidates = [braceEnd, bracketEnd].filter((index) => index !== -1);
  if (endCandidates.length === 0) {
    return undefined;
  }

  const end = Math.max(...endCandidates);
  return remainder.slice(0, end + 1).trim();
}

function parseWithRepair(raw: string): unknown {
  const attempts = new Set<string>();
  const trimmed = raw.trim();

  if (trimmed) {
    attempts.add(trimmed);
  }

  const fenced = stripCodeFence(raw);
  if (fenced) {
    attempts.add(fenced);
  }

  const fragment = extractLikelyJsonFragment(raw);
  if (fragment) {
    attempts.add(fragment);
  }

  for (const attempt of attempts) {
    const parsed = parseCandidate(attempt);
    if (parsed !== undefined) {
      return parsed;
    }
  }

  const preview = trimmed.length > 500 ? `${trimmed.slice(0, 500)}...` : trimmed;

  console.warn("Failed to parse resume update payload after repair attempts.", {
    preview,
  });

  return undefined;
}

function mergeResume(base: Resume, updates: ResumeUpdate): Resume {
  const basics = updates.basics ? { ...base.basics, ...updates.basics } : base.basics;

  return {
    ...base,
    ...updates,
    basics,
    experience: updates.experience ?? base.experience,
    education: updates.education ?? base.education,
    projects: updates.projects ?? base.projects,
    skills: updates.skills ?? base.skills,
  };
}
