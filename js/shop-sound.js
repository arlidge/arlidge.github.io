// Links marked data-click-sound (the Prints card on the homepage): the first
// click of a visit plays the click sound, then opens the link once it finishes.
(function () {
  var links = document.querySelectorAll('a[data-click-sound]');
  if (!links.length) return;

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

  Array.prototype.forEach.call(links, function (link) {
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
