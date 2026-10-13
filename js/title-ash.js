// Page title (homepage hero and shop page): as the page scrolls down, the letters are swept off to the left
// and break up into small ash-like particles carried the same way. Scrolling
// back up reassembles the title. (GSAP ScrollTrigger + a canvas over the header.)
//
// The letters themselves are moved by a scrubbed GSAP timeline. The particles
// are not simulated: each one's position is a pure function of the timeline's
// time, so the effect scrubs backwards and forwards exactly.
(function () {
  var title = document.querySelector('.header-title.kinetic, .shop-title');
  var header = title && title.closest('header');
  if (!title || !header || !window.gsap || !window.ScrollTrigger) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  gsap.registerPlugin(ScrollTrigger);

  var RAMP = [[122, 90, 18], [212, 175, 55], [247, 231, 166]];  // title colours (gold)
  var ASH = [96, 90, 84];                                     // what they burn down to
  var LETTER_DUR = 0.4;   // timeline seconds each letter takes to blow away
  var STAGGER = 0.5;      // spread of start times, leftmost letter first
  var TAIL = 0.6;         // extra time for the last particles to clear
  var SCROLL_SPAN = 0.75; // effect plays over this fraction of the window height...
  var HEADER_SPAN = 0.85; // ...or this fraction of the header's height, if that's shorter

  var letters = Array.prototype.slice.call(title.querySelectorAll('.ch'));
  if (!letters.length) return;

  var canvas = document.createElement('canvas');
  canvas.className = 'title-ash';
  canvas.setAttribute('aria-hidden', 'true');
  header.appendChild(canvas);
  var ctx = canvas.getContext('2d');

  var tl = null, particles = [], W = 0, H = 0, dpr = 1;

  function rand(a, b) { return a + Math.random() * (b - a); }

  // random points that fall inside the drawn shape of one letter
  function glyphPoints(box, count) {
    var w = Math.max(2, Math.round(box.w)), h = Math.max(2, Math.round(box.h));
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var g = c.getContext('2d');
    var cs = getComputedStyle(box.el);
    g.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(box.el.textContent, w / 2, h / 2);
    var data = g.getImageData(0, 0, w, h).data;
    var pts = [];
    for (var n = 0; n < count; n++) {
      var x = 0, y = 0;
      for (var tries = 0; tries < 14; tries++) {
        x = Math.random() * w; y = Math.random() * h;
        if (data[((y | 0) * w + (x | 0)) * 4 + 3] > 100) break;
      }
      pts.push([x, y]);
    }
    return pts;
  }

  function build() {
    if (tl) {
      if (tl.scrollTrigger) tl.scrollTrigger.kill();
      tl.kill();
      tl = null;
    }
    gsap.set(letters, { clearProps: 'transform,opacity' });
    title.classList.add('ch-ready'); // hands the letters over from the CSS intro animation

    var hb = header.getBoundingClientRect();
    W = hb.width; H = hb.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);

    var boxes = letters.map(function (el) {
      var r = el.getBoundingClientRect();
      return { el: el, x: r.left - hb.left, y: r.top - hb.top, w: r.width, h: r.height };
    }).sort(function (a, b) { return a.x - b.x; });

    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    boxes.forEach(function (b) {
      minX = Math.min(minX, b.x); minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h);
    });
    var span = (maxX - minX) + (maxY - minY) || 1;

    particles = [];
    tl = gsap.timeline({
      defaults: { ease: 'power1.in' },
      onUpdate: draw,
      scrollTrigger: {
        trigger: header,
        start: 'top top',
        end: function () {
          return '+=' + Math.round(Math.min(window.innerHeight * SCROLL_SPAN, header.offsetHeight * HEADER_SPAN));
        },
        scrub: 1
      }
    });

    boxes.forEach(function (b, k) {
      b.start = boxes.length > 1 ? (k / (boxes.length - 1)) * STAGGER : 0;
      b.travel = Math.max(160, (b.x + b.w) * 0.6); // how far left the letter gets before it's gone

      // one wind direction for everything: left, slightly up, leaning into it
      tl.to(b.el, {
        x: -b.travel,
        y: rand(-50, 10),
        rotation: rand(-22, -6),
        skewX: -16,
        opacity: 0,
        duration: LETTER_DUR
      }, b.start);

      var count = Math.max(40, Math.min(260, Math.round((b.w * b.h) / 55)));
      glyphPoints(b, count).forEach(function (pt) {
        // the windward (right) side of each letter crumbles first
        var frac = 0.6 * (1 - pt[0] / b.w) + 0.4 * Math.random();
        var s = b.start + LETTER_DUR * (0.1 + 0.85 * frac);
        var u = (s - b.start) / LETTER_DUR;
        var ox = b.x + pt[0], oy = b.y + pt[1];
        var t = Math.max(0, Math.min(1, ((ox - minX) + (oy - minY)) / span)) * (RAMP.length - 1);
        var i = Math.min(Math.floor(t), RAMP.length - 2), f = t - i;
        particles.push({
          x: ox - b.travel * u * u, // where the letter has drifted to when this bit breaks off
          y: oy,
          s: s,
          life: rand(0.3, 0.55),
          dx: -rand(0.25, 0.8) * W,
          dy: rand(-0.2, 0.06) * H,
          amp: rand(4, 22),
          freq: rand(1.5, 4.5),
          phase: rand(0, 6.283),
          size: rand(2, 5),
          r: RAMP[i][0] + (RAMP[i + 1][0] - RAMP[i][0]) * f,
          g: RAMP[i][1] + (RAMP[i + 1][1] - RAMP[i][1]) * f,
          b: RAMP[i][2] + (RAMP[i + 1][2] - RAMP[i][2]) * f
        });
      });
    });
    tl.to({}, { duration: TAIL });
    draw();
  }

  function draw() {
    var t = tl ? tl.time() : 0;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    for (var n = 0; n < particles.length; n++) {
      var p = particles[n];
      var q = (t - p.s) / p.life;
      if (q <= 0 || q >= 1) continue;
      var e = 0.4 * q + 0.6 * q * q; // picks up speed as the wind takes it
      var x = p.x + p.dx * e;
      var y = p.y + p.dy * q + Math.sin(q * p.freq * 6.283 + p.phase) * p.amp * q;
      var a = q < 0.12 ? q / 0.12 : (q > 0.55 ? (1 - q) / 0.45 : 1);
      var k = Math.min(1, q * 1.4);   // ember colour cools to grey ash
      var size = p.size * (1 - 0.6 * q);
      ctx.fillStyle = 'rgba(' +
        Math.round(p.r + (ASH[0] - p.r) * k) + ',' +
        Math.round(p.g + (ASH[1] - p.g) * k) + ',' +
        Math.round(p.b + (ASH[2] - p.b) * k) + ',' + a.toFixed(3) + ')';
      ctx.fillRect(x, y, size, size);
    }
  }

  // start once the web font is in and the CSS intro animation (about 1.1s) is over
  var began = Date.now();
  function begin() { setTimeout(build, Math.max(0, 1400 - (Date.now() - began))); }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(begin);
  else window.addEventListener('load', begin);

  var timer;
  window.addEventListener('resize', function () {
    if (!tl) return;
    clearTimeout(timer);
    timer = setTimeout(build, 300);
  });
})();
