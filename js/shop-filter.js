// Shop page: shop.html?type=paper or ?type=plastic shows only that kind of
// print (cards carry data-type). No type shows everything.
(function () {
  var type = new URLSearchParams(window.location.search).get('type');
  if (type !== 'paper' && type !== 'plastic') type = null;

  document.querySelectorAll('.print-col[data-type]').forEach(function (col) {
    col.hidden = type !== null && col.getAttribute('data-type') !== type;
  });

  document.querySelectorAll('.shop-tabs a').forEach(function (a) {
    var on = a.getAttribute('data-type') === type;
    a.classList.toggle('is-active', on);
    if (on) a.setAttribute('aria-current', 'page');
  });

  var label = document.querySelector('.shop-type-label');
  if (label && type) label.textContent = type.toUpperCase();
})();
