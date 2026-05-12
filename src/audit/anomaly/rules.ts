import type { RatioYearResult } from "@/types/audit";

export interface AnomalyFindingInput {
  code: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  title: string;
  detail: Record<string, unknown>;
}

const THRESH = {
  revenueYoYSpike: 0.35,
  arVsRevGap: 0.12,
  cfoNiLow: 0.45,
  debtJump: 0.15,
  marginSwing: 0.08,
};

export function detectAnomalies(
  ratios: RatioYearResult[],
): AnomalyFindingInput[] {
  const findings: AnomalyFindingInput[] = [];
  if (!ratios.length) return findings;

  const latest = ratios[0]!;
  const prev = ratios[1];

  if (
    latest.revenueYoY != null &&
    latest.revenueYoY > THRESH.revenueYoYSpike
  ) {
    findings.push({
      code: "REVENUE_YOY_SPIKE",
      severity: "HIGH",
      title: "매출 YoY 급증",
      detail: { revenueYoY: latest.revenueYoY, year: latest.fiscalYear },
    });
  }

  if (
    latest.arYoY != null &&
    latest.revenueYoY != null &&
    latest.arYoY - latest.revenueYoY > THRESH.arVsRevGap
  ) {
    findings.push({
      code: "AR_OUTPACES_REVENUE",
      severity: "HIGH",
      title: "매출채권 증가율이 매출 증가율을 상회",
      detail: {
        arYoY: latest.arYoY,
        revenueYoY: latest.revenueYoY,
        year: latest.fiscalYear,
      },
    });
  }

  if (
    latest.cfoToNetIncome != null &&
    latest.netMargin != null &&
    latest.netMargin > 0.02 &&
    latest.cfoToNetIncome < THRESH.cfoNiLow
  ) {
    findings.push({
      code: "CFO_NI_DIVERGENCE",
      severity: "MEDIUM",
      title: "영업현금흐름 대비 순이익 괴리",
      detail: {
        cfoToNetIncome: latest.cfoToNetIncome,
        netMargin: latest.netMargin,
        year: latest.fiscalYear,
      },
    });
  }

  if (latest.debtRatio != null && prev?.debtRatio != null) {
    const jump = latest.debtRatio - prev.debtRatio;
    if (jump > THRESH.debtJump) {
      findings.push({
        code: "DEBT_RATIO_JUMP",
        severity: "MEDIUM",
        title: "부채비율 급증",
        detail: {
          debtRatio: latest.debtRatio,
          prevDebtRatio: prev.debtRatio,
          year: latest.fiscalYear,
        },
      });
    }
  }

  if (
    latest.operatingMargin != null &&
    prev?.operatingMargin != null
  ) {
    const swing = Math.abs(latest.operatingMargin - prev.operatingMargin);
    if (swing > THRESH.marginSwing) {
      findings.push({
        code: "MARGIN_VOLATILITY",
        severity: "LOW",
        title: "영업이익률 변동성 확대",
        detail: {
          operatingMargin: latest.operatingMargin,
          prevOperatingMargin: prev.operatingMargin,
          year: latest.fiscalYear,
        },
      });
    }
  }

  if (
    latest.inventoryYoY != null &&
    latest.revenueYoY != null &&
    latest.inventoryYoY - latest.revenueYoY > THRESH.arVsRevGap
  ) {
    findings.push({
      code: "INVENTORY_BUILDUP",
      severity: "MEDIUM",
      title: "재고 증가율이 매출 증가율을 상회",
      detail: {
        inventoryYoY: latest.inventoryYoY,
        revenueYoY: latest.revenueYoY,
        year: latest.fiscalYear,
      },
    });
  }

  return findings;
}
