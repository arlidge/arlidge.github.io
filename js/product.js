// Product page options. Each .variant-block is one choice (e.g. Type, Colour):
// clicking a .variant-btn selects it within its block and updates that block's
// .variant-current label.
//
// Buttons that carry data-variant="green" also switch the gallery: they show
// the group of thumbnails with the matching data-variant-views and select its
// first thumbnail, so the main image changes (js/gallery.js does the swap).
(function () {
  document.querySelectorAll('[data-product]').forEach(function (product) {
    var groups = product.querySelectorAll('[data-variant-views]');

    product.querySelectorAll('.variant-block').forEach(function (block) {
      var buttons = block.querySelectorAll('.variant-btn');
      var current = block.querySelector('.variant-current');

      buttons.forEach(function (btn) {
        btn.addEventListener('click', function () {
          buttons.forEach(function (b) {
            var on = b === btn;
            b.classList.toggle('is-active', on);
            b.setAttribute('aria-pressed', on ? 'true' : 'false');
          });
          if (current) current.textContent = btn.getAttribute('data-variant-name') || btn.textContent.trim();

          var key = btn.getAttribute('data-variant');
          if (!key) return; // an option with no pictures of its own
          groups.forEach(function (g) {
            var on = g.getAttribute('data-variant-views') === key;
            g.hidden = !on;
            if (on) {
              var first = g.querySelector('.gallery-thumb');
              if (first) first.click();
            }
          });
        });
      });
    });
  });
})();
