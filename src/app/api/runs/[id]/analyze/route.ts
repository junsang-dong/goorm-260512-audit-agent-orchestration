import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { inngest } from "@/inngest/client";
import { getDb } from "@/db";
import { analysisRuns } from "@/db/schema";
import { executeAuditPipeline } from "@/lib/pipeline";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: runId } = await ctx.params;
  const db = getDb();
  const [run] = await db
    .select({ id: analysisRuns.id })
    .from(analysisRuns)
    .where(eq(analysisRuns.id, runId))
    .limit(1);
  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });

  const useInngest =
    process.env.INNGEST_SIGNING_KEY && process.env.INNGEST_EVENT_KEY;

  if (useInngest) {
    await inngest.send({
      name: "audit/run.requested",
      data: { runId },
    });
    return NextResponse.json({ queued: true, mode: "inngest" });
  }

  await executeAuditPipeline(runId);
  return NextResponse.json({ queued: false, mode: "inline" });
}
