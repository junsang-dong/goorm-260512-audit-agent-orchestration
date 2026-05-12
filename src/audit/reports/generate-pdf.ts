import { put } from "@vercel/blob";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { analysisRuns } from "@/db/schema";
import { AuditPdfDocument } from "@/audit/reports/AuditPdfDocument";

export async function generateAndStoreAuditPdf(runId: string) {
  const db = getDb();
  const [run] = await db
    .select()
    .from(analysisRuns)
    .where(eq(analysisRuns.id, runId))
    .limit(1);
  if (!run) throw new Error("Run not found");
  if (run.status !== "done") {
    throw new Error("분석이 완료된 후에만 PDF를 생성할 수 있습니다.");
  }
  const summary = (run.summaryJson ?? {}) as {
    synthesis?: string;
    riskScore?: number;
    heatmap?: { label: string; level: string }[];
  };
  const heatmapFromJson = (
    run.heatmapJson as { rows?: { label: string; level: string }[] } | null
  )?.rows;
  const heatmap =
    heatmapFromJson ??
    summary.heatmap?.map((h) => ({ label: h.label, level: h.level })) ??
    [];

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("BLOB_READ_WRITE_TOKEN이 설정되어 있지 않습니다.");

  const buf = await renderToBuffer(
    React.createElement(AuditPdfDocument, {
      companyName: run.companyDisplayName,
      runId: run.id,
      riskScore: run.riskScore ?? summary.riskScore ?? null,
      synthesis: summary.synthesis ?? "",
      heatmapLines: heatmap,
    }) as Parameters<typeof renderToBuffer>[0],
  );

  const blob = await put(`reports/${runId}.pdf`, buf, {
    access: "public",
    token,
    contentType: "application/pdf",
  });

  await db
    .update(analysisRuns)
    .set({ reportBlobUrl: blob.url, updatedAt: new Date() })
    .where(eq(analysisRuns.id, runId));

  return blob.url;
}
