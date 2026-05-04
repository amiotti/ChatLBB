import { deflate } from "pako";
import { buildAnalyticsFromExcelArrayBuffer } from "@/lib/chatAnalytics";

type WorkerRequest = {
  fileName: string;
  arrayBuffer: ArrayBuffer;
};

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  try {
    const { fileName, arrayBuffer } = event.data;
    const generatedAt = new Date().toISOString();

    postMessage({ type: "status", status: "Calculando métricas del Excel..." });

    const analytics = buildAnalyticsFromExcelArrayBuffer(arrayBuffer, fileName);
    const nextAnalytics = {
      ...analytics,
      generatedAt,
      sourceName: fileName,
    };

    postMessage({ type: "status", status: "Comprimiendo métricas..." });

    const encoded = bytesToBase64(deflate(JSON.stringify(nextAnalytics)));

    postMessage({
      type: "done",
      encoded,
      generatedAt,
      sourceName: fileName,
      totalMessages: nextAnalytics.totalMessages,
    });
  } catch (error) {
    postMessage({
      type: "error",
      error:
        error instanceof Error
          ? error.message
          : "No se pudieron calcular las métricas.",
    });
  }
};

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const batchSize = 0x8000;

  for (let index = 0; index < bytes.length; index += batchSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + batchSize));
  }

  return btoa(binary);
}
