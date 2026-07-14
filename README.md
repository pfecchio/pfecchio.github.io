# Personal page

Sito statico personale per GitHub Pages, realizzato con HTML, CSS e JavaScript
senza dipendenze o passaggi di build.

## Personalizzazione

- `index.html`: nome, presentazione, metriche, competenze e progetti.
- `data/visited-countries.json`: paesi mostrati nella mappa interattiva.
- `data/visited-italian-regions.json`: visite nelle 20 regioni italiane.
- `data/italy-regions.geojson`: confini regionali semplificati per il web.
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

La mappa italiana usa tutte le 20 regioni. Per segnarne una come visitata,
imposta `visits` a un intero maggiore di zero in
`data/visited-italian-regions.json`:

```json
{
  "name": "Toscana",
  "code": "09",
  "visits": 3
}
```

I codici corrispondono ai codici regionali ISTAT e non devono essere
modificati.

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

Le mappe usano [Leaflet](https://leafletjs.com/), le mappe di
[OpenStreetMap](https://www.openstreetmap.org/) e le sagome GeoJSON di Natural
Earth, quindi richiede una connessione Internet.

I confini regionali italiani derivano dai dati
[ISTAT](https://www.istat.it/) pubblicati da
[Openpolis](https://github.com/openpolis/geojson-italy) con licenza
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Le geometrie sono
state semplificate per ridurre il peso della pagina.
