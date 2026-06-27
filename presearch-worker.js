(() => {
  "use strict";

  const BLACK = 1;
  const WHITE = 2;
  const THREAT_QUIET = 0;
  const PRESEARCH_DIRECT_FLAG = "EXACT";
  const PRESEARCH_RANK_FLAG = "RANK";
  const DB_NAME = "gomoku-presearch";
  const DB_VERSION = 1;
  const META_STORE = "bucketMeta";
  const CHUNK_STORE = "bucketChunks";
  const CHUNK_SIZE = 1000;

  self.onmessage = (event) => {
    const message = event.data || {};
    if (message.type !== "load-bucket") {
      return;
    }
    loadBucket(message).catch((error) => {
      self.postMessage({
        type: "error",
        id: message.id,
        bucket: message.bucket,
        url: message.url,
        error: error?.message || String(error),
      });
    });
  };

  async function loadBucket(message) {
    const cached = await streamCachedBucket(message);
    if (cached) {
      self.postMessage({ type: "done", id: message.id, bucket: message.bucket, cached: true });
      return;
    }

    const response = await fetch(message.url, { cache: "force-cache" });
    if (!response.ok) {
      throw new Error(`presearch bucket ${message.bucket} fetch failed: ${response.status}`);
    }

    const text = await response.text();
    const payload = extractPayload(text, message.bucket);
    const chunks = decodePayload(payload);
    await writeCachedBucket(message, chunks);
    for (const entries of chunks) {
      self.postMessage({ type: "chunk", id: message.id, bucket: message.bucket, entries });
    }
    self.postMessage({ type: "done", id: message.id, bucket: message.bucket, cached: false });
  }

  function extractPayload(text, bucket) {
    const pattern = new RegExp(`PRESEARCH_BUCKETS\\s*\\[\\s*${bucket}\\s*\\]\\s*=\\s*\`([\\s\\S]*)\`;`);
    const match = String(text).match(pattern);
    return match ? match[1] : String(text);
  }

  function decodePayload(payload) {
    const chunks = [];
    let chunk = [];
    for (const line of String(payload).trim().split("\n")) {
      if (!line) {
        continue;
      }
      const entry = decodePackedPresearchEntry(line);
      if (!entry) {
        continue;
      }
      chunk.push(entry);
      if (chunk.length >= CHUNK_SIZE) {
        chunks.push(chunk);
        chunk = [];
      }
    }
    if (chunk.length > 0) {
      chunks.push(chunk);
    }
    return chunks;
  }

  function decodePackedPresearchEntry(line) {
    const parts = String(line).split("|");
    if (parts.length < 6) {
      return null;
    }
    const isV2 = parts[0] === "v2";
    const player = Number(parts[isV2 ? 1 : 0]);
    const depth = Number(parts[isV2 ? 2 : 1]);
    const score = Number(parts[isV2 ? 3 : 2]);
    const flag = isV2 ? normalizePresearchFlag(parts[4]) : PRESEARCH_RANK_FLAG;
    const signature = parts[isV2 ? 5 : 3];
    const move = decodePackedMove(parts[isV2 ? 6 : 4]);
    const candidates = parts[isV2 ? 7 : 5].split(";").map(decodePackedMove).filter(Boolean);
    const configHash = isV2 ? parts[8] || "" : "";
    const ruleHash = isV2 ? parts[9] || "" : "";
    const source = isV2 ? parts[10] || "packed-v2" : "heuristic-packed-v1";
    if (!move || (player !== BLACK && player !== WHITE)) {
      return null;
    }
    return {
      key: `pre:${player}:${signature}`,
      value: {
        name: `book-${signature || "empty"}`,
        depth,
        score,
        flag,
        source,
        configHash,
        ruleHash,
        move,
        candidates,
      },
    };
  }

  function normalizePresearchFlag(flag) {
    return String(flag || PRESEARCH_RANK_FLAG).toUpperCase() === PRESEARCH_DIRECT_FLAG
      ? PRESEARCH_DIRECT_FLAG
      : PRESEARCH_RANK_FLAG;
  }

  function decodePackedMove(text) {
    if (!text || text.length < 2) {
      return null;
    }
    const rest = text.slice(2).split(",");
    return {
      row: Number.parseInt(text[0], 36),
      col: Number.parseInt(text[1], 36),
      score: Number(rest[1] || rest[0] || 0),
      threat: Number(rest[2] || rest[1] || THREAT_QUIET),
    };
  }

  async function streamCachedBucket(message) {
    const db = await openDb().catch(() => null);
    if (!db) {
      return false;
    }
    const metaKey = makeBucketKey(message);
    const meta = await idbGet(db, META_STORE, metaKey).catch(() => null);
    if (!meta || meta.chunks < 1) {
      db.close();
      return false;
    }
    for (let index = 0; index < meta.chunks; index++) {
      const record = await idbGet(db, CHUNK_STORE, `${metaKey}:${index}`).catch(() => null);
      if (!record?.entries) {
        db.close();
        return false;
      }
      self.postMessage({ type: "chunk", id: message.id, bucket: message.bucket, entries: record.entries });
    }
    db.close();
    return true;
  }

  async function writeCachedBucket(message, chunks) {
    const db = await openDb().catch(() => null);
    if (!db) {
      return;
    }
    const metaKey = makeBucketKey(message);
    await idbTransaction(db, [META_STORE, CHUNK_STORE], "readwrite", (stores) => {
      stores[META_STORE].put({
        key: metaKey,
        bucket: message.bucket,
        cacheKey: message.cacheKey,
        chunks: chunks.length,
        entries: chunks.reduce((sum, chunk) => sum + chunk.length, 0),
        savedAt: Date.now(),
      });
      chunks.forEach((entries, index) => {
        stores[CHUNK_STORE].put({ key: `${metaKey}:${index}`, entries });
      });
    }).catch(() => {});
    db.close();
  }

  function makeBucketKey(message) {
    return `${message.cacheKey || "default"}:${message.bucket}`;
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      if (!("indexedDB" in self)) {
        reject(new Error("indexedDB unavailable"));
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE, { keyPath: "key" });
        }
        if (!db.objectStoreNames.contains(CHUNK_STORE)) {
          db.createObjectStore(CHUNK_STORE, { keyPath: "key" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function idbGet(db, storeName, key) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, "readonly");
      const request = transaction.objectStore(storeName).get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function idbTransaction(db, storeNames, mode, body) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeNames, mode);
      const stores = Object.fromEntries(storeNames.map((name) => [name, transaction.objectStore(name)]));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error("indexedDB transaction aborted"));
      body(stores);
    });
  }
})();
