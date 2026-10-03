/* Pure capture accounting, shared by the browser and regression tests. */
(function (root) {
  const inventory = { p: 8, n: 2, b: 2, r: 2, q: 1 };
  const color = piece => piece === piece.toUpperCase() ? 'w' : 'b';
  const coords = square => [8 - Number(square[1]), square.charCodeAt(0) - 97];
  function infer(board) {
    const result = { w: [], b: [] };
    for (const army of ['w', 'b']) {
      const counts = { p: 0, n: 0, b: 0, r: 0, q: 0 };
      for (const piece of board.flat()) {
        if (piece && color(piece) === army && piece.toLowerCase() in counts) counts[piece.toLowerCase()]++;
      }
      const promotions = ['n', 'b', 'r', 'q'].reduce((sum, role) => sum + Math.max(0, counts[role] - inventory[role]), 0);
      for (const [role, initial] of Object.entries(inventory)) {
        const missing = Math.max(0, initial - counts[role] - (role === 'p' ? promotions : 0));
        result[army === 'w' ? 'b' : 'w'].push(...Array(missing).fill(army === 'w' ? role.toUpperCase() : role));
      }
    }
    return result;
  }
  function atPly(history, ply, inferred = false) {
    const result = inferred ? infer(history[0].game.board) : { w: [], b: [] };
    for (let i = 1; i <= ply; i++) {
      const before = history[i - 1].game;
      const move = history[i].move;
      if (!move) continue;
      const [row, col] = coords(move.to);
      const [fromRow] = coords(move.from);
      const captured = before.board[move.flag === 'ep' ? fromRow : row][col];
      if (captured && captured.toLowerCase() !== 'k') result[before.turn].push(captured);
    }
    return result;
  }
  const api = { infer, atPly };
  if (typeof module !== 'undefined') module.exports = api;
  else root.CapturedMaterial = api;
})(typeof window === 'undefined' ? globalThis : window);
