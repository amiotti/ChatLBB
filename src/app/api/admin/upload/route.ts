import fs from "node:fs/promises";
import path from "node:path";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { buildAnalyticsFromExcel, EXCEL_PATH } from "@/lib/chatAnalytics";
import { saveAnalyticsToDb } from "@/lib/instantAnalytics";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const cookieStore = await cookies();

  if (cookieStore.get("chat_admin")?.value !== "1") {
    return NextResponse.json(
      { ok: false, error: "No autorizado" },
      { status: 401 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { ok: false, error: "Subi un archivo Excel" },
      { status: 400 },
    );
  }

  if (!/\.(xlsx|xls)$/i.test(file.name)) {
    return NextResponse.json(
      { ok: false, error: "El archivo debe ser .xlsx o .xls" },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const tempPath = path.join(path.dirname(EXCEL_PATH), `upload-${Date.now()}.xlsx`);

  await fs.mkdir(path.dirname(EXCEL_PATH), { recursive: true });
  await fs.writeFile(tempPath, buffer);

  try {
    const analytics = buildAnalyticsFromExcel(tempPath);
    await saveAnalyticsToDb({
      ...analytics,
      generatedAt: new Date().toISOString(),
      sourceName: file.name,
    });
    await fs.rm(tempPath, { force: true });

    return NextResponse.json({
      ok: true,
      totalMessages: analytics.totalMessages,
      storage: "instantdb",
    });
  } catch (error) {
    await fs.rm(tempPath, { force: true });

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "No se pudo procesar",
      },
      { status: 500 },
    );
  }
}
