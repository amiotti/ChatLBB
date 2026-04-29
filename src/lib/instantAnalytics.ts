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

  return JSON.parse(json) as ChatAnalytics;
}

export async function saveAnalyticsToDb(analytics: ChatAnalytics) {
  const db = getInstantDb();
  const json = JSON.stringify(analytics);
  const encoded = Buffer.from(deflate(json)).toString("base64");
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
      sourceName: analytics.sourceName,
      generatedAt: analytics.generatedAt,
      totalMessages: analytics.totalMessages,
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
}

export async function initExcelUpload(fileName: string, size: number) {
  const db = getInstantDb();
  const uploadId = id();

  await db.transact(
    db.tx.excelUploads[uploadId].update({
      fileName,
      size,
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

  const base64 = chunks
    .sort((a, b) => Number(a.index) - Number(b.index))
    .map((chunk) => String(chunk.payload))
    .join("");

  return {
    fileName: String(upload.fileName),
    buffer: Buffer.from(base64, "base64"),
  };
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

async function transactInBatches(db: InstantDb, txs: unknown[]) {
  for (let index = 0; index < txs.length; index += TRANSACT_BATCH_SIZE) {
    await db.transact(
      txs.slice(index, index + TRANSACT_BATCH_SIZE) as Parameters<
        InstantDb["transact"]
      >[0],
    );
  }
}
