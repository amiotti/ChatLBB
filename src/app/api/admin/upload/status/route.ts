import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { getExcelUploadStatus } from "@/lib/instantAnalytics";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    if (!(await isAdminRequest())) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const uploadId = String(body.uploadId ?? "");

    if (!uploadId) {
      return NextResponse.json(
        { ok: false, error: "Falta uploadId" },
        { status: 400 },
      );
    }

    const status = await getExcelUploadStatus(uploadId);

    return NextResponse.json({ ok: true, ...status });
  } catch (error) {
    console.error("[admin/upload/status] failed", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "No se pudo consultar el estado.",
      },
      { status: 500 },
    );
  }
}
