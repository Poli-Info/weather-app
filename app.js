// ======================================================
// =================== Script Sidebar ===================
// ======================================================


const body = document.querySelector("body"),
      sidebar = body.querySelector(".sidebar"),
      toggle = body.querySelector("#toggle"),
      searchBtn = body.querySelector(".search-box"),
      modeSwitch = body.querySelector(".toggle-switch"),
      modeText = body.querySelector(".mode-text");

      //Bouton close
      toggle.addEventListener("click", () => {
        sidebar.classList.toggle("close");
      });

      //Bouton Bright Mode
      modeSwitch.addEventListener("click", () => {
        body.classList.toggle("bright");
      });



// ======================================================
// ================= FIN Script Sidebar =================
// ======================================================


// ======================================================
// ==================== Script Météo ====================
// ======================================================


// ===== RÉCUPÉRATION DES ÉLÉMENTS HTML =====
// document.getElementById('xxx') va chercher dans la page l'élément qui a id="xxx"
// On les range tous dans un seul objet "els" (abréviation de "elements") pour s'y retrouver facilement
const els = {
  form: document.getElementById('search-form'),       // le formulaire de recherche
  input: document.getElementById('city-input'),        // le champ de texte
  locateBtn: document.getElementById('locate-btn'),     // le bouton 📍
  suggestions: document.getElementById('suggestions'),  // la boîte où afficher les villes trouvées
  main: document.getElementById('main-panel'),          // la grande boîte où afficher la météo
};

// ===== DICTIONNAIRE DES CODES MÉTÉO =====
// L'API météo ne renvoie pas "il pleut", elle renvoie juste un NUMÉRO (norme internationale WMO).
// Cet objet sert de "traducteur" numéro -> texte en français.
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

// Petite fonction qui prend un code météo (nombre) et renvoie le texte français correspondant.
// Si le code n'existe pas dans notre dictionnaire, elle renvoie un texte par défaut.
function weatherLabel(code) {
  return WMO[code] || 'Conditions inconnues';
  // "||" veut dire "ou" : si WMO[code] est vide/inexistant (undefined), on prend ce qui est après le ||
}

// ===== FONCTIONS D'AFFICHAGE GÉNÉRIQUES =====

// Remplace tout le contenu de la grande boîte météo par le HTML donné en paramètre
function setPanel(html) {
  els.main.innerHTML = html;
  // innerHTML permet d'injecter du code HTML directement, qui sera aussitôt affiché
}

// Affiche un message simple dans la boîte (ex: "Chargement…", "Erreur")
// isError permet d'afficher le message en rouge si besoin (deuxième paramètre optionnel, false par défaut)
function statusPanel(text, isError = false) {
  setPanel(`<div class="status-panel${isError ? ' error' : ''}">${text}</div>`);
  // Ceci est un "template string" (entre back-ticks `). Le ${...} insère une valeur JavaScript dans le texte.
  // ${isError ? ' error' : ''} veut dire : "si isError est vrai, ajoute la classe error, sinon rien"
}

// ===== APPELS À L'API (RÉCUPÉRATION DE DONNÉES SUR INTERNET) =====

// Cette fonction cherche les villes qui correspondent au texte tapé par l'utilisateur.
// "async" veut dire que la fonction peut "attendre" une réponse d'internet sans bloquer le reste de l'appli.
async function geocodeCity(name) {
  // On construit l'adresse (URL) à appeler. encodeURIComponent() transforme les espaces/accents
  // en un format compatible avec une adresse web (ex: "Paris Nord" devient "Paris%20Nord")
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=5&language=fr&format=json`;

  const res = await fetch(url);
  // fetch() envoie une requête vers l'adresse et attend ("await") la réponse du serveur

  if (!res.ok) throw new Error('Recherche impossible');
  // res.ok est "vrai" si le serveur a répondu correctement (pas d'erreur 404/500...).
  // Si ce n'est pas le cas, on arrête tout et on déclenche une erreur

  const data = await res.json();
  // On transforme la réponse (du texte brut) en objet JavaScript utilisable

  return data.results || [];
  // On renvoie la liste des villes trouvées, ou une liste vide si "results" n'existe pas
}

// Cette fonction récupère la météo actuelle pour des coordonnées GPS précises (latitude/longitude)
async function fetchWeather(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    // "current=..." liste toutes les infos météo "en ce moment" qu'on veut recevoir
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,surface_pressure,is_day` +
    // "daily=sunrise,sunset" demande en plus l'heure de lever et coucher du soleil du jour
    `&daily=sunrise,sunset&timezone=auto`;
    // timezone=auto : l'API devine automatiquement le fuseau horaire du lieu demandé

  const res = await fetch(url);
  if (!res.ok) throw new Error('Données météo indisponibles');
  return res.json();
  // Ici pas besoin de "await" avant de renvoyer : la fonction qui appelle fetchWeather()
  // fera elle-même le "await fetchWeather(...)" et recevra directement l'objet final
}

// ===== CALCULS =====

// Calcule à quel "pourcentage" de la journée on se trouve, entre le lever et le coucher du soleil.
// Résultat : un nombre entre 0 (lever) et 1 (coucher)
function dayProgress(nowMs, sunriseMs, sunsetMs) {
  if (nowMs <= sunriseMs) return 0;   // avant le lever du soleil → tout au début (0%)
  if (nowMs >= sunsetMs) return 1;    // après le coucher du soleil → tout à la fin (100%)
  return (nowMs - sunriseMs) / (sunsetMs - sunriseMs);
  // Sinon, calcul classique de "où on en est" entre un début et une fin
}

// ===== GÉNÉRATION DE DESSINS (SVG) =====
// Le SVG est un format de dessin "vectoriel" : au lieu d'une image, on décrit des formes avec des nombres.
// Ici on construit le dessin de l'arc jour/nuit directement en texte, avec les bonnes coordonnées à chaque appel.

function horizonArcSVG(progress, isDay) {
  // W = largeur du dessin, H = hauteur, cx/cy = centre du demi-cercle, r = rayon du demi-cercle
  const W = 280, H = 110, cx = W / 2, cy = 100, r = 90;

  const angle = Math.PI * (1 - progress);
  // Convertit notre "progress" (0 à 1) en angle, en radians (unité utilisée par les fonctions mathématiques).
  // À progress=0 (lever), angle = PI (tout à gauche). À progress=1 (coucher), angle = 0 (tout à droite).

  const mx = cx + r * Math.cos(angle);
  const my = cy - r * Math.sin(angle);
  // Math.cos et Math.sin permettent de calculer la position (x, y) d'un point sur un cercle,
  // à partir de son angle. C'est ce qui nous donne la position du petit point (soleil/lune) sur l'arc.

  const markerColor = isDay ? '#E8A94C' : '#8DA0BC';
  // Couleur du point : doré s'il fait jour, gris-bleu s'il fait nuit

  // On renvoie directement le code SVG sous forme de texte, avec nos valeurs calculées insérées dedans
  return `
  <svg viewBox="0 0 ${W} ${H}" width="100%" height="90" xmlns="http://www.w3.org/2000/svg">
    <path d="M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}" fill="none" stroke="rgba(255,255,255,0.14)" stroke-width="2" stroke-dasharray="1 7" stroke-linecap="round"/>
    <!-- Le trait en pointillés qui dessine tout l'arc de fond, du lever au coucher -->

    <path d="M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${mx} ${my}" fill="none" stroke="${markerColor}" stroke-width="3" stroke-linecap="round" opacity="0.6"/>
    <!-- Un deuxième arc, plus épais et coloré, qui ne va que du lever jusqu'à la position ACTUELLE -->

    <circle cx="${mx}" cy="${my}" r="6" fill="${markerColor}"/>
    <!-- Le petit rond qui représente le soleil (ou la lune) au bon endroit sur l'arc -->

    <circle cx="${cx - r}" cy="${cy}" r="2.5" fill="#8DA0BC"/>
    <!-- Petit point discret marquant le début de l'arc (le lever) -->

    <circle cx="${cx + r}" cy="${cy}" r="2.5" fill="#8DA0BC"/>
    <!-- Petit point discret marquant la fin de l'arc (le coucher) -->
  </svg>`;
}

// Génère un petit cadran circulaire (jauge), utilisé pour vent / humidité / pression.
// "fraction" est un nombre entre 0 et 1 qui représente le niveau de remplissage du cercle
function gaugeDialSVG(fraction, color) {
  const size = 64, cx = size / 2, cy = size / 2, r = 24;
  // size = taille du dessin, cx/cy = centre, r = rayon du cercle

  const circumference = 2 * Math.PI * r;
  // Formule mathématique classique : la longueur totale du contour d'un cercle

  const offset = circumference * (1 - Math.max(0, Math.min(1, fraction)));
  // On calcule de combien "décaler" le trait pointillé pour ne montrer que la portion voulue.
  // Math.max(0, Math.min(1, fraction)) force la valeur à rester entre 0 et 1, même si jamais
  // les données reçues étaient bizarres (sécurité)

  return `
  <svg viewBox="0 0 ${size} ${size}" width="56" height="56">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="6"/>
    <!-- Le cercle de fond, gris clair, qui représente "le total" (100%) -->

    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="6"
      stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
      stroke-linecap="round" transform="rotate(-90 ${cx} ${cy})"/>
    <!-- Le cercle coloré par-dessus, dont on ne montre qu'une portion grâce à stroke-dashoffset.
         transform="rotate(-90...)" fait commencer le dessin en haut plutôt qu'à droite -->
  </svg>`;
}

// Transforme une date technique (ex: "2026-08-12T19:45") en heure lisible (ex: "19:45")
function formatTime(iso) {
  const d = new Date(iso);
  // new Date(...) transforme le texte en un vrai objet "date" que JavaScript sait manipuler

  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  // toLocaleTimeString formate la date selon les habitudes françaises (heures:minutes)
}

// ===== FONCTION PRINCIPALE D'AFFICHAGE =====
// Cette fonction prend les données reçues de l'API et construit tout le HTML de l'écran météo
function render(place, weather) {
  const cur = weather.current;   // raccourci vers les données "actuelles"
  const daily = weather.daily;   // raccourci vers les données "du jour" (lever/coucher du soleil)

  const sunrise = new Date(daily.sunrise[0]).getTime();
  // .getTime() convertit une date en un simple NOMBRE (millisecondes), plus facile à comparer/calculer
  const sunset = new Date(daily.sunset[0]).getTime();
  const now = Date.now();
  // Date.now() donne l'heure actuelle, elle aussi en nombre de millisecondes

  const progress = dayProgress(now, sunrise, sunset);
  // On utilise notre fonction définie plus haut pour savoir où on en est dans la journée

  const isDay = cur.is_day === 1;
  // L'API renvoie 1 si c'est le jour, 0 si c'est la nuit. On transforme ça en vrai/faux (true/false)

  const windFraction = Math.min(cur.wind_speed_10m / 60, 1);
  // On imagine une échelle de 0 à 60 km/h pour la jauge de vent. Math.min(...,1) évite de dépasser 100%
  const humidityFraction = cur.relative_humidity_2m / 100;
  // L'humidité est déjà un pourcentage (0-100), on la ramène juste à une fraction (0-1)
  const pressureFraction = Math.min(Math.max((cur.surface_pressure - 970) / (1050 - 970), 0), 1);
  // On imagine une échelle de pression entre 970 et 1050 hPa (valeurs réalistes),
  // et on s'assure que le résultat reste bien entre 0 et 1

  // On construit tout le HTML de l'écran d'un coup, en insérant nos valeurs calculées avec ${...}
  setPanel(`
    <div class="location-row">
      <div>
        <div class="location-name">${place.name}${place.admin1 ? ', ' + place.admin1 : ''}${place.country ? ' · ' + place.country : ''}</div>
        <!-- Affiche le nom de la ville, puis la région si elle existe, puis le pays si il existe -->

        <div class="location-coords">${place.latitude.toFixed(2)}°, ${place.longitude.toFixed(2)}°</div>
        <!-- .toFixed(2) arrondit les coordonnées GPS à 2 chiffres après la virgule -->
      </div>
      <div class="location-coords">${new Date().toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
      <!-- Affiche la date du jour, en format court (ex: "mer. 12 août") -->
    </div>

    <div class="hero">
      <div class="temp-row">
        <div class="temp-value">${Math.round(cur.temperature_2m)}</div>
        <!-- Math.round() arrondit la température au nombre entier le plus proche -->
        <div class="temp-unit">°C</div>
      </div>
      <div class="condition-label">${weatherLabel(cur.weather_code)}</div>
      <!-- Utilise notre fonction "traducteur" définie plus haut -->
      <div class="feels-like">RESSENTI ${Math.round(cur.apparent_temperature)}°C</div>

      <div class="horizon-wrap">
        ${horizonArcSVG(progress, isDay)}
        <!-- Insère directement le dessin SVG généré par notre fonction -->
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

// ===== ORCHESTRATION : RELIER LES DONNÉES À L'AFFICHAGE =====

// Fonction appelée dès qu'on a un "lieu" (ville choisie ou position GPS) : va chercher la météo puis l'affiche
async function loadForPlace(place) {
  statusPanel('Lecture des instruments…');
  // Message affiché pendant le chargement

  try {
    // "try/catch" = "essaie ceci, et si ça plante, fais autre chose au lieu de faire crasher toute l'appli"
    const weather = await fetchWeather(place.latitude, place.longitude);
    render(place, weather);
  } catch (err) {
    // Si fetchWeather() ou render() ont échoué (ex: pas de connexion internet), on arrive ici
    statusPanel(err.message || 'Erreur de chargement', true);
    // err.message contient le texte de l'erreur ; true = affiche en rouge (voir statusPanel)
  }
}

// Fonction appelée à chaque fois que l'utilisateur tape dans la barre de recherche
async function handleSearch(query) {
  els.suggestions.innerHTML = '';
  // On vide d'abord les anciennes suggestions

  if (!query || query.trim().length < 2) return;
  // .trim() enlève les espaces avant/après. Si le texte est vide ou trop court (moins de 2 lettres),
  // on arrête là (return) pour ne pas faire une recherche inutile

  try {
    const results = await geocodeCity(query.trim());

    if (!results.length) {
      // .length = nombre d'éléments dans la liste. Si 0, aucun résultat trouvé
      els.suggestions.innerHTML = `<div class="status-panel">Aucun lieu trouvé pour « ${query} »</div>`;
      return;
    }

    // .map() transforme chaque résultat en un petit bout de HTML (un bouton),
    // puis .join('') colle tous ces bouts de texte ensemble en une seule chaîne
    els.suggestions.innerHTML = results.map((r, i) => `
      <button type="button" data-idx="${i}">
        ${r.name}<span>${r.admin1 ? r.admin1 + ', ' : ''}${r.country}</span>
      </button>
    `).join('');

    // Une fois les boutons affichés à l'écran, on doit leur "apprendre" quoi faire quand on clique dessus
    [...els.suggestions.querySelectorAll('button')].forEach((btn, i) => {
      // querySelectorAll récupère tous les boutons qu'on vient de créer
      // [...] transforme le résultat en vraie liste JavaScript, pour pouvoir utiliser .forEach()
      btn.addEventListener('click', () => {
        // addEventListener("click", ...) = "quand on clique sur CE bouton précis, fais ceci"
        els.suggestions.innerHTML = '';
        // On referme la liste de suggestions
        els.input.value = `${results[i].name}`;
        // On met le nom choisi dans la barre de recherche
        loadForPlace(results[i]);
        // Et on charge la météo pour ce lieu précis
      });
    });
  } catch (err) {
    els.suggestions.innerHTML = `<div class="status-panel error">${err.message}</div>`;
  }
}

// ===== ÉCOUTEURS D'ÉVÉNEMENTS =====
// Cette partie "branche" nos fonctions aux actions de l'utilisateur (clic, écriture, etc.)

els.form.addEventListener('submit', (e) => {
  // "submit" se déclenche quand on valide le formulaire (touche Entrée ou bouton "OK" du clavier)
  e.preventDefault();
  // Empêche le comportement par défaut du formulaire (qui rechargerait toute la page - on ne veut pas ça)
  handleSearch(els.input.value);
});

els.input.addEventListener('input', () => {
  // "input" se déclenche à CHAQUE lettre tapée dans le champ
  clearTimeout(els.input._t);
  // Annule la recherche précédente si l'utilisateur tape encore (évite de spammer l'API à chaque lettre)
  els.input._t = setTimeout(() => handleSearch(els.input.value), 400);
  // setTimeout attend 400 millisecondes SANS nouvelle frappe avant de vraiment lancer la recherche
  // (technique appelée "debounce")
});

els.locateBtn.addEventListener('click', () => {
  if (!navigator.geolocation) {
    // Vérifie que le téléphone/navigateur sait faire de la géolocalisation
    statusPanel('Géolocalisation non disponible sur cet appareil', true);
    return;
  }

  statusPanel('Repérage de ta position…');

  navigator.geolocation.getCurrentPosition(
    // Cette fonction demande au téléphone sa position GPS. Elle prend 2 "callbacks" (fonctions) :
    // une pour le succès, une pour l'échec (ex: utilisateur refuse l'autorisation)

    (pos) => {
      // ----- callback appelé SI la position est obtenue -----
      const place = {
        name: 'Ma position',
        admin1: '', country: '',
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      };
      loadForPlace(place);
    },

    () => statusPanel('Position refusée — cherche une ville à la place', true),
    // ----- callback appelé SI erreur/refus -----

    { timeout: 8000 }
    // Options : abandonne si aucune réponse après 8000 millisecondes (8 secondes)
  );
});

// ===== ÉTAT INITIAL AU CHARGEMENT DE LA PAGE =====
statusPanel('Cherche une ville ou utilise 📍 pour ta position');
// Premier message affiché à l'utilisateur avant qu'il n'ait rien fait

// ===== ENREGISTREMENT DU SERVICE WORKER (POUR L'INSTALLATION) =====
if ('serviceWorker' in navigator) {
  // Vérifie que le navigateur du téléphone sait gérer les service workers (c'est le cas sur Chrome/Safari récents)
  window.addEventListener('load', () => {
    // On attend que TOUTE la page soit chargée avant de faire ça, pour ne pas ralentir l'affichage initial
    navigator.serviceWorker.register('./sw.js').catch(() => {});
    // Demande au navigateur d'activer notre fichier sw.js en arrière-plan.
    // .catch(() => {}) = si ça échoue, on ignore silencieusement l'erreur (pas grave pour le fonctionnement de base)
  });
}
