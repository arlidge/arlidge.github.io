// Title fill: one dithered gradient running diagonally (45deg, top-left to
// bottom-right) across the whole title, dark gold to pale gold.
// The gradient is drawn once on a small canvas at "dither pixel" resolution,
// then used as the clipped background of every letter, offset so the letters
// line up as windows onto the same picture. Without JS the CSS falls back to
// the per-letter top-to-bottom texture.
(function () {
  var RAMP = [[0x7A, 0x5A, 0x12], [0xD4, 0xAF, 0x37], [0xF7, 0xE7, 0xA6]]; // dark gold, gold, pale gold
  var BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  var CELL = 2; // size of one dither pixel on screen, px

  var probe = document.createElement('span').style;
  if (!('backgroundClip' in probe) && !('webkitBackgroundClip' in probe)) return;

  function texture(w, h) {
    var cols = Math.max(2, Math.ceil(w / CELL));
    var rows = Math.max(2, Math.ceil(h / CELL));
    var canvas = document.createElement('canvas');
    canvas.width = cols;
    canvas.height = rows;
    var ctx = canvas.getContext('2d');
    var img = ctx.createImageData(cols, rows);
    var span = cols + rows - 2;
    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < cols; x++) {
        var t = ((x + y) / span) * (RAMP.length - 1); // 45deg: constant along x + y
        var i = Math.min(Math.floor(t), RAMP.length - 2);
        var c = (t - i) > (BAYER[y % 4][x % 4] + 0.5) / 16 ? RAMP[i + 1] : RAMP[i];
        var o = (y * cols + x) * 4;
        img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return { url: canvas.toDataURL('image/png'), w: cols * CELL, h: rows * CELL };
  }

  // pieces: [{ el, x, y, w, h }] in one shared coordinate space
  function paint(pieces) {
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    pieces.forEach(function (p) {
      minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x + p.w); maxY = Math.max(maxY, p.y + p.h);
    });
    if (!(maxX > minX) || !(maxY > minY)) return;
    var tex = texture(maxX - minX, maxY - minY);
    pieces.forEach(function (p) {
      var s = p.el.style;
      s.backgroundImage = 'url(' + tex.url + ')';
      s.backgroundRepeat = 'no-repeat';
      s.backgroundSize = tex.w + 'px ' + tex.h + 'px';
      // snap to the dither grid so neighbouring letters share the same pixels
      s.backgroundPosition = -Math.round((p.x - minX) / CELL) * CELL + 'px ' +
                             -Math.round((p.y - minY) / CELL) * CELL + 'px';
    });
  }

  function render() {
    // one piece per letter (layout offsets ignore any transforms on the letters)
    var letters = document.querySelectorAll('.header-title.kinetic .ch, .shop-title .ch');
    if (letters.length) {
      paint(Array.prototype.map.call(letters, function (el) {
        return { el: el, x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight };
      }));
    }
    // a shop title that hasn't been split into letters: fit the gradient to its text
    var shop = document.querySelector('.shop-title');
    if (shop && !shop.querySelector('.ch')) {
      var box = shop.getBoundingClientRect();
      var range = document.createRange();
      range.selectNodeContents(shop);
      var text = range.getBoundingClientRect();
      var tex = texture(text.width, text.height);
      var s = shop.style;
      s.backgroundImage = 'url(' + tex.url + ')';
      s.backgroundRepeat = 'no-repeat';
      s.backgroundSize = tex.w + 'px ' + tex.h + 'px';
      s.backgroundPosition = Math.round(text.left - box.left) + 'px ' + Math.round(text.top - box.top) + 'px';
    }
  }

  var timer;
  window.addEventListener('resize', function () {
    clearTimeout(timer);
    timer = setTimeout(render, 150);
  });
  render();
  // the letters change size once the web font arrives
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(render);
  window.addEventListener('load', render);
})();
