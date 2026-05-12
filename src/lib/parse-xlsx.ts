import * as XLSX from "xlsx";
import type { FinancialAccountKey, FactsByYear } from "@/types/audit";

const LABEL_MAP: Record<string, FinancialAccountKey> = {
  매출액: "revenue",
  매출: "revenue",
  수익: "revenue",
  매출원가: "cogs",
  매출총이익: "gross_profit",
  영업이익: "operating_income",
  법인세비용차감전순이익: "ebit",
  당기순이익: "net_income",
  순이익: "net_income",
  매출채권: "accounts_receivable",
  재고자산: "inventory",
  유동자산: "current_assets",
  유동부채: "current_liabilities",
  자산총계: "total_assets",
  부채총계: "total_liabilities",
  자본총계: "total_equity",
  유형자산: "ppe",
  이익잉여금: "retained_earnings",
  영업활동현금흐름: "operating_cash_flow",
  투자활동현금흐름: "investing_cash_flow",
  감가상각비: "depreciation",
  판매비와관리비: "sales_gna_expense",
  비유동부채: "long_term_debt",
  시가총액: "market_cap",
};

function normalizeLabel(cell: unknown): string {
  return String(cell ?? "")
    .replace(/\s+/g, "")
    .replace(/[()]/g, "");
}

function parseNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  const s = String(v).replace(/,/g, "").replace(/\s/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Heuristic: first column = label, header row contains years like 2024, 2023 */
export function parseFinancialXlsx(buffer: Buffer): FactsByYear {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: false,
  }) as unknown[][];

  if (!rows.length) return {};

  const header = rows[0].map((c) => String(c).trim());
  const yearCols: { col: number; year: number }[] = [];
  header.forEach((h, col) => {
    const m = /^20\d{2}$/.exec(h);
    if (m) yearCols.push({ col, year: Number(h) });
  });

  if (!yearCols.length) {
    const altYears = [new Date().getFullYear(), new Date().getFullYear() - 1];
    yearCols.push(
      { col: 1, year: altYears[0] },
      { col: 2, year: altYears[1] },
    );
  }

  const out: FactsByYear = {};
  for (const { year } of yearCols) {
    out[year] = {};
  }

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const labelRaw = row[0];
    const nk = normalizeLabel(labelRaw);
    let key: FinancialAccountKey | undefined;
    for (const [korean, k] of Object.entries(LABEL_MAP)) {
      if (nk.includes(korean)) {
        key = k;
        break;
      }
    }
    if (!key) continue;

    for (const { col, year } of yearCols) {
      const val = parseNumber(row[col]);
      if (val !== null) {
        out[year]![key] = val;
      }
    }
  }

  return out;
}
