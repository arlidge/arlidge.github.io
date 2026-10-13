// "SHOP" heading: the letters scatter and drift apart as the page scrolls down
// past it, and come back together when you scroll back up (GSAP ScrollTrigger).
(function () {
  var heading = document.getElementById('shop-heading');
  if (!heading || !window.gsap || !window.ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);

  // split the heading into one span per letter; screen readers still get the word
  var word = heading.textContent.trim();
  heading.setAttribute('aria-label', word);
  heading.textContent = '';
  var letters = word.split('').map(function (ch) {
    var span = document.createElement('span');
    span.className = 'scatter-ch';
    span.setAttribute('aria-hidden', 'true');
    span.textContent = ch;
    heading.appendChild(span);
    return span;
  });

  var mm = gsap.matchMedia();
  mm.add('(prefers-reduced-motion: no-preference)', function () {
    var mid = (letters.length - 1) / 2;
    // how far letters may travel sideways: kept inside the window so the page
    // never gains a horizontal scrollbar
    function reach() { return Math.min(window.innerWidth * 0.3, 320); }

    gsap.to(letters, {
      // spread outwards from the middle of the word, plus some randomness
      x: function (i) { return ((i - mid) / (mid || 1)) * reach() * gsap.utils.random(0.6, 1); },
      y: function () { return gsap.utils.random(-140, 140); },
      rotation: function () { return gsap.utils.random(-70, 70); },
      opacity: 0.15,
      ease: 'none',
      scrollTrigger: {
        trigger: heading,
        start: 'top 45%',   // begins once the heading is a little above mid-screen
        end: 'bottom top',  // fully scattered as it leaves the top of the window
        scrub: 1,           // eases after the scroll position, so it drifts
        invalidateOnRefresh: true
      }
    });
  });
})();
