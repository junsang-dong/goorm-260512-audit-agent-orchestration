import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  agentOutputs,
  analysisRuns,
  anomalyFindings,
  financialFacts,
  ratioSnapshots,
  uploadedFiles,
} from "@/db/schema";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const db = getDb();
  const [run] = await db
    .select()
    .from(analysisRuns)
    .where(eq(analysisRuns.id, id))
    .limit(1);
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [files, facts, ratios, anomalies, agents] = await Promise.all([
    db.select().from(uploadedFiles).where(eq(uploadedFiles.runId, id)),
    db.select().from(financialFacts).where(eq(financialFacts.runId, id)),
    db.select().from(ratioSnapshots).where(eq(ratioSnapshots.runId, id)),
    db.select().from(anomalyFindings).where(eq(anomalyFindings.runId, id)),
    db.select().from(agentOutputs).where(eq(agentOutputs.runId, id)),
  ]);

  return NextResponse.json({
    run,
    files,
    facts,
    ratios,
    anomalies,
    agents,
  });
}
