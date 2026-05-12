export async function runPerplexitySonar(input: {
  companyName: string;
  stockCode?: string | null;
}) {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    return {
      skipped: true,
      reason: "PERPLEXITY_API_KEY 없음",
      payload: {} as Record<string, unknown>,
      confidence: 0,
    };
  }
  const query = `${input.companyName} ${input.stockCode ?? ""} 최근 12개월 회계 이슈, 소송, 공시 경고, 애널리스트 우려, 뉴스 요약`;
  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.PERPLEXITY_MODEL ?? "sonar-pro",
      messages: [{ role: "user", content: query }],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Perplexity HTTP ${res.status}: ${err}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content ?? "";
  return {
    skipped: false,
    payload: { external_market_scan: content },
    confidence: 0.6,
  };
}
