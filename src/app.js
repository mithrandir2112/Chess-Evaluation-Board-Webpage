const PIECES = {
  K: "♔",
  Q: "♕",
  R: "♖",
  B: "♗",
  N: "♘",
  P: "♙",
  k: "♚",
  q: "♛",
  r: "♜",
  b: "♝",
  n: "♞",
  p: "♟"
};

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const FILES = "abcdefgh";
const RANKS = "87654321";
const SAMPLE_PGN = `[Event "Sample"]
[Site "Local"]
[Date "2026.05.26"]
[Round "-"]
[White "White"]
[Black "Black"]
[Result "*"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O *`;

const state = {
  game: createGame(),
  history: [],
  activePly: 0,
  bestMove: null,
  analyzing: false,
  analysisId: 0,
  pointerDrag: null
};

const els = {
  pgnInput: document.querySelector("#pgnInput"),
  parseBtn: document.querySelector("#parseBtn"),
  clearBtn: document.querySelector("#clearBtn"),
  sampleBtn: document.querySelector("#sampleBtn"),
  status: document.querySelector("#status"),
  board: document.querySelector("#board"),
  moveList: document.querySelector("#moveList"),
  firstBtn: document.querySelector("#firstBtn"),
  prevBtn: document.querySelector("#prevBtn"),
  nextBtn: document.querySelector("#nextBtn"),
  lastBtn: document.querySelector("#lastBtn"),
  analyzeBtn: document.querySelector("#analyzeBtn"),
  positionLabel: document.querySelector("#positionLabel"),
  blackEvalFill: document.querySelector("#blackEvalFill"),
  whiteEvalFill: document.querySelector("#whiteEvalFill"),
  positionEval: document.querySelector("#positionEval"),
  bestMove: document.querySelector("#bestMove"),
  evalScore: document.querySelector("#evalScore"),
  pvLine: document.querySelector("#pvLine"),
  engineName: document.querySelector("#engineName")
};

els.pgnInput.value = SAMPLE_PGN;
els.parseBtn.addEventListener("click", parsePgnFromInput);
els.clearBtn.addEventListener("click", clearApp);
els.sampleBtn.addEventListener("click", () => {
  els.pgnInput.value = SAMPLE_PGN;
  parsePgnFromInput();
});
els.firstBtn.addEventListener("click", () => setActivePly(0));
els.prevBtn.addEventListener("click", () => setActivePly(Math.max(0, state.activePly - 1)));
els.nextBtn.addEventListener("click", () => setActivePly(Math.min(state.history.length - 1, state.activePly + 1)));
els.lastBtn.addEventListener("click", () => setActivePly(state.history.length - 1));
els.analyzeBtn.addEventListener("click", analyzeCurrentPosition);

parsePgnFromInput();

function createGame() {
  return gameFromFen(START_FEN);
}

function gameFromFen(fen) {
  const [placement, turn, castling, ep, halfmove, fullmove] = fen.split(/\s+/);
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));
  placement.split("/").forEach((rank, r) => {
    let c = 0;
    for (const ch of rank) {
      if (/\d/.test(ch)) c += Number(ch);
      else board[r][c++] = ch;
    }
  });
  return {
    board,
    turn,
    castling: castling === "-" ? "" : castling,
    ep,
    halfmove: Number(halfmove || 0),
    fullmove: Number(fullmove || 1)
  };
}

function cloneGame(game) {
  return {
    board: game.board.map((row) => [...row]),
    turn: game.turn,
    castling: game.castling,
    ep: game.ep,
    halfmove: game.halfmove,
    fullmove: game.fullmove
  };
}

function parsePgnFromInput() {
  try {
    const tokens = tokenizePgn(els.pgnInput.value);
    const game = createGame();
    const history = [{ game: cloneGame(game), san: "Start", move: null }];

    for (const token of tokens) {
      const move = findMoveFromSan(game, token);
      if (!move) throw new Error(`Could not parse move "${token}".`);
      applyMove(game, move);
      history.push({ game: cloneGame(game), san: token, move });
    }

    state.game = game;
    state.history = history;
    state.activePly = history.length - 1;
    state.bestMove = null;
    setStatus(`Loaded ${tokens.length} moves. Select any position and run analysis.`);
    render();
  } catch (error) {
    setStatus(error.message, true);
  }
}

function tokenizePgn(pgn) {
  return pgn
    .replace(/\{[^}]*}/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*]/g, " ")
    .replace(/\d+\.(\.\.)?/g, " ")
    .replace(/\$\d+/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => !["1-0", "0-1", "1/2-1/2", "*"].includes(token));
}

function setActivePly(ply) {
  state.activePly = ply;
  state.bestMove = null;
  render();
}

function clearApp() {
  els.pgnInput.value = "";
  state.history = [{ game: createGame(), san: "Start", move: null }];
  state.activePly = 0;
  state.bestMove = null;
  setStatus("Ready for a PGN.");
  render();
}

function render() {
  const current = state.history[state.activePly]?.game || createGame();
  renderBoard(current);
  renderEvaluationBar(current);
  renderMoveList();
  renderAnalysis(current);
  updateControls();
}

function renderBoard(game) {
  els.board.innerHTML = "";
  const arrow = createArrowLayer(state.bestMove);

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const square = document.createElement("div");
      const name = coordsToSquare(r, c);
      const piece = game.board[r][c];
      square.className = `square ${(r + c) % 2 ? "dark" : "light"}`;
      if (state.bestMove?.from === name) square.classList.add("from");
      if (state.bestMove?.to === name) square.classList.add("to");
      square.dataset.square = name;
      square.addEventListener("dragover", handleDragOver);
      square.addEventListener("drop", handleDrop);

      if (piece) {
        const pieceEl = document.createElement("span");
        pieceEl.className = "piece";
        pieceEl.textContent = PIECES[piece];
        pieceEl.draggable = colorOf(piece) === game.turn;
        pieceEl.addEventListener("dragstart", (event) => handleDragStart(event, name));
        pieceEl.addEventListener("pointerdown", (event) => handlePointerDragStart(event, name, piece));
        square.append(pieceEl);
      }

      if (r === 7 || c === 0) {
        const coord = document.createElement("span");
        coord.className = "coord";
        coord.textContent = `${c === 0 ? RANKS[r] : ""}${r === 7 ? FILES[c] : ""}`;
        square.append(coord);
      }

      els.board.append(square);
    }
  }

  els.board.append(arrow);
}

function createArrowLayer(move) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "arrow-layer");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("preserveAspectRatio", "none");

  if (!move) return svg;

  const from = squareCenter(move.from);
  const to = squareCenter(move.to);
  const shortened = shortenArrow(from, to);
  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
  marker.setAttribute("id", "arrowhead");
  marker.setAttribute("markerWidth", "2.75");
  marker.setAttribute("markerHeight", "2.75");
  marker.setAttribute("refX", "2.25");
  marker.setAttribute("refY", "1.125");
  marker.setAttribute("orient", "auto");
  const head = document.createElementNS("http://www.w3.org/2000/svg", "path");
  head.setAttribute("d", "M0,0 L0,2.25 L2.625,1.125 z");
  head.setAttribute("fill", "var(--arrow)");
  marker.append(head);
  defs.append(marker);

  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("x1", shortened.x1);
  line.setAttribute("y1", shortened.y1);
  line.setAttribute("x2", shortened.x2);
  line.setAttribute("y2", shortened.y2);
  line.setAttribute("stroke", "var(--arrow)");
  line.setAttribute("stroke-width", "2.45");
  line.setAttribute("stroke-linecap", "round");
  line.setAttribute("marker-end", "url(#arrowhead)");
  line.setAttribute("opacity", "0.84");

  svg.append(defs, line);
  return svg;
}

function renderMoveList() {
  els.moveList.innerHTML = "";
  const moves = state.history.slice(1);

  for (let i = 0; i < moves.length; i += 2) {
    const pair = document.createElement("div");
    pair.className = "move-pair";

    const moveNo = document.createElement("span");
    moveNo.className = "move-number";
    moveNo.textContent = `${i / 2 + 1}.`;
    pair.append(moveNo);

    pair.append(createMoveButton(moves[i], i + 1));
    pair.append(moves[i + 1] ? createMoveButton(moves[i + 1], i + 2) : document.createElement("span"));
    els.moveList.append(pair);
  }
}

function createMoveButton(entry, ply) {
  const button = document.createElement("button");
  button.className = "move-token";
  if (ply === state.activePly) button.classList.add("active");
  button.textContent = entry.san;
  button.addEventListener("click", () => setActivePly(ply));
  return button;
}

function handleDragStart(event, from) {
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", from);
}

function handleDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
}

function handleDrop(event) {
  event.preventDefault();
  const from = event.dataTransfer.getData("text/plain");
  const to = event.currentTarget.dataset.square;
  if (!from || !to || from === to) return;
  playMove(from, to);
}

function handlePointerDragStart(event, from, piece) {
  if (event.button !== 0 || colorOf(piece) !== state.history[state.activePly].game.turn) return;
  event.preventDefault();
  const ghost = document.createElement("div");
  ghost.className = "piece drag-ghost";
  ghost.textContent = PIECES[piece];
  document.body.append(ghost);
  state.pointerDrag = { from, ghost };
  moveDragGhost(event);
  document.addEventListener("pointermove", handlePointerDragMove);
  document.addEventListener("pointerup", handlePointerDragEnd, { once: true });
}

function handlePointerDragMove(event) {
  if (!state.pointerDrag) return;
  event.preventDefault();
  moveDragGhost(event);
}

function handlePointerDragEnd(event) {
  if (!state.pointerDrag) return;
  event.preventDefault();
  const { from, ghost } = state.pointerDrag;
  ghost.remove();
  state.pointerDrag = null;
  document.removeEventListener("pointermove", handlePointerDragMove);

  const targetSquare = document.elementFromPoint(event.clientX, event.clientY)?.closest(".square")?.dataset.square;
  if (!targetSquare || targetSquare === from) return;
  playMove(from, targetSquare);
}

function moveDragGhost(event) {
  const ghost = state.pointerDrag?.ghost;
  if (!ghost) return;
  ghost.style.left = `${event.clientX}px`;
  ghost.style.top = `${event.clientY}px`;
}

function playMove(from, to) {
  const game = cloneGame(state.history[state.activePly].game);
  const move = legalMoves(game).find((candidate) => {
    if (candidate.from !== from || candidate.to !== to) return false;
    return !candidate.promotion || candidate.promotion === "q";
  });

  if (!move) {
    setStatus("That move is not legal in the current position.", true);
    return;
  }

  const san = moveToSan(game, move);
  applyMove(game, move);
  state.history = [
    ...state.history.slice(0, state.activePly + 1),
    { game: cloneGame(game), san, move }
  ];
  state.activePly = state.history.length - 1;
  state.bestMove = null;
  setStatus(`Played ${san}. Updating best move...`);
  render();
  analyzeCurrentPosition({ automatic: true });
}

function renderEvaluationBar(game) {
  const score = evaluate(game);
  const whitePercent = scoreToWhitePercent(score);
  const blackPercent = 100 - whitePercent;
  els.whiteEvalFill.style.height = `${whitePercent}%`;
  els.blackEvalFill.style.height = `${blackPercent}%`;
  els.positionEval.textContent = formatEval(score);
  els.positionEval.style.color = score > 25 ? "#0b5e58" : score < -25 ? "#202936" : "var(--muted)";
}

function renderAnalysis(game) {
  const currentScore = evaluate(game);
  els.evalScore.textContent = formatEval(currentScore);

  if (state.bestMove) {
    els.bestMove.textContent = `${state.bestMove.san || state.bestMove.uci}`;
    els.pvLine.textContent = state.bestMove.pv?.join(" ") || state.bestMove.uci;
  } else {
    els.bestMove.textContent = "-";
    els.pvLine.textContent = "-";
  }
}

function updateControls() {
  const hasHistory = state.history.length > 1;
  els.firstBtn.disabled = state.activePly === 0;
  els.prevBtn.disabled = state.activePly === 0;
  els.nextBtn.disabled = state.activePly >= state.history.length - 1;
  els.lastBtn.disabled = !hasHistory || state.activePly >= state.history.length - 1;
  els.analyzeBtn.disabled = state.analyzing;
  els.parseBtn.disabled = state.analyzing;
  els.positionLabel.textContent = state.activePly === 0 ? "Start position" : `After ${state.history[state.activePly].san}`;
}

async function analyzeCurrentPosition(options = {}) {
  const game = cloneGame(state.history[state.activePly].game);
  const analysisId = ++state.analysisId;
  state.analyzing = true;
  state.bestMove = null;
  if (!options.automatic) setStatus("Analyzing selected position...");
  render();

  await new Promise((resolve) => setTimeout(resolve, 80));
  const best = findBestMove(game, 3);
  if (analysisId !== state.analysisId) return;
  state.bestMove = best;
  state.analyzing = false;
  els.engineName.textContent = "Prototype evaluator";
  setStatus(best ? `Best move found: ${best.san || best.uci}.` : "No legal moves in this position.");
  render();
}

function setStatus(message, isError = false) {
  els.status.textContent = message;
  els.status.classList.toggle("error", isError);
}

function findMoveFromSan(game, san) {
  const target = normalizeSan(san);
  return legalMoves(game).find((move) => normalizeSan(moveToSan(game, move)) === target);
}

function normalizeSan(san) {
  return san.replace(/[+#?!]+/g, "").replace(/0/g, "O");
}

function legalMoves(game) {
  const pseudo = pseudoMoves(game);
  return pseudo.filter((move) => {
    const next = cloneGame(game);
    applyMove(next, move);
    return !isKingInCheck(next, game.turn);
  });
}

function pseudoMoves(game) {
  const moves = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = game.board[r][c];
      if (!piece || colorOf(piece) !== game.turn) continue;
      collectPieceMoves(game, r, c, piece, moves);
    }
  }
  return moves;
}

function collectPieceMoves(game, r, c, piece, moves) {
  const color = colorOf(piece);
  const type = piece.toLowerCase();
  const forward = color === "w" ? -1 : 1;
  const from = coordsToSquare(r, c);

  if (type === "p") {
    const one = r + forward;
    if (inBounds(one, c) && !game.board[one][c]) {
      addPawnMove(moves, from, piece, one, c, false);
      const start = color === "w" ? 6 : 1;
      const two = r + forward * 2;
      if (r === start && !game.board[two][c]) moves.push({ from, to: coordsToSquare(two, c), piece, flag: "double" });
    }
    for (const dc of [-1, 1]) {
      const tr = r + forward;
      const tc = c + dc;
      if (!inBounds(tr, tc)) continue;
      const target = game.board[tr][tc];
      if (target && colorOf(target) !== color) addPawnMove(moves, from, piece, tr, tc, true, target);
      if (game.ep !== "-" && coordsToSquare(tr, tc) === game.ep) {
        moves.push({ from, to: game.ep, piece, capture: true, flag: "ep" });
      }
    }
    return;
  }

  if (type === "n") {
    for (const [dr, dc] of [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]) {
      addStepMove(game, moves, from, piece, r + dr, c + dc);
    }
    return;
  }

  if (type === "k") {
    for (const dr of [-1, 0, 1]) {
      for (const dc of [-1, 0, 1]) {
        if (dr || dc) addStepMove(game, moves, from, piece, r + dr, c + dc);
      }
    }
    addCastleMoves(game, moves, r, c, piece);
    return;
  }

  const directions = {
    b: [[-1, -1], [-1, 1], [1, -1], [1, 1]],
    r: [[-1, 0], [1, 0], [0, -1], [0, 1]],
    q: [[-1, -1], [-1, 1], [1, -1], [1, 1], [-1, 0], [1, 0], [0, -1], [0, 1]]
  }[type];

  for (const [dr, dc] of directions) {
    let tr = r + dr;
    let tc = c + dc;
    while (inBounds(tr, tc)) {
      const target = game.board[tr][tc];
      if (!target) {
        moves.push({ from, to: coordsToSquare(tr, tc), piece });
      } else {
        if (colorOf(target) !== color) moves.push({ from, to: coordsToSquare(tr, tc), piece, capture: target });
        break;
      }
      tr += dr;
      tc += dc;
    }
  }
}

function addPawnMove(moves, from, piece, r, c, capture, captured = null) {
  const rank = RANKS[r];
  if (rank === "8" || rank === "1") {
    for (const promotion of ["q", "r", "b", "n"]) {
      moves.push({ from, to: coordsToSquare(r, c), piece, capture: captured || capture, promotion });
    }
  } else {
    moves.push({ from, to: coordsToSquare(r, c), piece, capture: captured || capture });
  }
}

function addStepMove(game, moves, from, piece, r, c) {
  if (!inBounds(r, c)) return;
  const target = game.board[r][c];
  if (!target || colorOf(target) !== colorOf(piece)) {
    moves.push({ from, to: coordsToSquare(r, c), piece, capture: target || false });
  }
}

function addCastleMoves(game, moves, r, c, piece) {
  const color = colorOf(piece);
  if (isKingInCheck(game, color)) return;
  if (color === "w" && r === 7 && c === 4) {
    if (game.castling.includes("K") && !game.board[7][5] && !game.board[7][6] && !isAttacked(game, 7, 5, "b") && !isAttacked(game, 7, 6, "b")) {
      moves.push({ from: "e1", to: "g1", piece, flag: "castle" });
    }
    if (game.castling.includes("Q") && !game.board[7][1] && !game.board[7][2] && !game.board[7][3] && !isAttacked(game, 7, 3, "b") && !isAttacked(game, 7, 2, "b")) {
      moves.push({ from: "e1", to: "c1", piece, flag: "castle" });
    }
  }
  if (color === "b" && r === 0 && c === 4) {
    if (game.castling.includes("k") && !game.board[0][5] && !game.board[0][6] && !isAttacked(game, 0, 5, "w") && !isAttacked(game, 0, 6, "w")) {
      moves.push({ from: "e8", to: "g8", piece, flag: "castle" });
    }
    if (game.castling.includes("q") && !game.board[0][1] && !game.board[0][2] && !game.board[0][3] && !isAttacked(game, 0, 3, "w") && !isAttacked(game, 0, 2, "w")) {
      moves.push({ from: "e8", to: "c8", piece, flag: "castle" });
    }
  }
}

function applyMove(game, move) {
  const [fr, fc] = squareToCoords(move.from);
  const [tr, tc] = squareToCoords(move.to);
  const piece = game.board[fr][fc];
  const captured = game.board[tr][tc];

  game.board[fr][fc] = null;
  game.board[tr][tc] = move.promotion ? promotePiece(piece, move.promotion) : piece;

  if (move.flag === "ep") {
    game.board[fr][tc] = null;
  }

  if (move.flag === "castle") {
    if (move.to === "g1") moveRook(game, "h1", "f1");
    if (move.to === "c1") moveRook(game, "a1", "d1");
    if (move.to === "g8") moveRook(game, "h8", "f8");
    if (move.to === "c8") moveRook(game, "a8", "d8");
  }

  updateCastling(game, move, piece, captured);
  game.ep = move.flag === "double" ? coordsToSquare((fr + tr) / 2, fc) : "-";
  game.halfmove = piece.toLowerCase() === "p" || captured ? 0 : game.halfmove + 1;
  if (game.turn === "b") game.fullmove += 1;
  game.turn = game.turn === "w" ? "b" : "w";
}

function moveRook(game, from, to) {
  const [fr, fc] = squareToCoords(from);
  const [tr, tc] = squareToCoords(to);
  game.board[tr][tc] = game.board[fr][fc];
  game.board[fr][fc] = null;
}

function updateCastling(game, move, piece, captured) {
  const remove = (rights) => {
    for (const right of rights) game.castling = game.castling.replace(right, "");
  };
  if (piece === "K") remove("KQ");
  if (piece === "k") remove("kq");
  if (move.from === "a1" || move.to === "a1" || captured === "R") remove("Q");
  if (move.from === "h1" || move.to === "h1" || captured === "R") remove("K");
  if (move.from === "a8" || move.to === "a8" || captured === "r") remove("q");
  if (move.from === "h8" || move.to === "h8" || captured === "r") remove("k");
}

function moveToSan(game, move) {
  if (move.flag === "castle") return move.to.endsWith("g1") || move.to.endsWith("g8") ? "O-O" : "O-O-O";

  const type = move.piece.toUpperCase() === "P" ? "" : move.piece.toUpperCase();
  const capture = move.capture ? "x" : "";
  const dest = move.to;
  const promotion = move.promotion ? `=${move.promotion.toUpperCase()}` : "";
  const disambiguation = type ? disambiguate(game, move) : "";
  const pawnFile = !type && capture ? move.from[0] : "";
  const next = cloneGame(game);
  applyMove(next, move);
  const check = isKingInCheck(next, next.turn) ? "+" : "";
  return `${type}${disambiguation}${pawnFile}${capture}${dest}${promotion}${check}`;
}

function disambiguate(game, move) {
  const [fr, fc] = squareToCoords(move.from);
  const candidates = pseudoMoves(game).filter((other) => {
    if (other.from === move.from || other.to !== move.to || other.piece !== move.piece) return false;
    const next = cloneGame(game);
    applyMove(next, other);
    return !isKingInCheck(next, game.turn);
  });
  if (!candidates.length) return "";
  const sameFile = candidates.some((other) => squareToCoords(other.from)[1] === fc);
  const sameRank = candidates.some((other) => squareToCoords(other.from)[0] === fr);
  if (!sameFile) return move.from[0];
  if (!sameRank) return move.from[1];
  return move.from;
}

function isKingInCheck(game, color) {
  const king = color === "w" ? "K" : "k";
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (game.board[r][c] === king) return isAttacked(game, r, c, color === "w" ? "b" : "w");
    }
  }
  return false;
}

function isAttacked(game, r, c, byColor) {
  const pawnDir = byColor === "w" ? -1 : 1;
  for (const dc of [-1, 1]) {
    const pr = r - pawnDir;
    const pc = c + dc;
    if (inBounds(pr, pc) && game.board[pr][pc]?.toLowerCase() === "p" && colorOf(game.board[pr][pc]) === byColor) return true;
  }

  for (const [dr, dc] of [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]) {
    const piece = game.board[r + dr]?.[c + dc];
    if (piece?.toLowerCase() === "n" && colorOf(piece) === byColor) return true;
  }

  for (const dr of [-1, 0, 1]) {
    for (const dc of [-1, 0, 1]) {
      if (!dr && !dc) continue;
      const piece = game.board[r + dr]?.[c + dc];
      if (piece?.toLowerCase() === "k" && colorOf(piece) === byColor) return true;
    }
  }

  return rayAttacked(game, r, c, byColor, [[-1, -1], [-1, 1], [1, -1], [1, 1]], "bq")
    || rayAttacked(game, r, c, byColor, [[-1, 0], [1, 0], [0, -1], [0, 1]], "rq");
}

function rayAttacked(game, r, c, byColor, dirs, attackers) {
  for (const [dr, dc] of dirs) {
    let tr = r + dr;
    let tc = c + dc;
    while (inBounds(tr, tc)) {
      const piece = game.board[tr][tc];
      if (piece) {
        if (colorOf(piece) === byColor && attackers.includes(piece.toLowerCase())) return true;
        break;
      }
      tr += dr;
      tc += dc;
    }
  }
  return false;
}

function findBestMove(game, depth) {
  const best = chooseBestMove(game, depth);
  if (!best) return null;

  const san = moveToSan(game, best.move);
  const pv = principalVariation(game, best.move, depth);
  return { ...best.move, san, uci: `${best.move.from}${best.move.to}${best.move.promotion || ""}`, score: best.score, pv };
}

function chooseBestMove(game, depth) {
  const moves = orderMoves(game, legalMoves(game));
  if (!moves.length) return null;

  let bestMove = null;
  let bestScore = game.turn === "w" ? -Infinity : Infinity;
  for (const move of moves) {
    const next = cloneGame(game);
    applyMove(next, move);
    const score = minimax(next, depth - 1, -Infinity, Infinity);
    if ((game.turn === "w" && score > bestScore) || (game.turn === "b" && score < bestScore)) {
      bestScore = score;
      bestMove = move;
    }
  }
  return { move: bestMove, score: bestScore };
}

function minimax(game, depth, alpha, beta) {
  const moves = legalMoves(game);
  if (depth === 0 || !moves.length) {
    if (!moves.length && isKingInCheck(game, game.turn)) return game.turn === "w" ? -100000 : 100000;
    return evaluate(game);
  }

  if (game.turn === "w") {
    let value = -Infinity;
    for (const move of orderMoves(game, moves)) {
      const next = cloneGame(game);
      applyMove(next, move);
      value = Math.max(value, minimax(next, depth - 1, alpha, beta));
      alpha = Math.max(alpha, value);
      if (alpha >= beta) break;
    }
    return value;
  }

  let value = Infinity;
  for (const move of orderMoves(game, moves)) {
    const next = cloneGame(game);
    applyMove(next, move);
    value = Math.min(value, minimax(next, depth - 1, alpha, beta));
    beta = Math.min(beta, value);
    if (alpha >= beta) break;
  }
  return value;
}

function principalVariation(game, firstMove, depth) {
  const line = [];
  let current = cloneGame(game);
  let move = firstMove;
  for (let i = 0; i < depth && move; i++) {
    line.push(moveToSan(current, move));
    applyMove(current, move);
    move = chooseBestMove(current, Math.max(1, depth - i - 1))?.move;
  }
  return line;
}

function orderMoves(game, moves) {
  return [...moves].sort((a, b) => moveGuess(game, b) - moveGuess(game, a));
}

function moveGuess(game, move) {
  const [, , tr, tc] = [...squareToCoords(move.from), ...squareToCoords(move.to)];
  const captured = game.board[tr][tc];
  return (captured ? pieceValue(captured) * 10 : 0) + (move.promotion ? pieceValue(move.promotion) : 0);
}

function evaluate(game) {
  let score = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = game.board[r][c];
      if (!piece) continue;
      const sign = colorOf(piece) === "w" ? 1 : -1;
      const center = 3.5 - Math.max(Math.abs(3.5 - r), Math.abs(3.5 - c));
      score += sign * (pieceValue(piece) + center * 3);
    }
  }
  return score;
}

function pieceValue(piece) {
  return { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 }[piece.toLowerCase()];
}

function formatEval(score) {
  if (Math.abs(score) > 90000) return score > 0 ? "White mates" : "Black mates";
  const pawns = Math.abs(score / 100).toFixed(2);
  if (Math.abs(score) < 10) return "Equal";
  return score >= 0 ? `White +${pawns}` : `Black +${pawns}`;
}

function scoreToWhitePercent(score) {
  if (score > 90000) return 100;
  if (score < -90000) return 0;
  const capped = Math.max(-600, Math.min(600, score));
  return 50 + capped / 12;
}

function colorOf(piece) {
  return piece === piece.toUpperCase() ? "w" : "b";
}

function promotePiece(piece, promotion) {
  return colorOf(piece) === "w" ? promotion.toUpperCase() : promotion.toLowerCase();
}

function inBounds(r, c) {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

function coordsToSquare(r, c) {
  return `${FILES[c]}${RANKS[r]}`;
}

function squareToCoords(square) {
  return [RANKS.indexOf(square[1]), FILES.indexOf(square[0])];
}

function squareCenter(square) {
  const [r, c] = squareToCoords(square);
  return {
    x: c * 12.5 + 6.25,
    y: r * 12.5 + 6.25
  };
}

function shortenArrow(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const startInset = 2.4;
  const endInset = 4.7;
  return {
    x1: from.x + (dx / length) * startInset,
    y1: from.y + (dy / length) * startInset,
    x2: to.x - (dx / length) * endInset,
    y2: to.y - (dy / length) * endInset
  };
}
