"use strict";

// Palette condivisa: 50 colori abbastanza contrastanti prima di dover ciclare.
// Se servono piu' cluster di cosi' il problema e' altrove, non nei colori.
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

const pointSize = 4;
const crossSize = 20;

function DOM(id){
    return document.getElementById(id);
}

function DOMgetValue(id){
    return DOM(id).value;
}

function DOMsetValue(id,value){
    DOM(id).textContent = value;
}

function euclidianDistance(point1, point2){
    let dx = Math.pow(point2.x - point1.x, 2);
    let dy = Math.pow(point2.y - point1.y, 2);
    return Math.sqrt(dx + dy);
}

function randomBetween(min, max){
    return min + Math.random() * (max - min);
}

function clamp(value, min, max){
    return Math.max(min, Math.min(max, value));
}

function isSamePoint(point1,point2){
    return point1.x === point2.x && point1.y === point2.y && point1.i === point2.i;
}

function isInArray(arr,point){
    return arr.some((element) => isSamePoint(element,point));
}

function isInCluster(arr,point){
    return arr.some((cluster) => {
        return cluster.some((element) => isSamePoint(element,point));
    });
}

function getMaxDist(points,centroid){
    let maxDist = -Infinity;

    for(let point of points){
        let distance = euclidianDistance(point,centroid);

        if(distance > maxDist){
            maxDist = distance;
        }
    }

    return maxDist + 18;
}
