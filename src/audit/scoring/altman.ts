import type { FactsByYear, FinancialAccountKey } from "@/types/audit";

export interface AltmanResult {
  zScore: number | null;
  components: Record<string, number | null>;
  zone: "distress" | "grey" | "safe" | "unknown";
  note: string;
}

export function computeAltmanZScore(
  f: Partial<Record<FinancialAccountKey, number>>,
): AltmanResult {
  const ca = f.current_assets;
  const cl = f.current_liabilities;
  const re = f.retained_earnings;
  const ebit = f.ebit ?? f.operating_income;
  const ta = f.total_assets;
  const tl = f.total_liabilities;
  const sales = f.revenue;
  const mc = f.market_cap;
  const te = f.total_equity;

  if (
    ca == null ||
    cl == null ||
    re == null ||
    ebit == null ||
    ta == null ||
    ta === 0 ||
    tl == null ||
    tl === 0 ||
    sales == null
  ) {
    return {
      zScore: null,
      components: {},
      zone: "unknown",
      note: "Altman Z 계산에 필요한 계정이 부족합니다.",
    };
  }

  const wc = ca - cl;
  const X1 = wc / ta;
  const X2 = re / ta;
  const X3 = ebit / ta;
  const equityValue = mc ?? (te != null ? te * 2.2 : null);
  if (equityValue == null) {
    return {
      zScore: null,
      components: { X1, X2, X3 },
      zone: "unknown",
      note: "시가총액 또는 자본총계가 없어 X4를 산출하지 못했습니다.",
    };
  }
  const X4 = equityValue / tl;
  const X5 = sales / ta;

  const z = 1.2 * X1 + 1.4 * X2 + 3.3 * X3 + 0.6 * X4 + 1.0 * X5;

  let zone: AltmanResult["zone"] = "grey";
  if (z < 1.81) zone = "distress";
  else if (z > 2.99) zone = "safe";

  return {
    zScore: z,
    components: { X1, X2, X3, X4, X5 },
    zone,
    note:
      zone === "distress"
        ? "전통적 임계값 기준 부실 위험 구간에 근접/진입(참고용)."
        : zone === "safe"
          ? "전통적 임계값 기준 상대적으로 안전 구간(참고용)."
          : "회색지대: 업종·모델 한계를 함께 검토하세요.",
  };
}

export function altmanFromFacts(facts: FactsByYear): AltmanResult {
  const years = Object.keys(facts)
    .map(Number)
    .sort((a, b) => b - a);
  if (!years.length) {
    return {
      zScore: null,
      components: {},
      zone: "unknown",
      note: "데이터 없음",
    };
  }
  return computeAltmanZScore(facts[years[0]!]!);
}
