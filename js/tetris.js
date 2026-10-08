/* ============================================
   THE DRAGON'S SHADOW - The Duel of Wills
   A Tetris boss fight against Superlord Malachar

   Both fighters share the screen: the hero plays the
   lower grid, the Superlord the upper one. The first to
   clear TARGET_LINES wins the duel - and the Amulet.

   Difficulty is tuned in the block just below.
   ============================================ */

const BossFight = (function () {

  /* ---------- Rules of the duel ---------- */

  const COLS = 10;
  const ROWS = 20;
  const TARGET_LINES = 20;      // first fighter to reach this many lines wins
  const HEAD_START = 3;         // lines Malachar starts with in "honor" mode
  const LOCK_DELAY = 180;       // ms a resting piece waits before it locks

  // How often Malachar throws dark stone into your rows (ms), and how much.
  const GARBAGE_FIRST_DELAY = 25000;
  const GARBAGE_EACH_WAVE = 150;   // every wave comes sooner than the last
  const GARBAGE_MIN_DELAY = 15000;

  // How often Malachar fumbles a piece instead of playing the best move.
  const BOSS_MISTAKE_RATE = 0.18;

  const PLAYER_CELL = 22;       // px per cell on the hero's grid
  const BOSS_CELL = 17;         // Malachar's grid is drawn smaller
  const PREVIEW_CELL = 11;      // px per cell in the next / hold boxes

  /* ---------- Colours & pieces ---------- */

  const EMPTY = '';
  const GARBAGE = '#7d2434';    // the dark stone Malachar throws at you

  const COLORS = {
    I: '#57c7f2',
    O: '#e8c34a',
    T: '#b070ff',
    S: '#63d68c',
    Z: '#e05a4f',
    J: '#5f7ff0',
    L: '#f08a4b'
  };

  // Each piece is a list of rotation states drawn around the piece's own
  // centre, so turning a piece never slides it across the grid.
  // J, L, S, T and Z live in a 3x3 box, I in a 4x4 box, O in a 2x2 box.
  const SHAPES = {
    I: [
      [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
      [[0,0,1,0],[0,0,1,0],[0,0,1,0],[0,0,1,0]],
      [[0,0,0,0],[0,0,0,0],[1,1,1,1],[0,0,0,0]],
      [[0,1,0,0],[0,1,0,0],[0,1,0,0],[0,1,0,0]]
    ],
    O: [
      [[1,1],[1,1]]
    ],
    T: [
      [[0,1,0],[1,1,1],[0,0,0]],
      [[0,1,0],[0,1,1],[0,1,0]],
      [[0,0,0],[1,1,1],[0,1,0]],
      [[0,1,0],[1,1,0],[0,1,0]]
    ],
    S: [
      [[0,1,1],[1,1,0],[0,0,0]],
      [[0,1,0],[0,1,1],[0,0,1]],
      [[0,0,0],[0,1,1],[1,1,0]],
      [[1,0,0],[1,1,0],[0,1,0]]
    ],
    Z: [
      [[1,1,0],[0,1,1],[0,0,0]],
      [[0,0,1],[0,1,1],[0,1,0]],
      [[0,0,0],[1,1,0],[0,1,1]],
      [[0,1,0],[1,1,0],[1,0,0]]
    ],
    J: [
      [[1,0,0],[1,1,1],[0,0,0]],
      [[0,1,1],[0,1,0],[0,1,0]],
      [[0,0,0],[1,1,1],[0,0,1]],
      [[0,1,0],[0,1,0],[1,1,0]]
    ],
    L: [
      [[0,0,1],[1,1,1],[0,0,0]],
      [[0,1,0],[0,1,0],[0,1,1]],
      [[0,0,0],[1,1,1],[1,0,0]],
      [[1,1,0],[0,1,0],[0,1,0]]
    ]
  };
  const SHAPE_KEYS = Object.keys(SHAPES);

  /* ---------- Small helpers ---------- */

  function randomInt(max) {
    return Math.floor(Math.random() * max);
  }

  function cloneMatrix(m) {
    return m.map(function (row) { return row.slice(); });
  }

  function cloneBoard(b) {
    return b.map(function (row) { return row.slice(); });
  }

  /* ---------- Board mechanics ---------- */

  function createBoard() {
    const board = [];
    for (let r = 0; r < ROWS; r++) {
      board.push(new Array(COLS).fill(EMPTY));
    }
    return board;
  }

  function isFullRow(row) {
    return row.every(function (cell) { return cell !== EMPTY; });
  }

  // Would this piece be outside the grid or land on top of a block?
  function collide(board, piece) {
    for (let r = 0; r < piece.matrix.length; r++) {
      for (let c = 0; c < piece.matrix[r].length; c++) {
        if (!piece.matrix[r][c]) continue;
        const x = piece.x + c;
        const y = piece.y + r;
        if (x < 0 || x >= COLS || y >= ROWS) return true;
        if (y >= 0 && board[y][x] !== EMPTY) return true;
      }
    }
    return false;
  }

  function mergeBoard(board, piece) {
    for (let r = 0; r < piece.matrix.length; r++) {
      for (let c = 0; c < piece.matrix[r].length; c++) {
        if (!piece.matrix[r][c]) continue;
        const y = piece.y + r;
        const x = piece.x + c;
        if (y >= 0) board[y][x] = COLORS[piece.key];
      }
    }
  }

  // Removes every complete row and reports which ones were cleared
  function clearLines(board) {
    const rows = [];
    for (let r = ROWS - 1; r >= 0; r--) {
      if (isFullRow(board[r])) rows.push(r);
    }
    // rows is bottom-up, so the indexes stay valid while we cut them out
    rows.forEach(function (r) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(EMPTY));
    });
    return rows;
  }

  // Malachar's dark stone: full rows with a single gap to slide a piece through.
  // They rise from the bottom, so the top row is pushed out of the grid.
  function addGarbage(board, count) {
    for (let i = 0; i < count; i++) {
      const row = new Array(COLS).fill(GARBAGE);
      row[randomInt(COLS)] = EMPTY;
      board.shift();
      board.push(row);
    }
  }

  /* ---------- Fighters ---------- */

  function createFighter(isBoss) {
    return {
      isBoss: isBoss,
      board: createBoard(),
      queue: [],
      bag: [],
      current: null,
      hold: null,
      canHold: true,
      rot: 0,                // index of the current rotation state
      target: null,          // where the Superlord wants his piece to land
      lines: 0,
      score: 0,
      combo: 0,
      attacks: 0,            // garbage waves already thrown
      lockTimer: 0,
      flash: null,           // { rows, at } - visual line-clear effect
      topOut: false
    };
  }

  function fillQueue(fighter) {
    while (fighter.queue.length < 4) {
      if (fighter.bag.length === 0) {
        // 7-bag randomiser: every piece appears once before any repeats
        fighter.bag = SHAPE_KEYS.slice();
        for (let i = fighter.bag.length - 1; i > 0; i--) {
          const j = randomInt(i + 1);
          const swap = fighter.bag[i];
          fighter.bag[i] = fighter.bag[j];
          fighter.bag[j] = swap;
        }
      }
      fighter.queue.push(fighter.bag.pop());
    }
  }

  function makePiece(key) {
    // O is two cells wide, so it spawns one column to the right
    return { key: key, matrix: cloneMatrix(SHAPES[key][0]), x: key === 'O' ? 4 : 3, y: 0 };
  }

  // Returns false when the piece cannot appear - that fighter is done
  function spawn(fighter) {
    fillQueue(fighter);
    const key = fighter.queue.shift();
    fillQueue(fighter);
    fighter.current = makePiece(key);
    fighter.canHold = true;
    fighter.lockTimer = 0;
    fighter.rot = 0;
    fighter.target = null;
    if (collide(fighter.board, fighter.current)) {
      fighter.topOut = true;
      return false;
    }
    return true;
  }

  function move(fighter, dx, dy) {
    const moved = {
      key: fighter.current.key,
      matrix: fighter.current.matrix,
      x: fighter.current.x + dx,
      y: fighter.current.y + dy
    };
    if (collide(fighter.board, moved)) return false;
    fighter.current.x = moved.x;
    fighter.current.y = moved.y;
    fighter.lockTimer = 0;
    return true;
  }

  // Turn to the next rotation state, with a few wall kicks so pieces do not
  // stick to the walls. Direction is +1 clockwise, -1 counter-clockwise.
  // The O piece has a single state, so turning it does nothing at all.
  function rotate(fighter, direction) {
    const states = SHAPES[fighter.current.key];
    if (states.length === 1) return false;

    const next = (fighter.rot + direction + states.length) % states.length;
    const matrix = cloneMatrix(states[next]);
    const kicks = [0, -1, 1, -2, 2];
    for (let i = 0; i < kicks.length; i++) {
      const test = {
        key: fighter.current.key,
        matrix: matrix,
        x: fighter.current.x + kicks[i],
        y: fighter.current.y
      };
      if (!collide(fighter.board, test)) {
        fighter.current.matrix = matrix;
        fighter.current.x = test.x;
        fighter.lockTimer = 0;
        fighter.rot = next;
        return true;
      }
    }
    return false;
  }

  function isGrounded(fighter) {
    if (!fighter.current) return false;
    return collide(fighter.board, {
      key: fighter.current.key,
      matrix: fighter.current.matrix,
      x: fighter.current.x,
      y: fighter.current.y + 1
    });
  }

  function hardDrop(fighter) {
    let dropped = 0;
    while (move(fighter, 0, 1)) dropped++;
    fighter.score += dropped * 2;
    lockPiece(fighter);
    return dropped;
  }

  function swapHeld(fighter) {
    if (!fighter.canHold || !fighter.current) return;
    const currentKey = fighter.current.key;
    if (fighter.hold) {
      fighter.current = makePiece(fighter.hold);
    } else {
      fillQueue(fighter);
      fighter.current = makePiece(fighter.queue.shift());
      fillQueue(fighter);
    }
    fighter.hold = currentKey;
    fighter.canHold = false;
    fighter.lockTimer = 0;
    if (collide(fighter.board, fighter.current)) fighter.topOut = true;
  }

  function lockPiece(fighter) {
    mergeBoard(fighter.board, fighter.current);
    const rows = clearLines(fighter.board);

    if (rows.length > 0) {
      fighter.combo += 1;
      fighter.lines += rows.length;
      const base = [0, 100, 300, 500, 800][rows.length] || 0;
      fighter.score += base + fighter.combo * 25;
      fighter.flash = { rows: rows, at: performance.now() };

      // Four lines at once sends the dark stone straight back
      if (rows.length === 4 && !fighter.isBoss) {
        addGarbage(boss.board, 2);
        showAlert('alertGarbageOut');
      }
    } else {
      fighter.combo = 0;
    }

    fighter.current = null;
    fighter.lockTimer = 0;
    spawn(fighter);
  }

  /* ---------- Malachar's brain ---------- */

  // Classic Tetris AI scoring: low stack, no holes, flat surface, clear lines
  function evaluateBoard(board, cleared) {
    const heights = new Array(COLS).fill(0);
    let holes = 0;

    for (let c = 0; c < COLS; c++) {
      let blockSeen = false;
      for (let r = 0; r < ROWS; r++) {
        if (board[r][c] !== EMPTY) {
          if (!blockSeen) {
            heights[c] = ROWS - r;
            blockSeen = true;
          }
        } else if (blockSeen) {
          holes++;
        }
      }
    }

    let aggregate = 0;
    let tallest = 0;
    for (let c = 0; c < COLS; c++) {
      aggregate += heights[c];
      if (heights[c] > tallest) tallest = heights[c];
    }

    let bumpiness = 0;
    for (let c = 0; c < COLS - 1; c++) {
      bumpiness += Math.abs(heights[c + 1] - heights[c]);
    }

    let score = -0.51 * aggregate
              + 0.76 * cleared
              - 0.36 * holes
              - 0.18 * bumpiness;

    // He never lets his own tower climb into the danger zone
    const danger = ROWS - 4;
    if (tallest > danger) score -= (tallest - danger) * 6;
    return score;
  }

  // Tries every rotation and every column, and keeps the best landing spot.
  // Malachar is ancient and arrogant: sometimes he simply misplaces a piece.
  function chooseBestPlacement(board, piece) {
    let best = null;
    const options = [];
    const states = SHAPES[piece.key];

    for (let rot = 0; rot < states.length; rot++) {
      const matrix = states[rot];
      for (let x = -3; x < COLS; x++) {
        const test = { key: piece.key, matrix: matrix, x: x, y: 0 };
        if (collide(board, test)) continue;
        while (!collide(board, {
          key: test.key, matrix: matrix, x: x, y: test.y + 1
        })) {
          test.y++;
        }
        const simulation = cloneBoard(board);
        mergeBoard(simulation, test);
        const cleared = clearLines(simulation).length;
        const score = evaluateBoard(simulation, cleared);
        options.push({ score: score, x: x, y: test.y, rot: rot });
        if (!best || score > best.score) {
          // the rotation matters: the Superlord has to turn the piece over first
          best = { score: score, x: x, y: test.y, rot: rot };
        }
      }
    }

    if (options.length > 1 && Math.random() < BOSS_MISTAKE_RATE) {
      return options[randomInt(options.length)];
    }
    return best;
  }

  // One beat of the Superlord's turn: he turns the piece, walks it across,
  // then drops it, one step at a time
  function bossStep(fighter) {
    if (!fighter.current) return;
    if (!fighter.target) fighter.target = chooseBestPlacement(fighter.board, fighter.current);
    if (!fighter.target) {
      lockPiece(fighter);
      return;
    }

    const piece = fighter.current;
    const target = fighter.target;

    if (fighter.rot !== target.rot) {
      const states = SHAPES[fighter.current.key];
      const turns = (target.rot - fighter.rot + states.length) % states.length;
      rotate(fighter, turns === 1 ? 1 : states.length - 1);
      return;
    }
    if (piece.x < target.x) {
      piece.x++;
      if (collide(fighter.board, piece)) piece.x--;
      return;
    }
    if (piece.x > target.x) {
      piece.x--;
      if (collide(fighter.board, piece)) piece.x++;
      return;
    }
    if (piece.y < target.y) {
      piece.y++;
      if (collide(fighter.board, piece)) piece.y--;
      return;
    }
    lockPiece(fighter);
  }

  /* ---------- The match ---------- */

  let state = 'ready';          // ready | playing | paused | over
  let mode = 'normal';          // 'normal' or 'honor'
  let player = null;            // the hero
  let boss = null;              // Malachar
  let overlayState = null;      // kept so the overlay survives a language switch
  let alertTimer = null;
  let softDropping = false;

  let dropTimer = 0;
  let bossTimer = 0;
  let bossInterval = 110;
  let garbageTimer = 0;
  let garbageInterval = GARBAGE_FIRST_DELAY;
  let hudTimer = 0;
  let lastTime = 0;

  const dom = {};

  function gravityInterval() {
    // The duel speeds up as the lines pile up
    return Math.max(110, 1000 - player.lines * 35);
  }

  function bossSpeed() {
    // He plays more slowly than a seasoned hero, and speeds up only a little
    return Math.max(120, 180 - boss.lines * 3);
  }

  function sendGarbage() {
    const rows = 1 + Math.min(2, Math.floor(boss.attacks / 5));
    addGarbage(player.board, rows);
    boss.attacks++;
    garbageInterval = Math.max(GARBAGE_MIN_DELAY, GARBAGE_FIRST_DELAY - boss.attacks * GARBAGE_EACH_WAVE);
    showAlert('alertGarbageIn');
  }

  function checkEnd() {
    if (state !== 'playing') return true;
    if (player.topOut) return endMatch('lose', 'topout');
    if (boss.topOut) return endMatch('win', 'topout');
    if (player.lines >= TARGET_LINES) return endMatch('win', 'lines');
    if (boss.lines >= TARGET_LINES) return endMatch('lose', 'lines');
    return false;
  }

  function endMatch(winner, how) {
    state = 'over';

    if (winner === 'win') {
      GameState.flags.tetrisWon = true;
      GameState.flags.tetrisLines = player.lines;
      GameState.flags.tetrisScore = player.score;
      GameState.flags.tetrisMode = mode;
      GameState.save();
      showOverlay('resultWinTitle', 'resultWinText', {
        lines: player.lines,
        score: Math.round(player.score)
      }, [
        {
          labelKey: 'btnClaimVictory',
          variant: 'primary',
          action: function () { goToPage('victory.html'); }
        },
        {
          labelKey: 'btnRetryDuel',
          action: function () { restart(); }
        }
      ]);
    } else {
      showOverlay('resultLoseTitle', 'resultLoseText', null, [
        {
          labelKey: 'btnRetryDuel',
          variant: 'primary',
          action: function () { restart(); }
        },
        {
          labelKey: 'btnAbandon',
          variant: 'ghost',
          action: function () { goToPage('gameover.html?reason=tetrisLost'); }
        }
      ]);
    }

    updateHud();
  }

  /* ---------- Update loop ---------- */

  function update(dt) {
    if (player.flash && performance.now() - player.flash.at > 240) player.flash = null;
    if (boss.flash && performance.now() - boss.flash.at > 240) boss.flash = null;

    // Hero: gravity (arrow-down makes it soft drop)
    const interval = softDropping ? gravityInterval() / 12 : gravityInterval();
    dropTimer += dt;
    // never catch up more than one row per frame, or the first press of
    // the down arrow would drop the piece the whole height of the grid
    if (dropTimer > interval) dropTimer = interval;
    while (dropTimer >= interval && player.current) {
      dropTimer -= interval;
      if (move(player, 0, 1)) {
        if (checkEnd()) return;
      } else {
        dropTimer = 0;
        break;
      }
    }

    // Hero: a piece resting on the stack locks after a short delay,
    // which leaves time to slide it somewhere better
    if (player.current) {
      if (isGrounded(player)) {
        player.lockTimer += dt;
        if (player.lockTimer >= LOCK_DELAY) {
          lockPiece(player);
          if (checkEnd()) return;
        }
      } else {
        player.lockTimer = 0;
      }
    }

    // Malachar: he walks his piece across and drops it, one step at a time
    bossInterval = bossSpeed();
    bossTimer += dt;
    while (bossTimer >= bossInterval) {
      bossTimer -= bossInterval;
      bossStep(boss);
      if (checkEnd()) return;
    }

    // Malachar: waves of dark stone crash into your rows
    garbageTimer += dt;
    if (garbageTimer >= garbageInterval) {
      garbageTimer = 0;
      sendGarbage();
      if (checkEnd()) return;
    }

    hudTimer += dt;
    if (hudTimer >= 100) {
      hudTimer = 0;
      updateHud();
    }
  }

  function frame(now) {
    const dt = Math.min(now - lastTime, 120);
    lastTime = now;
    if (state === 'playing') update(dt);
    render();
    requestAnimationFrame(frame);
  }

  /* ---------- Rendering ---------- */

  function makeContext(canvas, cols, rows, cell) {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(cols * cell * ratio);
    canvas.height = Math.round(rows * cell * ratio);
    canvas.style.width = (cols * cell) + 'px';
    canvas.style.height = (rows * cell) + 'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    return ctx;
  }

  function drawBlock(ctx, px, py, cell, color, isGarbage) {
    ctx.fillStyle = color;
    ctx.fillRect(px + 1, py + 1, cell - 2, cell - 2);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(px + 2, py + 2, cell - 4, 3);
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.fillRect(px + 2, py + cell - 5, cell - 4, 3);
    if (isGarbage) {
      ctx.strokeStyle = 'rgba(255,140,140,0.40)';
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 3.5, py + 3.5, cell - 7, cell - 7);
    }
  }

  function drawGhost(ctx, piece, cell) {
    ctx.strokeStyle = 'rgba(240, 200, 120, 0.55)';
    ctx.lineWidth = 1.5;
    for (let r = 0; r < piece.matrix.length; r++) {
      for (let c = 0; c < piece.matrix[r].length; c++) {
        if (!piece.matrix[r][c]) continue;
        const x = (piece.x + c) * cell + 2.5;
        const y = (piece.y + r) * cell + 2.5;
        ctx.strokeRect(x, y, cell - 5, cell - 5);
      }
    }
  }

  function drawPiece(ctx, piece, cell) {
    for (let r = 0; r < piece.matrix.length; r++) {
      for (let c = 0; c < piece.matrix[r].length; c++) {
        if (!piece.matrix[r][c]) continue;
        const y = piece.y + r;
        if (y < 0) continue;
        drawBlock(ctx, (piece.x + c) * cell, y * cell, cell, COLORS[piece.key], false);
      }
    }
  }

  function drawBoard(ctx, fighter, cell, options) {
    const w = COLS * cell;
    const h = ROWS * cell;

    const backdrop = ctx.createLinearGradient(0, 0, 0, h);
    backdrop.addColorStop(0, '#0b0b18');
    backdrop.addColorStop(1, '#15152c');
    ctx.fillStyle = backdrop;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let c = 1; c < COLS; c++) {
      ctx.moveTo(c * cell + 0.5, 0);
      ctx.lineTo(c * cell + 0.5, h);
    }
    for (let r = 1; r < ROWS; r++) {
      ctx.moveTo(0, r * cell + 0.5);
      ctx.lineTo(w, r * cell + 0.5);
    }
    ctx.stroke();

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const value = fighter.board[r][c];
        if (value !== EMPTY) drawBlock(ctx, c * cell, r * cell, cell, value, value === GARBAGE);
      }
    }

    if (fighter.current) {
      if (options.ghost) {
        const landing = {
          key: fighter.current.key,
          matrix: fighter.current.matrix,
          x: fighter.current.x,
          y: fighter.current.y
        };
        while (!collide(fighter.board, {
          key: landing.key, matrix: landing.matrix, x: landing.x, y: landing.y + 1
        })) landing.y++;
        drawGhost(ctx, landing, cell);
      }
      drawPiece(ctx, fighter.current, cell);
    }

    if (fighter.flash) {
      const alpha = Math.max(0, 1 - (performance.now() - fighter.flash.at) / 220);
      if (alpha > 0) {
        ctx.fillStyle = 'rgba(255,255,255,' + alpha.toFixed(3) + ')';
        fighter.flash.rows.forEach(function (r) { ctx.fillRect(0, r * cell, w, cell); });
      }
    }
  }

  function drawPreview(ctx, key) {
    if (!ctx) return;
    const w = 4 * PREVIEW_CELL;
    const h = 4 * PREVIEW_CELL;
    ctx.clearRect(0, 0, w, h);
    if (!key) return;

    // bounding box of the piece, so it sits centred inside the box
    const shape = SHAPES[key][0];
    let minR = shape.length, maxR = -1, minC = shape[0].length, maxC = -1;
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        if (r < minR) minR = r;
        if (r > maxR) maxR = r;
        if (c < minC) minC = c;
        if (c > maxC) maxC = c;
      }
    }
    const pieceW = (maxC - minC + 1) * PREVIEW_CELL;
    const pieceH = (maxR - minR + 1) * PREVIEW_CELL;
    const offsetX = (w - pieceW) / 2;
    const offsetY = (h - pieceH) / 2;

    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        if (!shape[r][c]) continue;
        drawBlock(
          ctx,
          offsetX + (c - minC) * PREVIEW_CELL,
          offsetY + (r - minR) * PREVIEW_CELL,
          PREVIEW_CELL,
          COLORS[key],
          false
        );
      }
    }
  }

  function render() {
    drawBoard(dom.bossCtx, boss, BOSS_CELL, { ghost: false });
    drawBoard(dom.playerCtx, player, PLAYER_CELL, { ghost: true });
    drawPreview(dom.nextCtx, player.queue[0]);
    drawPreview(dom.holdCtx, player.hold);
  }

  /* ---------- HUD, alerts, overlay ---------- */

  function updateHud() {
    dom.bossLines.textContent = boss.lines + ' / ' + TARGET_LINES;
    dom.playerLines.textContent = player.lines + ' / ' + TARGET_LINES;
    dom.bossFill.style.width = Math.min(100, (boss.lines / TARGET_LINES) * 100) + '%';
    dom.playerFill.style.width = Math.min(100, (player.lines / TARGET_LINES) * 100) + '%';
    dom.score.textContent = player.score;
    dom.playerSide.classList.toggle('in-danger', isInDanger(player));
  }

  function isInDanger(fighter) {
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < COLS; c++) {
        if (fighter.board[r][c] !== EMPTY) return true;
      }
    }
    return false;
  }

  function showAlert(key) {
    if (!dom.alert) return;
    dom.alert.innerHTML = t(key);
    dom.alert.classList.add('visible');
    clearTimeout(alertTimer);
    alertTimer = setTimeout(function () {
      dom.alert.classList.remove('visible');
    }, 1800);
  }

  function showOverlay(titleKey, textKey, vars, actions) {
    overlayState = {
      titleKey: titleKey,
      textKey: textKey,
      vars: vars,
      actions: actions
    };

    dom.overlayTitle.innerHTML = t(titleKey);
    dom.overlayText.innerHTML = t(textKey, vars);
    dom.overlayActions.innerHTML = '';

    actions.forEach(function (item) {
      const button = document.createElement('button');
      button.className = 'overlay-btn ' + (item.variant || '');
      button.textContent = t(item.labelKey);
      button.addEventListener('click', item.action);
      dom.overlayActions.appendChild(button);
    });

    dom.overlay.classList.add('visible');
  }

  function hideOverlay() {
    overlayState = null;
    dom.overlay.classList.remove('visible');
  }

  /* ---------- Input ---------- */

  function playerAction(action) {
    if (state !== 'playing' || !player.current) return;
    switch (action) {
      case 'left': move(player, -1,  0); break;
      case 'right': move(player, 1,  0); break;
      case 'soft': move(player, 0,  1); break;
      case 'rotate': rotate(player, 1); break;
      case 'rotateBack': rotate(player, -1); break;
      case 'hold': swapHeld(player); checkEnd(); break;
      case 'drop': hardDrop(player); checkEnd(); break;
    }
  }

  function onKeyDown(event) {
    const key = event.key;
    const onButton = event.target && event.target.tagName === 'BUTTON';

    if ((key === 'Enter' || key === ' ') && !onButton) {
      if (state === 'ready') { event.preventDefault(); startMatch(); return; }
      if (state === 'paused') { event.preventDefault(); togglePause(); return; }
    }

    if (key === 'p' || key === 'P' || key === 'Escape') {
      event.preventDefault();
      togglePause();
      return;
    }
    if (key === 'r' || key === 'R') {
      restart();
      return;
    }

    switch (key) {
      case 'ArrowLeft': event.preventDefault(); playerAction('left'); break;
      case 'ArrowRight': event.preventDefault(); playerAction('right'); break;
      case 'ArrowDown':
        event.preventDefault();
        softDropping = true;
        dropTimer = 0;              // the press itself is the first row
        playerAction('soft');
        break;
      case 'ArrowUp': event.preventDefault(); playerAction('rotate'); break;
      case 'x': case 'X': event.preventDefault(); playerAction('rotate'); break;
      case 'z': case 'Z': event.preventDefault(); playerAction('rotateBack'); break;
      case 'c': case 'C': event.preventDefault(); playerAction('hold'); break;
      case ' ': event.preventDefault(); playerAction('drop'); break;
    }
  }

  function onKeyUp(event) {
    if (event.key === 'ArrowDown') softDropping = false;
  }

  function wireTouchControls() {
    const buttons = document.querySelectorAll('[data-act]');
    Array.prototype.forEach.call(buttons, function (button) {
      const action = button.getAttribute('data-act');
      const release = function () {
        if (action === 'soft') softDropping = false;
      };

      button.addEventListener('pointerdown', function (event) {
        event.preventDefault();
        if (action === 'soft') softDropping = true;
        playerAction(action);
      });
      button.addEventListener('pointerup', release);
      button.addEventListener('pointerleave', release);
      button.addEventListener('pointercancel', release);
    });
  }

  /* ---------- Match control ---------- */

  function resetFighters() {
    player = createFighter(false);
    boss = createFighter(true);
    spawn(player);
    spawn(boss);
    if (mode === 'honor') boss.lines = HEAD_START;

    dropTimer = 0;
    bossTimer = 0;
    garbageTimer = 0;
    garbageInterval = GARBAGE_FIRST_DELAY;
    softDropping = false;
    updateHud();
  }

  function startMatch() {
    resetFighters();
    state = 'playing';
    hideOverlay();
    lastTime = performance.now();
    if (dom.playerSide) {
      dom.playerSide.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function restart() {
    resetFighters();
    state = 'playing';
    hideOverlay();
    lastTime = performance.now();
  }

  function togglePause() {
    if (state === 'playing') {
      state = 'paused';
      softDropping = false;
      showOverlay('pausedTitle', 'pausedText', null, [
        { labelKey: 'btnResume', variant: 'primary', action: function () { togglePause(); } },
        { labelKey: 'btnRestart', action: function () { restart(); } }
      ]);
    } else if (state === 'paused') {
      state = 'playing';
      hideOverlay();
      lastTime = performance.now();
    }
  }

  // Called when the player flips between English and French
  function refreshLanguage() {
    if (dom.taunt) {
      dom.taunt.innerHTML = t(mode === 'honor' ? 'bossTauntHonor' : 'bossTaunt');
    }
    if (overlayState) {
      showOverlay(
        overlayState.titleKey,
        overlayState.textKey,
        overlayState.vars,
        overlayState.actions
      );
    }
  }

  /* ---------- Setup ---------- */

  function cacheDom() {
    dom.playerSide = document.getElementById('playerSide');
    dom.taunt = document.getElementById('arenaTaunt');
    dom.alert = document.getElementById('garbageAlert');
    dom.overlay = document.getElementById('duelOverlay');
    dom.overlayTitle = document.getElementById('overlayTitle');
    dom.overlayText = document.getElementById('overlayText');
    dom.overlayActions = document.getElementById('overlayActions');
    dom.bossLines = document.getElementById('bossLinesValue');
    dom.playerLines = document.getElementById('playerLinesValue');
    dom.bossFill = document.getElementById('bossFill');
    dom.playerFill = document.getElementById('playerFill');
    dom.score = document.getElementById('scoreValue');

    dom.bossCtx = makeContext(document.getElementById('bossCanvas'), COLS, ROWS, BOSS_CELL);
    dom.playerCtx = makeContext(document.getElementById('playerCanvas'), COLS, ROWS, PLAYER_CELL);
    dom.nextCtx = makeContext(document.getElementById('nextCanvas'), 4, 4, PREVIEW_CELL);
    dom.holdCtx = makeContext(document.getElementById('holdCanvas'), 4, 4, PREVIEW_CELL);
  }

  function init() {
    mode = new URLSearchParams(window.location.search).get('mode') === 'honor'
      ? 'honor'
      : 'normal';

    cacheDom();
    resetFighters();

    refreshLanguage();
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    wireTouchControls();

    const pauseButton = document.getElementById('btnPause');
    if (pauseButton) pauseButton.addEventListener('click', togglePause);
    const restartButton = document.getElementById('btnRestart');
    if (restartButton) restartButton.addEventListener('click', restart);

    // A hidden tab is not a fair fight - pause instead of losing
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && state === 'playing') togglePause();
    });

    state = 'ready';
    showOverlay('duelReadyTitle', 'duelReadyText', null, [
      { labelKey: 'btnStartDuel', variant: 'primary', action: startMatch }
    ]);

    lastTime = performance.now();
    requestAnimationFrame(frame);
  }

  return {
    init: init,
    restart: restart,
    togglePause: togglePause,
    refreshLanguage: refreshLanguage
  };
})();