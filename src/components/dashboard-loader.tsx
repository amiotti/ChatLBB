"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Beer, Loader2, Shield } from "lucide-react";
import type { ChatAnalytics } from "@/lib/chatAnalytics";

const Dashboard = dynamic(
  () => import("@/components/dashboard").then((module) => module.Dashboard),
  {
    ssr: false,
    loading: () => <LoadingPanel message="Preparando graficos y filtros..." />,
  },
);

type LoadState =
  | { status: "loading"; analytics?: never; error?: never }
  | { status: "ready"; analytics: ChatAnalytics; error?: never }
  | { status: "error"; analytics?: never; error: string };

export function DashboardLoader() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();

    async function loadAnalytics() {
      try {
        const response = await fetch("/api/analytics", {
          signal: controller.signal,
          headers: {
            Accept: "application/json",
          },
        });
        const payload = await response.json();

        if (!response.ok || !payload.ok) {
          throw new Error(payload.error ?? "No se pudieron cargar las metricas.");
        }

        setState({ status: "ready", analytics: payload.analytics });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setState({
          status: "error",
          error:
            error instanceof Error
              ? error.message
              : "No se pudieron cargar las metricas.",
        });
      }
    }

    loadAnalytics();

    return () => controller.abort();
  }, []);

  if (state.status === "ready") {
    return <Dashboard analytics={state.analytics} />;
  }

  return (
    <main className="app-shell flex min-h-screen items-center justify-center px-5 py-10">
      <section className="panel-card w-full max-w-xl p-6 text-center">
        <StatusIcon loading={state.status === "loading"} />
        <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--beer)]/30 bg-[var(--beer)]/10 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--beer)]">
          <Beer size={16} />
          ANALISIS DEL CHAT HISTORICO DE LBB
        </p>
        <h1 className="text-3xl font-black text-[var(--foreground)]">
          {state.status === "loading" ? "Cargando metricas" : "Faltan datos del chat"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          {state.status === "loading"
            ? "Preparando el dashboard. La primera carga puede tardar un momento, despues queda cacheada."
            : state.error}
        </p>
        <Link
          href="/admin"
          className="primary-action mt-6 inline-flex h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-black transition hover:scale-[1.03]"
        >
          <Shield size={16} />
          Admin
        </Link>
      </section>
    </main>
  );
}

function LoadingPanel({ message }: { message: string }) {
  return (
    <main className="app-shell flex min-h-screen items-center justify-center px-5 py-10">
      <section className="panel-card w-full max-w-xl p-6 text-center">
        <StatusIcon loading />
        <h1 className="text-3xl font-black text-[var(--foreground)]">
          Cargando dashboard
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{message}</p>
      </section>
    </main>
  );
}

function StatusIcon({ loading }: { loading: boolean }) {
  return (
    <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl border border-[var(--beer)]/30 bg-[var(--beer)]/10 text-[var(--beer)]">
      {loading ? <Loader2 className="animate-spin" size={26} /> : <Beer size={26} />}
    </div>
  );
}
