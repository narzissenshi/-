((root, factory) => {
  const api = factory(root || {});
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.GomokuMinimaxLab = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, (root) => {
  "use strict";

  const SIZE = 15;
  const BLACK = 1;
  const WHITE = 2;
  const EMPTY = 0;
  const CENTER = 7;
  const CUSTOM_PATTERN_KEY = "gomoku-minimax-custom-patterns-v2";
  const DIRECTIONS = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];
  const DEFAULT_WEIGHTS = {
    five: 100000,
    openFour: 30000,
    four: 12000,
    openThree: 2600,
    three: 700,
    center: 18,
  };
  const MINIMAX_PRESETS = Object.freeze({
    balanced: {
      label: "均衡策略",
      config: { depth: 2, width: 4, alphaBeta: true, randomness: 4, weights: { ...DEFAULT_WEIGHTS } },
    },
    attack: {
      label: "进攻策略",
      config: {
        depth: 3,
        width: 5,
        alphaBeta: true,
        randomness: 8,
        weights: { ...DEFAULT_WEIGHTS, openFour: 36000, four: 15000, openThree: 3600, three: 900, center: 22 },
      },
    },
    defense: {
      label: "防守策略",
      config: {
        depth: 3,
        width: 5,
        alphaBeta: true,
        randomness: 2,
        weights: { ...DEFAULT_WEIGHTS, openFour: 33000, four: 18000, openThree: 2200, three: 1100, center: 14 },
      },
    },
    fast: {
      label: "快速搜索",
      config: { depth: 1, width: 3, alphaBeta: true, randomness: 0, weights: { ...DEFAULT_WEIGHTS, center: 20 } },
    },
  });
  const BUILT_IN_PATTERN_CARDS = Object.freeze([
    { id: "five", name: "连五", pattern: "11111", scoreKey: "five" },
    { id: "open-four", name: "活四", pattern: "011110", scoreKey: "openFour" },
    { id: "four", name: "冲四", pattern: "11110", scoreKey: "four" },
    { id: "jump-four", name: "跳四", pattern: "11011", scoreKey: "four" },
    { id: "open-three", name: "活三", pattern: "01110", scoreKey: "openThree" },
    { id: "jump-three", name: "跳活三", pattern: "010110", scoreKey: "openThree" },
    { id: "sleep-three", name: "眠三", pattern: "001110", scoreKey: "three" },
  ]);
  const EXTRA_WEIGHT_CARDS = Object.freeze([{ id: "center", name: "中心偏好", pattern: "0001000", scoreKey: "center" }]);
  const PATTERN_DESCRIPTIONS = Object.freeze({
    five: "连成五子直接获胜，是最高优先级棋形。",
    "open-four": "两端都可继续成五，通常必须立即处理。",
    four: "一端受限但下一手可成五，是强迫防守的冲击点。",
    "jump-four": "中间隔一格的四子，补上空点即可成五。",
    "open-three": "两端开放的三子，可以继续发展成活四。",
    "jump-three": "带跳点的活三，常用于制造双威胁。",
    "sleep-three": "一端受限的三子，价值低于活三。",
    center: "越靠近天元越容易连接多方向，中心偏好会给候选点少量加分。",
  });

  function clock() {
    return root.performance?.now ? root.performance.now() : Date.now();
  }

  function opponent(player) {
    return player === BLACK ? WHITE : BLACK;
  }

  function profileScore(profile = {}, weights = DEFAULT_WEIGHTS, extra = 0) {
    if (profile.win) {
      return weights.five + extra;
    }
    return (
      (profile.openFour || 0) * weights.openFour +
      (profile.four || 0) * weights.four +
      (profile.openThree || 0) * weights.openThree +
      (profile.three || 0) * weights.three +
      extra
    );
  }

  function normalizePattern(input) {
    const raw = String(input || "")
      .trim()
      .toUpperCase();
    let pattern = "";
    for (const ch of raw) {
      if (ch === "0" || ch === "." || ch === "_" || ch === "-") {
        pattern += "0";
      } else if (ch === "1" || ch === "X" || ch === "B") {
        pattern += "1";
      } else if (ch === "2" || ch === "O" || ch === "W") {
        pattern += "2";
      } else if (ch === "3" || ch === "4" || ch === "#") {
        pattern += "3";
      }
    }
    if (pattern.length < 2 || pattern.length > 11 || !pattern.includes("1")) {
      return "";
    }
    return pattern;
  }

  function normalizePatternRules(patterns = []) {
    const seen = new Set();
    const rules = [];
    for (const item of patterns || []) {
      const pattern = normalizePattern(item.pattern || item.sequence);
      const score = Number(item.score);
      if (!pattern || !Number.isFinite(score)) {
        continue;
      }
      const id = String(item.id || `${pattern}:${score}`);
      const key = `${pattern}:${score}:${item.name || ""}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      rules.push({
        id,
        name: String(item.name || "custom").slice(0, 24),
        pattern,
        score: Math.round(score),
      });
    }
    return rules.slice(0, 24);
  }

  function activePatternRules(config = {}) {
    return normalizePatternRules(config.patterns || config.customPatterns || []);
  }

  function buildPatternLine(board, row, col, dx, dy, player) {
    let line = "";
    const rival = opponent(player);
    for (let offset = -5; offset <= 5; offset++) {
      const x = row + dx * offset;
      const y = col + dy * offset;
      if (!board.inside(x, y)) {
        line += "3";
      } else if (offset === 0) {
        line += "1";
      } else {
        const stone = board.get(x, y);
        line += stone === player ? "1" : stone === rival ? "2" : "0";
      }
    }
    return line;
  }

  function countCenterMatches(line, pattern) {
    let count = 0;
    let start = line.indexOf(pattern);
    while (start !== -1) {
      const end = start + pattern.length - 1;
      if (start <= 5 && 5 <= end) {
        count++;
      }
      start = line.indexOf(pattern, start + 1);
    }
    return count;
  }

  function customPatternScore(board, row, col, player, rules = []) {
    if (!rules.length || board.get(row, col) !== EMPTY) {
      return { score: 0, hits: [] };
    }
    const hits = [];
    let score = 0;
    board.set(row, col, player);
    try {
      for (const [dx, dy] of DIRECTIONS) {
        const line = buildPatternLine(board, row, col, dx, dy, player);
        for (const rule of rules) {
          const count = countCenterMatches(line, rule.pattern);
          if (count > 0) {
            score += rule.score * count;
            hits.push({ name: rule.name, pattern: rule.pattern, count, score: rule.score * count });
          }
        }
      }
    } finally {
      board.set(row, col, EMPTY);
    }
    return { score, hits };
  }

  function centerValue(row, col, weights) {
    return Math.max(0, 1 - (Math.abs(row - CENTER) + Math.abs(col - CENTER)) / 14) * weights.center;
  }

  function stableNoise(row, col, player, amount, salt = 0) {
    if (!amount) {
      return 0;
    }
    let value = (row + 17) * 73856093;
    value ^= (col + 31) * 19349663;
    value ^= (player + 5) * 83492791;
    value ^= salt * 2654435761;
    value >>>= 0;
    return (((value % 2001) / 1000) - 1) * amount;
  }

  function staticMoveScore(core, board, row, col, player, weights = DEFAULT_WEIGHTS, patternRules = []) {
    const rival = opponent(player);
    const attackExtra = customPatternScore(board, row, col, player, patternRules).score;
    const defenseExtra = customPatternScore(board, row, col, rival, patternRules).score;
    const attack = profileScore(core.moveShapeProfile(board, row, col, player), weights, attackExtra);
    const defense = profileScore(core.moveShapeProfile(board, row, col, rival), weights, defenseExtra);
    return attack * 1.4 + defense * 1.15 + centerValue(row, col, weights);
  }

  function evaluateBoard(core, board, player, weights = DEFAULT_WEIGHTS, patternRules = []) {
    const rival = opponent(player);
    const last = board.lastMove;
    if (last && Number.isFinite(last.player)) {
      const winner = core.ResultJudge.check(board, last.row, last.col, last.player);
      if (winner === player) {
        return weights.five;
      }
      if (winner === rival) {
        return -weights.five;
      }
    }
    let score = 0;
    for (let row = 0; row < SIZE; row++) {
      for (let col = 0; col < SIZE; col++) {
        const stone = board.get(row, col);
        if (stone === player) {
          score += centerValue(row, col, weights);
        } else if (stone === rival) {
          score -= centerValue(row, col, weights);
        } else if (core.hasNeighbor(board, row, col, 2)) {
          score += staticMoveScore(core, board, row, col, player, weights, patternRules) * 0.08;
          score -= staticMoveScore(core, board, row, col, rival, weights, patternRules) * 0.09;
        }
      }
    }
    return Math.round(score);
  }

  function orderedCandidates(core, board, player, config = {}) {
    const width = Math.max(1, Number(config.width) || 5);
    const weights = { ...DEFAULT_WEIGHTS, ...(config.weights || {}) };
    const patternRules = activePatternRules(config);
    const salt = typeof board.countStones === "function" ? board.countStones() : board.history?.length || 0;
    let candidates = core.legalCandidates(board, player, { limit: Math.max(width * 3, width) });
    candidates = candidates.map((move) => ({
      ...move,
      score:
        staticMoveScore(core, board, move.row, move.col, player, weights, patternRules) +
        stableNoise(move.row, move.col, player, Number(config.randomness) || 0, salt),
    }));
    if (config.botModel && root.GomokuTrainer) {
      candidates = root.GomokuTrainer.rankCandidates(config.botModel, board, player, candidates, core).map((move) => ({
        ...move,
        score: move.score + staticMoveScore(core, board, move.row, move.col, player, weights, patternRules),
      }));
    }
    candidates.sort((a, b) => b.score - a.score);
    return candidates.slice(0, width);
  }

  function nodeRole(playerToMove, rootPlayer) {
    return playerToMove === rootPlayer ? "极大" : "极小";
  }

  function makeNode(data) {
    return {
      id: data.id,
      ply: data.ply,
      depthRemaining: data.depthRemaining,
      role: data.role,
      playerToMove: data.playerToMove,
      playerJustMoved: data.playerJustMoved || null,
      move: data.move || null,
      value: null,
      returnScore: null,
      alphaBefore: data.alphaBefore,
      betaBefore: data.betaBefore,
      alphaAfter: data.alphaBefore,
      betaAfter: data.betaBefore,
      reason: "",
      bestChildId: null,
      cutoff: false,
      causedCutoff: false,
      pruned: Boolean(data.pruned),
      pruneReason: data.pruneReason || "",
      cutoffLabel: data.cutoffLabel || "",
      children: [],
    };
  }

  function scoreForDisplay(score, currentPlayer, rootPlayer) {
    return currentPlayer === rootPlayer ? score : -score;
  }

  function collectLayers(rootNode) {
    const map = new Map();
    const visit = (node) => {
      const row = map.get(node.ply) || { ply: node.ply, count: 0, pruned: 0 };
      row.count++;
      if (node.pruned) {
        row.pruned++;
      }
      map.set(node.ply, row);
      node.children.forEach(visit);
    };
    visit(rootNode);
    return [...map.values()].sort((a, b) => a.ply - b.ply);
  }

  function flattenTree(rootNode) {
    const rows = [];
    const visit = (node) => {
      if (node.ply > 0 || node.pruned) {
        rows.push({
          nodeId: node.id,
          ply: node.ply,
          depth: node.depthRemaining,
          move: node.move,
          score: node.value,
          alpha: node.alphaBefore,
          beta: node.betaBefore,
          cut: node.causedCutoff || node.cutoff,
          pruned: node.pruned,
          summary: false,
        });
      }
      node.children.forEach(visit);
    };
    visit(rootNode);
    return rows;
  }

  function buildSearch(core, sourceBoard, player, config = {}) {
    const board = sourceBoard.clone ? sourceBoard.clone() : core.boardFromCells(sourceBoard.cells, player);
    const started = clock();
    const depth = Math.max(1, Number(config.depth) || 2);
    const alphaBeta = config.alphaBeta !== false;
    const weights = { ...DEFAULT_WEIGHTS, ...(config.weights || {}) };
    const patternRules = activePatternRules(config);
    let nodes = 0;
    let prunes = 0;
    let nextId = 0;
    let bestMove = null;
    let bestScore = -Infinity;
    let bestPv = [];

    const rootNode = makeNode({
      id: `n${nextId++}`,
      ply: 0,
      depthRemaining: depth,
      role: "极大",
      playerToMove: player,
      alphaBefore: -Infinity,
      betaBefore: Infinity,
    });

    function terminalScore(currentPlayer, ply) {
      const last = board.lastMove;
      if (!last || !Number.isFinite(last.player)) {
        return null;
      }
      const winner = core.ResultJudge.check(board, last.row, last.col, last.player);
      if (!winner) {
        return null;
      }
      return winner === currentPlayer ? weights.five - ply : -weights.five + ply;
    }

    function search(currentPlayer, remaining, alpha, beta, ply, node) {
      nodes++;
      node.alphaBefore = alpha;
      node.betaBefore = beta;
      node.alphaAfter = alpha;
      node.betaAfter = beta;
      node.depthRemaining = remaining;

      const terminal = terminalScore(currentPlayer, ply);
      if (terminal !== null) {
        node.returnScore = terminal;
        node.value = scoreForDisplay(terminal, currentPlayer, player);
        node.reason = terminal > 0 ? "胜利" : "失败";
        return { score: terminal, pv: [] };
      }
      if (remaining === 0 || core.ResultJudge.isFull(board)) {
        const score = evaluateBoard(core, board, currentPlayer, weights, patternRules);
        node.returnScore = score;
        node.value = scoreForDisplay(score, currentPlayer, player);
        node.reason = "静态评估";
        return { score, pv: [] };
      }

      const moves = orderedCandidates(core, board, currentPlayer, { ...config, weights, patterns: patternRules });
      if (!moves.length) {
        const score = evaluateBoard(core, board, currentPlayer, weights, patternRules);
        node.returnScore = score;
        node.value = scoreForDisplay(score, currentPlayer, player);
        node.reason = "NO MOVE";
        return { score, pv: [] };
      }

      let localBest = -Infinity;
      let localMove = null;
      let localPv = [];
      let localBestChild = null;

      for (let index = 0; index < moves.length; index++) {
        const move = moves[index];
        const childPlayer = opponent(currentPlayer);
        const child = makeNode({
          id: `n${nextId++}`,
          ply: ply + 1,
          depthRemaining: remaining - 1,
          role: nodeRole(childPlayer, player),
          playerToMove: childPlayer,
          playerJustMoved: currentPlayer,
          move: { row: move.row, col: move.col },
          alphaBefore: -beta,
          betaBefore: -alpha,
        });
        node.children.push(child);

        board.applyMove(move.row, move.col, currentPlayer, "MINIMAX", null);
        const childResult = search(childPlayer, remaining - 1, -beta, -alpha, ply + 1, child);
        const score = -childResult.score;
        board.undo(1);

        if (score > localBest) {
          localBest = score;
          localMove = move;
          localPv = [move, ...childResult.pv];
          localBestChild = child;
        }
        if (score > alpha) {
          alpha = score;
        }
        node.alphaAfter = alpha;
        node.betaAfter = beta;

        if (alphaBeta && alpha >= beta) {
          node.cutoff = true;
          child.causedCutoff = true;
          child.cutoffLabel = `剪枝 α ${fmt(alpha)} >= β ${fmt(beta)}`;
          node.reason = `剪枝 ${fmt(alpha)} >= ${fmt(beta)}`;
          for (let rest = index + 1; rest < moves.length; rest++) {
            const skipped = moves[rest];
            node.children.push(
              makeNode({
                id: `n${nextId++}`,
                ply: ply + 1,
                depthRemaining: remaining - 1,
                role: nodeRole(childPlayer, player),
                playerToMove: childPlayer,
                playerJustMoved: currentPlayer,
                move: { row: skipped.row, col: skipped.col },
                alphaBefore: -beta,
                betaBefore: -alpha,
                pruned: true,
                pruneReason: `剪枝 α ${fmt(alpha)} >= β ${fmt(beta)}`,
              }),
            );
            prunes++;
          }
          break;
        }
      }

      node.bestChildId = localBestChild?.id || null;
      node.returnScore = localBest;
      node.value = scoreForDisplay(localBest, currentPlayer, player);
      node.reason = node.reason || (localMove ? `最佳 ${moveText(core, localMove)}` : "搜索");
      if (ply === 0) {
        bestMove = localMove;
        bestScore = localBest;
        bestPv = localPv;
      }
      return { score: localBest, pv: localPv };
    }

    search(player, depth, -Infinity, Infinity, 0, rootNode);
    const durationMs = clock() - started;
    const rootCandidates = orderedCandidates(core, sourceBoard, player, { ...config, weights, patterns: patternRules }).map((move) => ({
      ...move,
      pv: bestPv.some((pvMove) => pvMove.row === move.row && pvMove.col === move.col),
    }));
    const trace = flattenTree(rootNode);
    return {
      move: bestMove,
      score: bestScore,
      pv: bestPv,
      trace,
      tree: rootNode,
      root: rootNode,
      layers: collectLayers(rootNode),
      depth,
      nodes,
      prunes,
      durationMs,
      candidates: rootCandidates,
      config: { ...config, depth, alphaBeta, weights, patterns: patternRules },
    };
  }

  function profilePayload(config, name) {
    return {
      schema: "gomoku-engine/v1",
      kind: "minimax",
      name: name || `Minimax 深度${config.depth} 宽度${config.width}`,
      config: {
        depth: Number(config.depth) || 2,
        width: Number(config.width) || 3,
        alphaBeta: config.alphaBeta !== false,
        randomness: Number(config.randomness) || 0,
        weights: { ...DEFAULT_WEIGHTS, ...(config.weights || {}) },
        patterns: activePatternRules(config),
      },
      createdAt: new Date().toISOString(),
    };
  }

  function engineCodeFromPayload(payload) {
    const editable = {
      name: payload.name,
      depth: payload.config.depth,
      width: payload.config.width,
      alphaBeta: payload.config.alphaBeta,
      randomness: payload.config.randomness,
      weights: payload.config.weights,
      patterns: payload.config.patterns,
    };
    return [
      "const gomokuMinimaxEngineConfig = ",
      JSON.stringify(editable, null, 2),
      ";",
      "",
      "// 修改上面的参数后，点击“注册到对战页”。",
      "// 注册成功后可在人机、机机模式的引擎下拉框中选择。",
    ].join("\n");
  }

  function profilePayloadFromEngineCode(text) {
    const source = String(text || "").trim();
    if (!source) {
      return null;
    }
    const start = source.indexOf("{");
    const end = source.lastIndexOf("}");
    if (start === -1 || end <= start) {
      throw new Error("没有找到 Minimax 参数对象");
    }
    const parsed = JSON.parse(source.slice(start, end + 1));
    const config = parsed.config || parsed;
    return profilePayload(config, parsed.name);
  }

  function cellFromEvent(canvas, event) {
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
    const pad = Math.round(canvas.width * 0.09);
    const cell = (canvas.width - pad * 2) / (SIZE - 1);
    const col = Math.round((x - pad) / cell);
    const row = Math.round((y - pad) / cell);
    const px = pad + col * cell;
    const py = pad + row * cell;
    if (row < 0 || row >= SIZE || col < 0 || col >= SIZE || Math.hypot(px - x, py - y) > cell * 0.5) {
      return null;
    }
    return { row, col };
  }

  function fmt(value) {
    if (!Number.isFinite(value)) {
      return value > 0 ? "+INF" : "-INF";
    }
    if (Math.abs(value) >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    if (Math.abs(value) >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return String(Math.round(value));
  }

  function moveText(core, move) {
    return move ? core.moveName(move) : "-";
  }

  function stoneText(player) {
    return player === BLACK ? "黑" : "白";
  }

  class MinimaxLab {
    constructor() {
      this.core = root.GomokuLabCore;
      this.store = root.GomokuModelStore;
      this.board = new this.core.BoardModel();
      this.result = null;
      this.visiblePly = 0;
      this.customPatterns = this.loadCustomPatterns();
      this.selectedPatternId = "open-three";
      this.principleIndex = 0;
      this.principleFlipped = false;
      this.$ = (id) => root.document.getElementById(id);
      this.loadDemoBoard();
      this.bindTabs();
      this.bind();
      this.registerEngines();
      this.store.ready().then(() => {
        root.GomokuRefreshEngineOptions?.();
        this.render();
      });
      this.render();
    }

    bindTabs() {
      root.document.querySelectorAll(".lab-tab").forEach((button) => {
        button.addEventListener("click", () => {
          root.document.body.dataset.activeLab = button.dataset.labTab;
          if (root.location && root.location.hash !== `#${button.dataset.labTab}`) {
            root.history?.replaceState?.(null, "", `#${button.dataset.labTab}`);
          }
          root.document.querySelectorAll(".lab-tab").forEach((item) => {
            item.classList.toggle("is-active", item === button);
          });
          this.render();
          root.gomokuTrainLab?.render?.();
        });
      });
      const initial = String(root.location?.hash || "").replace("#", "");
      if (["battle", "minimax", "train"].includes(initial)) {
        root.document.querySelector(`.lab-tab[data-lab-tab="${initial}"]`)?.click();
      }
    }

    bind() {
      this.$("minimax-run").addEventListener("click", () => this.run(true));
      this.$("minimax-step").addEventListener("click", () => this.stepLayer());
      this.$("minimax-reset").addEventListener("click", () => this.reset());
      this.$("minimax-export").addEventListener("click", () => this.exportProfile());
      this.$("minimax-undo")?.addEventListener("click", () => this.undoMove());
      this.$("minimax-clear")?.addEventListener("click", () => this.clearBoard());
      this.$("minimax-demo")?.addEventListener("click", () => this.reset());
      this.$("minimax-principle-prev")?.addEventListener("click", () => this.switchPrinciple(-1));
      this.$("minimax-principle-next")?.addEventListener("click", () => this.switchPrinciple(1));
      this.$("minimax-principle-flip")?.addEventListener("click", () => this.flipPrinciple());
      this.$("minimax-save").addEventListener("click", () => this.saveProfile());
      this.$("minimax-import").addEventListener("click", () => this.$("minimax-import-file").click());
      this.$("minimax-import-file").addEventListener("change", (event) => this.importProfile(event));
      ["minimax-depth", "minimax-width", "minimax-randomness", "minimax-alpha-beta"].forEach((id) => {
        this.$(id).addEventListener("input", () => {
          this.syncOutputs();
          this.result = null;
          this.visiblePly = 0;
          this.render();
        });
      });
      root.document.querySelectorAll("[data-minimax-preset]").forEach((button) => {
        button.addEventListener("click", () => this.applyPreset(button.dataset.minimaxPreset));
      });
      root.document.querySelectorAll(".minimax-score").forEach((input) => {
        input.addEventListener("input", () => {
          this.result = null;
          this.render();
        });
      });
      this.$("minimax-board").addEventListener("click", (event) => this.play(event));
      this.$("minimax-pattern-new")?.addEventListener("click", () => this.addCustomPatternFromEditor());
      this.$("minimax-pattern-delete")?.addEventListener("click", () => this.deleteSelectedPattern());
      this.$("minimax-pattern-edit-name")?.addEventListener("input", () => this.updateSelectedPatternFromEditor());
      this.$("minimax-pattern-edit-sequence")?.addEventListener("input", () => this.updateSelectedPatternFromEditor());
      this.$("minimax-pattern-edit-score")?.addEventListener("input", () => this.updateSelectedPatternFromEditor());
      this.syncOutputs();
      this.renderPrincipleCards();
    }

    registerEngines() {
      this.core.registerLabEngine("minimax", {
        findBestMove: (board, player, rawConfig) => this.findFromProfile(board, player, rawConfig),
      });
      this.core.registerLabEngine("hybrid", {
        findBestMove: (board, player, rawConfig) => this.findHybrid(board, player, rawConfig),
      });
    }

    loadCustomPatterns() {
      try {
        return normalizePatternRules(JSON.parse(root.localStorage?.getItem(CUSTOM_PATTERN_KEY) || "[]"));
      } catch {
        return [];
      }
    }

    saveCustomPatterns() {
      try {
        root.localStorage?.setItem(CUSTOM_PATTERN_KEY, JSON.stringify(this.customPatterns));
      } catch {
        // localStorage may be blocked when the page is opened from a restricted environment.
      }
    }

    readWeights() {
      const weights = { ...DEFAULT_WEIGHTS };
      root.document.querySelectorAll(".minimax-score").forEach((input) => {
        weights[input.dataset.scoreKey] = Number(input.value);
      });
      return weights;
    }

    readConfig() {
      return {
        depth: Number(this.$("minimax-depth").value),
        width: Number(this.$("minimax-width").value),
        alphaBeta: this.$("minimax-alpha-beta").checked,
        randomness: Number(this.$("minimax-randomness").value),
        weights: this.readWeights(),
        patterns: this.customPatterns,
      };
    }

    applyConfig(config = {}) {
      if (config.weights) {
        root.document.querySelectorAll(".minimax-score").forEach((input) => {
          if (Number.isFinite(Number(config.weights[input.dataset.scoreKey]))) {
            input.value = String(config.weights[input.dataset.scoreKey]);
          }
        });
      }
      if (Number.isFinite(Number(config.depth))) {
        this.$("minimax-depth").value = String(config.depth);
      }
      if (Number.isFinite(Number(config.width))) {
        this.$("minimax-width").value = String(this.core.clamp(Number(config.width), 2, 5));
      }
      if (Number.isFinite(Number(config.randomness))) {
        this.$("minimax-randomness").value = String(config.randomness);
      }
      if (typeof config.alphaBeta === "boolean") {
        this.$("minimax-alpha-beta").checked = config.alphaBeta;
      }
      if (config.patterns) {
        this.customPatterns = normalizePatternRules(config.patterns);
        this.saveCustomPatterns();
      }
      this.syncOutputs();
      this.result = null;
      this.visiblePly = 0;
      this.render();
    }

    syncOutputs() {
      this.$("minimax-depth-output").textContent = this.$("minimax-depth").value;
      this.$("minimax-width-output").textContent = this.$("minimax-width").value;
      this.$("minimax-randomness-output").textContent = this.$("minimax-randomness").value;
    }

    loadDemoBoard() {
      this.board.reset();
      [
        [BLACK, 7, 7],
        [WHITE, 7, 8],
        [BLACK, 6, 7],
        [WHITE, 8, 8],
        [BLACK, 5, 7],
        [WHITE, 8, 7],
      ].forEach(([player, row, col]) => this.board.applyMove(row, col, player, "DEMO", null));
      this.board.current = BLACK;
      this.board.result = null;
    }

    play(event) {
      const cell = cellFromEvent(this.$("minimax-board"), event);
      if (!cell || this.board.result || !this.core.Rules.checkMove(this.board, cell.row, cell.col, this.board.current).ok) {
        return;
      }
      const player = this.board.current;
      this.board.applyMove(cell.row, cell.col, player, "LAB", null);
      if (this.core.ResultJudge.check(this.board, cell.row, cell.col, player) === player) {
        this.board.result = { type: "win", winner: player };
      }
      this.result = null;
      this.visiblePly = 0;
      this.render();
    }

    run(showFull) {
      this.result = buildSearch(this.core, this.board, this.board.current, this.readConfig());
      this.visiblePly = showFull ? this.result.depth : 0;
      this.render();
    }

    stepLayer() {
      if (!this.result) {
        this.run(false);
        this.visiblePly = 0;
      } else if (this.visiblePly >= this.result.depth) {
        this.visiblePly = 0;
      } else {
        this.visiblePly++;
      }
      this.renderTree();
    }

    reset() {
      this.loadDemoBoard();
      this.result = null;
      this.visiblePly = 0;
      this.render();
    }

    applyPreset(name) {
      const preset = MINIMAX_PRESETS[name];
      if (!preset) {
        return;
      }
      this.applyConfig({
        ...preset.config,
        weights: { ...DEFAULT_WEIGHTS, ...(preset.config.weights || {}) },
      });
      root.document.querySelectorAll("[data-minimax-preset]").forEach((button) => {
        button.classList.toggle("is-active", button.dataset.minimaxPreset === name);
      });
      this.log(`已切换到“${preset.label}”。可以运行搜索查看候选评估与搜索树。`);
    }

    undoMove() {
      if (!this.board.history.length) {
        return;
      }
      this.board.undo(1);
      this.board.result = null;
      this.result = null;
      this.visiblePly = 0;
      this.render();
    }

    clearBoard() {
      this.board.reset();
      this.result = null;
      this.visiblePly = 0;
      this.render();
    }

    allPatternRows() {
      const weights = this.readWeights();
      return [
        ...BUILT_IN_PATTERN_CARDS.map((card) => ({
          ...card,
          score: weights[card.scoreKey],
          builtIn: true,
          editable: false,
          description: PATTERN_DESCRIPTIONS[card.id] || "常用棋形。",
        })),
        ...EXTRA_WEIGHT_CARDS.map((card) => ({
          ...card,
          score: weights[card.scoreKey],
          builtIn: true,
          editable: false,
          description: PATTERN_DESCRIPTIONS[card.id] || "基础权重。",
        })),
        ...this.customPatterns.map((rule) => ({
          ...rule,
          builtIn: false,
          editable: true,
          description: "自定义棋形会参与攻击和防守两侧的静态评分。",
        })),
      ];
    }

    selectedPattern() {
      const rows = this.allPatternRows();
      return rows.find((row) => row.id === this.selectedPatternId) || rows[0];
    }

    addCustomPatternFromEditor() {
      const source = this.selectedPattern();
      const id = `custom-${Date.now().toString(36)}`;
      const pattern = normalizePattern(this.$("minimax-pattern-edit-sequence")?.value || source?.pattern || "01110") || "01110";
      const score = Number(this.$("minimax-pattern-edit-score")?.value || source?.score || 1600);
      const name = this.$("minimax-pattern-edit-name")?.value || "custom";
      this.customPatterns = normalizePatternRules([
        ...this.customPatterns,
        { id, name, pattern, score },
      ]);
      this.selectedPatternId = id;
      this.saveCustomPatterns();
      this.result = null;
      this.render();
    }

    deleteSelectedPattern() {
      const selected = this.selectedPattern();
      if (!selected || selected.builtIn) {
        return;
      }
      this.removeCustomPattern(selected.id);
    }

    removeCustomPattern(id) {
      this.customPatterns = this.customPatterns.filter((rule) => rule.id !== id);
      if (this.selectedPatternId === id) {
        this.selectedPatternId = "open-three";
      }
      this.saveCustomPatterns();
      this.result = null;
      this.render();
    }

    updateSelectedPatternFromEditor() {
      const selected = this.selectedPattern();
      const score = Number(this.$("minimax-pattern-edit-score")?.value);
      this.$("minimax-pattern-edit-score-output").textContent = fmt(score);
      if (selected) {
        this.$("minimax-pattern-current").textContent = selected.name;
        this.$("minimax-pattern-edit-info").textContent = `${selected.builtIn ? "预设棋形" : "自定义棋形"}：${
          selected.description || "参与静态评估。"
        } 当前分数 ${fmt(score)}。`;
      }
      if (!selected) {
        return;
      }
      if (selected.builtIn) {
        if (selected.scoreKey && Number.isFinite(score)) {
          const input = root.document.querySelector(`.minimax-score[data-score-key="${selected.scoreKey}"]`);
          if (input) {
            input.value = String(score);
          }
        }
      } else {
        const pattern = normalizePattern(this.$("minimax-pattern-edit-sequence")?.value);
        const name = this.$("minimax-pattern-edit-name")?.value || "custom";
        this.customPatterns = this.customPatterns.map((rule) =>
          rule.id === selected.id
            ? {
                ...rule,
                name,
                pattern: pattern || rule.pattern,
                score: Number.isFinite(score) ? Math.round(score) : rule.score,
              }
            : rule,
        );
        this.saveCustomPatterns();
      }
      this.result = null;
      this.renderPatternPreviewOnly();
      this.writeEngineCode(true);
      this.renderTree();
    }

    writeEngineCode(force = true, payload = profilePayload(this.readConfig())) {
      const editor = this.$("minimax-engine-code");
      if (!editor) {
        return;
      }
      if (force || !editor.value.trim()) {
        editor.value = engineCodeFromPayload(payload);
      }
    }

    readEnginePayload() {
      const editor = this.$("minimax-engine-code");
      if (!editor || !editor.value.trim()) {
        return null;
      }
      return profilePayloadFromEngineCode(editor.value);
    }

    async saveProfile() {
      let payload;
      try {
        payload = this.readEnginePayload() || profilePayload(this.readConfig());
      } catch (error) {
        this.log(`代码解析失败：${error.message}`);
        return;
      }
      this.applyConfig(payload.config);
      this.writeEngineCode(true, payload);
      const saved = await this.store.save("profiles", {
        id: this.store.nowId("minimax"),
        kind: "minimax",
        name: payload.name,
        config: payload.config,
        schema: payload.schema,
      });
      const latestBot = this.store.list("models").find((row) => row.kind === "personal-bot");
      if (latestBot) {
        await this.store.save("profiles", {
          id: this.store.nowId("hybrid"),
          kind: "hybrid",
          name: `${saved.name} + ${latestBot.name}`,
          config: { ...saved.config, minimaxId: saved.id, botId: latestBot.id, blend: 0.35 },
          schema: payload.schema,
        });
      }
      root.GomokuRefreshEngineOptions?.();
      this.log(`已保存到对战页：${saved.name}`);
    }

    exportProfile() {
      const payload = profilePayload(this.readConfig());
      this.writeEngineCode(true, payload);
      this.log("配置已经生成。想备份的话，可以复制上面的代码");
    }

    async importProfile(event) {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }
      const imported = await this.store.importJson(await file.text());
      if (imported?.config) {
        this.applyConfig(imported.config);
        this.writeEngineCode(true, profilePayload(imported.config, imported.name));
      }
      root.GomokuRefreshEngineOptions?.();
      this.log(`已导入 ${imported.name || imported.id}`);
      event.target.value = "";
    }

    log(message) {
      const target = this.$("minimax-profile-log");
      target.textContent = `${new Date().toLocaleTimeString("zh-CN", { hour12: false })} ${message}\n${target.textContent}`.slice(0, 3000);
    }

    render() {
      const heat = this.result?.candidates || orderedCandidates(this.core, this.board, this.board.current, this.readConfig());
      root.GomokuTrainer?.drawLabBoard(this.$("minimax-board"), this.board, {
        heat: heat.map((move, index) => ({ ...move, probability: Math.max(0.08, 1 - index / Math.max(1, heat.length)) })),
        teacherMove: this.result?.move,
      });
      this.$("minimax-turn").textContent = this.board.current === BLACK ? "黑方" : "白方";
      this.$("minimax-node-count").textContent = `节点 ${this.result?.nodes || 0}`;
      this.$("minimax-best").textContent = this.result?.move ? `最佳 ${this.core.moveName(this.result.move)}` : "最佳 -";
      this.renderPatterns();
      this.writeEngineCode(false);
      this.renderTree();
      this.renderPrincipleNote();
    }

    switchPrinciple(delta) {
      const cards = [...root.document.querySelectorAll(".principle-card")];
      if (!cards.length) {
        return;
      }
      this.principleIndex = (this.principleIndex + delta + cards.length) % cards.length;
      this.principleFlipped = false;
      this.renderPrincipleCards();
    }

    flipPrinciple() {
      this.principleFlipped = !this.principleFlipped;
      this.renderPrincipleCards();
    }

    renderPrincipleCards() {
      root.document.querySelectorAll(".principle-card").forEach((card, index) => {
        card.classList.toggle("is-active", index === this.principleIndex);
        card.classList.toggle("is-flipped", index === this.principleIndex && this.principleFlipped);
      });
    }

    renderPatterns() {
      const menu = this.$("minimax-pattern-menu");
      if (!menu) {
        return;
      }
      const rows = this.allPatternRows();
      if (!rows.some((row) => row.id === this.selectedPatternId)) {
        this.selectedPatternId = rows[0]?.id || "";
      }
      const selected = this.selectedPattern();
      this.$("minimax-pattern-current").textContent = selected ? selected.name : "-";

      menu.replaceChildren();
      const groups = [
        ["基础权重", rows.filter((row) => row.builtIn && row.scoreKey === "center")],
        ["常用棋形", rows.filter((row) => row.builtIn && row.scoreKey !== "center")],
        ["自定义棋形", rows.filter((row) => !row.builtIn)],
      ];
      for (const [title, items] of groups) {
        const group = root.document.createElement("div");
        const heading = root.document.createElement("strong");
        heading.textContent = title;
        group.className = "pattern-menu-group";
        group.append(heading);
        if (!items.length) {
          const empty = root.document.createElement("span");
          empty.className = "pattern-menu-empty";
          empty.textContent = "暂无";
          group.append(empty);
        }
        for (const item of items) {
          group.append(this.renderPatternMenuRow(item));
        }
        menu.append(group);
      }
      this.renderPatternEditor(selected);
    }

    renderPatternMenuRow(row) {
      const item = root.document.createElement("div");
      const button = root.document.createElement("button");
      item.className = "pattern-menu-row";
      item.classList.toggle("is-active", row.id === this.selectedPatternId);
      button.type = "button";
      button.textContent = `${row.name} ${fmt(row.score)}`;
      button.addEventListener("click", () => {
        this.selectedPatternId = row.id;
        this.$("minimax-pattern-picker").open = false;
        this.renderPatterns();
      });
      item.append(button);
      if (!row.builtIn) {
        const remove = root.document.createElement("button");
        remove.type = "button";
        remove.textContent = "删除";
        remove.addEventListener("click", (event) => {
          event.stopPropagation();
          this.removeCustomPattern(row.id);
        });
        item.append(remove);
      }
      return item;
    }

    renderPatternEditor(row = this.selectedPattern()) {
      if (!row) {
        return;
      }
      const name = this.$("minimax-pattern-edit-name");
      const sequence = this.$("minimax-pattern-edit-sequence");
      const slider = this.$("minimax-pattern-edit-score");
      const output = this.$("minimax-pattern-edit-score-output");
      const info = this.$("minimax-pattern-edit-info");
      const del = this.$("minimax-pattern-delete");
      const sourceInput = row.scoreKey ? root.document.querySelector(`.minimax-score[data-score-key="${row.scoreKey}"]`) : null;

      name.value = row.name || "";
      name.disabled = Boolean(row.builtIn);
      sequence.value = row.pattern || "";
      sequence.disabled = Boolean(row.builtIn);
      slider.min = row.builtIn && sourceInput ? sourceInput.min : "-20000";
      slider.max = row.builtIn && sourceInput ? sourceInput.max : "100000";
      slider.step = row.builtIn && sourceInput ? sourceInput.step : "50";
      slider.value = String(row.score || 0);
      output.textContent = fmt(row.score || 0);
      info.textContent = `${row.builtIn ? "预设棋形" : "自定义棋形"}：${row.description || "参与静态评估。"} 当前分数 ${fmt(row.score || 0)}。`;
      del.disabled = Boolean(row.builtIn);
      del.hidden = Boolean(row.builtIn);
      this.renderPatternPreviewOnly(row);
    }

    renderPatternPreviewOnly(row = this.selectedPattern()) {
      const preview = this.$("minimax-pattern-edit-preview");
      if (!preview || !row) {
        return;
      }
      const pattern = normalizePattern(this.$("minimax-pattern-edit-sequence")?.value || row.pattern) || row.pattern || "";
      preview.replaceChildren(renderPatternLine(pattern));
    }

    renderTree() {
      const list = this.$("minimax-tree");
      list.replaceChildren();
      this.renderLayerReadout();
      this.renderPrincipleNote();
      if (!this.result?.tree) {
        const item = root.document.createElement("div");
        item.className = "tree-empty";
        item.textContent = "点击“运行搜索”后，这里会展示候选落点、评分回传与剪枝结果。";
        list.append(item);
        return;
      }

      const meta = root.document.createElement("div");
      meta.className = "tree-meta-grid";
      [
        ["层数", `${this.visiblePly}/${this.result.depth}`],
        ["估值", fmt(this.result.score)],
        ["节点", fmt(this.result.nodes)],
        ["剪枝", this.result.config.alphaBeta ? fmt(this.result.prunes) : "关闭"],
      ].forEach(([key, value]) => {
        const cell = root.document.createElement("span");
        const label = root.document.createElement("em");
        const data = root.document.createElement("strong");
        label.textContent = key;
        data.textContent = value;
        cell.append(label, data);
        meta.append(cell);
      });

      const shell = root.document.createElement("div");
      const stage = root.document.createElement("div");
      shell.className = "tree-stage-shell";
      stage.className = "tree-stage";
      stage.append(this.renderTreeBranch(this.result.tree));
      shell.append(this.renderLayerLabels(), stage);
      list.append(meta, shell, this.renderTreeBottomNote());
    }

    renderLayerReadout() {
      const readout = this.$("minimax-layer-readout");
      if (!readout) {
        return;
      }
      const layer = this.result?.layers?.find((item) => item.ply === this.visiblePly);
      readout.replaceChildren();
      [`第 ${this.visiblePly} 层`, `可见 ${layer?.count || 0}`, `剪枝 ${this.result?.prunes || 0}`].forEach((text) => {
        const span = root.document.createElement("span");
        span.textContent = text;
        readout.append(span);
      });
    }

    renderLayerLabels() {
      const labels = root.document.createElement("div");
      labels.className = "tree-layer-labels";
      for (let ply = 0; ply <= this.visiblePly; ply++) {
        const label = root.document.createElement("span");
        label.className = "tree-layer-label";
        label.style.setProperty("--ply", String(ply));
        label.textContent = `第 ${ply} 层 ${ply % 2 === 0 ? "极大" : "极小"}`;
        labels.append(label);
      }
      return labels;
    }

    renderTreeBranch(node) {
      const branch = root.document.createElement("div");
      branch.className = "tree-branch";
      const edgeLabel = node.cutoffLabel || (node.pruned ? node.pruneReason : "");
      if (edgeLabel) {
        const label = root.document.createElement("span");
        label.className = "tree-edge-label";
        label.textContent = edgeLabel;
        branch.append(label);
      }
      branch.append(this.renderTreeNode(node));
      const children = (node.children || []).filter((child) => child.ply <= this.visiblePly);
      if (children.length) {
        const wrap = root.document.createElement("div");
        wrap.className = "tree-children";
        children.forEach((child) => wrap.append(this.renderTreeBranch(child)));
        branch.append(wrap);
      }
      return branch;
    }

    renderTreeNode(node) {
      const item = root.document.createElement("div");
      item.className = "tree-node";
      item.classList.toggle("is-cut", Boolean(node.causedCutoff || node.cutoff));
      item.classList.toggle("is-pruned", Boolean(node.pruned));
      item.classList.toggle("is-pv", Boolean(node.id && node.id === this.result?.tree.bestChildId));
      const visibleChildren = (node.children || []).filter((child) => child.ply <= this.visiblePly);
      const isVisibleLeaf = node.ply > 0 && visibleChildren.length === 0;

      const top = root.document.createElement("div");
      const move = root.document.createElement("strong");
      const score = root.document.createElement("span");
      top.className = "node-top";
      move.className = "node-move";
      score.className = "node-score";
      move.textContent = node.move ? `${stoneText(node.playerJustMoved)} ${moveText(this.core, node.move)}` : "根节点";
      score.textContent = node.pruned ? "-" : fmt(node.value);
      top.append(move, score);

      const reason = root.document.createElement("div");
      reason.className = "node-reason";
      const reasonText = node.pruned || String(node.reason || "").startsWith("剪枝") ? "" : node.reason || "搜索";
      reason.textContent = reasonText;

      item.append(top);
      if (!isVisibleLeaf && reason.textContent) {
        item.append(reason);
      }
      return item;
    }

    renderTreeBottomNote() {
      const note = root.document.createElement("div");
      note.className = "tree-bottom-note";
      if (!this.result) {
        note.textContent = "这里会补充它最后怎么给局面打分。";
        return note;
      }
      const weights = this.result.config.weights || this.readWeights();
      note.textContent = `最后打分时，它会参考连五 ${fmt(weights.five)}、活四 ${fmt(
        weights.openFour,
      )}、冲四 ${fmt(weights.four)}、活三 ${fmt(weights.openThree)}、眠三 ${fmt(weights.three)}，再把分数传回第一步。`;
      return note;
    }

    renderPrincipleNote() {
      const target = this.$("minimax-principle-note");
      if (!target) {
        return;
      }
      if (!this.result) {
        target.textContent = "先运行一次搜索，再展开搜索树，可查看模型为何选择当前推荐落点。";
        return;
      }
      const layer = this.result.layers.find((item) => item.ply === this.visiblePly);
      if (this.visiblePly === 0) {
        target.textContent = `第 0 层就是当前局面：现在轮到 ${stoneText(this.board.current)}方，它会先挑几个看起来最有希望的位置。`;
        return;
      }
      if (this.visiblePly >= this.result.depth) {
        target.textContent = `第 ${this.visiblePly} 层已经看到尽头：它按棋形给局面打分，再把分数传回来。本次看了 ${this.result.nodes} 个点，跳过 ${this.result.prunes} 条没必要的路。`;
        return;
      }
      const role = this.visiblePly % 2 === 0 ? "极大" : "极小";
      const goal = role === "极大" ? "它在找对自己更好的走法" : "它在假设对手会挑更难受的回应";
      const prune = this.result.config.alphaBeta
        ? `明显不会影响结果的路线会被跳过。当前可见 ${layer?.count || 0} 个节点，已经跳过 ${this.result.prunes} 条。`
        : "现在没有跳过分支，所以每条候选都会继续展开。";
      target.textContent = `第 ${this.visiblePly} 层是${role}层：${goal}。${prune}`;
    }
  }

  function renderPatternLine(pattern) {
    const line = root.document.createElement("div");
    line.className = "pattern-line";
    line.style.setProperty("--cells", String(pattern.length));
    for (const ch of pattern) {
      const cell = root.document.createElement("span");
      cell.className = "pattern-cell";
      if (ch === "1") {
        cell.classList.add("own");
      } else if (ch === "2") {
        cell.classList.add("rival");
      } else if (ch === "3") {
        cell.classList.add("edge");
      }
      line.append(cell);
    }
    return line;
  }

  function mount() {
    if (!root.document || !root.GomokuLabCore || !root.GomokuModelStore || !root.document.getElementById("minimax-board")) {
      return null;
    }
    if (root.gomokuMinimaxLab) {
      return root.gomokuMinimaxLab;
    }
    root.gomokuMinimaxLab = new MinimaxLab();
    return root.gomokuMinimaxLab;
  }

  if (root.document) {
    root.addEventListener("DOMContentLoaded", mount);
  }

  return {
    DEFAULT_WEIGHTS,
    BUILT_IN_PATTERN_CARDS,
    profileScore,
    normalizePattern,
    normalizePatternRules,
    customPatternScore,
    evaluateBoard,
    orderedCandidates,
    buildSearch,
    profilePayload,
    mount,
  };
});
