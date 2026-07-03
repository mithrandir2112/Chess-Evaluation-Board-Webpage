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
const DEFAULT_STOCKFISH_DEPTH = 14;
const PIECE_STYLES = ["classic", "modern", "minimal", "vector", "broadcast"];
const PIECE_PALETTES = ["black-white", "ivory-charcoal", "high-contrast", "michigan-pieces", "steel-charcoal"];
const RED_WINGS_INCOMPATIBLE_PALETTES = new Set(["black-white", "ivory-charcoal", "high-contrast"]);
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
  engineScore: null,
  engineDepth: 0,
  engineName: "Stockfish 18 Lite",
  engineStatus: "idle",
  candidates: [],
  analysisDepth: clampDepth(Number(readPreference("chess-analysis-depth", DEFAULT_STOCKFISH_DEPTH))),
  analyzing: false,
  analysisId: 0,
  pointerDrag: null,
  selectedSquare: null,
  players: { white: "Player 1", black: "Player 2" },
  inputFormat: "pgn",
  orientation: readPreference("chess-board-orientation", "white"),
  boardTheme: readPreference("chess-board-theme", "ice-blue"),
  pieceStyle: readPreference("chess-piece-style", "classic"),
  piecePalette: readPreference("chess-piece-palette", null)
};
state.paletteBeforeRestrictedTheme = null;

if (state.pieceStyle === "contrast") {
  state.pieceStyle = "classic";
  state.piecePalette ||= "high-contrast";
}
if (!PIECE_STYLES.includes(state.pieceStyle)) state.pieceStyle = "classic";
if (!PIECE_PALETTES.includes(state.piecePalette)) state.piecePalette = "black-white";

const els = {
  pgnInput: document.querySelector("#pgnInput"),
  parseBtn: document.querySelector("#parseBtn"),
  clearBtn: document.querySelector("#clearBtn"),
  sampleBtn: document.querySelector("#sampleBtn"),
  status: document.querySelector("#status"),
  stage: document.querySelector(".stage"),
  boardArea: document.querySelector(".board-area"),
  boardStack: document.querySelector(".board-stack"),
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
  pvLine: document.querySelector("#pvLine"),
  engineName: document.querySelector("#engineName"),
  engineDepth: document.querySelector("#engineDepth"),
  depthSelect: document.querySelector("#depthSelect"),
  customDepthControl: document.querySelector("#customDepthControl"),
  customDepthInput: document.querySelector("#customDepthInput"),
  stopBtn: document.querySelector("#stopBtn"),
  analysisProgress: document.querySelector("#analysisProgress"),
  depthWarning: document.querySelector("#depthWarning"),
  candidateList: document.querySelector("#candidateList"),
  moveCount: document.querySelector("#moveCount"),
  themeToggle: document.querySelector("#themeToggle"),
  themeLabel: document.querySelector("#themeLabel"),
  flipBoardBtn: document.querySelector("#flipBoardBtn"),
  boardThemeSelect: document.querySelector("#boardThemeSelect"),
  pieceStyleSelect: document.querySelector("#pieceStyleSelect"),
  piecePaletteSelect: document.querySelector("#piecePaletteSelect"),
  evalBar: document.querySelector("#evalBar"),
  evalTopLabel: document.querySelector("#evalTopLabel"),
  evalBottomLabel: document.querySelector("#evalBottomLabel"),
  topPlayer: document.querySelector("#topPlayer"),
  topPlayerName: document.querySelector("#topPlayerName"),
  topPlayerColor: document.querySelector("#topPlayerColor"),
  bottomPlayer: document.querySelector("#bottomPlayer"),
  bottomPlayerName: document.querySelector("#bottomPlayerName"),
  bottomPlayerColor: document.querySelector("#bottomPlayerColor")
};

const stockfishEngine = new window.StockfishEngine({
  workerUrl: new URL("./public/vendor/stockfish/stockfish-18-lite-single.js", document.baseURI).href
});
let automaticAnalysisTimer = null;

applyPreferences();
updateDepthControls();

els.pgnInput.value = SAMPLE_PGN;
els.parseBtn.addEventListener("click", parseNotationFromInput);
els.clearBtn.addEventListener("click", clearApp);
els.sampleBtn.addEventListener("click", () => {
  els.pgnInput.value = SAMPLE_PGN;
  parseNotationFromInput();
});
els.firstBtn.addEventListener("click", () => setActivePly(0));
els.prevBtn.addEventListener("click", () => setActivePly(Math.max(0, state.activePly - 1)));
els.nextBtn.addEventListener("click", () => setActivePly(Math.min(state.history.length - 1, state.activePly + 1)));
els.lastBtn.addEventListener("click", () => setActivePly(state.history.length - 1));
els.analyzeBtn.addEventListener("click", analyzeCurrentPosition);
els.stopBtn.addEventListener("click", stopAnalysis);
els.depthSelect.addEventListener("change", handleDepthSelection);
els.customDepthInput.addEventListener("input", handleCustomDepthInput);
els.customDepthInput.addEventListener("change", handleCustomDepthChange);
els.themeToggle.addEventListener("click", toggleTheme);
els.flipBoardBtn.addEventListener("click", flipBoard);
els.boardThemeSelect.addEventListener("change", (event) => setBoardTheme(event.target.value));
els.pieceStyleSelect.addEventListener("change", (event) => setPieceStyle(event.target.value));
els.piecePaletteSelect.addEventListener("change", (event) => setPiecePalette(event.target.value));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") clearPieceSelection();
});

setupResponsiveBoard();
parseNotationFromInput();

function setupResponsiveBoard() {
  const desktopLayout = window.matchMedia("(min-width: 1101px)");
  let lastSize = null;
  let resizeFrame = null;

  const resizeBoard = () => {
    resizeFrame = null;
    if (!desktopLayout.matches) {
      lastSize = null;
      els.boardArea.style.removeProperty("--board-size");
      return;
    }

    const stage = els.stage.getBoundingClientRect();
    const areaStyle = getComputedStyle(els.boardArea);
    const stackStyle = getComputedStyle(els.boardStack);
    const columnGap = parseFloat(areaStyle.columnGap) || 0;
    const rowGap = parseFloat(stackStyle.rowGap) || 0;
    const evaluationWidth = els.evalBar.getBoundingClientRect().width;
    const playerHeight = els.topPlayer.getBoundingClientRect().height + els.bottomPlayer.getBoundingClientRect().height;
    const verticalChrome = playerHeight + rowGap * 2 + 8;
    const horizontalChrome = evaluationWidth + columnGap;
    const nextSize = Math.max(0, Math.floor(Math.min(
      stage.width - horizontalChrome,
      stage.height - verticalChrome
    )));

    if (lastSize !== null && Math.abs(nextSize - lastSize) < 3) return;
    lastSize = nextSize;
    els.boardArea.style.setProperty("--board-size", `${nextSize}px`);
  };

  const scheduleResize = () => {
    if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(resizeBoard);
  };

  if ("ResizeObserver" in window) {
    const observer = new ResizeObserver(scheduleResize);
    observer.observe(els.stage);
  }
  desktopLayout.addEventListener?.("change", scheduleResize);
  window.addEventListener("resize", scheduleResize, { passive: true });
  window.visualViewport?.addEventListener("resize", scheduleResize, { passive: true });
  scheduleResize();
}

function createGame() {
  return gameFromFen(START_FEN);
}

function gameFromFen(fen) {
  const normalized = normalizeFen(fen);
  const [placement, turn, castling, ep, halfmove, fullmove] = normalized.split(/\s+/);
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

function parseNotationFromInput() {
  try {
    const notation = els.pgnInput.value.trim();
    if (!notation) throw new Error("Paste a PGN game or FEN position first.");
    if (looksLikeFen(notation)) loadFen(notation);
    else loadPgn(notation);
  } catch (error) {
    setStatus(error.message, true);
  }
}

function loadPgn(pgn) {
    const tokens = tokenizePgn(pgn);
    if (!tokens.length) throw new Error("The PGN does not contain any moves.");
    const headers = parsePgnHeaders(pgn);
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
    state.selectedSquare = null;
    clearAnalysisResult();
    state.players = {
      white: playerName(headers.White, "Player 1", "White"),
      black: playerName(headers.Black, "Player 2", "Black")
    };
    state.inputFormat = "pgn";
    const loadedMessage = `PGN loaded: ${tokens.length} moves.`;
    setStatus(loadedMessage);
    render();
    scheduleAutomaticAnalysis({ loadedMessage });
}

function loadFen(fen) {
  const game = gameFromFen(fen);
  state.game = cloneGame(game);
  state.history = [{ game: cloneGame(game), san: "Position", move: null }];
  state.activePly = 0;
  state.selectedSquare = null;
  clearAnalysisResult();
  state.players = { white: "Player 1", black: "Player 2" };
  state.inputFormat = "fen";
  const loadedMessage = `FEN position loaded. ${game.turn === "w" ? "White" : "Black"} to move.`;
  setStatus(loadedMessage);
  render();
  scheduleAutomaticAnalysis({ loadedMessage });
}

function looksLikeFen(notation) {
  return notation.split(/\s+/)[0]?.split("/").length === 8;
}

function normalizeFen(fen) {
  const parts = fen.trim().split(/\s+/);
  if (parts.length === 4) parts.push("0", "1");
  if (parts.length !== 6) throw new Error("FEN must contain four or six space-separated fields.");

  const [placement, turn, castling, ep, halfmove, fullmove] = parts;
  const ranks = placement.split("/");
  if (ranks.length !== 8) throw new Error("FEN placement must contain eight ranks.");

  for (const rank of ranks) {
    if (!/^[prnbqkPRNBQK1-8]+$/.test(rank)) throw new Error("FEN contains an invalid piece or rank character.");
    const width = [...rank].reduce((total, char) => total + (/\d/.test(char) ? Number(char) : 1), 0);
    if (width !== 8) throw new Error("Each FEN rank must describe exactly eight squares.");
  }

  if ((placement.match(/K/g) || []).length !== 1 || (placement.match(/k/g) || []).length !== 1) {
    throw new Error("FEN must contain exactly one white king and one black king.");
  }
  if (!/^[wb]$/.test(turn)) throw new Error('FEN active color must be "w" or "b".');
  if (!/^(?:-|K?Q?k?q?)$/.test(castling)) throw new Error("FEN castling rights are invalid.");
  if (!/^(?:-|[a-h][36])$/.test(ep)) throw new Error("FEN en-passant square is invalid.");
  if (!/^\d+$/.test(halfmove)) throw new Error("FEN halfmove clock must be a non-negative number.");
  if (!/^[1-9]\d*$/.test(fullmove)) throw new Error("FEN fullmove number must be positive.");

  return parts.join(" ");
}

function parsePgnHeaders(pgn) {
  const headers = {};
  for (const match of pgn.matchAll(/^\s*\[([A-Za-z0-9_]+)\s+"([^"]*)"\]\s*$/gm)) {
    headers[match[1]] = match[2].trim();
  }
  return headers;
}

function playerName(value, fallback, genericColor) {
  if (!value || value === "?" || value.toLowerCase() === genericColor.toLowerCase()) return fallback;
  return value;
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
  state.selectedSquare = null;
  clearAnalysisResult();
  render();
  scheduleAutomaticAnalysis();
}

function clearApp() {
  state.analysisId += 1;
  state.analyzing = false;
  state.engineStatus = "idle";
  state.selectedSquare = null;
  stockfishEngine.cancel().catch(() => {});
  els.pgnInput.value = "";
  state.history = [{ game: createGame(), san: "Start", move: null }];
  state.activePly = 0;
  clearAnalysisResult();
  state.players = { white: "Player 1", black: "Player 2" };
  state.inputFormat = "pgn";
  setStatus("Ready for PGN or FEN notation.");
  render();
}

function clearAnalysisResult() {
  state.bestMove = null;
  state.engineScore = null;
  state.engineDepth = 0;
  state.candidates = [];
}

function render() {
  const current = state.history[state.activePly]?.game || createGame();
  renderBoard(current);
  renderEvaluationBar(current);
  renderPlayerLabels(current);
  renderMoveList();
  renderAnalysis(current);
  renderCandidates();
  updateControls();
}

function renderPlayerLabels(game) {
  const topColor = state.orientation === "white" ? "black" : "white";
  const bottomColor = topColor === "white" ? "black" : "white";
  setPlayerLabel("top", topColor, game.turn);
  setPlayerLabel("bottom", bottomColor, game.turn);
}

function setPlayerLabel(side, color, turn) {
  const label = side === "top" ? els.topPlayer : els.bottomPlayer;
  const name = side === "top" ? els.topPlayerName : els.bottomPlayerName;
  const colorLabel = side === "top" ? els.topPlayerColor : els.bottomPlayerColor;
  const shortColor = color === "white" ? "w" : "b";
  name.textContent = state.players[color];
  colorLabel.textContent = color[0].toUpperCase() + color.slice(1);
  label.classList.toggle("active", turn === shortColor);
  label.setAttribute("aria-label", `${state.players[color]}, ${color}${turn === shortColor ? ", to move" : ""}`);
}

function renderBoard(game) {
  els.board.innerHTML = "";
  const arrow = createArrowLayer(state.bestMove);
  const selectedMoves = state.selectedSquare
    ? legalMoves(game).filter((move) => move.from === state.selectedSquare)
    : [];
  const destinations = new Map(selectedMoves.map((move) => [move.to, move]));

  for (let displayRow = 0; displayRow < 8; displayRow++) {
    for (let displayCol = 0; displayCol < 8; displayCol++) {
      const r = state.orientation === "white" ? displayRow : 7 - displayRow;
      const c = state.orientation === "white" ? displayCol : 7 - displayCol;
      const square = document.createElement("div");
      const name = coordsToSquare(r, c);
      const piece = game.board[r][c];
      square.className = `square ${(r + c) % 2 ? "dark" : "light"}`;
      if (state.selectedSquare === name) square.classList.add("selected-piece-square");
      if (state.bestMove?.from === name) square.classList.add("from");
      if (state.bestMove?.to === name) square.classList.add("to");
      square.dataset.square = name;
      square.addEventListener("dragover", handleDragOver);
      square.addEventListener("drop", handleDrop);
      square.addEventListener("click", (event) => handleSquareClick(event, name));

      const legalMove = destinations.get(name);
      if (legalMove) {
        const marker = document.createElement("span");
        marker.className = `legal-move-marker ${legalMove.capture ? "capture" : "destination"}`;
        marker.setAttribute("aria-hidden", "true");
        square.append(marker);
      }

      if (piece) {
        const pieceEl = document.createElement("span");
        pieceEl.className = "piece";
        pieceEl.dataset.color = colorOf(piece);
        pieceEl.dataset.piece = piece.toLowerCase();
        pieceEl.textContent = PIECES[piece];
        pieceEl.draggable = false;
        pieceEl.addEventListener("pointerdown", (event) => handlePointerDragStart(event, name, piece));
        square.append(pieceEl);
      }

      if (displayRow === 7 || displayCol === 0) {
        const coord = document.createElement("span");
        coord.className = "coord";
        coord.textContent = `${displayCol === 0 ? name[1] : ""}${displayRow === 7 ? name[0] : ""}`;
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
  marker.setAttribute("markerWidth", "2.1");
  marker.setAttribute("markerHeight", "2.1");
  marker.setAttribute("refX", "1.8");
  marker.setAttribute("refY", "0.9");
  marker.setAttribute("orient", "auto");
  const head = document.createElementNS("http://www.w3.org/2000/svg", "path");
  head.setAttribute("d", "M0,0 L0,1.8 L2.05,0.9 z");
  head.setAttribute("fill", "var(--arrow)");
  marker.append(head);
  defs.append(marker);

  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("x1", shortened.x1);
  line.setAttribute("y1", shortened.y1);
  line.setAttribute("x2", shortened.x2);
  line.setAttribute("y2", shortened.y2);
  line.setAttribute("stroke", "var(--arrow)");
  line.setAttribute("stroke-width", "1.2");
  line.setAttribute("stroke-linecap", "round");
  line.setAttribute("marker-end", "url(#arrowhead)");
  line.setAttribute("opacity", "0.84");

  svg.append(defs, line);
  return svg;
}

function renderMoveList() {
  els.moveList.innerHTML = "";
  const moves = state.history.slice(1);
  els.moveCount.textContent = `Move ${state.activePly} of ${moves.length}`;

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
  event.currentTarget.setPointerCapture?.(event.pointerId);
  state.pointerDrag = {
    from,
    piece,
    pointerId: event.pointerId,
    source: event.currentTarget,
    ghost: null,
    moved: false,
    startX: event.clientX,
    startY: event.clientY
  };
  document.addEventListener("pointermove", handlePointerDragMove);
  window.addEventListener("pointerup", handlePointerDragEnd, true);
  window.addEventListener("pointercancel", handlePointerDragCancel, true);
}

function handlePointerDragMove(event) {
  if (!state.pointerDrag || event.pointerId !== state.pointerDrag.pointerId) return;
  const drag = state.pointerDrag;
  if (drag.moved && event.pointerType === "mouse" && event.buttons === 0) {
    handlePointerDragEnd(event);
    return;
  }
  if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 5) return;
  event.preventDefault();
  if (!drag.ghost) {
    const ghost = document.createElement("div");
    ghost.className = "piece drag-ghost";
    ghost.dataset.color = colorOf(drag.piece);
    ghost.dataset.piece = drag.piece.toLowerCase();
    ghost.textContent = PIECES[drag.piece];
    document.body.append(ghost);
    drag.ghost = ghost;
    drag.moved = true;
  }
  moveDragGhost(event);
}

function handlePointerDragEnd(event) {
  if (!state.pointerDrag || event.pointerId !== state.pointerDrag.pointerId) return;
  event.preventDefault();
  const { from, moved, source, pointerId } = state.pointerDrag;
  finishPointerDrag();
  try {
    source.releasePointerCapture?.(pointerId);
  } catch (_) {
    // Capture may already be released when Safari ends the gesture.
  }

  const targetSquare = resolveDropSquare(from, event.clientX, event.clientY);
  if (!moved) {
    setTimeout(() => selectPiece(from), 0);
    return;
  }
  if (!targetSquare || targetSquare === from) return;
  playMove(from, targetSquare);
}

function resolveDropSquare(from, clientX, clientY) {
  const directSquare = document.elementFromPoint(clientX, clientY)?.closest(".square")?.dataset.square || null;
  const game = state.history[state.activePly].game;
  const legalDestinations = new Set(
    legalMoves(game).filter((move) => move.from === from).map((move) => move.to)
  );
  if (directSquare && legalDestinations.has(directSquare)) return directSquare;

  const tolerance = els.board.getBoundingClientRect().width / 8 * 0.15;
  let nearest = null;
  let nearestDistance = Infinity;

  for (const destination of legalDestinations) {
    const square = els.board.querySelector(`[data-square="${destination}"]`);
    if (!square) continue;
    const rect = square.getBoundingClientRect();
    const dx = Math.max(rect.left - clientX, 0, clientX - rect.right);
    const dy = Math.max(rect.top - clientY, 0, clientY - rect.bottom);
    if (dx > tolerance || dy > tolerance) continue;
    const distance = Math.hypot(dx, dy);
    if (distance < nearestDistance) {
      nearest = destination;
      nearestDistance = distance;
    }
  }

  return nearest || directSquare;
}

function handlePointerDragCancel(event) {
  if (!state.pointerDrag || event.pointerId !== state.pointerDrag.pointerId) return;
  finishPointerDrag();
}

function finishPointerDrag() {
  state.pointerDrag?.ghost?.remove();
  state.pointerDrag = null;
  document.removeEventListener("pointermove", handlePointerDragMove);
  window.removeEventListener("pointerup", handlePointerDragEnd, true);
  window.removeEventListener("pointercancel", handlePointerDragCancel, true);
}

function handleSquareClick(event, square) {
  const game = state.history[state.activePly].game;
  const [r, c] = squareToCoords(square);
  const piece = game.board[r][c];

  if (event.target.closest(".piece") && piece && colorOf(piece) === game.turn) return;

  if (state.selectedSquare) {
    const move = legalMoves(game).find((candidate) => (
      candidate.from === state.selectedSquare && candidate.to === square
    ));
    if (move) {
      playMove(move.from, move.to, move.promotion);
      return;
    }
  }

  if (piece && colorOf(piece) === game.turn) selectPiece(square);
  else clearPieceSelection();
}

function selectPiece(square) {
  const game = state.history[state.activePly].game;
  const [r, c] = squareToCoords(square);
  const piece = game.board[r][c];
  if (!piece || colorOf(piece) !== game.turn) return;
  state.selectedSquare = state.selectedSquare === square ? null : square;
  renderBoard(game);
}

function clearPieceSelection() {
  if (!state.selectedSquare) return;
  state.selectedSquare = null;
  renderBoard(state.history[state.activePly].game);
}

function moveDragGhost(event) {
  const ghost = state.pointerDrag?.ghost;
  if (!ghost) return;
  ghost.style.left = `${event.clientX}px`;
  ghost.style.top = `${event.clientY}px`;
}

function playMove(from, to, promotion = "q") {
  const game = cloneGame(state.history[state.activePly].game);
  const move = legalMoves(game).find((candidate) => {
    if (candidate.from !== from || candidate.to !== to) return false;
    return !candidate.promotion || candidate.promotion === promotion;
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
  state.selectedSquare = null;
  clearAnalysisResult();
  setStatus(`Played ${san}. Updating best move...`);
  render();
  scheduleAutomaticAnalysis();
}

function renderEvaluationBar(game) {
  const score = state.engineScore ? engineScoreToNumber(state.engineScore) : 0;
  const whitePercent = scoreToWhitePercent(score);
  const blackPercent = 100 - whitePercent;
  els.whiteEvalFill.style.height = `${whitePercent}%`;
  els.blackEvalFill.style.height = `${blackPercent}%`;
  els.positionEval.textContent = state.engineScore
    ? formatEngineScore(state.engineScore)
    : state.analyzing ? "Analyzing..." : "Not analyzed";
  els.positionEval.style.color = score > 25 ? "var(--accent-strong)" : score < -25 ? "var(--ink)" : "var(--muted)";
  const isFlipped = state.orientation === "black";
  els.evalBar.classList.toggle("flipped", isFlipped);
  els.evalTopLabel.textContent = isFlipped ? "White" : "Black";
  els.evalBottomLabel.textContent = isFlipped ? "Black" : "White";
}

function renderAnalysis(game) {
  els.engineName.textContent = state.engineName;
  els.engineDepth.textContent = state.engineDepth ? String(state.engineDepth) : "-";

  if (state.bestMove) {
    els.bestMove.textContent = `${state.bestMove.san || state.bestMove.uci}`;
    const line = state.bestMove.pv?.join(" ") || state.bestMove.uci;
    els.pvLine.textContent = line;
    els.pvLine.title = line;
  } else {
    els.bestMove.textContent = "-";
    els.pvLine.textContent = "-";
    els.pvLine.title = "No principal variation";
  }
}

function renderCandidates() {
  els.candidateList.innerHTML = "";

  if (!state.candidates.length) {
    const empty = document.createElement("div");
    empty.className = "candidate-empty";
    empty.textContent = state.analyzing ? "Calculating candidate lines..." : "Analyze this position to compare candidate moves.";
    els.candidateList.append(empty);
    return;
  }

  for (const [index, candidate] of state.candidates.entries()) {
    const row = document.createElement("button");
    row.className = "candidate-row";
    row.type = "button";
    row.title = `Play ${candidate.san}. ${candidate.pv.join(" ")}`;
    row.setAttribute("aria-label", `Play candidate ${index + 1}: ${candidate.san}`);
    row.innerHTML = `<span class="candidate-rank">${index + 1}</span><strong class="candidate-move"></strong><span class="candidate-score"></span><span class="candidate-pv"></span><span class="candidate-play" aria-hidden="true">▶</span>`;
    row.querySelector(".candidate-move").textContent = candidate.san;
    row.querySelector(".candidate-score").textContent = formatEngineScore(candidate.score);
    row.querySelector(".candidate-pv").textContent = candidate.pv.join(" ");
    row.addEventListener("click", () => playCandidate(candidate));
    els.candidateList.append(row);
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
  els.stopBtn.hidden = !state.analyzing;
  els.analysisProgress.textContent = state.analyzing
    ? state.engineStatus === "restarting"
      ? "Restarting Stockfish..."
      : state.engineStatus === "starting" && !state.engineDepth
        ? "Starting Stockfish..."
        : `Searching depth ${state.engineDepth || 1} of ${state.analysisDepth}`
    : state.engineDepth ? `Completed at depth ${state.engineDepth}` : "Ready";
  els.positionLabel.textContent = state.activePly === 0
    ? state.inputFormat === "fen" ? "FEN position" : "Start position"
    : `After ${state.history[state.activePly].san}`;
}

async function analyzeCurrentPosition(options = {}) {
  if (!options.automatic && automaticAnalysisTimer !== null) {
    clearTimeout(automaticAnalysisTimer);
    automaticAnalysisTimer = null;
  }
  const game = cloneGame(state.history[state.activePly].game);
  const analysisId = ++state.analysisId;
  state.analyzing = true;
  state.engineStatus = "starting";
  clearAnalysisResult();
  state.engineName = "Stockfish 18 Lite";
  if (!options.automatic) setStatus("Analyzing selected position...");
  render();

  try {
    const result = await stockfishEngine.analyze(gameToFen(game), {
      depth: state.analysisDepth,
      multiPv: 3,
      timeoutMs: 300000,
      onStatus: (status) => {
        if (analysisId !== state.analysisId) return;
        state.engineStatus = status;
        updateControls();
      },
      onInfo: (info) => {
        if (analysisId !== state.analysisId) return;
        if (info.score) state.engineScore = info.score;
        if (info.depth) state.engineDepth = info.depth;
        state.candidates = stockfishVariationsToMoves(game, info.variations);
        renderEvaluationBar(game);
        renderAnalysis(game);
        renderCandidates();
        updateControls();
      }
    });

    if (analysisId !== state.analysisId) return;
    state.bestMove = stockfishResultToMove(game, result);
    state.engineScore = result.score || state.engineScore;
    state.engineDepth = result.depth || state.engineDepth;
    state.engineName = result.engineName || "Stockfish 18 Lite";
    state.candidates = stockfishVariationsToMoves(game, result.variations);
    state.analyzing = false;
    state.engineStatus = "ready";
    const resultMessage = state.bestMove
      ? `Stockfish depth ${state.engineDepth}: best move ${state.bestMove.san || state.bestMove.uci}.`
      : "No legal moves in this position.";
    setStatus(options.loadedMessage ? `${options.loadedMessage} ${resultMessage}` : resultMessage);
    render();
  } catch (error) {
    if (error.name === "AbortError" || analysisId !== state.analysisId) return;

    const best = findBestMove(game, 3);
    state.bestMove = best;
    state.engineScore = best ? { type: "cp", value: best.score } : null;
    state.engineDepth = 3;
    state.engineName = "Prototype fallback";
    state.analyzing = false;
    state.engineStatus = "failed";
    const failure = error.isStockfishEngineError
      ? `Stockfish failed after an automatic retry (${error.message})`
      : `Stockfish returned an unusable response (${error.message})`;
    const resultMessage = best
      ? `${failure}; prototype fallback suggests ${best.san || best.uci}.`
      : `${failure}; no legal moves were found.`;
    setStatus(options.loadedMessage ? `${options.loadedMessage} ${resultMessage}` : resultMessage, true);
    render();
  }
}

function scheduleAutomaticAnalysis(options = {}) {
  const analysisAlreadyQueued = automaticAnalysisTimer !== null;
  if (analysisAlreadyQueued) clearTimeout(automaticAnalysisTimer);

  if (!analysisAlreadyQueued) {
    state.analysisId += 1;
    state.analyzing = false;
    state.engineStatus = "idle";
    stockfishEngine.cancel().catch(() => {});
  }

  updateControls();
  automaticAnalysisTimer = setTimeout(() => {
    automaticAnalysisTimer = null;
    analyzeCurrentPosition({ ...options, automatic: true });
  }, 180);
}

function stockfishVariationsToMoves(game, variations = []) {
  return variations.slice(0, 3).map((variation) => {
    const uci = variation.pv?.[0];
    const move = uci ? moveFromUci(game, uci) : null;
    if (!move || !variation.score) return null;
    return {
      uci,
      san: moveToSan(game, move),
      score: variation.score,
      pv: uciLineToSan(game, variation.pv)
    };
  }).filter(Boolean);
}

function playCandidate(candidate) {
  const move = moveFromUci(state.history[state.activePly].game, candidate.uci);
  if (!move) return;
  playMove(move.from, move.to, move.promotion);
}

function stopAnalysis() {
  if (!state.analyzing) return;
  state.analysisId += 1;
  state.analyzing = false;
  state.engineStatus = "idle";
  stockfishEngine.cancel().catch(() => {});
  setStatus(`Analysis stopped at depth ${state.engineDepth || 0}.`);
  render();
}

function handleDepthSelection(event) {
  const isCustom = event.target.value === "custom";
  els.customDepthControl.hidden = !isCustom;
  state.analysisDepth = isCustom ? clampDepth(Number(els.customDepthInput.value)) : Number(event.target.value);
  savePreference("chess-analysis-depth", state.analysisDepth);
  updateDepthWarning();
  scheduleAutomaticAnalysis();
}

function handleCustomDepthChange() {
  state.analysisDepth = clampDepth(Number(els.customDepthInput.value));
  els.customDepthInput.value = state.analysisDepth;
  savePreference("chess-analysis-depth", state.analysisDepth);
  updateDepthWarning();
  scheduleAutomaticAnalysis();
}

function handleCustomDepthInput() {
  state.analysisDepth = clampDepth(Number(els.customDepthInput.value));
  updateDepthWarning();
}

function clampDepth(depth) {
  return Math.min(30, Math.max(6, Number.isFinite(depth) ? depth : DEFAULT_STOCKFISH_DEPTH));
}

function updateDepthControls() {
  const preset = [10, 14, 18].includes(state.analysisDepth) ? String(state.analysisDepth) : "custom";
  els.depthSelect.value = preset;
  els.customDepthControl.hidden = preset !== "custom";
  els.customDepthInput.value = state.analysisDepth;
  updateDepthWarning();
}

function updateDepthWarning() {
  els.depthWarning.hidden = state.analysisDepth <= 22;
}

function gameToFen(game) {
  const placement = game.board.map((rank) => {
    let empty = 0;
    let output = "";
    for (const piece of rank) {
      if (!piece) {
        empty += 1;
        continue;
      }
      if (empty) output += empty;
      empty = 0;
      output += piece;
    }
    return output + (empty || "");
  }).join("/");

  return [
    placement,
    game.turn,
    game.castling || "-",
    game.ep || "-",
    game.halfmove,
    game.fullmove
  ].join(" ");
}

function stockfishResultToMove(game, result) {
  if (!result.bestMove) return null;
  const move = moveFromUci(game, result.bestMove);
  if (!move) throw new Error(`Stockfish returned an unsupported move: ${result.bestMove}`);

  return {
    ...move,
    san: moveToSan(game, move),
    uci: result.bestMove,
    score: result.score,
    pv: uciLineToSan(game, result.pv?.length ? result.pv : [result.bestMove])
  };
}

function moveFromUci(game, uci) {
  const normalized = uci.toLowerCase();
  const from = normalized.slice(0, 2);
  const to = normalized.slice(2, 4);
  const promotion = normalized[4] || null;
  return legalMoves(game).find((move) => (
    move.from === from
    && move.to === to
    && (move.promotion || null) === promotion
  ));
}

function uciLineToSan(game, line) {
  const current = cloneGame(game);
  const san = [];

  for (const uci of line || []) {
    const move = moveFromUci(current, uci);
    if (!move) break;
    san.push(moveToSan(current, move));
    applyMove(current, move);
  }

  return san;
}

function engineScoreToNumber(score) {
  if (score.type === "mate") return score.value > 0 ? 100000 : score.value < 0 ? -100000 : 0;
  return score.value;
}

function formatEngineScore(score) {
  if (score.type === "mate") {
    if (score.value > 0) return `White mates in ${score.value}`;
    if (score.value < 0) return `Black mates in ${Math.abs(score.value)}`;
    return "Checkmate";
  }
  return formatEval(score.value);
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
  let [r, c] = squareToCoords(square);
  if (state.orientation === "black") {
    r = 7 - r;
    c = 7 - c;
  }
  return {
    x: c * 12.5 + 6.25,
    y: r * 12.5 + 6.25
  };
}

function readPreference(key, fallback) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch (_) {
    return fallback;
  }
}

function savePreference(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (_) {
    // Preferences remain active for the current session when storage is unavailable.
  }
}

function applyPreferences() {
  const theme = document.documentElement.dataset.theme || "light";
  setInterfaceTheme(theme);
  setBoardTheme(state.boardTheme);
  setPieceStyle(state.pieceStyle);
  setPiecePalette(state.piecePalette);
  updateOrientationControl();
}

function toggleTheme() {
  setInterfaceTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
}

function setInterfaceTheme(theme) {
  document.documentElement.dataset.theme = theme;
  els.themeToggle.setAttribute("aria-checked", String(theme === "dark"));
  els.themeLabel.textContent = theme === "dark" ? "Light" : "Dark";
  savePreference("chess-ui-theme", theme);
}

function flipBoard() {
  state.orientation = state.orientation === "white" ? "black" : "white";
  state.selectedSquare = null;
  savePreference("chess-board-orientation", state.orientation);
  updateOrientationControl();
  render();
}

function updateOrientationControl() {
  const blackAtBottom = state.orientation === "black";
  els.flipBoardBtn.setAttribute("aria-pressed", String(blackAtBottom));
  els.flipBoardBtn.title = blackAtBottom ? "Show White at bottom" : "Show Black at bottom";
  els.flipBoardBtn.setAttribute("aria-label", els.flipBoardBtn.title);
}

function setBoardTheme(theme) {
  const leavingRestrictedTheme = state.boardTheme === "red-wings" && theme !== "red-wings";
  state.boardTheme = theme;
  document.documentElement.dataset.boardTheme = theme;
  els.boardThemeSelect.value = theme;
  savePreference("chess-board-theme", theme);

  if (theme === "red-wings" && RED_WINGS_INCOMPATIBLE_PALETTES.has(state.piecePalette)) {
    state.paletteBeforeRestrictedTheme = state.piecePalette;
    setPiecePalette("steel-charcoal");
  } else if (leavingRestrictedTheme && state.paletteBeforeRestrictedTheme) {
    const previousPalette = state.paletteBeforeRestrictedTheme;
    state.paletteBeforeRestrictedTheme = null;
    setPiecePalette(previousPalette);
  }

  updatePiecePaletteAvailability();
}

function setPieceStyle(style) {
  if (!PIECE_STYLES.includes(style)) style = "classic";
  state.pieceStyle = style;
  document.documentElement.dataset.pieceStyle = style;
  els.pieceStyleSelect.value = style;
  savePreference("chess-piece-style", style);
}

function setPiecePalette(palette) {
  if (!PIECE_PALETTES.includes(palette)) palette = "black-white";
  if (state.boardTheme === "red-wings" && RED_WINGS_INCOMPATIBLE_PALETTES.has(palette)) {
    palette = "steel-charcoal";
  }
  state.piecePalette = palette;
  document.documentElement.dataset.piecePalette = palette;
  els.piecePaletteSelect.value = palette;
  savePreference("chess-piece-palette", palette);
}

function updatePiecePaletteAvailability() {
  const restricted = state.boardTheme === "red-wings";
  for (const option of els.piecePaletteSelect.options) {
    option.disabled = restricted && RED_WINGS_INCOMPATIBLE_PALETTES.has(option.value);
  }
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
