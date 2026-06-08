"use strict";

// Main controller: orchestrates the entire playground lifecycle.
// Responsibilities:
// - Initialize and wire together state, canvas, algorithms, and renderers
// - Bind DOM events and manage user interactions
// - Coordinate the Play/Step/Execute/Back flow
// - Delegate to the appropriate algorithm and renderer via modeStrategies
//
// Architecture: Session state lives entirely in AppState (src/core/state.js).
// View rendering (metrics, charts, pseudocode, legend) is delegated to src/ui/ modules.
// This file stays focused on event orchestration and control flow.

let state;              // Current session state (AppState instance)
let primitives;         // Canvas handler and drawing primitives

// Mode strategies: one entry per clustering algorithm. Each entry is a pair:
// { run: function, draw: function }
// where run() is invoked by Play/Step/Execute buttons and returns {result, steps},
// and draw() is called during render() to display the current state.
let modeStrategies;

let kmeans, spectral, fuzzy, meanShift, gmm, dbscan, hdbscan, hcluster;
let kmeansRenderer, spectralRenderer, fuzzyRenderer, meanShiftRenderer;
let gmmRenderer, dbscanRenderer, hdbscanRenderer, hclusterRenderer;

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

// Light/dark theme toggle. Persisted to localStorage and read on startup.
// The theme button updates the icon (sun/moon) and redraws the canvas because
// several ink colors (legend, grid, text) are theme-dependent.
const THEME_STORAGE_KEY = "clusteringPlayground.theme";

// Initialize the theme on app startup. Reads from localStorage; defaults to light mode.
// Sets the data-theme attribute on <html> so CSS can respond with var(--ink-color), etc.
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
    DOM("stepBackAlgorithm").addEventListener("click", () => {
        stopAutoplay();
        showPrevStep();
    });
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

// updateComplexityBadge() vive in src/ui/legend.js

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

// getLegendItems() e updateLegend() vivono in src/ui/legend.js

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

// getPseudocode(), highlightPseudocode() e updatePseudocode() vivono in
// src/ui/pseudocode.js; escapeHtml() in src/ui/view-helpers.js.

// updateMetrics(), renderGMMMetrics(), renderGMMComparisonTable(),
// formatComparisonNumber() e renderMetricCard() vivono in src/ui/metrics-view.js;
// escapeAttr() in src/ui/view-helpers.js.

// updateConvergenceChart(), formatSpark() e drawSparkline() vivono in
// src/ui/charts.js; isDarkTheme() e hexToRgba() in src/ui/view-helpers.js;
// updateQualityLegend() in src/ui/legend.js.

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

    if(datasetKey !== state.gmmComparisonDatasetKey){
        state.gmmComparisonDatasetKey = datasetKey;
        state.gmmModelComparisons = [];
    }

    let logLikelihood = Number.isFinite(result.logLikelihood) ? result.logLikelihood : 0;
    let parameterCount = Math.max(1, componentCount * 6 - 1);
    let pointCount = Math.max(1, state.data.length);
    let entry = {
        components: componentCount,
        aic: 2 * parameterCount - 2 * logLikelihood,
        bic: Math.log(pointCount) * parameterCount - 2 * logLikelihood
    };
    let existingIndex = state.gmmModelComparisons.findIndex((candidate) => candidate.components === componentCount);

    if(existingIndex === -1){
        state.gmmModelComparisons.push(entry);
    }else{
        state.gmmModelComparisons[existingIndex] = entry;
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

// Speculare a showNextStep: nessun ricalcolo, solo riposizionamento sull'array
// di step gia' in memoria. Serve aver gia' generato gli step (Step/Play/Execute).
function showPrevStep(){
    if(!state.hasSteps()){
        setStatus("Run the algorithm first to step through it");
        return;
    }
    let step = state.retreatStep();
    if(!step){
        setStatus("Already at the first step");
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

// updatePreviews() e drawAffinityHeatmap() vivono in src/ui/charts.js

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
