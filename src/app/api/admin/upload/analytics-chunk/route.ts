import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { saveAnalyticsUploadChunk } from "@/lib/instantAnalytics";

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
        { ok: false, error: "Chunk de métricas inválido" },
        { status: 400 },
      );
    }

    await saveAnalyticsUploadChunk(uploadId, index, payload);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin/upload/analytics-chunk] failed", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "No se pudo guardar la parte de métricas.",
      },
      { status: 500 },
    );
  }
}
