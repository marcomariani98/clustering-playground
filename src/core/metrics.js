"use strict";

// Numeri di qualità per ogni algoritmo. Tutto qui dentro è pure: niente DOM,
// niente canvas, solo math su quello che gli algoritmi hanno gia' calcolato.
// L'ingresso e' computeMetrics(mode, ctx); il resto sono funzioni interne.

const Metrics = (function(){

    function computeMetrics(mode, ctx){
        let { data, result, steps, canvasSize, modelComparisons } = ctx;

        if(mode === "kmeans"){
            let clusters = getPointClusters(result);
            let silhouette = silhouetteScore(clusters);
            let inertia = inertiaScore(result);
            let avgRadius = Math.sqrt(inertia / Math.max(1, data.length));
            let db = daviesBouldin(clusters, result.centroids);

            return [
                metric("Silhouette", formatNumber(silhouette), qualityHigh(silhouette, 0.65, 0.35), {
                    bar: silhouetteToBar(silhouette),
                    hint: "Cohesion vs separation. Range [-1, 1], >0.5 is good."
                }),
                metric("Davies-Bouldin", formatNumber(db), qualityLow(db, 0.7, 1.4), {
                    bar: dbToBar(db),
                    hint: "Avg ratio of intra-cluster spread to inter-cluster distance. Lower is better."
                }),
                metric("Inertia sqrt/n", formatNumber(avgRadius), qualityLow(avgRadius, 0.08, 0.16, canvasSize), {
                    hint: "Average distance to centroid (pixels)."
                })
            ];
        }

        if(mode === "spectral"){
            let clusters = getPointClusters(result);
            let silhouette = silhouetteScore(clusters);
            let purity = neighborhoodPurity(clusters);
            let centroids = clusters.map((c) => avgPoint(c));
            let db = daviesBouldin(clusters, centroids);

            return [
                metric("Silhouette", formatNumber(silhouette), qualityHigh(silhouette, 0.65, 0.35), {
                    bar: silhouetteToBar(silhouette),
                    hint: "Cohesion vs separation in original space. Range [-1, 1]."
                }),
                metric("Neighborhood purity", formatNumber(purity), qualityHigh(purity, 0.80, 0.55), {
                    bar: purity,
                    hint: "Fraction of k-NN that share the same cluster. Range [0, 1]."
                }),
                metric("Davies-Bouldin", formatNumber(db), qualityLow(db, 0.7, 1.4), {
                    bar: dbToBar(db),
                    hint: "Lower means tighter, well-separated clusters."
                })
            ];
        }

        if(mode === "fuzzy"){
            let fpc = fuzzyPartitionCoefficient(result.memberships);
            let entropy = fuzzyEntropy(result.memberships);
            let clusters = getPointClusters(result);
            let db = daviesBouldin(clusters, result.centroids);

            return [
                metric("FPC", formatNumber(fpc), qualityHigh(fpc, 0.75, 0.55), {
                    bar: fpc,
                    hint: "Fuzzy Partition Coefficient. 1 = crisp, 1/k = fully fuzzy."
                }),
                metric("Entropy", formatNumber(entropy), qualityLow(entropy, 0.35, 0.65), {
                    bar: entropy,
                    hint: "Normalized membership entropy. Lower = more decisive."
                }),
                metric("Davies-Bouldin", formatNumber(db), qualityLow(db, 0.7, 1.4), {
                    bar: dbToBar(db),
                    hint: "Computed on the hard-assigned partition."
                })
            ];
        }

        if(mode === "gmm"){
            let info = gmmInfo(result, data);
            let confidence = gmmConfidence(result, data);
            let comparison = gmmComparisonQuality(info, modelComparisons);

            return [
                metric("Mean confidence", `${formatNumber(confidence.mean * 100, 1)}%`, qualityHigh(confidence.mean, 0.82, 0.62), {
                    key: "confidence",
                    bar: confidence.mean,
                    hint: "Average posterior probability of the winning Gaussian. Higher means clearer assignments."
                }),
                metric("Uncertain points", `${confidence.uncertainCount} / ${data.length}`, qualityLow(confidence.uncertainRatio * 100, 10, 25), {
                    key: "uncertain",
                    bar: confidence.uncertainRatio,
                    barInvert: true,
                    hint: "Points whose best component has less than 60% probability. Lower is better."
                }),
                metric("Fit / point", formatNumber(info.avgLogLikelihood, 2), "neutral", {
                    key: "avgLikelihood",
                    hint: "Fit per point. Read its convergence curve or compare runs on the same dataset."
                }),
                metric("AIC", formatNumber(info.aic, 0), comparison.aic, {
                    key: "aic",
                    hint: comparison.hint
                        ? `${comparison.hint} AIC uses a moderate complexity penalty.`
                        : "Run GMM with another component count on these same points to compare AIC. Lower wins."
                }),
                metric("BIC", formatNumber(info.bic, 0), comparison.bic, {
                    key: "bic",
                    hint: comparison.hint
                        ? `${comparison.hint} BIC penalizes extra components more strongly as data grows.`
                        : "Run GMM with another component count on these same points to compare BIC. Lower wins."
                })
            ];
        }

        if(mode === "dbscan"){
            let noisePercent = noiseRatio(result, data) * 100;
            let purity = neighborhoodPurity(getPointClusters(result));
            let clusterCount = result.clusters ? result.clusters.length : 0;

            return [
                metric("Clusters", String(clusterCount), clusterCount > 0 ? "good" : "bad", {
                    hint: "Number of dense regions found above MinPTS."
                }),
                metric("Noise %", `${formatNumber(noisePercent, 1)}%`, qualityLow(noisePercent, 10, 30), {
                    bar: clamp(noisePercent / 100, 0, 1),
                    barInvert: true,
                    hint: "Fraction of points marked as noise (not dense)."
                }),
                metric("Neighborhood purity", formatNumber(purity), qualityHigh(purity, 0.80, 0.55), {
                    bar: purity,
                    hint: "How well k-NN agree with the assignment."
                })
            ];
        }

        if(mode === "hdbscan"){
            let noisePercent = noiseRatio(result, data) * 100;
            let stability = result.stability || 0;
            let normalized = stability / Math.max(1, data.length);
            let clusterCount = result.clusters ? result.clusters.length : 0;

            return [
                metric("Clusters", String(clusterCount), clusterCount > 0 ? "good" : "bad", {
                    hint: "Selected by the most stable cut of the condensed tree."
                }),
                metric("Stability", formatNumber(stability), qualityHigh(normalized, 0.03, 0.01), {
                    hint: "Simplified cluster lifetime score. Higher = picks survived longer thresholds."
                }),
                metric("Noise %", `${formatNumber(noisePercent, 1)}%`, qualityLow(noisePercent, 10, 30), {
                    bar: clamp(noisePercent / 100, 0, 1),
                    barInvert: true,
                    hint: "Points outside any minimum cluster."
                })
            ];
        }

        if(mode === "meanshift"){
            let n = Math.max(1, data.length);
            let weakRatio = (result.weakCount || 0) / n;
            let modeCount = result.modes ? result.modes.length : 0;
            let modeLimit = Math.max(2, Math.sqrt(n));
            let modeQuality = "good";

            if(weakRatio > 0.20 || modeCount > modeLimit * 2){
                modeQuality = "bad";
            }else if(weakRatio > 0.05 || modeCount > modeLimit){
                modeQuality = "medium";
            }

            // Silhouette sui cluster validi (almeno 3 punti, esclusi i micro-modi).
            let strongClusters = (result.clusters || []).filter((c) => c.length > 2);
            let silhouette = strongClusters.length >= 2 ? silhouetteScore(strongClusters) : NaN;

            return [
                metric("Modes", String(modeCount), modeQuality, {
                    hint: "Local density maxima. Rule of thumb: ~sqrt(n) is healthy."
                }),
                metric("Weak ratio", `${formatNumber(weakRatio * 100, 1)}%`, qualityLow(weakRatio * 100, 5, 20), {
                    bar: clamp(weakRatio, 0, 1),
                    barInvert: true,
                    hint: "Points stuck in micro-modes (cluster size <= 2). Lower is cleaner."
                }),
                metric("Silhouette", formatNumber(silhouette), qualityHigh(silhouette, 0.65, 0.35), {
                    bar: silhouetteToBar(silhouette),
                    hint: "Computed on strong clusters only (size > 2)."
                })
            ];
        }

        // hcluster
        let hClusters = hclusterCut(steps, result, data);
        let cophenetic = copheneticCorrelation(result, data);
        let silhouette = silhouetteScore(hClusters);
        let centroids = hClusters.map((c) => avgPoint(c));
        let db = daviesBouldin(hClusters, centroids);

        return [
            metric("Cophenetic", formatNumber(cophenetic), qualityHigh(cophenetic, 0.75, 0.50), {
                bar: clamp((cophenetic + 1) / 2, 0, 1),
                hint: "How faithfully the tree preserves original pairwise distances. Range [-1, 1]."
            }),
            metric("Silhouette", formatNumber(silhouette), qualityHigh(silhouette, 0.65, 0.35), {
                bar: silhouetteToBar(silhouette),
                hint: "Computed on a sqrt(n)-cluster cut of the dendrogram."
            }),
            metric("Davies-Bouldin", formatNumber(db), qualityLow(db, 0.7, 1.4), {
                bar: dbToBar(db),
                hint: "Spread vs separation on the same cut. Lower is better."
            })
        ];
    }

    // metric(name, value, quality, options). options puo' contenere:
    //   hint: tooltip esteso per la UI (descrive cosa significa la metrica)
    //   bar:  valore [0,1] per disegnare un gauge sotto la metrica
    //   barInvert: se true, la barra e' "invertita" (verde a sinistra).
    function metric(name, value, quality, options = {}){
        let titles = {
            good: "Very good",
            medium: "Medium",
            bad: "Weak",
            neutral: "Neutral",
            plain: "Reference value"
        };

        return {
            name: name,
            value: value,
            quality: quality,
            title: options.hint || titles[quality] || titles.neutral,
            bar: typeof options.bar === "number" && Number.isFinite(options.bar)
                ? clamp(options.bar, 0, 1)
                : null,
            barInvert: options.barInvert === true,
            key: options.key || ""
        };
    }

    // Davies-Bouldin: per ogni cluster, max ratio tra (spread_i + spread_j) e
    // distanza tra centroidi. La media e' il DB index. Lower is better.
    // Range tipico: 0.5-2.5 per dataset normali; valori >3 indicano partizione cattiva.
    function daviesBouldin(clusters, centroids){
        let valid = [];
        for(let i = 0; i < clusters.length; i++){
            if(!clusters[i] || clusters[i].length === 0 || !centroids[i]) continue;
            valid.push({ points: clusters[i], centroid: centroids[i] });
        }
        if(valid.length < 2) return NaN;

        let spreads = valid.map((c) => {
            let total = 0;
            for(let p of c.points){
                total += euclidianDistance(p, c.centroid);
            }
            return total / c.points.length;
        });

        let total = 0;
        for(let i = 0; i < valid.length; i++){
            let maxRatio = -Infinity;
            for(let j = 0; j < valid.length; j++){
                if(i === j) continue;
                let dCentroids = euclidianDistance(valid[i].centroid, valid[j].centroid);
                if(dCentroids <= 0) continue;
                let ratio = (spreads[i] + spreads[j]) / dCentroids;
                if(ratio > maxRatio) maxRatio = ratio;
            }
            if(Number.isFinite(maxRatio)) total += maxRatio;
        }

        return total / valid.length;
    }

    function avgPoint(points){
        if(!points || points.length === 0) return null;
        let x = 0, y = 0;
        for(let p of points){
            x += p.x;
            y += p.y;
        }
        return { x: x / points.length, y: y / points.length };
    }

    // Mappa silhouette [-1, 1] su [0, 1] per la gauge bar.
    function silhouetteToBar(s){
        return Number.isFinite(s) ? clamp((s + 1) / 2, 0, 1) : null;
    }

    // DB e' [0, inf), lower is better. Saturo a 3 per evitare barre microscopiche
    // su outlier, e inverto (1 = perfetto, 0 = pessimo).
    function dbToBar(db){
        if(!Number.isFinite(db)) return null;
        let saturated = clamp(db / 3, 0, 1);
        return 1 - saturated;
    }

    function formatNumber(value, digits = 2){
        if(!Number.isFinite(value)){
            return "n/d";
        }

        return value.toFixed(digits);
    }

    function qualityHigh(value, goodLimit, mediumLimit){
        if(!Number.isFinite(value)){
            return "neutral";
        }

        if(value >= goodLimit) return "good";
        if(value >= mediumLimit) return "medium";
        return "bad";
    }

    // qualityLow accetta canvasSize per le soglie K-Means che vivono in pixel.
    function qualityLow(value, goodLimit, mediumLimit, canvasSize){
        if(!Number.isFinite(value)){
            return "neutral";
        }

        if(canvasSize){
            goodLimit *= canvasSize;
            mediumLimit *= canvasSize;
        }

        if(value <= goodLimit) return "good";
        if(value <= mediumLimit) return "medium";
        return "bad";
    }

    function getPointClusters(result){
        if(!result || !result.clusters){
            return [];
        }

        return result.clusters
            .map((cluster) => cluster.points ? cluster.points : cluster)
            .filter((cluster) => cluster && cluster.length > 0);
    }

    // Silhouette classico: per ogni punto, b (distanza media dal cluster piu'
    // vicino diverso) meno a (distanza media nel proprio cluster), normalizzato.
    function silhouetteScore(clusters){
        let items = [];

        for(let [clusterIndex, cluster] of clusters.entries()){
            for(let point of cluster){
                items.push({ point, clusterIndex });
            }
        }

        let activeClusters = clusters.filter((cluster) => cluster.length > 0).length;
        if(items.length < 2 || activeClusters < 2){
            return 0;
        }

        let total = 0;

        for(let item of items){
            let ownCluster = clusters[item.clusterIndex];
            let a = avgDistanceToCluster(item.point, ownCluster, item.point);
            let b = Infinity;

            for(let [clusterIndex, cluster] of clusters.entries()){
                if(clusterIndex === item.clusterIndex || cluster.length === 0){
                    continue;
                }
                b = Math.min(b, avgDistanceToCluster(item.point, cluster, null));
            }

            if(!Number.isFinite(b)) b = 0;

            if(a === 0 && b === 0){
                total += 0;
            }else{
                total += (b - a) / Math.max(a, b);
            }
        }

        return total / items.length;
    }

    function avgDistanceToCluster(point, cluster, skipPoint){
        let total = 0;
        let count = 0;

        for(let other of cluster){
            if(other === skipPoint) continue;
            total += euclidianDistance(point, other);
            count++;
        }

        return count === 0 ? 0 : total / count;
    }

    function inertiaScore(result){
        let inertia = 0;

        for(let [i, cluster] of result.clusters.entries()){
            let points = cluster.points ? cluster.points : cluster;
            let centroid = result.centroids && result.centroids[i] ? result.centroids[i] : cluster.centroid;

            if(!centroid) continue;

            for(let point of points){
                let d = euclidianDistance(point, centroid);
                inertia += d * d;
            }
        }

        return inertia;
    }

    // Su quanti k-vicini un punto rimane nel suo stesso cluster. Quick proxy
    // per "coesione locale": utile per Spectral e DBSCAN dove inertia non ha senso.
    function neighborhoodPurity(clusters){
        let items = [];

        for(let [clusterIndex, cluster] of clusters.entries()){
            for(let point of cluster){
                items.push({ point, clusterIndex });
            }
        }

        if(items.length < 2) return 0;

        let k = Math.max(1, Math.min(items.length - 1, Math.round(Math.sqrt(items.length))));
        let purity = 0;

        for(let item of items){
            let neighbours = items
                .filter((other) => other !== item)
                .map((other) => ({
                    clusterIndex: other.clusterIndex,
                    distance: euclidianDistance(item.point, other.point)
                }))
                .sort((a, b) => a.distance - b.distance)
                .slice(0, k);

            let sameCluster = neighbours.filter((other) => other.clusterIndex === item.clusterIndex).length;
            purity += sameCluster / k;
        }

        return purity / items.length;
    }

    function fuzzyPartitionCoefficient(memberships){
        if(!memberships || memberships.length === 0) return 0;

        let total = 0;
        for(let row of memberships){
            for(let value of row){
                total += value * value;
            }
        }

        return total / memberships.length;
    }

    function fuzzyEntropy(memberships){
        if(!memberships || memberships.length === 0 || memberships[0].length <= 1) return 0;

        let total = 0;
        let norm = Math.log(memberships[0].length);

        for(let row of memberships){
            let rowEntropy = 0;
            for(let value of row){
                if(value > 0){
                    rowEntropy -= value * Math.log(value);
                }
            }
            total += rowEntropy / norm;
        }

        return total / memberships.length;
    }

    function gmmInfo(result, data){
        let k = result.components ? result.components.length : 1;
        let n = Math.max(1, data.length);
        // Ogni componente 2D: peso + 2 medie + 3 covarianza = 6. -1 per il vincolo dei pesi.
        let params = Math.max(1, k * 6 - 1);
        let logLikelihood = result.logLikelihood || 0;

        return {
            aic: 2 * params - 2 * logLikelihood,
            bic: Math.log(n) * params - 2 * logLikelihood,
            logLikelihood: logLikelihood,
            avgLogLikelihood: logLikelihood / n
        };
    }

    // Responsibilities describe how decisive GMM is after fitting the model.
    // Values near one belong clearly to one component; lower maxima reveal overlap.
    function gmmConfidence(result, data){
        let values = (result.confidence || []).filter((value) => Number.isFinite(value));
        let n = Math.max(1, data.length);

        if(values.length === 0){
            return { mean: 0, uncertainCount: 0, uncertainRatio: 0 };
        }

        let mean = values.reduce((sum, value) => sum + value, 0) / values.length;
        let uncertainCount = values.filter((value) => value < 0.60).length;

        return {
            mean: mean,
            uncertainCount: uncertainCount,
            uncertainRatio: uncertainCount / n
        };
    }

    // AIC and BIC do not have an absolute "good" value. They become readable
    // only after comparing models fitted to exactly the same point cloud.
    function gmmComparisonQuality(info, comparisons){
        if(!comparisons || comparisons.length < 2){
            return { aic: "neutral", bic: "neutral", hint: "" };
        }

        return {
            aic: rankLowerIsBetter(info.aic, comparisons.map((entry) => entry.aic)),
            bic: rankLowerIsBetter(info.bic, comparisons.map((entry) => entry.bic)),
            hint: `Compared across ${comparisons.length} component counts on this dataset.`
        };
    }

    function rankLowerIsBetter(current, values){
        let ranked = values.slice().sort((a, b) => a - b);
        let best = ranked[0];
        let worst = ranked[ranked.length - 1];

        if(Math.abs(current - best) < 0.000001){
            return "good";
        }

        if(Math.abs(current - worst) < 0.000001){
            return "bad";
        }

        return "medium";
    }

    function noiseRatio(result, data){
        let noise = result && result.noise ? result.noise.length : 0;
        return noise / Math.max(1, data.length);
    }

    // HCluster mostra l'intero albero negli step. Per calcolare la silhouette
    // serve un "cut": prendo lo step in cui il numero di cluster e' piu' vicino
    // a sqrt(n), che e' un'euristica decente per dataset piccoli.
    function hclusterCut(steps, currentResult, data){
        if(!steps || steps.length === 0){
            return currentResult && currentResult.currentClusters
                ? currentResult.currentClusters.map((cluster) => cluster.points)
                : [];
        }

        let target = Math.max(2, Math.round(Math.sqrt(Math.max(1, data.length))));
        let best = steps[0];
        let bestDistance = Infinity;

        for(let step of steps){
            if(!step.currentClusters) continue;

            let distance = Math.abs(step.currentClusters.length - target);
            if(distance < bestDistance){
                best = step;
                bestDistance = distance;
            }
        }

        return best.currentClusters.map((cluster) => cluster.points);
    }

    // Cophenetic correlation: confronta distanze originali tra coppie con la
    // distanza alla quale sono state fuse nell'albero. Alta = albero fedele.
    function copheneticCorrelation(result, data){
        if(!result || !result.allClusters || data.length < 3) return 0;

        let pairValues = [];
        let cophenetic = {};
        let allClusters = result.allClusters
            .filter((cluster) => cluster.tree && cluster.tree.length > 0)
            .sort((a, b) => a.level - b.level);

        for(let cluster of allClusters){
            for(let i = 0; i < cluster.points.length; i++){
                for(let j = i + 1; j < cluster.points.length; j++){
                    let first = cluster.points[i].i;
                    let second = cluster.points[j].i;
                    let key = first < second ? `${first}-${second}` : `${second}-${first}`;

                    if(cophenetic[key] === undefined){
                        cophenetic[key] = cluster.mergeDistance;
                    }
                }
            }
        }

        for(let i = 0; i < data.length; i++){
            for(let j = i + 1; j < data.length; j++){
                let key = `${i}-${j}`;
                if(cophenetic[key] === undefined) continue;

                pairValues.push({
                    original: euclidianDistance(data[i], data[j]),
                    cophenetic: cophenetic[key]
                });
            }
        }

        return pearson(
            pairValues.map((pair) => pair.original),
            pairValues.map((pair) => pair.cophenetic)
        );
    }

    function pearson(xs, ys){
        if(xs.length < 2 || xs.length !== ys.length) return 0;

        let xMean = xs.reduce((sum, v) => sum + v, 0) / xs.length;
        let yMean = ys.reduce((sum, v) => sum + v, 0) / ys.length;
        let num = 0;
        let xDen = 0;
        let yDen = 0;

        for(let i = 0; i < xs.length; i++){
            let dx = xs[i] - xMean;
            let dy = ys[i] - yMean;
            num += dx * dy;
            xDen += dx * dx;
            yDen += dy * dy;
        }

        let den = Math.sqrt(xDen * yDen);
        return den === 0 ? 0 : num / den;
    }

    // Serie da plottare sotto il pannello metrics. La logica e' diversa per
    // ogni algoritmo: K-Means non salva l'inertia, ricalcoliamo dagli step;
    // GMM e Fuzzy invece hanno gia' i numeri buoni dentro lo step.
    function convergenceSeries(mode, steps){
        if(!steps || steps.length === 0) return null;

        if(mode === "kmeans"){
            let values = steps
                .map((step) => inertiaFromStep(step))
                .filter((value) => Number.isFinite(value));
            if(values.length < 2) return null;
            return { label: "Inertia", values, lowerIsBetter: true };
        }

        if(mode === "gmm"){
            let values = steps
                .map((step) => step.logLikelihood)
                .filter((value) => Number.isFinite(value));
            if(values.length < 2) return null;
            return { label: "Log-likelihood", values, lowerIsBetter: false };
        }

        if(mode === "fuzzy"){
            let values = steps
                .map((step) => step.memberships ? fuzzyEntropy(step.memberships) : null)
                .filter((value) => value !== null && Number.isFinite(value));
            if(values.length < 2) return null;
            return { label: "Entropy", values, lowerIsBetter: true };
        }

        return null;
    }

    // K-Means non espone l'inertia per step: ce la ricostruiamo dal layout
    // del cluster (stessi dati usati per il rendering).
    function inertiaFromStep(step){
        if(!step || !step.clusters) return NaN;
        let total = 0;
        for(let cluster of step.clusters){
            let centroid = cluster.centroid;
            let points = cluster.points || [];
            if(!centroid) continue;
            for(let point of points){
                let d = euclidianDistance(point, centroid);
                total += d * d;
            }
        }
        return total;
    }

    return { computeMetrics, convergenceSeries };
})();
