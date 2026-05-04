import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { initExcelUpload } from "@/lib/instantAnalytics";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    if (!(await isAdminRequest())) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const fileName = String(body.fileName ?? "");
    const size = Number(body.size ?? 0);
    const totalChunks = Number(body.totalChunks ?? 0);

    if (
      !/\.(xlsx|xls)$/i.test(fileName) ||
      !size ||
      !Number.isFinite(totalChunks) ||
      totalChunks < 0
    ) {
      return NextResponse.json(
        { ok: false, error: "Archivo Excel invalido" },
        { status: 400 },
      );
    }

    console.log("[admin/upload/init] starting", { fileName, size, totalChunks });
    const uploadId = await initExcelUpload(fileName, size, totalChunks);

    return NextResponse.json({ ok: true, uploadId });
  } catch (error) {
    console.error("[admin/upload/init] failed", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "No se pudo iniciar la carga.",
      },
      { status: 500 },
    );
  }
}
