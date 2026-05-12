import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { auditPipelineFn } from "@/inngest/functions/auditPipeline";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [auditPipelineFn],
});

export const runtime = "nodejs";
