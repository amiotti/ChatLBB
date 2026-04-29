import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { saveExcelUploadChunk } from "@/lib/instantAnalytics";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const uploadId = String(body.uploadId ?? "");
  const index = Number(body.index);
  const payload = String(body.payload ?? "");

  if (!uploadId || !Number.isFinite(index) || !payload) {
    return NextResponse.json(
      { ok: false, error: "Chunk inválido" },
      { status: 400 },
    );
  }

  await saveExcelUploadChunk(uploadId, index, payload);

  return NextResponse.json({ ok: true });
}
