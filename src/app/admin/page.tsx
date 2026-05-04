import { cookies } from "next/headers";
import Link from "next/link";
import { Lock, UploadCloud } from "lucide-react";
import { loadAnalytics } from "@/lib/chatAnalytics";
import { loadAnalyticsFromDb } from "@/lib/instantAnalytics";
import { UploadForm } from "./upload-form";

export default async function AdminPage() {
  const cookieStore = await cookies();
  const isAdmin = cookieStore.get("chat_admin")?.value === "1";
  const analytics = isAdmin ? (await loadAnalyticsFromDb()) ?? loadAnalytics() : null;

  return (
    <main className="min-h-screen bg-[#f6f2ea] px-5 py-8 text-[#211f1b]">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <nav className="flex items-center justify-between">
          <Link href="/" className="text-sm font-semibold text-[#6b5f4b]">
            Volver al dashboard
          </Link>
        </nav>

        <section className="rounded-lg border border-[#ded4c2] bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-md bg-[#0d3b3e] text-white">
              {isAdmin ? <UploadCloud size={22} /> : <Lock size={22} />}
            </div>
            <div>
              <h1 className="text-2xl font-bold">Admin de carga</h1>
              <p className="text-sm text-[#6b5f4b]">
                Actualiza el Excel que alimenta las metricas publicas.
              </p>
            </div>
          </div>

          {isAdmin ? (
            <UploadForm
              currentSource={analytics?.sourceName ?? "Sin archivo"}
              generatedAt={analytics?.generatedAt ?? null}
              totalMessages={analytics?.totalMessages ?? 0}
            />
          ) : (
            <form
              action="/api/admin/login"
              method="post"
              className="flex flex-col gap-4"
            >
              <label className="flex flex-col gap-2 text-sm font-semibold">
                Clave admin
                <input
                  name="password"
                  type="password"
                  className="h-11 rounded-md border border-[#cfc4af] bg-[#fffdf9] px-3 outline-none ring-[#0d3b3e]/20 transition focus:ring-4"
                  placeholder="ADMIN_PASSWORD o admin"
                />
              </label>
              <button className="h-11 rounded-md bg-[#0d3b3e] px-4 text-sm font-bold text-white transition hover:bg-[#155d60]">
                Entrar
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
