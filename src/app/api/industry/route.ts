import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { industryBenchmarks } from "@/db/schema";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const industry = searchParams.get("industry")?.trim() || "일반";
  const db = getDb();
  let rows = await db
    .select()
    .from(industryBenchmarks)
    .where(eq(industryBenchmarks.industry, industry));
  if (!rows.length) {
    rows = await db
      .select()
      .from(industryBenchmarks)
      .where(eq(industryBenchmarks.industry, "일반"));
  }
  return NextResponse.json({ industry, benchmarks: rows });
}
