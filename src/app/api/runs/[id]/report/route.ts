import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { analysisRuns } from "@/db/schema";
import { generateAndStoreAuditPdf } from "@/audit/reports/generate-pdf";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: runId } = await ctx.params;
  const db = getDb();
  const [run] = await db
    .select({ status: analysisRuns.status })
    .from(analysisRuns)
    .where(eq(analysisRuns.id, runId))
    .limit(1);
  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });

  try {
    const url = await generateAndStoreAuditPdf(runId);
    return NextResponse.json({ reportBlobUrl: url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
