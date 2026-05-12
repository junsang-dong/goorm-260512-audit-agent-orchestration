import type { AnomalyFindingInput } from "@/audit/anomaly/rules";
import type { HeatmapRow, RatioYearResult } from "@/types/audit";

function levelFromScore(s: number): HeatmapRow["level"] {
  if (s >= 70) return "HIGH";
  if (s >= 40) return "MEDIUM";
  return "LOW";
}

export function buildRiskHeatmap(input: {
  anomalies: AnomalyFindingInput[];
  ratios: RatioYearResult[];
  beneishM: number | null;
  altmanZ: number | null;
}): HeatmapRow[] {
  const rows: HeatmapRow[] = [];

  const ar = input.anomalies.find((a) => a.code === "AR_OUTPACES_REVENUE");
  rows.push({
    label: "매출채권",
    score: ar ? (ar.severity === "HIGH" ? 85 : 55) : 25,
    level: levelFromScore(ar ? (ar.severity === "HIGH" ? 85 : 55) : 25),
  });

  const inv = input.anomalies.find((a) => a.code === "INVENTORY_BUILDUP");
  rows.push({
    label: "재고자산",
    score: inv ? 60 : 30,
    level: levelFromScore(inv ? 60 : 30),
  });

  const cfo = input.anomalies.find((a) => a.code === "CFO_NI_DIVERGENCE");
  rows.push({
    label: "현금흐름",
    score: cfo ? (cfo.severity === "MEDIUM" ? 72 : 50) : 28,
    level: levelFromScore(cfo ? 72 : 28),
  });

  const latest = input.ratios[0];
  let capexScore = 25;
  if (latest?.fcf != null && latest.fcf < 0) capexScore = 65;
  rows.push({
    label: "CAPEX/FCF",
    score: capexScore,
    level: levelFromScore(capexScore),
  });

  const beneishScore =
    input.beneishM != null && input.beneishM > -1.78 ? 78 : 22;
  rows.push({
    label: "Beneish M-Score",
    score: beneishScore,
    level: levelFromScore(beneishScore),
  });

  const altScore =
    input.altmanZ != null && input.altmanZ < 1.81
      ? 80
      : input.altmanZ != null && input.altmanZ < 2.99
        ? 50
        : 24;
  rows.push({
    label: "Altman Z",
    score: altScore,
    level: levelFromScore(altScore),
  });

  return rows;
}
