import { Dashboard } from "@/components/dashboard";
import { loadAnalytics } from "@/lib/chatAnalytics";
import { loadAnalyticsFromDb } from "@/lib/instantAnalytics";

export const dynamic = "force-dynamic";

export default async function Home() {
  const analytics = (await loadAnalyticsFromDb()) ?? loadAnalytics();

  if (!analytics) {
    return (
      <main className="app-shell flex min-h-screen items-center justify-center px-6">
        <section className="panel-card max-w-xl p-6 text-center">
          <h1 className="text-2xl font-black text-[var(--foreground)]">
            Faltan datos del chat
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
            Configurá `INSTANT_APP_ADMIN_TOKEN` en Vercel o cargá el Excel desde
            el panel admin para publicar las métricas.
          </p>
        </section>
      </main>
    );
  }

  return <Dashboard analytics={analytics} />;
}
