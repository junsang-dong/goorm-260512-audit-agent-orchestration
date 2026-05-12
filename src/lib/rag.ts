import OpenAI from "openai";
import { cosineSimilarity } from "./vector-math";

function chunkText(text: string, maxLen = 900): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + maxLen));
    i += maxLen;
  }
  return chunks.filter((c) => c.trim().length > 40);
}

export async function embedChunks(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || texts.length === 0) return [];
  const client = new OpenAI({ apiKey });
  const res = await client.embeddings.create({
    model: process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
    input: texts,
  });
  return res.data.map((d) => d.embedding as number[]);
}

export async function ingestDocumentForRag(input: {
  runId: string;
  source: string;
  fullText: string;
  insertChunk: (args: {
    runId: string;
    source: string;
    content: string;
    embedding: number[];
  }) => Promise<void>;
}): Promise<number> {
  const chunks = chunkText(input.fullText, 950);
  if (!chunks.length) return 0;
  const embeddings = await embedChunks(chunks);
  let n = 0;
  for (let i = 0; i < chunks.length; i++) {
    const emb = embeddings[i];
    if (!emb) continue;
    await input.insertChunk({
      runId: input.runId,
      source: input.source,
      content: chunks[i]!,
      embedding: emb,
    });
    n++;
  }
  return n;
}

export function searchTopChunks(args: {
  queryEmbedding: number[];
  candidates: { id: string; content: string; embedding: number[] }[];
  k: number;
}) {
  const scored = args.candidates
    .map((c) => ({
      ...c,
      score: cosineSimilarity(args.queryEmbedding, c.embedding),
    }))
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, args.k);
}
