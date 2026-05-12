import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import type { FactsByYear } from "@/types/audit";
import { runGptAuditAgent } from "@/agents/gpt-agent/analyze";
import { runClaudeAuditAgent } from "@/agents/claude-agent/analyze";
import { runGeminiMultimodalPdf } from "@/agents/gemini-agent/analyze";
import { runPerplexitySonar } from "@/agents/perplexity-agent/analyze";

export interface AuditGraphContext {
  runId: string;
  companyName: string;
  stockCode?: string | null;
  industry?: string | null;
  quantitativeContext: string;
  longTextContext: string;
  pdfBase64?: string | null;
  facts: FactsByYear;
}

export interface AuditGraphResult {
  gpt: Awaited<ReturnType<typeof runGptAuditAgent>>;
  claude: Awaited<ReturnType<typeof runClaudeAuditAgent>>;
  gemini: Awaited<ReturnType<typeof runGeminiMultimodalPdf>>;
  perplexity: Awaited<ReturnType<typeof runPerplexitySonar>>;
  evaluation: string;
  synthesis: string;
}

const AuditState = Annotation.Root({
  ctx: Annotation<AuditGraphContext>({
    reducer: (a, b) => ({ ...a, ...b }),
    default: () =>
      ({
        runId: "",
        companyName: "",
        quantitativeContext: "{}",
        longTextContext: "",
        facts: {},
      }) as AuditGraphContext,
  }),
  gpt: Annotation<Awaited<ReturnType<typeof runGptAuditAgent>> | null>({
    reducer: (_a, b) => b,
    default: () => null,
  }),
  claude: Annotation<Awaited<ReturnType<typeof runClaudeAuditAgent>> | null>({
    reducer: (_a, b) => b,
    default: () => null,
  }),
  gemini: Annotation<Awaited<ReturnType<typeof runGeminiMultimodalPdf>> | null>(
    {
      reducer: (_a, b) => b,
      default: () => null,
    },
  ),
  perplexity: Annotation<
    Awaited<ReturnType<typeof runPerplexitySonar>> | null
  >({
    reducer: (_a, b) => b,
    default: () => null,
  }),
  evaluation: Annotation<string>({
    reducer: (_a, b) => b,
    default: () => "",
  }),
  synthesis: Annotation<string>({
    reducer: (_a, b) => b,
    default: () => "",
  }),
});

async function specialistNode(state: typeof AuditState.State) {
  const { ctx } = state;
  const [gpt, claude, gemini, perplexity] = await Promise.all([
    runGptAuditAgent({
      companyName: ctx.companyName,
      quantitativeContext: ctx.quantitativeContext,
    }),
    runClaudeAuditAgent({
      companyName: ctx.companyName,
      longContext: ctx.longTextContext,
    }),
    ctx.pdfBase64
      ? runGeminiMultimodalPdf({
          companyName: ctx.companyName,
          pdfBase64: ctx.pdfBase64,
        })
      : Promise.resolve({
          skipped: true,
          reason: "PDF 미제공",
          payload: {},
          confidence: 0,
        }),
    runPerplexitySonar({
      companyName: ctx.companyName,
      stockCode: ctx.stockCode,
    }),
  ]);
  return { gpt, claude, gemini, perplexity };
}

function evaluatorNode(state: typeof AuditState.State) {
  const issues: string[] = [];
  const g = state.gpt;
  if (g && !g.skipped && typeof g.confidence === "number" && g.confidence < 0.35) {
    issues.push("GPT confidence가 낮습니다. 근거 재검토가 필요합니다.");
  }
  if (state.claude?.skipped && state.gemini?.skipped) {
    issues.push("장문/멀티모달 에이전트가 모두 비활성화되어 문서 심층 검토가 제한됩니다.");
  }
  const evaluation =
    issues.length === 0
      ? "에이전트 출력 간 중대한 모순은 탐지되지 않았습니다(자동 평가 한계 있음)."
      : issues.join(" ");
  return { evaluation };
}

function synthesizerNode(state: typeof AuditState.State) {
  const parts: string[] = [];
  const g = state.gpt;
  if (g && !g.skipped && "payload" in g && g.payload && typeof g.payload === "object") {
    const p = g.payload as { executive_summary?: string };
    if (p.executive_summary) parts.push(`[요약] ${p.executive_summary}`);
  }
  if (state.claude && !state.claude.skipped) {
    const n = (state.claude.payload as { narrative?: string })?.narrative;
    if (n) parts.push(`[문서 해석] ${n.slice(0, 1200)}`);
  }
  if (state.gemini && !state.gemini.skipped) {
    const m = (state.gemini.payload as { multimodal_summary?: string })
      ?.multimodal_summary;
    if (m) parts.push(`[멀티모달] ${m.slice(0, 800)}`);
  }
  if (state.perplexity && !state.perplexity.skipped) {
    const e = (state.perplexity.payload as { external_market_scan?: string })
      ?.external_market_scan;
    if (e) parts.push(`[외부 검증] ${e.slice(0, 800)}`);
  }
  parts.push(`[Evaluator] ${state.evaluation}`);
  return { synthesis: parts.join("\n\n") };
}

const graphBuilder = new StateGraph(AuditState)
  .addNode("specialists", specialistNode)
  .addNode("evaluator", evaluatorNode)
  .addNode("synthesizer", synthesizerNode)
  .addEdge(START, "specialists")
  .addEdge("specialists", "evaluator")
  .addEdge("evaluator", "synthesizer")
  .addEdge("synthesizer", END);

const compiled = graphBuilder.compile();

export async function runAuditAgentGraph(
  ctx: AuditGraphContext,
): Promise<AuditGraphResult> {
  const out = await compiled.invoke({
    ctx,
    gpt: null,
    claude: null,
    gemini: null,
    perplexity: null,
    evaluation: "",
    synthesis: "",
  });
  return {
    gpt: out.gpt!,
    claude: out.claude!,
    gemini: out.gemini!,
    perplexity: out.perplexity!,
    evaluation: out.evaluation,
    synthesis: out.synthesis,
  };
}
