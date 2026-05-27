# PGN Best Move Analyzer Prototype

A dependency-free browser prototype for loading a PGN game, stepping through positions, and drawing the best move on a chessboard.

## Run

```sh
npm run dev
```

Then open:

```text
http://[::1]:5173
```

If your browser prefers IPv4, use `http://127.0.0.1:5173`.

## What Works

- Paste or edit PGN text.
- Parse the move list into board positions.
- Step to the start, previous move, next move, or latest move.
- Move pieces on the board with the mouse; legal moves are appended to the current line.
- View a live evaluation bar showing whether White or Black is ahead in the selected position.
- Run a prototype evaluator on the selected position.
- Automatically refresh the evaluation and best-move prediction after a piece is moved.
- Render the suggested move as an arrow on the board.
- Show evaluation and a short principal variation.

## Stockfish Integration Note

This first pass uses a local JavaScript evaluator so it can run without downloaded dependencies or a Stockfish binary. The UI is intentionally shaped around the same output a Stockfish UCI worker would provide: best move, score, and principal variation.

To make it production-strength, replace `findBestMove` in `src/app.js` with a Stockfish WASM worker adapter that sends `position fen ...`, `go depth ...`, and reads `bestmove`, `score`, and `pv` lines.
