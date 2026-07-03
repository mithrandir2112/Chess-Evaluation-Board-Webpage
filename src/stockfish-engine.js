(function () {
  class StockfishEngine {
    constructor(options = {}) {
      this.workerUrl = options.workerUrl;
      this.worker = null;
      this.engineName = "Stockfish";
      this.initialization = null;
      this.pendingSearch = null;
      this.lineWaiters = [];
      this.requestId = 0;
      this.transition = Promise.resolve();
    }

    initialize() {
      if (this.initialization) return this.initialization;

      this.initialization = new Promise((resolve, reject) => {
        let worker;
        try {
          worker = new Worker(this.workerUrl);
          this.worker = worker;
        } catch (error) {
          this.initialization = null;
          reject(error);
          return;
        }

        const fail = (message) => {
          const error = new Error(message || "Stockfish failed to load.");
          if (this.worker !== worker) return;
          reject(error);
          this.resetWorker(error, worker);
        };

        this.worker.addEventListener("error", (event) => {
          fail(event.message || "Stockfish worker error.");
        });

        this.worker.addEventListener("message", (event) => {
          if (typeof event.data === "string") this.handleLine(event.data);
        });

        this.waitForLine((line) => line === "uciok", 30000)
          .then(() => {
            this.send("setoption name Hash value 32");
            return this.synchronize();
          })
          .then(() => resolve(this.engineName))
          .catch(reject);

        this.send("uci");
      });

      return this.initialization;
    }

    async analyze(fen, options = {}) {
      const requestId = ++this.requestId;
      let lastError;

      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          options.onStatus?.(attempt ? "restarting" : "starting");
          const result = await this.analyzeOnce(fen, options, requestId);
          options.onStatus?.("ready");
          return result;
        } catch (error) {
          if (error.name === "AbortError" || requestId !== this.requestId) throw error;
          lastError = error;
          this.resetWorker(error);
        }
      }

      lastError.isStockfishEngineError = true;
      throw lastError;
    }

    async analyzeOnce(fen, options, requestId) {
      await this.initialize();
      this.assertCurrent(requestId);
      await this.queueTransition(() => {
        this.assertCurrent(requestId);
        return this.stopNow();
      });
      this.assertCurrent(requestId);

      const depth = options.depth || 12;
      const multiPv = Math.max(1, Math.min(5, options.multiPv || 1));
      const turn = fen.split(/\s+/)[1];

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          this.pendingSearch = null;
          this.send("stop");
          reject(new Error("Stockfish analysis timed out."));
        }, options.timeoutMs || 60000);

        this.pendingSearch = {
          turn,
          latest: null,
          variations: new Map(),
          onInfo: options.onInfo,
          resolve: (result) => {
            clearTimeout(timeout);
            resolve(result);
          },
          reject: (error) => {
            clearTimeout(timeout);
            reject(error);
          }
        };

        this.send(`setoption name MultiPV value ${multiPv}`);
        this.send(`position fen ${fen}`);
        this.send(`go depth ${depth}`);
      });
    }

    async stop() {
      return this.queueTransition(() => this.stopNow());
    }

    async stopNow() {
      if (!this.worker) return;

      if (this.pendingSearch) {
        const pending = this.pendingSearch;
        this.pendingSearch = null;
        pending.reject(new DOMException("Analysis superseded.", "AbortError"));
      }

      this.send("stop");
      await this.synchronize();
    }

    cancel() {
      this.requestId += 1;
      return this.stop();
    }

    queueTransition(operation) {
      const next = this.transition.catch(() => {}).then(operation);
      this.transition = next;
      return next;
    }

    assertCurrent(requestId) {
      if (requestId !== this.requestId) {
        throw new DOMException("Analysis superseded.", "AbortError");
      }
    }

    resetWorker(error, expectedWorker = this.worker) {
      if (expectedWorker && this.worker !== expectedWorker) return;

      const worker = this.worker;
      this.worker = null;
      this.initialization = null;

      if (this.pendingSearch) {
        const pending = this.pendingSearch;
        this.pendingSearch = null;
        pending.reject(error || new Error("Stockfish worker stopped."));
      }

      for (const waiter of this.lineWaiters.splice(0)) {
        clearTimeout(waiter.timeout);
        waiter.reject(error || new Error("Stockfish worker stopped."));
      }

      try {
        worker?.terminate();
      } catch (_) {
        // The worker may already have terminated itself.
      }
    }

    synchronize() {
      const ready = this.waitForLine((line) => line === "readyok", 10000);
      this.send("isready");
      return ready;
    }

    send(command) {
      if (!this.worker) throw new Error("Stockfish worker is not available.");
      this.worker.postMessage(command);
    }

    waitForLine(predicate, timeoutMs) {
      return new Promise((resolve, reject) => {
        const waiter = { predicate, resolve, reject };
        waiter.timeout = setTimeout(() => {
          this.lineWaiters = this.lineWaiters.filter((candidate) => candidate !== waiter);
          reject(new Error("Stockfish did not respond in time."));
        }, timeoutMs);
        this.lineWaiters.push(waiter);
      });
    }

    handleLine(line) {
      if (line.startsWith("id name ")) {
        this.engineName = line.slice(8).trim();
      }

      for (const waiter of [...this.lineWaiters]) {
        if (!waiter.predicate(line)) continue;
        clearTimeout(waiter.timeout);
        this.lineWaiters = this.lineWaiters.filter((candidate) => candidate !== waiter);
        waiter.resolve(line);
      }

      if (!this.pendingSearch) return;

      if (line.startsWith("info ")) {
        const info = parseInfoLine(line, this.pendingSearch.turn);
        if (!info) return;
        const previous = this.pendingSearch.variations.get(info.multiPv) || {};
        const variation = {
          multiPv: info.multiPv,
          depth: info.depth || previous.depth || 0,
          score: info.score || previous.score || null,
          pv: info.pv.length ? info.pv : previous.pv || []
        };
        this.pendingSearch.variations.set(info.multiPv, variation);
        this.pendingSearch.latest = this.pendingSearch.variations.get(1) || variation;
        this.pendingSearch.onInfo?.({
          ...this.pendingSearch.latest,
          variations: [...this.pendingSearch.variations.values()].sort((a, b) => a.multiPv - b.multiPv)
        });
        return;
      }

      if (line.startsWith("bestmove ")) {
        const [, bestMove] = line.split(/\s+/);
        const pending = this.pendingSearch;
        this.pendingSearch = null;
        pending.resolve({
          bestMove: bestMove === "(none)" ? null : bestMove,
          ...pending.latest,
          variations: [...pending.variations.values()].sort((a, b) => a.multiPv - b.multiPv),
          engineName: this.engineName
        });
      }
    }
  }

  function parseInfoLine(line, turn) {
    const depthMatch = line.match(/\bdepth\s+(\d+)/);
    const scoreMatch = line.match(/\bscore\s+(cp|mate)\s+(-?\d+)/);
    const multiPvMatch = line.match(/\bmultipv\s+(\d+)/);
    const pvMatch = line.match(/\bpv\s+(.+)$/);
    if (!depthMatch && !scoreMatch && !pvMatch) return null;

    let score = null;
    if (scoreMatch) {
      const perspective = turn === "w" ? 1 : -1;
      score = {
        type: scoreMatch[1],
        value: Number(scoreMatch[2]) * perspective
      };
    }

    return {
      multiPv: multiPvMatch ? Number(multiPvMatch[1]) : 1,
      depth: depthMatch ? Number(depthMatch[1]) : 0,
      score,
      pv: pvMatch ? pvMatch[1].trim().split(/\s+/) : []
    };
  }

  window.StockfishEngine = StockfishEngine;
})();
