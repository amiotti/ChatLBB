"use client";

import { useRef, useState } from "react";
import { FileSpreadsheet, LogOut, RefreshCcw } from "lucide-react";

type UploadFormProps = {
  currentSource: string;
  generatedAt: string | null;
  totalMessages: number;
};

export function UploadForm({
  currentSource,
  generatedAt,
  totalMessages,
}: UploadFormProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = inputRef.current?.files?.[0];

    if (!file) {
      setStatus("Elegi un archivo Excel.");
      return;
    }

    setIsUploading(true);
    setStatus("Procesando Excel. Puede tardar un poco si tiene muchas filas...");

    const body = new FormData();
    body.append("file", file);

    const response = await fetch("/api/admin/upload", {
      method: "POST",
      body,
    });
    const payload = await response.json();

    setIsUploading(false);

    if (!response.ok) {
      setStatus(payload.error ?? "No se pudo subir el archivo.");
      return;
    }

    setStatus(`Listo: ${payload.totalMessages.toLocaleString("es-AR")} mensajes procesados.`);
    window.setTimeout(() => window.location.reload(), 1000);
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
    </div>
  );
}
