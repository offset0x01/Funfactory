/**
 * Motore AI generico per giochi a turni a due giocatori (usato dal Tris).
 * Porting di game_ai.py.
 *
 * Algoritmi:
 *   * 'random'     mossa casuale
 *   * 'heuristic'  valuta solo la posizione dopo una mossa (greedy)
 *   * 'minimax'    minimax con iterative deepening e tabella di trasposizione
 *   * 'alpha_beta' potatura alfa-beta con ordinamento delle mosse
 *
 * Dettagli importanti (come nella v3 Python):
 *   * a parità di valore la mossa viene scelta a caso (CPU meno prevedibile);
 *   * `blunderRate`: probabilità di "sbagliare" apposta (difficoltà facili);
 *   * l'iterative deepening usa solo le profondità completate entro il tempo;
 *   * `GameAI.forLevel('easy' | 'medium' | 'hard')` crea preset pronti.
 *
 * Approfondimenti: https://it.wikipedia.org/wiki/Minimax
 *                  https://it.wikipedia.org/wiki/Potatura_alfa-beta
 */

export const RESULT = { WIN: 1, LOSS: -1, DRAW: 0, ONGOING: null };
export const ALGORITHMS = ['random', 'minimax', 'alpha_beta', 'heuristic'];

const now = () => (globalThis.performance ? performance.now() : Date.now());

export class GameAI {
  constructor({
    algorithm = 'minimax', difficulty = 3, timeLimit = 5, playerId = -1, blunderRate = 0, rng = Math.random,
  } = {}) {
    const alg = String(algorithm).toLowerCase();
    if (!ALGORITHMS.includes(alg)) console.warn(`[GameAI] algoritmo '${algorithm}' non riconosciuto: uso 'minimax'.`);
    this.algorithm = ALGORITHMS.includes(alg) ? alg : 'minimax';
    this.difficulty = Math.max(1, Math.min(9, difficulty));
    this.timeLimit = Math.max(0.01, Number(timeLimit));
    this.playerId = playerId;
    this.blunderRate = Math.max(0, Math.min(1, blunderRate));
    this.rng = rng;
    this.nodesEvaluated = 0;
    this.startTime = 0;
    this._memo = new Map();
    this._aborted = false;
  }

  /**
   * Preset: easy = euristica greedy che sbaglia una mossa su tre;
   * medium = minimax a profondità 2 con qualche errore;
   * hard = minimax completo (nel Tris è imbattibile).
   */
  static forLevel(level, playerId = -1, rng = Math.random) {
    const presets = {
      easy: { algorithm: 'heuristic', difficulty: 1, blunderRate: 0.35 },
      medium: { algorithm: 'minimax', difficulty: 2, blunderRate: 0.12 },
      hard: { algorithm: 'minimax', difficulty: 9, blunderRate: 0 },
    };
    return new GameAI({ ...(presets[level] || presets.medium), playerId, rng });
  }

  _choice(list) { return list[Math.floor(this.rng() * list.length)]; }

  getBestMove(state) {
    let legal;
    try { legal = [...state.getLegalMoves()]; } catch { return null; }
    if (!legal.length) return null;
    this.nodesEvaluated = 0;
    this.startTime = now();
    this._memo = new Map();
    this._aborted = false;
    if (this.blunderRate && this.rng() < this.blunderRate) return this._choice(legal);
    try {
      switch (this.algorithm) {
        case 'random': return this._choice(legal);
        case 'minimax': return this._minimaxMove(state, legal);
        case 'alpha_beta': return this._alphaBetaMove(state, legal);
        case 'heuristic': return this._heuristicMove(state, legal);
        default: return this._choice(legal);
      }
    } catch {
      return this._choice(legal);   // ripiego robusto
    }
  }

  /** Sceglie a caso tra le mosse con il valore massimo. */
  _pick(scored) {
    const best = Math.max(...scored.map(([v]) => v));
    return this._choice(scored.filter(([v]) => v >= best - 1e-9).map(([, m]) => m));
  }

  _minimaxMove(state, legal) {
    let bestMove = null;
    const maxDepth = Math.max(1, this.difficulty);
    // Se la profondità copre tutta la partita rimasta (nel Tris ogni mossa
    // occupa una casella) basta una sola ricerca completa.
    const firstDepth = maxDepth >= legal.length ? maxDepth : 1;
    for (let depth = firstDepth; depth <= maxDepth; depth++) {
      if (this._timeUp()) break;
      const scored = [];
      for (const move of legal) scored.push([this._minimax(state.makeMove(move), depth - 1, false), move]);
      if (this._aborted) break;   // profondità incompleta: si tiene il risultato precedente
      if (scored.length) bestMove = this._pick(scored);
      if (scored.every(([v]) => Math.abs(v) >= 1000)) break;   // esito già certo per ogni mossa
    }
    return bestMove ?? this._choice(legal);
  }

  _alphaBetaMove(state, legal) {
    let bestMove = null;
    const maxDepth = Math.max(1, this.difficulty);
    for (let depth = 1; depth <= maxDepth; depth++) {
      if (this._timeUp()) break;
      let depthBest = null;
      let bestValue = -Infinity;
      let alpha = -Infinity;
      const beta = Infinity;
      for (const move of this._orderMoves(legal)) {
        const value = this._alphaBeta(state.makeMove(move), depth - 1, alpha, beta, false);
        if (value > bestValue) { bestValue = value; depthBest = move; }
        alpha = Math.max(alpha, value);
      }
      if (this._aborted) break;
      if (depthBest !== null) bestMove = depthBest;
    }
    return bestMove ?? this._choice(legal);
  }

  _heuristicMove(state, legal) {
    const scored = legal.map((m) => [state.makeMove(m).evaluatePosition(this.playerId), m]);
    return scored.length ? this._pick(scored) : this._choice(legal);
  }

  /** Centro, poi angoli, poi bordi: migliora molto la potatura nel Tris. */
  _orderMoves(moves) {
    if (!moves.length || !Array.isArray(moves[0]) || moves[0].length !== 2) return moves;
    const center = [], corners = [], edges = [];
    for (const m of moves) {
      const [r, c] = m;
      if (r === 1 && c === 1) center.push(m);
      else if ((r === 0 || r === 2) && (c === 0 || c === 2)) corners.push(m);
      else edges.push(m);
    }
    return [...center, ...corners, ...edges];
  }

  _evaluateTerminal(state, depth) {
    if (state.isTerminal()) {
      const result = state.getResult(this.playerId);
      if (result === RESULT.WIN) return 1000 + depth;   // vincere prima vale di più
      if (result === RESULT.LOSS) return -1000 - depth;
      return 0;
    }
    try { return state.evaluatePosition(this.playerId); } catch { return 0; }
  }

  _minimax(state, depth, maximizing) {
    this.nodesEvaluated++;
    if (this._timeUp()) { this._aborted = true; return this._evaluateTerminal(state, depth); }
    if (depth === 0 || state.isTerminal()) return this._evaluateTerminal(state, depth);
    const key = state.key?.();
    const memoKey = key != null ? `${key}|${depth}|${maximizing ? 1 : 0}` : null;
    if (memoKey && this._memo.has(memoKey)) return this._memo.get(memoKey);
    const values = [];
    for (const move of state.getLegalMoves()) {
      values.push(this._minimax(state.makeMove(move), depth - 1, !maximizing));
      if (this._aborted) break;
    }
    if (!values.length) return this._evaluateTerminal(state, depth);
    const result = maximizing ? Math.max(...values) : Math.min(...values);
    if (memoKey && !this._aborted) this._memo.set(memoKey, result);
    return result;
  }

  _alphaBeta(state, depth, alpha, beta, maximizing) {
    this.nodesEvaluated++;
    if (this._timeUp()) { this._aborted = true; return this._evaluateTerminal(state, depth); }
    if (depth === 0 || state.isTerminal()) return this._evaluateTerminal(state, depth);
    if (maximizing) {
      let best = -Infinity;
      for (const move of this._orderMoves(state.getLegalMoves())) {
        const v = this._alphaBeta(state.makeMove(move), depth - 1, alpha, beta, false);
        best = Math.max(best, v);
        alpha = Math.max(alpha, v);
        if (beta <= alpha || this._aborted) break;
      }
      return best;
    }
    let best = Infinity;
    for (const move of this._orderMoves(state.getLegalMoves())) {
      const v = this._alphaBeta(state.makeMove(move), depth - 1, alpha, beta, true);
      best = Math.min(best, v);
      beta = Math.min(beta, v);
      if (beta <= alpha || this._aborted) break;
    }
    return best;
  }

  _timeUp() { return (now() - this.startTime) / 1000 > this.timeLimit; }

  getStats() {
    return {
      algorithm: this.algorithm, difficulty: this.difficulty,
      nodesEvaluated: this.nodesEvaluated, timeTaken: (now() - this.startTime) / 1000,
    };
  }
}

const LINES = [
  [[0, 0], [0, 1], [0, 2]], [[1, 0], [1, 1], [1, 2]], [[2, 0], [2, 1], [2, 2]],
  [[0, 0], [1, 0], [2, 0]], [[0, 1], [1, 1], [2, 1]], [[0, 2], [1, 2], [2, 2]],
  [[0, 0], [1, 1], [2, 2]], [[0, 2], [1, 1], [2, 0]],
];

/** Le tre caselle [riga, colonna] di una linea vincente, oppure null. */
export function winningLine(board) {
  for (const line of LINES) {
    const [a, b, c] = line.map(([r, col]) => board[r][col]);
    if (a !== null && a === b && b === c) return line;
  }
  return null;
}

/** Stato del Tris: tabellone 3x3 con null (vuota), 1 (X) e -1 (O). Immutabile. */
export class TicTacToeState {
  constructor(board = null, currentPlayer = 1) {
    this.board = board ? board.map((row) => [...row]) : [[null, null, null], [null, null, null], [null, null, null]];
    this.currentPlayer = currentPlayer;
    this._legal = null;
  }

  getLegalMoves() {
    if (!this._legal) {
      this._legal = [];
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) if (this.board[r][c] === null) this._legal.push([r, c]);
    }
    return this._legal;
  }

  /** Nuovo stato dopo la mossa (quello attuale non cambia). */
  makeMove([r, c]) {
    const board = this.board.map((row) => [...row]);
    board[r][c] = this.currentPlayer;
    return new TicTacToeState(board, -this.currentPlayer);
  }

  getWinner() {
    const line = winningLine(this.board);
    return line ? this.board[line[0][0]][line[0][1]] : null;
  }

  isTerminal() { return this.getWinner() !== null || this.getLegalMoves().length === 0; }

  getResult(player) {
    const w = this.getWinner();
    if (w === null) return this.getLegalMoves().length === 0 ? RESULT.DRAW : RESULT.ONGOING;
    return w === player ? RESULT.WIN : RESULT.LOSS;
  }

  getCurrentPlayer() { return this.currentPlayer; }

  key() { return `${this.board.flat().map((v) => (v === null ? '.' : v === 1 ? 'X' : 'O')).join('')}${this.currentPlayer}`; }

  /** Valutazione posizionale: minacce, centro e angoli. */
  evaluatePosition(player) {
    const w = this.getWinner();
    if (w === player) return 100;
    if (w === -player) return -100;
    let score = 0;
    for (const line of LINES) score += this._evaluateLine(line.map(([r, c]) => this.board[r][c]), player);
    if (this.board[1][1] === player) score += 3;
    for (const [r, c] of [[0, 0], [0, 2], [2, 0], [2, 2]]) if (this.board[r][c] === player) score += 2;
    return score;
  }

  _evaluateLine(line, player) {
    const mine = line.filter((v) => v === player).length;
    const theirs = line.filter((v) => v === -player).length;
    const empty = line.filter((v) => v === null).length;
    if (mine && theirs) return 0;   // linea "contaminata"
    if (mine === 2 && empty === 1) return 5;
    if (mine === 1 && empty === 2) return 1;
    if (theirs === 2 && empty === 1) return -5;
    if (theirs === 1 && empty === 2) return -1;
    return 0;
  }
}
