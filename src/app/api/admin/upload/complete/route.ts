import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { buildAnalyticsFromExcelBuffer } from "@/lib/chatAnalytics";
import {
  loadExcelUploadBuffer,
  markExcelUploadAsCurrent,
  saveAnalyticsToDb,
} from "@/lib/instantAnalytics";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
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

  try {
    const { fileName, buffer } = await loadExcelUploadBuffer(uploadId);
    const analytics = buildAnalyticsFromExcelBuffer(buffer, fileName);
    const nextAnalytics = {
      ...analytics,
      generatedAt: new Date().toISOString(),
      sourceName: fileName,
    };

    await saveAnalyticsToDb(nextAnalytics);
    await markExcelUploadAsCurrent(uploadId);

    return NextResponse.json({
      ok: true,
      totalMessages: analytics.totalMessages,
      storage: "instantdb",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "No se pudo procesar",
      },
      { status: 500 },
    );
  }
}
