import { z } from "zod";

export const ExperienceSchema = z.object({
  role: z.string(),
  company: z.string(),
  start: z.string(),
  end: z.string(),
  location: z.string().optional().default(""),
  highlights: z.array(z.string()).default([]),
});

export const EducationSchema = z.object({
  school: z.string(),
  degree: z.string(),
  start: z.string(),
  end: z.string(),
  location: z.string().optional().default(""),
  details: z.string().optional().default(""),
});

export const ProjectSchema = z.object({
  name: z.string(),
  description: z.string(),
  link: z.string().optional().default(""),
  timeframe: z.string().optional().default(""),
  highlights: z.array(z.string()).default([]),
});

export const ResumeSchema = z.object({
  basics: z.object({
    name: z.string(),
    title: z.string(),
    location: z.string(),
    email: z.string(),
    phone: z.string(),
    website: z.string().optional().default(""),
  }),
  summary: z.string(),
  experience: z.array(ExperienceSchema).default([]),
  education: z.array(EducationSchema).default([]),
  projects: z.array(ProjectSchema).default([]),
  skills: z.array(z.string()).default([]),
});

export const AgentState = z.object({
  resume: ResumeSchema,
});

export type AgentStateType = z.infer<typeof AgentState>;
