"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuditStore } from "@/store/audit-store";

type RunDetail = {
  run: {
    id: string;
    companyDisplayName: string;
    status: string;
    riskScore: number | null;
    summaryJson: Record<string, unknown> | null;
    heatmapJson: { rows?: { label: string; level: string; score?: number }[] } | null;
    reportBlobUrl: string | null;
  };
  files: { id: string; kind: string; originalName: string }[];
  anomalies: { code: string; severity: string; title: string }[];
  ratios: { fiscalYear: number; payload: Record<string, unknown> }[];
};

const FILE_KINDS = [
  { value: "business_report_pdf", label: "사업보고서 PDF" },
  { value: "fs_xlsx", label: "재무제표 XLSX" },
  { value: "dart_csv", label: "DART CSV" },
  { value: "ir_pdf", label: "IR PDF" },
];

export function RunDetailView() {
  const params = useParams();
  const id = String(params.id ?? "");
  const setRun = useAuditStore((s) => s.setCurrentRunId);
  const [data, setData] = useState<RunDetail | null>(null);
  const [poll, setPoll] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/runs/${id}`);
    if (!res.ok) return;
    const j = await res.json();
    setData(j);
    setRun(id);
  }, [id, setRun]);

  useEffect(() => {
    void load();
  }, [load, poll]);

  useEffect(() => {
    const st = data?.run?.status;
    if (st === "running" || st === "queued") {
      const t = setInterval(() => setPoll((p) => p + 1), 3000);
      return () => clearInterval(t);
    }
  }, [data?.run?.status]);

  async function uploadFile(kind: string, file: File) {
    setMsg(null);
    const fd = new FormData();
    fd.set("kind", kind);
    fd.set("file", file);
    const res = await fetch(`/api/runs/${id}/files`, { method: "POST", body: fd });
    const j = await res.json();
    if (!res.ok) setMsg(j.error ?? "업로드 실패");
    await load();
  }

  async function runAnalyze() {
    setMsg(null);
    const res = await fetch(`/api/runs/${id}/analyze`, { method: "POST" });
    const j = await res.json();
    if (!res.ok) setMsg(j.error ?? "분석 실패");
    else setMsg(j.mode === "inngest" ? "Inngest 큐에 등록되었습니다." : "동기 분석을 시작했습니다.");
    setPoll((p) => p + 1);
  }

  async function seedDemoFacts() {
    setMsg(null);
    const demo = {
      facts: {
        2022: {
          revenue: 100,
          cogs: 60,
          gross_profit: 40,
          operating_income: 10,
          net_income: 8,
          accounts_receivable: 12,
          inventory: 8,
          current_assets: 40,
          current_liabilities: 25,
          total_assets: 120,
          total_liabilities: 55,
          total_equity: 65,
          ppe: 35,
          retained_earnings: 30,
          operating_cash_flow: 6,
          investing_cash_flow: -8,
          depreciation: 5,
          sales_gna_expense: 22,
          long_term_debt: 10,
          ebit: 10,
        },
        2023: {
          revenue: 140,
          cogs: 88,
          gross_profit: 52,
          operating_income: 18,
          net_income: 16,
          accounts_receivable: 28,
          inventory: 14,
          current_assets: 55,
          current_liabilities: 30,
          total_assets: 150,
          total_liabilities: 72,
          total_equity: 78,
          ppe: 40,
          retained_earnings: 40,
          operating_cash_flow: 7,
          investing_cash_flow: -12,
          depreciation: 6,
          sales_gna_expense: 26,
          long_term_debt: 18,
          ebit: 18,
        },
        2024: {
          revenue: 200,
          cogs: 130,
          gross_profit: 70,
          operating_income: 22,
          net_income: 20,
          accounts_receivable: 55,
          inventory: 22,
          current_assets: 70,
          current_liabilities: 38,
          total_assets: 190,
          total_liabilities: 95,
          total_equity: 95,
          ppe: 45,
          retained_earnings: 52,
          operating_cash_flow: 8,
          investing_cash_flow: -15,
          depreciation: 7,
          sales_gna_expense: 32,
          long_term_debt: 28,
          ebit: 22,
        },
      },
    };
    const res = await fetch(`/api/runs/${id}/facts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(demo),
    });
    const j = await res.json();
    if (!res.ok) setMsg(j.error ?? "시드 실패");
    else setMsg(`데모 팩트 ${j.inserted}건 삽입`);
    await load();
  }

  async function downloadPdf() {
    setMsg(null);
    const res = await fetch(`/api/runs/${id}/report`, { method: "POST" });
    const j = await res.json();
    if (!res.ok) {
      setMsg(j.error ?? "PDF 실패");
      return;
    }
    window.open(j.reportBlobUrl as string, "_blank");
    await load();
  }

  if (!data?.run) {
    return (
      <div className="p-8 text-zinc-400">
        불러오는 중…{" "}
        <Link href="/" className="underline">
          홈
        </Link>
      </div>
    );
  }

  const summary = data.run.summaryJson as {
    synthesis?: string;
    heatmap?: { label: string; level: string }[];
    gpt?: { payload?: { executive_summary?: string } };
  } | null;

  const heatRows =
    data.run.heatmapJson?.rows ??
    summary?.heatmap?.map((h) => ({
      label: h.label,
      level: h.level,
      score: 50,
    })) ??
    [];

  const chartData = [...data.ratios]
    .sort((a, b) => a.fiscalYear - b.fiscalYear)
    .map((r) => ({
      year: String(r.fiscalYear),
      margin: Number(r.payload.operatingMargin ?? 0) * 100,
    }));

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6 text-zinc-100">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{data.run.companyDisplayName}</h1>
          <p className="text-sm text-zinc-400">
            상태: {data.run.status} · Risk Score:{" "}
            {data.run.riskScore ?? "—"}
          </p>
        </div>
        <Link href="/" className="text-sm text-emerald-400 underline">
          새 분석
        </Link>
      </div>

      {msg && <p className="text-sm text-amber-300">{msg}</p>}

      <section className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
        <h2 className="mb-3 font-medium">파일 업로드</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {FILE_KINDS.map((fk) => (
            <label
              key={fk.value}
              className="flex cursor-pointer flex-col rounded border border-zinc-700 bg-zinc-900/50 px-3 py-2 text-sm hover:border-zinc-500"
            >
              <span className="text-zinc-400">{fk.label}</span>
              <input
                type="file"
                className="mt-1 text-xs file:mr-2 file:rounded file:border-0 file:bg-emerald-700 file:px-2 file:py-1 file:text-white"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadFile(fk.value, f);
                  e.target.value = "";
                }}
              />
            </label>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void seedDemoFacts()}
            className="rounded bg-zinc-700 px-3 py-1.5 text-sm"
          >
            데모 재무팩트 주입
          </button>
          <button
            type="button"
            onClick={() => void runAnalyze()}
            className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white"
          >
            AI 분석 실행
          </button>
          <button
            type="button"
            onClick={() => void downloadPdf()}
            disabled={data.run.status !== "done"}
            className="rounded bg-sky-700 px-3 py-1.5 text-sm text-white disabled:opacity-40"
          >
            PDF 리포트 생성
          </button>
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          업로드된 파일: {data.files.map((f) => f.originalName).join(", ") || "없음"}
        </p>
      </section>

      {heatRows.length > 0 && (
        <section>
          <h2 className="mb-3 font-medium">Risk Heatmap</h2>
          <div className="space-y-2 font-mono text-sm">
            {heatRows.map((row) => (
              <div key={row.label} className="flex items-center gap-3">
                <span className="w-32 text-zinc-400">{row.label}</span>
                <span
                  className={
                    row.level === "HIGH"
                      ? "text-red-400"
                      : row.level === "MEDIUM"
                        ? "text-amber-300"
                        : "text-emerald-400"
                  }
                >
                  {row.level === "HIGH"
                    ? "████████ HIGH"
                    : row.level === "MEDIUM"
                      ? "█████ MEDIUM"
                      : "██ LOW"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {chartData.length > 0 && (
        <section className="h-72 rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
          <h2 className="mb-2 font-medium">영업이익률 (%)</h2>
          <ResponsiveContainer width="100%" height="90%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="year" stroke="#888" />
              <YAxis stroke="#888" />
              <Tooltip
                contentStyle={{ background: "#18181b", border: "1px solid #333" }}
              />
              <Bar dataKey="margin" fill="#10b981" name="영업이익률 %" />
            </BarChart>
          </ResponsiveContainer>
        </section>
      )}

      {data.anomalies.length > 0 && (
        <section>
          <h2 className="mb-2 font-medium">이상징후</h2>
          <ul className="space-y-2 text-sm">
            {data.anomalies.map((a) => (
              <li key={a.code} className="rounded border border-zinc-800 bg-zinc-900/40 px-3 py-2">
                <span className="text-zinc-500">[{a.severity}]</span> {a.title}
              </li>
            ))}
          </ul>
        </section>
      )}

      {(summary?.gpt?.payload?.executive_summary || summary?.synthesis) && (
        <section>
          <h2 className="mb-2 font-medium">AI 감사 메모</h2>
          <div className="rounded border border-zinc-800 bg-zinc-900/30 p-4 text-sm leading-relaxed text-zinc-200">
            {summary?.gpt?.payload?.executive_summary && (
              <p className="mb-4">{summary.gpt.payload.executive_summary}</p>
            )}
            <pre className="whitespace-pre-wrap font-sans text-zinc-400">
              {summary?.synthesis}
            </pre>
          </div>
        </section>
      )}
    </div>
  );
}
