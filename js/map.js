"use strict";

const DATA_URL = "./data/visited-countries.json";
const GEOJSON_URL =
  "https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_110m_admin_0_countries.geojson";
const WORLD_COUNTRY_COUNT = 195;
const DEFAULT_VIEW = {
  center: [22, 10],
  zoom: 2,
};

const CONTINENT_COLORS = {
  Europa: "#d66b4b",
  Asia: "#c9a344",
  Africa: "#9984a3",
  "Nord America": "#6d99a6",
  "Sud America": "#718c69",
  Oceania: "#4e8179",
};

const state = {
  data: null,
  countryByCode: new Map(),
  map: null,
  geoJsonLayer: null,
  countryLayers: new Map(),
  visibleCodes: new Set(),
  activeContinent: "Tutti",
  query: "",
  currentResults: [],
};

const elements = {
  continentFilters: document.querySelector("#continent-filters"),
  searchInput: document.querySelector("#search-input"),
  mapResultCount: document.querySelector("#map-result-count"),
  countryResultCount: document.querySelector("#country-result-count"),
  countryGrid: document.querySelector("#country-grid"),
  continentChart: document.querySelector("#continent-chart"),
  rankingList: document.querySelector("#ranking-list"),
  coverageRing: document.querySelector("#coverage-ring"),
  coverageValue: document.querySelector("#coverage-value"),
  emptyState: document.querySelector("#empty-state"),
  clearFilters: document.querySelector("#clear-filters"),
  mapReset: document.querySelector("#map-reset"),
  errorBanner: document.querySelector("#error-banner"),
};

document.addEventListener("DOMContentLoaded", () => {
  initialize().catch(handleFatalError);
});

async function initialize() {
  if (typeof window.L === "undefined") {
    throw new Error(
      "La libreria della mappa non è disponibile. Controlla la connessione internet e ricarica la pagina.",
    );
  }

  const [travelResponse, geoJsonResponse] = await Promise.all([
    fetch(DATA_URL, { cache: "no-store" }),
    fetch(GEOJSON_URL),
  ]);

  if (!travelResponse.ok) {
    throw new Error(
      `Impossibile caricare ${DATA_URL}: il server ha risposto con stato ${travelResponse.status}.`,
    );
  }

  if (!geoJsonResponse.ok) {
    throw new Error(
      `Impossibile caricare le sagome dei paesi: il server ha risposto con stato ${geoJsonResponse.status}.`,
    );
  }

  const [data, geoJson] = await Promise.all([
    travelResponse.json(),
    geoJsonResponse.json(),
  ]);

  validateTravelData(data);
  validateGeoJson(geoJson);

  state.data = data;
  state.countryByCode = new Map(
    data.countries.map((country) => [country.code.toUpperCase(), country]),
  );
  state.visibleCodes = new Set(state.countryByCode.keys());

  initializeMap(geoJson);
  bindEvents();
  renderStaticContent();
  renderFilters();
  applyFilters({ fitMap: true });

  requestAnimationFrame(() => {
    document.body.classList.add("is-ready");
    state.map.invalidateSize();
  });
}

function validateTravelData(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Il file JSON deve contenere un oggetto.");
  }

  const rootKeys = Object.keys(data);
  if (rootKeys.length !== 1 || rootKeys[0] !== "countries") {
    throw new Error(
      "Il file JSON deve contenere soltanto la proprietà “countries”.",
    );
  }

  if (!Array.isArray(data.countries) || data.countries.length === 0) {
    throw new Error(
      "Il file JSON deve contenere un array non vuoto chiamato “countries”.",
    );
  }

  const expectedFields = ["name", "code", "continent", "visits"];
  const countryCodes = new Set();

  data.countries.forEach((country, countryIndex) => {
    const label = `countries[${countryIndex}]`;
    const fields = Object.keys(country);
    const missingFields = expectedFields.filter((field) => !(field in country));
    const extraFields = fields.filter((field) => !expectedFields.includes(field));

    if (missingFields.length > 0 || extraFields.length > 0) {
      const details = [
        missingFields.length > 0
          ? `mancano: ${missingFields.join(", ")}`
          : null,
        extraFields.length > 0
          ? `non supportati: ${extraFields.join(", ")}`
          : null,
      ]
        .filter(Boolean)
        .join("; ");
      throw new Error(`${label} non rispetta il formato previsto (${details}).`);
    }

    requireString(country.name, `${label}.name`);
    requireString(country.code, `${label}.code`);
    requireString(country.continent, `${label}.continent`);

    if (!/^[A-Za-z]{2}$/.test(country.code)) {
      throw new Error(`${label}.code deve essere un codice ISO di due lettere.`);
    }

    const normalizedCode = country.code.toUpperCase();
    if (countryCodes.has(normalizedCode)) {
      throw new Error(`Il codice paese ${normalizedCode} è duplicato nel JSON.`);
    }
    countryCodes.add(normalizedCode);

    if (!Number.isInteger(country.visits) || country.visits < 1) {
      throw new Error(`${label}.visits deve essere un intero maggiore di zero.`);
    }
  });
}

function validateGeoJson(geoJson) {
  if (
    !geoJson ||
    geoJson.type !== "FeatureCollection" ||
    !Array.isArray(geoJson.features)
  ) {
    throw new Error("La sorgente geografica non contiene un GeoJSON valido.");
  }
}

function requireString(value, path) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${path} deve essere una stringa non vuota.`);
  }
}

function initializeMap(geoJson) {
  state.map = window.L.map("map", {
    zoomControl: false,
    scrollWheelZoom: false,
    minZoom: 2,
    worldCopyJump: true,
  }).setView(DEFAULT_VIEW.center, DEFAULT_VIEW.zoom);

  window.L.control.zoom({ position: "bottomright" }).addTo(state.map);

  window.L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      maxZoom: 18,
      attribution:
        "&copy; OpenStreetMap contributors &middot; Natural Earth",
    },
  ).addTo(state.map);

  state.geoJsonLayer = window.L.geoJSON(geoJson, {
    style: (feature) => getCountryStyle(getFeatureCountryCode(feature)),
    onEachFeature: (feature, layer) => {
      const code = getFeatureCountryCode(feature);
      const country = code ? state.countryByCode.get(code) : null;

      if (!country) {
        return;
      }

      state.countryLayers.set(code, layer);
      layer.bindPopup(createPopupContent(country), {
        closeButton: false,
        maxWidth: 240,
      });
      layer.bindTooltip(
        `${countryCodeToFlag(country.code)} ${escapeHtml(country.name)}`,
        {
          sticky: true,
          direction: "top",
          className: "country-tooltip",
        },
      );

      layer.on({
        mouseover: () => {
          if (!state.visibleCodes.has(code)) {
            return;
          }
          layer.setStyle({ weight: 2.2, fillOpacity: 0.9 });
          layer.bringToFront();
        },
        mouseout: () => {
          layer.setStyle(getCountryStyle(code));
        },
      });
    },
  }).addTo(state.map);

  const missingCodes = [...state.countryByCode.keys()].filter(
    (code) => !state.countryLayers.has(code),
  );
  if (missingCodes.length > 0) {
    throw new Error(
      `Nessuna sagoma trovata per i codici: ${missingCodes.join(", ")}.`,
    );
  }

  document.querySelector("#map .map-loading")?.remove();
}

function getFeatureCountryCode(feature) {
  const properties = feature?.properties || {};
  const candidates = [
    properties.ISO_A2_EH,
    properties.ISO_A2,
    properties.WB_A2,
    properties.POSTAL,
  ];

  return (
    candidates.find(
      (code) => typeof code === "string" && /^[A-Z]{2}$/.test(code),
    ) || null
  );
}

function getCountryStyle(code) {
  const country = code ? state.countryByCode.get(code) : null;

  if (!country) {
    return {
      color: "#b7b2a7",
      weight: 0.55,
      fillColor: "#ddd9cf",
      fillOpacity: 0.42,
    };
  }

  if (!state.visibleCodes.has(code)) {
    return {
      color: "#bbb6ab",
      weight: 0.7,
      fillColor: "#c9c4b8",
      fillOpacity: 0.12,
    };
  }

  return {
    color: "#f4f1e9",
    weight: 1.15,
    fillColor: getContinentColor(country.continent),
    fillOpacity: 0.76,
  };
}

function bindEvents() {
  elements.continentFilters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-continent]");
    if (!button) {
      return;
    }

    state.activeContinent = button.dataset.continent;
    updateFilterButtons();
    applyFilters({ fitMap: true });
  });

  elements.searchInput.addEventListener("input", (event) => {
    state.query = event.target.value.trim();
    applyFilters({ fitMap: true });
  });

  elements.countryGrid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-focus-country]");
    if (!button) {
      return;
    }

    focusCountryOnMap(button.dataset.focusCountry);
  });

  elements.clearFilters.addEventListener("click", resetFilters);
  elements.mapReset.addEventListener("click", () => {
    state.map.setView(DEFAULT_VIEW.center, DEFAULT_VIEW.zoom);
  });
}

function renderStaticContent() {
  const stats = calculateStats();

  document.querySelectorAll('[data-stat="countries"]').forEach((element) => {
    element.textContent = formatNumber(stats.countryCount);
  });
  document.querySelectorAll('[data-stat="visits"]').forEach((element) => {
    element.textContent = formatNumber(stats.visitCount);
  });
  document.querySelector('[data-stat="continents"]').textContent = formatNumber(
    stats.continentCount,
  );

  elements.coverageValue.textContent = `${formatDecimal(stats.coverage)}%`;
  elements.coverageRing.style.setProperty(
    "--coverage",
    Math.min(stats.coverage, 100).toFixed(2),
  );
  elements.coverageRing.setAttribute(
    "aria-label",
    `${formatDecimal(stats.coverage)}% dei paesi del mondo visitato`,
  );

  renderContinentChart(stats.continentCounts, stats.countryCount);
  renderRanking(stats.ranking);
}

function calculateStats() {
  const continentCounts = state.data.countries.reduce((counts, country) => {
    counts[country.continent] = (counts[country.continent] || 0) + 1;
    return counts;
  }, {});
  const visitCount = state.data.countries.reduce(
    (total, country) => total + country.visits,
    0,
  );
  const ranking = [...state.data.countries].sort((first, second) => {
    if (second.visits !== first.visits) {
      return second.visits - first.visits;
    }
    return first.name.localeCompare(second.name, "it");
  });

  return {
    countryCount: state.data.countries.length,
    continentCount: Object.keys(continentCounts).length,
    visitCount,
    coverage: (state.data.countries.length / WORLD_COUNTRY_COUNT) * 100,
    continentCounts,
    ranking,
  };
}

function renderFilters() {
  const continentCounts = state.data.countries.reduce((counts, country) => {
    counts[country.continent] = (counts[country.continent] || 0) + 1;
    return counts;
  }, {});

  const filters = [
    { name: "Tutti", count: state.data.countries.length },
    ...Object.entries(continentCounts)
      .sort(([first], [second]) => first.localeCompare(second, "it"))
      .map(([name, count]) => ({ name, count })),
  ];

  elements.continentFilters.replaceChildren(
    ...filters.map(({ name, count }) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "filter-chip";
      button.dataset.continent = name;
      button.setAttribute("aria-pressed", String(name === state.activeContinent));
      button.append(document.createTextNode(name));

      const badge = document.createElement("span");
      badge.textContent = count;
      button.append(badge);
      return button;
    }),
  );

  updateFilterButtons();
}

function updateFilterButtons() {
  elements.continentFilters
    .querySelectorAll("[data-continent]")
    .forEach((button) => {
      const isActive = button.dataset.continent === state.activeContinent;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });
}

function applyFilters({ fitMap }) {
  state.currentResults = getFilteredResults();
  state.visibleCodes = new Set(
    state.currentResults.map((country) => country.code.toUpperCase()),
  );

  updateMapCountries(fitMap);
  renderCountryCards(state.currentResults);
  renderResultCounts(state.currentResults);

  const hasResults = state.currentResults.length > 0;
  elements.countryGrid.hidden = !hasResults;
  elements.emptyState.hidden = hasResults;
}

function getFilteredResults() {
  const normalizedQuery = normalizeText(state.query);

  return state.data.countries.filter((country) => {
    if (
      state.activeContinent !== "Tutti" &&
      country.continent !== state.activeContinent
    ) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    return normalizeText(
      `${country.name} ${country.code} ${country.continent}`,
    ).includes(normalizedQuery);
  });
}

function updateMapCountries(fitMap) {
  state.geoJsonLayer.setStyle((feature) =>
    getCountryStyle(getFeatureCountryCode(feature)),
  );

  state.countryLayers.forEach((layer, code) => {
    const element = layer.getElement();
    if (element) {
      element.style.pointerEvents = state.visibleCodes.has(code)
        ? "auto"
        : "none";
    }
  });

  if (fitMap) {
    fitMapToCountries(state.currentResults);
  }
}

function fitMapToCountries(countries) {
  const layers = countries
    .map((country) => state.countryLayers.get(country.code.toUpperCase()))
    .filter(Boolean);

  if (layers.length === 0) {
    state.map.setView(DEFAULT_VIEW.center, DEFAULT_VIEW.zoom);
    return;
  }

  const bounds = window.L.featureGroup(layers).getBounds();
  state.map.fitBounds(bounds, {
    padding: [48, 48],
    maxZoom: layers.length === 1 ? 5 : 4,
  });
}

function createPopupContent(country) {
  return `
    <article class="map-popup">
      <div class="map-popup__topline">
        <span class="map-popup__flag" aria-hidden="true">
          ${countryCodeToFlag(country.code)}
        </span>
        <span class="map-popup__visits">${formatVisitCount(country.visits)}</span>
      </div>
      <h3>${escapeHtml(country.name)}</h3>
      <p>${escapeHtml(country.continent)} · ${escapeHtml(country.code.toUpperCase())}</p>
    </article>
  `;
}

function renderCountryCards(countries) {
  const maxVisits = Math.max(
    ...state.data.countries.map((country) => country.visits),
  );

  elements.countryGrid.innerHTML = countries
    .map((country) => {
      const color = getContinentColor(country.continent);
      const progress = (country.visits / maxVisits) * 100;

      return `
        <article class="country-card" style="--country-accent: ${color}">
          <header class="country-card__header">
            <span class="country-card__flag" aria-hidden="true">
              ${countryCodeToFlag(country.code)}
            </span>
            <div class="country-card__title">
              <h3>${escapeHtml(country.name)}</h3>
              <span>${escapeHtml(country.continent)}</span>
            </div>
            <span class="country-card__visits">${formatVisitCount(country.visits)}</span>
          </header>

          <div class="country-card__summary">
            <span>Frequenza di viaggio</span>
            <strong>${formatNumber(country.visits)}</strong>
          </div>
          <div class="country-card__progress" aria-hidden="true">
            <span style="--visit-width: ${progress.toFixed(2)}%"></span>
          </div>

          <footer class="country-card__footer">
            <span>ISO · ${escapeHtml(country.code.toUpperCase())}</span>
            <button
              class="country-focus"
              type="button"
              data-focus-country="${escapeHtml(country.code.toUpperCase())}"
              aria-label="Mostra ${escapeHtml(country.name)} sulla mappa"
            >
              Sulla mappa
              <span aria-hidden="true">↗</span>
            </button>
          </footer>
        </article>
      `;
    })
    .join("");
}

function renderResultCounts(countries) {
  const countryCount = countries.length;

  elements.mapResultCount.textContent =
    countryCount === 1
      ? "1 paese evidenziato"
      : `${formatNumber(countryCount)} paesi evidenziati`;

  elements.countryResultCount.textContent =
    countryCount === 1
      ? "1 paese corrisponde ai filtri"
      : `${formatNumber(countryCount)} paesi corrispondono ai filtri`;
}

function renderContinentChart(continentCounts, countryCount) {
  elements.continentChart.innerHTML = Object.entries(continentCounts)
    .sort(([, firstCount], [, secondCount]) => secondCount - firstCount)
    .map(([continent, count]) => {
      const percentage = (count / countryCount) * 100;

      return `
        <div class="continent-bar">
          <div class="continent-bar__meta">
            <span>${escapeHtml(continent)}</span>
            <span>${count} ${count === 1 ? "paese" : "paesi"}</span>
          </div>
          <div class="continent-bar__track">
            <div
              class="continent-bar__fill"
              style="--bar-width: ${percentage.toFixed(2)}%; --bar-color: ${getContinentColor(continent)}"
            ></div>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderRanking(countries) {
  elements.rankingList.innerHTML = countries
    .slice(0, 4)
    .map(
      (country, index) => `
        <li>
          <span class="ranking-list__position">${index + 1}</span>
          <span class="ranking-list__flag" aria-hidden="true">
            ${countryCodeToFlag(country.code)}
          </span>
          <div>
            <strong>${escapeHtml(country.name)}</strong>
            <small>${escapeHtml(country.continent)}</small>
          </div>
          <span class="ranking-list__visits">${country.visits}×</span>
        </li>
      `,
    )
    .join("");
}

function focusCountryOnMap(countryCode) {
  const normalizedCode = countryCode.toUpperCase();
  const layer = state.countryLayers.get(normalizedCode);
  if (!layer) {
    return;
  }

  state.map.fitBounds(layer.getBounds(), {
    padding: [70, 70],
    maxZoom: 5,
  });
  document.querySelector("#mappa").scrollIntoView({ behavior: "smooth" });

  window.setTimeout(() => {
    layer.openPopup();
  }, 450);
}

function resetFilters() {
  state.activeContinent = "Tutti";
  state.query = "";
  elements.searchInput.value = "";
  updateFilterButtons();
  applyFilters({ fitMap: true });
}

function getContinentColor(continent) {
  return CONTINENT_COLORS[continent] || "#566653";
}

function countryCodeToFlag(code) {
  const normalizedCode = String(code).trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalizedCode)) {
    return "◎";
  }

  return String.fromCodePoint(
    ...normalizedCode.split("").map((letter) => 127397 + letter.charCodeAt(0)),
  );
}

function normalizeText(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("it");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatNumber(value) {
  return new Intl.NumberFormat("it-IT").format(value);
}

function formatDecimal(value) {
  return new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function formatVisitCount(value) {
  return value === 1 ? "1 visita" : `${formatNumber(value)} visite`;
}

function handleFatalError(error) {
  console.error(error);

  elements.errorBanner.hidden = false;
  elements.errorBanner.textContent = `Errore: ${error.message}`;
  elements.mapResultCount.textContent = "Dati non disponibili";
  elements.countryResultCount.textContent = "Impossibile mostrare i paesi";

  const mapElement = document.querySelector("#map");
  mapElement.innerHTML = `
    <div class="map-loading">
      Impossibile caricare la mappa. Controlla la connessione e riprova.
    </div>
  `;
}
