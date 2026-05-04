import { init, id } from "@instantdb/admin";
import { deflate, inflate } from "pako";
import type { ChatAnalytics } from "./chatAnalytics";

const APP_ID =
  process.env.INSTANT_APP_ID ??
  process.env.NEXT_PUBLIC_INSTANT_APP_ID ??
  "6d3ebf4b-4c9b-43e7-a54a-4615b71140de";
const SNAPSHOT_KEY = "chat-lbb-current";
const CHUNK_SIZE = 250_000;
const TRANSACT_BATCH_SIZE = 80;

type InstantDb = ReturnType<typeof init>;

let instantDb: InstantDb | null = null;
let analyticsCache: ChatAnalytics | null = null;

function getInstantDb() {
  if (!process.env.INSTANT_APP_ADMIN_TOKEN) {
    throw new Error("Falta INSTANT_APP_ADMIN_TOKEN en las variables de entorno.");
  }

  if (!instantDb) {
    instantDb = init({
      appId: APP_ID,
      adminToken: process.env.INSTANT_APP_ADMIN_TOKEN,
    });
  }

  return instantDb;
}

export async function loadAnalyticsFromDb() {
  if (!process.env.INSTANT_APP_ADMIN_TOKEN) {
    return null;
  }

  if (analyticsCache) {
    return analyticsCache;
  }

  const db = getInstantDb();
  const data = await db.query({
    analyticsSnapshots: {
      $: {
        where: {
          key: SNAPSHOT_KEY,
        },
      },
    },
    analyticsChunks: {
      $: {
        where: {
          snapshotKey: SNAPSHOT_KEY,
        },
      },
    },
  });
  const snapshot = data.analyticsSnapshots?.[0];
  const chunks = data.analyticsChunks ?? [];

  if (!snapshot || chunks.length === 0) {
    return null;
  }

  const encoded = chunks
    .sort((a, b) => Number(a.index) - Number(b.index))
    .map((chunk) => String(chunk.payload))
    .join("");
  const json = inflate(Buffer.from(encoded, "base64"), { to: "string" });

  analyticsCache = JSON.parse(json) as ChatAnalytics;

  return analyticsCache;
}

export async function saveAnalyticsToDb(analytics: ChatAnalytics) {
  const json = JSON.stringify(analytics);
  const encoded = Buffer.from(deflate(json)).toString("base64");
  await saveEncodedAnalyticsToDb({
    encoded,
    sourceName: analytics.sourceName,
    generatedAt: analytics.generatedAt,
    totalMessages: analytics.totalMessages,
  });
  analyticsCache = analytics;
}

export async function saveEncodedAnalyticsToDb({
  encoded,
  sourceName,
  generatedAt,
  totalMessages,
}: {
  encoded: string;
  sourceName: string;
  generatedAt: string;
  totalMessages: number;
}) {
  const db = getInstantDb();
  const chunks = encoded.match(new RegExp(`.{1,${CHUNK_SIZE}}`, "g")) ?? [];
  const existing = await db.query({
    analyticsSnapshots: {
      $: {
        where: {
          key: SNAPSHOT_KEY,
        },
      },
    },
    analyticsChunks: {
      $: {
        where: {
          snapshotKey: SNAPSHOT_KEY,
        },
      },
    },
  });
  const txs = [
    ...(existing.analyticsChunks ?? []).map((chunk) =>
      db.tx.analyticsChunks[chunk.id].delete(),
    ),
    ...(existing.analyticsSnapshots ?? []).map((snapshot) =>
      db.tx.analyticsSnapshots[snapshot.id].delete(),
    ),
    db.tx.analyticsSnapshots[id()].update({
      key: SNAPSHOT_KEY,
      sourceName,
      generatedAt,
      totalMessages,
      chunkCount: chunks.length,
      compressedBytes: encoded.length,
    }),
    ...chunks.map((payload, index) =>
      db.tx.analyticsChunks[id()].update({
        snapshotKey: SNAPSHOT_KEY,
        index,
        payload,
      }),
    ),
  ];

  await transactInBatches(db, txs);
  analyticsCache = null;
}

export async function initExcelUpload(
  fileName: string,
  size: number,
  totalChunks: number,
) {
  const db = getInstantDb();
  const uploadId = id();

  await db.transact(
    db.tx.excelUploads[uploadId].update({
      fileName,
      size,
      totalChunks,
      status: "uploading",
      createdAt: new Date().toISOString(),
    }),
  );

  return uploadId;
}

export async function saveExcelUploadChunk(
  uploadId: string,
  index: number,
  payload: string,
) {
  const db = getInstantDb();

  await db.transact(
    db.tx.excelUploadChunks[id()].update({
      uploadId,
      index,
      payload,
      receivedAt: new Date().toISOString(),
    }),
  );
}

export async function saveAnalyticsUploadChunk(
  uploadId: string,
  index: number,
  payload: string,
) {
  const db = getInstantDb();

  await db.transact(
    db.tx.analyticsUploadChunks[id()].update({
      uploadId,
      index,
      payload,
      receivedAt: new Date().toISOString(),
    }),
  );
}

export async function getExcelUploadStatus(uploadId: string) {
  const db = getInstantDb();
  const data = await db.query({
    excelUploads: {
      $: {
        where: {
          id: uploadId,
        },
      },
    },
  });
  const upload = data.excelUploads?.[0];

  if (!upload) {
    throw new Error("No se encontro la carga del Excel.");
  }

  return {
    id: String(upload.id),
    fileName: String(upload.fileName ?? ""),
    status: String(upload.status ?? "uploading"),
    totalMessages: Number(upload.totalMessages ?? 0),
    error: upload.error ? String(upload.error) : null,
    startedAt: upload.startedAt ? String(upload.startedAt) : null,
    completedAt: upload.completedAt ? String(upload.completedAt) : null,
    updatedAt: upload.updatedAt ? String(upload.updatedAt) : null,
  };
}

export async function updateExcelUploadStatus(
  uploadId: string,
  values: Record<string, string | number | null>,
) {
  const db = getInstantDb();

  await db.transact(
    db.tx.excelUploads[uploadId].update({
      ...values,
      updatedAt: new Date().toISOString(),
    }),
  );
}

export async function loadExcelUploadBuffer(uploadId: string) {
  const db = getInstantDb();
  const data = await db.query({
    excelUploads: {
      $: {
        where: {
          id: uploadId,
        },
      },
    },
    excelUploadChunks: {
      $: {
        where: {
          uploadId,
        },
      },
    },
  });
  const upload = data.excelUploads?.[0];
  const chunks = data.excelUploadChunks ?? [];

  if (!upload || chunks.length === 0) {
    throw new Error("No se encontró el Excel subido en InstantDB.");
  }

  const chunkMap = new Map<number, string>();

  for (const chunk of chunks.sort((a, b) =>
    String(a.receivedAt ?? "").localeCompare(String(b.receivedAt ?? "")),
  )) {
    const index = Number(chunk.index);

    if (Number.isFinite(index)) {
      chunkMap.set(index, String(chunk.payload));
    }
  }

  const expectedChunks = Number(upload.totalChunks || chunkMap.size);
  const missingIndexes: number[] = [];

  for (let index = 0; index < expectedChunks; index += 1) {
    if (!chunkMap.has(index)) {
      missingIndexes.push(index);
    }
  }

  if (missingIndexes.length > 0) {
    throw new Error(
      `Faltan ${missingIndexes.length} partes del Excel. Volve a intentar la carga.`,
    );
  }

  const base64 = Array.from({ length: expectedChunks }, (_, index) =>
    chunkMap.get(index) ?? "",
  ).join("");
  const buffer = Buffer.from(base64, "base64");
  const expectedSize = Number(upload.size || 0);

  if (expectedSize && buffer.length !== expectedSize) {
    throw new Error(
      `El Excel subido quedo incompleto (${buffer.length}/${expectedSize} bytes). Volve a intentar la carga.`,
    );
  }

  return {
    fileName: String(upload.fileName),
    buffer,
  };
}

export async function loadEncodedAnalyticsUpload(
  uploadId: string,
  expectedChunks: number,
) {
  const db = getInstantDb();
  const data = await db.query({
    analyticsUploadChunks: {
      $: {
        where: {
          uploadId,
        },
      },
    },
  });
  const chunks = data.analyticsUploadChunks ?? [];
  const chunkMap = new Map<number, string>();

  for (const chunk of chunks.sort((a, b) =>
    String(a.receivedAt ?? "").localeCompare(String(b.receivedAt ?? "")),
  )) {
    const index = Number(chunk.index);

    if (Number.isFinite(index)) {
      chunkMap.set(index, String(chunk.payload));
    }
  }

  const missingIndexes: number[] = [];

  for (let index = 0; index < expectedChunks; index += 1) {
    if (!chunkMap.has(index)) {
      missingIndexes.push(index);
    }
  }

  if (missingIndexes.length > 0) {
    throw new Error(
      `Faltan ${missingIndexes.length} partes de las metricas. Volve a intentar la carga.`,
    );
  }

  return Array.from({ length: expectedChunks }, (_, index) =>
    chunkMap.get(index) ?? "",
  ).join("");
}

export async function markExcelUploadAsCurrent(uploadId: string) {
  const db = getInstantDb();
  const current = await db.query({
    excelFiles: {
      $: {
        where: {
          key: "current",
        },
      },
    },
  });
  const previousUploadId = current.excelFiles?.[0]?.uploadId
    ? String(current.excelFiles[0].uploadId)
    : null;
  const txs = [
    ...(current.excelFiles ?? []).map((file) => db.tx.excelFiles[file.id].delete()),
    db.tx.excelFiles[id()].update({
      key: "current",
      uploadId,
      updatedAt: new Date().toISOString(),
    }),
    db.tx.excelUploads[uploadId].update({
      status: "current",
      completedAt: new Date().toISOString(),
    }),
  ];

  await db.transact(txs);

  if (previousUploadId && previousUploadId !== uploadId) {
    await deleteExcelUpload(previousUploadId);
  }
}

export async function deleteExcelUpload(uploadId: string) {
  const db = getInstantDb();
  const data = await db.query({
    excelUploads: {
      $: {
        where: {
          id: uploadId,
        },
      },
    },
    excelUploadChunks: {
      $: {
        where: {
          uploadId,
        },
      },
    },
  });
  const txs = [
    ...(data.excelUploadChunks ?? []).map((chunk) =>
      db.tx.excelUploadChunks[chunk.id].delete(),
    ),
    ...(data.excelUploads ?? []).map((upload) =>
      db.tx.excelUploads[upload.id].delete(),
    ),
  ];

  await transactInBatches(db, txs);
}

export async function deleteAnalyticsUploadChunks(uploadId: string) {
  const db = getInstantDb();
  const data = await db.query({
    analyticsUploadChunks: {
      $: {
        where: {
          uploadId,
        },
      },
    },
  });
  const txs = (data.analyticsUploadChunks ?? []).map((chunk) =>
    db.tx.analyticsUploadChunks[chunk.id].delete(),
  );

  await transactInBatches(db, txs);
}

async function transactInBatches(db: InstantDb, txs: unknown[]) {
  for (let index = 0; index < txs.length; index += TRANSACT_BATCH_SIZE) {
    await db.transact(
      txs.slice(index, index + TRANSACT_BATCH_SIZE) as Parameters<
        InstantDb["transact"]
      >[0],
    );
  }
}
