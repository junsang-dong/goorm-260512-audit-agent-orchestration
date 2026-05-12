import "dotenv/config";
import { createDb } from "../src/db";
import { industryBenchmarks } from "../src/db/schema";

const seed = [
  { industry: "반도체", metricKey: "gross_margin_mean", meanValue: 0.32 },
  { industry: "반도체", metricKey: "operating_margin_mean", meanValue: 0.14 },
  { industry: "반도체", metricKey: "debt_ratio_mean", meanValue: 0.36 },
  { industry: "조선", metricKey: "gross_margin_mean", meanValue: 0.12 },
  { industry: "조선", metricKey: "operating_margin_mean", meanValue: 0.04 },
  { industry: "조선", metricKey: "debt_ratio_mean", meanValue: 0.58 },
  { industry: "2차전지", metricKey: "gross_margin_mean", meanValue: 0.18 },
  { industry: "2차전지", metricKey: "operating_margin_mean", meanValue: 0.07 },
  { industry: "2차전지", metricKey: "debt_ratio_mean", meanValue: 0.48 },
  { industry: "바이오", metricKey: "gross_margin_mean", meanValue: 0.62 },
  { industry: "바이오", metricKey: "operating_margin_mean", meanValue: -0.05 },
  { industry: "바이오", metricKey: "debt_ratio_mean", meanValue: 0.42 },
  { industry: "일반", metricKey: "gross_margin_mean", meanValue: 0.22 },
  { industry: "일반", metricKey: "operating_margin_mean", meanValue: 0.08 },
  { industry: "일반", metricKey: "debt_ratio_mean", meanValue: 0.5 },
];

async function main() {
  const db = createDb();
  for (const row of seed) {
    await db
      .insert(industryBenchmarks)
      .values(row)
      .onConflictDoNothing({
        target: [industryBenchmarks.industry, industryBenchmarks.metricKey],
      });
  }
  console.log("Industry benchmarks seeded (idempotent).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
