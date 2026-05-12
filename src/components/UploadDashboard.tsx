"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const industries = ["반도체", "조선", "2차전지", "바이오", "일반"];

export function UploadDashboard() {
  const router = useRouter();
  const [name, setName] = useState("데모 상장사");
  const [code, setCode] = useState("000000");
  const [industry, setIndustry] = useState("반도체");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function createRun() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyDisplayName: name,
          stockCode: code,
          industry,
        }),
      });
      const raw = await res.text();
      let data: { id?: string; error?: string } = {};
      if (raw.trim()) {
        try {
          data = JSON.parse(raw) as typeof data;
        } catch {
          throw new Error(
            res.status >= 500
              ? `서버 오류(${res.status}). 응답이 JSON이 아닙니다.`
              : "응답 파싱에 실패했습니다.",
          );
        }
      } else if (!res.ok) {
        throw new Error(`서버 오류(${res.status}). 응답 본문이 비어 있습니다.`);
      }
      if (!res.ok) throw new Error(data.error ?? "생성 실패");
      router.push(`/runs/${data.id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 rounded-xl border border-zinc-800 bg-zinc-950/80 p-8 text-zinc-100 shadow-xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          코스피 재무 이상징후 탐지
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          분석 세션을 생성한 뒤 파일을 업로드하고 AI 감사 파이프라인을
          실행합니다. (Vercel Blob + Neon + 멀티 LLM)
        </p>
      </div>
      <label className="block text-sm">
        <span className="text-zinc-400">기업 표시명</span>
        <input
          className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="block text-sm">
        <span className="text-zinc-400">종목코드 (선택)</span>
        <input
          className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
      </label>
      <label className="block text-sm">
        <span className="text-zinc-400">업종</span>
        <select
          className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2"
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
        >
          {industries.map((i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </select>
      </label>
      {err && <p className="text-sm text-red-400">{err}</p>}
      <button
        type="button"
        disabled={busy}
        onClick={createRun}
        className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
      >
        {busy ? "생성 중…" : "분석 세션 만들기"}
      </button>
      <p className="text-center text-sm text-zinc-500">
        <Link href="/" className="underline">
          홈
        </Link>
      </p>
    </div>
  );
}
