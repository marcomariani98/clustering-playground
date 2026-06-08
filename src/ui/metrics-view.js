"use strict";

// Metrics panel rendering: quality cards, GMM dashboard, and model comparison table.
// This module handles only HTML generation and DOM updates. The actual metric
// calculations live in core/metrics.js (the Metrics IIFE module). GMM run history
// is stored in state.gmmModelComparisons and state.gmmComparisonDatasetKey.

// Update the metrics panel display. Handles three cases:
// 1. No result yet: show a hint
// 2. GMM mode: render the dashboard with model comparison table
// 3. Other algorithms: render metric cards in a simple grid
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
        modelComparisons: state.mode === "gmm" ? state.gmmModelComparisons : []
    });

    if(metrics.length === 0){
        panel.innerHTML = "<p class=\"hint\">Metrics are not available for this result.</p>";
        return;
    }

    panel.innerHTML = state.mode === "gmm"
        ? renderGMMMetrics(metrics, state.gmmModelComparisons)
        : metrics.map((metric) => renderMetricCard(metric)).join("");
}

// Render the GMM-specific metrics dashboard. This includes:
// - Assignment metrics (confidence and uncertainty)
// - Model selection metrics (likelihood, AIC, BIC)
// - A table comparing AIC/BIC across different component counts
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

// Render the GMM model comparison table. Displays all saved runs for the current dataset
// with AIC and BIC scores as bar fills (lower = wider bar). The current run is highlighted.
// Runs that win AIC or BIC get a gradient background. This allows users to visually
// compare model quality across different component counts.
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

    // Find the component counts that achieve the best AIC and BIC scores.
    let bestAicK = sorted.find((entry) => Math.abs(entry.aic - bestAic) < 0.000001).components;
    let bestBicK = sorted.find((entry) => Math.abs(entry.bic - bestBic) < 0.000001).components;

    // Normalize score to a 0–1 bar fill. Invert the range so lower scores produce wider bars.
    let normalize = (value, min, max) => {
        if(max - min < 0.000001) return 1;
        // Inverted: lower score → wider bar (lower is better in AIC/BIC).
        return 1 - (value - min) / (max - min);
    };

    let rows = sorted.map((entry) => {
        let isCurrent = entry.components === currentK;
        let isBestAic = Math.abs(entry.aic - bestAic) < 0.000001;
        let isBestBic = Math.abs(entry.bic - bestBic) < 0.000001;
        // Scale normalized value to 20–100% (minimum visible bar width is 20%).
        let aicFill = (0.20 + 0.80 * normalize(entry.aic, bestAic, aicMax)) * 100;
        let bicFill = (0.20 + 0.80 * normalize(entry.bic, bestBic, bicMax)) * 100;
        // BIC win gets ★ (solid star), AIC win gets ☆ (hollow star).
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

    // Show whether AIC and BIC agree on the best k. Agreement is stronger evidence.
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

// Format a comparison number (AIC/BIC score) for display. Very large numbers get
// no decimal places; medium-sized numbers get zero decimals; small numbers get one.
function formatComparisonNumber(value){
    if(!Number.isFinite(value)) return "n/d";
    let abs = Math.abs(value);
    if(abs >= 10000) return value.toFixed(0);
    if(abs >= 100) return value.toFixed(0);
    return value.toFixed(1);
}

// Render a single metric card (for K-Means, DBSCAN, etc.). The card includes:
// - A colored dot (quality indicator)
// - The metric name and value
// - An optional horizontal bar (for metrics in [0,1])
// - A tooltip with explanation
function renderMetricCard(metric, extraClass = ""){
    let indicator = `<span class="metric-dot" aria-label="${escapeAttr(metric.title)}"></span>`;
    let bar = "";

    // Add a gauge bar only for metrics with a meaningful [0,1] range
    // (silhouette, Davies-Bouldin, etc.). Invert if needed (lower is better).
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
