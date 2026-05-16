# Clustering Playground

Playground interattivo per visualizzare e sperimentare algoritmi di clustering direttamente nel browser.

Realizzato con JavaScript vanilla e HTML5 Canvas.

---

# Panoramica

Questo progetto nasce come strumento didattico e visuale per esplorare il comportamento dei principali algoritmi di clustering su dataset sintetici generati in tempo reale.

È un progetto personale sviluppato e migliorato progressivamente nel corso di circa 3 anni con alti e bassi, attraverso sperimentazione continua, studio degli algoritmi di clustering e iterazioni sull’esperienza visuale e didattica.

L’applicazione permette di:

- generare dataset interattivi
- eseguire diversi algoritmi di clustering
- visualizzare i passaggi intermedi
- osservare boundary e regioni di decisione
- confrontare approcci basati su centroidi, densità e struttura
- capire intuitivamente come cambiano i risultati variando i parametri

L’obiettivo principale è educativo e visuale, non la performance scientifica o l’uso production-ready.

---

# Funzionalità

## Generazione dataset

Dataset disponibili:

- Cluster casuali
- Rumore casuale
- Two Moons
- Cerchi concentrici
- Spirale

Parametri regolabili:

- numero di punti
- spread
- percentuale di noise
- numero di cluster

---

# Interazione Mouse

L’applicazione permette anche l’inserimento manuale dei centroidi iniziali.

## Controlli mouse

- Click sinistro → aggiunge un centroide manualmente sul canvas
- I centroidi manuali possono essere utilizzati dagli algoritmi basati su centroidi come K-Means

Questa modalità permette di osservare come la scelta iniziale dei centroidi influenzi il risultato finale del clustering.

---

# Algoritmi implementati

## Clustering classico / soft

- K-Means
- Fuzzy C-Means
- Gaussian Mixture Models (GMM)

## Clustering basato sulla densità

- DBSCAN
- HDBSCAN
- Mean Shift

## Clustering basato sulla struttura

- Spectral Clustering
- Hierarchical Clustering

---

# Visualizzazioni

Il progetto include diverse visualizzazioni pensate per facilitare la comprensione degli algoritmi:

- esecuzione step-by-step
- boundaries stile Voronoi per K-Means
- trail di convergenza per Mean Shift
- raggi epsilon per DBSCAN
- regioni di densità
- ellissi gaussiane per GMM
- Minimum Spanning Tree
- dendrogrammi per clustering gerarchico
- trasparenza basata sulla membership nei metodi fuzzy

---

# Tecnologie utilizzate

- JavaScript Vanilla
- HTML5 Canvas
- HTML/CSS
- Nessun framework esterno

---

# Struttura del progetto

L’attuale versione mantiene volutamente gran parte della logica in un singolo file JavaScript per rendere più semplice seguire il flusso completo del progetto durante l’esplorazione didattica.

Le componenti principali includono:

- generazione dataset
- implementazione algoritmi
- rendering canvas
- controlli UI interattivi

---

# Obiettivo didattico

Questo progetto è pensato per aiutare a visualizzare concetti che spesso risultano difficili da comprendere tramite immagini statiche o teoria pura.

L’obiettivo non è fornire implementazioni ottimizzate degli algoritmi, ma rendere osservabile e intuitivo il loro comportamento.

Alcuni algoritmi sono volutamente semplificati o adattati per finalità visuali ed educative.

---

# Demo Online

👉 https://marcomariani98.github.io/Visualizzazione-Cluster/

Il progetto può essere eseguito direttamente dal browser tramite GitHub Pages.



---

# Avvio locale

È sufficiente aprire:

```html
index.html