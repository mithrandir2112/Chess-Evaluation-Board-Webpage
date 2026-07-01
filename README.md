# Chess Stockfish Analyzer

A browser-based chess analysis workspace for loading PGN games or FEN positions, stepping through move history, and analyzing the displayed position with Stockfish.

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
- Paste a FEN position.
- Parse the move list into board positions.
- Step to the start, previous move, next move, or latest move.
- Move pieces on the board with the mouse; legal moves are appended to the current line.
- Analyze the selected position with Stockfish 18 Lite at preset or custom depth (6–30).
- Automatically refresh Stockfish analysis after navigating history or moving a piece.
- Compare three Stockfish candidate moves with evaluations and principal variations.
- Play a candidate move directly on the board, then return through move history to compare another line.
- Stop a long-running search while retaining the latest completed depth.
- View the Stockfish score, search depth, best move, and principal variation.
- Render the suggested move as an arrow on the board.
- Flip the board and label the players on their current sides.
- Select board themes, piece styles, piece colors, and light or dark interface mode.

## Stockfish Engine

The application vendors the Stockfish.js 18.0.8 lite single-threaded WASM build under:

```text
public/vendor/stockfish/
```

Stockfish runs in a Web Worker inside the visitor's browser. The server only delivers the JavaScript and WASM files. Engine source, version, build, and license metadata are recorded in `public/vendor/stockfish/manifest.json`.

If the Stockfish worker cannot load or respond, the application clearly switches to the original depth-3 JavaScript evaluator as a fallback.

## Deployment

The current single-threaded WASM build does not require cross-origin isolation headers. Apache should serve `.wasm` files as `application/wasm`; modern Apache installations commonly include this mapping already:

```apache
AddType application/wasm .wasm
```

## Follow-up Notes

- Increase the visual size of the Depth label and selector; the current control is smaller than the surrounding analysis controls.
