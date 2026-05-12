import { inngest } from "@/inngest/client";
import { executeAuditPipeline } from "@/lib/pipeline";

export const auditPipelineFn = inngest.createFunction(
  {
    id: "audit-pipeline",
    name: "Financial audit pipeline",
    triggers: [{ event: "audit/run.requested" }],
  },
  async ({ event, step }) => {
    const runId = event.data.runId as string;
    await step.run("execute-audit-pipeline", async () => {
      await executeAuditPipeline(runId);
    });
    return { ok: true, runId };
  },
);
