((root, factory) => {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.GomokuRules = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  "use strict";

  const SIZE = 15;
  const EMPTY = 0;
  const BLACK = 1;
  const WHITE = 2;
  const LATEST_BLACK = 3;
  const LATEST_WHITE = 4;
  const LINE_RADIUS = 4;
  const LINE_LENGTH = LINE_RADIUS * 2 + 1;
  const LINE_CENTER = LINE_RADIUS;
  const EDGE_MARK = "4";
  const MAX_TRUE_THREE_RECURSION = 4;
  const DIRECTIONS = [
    [0, 1],
    [1, 0],
    [1, -1],
    [1, 1],
  ];
  const THREE_PATTERNS = ["01110", "010110", "011010"];
  const FOUR_PATTERNS = ["011110", "10111", "11011", "11101", "011112", "011114", "211110", "411110"];
  const BAN_LABELS = {
    0: "OK",
    1: "DOUBLE-THREE",
    2: "DOUBLE-FOUR",
    3: "LONG",
  };

  function boardSize(board) {
    return Number(board?.size) || SIZE;
  }

  function inside(board, row, col) {
    if (board && typeof board.inside === "function") {
      return board.inside(row, col);
    }
    const size = boardSize(board);
    return row >= 0 && row < size && col >= 0 && col < size;
  }

  function getStone(board, row, col) {
    if (board && typeof board.get === "function") {
      return board.get(row, col);
    }
    const size = boardSize(board);
    if (board?.cells) {
      return board.cells[row * size + col];
    }
    if (Array.isArray(board)) {
      return board[row]?.[col] ?? EMPTY;
    }
    return EMPTY;
  }

  function setStone(board, row, col, value) {
    if (board && typeof board.set === "function") {
      board.set(row, col, value);
      return;
    }
    const size = boardSize(board);
    if (board?.cells) {
      board.cells[row * size + col] = value;
      return;
    }
    if (Array.isArray(board)) {
      board[row][col] = value;
      return;
    }
    throw new TypeError("board must provide set(row, col, value) or cells");
  }

  function isBlackState(state) {
    return state === BLACK || state === LATEST_BLACK;
  }

  function isWhiteState(state) {
    return state === WHITE || state === LATEST_WHITE;
  }

  function stateToMark(state) {
    if (isBlackState(state)) {
      return "1";
    }
    if (isWhiteState(state)) {
      return "2";
    }
    return "0";
  }

  function buildLine(board, row, col, dx, dy) {
    let line = "";
    for (let i = 0; i < LINE_LENGTH; i++) {
      const offset = i - LINE_CENTER;
      const x = row + offset * dx;
      const y = col + offset * dy;
      line += inside(board, x, y) ? stateToMark(getStone(board, x, y)) : EDGE_MARK;
    }
    return line;
  }

  function matchTouchesCurrentMove(start, patternLength) {
    const end = start + patternLength - 1;
    return start <= LINE_CENTER && LINE_CENTER <= end;
  }

  function lineHasPattern(board, row, col, dx, dy, patterns) {
    const line = buildLine(board, row, col, dx, dy);
    for (const pattern of patterns) {
      let start = line.indexOf(pattern);
      while (start !== -1) {
        if (matchTouchesCurrentMove(start, pattern.length)) {
          return true;
        }
        start = line.indexOf(pattern, start + 1);
      }
    }
    return false;
  }

  function countPatternDirections(board, row, col, patterns) {
    let count = 0;
    for (const [dx, dy] of DIRECTIONS) {
      if (lineHasPattern(board, row, col, dx, dy, patterns)) {
        count++;
      }
    }
    return count;
  }

  function countSide(board, row, col, dx, dy) {
    let count = 0;
    for (let step = 1; ; step++) {
      const x = row + step * dx;
      const y = col + step * dy;
      if (!inside(board, x, y) || !isBlackState(getStone(board, x, y))) {
        break;
      }
      count++;
    }
    return count;
  }

  function lineBlackCount(board, row, col, dx, dy) {
    return 1 + countSide(board, row, col, dx, dy) + countSide(board, row, col, -dx, -dy);
  }

  function hasExactFive(board, row, col) {
    return DIRECTIONS.some(([dx, dy]) => lineBlackCount(board, row, col, dx, dy) === 5);
  }

  function directionHasExactFive(board, row, col, dx, dy) {
    return lineBlackCount(board, row, col, dx, dy) === 5;
  }

  function offsetAlongDirection(fromRow, fromCol, toRow, toCol, dx, dy) {
    const rowDelta = toRow - fromRow;
    const colDelta = toCol - fromCol;
    if (dx === 0) {
      return rowDelta === 0 && colDelta % dy === 0 ? colDelta / dy : null;
    }
    if (dy === 0) {
      return colDelta === 0 && rowDelta % dx === 0 ? rowDelta / dx : null;
    }
    if (rowDelta % dx !== 0 || colDelta % dy !== 0) {
      return null;
    }
    const rowOffset = rowDelta / dx;
    const colOffset = colDelta / dy;
    return rowOffset === colOffset ? rowOffset : null;
  }

  function directionExactFiveIncludes(board, row, col, targetRow, targetCol, dx, dy) {
    if (!directionHasExactFive(board, row, col, dx, dy)) {
      return false;
    }
    const offset = offsetAlongDirection(row, col, targetRow, targetCol, dx, dy);
    if (offset === null) {
      return false;
    }
    return -countSide(board, row, col, -dx, -dy) <= offset && offset <= countSide(board, row, col, dx, dy);
  }

  function longBan(board, row, col) {
    return DIRECTIONS.some(([dx, dy]) => lineBlackCount(board, row, col, dx, dy) > 5);
  }

  function directionCells(board, row, col, dx, dy) {
    let startRow = row;
    let startCol = col;
    while (inside(board, startRow - dx, startCol - dy)) {
      startRow -= dx;
      startCol -= dy;
    }

    const cells = [];
    for (let x = startRow, y = startCol; inside(board, x, y); x += dx, y += dy) {
      cells.push([x, y]);
    }
    return cells;
  }

  function withTemporaryStone(board, row, col, value, fn) {
    const previous = getStone(board, row, col);
    setStone(board, row, col, value);
    try {
      return fn();
    } finally {
      setStone(board, row, col, previous);
    }
  }

  function winningExtensionsInDirection(board, row, col, dx, dy) {
    const extensions = [];
    for (const [x, y] of directionCells(board, row, col, dx, dy)) {
      if (getStone(board, x, y) !== EMPTY) {
        continue;
      }
      const makesFive = withTemporaryStone(board, x, y, BLACK, () =>
        directionExactFiveIncludes(board, x, y, row, col, dx, dy),
      );
      if (makesFive) {
        extensions.push([x, y]);
      }
    }
    return extensions;
  }

  function stepDistance(a, b) {
    return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
  }

  function hasWinningExtensionPair(extensions, distance) {
    for (let i = 0; i < extensions.length; i++) {
      for (let j = i + 1; j < extensions.length; j++) {
        if (stepDistance(extensions[i], extensions[j]) === distance) {
          return true;
        }
      }
    }
    return false;
  }

  function hasTightWinningExtensionPair(extensions) {
    for (let i = 0; i < extensions.length; i++) {
      for (let j = i + 1; j < extensions.length; j++) {
        if (stepDistance(extensions[i], extensions[j]) < 5) {
          return true;
        }
      }
    }
    return false;
  }

  function countFoursInDirection(board, row, col, dx, dy) {
    if (lineBlackCount(board, row, col, dx, dy) >= 5) {
      return 0;
    }
    const extensions = winningExtensionsInDirection(board, row, col, dx, dy);
    if (hasTightWinningExtensionPair(extensions)) {
      return 2;
    }
    return extensions.length > 0 ? 1 : 0;
  }

  function isFourDirection(board, row, col, dx, dy) {
    return countFoursInDirection(board, row, col, dx, dy) > 0;
  }

  function countFourDirections(board, row, col) {
    let count = 0;
    for (const [dx, dy] of DIRECTIONS) {
      count += countFoursInDirection(board, row, col, dx, dy);
    }
    return count;
  }

  function hasOpenFourInDirection(board, row, col, dx, dy) {
    if (lineBlackCount(board, row, col, dx, dy) >= 5) {
      return false;
    }
    return hasWinningExtensionPair(winningExtensionsInDirection(board, row, col, dx, dy), 5);
  }

  function candidateThreeExtensions(board, row, col, dx, dy) {
    const result = [];
    for (let step = -LINE_RADIUS; step <= LINE_RADIUS; step++) {
      if (step === 0) {
        continue;
      }
      const x = row + step * dx;
      const y = col + step * dy;
      if (inside(board, x, y) && getStone(board, x, y) === EMPTY) {
        result.push([x, y]);
      }
    }
    return result;
  }

  function legalFourExtension(board, row, col, dx, dy, depth, requireOpenFour) {
    return withTemporaryStone(board, row, col, BLACK, () => {
      const createsFour = requireOpenFour
        ? hasOpenFourInDirection(board, row, col, dx, dy)
        : countFoursInDirection(board, row, col, dx, dy) > 0;
      return createsFour && !isForbiddenPlaced(board, row, col, depth + 1);
    });
  }

  function isForbiddenPlaced(board, row, col, depth) {
    if (depth > MAX_TRUE_THREE_RECURSION) {
      return false;
    }
    if (hasExactFive(board, row, col)) {
      return false;
    }
    if (longBan(board, row, col)) {
      return true;
    }
    if (countFourDirections(board, row, col) >= 2) {
      return true;
    }
    if (countPatternDirections(board, row, col, THREE_PATTERNS) <= 1) {
      return false;
    }
    return countTrueOpenThreeDirections(board, row, col, depth + 1) >= 2;
  }

  function isLegalBlackExtension(board, row, col, depth) {
    return withTemporaryStone(board, row, col, BLACK, () => !isForbiddenPlaced(board, row, col, depth));
  }

  function isSameLineF3S(board, row, col, dx, dy, depth) {
    const line = buildLine(board, row, col, dx, dy);
    const pattern = "101101";
    let start = line.indexOf(pattern);
    while (start !== -1) {
      if (matchTouchesCurrentMove(start, pattern.length)) {
        let legalExtensions = 0;
        for (let i = 0; i < pattern.length; i++) {
          if (pattern[i] !== "0") {
            continue;
          }
          const offset = start + i - LINE_CENTER;
          const x = row + offset * dx;
          const y = col + offset * dy;
          if (inside(board, x, y) && getStone(board, x, y) === EMPTY && legalFourExtension(board, x, y, dx, dy, depth, false)) {
            legalExtensions++;
          }
        }
        if (legalExtensions >= 2) {
          return true;
        }
      }
      start = line.indexOf(pattern, start + 1);
    }
    return false;
  }

  function isTrueOpenThreeDirection(board, row, col, dx, dy, depth) {
    if (!lineHasPattern(board, row, col, dx, dy, THREE_PATTERNS)) {
      return false;
    }
    if (lineBlackCount(board, row, col, dx, dy) >= 5 || isFourDirection(board, row, col, dx, dy)) {
      return false;
    }

    if (isSameLineF3S(board, row, col, dx, dy, depth)) {
      return true;
    }

    for (const [x, y] of candidateThreeExtensions(board, row, col, dx, dy)) {
      if (legalFourExtension(board, x, y, dx, dy, depth, true)) {
        return true;
      }
    }
    return false;
  }

  function countTrueOpenThreeDirections(board, row, col, depth = 0) {
    let count = 0;
    for (const [dx, dy] of DIRECTIONS) {
      if (isTrueOpenThreeDirection(board, row, col, dx, dy, depth)) {
        count++;
      }
    }
    return count;
  }

  function threeBan(board, row, col) {
    if (!inside(board, row, col) || !isBlackState(getStone(board, row, col)) || hasExactFive(board, row, col)) {
      return false;
    }
    if (countPatternDirections(board, row, col, THREE_PATTERNS) <= 1) {
      return false;
    }
    return countTrueOpenThreeDirections(board, row, col) > 1;
  }

  function fourBan(board, row, col) {
    if (!inside(board, row, col) || !isBlackState(getStone(board, row, col)) || hasExactFive(board, row, col)) {
      return false;
    }
    return countFourDirections(board, row, col) > 1;
  }

  function banInfo(board, row, col) {
    if (!inside(board, row, col) || !isBlackState(getStone(board, row, col))) {
      return { code: 0, label: BAN_LABELS[0] };
    }
    if (hasExactFive(board, row, col)) {
      return { code: 0, label: BAN_LABELS[0] };
    }
    if (longBan(board, row, col)) {
      return { code: 3, label: BAN_LABELS[3] };
    }
    if (fourBan(board, row, col)) {
      return { code: 2, label: BAN_LABELS[2] };
    }
    if (threeBan(board, row, col)) {
      return { code: 1, label: BAN_LABELS[1] };
    }
    return { code: 0, label: BAN_LABELS[0] };
  }

  function checkMove(board, row, col, player) {
    if (!inside(board, row, col)) {
      return { ok: false, reason: "OUT" };
    }
    if (getStone(board, row, col) !== EMPTY) {
      return { ok: false, reason: "OCCUPIED" };
    }
    if (isBlackState(player)) {
      const ban = withTemporaryStone(board, row, col, BLACK, () => banInfo(board, row, col));
      if (ban.code !== 0) {
        return { ok: false, reason: ban.label, ban };
      }
    }
    return { ok: true, reason: BAN_LABELS[0] };
  }

  return Object.freeze({
    SIZE,
    EMPTY,
    BLACK,
    WHITE,
    LATEST_BLACK,
    LATEST_WHITE,
    DIRECTIONS,
    THREE_PATTERNS,
    FOUR_PATTERNS,
    BAN_LABELS,
    buildLine,
    lineHasPattern,
    countPatternDirections,
    countFourDirections,
    countTrueOpenThreeDirections,
    threeBan,
    fourBan,
    longBan,
    banInfo,
    checkMove,
  });
});
