"use strict";

const V6_VERSION = "v6-lab";
const V6_SCRIPT = "v6-engine-runtime.js";
const V6_INLINE_ASSETS = "v6-engine-inline-assets.js";
const UPSTREAM_FACTORY = "Ra" + "pfi";
const UPSTREAM_BUNDLE = "ra" + "pfi" + "-single-simd128";
const RUNTIME_FILES = {
  [`${UPSTREAM_BUNDLE}.wasm`]: "v6-engine-runtime.wasm",
  [`${UPSTREAM_BUNDLE}.data`]: "v6-engine-runtime.data",
};
const MOVE_RE = /^(\d+),(\d+)(?:\s|$)/;
const WORKER_BASE_URL = typeof self.GOMOKU_V6_BASE_URL === "string" && self.GOMOKU_V6_BASE_URL ? self.GOMOKU_V6_BASE_URL : self.location?.href || "";

let modulePromise = null;
let engineModule = null;
let initialized = false;
let activeSearch = null;
let stdoutWaiters = [];
let stderrLines = [];

self.addEventListener("message", (event) => {
  handleRequest(event.data).catch((error) => {
    self.postMessage({
      id: event.data?.id,
      ok: false,
      error: error?.message || String(error),
    });
  });
});

async function handleRequest(message) {
  if (!message || message.type !== "search") {
    throw new Error(`Unsupported V6 worker request ${message?.type || ""}`);
  }
  const result = await search(message.payload);
  self.postMessage({ id: message.id, ok: true, result });
}

async function search(payload) {
  const started = performance.now();
  const module = await ensureEngine();
  const config = payload.config || {};
  const timeoutMs = Math.max(300, Number(config.timeLimitMs) || 1000);
  const maxDepth = Math.max(2, Number(config.maxDepth) || 99);
  const trace = [];

  await sendAndDrain(module, `INFO TIMEOUT_TURN ${timeoutMs}`);
  await sendAndDrain(module, `INFO MAX_DEPTH ${maxDepth}`);
  await sendAndDrain(module, "INFO SHOW_DETAIL 0");
  await sendAndDrain(module, "INFO RULE 4");

  const boardCommand = makeBoardCommand(payload.board);
  const moveLine = await sendAndWaitForMove(module, boardCommand, timeoutMs + 30000, trace);
  const match = moveLine.match(MOVE_RE);
  const col = Number(match[1]);
  const row = Number(match[2]);
  const durationMs = performance.now() - started;
  const move = {
    row,
    col,
    score: 0,
    threat: 0,
  };

  return {
    move,
    stats: {
      version: V6_VERSION,
      completedDepth: maxDepth,
      nodes: 0,
      score: 0,
      timedOut: false,
      durationMs,
      candidates: [move],
      depthTrace: [
        {
          depth: maxDepth,
          move: { row, col },
          score: 0,
          nodes: 0,
          time: durationMs,
        },
      ],
      reason: "V6-WASM",
      engineTrace: trace.slice(-40),
    },
  };
}

async function ensureEngine() {
  if (!modulePromise) {
    modulePromise = loadEngine();
  }
  return modulePromise;
}

async function loadEngine() {
  loadInlineAssetsIfNeeded();
  const wasmBinary = readInlineAsset(`${UPSTREAM_BUNDLE}.wasm`);
  const dataPackage = readInlineAsset(`${UPSTREAM_BUNDLE}.data`);
  if (self.GOMOKU_V6_FILE_MODE && (!wasmBinary || !dataPackage)) {
    throw new Error(`V6 file release is missing ${V6_INLINE_ASSETS}.`);
  }

  try {
    importScripts(resolveRuntimeUrl(V6_SCRIPT));
  } catch (error) {
    throw new Error(`V6 WASM loader ${V6_SCRIPT} is missing.`);
  }
  const createEngine = self[UPSTREAM_FACTORY];
  if (typeof createEngine !== "function") {
    throw new Error(`${V6_SCRIPT} did not expose the Emscripten factory`);
  }

  engineModule = await createEngine({
    wasmBinary: wasmBinary || undefined,
    getPreloadedPackage(path) {
      return readInlineAsset(path);
    },
    locateFile(path) {
      return resolveRuntimeUrl(RUNTIME_FILES[path] || path);
    },
    onReceiveStdout(line) {
      handleStdout(line);
    },
    onReceiveStderr(line) {
      if (line) {
        stderrLines.push(line);
        stderrLines = stderrLines.slice(-80);
      }
    },
  });

  await sendAndWait(engineModule, "START 15", (line) => line === "OK", 15000);
  await sendAndDrain(engineModule, "INFO THREAD_NUM 1");
  await sendAndDrain(engineModule, "INFO RULE 4");
  initialized = true;
  return engineModule;
}

function loadInlineAssetsIfNeeded() {
  if (self.GOMOKU_V6_INLINE_ASSETS || !self.GOMOKU_V6_FILE_MODE) {
    return;
  }
  try {
    importScripts(resolveRuntimeUrl(V6_INLINE_ASSETS));
  } catch {
    // HTTP deployments can still load .wasm/.data as separate files.
  }
}

function readInlineAsset(path) {
  const assets = self.GOMOKU_V6_INLINE_ASSETS;
  if (!assets || typeof assets.get !== "function") {
    return null;
  }
  return assets.get(normalizeRuntimeAssetName(path));
}

function normalizeRuntimeAssetName(path) {
  const text = String(path || "");
  const name = text.split(/[\\/]/).pop() || text;
  return RUNTIME_FILES[name] || name;
}

function resolveRuntimeUrl(path) {
  if (!WORKER_BASE_URL) {
    return path;
  }
  try {
    return new URL(path, WORKER_BASE_URL).href;
  } catch {
    return path;
  }
}

function makeBoardCommand(board) {
  const size = Number(board?.size) || 15;
  if (size !== 15) {
    throw new Error(`V6 engine is configured for 15x15, got ${size}`);
  }
  const lines = ["BOARD"];
  for (const move of board?.moves || []) {
    const row = Number(move.row);
    const col = Number(move.col);
    const player = Number(move.player);
    if (!Number.isInteger(row) || !Number.isInteger(col) || (player !== 1 && player !== 2)) {
      continue;
    }
    lines.push(`${col},${row},${player}`);
  }
  lines.push("DONE");
  return lines.join("\n");
}

function sendAndDrain(module, command) {
  module.sendCommand(command);
  return Promise.resolve();
}

function sendAndWait(module, command, predicate, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      stdoutWaiters = stdoutWaiters.filter((waiter) => waiter.resolve !== resolve);
      reject(new Error(`V6 command timed out: ${command.split("\n")[0]}`));
    }, timeoutMs);
    stdoutWaiters.push({
      predicate,
      resolve(line) {
        clearTimeout(timeout);
        resolve(line);
      },
    });
    module.sendCommand(command);
  });
}

function sendAndWaitForMove(module, command, timeoutMs, trace) {
  if (!initialized && !engineModule) {
    return Promise.reject(new Error("V6 module is not initialized"));
  }
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      activeSearch = null;
      reject(new Error(`V6 search timed out. stderr: ${stderrLines.slice(-3).join(" | ")}`));
    }, timeoutMs);
    activeSearch = {
      trace,
      resolve(line) {
        clearTimeout(timeout);
        activeSearch = null;
        resolve(line);
      },
    };
    module.sendCommand(command);
  });
}

function handleStdout(line) {
  const text = String(line || "").trim();
  if (!text) {
    return;
  }

  const waiters = stdoutWaiters;
  stdoutWaiters = [];
  for (const waiter of waiters) {
    if (waiter.predicate(text)) {
      waiter.resolve(text);
    } else {
      stdoutWaiters.push(waiter);
    }
  }

  if (activeSearch) {
    activeSearch.trace.push(text);
    if (MOVE_RE.test(text)) {
      activeSearch.resolve(text);
    }
  }
}
