// Top-down pen plotter animation. Draws a set of strokes onto a sheet of paper: the gantry slides up and down the side rails, the carriage
// slides along the gantry, and the pen lifts between strokes. It draws once, the
// first time the card scrolls into view, then parks and leaves the drawing on the
// sheet. A .plotter-replay button (if present) swaps the sheet and draws it again.
//
// Markup: <canvas class="plotter-canvas"></canvas>, any number per page. Options:
//   data-plotter="bird"  which drawing (window.PLOTTER_DATA[name], from a *-paths.js file)
//   data-aspect="0.8"    canvas height as a fraction of its width (0.8 = 5:4)
//   data-seconds="45"    roughly how long the drawing takes, pen-down time
// A .plotter-replay button next to the canvas (same parent element) replays it.
(function () {
  var library = window.PLOTTER_DATA || {};
  if (window.PLOTTER_BIRD && !library.bird) library.bird = window.PLOTTER_BIRD;

  function plotter(canvas) {
    var data = library[canvas.getAttribute('data-plotter') || 'bird'];
    if (!data) return;
    var ctx = canvas.getContext('2d');
    var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var DRAW_SECONDS = parseFloat(canvas.getAttribute('data-seconds')) || 45;
    var ASPECT = parseFloat(canvas.getAttribute('data-aspect')) || 0.8;
    var TRAVEL_FACTOR = 3.5; // pen-up moves are this much faster than drawing
    var PEN_MOVE = 0.12;     // seconds to lift or drop the pen
    var SWAP = 1.2;          // seconds to swap the sheet when replaying

    // ---------- geometry (recomputed on resize) ----------
    var W, H, dpr, g = {};
    var ink = document.createElement('canvas');   // the drawing so far
    var inkCtx = ink.getContext('2d');

    function layout() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.clientWidth;
      H = Math.round(W * ASPECT);
      canvas.style.height = H + 'px';
      canvas.width = ink.width = Math.round(W * dpr);
      canvas.height = ink.height = Math.round(H * dpr);

      var base = Math.min(W, H / 0.8);   // machine parts scale with this, so wide beds don't get huge parts
      var rail = Math.max(14, base * 0.04);
      g.rail = rail;
      g.railL = W * 0.03;
      g.railR = W - W * 0.03 - rail;
      g.gantryH = Math.max(16, H * 0.055);
      g.carW = Math.max(26, base * 0.07);
      g.carH = g.gantryH * 1.9;
      // sheet of paper centred between the rails: A-series proportions, or wider
      // (a banner) when the drawing itself is wide
      var ratio = Math.max(1.414, (data.w / data.h) * 1.2);
      var innerL = g.railL + rail + W * 0.05, innerR = g.railR - W * 0.05;
      var pw = innerR - innerL, ph = pw / ratio;
      if (ph > H * 0.82) { ph = H * 0.82; pw = ph * ratio; }
      g.paper = { x: (W - pw) / 2, y: (H - ph) / 2, w: pw, h: ph };
      // drawing area on the sheet, keeping the drawing's proportions
      var m = pw * 0.08;
      var s = Math.min((pw - 2 * m) / data.w, (ph - 2 * m) / data.h);
      g.scale = s;
      g.ox = g.paper.x + (pw - data.w * s) / 2;
      g.oy = g.paper.y + (ph - data.h * s) / 2;
      g.home = { x: g.paper.x - W * 0.02, y: g.paper.y - H * 0.04 };
    }

    function toScreen(x, y) { return { x: g.ox + x * g.scale, y: g.oy + y * g.scale }; }

    // ---------- the job: a list of moves ----------
    var strokes = data.strokes;
    var totalInk = 0;
    strokes.forEach(function (s) {
      for (var i = 2; i < s.length; i += 2) totalInk += Math.hypot(s[i] - s[i - 2], s[i + 1] - s[i - 1]);
    });
    var drawSpeed = totalInk / DRAW_SECONDS;     // image px per second
    var travelSpeed = drawSpeed * TRAVEL_FACTOR;

    // state
    var pen = { x: 0, y: 0, down: 0 };  // position in image px; down: 0 = up, 1 = on the paper
    var job;                            // current position in the job
    function resetJob() {
      job = { stroke: 0, point: 0, phase: 'travel', t: 0, sheet: 1, done: false };
      var h = homeImage();
      pen.x = h.x; pen.y = h.y; pen.down = 0;
      inkCtx.setTransform(1, 0, 0, 1, 0, 0);
      inkCtx.clearRect(0, 0, ink.width, ink.height);
    }
    function homeImage() { return { x: (g.home.x - g.ox) / g.scale, y: (g.home.y - g.oy) / g.scale }; }

    function inkLine(x0, y0, x1, y1) {
      var a = toScreen(x0, y0), b = toScreen(x1, y1);
      inkCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      inkCtx.strokeStyle = '#151515';
      inkCtx.lineWidth = Math.max(1, g.scale * 1.6);
      inkCtx.lineCap = 'round';
      inkCtx.lineJoin = 'round';
      inkCtx.beginPath();
      inkCtx.moveTo(a.x, a.y);
      inkCtx.lineTo(b.x, b.y);
      inkCtx.stroke();
    }

    // move the pen towards (tx, ty) at speed for up to dt seconds; returns time left over
    function moveTo(tx, ty, speed, dt, drawing) {
      var dx = tx - pen.x, dy = ty - pen.y, dist = Math.hypot(dx, dy);
      var step = speed * dt;
      var nx, ny, left;
      if (step >= dist) { nx = tx; ny = ty; left = dist ? dt - dist / speed : dt; }
      else { nx = pen.x + dx / dist * step; ny = pen.y + dy / dist * step; left = 0; }
      if (drawing) inkLine(pen.x, pen.y, nx, ny);
      pen.x = nx; pen.y = ny;
      return left;
    }

    function advance(dt) {
      var guard = 0;
      while (dt > 0 && guard++ < 10000) {
        if (job.phase === 'done') {
          dt = 0;
        } else if (job.phase === 'park') {
          var home = homeImage();
          dt = moveTo(home.x, home.y, travelSpeed, dt, false);
          if (pen.x === home.x && pen.y === home.y) { job.phase = 'done'; finished(); }
        } else if (job.phase === 'swap') {
          job.t += dt; dt = 0;
          var h = homeImage();
          moveTo(h.x, h.y, travelSpeed * 1.5, 1 / 60, false);
          if (job.t >= SWAP) resetJob();
        } else if (job.stroke >= strokes.length) {
          job.phase = 'park'; job.t = 0; pen.down = 0;
        } else {
          var s = strokes[job.stroke];
          if (job.phase === 'travel') {
            dt = moveTo(s[0], s[1], travelSpeed, dt, false);
            if (pen.x === s[0] && pen.y === s[1]) { job.phase = 'drop'; job.t = 0; }
          } else if (job.phase === 'drop') {
            job.t += dt;
            pen.down = Math.min(1, job.t / PEN_MOVE);
            if (job.t >= PEN_MOVE) { dt = job.t - PEN_MOVE; job.phase = 'draw'; job.point = 1; } else dt = 0;
          } else if (job.phase === 'draw') {
            var tx = s[job.point * 2], ty = s[job.point * 2 + 1];
            dt = moveTo(tx, ty, drawSpeed, dt, true);
            if (pen.x === tx && pen.y === ty) {
              job.point++;
              if (job.point * 2 >= s.length) { job.phase = 'lift'; job.t = 0; }
            }
          } else if (job.phase === 'lift') {
            job.t += dt;
            pen.down = Math.max(0, 1 - job.t / PEN_MOVE);
            if (job.t >= PEN_MOVE) { dt = job.t - PEN_MOVE; job.stroke++; job.phase = 'travel'; } else dt = 0;
          }
        }
      }
    }

    // ---------- drawing the machine ----------
    function roundRect(x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }

    function render() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // bed with a faint dot grid
      ctx.fillStyle = '#e6e3dc';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      var step = Math.max(12, W / 40);
      for (var gy = step / 2; gy < H; gy += step)
        for (var gx = step / 2; gx < W; gx += step) ctx.fillRect(gx, gy, 1.2, 1.2);

      // paper (fades out and back in during the sheet swap)
      var p = g.paper;
      var fade = job.phase === 'swap' ? Math.abs(Math.cos(Math.min(1, job.t / SWAP) * Math.PI)) : 1;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.18)';
      ctx.shadowBlur = 10; ctx.shadowOffsetY = 3;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.restore();
      // corner clips holding the sheet down
      ctx.fillStyle = '#3a3a3a';
      var c = Math.max(6, p.w * 0.025);
      [[p.x, p.y], [p.x + p.w - c, p.y], [p.x, p.y + p.h - c], [p.x + p.w - c, p.y + p.h - c]].forEach(function (q) {
        ctx.fillRect(q[0], q[1], c, c);
      });
      // the ink
      ctx.globalAlpha = job.phase === 'swap' && job.t < SWAP / 2 ? fade : (job.phase === 'swap' ? 0 : 1);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(ink, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = 1;

      // side rails (Y axis) with belts and stepper motors at the top
      [g.railL, g.railR].forEach(function (x) {
        var grd = ctx.createLinearGradient(x, 0, x + g.rail, 0);
        grd.addColorStop(0, '#2a2a2a'); grd.addColorStop(0.5, '#4a4a4a'); grd.addColorStop(1, '#232323');
        ctx.fillStyle = grd;
        ctx.fillRect(x, 0, g.rail, H);
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(x + g.rail * 0.45, 0, g.rail * 0.1, H);           // belt
        ctx.fillStyle = '#111';
        roundRect(x - g.rail * 0.2, H * 0.015, g.rail * 1.4, g.rail * 1.4, 3); ctx.fill();   // motor
        ctx.fillStyle = '#6b6b6b';
        ctx.beginPath(); ctx.arc(x + g.rail / 2, H * 0.015 + g.rail * 0.7, g.rail * 0.22, 0, Math.PI * 2); ctx.fill();
      });

      var s = toScreen(pen.x, pen.y);

      // gantry (X axis), spanning the rails at the pen's height
      var gy0 = s.y - g.gantryH / 2;
      var ggr = ctx.createLinearGradient(0, gy0, 0, gy0 + g.gantryH);
      ggr.addColorStop(0, '#d9d9d9'); ggr.addColorStop(0.5, '#a9a9a9'); ggr.addColorStop(1, '#8a8a8a');
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 4;
      ctx.fillStyle = ggr;
      ctx.fillRect(g.railL, gy0, g.railR + g.rail - g.railL, g.gantryH);
      ctx.restore();
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(g.railL, gy0 + g.gantryH * 0.46, g.railR + g.rail - g.railL, g.gantryH * 0.08);   // slot
      // end blocks riding on the rails
      ctx.fillStyle = '#151515';
      [g.railL, g.railR].forEach(function (x) {
        roundRect(x - g.rail * 0.15, s.y - g.gantryH * 0.85, g.rail * 1.3, g.gantryH * 1.7, 3); ctx.fill();
      });

      // carriage with the pen
      var cx0 = s.x - g.carW / 2, cy0 = s.y - g.carH / 2;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 3;
      ctx.fillStyle = '#1b1b1b';
      roundRect(cx0, cy0, g.carW, g.carH, 4); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#7a7a7a';
      [[0.18, 0.15], [0.82, 0.15], [0.18, 0.85], [0.82, 0.85]].forEach(function (q) {   // screws
        ctx.beginPath(); ctx.arc(cx0 + g.carW * q[0], cy0 + g.carH * q[1], Math.max(1.5, g.carW * 0.05), 0, Math.PI * 2); ctx.fill();
      });
      // pen: raised = bigger with a shadow off to the side; down = smaller, on the paper
      var lift = 1 - pen.down;
      var r = g.carW * (0.16 + 0.05 * lift);
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,' + (0.15 + 0.35 * lift) + ')';
      ctx.shadowBlur = 2 + 6 * lift;
      ctx.shadowOffsetX = 3 * lift; ctx.shadowOffsetY = 4 * lift;
      ctx.fillStyle = '#f2f2f2';
      ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.fillStyle = pen.down > 0.5 ? '#C0C0C0' : '#151515';
      ctx.beginPath(); ctx.arc(s.x, s.y, r * 0.45, 0, Math.PI * 2); ctx.fill();
    }

    // ---------- run ----------
    function redrawFinished() {
      // reduced motion, or after a resize: lay down every stroke up to where the job is
      inkCtx.setTransform(1, 0, 0, 1, 0, 0);
      inkCtx.clearRect(0, 0, ink.width, ink.height);
      var upTo = still ? strokes.length : job.stroke;
      for (var k = 0; k < upTo && k < strokes.length; k++) {
        var s = strokes[k];
        for (var i = 2; i < s.length; i += 2) inkLine(s[i - 2], s[i - 1], s[i], s[i + 1]);
      }
      if (!still && job.phase === 'draw' && job.stroke < strokes.length) {
        var cur = strokes[job.stroke];
        for (var j = 1; j < job.point; j++) inkLine(cur[j * 2 - 2], cur[j * 2 - 1], cur[j * 2], cur[j * 2 + 1]);
        inkLine(cur[job.point * 2 - 2], cur[job.point * 2 - 1], pen.x, pen.y);
      }
    }

    layout();
    resetJob();

    if (still) {
      job.stroke = strokes.length;
      var h = homeImage();
      pen.x = h.x; pen.y = h.y;
      redrawFinished();
      render();
      window.addEventListener('resize', function () { layout(); redrawFinished(); render(); });
      return;
    }

    var replay = canvas.parentNode.querySelector('.plotter-replay');
    var last = null, running = false, started = false;
    var visible = !('IntersectionObserver' in window);

    function frame(now) {
      if (last === null) last = now;
      var dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (visible) { advance(dt); render(); }
      if (job.phase === 'done') { running = false; return; }   // stop until replayed
      requestAnimationFrame(frame);
    }
    function run() {
      if (running) return;
      running = true; last = null;
      if (replay) replay.disabled = true;
      requestAnimationFrame(frame);
    }
    function finished() {
      if (replay) replay.disabled = false;
    }

    render(); // empty sheet, gantry parked, until it's on screen
    if (replay) {
      replay.disabled = true;
      replay.addEventListener('click', function () {
        if (job.phase !== 'done') return;
        job.phase = 'swap'; job.t = 0;
        run();
      });
    }

    // start drawing the first time the card is on screen; pause while it's off screen
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible && !started) { started = true; run(); }
      }, { threshold: 0.35 }).observe(canvas);
    } else {
      started = true; run();
    }
    var timer;
    window.addEventListener('resize', function () {
      clearTimeout(timer);
      timer = setTimeout(function () { layout(); redrawFinished(); render(); }, 120);
    });
  }

  document.querySelectorAll('.plotter-canvas').forEach(plotter);
})();
