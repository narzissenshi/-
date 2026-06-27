((root, factory) => {
  const api = factory(root || {});
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.GomokuModelStore = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, (root) => {
  "use strict";

  const DB_NAME = "gomoku-lab";
  const DB_VERSION = 1;
  const STORES = ["profiles", "models", "samples", "matches"];
  const memory = {
    profiles: new Map(),
    models: new Map(),
    samples: new Map(),
    matches: new Map(),
  };
  let dbPromise = null;
  let fallbackOnly = false;

  function nowId(prefix) {
    const stamp = Date.now().toString(36);
    const random = Math.floor(Math.random() * 0xffffff).toString(36).padStart(5, "0");
    return `${prefix}-${stamp}-${random}`;
  }

  function openDb() {
    if (fallbackOnly || !("indexedDB" in root)) {
      fallbackOnly = true;
      return Promise.resolve(null);
    }
    if (dbPromise) {
      return dbPromise;
    }
    dbPromise = new Promise((resolve, reject) => {
      const request = root.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        for (const name of STORES) {
          if (!db.objectStoreNames.contains(name)) {
            db.createObjectStore(name, { keyPath: "id" });
          }
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        fallbackOnly = true;
        reject(request.error);
      };
    }).catch(() => null);
    return dbPromise;
  }

  function localKey(store) {
    return `${DB_NAME}:${store}`;
  }

  function readFallback(store) {
    try {
      const rows = JSON.parse(root.localStorage?.getItem(localKey(store)) || "[]");
      memory[store].clear();
      for (const row of rows) {
        if (row?.id) {
          memory[store].set(row.id, row);
        }
      }
      return rows;
    } catch {
      return [];
    }
  }

  function writeFallback(store) {
    try {
      root.localStorage?.setItem(localKey(store), JSON.stringify([...memory[store].values()]));
    } catch {
      // localStorage can be full or disabled; in-memory cache still works for this session.
    }
  }

  function tx(db, store, mode, body) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(store, mode);
      const objectStore = transaction.objectStore(store);
      const result = body(objectStore);
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error("transaction aborted"));
    });
  }

  function getAll(store) {
    return openDb().then((db) => {
      if (!db) {
        return readFallback(store);
      }
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(store, "readonly");
        const request = transaction.objectStore(store).getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      }).catch(() => readFallback(store));
    });
  }

  async function ready() {
    for (const store of STORES) {
      const rows = await getAll(store);
      memory[store].clear();
      for (const row of rows) {
        if (row?.id) {
          memory[store].set(row.id, row);
        }
      }
    }
    return api;
  }

  async function save(store, record) {
    if (!memory[store]) {
      throw new Error(`unknown store ${store}`);
    }
    const row = {
      ...record,
      id: record.id || nowId(store.slice(0, -1) || "row"),
      updatedAt: new Date().toISOString(),
    };
    if (!row.createdAt) {
      row.createdAt = row.updatedAt;
    }
    memory[store].set(row.id, row);
    const db = await openDb();
    if (db) {
      await tx(db, store, "readwrite", (objectStore) => objectStore.put(row)).catch(() => writeFallback(store));
    } else {
      writeFallback(store);
    }
    dispatchChanged(store);
    return row;
  }

  async function remove(store, id) {
    memory[store]?.delete(id);
    const db = await openDb();
    if (db) {
      await tx(db, store, "readwrite", (objectStore) => objectStore.delete(id)).catch(() => writeFallback(store));
    } else {
      writeFallback(store);
    }
    dispatchChanged(store);
  }

  function list(store) {
    return [...(memory[store]?.values() || [])].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  }

  function getCached(store, id) {
    return memory[store]?.get(id) || null;
  }

  function upgradePersonalBot(payload) {
    const weights = { ...(payload.weights || {}) };
    const h2 = Array.isArray(weights.wPolicy)
      ? weights.wPolicy.length
      : Array.isArray(weights.w3)
        ? weights.w3.length
        : 16;
    if (!Array.isArray(weights.wPolicy)) {
      weights.wPolicy = Array.isArray(weights.w3) ? weights.w3.slice() : Array.from({ length: h2 }, () => 0);
    }
    if (!Number.isFinite(Number(weights.bPolicy))) {
      weights.bPolicy = Number(weights.b3) || 0;
    }
    if (!Array.isArray(weights.wValue)) {
      weights.wValue = Array.from({ length: h2 }, () => 0);
    }
    if (!Number.isFinite(Number(weights.bValue))) {
      weights.bValue = 0;
    }
    return {
      id: payload.id || nowId("bot"),
      format: "gomoku-personal-bot",
      version: 2,
      kind: "personal-bot",
      name: payload.name || `Personal Bot 第${payload.generation || 1}代`,
      generation: payload.generation || 1,
      featureSchema: 2,
      weights,
      metrics: {
        samples: 0,
        loss: null,
        policyLoss: null,
        valueLoss: null,
        top1: 0,
        top3: 0,
        valueMae: null,
        rating: 1000,
        ...(payload.metrics || {}),
      },
    };
  }

  async function exportRecord(store, id) {
    const record = getCached(store, id);
    if (!record) {
      throw new Error(`missing ${store} ${id}`);
    }
    return JSON.stringify({ format: "gomoku-lab", store, record }, null, 2);
  }

  async function importJson(text) {
    const payload = JSON.parse(text);
    if (payload.format === "gomoku-lab" && payload.store && payload.record) {
      const record =
        payload.store === "models" && (payload.record.kind === "personal-bot" || payload.record.format === "gomoku-personal-bot")
          ? upgradePersonalBot(payload.record)
          : payload.record;
      return save(payload.store, record);
    }
    if (payload.format === "gomoku-personal-bot") {
      return save("models", upgradePersonalBot(payload));
    }
    if (payload.schema === "gomoku-engine/v1" || payload.kind === "minimax") {
      return save("profiles", {
        id: payload.id || nowId("minimax"),
        kind: payload.kind || "minimax",
        name: payload.name || "导入的 Minimax",
        config: payload.config || payload.search || payload,
      });
    }
    throw new Error("unsupported import format");
  }

  function download(name, text) {
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function dispatchChanged(store) {
    if (typeof root.dispatchEvent === "function" && typeof root.CustomEvent === "function") {
      root.dispatchEvent(new root.CustomEvent("gomoku-store-changed", { detail: { store } }));
    }
  }

  const api = {
    ready,
    save,
    remove,
    list,
    getCached,
    exportRecord,
    importJson,
    download,
    nowId,
    memory,
  };

  return api;
});
