import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  agentOutputs,
  analysisRuns,
  anomalyFindings,
  auditTrail,
  companies,
  companyMemory,
  documentChunks,
  financialFacts,
  industryBenchmarks,
  ratioSnapshots,
  uploadedFiles,
} from "@/db/schema";
import { parseFinancialXlsx } from "@/lib/parse-xlsx";
import { parseDartCsv } from "@/lib/parse-csv";
import { extractPdfText } from "@/lib/pdf-extract";
import { mergeFacts } from "@/lib/merge-facts";
import type { FactsByYear } from "@/types/audit";
import { computeRatiosByYear } from "@/audit/ratios/compute";
import { detectAnomalies } from "@/audit/anomaly/rules";
import { beneishFromFacts } from "@/audit/scoring/beneish";
import { altmanFromFacts } from "@/audit/scoring/altman";
import { freeCashFlowForLatestYear } from "@/audit/scoring/fcf";
import { fuseRiskScore } from "@/audit/scoring/fusion";
import { runAuditAgentGraph } from "@/agents/orchestrator/audit-graph";
import { buildRiskHeatmap } from "@/lib/heatmap";
import { embedChunks, ingestDocumentForRag, searchTopChunks } from "@/lib/rag";

async function logTrail(
  db: ReturnType<typeof getDb>,
  runId: string,
  action: string,
  meta?: Record<string, unknown>,
) {
  await db.insert(auditTrail).values({ runId, action, meta: meta ?? {} });
}

async function ensureCompany(
  db: ReturnType<typeof getDb>,
  stockCode: string | null | undefined,
  displayName: string,
  industry: string | null | undefined,
): Promise<string | null> {
  if (!stockCode) return null;
  const existing = await db
    .select()
    .from(companies)
    .where(eq(companies.stockCode, stockCode))
    .limit(1);
  if (existing[0]) {
    await db
      .update(companies)
      .set({
        displayName,
        industry: industry ?? existing[0].industry,
      })
      .where(eq(companies.id, existing[0].id));
    return existing[0].id;
  }
  const [row] = await db
    .insert(companies)
    .values({
      stockCode,
      displayName,
      industry: industry ?? null,
    })
    .returning({ id: companies.id });
  return row?.id ?? null;
}

async function loadIndustryBenchmarks(
  db: ReturnType<typeof getDb>,
  industry: string | null | undefined,
) {
  const key = industry?.trim() || "일반";
  const rows = await db
    .select()
    .from(industryBenchmarks)
    .where(eq(industryBenchmarks.industry, key));
  if (rows.length) return { industry: key, rows };
  const fallback = await db
    .select()
    .from(industryBenchmarks)
    .where(eq(industryBenchmarks.industry, "일반"));
  return { industry: "일반", rows: fallback };
}

export async function executeAuditPipeline(runId: string) {
  const db = getDb();
  await db
    .update(analysisRuns)
    .set({ status: "running", updatedAt: new Date() })
    .where(eq(analysisRuns.id, runId));
  await logTrail(db, runId, "pipeline_started", {});

  try {
    const [run] = await db
      .select()
      .from(analysisRuns)
      .where(eq(analysisRuns.id, runId))
      .limit(1);
    if (!run) throw new Error("Run not found");

    const companyId = await ensureCompany(
      db,
      run.stockCode,
      run.companyDisplayName,
      run.industry,
    );
    if (companyId) {
      await db
        .update(analysisRuns)
        .set({ companyId, updatedAt: new Date() })
        .where(eq(analysisRuns.id, runId));
    }

    const files = await db
      .select()
      .from(uploadedFiles)
      .where(eq(uploadedFiles.runId, runId));

    const factPieces: FactsByYear[] = [];
    const textParts: string[] = [];
    let pdfBase64: string | null = null;

    for (const f of files) {
      const res = await fetch(f.blobUrl);
      if (!res.ok) throw new Error(`Blob fetch failed ${f.originalName}`);
      const buf = Buffer.from(await res.arrayBuffer());

      if (f.kind === "fs_xlsx") {
        factPieces.push(parseFinancialXlsx(buf));
      } else if (f.kind === "dart_csv") {
        factPieces.push(parseDartCsv(buf.toString("utf-8")));
      } else if (f.kind === "business_report_pdf" || f.kind === "ir_pdf") {
        const txt = await extractPdfText(buf);
        textParts.push(`[${f.kind}] ${txt.slice(0, 120_000)}`);
        if (!pdfBase64 && f.kind === "ir_pdf") {
          pdfBase64 = buf.toString("base64");
        } else if (!pdfBase64 && f.kind === "business_report_pdf") {
          pdfBase64 = buf.toString("base64");
        }
      }
    }

    const existingFactRows = await db
      .select()
      .from(financialFacts)
      .where(eq(financialFacts.runId, runId));

    const dbFacts: FactsByYear = {};
    for (const r of existingFactRows) {
      if (!dbFacts[r.fiscalYear]) dbFacts[r.fiscalYear] = {};
      (dbFacts[r.fiscalYear] as Record<string, number>)[r.accountKey] = r.value;
    }

    const mergedFacts = mergeFacts(dbFacts, ...factPieces);

    await db.delete(financialFacts).where(eq(financialFacts.runId, runId));
    const factRows: (typeof financialFacts.$inferInsert)[] = [];
    for (const [yStr, row] of Object.entries(mergedFacts)) {
      const fy = Number(yStr);
      for (const [accountKey, value] of Object.entries(row)) {
        if (typeof value !== "number") continue;
        factRows.push({
          runId,
          fiscalYear: fy,
          accountKey,
          value,
          unit: "KRW",
          source: "upload",
        });
      }
    }
    if (factRows.length) {
      await db.insert(financialFacts).values(factRows);
    }

    const ratios = computeRatiosByYear(mergedFacts);
    await db.delete(ratioSnapshots).where(eq(ratioSnapshots.runId, runId));
    for (const r of ratios) {
      await db.insert(ratioSnapshots).values({
        runId,
        fiscalYear: r.fiscalYear,
        payload: r as unknown as Record<string, unknown>,
      });
    }

    const anomalies = detectAnomalies(ratios);
    await db.delete(anomalyFindings).where(eq(anomalyFindings.runId, runId));
    for (const a of anomalies) {
      await db.insert(anomalyFindings).values({
        runId,
        code: a.code,
        severity: a.severity,
        title: a.title,
        detail: a.detail,
      });
    }

    const beneish = beneishFromFacts(mergedFacts);
    const altman = altmanFromFacts(mergedFacts);
    const fcf = freeCashFlowForLatestYear(mergedFacts);

    const { rows: benchRows } = await loadIndustryBenchmarks(db, run.industry);
    const latestRatio = ratios[0];
    const benchPayload = benchRows.map((b) => ({
      metricKey: b.metricKey,
      mean: b.meanValue,
      company:
        b.metricKey === "gross_margin_mean"
          ? latestRatio?.grossMargin
          : b.metricKey === "operating_margin_mean"
            ? latestRatio?.operatingMargin
            : b.metricKey === "debt_ratio_mean"
              ? latestRatio?.debtRatio
              : null,
    }));

    await db.delete(documentChunks).where(eq(documentChunks.runId, runId));
    const combinedText = textParts.join("\n\n");
    if (combinedText.length > 80) {
      await ingestDocumentForRag({
        runId,
        source: "pdf_text",
        fullText: combinedText,
        insertChunk: async ({ runId: rid, source, content, embedding }) => {
          await db.insert(documentChunks).values({
            runId: rid,
            source,
            content,
            embedding,
          });
        },
      });
    }

    let ragSnippet = "";
    const chunks = await db
      .select()
      .from(documentChunks)
      .where(eq(documentChunks.runId, runId))
      .limit(120);
    if (chunks.length && process.env.OPENAI_API_KEY) {
      const qEmb = await embedChunks(["재무제표 위험 이상징후 핵심 키워드"]);
      const q = qEmb[0];
      if (q) {
        const ranked = searchTopChunks({
          queryEmbedding: q,
          candidates: chunks
            .filter((c) => c.embedding && (c.embedding as number[]).length)
            .map((c) => ({
              id: c.id,
              content: c.content,
              embedding: c.embedding as number[],
            })),
          k: 3,
        });
        ragSnippet = ranked.map((r) => r.content).join("\n---\n");
      }
    }

    const quantitativeContext = JSON.stringify(
      {
        ratios,
        beneish,
        altman,
        fcf,
        anomalies,
        industryComparison: benchPayload,
        ragTopChunks: ragSnippet.slice(0, 6000),
      },
      null,
      2,
    );

    const graphOut = await runAuditAgentGraph({
      runId,
      companyName: run.companyDisplayName,
      stockCode: run.stockCode,
      industry: run.industry,
      quantitativeContext,
      longTextContext: `${ragSnippet}\n\n${combinedText}`.slice(0, 120_000),
      pdfBase64,
      facts: mergedFacts,
    });

    await db.delete(agentOutputs).where(eq(agentOutputs.runId, runId));
    const outs: {
      agent: string;
      model?: string;
      confidence?: number;
      payload: Record<string, unknown>;
    }[] = [
      {
        agent: "gpt",
        model: process.env.OPENAI_MODEL,
        confidence: graphOut.gpt.confidence,
        payload: { ...graphOut.gpt } as Record<string, unknown>,
      },
      {
        agent: "claude",
        model: process.env.ANTHROPIC_MODEL,
        confidence: graphOut.claude.confidence,
        payload: { ...graphOut.claude } as Record<string, unknown>,
      },
      {
        agent: "gemini",
        model: process.env.GEMINI_MODEL,
        confidence: graphOut.gemini.confidence,
        payload: { ...graphOut.gemini } as Record<string, unknown>,
      },
      {
        agent: "perplexity",
        model: process.env.PERPLEXITY_MODEL,
        confidence: graphOut.perplexity.confidence,
        payload: { ...graphOut.perplexity } as Record<string, unknown>,
      },
    ];
    for (const o of outs) {
      await db.insert(agentOutputs).values({
        runId,
        agent: o.agent,
        model: o.model ?? null,
        confidence: o.confidence ?? null,
        payload: o.payload,
      });
    }

    const confidences = outs
      .map((o) => o.confidence)
      .filter((c): c is number => typeof c === "number" && !Number.isNaN(c));

    const riskScore = fuseRiskScore({
      anomalies,
      beneish,
      altman,
      agentConfidences: confidences,
    });

    const heatmap = buildRiskHeatmap({
      anomalies,
      ratios,
      beneishM: beneish.mScore,
      altmanZ: altman.zScore,
    });

    const summaryJson = {
      riskScore,
      beneish,
      altman,
      fcf,
      heatmap,
      evaluation: graphOut.evaluation,
      synthesis: graphOut.synthesis,
      gpt: graphOut.gpt,
    };

    await db
      .update(analysisRuns)
      .set({
        status: "done",
        riskScore,
        summaryJson,
        heatmapJson: { rows: heatmap },
        updatedAt: new Date(),
      })
      .where(eq(analysisRuns.id, runId));

    if (companyId) {
      await db.insert(companyMemory).values({
        companyId,
        runId,
        fiscalYear: ratios[0]?.fiscalYear ?? null,
        snapshot: {
          riskScore,
          runId,
          createdAt: new Date().toISOString(),
        },
      });
    }

    await logTrail(db, runId, "pipeline_completed", { riskScore });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db
      .update(analysisRuns)
      .set({
        status: "failed",
        summaryJson: { error: message },
        updatedAt: new Date(),
      })
      .where(eq(analysisRuns.id, runId));
    await logTrail(db, runId, "pipeline_failed", { error: message });
    throw e;
  }
}
