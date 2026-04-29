import { init, id } from "@instantdb/admin";
import { deflate, inflate } from "pako";
import type { ChatAnalytics } from "./chatAnalytics";

const APP_ID =
  process.env.INSTANT_APP_ID ??
  process.env.NEXT_PUBLIC_INSTANT_APP_ID ??
  "6d3ebf4b-4c9b-43e7-a54a-4615b71140de";
const SNAPSHOT_KEY = "chat-lbb-current";
const CHUNK_SIZE = 250_000;

type InstantDb = ReturnType<typeof init>;

let instantDb: InstantDb | null = null;

function getInstantDb() {
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
  if (!process.env.INSTANT_APP_ADMIN_TOKEN) {
    throw new Error("Falta INSTANT_APP_ADMIN_TOKEN en .env.local");
  }

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

  await db.transact(txs);
}
