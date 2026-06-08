"use strict";

// Informational panels for the top bar and sidebar: complexity badge,
// legend of visual symbols for the active algorithm, and quality color legend.
// These provide at-a-glance context for understanding the current clustering mode.

// Update the complexity badge in the top-right corner with the worst-case
// time complexity of the currently selected algorithm. The severity level
// (heavy/medium/light) colors the badge as a visual alert when the algorithm
// is computationally expensive. Thresholds match those enforced by safeRun().
function updateComplexityBadge(){
    let badge = DOM("complexityBadge");
    let value = DOM("complexityValue");
    if(!badge || !value) return;

    // Complexity lookup table. n = number of points, k = number of clusters, i = iterations.
    // Light algorithms can handle thousands of points; heavy ones freeze above ~180 points.
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

// Return an array of human-readable legend items describing the visual symbols
// used by the currently active clustering algorithm. Each item explains what
// a color, shape, or line in the visualization represents.
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

// Update the legend display in the sidebar. If the "Show legend" checkbox is
// unchecked, show a single message. Otherwise, render the algorithm-specific
// legend items as an unordered list.
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

// Update the quality legend, which explains the meaning of the colored dots
// next to metric cards. GMM uses four states (good/mixed/weak/needs comparison);
// other algorithms use three states (good/medium/weak).
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
