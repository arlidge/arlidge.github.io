// Prints card: the dropdown opens on hover (CSS); on touch screens, which can't
// hover, tapping the card opens/closes it. Clicking an option plays the click
// sound, then opens the shop once it finishes.
(function () {
  var dropdown = document.querySelector('.pricing-dropdown');
  if (!dropdown) return;
  var toggle = dropdown.querySelector('.pricing-toggle');

  function setOpen(open) {
    dropdown.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  var canHover = window.matchMedia && window.matchMedia('(hover: hover)').matches;

  // touch screens: tapping anywhere on the card toggles it, except the options
  dropdown.addEventListener('click', function (e) {
    if (canHover || e.target.closest('.shop-link')) return;
    setOpen(!dropdown.classList.contains('is-open'));
  });
  document.addEventListener('click', function (e) {
    if (!dropdown.contains(e.target)) setOpen(false);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') setOpen(false);
  });

  var sound = new Audio('audio/shop-click.m4a');
  sound.preload = 'auto';
  sound.volume = 0.2; // 0 = silent, 1 = full volume
  var MAX_WAIT = 1500; // ms: never hold the click longer than this

  // only play once per visit (sessionStorage clears when the tab is closed)
  var PLAYED_KEY = 'shopSoundPlayed';
  function alreadyPlayed() {
    try { return sessionStorage.getItem(PLAYED_KEY) === '1'; } catch (e) { return false; }
  }
  function markPlayed() {
    try { sessionStorage.setItem(PLAYED_KEY, '1'); } catch (e) {}
  }

  Array.prototype.forEach.call(dropdown.querySelectorAll('.shop-link'), function (link) {
    link.addEventListener('click', function (e) {
      // let ctrl/cmd/middle-click open a new tab as normal
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
      if (alreadyPlayed()) return; // normal link: straight to the shop
      e.preventDefault();
      markPlayed();
      var href = link.href;
      var gone = false;
      function go() { if (!gone) { gone = true; window.location.href = href; } }

      sound.currentTime = 0;
      sound.addEventListener('ended', go, { once: true });
      setTimeout(go, MAX_WAIT);
      var p = sound.play();
      if (p && p.catch) p.catch(go); // blocked or missing file: just navigate
    });
  });
})();
