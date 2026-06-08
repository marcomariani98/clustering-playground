"use strict";

// Smoke test for the clustering playground. Just catching the obvious breaks:
// does run() throw? Does it return {steps}? Do metrics crash on the result?
// Not checking if the clustering is *correct*, just that the refactored code
// doesn't have holes.
//
// Runs in the browser with zero dependencies, same as the rest of the project.
// No Node, no Playwright, no npm install. Open smoke.html in a browser (even
// file:// works). Green = all's good. Red = something broke after a refactor.

(function(){
    let passed = 0;
    let failed = 0;
    let lines = [];

    function log(msg, cls){
        lines.push({ msg: msg, cls: cls || "" });
        console.log(msg);
    }

    function test(name, fn){
        try{
            fn();
            passed++;
            log(`PASS  ${name}`, "pass");
        }catch(err){
            failed++;
            log(`FAIL  ${name}  ->  ${err.message}`, "fail");
        }
    }

    function assert(condition, message){
        if(!condition) throw new Error(message);
    }

    // The contract: algorithms expose run(...) returning { result, steps }
    // where steps is a non-empty array of intermediate snapshots.
    function assertRunContract(result){
        assert(result && typeof result === "object", "result is not an object");
        assert(Array.isArray(result.steps), "result.steps is not an array");
        assert(result.steps.length >= 1, "result.steps is empty");
    }

    // Stub canvas: algorithms don't draw in run(), only read width/height.
    // K-Means uses this to generate random initial centroids.
    const stubCanvas = { width: 800, height: 600 };

    // Random dataset: 3 Gaussian clusters plus noise. Different each time,
    // by design, so the smoke test has to work on varied inputs.
    function dataset(totalPoints){
        return generateRandomClusters(3, totalPoints, 35, 5, stubCanvas.width, stubCanvas.height);
    }

    // One test case per algorithm. Point counts stay below safeMode caps
    // (see main.js > safeRun) so the main thread doesn't block.
    const cases = [
        { mode: "kmeans", run: () => {
            let data = dataset(150);
            let km = new kMeans(stubCanvas);
            km.forgyCentroids(data, 3);  // run() requires init_centroid to be set
            return { data: data, result: km.run(data) };
        }},
        { mode: "dbscan", run: () => {
            let data = dataset(150);
            return { data: data, result: new DBSCAN(stubCanvas).run(data, 40, 4) };
        }},
        { mode: "spectral", run: () => {
            let data = dataset(120);  // cap is 180 (O(n³) eigendecomposition)
            return { data: data, result: new SpectralClustering(stubCanvas).run(data, 3, 40, "symmetric") };
        }},
        { mode: "fuzzy", run: () => {
            let data = dataset(150);
            return { data: data, result: new FuzzyCMeans(stubCanvas).run(data, 3, 2, 20) };
        }},
        { mode: "meanshift", run: () => {
            let data = dataset(120);  // slow at O(n² · iterations), but 120 is safe
            return { data: data, result: new MeanShift(stubCanvas).run(data, 60, 20) };
        }},
        { mode: "gmm", run: () => {
            let data = dataset(150);
            return { data: data, result: new GMM(stubCanvas).run(data, 3, 30) };
        }},
        { mode: "hdbscan", run: () => {
            let data = dataset(120);  // cap is 260 (MST + sorting overhead)
            return { data: data, result: new HDBSCAN(stubCanvas).run(data, 4, 5) };
        }},
        { mode: "hcluster", run: () => {
            let data = dataset(24);  // cap is 30 (O(n³) + O(n²) memory for dendrogram)
            return { data: data, result: new HCluster(stubCanvas).run(data, "average", "euclidean") };
        }}
    ];

    log("=== Clustering Playground — smoke test ===", "head");

    for(let c of cases){
        let ctx = null;

        test(`${c.mode}: run() returns { result, steps }`, () => {
            ctx = c.run();
            assertRunContract(ctx.result);
        });

        // If the run succeeded, try running metrics on the same result.
        // This catches if metrics crash on an algorithm's output.
        if(ctx && ctx.result){
            test(`${c.mode}: Metrics.computeMetrics doesn't crash`, () => {
                let metrics = Metrics.computeMetrics(c.mode, {
                    data: ctx.data,
                    result: ctx.result,
                    steps: ctx.result.steps,
                    canvasSize: Math.min(stubCanvas.width, stubCanvas.height),
                    modelComparisons: []
                });
                assert(Array.isArray(metrics), "computeMetrics returned non-array");
            });

            test(`${c.mode}: Metrics.convergenceSeries doesn't crash`, () => {
                let series = Metrics.convergenceSeries(c.mode, ctx.result.steps);
                assert(!series || Array.isArray(series.values),
                    "convergenceSeries should be null or {values: []}");
            });
        }
    }

    log(`\n=== ${passed} passed, ${failed} failed ===`, failed ? "fail" : "pass");

    // Render results on the page if opened in a browser.
    let out = document.getElementById("out");
    if(out){
        out.innerHTML = lines
            .map((l) => `<div class="${l.cls}">${l.msg.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</div>`)
            .join("");
    }
    let summary = document.getElementById("summary");
    if(summary){
        summary.textContent = failed ? `${failed} FAILED` : `ALL ${passed} PASSED`;
        summary.className = failed ? "fail" : "pass";
    }
})();
