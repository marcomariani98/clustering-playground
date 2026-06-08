"use strict";

// Centralized canvas drawing primitives: points, crosses, circles, labels,
// Voronoi backgrounds, etc. No renderer draws directly to the canvas context;
// all drawing goes through this class. Also holds canvas dimensions so algorithms
// and UI code can query width/height without accessing the DOM directly.

class Primitives{
    constructor(canvas){
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.resize();
    }

    resize(){
        let rect = this.canvas.getBoundingClientRect();
        this.canvas.width = Math.max(320, parseInt(rect.width));
        this.canvas.height = Math.max(320, parseInt(rect.height));
        this.width = this.canvas.width;
        this.height = this.canvas.height;
    }

    reset(){
        this.ctx.clearRect(0, 0, this.width, this.height);
    }

    getMouse(event){
        let rect = this.canvas.getBoundingClientRect();
        return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };
    }

    drawPoints(data, color){
        for(let point of data){
            this.ctx.beginPath();
            this.ctx.arc(point.x, point.y, pointSize, 0, 2 * Math.PI, false);
            this.ctx.fillStyle = color;
            this.ctx.fill();
        }
    }

    drawPointAlpha(point, color, alpha){
        this.ctx.beginPath();
        this.ctx.arc(point.x, point.y, pointSize, 0, 2 * Math.PI, false);
        this.ctx.fillStyle = this.colorAlpha(color, alpha);
        this.ctx.fill();
    }

    drawCentroids(centroids, color){
        for(let centroid of centroids){
            this.ctx.beginPath();
            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = 1.5;
            this.ctx.moveTo(centroid.x - crossSize / 2, centroid.y);
            this.ctx.lineTo(centroid.x + crossSize / 2, centroid.y);
            this.ctx.moveTo(centroid.x, centroid.y - crossSize / 2);
            this.ctx.lineTo(centroid.x, centroid.y + crossSize / 2);
            this.ctx.stroke();
        }
    }

    drawRadius(x, y, radius, color = "black", lineWidth = 1){
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, 2 * Math.PI, false);
        this.ctx.lineWidth = lineWidth;
        this.ctx.strokeStyle = color;
        this.ctx.stroke();
    }

    drawLabel(point, text, color = "#111827", font = "12px Arial"){
        this.ctx.fillStyle = color;
        this.ctx.font = font;
        this.ctx.fillText(String(text), point.x + 6, point.y + 12);
    }

    drawSoftLabel(point, text, isActive){
        this.ctx.save();
        this.ctx.font = isActive ? "700 11px Arial" : "10px Arial";
        this.ctx.fillStyle = isActive ? "rgba(17, 24, 39, 0.92)" : "rgba(71, 85, 105, 0.58)";
        this.ctx.fillText(String(text), point.x + 6, point.y + 12);
        this.ctx.restore();
    }

    drawInfo(text){
        this.ctx.save();
        this.ctx.font = "700 13px Arial";
        this.ctx.fillStyle = this.inkColor(0.78);
        this.ctx.fillText(text, 16, 24);
        this.ctx.restore();
    }

    // Colore "ink" sensibile al tema. Usato dove serve testo leggibile sul canvas
    // in entrambe le palette. Per i colori cluster non serve, sono gia' visibili.
    isDarkTheme(){
        return document.documentElement.dataset.theme === "dark";
    }

    inkColor(opacity = 1){
        return this.isDarkTheme()
            ? `rgba(226, 232, 240, ${opacity})`
            : `rgba(17, 24, 39, ${opacity})`;
    }

    // Colore "glyph" pieno: per centroidi neri, punti raw, etichette su canvas.
    // E' la versione hex senza alpha — utile dove serve passare un colore valido
    // a drawCentroids/drawPoints/drawLabel che vogliono una stringa hex.
    glyphColor(){
        return this.isDarkTheme() ? "#e2e8f0" : "#111827";
    }

    // Sfondo dei pannelli flottanti dentro al canvas (embedding Spectral,
    // dendrogramma HCluster). In light era bianco, in dark un grigio profondo.
    panelBg(opacity = 0.94){
        return this.isDarkTheme()
            ? `rgba(22, 30, 46, ${opacity})`
            : `rgba(255, 255, 255, ${opacity})`;
    }

    // Voronoi sfumato sui centroidi: usato da K-Means e Fuzzy.
    drawCentroidBoundaries(centroids){
        let cellSize = 10;

        for(let y = 0; y < this.height; y += cellSize){
            for(let x = 0; x < this.width; x += cellSize){
                let probe = { x: x + cellSize / 2, y: y + cellSize / 2 };
                let pick = 0;
                let minDistance = Infinity;

                for(let [i, centroid] of centroids.entries()){
                    let d = euclidianDistance(probe, centroid);
                    if(d < minDistance){
                        minDistance = d;
                        pick = i;
                    }
                }

                this.ctx.fillStyle = this.colorAlpha(cluster_color[pick % cluster_color.length], 0.12);
                this.ctx.fillRect(x, y, cellSize, cellSize);
            }
        }
    }

    // Voronoi sul punto piu' vicino dentro un cluster: usato da Spectral
    // (e potrebbe esserlo da DBSCAN, ma DBSCAN ha una variante che si ferma a eps).
    drawNearestPointBoundaries(clusters){
        let cellSize = 10;

        for(let y = 0; y < this.height; y += cellSize){
            for(let x = 0; x < this.width; x += cellSize){
                let probe = { x: x + cellSize / 2, y: y + cellSize / 2 };
                let pick = -1;
                let minDistance = Infinity;

                for(let [i, cluster] of clusters.entries()){
                    for(let p of cluster){
                        let d = euclidianDistance(probe, p);
                        if(d < minDistance){
                            minDistance = d;
                            pick = i;
                        }
                    }
                }

                if(pick >= 0){
                    this.ctx.fillStyle = this.colorAlpha(cluster_color[pick % cluster_color.length], 0.10);
                    this.ctx.fillRect(x, y, cellSize, cellSize);
                }
            }
        }
    }

    centroidOf(points){
        let x = 0;
        let y = 0;
        for(let point of points){
            x += point.x;
            y += point.y;
        }
        return { x: x / points.length, y: y / points.length };
    }

    roundRect(x, y, width, height, radius){
        this.ctx.beginPath();
        this.ctx.moveTo(x + radius, y);
        this.ctx.lineTo(x + width - radius, y);
        this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        this.ctx.lineTo(x + width, y + height - radius);
        this.ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        this.ctx.lineTo(x + radius, y + height);
        this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        this.ctx.lineTo(x, y + radius);
        this.ctx.quadraticCurveTo(x, y, x + radius, y);
        this.ctx.closePath();
    }

    colorAlpha(hexColor, alpha){
        let raw = hexColor.replace("#", "");
        let r = parseInt(raw.slice(0, 2), 16);
        let g = parseInt(raw.slice(2, 4), 16);
        let b = parseInt(raw.slice(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
}
