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
- Click a piece to highlight every legal destination, with dots for open squares and rings for captures.
- Move pieces by clicking a highlighted destination or by dragging with pointer capture and forgiving legal-square snapping.
- Preserve legal move validation while allowing near-edge drops to snap to a nearby legal square.
- Analyze the selected position with Stockfish 18 Lite at preset or custom depth (6–30).
- Automatically refresh Stockfish analysis after navigating history or moving a piece, while coalescing rapid navigation into one search.
- Compare three Stockfish candidate moves with evaluations and principal variations.
- Play a candidate move directly on the board, then return through move history to compare another line.
- Stop a long-running search while retaining the latest completed depth.
- View the Stockfish score, search depth, best move, and principal variation.
- Render the suggested move as an arrow on the board.
- Flip the board with a labeled ⇅ Flip Board button on desktop and mobile, and label the players on their current sides.
- Select board themes, piece styles, piece colors, and light or dark interface mode.
- Use Detroit Lions, Tigers, Red Wings, and Pistons-inspired boards, plus Walnut, Midnight, and maximum-contrast themes.
- Choose Classic, Modern, or Minimal using a bundled chess font, or the CC0 SVG Vector and Bold Broadcast sets.

## Stockfish Engine

The application vendors the Stockfish.js 18.0.8 lite single-threaded WASM build under:

```text
public/vendor/stockfish/
```

Stockfish runs in a Web Worker inside the visitor's browser. The server only delivers the JavaScript and WASM files. Engine source, version, build, and license metadata are recorded in `public/vendor/stockfish/manifest.json`.

The engine wrapper serializes stop/restart transitions and discards superseded searches before they can interfere with the current position. Transient Worker or WASM failures automatically recreate Stockfish and retry once. Rapid move navigation is coalesced to avoid repeatedly stopping and restarting the engine.

If Stockfish still cannot load or respond after recovery, the application reports the underlying error and clearly switches to the original depth-3 JavaScript evaluator as a fallback.

## Board Interaction

Clicking a piece belonging to the side to move highlights its legal destinations. Empty destinations use translucent dots, captures use perimeter rings, and the selected square uses a brighter color designed for the active board theme. Selection clears after a move, history navigation, board flip, new notation, or Escape.

Dragging uses one pointer-capture path across mouse and touch input. A five-pixel threshold separates a click from a drag, window-level cleanup prevents stranded drag images, and a 15% boundary tolerance snaps near-edge drops only when the nearby destination is legal.

Both armies use matching silhouettes and per-piece proportions, with smaller pawns and larger kings/queens. Classic, Modern, and Minimal use a bundled six-glyph font with explicit text presentation, avoiding device-specific font or emoji substitutions. Vector and Bold Broadcast apply their outlines outside the SVG mask so the outlines remain visible.

The drag representation preserves the source piece's size, font size, and transform from pointer-down. Vector and Bold Broadcast pieces keep their square-sized masks when dragged outside the board; font-based pieces retain their container-relative sizing.

### Browser regression checks

```sh
npm ci
npx playwright install chromium webkit
npm run test:browser
```

On Linux, use `npx playwright install --with-deps chromium webkit`. The tests compare every white/black piece pair across all five styles and all five palettes at desktop and phone widths, confirm the bundled font loads and pawns stay smaller than kings, and cover pointer-centered sizing, both colors, legal moves, illegal drops, captures, board flipping, history navigation, and cancellation. Searches are stopped through the UI while measuring geometry. Phone-width mouse tests do not replace a physical touchscreen check.

## Piece Artwork

The Vector and Bold Broadcast styles use the CC0 chess SVG set by femrek from OpenGameArt. The source and public-domain dedication are documented in `public/pieces/cc0-vector/LICENSE.md`.

Classic, Modern, and Minimal use Chess Symbols, a 4.6 KB subset derived from Noto Sans Symbols 2 under the SIL Open Font License. Source, modifications, and license are in `public/fonts/noto-sans-symbols-2/`. The font is served locally with the app.

## Deployment

The current single-threaded WASM build does not require cross-origin isolation headers. Apache should serve `.wasm` files as `application/wasm`; modern Apache installations commonly include this mapping already:

```apache
AddType application/wasm .wasm
```

## Follow-up Notes

- Increase the visual size of the Depth label and selector; the current control is smaller than the surrounding analysis controls.
