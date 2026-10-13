// Product strip: infinite loop. The cards in the HTML are cloned on both sides;
// once scrolling settles inside a cloned set, it jumps back by one set width
// to the matching original card, so the row never runs out either way.
(function () {
  var track = document.querySelector('.product-track');
  if (!track) return;
  var prev = document.querySelector('.strip-arrow--prev');
  var next = document.querySelector('.strip-arrow--next');
  var originals = Array.prototype.slice.call(track.querySelectorAll('.product-card'));
  if (!originals.length) return;

  var COPIES = 2; // cloned sets on each side, enough to fill very wide screens

  function makeClone(card) {
    var c = card.cloneNode(true);
    c.setAttribute('aria-hidden', 'true');
    c.setAttribute('tabindex', '-1');
    return c;
  }
  for (var n = 0; n < COPIES; n++) {
    originals.forEach(function (card) { track.appendChild(makeClone(card)); });
    for (var i = originals.length - 1; i >= 0; i--) track.insertBefore(makeClone(originals[i]), track.firstChild);
  }

  function pad() { return parseFloat(getComputedStyle(track).paddingLeft) || 0; }
  // scroll position that lines a card up with the left edge
  function stopFor(card) { return card.offsetLeft - pad(); }
  function start() { return stopFor(originals[0]); }
  function setWidth() {
    var gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    var last = originals[originals.length - 1];
    return last.offsetLeft + last.offsetWidth + gap - originals[0].offsetLeft;
  }

  function normalise() {
    var x = track.scrollLeft, s = start(), w = setWidth();
    if (x < s - 4) track.scrollLeft = x + w;
    else if (x >= s + w - 4) track.scrollLeft = x - w;
  }

  function go(dir) {
    normalise();
    var x = track.scrollLeft;
    var cards = track.querySelectorAll('.product-card');
    var target = null;
    for (var i = 0; i < cards.length; i++) {
      var c = cards[dir > 0 ? i : cards.length - 1 - i];
      var s = stopFor(c);
      if (dir > 0 ? s > x + 4 : s < x - 4) { target = s; break; }
    }
    if (target === null) return;
    if (track.scrollTo) track.scrollTo({ left: target, behavior: 'smooth' });
    else track.scrollLeft = target;
  }

  // wait for scrolling (swipe, wheel or arrow) to settle before looping back
  var settle;
  track.addEventListener('scroll', function () {
    clearTimeout(settle);
    settle = setTimeout(normalise, 140);
  }, { passive: true });

  prev.addEventListener('click', function () { go(-1); });
  next.addEventListener('click', function () { go(1); });

  function reset() { track.scrollLeft = start(); }
  reset();
  window.addEventListener('load', reset);
  window.addEventListener('resize', normalise);
})();
