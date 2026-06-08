"use strict";

// Canvas rendering for information visualizations: convergence sparkline and
// spectral affinity heatmap. The convergence series is calculated in core/metrics.js;
// this module handles only the drawing and DOM updates. All chart colors are
// theme-aware (light/dark mode).

// Update the convergence chart display. Shows a sparkline of the metric value
// over algorithm steps (e.g., centroid variance for K-Means, WCSS, etc.).
// Updates only if there are steps; otherwise hides the chart.
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

// Format a sparkline value for readability. Uses progressively fewer decimal
// places for larger values: 0 decimals for abs >= 1000, 1 for abs >= 10, 2 otherwise.
function formatSpark(value){
    if(!Number.isFinite(value)) return "n/d";
    let abs = Math.abs(value);
    if(abs >= 1000) return value.toFixed(0);
    if(abs >= 10) return value.toFixed(1);
    return value.toFixed(2);
}

// Draw a convergence sparkline on the given canvas. Shows a filled area under the curve
// (gradient from opaque to transparent) and a line on top, with a dot at the final point.
// Handles DPI scaling for crisp rendering on high-DPI displays.
function drawSparkline(canvas, series){
    let ctx = canvas.getContext("2d");
    let dpr = window.devicePixelRatio || 1;
    let cssWidth = canvas.clientWidth || canvas.width;
    let cssHeight = canvas.clientHeight || canvas.height;

    // Resize the canvas to match CSS size and apply DPI scaling for high-DPI displays.
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

    // Map a value index to canvas coordinates. Handle single-value edge case.
    let pointAt = (i) => ({
        x: pad + (values.length === 1 ? 0 : (i / (values.length - 1)) * plotW),
        y: pad + (1 - (values[i] - min) / range) * plotH
    });

    // Choose accent color based on current theme.
    let accent = isDarkTheme() ? "#4f8cff" : "#1769e0";
    let last = pointAt(values.length - 1);
    let first = pointAt(0);

    // Draw the filled area under the curve with a gradient that fades to transparent.
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

    // Draw the main line connecting all points.
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

    // Draw a dot at the final point to emphasize the endpoint.
    ctx.beginPath();
    ctx.arc(last.x, last.y, 3, 0, 2 * Math.PI, false);
    ctx.fillStyle = accent;
    ctx.fill();
}

// Update sidebar preview panels. Currently shows the affinity heatmap for Spectral
// Clustering. HCluster's dendrogram is drawn directly on the main canvas, so no
// sidebar preview is needed for it. Previews are hidden when there's no result.
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

    // Note: HCluster's dendrogram grows directly on the main canvas in HClusterRenderer._drawTree,
    // animated with each merge, so no sidebar preview is needed.
}

// Draw an NxN affinity matrix heatmap. Each cell is colored by its weight
// (0 = fully transparent, 1 = full accent color). The matrix grows with dataset size,
// but Spectral is capped at 180 points, so the heatmap stays manageable.
function drawAffinityHeatmap(canvas, result){
    let ctx = canvas.getContext("2d");
    let dpr = window.devicePixelRatio || 1;
    let cssSize = Math.max(canvas.clientWidth, 180);

    // Resize canvas to match CSS size; maintain square aspect ratio. Apply DPI scaling.
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

    // Fill the background.
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, cssSize, cssSize);

    // Draw cells. Skip very weak weights (< 0.02) for visual clarity. Alpha
    // is clamped to 1.0 even if the weight exceeds 1.0.
    for(let i = 0; i < n; i++){
        for(let j = 0; j < n; j++){
            let weight = affinity[i][j] || 0;
            if(weight < 0.02) continue;
            let alpha = Math.min(1, weight);
            ctx.fillStyle = `rgba(${accent[0]}, ${accent[1]}, ${accent[2]}, ${alpha})`;
            ctx.fillRect(j * cell, i * cell, Math.max(1, cell), Math.max(1, cell));
        }
    }

    // Draw a thin border to visually delimit the matrix.
    ctx.strokeStyle = dark ? "rgba(148,163,184,0.30)" : "rgba(148,163,184,0.50)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, cssSize - 1, cssSize - 1);
}
