import type { FactsByYear } from "@/types/audit";

export function freeCashFlowForLatestYear(
  facts: FactsByYear,
): { year: number; fcf: number | null } | null {
  const years = Object.keys(facts)
    .map(Number)
    .sort((a, b) => b - a);
  if (!years.length) return null;
  const y = years[0]!;
  const f = facts[y]!;
  const cfo = f.operating_cash_flow;
  if (cfo == null) return { year: y, fcf: null };
  let capex = 0;
  if (f.capex != null) capex = Math.abs(f.capex);
  else if (f.investing_cash_flow != null && f.investing_cash_flow < 0)
    capex = -f.investing_cash_flow;
  return { year: y, fcf: cfo - capex };
}
