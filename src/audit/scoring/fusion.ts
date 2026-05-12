import type { AnomalyFindingInput } from "@/audit/anomaly/rules";
import type { BeneishResult } from "@/audit/scoring/beneish";
import type { AltmanResult } from "@/audit/scoring/altman";

export interface FusionInput {
  anomalies: AnomalyFindingInput[];
  beneish: BeneishResult;
  altman: AltmanResult;
  agentConfidences: number[];
}

/** 0 = low risk, 100 = high risk (heatmap / dashboard용) */
export function fuseRiskScore(input: FusionInput): number {
  let score = 20;

  for (const a of input.anomalies) {
    if (a.severity === "HIGH") score += 18;
    else if (a.severity === "MEDIUM") score += 10;
    else score += 4;
  }

  if (input.beneish.mScore != null && input.beneish.mScore > -1.78) {
    score += 15;
  }

  if (input.altman.zScore != null) {
    if (input.altman.zone === "distress") score += 20;
    else if (input.altman.zone === "grey") score += 8;
  }

  const avgConf =
    input.agentConfidences.length > 0
      ? input.agentConfidences.reduce((a, b) => a + b, 0) /
        input.agentConfidences.length
      : 0.5;
  score += (avgConf - 0.5) * 20;

  return Math.max(0, Math.min(100, Math.round(score)));
}
