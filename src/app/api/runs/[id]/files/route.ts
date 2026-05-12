import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { eq } from "drizzle-orm";
import { createHash } from "crypto";
import { getDb } from "@/db";
import { analysisRuns, uploadedFiles } from "@/db/schema";
import type { UploadFileKind } from "@/types/audit";

export const runtime = "nodejs";

const ALLOWED: UploadFileKind[] = [
  "business_report_pdf",
  "fs_xlsx",
  "dart_csv",
  "ir_pdf",
];

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: runId } = await ctx.params;
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "BLOB_READ_WRITE_TOKEN이 필요합니다." },
      { status: 500 },
    );
  }

  const db = getDb();
  const [run] = await db
    .select({ id: analysisRuns.id })
    .from(analysisRuns)
    .where(eq(analysisRuns.id, runId))
    .limit(1);
  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });

  const form = await request.formData();
  const file = form.get("file");
  const kind = String(form.get("kind") ?? "");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file 필드가 필요합니다." }, { status: 400 });
  }
  if (!ALLOWED.includes(kind as UploadFileKind)) {
    return NextResponse.json(
      { error: `kind는 다음 중 하나여야 합니다: ${ALLOWED.join(", ")}` },
      { status: 400 },
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const checksum = createHash("sha256").update(buf).digest("hex");
  const pathname = `runs/${runId}/${kind}/${checksum.slice(0, 12)}-${file.name}`;

  const blob = await put(pathname, buf, {
    access: "public",
    token,
    contentType: file.type || "application/octet-stream",
  });

  const [row] = await db
    .insert(uploadedFiles)
    .values({
      runId,
      kind,
      blobUrl: blob.url,
      originalName: file.name,
      checksum,
      sizeBytes: buf.length,
    })
    .returning();

  return NextResponse.json({ file: row });
}
