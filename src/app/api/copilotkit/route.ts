import {
  CopilotRuntime,
  ExperimentalEmptyAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import { MastraAgent } from "@ag-ui/mastra";
import type { NextRequest } from "next/server";
import { mastra } from "@/mastra";

const serviceAdapter = new ExperimentalEmptyAdapter();

const runtime = new CopilotRuntime({
  agents: MastraAgent.getLocalAgents({ mastra }),
});

const endpointHandlers = copilotRuntimeNextJSAppRouterEndpoint({
  runtime,
  serviceAdapter,
  endpoint: "/api/copilotkit",
});

export const GET = (req: NextRequest) => endpointHandlers.GET(req);
export const OPTIONS = (req: NextRequest) => endpointHandlers.OPTIONS(req);
export const POST = (req: NextRequest) => endpointHandlers.POST(req);
