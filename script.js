(() => {
  "use strict";

  const SIZE = 15;
  const EMPTY = 0;
  const BLACK = 1;
  const WHITE = 2;
  const MAX_MOVES = SIZE * SIZE;
  const DIRECTIONS = [
    [0, 1],
    [1, 0],
    [1, -1],
    [1, 1],
  ];
  const RuleCore = window.GomokuRules;

  if (!RuleCore) {
    throw new Error("gomoku-rules.js must be loaded before script.js");
  }

  const INF_SCORE = 1000000000;
  const WIN_SCORE = 100000000;
  const OPEN_FOUR_SCORE = 300000;
  const FOUR_SCORE = 60000;
  const OPEN_THREE_SCORE = 12000;
  const THREE_SCORE = 1600;
  const ASPIRATION_WINDOW = 25000;
  const MAX_SEARCH_PLY = 96;
  const HISTORY_MAX = 4000000;
  const HISTORY_SCALE = 32;
  const KILLER_BONUS = 5000000;
  const SECOND_KILLER_BONUS = 2500000;
  const THREAT_WIN = 6;
  const THREAT_OPEN_FOUR = 5;
  const THREAT_FOUR = 4;
  const THREAT_OPEN_THREE = 3;
  const THREAT_THREE = 2;
  const THREAT_QUIET = 0;
  const THREAT_EXTENSION_DEPTH = 4;
  const MAX_THREAT_EXTENSIONS = 2;
  const QSEARCH_CANDIDATE_LIMIT = 12;
  const ROOT_CACHE_LIMIT = 384;
  const TT_CACHE_LIMIT = 120000;
  const ROOT_CACHE_MAX_AGE = 40;
  const TT_CACHE_MAX_AGE = 24;
  const PREHEAT_CANDIDATES = 6;
  const PREHEAT_TIME_LIMIT_MS = 180;
  const TIME_LIMIT_MS = 12000;
  const LAB_STRONG_VERSION = "v5-lab-strong";
  const V6_ENGINE_VERSION = "v6-lab";
  const LAB_ENGINE_PREFIX = "lab:";
  const LAB_ENGINE_REGISTRY = new Map();
  const CHOICE_CACHE_LIMIT = 8192;
  const CHOICE_CACHE_MAX_AGE = 18;
  const CHOICE_CACHE_MIN_DEPTH = 8;
  const CHOICE_CACHE_MIN_WIDTH = 24;
  const LAB_DEEP_FEATURE_MIN_STONES = 48;
  const RESIDUAL_DEFENSE_CANDIDATES = 36;
  const RESIDUAL_MATERIAL_SCAN_LIMIT = 160;
  const DEEP_SEARCH_MIN_WIDTH = 10;
  const DEEP_SEARCH_ROOT_WIDTH = 24;
  const DEEP_SEARCH_MIDGAME_WIDTH = 16;
  const DEEP_SEARCH_LATEGAME_WIDTH = 12;
  const ROOT_DEFENSE_SOFT_MAX_MS = 1800;
  const ROOT_DEFENSE_SOFT_FRACTION = 0.18;
  const NN_POLICY_SIZE = SIZE * SIZE;
  const NN_DEFAULT_CANDIDATES = 48;
  const NN_DEFAULT_STATIC_WEIGHT = 0.15;
  const NN_DEFAULT_CENTER_WEIGHT = 0.01;
  const LETTERS = "ABCDEFGHIJKLMNO";
  const IQ_PRESETS = {
    80: { depth: 2, width: 14 },
    105: { depth: 4, width: 24 },
    130: { depth: 5, width: 34 },
    155: { depth: 10, width: 48 },
  };
  const THEMES = {
    paper: { bg: "#f7f7f1", ink: "#111111" },
    dark: { bg: "#030303", ink: "#f3f3f3" },
    green: { bg: "#001407", ink: "#9dff9d" },
    amber: { bg: "#180e00", ink: "#ffd37a" },
  };

  const $ = (selector) => document.querySelector(selector);
  const ui = {
    shell: $(".terminal-shell"),
    clock: $("#clock"),
    turnReadout: $("#turn-readout"),
    board: $("#board-canvas"),
    status: $("#game-status"),
    moveCount: $("#move-count"),
    timeCap: $("#time-cap"),
    theme: $("#theme-select"),
    bgColor: $("#bg-color"),
    inkColor: $("#ink-color"),
    modeButtons: [...document.querySelectorAll(".mode-button")],
    controlPanel: $("#control-panel"),
    configTitle: $("#config-title"),
    humanAiConfig: $("#human-ai-config"),
    aiAiConfig: $("#ai-ai-config"),
    hintConfig: $("#hint-config"),
    newGame: $("#new-game"),
    undo: $("#undo-move"),
    aiStep: $("#ai-step"),
    autoPlay: $("#auto-play"),
    hintToggle: $("#hint-toggle"),
    resultBanner: $("#result-banner"),
    resultTitle: $("#result-title"),
    humanSide: $("#human-side"),
    machineEngine: $("#machine-engine"),
    machineSeed: $("#machine-seed"),
    machineSeedRefresh: $("#machine-seed-refresh"),
    machineTime: $("#machine-time"),
    machineTimeOutput: $("#machine-time-output"),
    machineIq: $("#machine-iq"),
    machineAdvanced: $("#machine-advanced"),
    machineDepth: $("#machine-depth"),
    machineDepthOutput: $("#machine-depth-output"),
    machineWidth: $("#machine-width"),
    machineWidthOutput: $("#machine-width-output"),
    machineTt: $("#machine-tt"),
    machineIqOutput: $("#machine-iq-output"),
    blackEngine: $("#black-engine"),
    blackSeed: $("#black-seed"),
    blackSeedRefresh: $("#black-seed-refresh"),
    blackTime: $("#black-time"),
    blackTimeOutput: $("#black-time-output"),
    blackDepth: $("#black-depth"),
    blackDepthOutput: $("#black-depth-output"),
    blackWidth: $("#black-width"),
    blackWidthOutput: $("#black-width-output"),
    blackTt: $("#black-tt"),
    whiteEngine: $("#white-engine"),
    whiteSeed: $("#white-seed"),
    whiteSeedRefresh: $("#white-seed-refresh"),
    whiteTime: $("#white-time"),
    whiteTimeOutput: $("#white-time-output"),
    whiteDepth: $("#white-depth"),
    whiteDepthOutput: $("#white-depth-output"),
    whiteWidth: $("#white-width"),
    whiteWidthOutput: $("#white-width-output"),
    whiteTt: $("#white-tt"),
    blackHintEngine: $("#black-hint-engine"),
    blackHintDepth: $("#black-hint-depth"),
    blackHintDepthOutput: $("#black-hint-depth-output"),
    blackHintWidth: $("#black-hint-width"),
    blackHintWidthOutput: $("#black-hint-width-output"),
    whiteHintEngine: $("#white-hint-engine"),
    whiteHintDepth: $("#white-hint-depth"),
    whiteHintDepthOutput: $("#white-hint-depth-output"),
    whiteHintWidth: $("#white-hint-width"),
    whiteHintWidthOutput: $("#white-hint-width-output"),
    statDepth: $("#stat-depth"),
    statNodes: $("#stat-nodes"),
    statScore: $("#stat-score"),
    statTime: $("#stat-time"),
    depthTrace: $("#depth-trace"),
    candidateList: $("#candidate-list"),
    moveList: $("#move-list"),
    eventLog: $("#event-log"),
  };

  class BoardModel {
    constructor(size = SIZE) {
      this.size = size;
      this.cells = new Int8Array(size * size);
      this.history = [];
      this.current = BLACK;
      this.result = null;
      this.lastMove = null;
    }

    index(row, col) {
      return row * this.size + col;
    }

    inside(row, col) {
      return row >= 0 && row < this.size && col >= 0 && col < this.size;
    }

    get(row, col) {
      return this.cells[this.index(row, col)];
    }

    set(row, col, value) {
      this.cells[this.index(row, col)] = value;
    }

    isEmpty(row, col) {
      return this.inside(row, col) && this.get(row, col) === EMPTY;
    }

    countStones() {
      let total = 0;
      for (const cell of this.cells) {
        if (cell !== EMPTY) {
          total++;
        }
      }
      return total;
    }

    reset() {
      this.cells.fill(EMPTY);
      this.history = [];
      this.current = BLACK;
      this.result = null;
      this.lastMove = null;
    }

    clone() {
      const copy = new BoardModel(this.size);
      copy.cells.set(this.cells);
      copy.history = this.history.map((move) => ({
        ...move,
        stats: null,
      }));
      copy.current = this.current;
      copy.result = this.result ? { ...this.result } : null;
      copy.lastMove = copy.history.at(-1) || null;
      return copy;
    }

    applyMove(row, col, player, source, stats = null) {
      this.set(row, col, player);
      const move = {
        row,
        col,
        player,
        source,
        stats,
        number: this.history.length + 1,
      };
      this.history.push(move);
      this.current = opponent(player);
      this.lastMove = move;
      return move;
    }

    undo(steps = 1) {
      const removed = [];
      while (steps > 0 && this.history.length > 0) {
        const move = this.history.pop();
        this.set(move.row, move.col, EMPTY);
        removed.push(move);
        steps--;
      }
      this.current = this.history.length > 0 ? opponent(this.history.at(-1).player) : BLACK;
      this.lastMove = this.history.at(-1) || null;
      this.result = null;
      return removed;
    }
  }

  class ResultJudge {
    static check(board, row, col, player) {
      for (const [dx, dy] of DIRECTIONS) {
        let count = 1;
        count += this.countSide(board, row, col, dx, dy, player);
        count += this.countSide(board, row, col, -dx, -dy, player);
        if (count >= 5) {
          return player;
        }
      }
      return EMPTY;
    }

    static countSide(board, row, col, dx, dy, player) {
      let count = 0;
      for (let step = 1; step < 6; step++) {
        const x = row + step * dx;
        const y = col + step * dy;
        if (!board.inside(x, y) || board.get(x, y) !== player) {
          break;
        }
        count++;
      }
      return count;
    }

    static isFull(board) {
      return board.history.length >= MAX_MOVES || board.countStones() >= MAX_MOVES;
    }
  }

  class GomokuBanRule {
    static banInfo(board, row, col) {
      return RuleCore.banInfo(board, row, col);
    }

    static threeBan(board, row, col) {
      return RuleCore.threeBan(board, row, col);
    }

    static fourBan(board, row, col) {
      return RuleCore.fourBan(board, row, col);
    }

    static longBan(board, row, col) {
      return RuleCore.longBan(board, row, col);
    }

    static countPatternDirections(board, row, col, patterns) {
      return RuleCore.countPatternDirections(board, row, col, patterns);
    }

    static lineHasPattern(board, row, col, dx, dy, patterns) {
      return RuleCore.lineHasPattern(board, row, col, dx, dy, patterns);
    }

    static buildLine(board, row, col, dx, dy) {
      return RuleCore.buildLine(board, row, col, dx, dy);
    }
  }

  class Rules {
    static checkMove(board, row, col, player) {
      return RuleCore.checkMove(board, row, col, player);
    }
  }

  class SearchContext {
    constructor(board, config, cache) {
      const effectiveCache = cache || new EngineSearchCache();
      this.board = board;
      this.config = config;
      this.cache = effectiveCache;
      this.nodes = 0;
      this.timedOut = false;
      this.start = performance.now();
      this.stoneCount = board.countStones();
      this.tt = effectiveCache.tt;
      this.historyHeuristic = effectiveCache.historyHeuristic;
      this.killers = Array.from({ length: MAX_SEARCH_PLY }, () => [-1, -1]);
      this.zobrist = makeZobrist(config.seed);
      this.sideKey = this.zobrist.side;
      this.ttPrefix = hashString(
        `${config.seed}:tt:${config.version}:${config.candidateLimit}:${config.vcfDepth}:${config.qsearchDepth}:${config.symmetryTT ? "sym" : "raw"}`,
      ).toString(36);
      this.symmetryHashes = new Uint32Array(8);
      this.ttStats = { probes: 0, hits: 0, cutoffs: 0, canonicalHits: 0 };
      this.neighbor1 = new Int16Array(MAX_MOVES);
      this.neighbor2 = new Int16Array(MAX_MOVES);
      this.evalVersion = 1;
      this.nextEvalVersion = 2;
      this.evalStack = [];
      this.legalCache = new Map();
      this.winningCache = new Map();
      this.shapeCache = new Map();
      this.profileCache = new Map();
      this.priorityCache = new Map();
      this.choiceCacheStats = { probes: 0, hits: 0, stores: 0 };
      this.softStopAt = 0;
      this.initNeighborCache();
      this.initSymmetryHashes();
    }

    shouldStop() {
      if (this.timedOut) {
        return true;
      }
      const now = performance.now();
      if (this.softStopAt > 0 && now >= this.softStopAt) {
        return true;
      }
      if ((this.nodes & 255) !== 0) {
        return false;
      }
      if (now - this.start >= this.config.timeLimitMs) {
        this.timedOut = true;
      }
      return this.timedOut;
    }

    makeMove(row, col, player) {
      this.evalStack.push(this.evalVersion);
      this.board.set(row, col, player);
      this.adjustSymmetryHashes(row, col, player);
      this.stoneCount++;
      this.adjustNeighbors(row, col, 1);
      this.evalVersion = this.nextEvalVersion++;
    }

    unmakeMove(row, col) {
      const player = this.board.get(row, col);
      this.adjustSymmetryHashes(row, col, player);
      this.board.set(row, col, EMPTY);
      this.stoneCount--;
      this.adjustNeighbors(row, col, -1);
      this.evalVersion = this.evalStack.pop() || this.nextEvalVersion++;
    }

    hashBoard(player) {
      let key = player === WHITE ? this.sideKey : 0;
      for (let idx = 0; idx < this.board.cells.length; idx++) {
        const stone = this.board.cells[idx];
        if (stone === BLACK || stone === WHITE) {
          key = (key ^ this.zobrist.table[playerIndex(stone)][idx]) >>> 0;
        }
      }
      return key >>> 0;
    }

    initSymmetryHashes() {
      this.symmetryHashes.fill(0);
      for (let row = 0; row < SIZE; row++) {
        for (let col = 0; col < SIZE; col++) {
          const stone = this.board.get(row, col);
          if (stone === BLACK || stone === WHITE) {
            this.adjustSymmetryHashes(row, col, stone);
          }
        }
      }
    }

    adjustSymmetryHashes(row, col, player) {
      if (player !== BLACK && player !== WHITE) {
        return;
      }
      const table = this.zobrist.table[playerIndex(player)];
      for (let transform = 0; transform < 8; transform++) {
        const mapped = transformMove({ row, col }, transform);
        const idx = this.board.index(mapped.row, mapped.col);
        this.symmetryHashes[transform] = (this.symmetryHashes[transform] ^ table[idx]) >>> 0;
      }
    }

    canonicalHash(player) {
      let bestKey = 0xffffffff;
      let bestTransform = 0;
      const side = player === WHITE ? this.sideKey : 0;
      for (let transform = 0; transform < 8; transform++) {
        const key = (this.symmetryHashes[transform] ^ side) >>> 0;
        if (key < bestKey) {
          bestKey = key;
          bestTransform = transform;
        }
      }
      return { key: bestKey >>> 0, transform: bestTransform, inverse: inverseTransform(bestTransform) };
    }

    initNeighborCache() {
      for (let row = 0; row < SIZE; row++) {
        for (let col = 0; col < SIZE; col++) {
          const stone = this.board.get(row, col);
          if (stone === BLACK || stone === WHITE) {
            this.adjustNeighbors(row, col, 1);
          }
        }
      }
    }

    adjustNeighbors(row, col, delta) {
      for (let dx = -2; dx <= 2; dx++) {
        for (let dy = -2; dy <= 2; dy++) {
          if (dx === 0 && dy === 0) {
            continue;
          }
          const x = row + dx;
          const y = col + dy;
          if (!this.board.inside(x, y)) {
            continue;
          }
          const idx = this.board.index(x, y);
          this.neighbor2[idx] += delta;
          if (Math.max(Math.abs(dx), Math.abs(dy)) <= 1) {
            this.neighbor1[idx] += delta;
          }
        }
      }
    }
  }

  class EngineSearchCache {
    constructor() {
      this.tt = new Map();
      this.root = new Map();
      this.choice = new Map();
      this.presearch = buildPresearchIndex();
      this.historyHeuristic = [new Int32Array(MAX_MOVES), new Int32Array(MAX_MOVES)];
      this.generation = 0;
    }

    beginSearch() {
      this.generation++;
      if ((this.generation & 7) === 0) {
        this.trimExpired();
      }
      return this.generation;
    }

    getRuntimeRoot(board, player, config) {
      const lookup = makeRootLookup(board, player, config, true);
      const entry = this.root.get(lookup.key);
      if (!entry || entry.depth < config.maxDepth) {
        return null;
      }
      entry.age = this.generation;
      return materializeCachedRoot(board, config, entry, lookup.inverse, "WARM-CACHE", player);
    }

    getRuntimeOrdering(board, player, config) {
      const lookup = makeRootLookup(board, player, config, true);
      const entry = this.root.get(lookup.key);
      if (!entry) {
        return null;
      }
      entry.age = this.generation;
      return {
        ...entry,
        candidates: transformCandidates(entry.candidates || [entry.move], lookup.inverse),
      };
    }

    getPresearchRoot(board, player, config) {
      if (!usesPresearchEngine(config.version)) {
        return null;
      }
      const lookup = makePresearchLookup(board, player);
      const entry = this.presearch.get(lookup.key);
      if (!entry) {
        requestPresearchBucket(lookup.bucket);
        return null;
      }
      if (!canUsePresearchEntry(config, entry)) {
        return null;
      }
      return materializeCachedRoot(board, config, entry, lookup.inverse, "PRESEARCH", player);
    }

    getPresearchOrdering(board, player, config) {
      if (!usesPresearchEngine(config.version)) {
        return null;
      }
      const lookup = makePresearchLookup(board, player);
      const entry = this.presearch.get(lookup.key);
      if (!entry) {
        requestPresearchBucket(lookup.bucket);
        return null;
      }
      if (!canUsePresearchEntry(config, entry)) {
        return null;
      }
      return {
        ...entry,
        candidates: transformCandidates(entry.candidates, lookup.inverse),
      };
    }

    getChoice(key) {
      const entry = this.choice.get(key);
      if (!entry) {
        return null;
      }
      entry.age = this.generation;
      return entry.candidates.map((candidate) => ({ ...candidate }));
    }

    storeChoice(key, candidates) {
      this.choice.set(key, {
        candidates: candidates.map((candidate) => ({ ...candidate })),
        age: this.generation,
      });
      if (this.choice.size > CHOICE_CACHE_LIMIT) {
        trimMap(this.choice, CHOICE_CACHE_LIMIT, CHOICE_CACHE_MAX_AGE, this.generation);
      }
    }

    storeRuntimeRoot(board, player, config, move, stats) {
      if (!move || !stats || stats.completedDepth <= 0) {
        return;
      }
      const lookup = makeRootLookup(board, player, config, true);
      const canonicalMove = transformMove(move, lookup.transform);
      const canonicalCandidates = transformCandidates(stats.candidates || [], lookup.transform);
      this.root.set(lookup.key, {
        depth: stats.completedDepth,
        score: stats.score,
        move: canonicalMove,
        candidates: canonicalCandidates.slice(0, 24),
        age: this.generation,
      });
      trimMap(this.root, ROOT_CACHE_LIMIT, ROOT_CACHE_MAX_AGE, this.generation);
    }

    trimTranspositions() {
      trimMap(this.tt, TT_CACHE_LIMIT, TT_CACHE_MAX_AGE, this.generation);
    }

    trimExpired() {
      trimMap(this.root, ROOT_CACHE_LIMIT, ROOT_CACHE_MAX_AGE, this.generation);
      trimMap(this.tt, TT_CACHE_LIMIT, TT_CACHE_MAX_AGE, this.generation);
      trimMap(this.choice, CHOICE_CACHE_LIMIT, CHOICE_CACHE_MAX_AGE, this.generation);
    }
  }

  class GomokuSearchEngine {
    constructor() {
      this.cache = new EngineSearchCache();
    }

    findBestMove(board, player, rawConfig) {
      const labEngine = resolveLabEngine(rawConfig);
      if (labEngine) {
        return labEngine.handler.findBestMove(board, player, {
          ...rawConfig,
          labEngineId: labEngine.id,
          labEngineType: labEngine.type,
        });
      }

      const config = normalizeConfig(rawConfig);
      const stats = {
        version: config.version,
        completedDepth: 0,
        nodes: 0,
        score: 0,
        timedOut: false,
        durationMs: 0,
        candidates: [],
        depthTrace: [],
        choiceCache: { probes: 0, hits: 0, stores: 0 },
        reason: "",
      };

      if (player !== BLACK && player !== WHITE) {
        return { move: null, stats };
      }

      if (config.version === V6_ENGINE_VERSION) {
        stats.reason = "V6-WASM-REQUIRED";
        stats.error = "V6 Lab must be loaded through the dedicated worker";
        return { move: null, stats };
      }

      this.cache.beginSearch();

      const runtimeHit = this.cache.getRuntimeRoot(board, player, config);
      if (runtimeHit) {
        return runtimeHit;
      }

      if (usesPresearchEngine(config.version)) {
        const presearchHit = this.cache.getPresearchRoot(board, player, config);
        if (presearchHit && presearchHit.stats.completedDepth >= config.maxDepth) {
          return presearchHit;
        }
      }

      const context = new SearchContext(board, config, this.cache);

      if (config.version === "nn-fusion") {
        return runNnFusionSearch(context, player, stats);
      }

      if (config.version === "scout") {
        const tactical = findRootTacticalMove(context, player);
        const candidates = generateCandidates(context, player, null);
        const picked = tactical || candidates[0] || null;
        stats.reason = tactical ? tactical.reason : "PATTERN";
        stats.candidates = candidates.slice(0, 18);
        stats.nodes = context.nodes;
        stats.score = picked ? picked.score : 0;
        stats.durationMs = performance.now() - context.start;
        return { move: picked, stats };
      }

      const tactical = findRootTacticalMove(context, player);
      if (tactical) {
        const candidates = generateCandidates(context, player, tactical);
        stats.reason = tactical.reason;
        stats.candidates = promoteCandidate(candidates, tactical).slice(0, 18);
        stats.nodes = context.nodes;
        stats.score = tactical.score;
        stats.timedOut = context.timedOut;
        stats.durationMs = performance.now() - context.start;
        return { move: tactical, stats };
      }

      const rootCandidates = generateCandidates(context, player, null);
      if (rootCandidates.length === 0) {
        stats.reason = "NO-LEGAL-MOVE";
        stats.durationMs = performance.now() - context.start;
        return { move: null, stats };
      }

      const presearchOrdering = this.cache.getPresearchOrdering(board, player, config);
      if (presearchOrdering) {
        applyPresearchOrdering(rootCandidates, presearchOrdering.candidates);
      }
      const runtimeOrdering = this.cache.getRuntimeOrdering(board, player, config);
      if (runtimeOrdering) {
        applyPresearchOrdering(rootCandidates, runtimeOrdering.candidates);
      }

      let best = { ...rootCandidates[0] };
      let bestScore = rootCandidates[0].score;
      const rootKey = context.hashBoard(player);
      stats.candidates = rootCandidates.slice(0, 18);

      for (let depth = 1; depth <= config.maxDepth; depth++) {
        const candidateLimit = adaptiveCandidateLimit(context, rootCandidates, config.candidateLimit, depth, 0);
        let depthBest = { ...best };
        let depthBestScore = -INF_SCORE;
        const useAspiration = depth >= 4 && bestScore > -WIN_SCORE / 2 && bestScore < WIN_SCORE / 2;
        let windowAlpha = useAspiration ? bestScore - ASPIRATION_WINDOW : -INF_SCORE;
        let windowBeta = useAspiration ? bestScore + ASPIRATION_WINDOW : INF_SCORE;

        while (true) {
          let rootAlpha = windowAlpha;
          depthBest = { ...best };
          depthBestScore = -INF_SCORE;

          for (let i = 0; i < candidateLimit; i++) {
            const candidate = rootCandidates[i];
            const childKey =
              (rootKey ^
                context.sideKey ^
                context.zobrist.table[playerIndex(player)][board.index(candidate.row, candidate.col)]) >>>
              0;

            if (context.shouldStop()) {
              break;
            }

            context.makeMove(candidate.row, candidate.col, player);
            const extension =
              depth <= THREAT_EXTENSION_DEPTH && candidate.threat >= THREAT_FOUR && MAX_THREAT_EXTENSIONS > 0
                ? 1
                : 0;
            const childDepth = depth - 1 + extension;
            const childExtensionLeft = extension ? MAX_THREAT_EXTENSIONS - 1 : MAX_THREAT_EXTENSIONS;
            let score;
            if (ResultJudge.check(board, candidate.row, candidate.col, player) === player) {
              score = WIN_SCORE;
            } else if (i === 0) {
              score = -negamax(
                context,
                opponent(player),
                childDepth,
                -windowBeta,
                -rootAlpha,
                childKey,
                candidate.row,
                candidate.col,
                1,
                childExtensionLeft,
              );
            } else {
              score = -negamax(
                context,
                opponent(player),
                childDepth,
                -rootAlpha - 1,
                -rootAlpha,
                childKey,
                candidate.row,
                candidate.col,
                1,
                childExtensionLeft,
              );
              if (!context.timedOut && score > rootAlpha && score < windowBeta) {
                score = -negamax(
                  context,
                  opponent(player),
                  childDepth,
                  -windowBeta,
                  -rootAlpha,
                  childKey,
                  candidate.row,
                  candidate.col,
                  1,
                  childExtensionLeft,
                );
              }
            }
            context.unmakeMove(candidate.row, candidate.col);

            if (context.timedOut) {
              break;
            }

            candidate.score = score;
            if (score > depthBestScore) {
              depthBestScore = score;
              depthBest = { ...candidate };
            }
            if (score > rootAlpha) {
              rootAlpha = score;
            }
            if (rootAlpha >= windowBeta) {
              break;
            }
          }

          if (context.timedOut || !useAspiration || (depthBestScore > windowAlpha && depthBestScore < windowBeta)) {
            break;
          }
          windowAlpha = -INF_SCORE;
          windowBeta = INF_SCORE;
        }

        if (context.timedOut) {
          break;
        }

        best = depthBest;
        bestScore = depthBestScore;
        rootCandidates.sort(compareCandidates);
        stats.completedDepth = depth;
        stats.score = bestScore;
        stats.candidates = rootCandidates.slice(0, 18);
        stats.depthTrace.push({
          depth,
          move: { row: best.row, col: best.col },
          score: bestScore,
          nodes: context.nodes,
          time: performance.now() - context.start,
        });

        if (bestScore >= WIN_SCORE / 2) {
          break;
        }
      }

      stats.nodes = context.nodes;
      stats.score = bestScore;
      stats.timedOut = context.timedOut;
      stats.durationMs = performance.now() - context.start;
      stats.tt = { mode: config.symmetryTT ? "canonical" : "raw", ...context.ttStats };
      stats.choiceCache = { ...context.choiceCacheStats };
      stats.reason = context.timedOut ? "TIME-CAP" : best.reason || "SEARCH";
      this.cache.storeRuntimeRoot(board, player, config, best, stats);
      this.cache.trimTranspositions();
      return { move: best, stats };
    }
  }

  function runNnFusionSearch(context, player, stats) {
    return nnFusionFindBestMove(context, player, stats);
  }

  function nnFusionFindBestMove(context, player, stats) {
    const budget = makeNnBudget(context.config);
    const win = findImmediateWin(context, player);
    if (win) {
      finishNnStats(context, stats, win, [win], "WIN-NOW", 0, false);
      return { move: win, stats };
    }

    const block = findImmediateBlock(context, player);
    if (block) {
      finishNnStats(context, stats, block, [block], "BLOCK-FIVE", 0, false);
      return { move: block, stats };
    }

    const evalResult = nnEngineEvaluate(context.board, player, context.config);
    if (!evalResult.ok) {
      return strongFallbackWithinBudget(context, player, budget, stats, "NN-FALLBACK");
    }
    context.nodes++;

    if (budgetHardExceeded(budget)) {
      const fallback = findBudgetFallbackMove(context, player);
      finishNnStats(context, stats, fallback, fallback ? [fallback] : [], "NN-HARD-CAP", 0, true);
      return { move: fallback, stats };
    }

    const selected = selectByNnPolicy(context, player, evalResult, budget);
    if (!selected.move) {
      return strongFallbackWithinBudget(context, player, budget, stats, "NN-SELECT-FALLBACK");
    }

    finishNnStats(
      context,
      stats,
      selected.move,
      selected.candidates,
      budgetHardExceeded(budget) ? "TIME-CAP" : "NN-FUSION",
      selected.visited + 1,
      budgetHardExceeded(budget),
      evalResult.value,
      evalResult.evalMs,
    );
    return { move: selected.move, stats };
  }

  function finishNnStats(context, stats, move, candidates, reason, visited, timedOut, value = 0, evalMs = 0) {
    stats.completedDepth = 0;
    stats.nodes = visited;
    stats.score = move ? move.score : 0;
    stats.timedOut = Boolean(timedOut);
    stats.durationMs = performance.now() - context.start;
    stats.reason = reason;
    stats.nnValue = value;
    stats.nnEvalMs = evalMs;
    stats.candidates = (candidates || []).slice(0, 18);
    if (move) {
      stats.depthTrace.push({
        depth: 0,
        move: { row: move.row, col: move.col },
        score: move.score,
        nodes: visited,
        time: stats.durationMs,
      });
    }
  }

  function findImmediateWin(context, player) {
    for (let row = 0; row < SIZE; row++) {
      for (let col = 0; col < SIZE; col++) {
        if (nnIsWinningMove(context.board, row, col, player)) {
          return { row, col, score: WIN_SCORE, threat: THREAT_WIN };
        }
      }
    }
    return null;
  }

  function findImmediateBlock(context, player) {
    const rival = opponent(player);
    for (let row = 0; row < SIZE; row++) {
      for (let col = 0; col < SIZE; col++) {
        if (nnIsWinningMove(context.board, row, col, rival) && Rules.checkMove(context.board, row, col, player).ok) {
          return { row, col, score: 90000000, threat: cachedThreatLevel(context, row, col, player) };
        }
      }
    }
    return null;
  }

  function nnIsWinningMove(board, row, col, player) {
    if (!Rules.checkMove(board, row, col, player).ok) {
      return false;
    }
    board.set(row, col, player);
    const wins = ResultJudge.check(board, row, col, player) === player;
    board.set(row, col, EMPTY);
    return wins;
  }

  function makeNnBudget(config) {
    const hardMs = Math.max(300, Number(config.timeLimitMs) || TIME_LIMIT_MS);
    return {
      start: performance.now(),
      softMs: Math.min(hardMs, Math.max(300, Math.floor(hardMs * 2 / 3))),
      hardMs,
    };
  }

  function budgetElapsedMs(budget) {
    return performance.now() - budget.start;
  }

  function budgetSoftExceeded(budget) {
    return budget.softMs > 0 && budgetElapsedMs(budget) >= budget.softMs;
  }

  function budgetHardExceeded(budget) {
    return budget.hardMs > 0 && budgetElapsedMs(budget) >= budget.hardMs;
  }

  function buildNnCandidates(context, player) {
    const candidates = [];
    if (context.board.countStones() === 0) {
      return [context.board.index(Math.floor(SIZE / 2), Math.floor(SIZE / 2))];
    }

    for (let row = 0; row < SIZE; row++) {
      for (let col = 0; col < SIZE; col++) {
        if (Rules.checkMove(context.board, row, col, player).ok && hasNeighbor(context.board, row, col, 2)) {
          candidates.push(context.board.index(row, col));
        }
      }
    }

    if (candidates.length === 0) {
      for (let row = 0; row < SIZE; row++) {
        for (let col = 0; col < SIZE; col++) {
          if (Rules.checkMove(context.board, row, col, player).ok) {
            candidates.push(context.board.index(row, col));
          }
        }
      }
    }
    return candidates;
  }

  function findBudgetFallbackMove(context, player) {
    const candidates = buildNnCandidates(context, player);
    let best = -1;
    let bestDistance = SIZE * 2 + 1;
    const center = Math.floor(SIZE / 2);

    for (const index of candidates) {
      const row = Math.floor(index / SIZE);
      const col = index % SIZE;
      const distance = Math.abs(row - center) + Math.abs(col - center);
      if (best < 0 || distance < bestDistance) {
        best = index;
        bestDistance = distance;
      }
    }
    if (best < 0) {
      return null;
    }
    return { row: Math.floor(best / SIZE), col: best % SIZE, score: 0, threat: THREAT_QUIET };
  }

  function staticMoveScore(board, row, col, player) {
    board.set(row, col, player);
    const score = evaluateBoard(board, player);
    board.set(row, col, EMPTY);
    return Math.tanh(score / 200000);
  }

  function centerScore(row, col) {
    const center = Math.floor(SIZE / 2);
    const distance = Math.abs(row - center) + Math.abs(col - center);
    return 1 / (1 + distance);
  }

  function selectByNnPolicy(context, player, evalResult, budget) {
    const candidates = buildNnCandidates(context, player);
    const candidateLimit = Math.min(context.config.nnCandidateLimit, candidates.length);
    const remaining = candidates.slice();
    const ranked = [];
    let bestMove = null;
    let bestScore = -Infinity;
    let visited = 0;

    for (let pass = 0; pass < candidateLimit; pass++) {
      let selected = -1;
      let selectedPolicy = -Infinity;

      if (visited > 0 && budgetSoftExceeded(budget)) {
        break;
      }
      if (budgetHardExceeded(budget)) {
        break;
      }

      for (let i = 0; i < remaining.length; i++) {
        const index = remaining[i];
        if (index < 0) {
          continue;
        }
        const policy = evalResult.policy[index];
        if (selected < 0 || policy > selectedPolicy) {
          selected = i;
          selectedPolicy = policy;
        }
      }

      if (selected < 0) {
        break;
      }

      const index = remaining[selected];
      const row = Math.floor(index / SIZE);
      const col = index % SIZE;
      const staticScore = staticMoveScore(context.board, row, col, player);
      const total =
        context.config.nnPolicyWeight * evalResult.policy[index] +
        context.config.nnStaticWeight * staticScore +
        context.config.nnCenterWeight * centerScore(row, col);
      const move = {
        row,
        col,
        score: Math.round(total * 1000000),
        threat: cachedThreatLevel(context, row, col, player),
        nnPolicy: evalResult.policy[index],
        nnStatic: staticScore,
        nnValue: evalResult.value,
      };

      remaining[selected] = -1;
      visited++;
      ranked.push(move);
      if (!bestMove || total > bestScore) {
        bestScore = total;
        bestMove = move;
      }
    }

    ranked.sort(compareCandidates);
    return { move: bestMove, candidates: ranked, visited };
  }

  function strongFallbackWithinBudget(context, player, budget, stats, reason) {
    const remainingMs = Math.max(0, budget.hardMs - Math.round(budgetElapsedMs(budget)));
    if (remainingMs <= 0) {
      const fallback = findBudgetFallbackMove(context, player);
      finishNnStats(context, stats, fallback, fallback ? [fallback] : [], `${reason}-CENTER`, 0, true);
      return { move: fallback, stats };
    }

    const config = normalizeConfig({
      ...context.config,
      version: "pvs-vcf",
      timeLimitMs: Math.min(context.config.timeLimitMs, remainingMs),
    });
    const fallbackEngine = new GomokuSearchEngine();
    fallbackEngine.cache = context.cache;
    const result = fallbackEngine.findBestMove(context.board, player, config);
    Object.assign(stats, result.stats);
    stats.reason = reason;
    return { move: result.move, stats };
  }

  function nnEngineEvaluate(board, player, config) {
    const started = performance.now();
    const policy = new Float32Array(NN_POLICY_SIZE);
    let valueAccumulator = 0;

    if (player !== BLACK && player !== WHITE) {
      return { ok: false, policy, value: 0, evalMs: 0 };
    }

    const ownPlane = new Float32Array(NN_POLICY_SIZE);
    const rivalPlane = new Float32Array(NN_POLICY_SIZE);
    const emptyPlane = new Float32Array(NN_POLICY_SIZE);
    encodeNnBoard(board, player, ownPlane, rivalPlane, emptyPlane);

    for (let row = 0; row < SIZE; row++) {
      for (let col = 0; col < SIZE; col++) {
        const index = board.index(row, col);
        const legal = Rules.checkMove(board, row, col, player).ok;
        if (!legal) {
          policy[index] = -1.0e9;
          continue;
        }
        const feature = nnPolicyFeature(board, ownPlane, rivalPlane, emptyPlane, row, col, player, config.seed);
        policy[index] = feature;
        valueAccumulator += feature * centerScore(row, col) * 0.01;
      }
    }

    const material = evaluateBoard(board, player) / 240000;
    const value = Math.tanh(material + valueAccumulator / NN_POLICY_SIZE);
    return { ok: true, policy, value, evalMs: performance.now() - started };
  }

  function encodeNnBoard(board, player, ownPlane, rivalPlane, emptyPlane) {
    const rival = opponent(player);
    for (let row = 0; row < SIZE; row++) {
      for (let col = 0; col < SIZE; col++) {
        const index = board.index(row, col);
        const stone = board.get(row, col);
        if (stone === player) {
          ownPlane[index] = 1;
        } else if (stone === rival) {
          rivalPlane[index] = 1;
        } else if (stone === EMPTY) {
          emptyPlane[index] = 1;
        }
      }
    }
  }

  function nnPolicyFeature(board, ownPlane, rivalPlane, emptyPlane, row, col, player, seed) {
    const attack = moveShapeScore(board, row, col, player);
    const defense = moveShapeScore(board, row, col, opponent(player));
    let localOwn = 0;
    let localRival = 0;
    let liberties = 0;
    let directionSignal = 0;

    for (const [dx, dy] of DIRECTIONS) {
      let ownRun = 0;
      let rivalRun = 0;
      let open = 0;
      for (let step = -4; step <= 4; step++) {
        if (step === 0) {
          continue;
        }
        const x = row + step * dx;
        const y = col + step * dy;
        const weight = 1 / (1 + Math.abs(step));
        if (!board.inside(x, y)) {
          continue;
        }
        const idx = board.index(x, y);
        ownRun += ownPlane[idx] * weight;
        rivalRun += rivalPlane[idx] * weight;
        open += emptyPlane[idx] * weight;
      }
      directionSignal += Math.tanh(ownRun * 0.75 + rivalRun * 0.62 + open * 0.08);
    }

    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        if (dx === 0 && dy === 0) {
          continue;
        }
        const x = row + dx;
        const y = col + dy;
        if (!board.inside(x, y)) {
          localRival += 0.04;
          continue;
        }
        const idx = board.index(x, y);
        const weight = Math.max(Math.abs(dx), Math.abs(dy)) === 1 ? 0.22 : 0.1;
        localOwn += ownPlane[idx] * weight;
        localRival += rivalPlane[idx] * weight;
        liberties += emptyPlane[idx] * weight;
      }
    }

    return Math.tanh(
      attack / 260000 +
        defense / 300000 +
        directionSignal * 0.24 +
        localOwn * 0.34 +
        localRival * 0.22 +
        liberties * 0.045 +
        centerScore(row, col) * 0.08 +
        stableNoise(seed, row, col, player) / 900,
    );
  }

  class BoardView {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.geometry = null;
      this.hover = null;
    }

    colors() {
      const style = getComputedStyle(document.body);
      return {
        bg: style.getPropertyValue("--bg").trim() || "#ffffff",
        board: style.getPropertyValue("--board-bg").trim() || "#ffffff",
        ink: style.getPropertyValue("--ink").trim() || "#111111",
        muted: style.getPropertyValue("--muted").trim() || "#666666",
        grid: style.getPropertyValue("--grid").trim() || "#888888",
        soft: style.getPropertyValue("--soft-line").trim() || "#cccccc",
      };
    }

    cellFromEvent(event) {
      if (!this.geometry) {
        return null;
      }
      const rect = this.canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const { pad, cell } = this.geometry;
      const col = Math.round((x - pad) / cell);
      const row = Math.round((y - pad) / cell);
      const px = pad + col * cell;
      const py = pad + row * cell;
      const distance = Math.hypot(px - x, py - y);
      if (row < 0 || row >= SIZE || col < 0 || col >= SIZE || distance > cell * 0.48) {
        return null;
      }
      return { row, col };
    }

    draw(board, options) {
      const rect = this.canvas.getBoundingClientRect();
      const cssSize = Math.max(320, Math.floor(rect.width || 720));
      const ratio = window.devicePixelRatio || 1;
      const pixelSize = Math.floor(cssSize * ratio);
      if (this.canvas.width !== pixelSize || this.canvas.height !== pixelSize) {
        this.canvas.width = pixelSize;
        this.canvas.height = pixelSize;
      }
      this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      this.ctx.clearRect(0, 0, cssSize, cssSize);

      const pad = Math.max(34, Math.round(cssSize * 0.085));
      const grid = cssSize - pad * 2;
      const cell = grid / (SIZE - 1);
      this.geometry = { pad, cell, cssSize };

      this.drawSurface(cssSize);
      this.drawGrid(pad, cell);
      this.drawHeat(options.stats, pad, cell);
      this.drawBans(options.bans, pad, cell);
      this.drawStones(board, pad, cell);
      this.drawHover(board, options.hover, options.hoverLegal, pad, cell);
    }

    drawSurface(size) {
      const ctx = this.ctx;
      const colors = this.colors();
      ctx.fillStyle = colors.board;
      ctx.fillRect(0, 0, size, size);
      ctx.strokeStyle = colors.ink;
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, size - 1, size - 1);
    }

    drawGrid(pad, cell) {
      const ctx = this.ctx;
      const colors = this.colors();
      ctx.save();
      ctx.strokeStyle = colors.grid;
      ctx.lineWidth = 1;
      for (let i = 0; i < SIZE; i++) {
        const p = pad + i * cell;
        ctx.beginPath();
        ctx.moveTo(pad, p);
        ctx.lineTo(pad + cell * (SIZE - 1), p);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(p, pad);
        ctx.lineTo(p, pad + cell * (SIZE - 1));
        ctx.stroke();
      }

      ctx.fillStyle = colors.ink;
      for (const row of [3, 7, 11]) {
        for (const col of [3, 7, 11]) {
          ctx.fillRect(pad + col * cell - 2, pad + row * cell - 2, 4, 4);
        }
      }

      ctx.font = "12px Consolas, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = colors.muted;
      for (let i = 0; i < SIZE; i++) {
        const p = pad + i * cell;
        ctx.fillText(LETTERS[i], p, pad * 0.45);
        ctx.fillText(String(i + 1), pad * 0.45, p);
      }
      ctx.restore();
    }

    drawHeat(stats, pad, cell) {
      const candidates = stats?.candidates || [];
      const ctx = this.ctx;
      const colors = this.colors();
      ctx.save();
      candidates.slice(0, 12).forEach((candidate, index) => {
        const x = pad + candidate.col * cell;
        const y = pad + candidate.row * cell;
        const radius = cell * (0.48 - Math.min(index, 8) * 0.018);
        ctx.globalAlpha = Math.max(0.18, 0.58 - index * 0.035);
        ctx.strokeStyle = colors.ink;
        ctx.lineWidth = index === 0 ? 3 : 1;
        ctx.setLineDash(index === 0 ? [] : [4, 3]);
        ctx.beginPath();
        ctx.rect(x - radius, y - radius, radius * 2, radius * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = colors.ink;
        ctx.font = `${Math.max(10, Math.floor(cell * 0.26))}px Consolas, monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(index + 1), x, y);
      });
      ctx.restore();
    }

    drawBans(bans, pad, cell) {
      if (!bans || bans.length === 0) {
        return;
      }
      const ctx = this.ctx;
      const colors = this.colors();
      ctx.save();
      ctx.strokeStyle = colors.muted;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.72;
      for (const ban of bans) {
        const x = pad + ban.col * cell;
        const y = pad + ban.row * cell;
        const r = cell * 0.22;
        ctx.beginPath();
        ctx.moveTo(x - r, y - r);
        ctx.lineTo(x + r, y + r);
        ctx.moveTo(x + r, y - r);
        ctx.lineTo(x - r, y + r);
        ctx.stroke();
      }
      ctx.restore();
    }

    drawStones(board, pad, cell) {
      const ctx = this.ctx;
      const colors = this.colors();
      for (let row = 0; row < SIZE; row++) {
        for (let col = 0; col < SIZE; col++) {
          const stone = board.get(row, col);
          if (stone === EMPTY) {
            continue;
          }
          const x = pad + col * cell;
          const y = pad + row * cell;
          const radius = cell * 0.38;
          const isLast = board.lastMove?.row === row && board.lastMove?.col === col;

          ctx.save();
          ctx.lineWidth = stone === BLACK ? 2.6 : 1.4;
          ctx.strokeStyle = colors.ink;
          ctx.fillStyle = stone === BLACK ? "#111111" : "#ffffff";
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          if (stone === WHITE) {
            ctx.fillStyle = "#111111";
            ctx.beginPath();
            ctx.arc(x, y, radius * 0.18, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.strokeStyle = colors.ink;
            ctx.beginPath();
            ctx.arc(x, y, radius * 0.58, 0, Math.PI * 2);
            ctx.stroke();
          }

          if (isLast) {
            ctx.strokeStyle = colors.ink;
            ctx.lineWidth = 2;
            ctx.strokeRect(x - radius * 1.15, y - radius * 1.15, radius * 2.3, radius * 2.3);
          }
          ctx.restore();
        }
      }
    }

    drawHover(board, hover, legal, pad, cell) {
      if (!hover || board.result || !board.isEmpty(hover.row, hover.col)) {
        return;
      }
      const ctx = this.ctx;
      const colors = this.colors();
      const x = pad + hover.col * cell;
      const y = pad + hover.row * cell;
      const r = cell * 0.32;
      ctx.save();
      ctx.globalAlpha = legal ? 0.85 : 0.35;
      ctx.strokeStyle = legal ? colors.ink : colors.muted;
      ctx.lineWidth = 1.5;
      ctx.setLineDash(legal ? [] : [3, 3]);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  class GameController {
    constructor() {
      this.board = new BoardModel();
      this.view = new BoardView(ui.board);
      this.engine = new GomokuSearchEngine();
      this.mode = "human-human";
      this.humanSide = BLACK;
      this.hintEnabled = false;
      this.auto = false;
      this.thinking = false;
      this.hintPending = false;
      this.hintToken = 0;
      this.preheatToken = 0;
      this.preheatTimer = 0;
      this.preheatBusy = false;
      this.lastStats = null;
      this.logs = [];
      this.hover = null;
      this.applyMachineIqPreset(ui.machineIq.value);
      this.applyTheme(false);
      this.bindEvents();
      this.writeLog("BOOT gomoku TERMINAL");
      this.render();
      warmupOpeningPresearch();
    }

    bindEvents() {
      ui.modeButtons.forEach((button) => {
        button.addEventListener("click", () => {
          this.mode = button.dataset.mode;
          this.auto = this.mode === "ai-ai" ? this.auto : false;
          if (this.mode !== "human-human") {
            this.hintEnabled = false;
          }
          this.lastStats = null;
          this.cancelHumanPreheat();
          this.writeLog(`MODE ${this.mode.toUpperCase()}`);
          this.render();
          this.scheduleAiIfNeeded();
          this.scheduleHumanPreheat();
        });
      });

      ui.theme.addEventListener("change", () => this.applyTheme(true));
      [ui.bgColor, ui.inkColor].forEach((control) => {
        control.addEventListener("input", () => {
          ui.theme.value = "custom";
          this.applyTheme(true);
        });
      });

      ui.newGame.addEventListener("click", () => this.newGame());
      ui.undo.addEventListener("click", () => this.undo());
      ui.aiStep.addEventListener("click", () => this.runEngineForTurn(true));
      ui.autoPlay.addEventListener("click", () => {
        this.auto = !this.auto;
        this.writeLog(this.auto ? "AUTO ON" : "AUTO OFF");
        this.render();
        this.scheduleAiIfNeeded();
      });
      ui.hintToggle.addEventListener("click", () => {
        this.hintEnabled = !this.hintEnabled;
        this.lastStats = null;
        this.writeLog(this.hintEnabled ? "HINT ON" : "HINT OFF");
        this.render();
        this.requestHint();
      });
      ui.humanSide.addEventListener("change", () => {
        this.humanSide = Number(ui.humanSide.value);
        this.writeLog(`HUMAN ${stoneName(this.humanSide)}`);
        this.render();
        this.scheduleAiIfNeeded();
        this.scheduleHumanPreheat();
      });

      [
        [ui.machineSeedRefresh, ui.machineSeed, "M"],
        [ui.blackSeedRefresh, ui.blackSeed, "B"],
        [ui.whiteSeedRefresh, ui.whiteSeed, "W"],
      ].forEach(([button, input, prefix]) => {
        button.addEventListener("click", () => {
          input.value = makeFreshSeed(prefix);
          this.writeLog(`SEED ${prefix} ${input.value}`);
          this.lastStats = null;
          this.syncOutputs();
          if (this.mode === "human-ai") {
            this.scheduleHumanPreheat();
          } else {
            this.renderTrace(this.lastStats);
          }
        });
      });

      ui.machineIq.addEventListener("change", () => {
        if (ui.machineIq.value !== "custom") {
          this.applyMachineIqPreset(ui.machineIq.value);
        } else {
          ui.machineAdvanced.open = true;
          this.updateMachineIqFromAdvanced();
        }
        this.renderTrace(this.lastStats);
        this.scheduleHumanPreheat();
      });

      [ui.machineDepth, ui.machineWidth].forEach((control) => {
        control.addEventListener("input", () => {
          ui.machineIq.value = "custom";
          this.updateMachineIqFromAdvanced();
          this.syncOutputs();
          this.scheduleHumanPreheat();
        });
      });

      [
        ui.machineEngine,
        ui.machineSeed,
        ui.machineTime,
        ui.machineTt,
        ui.blackEngine,
        ui.blackSeed,
        ui.blackTime,
        ui.blackTt,
        ui.blackDepth,
        ui.blackWidth,
        ui.whiteEngine,
        ui.whiteSeed,
        ui.whiteTime,
        ui.whiteTt,
        ui.whiteDepth,
        ui.whiteWidth,
        ui.blackHintEngine,
        ui.blackHintDepth,
        ui.blackHintWidth,
        ui.whiteHintEngine,
        ui.whiteHintDepth,
        ui.whiteHintWidth,
      ].forEach((control) => {
        control.addEventListener("input", () => {
          this.syncOutputs();
          ui.timeCap.textContent = this.makeTimeCapText();
          if (this.mode === "human-human" && this.hintEnabled) {
            this.requestHint();
          } else if (this.mode === "human-ai") {
            this.scheduleHumanPreheat();
          } else {
            this.renderTrace(this.lastStats);
          }
        });
      });

      ui.board.addEventListener("click", (event) => {
        const cell = this.view.cellFromEvent(event);
        if (!cell) {
          return;
        }
        this.handleHumanMove(cell.row, cell.col);
      });

      ui.board.addEventListener("pointermove", (event) => {
        this.hover = this.view.cellFromEvent(event);
        this.renderBoardOnly();
      });

      ui.board.addEventListener("pointerleave", () => {
        this.hover = null;
        this.renderBoardOnly();
      });

      window.addEventListener("resize", () => this.renderBoardOnly());
    }

    applyTheme(renderAfter) {
      const theme = ui.theme.value;
      if (theme !== "custom" && THEMES[theme]) {
        ui.bgColor.value = THEMES[theme].bg;
        ui.inkColor.value = THEMES[theme].ink;
        document.body.dataset.theme = theme;
        document.body.style.removeProperty("--bg");
        document.body.style.removeProperty("--panel");
        document.body.style.removeProperty("--panel-2");
        document.body.style.removeProperty("--ink");
        document.body.style.removeProperty("--line");
        document.body.style.removeProperty("--soft-line");
        document.body.style.removeProperty("--board-bg");
        document.body.style.removeProperty("--grid");
        document.body.style.removeProperty("--muted");
        document.body.style.removeProperty("--dim");
      } else {
        const bg = ui.bgColor.value;
        const ink = ui.inkColor.value;
        document.body.dataset.theme = "custom";
        document.body.style.setProperty("--bg", bg);
        document.body.style.setProperty("--panel", mixHex(bg, "#ffffff", 0.72));
        document.body.style.setProperty("--panel-2", mixHex(bg, "#ffffff", 0.5));
        document.body.style.setProperty("--ink", ink);
        document.body.style.setProperty("--line", ink);
        document.body.style.setProperty("--soft-line", mixHex(bg, ink, 0.35));
        document.body.style.setProperty("--board-bg", mixHex(bg, "#ffffff", 0.58));
        document.body.style.setProperty("--grid", mixHex(bg, ink, 0.62));
        document.body.style.setProperty("--muted", mixHex(bg, ink, 0.72));
        document.body.style.setProperty("--dim", mixHex(bg, ink, 0.45));
      }
      if (renderAfter) {
        this.renderBoardOnly();
      }
    }

    applyMachineIqPreset(value) {
      const preset = IQ_PRESETS[value] || IQ_PRESETS[105];
      ui.machineDepth.value = String(preset.depth);
      ui.machineWidth.value = String(preset.width);
      ui.machineIqOutput.textContent = `IQ ${value}`;
      ui.machineAdvanced.open = false;
      this.syncOutputs();
    }

    updateMachineIqFromAdvanced() {
      const depth = Number(ui.machineDepth.value);
      const width = Number(ui.machineWidth.value);
      const iq = Math.round(40 + depth * 13 + width * 0.75);
      ui.machineIqOutput.textContent = `IQ ${clamp(iq, 60, 180)}`;
    }

    newGame() {
      this.cancelHumanPreheat();
      this.board.reset();
      this.lastStats = null;
      this.thinking = false;
      this.hintPending = false;
      this.writeLog("NEW GAME");
      this.render();
      this.requestHint();
      this.scheduleAiIfNeeded();
      this.scheduleHumanPreheat();
    }

    undo() {
      if (this.thinking || this.board.history.length === 0) {
        return;
      }
      this.cancelHumanPreheat();
      let steps = 1;
      if (this.mode === "human-ai" && this.board.current === this.humanSide && this.board.history.length > 1) {
        steps = 2;
      }
      const removed = this.board.undo(steps);
      this.auto = false;
      this.lastStats = null;
      this.writeLog(`UNDO ${removed.map((move) => moveName(move)).join(" ")}`);
      this.render();
      this.requestHint();
      this.scheduleHumanPreheat();
    }

    handleHumanMove(row, col) {
      if (this.thinking || this.hintPending) {
        return;
      }
      if (!this.isHumanTurn()) {
        this.writeLog("INPUT LOCKED");
        return;
      }
      this.cancelHumanPreheat();
      this.commitMove(row, col, "HUMAN", null);
    }

    commitMove(row, col, source, stats) {
      if (this.board.result) {
        return false;
      }
      const player = this.board.current;
      const legal = Rules.checkMove(this.board, row, col, player);
      if (!legal.ok) {
        this.writeLog(`${stoneName(player)} ${moveName({ row, col })} REJECT ${legal.reason}`);
        this.renderBoardOnly();
        return false;
      }

      const rating = this.mode === "human-human" ? this.rateMove(row, col, player) : null;
      const move = this.board.applyMove(row, col, player, source, stats);
      move.rating = rating;
      this.lastStats = stats || null;

      const winner = ResultJudge.check(this.board, row, col, player);
      if (winner === player) {
        this.board.result = { type: "win", winner: player };
        this.auto = false;
        this.writeLog(`${stoneName(player)} ${moveName(move)} WIN${rating === null ? "" : ` SCORE ${formatRating(rating)}`}`);
      } else if (ResultJudge.isFull(this.board)) {
        this.board.result = { type: "draw", winner: EMPTY };
        this.auto = false;
        this.writeLog("DRAW FULL BOARD");
      } else {
        this.writeLog(
          `${source} ${stoneName(player)} ${moveName(move)}${rating === null ? "" : ` SCORE ${formatRating(rating)}`}`,
        );
      }

      this.render();
      this.requestHint();
      this.scheduleAiIfNeeded();
      this.scheduleHumanPreheat();
      return true;
    }

    rateMove(row, col, player) {
      const config = this.readHintConfig(player);
      if (config.version === V6_ENGINE_VERSION) {
        return null;
      }
      return rateMoveQuality(this.board, row, col, player, config, this.lastStats);
    }

    async findBestMoveAsync(board, player, config) {
      if (config.version !== V6_ENGINE_VERSION) {
        return this.engine.findBestMove(board, player, config);
      }

      if (!window.GomokuV6Engine) {
        return makeEngineErrorResult(config, "V6-WASM-MISSING", "v6-engine-client.js is not loaded");
      }

      try {
        return await window.GomokuV6Engine.findBestMove(board, player, config);
      } catch (error) {
        return makeEngineErrorResult(config, "V6-WASM-ERROR", error?.message || String(error));
      }
    }

    async requestHint() {
      if (this.mode !== "human-human" || !this.hintEnabled || this.board.result || this.thinking) {
        return;
      }
      const token = ++this.hintToken;
      const player = this.board.current;
      const config = this.readHintConfig(player);
      this.hintPending = true;
      this.render();
      await sleep(20);
      const { stats } = await this.findBestMoveAsync(this.board, player, config);
      if (token !== this.hintToken || this.mode !== "human-human" || !this.hintEnabled) {
        return;
      }
      stats.player = player;
      this.lastStats = stats;
      this.hintPending = false;
      if (stats.error) {
        this.writeLog(`HINT ERROR ${stats.reason} ${stats.error}`);
      }
      this.render();
    }

    async runEngineForTurn(forced = false) {
      if (this.thinking || this.hintPending || this.board.result || this.mode === "human-human") {
        return;
      }
      if (!forced && this.isHumanTurn()) {
        return;
      }
      if (forced && this.mode === "human-ai" && this.isHumanTurn()) {
        return;
      }

      const player = this.board.current;
      const config = this.readEngineConfig(player);
      this.thinking = true;
      this.writeLog(`${stoneName(player)} ENGINE ${config.version.toUpperCase()} THINK`);
      this.render();
      await sleep(30);

      const { move, stats } = await this.findBestMoveAsync(this.board, player, config);
      stats.player = player;
      this.thinking = false;
      this.lastStats = stats;

      if (stats.error) {
        this.writeLog(`ENGINE ERROR ${stats.reason} ${stats.error}`);
        this.render();
        return;
      }

      if (!move) {
        this.board.result = { type: "draw", winner: EMPTY };
        this.writeLog("NO LEGAL MOVE");
        this.render();
        return;
      }

      const legal = Rules.checkMove(this.board, move.row, move.col, player);
      if (!legal.ok) {
        const fallback = firstLegalMove(this.board, player);
        this.writeLog(`ENGINE ILLEGAL ${moveName(move)} ${legal.reason}`);
        if (!fallback) {
          this.board.result = { type: "draw", winner: EMPTY };
          this.render();
          return;
        }
        this.commitMove(fallback.row, fallback.col, "AI", stats);
        return;
      }

      this.commitMove(move.row, move.col, "AI", stats);
      this.writeLog(
        `TRACE D${stats.completedDepth} N${stats.nodes} S${formatScore(stats.score)} T${Math.round(
          stats.durationMs,
        )}MS ${stats.reason}`,
      );
    }

    scheduleAiIfNeeded() {
      if (this.board.result || this.thinking || this.hintPending || this.isHumanTurn()) {
        return;
      }
      if (this.mode === "human-ai" || (this.mode === "ai-ai" && this.auto)) {
        window.setTimeout(() => this.runEngineForTurn(false), this.mode === "ai-ai" ? 260 : 120);
      }
    }

    scheduleHumanPreheat() {
      window.clearTimeout(this.preheatTimer);
      if (this.mode !== "human-ai" || !this.isHumanTurn() || this.board.result || this.thinking || this.hintPending) {
        return;
      }
      requestPresearchBucket(this.board.history.length);
      requestPresearchBucket(this.board.history.length + 1);
      const token = ++this.preheatToken;
      this.preheatTimer = window.setTimeout(() => this.preheatHumanReplies(token), 120);
    }

    cancelHumanPreheat() {
      this.preheatToken++;
      window.clearTimeout(this.preheatTimer);
      this.preheatTimer = 0;
    }

    async preheatHumanReplies(token) {
      if (token !== this.preheatToken || this.mode !== "human-ai" || !this.isHumanTurn() || this.board.result) {
        return;
      }
      if (this.preheatBusy) {
        return;
      }

      this.preheatBusy = true;
      let warmed = 0;
      try {
        const human = this.board.current;
        const scoutConfig = normalizeConfig({
          version: "scout",
          maxDepth: 1,
          candidateLimit: Math.max(PREHEAT_CANDIDATES, Number(ui.machineWidth.value) || 18),
          seed: `preheat-human:${stoneName(human)}`,
          timeLimitMs: 300,
          vcfDepth: 0,
          qsearchDepth: 0,
        });
        const context = new SearchContext(this.board, scoutConfig, this.engine.cache);
        const likelyMoves = generateCandidates(context, human, null).slice(0, PREHEAT_CANDIDATES);

        for (const candidate of likelyMoves) {
          if (token !== this.preheatToken || this.mode !== "human-ai" || !this.isHumanTurn() || this.board.result) {
            break;
          }
          if (!Rules.checkMove(this.board, candidate.row, candidate.col, human).ok) {
            continue;
          }

          const sandbox = this.board.clone();
          sandbox.applyMove(candidate.row, candidate.col, human, "PREDICT", null);
          if (ResultJudge.check(sandbox, candidate.row, candidate.col, human) === human || ResultJudge.isFull(sandbox)) {
            continue;
          }

          const aiPlayer = sandbox.current;
          const config = this.readEngineConfig(aiPlayer, sandbox);
          if (config.version === V6_ENGINE_VERSION) {
            continue;
          }
          this.engine.findBestMove(sandbox, aiPlayer, {
            ...config,
            timeLimitMs: Math.min(PREHEAT_TIME_LIMIT_MS, config.timeLimitMs),
          });
          warmed++;
          await sleep(8);
        }
      } finally {
        this.preheatBusy = false;
        if (warmed > 0 && token === this.preheatToken && this.mode === "human-ai" && this.isHumanTurn()) {
          this.writeLog(`PREFETCH ${warmed} HUMAN LINES`);
          this.renderLog();
        }
      }
    }

    isHumanTurn() {
      if (this.mode === "human-human") {
        return true;
      }
      if (this.mode === "human-ai") {
        return this.board.current === this.humanSide;
      }
      return false;
    }

    readEngineConfig(player, board = this.board) {
      if (this.mode === "human-ai") {
        const baseVersion = ui.machineEngine.value;
        const version = this.effectiveEngineVersion(baseVersion);
        const maxDepth = Number(ui.machineDepth.value);
        const candidateLimit = Number(ui.machineWidth.value);
        return {
          version,
          maxDepth,
          candidateLimit,
          seed: `${ui.machineSeed.value || "0"}:${stoneName(player)}:${version}`,
          timeLimitMs: Number(ui.machineTime.value),
          symmetryTT: this.resolveTtMode(ui.machineTt.value, version),
          vcfDepth: usesVcfEngine(version) ? Math.max(3, Math.min(9, maxDepth + 2)) : 0,
          qsearchDepth: usesVcfEngine(version) ? 4 : 0,
        };
      }

      const isBlack = player === BLACK;
      const baseVersion = isBlack ? ui.blackEngine.value : ui.whiteEngine.value;
      const version = this.effectiveEngineVersion(baseVersion);
      const maxDepth = Number(isBlack ? ui.blackDepth.value : ui.whiteDepth.value);
      const candidateLimit = Number(isBlack ? ui.blackWidth.value : ui.whiteWidth.value);
      const seedText = isBlack ? ui.blackSeed.value : ui.whiteSeed.value;
      const timeLimitMs = Number(isBlack ? ui.blackTime.value : ui.whiteTime.value);
      const ttMode = isBlack ? ui.blackTt.value : ui.whiteTt.value;
      return {
        version,
        maxDepth,
        candidateLimit,
        seed: `${seedText || "0"}:${stoneName(player)}:${version}`,
        timeLimitMs,
        symmetryTT: this.resolveTtMode(ttMode, version),
        vcfDepth: usesVcfEngine(version) ? Math.max(3, Math.min(9, maxDepth + 2)) : 0,
        qsearchDepth: usesVcfEngine(version) ? 4 : 0,
      };
    }

    resolveTtMode(mode, version) {
      if (!isStrongProfileVersion(version)) {
        return false;
      }
      if (mode === "raw") {
        return false;
      }
      if (mode === "sym") {
        return true;
      }
      return true;
    }

    readHintConfig(player) {
      const isBlack = player === BLACK;
      const baseVersion = isBlack ? ui.blackHintEngine.value : ui.whiteHintEngine.value;
      const version = this.effectiveEngineVersion(baseVersion);
      const maxDepth = Number(isBlack ? ui.blackHintDepth.value : ui.whiteHintDepth.value);
      const candidateLimit = Number(isBlack ? ui.blackHintWidth.value : ui.whiteHintWidth.value);
      return {
        version,
        maxDepth,
        candidateLimit,
        seed: `hint:${stoneName(player)}:${version}`,
        timeLimitMs: 900,
        vcfDepth: usesVcfEngine(version) ? Math.max(3, Math.min(7, maxDepth + 2)) : 0,
        qsearchDepth: usesVcfEngine(version) ? 3 : 0,
      };
    }

    effectiveEngineVersion(baseVersion) {
      if (String(baseVersion || "").startsWith(LAB_ENGINE_PREFIX)) {
        return baseVersion;
      }
      return baseVersion;
    }

    syncOutputs() {
      ui.machineDepthOutput.textContent = String(ui.machineDepth.value);
      ui.machineWidthOutput.textContent = String(ui.machineWidth.value);
      ui.machineTimeOutput.textContent = `${ui.machineTime.value}MS`;
      if (ui.machineIq.value === "custom") {
        this.updateMachineIqFromAdvanced();
      }
      ui.blackTimeOutput.textContent = `TIME ${ui.blackTime.value}MS`;
      ui.blackDepthOutput.textContent = `DEPTH ${ui.blackDepth.value}`;
      ui.blackWidthOutput.textContent = `WIDTH ${ui.blackWidth.value}`;
      ui.whiteTimeOutput.textContent = `TIME ${ui.whiteTime.value}MS`;
      ui.whiteDepthOutput.textContent = `DEPTH ${ui.whiteDepth.value}`;
      ui.whiteWidthOutput.textContent = `WIDTH ${ui.whiteWidth.value}`;
      ui.blackHintDepthOutput.textContent = `DEPTH ${ui.blackHintDepth.value}`;
      ui.blackHintWidthOutput.textContent = `WIDTH ${ui.blackHintWidth.value}`;
      ui.whiteHintDepthOutput.textContent = `DEPTH ${ui.whiteHintDepth.value}`;
      ui.whiteHintWidthOutput.textContent = `WIDTH ${ui.whiteHintWidth.value}`;
    }

    render() {
      this.syncOutputs();
      const showConfig = this.mode !== "human-human" || this.hintEnabled;
      ui.shell.classList.toggle("config-hidden", !showConfig);
      ui.controlPanel.hidden = !showConfig;
      ui.humanAiConfig.hidden = this.mode !== "human-ai";
      ui.aiAiConfig.hidden = this.mode !== "ai-ai";
      ui.hintConfig.hidden = !(this.mode === "human-human" && this.hintEnabled);
      ui.configTitle.textContent =
        this.mode === "human-ai" ? "人机配置" : this.mode === "ai-ai" ? "机机配置" : "落子提示配置";

      ui.modeButtons.forEach((button) => {
        button.classList.toggle("is-active", button.dataset.mode === this.mode);
      });
      ui.hintToggle.hidden = this.mode !== "human-human";
      ui.hintToggle.textContent = this.hintEnabled ? "提示 ON" : "提示 OFF";
      ui.hintToggle.setAttribute("aria-pressed", String(this.hintEnabled));
      ui.autoPlay.hidden = this.mode !== "ai-ai";
      ui.aiStep.hidden = this.mode === "human-human";
      ui.autoPlay.setAttribute("aria-pressed", String(this.auto));
      ui.autoPlay.disabled = this.mode !== "ai-ai";
      ui.undo.disabled = this.thinking || this.hintPending || this.board.history.length === 0;
      ui.aiStep.disabled =
        this.thinking ||
        this.hintPending ||
        Boolean(this.board.result) ||
        (this.mode === "human-ai" && this.isHumanTurn());
      ui.newGame.disabled = this.thinking || this.hintPending;
      ui.turnReadout.textContent = this.makeTurnText();
      ui.status.textContent = this.makeStatusText();
      ui.moveCount.textContent = `MOVES ${this.board.history.length}`;
      ui.timeCap.textContent = this.makeTimeCapText();
      ui.resultBanner.hidden = !this.board.result;
      ui.resultTitle.textContent =
        this.board.result?.type === "win" ? `${stoneName(this.board.result.winner)} WINS` : "DRAW";
      this.renderBoardOnly();
      this.renderMoves();
      this.renderLog();
      this.renderTrace(this.lastStats);
    }

    renderBoardOnly() {
      const hoverLegal =
        this.hover && this.isHumanTurn()
          ? Rules.checkMove(this.board, this.hover.row, this.hover.col, this.board.current).ok
          : false;
      this.view.draw(this.board, {
        hover: this.hover,
        hoverLegal,
        stats: this.mode === "human-ai" ? null : this.lastStats,
        bans: this.collectBans(),
      });
    }

    renderMoves() {
      ui.moveList.replaceChildren();
      if (this.board.history.length === 0) {
        const item = document.createElement("li");
        item.textContent = "EMPTY STACK";
        ui.moveList.append(item);
        return;
      }
      for (const move of this.board.history.slice(-60)) {
        const item = document.createElement("li");
        const coord = document.createElement("span");
        const meta = document.createElement("span");
        coord.className = "coord";
        meta.className = "meta";
        coord.textContent = `${String(move.number).padStart(3, "0")} ${stoneShort(move.player)} ${moveName(move)}`;
        meta.textContent = move.rating === null || move.rating === undefined ? move.source : `${move.source} ${formatRating(move.rating)}`;
        if (move.rating !== null && move.rating !== undefined) {
          meta.classList.add(move.rating >= 0 ? "score-good" : "score-bad");
        }
        item.append(coord, meta);
        ui.moveList.append(item);
      }
    }

    renderLog() {
      ui.eventLog.textContent = this.logs.slice(-80).join("\n");
      ui.eventLog.scrollTop = ui.eventLog.scrollHeight;
    }

    renderTrace(stats) {
      ui.statDepth.textContent = stats ? String(stats.completedDepth) : "-";
      ui.statNodes.textContent = stats ? compactNumber(stats.nodes) : "-";
      ui.statScore.textContent = stats ? formatScore(stats.score) : "-";
      ui.statTime.textContent = stats
        ? `${Math.round(stats.durationMs)}MS${stats.tt?.mode ? ` ${stats.tt.mode.toUpperCase()}` : ""}`
        : "-";

      ui.depthTrace.replaceChildren();
      if (this.hintPending) {
        const row = document.createElement("div");
        row.className = "trace-row";
        row.textContent = "HINT THINKING";
        ui.depthTrace.append(row);
      } else if (!stats || stats.depthTrace.length === 0) {
        const row = document.createElement("div");
        row.className = "trace-row";
        row.textContent = stats ? `TACTIC ${stats.reason || "READY"}` : "WAITING";
        ui.depthTrace.append(row);
      } else {
        const maxNodes = Math.max(...stats.depthTrace.map((item) => item.nodes), 1);
        for (const item of stats.depthTrace.slice(-6).reverse()) {
          const row = document.createElement("div");
          row.className = "trace-row";
          const left = document.createElement("strong");
          const bar = document.createElement("span");
          const right = document.createElement("span");
          left.textContent = `D${item.depth} ${moveName(item.move)}`;
          bar.className = "bar";
          bar.innerHTML = `<span style="--w:${Math.max(4, (item.nodes / maxNodes) * 100)}%"></span>`;
          right.textContent = `${formatScore(item.score)} ${Math.round(item.time)}MS`;
          row.append(left, bar, right);
          ui.depthTrace.append(row);
        }
      }

      ui.candidateList.replaceChildren();
      const candidates = stats?.candidates || [];
      if (candidates.length === 0) {
        const item = document.createElement("li");
        item.textContent = this.mode === "human-human" ? "每步评分会显示在 MOVE STACK" : "NO DATA";
        ui.candidateList.append(item);
        return;
      }
      const maxAbs = Math.max(...candidates.map((candidate) => Math.abs(candidate.score)), 1);
      candidates.slice(0, 18).forEach((candidate, index) => {
        const item = document.createElement("li");
        const coord = document.createElement("span");
        const bar = document.createElement("span");
        const score = document.createElement("span");
        coord.className = "coord";
        bar.className = "bar";
        score.className = "score";
        coord.textContent = `#${index + 1} ${moveName(candidate)}`;
        bar.innerHTML = `<span style="--w:${Math.max(4, (Math.abs(candidate.score) / maxAbs) * 100)}%"></span>`;
        score.textContent = this.mode === "human-human" ? formatRating(candidateQuality(candidate, candidates)) : formatScore(candidate.score);
        item.append(coord, bar, score);
        ui.candidateList.append(item);
      });
    }

    collectBans() {
      if (this.board.result || this.board.current !== BLACK) {
        return [];
      }
      const bans = [];
      for (let row = 0; row < SIZE; row++) {
        for (let col = 0; col < SIZE; col++) {
          if (!this.board.isEmpty(row, col)) {
            continue;
          }
          this.board.set(row, col, BLACK);
          const ban = GomokuBanRule.banInfo(this.board, row, col);
          this.board.set(row, col, EMPTY);
          if (ban.code !== 0) {
            bans.push({ row, col, code: ban.code });
          }
        }
      }
      return bans;
    }

    makeTurnText() {
      if (this.thinking) {
        return `${stoneName(this.board.current)} THINKING`;
      }
      if (this.hintPending) {
        return `${stoneName(this.board.current)} HINT`;
      }
      if (this.board.result?.type === "win") {
        return `${stoneName(this.board.result.winner)} WIN`;
      }
      if (this.board.result?.type === "draw") {
        return "DRAW";
      }
      return `${stoneName(this.board.current)} READY`;
    }

    makeStatusText() {
      if (this.thinking) {
        return `${stoneName(this.board.current)} ENGINE THINKING`;
      }
      if (this.hintPending) {
        return `${stoneName(this.board.current)} HINT THINKING`;
      }
      if (this.board.result?.type === "win") {
        return `${stoneName(this.board.result.winner)} WINS`;
      }
      if (this.board.result?.type === "draw") {
        return "DRAW";
      }
      if (this.isHumanTurn()) {
        return `${stoneName(this.board.current)} TO MOVE`;
      }
      return `${stoneName(this.board.current)} AI READY`;
    }

    makeTimeCapText() {
      if (this.mode === "human-ai") {
        const prefix = ui.machineEngine.value === "nn-fusion" ? "NN CAP" : "CAP";
        return `${prefix} ${ui.machineTime.value}MS`;
      }
      if (this.mode === "ai-ai") {
        const activeEngine = this.board.current === BLACK ? ui.blackEngine.value : ui.whiteEngine.value;
        const prefix = activeEngine === "nn-fusion" ? "NN CAP" : "CAP";
        return `${prefix} ${this.board.current === BLACK ? ui.blackTime.value : ui.whiteTime.value}MS`;
      }
      if (this.hintEnabled) {
        const activeEngine = this.board.current === BLACK ? ui.blackHintEngine.value : ui.whiteHintEngine.value;
        return `${activeEngine === "nn-fusion" ? "NN HINT" : "HINT"} 900MS`;
      }
      return "CAP -";
    }

    writeLog(message) {
      const stamp = new Date().toLocaleTimeString("zh-CN", { hour12: false });
      this.logs.push(`${stamp} ${message}`);
    }
  }

  function usesVcfEngine(version) {
    return version === "pvs-vcf" || version === "v4-source-guard" || version === LAB_STRONG_VERSION;
  }

  function makeEngineErrorResult(config, reason, message) {
    return {
      move: null,
      stats: {
        version: config.version,
        completedDepth: 0,
        nodes: 0,
        score: 0,
        timedOut: false,
        durationMs: 0,
        candidates: [],
        depthTrace: [],
        choiceCache: { probes: 0, hits: 0, stores: 0 },
        reason,
        error: message,
      },
    };
  }

  function usesPresearchEngine(version) {
    return usesVcfEngine(version);
  }

  function usesV6EngineVersion(version) {
    return version === V6_ENGINE_VERSION;
  }

  function isStrongProfileVersion(version) {
    return version === "v4-source-guard" || version === LAB_STRONG_VERSION;
  }

  function canUsePresearchEntry(config, entry) {
    if (entry?.flag !== "RANK") {
      return true;
    }
    return !(
      isStrongProfileVersion(config.version) &&
      config.symmetryTT &&
      config.timeLimitMs >= 1000
    );
  }

  function usesSourceGuardEngine(context) {
    return context.config.version === "v4-source-guard" || usesLabStrongEngine(context);
  }

  function usesLabStrongEngine(context) {
    return context.config.version === LAB_STRONG_VERSION;
  }

  function usesDeepLabSearch(context) {
    return (
      usesLabStrongEngine(context) &&
      context.stoneCount >= LAB_DEEP_FEATURE_MIN_STONES &&
      context.config.timeLimitMs >= 1000 &&
      context.config.maxDepth >= CHOICE_CACHE_MIN_DEPTH &&
      context.config.candidateLimit >= CHOICE_CACHE_MIN_WIDTH
    );
  }

  function usesResidualDefenseProfiles(context) {
    return usesDeepLabSearch(context);
  }

  function normalizeConfig(config = {}) {
    const version = ["scout", "pvs", "pvs-vcf", "v4-source-guard", LAB_STRONG_VERSION, V6_ENGINE_VERSION, "nn-fusion"].includes(config.version)
      ? config.version
      : "pvs-vcf";
    const maxDepth = version === "scout" ? 1 : clamp(Number(config.maxDepth) || 5, 1, 10);
    const candidateLimit = clamp(Number(config.candidateLimit) || 32, 8, 64);
    const timeLimitMs = Math.max(300, Number(config.timeLimitMs) || TIME_LIMIT_MS);
    const defaultSymmetryTT = isStrongProfileVersion(version);
    return {
      version,
      maxDepth,
      candidateLimit,
      seed: String(config.seed || "0"),
      timeLimitMs,
      symmetryTT: parseBooleanOption(config.symmetryTT, defaultSymmetryTT),
      vcfDepth: usesVcfEngine(version) ? clamp(Number(config.vcfDepth) || maxDepth + 2, 1, 9) : 0,
      qsearchDepth: usesVcfEngine(version) ? clamp(Number(config.qsearchDepth ?? 4), 0, 4) : 0,
      nnCandidateLimit: clamp(Number(config.nnCandidateLimit) || candidateLimit || NN_DEFAULT_CANDIDATES, 1, NN_POLICY_SIZE),
      nnPolicyWeight: Number.isFinite(Number(config.nnPolicyWeight)) ? Number(config.nnPolicyWeight) : 1,
      nnStaticWeight: Number.isFinite(Number(config.nnStaticWeight))
        ? Number(config.nnStaticWeight)
        : NN_DEFAULT_STATIC_WEIGHT,
      nnCenterWeight: Number.isFinite(Number(config.nnCenterWeight))
        ? Number(config.nnCenterWeight)
        : NN_DEFAULT_CENTER_WEIGHT,
    };
  }

  function parseBooleanOption(value, fallback) {
    if (value === true || value === false) {
      return value;
    }
    if (value === 1 || value === "1" || value === "true" || value === "yes" || value === "on") {
      return true;
    }
    if (value === 0 || value === "0" || value === "false" || value === "no" || value === "off") {
      return false;
    }
    return Boolean(fallback);
  }

  function findRootTacticalMove(context, player) {
    const ownWins = collectImmediateWins(context, player, 1);
    if (ownWins.count > 0) {
      return { ...ownWins.wins[0], score: WIN_SCORE, reason: "WIN-NOW" };
    }

    const rival = opponent(player);
    const opponentWins = collectImmediateWins(context, rival, 2);
    if (opponentWins.count > 0) {
      const block = makeBlockCandidate(context, player, opponentWins.wins[0]);
      if (block) {
        return {
          ...block,
          score: opponentWins.count >= 2 ? -WIN_SCORE / 2 : block.score,
          reason: opponentWins.count >= 2 ? "BLOCK-DOUBLE" : "BLOCK-FIVE",
        };
      }
    }

    if (context.config.vcfDepth > 0) {
      const ownVcf = findVcfWin(context, player, context.config.vcfDepth);
      if (ownVcf) {
        return { ...ownVcf, score: WIN_SCORE / 2, reason: "VCF-WIN" };
      }
    }

    if (usesSourceGuardEngine(context) || context.config.vcfDepth > 0) {
      const defense = findComplexDefenseRootMove(context, player);
      if (defense) {
        return defense;
      }
    }

    if (usesSourceGuardEngine(context)) {
      const sourceGuardMove = findSourceGuardRootMove(context, player);
      if (sourceGuardMove) {
        return sourceGuardMove;
      }
    }

    if (context.config.vcfDepth > 0) {
      const rivalVcf = findVcfWin(context, rival, context.config.vcfDepth);
      if (rivalVcf && isLegalMove(context, rivalVcf.row, rivalVcf.col, player)) {
        return { ...rivalVcf, score: FOUR_SCORE, reason: "VCF-BLOCK" };
      }
    }

    return null;
  }

  function findComplexDefenseRootMove(context, player) {
    const checks = [
      [findRootLiveThreatBlock, "LIVE-THREAT-BLOCK"],
      [findDirectDoubleThreatBlock, "DOUBLE-THREAT-BLOCK"],
      [findForkDefenseMove, "FORK-DEFENSE"],
      [findOpponentForkPointBlock, "FORK-SOURCE-BLOCK"],
    ];
    if (usesResidualDefenseProfiles(context)) {
      checks.splice(3, 0, [findResidualThreatDefenseRootMove, "RESIDUAL-THREAT-GUARD"]);
    }

    const previousSoftStop = context.softStopAt;
    const softBudget = Math.min(
      ROOT_DEFENSE_SOFT_MAX_MS,
      Math.max(120, Math.floor(context.config.timeLimitMs * ROOT_DEFENSE_SOFT_FRACTION)),
    );
    context.softStopAt = Math.min(context.start + context.config.timeLimitMs, performance.now() + softBudget);
    try {
      for (const [finder, reason] of checks) {
        if (context.shouldStop()) {
          return null;
        }
        const move = finder(context, player);
        if (!move || context.timedOut || context.shouldStop()) {
          continue;
        }
        const guarded = context.config.vcfDepth > 0 ? guardRootMoveAgainstVcf(context, player, move) : move;
        if (!guarded || context.timedOut || context.shouldStop()) {
          continue;
        }
        if (!moveLeavesOpponentFork(context, player, guarded) || moveCreatesImmediateDoubleWin(context, player, guarded)) {
          return { ...guarded, reason };
        }
      }
    } finally {
      context.softStopAt = previousSoftStop;
    }

    return null;
  }

  function findSourceGuardRootMove(context, player) {
    let tactical = findRootForcingThreatMove(context, player);
    if (tactical) {
      tactical = guardRootMoveAgainstVcf(context, player, tactical);
      if (
        tactical &&
        (!moveLeavesOpponentFork(context, player, tactical) || moveCreatesImmediateDoubleWin(context, player, tactical))
      ) {
        return { ...tactical, reason: "FORCE-THREAT" };
      }
    }

    return null;
  }

  function sourceDefenseClearsForks(context, player, move) {
    return remainingForkSourcesAfterMove(context, player, move, 1) === 0 && !context.timedOut;
  }

  function findVcfWin(context, attacker, depth) {
    context.nodes++;
    if (context.shouldStop() || depth <= 0) {
      return null;
    }

    const immediate = collectImmediateWins(context, attacker, 1);
    if (immediate.count > 0) {
      return { ...immediate.wins[0], score: WIN_SCORE };
    }

    const defender = opponent(attacker);
    const candidates = generateCandidates(context, attacker, null).slice(
      0,
      Math.min(context.config.candidateLimit, 18),
    );

    for (const candidate of candidates) {
      if (context.shouldStop()) {
        return null;
      }

      let found = false;
      context.makeMove(candidate.row, candidate.col, attacker);

      if (ResultJudge.check(context.board, candidate.row, candidate.col, attacker) === attacker) {
        found = true;
      } else if (collectImmediateWins(context, defender, 1).count === 0) {
        const threats = collectImmediateWins(context, attacker, 2);
        if (threats.count >= 2) {
          found = true;
        } else if (threats.count === 1 && depth > 1) {
          const block = threats.wins[0];
          if (!isLegalMove(context, block.row, block.col, defender)) {
            found = true;
          } else {
            context.makeMove(block.row, block.col, defender);
            found = Boolean(findVcfWin(context, attacker, depth - 2));
            context.unmakeMove(block.row, block.col);
          }
        }
      }

      context.unmakeMove(candidate.row, candidate.col);
      if (found) {
        return { ...candidate, score: WIN_SCORE / 2 };
      }
    }

    return null;
  }

  function findVcfDefenseMove(context, player, depth) {
    const rival = opponent(player);
    if (depth <= 0 || !findVcfWin(context, rival, depth) || context.timedOut) {
      return null;
    }

    const candidates = generateCandidates(context, player, null).slice(
      0,
      Math.min(context.config.candidateLimit, 24),
    );
    let best = null;
    let bestScore = -INF_SCORE;

    for (const candidate of candidates) {
      let safe = false;
      context.makeMove(candidate.row, candidate.col, player);
      if (ResultJudge.check(context.board, candidate.row, candidate.col, player) === player) {
        safe = true;
      } else if (collectImmediateWins(context, rival, 2).count === 0 && !findVcfWin(context, rival, depth)) {
        safe = true;
      }
      context.unmakeMove(candidate.row, candidate.col);

      if (context.timedOut) {
        break;
      }
      if (safe && candidate.score > bestScore) {
        best = { ...candidate, score: FOUR_SCORE + Math.floor(candidate.score / 1024) };
        bestScore = candidate.score;
      }
    }

    return best;
  }

  function immediateWinDanger(context, defender, attacker) {
    const wins = collectImmediateWins(context, attacker, 2);
    if (wins.count >= 2) {
      return 2;
    }
    if (wins.count === 1) {
      return cachedIsLegalMove(context, wins.wins[0].row, wins.wins[0].col, defender) ? 1 : 2;
    }
    return 0;
  }

  function opponentForkSourceCount(context, player, maxCount) {
    const rival = opponent(player);
    let count = 0;
    const limit = Math.max(0, maxCount);

    for (let row = 0; row < SIZE; row++) {
      for (let col = 0; col < SIZE; col++) {
        if (context.shouldStop()) {
          return count;
        }
        if (
          context.board.get(row, col) !== EMPTY ||
          !cachedHasNeighbor(context, row, col, 2) ||
          !cachedIsLegalMove(context, row, col, rival)
        ) {
          continue;
        }

        let danger = 0;
        context.makeMove(row, col, rival);
        if (ResultJudge.check(context.board, row, col, rival) !== rival) {
          danger = immediateWinDanger(context, player, rival);
        }
        context.unmakeMove(row, col);

        if (context.timedOut) {
          return count;
        }
        if (danger >= 2) {
          count++;
          if (count >= limit) {
            return count;
          }
        }
      }
    }

    return count;
  }

  function markDirectDefense(context, player, coverage, severityMap, orderMap, orderBox, severity, row, col) {
    if (!cachedIsLegalMove(context, row, col, player)) {
      return;
    }
    const idx = context.board.index(row, col);
    if (coverage[idx] === 0) {
      orderMap[idx] = orderBox.value++;
    }
    coverage[idx]++;
    severityMap[idx] = Math.max(severityMap[idx], severity);
  }

  function findDirectDoubleThreatBlock(context, player) {
    const rival = opponent(player);
    const coverage = new Int16Array(MAX_MOVES);
    const severityMap = new Int16Array(MAX_MOVES);
    const orderMap = new Int16Array(MAX_MOVES);
    const orderBox = { value: 1 };

    for (let row = 0; row < SIZE; row++) {
      for (let col = 0; col < SIZE; col++) {
        if (
          context.board.get(row, col) !== EMPTY ||
          !cachedHasNeighbor(context, row, col, 2) ||
          !cachedIsLegalMove(context, row, col, rival)
        ) {
          continue;
        }

        let wins = { count: 0, wins: [] };
        let singleUnblockable = false;
        context.makeMove(row, col, rival);
        if (ResultJudge.check(context.board, row, col, rival) !== rival) {
          wins = collectImmediateWins(context, rival, 2);
          singleUnblockable =
            wins.count === 1 && !cachedIsLegalMove(context, wins.wins[0].row, wins.wins[0].col, player);
        }
        context.unmakeMove(row, col);

        if (context.timedOut) {
          return null;
        }

        if (wins.count >= 2) {
          const sourceSeverity = 3;
          markDirectDefense(context, player, coverage, severityMap, orderMap, orderBox, sourceSeverity, row, col);
          for (const win of wins.wins) {
            markDirectDefense(context, player, coverage, severityMap, orderMap, orderBox, 2, win.row, win.col);
          }
        } else if (singleUnblockable) {
          markDirectDefense(context, player, coverage, severityMap, orderMap, orderBox, 3, row, col);
          markDirectDefense(context, player, coverage, severityMap, orderMap, orderBox, 3, wins.wins[0].row, wins.wins[0].col);
        }
      }
    }

    let best = null;
    let bestScore = -INF_SCORE;
    let bestSeverity = 0;
    let bestCoverage = 0;
    let bestDangerAfter = INF_SCORE;
    let bestSourceCountAfter = INF_SCORE;
    let bestOrder = MAX_MOVES + 1;

    for (let row = 0; row < SIZE; row++) {
      for (let col = 0; col < SIZE; col++) {
        const idx = context.board.index(row, col);
        if (coverage[idx] === 0) {
          continue;
        }

        let dangerAfter = 0;
        let sourceCountAfter = 0;
        context.makeMove(row, col, player);
        if (ResultJudge.check(context.board, row, col, player) !== player) {
          dangerAfter = opponentForkDanger(context, player);
          sourceCountAfter = opponentForkSourceCount(context, player, bestSourceCountAfter + 1);
        }
        context.unmakeMove(row, col);

        if (context.timedOut) {
          return best;
        }

        const score = cachedMovePriority(context, row, col, player);
        let better = false;
        if (!best || dangerAfter < bestDangerAfter) {
          better = true;
        } else if (dangerAfter === bestDangerAfter) {
          if (sourceCountAfter < bestSourceCountAfter) {
            better = true;
          } else if (sourceCountAfter === bestSourceCountAfter && severityMap[idx] > bestSeverity) {
            better = true;
          } else if (sourceCountAfter === bestSourceCountAfter && severityMap[idx] === bestSeverity) {
            if (coverage[idx] > bestCoverage) {
              better = true;
            } else if (coverage[idx] === bestCoverage && severityMap[idx] < 3 && score > bestScore) {
              better = true;
            } else if (coverage[idx] === bestCoverage && severityMap[idx] >= 3 && orderMap[idx] < bestOrder) {
              better = true;
            }
          }
        }

        if (better) {
          best = {
            row,
            col,
            score: FOUR_SCORE + Math.floor(score / 1024),
            threat: cachedThreatLevel(context, row, col, player),
          };
          bestScore = score;
          bestSeverity = severityMap[idx];
          bestCoverage = coverage[idx];
          bestDangerAfter = dangerAfter;
          bestSourceCountAfter = sourceCountAfter;
          bestOrder = orderMap[idx];
        }
      }
    }

    return best;
  }

  function findOpponentForkPointBlock(context, player) {
    const baselineCount = opponentForkSourceCount(context, player, MAX_MOVES);
    if (context.timedOut || baselineCount <= 0) {
      return null;
    }

    let best = null;
    let bestRemaining = baselineCount;
    let bestScore = -INF_SCORE;

    for (let row = 0; row < SIZE; row++) {
      for (let col = 0; col < SIZE; col++) {
        if (context.shouldStop()) {
          return best;
        }
        if (
          context.board.get(row, col) !== EMPTY ||
          !cachedHasNeighbor(context, row, col, 2) ||
          !cachedIsLegalMove(context, row, col, player)
        ) {
          continue;
        }

        let remaining = 0;
        context.makeMove(row, col, player);
        if (ResultJudge.check(context.board, row, col, player) !== player) {
          remaining = opponentForkSourceCount(context, player, bestRemaining + 1);
        }
        context.unmakeMove(row, col);

        if (context.timedOut) {
          return best;
        }

        const score = cachedMovePriority(context, row, col, player);
        if (remaining < bestRemaining || (remaining === bestRemaining && score > bestScore)) {
          best = {
            row,
            col,
            score: FOUR_SCORE + Math.floor(score / 1024),
            threat: cachedThreatLevel(context, row, col, player),
          };
          bestRemaining = remaining;
          bestScore = score;
        }
      }
    }

    return best && bestRemaining < baselineCount ? best : null;
  }

  function opponentForkDanger(context, player) {
    const rival = opponent(player);
    let danger = immediateWinDanger(context, player, rival);
    if (danger >= 2) {
      return danger;
    }

    const candidates = generateCandidates(context, rival, null, 1);
    const candidateLimit = Math.min(candidates.length, 128);
    for (let i = 0; i < candidateLimit; i++) {
      const candidate = candidates[i];
      let winCount = 0;
      context.makeMove(candidate.row, candidate.col, rival);
      if (ResultJudge.check(context.board, candidate.row, candidate.col, rival) === rival) {
        winCount = 3;
      } else {
        winCount = immediateWinDanger(context, player, rival);
      }
      context.unmakeMove(candidate.row, candidate.col);

      if (context.timedOut) {
        return danger;
      }
      if (winCount > danger) {
        danger = winCount;
        if (danger >= 2) {
          return danger;
        }
      }
    }

    return danger;
  }

  function findForkDefenseMove(context, player) {
    const baselineDanger = opponentForkDanger(context, player);
    if (context.timedOut || baselineDanger < 2) {
      return null;
    }

    const candidates = generateCandidates(context, player, null);
    let best = null;
    let bestDanger = baselineDanger;
    let bestScore = -INF_SCORE;

    for (const candidate of candidates) {
      let danger = 0;
      context.makeMove(candidate.row, candidate.col, player);
      if (ResultJudge.check(context.board, candidate.row, candidate.col, player) !== player) {
        danger = opponentForkDanger(context, player);
      }
      context.unmakeMove(candidate.row, candidate.col);

      if (context.timedOut) {
        break;
      }
      if (danger < bestDanger || (danger === bestDanger && candidate.score > bestScore)) {
        best = { ...candidate, score: FOUR_SCORE + Math.floor(candidate.score / 1024) };
        bestDanger = danger;
        bestScore = candidate.score;
      }
    }

    return best && bestDanger < baselineDanger ? best : null;
  }

  function moveAllowsOpponentVcf(context, player, defenseMove, depth) {
    if (depth <= 0 || !defenseMove) {
      return false;
    }
    const rival = opponent(player);
    let unsafe = false;
    context.makeMove(defenseMove.row, defenseMove.col, player);
    if (ResultJudge.check(context.board, defenseMove.row, defenseMove.col, player) !== player) {
      unsafe = Boolean(findVcfWin(context, rival, depth));
    }
    context.unmakeMove(defenseMove.row, defenseMove.col);
    return unsafe;
  }

  function remainingForkSourcesAfterMove(context, player, move, maxCount) {
    let remaining = 0;
    context.makeMove(move.row, move.col, player);
    if (ResultJudge.check(context.board, move.row, move.col, player) !== player) {
      remaining = opponentForkSourceCount(context, player, maxCount);
    }
    context.unmakeMove(move.row, move.col);
    return remaining;
  }

  function guardRootMoveAgainstVcf(context, player, tacticalMove) {
    if (
      context.config.vcfDepth <= 0 ||
      !moveAllowsOpponentVcf(context, player, tacticalMove, context.config.vcfDepth)
    ) {
      return tacticalMove;
    }

    const currentSources = remainingForkSourcesAfterMove(context, player, tacticalMove, MAX_MOVES);
    if (context.timedOut) {
      return tacticalMove;
    }

    const vcfDefense = findVcfDefenseMove(context, player, context.config.vcfDepth);
    if (!vcfDefense || context.timedOut) {
      return null;
    }

    const replacementSources = remainingForkSourcesAfterMove(context, player, vcfDefense, currentSources + 1);
    return !context.timedOut && replacementSources <= currentSources ? vcfDefense : null;
  }

  function moveCreatesImmediateDoubleWin(context, player, move) {
    const rival = opponent(player);
    let danger = 0;
    context.makeMove(move.row, move.col, player);
    if (ResultJudge.check(context.board, move.row, move.col, player) === player) {
      danger = 2;
    } else {
      danger = immediateWinDanger(context, rival, player);
    }
    context.unmakeMove(move.row, move.col);
    return danger >= 2;
  }

  function moveLeavesOpponentFork(context, player, move) {
    let opponentFork = false;
    let ownDoubleWin = false;
    context.makeMove(move.row, move.col, player);
    if (ResultJudge.check(context.board, move.row, move.col, player) === player) {
      context.unmakeMove(move.row, move.col);
      return false;
    }

    ownDoubleWin = immediateWinDanger(context, opponent(player), player) >= 2;
    opponentFork = opponentForkDanger(context, player) >= 2;
    context.unmakeMove(move.row, move.col);
    return opponentFork && !ownDoubleWin;
  }

  function findRootForcingThreatMove(context, player) {
    const candidates = generateCandidates(context, player, null);
    let best = null;
    let bestThreat = THREAT_QUIET;
    let bestScore = -INF_SCORE;

    for (const candidate of candidates) {
      const profile = cachedMoveProfile(context, candidate.row, candidate.col, player);
      const threat = profileThreatLevel(profile, player);
      if (!isForcingAttackProfile(profile, player)) {
        continue;
      }
      if (threat > bestThreat || (threat === bestThreat && candidate.score > bestScore)) {
        best = { ...candidate, score: WIN_SCORE / 3 + Math.floor(candidate.score / 1024), threat };
        bestThreat = threat;
        bestScore = candidate.score;
      }
    }

    return best;
  }

  function findRootLiveThreatBlock(context, player) {
    const rival = opponent(player);
    let best = null;
    let bestThreat = THREAT_QUIET;
    let bestDangerAfter = INF_SCORE;
    let bestScore = -INF_SCORE;

    for (let row = 0; row < SIZE; row++) {
      for (let col = 0; col < SIZE; col++) {
        if (
          context.board.get(row, col) !== EMPTY ||
          !cachedHasNeighbor(context, row, col, 2) ||
          !cachedIsLegalMove(context, row, col, player) ||
          !cachedIsLegalMove(context, row, col, rival)
        ) {
          continue;
        }

        const rivalProfile = cachedMoveProfile(context, row, col, rival);
        const rivalThreat = profileThreatLevel(rivalProfile, rival);
        if (rivalProfile.openFour === 0 && !isForcingAttackProfile(rivalProfile, rival)) {
          continue;
        }

        context.makeMove(row, col, player);
        const dangerAfter = immediateWinDanger(context, player, rival);
        context.unmakeMove(row, col);

        if (context.timedOut) {
          return best;
        }
        if (dangerAfter >= 2 && best) {
          continue;
        }

        const score = cachedMovePriority(context, row, col, player);
        if (
          !best ||
          dangerAfter < bestDangerAfter ||
          (dangerAfter === bestDangerAfter && rivalThreat > bestThreat) ||
          (dangerAfter === bestDangerAfter && rivalThreat === bestThreat && score > bestScore)
        ) {
          best = {
            row,
            col,
            score: FOUR_SCORE + Math.floor(score / 1024),
            threat: cachedThreatLevel(context, row, col, player),
          };
          bestThreat = rivalThreat;
          bestDangerAfter = dangerAfter;
          bestScore = score;
        }
      }
    }

    return best;
  }

  function findResidualThreatDefenseRootMove(context, player) {
    const rival = opponent(player);
    const baseline = buildResidualThreatMaterial(context, rival);
    if (context.timedOut || !isUrgentResidualMaterial(baseline)) {
      return null;
    }

    const candidates = generateCandidates(context, player, null).slice(
      0,
      Math.min(RESIDUAL_DEFENSE_CANDIDATES, context.config.candidateLimit, 48),
    );
    let best = null;
    let bestMaterial = baseline;
    let bestCounter = -1;
    let bestScore = -INF_SCORE;

    for (const candidate of candidates) {
      if (context.shouldStop()) {
        return best;
      }

      let material = null;
      let counter = 0;
      context.makeMove(candidate.row, candidate.col, player);
      if (ResultJudge.check(context.board, candidate.row, candidate.col, player) === player) {
        material = emptyResidualThreatMaterial(-WIN_SCORE);
        counter = 2;
      } else {
        counter = immediateWinDanger(context, rival, player);
        material = buildResidualThreatMaterial(context, rival, bestMaterial.score);
      }
      context.unmakeMove(candidate.row, candidate.col);

      if (context.timedOut) {
        return best;
      }
      if (!residualMaterialImproves(baseline, material) && counter < 2) {
        continue;
      }
      if (
        !best ||
        residualMaterialBetter(material, bestMaterial) ||
        (residualMaterialEqual(material, bestMaterial) && counter > bestCounter) ||
        (residualMaterialEqual(material, bestMaterial) && counter === bestCounter && candidate.score > bestScore)
      ) {
        best = {
          ...candidate,
          score: OPEN_FOUR_SCORE + Math.floor(candidate.score / 1024) - Math.floor(material.score / 4096),
        };
        bestMaterial = material;
        bestCounter = counter;
        bestScore = candidate.score;
      }
    }

    return best && (residualMaterialImproves(baseline, bestMaterial) || bestCounter >= 2) ? best : null;
  }

  function emptyResidualThreatMaterial(score = 0) {
    return {
      score,
      c5: 0,
      openFour: 0,
      four: 0,
      b4f3: 0,
      openThree: 0,
      doubleC5Followup: 0,
      singleC5Followup: 0,
      forcing: 0,
    };
  }

  function buildResidualThreatMaterial(context, attacker, scoreCap = INF_SCORE) {
    const defender = opponent(attacker);
    const material = emptyResidualThreatMaterial();
    let scannedForcing = 0;

    for (let row = 0; row < SIZE; row++) {
      for (let col = 0; col < SIZE; col++) {
        if (context.shouldStop()) {
          return material;
        }
        if (
          context.board.get(row, col) !== EMPTY ||
          !cachedHasNeighbor(context, row, col, 2) ||
          !cachedIsLegalMove(context, row, col, attacker)
        ) {
          continue;
        }

        const profile = cachedMoveProfile(context, row, col, attacker);
        const fourCount = profileFourCount(profile);
        const b4f3 = fourCount > 0 && (profile?.openThree || 0) > 0;
        const forcing =
          profile?.win ||
          (profile?.openFour || 0) > 0 ||
          fourCount > 0 ||
          (profile?.openThree || 0) > 0 ||
          (profile?.three || 0) > 0;
        if (!forcing) {
          continue;
        }

        scannedForcing++;
        material.forcing++;
        if (profile.win) {
          material.c5++;
          material.score += WIN_SCORE / 2;
        }
        if ((profile?.openFour || 0) > 0) {
          material.openFour += profile.openFour;
          material.score += profile.openFour * OPEN_FOUR_SCORE * 4;
        }
        if (b4f3) {
          material.b4f3++;
          material.score += OPEN_FOUR_SCORE * 3;
        }
        if (fourCount > 0) {
          material.four += fourCount;
          material.score += fourCount * FOUR_SCORE * 2;
        }
        if ((profile?.openThree || 0) > 0) {
          material.openThree += profile.openThree;
          material.score += profile.openThree * OPEN_THREE_SCORE;
        }

        if (!profile.win && (fourCount > 0 || (profile?.openFour || 0) > 0 || (profile?.openThree || 0) > 0)) {
          context.makeMove(row, col, attacker);
          if (ResultJudge.check(context.board, row, col, attacker) !== attacker) {
            const danger = immediateWinDanger(context, defender, attacker);
            if (danger >= 2) {
              material.doubleC5Followup++;
              material.score += OPEN_FOUR_SCORE * 8;
            } else if (danger === 1) {
              material.singleC5Followup++;
              material.score += OPEN_FOUR_SCORE * 2;
            }
          }
          context.unmakeMove(row, col);
        }

        if (material.score >= scoreCap || scannedForcing >= RESIDUAL_MATERIAL_SCAN_LIMIT) {
          return material;
        }
      }
    }

    return material;
  }

  function isUrgentResidualMaterial(material) {
    return (
      material.c5 > 0 ||
      material.openFour > 0 ||
      material.doubleC5Followup > 0 ||
      material.b4f3 > 0 ||
      material.four >= 2 ||
      material.openThree >= 2
    );
  }

  function residualMaterialImproves(before, after) {
    return residualMaterialBetter(after, before);
  }

  function residualMaterialBetter(a, b) {
    if (a.score !== b.score) {
      return a.score < b.score;
    }
    for (const key of ["c5", "doubleC5Followup", "singleC5Followup", "openFour", "b4f3", "four", "openThree", "forcing"]) {
      if (a[key] !== b[key]) {
        return a[key] < b[key];
      }
    }
    return false;
  }

  function residualMaterialEqual(a, b) {
    return (
      a.score === b.score &&
      a.c5 === b.c5 &&
      a.doubleC5Followup === b.doubleC5Followup &&
      a.singleC5Followup === b.singleC5Followup &&
      a.openFour === b.openFour &&
      a.b4f3 === b.b4f3 &&
      a.four === b.four &&
      a.openThree === b.openThree &&
      a.forcing === b.forcing
    );
  }

  function threatQuiescence(context, player, alpha, beta, ply, qdepth) {
    context.nodes++;
    if (context.shouldStop()) {
      return evaluateBoard(context.board, player);
    }

    if (collectImmediateWins(context, player, 1).count > 0) {
      return WIN_SCORE - ply;
    }

    const rival = opponent(player);
    const opponentWins = collectImmediateWins(context, rival, 2);
    let forcedCandidates = [];
    if (opponentWins.count >= 2) {
      return -WIN_SCORE + ply;
    }
    if (opponentWins.count === 1) {
      const block = makeBlockCandidate(context, player, opponentWins.wins[0]);
      if (!block) {
        return -WIN_SCORE + ply;
      }
      forcedCandidates = [block];
    }

    const standPat = evaluateBoard(context.board, player);
    if (standPat >= beta) {
      return beta;
    }
    if (standPat > alpha) {
      alpha = standPat;
    }
    if (qdepth <= 0) {
      return alpha;
    }

    const candidates =
      forcedCandidates.length > 0
        ? forcedCandidates
        : generateCandidates(context, player, null).slice(0, QSEARCH_CANDIDATE_LIMIT);
    let searched = 0;
    for (const candidate of candidates) {
      if (forcedCandidates.length === 0 && candidate.threat < THREAT_OPEN_THREE) {
        continue;
      }
      if (searched >= QSEARCH_CANDIDATE_LIMIT) {
        break;
      }

      let score;
      context.makeMove(candidate.row, candidate.col, player);
      if (ResultJudge.check(context.board, candidate.row, candidate.col, player) === player) {
        score = WIN_SCORE - ply;
      } else {
        score = -threatQuiescence(context, rival, -beta, -alpha, ply + 1, qdepth - 1);
      }
      context.unmakeMove(candidate.row, candidate.col);

      if (context.timedOut) {
        return alpha;
      }

      searched++;
      if (score >= beta) {
        recordCutoff(context, player, candidate.row, candidate.col, 1, ply);
        return beta;
      }
      if (score > alpha) {
        alpha = score;
      }
    }
    return alpha;
  }

  function negamax(context, player, depth, alpha, beta, key, lastRow, lastCol, ply, extensionLeft) {
    context.nodes++;
    if (context.shouldStop()) {
      return evaluateBoard(context.board, player);
    }

    const lastPlayer = opponent(player);
    if (lastRow >= 0 && ResultJudge.check(context.board, lastRow, lastCol, lastPlayer) === lastPlayer) {
      return -WIN_SCORE + ply;
    }

    if (collectImmediateWins(context, player, 1).count > 0) {
      return WIN_SCORE - ply;
    }

    let candidates = [];
    let candidateLimit = context.config.candidateLimit;
    let forcedSingleDefense = false;
    const opponentWins = collectImmediateWins(context, lastPlayer, 2);
    if (opponentWins.count >= 2) {
      return -WIN_SCORE + ply;
    }
    if (opponentWins.count === 1) {
      const block = makeBlockCandidate(context, player, opponentWins.wins[0]);
      if (!block) {
        return -WIN_SCORE + ply;
      }
      candidates = [block];
      candidateLimit = 1;
      forcedSingleDefense = true;
    }

    if (candidates.length === 0) {
      if (depth <= 0) {
        const qdepth = effectiveQsearchDepth(context, ply);
        return qdepth > 0 ? threatQuiescence(context, player, alpha, beta, ply, qdepth) : evaluateBoard(context.board, player);
      }

      const entry = lookupTransposition(context, player, key, depth, alpha, beta);
      if (entry.hit) {
        return entry.score;
      }

      candidates = generateCandidates(context, player, entry.best, ply);
      if (candidates.length === 0) {
        return 0;
      }
      candidateLimit = adaptiveCandidateLimit(context, candidates, candidateLimit, depth, ply);
    }

    const originalAlpha = alpha;
    let bestScore = -INF_SCORE;
    let bestMove = null;

    for (let i = 0; i < candidateLimit; i++) {
      const move = candidates[i];
      const extension =
        extensionLeft > 0 && depth <= THREAT_EXTENSION_DEPTH && move.threat >= THREAT_FOUR ? 1 : 0;
      const nextDepth = depth - 1 + extension;
      const preserveForcedDefenseBudget = forcedSingleDefense && usesDeepLabSearch(context);
      const childExtensionLeft = extension && !preserveForcedDefenseBudget ? extensionLeft - 1 : extensionLeft;
      const childKey =
        (key ^
          context.sideKey ^
          context.zobrist.table[playerIndex(player)][context.board.index(move.row, move.col)]) >>>
        0;
      let reducedDepth = nextDepth;
      let score;

      context.makeMove(move.row, move.col, player);
      if (ResultJudge.check(context.board, move.row, move.col, player) === player) {
        score = WIN_SCORE - ply;
      } else if (i === 0) {
        score = -negamax(
          context,
          opponent(player),
          nextDepth,
          -beta,
          -alpha,
          childKey,
          move.row,
          move.col,
          ply + 1,
          childExtensionLeft,
        );
      } else {
        if (depth >= 4 && i >= 4 && move.threat < THREAT_OPEN_THREE) {
          reducedDepth = Math.max(0, nextDepth - 1);
        }
        score = -negamax(
          context,
          opponent(player),
          reducedDepth,
          -alpha - 1,
          -alpha,
          childKey,
          move.row,
          move.col,
          ply + 1,
          childExtensionLeft,
        );
        if (!context.timedOut && reducedDepth < nextDepth && score > alpha) {
          score = -negamax(
            context,
            opponent(player),
            nextDepth,
            -alpha - 1,
            -alpha,
            childKey,
            move.row,
            move.col,
            ply + 1,
            childExtensionLeft,
          );
        }
        if (!context.timedOut && score > alpha && score < beta) {
          score = -negamax(
            context,
            opponent(player),
            nextDepth,
            -beta,
            -alpha,
            childKey,
            move.row,
            move.col,
            ply + 1,
            childExtensionLeft,
          );
        }
      }
      context.unmakeMove(move.row, move.col);

      if (context.timedOut) {
        return evaluateBoard(context.board, player);
      }

      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
      if (score > alpha) {
        alpha = score;
      }
      if (alpha >= beta) {
        recordCutoff(context, player, move.row, move.col, depth, ply);
        break;
      }
    }

    let flag = "EXACT";
    if (bestScore <= originalAlpha) {
      flag = "UPPER";
    } else if (bestScore >= beta) {
      flag = "LOWER";
    }
    storeTransposition(context, player, key, depth, bestScore, flag, bestMove);
    return bestScore;
  }

  function lookupTransposition(context, player, key, depth, alpha, beta) {
    context.ttStats.probes++;
    const canonical = context.config.symmetryTT ? context.canonicalHash(player) : { key: key >>> 0, transform: 0, inverse: 0 };
    const entry = context.tt.get(ttKey(context, canonical.key));
    if (!entry) {
      return { hit: false, best: null, score: 0 };
    }
    entry.age = context.cache.generation;
    context.ttStats.hits++;
    if (canonical.transform !== 0) {
      context.ttStats.canonicalHits++;
    }
    const best = entry.move ? transformMove(entry.move, canonical.inverse) : null;
    if (entry.depth < depth) {
      return { hit: false, best, score: 0 };
    }
    if (entry.flag === "EXACT") {
      context.ttStats.cutoffs++;
      return { hit: true, best, score: entry.score };
    }
    if (entry.flag === "LOWER" && entry.score >= beta) {
      context.ttStats.cutoffs++;
      return { hit: true, best, score: entry.score };
    }
    if (entry.flag === "UPPER" && entry.score <= alpha) {
      context.ttStats.cutoffs++;
      return { hit: true, best, score: entry.score };
    }
    return { hit: false, best, score: 0 };
  }

  function storeTransposition(context, player, key, depth, score, flag, move) {
    if (!move) {
      return;
    }
    const canonical = context.config.symmetryTT ? context.canonicalHash(player) : { key: key >>> 0, transform: 0 };
    const keyText = ttKey(context, canonical.key);
    const previous = context.tt.get(keyText);
    if (previous && previous.depth > depth) {
      return;
    }
    const canonicalMove = transformMove(move, canonical.transform);
    context.tt.set(keyText, {
      depth,
      score,
      flag,
      move: { row: canonicalMove.row, col: canonicalMove.col },
      age: context.cache.generation,
    });
    if (context.tt.size > TT_CACHE_LIMIT) {
      context.cache.trimTranspositions();
    }
  }

  function ttKey(context, key) {
    return `${context.ttPrefix}:${key >>> 0}`;
  }

  function generateCandidates(context, player, ttMove, ply = 0) {
    if (context.stoneCount === 0) {
      return [{ row: 7, col: 7, score: WIN_SCORE, threat: THREAT_QUIET }];
    }

    let staticCandidates = null;
    const choiceKey = shouldUseChoiceCache(context, ply) ? choiceCacheKey(context, player) : "";
    if (choiceKey) {
      context.choiceCacheStats.probes++;
      staticCandidates = context.cache.getChoice(choiceKey);
      if (staticCandidates) {
        context.choiceCacheStats.hits++;
      }
    }
    if (!staticCandidates) {
      staticCandidates = buildStaticCandidates(context, player, Boolean(choiceKey));
      if (choiceKey) {
        context.cache.storeChoice(choiceKey, staticCandidates);
        context.choiceCacheStats.stores++;
      }
    }

    const candidates = materializeCandidates(context, player, staticCandidates, ttMove, ply);
    candidates.sort(compareCandidates);
    return candidates.slice(0, 128);
  }

  function shouldUseChoiceCache(context, ply) {
    return (
      usesDeepLabSearch(context) &&
      ply > 0 &&
      context.config.maxDepth >= CHOICE_CACHE_MIN_DEPTH &&
      context.config.candidateLimit >= CHOICE_CACHE_MIN_WIDTH &&
      context.config.timeLimitMs >= 1000
    );
  }

  function choiceCacheKey(context, player) {
    const side = player === WHITE ? context.sideKey : 0;
    const key = (context.symmetryHashes[0] ^ side) >>> 0;
    return `${context.ttPrefix}:choice:${player}:${key}`;
  }

  function buildStaticCandidates(context, player, keepFullPool = false) {
    const candidates = [];
    for (let row = 0; row < SIZE; row++) {
      for (let col = 0; col < SIZE; col++) {
        if (
          context.board.get(row, col) !== EMPTY ||
          !cachedHasNeighbor(context, row, col, 2) ||
          !cachedIsLegalMove(context, row, col, player)
        ) {
          continue;
        }
        const threat = cachedThreatLevel(context, row, col, player);
        let score = cachedMovePriority(context, row, col, player);
        score += threatBonus(threat);
        score += stableNoise(candidateOrderingSeed(context), row, col, player);
        candidates.push({ row, col, score, baseScore: score, threat, prior: candidatePrior(row, col, threat) });
      }
    }

    if (candidates.length === 0) {
      for (let row = 0; row < SIZE; row++) {
        for (let col = 0; col < SIZE; col++) {
          if (context.board.get(row, col) === EMPTY && cachedIsLegalMove(context, row, col, player)) {
            const score = centerBonus(row, col);
            candidates.push({ row, col, score, baseScore: score, threat: THREAT_QUIET, prior: candidatePrior(row, col, THREAT_QUIET) });
          }
        }
      }
    }

    candidates.sort(compareCandidates);
    return keepFullPool ? candidates : candidates.slice(0, 128);
  }

  function materializeCandidates(context, player, staticCandidates, ttMove, ply) {
    return staticCandidates.map((candidate) => {
      let score = candidate.baseScore ?? candidate.score;
      score += searchHeuristicBonus(context, player, candidate.row, candidate.col, ply);
      if (ttMove && ttMove.row === candidate.row && ttMove.col === candidate.col) {
        score += WIN_SCORE / 4;
      }
      return {
        ...candidate,
        score,
      };
    });
  }

  function candidatePrior(row, col, threat) {
    return threat * 1000 + centerBonus(row, col);
  }

  function candidateOrderingSeed(context) {
    return usesLabStrongEngine(context)
      ? String(context.config.seed || "").replaceAll(LAB_STRONG_VERSION, "v4-source-guard")
      : context.config.seed;
  }

  function collectImmediateWins(context, player, maxWins) {
    const wins = [];
    let count = 0;
    for (let row = 0; row < SIZE; row++) {
      for (let col = 0; col < SIZE; col++) {
        if (!isWinningMove(context, row, col, player)) {
          continue;
        }
        if (wins.length < maxWins) {
          wins.push({ row, col, score: cachedMovePriority(context, row, col, player), threat: THREAT_WIN });
        }
        count++;
        if (count >= maxWins) {
          return { count, wins };
        }
      }
    }
    return { count, wins };
  }

  function isWinningMove(context, row, col, player) {
    if (
      context.board.get(row, col) !== EMPTY ||
      !cachedHasNeighbor(context, row, col, 1) ||
      !cachedIsLegalMove(context, row, col, player)
    ) {
      return false;
    }
    const key = cacheKey(context, "win", player, row, col);
    if (!context.winningCache.has(key)) {
      context.board.set(row, col, player);
      context.winningCache.set(key, ResultJudge.check(context.board, row, col, player) === player);
      context.board.set(row, col, EMPTY);
    }
    return context.winningCache.get(key);
  }

  function makeBlockCandidate(context, player, threat) {
    if (!cachedIsLegalMove(context, threat.row, threat.col, player)) {
      return null;
    }
    return {
      row: threat.row,
      col: threat.col,
      score: WIN_SCORE / 3 + cachedMovePriority(context, threat.row, threat.col, player),
      threat: cachedThreatLevel(context, threat.row, threat.col, player),
    };
  }

  function isLegalMove(context, row, col, player) {
    return cachedIsLegalMove(context, row, col, player);
  }

  function cachedHasNeighbor(context, row, col, radius) {
    const idx = context.board.index(row, col);
    if (radius <= 1) {
      return context.neighbor1[idx] > 0;
    }
    if (radius <= 2) {
      return context.neighbor2[idx] > 0;
    }
    return hasNeighbor(context.board, row, col, radius);
  }

  function cachedIsLegalMove(context, row, col, player) {
    if (!context.board.inside(row, col) || context.board.get(row, col) !== EMPTY) {
      return false;
    }
    const key = cacheKey(context, "legal", player, row, col);
    if (!context.legalCache.has(key)) {
      context.legalCache.set(key, Rules.checkMove(context.board, row, col, player).ok);
    }
    return context.legalCache.get(key);
  }

  function cachedMoveShapeScore(context, row, col, player) {
    const key = cacheKey(context, "shape", player, row, col);
    if (!context.shapeCache.has(key)) {
      context.shapeCache.set(key, moveShapeScore(context.board, row, col, player));
    }
    return context.shapeCache.get(key);
  }

  function cachedMoveProfile(context, row, col, player) {
    const key = cacheKey(context, "profile", player, row, col);
    if (!context.profileCache.has(key)) {
      const profile = moveShapeProfile(context.board, row, col, player);
      context.profileCache.set(key, profile);
      context.shapeCache.set(cacheKey(context, "shape", player, row, col), profile.score);
    }
    return context.profileCache.get(key);
  }

  function cachedThreatLevel(context, row, col, player) {
    const attack = shapeThreatLevel(cachedMoveShapeScore(context, row, col, player));
    const defense = shapeThreatLevel(cachedMoveShapeScore(context, row, col, opponent(player)));
    return Math.max(attack, defense);
  }

  function cachedMovePriority(context, row, col, player) {
    const key = cacheKey(context, "priority", player, row, col);
    if (!context.priorityCache.has(key)) {
      const attack = cachedMoveShapeScore(context, row, col, player);
      const defense = cachedMoveShapeScore(context, row, col, opponent(player));
      let score = attack * 2 + Math.floor((defense * 3) / 2) + centerBonus(row, col);
      if (attack >= WIN_SCORE) {
        score += WIN_SCORE / 2;
      }
      if (defense >= WIN_SCORE) {
        score += WIN_SCORE / 3;
      }
      context.priorityCache.set(key, score);
    }
    return context.priorityCache.get(key);
  }

  function profileFourCount(profile) {
    return (profile?.openFour || 0) + (profile?.four || 0);
  }

  function profileThreatLevel(profile, player) {
    const fourCount = profileFourCount(profile);
    if (profile?.win) {
      return THREAT_WIN;
    }
    if ((profile?.openFour || 0) > 0 && (profile?.openThree || 0) > 0) {
      return THREAT_OPEN_FOUR;
    }
    if (fourCount >= 2) {
      return THREAT_OPEN_FOUR;
    }
    if ((profile?.openFour || 0) > 0) {
      return THREAT_OPEN_FOUR;
    }
    if ((profile?.four || 0) > 0) {
      return THREAT_FOUR;
    }
    if ((profile?.openThree || 0) >= 2 && player === WHITE) {
      return THREAT_FOUR;
    }
    if ((profile?.openThree || 0) > 0) {
      return THREAT_OPEN_THREE;
    }
    if ((profile?.three || 0) > 0) {
      return THREAT_THREE;
    }
    return THREAT_QUIET;
  }

  function isForcingAttackProfile(profile, player) {
    if (profile?.win) {
      return true;
    }
    if (player === BLACK) {
      return (profile?.openFour || 0) > 0 && (profile?.openThree || 0) > 0;
    }
    return (
      (profile?.openFour || 0) > 0 ||
      profileFourCount(profile) >= 2 ||
      ((profile?.four || 0) > 0 && (profile?.openThree || 0) > 0) ||
      (profile?.openThree || 0) >= 2
    );
  }

  function shapeThreatLevel(score) {
    if (score >= WIN_SCORE) {
      return THREAT_WIN;
    }
    if (score >= OPEN_FOUR_SCORE) {
      return THREAT_OPEN_FOUR;
    }
    if (score >= FOUR_SCORE) {
      return THREAT_FOUR;
    }
    if (score >= OPEN_THREE_SCORE) {
      return THREAT_OPEN_THREE;
    }
    if (score >= THREE_SCORE) {
      return THREAT_THREE;
    }
    return THREAT_QUIET;
  }

  function threatBonus(threat) {
    if (threat >= THREAT_WIN) {
      return WIN_SCORE / 4;
    }
    if (threat >= THREAT_OPEN_FOUR) {
      return OPEN_FOUR_SCORE * 3;
    }
    if (threat >= THREAT_FOUR) {
      return OPEN_FOUR_SCORE;
    }
    if (threat >= THREAT_OPEN_THREE) {
      return FOUR_SCORE;
    }
    if (threat >= THREAT_THREE) {
      return OPEN_THREE_SCORE;
    }
    return 0;
  }

  function searchHeuristicBonus(context, player, row, col, ply) {
    const idx = context.board.index(row, col);
    const history = context.historyHeuristic[playerIndex(player)][idx] / HISTORY_SCALE;
    const killers = context.killers[clampPly(ply)];
    if (killers[0] === idx) {
      return history + KILLER_BONUS;
    }
    if (killers[1] === idx) {
      return history + SECOND_KILLER_BONUS;
    }
    return history;
  }

  function recordCutoff(context, player, row, col, depth, ply) {
    const idx = context.board.index(row, col);
    const history = context.historyHeuristic[playerIndex(player)];
    const bonus = depth * depth * 64;
    history[idx] = Math.min(HISTORY_MAX, history[idx] + bonus);

    const killers = context.killers[clampPly(ply)];
    if (killers[0] === idx) {
      return;
    }
    killers[1] = killers[0];
    killers[0] = idx;
  }

  function applyThreatCandidateLimit(candidates, candidateLimit) {
    if (candidates.length === 0 || candidateLimit <= 0) {
      return candidateLimit;
    }
    let minThreat = THREAT_QUIET;
    if (candidates[0].threat >= THREAT_OPEN_FOUR) {
      minThreat = THREAT_FOUR;
    } else if (candidates[0].threat >= THREAT_FOUR) {
      minThreat = THREAT_OPEN_THREE;
    } else {
      return candidateLimit;
    }

    let tacticalCount = 0;
    while (
      tacticalCount < candidates.length &&
      tacticalCount < candidateLimit &&
      candidates[tacticalCount].threat >= minThreat
    ) {
      tacticalCount++;
    }
    return tacticalCount > 0 ? tacticalCount : candidateLimit;
  }

  function effectiveQsearchDepth(context, ply) {
    let qdepth = context.config.qsearchDepth;
    if (context.config.maxDepth >= 5 && context.config.timeLimitMs >= 1000) {
      if (context.stoneCount >= 48) {
        qdepth = Math.min(qdepth, 1);
      } else if (context.stoneCount >= 24) {
        qdepth = Math.min(qdepth, 1);
      } else if (context.stoneCount >= 12 && ply <= 1) {
        qdepth = Math.min(qdepth, 2);
      }
    }
    return qdepth;
  }

  function adaptiveCandidateLimit(context, candidates, baseLimit, depth, ply = 0) {
    if (candidates.length === 0) {
      return 0;
    }
    let limit = Math.min(Math.max(1, baseLimit), candidates.length);
    const highDepthSearch = context.config.maxDepth >= 5 && context.config.timeLimitMs >= 1000 && baseLimit > 18;
    if (highDepthSearch) {
      let width = DEEP_SEARCH_ROOT_WIDTH;
      if (context.stoneCount >= 48) {
        width = DEEP_SEARCH_LATEGAME_WIDTH;
      } else if (context.stoneCount >= 24) {
        width = DEEP_SEARCH_MIDGAME_WIDTH;
      }
      if (depth >= 7) {
        width = Math.floor(width * 0.7);
      } else if (depth >= 5) {
        width = Math.floor(width * 0.82);
      } else if (depth >= 3) {
        width = Math.floor(width * 0.75);
      }
      if (ply >= 3) {
        width = Math.floor(width * 0.78);
      } else if (ply >= 1) {
        width = Math.floor(width * 0.88);
      }

      const tacticalFloor = countTacticalPrefix(candidates);
      limit = Math.min(
        limit,
        Math.max(DEEP_SEARCH_MIN_WIDTH, width, Math.min(tacticalFloor, Math.min(baseLimit, 32))),
      );
    }

    return applyThreatCandidateLimit(candidates, limit);
  }

  function countTacticalPrefix(candidates) {
    if (candidates.length === 0) {
      return 0;
    }
    const minThreat = candidates[0].threat >= THREAT_FOUR ? THREAT_OPEN_THREE : THREAT_FOUR;
    let count = 0;
    while (count < candidates.length && candidates[count].threat >= minThreat) {
      count++;
    }
    return count;
  }

  function cacheKey(context, kind, player, row, col) {
    return `${context.evalVersion}:${kind}:${player}:${row}:${col}`;
  }

  function clampPly(ply) {
    return clamp(ply, 0, MAX_SEARCH_PLY - 1);
  }

  function firstLegalMove(board, player) {
    const context = new SearchContext(board, {
      version: "scout",
      maxDepth: 1,
      candidateLimit: 32,
      seed: "fallback",
      timeLimitMs: 500,
      vcfDepth: 0,
      qsearchDepth: 0,
    }, new EngineSearchCache());
    return generateCandidates(context, player, null)[0] || null;
  }

  function rateMoveQuality(board, row, col, player, config, existingStats) {
    if (!Rules.checkMove(board, row, col, player).ok) {
      return -100;
    }

    let candidates =
      existingStats?.player === player && existingStats.candidates?.length > 0 ? existingStats.candidates : null;

    if (!candidates) {
      const context = new SearchContext(
        board,
        { ...config, version: "scout", maxDepth: 1, timeLimitMs: 300, qsearchDepth: 0 },
        new EngineSearchCache(),
      );
      candidates = generateCandidates(context, player, null).slice(0, Math.max(12, config.candidateLimit || 18));
    }

    const selected =
      candidates.find((candidate) => candidate.row === row && candidate.col === col) || {
        row,
        col,
        score: board.countStones() === 0 ? centerBonus(row, col) : movePriority(board, row, col, player),
      };

    return candidateQuality(selected, [selected, ...candidates]);
  }

  function candidateQuality(candidate, candidates) {
    if (!candidates || candidates.length === 0) {
      return 0;
    }
    const best = Math.max(...candidates.map((item) => item.score));
    const worst = Math.min(...candidates.map((item) => item.score));
    const spread = Math.max(100, best - worst);
    return clamp(Math.round(100 - ((best - candidate.score) * 200) / spread), -100, 100);
  }

  function hasNeighbor(board, row, col, radius) {
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        if (dx === 0 && dy === 0) {
          continue;
        }
        const x = row + dx;
        const y = col + dy;
        if (board.inside(x, y) && board.get(x, y) !== EMPTY) {
          return true;
        }
      }
    }
    return false;
  }

  function movePriority(board, row, col, player) {
    const attack = moveShapeScore(board, row, col, player);
    const defense = moveShapeScore(board, row, col, opponent(player));
    let score = attack * 2 + Math.floor((defense * 3) / 2) + centerBonus(row, col);
    if (attack >= WIN_SCORE) {
      score += WIN_SCORE / 2;
    }
    if (defense >= WIN_SCORE) {
      score += WIN_SCORE / 3;
    }
    return score;
  }

  function moveShapeScore(board, row, col, player) {
    let score = 0;
    let openFourCount = 0;
    let fourCount = 0;
    let openThreeCount = 0;

    for (const [dx, dy] of DIRECTIONS) {
      const directionScore = directionShapeScore(board, row, col, dx, dy, player);
      if (directionScore >= WIN_SCORE) {
        return WIN_SCORE;
      }
      if (directionScore >= OPEN_FOUR_SCORE) {
        openFourCount++;
      } else if (directionScore >= FOUR_SCORE) {
        fourCount++;
      } else if (directionScore >= OPEN_THREE_SCORE) {
        openThreeCount++;
      }
      score += directionScore;
    }

    if (openFourCount > 0 && (fourCount > 0 || openThreeCount > 0)) {
      score += OPEN_FOUR_SCORE;
    }
    if (fourCount >= 2) {
      score += OPEN_FOUR_SCORE;
    }
    if (openThreeCount >= 2) {
      score += FOUR_SCORE;
    }
    return score;
  }

  function moveShapeProfile(board, row, col, player) {
    const profile = {
      score: 0,
      win: false,
      openFour: 0,
      four: 0,
      openThree: 0,
      three: 0,
    };

    for (const [dx, dy] of DIRECTIONS) {
      const directionScore = directionShapeScore(board, row, col, dx, dy, player);
      if (directionScore >= WIN_SCORE) {
        profile.win = true;
        profile.score = WIN_SCORE;
        return profile;
      }
      if (directionScore >= OPEN_FOUR_SCORE) {
        profile.openFour++;
      } else if (directionScore >= FOUR_SCORE) {
        profile.four++;
      } else if (directionScore >= OPEN_THREE_SCORE) {
        profile.openThree++;
      } else if (directionScore >= THREE_SCORE) {
        profile.three++;
      }
      profile.score += directionScore;
    }

    const fourCount = profileFourCount(profile);
    if (profile.openFour > 0 && (fourCount > profile.openFour || profile.openThree > 0)) {
      profile.score += OPEN_FOUR_SCORE;
    }
    if (fourCount >= 2) {
      profile.score += OPEN_FOUR_SCORE;
    }
    if (profile.openThree >= 2) {
      profile.score += FOUR_SCORE;
    }
    return profile;
  }

  function directionShapeScore(board, row, col, dx, dy, player) {
    const line = buildVirtualLine(board, row, col, dx, dy, player);
    if (line.includes("11111")) {
      return WIN_SCORE;
    }
    if (containsAny(line, ["011110"])) {
      return OPEN_FOUR_SCORE;
    }
    if (containsAny(line, ["11110", "01111", "11011", "10111", "11101"])) {
      return FOUR_SCORE;
    }
    if (containsAny(line, ["01110", "010110", "011010"])) {
      return OPEN_THREE_SCORE;
    }
    if (containsAny(line, ["001110", "011100", "01011", "11010", "10110", "01101"])) {
      return THREE_SCORE;
    }
    return 0;
  }

  function buildVirtualLine(board, row, col, dx, dy, player) {
    let line = "";
    for (let offset = -5; offset <= 5; offset++) {
      const x = row + offset * dx;
      const y = col + offset * dy;
      if (!board.inside(x, y)) {
        line += "3";
      } else if (offset === 0) {
        line += "1";
      } else {
        const stone = board.get(x, y);
        line += stone === player ? "1" : stone === opponent(player) ? "2" : "0";
      }
    }
    return line;
  }

  function containsAny(line, patterns) {
    return patterns.some((pattern) => line.includes(pattern));
  }

  function evaluateBoard(board, perspective) {
    let score = evaluateWindows(board, perspective);
    for (let row = 0; row < SIZE; row++) {
      for (let col = 0; col < SIZE; col++) {
        const stone = board.get(row, col);
        if (stone === perspective) {
          score += centerBonus(row, col);
        } else if (stone === opponent(perspective)) {
          score -= centerBonus(row, col);
        }
      }
    }
    return score;
  }

  function evaluateWindows(board, player) {
    let total = 0;
    for (let row = 0; row < SIZE; row++) {
      for (let col = 0; col < SIZE; col++) {
        for (const [dx, dy] of DIRECTIONS) {
          if (!board.inside(row + 4 * dx, col + 4 * dy)) {
            continue;
          }
          let own = 0;
          let rival = 0;
          let open = 0;
          for (let k = 0; k < 5; k++) {
            const stone = board.get(row + k * dx, col + k * dy);
            if (stone === player) {
              own++;
            } else if (stone === opponent(player)) {
              rival++;
            }
          }
          const beforeRow = row - dx;
          const beforeCol = col - dy;
          const afterRow = row + 5 * dx;
          const afterCol = col + 5 * dy;
          if (board.inside(beforeRow, beforeCol) && board.get(beforeRow, beforeCol) === EMPTY) {
            open++;
          }
          if (board.inside(afterRow, afterCol) && board.get(afterRow, afterCol) === EMPTY) {
            open++;
          }
          if (own > 0 && rival === 0) {
            total += windowScore(own, open);
          } else if (rival > 0 && own === 0) {
            total -= Math.floor((windowScore(rival, open) * 11) / 10);
          }
        }
      }
    }
    return total;
  }

  function windowScore(stones, openEnds) {
    if (stones >= 5) {
      return WIN_SCORE;
    }
    if (stones === 4) {
      return openEnds === 2 ? 180000 : 25000;
    }
    if (stones === 3) {
      return openEnds === 2 ? 8000 : 800;
    }
    if (stones === 2) {
      return openEnds === 2 ? 300 : 45;
    }
    if (stones === 1) {
      return openEnds === 2 ? 12 : 3;
    }
    return 0;
  }

  const PRESEARCH_STORE = {
    index: null,
    loadedBuckets: new Set(),
    pendingBuckets: new Set(),
  };

  function buildPresearchIndex() {
    if (PRESEARCH_STORE.index) {
      return PRESEARCH_STORE.index;
    }

    const index = new Map();
    PRESEARCH_STORE.index = index;
    window.gomokuRegisterPresearchBucket = (bucket) => importPresearchBucket(bucket);

    const rows = Array.isArray(window.GOMOKU_V3_PRESEARCH) ? window.GOMOKU_V3_PRESEARCH : [];
    for (const row of rows) {
      const board = new BoardModel();
      for (const stone of row.stones || []) {
        board.set(stone[1], stone[2], stone[0]);
      }
      const player = row.player === WHITE ? WHITE : BLACK;
      const lookup = makePresearchLookup(board, player);
      const move = transformMove(tupleMove(row.move), lookup.transform);
      const candidates = (row.candidates || []).map((candidate) => ({
        ...transformMove(tupleMove(candidate), lookup.transform),
        score: candidate[2] || 0,
        threat: candidate[3] || THREAT_QUIET,
      }));
      index.set(lookup.key, {
        name: row.name || lookup.key,
        depth: row.depth || 1,
        score: row.score || candidates[0]?.score || 0,
        move,
        candidates,
      });
    }

    const loaded = window.GOMOKU_V3_PRESEARCH_BUCKETS || {};
    Object.keys(loaded).forEach((bucket) => importPresearchBucket(Number(bucket)));
    return index;
  }

  function requestPresearchBucket(bucket) {
    const manifest = window.GOMOKU_V3_PRESEARCH_MANIFEST;
    if (
      !manifest ||
      !manifest.buckets?.includes(bucket) ||
      PRESEARCH_STORE.loadedBuckets.has(bucket) ||
      PRESEARCH_STORE.pendingBuckets.has(bucket)
    ) {
      return;
    }
    if (window.GOMOKU_V3_PRESEARCH_BUCKETS?.[bucket]) {
      importPresearchBucket(bucket);
      return;
    }

    PRESEARCH_STORE.pendingBuckets.add(bucket);
    const script = document.createElement("script");
    const directory = manifest.directory || "presearch-books";
    script.src = `${directory}/book-${bucket}.js`;
    script.defer = true;
    script.onload = () => {
      PRESEARCH_STORE.pendingBuckets.delete(bucket);
      importPresearchBucket(bucket);
    };
    script.onerror = () => PRESEARCH_STORE.pendingBuckets.delete(bucket);
    document.head.append(script);
  }

  function warmupOpeningPresearch() {
    const load = () => {
      for (const bucket of [0, 1, 2, 3, 4]) {
        requestPresearchBucket(bucket);
      }
    };
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(load, { timeout: 1200 });
    } else {
      window.setTimeout(load, 600);
    }
  }

  function importPresearchBucket(bucket) {
    const payload = window.GOMOKU_V3_PRESEARCH_BUCKETS?.[bucket];
    if (!payload || PRESEARCH_STORE.loadedBuckets.has(bucket)) {
      return 0;
    }
    const index = PRESEARCH_STORE.index || buildPresearchIndex();
    let imported = 0;
    const lines = String(payload).trim().split("\n");
    for (const line of lines) {
      if (!line) {
        continue;
      }
      const entry = decodePackedPresearchEntry(line);
      if (!entry) {
        continue;
      }
      const existing = index.get(entry.key);
      if (!existing || (entry.value.depth || 0) >= (existing.depth || 0)) {
        index.set(entry.key, entry.value);
        imported++;
      }
    }
    PRESEARCH_STORE.loadedBuckets.add(bucket);
    delete window.GOMOKU_V3_PRESEARCH_BUCKETS[bucket];
    return imported;
  }

  function decodePackedPresearchEntry(line) {
    const parts = line.split("|");
    if (parts[0] === "v2") {
      const player = Number(parts[1]);
      const depth = Number(parts[2]);
      const score = Number(parts[3]);
      const signature = parts[5];
      const move = decodePackedMove(parts[6]);
      const candidates = (parts[7] || "").split(";").map(decodePackedMove).filter(Boolean);
      if (!move || (player !== BLACK && player !== WHITE)) {
        return null;
      }
      return {
        key: `pre:${player}:${signature}`,
        value: {
          name: parts[10] || `book-${signature || "empty"}`,
          depth,
          score,
          move,
          candidates,
          flag: parts[4] || "RANK",
          configHash: parts[8] || "",
          ruleHash: parts[9] || "",
        },
      };
    }
    if (parts.length < 6) {
      return null;
    }
    const player = Number(parts[0]);
    const depth = Number(parts[1]);
    const score = Number(parts[2]);
    const signature = parts[3];
    const move = decodePackedMove(parts[4]);
    const candidates = parts[5].split(";").map(decodePackedMove).filter(Boolean);
    if (!move || (player !== BLACK && player !== WHITE)) {
      return null;
    }
    return {
      key: `pre:${player}:${signature}`,
      value: {
        name: `book-${signature || "empty"}`,
        depth,
        score,
        move,
        candidates,
      },
    };
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

  function makePresearchLookup(board, player) {
    return {
      ...canonicalizeBoard(board, player, "pre"),
      bucket: board.countStones(),
    };
  }

  function makeRootLookup(board, player, config, includeSeed) {
    const lookup = canonicalizeBoard(board, player, "root");
    const seedPart = includeSeed ? `:${config.seed}` : "";
    return {
      ...lookup,
      key: `${lookup.key}:${config.version}:d${config.maxDepth}:w${config.candidateLimit}${seedPart}`,
    };
  }

  function materializeCachedRoot(board, config, entry, inverse, reason, player = null) {
    const move = transformMove(entry.move, inverse);
    if (!move || !board.inside(move.row, move.col) || board.get(move.row, move.col) !== EMPTY) {
      return null;
    }
    if (player && !Rules.checkMove(board, move.row, move.col, player).ok) {
      return null;
    }
    const candidates = transformCandidates(entry.candidates || [entry.move], inverse)
      .filter(
        (candidate) =>
          board.inside(candidate.row, candidate.col) &&
          board.get(candidate.row, candidate.col) === EMPTY &&
          (!player || Rules.checkMove(board, candidate.row, candidate.col, player).ok),
      )
      .slice(0, 18);
    const stats = {
      version: config.version,
      completedDepth: entry.depth || config.maxDepth,
      nodes: 0,
      score: entry.score || move.score || 0,
      timedOut: false,
      durationMs: 0,
      candidates: promoteCandidate(candidates, { ...move, score: entry.score || move.score || 0 }).slice(0, 18),
      depthTrace: [],
      reason,
    };
    return { move: { ...move, score: stats.score }, stats };
  }

  function applyPresearchOrdering(candidates, cachedCandidates) {
    if (!cachedCandidates || cachedCandidates.length === 0) {
      return;
    }
    const bonusBase = WIN_SCORE / 5;
    cachedCandidates.forEach((cached, rank) => {
      const candidate = candidates.find((item) => item.row === cached.row && item.col === cached.col);
      if (candidate) {
        candidate.score += bonusBase - rank * 10000 + Math.floor((cached.score || 0) / 16);
      }
    });
    candidates.sort(compareCandidates);
  }

  function canonicalizeBoard(board, player, prefix) {
    let best = null;
    for (let transform = 0; transform < 8; transform++) {
      const key = `${prefix}:${player}:${boardSignature(board, transform)}`;
      if (!best || key < best.key) {
        best = { key, transform, inverse: inverseTransform(transform) };
      }
    }
    return best;
  }

  function boardSignature(board, transform) {
    const stones = [];
    for (let row = 0; row < SIZE; row++) {
      for (let col = 0; col < SIZE; col++) {
        const stone = board.get(row, col);
        if (stone !== EMPTY) {
          const mapped = transformMove({ row, col }, transform);
          stones.push(`${stone}${mapped.row.toString(36).padStart(2, "0")}${mapped.col.toString(36).padStart(2, "0")}`);
        }
      }
    }
    stones.sort();
    return stones.join(".");
  }

  function transformCandidates(candidates, transform) {
    return (candidates || []).map((candidate) => ({
      ...transformMove(candidate, transform),
      score: candidate.score || 0,
      threat: candidate.threat || THREAT_QUIET,
    }));
  }

  function transformMove(move, transform) {
    if (!move) {
      return null;
    }
    const row = move.row;
    const col = move.col;
    const max = SIZE - 1;
    switch (transform) {
      case 1:
        return { ...move, row: col, col: max - row };
      case 2:
        return { ...move, row: max - row, col: max - col };
      case 3:
        return { ...move, row: max - col, col: row };
      case 4:
        return { ...move, row, col: max - col };
      case 5:
        return { ...move, row: max - row, col };
      case 6:
        return { ...move, row: col, col: row };
      case 7:
        return { ...move, row: max - col, col: max - row };
      default:
        return { ...move, row, col };
    }
  }

  function inverseTransform(transform) {
    return [0, 3, 2, 1, 4, 5, 6, 7][transform] || 0;
  }

  function tupleMove(tuple) {
    return {
      row: tuple?.[0] ?? 7,
      col: tuple?.[1] ?? 7,
      score: tuple?.[2] ?? 0,
      threat: tuple?.[3] ?? THREAT_QUIET,
    };
  }

  function trimMap(map, maxSize, maxAge = 0, currentAge = 0) {
    if (maxAge > 0 && currentAge > 0) {
      for (const [key, value] of map) {
        if (!value || typeof value.age !== "number" || currentAge - value.age > maxAge) {
          map.delete(key);
        }
      }
    }
    while (map.size > maxSize) {
      map.delete(map.keys().next().value);
    }
  }

  function makeZobrist(seedText) {
    const rng = mulberry32(hashString(`${seedText}:zobrist`));
    const black = new Uint32Array(SIZE * SIZE);
    const white = new Uint32Array(SIZE * SIZE);
    for (let i = 0; i < SIZE * SIZE; i++) {
      black[i] = rng();
      white[i] = rng();
    }
    return { table: [black, white], side: rng() };
  }

  function mulberry32(seed) {
    let value = seed >>> 0;
    return () => {
      value = (value + 0x6d2b79f5) >>> 0;
      let t = value;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return (t ^ (t >>> 14)) >>> 0;
    };
  }

  function stableNoise(seed, row, col, player) {
    const hash = hashString(`${seed}:${row}:${col}:${player}`);
    return (hash % 97) - 48;
  }

  function makeFreshSeed(prefix = "S") {
    let value = Math.floor(Math.random() * 0xffffffff) >>> 0;
    if (window.crypto?.getRandomValues) {
      const buffer = new Uint32Array(1);
      window.crypto.getRandomValues(buffer);
      value = buffer[0] >>> 0;
    }
    const clock = Date.now().toString(36).slice(-6).toUpperCase();
    return `${prefix}-${clock}-${value.toString(36).toUpperCase().padStart(7, "0")}`;
  }

  function hashString(text) {
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function promoteCandidate(candidates, move) {
    const promoted = candidates.filter((candidate) => candidate.row !== move.row || candidate.col !== move.col);
    promoted.unshift({
      row: move.row,
      col: move.col,
      score: move.score,
      threat: move.threat || THREAT_QUIET,
      prior: move.prior || candidatePrior(move.row, move.col, move.threat || THREAT_QUIET),
    });
    return promoted;
  }

  function compareCandidates(a, b) {
    if (a.score !== b.score) {
      return b.score - a.score;
    }
    if ((a.prior || 0) !== (b.prior || 0)) {
      return (b.prior || 0) - (a.prior || 0);
    }
    if ((a.threat || THREAT_QUIET) !== (b.threat || THREAT_QUIET)) {
      return (b.threat || THREAT_QUIET) - (a.threat || THREAT_QUIET);
    }
    if (a.row !== b.row) {
      return a.row - b.row;
    }
    return a.col - b.col;
  }

  function centerBonus(row, col) {
    const center = Math.floor(SIZE / 2);
    const distance = Math.abs(row - center) + Math.abs(col - center);
    return (SIZE + SIZE - distance) * 3;
  }

  function opponent(player) {
    return player === BLACK ? WHITE : BLACK;
  }

  function playerIndex(player) {
    return player === BLACK ? 0 : 1;
  }

  function stoneName(player) {
    return player === BLACK ? "BLACK" : "WHITE";
  }

  function stoneShort(player) {
    return player === BLACK ? "B" : "W";
  }

  function moveName(move) {
    return `${LETTERS[move.col]}${move.row + 1}`;
  }

  function formatScore(score) {
    if (!Number.isFinite(score)) {
      return "-";
    }
    if (score >= WIN_SCORE / 2) {
      return "WIN";
    }
    if (score <= -WIN_SCORE / 2) {
      return "LOSS";
    }
    const sign = score > 0 ? "+" : "";
    if (Math.abs(score) >= 1000000) {
      return `${sign}${(score / 1000000).toFixed(1)}M`;
    }
    if (Math.abs(score) >= 1000) {
      return `${sign}${(score / 1000).toFixed(1)}K`;
    }
    return `${sign}${Math.round(score)}`;
  }

  function formatRating(score) {
    const rounded = clamp(Math.round(score), -100, 100);
    return `${rounded > 0 ? "+" : ""}${rounded}`;
  }

  function compactNumber(value) {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return String(value);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function sleep(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function mixHex(a, b, amount) {
    const left = hexToRgb(a);
    const right = hexToRgb(b);
    const mix = (x, y) => Math.round(x * (1 - amount) + y * amount);
    return `#${[mix(left.r, right.r), mix(left.g, right.g), mix(left.b, right.b)]
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("")}`;
  }

  function hexToRgb(hex) {
    const text = hex.replace("#", "").trim();
    const normalized =
      text.length === 3
        ? text
            .split("")
            .map((ch) => ch + ch)
            .join("")
        : text.padEnd(6, "0").slice(0, 6);
    const value = Number.parseInt(normalized, 16);
    return {
      r: (value >> 16) & 255,
      g: (value >> 8) & 255,
      b: value & 255,
    };
  }

  function registerLabEngine(type, handler) {
    if (!type || !handler || typeof handler.findBestMove !== "function") {
      throw new TypeError("lab engine must provide findBestMove(board, player, config)");
    }
    LAB_ENGINE_REGISTRY.set(String(type), handler);
  }

  function resolveLabEngine(config = {}) {
    const version = String(config.version || "");
    if (!version.startsWith(LAB_ENGINE_PREFIX)) {
      return null;
    }
    const [, type = "", ...rest] = version.split(":");
    const id = rest.join(":");
    const handler = LAB_ENGINE_REGISTRY.get(type) || {
      findBestMove(board, player, rawConfig) {
        const move = firstLegalMove(board, player);
        return {
          move,
          stats: makeLabStats(rawConfig.version, move, move ? [move] : [], "LAB-ENGINE-MISSING"),
        };
      },
    };
    return { type, id, handler };
  }

  function makeLabStats(version, move, candidates = [], reason = "LAB", extra = {}) {
    return {
      version,
      completedDepth: extra.completedDepth || 0,
      nodes: extra.nodes || candidates.length,
      score: move ? move.score || 0 : 0,
      timedOut: false,
      durationMs: extra.durationMs || 0,
      candidates: candidates.slice(0, 18),
      depthTrace:
        extra.depthTrace ||
        (move
          ? [{ depth: extra.completedDepth || 0, move, score: move.score || 0, nodes: extra.nodes || 1, time: extra.durationMs || 0 }]
          : []),
      reason,
      ...extra,
    };
  }

  function boardFromCells(cells, current = BLACK) {
    const board = new BoardModel();
    const source = cells || [];
    for (let i = 0; i < Math.min(source.length, MAX_MOVES); i++) {
      board.cells[i] = source[i] || EMPTY;
    }
    board.current = current === WHITE ? WHITE : BLACK;
    return board;
  }

  function boardSnapshot(board) {
    return {
      size: board.size,
      current: board.current,
      cells: Array.from(board.cells),
      history: board.history.map((move) => ({ row: move.row, col: move.col, player: move.player })),
    };
  }

  function legalCandidates(board, player, options = {}) {
    const config = normalizeConfig({
      version: "scout",
      maxDepth: 1,
      candidateLimit: options.limit || options.candidateLimit || 32,
      seed: options.seed || `lab:${board.history.length}:${player}`,
      timeLimitMs: 500,
      vcfDepth: 0,
      qsearchDepth: 0,
    });
    const context = new SearchContext(board, config, new EngineSearchCache());
    return generateCandidates(context, player, null).slice(0, Math.max(1, options.limit || config.candidateLimit));
  }

  function teacherSearch(board, player, options = {}) {
    const engine = new GomokuSearchEngine();
    const config = normalizeConfig({
      version: options.version || "v4-source-guard",
      maxDepth: options.depth || 2,
      candidateLimit: options.width || 18,
      seed: options.seed || `teacher:${board.history.length}:${player}`,
      timeLimitMs: options.timeLimitMs || 700,
      symmetryTT: true,
      vcfDepth: options.vcfDepth ?? 3,
      qsearchDepth: options.qsearchDepth ?? 2,
    });
    return engine.findBestMove(board, player, config);
  }

  function findTacticalMove(board, player) {
    const context = new SearchContext(
      board,
      normalizeConfig({
        version: "v4-source-guard",
        maxDepth: 2,
        candidateLimit: 18,
        seed: `tactical:${board.history.length}:${player}`,
        timeLimitMs: 500,
        vcfDepth: 3,
        qsearchDepth: 1,
      }),
      new EngineSearchCache(),
    );
    return findRootTacticalMove(context, player);
  }

  function updateClock() {
    ui.clock.textContent = new Date().toLocaleTimeString("zh-CN", { hour12: false });
  }

  updateClock();
  window.setInterval(updateClock, 1000);
  window.GomokuLabCore = Object.freeze({
    BoardModel,
    BoardView,
    GomokuSearchEngine,
    Rules,
    ResultJudge,
    constants: {
      SIZE,
      EMPTY,
      BLACK,
      WHITE,
      WIN_SCORE,
      OPEN_FOUR_SCORE,
      FOUR_SCORE,
      OPEN_THREE_SCORE,
      THREE_SCORE,
      THREAT_WIN,
      THREAT_OPEN_FOUR,
      THREAT_FOUR,
      THREAT_OPEN_THREE,
      THREAT_THREE,
      THREAT_QUIET,
      DIRECTIONS,
      LETTERS,
    },
    normalizeConfig,
    nnEngineEvaluate,
    registerLabEngine,
    makeLabStats,
    boardFromCells,
    boardSnapshot,
    legalCandidates,
    teacherSearch,
    findTacticalMove,
    moveShapeScore,
    moveShapeProfile,
    evaluateBoard,
    centerBonus,
    hasNeighbor,
    opponent,
    moveName,
    formatScore,
    clamp,
  });
  window.gomokuTesting = Object.freeze({
    BoardModel,
    GomokuSearchEngine,
    Rules,
    ResultJudge,
    constants: { SIZE, EMPTY, BLACK, WHITE, WIN_SCORE },
    normalizeConfig,
    nnEngineEvaluate,
  });
  window.gomokuApp = new GameController();
})();
