import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { analysisRuns } from "@/db/schema";

export const runtime = "nodejs";

function serverError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

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
  try {
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
    if (!row?.id) {
      return serverError("분석 세션 생성에 실패했습니다.");
    }
    return NextResponse.json({ id: row.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("DATABASE_URL is not configured")) {
      return serverError(
        "DATABASE_URL이 설정되지 않았습니다. Vercel 프로젝트 환경 변수를 확인하세요.",
        500,
      );
    }
    if (
      msg.includes("relation") &&
      msg.includes("does not exist")
    ) {
      return serverError(
        "DB 테이블이 없습니다. Neon에 스키마를 반영하세요: npm run db:push",
        500,
      );
    }
    return serverError(msg, 500);
  }
}

export async function GET() {
  try {
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
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return serverError(msg, 500);
  }
}
