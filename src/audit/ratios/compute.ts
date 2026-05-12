import type { FactsByYear, FinancialAccountKey, RatioYearResult } from "@/types/audit";

function get(
  y: Partial<Record<FinancialAccountKey, number>> | undefined,
  k: FinancialAccountKey,
): number | undefined {
  const v = y?.[k];
  return v === undefined || Number.isNaN(v) ? undefined : v;
}

function estimateCapex(f: Partial<Record<FinancialAccountKey, number>>): number {
  const cap = get(f, "capex");
  if (cap != null) return Math.abs(cap);
  const inv = get(f, "investing_cash_flow");
  if (inv != null && inv < 0) return -inv;
  return 0;
}

export function computeRatiosByYear(facts: FactsByYear): RatioYearResult[] {
  const years = Object.keys(facts)
    .map(Number)
    .sort((a, b) => b - a);
  const results: RatioYearResult[] = [];

  for (let i = 0; i < years.length; i++) {
    const year = years[i]!;
    const cur = facts[year] ?? {};
    const prev = i + 1 < years.length ? facts[years[i + 1]!] : undefined;

    const revenue = get(cur, "revenue");
    const prevRev = prev ? get(prev, "revenue") : undefined;
    const cogs = get(cur, "cogs");
    const ar = get(cur, "accounts_receivable");
    const inv = get(cur, "inventory");
    const ta = get(cur, "total_assets");
    const tl = get(cur, "total_liabilities");
    const ni = get(cur, "net_income");
    const oi = get(cur, "operating_income");
    const gp = get(cur, "gross_profit");
    const cfo = get(cur, "operating_cash_flow");
    const capex = estimateCapex(cur);

    const row: RatioYearResult = { fiscalYear: year };

    if (revenue != null && prevRev != null && prevRev !== 0) {
      row.revenueYoY = (revenue - prevRev) / Math.abs(prevRev);
    }
    if (revenue != null && revenue !== 0 && gp != null) {
      row.grossMargin = gp / revenue;
    }
    if (revenue != null && revenue !== 0 && oi != null) {
      row.operatingMargin = oi / revenue;
    }
    if (revenue != null && revenue !== 0 && ni != null) {
      row.netMargin = ni / revenue;
    }
    if (revenue != null && revenue !== 0 && ar != null) {
      row.dsoDays = (ar / revenue) * 365;
    }
    if (cogs != null && inv != null && inv !== 0) {
      row.inventoryTurnover = cogs / inv;
    }
    if (ta != null && ta !== 0 && tl != null) {
      row.debtRatio = tl / ta;
    }
    if (ni != null && ni !== 0 && cfo != null) {
      row.cfoToNetIncome = cfo / ni;
    }
    if (cfo != null) {
      row.fcf = cfo - capex;
    }
    if (ar != null && prev) {
      const par = get(prev, "accounts_receivable");
      if (par != null && par !== 0) {
        row.arYoY = (ar - par) / Math.abs(par);
      }
    }
    if (inv != null && prev) {
      const pinv = get(prev, "inventory");
      if (pinv != null && pinv !== 0) {
        row.inventoryYoY = (inv - pinv) / Math.abs(pinv);
      }
    }

    results.push(row);
  }

  return results;
}
