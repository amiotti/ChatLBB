import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { buildAnalyticsFromExcelBuffer } from "@/lib/chatAnalytics";
import {
  loadExcelUploadBuffer,
  markExcelUploadAsCurrent,
  saveAnalyticsToDb,
  updateExcelUploadStatus,
} from "@/lib/instantAnalytics";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  let uploadId = "";
  const startedAt = Date.now();

  try {
    if (!(await isAdminRequest())) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    uploadId = String(body.uploadId ?? "");

    if (!uploadId) {
      return NextResponse.json(
        { ok: false, error: "Falta uploadId" },
        { status: 400 },
      );
    }

    await updateExcelUploadStatus(uploadId, {
      status: "processing",
      startedAt: new Date().toISOString(),
      completedAt: null,
      elapsedMs: 0,
      error: "",
    });

    const { fileName, buffer } = await loadExcelUploadBuffer(uploadId);
    const analytics = buildAnalyticsFromExcelBuffer(buffer, fileName);
    const nextAnalytics = {
      ...analytics,
      generatedAt: new Date().toISOString(),
      sourceName: fileName,
    };

    await saveAnalyticsToDb(nextAnalytics);
    await markExcelUploadAsCurrent(uploadId);
    await updateExcelUploadStatus(uploadId, {
      status: "current",
      totalMessages: analytics.totalMessages,
      completedAt: new Date().toISOString(),
      elapsedMs: Date.now() - startedAt,
      error: "",
    });

    return NextResponse.json({
      ok: true,
      processing: false,
      totalMessages: analytics.totalMessages,
      elapsedMs: Date.now() - startedAt,
    });
  } catch (error) {
    console.error("[admin/upload/complete] failed", error);

    if (uploadId) {
      await updateExcelUploadStatus(uploadId, {
        status: "failed",
        error: error instanceof Error ? error.message : "No se pudo procesar",
        elapsedMs: Date.now() - startedAt,
      });
    }

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "No se pudo procesar",
      },
      { status: 500 },
    );
  }
}
