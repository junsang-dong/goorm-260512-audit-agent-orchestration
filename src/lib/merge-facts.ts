import type { FactsByYear } from "@/types/audit";

export function mergeFacts(...sources: FactsByYear[]): FactsByYear {
  const out: FactsByYear = {};
  for (const src of sources) {
    for (const [yStr, row] of Object.entries(src)) {
      const y = Number(yStr);
      if (!Number.isFinite(y)) continue;
      out[y] = { ...(out[y] ?? {}), ...(row ?? {}) };
    }
  }
  return out;
}
