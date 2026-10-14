// Home Decor page: the star motif starts on the left of the cards section and
// drifts slowly off the left edge as the page scrolls down, and back as it
// scrolls up (GSAP ScrollTrigger).
(function () {
  var star = document.querySelector('.decor-star');
  var section = document.getElementById('shop');
  if (!star || !section || !window.gsap || !window.ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);

  gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', function () {
    gsap.to(star, {
      // far enough to clear the left edge of the window completely
      x: function () { return -(star.offsetLeft + star.offsetWidth + 40); },
      ease: 'none',
      scrollTrigger: {
        trigger: section,
        start: 'top 85%',  // begins as the section comes into view
        end: 'bottom top', // fully gone only when the section has scrolled past
        scrub: 2,          // long lag behind the scroll, so it glides
        invalidateOnRefresh: true
      }
    });
  });
})();
