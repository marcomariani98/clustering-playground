"use strict";

// Shared utilities and constants for the entire playground.
// This module provides DOM helpers, math utilities, and a color palette.

// Shared color palette: 50 sufficiently distinct colors before cycling.
// If more than 50 clusters are needed, the issue is elsewhere, not the colors.
// Colors are curated for accessibility and visual distinction across colorblind profiles.
const cluster_color = [
    "#e6194b", "#3cb44b", "#e5c700", "#4363d8", "#f58231", "#911eb4",
    "#46f0f0", "#f032e6", "#bcf60c", "#fabebe", "#008080", "#e6beff",
    "#9a6324", "#db8707", "#800000", "#aaffc3", "#808000", "#ffd8b1",
    "#000075", "#808080", "#548075", "#e100ff",
    "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b",
    "#17becf", "#7f7f00", "#003f5c", "#ffa600", "#665191", "#a05195",
    "#f95d6a", "#4d9221", "#c51b7d", "#2166ac", "#762a83", "#b35806",
    "#01665e", "#5e3c99", "#e66101", "#4393c3", "#d73027", "#66a61e",
    "#e7298a", "#7570b3", "#1b7837", "#b2182b"
];

// Canvas drawing constants: point radius and cross-hair size (in pixels).
const pointSize = 4;
const crossSize = 20;

// Get a DOM element by ID. Shorthand for document.getElementById.
function DOM(id){
    return document.getElementById(id);
}

// Get the value of an input element (e.g., <input type="range">, <select>).
function DOMgetValue(id){
    return DOM(id).value;
}

// Set the text content of a DOM element. Used for status updates and labels.
function DOMsetValue(id, value){
    DOM(id).textContent = value;
}

// Compute Euclidean distance between two 2D points.
// Used frequently in clustering algorithms; no micro-optimization yet
// (e.g., avoiding Math.pow for squaring).
function euclidianDistance(point1, point2){
    let dx = Math.pow(point2.x - point1.x, 2);
    let dy = Math.pow(point2.y - point1.y, 2);
    return Math.sqrt(dx + dy);
}

// Return a random number in [min, max).
function randomBetween(min, max){
    return min + Math.random() * (max - min);
}

// Clamp a value to a range [min, max].
function clamp(value, min, max){
    return Math.max(min, Math.min(max, value));
}

// Check if two points are identical (same x, y, and optional index i).
// The index i can be present if points carry metadata (e.g., in some algorithms).
function isSamePoint(point1, point2){
    return point1.x === point2.x && point1.y === point2.y && point1.i === point2.i;
}

// Check if a point exists in a flat array of points.
function isInArray(arr, point){
    return arr.some((element) => isSamePoint(element, point));
}

// Check if a point exists anywhere in a 2D array of clusters (array of arrays).
function isInCluster(arr, point){
    return arr.some((cluster) => {
        return cluster.some((element) => isSamePoint(element, point));
    });
}

// Find the maximum distance from a centroid to any point in the set,
// then add 18 pixels (buffer for visualization). Used by some renderers
// to determine circle/halo radii.
function getMaxDist(points, centroid){
    let maxDist = -Infinity;

    for(let point of points){
        let distance = euclidianDistance(point, centroid);

        if(distance > maxDist){
            maxDist = distance;
        }
    }

    return maxDist + 18;
}
