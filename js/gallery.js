// Product cards with several views: clicking a thumbnail swaps the main image.
// Markup: [data-gallery] containing one img.gallery-main and .gallery-thumb
// buttons that each carry data-src and data-alt.
(function () {
  document.querySelectorAll('[data-gallery]').forEach(function (gallery) {
    var main = gallery.querySelector('.gallery-main');
    var thumbs = gallery.querySelectorAll('.gallery-thumb');
    if (!main || !thumbs.length) return;

    thumbs.forEach(function (thumb) {
      thumb.addEventListener('click', function () {
        main.src = thumb.getAttribute('data-src');
        main.alt = thumb.getAttribute('data-alt') || '';
        thumbs.forEach(function (t) {
          var on = t === thumb;
          t.classList.toggle('is-active', on);
          t.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
      });
    });
  });
})();
