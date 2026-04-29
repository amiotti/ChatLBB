import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { saveExcelUploadChunk } from "@/lib/instantAnalytics";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    if (!(await isAdminRequest())) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const uploadId = String(body.uploadId ?? "");
    const index = Number(body.index);
    const payload = String(body.payload ?? "");

    if (!uploadId || !Number.isFinite(index) || !payload) {
      return NextResponse.json(
        { ok: false, error: "Chunk invalido" },
        { status: 400 },
      );
    }

    console.log("[admin/upload/chunk] saving", {
      uploadId,
      index,
      payloadBytes: payload.length,
    });
    await saveExcelUploadChunk(uploadId, index, payload);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin/upload/chunk] failed", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "No se pudo guardar la parte del Excel.",
      },
      { status: 500 },
    );
  }
}
