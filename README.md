# Personal page

Sito statico personale per GitHub Pages, realizzato con HTML, CSS e JavaScript
senza dipendenze o passaggi di build.

## Personalizzazione

- `index.html`: nome, presentazione, metriche, competenze e progetti.
- `data/visited-countries.json`: paesi mostrati nella mappa interattiva.
- `js/map.js`: caricamento dei dati, filtri, statistiche e interazioni.
- `map-styles.css`: stile dedicato alla pagina dei viaggi.
- `styles.css`: colori e stile globale; le variabili principali sono all'inizio
  del file.

Ogni paese nel JSON usa nome, codice ISO 3166-1 alpha-2, continente e numero di
visite:

```json
{
  "name": "Italia",
  "code": "IT",
  "continent": "Europa",
  "visits": 2
}
```

Statistiche, filtri, bandiere, schede e sagome evidenziate si aggiornano
automaticamente quando cambia il JSON.

## Anteprima locale

Avvia un server dalla cartella del repository:

```bash
uv venv .venv
./.venv/bin/python -m http.server 8000
```

Poi visita `http://localhost:8000`.

## Pubblicazione

Il sito è pronto per essere pubblicato dalla root del branch `main`. In
**Settings → Pages**, seleziona **Deploy from a branch**, quindi `main` e
`/(root)`.

La mappa usa [Leaflet](https://leafletjs.com/), le mappe di
[OpenStreetMap](https://www.openstreetmap.org/) e le sagome GeoJSON di Natural
Earth, quindi richiede una connessione Internet.
