"use client";

import { useRef, useState } from "react";
import { FileSpreadsheet, LogOut, RefreshCcw } from "lucide-react";

type UploadFormProps = {
  currentSource: string;
  generatedAt: string | null;
  totalMessages: number;
};

const CHUNK_BYTES = 600_000;

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

      for (let index = 0; index < totalChunks; index += 1) {
        const start = index * CHUNK_BYTES;
        const chunk = file.slice(start, start + CHUNK_BYTES);
        const payload = await blobToBase64(chunk);

        await postJson("/api/admin/upload/chunk", {
          uploadId,
          index,
          payload,
        });

        const nextProgress = Math.round(((index + 1) / totalChunks) * 80);
        setProgress(nextProgress);
        setStatus(`Subiendo Excel a InstantDB: ${index + 1}/${totalChunks} partes...`);
      }

      setProgress(85);
      setStatus("Excel subido. Procesando metricas desde la BD... puede tardar unos minutos.");

      const completePayload = await postJson("/api/admin/upload/complete", {
        uploadId,
      });
      const finalPayload = completePayload.processing
        ? await waitForProcessing(uploadId, setProgress, setStatus)
        : completePayload;

      setProgress(100);
      setStatus(
        `Listo: ${Number(finalPayload.totalMessages).toLocaleString("es-AR")} mensajes procesados.`,
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

async function waitForProcessing(
  uploadId: string,
  setProgress: (value: number) => void,
  setStatus: (value: string) => void,
) {
  const startedAt = Date.now();
  let checks = 0;

  while (Date.now() - startedAt < 10 * 60 * 1000) {
    await sleep(3000);
    checks += 1;

    const payload = await postJson("/api/admin/upload/status", { uploadId });
    const status = String(payload.status ?? "");

    if (status === "current") {
      return payload;
    }

    if (status === "failed") {
      throw new Error(String(payload.error ?? "No se pudo procesar el Excel."));
    }

    const nextProgress = Math.min(98, 85 + checks);
    const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000);
    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = elapsedSeconds % 60;

    const elapsed =
      minutes > 0
        ? `${minutes}m ${String(seconds).padStart(2, "0")}s`
        : `${seconds}s`;

    setProgress(nextProgress);
    setStatus(`Procesando metricas en segundo plano... ${elapsed}`);
  }

  throw new Error("El procesamiento sigue tardando demasiado. Volve a revisar el estado en unos minutos.");
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
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
