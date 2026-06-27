((root, factory) => {
  const api = factory(root || {});
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.GomokuTrainer = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, (root) => {
  "use strict";

  const SIZE = 15;
  const EMPTY = 0;
  const BLACK = 1;
  const WHITE = 2;
  const FEATURE_NAMES = [
    "attack",
    "defense",
    "ownWin",
    "ownOpenFour",
    "ownFour",
    "ownOpenThree",
    "ownThree",
    "rivalWin",
    "rivalOpenFour",
    "rivalFour",
    "rivalOpenThree",
    "rivalThree",
    "center",
    "r1Own",
    "r1Rival",
    "r1Empty",
    "r2Own",
    "r2Rival",
    "r2Empty",
    "progress",
    "row",
    "col",
    "nearLast",
    "forbidden",
  ];
  const INPUTS = FEATURE_NAMES.length;
  const H1 = 32;
  const H2 = 16;
  const MODEL_VERSION = 2;
  const SAMPLE_VERSION = 2;
  const DEFAULT_VALUE_LOSS_WEIGHT = 0.35;
  const SAMPLE_POOL_LIMIT = 32768;
  const AUGMENT_TRANSFORMS = 8;
  const TRAIN_PRESETS = Object.freeze({
    quick: { label: "少量", epochs: 8, rate: 24, batch: 32, temperature: 16, sampleTarget: 512, teacherTimeMs: 180 },
    normal: { label: "适中", epochs: 30, rate: 18, batch: 128, temperature: 14, sampleTarget: 4096, teacherTimeMs: 260 },
    strong: { label: "大量", epochs: 80, rate: 12, batch: 256, temperature: 12, sampleTarget: 12000, teacherTimeMs: 320 },
    gpu4060: { label: "烤机", epochs: 160, rate: 8, batch: 512, temperature: 10, sampleTarget: 32768, teacherTimeMs: 360 },
  });
  const SAMPLE_SOURCE_LABELS = Object.freeze({
    v4: "现成模型",
    "human-style": "我的棋谱",
    unknown: "其他",
  });

  function seededRandom(seedText) {
    let seed = 2166136261;
    for (const ch of String(seedText || "gomoku")) {
      seed ^= ch.charCodeAt(0);
      seed = Math.imul(seed, 16777619);
    }
    return () => {
      seed += 0x6d2b79f5;
      let t = seed;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeArray(length, fill = 0) {
    return Array.from({ length }, () => fill);
  }

  function createModel(seed = "gomoku-apprentice", generation = 0) {
    const rand = seededRandom(seed);
    const weights = {
      w1: makeArray(H1 * INPUTS).map(() => (rand() - 0.5) * 0.18),
      b1: makeArray(H1),
      w2: makeArray(H2 * H1).map(() => (rand() - 0.5) * 0.16),
      b2: makeArray(H2),
      wPolicy: makeArray(H2).map(() => (rand() - 0.5) * 0.12),
      bPolicy: 0,
      wValue: makeArray(H2).map(() => (rand() - 0.5) * 0.08),
      bValue: 0,
    };
    return {
      format: "gomoku-personal-bot",
      version: MODEL_VERSION,
      id: `bot-${Date.now().toString(36)}`,
      kind: "personal-bot",
      name: `gomoku-apprentice-${String(generation).padStart(2, "0")}`,
      generation,
      featureSchema: SAMPLE_VERSION,
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
      },
    };
  }

  function ensureModel(model) {
    if (!model || !model.weights) {
      return createModel("gomoku-apprentice", 0);
    }
    const weights = model.weights;
    if (!Array.isArray(weights.wPolicy)) {
      weights.wPolicy = Array.isArray(weights.w3) ? weights.w3.slice() : makeArray(H2);
    }
    if (!Number.isFinite(Number(weights.bPolicy))) {
      weights.bPolicy = Number(weights.b3) || 0;
    }
    if (!Array.isArray(weights.wValue)) {
      weights.wValue = makeArray(H2);
    }
    if (!Number.isFinite(Number(weights.bValue))) {
      weights.bValue = 0;
    }
    for (const [key, length] of [
      ["w1", H1 * INPUTS],
      ["b1", H1],
      ["w2", H2 * H1],
      ["b2", H2],
      ["wPolicy", H2],
      ["wValue", H2],
    ]) {
      if (!Array.isArray(weights[key])) {
        weights[key] = makeArray(length);
      }
      while (weights[key].length < length) {
        weights[key].push(0);
      }
      if (weights[key].length > length) {
        weights[key] = weights[key].slice(0, length);
      }
    }
    model.format = "gomoku-personal-bot";
    model.version = MODEL_VERSION;
    model.kind = "personal-bot";
    model.featureSchema = SAMPLE_VERSION;
    model.metrics = {
      samples: 0,
      loss: null,
      policyLoss: null,
      valueLoss: null,
      top1: 0,
      top3: 0,
      valueMae: null,
      rating: 1000,
      ...(model.metrics || {}),
    };
    return model;
  }

  function relu(value) {
    return value > 0 ? value : 0;
  }

  function forwardOne(model, input) {
    const safeModel = ensureModel(model);
    const { w1, b1, w2, b2, wPolicy, bPolicy, wValue, bValue } = safeModel.weights;
    const z1 = makeArray(H1);
    const a1 = makeArray(H1);
    const z2 = makeArray(H2);
    const a2 = makeArray(H2);
    for (let h = 0; h < H1; h++) {
      let sum = b1[h];
      const offset = h * INPUTS;
      for (let i = 0; i < INPUTS; i++) {
        sum += w1[offset + i] * input[i];
      }
      z1[h] = sum;
      a1[h] = relu(sum);
    }
    for (let h = 0; h < H2; h++) {
      let sum = b2[h];
      const offset = h * H1;
      for (let i = 0; i < H1; i++) {
        sum += w2[offset + i] * a1[i];
      }
      z2[h] = sum;
      a2[h] = relu(sum);
    }
    let logit = bPolicy;
    let valueRaw = bValue;
    for (let i = 0; i < H2; i++) {
      logit += wPolicy[i] * a2[i];
      valueRaw += wValue[i] * a2[i];
    }
    return { logit, value: Math.tanh(valueRaw), valueRaw, z1, a1, z2, a2 };
  }

  function softmax(values, temperature = 1) {
    const temp = Math.max(0.05, temperature);
    const max = Math.max(...values);
    const exps = values.map((value) => Math.exp((value - max) / temp));
    const sum = exps.reduce((total, value) => total + value, 0) || 1;
    return exps.map((value) => value / sum);
  }

  function teacherSoftmax(candidates, temperature = 1.4) {
    const scores = candidates.map((move) => Math.max(-8000, Math.min(8000, Number(move.score) || 0)) / 1000);
    return softmax(scores, temperature);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function normalizePolicy(values, length) {
    const policy = Array.isArray(values) ? values.slice(0, length) : [];
    while (policy.length < length) {
      policy.push(0);
    }
    const safe = policy.map((value) => (Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : 0));
    const sum = safe.reduce((total, value) => total + value, 0);
    if (sum > 0) {
      return safe.map((value) => value / sum);
    }
    return safe.map((_, index) => (index === 0 ? 1 : 0));
  }

  function sampleValueTarget(sample) {
    const value = Number(sample?.valueTarget ?? sample?.result ?? 0);
    return Number.isFinite(value) ? clamp(value, -1, 1) : 0;
  }

  function predictSample(model, sample) {
    const safeSample = ensureSample(sample);
    const logits = safeSample.features.map((features) => forwardOne(model, features).logit);
    return softmax(logits, 1);
  }

  function predictSampleDetails(model, sample) {
    const safeSample = ensureSample(sample);
    const passes = safeSample.features.map((features) => forwardOne(model, features));
    return {
      policy: softmax(passes.map((pass) => pass.logit), 1),
      values: passes.map((pass) => pass.value),
    };
  }

  function trainOneSample(model, sample, learningRate) {
    const safeSample = ensureSample(sample);
    if (!safeSample?.features?.length || !safeSample?.teacherScores?.length) {
      return { loss: 0, policyLoss: 0, valueLoss: 0, top1: 0, top3: 0, valueMae: 0 };
    }
    ensureModel(model);
    const passes = safeSample.features.map((features) => forwardOne(model, features));
    const probs = softmax(passes.map((pass) => pass.logit), 1);
    const targets = normalizePolicy(safeSample.teacherScores, safeSample.features.length);
    const valueTarget = sampleValueTarget(safeSample);
    const valueLossWeight = Number.isFinite(Number(safeSample.valueLossWeight)) ? Number(safeSample.valueLossWeight) : DEFAULT_VALUE_LOSS_WEIGHT;
    const grads = {
      w1: makeArray(H1 * INPUTS),
      b1: makeArray(H1),
      w2: makeArray(H2 * H1),
      b2: makeArray(H2),
      wPolicy: makeArray(H2),
      bPolicy: 0,
      wValue: makeArray(H2),
      bValue: 0,
    };
    let policyLoss = 0;
    let valueLoss = 0;
    let valueAbsError = 0;
    for (let c = 0; c < probs.length; c++) {
      const target = targets[c] || 0;
      policyLoss -= target * Math.log(Math.max(1e-8, probs[c]));
      const dLogit = probs[c] - target;
      const pass = passes[c];
      const valueError = pass.value - valueTarget;
      valueLoss += valueError * valueError;
      valueAbsError += Math.abs(valueError);
      const dValueRaw = (2 * valueError * (1 - pass.value * pass.value) * valueLossWeight) / Math.max(1, probs.length);
      grads.bPolicy += dLogit;
      grads.bValue += dValueRaw;
      for (let h = 0; h < H2; h++) {
        grads.wPolicy[h] += dLogit * pass.a2[h];
        grads.wValue[h] += dValueRaw * pass.a2[h];
      }
      const dA2 = makeArray(H2);
      for (let h = 0; h < H2; h++) {
        dA2[h] = (dLogit * model.weights.wPolicy[h] + dValueRaw * model.weights.wValue[h]) * (pass.z2[h] > 0 ? 1 : 0);
        grads.b2[h] += dA2[h];
        const offset = h * H1;
        for (let i = 0; i < H1; i++) {
          grads.w2[offset + i] += dA2[h] * pass.a1[i];
        }
      }
      const dA1 = makeArray(H1);
      for (let i = 0; i < H1; i++) {
        let sum = 0;
        for (let h = 0; h < H2; h++) {
          sum += dA2[h] * model.weights.w2[h * H1 + i];
        }
        dA1[i] = sum * (pass.z1[i] > 0 ? 1 : 0);
        grads.b1[i] += dA1[i];
        const offset = i * INPUTS;
        for (let f = 0; f < INPUTS; f++) {
          grads.w1[offset + f] += dA1[i] * safeSample.features[c][f];
        }
      }
    }
    const scale = learningRate / Math.max(1, sample.features.length);
    for (const key of ["w1", "b1", "w2", "b2", "wPolicy", "wValue"]) {
      for (let i = 0; i < model.weights[key].length; i++) {
        model.weights[key][i] -= grads[key][i] * scale;
      }
    }
    model.weights.bPolicy -= grads.bPolicy * scale;
    model.weights.bValue -= grads.bValue * scale;
    const ranked = probs.map((prob, index) => ({ prob, index })).sort((a, b) => b.prob - a.prob);
    const teacherBest = targets.indexOf(Math.max(...targets));
    const top1 = ranked[0]?.index === teacherBest ? 1 : 0;
    const top3 = ranked.slice(0, 3).some((item) => item.index === teacherBest) ? 1 : 0;
    valueLoss /= Math.max(1, probs.length);
    valueAbsError /= Math.max(1, probs.length);
    const totalLoss = policyLoss + valueLoss * valueLossWeight;
    return { loss: totalLoss, totalLoss, policyLoss, valueLoss, top1, top3, valueMae: valueAbsError };
  }

  function trainEpoch(model, samples, options = {}) {
    ensureModel(model);
    const lr = Number(options.learningRate) || 0.018;
    const valueLossWeight = Number.isFinite(Number(options.valueLossWeight))
      ? Number(options.valueLossWeight)
      : DEFAULT_VALUE_LOSS_WEIGHT;
    let totalLoss = 0;
    let policyLoss = 0;
    let valueLoss = 0;
    let top1 = 0;
    let top3 = 0;
    let valueMae = 0;
    let seen = 0;
    const order = samples.map((_, index) => index);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    for (const index of order) {
      const result = trainOneSample(model, { ...ensureSample(samples[index]), valueLossWeight }, lr);
      totalLoss += result.totalLoss ?? result.loss;
      policyLoss += result.policyLoss ?? result.loss;
      valueLoss += result.valueLoss || 0;
      top1 += result.top1 || 0;
      top3 += result.top3;
      valueMae += result.valueMae || 0;
      seen++;
    }
    return {
      loss: seen ? totalLoss / seen : 0,
      totalLoss: seen ? totalLoss / seen : 0,
      policyLoss: seen ? policyLoss / seen : 0,
      valueLoss: seen ? valueLoss / seen : 0,
      top1: seen ? top1 / seen : 0,
      top3: seen ? top3 / seen : 0,
      valueMae: seen ? valueMae / seen : 0,
    };
  }

  function trainModel(model, samples, options = {}) {
    ensureModel(model);
    const history = [];
    const epochs = Number(options.epochs) || 20;
    for (let epoch = 1; epoch <= epochs; epoch++) {
      const metrics = trainEpoch(model, samples, options);
      history.push({ epoch, ...metrics });
    }
    const latest = history.at(-1) || { loss: 0, top3: 0 };
    model.metrics = {
      ...model.metrics,
      samples: samples.length,
      loss: latest.loss,
      policyLoss: latest.policyLoss,
      valueLoss: latest.valueLoss,
      top1: latest.top1,
      top3: latest.top3,
      valueMae: latest.valueMae,
      rating: Math.round((model.metrics?.rating || 1000) + latest.top3 * 90 + latest.top1 * 45 - latest.loss * 7 - latest.valueMae * 18),
    };
    return { model, history, metrics: model.metrics };
  }

  function scoreToUnit(score) {
    if (!Number.isFinite(score)) {
      return 0;
    }
    return Math.tanh(score / 120000);
  }

  function getCell(board, row, col) {
    return typeof board.get === "function" ? board.get(row, col) : board.cells[row * SIZE + col];
  }

  function inside(board, row, col) {
    return typeof board.inside === "function" ? board.inside(row, col) : row >= 0 && row < SIZE && col >= 0 && col < SIZE;
  }

  function neighborFeatures(board, row, col, player, radius) {
    const rival = player === BLACK ? WHITE : BLACK;
    let own = 0;
    let enemy = 0;
    let empty = 0;
    let total = 0;
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        if (dx === 0 && dy === 0 || Math.max(Math.abs(dx), Math.abs(dy)) !== radius) {
          continue;
        }
        const x = row + dx;
        const y = col + dy;
        if (!inside(board, x, y)) {
          continue;
        }
        total++;
        const stone = getCell(board, x, y);
        if (stone === player) {
          own++;
        } else if (stone === rival) {
          enemy++;
        } else {
          empty++;
        }
      }
    }
    const denom = Math.max(1, total);
    return [own / denom, enemy / denom, empty / denom];
  }

  function featureVector(board, player, move, core = root.GomokuLabCore) {
    const row = move.row ?? Math.floor(move.index / SIZE);
    const col = move.col ?? move.index % SIZE;
    const rival = player === BLACK ? WHITE : BLACK;
    const own = core?.moveShapeProfile?.(board, row, col, player) || {};
    const enemy = core?.moveShapeProfile?.(board, row, col, rival) || {};
    const attack = core?.moveShapeScore ? core.moveShapeScore(board, row, col, player) : 0;
    const defense = core?.moveShapeScore ? core.moveShapeScore(board, row, col, rival) : 0;
    const center = 1 - (Math.abs(row - 7) + Math.abs(col - 7)) / 14;
    const r1 = neighborFeatures(board, row, col, player, 1);
    const r2 = neighborFeatures(board, row, col, player, 2);
    const count = typeof board.countStones === "function" ? board.countStones() : board.cells.filter(Boolean).length;
    const last = board.lastMove || board.history?.at?.(-1);
    const nearLast = last ? Math.max(0, 1 - (Math.abs(row - last.row) + Math.abs(col - last.col)) / 8) : 0;
    const legal = core?.Rules?.checkMove?.(board, row, col, player);
    return [
      scoreToUnit(attack),
      scoreToUnit(defense),
      own.win ? 1 : 0,
      Math.min(1, (own.openFour || 0) / 2),
      Math.min(1, (own.four || 0) / 2),
      Math.min(1, (own.openThree || 0) / 3),
      Math.min(1, (own.three || 0) / 3),
      enemy.win ? 1 : 0,
      Math.min(1, (enemy.openFour || 0) / 2),
      Math.min(1, (enemy.four || 0) / 2),
      Math.min(1, (enemy.openThree || 0) / 3),
      Math.min(1, (enemy.three || 0) / 3),
      center,
      ...r1,
      ...r2,
      count / (SIZE * SIZE),
      (row - 7) / 7,
      (col - 7) / 7,
      nearLast,
      legal && !legal.ok ? 1 : 0,
    ];
  }

  function ensureSample(sample) {
    if (!sample || !sample.features?.length) {
      return sample;
    }
    const length = sample.features.length;
    const teacherScores = normalizePolicy(sample.teacherScores || sample.teacherPolicy, length);
    sample.schema = `gomoku-training-sample/v${SAMPLE_VERSION}`;
    sample.teacherScores = teacherScores;
    sample.teacherPolicy = teacherScores;
    sample.valueTarget = sampleValueTarget(sample);
    sample.candidates = (sample.candidates || []).slice(0, length);
    return sample;
  }

  function sampleFromCandidates(board, player, candidates, teacherScores, meta = {}) {
    const moves = candidates.map((move) => ({
      row: move.row,
      col: move.col,
      index: move.row * SIZE + move.col,
      score: move.score || 0,
      threat: move.threat || 0,
    }));
    const normalizedPolicy = normalizePolicy(teacherScores, moves.length);
    const valueTarget =
      meta.valueTarget !== undefined
        ? sampleValueTarget({ valueTarget: meta.valueTarget })
        : meta.result !== undefined
          ? sampleValueTarget({ result: meta.result })
          : sampleValueTarget({ valueTarget: moves[0] ? scoreToUnit(moves[0].score || 0) : 0 });
    return {
      id: `sample-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      schema: `gomoku-training-sample/v${SAMPLE_VERSION}`,
      board: Array.from(board.cells),
      player,
      legalMoves: moves.map((move) => move.index),
      teacherScores: normalizedPolicy,
      teacherPolicy: normalizedPolicy,
      features: moves.map((move) => featureVector(board, player, move)),
      candidates: moves,
      result: meta.result || 0,
      valueTarget,
      source: meta.source || "teacher",
      chosen: meta.chosen || null,
      createdAt: new Date().toISOString(),
    };
  }

  function transformCoord(row, col, transform) {
    const last = SIZE - 1;
    switch (transform) {
      case 1:
        return { row: col, col: last - row };
      case 2:
        return { row: last - row, col: last - col };
      case 3:
        return { row: last - col, col: row };
      case 4:
        return { row, col: last - col };
      case 5:
        return { row: last - row, col };
      case 6:
        return { row: col, col: row };
      case 7:
        return { row: last - col, col: last - row };
      default:
        return { row, col };
    }
  }

  function transformCells(cells, transform) {
    const output = makeArray(SIZE * SIZE, EMPTY);
    for (let row = 0; row < SIZE; row++) {
      for (let col = 0; col < SIZE; col++) {
        const mapped = transformCoord(row, col, transform);
        output[mapped.row * SIZE + mapped.col] = cells[row * SIZE + col] || EMPTY;
      }
    }
    return output;
  }

  function transformMove(move, transform) {
    const mapped = transformCoord(Number(move.row), Number(move.col), transform);
    return {
      ...move,
      row: mapped.row,
      col: mapped.col,
      index: mapped.row * SIZE + mapped.col,
    };
  }

  function rankCandidates(model, board, player, candidates, core = root.GomokuLabCore) {
    ensureModel(model);
    const features = candidates.map((move) => featureVector(board, player, move, core));
    const passes = features.map((row) => forwardOne(model, row));
    const probs = softmax(passes.map((pass) => pass.logit), 1);
    return candidates
      .map((move, index) => ({
        ...move,
        score: Math.round(probs[index] * 1000000),
        probability: probs[index],
        value: passes[index]?.value || 0,
        features: features[index],
      }))
      .sort((a, b) => b.score - a.score);
  }

  function drawLabBoard(canvas, board, options = {}) {
    if (!canvas || !board) {
      return;
    }
    const ctx = canvas.getContext("2d");
    const size = canvas.width;
    const pad = Math.round(size * 0.09);
    const cell = (size - pad * 2) / (SIZE - 1);
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = getCss("--board-bg", "#fbfbf6");
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = getCss("--ink", "#111111");
    ctx.strokeRect(0.5, 0.5, size - 1, size - 1);
    ctx.strokeStyle = getCss("--grid", "#888888");
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
    const heat = options.heat || [];
    const modelHeat = options.modelHeat || [];
    const max = Math.max(...heat.map((move) => move.probability || move.score || 0), 1);
    for (const move of heat.slice(0, 18)) {
      const x = pad + move.col * cell;
      const y = pad + move.row * cell;
      const weight = (move.probability || move.score || 0) / max;
      ctx.globalAlpha = 0.16 + Math.min(0.52, weight * 0.52);
      ctx.fillStyle = getCss("--ink", "#111111");
      ctx.beginPath();
      ctx.arc(x, y, cell * (0.15 + weight * 0.32), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    const modelMax = Math.max(...modelHeat.map((move) => move.probability || move.score || 0), 1);
    for (const move of modelHeat.slice(0, 18)) {
      const x = pad + move.col * cell;
      const y = pad + move.row * cell;
      const weight = (move.probability || move.score || 0) / modelMax;
      ctx.save();
      ctx.globalAlpha = 0.36 + Math.min(0.44, weight * 0.44);
      ctx.strokeStyle = "#1f8f4d";
      ctx.lineWidth = Math.max(2, cell * 0.08);
      ctx.beginPath();
      ctx.arc(x, y, cell * (0.24 + weight * 0.25), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    drawMarker(ctx, pad, cell, options.teacherMove, "#d33");
    drawMarker(ctx, pad, cell, options.userMove, "#1f8f4d");
    for (let row = 0; row < SIZE; row++) {
      for (let col = 0; col < SIZE; col++) {
        const stone = getCell(board, row, col);
        if (stone === EMPTY) {
          continue;
        }
        const x = pad + col * cell;
        const y = pad + row * cell;
        const r = cell * 0.36;
        ctx.fillStyle = stone === BLACK ? "#111111" : "#ffffff";
        ctx.strokeStyle = "#111111";
        ctx.lineWidth = stone === BLACK ? 2.3 : 1.3;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
  }

  function drawMarker(ctx, pad, cell, move, color) {
    if (!move) {
      return;
    }
    const x = pad + move.col * cell;
    const y = pad + move.row * cell;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.strokeRect(x - cell * 0.43, y - cell * 0.43, cell * 0.86, cell * 0.86);
    ctx.restore();
  }

  function getCss(name, fallback) {
    if (!root.document) {
      return fallback;
    }
    return getComputedStyle(root.document.body).getPropertyValue(name).trim() || fallback;
  }

  function refreshEngineOptions() {
    const store = root.GomokuModelStore;
    if (!root.document || !store) {
      return;
    }
    const selects = [
      "machine-engine",
      "black-engine",
      "white-engine",
      "black-hint-engine",
      "white-hint-engine",
    ]
      .map((id) => root.document.getElementById(id))
      .filter(Boolean);
    const minimax = store.list("profiles").filter((row) => row.kind === "minimax" || row.kind === "hybrid");
    const bots = store.list("models").filter((row) => row.kind === "personal-bot");
    for (const select of selects) {
      const selected = select.value;
      select.querySelectorAll('optgroup[data-lab-engine="true"]').forEach((group) => group.remove());
      if (minimax.length) {
        const group = root.document.createElement("optgroup");
        group.label = "实验室 Minimax";
        group.dataset.labEngine = "true";
        for (const profile of minimax) {
          const option = root.document.createElement("option");
          option.value = `lab:${profile.kind === "hybrid" ? "hybrid" : "minimax"}:${profile.id}`;
          option.textContent = profile.name || profile.id;
          group.append(option);
        }
        select.append(group);
      }
      if (bots.length) {
        const group = root.document.createElement("optgroup");
        group.label = "NN lab(beta)";
        group.dataset.labEngine = "true";
        for (const model of bots) {
          const option = root.document.createElement("option");
          option.value = `lab:bot:${model.id}`;
          option.textContent = `${model.name || model.id} 第${model.generation || 0}代`;
          group.append(option);
        }
        select.append(group);
      }
      if ([...select.options].some((option) => option.value === selected)) {
        select.value = selected;
      }
    }
  }

  function evaluateModelOnSamples(model, samples) {
    ensureModel(model);
    let top1 = 0;
    let top3 = 0;
    let valueMae = 0;
    let seen = 0;
    for (const rawSample of samples) {
      const sample = ensureSample(rawSample);
      if (!sample?.features?.length) {
        continue;
      }
      const details = predictSampleDetails(model, sample);
      const ranked = details.policy.map((prob, index) => ({ prob, index })).sort((a, b) => b.prob - a.prob);
      const teacherBest = sample.teacherScores.indexOf(Math.max(...sample.teacherScores));
      top1 += ranked[0]?.index === teacherBest ? 1 : 0;
      top3 += ranked.slice(0, 3).some((item) => item.index === teacherBest) ? 1 : 0;
      const avgValue = details.values.reduce((sum, value) => sum + value, 0) / Math.max(1, details.values.length);
      valueMae += Math.abs(avgValue - sampleValueTarget(sample));
      seen++;
    }
    return {
      top1: seen ? top1 / seen : 0,
      top3: seen ? top3 / seen : 0,
      valueMae: seen ? valueMae / seen : 0,
    };
  }

  function pct(value) {
    return `${Math.round((Number(value) || 0) * 100)}%`;
  }

  function fmtCount(value) {
    return Number(value || 0).toLocaleString("zh-CN");
  }

  class TrainLab {
    constructor() {
      this.core = root.GomokuLabCore;
      this.store = root.GomokuModelStore;
      this.model = createModel("gomoku-apprentice", 0);
      this.previousModel = null;
      this.samples = [];
      this.history = [];
      this.worker = null;
      this.board = new this.core.BoardModel();
      this.policy = [];
      this.trainPreset = "normal";
      this.$ = (id) => root.document.getElementById(id);
      this.bind();
      this.load();
      this.render();
    }

    async load() {
      await this.store.ready();
      this.samples = this.store
        .list("samples")
        .filter((row) => row.features?.length)
        .map(ensureSample)
        .slice(-SAMPLE_POOL_LIMIT);
      const models = this.store.list("models").filter((row) => row.kind === "personal-bot").map(ensureModel);
      const latest = models[0];
      if (latest) {
        this.model = latest;
      }
      this.previousModel = models[1] || null;
      refreshEngineOptions();
      this.render();
    }

    bind() {
      this.$("train-v4").addEventListener("click", () => this.learnFromV4());
      this.$("train-style").addEventListener("click", () => this.learnStyle());
      this.$("train-start").addEventListener("click", () => this.startTraining());
      this.$("train-pause").addEventListener("click", () => this.pause());
      this.$("train-reset").addEventListener("click", () => this.reset());
      this.$("train-arena").addEventListener("click", () => this.runArena());
      this.$("train-export").addEventListener("click", () => this.exportModel());
      this.$("train-import").addEventListener("click", () => this.$("train-import-file").click());
      this.$("train-import-file").addEventListener("change", (event) => this.importModel(event));
      root.document.querySelectorAll("[data-train-preset]").forEach((button) => {
        button.addEventListener("click", () => this.applyTrainPreset(button.dataset.trainPreset));
      });
      ["train-epochs", "train-rate", "train-batch", "train-temperature"].forEach((id) => {
        this.$(id).addEventListener("input", () => this.syncOutputs());
      });
      this.syncOutputs();
      this.syncPresetButtons();
    }

    syncOutputs() {
      this.$("train-epochs-output").textContent = this.$("train-epochs").value;
      this.$("train-rate-output").textContent = this.learningRate().toFixed(3);
      this.$("train-batch-output").textContent = this.$("train-batch").value;
      this.$("train-temperature-output").textContent = this.temperature().toFixed(1);
    }

    learningRate() {
      return Number(this.$("train-rate").value) / 1000;
    }

    temperature() {
      return Number(this.$("train-temperature").value) / 10;
    }

    applyTrainPreset(name) {
      const preset = TRAIN_PRESETS[name];
      if (!preset) {
        return;
      }
      this.trainPreset = name;
      this.$("train-epochs").value = String(preset.epochs);
      this.$("train-rate").value = String(preset.rate);
      this.$("train-batch").value = String(preset.batch);
      this.$("train-temperature").value = String(preset.temperature);
      this.syncPresetButtons();
      this.syncOutputs();
      this.log(`已切到“${preset.label}”：会准备约 ${fmtCount(preset.sampleTarget)} 道练习题，训练 ${preset.epochs} 轮`);
      this.renderFlow();
    }

    syncPresetButtons() {
      root.document.querySelectorAll("[data-train-preset]").forEach((button) => {
        button.classList.toggle("is-active", button.dataset.trainPreset === this.trainPreset);
      });
    }

    currentPreset() {
      return TRAIN_PRESETS[this.trainPreset] || TRAIN_PRESETS.normal;
    }

    log(message) {
      const target = this.$("train-log");
      target.textContent = `${new Date().toLocaleTimeString("zh-CN", { hour12: false })} ${message}\n${target.textContent}`.slice(0, 4000);
    }

    async learnFromV4() {
      const preset = this.currentPreset();
      const target = Math.min(SAMPLE_POOL_LIMIT, Math.max(preset.sampleTarget || 4096, this.samples.length + 1));
      if (this.samples.length >= target) {
        this.log(`现在已有 ${fmtCount(this.samples.length)} 道练习题，已经够“${preset.label}”使用了`);
        return;
      }
      this.log(`正在调用现成模型出题：目标 ${fmtCount(target)} 道，同一个局面会自动换方向练`);
      let added = 0;
      let games = 0;
      const maxGames = Math.ceil((target - this.samples.length) / (AUGMENT_TRANSFORMS * 20)) + 6;
      while (this.samples.length < target && games < maxGames) {
        const board = new this.core.BoardModel();
        const gameSeed = `v4-distill:${Date.now()}:${games}:${this.samples.length}`;
        const maxPly = 34 + (games % 4) * 4;
        for (let ply = 0; ply < maxPly && !board.result && this.samples.length < target; ply++) {
          const player = board.current;
          const { move, stats } = this.core.teacherSearch(board, player, {
            depth: ply < 8 ? 2 : 1,
            width: preset.sampleTarget >= 12000 ? 18 : 14,
            timeLimitMs: preset.teacherTimeMs || 260,
            seed: `${gameSeed}:${ply}`,
          });
          const candidates = (stats.candidates?.length ? stats.candidates : move ? [move] : []).slice(0, 14);
          if (!move || !candidates.length) {
            break;
          }
          const sample = sampleFromCandidates(board, player, candidates, teacherSoftmax(candidates, this.temperature()), {
            source: "v4",
            chosen: { row: move.row, col: move.col },
            valueTarget: scoreToUnit(stats.score || move.score || 0),
          });
          const variants = this.augmentSample(sample);
          for (const variant of variants) {
            if (this.samples.length >= target) {
              break;
            }
            this.samples.push(variant);
            await this.store.save("samples", variant);
            added++;
          }
          board.applyMove(move.row, move.col, player, "V4", stats);
          if (this.core.ResultJudge.check(board, move.row, move.col, player) === player || this.core.ResultJudge.isFull(board)) {
            break;
          }
          if (added && added % 128 === 0) {
            this.trimSamples();
            this.renderFlow();
            this.$("train-samples").textContent = `数据集 ${fmtCount(this.samples.length)}`;
            await new Promise((resolve) => setTimeout(resolve, 0));
          }
        }
        games++;
      }
      this.trimSamples();
      this.log(`练习题 +${fmtCount(added)}，现在一共有 ${fmtCount(this.samples.length)} 道`);
      this.previewLatest();
      this.render();
    }

    async learnStyle() {
      const app = root.gomokuApp;
      if (!app?.board?.history?.length) {
        this.log("还没有你的棋谱。先去“对战”页下几手，再回来让它学你的下法");
        return;
      }
      const board = new this.core.BoardModel();
      let added = 0;
      for (const move of app.board.history) {
        const player = board.current;
        const candidates = this.core.legalCandidates(board, player, { limit: 14 });
        if (!candidates.some((item) => item.row === move.row && item.col === move.col)) {
          candidates.push({ row: move.row, col: move.col, score: 0, threat: 0 });
        }
        const rawScores = candidates.map((item) =>
          item.row === move.row && item.col === move.col ? 0.86 : 0.14 / Math.max(1, candidates.length - 1),
        );
        const total = rawScores.reduce((sum, value) => sum + value, 0) || 1;
        const sample = sampleFromCandidates(board, player, candidates, rawScores.map((value) => value / total), {
          source: "human-style",
          chosen: { row: move.row, col: move.col },
          valueTarget: app.board.result?.type === "win" ? (app.board.result.winner === player ? 1 : -1) : 0,
        });
        for (const variant of this.augmentSample(sample)) {
          this.samples.push(variant);
          await this.store.save("samples", variant);
          added++;
        }
        board.applyMove(move.row, move.col, player, "STYLE", null);
      }
      this.trimSamples();
      this.log(`已学入你的棋谱，新增 ${fmtCount(added)} 道练习题`);
      this.previewLatest();
      this.render();
    }

    augmentSample(sample) {
      const variants = [];
      const baseScores = sample.teacherScores || sample.teacherPolicy || [];
      for (let transform = 0; transform < AUGMENT_TRANSFORMS; transform++) {
        const cells = transformCells(sample.board, transform);
        const board = this.core.boardFromCells(cells, sample.player);
        const candidates = (sample.candidates || []).map((move) => transformMove(move, transform));
        const chosen = sample.chosen ? transformMove(sample.chosen, transform) : null;
        variants.push(
          sampleFromCandidates(board, sample.player, candidates, baseScores, {
            source: sample.source || "v4",
            chosen,
            valueTarget: sample.valueTarget,
            result: sample.result,
          }),
        );
      }
      return variants;
    }

    trimSamples() {
      if (this.samples.length > SAMPLE_POOL_LIMIT) {
        this.samples = this.samples.slice(-SAMPLE_POOL_LIMIT);
      }
    }

    startTraining() {
      if (!this.samples.length) {
        this.log("还没有练习题。先点“现成模型出题”，或者去对战页下几手再回来");
        return;
      }
      this.pause();
      const epochs = Number(this.$("train-epochs").value);
      const batchSize = Number(this.$("train-batch").value);
      const payload = {
        type: "train",
        model: JSON.parse(JSON.stringify(ensureModel(this.model))),
        samples: this.samples,
        options: {
          epochs,
          learningRate: this.learningRate(),
          batchSize,
          valueLossWeight: DEFAULT_VALUE_LOSS_WEIGHT,
        },
      };
      try {
        this.worker = new Worker("trainer-worker.js");
        this.worker.onmessage = (event) => this.handleWorker(event.data);
        this.worker.onerror = () => {
          this.log("后台训练没有启动成功，先改用当前页面继续练");
          this.pause();
          this.finishTraining(trainModel(payload.model, payload.samples, payload.options));
        };
        this.worker.postMessage(payload);
        this.log(`开始训练：${epochs} 轮，${fmtCount(this.samples.length)} 道练习题，每批 ${fmtCount(batchSize)} 道`);
        this.renderFlow();
      } catch {
        this.finishTraining(trainModel(payload.model, payload.samples, payload.options));
      }
    }

    handleWorker(message) {
      if (message.type === "progress") {
        this.history.push(message.metrics);
        this.render();
      } else if (message.type === "done") {
        this.finishTraining(message);
      } else if (message.type === "error") {
        this.log(`训练失败 ${message.error || "unknown"}`);
        this.pause();
      }
    }

    async finishTraining(result) {
      this.pause();
      this.history = result.history || this.history;
      const oldGeneration = Number(this.model.generation || 0);
      this.previousModel = JSON.parse(JSON.stringify(ensureModel(this.model)));
      this.model = {
        ...ensureModel(result.model),
        id: this.store.nowId("bot"),
        generation: oldGeneration + 1,
        name: `gomoku-apprentice-${String(oldGeneration + 1).padStart(2, "0")}`,
        kind: "personal-bot",
      };
      await this.store.save("models", this.model);
      refreshEngineOptions();
      this.previewLatest();
      this.log(
        `第 ${this.model.generation} 代已经留下来了，误差 ${Number(this.model.metrics.loss).toFixed(3)}，接近程度 ${Math.round(
          (this.model.metrics.top3 || 0) * 100,
        )}%`,
      );
      this.render();
    }

    pause() {
      if (this.worker) {
        this.worker.terminate();
        this.worker = null;
      }
    }

    reset() {
      this.pause();
      this.model = createModel("gomoku-apprentice", 0);
      this.history = [];
      this.policy = [];
      this.log("模型已重练，练习题还保留着");
      this.render();
    }

    runArena() {
      if (!this.samples.length) {
        this.log("还没有练习题，暂时没法查看本次训练效果");
        return;
      }
      const validation = this.samples.slice(-Math.min(80, this.samples.length));
      const current = evaluateModelOnSamples(this.model, validation);
      const previous = this.previousModel ? evaluateModelOnSamples(this.previousModel, validation) : null;
      const score = previous
        ? `现 ${pct(current.top3)} top3 / 旧 ${pct(previous.top3)}`
        : `${Math.round(current.top1 * validation.length)}/${validation.length} top1, ${Math.round(current.top3 * validation.length)}/${validation.length} top3`;
      this.model.metrics = {
        ...this.model.metrics,
        top1: current.top1,
        top3: current.top3,
        valueMae: current.valueMae,
        rating: Math.round(1000 + current.top3 * 230 + current.top1 * 130 - current.valueMae * 35),
      };
      this.$("train-arena-score").textContent = score;
      this.log(`看完了：${score}`);
      this.render();
    }

    async exportModel() {
      const text = JSON.stringify(ensureModel(this.model), null, 2);
      this.store.download(`${this.model.name || "personal-bot"}.json`, text);
      this.log("模型已下载，可以留作备份或分享给别人");
    }

    async importModel(event) {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }
      const imported = await this.store.importJson(await file.text());
      if (imported.kind === "personal-bot") {
        this.previousModel = this.model;
        this.model = ensureModel(imported);
      }
      refreshEngineOptions();
      this.log(`已导入 ${imported.name || imported.id}`);
      this.render();
      event.target.value = "";
    }

    previewLatest() {
      const sample = this.samples.at(-1);
      if (!sample) {
        return;
      }
      this.board = this.core.boardFromCells(sample.board, sample.player);
      const candidates = sample.candidates.map((move, index) => ({ ...move, probability: sample.teacherScores[index] || 0 }));
      this.policy = candidates;
    }

    render() {
      ensureModel(this.model);
      this.$("train-model-name").textContent = this.model.name || "gomoku-apprentice";
      this.$("train-samples").textContent = `数据集 ${fmtCount(this.samples.length)}`;
      this.$("train-generation").textContent = `第 ${this.model.generation || 0} 代`;
      this.$("train-loss").textContent = Number.isFinite(this.model.metrics?.loss) ? this.model.metrics.loss.toFixed(3) : "-";
      this.$("train-policy-loss").textContent = Number.isFinite(this.model.metrics?.policyLoss)
        ? this.model.metrics.policyLoss.toFixed(3)
        : "-";
      this.$("train-value-mae").textContent = Number.isFinite(this.model.metrics?.valueMae)
        ? this.model.metrics.valueMae.toFixed(3)
        : "-";
      this.$("train-top3").textContent = Number.isFinite(this.model.metrics?.top3)
        ? `${pct(this.model.metrics.top1)} / ${pct(this.model.metrics.top3)}`
        : "-";
      this.$("train-rating").textContent = String(this.model.metrics?.rating || 1000);
      this.$("train-dataset-summary").textContent = this.datasetSummary();
      this.renderFlow();
      this.renderChart();
      const modelHeat =
        this.model && this.policy.length ? rankCandidates(this.model, this.board, this.board.current, this.policy, this.core) : [];
      drawLabBoard(this.$("train-board"), this.board, {
        heat: this.policy,
        modelHeat,
        teacherMove: this.policy[0],
        userMove: this.samples.at(-1)?.chosen,
      });
      this.renderPolicyList();
      this.renderGenerationList();
    }

    renderChart() {
      const chart = this.$("train-loss-chart");
      chart.replaceChildren();
      const rows = this.history.slice(-48);
      const max = Math.max(...rows.map((row) => row.loss || row.totalLoss || 0), 1);
      for (const row of rows) {
        const bar = root.document.createElement("span");
        bar.style.setProperty("--h", `${Math.max(4, ((row.loss || row.totalLoss || 0) / max) * 100)}%`);
        bar.title = `E${row.epoch} loss ${Number(row.loss || 0).toFixed(3)} policy ${Number(row.policyLoss || 0).toFixed(
          3,
        )} value ${Number(row.valueLoss || 0).toFixed(3)}`;
        chart.append(bar);
      }
    }

    renderPolicyList() {
      const list = this.$("train-policy-list");
      list.replaceChildren();
      const ranked = this.model && this.policy.length ? rankCandidates(this.model, this.board, this.board.current, this.policy, this.core) : this.policy;
      if (!ranked.length) {
        const item = root.document.createElement("li");
        item.textContent = "有了练习题后，这里会显示它最想下的几个位置";
        list.append(item);
        return;
      }
      const teacherByIndex = new Map(this.policy.map((move) => [move.index ?? move.row * SIZE + move.col, move.probability || 0]));
      const max = Math.max(...ranked.map((move) => Math.abs(move.score || 0)), 1);
      ranked.slice(0, 10).forEach((move, index) => {
        const item = root.document.createElement("li");
        const coord = root.document.createElement("span");
        const bar = root.document.createElement("span");
        const score = root.document.createElement("span");
        const idx = move.index ?? move.row * SIZE + move.col;
        const teacherProb = teacherByIndex.get(idx) || 0;
        const modelProb = move.probability || 0;
        coord.className = "coord";
        bar.className = "bar";
        score.className = "score";
        coord.textContent = `#${index + 1} ${this.core.moveName(move)}`;
        bar.innerHTML = `<span style="--w:${Math.max(4, (Math.abs(move.score || 0) / max) * 100)}%"></span>`;
        score.textContent = `T${Math.round(teacherProb * 100)} M${Math.round(modelProb * 100)} Δ${Math.round(
          (modelProb - teacherProb) * 100,
        )}`;
        item.title = [
          `teacher ${(teacherProb * 100).toFixed(1)}%`,
          `model ${(modelProb * 100).toFixed(1)}%`,
          `value ${(move.value || 0).toFixed(3)}`,
          ...(move.features || []).map((value, i) => `${FEATURE_NAMES[i]} ${value.toFixed(2)}`),
        ].join("\n");
        item.append(coord, bar, score);
        list.append(item);
      });
    }

    datasetSummary() {
      if (!this.samples.length) {
        return "练习题来源 -";
      }
      const counts = new Map();
      for (const sample of this.samples) {
        counts.set(sample.source || "unknown", (counts.get(sample.source || "unknown") || 0) + 1);
      }
      return [...counts.entries()].map(([name, count]) => `${SAMPLE_SOURCE_LABELS[name] || name} ${fmtCount(count)}`).join(" / ");
    }

    renderFlow() {
      const status = this.$("train-flow-status");
      if (!status) {
        return;
      }
      const preset = this.currentPreset();
      const generation = Number(this.model?.generation || 0);
      const isTraining = Boolean(this.worker);
      const hasSamples = this.samples.length > 0;
      const steps = [
        ["train-step-data", hasSamples, !hasSamples],
        ["train-step-train", generation > 0, hasSamples && generation === 0 && !isTraining],
        ["train-step-test", Boolean(this.model?.metrics?.top3), generation > 0 && !this.model?.metrics?.top3],
        ["train-step-save", generation > 0, generation > 0],
      ];
      for (const [id, done, live] of steps) {
        const item = this.$(id);
        if (!item) {
          continue;
        }
        item.classList.toggle("is-done", Boolean(done));
        item.classList.toggle("is-live", Boolean(live || (id === "train-step-train" && isTraining)));
      }
      if (isTraining) {
        status.textContent = `正在训练：已有 ${fmtCount(this.samples.length)} / ${fmtCount(preset.sampleTarget)} 道练习题，保持页面打开就好。`;
      } else if (!hasSamples) {
        status.textContent = `先准备练习题。“${preset.label}”大约需要 ${fmtCount(preset.sampleTarget)} 道。`;
      } else if (generation === 0) {
        status.textContent = `已有 ${fmtCount(this.samples.length)} / ${fmtCount(preset.sampleTarget)} 道练习题，可以继续补题，也可以先练起来。`;
      } else {
        status.textContent = `第 ${generation} 代已经蒸馏，练习题 ${fmtCount(this.samples.length)} / ${fmtCount(
          preset.sampleTarget,
        )}。`;
      }
    }

    renderGenerationList() {
      const list = this.$("train-generation-list");
      if (!list) {
        return;
      }
      list.replaceChildren();
      const rows = this.store.list("models").filter((row) => row.kind === "personal-bot").slice(0, 8);
      if (!rows.length) {
        const item = root.document.createElement("li");
        item.textContent = "训练完成后，这里会留下记录";
        list.append(item);
        return;
      }
      for (const row of rows) {
        const item = root.document.createElement("li");
        const name = root.document.createElement("strong");
        const meta = root.document.createElement("span");
        name.textContent = row.name || row.id;
        meta.textContent = `G${row.generation || 0} L${Number(row.metrics?.loss || 0).toFixed(2)} ${pct(row.metrics?.top3)}`;
        item.append(name, meta);
        list.append(item);
      }
    }
  }

  function mountTrainLab() {
    if (!root.document || !root.GomokuLabCore || !root.GomokuModelStore || !root.document.getElementById("train-board")) {
      return null;
    }
    if (root.gomokuTrainLab) {
      return root.gomokuTrainLab;
    }
    root.GomokuLabCore.registerLabEngine("bot", {
      findBestMove(board, player, config) {
        const started = performance.now();
        const model = root.GomokuModelStore.getCached("models", config.labEngineId);
        const tactical = root.GomokuLabCore.findTacticalMove(board, player);
        if (tactical) {
          return {
            move: tactical,
            stats: root.GomokuLabCore.makeLabStats(config.version, tactical, [tactical], tactical.reason || "TACTIC", {
              durationMs: performance.now() - started,
            }),
          };
        }
        const candidates = root.GomokuLabCore.legalCandidates(board, player, { limit: config.candidateLimit || 32 });
        const ranked = model ? rankCandidates(model, board, player, candidates, root.GomokuLabCore) : candidates;
        const move = ranked[0] || null;
        return {
          move,
          stats: root.GomokuLabCore.makeLabStats(config.version, move, ranked, model ? "PERSONAL-BOT" : "BOT-MISSING", {
            nodes: ranked.length,
            durationMs: performance.now() - started,
          }),
        };
      },
    });
    root.GomokuRefreshEngineOptions = refreshEngineOptions;
    root.addEventListener("gomoku-store-changed", refreshEngineOptions);
    root.gomokuTrainLab = new TrainLab();
    return root.gomokuTrainLab;
  }

  if (root.document) {
    root.addEventListener("DOMContentLoaded", mountTrainLab);
  }

  return {
    FEATURE_NAMES,
    INPUTS,
    createModel,
    ensureModel,
    forwardOne,
    softmax,
    teacherSoftmax,
    trainEpoch,
    trainModel,
    predictSample,
    predictSampleDetails,
    featureVector,
    ensureSample,
    sampleFromCandidates,
    rankCandidates,
    drawLabBoard,
    mountTrainLab,
  };
});
