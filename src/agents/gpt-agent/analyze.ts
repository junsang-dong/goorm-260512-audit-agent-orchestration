import OpenAI from "openai";

const gptSchema = {
  name: "audit_gpt_analysis",
  strict: false,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      executive_summary: { type: "string" },
      risk_bullets: {
        type: "array",
        items: { type: "string" },
      },
      recommended_procedures: {
        type: "array",
        items: { type: "string" },
      },
      confidence: { type: "number" },
    },
    required: [
      "executive_summary",
      "risk_bullets",
      "recommended_procedures",
      "confidence",
    ],
  },
} as const;

export interface GptAuditInput {
  companyName: string;
  /** Deterministic numbers / ratios JSON string for grounding */
  quantitativeContext: string;
}

export async function runGptAuditAgent(input: GptAuditInput) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      skipped: true,
      reason: "OPENAI_API_KEY 없음",
      payload: {},
      confidence: 0,
    };
  }
  const client = new OpenAI({ apiKey });
  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
    messages: [
      {
        role: "system",
        content:
          "당신은 한국 상장사 재무감사 보조 AI입니다. 제공된 정량 수치는 외부에서 계산된 것이며 절대 변경하지 마세요. 수치와 모순되는 서술을 하지 마세요. 한국어로 간결하게 작성하세요.",
      },
      {
        role: "user",
        content: `기업: ${input.companyName}\n\n정량 컨텍스트(JSON):\n${input.quantitativeContext}\n\n위 수치를 근거로 이상징후 해석, 감사 절차 제안을 JSON 스키마에 맞춰 출력하세요.`,
      },
    ],
    response_format: { type: "json_schema", json_schema: gptSchema },
  });
  const text = completion.choices[0]?.message?.content;
  if (!text) throw new Error("Empty GPT response");
  const payload = JSON.parse(text) as {
    executive_summary: string;
    risk_bullets: string[];
    recommended_procedures: string[];
    confidence: number;
  };
  return {
    skipped: false,
    payload,
    confidence: payload.confidence,
  };
}
