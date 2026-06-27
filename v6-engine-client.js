((root) => {
  "use strict";

  const V6_VERSION = "v6-lab";

  class V6EngineClient {
    constructor() {
      this.worker = null;
      this.workerObjectUrl = null;
      this.nextId = 1;
      this.pending = new Map();
    }

    findBestMove(board, player, config) {
      if (config?.version !== V6_VERSION) {
        return Promise.reject(new Error(`V6EngineClient received unsupported version ${config?.version || ""}`));
      }
      const payload = {
        player,
        config: {
          version: V6_VERSION,
          maxDepth: Number(config.maxDepth) || 99,
          timeLimitMs: Math.max(300, Number(config.timeLimitMs) || 1000),
          candidateLimit: Number(config.candidateLimit) || 32,
          seed: String(config.seed || "0"),
        },
        board: serializeBoard(board),
      };
      return this.post("search", payload, payload.config.timeLimitMs + 45000);
    }

    post(type, payload, timeoutMs) {
      const worker = this.ensureWorker();
      const id = this.nextId++;
      return new Promise((resolve, reject) => {
        const timer = root.setTimeout(() => {
          this.pending.delete(id);
          reject(new Error(`V6 worker timed out after ${timeoutMs}ms`));
        }, timeoutMs);
        this.pending.set(id, { resolve, reject, timer });
        worker.postMessage({ id, type, payload });
      });
    }

    ensureWorker() {
      if (this.worker) {
        return this.worker;
      }
      if (typeof Worker !== "function") {
        throw new Error("Web Worker is not available in this browser");
      }
      this.worker = this.createWorker();
      this.worker.addEventListener("message", (event) => this.handleMessage(event.data));
      this.worker.addEventListener("error", (event) => {
        const message = event.message || "V6 worker failed";
        for (const [id, pending] of this.pending) {
          root.clearTimeout(pending.timer);
          pending.reject(new Error(message));
          this.pending.delete(id);
        }
      });
      return this.worker;
    }

    createWorker() {
      const workerUrl = new URL("v6-engine-worker.js", root.location?.href || "");
      if (root.location?.protocol === "file:") {
        return this.createBlobWorker(workerUrl.href);
      }
      try {
        return new Worker(workerUrl.href, { name: "gomoku-v6-engine" });
      } catch (error) {
        try {
          return this.createBlobWorker(workerUrl.href);
        } catch {
          throw error;
        }
      }
    }

    createBlobWorker(workerUrl) {
      const baseUrl = new URL(".", workerUrl).href;
      const fileMode = new URL(workerUrl).protocol === "file:";
      const bootstrap = [
        '"use strict";',
        `self.GOMOKU_V6_BASE_URL = ${JSON.stringify(baseUrl)};`,
        `self.GOMOKU_V6_FILE_MODE = ${JSON.stringify(fileMode)};`,
        `importScripts(${JSON.stringify(workerUrl)});`,
      ].join("\n");
      this.workerObjectUrl = root.URL.createObjectURL(new Blob([bootstrap], { type: "application/javascript" }));
      return new Worker(this.workerObjectUrl, { name: "gomoku-v6-engine-file" });
    }

    handleMessage(message) {
      if (!message || typeof message.id !== "number") {
        return;
      }
      const pending = this.pending.get(message.id);
      if (!pending) {
        return;
      }
      this.pending.delete(message.id);
      root.clearTimeout(pending.timer);
      if (message.ok) {
        pending.resolve(message.result);
      } else {
        pending.reject(new Error(message.error || "V6 worker request failed"));
      }
    }
  }

  function serializeBoard(board) {
    const history = Array.isArray(board?.history) ? board.history : [];
    return {
      size: Number(board?.size) || 15,
      current: Number(board?.current) || 1,
      moves: history.map((move) => ({
        row: Number(move.row),
        col: Number(move.col),
        player: Number(move.player),
      })),
    };
  }

  root.GomokuV6Engine = new V6EngineClient();
})(typeof window !== "undefined" ? window : globalThis);
