import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { analysisRuns } from "@/db/schema";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: {
    companyDisplayName: string;
    stockCode?: string;
    industry?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body?.companyDisplayName?.trim()) {
    return NextResponse.json(
      { error: "companyDisplayName is required" },
      { status: 400 },
    );
  }
  const db = getDb();
  const [row] = await db
    .insert(analysisRuns)
    .values({
      companyDisplayName: body.companyDisplayName.trim(),
      stockCode: body.stockCode?.trim() || null,
      industry: body.industry?.trim() || null,
      status: "queued",
    })
    .returning({ id: analysisRuns.id });
  return NextResponse.json({ id: row!.id });
}

export async function GET() {
  const db = getDb();
  const rows = await db
    .select({
      id: analysisRuns.id,
      companyDisplayName: analysisRuns.companyDisplayName,
      status: analysisRuns.status,
      riskScore: analysisRuns.riskScore,
      createdAt: analysisRuns.createdAt,
    })
    .from(analysisRuns);
  return NextResponse.json({ runs: rows });
}
