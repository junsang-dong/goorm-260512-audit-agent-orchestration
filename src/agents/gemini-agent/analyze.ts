import { GoogleGenerativeAI } from "@google/generative-ai";

export async function runGeminiMultimodalPdf(input: {
  companyName: string;
  pdfBase64: string;
  mimeType?: string;
}) {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    return {
      skipped: true,
      reason: "GOOGLE_GENERATIVE_AI_API_KEY 없음",
      payload: {} as Record<string, unknown>,
      confidence: 0,
    };
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
  });
  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `${input.companyName} IR/사업보고서 PDF입니다. 표·그래프·텍스트에서 재무적 이상징후 가능성이 있는 시각적 단서를 한국어로 요약하세요.`,
          },
          {
            inlineData: {
              mimeType: input.mimeType ?? "application/pdf",
              data: input.pdfBase64,
            },
          },
        ],
      },
    ],
  });
  const text = result.response.text();
  return {
    skipped: false,
    payload: { multimodal_summary: text },
    confidence: 0.68,
  };
}
