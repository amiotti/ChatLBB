"use client";

import { useRef, useState } from "react";
import { FileSpreadsheet, LogOut, RefreshCcw } from "lucide-react";

type UploadFormProps = {
  currentSource: string;
  generatedAt: string | null;
  totalMessages: number;
};

const CHUNK_BYTES = 1_200_000;
const ANALYTICS_CHUNK_CHARS = 900_000;
const UPLOAD_CONCURRENCY = 3;

export function UploadForm({
  currentSource,
  generatedAt,
  totalMessages,
}: UploadFormProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = inputRef.current?.files?.[0];

    if (!file) {
      setStatus("Elegi un archivo Excel.");
      return;
    }

    setIsUploading(true);
    setProgress(0);
    setStatus("Creando carga en InstantDB...");

    try {
      const initPayload = await postJson("/api/admin/upload/init", {
        fileName: file.name,
        size: file.size,
        totalChunks: Math.ceil(file.size / CHUNK_BYTES),
      });
      const uploadId = String(initPayload.uploadId);
      const totalChunks = Math.ceil(file.size / CHUNK_BYTES);
      let showAnalyticsStatus = false;
      let latestAnalyticsStatus = "Calculando métricas del Excel...";
      const analyticsPromise = prepareAnalyticsInWorker(file, (message, seconds) => {
        latestAnalyticsStatus = `${message} ${formatElapsed(seconds)}`.trim();

        if (showAnalyticsStatus) {
          setStatus(latestAnalyticsStatus);
        }
      });
      analyticsPromise.catch(() => undefined);

      let excelChunksDone = 0;

      await mapWithConcurrency(
        Array.from({ length: totalChunks }, (_, index) => index),
        UPLOAD_CONCURRENCY,
        async (index) => {
        const start = index * CHUNK_BYTES;
        const chunk = file.slice(start, start + CHUNK_BYTES);
        const payload = await blobToBase64(chunk);

        await postJson("/api/admin/upload/chunk", {
          uploadId,
          index,
          payload,
        });

          excelChunksDone += 1;
        const nextProgress = Math.round((excelChunksDone / totalChunks) * 52);
        setProgress(nextProgress);
        setStatus(`Subiendo Excel a InstantDB: ${excelChunksDone}/${totalChunks} partes...`);
        },
      );

      setProgress(58);
      showAnalyticsStatus = true;
      setStatus(latestAnalyticsStatus);
      await waitForPaint();

      const prepared = await analyticsPromise;

      setProgress(72);
      setStatus("Métricas listas. Guardándolas en InstantDB...");
      await waitForPaint();

      const analyticsChunks = chunkString(prepared.encoded, ANALYTICS_CHUNK_CHARS);

      let analyticsChunksDone = 0;

      await mapWithConcurrency(
        Array.from({ length: analyticsChunks.length }, (_, index) => index),
        UPLOAD_CONCURRENCY,
        async (index) => {
        await postJson("/api/admin/upload/analytics-chunk", {
          uploadId,
          index,
          payload: analyticsChunks[index],
        });

          analyticsChunksDone += 1;
        setProgress(72 + Math.round((analyticsChunksDone / analyticsChunks.length) * 22));
        setStatus(
          `Guardando métricas en InstantDB: ${analyticsChunksDone}/${analyticsChunks.length} partes...`,
        );
        },
      );

      setProgress(96);
      setStatus("Reemplazando la base actual por las métricas nuevas...");

      const completePayload = await postJson("/api/admin/upload/complete", {
        uploadId,
        preparedAnalytics: true,
        analyticsChunkCount: analyticsChunks.length,
        sourceName: prepared.sourceName,
        generatedAt: prepared.generatedAt,
        totalMessages: prepared.totalMessages,
      });

      setProgress(100);
      setStatus(
        `Listo: ${Number(completePayload.totalMessages).toLocaleString("es-AR")} mensajes procesados.`,
      );
      window.setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "No se pudo subir el archivo.");
    } finally {
      setIsUploading(false);
    }
  }

  async function logout() {
    await fetch("/api/admin/login", { method: "DELETE" });
    window.location.reload();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 rounded-md border border-[#eee5d5] bg-[#fffaf1] p-4 text-sm text-[#5b523f] sm:grid-cols-3">
        <p>
          <span className="block text-xs uppercase tracking-wide text-[#8b806d]">
            Archivo
          </span>
          <strong className="text-[#211f1b]">{currentSource}</strong>
        </p>
        <p>
          <span className="block text-xs uppercase tracking-wide text-[#8b806d]">
            Mensajes
          </span>
          <strong className="text-[#211f1b]">
            {totalMessages.toLocaleString("es-AR")}
          </strong>
        </p>
        <p>
          <span className="block text-xs uppercase tracking-wide text-[#8b806d]">
            Actualizado
          </span>
          <strong className="text-[#211f1b]">
            {generatedAt
              ? new Date(generatedAt).toLocaleString("es-AR")
              : "Pendiente"}
          </strong>
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-[#b9ab91] bg-[#fffdf9] p-6 text-center transition hover:border-[#0d3b3e]">
          <FileSpreadsheet className="text-[#0d3b3e]" size={34} />
          <span className="text-sm font-semibold">
            Seleccionar Excel actualizado
          </span>
          <input
            ref={inputRef}
            name="file"
            type="file"
            accept=".xlsx,.xls"
            className="max-w-full text-sm"
          />
        </label>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            disabled={isUploading}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#0d3b3e] px-4 text-sm font-bold text-white transition hover:bg-[#155d60] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCcw size={16} />
            {isUploading ? "Procesando" : "Subir y recalcular"}
          </button>
          <button
            type="button"
            onClick={logout}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-[#cfc4af] px-4 text-sm font-bold text-[#5b523f] transition hover:bg-[#fff8eb]"
          >
            <LogOut size={16} />
            Salir
          </button>
        </div>
      </form>

      {status ? <p className="text-sm font-medium text-[#5b523f]">{status}</p> : null}
      {isUploading ? (
        <div className="h-3 overflow-hidden rounded-full bg-[#e5dcc9]">
          <div
            className="h-full rounded-full bg-[#0d3b3e] transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();
  let payload: { ok?: boolean; error?: string; [key: string]: unknown } = {};

  if (contentType.includes("application/json") && text) {
    payload = JSON.parse(text);
  } else if (!response.ok) {
    const preview = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

    throw new Error(
      `La API devolvió ${response.status} ${response.statusText}. ${
        preview ? preview.slice(0, 180) : "No hubo detalle del servidor."
      }`,
    );
  }

  if (!response.ok || !payload.ok) {
    throw new Error(payload.error ?? "No se pudo completar la operación.");
  }

  return payload;
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function chunkString(value: string, size: number) {
  const chunks: string[] = [];

  for (let index = 0; index < value.length; index += size) {
    chunks.push(value.slice(index, index + size));
  }

  return chunks;
}

function waitForPaint() {
  return new Promise<void>((resolve) =>
    window.requestAnimationFrame(() => resolve()),
  );
}

function prepareAnalyticsInWorker(
  file: File,
  onStatus: (message: string, elapsedSeconds: number) => void,
) {
  return new Promise<{
    encoded: string;
    generatedAt: string;
    sourceName: string;
    totalMessages: number;
  }>(async (resolve, reject) => {
    const worker = new Worker(new URL("./analytics-worker.ts", import.meta.url), {
      type: "module",
    });
    const startedAt = Date.now();
    let lastMessage = "Calculando métricas del Excel...";
    const interval = window.setInterval(() => {
      onStatus(lastMessage, Math.round((Date.now() - startedAt) / 1000));
    }, 1000);

    worker.onmessage = (event: MessageEvent<Record<string, unknown>>) => {
      if (event.data.type === "status") {
        lastMessage = String(event.data.status ?? lastMessage);
        onStatus(lastMessage, Math.round((Date.now() - startedAt) / 1000));
        return;
      }

      window.clearInterval(interval);
      worker.terminate();

      if (event.data.type === "done") {
        resolve({
          encoded: String(event.data.encoded ?? ""),
          generatedAt: String(event.data.generatedAt ?? new Date().toISOString()),
          sourceName: String(event.data.sourceName ?? file.name),
          totalMessages: Number(event.data.totalMessages ?? 0),
        });
        return;
      }

      reject(new Error(String(event.data.error ?? "No se pudieron calcular las métricas.")));
    };
    worker.onerror = (error) => {
      window.clearInterval(interval);
      worker.terminate();
      reject(new Error(error.message || "No se pudieron calcular las métricas."));
    };

    try {
      const arrayBuffer = await file.arrayBuffer();
      worker.postMessage({ fileName: file.name, arrayBuffer }, [arrayBuffer]);
    } catch (error) {
      window.clearInterval(interval);
      worker.terminate();
      reject(error);
    }
  });
}

function formatElapsed(seconds: number) {
  if (seconds < 2) {
    return "";
  }

  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;

  return minutes > 0
    ? `(${minutes}m ${String(rest).padStart(2, "0")}s)`
    : `(${seconds}s)`;
}

async function mapWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
) {
  let cursor = 0;

  async function runNext() {
    while (cursor < items.length) {
      const current = items[cursor];
      cursor += 1;
      await worker(current);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => runNext()),
  );
}
