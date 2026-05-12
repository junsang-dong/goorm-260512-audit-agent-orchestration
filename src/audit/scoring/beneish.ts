import type { FactsByYear, FinancialAccountKey } from "@/types/audit";

function pick(
  a: Partial<Record<FinancialAccountKey, number>> | undefined,
  b: Partial<Record<FinancialAccountKey, number>> | undefined,
  k: FinancialAccountKey,
) {
  const v = a?.[k] ?? b?.[k];
  return v === undefined || Number.isNaN(v) ? null : v;
}

export interface BeneishResult {
  mScore: number | null;
  components: Record<string, number | null>;
  interpretation: string;
}

/**
 * Beneish M-Score (simplified public variant). Requires two consecutive years of mapped accounts.
 */
export function computeBeneishMScore(
  current: Partial<Record<FinancialAccountKey, number>>,
  prior: Partial<Record<FinancialAccountKey, number>>,
): BeneishResult {
  const S_t = pick(current, current, "revenue");
  const S_tm = pick(prior, prior, "revenue");
  const AR_t = pick(current, current, "accounts_receivable");
  const AR_tm = pick(prior, prior, "accounts_receivable");
  const COGS_t = pick(current, current, "cogs");
  const COGS_tm = pick(prior, prior, "cogs");
  const CA_t = pick(current, current, "current_assets");
  const CA_tm = pick(prior, prior, "current_assets");
  const PPE_t = pick(current, current, "ppe");
  const PPE_tm = pick(prior, prior, "ppe");
  const TA_t = pick(current, current, "total_assets");
  const TA_tm = pick(prior, prior, "total_assets");
  const DEP_t = pick(current, current, "depreciation");
  const DEP_tm = pick(prior, prior, "depreciation");
  const SGA_t = pick(current, current, "sales_gna_expense");
  const SGA_tm = pick(prior, prior, "sales_gna_expense");
  const LTD_t = pick(current, current, "long_term_debt");
  const LTD_tm = pick(prior, prior, "long_term_debt");
  const CL_t = pick(current, current, "current_liabilities");
  const CL_tm = pick(prior, prior, "current_liabilities");
  const NI_t = pick(current, current, "net_income");
  const NI_tm = pick(prior, prior, "net_income");
  const OCF_t = pick(current, current, "operating_cash_flow");
  const OCF_tm = pick(prior, prior, "operating_cash_flow");

  const need = [
    S_t,
    S_tm,
    AR_t,
    AR_tm,
    COGS_t,
    COGS_tm,
    CA_t,
    CA_tm,
    PPE_t,
    PPE_tm,
    TA_t,
    TA_tm,
    DEP_t,
    DEP_tm,
    SGA_t,
    SGA_tm,
    LTD_t,
    LTD_tm,
    CL_t,
    CL_tm,
    NI_t,
    NI_tm,
    OCF_t,
    OCF_tm,
  ];
  if (need.some((v) => v === null || v === 0)) {
    return {
      mScore: null,
      components: {},
      interpretation: "Beneish 계산에 필요한 계정(2개년)이 부족합니다.",
    };
  }

  const DSRI =
    AR_t! / S_t! / (AR_tm! / S_tm!);
  const GMI =
    (S_tm! - COGS_tm!) / S_tm! / ((S_t! - COGS_t!) / S_t!);
  const AQI =
    (1 - (CA_tm! + PPE_tm!) / TA_tm!) /
    (1 - (CA_t! + PPE_t!) / TA_t!);
  const SGI = S_t! / S_tm!;
  const DEPI = DEP_tm! / (DEP_tm! + PPE_tm!) / (DEP_t! / (DEP_t! + PPE_t!));
  const SGAI = SGA_t! / S_t! / (SGA_tm! / S_tm!);
  const LVGI =
    (LTD_t! + CL_t!) / TA_t! / ((LTD_tm! + CL_tm!) / TA_tm!);
  const TATA =
    (NI_t! - OCF_t!) / TA_t! / ((NI_tm! - OCF_tm!) / TA_tm!);

  const m =
    -4.84 +
    0.92 * DSRI +
    0.528 * GMI +
    0.404 * AQI +
    0.892 * SGI +
    0.115 * DEPI -
    0.172 * SGAI +
    4.679 * TATA -
    0.327 * LVGI;

  return {
    mScore: m,
    components: {
      DSRI,
      GMI,
      AQI,
      SGI,
      DEPI,
      SGAI,
      TATA,
      LVGI,
    },
    interpretation:
      m > -1.78
        ? "M-Score가 통상 임계값(-1.78)보다 높아 분식 가능성 시그널이 상대적으로 큽니다(참고용)."
        : "M-Score는 통상 임계값 이하입니다(참고용).",
  };
}

export function beneishFromFacts(facts: FactsByYear): BeneishResult {
  const years = Object.keys(facts)
    .map(Number)
    .sort((a, b) => b - a);
  if (years.length < 2) {
    return {
      mScore: null,
      components: {},
      interpretation: "Beneish는 최소 2개년 재무 데이터가 필요합니다.",
    };
  }
  return computeBeneishMScore(facts[years[0]!]!, facts[years[1]!]!);
}
