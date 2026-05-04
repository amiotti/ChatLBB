import { NextResponse } from "next/server";
import { loadAnalytics } from "@/lib/chatAnalytics";
import { loadAnalyticsFromDb } from "@/lib/instantAnalytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();

  try {
    const analytics = (await loadAnalyticsFromDb()) ?? loadAnalytics();

    if (!analytics) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Configura INSTANT_APP_ADMIN_TOKEN en Vercel o carga el Excel desde el panel admin.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        analytics,
        elapsedMs: Date.now() - startedAt,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
          "CDN-Cache-Control": "no-store",
          "Vercel-CDN-Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("[api/analytics] failed", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "No se pudieron cargar las metricas.",
      },
      { status: 500 },
    );
  }
}
