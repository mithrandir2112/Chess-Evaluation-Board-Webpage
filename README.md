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

### Startup and captured pieces

The board starts with all 32 pieces in the standard starting position, White to move, and no moves played. You can play immediately, load PGN/FEN, or explicitly select **Load sample PGN**. **Clear** resets to a new game, clears captures and evaluation, and cancels pending or running analysis.

Small captured-piece icons appear beneath each player's name and stay with that player when the board flips. PGN captures follow the selected move, including en passant, and update when you rewind or play a different continuation. PGN setup positions with `SetUp "1"` and `FEN` headers are supported.

FEN capture rows are marked **Inferred**: missing pieces are compared with the normal starting inventory. Visible extra queens, rooks, bishops, or knights account for promoted pawns. A position alone cannot reveal every past promotion or capture, so the initial inventory is an estimate; subsequent moves are tracked directly. The same applies to PGN games beginning from a FEN setup position.

### Exporting a game

Use **Copy PGN** or **Download PGN** beside Game Moves to export the complete current continuation, even while reviewing an earlier move. Playing a different move replaces the future continuation. Download saves `chess-game.pgn`; Copy uses the clipboard and reports when browser permissions prevent access. The input box is unchanged. Exports include player names, standard game headers and the starting FEN when needed. New or edited games use `*` (unfinished); imported Result headers are retained until a move is played. Clear resets the export to a new game.

Engine progress updates the existing analysis values and candidate slots without replacing board pieces or move-history buttons. Candidate space stays reserved during searches, and outdated scores are replaced with “Analyzing…” after a move. Desktop navigation and appearance selectors use 44px controls. Load Sample is labeled beside the notation actions.


### Native and host themes

The synchronous `src/theme.js` script runs before the stylesheet to select a theme before paint. Standalone chess uses the saved `chess-ui-theme` light/dark choice, otherwise follows `prefers-color-scheme`, including live system changes. Automatic system choices are never persisted. The local toggle saves an explicit choice. `ChessTheme.setPreference("system")` clears it and resumes system behavior. Blocked storage does not prevent theming.

A host supplies attributes before loading `theme.js`:

```html
<html data-chess-theme-source="host" data-theme="forest" data-chess-color-scheme="dark">
```

`data-theme` is the host's palette name, not an enum restricted to light/dark. `data-chess-color-scheme` selects light or dark native fallback colors and native form appearance for named palettes. For light/dark names it is inferred when omitted and follows subsequent theme changes. For named themes, set the scheme explicitly when changing the palette. A preexisting `data-theme` also selects host ownership automatically. A host attaching later should set `data-chess-theme-source="host"` before supplying attributes and tokens; changing `data-theme` externally also transfers ownership when its value differs from the native selection.

In host mode chess never writes a local theme preference or reacts to OS changes, and hides `#themeToggle`. The host may omit that button entirely. Updating root attributes or tokens takes effect without reloading, repainting the board DOM, or resetting play/analysis. To release control, set `data-chess-theme-source="native"`; the saved local preference or system theme resumes and host tokens are ignored. A host should then stop writing theme attributes.

The CSS contract uses the actual `--theme-*` semantic names already implemented by mithrandir-site (the older issue examples used proposed `--site-*` names):

| Host tokens | Chess chrome |
| --- | --- |
| `--theme-page` | Page background |
| `--theme-surface-raised`, `--theme-surface-muted`, `--theme-control` | Panels, metrics, controls |
| `--theme-text`, `--theme-text-muted`, `--theme-border` | Text and borders |
| `--theme-accent`, `--theme-accent-strong`, `--theme-accent-contrast` | Actions, headings, text on filled actions |
| `--theme-focus`, `--theme-focus-soft` | Keyboard focus border and ring |
| `--theme-maize`, `--theme-maize-bright` | Supporting accents |
| `--theme-danger`, `--theme-danger-surface` | Error states |
| `--theme-shadow` | Panel/board shadows |

Every token is optional and falls back to native light/dark values. Supply valid CSS values and contrasting accent/contrast colors together for a custom palette. Board-square themes, piece palettes, legal-move markers and evaluation colors retain their chess-specific meaning; host chrome tokens do not replace them. There are no site-file imports, site-event dependencies, or required host controllers.

Example host CSS (load alongside the native stylesheet):

```css
:root[data-theme="forest"] {
  --theme-page: #10251e;
  --theme-surface-raised: #17352b;
  --theme-surface-muted: #1d4135;
  --theme-control: #244f40;
  --theme-text: #f1fff7;
  --theme-text-muted: #b2d4c2;
  --theme-border: #487762;
  --theme-accent: #82ddaa;
  --theme-accent-strong: #a1f4c5;
  --theme-accent-contrast: #10251e;
}
```

For mithrandir-site integration, keep the shared theme bootstrap before `src/theme.js`, include the native stylesheet and the site's token definitions, and retain only site-specific navigation/layout adaptations. The existing shared bootstrap supplies `data-theme` before chess starts, so its controller remains authoritative. This standalone release does not itself modify or deploy the integrated site.
