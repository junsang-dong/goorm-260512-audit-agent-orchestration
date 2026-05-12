import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { analysisRuns, financialFacts } from "@/db/schema";
import type { FactsByYear } from "@/types/audit";

export const runtime = "nodejs";

/** 데모/테스트용: Blob 없이 JSON으로 재무 팩트를 주입합니다. */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: runId } = await ctx.params;
  let body: { facts: FactsByYear };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.facts || typeof body.facts !== "object") {
    return NextResponse.json({ error: "facts 객체가 필요합니다." }, { status: 400 });
  }

  const db = getDb();
  const [run] = await db
    .select({ id: analysisRuns.id })
    .from(analysisRuns)
    .where(eq(analysisRuns.id, runId))
    .limit(1);
  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });

  await db.delete(financialFacts).where(eq(financialFacts.runId, runId));
  const rows: (typeof financialFacts.$inferInsert)[] = [];
  for (const [yStr, row] of Object.entries(body.facts)) {
    const fy = Number(yStr);
    if (!Number.isFinite(fy)) continue;
    for (const [accountKey, value] of Object.entries(row)) {
      if (typeof value !== "number") continue;
      rows.push({
        runId,
        fiscalYear: fy,
        accountKey,
        value,
        unit: "KRW",
        source: "manual_json",
      });
    }
  }
  if (rows.length) await db.insert(financialFacts).values(rows);
  return NextResponse.json({ inserted: rows.length });
}
