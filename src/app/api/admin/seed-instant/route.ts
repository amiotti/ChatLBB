import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ensureAnalytics } from "@/lib/chatAnalytics";
import { saveAnalyticsToDb } from "@/lib/instantAnalytics";

export const runtime = "nodejs";

export async function POST() {
  const cookieStore = await cookies();

  if (cookieStore.get("chat_admin")?.value !== "1") {
    return NextResponse.json(
      { ok: false, error: "No autorizado" },
      { status: 401 },
    );
  }

  const analytics = ensureAnalytics();
  await saveAnalyticsToDb({
    ...analytics,
    generatedAt: new Date().toISOString(),
  });

  return NextResponse.json({
    ok: true,
    totalMessages: analytics.totalMessages,
    storage: "instantdb",
  });
}
