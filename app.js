const els = {
  form: document.getElementById('search-form'),
  input: document.getElementById('city-input'),
  locateBtn: document.getElementById('locate-btn'),
  suggestions: document.getElementById('suggestions'),
  main: document.getElementById('main-panel'),
};

const WMO = {
  0: 'Ciel dégagé', 1: 'Plutôt dégagé', 2: 'Partiellement nuageux', 3: 'Couvert',
  45: 'Brouillard', 48: 'Brouillard givrant',
  51: 'Bruine légère', 53: 'Bruine', 55: 'Bruine dense',
  56: 'Bruine verglaçante', 57: 'Bruine verglaçante dense',
  61: 'Pluie légère', 63: 'Pluie', 65: 'Pluie forte',
  66: 'Pluie verglaçante', 67: 'Pluie verglaçante forte',
  71: 'Neige légère', 73: 'Neige', 75: 'Neige forte', 77: 'Grains de neige',
  80: 'Averses légères', 81: 'Averses', 82: 'Averses violentes',
  85: 'Averses de neige', 86: 'Averses de neige fortes',
  95: 'Orage', 96: 'Orage avec grêle', 99: 'Orage avec grêle forte',
};

function weatherLabel(code) {
  return WMO[code] || 'Conditions inconnues';
}

function setPanel(html) {
  els.main.innerHTML = html;
}

function statusPanel(text, isError = false) {
  setPanel(`<div class="status-panel${isError ? ' error' : ''}">${text}</div>`);
}

async function geocodeCity(name) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=5&language=fr&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Recherche impossible');
  const data = await res.json();
  return data.results || [];
}

async function fetchWeather(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,surface_pressure,is_day` +
    `&daily=sunrise,sunset&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Données météo indisponibles');
  return res.json();
}

function dayProgress(nowMs, sunriseMs, sunsetMs) {
  if (nowMs <= sunriseMs) return 0;
  if (nowMs >= sunsetMs) return 1;
  return (nowMs - sunriseMs) / (sunsetMs - sunriseMs);
}

function horizonArcSVG(progress, isDay) {
  // Semi-circle arc from left (sunrise) to right (sunset), marker position = progress
  const W = 280, H = 110, cx = W / 2, cy = 100, r = 90;
  const angle = Math.PI * (1 - progress); // PI (left) -> 0 (right)
  const mx = cx + r * Math.cos(angle);
  const my = cy - r * Math.sin(angle);
  const markerColor = isDay ? '#E8A94C' : '#8DA0BC';
  return `
  <svg viewBox="0 0 ${W} ${H}" width="100%" height="90" xmlns="http://www.w3.org/2000/svg">
    <path d="M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}" fill="none" stroke="rgba(255,255,255,0.14)" stroke-width="2" stroke-dasharray="1 7" stroke-linecap="round"/>
    <path d="M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${mx} ${my}" fill="none" stroke="${markerColor}" stroke-width="3" stroke-linecap="round" opacity="0.6"/>
    <circle cx="${mx}" cy="${my}" r="6" fill="${markerColor}"/>
    <circle cx="${cx - r}" cy="${cy}" r="2.5" fill="#8DA0BC"/>
    <circle cx="${cx + r}" cy="${cy}" r="2.5" fill="#8DA0BC"/>
  </svg>`;
}

function gaugeDialSVG(fraction, color) {
  const size = 64, cx = size / 2, cy = size / 2, r = 24;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - Math.max(0, Math.min(1, fraction)));
  return `
  <svg viewBox="0 0 ${size} ${size}" width="56" height="56">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="6"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="6"
      stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
      stroke-linecap="round" transform="rotate(-90 ${cx} ${cy})"/>
  </svg>`;
}

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function render(place, weather) {
  const cur = weather.current;
  const daily = weather.daily;
  const sunrise = new Date(daily.sunrise[0]).getTime();
  const sunset = new Date(daily.sunset[0]).getTime();
  const now = Date.now();
  const progress = dayProgress(now, sunrise, sunset);
  const isDay = cur.is_day === 1;

  const windFraction = Math.min(cur.wind_speed_10m / 60, 1); // 0-60 km/h scale
  const humidityFraction = cur.relative_humidity_2m / 100;
  const pressureFraction = Math.min(Math.max((cur.surface_pressure - 970) / (1050 - 970), 0), 1);

  setPanel(`
    <div class="location-row">
      <div>
        <div class="location-name">${place.name}${place.admin1 ? ', ' + place.admin1 : ''}${place.country ? ' · ' + place.country : ''}</div>
        <div class="location-coords">${place.latitude.toFixed(2)}°, ${place.longitude.toFixed(2)}°</div>
      </div>
      <div class="location-coords">${new Date().toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
    </div>

    <div class="hero">
      <div class="temp-row">
        <div class="temp-value">${Math.round(cur.temperature_2m)}</div>
        <div class="temp-unit">°C</div>
      </div>
      <div class="condition-label">${weatherLabel(cur.weather_code)}</div>
      <div class="feels-like">RESSENTI ${Math.round(cur.apparent_temperature)}°C</div>

      <div class="horizon-wrap">
        ${horizonArcSVG(progress, isDay)}
        <div class="horizon-labels">
          <span>☀ ${formatTime(daily.sunrise[0])}</span>
          <span>${isDay ? 'JOUR' : 'NUIT'}</span>
          <span>${formatTime(daily.sunset[0])} ☾</span>
        </div>
      </div>
    </div>

    <div class="gauge-grid">
      <div class="gauge-card">
        ${gaugeDialSVG(windFraction, '#2CA6A4')}
        <div class="gauge-value">${Math.round(cur.wind_speed_10m)} km/h</div>
        <div class="gauge-label">Vent</div>
      </div>
      <div class="gauge-card">
        ${gaugeDialSVG(humidityFraction, '#E8A94C')}
        <div class="gauge-value">${cur.relative_humidity_2m}%</div>
        <div class="gauge-label">Humidité</div>
      </div>
      <div class="gauge-card">
        ${gaugeDialSVG(pressureFraction, '#8DA0BC')}
        <div class="gauge-value">${Math.round(cur.surface_pressure)} hPa</div>
        <div class="gauge-label">Pression</div>
      </div>
    </div>
  `);
}

async function loadForPlace(place) {
  statusPanel('Lecture des instruments…');
  try {
    const weather = await fetchWeather(place.latitude, place.longitude);
    render(place, weather);
  } catch (err) {
    statusPanel(err.message || 'Erreur de chargement', true);
  }
}

async function handleSearch(query) {
  els.suggestions.innerHTML = '';
  if (!query || query.trim().length < 2) return;
  try {
    const results = await geocodeCity(query.trim());
    if (!results.length) {
      els.suggestions.innerHTML = `<div class="status-panel">Aucun lieu trouvé pour « ${query} »</div>`;
      return;
    }
    els.suggestions.innerHTML = results.map((r, i) => `
      <button type="button" data-idx="${i}">
        ${r.name}<span>${r.admin1 ? r.admin1 + ', ' : ''}${r.country}</span>
      </button>
    `).join('');
    [...els.suggestions.querySelectorAll('button')].forEach((btn, i) => {
      btn.addEventListener('click', () => {
        els.suggestions.innerHTML = '';
        els.input.value = `${results[i].name}`;
        loadForPlace(results[i]);
      });
    });
  } catch (err) {
    els.suggestions.innerHTML = `<div class="status-panel error">${err.message}</div>`;
  }
}

els.form.addEventListener('submit', (e) => {
  e.preventDefault();
  handleSearch(els.input.value);
});

els.input.addEventListener('input', () => {
  clearTimeout(els.input._t);
  els.input._t = setTimeout(() => handleSearch(els.input.value), 400);
});

els.locateBtn.addEventListener('click', () => {
  if (!navigator.geolocation) {
    statusPanel('Géolocalisation non disponible sur cet appareil', true);
    return;
  }
  statusPanel('Repérage de ta position…');
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const place = {
        name: 'Ma position',
        admin1: '', country: '',
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      };
      loadForPlace(place);
    },
    () => statusPanel('Position refusée — cherche une ville à la place', true),
    { timeout: 8000 }
  );
});

// Initial state: try geolocation silently, fallback to placeholder
statusPanel('Cherche une ville ou utilise 📍 pour ta position');

// Register service worker for installability
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
