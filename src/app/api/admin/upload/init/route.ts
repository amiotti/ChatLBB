import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { initExcelUpload } from "@/lib/instantAnalytics";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const fileName = String(body.fileName ?? "");
  const size = Number(body.size ?? 0);

  if (!/\.(xlsx|xls)$/i.test(fileName) || !size) {
    return NextResponse.json(
      { ok: false, error: "Archivo Excel inválido" },
      { status: 400 },
    );
  }

  const uploadId = await initExcelUpload(fileName, size);

  return NextResponse.json({ ok: true, uploadId });
}
