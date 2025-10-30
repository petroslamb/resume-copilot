import { z } from "zod";

export const AgentState = z.object({
  markdownResume: z.string().default(""),
});

export type AgentStateType = z.infer<typeof AgentState>;
