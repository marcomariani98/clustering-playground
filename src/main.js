"use strict";

// Coordina tutto: legge la UI, chiede all'algoritmo di girare, passa al
// renderer. Vive di tre oggetti: lo stato (AppState), le primitive (Canvas)
// e il registry di strategie. Niente let globali sparse: tutto e' attaccato
// a state.

let state;
let primitives;

// Una coppia { algorithm, renderer, run, draw } per modalita'. run e' il
// command che usano i pulsanti Play/Step/Execute; draw e' chiamata a ogni
// render() e tira fuori dalla UI le opzioni specifiche dell'algoritmo.
let modeStrategies;

let kmeans, spectral, fuzzy, meanShift, gmm, dbscan, hdbscan, hcluster;
let kmeansRenderer, spectralRenderer, fuzzyRenderer, meanShiftRenderer;
let gmmRenderer, dbscanRenderer, hdbscanRenderer, hclusterRenderer;
let gmmModelComparisons = [];
let gmmComparisonDatasetKey = "";

function startApp(){
    initTheme();
    state = new AppState();
    primitives = new Primitives(DOM("clusterCanvas"));

    kmeans = new kMeans(primitives);
    spectral = new SpectralClustering(primitives);
    fuzzy = new FuzzyCMeans(primitives);
    meanShift = new MeanShift(primitives);
    gmm = new GMM(primitives);
    dbscan = new DBSCAN(primitives);
    hdbscan = new HDBSCAN(primitives);
    hcluster = new HCluster(primitives);

    kmeansRenderer = new KMeansRenderer(primitives);
    spectralRenderer = new SpectralRenderer(primitives);
    fuzzyRenderer = new FuzzyRenderer(primitives);
    meanShiftRenderer = new MeanShiftRenderer(primitives);
    gmmRenderer = new GMMRenderer(primitives);
    dbscanRenderer = new DBSCANRenderer(primitives);
    hdbscanRenderer = new HDBSCANRenderer(primitives);
    hclusterRenderer = new HClusterRenderer(primitives);

    modeStrategies = createModeStrategies();

    bindEvents();
    bindBrushMode();
    bindTabs();
    bindIO();
    updateRangeValues();
    updateLegend();
    updatePseudocode();
    updateQualityLegend();
    updateComplexityBadge();
    render();
}

// Tema chiaro/scuro. Letto da localStorage al boot, persisto al toggle.
// Il bottone aggiorna anche l'icona (sole/luna) e ridisegna il canvas per
// rinfrescare i colori "ink" che dipendono dal tema.
const THEME_STORAGE_KEY = "clusteringPlayground.theme";

function initTheme(){
    let saved = null;
    try {
        saved = localStorage.getItem(THEME_STORAGE_KEY);
    } catch (e) {
        // localStorage puo' lanciare in alcuni contesti (file://, private mode).
    }
    if(saved === "dark"){
        document.documentElement.dataset.theme = "dark";
    }
}

function toggleTheme(){
    let isDark = document.documentElement.dataset.theme === "dark";
    if(isDark){
        delete document.documentElement.dataset.theme;
    }else{
        document.documentElement.dataset.theme = "dark";
    }
    try {
        localStorage.setItem(THEME_STORAGE_KEY, isDark ? "light" : "dark");
    } catch (e) {}
    updateThemeButton();
    render();
    updateConvergenceChart();
    updatePreviews();
}

function updateThemeButton(){
    let btn = DOM("themeToggle");
    if(!btn) return;
    let isDark = document.documentElement.dataset.theme === "dark";
    btn.textContent = isDark ? "☀️" : "🌙";
}

function bindEvents(){
    window.addEventListener("resize", () => {
        primitives.resize();
        render();
    });

    DOM("safemode").addEventListener("change", () => {
        state.safeMode = DOM("safemode").checked;
        setStatus(state.safeMode
            ? "Safe mode ON — per-algorithm point limits enforced"
            : "Safe mode OFF — heavy algorithms can freeze the browser");
    });
    DOM("themeToggle").addEventListener("click", toggleTheme);
    updateThemeButton();

    primitives.canvas.addEventListener("click", (event) => {
        // Quando il brush e' attivo i punti vengono spawnati da mousedown/move.
        if(DOM("brushMode").checked) return;
        state.addPoint(primitives.getMouse(event));
        clearResult();
        setStatus(`Points: ${state.data.length}`);
        render();
    });

    // Tasto destro = centroide manuale, ma solo per K-Means (gli altri non lo usano).
    primitives.canvas.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        if(state.mode !== "kmeans") return;

        kmeans.init_centroid.push(primitives.getMouse(event));
        clearResult();
        setStatus(`Centroids: ${kmeans.init_centroid.length}`);
        render();
    });

    document.querySelectorAll("[data-mode]").forEach((button) => {
        button.addEventListener("click", () => changeMode(button.dataset.mode));
    });

    DOM("algorithmSelect").addEventListener("change", () => {
        changeMode(DOMgetValue("algorithmSelect"));
    });

    document.querySelectorAll("input[name=\"spectralLaplacian\"]").forEach((input) => {
        input.addEventListener("change", () => {
            clearResult();
            updatePseudocode();
            setStatus(`Spectral Laplacian: ${getSpectralLaplacianInfo().label}`);
            render();
        });
    });

    // I parametri di DBSCAN influenzano direttamente i cerchi epsilon disegnati.
    // Se l'utente cambia il valore senza ri-runnare, il disegno precedente
    // mostra raggi diversi dal nuovo valore: clearResult evita l'incongruenza.
    ["dbscanEpsilon", "dbscanMinPts"].forEach((id) => {
        let input = DOM(id);
        if(input){
            input.addEventListener("input", () => {
                clearResult();
                setStatus(`DBSCAN parameters updated`);
                render();
            });
        }
    });

    bindRange("noiseCount", "noiseCountValue");
    bindRange("clusterCount", "clusterCountValue");
    bindRange("clusterSize", "clusterSizeValue");
    bindRange("clusterSpread", "clusterSpreadValue");
    bindRange("autoplaySpeed", "autoplaySpeedValue");

    DOM("addNoisePoints").addEventListener("click", () => {
        let count = parseInt(DOMgetValue("clusterSize"));
        let points = generateNoisePoints(count, primitives.width, primitives.height);
        state.addPoints(points);
        clearResult();
        setStatus(`Added ${points.length} noise points`);
        render();
    });

    DOM("addRandomClusters").addEventListener("click", () => {
        let clusterCount = parseInt(DOMgetValue("clusterCount"));
        let pointCount = parseInt(DOMgetValue("clusterSize"));
        let clusterSpread = parseInt(DOMgetValue("clusterSpread"));
        let noisePercent = parseInt(DOMgetValue("noiseCount"));
        let points = generateRandomClusters(
            clusterCount, pointCount, clusterSpread, noisePercent,
            primitives.width, primitives.height
        );
        state.addPoints(points);
        clearResult();
        setStatus(`Added ${points.length} points in ${clusterCount} clusters, noise ${noisePercent}%`);
        render();
    });

    DOM("addTwoMoons").addEventListener("click", () => {
        let count = parseInt(DOMgetValue("clusterSize"));
        let spread = parseInt(DOMgetValue("clusterSpread"));
        let noisePercent = parseInt(DOMgetValue("noiseCount"));
        let points = generateTwoMoons(count, primitives.width, primitives.height, spread, noisePercent);
        state.addPoints(points);
        clearResult();
        setStatus(`Added two moons dataset: ${points.length} points, noise ${noisePercent}%, spread ${spread}`);
        render();
    });

    DOM("addCircles").addEventListener("click", () => {
        let count = parseInt(DOMgetValue("clusterSize"));
        let spread = parseInt(DOMgetValue("clusterSpread"));
        let noisePercent = parseInt(DOMgetValue("noiseCount"));
        let points = generateConcentricCircles(count, primitives.width, primitives.height, spread, noisePercent);
        state.addPoints(points);
        clearResult();
        setStatus(`Added concentric circles dataset: ${points.length} points, noise ${noisePercent}%, spread ${spread}`);
        render();
    });

    DOM("addSpiral").addEventListener("click", () => {
        let count = parseInt(DOMgetValue("clusterSize"));
        let spread = parseInt(DOMgetValue("clusterSpread"));
        let noisePercent = parseInt(DOMgetValue("noiseCount"));
        let points = generateSpiral(count, primitives.width, primitives.height, spread, noisePercent);
        state.addPoints(points);
        clearResult();
        setStatus(`Added spiral dataset: ${points.length} points, noise ${noisePercent}%, spread ${spread}`);
        render();
    });

    DOM("resetPoints").addEventListener("click", () => {
        state.resetPoints();
        kmeans.reset();
        clearResult();
        setStatus("Points removed");
        render();
    });

    DOM("clearResult").addEventListener("click", () => {
        clearResult();
        setStatus("Result cleared");
        render();
    });

    DOM("showBoundaries").addEventListener("change", () => render());
    DOM("showDetails").addEventListener("change", () => render());
    DOM("showTrails").addEventListener("change", () => render());
    DOM("showLegend").addEventListener("change", () => updateLegend());
    DOM("meanShiftDensityMap").addEventListener("change", () => render());
    DOM("dbscanDrawEps").addEventListener("change", () => render());

    DOM("playAlgorithm").addEventListener("click", () => startAutoplay());
    DOM("stepAlgorithm").addEventListener("click", () => {
        stopAutoplay();
        runCurrent(true);
    });
    DOM("stopAlgorithm").addEventListener("click", () => stopAutoplay());
    DOM("executeAlgorithm").addEventListener("click", () => {
        stopAutoplay();
        runCurrent(false);
    });

    DOM("randomCentroids").addEventListener("click", () => {
        let k = readPositiveInt("kValue", "Invalid K");
        if(!k) return;
        kmeans.generateInitCentroids(k);
        clearResult();
        setStatus(`Generated centroids: ${kmeans.init_centroid.length}`);
        render();
    });

    DOM("forgyCentroids").addEventListener("click", () => {
        let k = readPositiveInt("kValue", "Invalid K");
        if(!k || !checkData()) return;
        kmeans.forgyCentroids(state.data, k);
        clearResult();
        setStatus(`Forgy centroids: ${kmeans.init_centroid.length}`);
        render();
    });

    DOM("kppCentroids").addEventListener("click", () => {
        let k = readPositiveInt("kValue", "Invalid K");
        if(!k || !checkData()) return;
        kmeans.kppCentroids(state.data, k);
        clearResult();
        setStatus(`K-Means++ centroids: ${kmeans.init_centroid.length}`);
        render();
    });

    DOM("farthestFirstCentroids").addEventListener("click", () => {
        let k = readPositiveInt("kValue", "Invalid K");
        if(!k || !checkData()) return;
        kmeans.farthestFirstCentroids(state.data, k);
        clearResult();
        setStatus(`Farthest-First centroids: ${kmeans.init_centroid.length}`);
        render();
    });

    DOM("runKmeans").addEventListener("click", () => runKMeans(false));
    DOM("stepKmeans").addEventListener("click", () => runKMeans(true));

    DOM("resetKmeans").addEventListener("click", () => {
        kmeans.reset();
        clearResult();
        setStatus("Centroids removed");
        render();
    });

    DOM("runDbscan").addEventListener("click", () => runDBSCAN(false));
    DOM("stepDbscan").addEventListener("click", () => runDBSCAN(true));
    DOM("runSpectral").addEventListener("click", () => runSpectral(false));
    DOM("stepSpectral").addEventListener("click", () => runSpectral(true));
    DOM("runFuzzy").addEventListener("click", () => runFuzzy(false));
    DOM("stepFuzzy").addEventListener("click", () => runFuzzy(true));
    DOM("runMeanShift").addEventListener("click", () => runMeanShift(false));
    DOM("stepMeanShift").addEventListener("click", () => runMeanShift(true));
    DOM("runGmm").addEventListener("click", () => runGMM(false));
    DOM("stepGmm").addEventListener("click", () => runGMM(true));
    DOM("runHdbscan").addEventListener("click", () => runHDBSCAN(false));
    DOM("stepHdbscan").addEventListener("click", () => runHDBSCAN(true));
    DOM("runHcluster").addEventListener("click", () => runHCluster(false));
    DOM("stepHcluster").addEventListener("click", () => runHCluster(true));
}

// Brush: tenendo premuto e trascinando spennelliamo punti. I tre slider della
// sezione Data modulano il comportamento:
//   - Spread → raggio del pennello (quanto si allarga la nuvola attorno al cursore)
//   - Points → quanti punti per singolo tick (densita' del tratto)
//   - Noise % → jitter aggiuntivo oltre il raggio del pennello (sporcizia)
// Throttle a 18ms per non spammare clearResult/render a 120fps.
const BRUSH_THROTTLE_MS = 18;
let brushDown = false;
let brushLastSpawn = 0;

function bindBrushMode(){
    let canvas = primitives.canvas;

    canvas.addEventListener("mousedown", (event) => {
        if(!DOM("brushMode").checked) return;
        if(event.button !== 0) return;
        brushDown = true;
        brushLastSpawn = 0;
        spawnBrushPoint(event);
    });

    canvas.addEventListener("mousemove", (event) => {
        if(!brushDown || !DOM("brushMode").checked) return;
        let now = Date.now();
        if(now - brushLastSpawn < BRUSH_THROTTLE_MS) return;
        brushLastSpawn = now;
        spawnBrushPoint(event);
    });

    // mouseup ovunque, cosi' rilasciando fuori dal canvas il brush si ferma comunque.
    window.addEventListener("mouseup", () => { brushDown = false; });
    canvas.addEventListener("mouseleave", () => { brushDown = false; });
}

function spawnBrushPoint(event){
    let m = primitives.getMouse(event);
    let spread = parseInt(DOMgetValue("clusterSpread")) || 45;
    let noisePercent = parseInt(DOMgetValue("noiseCount")) || 0;
    let pointsSlider = parseInt(DOMgetValue("clusterSize")) || 50;

    // Mappatura diretta richiesta: slider=N -> N punti per tick.
    // Slider va 1..200 quindi il pennello cresce in proporzione 1:1.
    let perTick = Math.max(1, pointsSlider);
    // Raggio del pennello: 2px a spread=10, ~22px a spread=120.
    let brushRadius = Math.max(2, spread * 0.18);
    // Jitter extra: scala lineare col noise%, modulata dallo spread.
    let noiseJitter = (noisePercent / 100) * spread * 0.4;

    for(let i = 0; i < perTick; i++){
        // sqrt(random) distribuisce uniformemente sull'area del cerchio.
        let angle = Math.random() * Math.PI * 2;
        let radius = Math.sqrt(Math.random()) * brushRadius;
        let nx = m.x + Math.cos(angle) * radius + randomBetween(-noiseJitter, noiseJitter);
        let ny = m.y + Math.sin(angle) * radius + randomBetween(-noiseJitter, noiseJitter);

        state.addPoint({
            x: clamp(nx, 4, primitives.width - 4),
            y: clamp(ny, 4, primitives.height - 4)
        });
    }

    clearResult();
    setStatus(`Brushing: ${state.data.length} points`);
    render();
}

// Switch tra i sotto-pannelli di una stessa section (Data: Generate / Save & Load).
// Il bind e' generico, basta avere data-tab e data-tab-content nello stesso parent.
function bindTabs(){
    document.querySelectorAll(".tab-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            let section = btn.closest("section");
            if(!section) return;

            section.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");

            let target = btn.dataset.tab;
            section.querySelectorAll("[data-tab-content]").forEach((content) => {
                content.classList.toggle("hidden", content.dataset.tabContent !== target);
            });
        });
    });
}

// Export/load di un point-cloud in JSON. Formato minimale ma esteso con metadata
// utili (versione, timestamp, dimensioni canvas) per debug e portabilita'.
function bindIO(){
    DOM("exportPoints").addEventListener("click", exportPoints);
    DOM("loadPoints").addEventListener("click", () => DOM("loadPointsInput").click());
    DOM("loadPointsInput").addEventListener("change", loadPointsFromFile);
}

function exportPoints(){
    if(state.data.length === 0){
        DOMsetValue("ioStatus", "Nothing to export — add some points first.");
        return;
    }

    let payload = {
        format: "clustering-playground/points",
        version: 1,
        exportedAt: new Date().toISOString(),
        canvas: { width: primitives.width, height: primitives.height },
        points: state.data.map((p) => ({ x: p.x, y: p.y }))
    };

    let blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    let url = URL.createObjectURL(blob);
    let a = document.createElement("a");
    let stamp = new Date().toISOString().replace(/[:.]/g, "-");
    a.href = url;
    a.download = `clustering-points-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Revoca asincrona per dare al browser il tempo di iniziare il download.
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    DOMsetValue("ioStatus", `Exported ${state.data.length} points.`);
}

function loadPointsFromFile(event){
    let file = event.target.files[0];
    if(!file) return;

    let reader = new FileReader();
    reader.onload = (e) => {
        try {
            let raw = JSON.parse(e.target.result);
            // Accettiamo sia il formato esportato da noi {points: [...]} sia un
            // array piatto, per facilitare l'import da altri tool.
            let rawPoints = Array.isArray(raw) ? raw : raw.points;
            if(!Array.isArray(rawPoints)) throw new Error("File doesn't contain a points array");

            let valid = rawPoints
                .filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y))
                .map((p) => ({
                    x: clamp(p.x, 4, primitives.width - 4),
                    y: clamp(p.y, 4, primitives.height - 4)
                }));

            if(valid.length === 0) throw new Error("No valid points found");

            state.resetPoints();
            state.addPoints(valid);
            kmeans.reset();
            clearResult();
            DOMsetValue("ioStatus", `Loaded ${valid.length} points from ${file.name}.`);
            setStatus(`Loaded ${valid.length} points from file`);
            render();
        } catch (err) {
            DOMsetValue("ioStatus", `Load failed: ${err.message}`);
        }

        // Reset dell'input cosi' che ricaricare lo stesso file riscateni il change.
        event.target.value = "";
    };
    reader.onerror = () => {
        DOMsetValue("ioStatus", "Could not read the file.");
    };
    reader.readAsText(file);
}

function bindRange(inputId, labelId){
    DOM(inputId).addEventListener("input", () => {
        updateRangeLabel(inputId, labelId);
        if(inputId === "autoplaySpeed" && state.isPlaying()){
            restartAutoplay();
        }
    });
}

function updateRangeValues(){
    updateRangeLabel("noiseCount", "noiseCountValue");
    updateRangeLabel("clusterCount", "clusterCountValue");
    updateRangeLabel("clusterSize", "clusterSizeValue");
    updateRangeLabel("clusterSpread", "clusterSpreadValue");
    updateRangeLabel("autoplaySpeed", "autoplaySpeedValue");
}

function updateRangeLabel(inputId, labelId){
    let value = DOMgetValue(inputId);
    if(inputId === "noiseCount" || inputId === "autoplaySpeed"){
        value = `${value}%`;
    }
    DOMsetValue(labelId, value);
}

function changeMode(newMode){
    stopAutoplay();
    state.setMode(newMode);
    clearResult();
    DOM("algorithmSelect").value = newMode;

    document.querySelectorAll("[data-mode]").forEach((button) => {
        button.classList.toggle("active", button.dataset.mode === newMode);
    });
    document.querySelectorAll("[data-panel]").forEach((panel) => {
        panel.classList.toggle("hidden", panel.dataset.panel !== newMode);
    });

    setStatus(`Mode: ${newMode}`);
    updateLegend();
    updatePseudocode();
    updateComplexityBadge();
    render();
}

// Etichetta in alto a destra: notazione big-O del worst-case per l'algoritmo
// selezionato. Severity (heavy/medium/light) colora il badge come "alert" visivo
// quando l'algoritmo e' costoso. Stesse soglie usate da safeRun.
function updateComplexityBadge(){
    let badge = DOM("complexityBadge");
    let value = DOM("complexityValue");
    if(!badge || !value) return;

    let map = {
        kmeans:    { expr: "O(n·k·i)",  severity: "light"  },
        fuzzy:     { expr: "O(n·k·i)",  severity: "light"  },
        gmm:       { expr: "O(n·k·i)",  severity: "light"  },
        dbscan:    { expr: "O(n²)",     severity: "medium" },
        hdbscan:   { expr: "O(n²)",     severity: "medium" },
        meanshift: { expr: "O(n²·i)",   severity: "medium" },
        spectral:  { expr: "O(n³)",     severity: "heavy"  },
        hcluster:  { expr: "O(n³)",     severity: "heavy"  }
    };

    let entry = map[state.mode] || { expr: "O(?)", severity: "light" };
    value.textContent = entry.expr;
    badge.dataset.severity = entry.severity;
    badge.title = `Worst-case time complexity for ${state.mode}. n = points, k = clusters, i = iterations.`;
}

// Mappa slider 1-100 in delay 120-1050ms (piu' lo slider e' alto, piu' veloce).
function getAutoDelay(){
    let speed = parseInt(DOMgetValue("autoplaySpeed")) || 55;
    let ratio = clamp(speed, 1, 100) / 100;
    return Math.round(1050 - ratio * 930);
}

function startAutoplay(){
    if(state.isPlaying()) return;

    if(!state.hasSteps() || !state.hasMoreSteps()){
        runCurrent(true);
    }
    if(!state.hasSteps()) return;

    if(!state.hasMoreSteps()){
        state.rewind();
    }

    let delay = getAutoDelay();
    DOM("playAlgorithm").classList.add("active");

    state.startTimer(delay, () => {
        if(!state.hasMoreSteps()){
            stopAutoplay(false);
            setStatus(`Auto completed ${state.currentSteps.length} steps`);
            return;
        }
        showNextStep();
    });

    setStatus(`Playing steps: ${delay}ms per step`);
}

function restartAutoplay(){
    if(!state.isPlaying()) return;
    state.stopTimer();
    startAutoplay();
}

function stopAutoplay(updateStatus = true){
    state.stopTimer();
    let button = DOM("playAlgorithm");
    if(button) button.classList.remove("active");

    if(updateStatus && state.hasSteps() && state.hasMoreSteps()){
        setStatus(`Auto stopped at step ${state.stepIndex}/${state.currentSteps.length}`);
    }
}

function runCurrent(isStep){
    modeStrategies[state.mode].run(isStep);
}

function getLegendItems(){
    if(state.mode === "kmeans"){
        return [
            "Red cross = initial centroids",
            "Green cross = final centroids",
            "Dashed lines = centroid movement",
            "Thin lines = point assignment",
            "Background = nearest-centroid region"
        ];
    }

    if(state.mode === "gmm"){
        return [
            "Ellipse = Gaussian covariance",
            "Cross = component mean",
            "Transparency = point confidence"
        ];
    }

    if(state.mode === "dbscan"){
        return [
            "Color = cluster",
            "Blue radius = current epsilon query",
            "Blue lines = points inside epsilon",
            "Purple = border point",
            "Black = noise",
            "Circle = epsilon range"
        ];
    }

    if(state.mode === "meanshift"){
        return [
            "Colored points = final cluster",
            "Cross = mode / density maximum",
            "Circle = bandwidth",
            "Trail = shift toward density",
            "Curves = density function levels",
            "Colored bands = KDE intensity",
            "Gray = micro-cluster or noise"
        ];
    }

    if(state.mode === "hdbscan"){
        return [
            "Lines = MST on mutual reachability",
            "Circles = selected clusters",
            "Black = noise",
            "Threshold = density level in the step"
        ];
    }

    if(state.mode === "spectral"){
        let info = getSpectralLaplacianInfo();
        return [
            "Blue edges = strongest RBF affinities",
            "Blue halos = point degree in the graph",
            "Mini plot = spectral embedding",
            `${info.shortLabel} = transformed space`,
            "Colors = final clusters after K-Means"
        ];
    }

    if(state.mode === "fuzzy"){
        return [
            "Transparency = maximum membership",
            "Purple halo = ambiguous membership",
            "Weighted lines = strongest memberships",
            "Dashed lines = fuzzy centroid movement",
            "Cross = centroid",
            "Soft colors = soft membership"
        ];
    }

    return [
        "Link = distance between sub-clusters",
        "C/P labels = clusters and points kept in the steps",
        "Final tree = complete hierarchy"
    ];
}

function updateLegend(){
    let legend = DOM("legendText");

    if(!DOM("showLegend").checked){
        legend.innerHTML = "<li>Legend hidden</li>";
        return;
    }

    legend.innerHTML = getLegendItems()
        .map((item) => `<li>${item}</li>`)
        .join("");
}

function getSpectralLaplacianType(){
    let option = document.querySelector("input[name=\"spectralLaplacian\"]:checked");
    return option ? option.value : "symmetric";
}

function getSpectralLaplacianInfo(){
    let options = {
        unnormalized: { label: "Unnormalized L = D - W", shortLabel: "Unnormalized L" },
        symmetric: { label: "Symmetric normalized L = I - D^-1/2 W D^-1/2", shortLabel: "Symmetric normalized L" },
        randomwalk: { label: "Random walk L = I - D^-1 W", shortLabel: "Random walk L" },
        signless: { label: "Signless Q = D + W", shortLabel: "Signless Q" },
        bethe: { label: "Bethe Hessian H = (β²-1)I + D - βW", shortLabel: "Bethe Hessian" }
    };
    return options[getSpectralLaplacianType()] || options.symmetric;
}

function getPseudocode(){
    if(state.mode === "kmeans"){
        return `let centroids = chooseInitialCentroids(data, k);
let converged = false;

while (!converged) {
  const oldCentroids = centroids;

  const clusters = assignPoints(data, centroids);
  centroids = updateCentroids(clusters);

  converged = hasConverged(oldCentroids, centroids);
}`;
    }

    if(state.mode === "spectral"){
        let laplacianType = getSpectralLaplacianType();
        return `let W = buildAffinityMatrix(data, sigma);
let L = graphLaplacian(W, { type: "${laplacianType}" });

let vectors = smallestEigenvectors(L, k);
let embedding = buildEmbedding(vectors);

return kMeans(embedding, k);`;
    }

    if(state.mode === "fuzzy"){
        return `let membership = randomMembership(data, k);
let centroids;

for (let i = 0; i < maxIterations; i++) {
  const oldMembership = membership;

  centroids = updateWeightedCentroids(data, membership);
  membership = updateMemberships(data, centroids);

  if (hasConverged(oldMembership, membership)) {
break;
  }
}

return strongestMembership(membership);`;
    }

    if(state.mode === "meanshift"){
        return `let shifted = copyPoints(data);
let stable = false;

while (!stable) {
  stable = true;

  for (let i = 0; i < shifted.length; i++) {
let neighbors = pointsWithinBandwidth(shifted[i], shifted);
let newPoint = weightedMean(neighbors);

if (distance(shifted[i], newPoint) > tolerance) {
  stable = false;
}

shifted[i] = newPoint;
  }
}

let modes = mergeNearbyPoints(shifted);
return assignPointsToModes(data, modes);`;
    }

    if(state.mode === "gmm"){
        return `let components = initializeGaussians(data, k);
let responsibilities;

for (let i = 0; i < maxIterations; i++) {
  const oldComponents = components;

  responsibilities = estimateMemberships(data, components);
  components = updateGaussians(data, responsibilities);

  if (hasConverged(oldComponents, components)) {
break;
  }
}

return mostLikelyComponent(responsibilities);`;
    }

    if(state.mode === "dbscan"){
        return `let clusterId = 0;

for (let point of data) {
  if (point.visited) continue;

  point.visited = true;
  let neighbors = regionQuery(point, epsilon);

  if (neighbors.length < minPts) {
markAsNoise(point);
  } else {
clusterId++;
expandCluster(point, neighbors, clusterId, epsilon, minPts);
  }
}`;
    }

    if(state.mode === "hdbscan"){
        return `let coreDistances = computeCoreDistances(data, minPts);
let graph = mutualReachabilityGraph(data, coreDistances);

let mst = minimumSpanningTree(graph);
let condensedTree = condenseTree(mst, minClusterSize);

let clusters = extractMostStableClusters(condensedTree);

return clusters;`;
    }

    return `let clusters = data.map(point => [point]);
let merges = [];

while (clusters.length > 1) {
  let pair = findClosestClusters(clusters);
  let distance = clusterDistance(pair[0], pair[1]);

  merges.push({ pair, distance });

  clusters = mergePair(clusters, pair);
}

return buildDendrogram(merges);`;
}

function escapeHtml(text){
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function pseudocodeToken(type, value){
    return `<span class="token-${type}">${escapeHtml(value)}</span>`;
}

// Tokenizer fatto a mano per evitare di tirarsi dietro Prism/highlight.js.
// Riconosce keyword/numeri/stringhe/identificatori/operatori — il minimo
// per dare colore allo pseudocodice nel popover.
function highlightPseudocode(code){
    let keywords = new Set(["let", "const", "return", "while", "for", "if", "else", "continue", "break", "of"]);
    let constants = new Set(["true", "false", "null", "undefined"]);
    let html = "";
    let i = 0;

    while(i < code.length){
        let char = code[i];

        if(/\s/.test(char)){
            html += char;
            i++;
            continue;
        }

        if(char === "\"" || char === "'"){
            let quote = char;
            let j = i + 1;
            while(j < code.length && code[j] !== quote){
                if(code[j] === "\\") j++;
                j++;
            }
            html += pseudocodeToken("string", code.slice(i, Math.min(j + 1, code.length)));
            i = Math.min(j + 1, code.length);
            continue;
        }

        if(/[0-9]/.test(char)){
            let j = i + 1;
            while(j < code.length && /[0-9.]/.test(code[j])) j++;
            html += pseudocodeToken("number", code.slice(i, j));
            i = j;
            continue;
        }

        if(/[A-Za-z_$]/.test(char)){
            let j = i + 1;
            while(j < code.length && /[A-Za-z0-9_$]/.test(code[j])) j++;

            let word = code.slice(i, j);
            let next = j;
            let previous = i - 1;
            while(next < code.length && /\s/.test(code[next])) next++;
            while(previous >= 0 && /\s/.test(code[previous])) previous--;

            if(keywords.has(word)){
                html += pseudocodeToken("keyword", word);
            }else if(constants.has(word)){
                html += pseudocodeToken("number", word);
            }else if(code[previous] === "."){
                html += pseudocodeToken("property", word);
            }else if(code[next] === "("){
                html += pseudocodeToken("function", word);
            }else{
                html += pseudocodeToken("variable", word);
            }

            i = j;
            continue;
        }

        if("+-*/=%!<>|&".includes(char)){
            let nextChar = code[i + 1] || "";
            let value = char;
            if("=><&|".includes(nextChar)){
                value += nextChar;
                i++;
            }
            html += pseudocodeToken("operator", value);
            i++;
            continue;
        }

        html += pseudocodeToken("punctuation", char);
        i++;
    }

    return html;
}

function updatePseudocode(){
    let box = DOM("pseudocodeBox");
    if(!box) return;
    box.innerHTML = highlightPseudocode(getPseudocode());
}

function updateMetrics(){
    let panel = DOM("metricsPanel");
    if(!panel) return;

    updateQualityLegend();
    updateConvergenceChart();
    panel.classList.toggle("gmm-dashboard", state.mode === "gmm" && state.metricsReady && state.currentResult);

    if(!state.metricsReady || !state.currentResult){
        panel.innerHTML = "<p class=\"hint\">Metrics will appear after Play or after the last Step.</p>";
        return;
    }

    let metrics = Metrics.computeMetrics(state.mode, {
        data: state.data,
        result: state.currentResult,
        steps: state.currentSteps,
        canvasSize: Math.min(primitives.width, primitives.height),
        modelComparisons: state.mode === "gmm" ? gmmModelComparisons : []
    });

    if(metrics.length === 0){
        panel.innerHTML = "<p class=\"hint\">Metrics are not available for this result.</p>";
        return;
    }

    panel.innerHTML = state.mode === "gmm"
        ? renderGMMMetrics(metrics, gmmModelComparisons)
        : metrics.map((metric) => renderMetricCard(metric)).join("");
}

function renderGMMMetrics(metrics, comparisons){
    let find = (key) => metrics.find((metric) => metric.key === key);
    let assignment = [find("confidence"), find("uncertain")].filter(Boolean);
    let modelSelection = [find("avgLikelihood"), find("aic"), find("bic")].filter(Boolean);
    let comparisonBlock = renderGMMComparisonTable(comparisons);
    let comparisonHelp = comparisons && comparisons.length >= 2
        ? `<p class="gmm-comparison-note">Each row is one run on this dataset. The highlighted row wins for its score (lower = better). When AIC and BIC pick the same k, you can trust it.</p>`
        : `<p class="gmm-comparison-note">Rerun GMM on the same points with a different number of components to compare. AIC and BIC reward fit and punish complexity — lower wins.</p>`;

    return `
        <p class="gmm-metrics-intro">How confidently each Gaussian explains the points, followed by scores for comparing component counts.</p>
        <span class="metric-group-label">Assignments</span>
        <div class="gmm-metric-grid">
            ${assignment.map((metric) => renderMetricCard(metric, "metric-compact")).join("")}
        </div>
        <span class="metric-group-label">Model comparison</span>
        <div class="gmm-model-grid">
            ${modelSelection.map((metric) => renderMetricCard(metric, "metric-compact")).join("")}
        </div>
        ${comparisonBlock}
        ${comparisonHelp}
    `;
}

// Tabella che mette in colonna tutte le run salvate per il dataset corrente:
// AIC e BIC vanno sempre letti "lower is better", e qui il "lower" e' visualizzato
// come barretta corta. La run attuale e' evidenziata; quelle che vincono AIC o BIC
// hanno il gradient di sfondo.
function renderGMMComparisonTable(comparisons){
    if(!comparisons || comparisons.length < 2){
        return "";
    }

    let currentK = state.currentResult && state.currentResult.components
        ? state.currentResult.components.length
        : null;

    let sorted = comparisons.slice().sort((a, b) => a.components - b.components);
    let aicValues = sorted.map((entry) => entry.aic);
    let bicValues = sorted.map((entry) => entry.bic);
    let bestAic = Math.min(...aicValues);
    let bestBic = Math.min(...bicValues);
    let aicMax = Math.max(...aicValues);
    let bicMax = Math.max(...bicValues);

    let bestAicK = sorted.find((entry) => Math.abs(entry.aic - bestAic) < 0.000001).components;
    let bestBicK = sorted.find((entry) => Math.abs(entry.bic - bestBic) < 0.000001).components;

    let normalize = (value, min, max) => {
        if(max - min < 0.000001) return 1;
        // Inverso: piu' basso = barra piu' piena (lower is better).
        return 1 - (value - min) / (max - min);
    };

    let rows = sorted.map((entry) => {
        let isCurrent = entry.components === currentK;
        let isBestAic = Math.abs(entry.aic - bestAic) < 0.000001;
        let isBestBic = Math.abs(entry.bic - bestBic) < 0.000001;
        let aicFill = (0.20 + 0.80 * normalize(entry.aic, bestAic, aicMax)) * 100;
        let bicFill = (0.20 + 0.80 * normalize(entry.bic, bestBic, bicMax)) * 100;
        let badge = isBestBic ? "★" : (isBestAic ? "☆" : "");
        let classes = ["gmm-comparison-row"];

        if(isCurrent) classes.push("is-current");
        if(isBestBic) classes.push("is-best-bic");
        else if(isBestAic) classes.push("is-best-aic");

        return `
            <div class="${classes.join(" ")}" title="${isCurrent ? "Current run" : "Previous run"}">
                <span class="gmm-comparison-k">k=${entry.components}${isCurrent ? " ●" : ""}</span>
                <div class="gmm-comparison-bar" title="AIC ${formatComparisonNumber(entry.aic)}">
                    <div class="gmm-comparison-bar-fill" style="width: ${aicFill.toFixed(1)}%"></div>
                    <span class="gmm-comparison-bar-value">${formatComparisonNumber(entry.aic)}</span>
                </div>
                <div class="gmm-comparison-bar" title="BIC ${formatComparisonNumber(entry.bic)}">
                    <div class="gmm-comparison-bar-fill" style="width: ${bicFill.toFixed(1)}%"></div>
                    <span class="gmm-comparison-bar-value">${formatComparisonNumber(entry.bic)}</span>
                </div>
                <span class="gmm-comparison-badge" title="${isBestBic ? "Best BIC overall" : (isBestAic ? "Best AIC overall" : "")}">${badge}</span>
            </div>
        `;
    }).join("");

    let agreement = bestAicK === bestBicK
        ? `<span><strong>Agreed:</strong> k=${bestBicK} wins on both</span>`
        : `<span>AIC prefers <strong>k=${bestAicK}</strong>, BIC prefers <strong>k=${bestBicK}</strong></span>`;

    return `
        <div class="gmm-comparison-table" role="table" aria-label="GMM model comparison">
            <div class="gmm-comparison-header" role="row">
                <span>Run</span>
                <span>AIC ↓</span>
                <span>BIC ↓</span>
                <span></span>
            </div>
            ${rows}
            <div class="gmm-comparison-verdict">${agreement}</div>
        </div>
    `;
}

function formatComparisonNumber(value){
    if(!Number.isFinite(value)) return "n/d";
    let abs = Math.abs(value);
    if(abs >= 10000) return value.toFixed(0);
    if(abs >= 100) return value.toFixed(0);
    return value.toFixed(1);
}

function renderMetricCard(metric, extraClass = ""){
    let indicator = `<span class="metric-dot" aria-label="${escapeAttr(metric.title)}"></span>`;
    let bar = "";

    // Gauge bars are used only by metrics with an interpretable [0,1] range.
    if(typeof metric.bar === "number"){
        let pct = metric.barInvert ? (1 - metric.bar) * 100 : metric.bar * 100;
        bar = `<div class="metric-bar"><div class="metric-bar-fill" style="width: ${pct.toFixed(1)}%"></div></div>`;
    }

    let hint = metric.title ? `<p class="metric-hint">${escapeHtml(metric.title)}</p>` : "";

    return `
        <div class="metric-item quality-${metric.quality} ${extraClass}" title="${escapeAttr(metric.title)}">
            <span class="metric-name">${escapeHtml(metric.name)}</span>
            <span class="metric-value">${escapeHtml(metric.value)}</span>
            ${indicator}
            ${bar}
            ${hint}
        </div>
    `;
}

function escapeAttr(text){
    return String(text || "").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Sparkline sotto le metriche: traccia il valore "convergente" passo per passo.
// La serie viene calcolata in metrics.js — qui ci si limita al disegno.
function updateConvergenceChart(){
    let wrap = DOM("convergenceWrap");
    if(!wrap) return;

    let series = state.hasSteps()
        ? Metrics.convergenceSeries(state.mode, state.currentSteps)
        : null;

    if(!series){
        wrap.classList.add("hidden");
        return;
    }

    wrap.classList.remove("hidden");
    DOMsetValue("convergenceLabel", `${series.label} - ${series.values.length} steps`);

    let first = series.values[0];
    let last = series.values[series.values.length - 1];
    DOMsetValue("convergenceRange", `${formatSpark(first)} → ${formatSpark(last)}`);

    drawSparkline(DOM("convergenceCanvas"), series);
}

function formatSpark(value){
    if(!Number.isFinite(value)) return "n/d";
    let abs = Math.abs(value);
    if(abs >= 1000) return value.toFixed(0);
    if(abs >= 10) return value.toFixed(1);
    return value.toFixed(2);
}

function drawSparkline(canvas, series){
    let ctx = canvas.getContext("2d");
    let dpr = window.devicePixelRatio || 1;
    let cssWidth = canvas.clientWidth || canvas.width;
    let cssHeight = canvas.clientHeight || canvas.height;

    if(canvas.width !== cssWidth * dpr || canvas.height !== cssHeight * dpr){
        canvas.width = cssWidth * dpr;
        canvas.height = cssHeight * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    let values = series.values;
    let min = Math.min(...values);
    let max = Math.max(...values);
    let range = max - min || 1;
    let pad = 4;
    let plotW = cssWidth - pad * 2;
    let plotH = cssHeight - pad * 2;

    let pointAt = (i) => ({
        x: pad + (values.length === 1 ? 0 : (i / (values.length - 1)) * plotW),
        y: pad + (1 - (values[i] - min) / range) * plotH
    });

    // Area sotto la curva, sfumata.
    let accent = isDarkTheme() ? "#4f8cff" : "#1769e0";
    let last = pointAt(values.length - 1);
    let first = pointAt(0);

    ctx.beginPath();
    ctx.moveTo(first.x, cssHeight - pad);
    for(let i = 0; i < values.length; i++){
        let p = pointAt(i);
        ctx.lineTo(p.x, p.y);
    }
    ctx.lineTo(last.x, cssHeight - pad);
    ctx.closePath();
    let grad = ctx.createLinearGradient(0, pad, 0, cssHeight - pad);
    grad.addColorStop(0, hexToRgba(accent, 0.28));
    grad.addColorStop(1, hexToRgba(accent, 0));
    ctx.fillStyle = grad;
    ctx.fill();

    // Linea principale
    ctx.beginPath();
    for(let i = 0; i < values.length; i++){
        let p = pointAt(i);
        if(i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
    }
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.stroke();

    // Dot finale per evidenziare l'ultimo valore.
    ctx.beginPath();
    ctx.arc(last.x, last.y, 3, 0, 2 * Math.PI, false);
    ctx.fillStyle = accent;
    ctx.fill();
}

function isDarkTheme(){
    return document.documentElement.dataset.theme === "dark";
}

function hexToRgba(hex, alpha){
    let raw = hex.replace("#", "");
    let r = parseInt(raw.slice(0, 2), 16);
    let g = parseInt(raw.slice(2, 4), 16);
    let b = parseInt(raw.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function updateQualityLegend(){
    let legend = DOM("qualityLegend");
    if(!legend) return;

    if(state.mode === "gmm"){
        legend.innerHTML = `
            <span><i class="good-dot"></i> good</span>
            <span><i class="medium-dot"></i> mixed</span>
            <span><i class="bad-dot"></i> weak</span>
            <span><i class="neutral-dot"></i> needs comparison</span>
        `;
        return;
    }

    legend.innerHTML = `
        <span><i class="good-dot"></i> green good</span>
        <span><i class="medium-dot"></i> yellow medium</span>
        <span><i class="bad-dot"></i> red weak</span>
    `;
}

// I runX leggono controlli, lanciano l'algoritmo, mettono in state {result, steps}.
// In modalita' step rivelano lo step successivo, altrimenti il risultato finale.

function runKMeans(isStep){
    if(!checkData()) return;
    if(!safeRun("kmeans")) return;

    if(kmeans.init_centroid.length === 0){
        window.alert("Generate centroids first to run K-Means.");
        setStatus("Generate centroids first");
        return;
    }

    if(isStep && state.hasSteps()){
        showNextStep();
        return;
    }

    let result = kmeans.run(state.data);
    state.setSteps(result.steps);

    if(isStep){
        showNextStep();
    }else{
        state.setResult(result);
        setStatus(`K-Means completed in ${result.iterations} iterations`);
        render();
    }
}

function runDBSCAN(isStep){
    if(!checkData()) return;
    if(!safeRun("dbscan")) return;

    let eps = readPositiveFloat("dbscanEpsilon", "Invalid epsilon");
    let minPts = readPositiveInt("dbscanMinPts", "Invalid MinPTS");
    if(!eps || !minPts) return;

    if(isStep && state.hasSteps()){
        showNextStep();
        return;
    }

    let result = dbscan.run(state.data, eps, minPts);
    state.setSteps(result.steps);

    if(isStep){
        showNextStep();
    }else{
        state.setResult(result);
        setStatus(`DBSCAN: ${result.clusters.length} clusters`);
        render();
    }
}

function runSpectral(isStep){
    if(!checkData()) return;
    if(!safeRun("spectral")) return;

    let k = readPositiveInt("spectralK", "Invalid Spectral K");
    let sigma = readPositiveFloat("spectralSigma", "Invalid Spectral sigma");
    let laplacianType = getSpectralLaplacianType();
    if(!k || !sigma) return;

    if(k > state.data.length){
        setStatus("Spectral: K cannot exceed the number of points");
        return;
    }

    if(isStep && state.hasSteps()){
        showNextStep();
        return;
    }

    let result = spectral.run(state.data, k, sigma, laplacianType);
    state.setSteps(result.steps);

    if(isStep){
        showNextStep();
    }else{
        state.setResult(result);
        setStatus(`Spectral (${getSpectralLaplacianInfo().shortLabel}): ${result.clusters.length} clusters`);
        render();
    }
}

function runFuzzy(isStep){
    if(!checkData()) return;
    if(!safeRun("fuzzy")) return;

    let k = readPositiveInt("fuzzyClusters", "Invalid Fuzzy clusters");
    let m = readPositiveFloat("fuzzyM", "Invalid fuzziness");
    let iterations = readPositiveInt("fuzzyIterations", "Invalid Fuzzy iterations");
    if(!k || !m || !iterations) return;

    if(k > state.data.length){
        setStatus("Fuzzy: clusters cannot exceed the number of points");
        return;
    }
    if(m <= 1){
        setStatus("Fuzzy: fuzziness must be greater than 1");
        return;
    }

    if(isStep && state.hasSteps()){
        showNextStep();
        return;
    }

    let result = fuzzy.run(state.data, k, m, iterations);
    state.setSteps(result.steps);

    if(isStep){
        showNextStep();
    }else{
        state.setResult(result);
        setStatus(`Fuzzy C-Means completed in ${result.iterations} iterations`);
        render();
    }
}

function runMeanShift(isStep){
    if(!checkData()) return;
    if(!safeRun("meanshift")) return;

    let bandwidth = readPositiveFloat("meanShiftBandwidth", "Invalid bandwidth");
    let iterations = readPositiveInt("meanShiftIterations", "Invalid Mean Shift iterations");
    if(!bandwidth || !iterations) return;

    if(isStep && state.hasSteps()){
        showNextStep();
        return;
    }

    let result = meanShift.run(state.data, bandwidth, iterations);
    state.setSteps(result.steps);

    if(isStep){
        showNextStep();
    }else{
        state.setResult(result);
        setStatus(`Mean Shift: ${result.modes.length} modes found`);
        render();
    }
}

function runGMM(isStep){
    if(!checkData()) return;
    if(!safeRun("gmm")) return;

    let k = readPositiveInt("gmmComponents", "Invalid GMM components");
    let iterations = readPositiveInt("gmmIterations", "Invalid GMM iterations");
    if(!k || !iterations) return;

    if(k > state.data.length){
        setStatus("GMM: components cannot exceed the number of points");
        return;
    }

    if(isStep && state.hasSteps()){
        showNextStep();
        return;
    }

    let result = gmm.run(state.data, k, iterations);
    rememberGMMComparison(k, result);
    state.setSteps(result.steps);

    if(isStep){
        showNextStep();
    }else{
        state.setResult(result);
        setStatus(`GMM completed in ${result.iterations} iterations`);
        render();
    }
}

function rememberGMMComparison(componentCount, result){
    let datasetKey = state.data
        .map((point) => `${point.x.toFixed(3)},${point.y.toFixed(3)}`)
        .join("|");

    if(datasetKey !== gmmComparisonDatasetKey){
        gmmComparisonDatasetKey = datasetKey;
        gmmModelComparisons = [];
    }

    let logLikelihood = Number.isFinite(result.logLikelihood) ? result.logLikelihood : 0;
    let parameterCount = Math.max(1, componentCount * 6 - 1);
    let pointCount = Math.max(1, state.data.length);
    let entry = {
        components: componentCount,
        aic: 2 * parameterCount - 2 * logLikelihood,
        bic: Math.log(pointCount) * parameterCount - 2 * logLikelihood
    };
    let existingIndex = gmmModelComparisons.findIndex((candidate) => candidate.components === componentCount);

    if(existingIndex === -1){
        gmmModelComparisons.push(entry);
    }else{
        gmmModelComparisons[existingIndex] = entry;
    }
}

function runHDBSCAN(isStep){
    if(!checkData()) return;
    if(!safeRun("hdbscan")) return;

    let minPts = readPositiveInt("hdbscanMinPts", "Invalid HDBSCAN MinPTS");
    let minClusterSize = readPositiveInt("hdbscanMinClusterSize", "Invalid min cluster size");
    if(!minPts || !minClusterSize) return;

    if(isStep && state.hasSteps()){
        showNextStep();
        return;
    }

    let result = hdbscan.run(state.data, minPts, minClusterSize);
    state.setSteps(result.steps);

    if(isStep){
        showNextStep();
    }else{
        state.setResult(result);
        setStatus(`HDBSCAN: ${result.clusters.length} clusters, ${result.noise.length} noise`);
        render();
    }
}

function runHCluster(isStep){
    if(!checkData()) return;
    if(!safeRun("hcluster")) return;

    if(isStep && state.hasSteps()){
        showNextStep();
        return;
    }

    let linkage = DOMgetValue("hclusterCriterion");
    let metric = DOMgetValue("hclusterMetric");
    let result = hcluster.run(state.data, linkage, metric);
    state.setSteps(result.steps);

    if(isStep){
        showNextStep();
    }else{
        state.setResult(result);
        setStatus(`HCluster completed in ${result.iterations} iterations`);
        render();
    }
}

// Registry: ogni modalita' abbina algoritmo + renderer + come leggere le
// opzioni dal pannello. Il render() chiama draw() senza sapere chi c'e' sotto.
function createModeStrategies(){
    return {
        kmeans: {
            run: runKMeans,
            draw: () => kmeansRenderer.draw(state.data, {
                result: state.currentResult,
                initCentroids: kmeans.init_centroid,
                showBoundaries: DOM("showBoundaries").checked,
                showDetails: DOM("showDetails").checked
            })
        },
        dbscan: {
            run: runDBSCAN,
            draw: () => dbscanRenderer.draw(state.data, {
                result: state.currentResult,
                showEpsilon: DOM("dbscanDrawEps").checked,
                showBoundaries: DOM("showBoundaries").checked,
                showDetails: DOM("showDetails").checked
            })
        },
        spectral: {
            run: runSpectral,
            draw: () => spectralRenderer.draw(state.data, {
                result: state.currentResult,
                showBoundaries: DOM("showBoundaries").checked,
                showDetails: DOM("showDetails").checked
            })
        },
        fuzzy: {
            run: runFuzzy,
            draw: () => fuzzyRenderer.draw(state.data, {
                result: state.currentResult,
                showBoundaries: DOM("showBoundaries").checked,
                showDetails: DOM("showDetails").checked
            })
        },
        meanshift: {
            run: runMeanShift,
            draw: () => meanShiftRenderer.draw(state.data, {
                result: state.currentResult,
                showDensity: DOM("meanShiftDensityMap").checked,
                showTrails: DOM("showTrails").checked,
                showDetails: DOM("showDetails").checked
            })
        },
        gmm: {
            run: runGMM,
            draw: () => gmmRenderer.draw(state.data, {
                result: state.currentResult,
                showBoundaries: DOM("showBoundaries").checked
            })
        },
        hdbscan: {
            run: runHDBSCAN,
            draw: () => hdbscanRenderer.draw(state.data, {
                result: state.currentResult,
                showBoundaries: DOM("showBoundaries").checked
            })
        },
        hcluster: {
            run: runHCluster,
            draw: () => hclusterRenderer.draw(state.data, {
                result: state.currentResult
            })
        }
    };
}

function showNextStep(){
    let step = state.advanceStep();
    if(!step){
        setStatus("Steps completed");
        return;
    }
    let label = step.phaseLabel ? `: ${step.phaseLabel}` : "";
    setStatus(`Step ${state.stepIndex}/${state.currentSteps.length}${label}`);
    render();
}

function render(){
    DOMsetValue("pointCounter", `Points: ${state.data.length}`);
    updateLegend();
    modeStrategies[state.mode].draw();
    updatePreviews();
}

// Mini-anteprime sempre visibili in sidebar: heatmap affinity per Spectral,
// dendrogramma compatto per HCluster. Spariscono quando non c'e' un risultato.
function updatePreviews(){
    let spectralWrap = DOM("spectralPreviewWrap");
    if(spectralWrap){
        if(state.mode === "spectral" && state.currentResult && state.currentResult.affinity){
            spectralWrap.classList.remove("hidden");
            drawAffinityHeatmap(DOM("spectralPreview"), state.currentResult);
        }else{
            spectralWrap.classList.add("hidden");
        }
    }

    // Il dendrogramma di HCluster ora cresce direttamente sul canvas principale
    // (HClusterRenderer._drawTree) animato a ogni merge: niente preview sidebar.
}

// Heatmap NxN della matrice di affinity. Ogni cella e' una "celletta" colorata
// in base al peso (0 = trasparente, 1 = accent). N cresce con il dataset, ma
// l'algoritmo Spectral e' gia' cap a 180 punti quindi la heatmap rimane sotto controllo.
function drawAffinityHeatmap(canvas, result){
    let ctx = canvas.getContext("2d");
    let dpr = window.devicePixelRatio || 1;
    let cssSize = Math.max(canvas.clientWidth, 180);

    if(canvas.width !== cssSize * dpr){
        canvas.width = cssSize * dpr;
        canvas.height = cssSize * dpr;
    }
    canvas.style.height = `${cssSize}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let affinity = result.affinity;
    let n = affinity.length;
    if(n === 0) return;

    let cell = cssSize / n;
    let dark = isDarkTheme();
    let bg = dark ? "#0f1729" : "#ffffff";
    let accent = dark ? [79, 140, 255] : [23, 105, 224];

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, cssSize, cssSize);

    for(let i = 0; i < n; i++){
        for(let j = 0; j < n; j++){
            let weight = affinity[i][j] || 0;
            if(weight < 0.02) continue;
            let alpha = Math.min(1, weight);
            ctx.fillStyle = `rgba(${accent[0]}, ${accent[1]}, ${accent[2]}, ${alpha})`;
            ctx.fillRect(j * cell, i * cell, Math.max(1, cell), Math.max(1, cell));
        }
    }

    // Cornice sottile per dare il senso di "matrice".
    ctx.strokeStyle = dark ? "rgba(148,163,184,0.30)" : "rgba(148,163,184,0.50)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, cssSize - 1, cssSize - 1);
}

function clearResult(){
    stopAutoplay(false);
    state.clearResult();
    updateMetrics();
}

function checkData(){
    if(state.data.length === 0){
        setStatus("Add some points first");
        return false;
    }
    return true;
}

function readPositiveInt(id, errorMessage){
    let value = parseInt(DOMgetValue(id));
    if(!Number.isInteger(value) || value <= 0){
        setStatus(errorMessage);
        return null;
    }
    return value;
}

function readPositiveFloat(id, errorMessage){
    let value = parseFloat(DOMgetValue(id));
    if(!Number.isFinite(value) || value <= 0){
        setStatus(errorMessage);
        return null;
    }
    return value;
}

function setStatus(message){
    DOMsetValue("statusText", message);
    updateMetrics();
}

// Limiti scelti in base alla complessità di ogni algoritmo sul main thread:
// K-Means    O(n·k·iter)   — lineare su n, regge bene fino a migliaia di punti
// DBSCAN     O(n²)         — matrice distanze naive, rallenta oltre ~800
// Spectral   O(n³)         — eigendecomposizione power-iteration, freeza oltre ~180
// Fuzzy      O(n·k·iter)   — simile a K-Means, tolera fino a ~1500
// Mean Shift O(n²·iter)    — kernel density su tutti i punti a ogni step, lento oltre ~500
// GMM        O(n·k·iter)   — E-step lineare su n, regge fino a ~1500
// HDBSCAN    O(n²)         — costruzione MST + sorting di tutti i threshold, lento oltre ~260
// HCluster   O(n³) + O(n²) mem — tutti gli n-1 merge in memoria per il dendrogramma, limite severo a 30
function safeRun(algorithm){
    const maxLength = {
        "kmeans": 2000,
        "dbscan": 800,
        "spectral": 180,
        "fuzzy": 1500,
        "meanshift": 500,
        "gmm": 1500,
        "hdbscan": 260,
        "hcluster": 30
    };

    const diagnosticMessages = {
        "kmeans": "K-Means can be slow with more than 2000 points. Please reduce the dataset before running it.",
        "dbscan": "DBSCAN can be slow with more than 800 points. Please reduce the dataset before running it.",
        "spectral": "Spectral can be slow with more than 180 points. Please reduce the dataset before running it.",
        "fuzzy": "Fuzzy C-Means can be slow with more than 1500 points. Please reduce the dataset before running it.",
        "meanshift": "Mean Shift can be slow with more than 500 points. Please reduce the dataset before running it.",
        "gmm": "GMM can be slow with more than 1500 points. Please reduce the dataset before running it.",
        "hdbscan": "HDBSCAN can be slow with more than 260 points. Please reduce the dataset before running it.",
        "hcluster": "Hierarchical clustering can be messy with more than 30 points. Please reduce the dataset before running it."
    };

    if(state.safeMode && state.data.length > maxLength[algorithm]){
        window.alert(diagnosticMessages[algorithm]);
        setStatus(diagnosticMessages[algorithm]);
        return false;
    }
    return true;
}

document.addEventListener("DOMContentLoaded", () => {
    startApp();
});
