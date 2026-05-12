import Anthropic from "@anthropic-ai/sdk";

export async function runClaudeAuditAgent(input: {
  companyName: string;
  longContext: string;
}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      skipped: true,
      reason: "ANTHROPIC_API_KEY 없음",
      payload: {} as Record<string, unknown>,
      confidence: 0,
    };
  }
  const client = new Anthropic({ apiKey });
  const textBlock = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? "claude-3-5-sonnet-20241022",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `기업명: ${input.companyName}\n\n다음은 사업보고서/공시에서 추출한 텍스트 발췌입니다. 회계 리스크, 수익인식·충당부채 등 감사인이 주목할 포인트를 한국어로 구조화해 설명하세요.\n\n---\n${input.longContext.slice(0, 90000)}`,
      },
    ],
  });
  const text = textBlock.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("\n");
  return {
    skipped: false,
    payload: { narrative: text },
    confidence: 0.72,
  };
}
