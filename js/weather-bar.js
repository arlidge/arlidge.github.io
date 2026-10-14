// Scrolling bar: replaces the text with a local weather forecast.
// Location: the visitor's city from their IP address (GeoJS, free, no key),
// falling back to Auckland. Forecast: Open-Meteo (free, no key).
// The result is kept for 30 minutes per tab so moving between pages doesn't
// fetch it again. If anything fails, the bar keeps its original text.
(function () {
  var track = document.querySelector('.brut-marquee-track');
  if (!track || !window.fetch) return;

  var FALLBACK = { city: 'Auckland', lat: -36.85, lon: 174.76 };
  var CACHE_KEY = 'weatherBar';
  var CACHE_MS = 30 * 60 * 1000;
  var SPEED = 60; // px per second the bar scrolls

  // WMO weather codes (what Open-Meteo returns) to short labels
  function describe(code) {
    if (code === 0) return 'CLEAR';
    if (code === 1) return 'MOSTLY CLEAR';
    if (code === 2) return 'PARTLY CLOUDY';
    if (code === 3) return 'OVERCAST';
    if (code === 45 || code === 48) return 'FOG';
    if (code >= 51 && code <= 57) return 'DRIZZLE';
    if (code >= 61 && code <= 67) return 'RAIN';
    if (code >= 71 && code <= 77) return 'SNOW';
    if (code >= 80 && code <= 82) return 'SHOWERS';
    if (code === 85 || code === 86) return 'SNOW SHOWERS';
    if (code >= 95) return 'THUNDERSTORMS';
    return '';
  }

  function getJSON(url, ms) {
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, ms) : null;
    return fetch(url, ctrl ? { signal: ctrl.signal } : {}).then(function (r) {
      if (timer) clearTimeout(timer);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  function locate() {
    return getJSON('https://get.geojs.io/v1/ip/geo.json', 4000).then(function (d) {
      var lat = parseFloat(d.latitude), lon = parseFloat(d.longitude);
      if (!isFinite(lat) || !isFinite(lon)) return FALLBACK;
      return { city: d.city || d.region || FALLBACK.city, lat: lat, lon: lon };
    }).catch(function () { return FALLBACK; });
  }

  function forecast(place) {
    var url = 'https://api.open-meteo.com/v1/forecast' +
      '?latitude=' + place.lat.toFixed(3) + '&longitude=' + place.lon.toFixed(3) +
      '&current=temperature_2m,weather_code,wind_speed_10m' +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
      '&timezone=auto&forecast_days=5';
    return getJSON(url, 6000).then(function (w) {
      var items = [];
      var c = w.current;
      items.push(place.city.toUpperCase() + ' NOW ' + Math.round(c.temperature_2m) + '° ' + describe(c.weather_code));
      items.push('WIND ' + Math.round(c.wind_speed_10m) + ' KM/H');
      var d = w.daily;
      var days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
      for (var i = 0; i < d.time.length; i++) {
        var label = i === 0 ? 'TODAY' : days[new Date(d.time[i] + 'T12:00:00').getDay()];
        var text = label + ' ' + Math.round(d.temperature_2m_max[i]) + '°/' +
                   Math.round(d.temperature_2m_min[i]) + '° ' + describe(d.weather_code[i]);
        var rain = d.precipitation_probability_max && d.precipitation_probability_max[i];
        if (rain >= 30) text += ' ' + rain + '% RAIN';
        items.push(text.trim());
      }
      return items;
    });
  }

  function render(items) {
    // one run of the forecast, separated by the bar's square markers
    function run() {
      var frag = document.createDocumentFragment();
      items.forEach(function (text) {
        var s = document.createElement('span');
        s.textContent = text;
        var sep = document.createElement('span');
        sep.innerHTML = '&#9632;';
        frag.appendChild(s);
        frag.appendChild(sep);
      });
      return frag;
    }
    track.textContent = '';
    track.appendChild(run());
    // the bar loops by sliding exactly half its length, so it needs an even
    // number of identical runs, together at least twice the window width
    var runWidth = track.scrollWidth || 1;
    var copies = Math.max(2, 2 * Math.ceil(window.innerWidth / runWidth));
    for (var n = 1; n < copies; n++) track.appendChild(run());
    track.style.animationDuration = Math.round((runWidth * copies / 2) / SPEED) + 's';
    track.parentNode.setAttribute('aria-label', 'Weather: ' + items.join(', '));
  }

  try {
    var cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
    if (cached && Date.now() - cached.at < CACHE_MS && cached.items && cached.items.length) {
      render(cached.items);
      return;
    }
  } catch (e) {}

  locate().then(forecast).then(function (items) {
    render(items);
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), items: items })); } catch (e) {}
  }).catch(function () { /* keep the original bar text */ });
})();
