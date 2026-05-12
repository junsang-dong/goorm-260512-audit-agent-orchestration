import type { FinancialAccountKey, FactsByYear } from "@/types/audit";

const LABEL_MAP: Record<string, FinancialAccountKey> = {
  ifrs_Revenue: "revenue",
  ifrs_CostOfSales: "cogs",
  dart_OperatingIncomeLoss: "operating_income",
  dart_ProfitLoss: "net_income",
  ifrs_Assets: "total_assets",
  ifrs_Liabilities: "total_liabilities",
  ifrs_Equity: "total_equity",
  ifrs_TradeReceivables: "accounts_receivable",
  ifrs_Inventories: "inventory",
  ifrs_CashFlowsFromUsedInOperatingActivities: "operating_cash_flow",
  ifrs_CashFlowsFromUsedInInvestingActivities: "investing_cash_flow",
};

function parseNumber(v: string): number | null {
  const s = v.replace(/,/g, "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * DART-like CSV: expects columns account_id (or sj_div), account_nm, thstrm_amount, frmtrm_amount, bfefrmtrm_amount
 * OR wide format: account_nm, 2024, 2023, 2022
 */
export function parseDartCsv(text: string): FactsByYear {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return {};

  const header = lines[0].split(",").map((s) => s.trim().replace(/^"|"$/g, ""));
  const wideYears = header
    .map((h, i) => ({ h, i }))
    .filter(({ h }) => /^20\d{2}$/.test(h));

  const out: FactsByYear = {};

  if (wideYears.length >= 2) {
    for (const { h } of wideYears) {
      out[Number(h)] = {};
    }
    for (let r = 1; r < lines.length; r++) {
      const cols = lines[r].split(",").map((s) => s.trim().replace(/^"|"$/g, ""));
      const label = cols[0];
      const key =
        LABEL_MAP[label] ??
        (Object.entries(LABEL_MAP).find(([k]) => label.includes(k))?.[1] as
          | FinancialAccountKey
          | undefined);
      if (!key) continue;
      for (const { h, i } of wideYears) {
        const v = parseNumber(cols[i] ?? "");
        if (v !== null) out[Number(h)]![key] = v;
      }
    }
    return out;
  }

  const idx = (name: string) => header.findIndex((h) => h === name);
  const idCol = idx("account_id");
  const nmCol = idx("account_nm");
  const curCol = idx("thstrm_amount");
  const prevCol = idx("frmtrm_amount");
  const prev2Col = idx("bfefrmtrm_amount");
  const yearCur = idx("thstrm_dt");
  const yearPrev = idx("frmtrm_dt");
  const yearPrev2 = idx("bfefrmtrm_dt");

  if (nmCol < 0 || curCol < 0) return out;

  const extractYear = (line: string[], col: number) => {
    const raw = col >= 0 ? line[col] : "";
    const m = /(20\d{2})/.exec(raw);
    return m ? Number(m[1]) : null;
  };

  for (let r = 1; r < lines.length; r++) {
    const cols = lines[r].split(",").map((s) => s.trim().replace(/^"|"$/g, ""));
    const id = idCol >= 0 ? cols[idCol] : "";
    const nm = cols[nmCol] ?? "";
    const key =
      LABEL_MAP[id] ??
      (Object.entries(LABEL_MAP).find(([k]) => nm.includes(k) || id.includes(k))?.[1] as
        | FinancialAccountKey
        | undefined);
    if (!key) continue;

    const y1 = extractYear(cols, yearCur) ?? new Date().getFullYear();
    const y2 = extractYear(cols, yearPrev) ?? y1 - 1;
    const y3 = extractYear(cols, yearPrev2) ?? y1 - 2;

    if (!out[y1]) out[y1] = {};
    if (!out[y2]) out[y2] = {};
    if (!out[y3]) out[y3] = {};

    const v1 = parseNumber(cols[curCol] ?? "");
    const v2 = prevCol >= 0 ? parseNumber(cols[prevCol] ?? "") : null;
    const v3 = prev2Col >= 0 ? parseNumber(cols[prev2Col] ?? "") : null;
    if (v1 !== null) out[y1]![key] = v1;
    if (v2 !== null) out[y2]![key] = v2;
    if (v3 !== null) out[y3]![key] = v3;
  }

  return out;
}
