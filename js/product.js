// Product page variations: each .variant-btn (data-variant="green") shows the
// group of thumbnails with the matching data-variant-views, and selects that
// group's first thumbnail so the main image changes (js/gallery.js does the swap).
(function () {
  document.querySelectorAll('[data-product]').forEach(function (product) {
    var buttons = product.querySelectorAll('.variant-btn');
    var groups = product.querySelectorAll('[data-variant-views]');
    var current = product.querySelector('.variant-current');
    if (!buttons.length || !groups.length) return;

    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-variant');
        buttons.forEach(function (b) {
          var on = b === btn;
          b.classList.toggle('is-active', on);
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        groups.forEach(function (g) {
          var on = g.getAttribute('data-variant-views') === key;
          g.hidden = !on;
          if (on) {
            var first = g.querySelector('.gallery-thumb');
            if (first) first.click();
          }
        });
        if (current) current.textContent = btn.getAttribute('data-variant-name') || key;
      });
    });
  });
})();
